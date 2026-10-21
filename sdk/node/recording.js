import { mkdir, open, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { ShroomError } from '../core/errors.js';
import { STREAM_SCHEMA } from '../core/stream-codec.js';

export const RECORDING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUEUE_BYTES = 16 * 1024 * 1024;
const CSV_COLUMNS = ['sessionId', 'label', 'index', 'timestamp', 'source', 'product', 'side', 'sequence', 'raw', 'pressure', 'pressureMatrix', 'fingers', 'palm', 'frame'];

/** Build a recording-specific error without exposing filesystem paths to WS clients. */
function recordingError(code, message, cause) {
  return new ShroomError(code, message, { stage: 'recording', cause });
}

/** Protect spreadsheet applications from formula execution while retaining proper CSV escaping. */
function csvCell(value) {
  let text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Stream UTF-8/BOM CSV from persisted JSONL without loading a whole recording into memory. */
export async function* recordingCsv(path) {
  yield `\ufeff${CSV_COLUMNS.map(csvCell).join(',')}\r\n`;
  const input = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line) continue;
      const row = JSON.parse(line);
      const frame = row.frame;
      const values = { ...row, product: frame.product, side: frame.side, sequence: frame.sequence,
        raw: frame.raw, pressure: frame.pressure, pressureMatrix: frame.pressureMatrix,
        fingers: frame.fingers, palm: frame.palm, frame };
      yield `${CSV_COLUMNS.map((key) => csvCell(values[key])).join(',')}\r\n`;
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

/** Create a persistent, bounded single-session recorder; all frames must already be wire-encoded. */
export async function createRecordingStore({ directory, maxQueueFrames = 1000, onChange = () => {} }) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const records = new Map();
  let active = null;
  let starting = false;
  let closed = false;

  /** Persist metadata atomically so successful stop survives a later server restart. */
  async function saveMeta(meta) {
    const tempPath = join(root, `${meta.id}.meta.tmp`);
    await writeFile(tempPath, JSON.stringify(meta, null, 2), 'utf8');
    await rename(tempPath, join(root, `${meta.id}.meta.json`));
    records.set(meta.id, { ...meta });
  }

  for (const file of await readdir(root)) {
    const id = file.replace(/\.meta\.json$/, '');
    if (!file.endsWith('.meta.json') || !RECORDING_ID.test(id)) continue;
    try {
      const meta = JSON.parse(await readFile(join(root, file), 'utf8'));
      if (meta.id !== id || !['recording', 'stopped', 'error'].includes(meta.status)) continue;
      if (meta.status === 'recording') {
        meta.status = 'error';
        meta.endedAt = Date.now();
        meta.error = { code: 'RECORDING_INTERRUPTED', message: '上次服务退出前未正常停止录制；文件可能不完整。' };
        await saveMeta(meta);
      }
      records.set(id, meta);
    } catch { /* A corrupt/unrelated file is not a downloadable SDK session. */ }
  }

  /** Return a detached snapshot; callers cannot mutate recorder state. */
  function snapshot(meta = active?.meta) {
    return meta ? { ...meta, ...(meta.error ? { error: { ...meta.error } } : {}) } : null;
  }

  /** Deliver status notifications without letting application callbacks stop persistence. */
  function notify(meta) {
    try { onChange(snapshot(meta)); } catch { /* Observers cannot alter the recording lifecycle. */ }
  }

  /** Mark an explicit failure and stop accepting additional frames. */
  function fail(session, error) {
    if (session.meta.status === 'error') return;
    session.accepting = false;
    session.meta.status = 'error';
    session.meta.error = { code: error.code ?? 'RECORDING_WRITE_FAILED', message: error.message };
    notify(session.meta);
    void finish(session).catch(() => {});
  }

  /** Drain queued frames serially; only successfully written rows count as recorded frames. */
  async function pump(session) {
    if (session.pumping) return session.pumping;
    session.pumping = (async () => {
      while (session.queue.length) {
        const row = session.queue.shift();
        try {
          await session.file.writeFile(row.text, 'utf8');
          session.meta.frameCount += 1;
        } catch (cause) {
          session.queue.length = 0;
          session.queuedBytes = 0;
          session.outstanding = 1;
          fail(session, recordingError('RECORDING_WRITE_FAILED', '录制文件写入失败，请检查磁盘空间和目录权限。', cause));
        } finally {
          session.outstanding -= 1;
          session.queuedBytes = Math.max(0, session.queuedBytes - row.bytes);
        }
      }
    })().finally(() => { session.pumping = null; });
    return session.pumping;
  }

  /** Flush accepted frames, close the file and persist final metadata once. */
  async function finish(session) {
    if (session.finishing) return session.finishing;
    session.accepting = false;
    session.finishing = (async () => {
      await pump(session);
      try { await session.file.sync(); }
      catch {
        session.meta.status = 'error';
        session.meta.error = { code: 'RECORDING_WRITE_FAILED', message: '录制文件同步失败，请检查磁盘。' };
      }
      try { await session.file.close(); }
      catch {
        session.meta.status = 'error';
        session.meta.error = { code: 'RECORDING_WRITE_FAILED', message: '录制文件关闭失败。' };
      }
      session.meta.endedAt = Date.now();
      if (session.meta.status !== 'error') session.meta.status = 'stopped';
      try { await saveMeta(session.meta); }
      catch (cause) {
        session.meta.status = 'error';
        session.meta.error = { code: 'RECORDING_WRITE_FAILED', message: '录制元信息保存失败，不能保证重启后可下载。' };
        records.set(session.meta.id, snapshot(session.meta));
        throw recordingError('RECORDING_WRITE_FAILED', session.meta.error.message, cause);
      } finally {
        notify(session.meta);
      }
      return snapshot(session.meta);
    })();
    return session.finishing;
  }

  return {
    /** Start a new immutable-label session; one recorder cannot run two sessions concurrently. */
    async start({ label, product, side, source } = {}) {
      if (closed) throw recordingError('SERVER_CLOSED', '服务已关闭。');
      if (starting || (active && !active.finishing && active.accepting)) throw recordingError('RECORDING_ACTIVE', '请先停止当前录制，再开始新的标签录制。');
      if (typeof label !== 'string' || !label.trim() || label.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(label)) {
        throw recordingError('INVALID_CONFIG', '标签需要是 1–200 字符的非空文本，不能包含控制字符。');
      }
      starting = true;
      try {
        if (active?.finishing) await active.finishing;
        const meta = { id: randomUUID(), label: label.trim(), startedAt: Date.now(), endedAt: null, frameCount: 0, status: 'recording',
          ...(product ? { product } : {}), ...(side ? { side } : {}), ...(source ? { source } : {}) };
        const file = await open(join(root, `${meta.id}.jsonl`), 'wx');
        try { await saveMeta(meta); } catch (error) { await file.close(); throw error; }
        active = { meta, file, accepting: true, queue: [], queuedBytes: 0, outstanding: 0, nextIndex: 0, pumping: null, finishing: null };
        notify(meta);
        return snapshot(meta);
      } catch (cause) {
        if (cause instanceof ShroomError) throw cause;
        throw recordingError('RECORDING_WRITE_FAILED', '无法创建录制文件，请检查录制目录权限和磁盘空间。', cause);
      } finally { starting = false; }
    },

    /** Accept one frame without blocking acquisition; overflow ends the recording with an explicit error. */
    append(frame) {
      const session = active;
      if (!session?.accepting) return;
      const row = { schema: STREAM_SCHEMA, sessionId: session.meta.id, label: session.meta.label,
        index: session.nextIndex, timestamp: frame.timestamp, source: session.meta.source ?? '', frame };
      const text = `${JSON.stringify(row)}\n`;
      const bytes = Buffer.byteLength(text);
      if (session.outstanding >= maxQueueFrames || session.queuedBytes + bytes > MAX_QUEUE_BYTES) {
        fail(session, recordingError('RECORDING_OVERFLOW', '磁盘写入跟不上采集，录制已停止；已接收帧会写完，请降低采集频率或使用更快磁盘。'));
        return;
      }
      session.queue.push({ text, bytes });
      session.nextIndex += 1;
      session.outstanding += 1;
      session.queuedBytes += bytes;
      queueMicrotask(() => { void pump(session); });
    },

    /** Stop explicitly after all accepted frames have reached disk. */
    async stop() {
      if (!active) throw recordingError('RECORDING_NOT_ACTIVE', '当前没有录制任务。');
      return finish(active);
    },

    /** End an active session as an error while preserving and flushing previously accepted frames. */
    async abort(error) {
      if (!active?.accepting) return active?.finishing ?? snapshot();
      fail(active, error);
      return active.finishing;
    },

    /** Report the latest session, including stopped/error state, or null before first recording. */
    status() { return snapshot(); },

    /** List persisted sessions newest first, including the current in-memory progress. */
    list() {
      const list = new Map(records);
      if (active) list.set(active.meta.id, snapshot());
      return [...list.values()].map((meta) => snapshot(meta)).sort((a, b) => b.startedAt - a.startedAt);
    },

    /** Resolve only a known final UUID session; never accept arbitrary filesystem paths. */
    download(id) {
      if (!RECORDING_ID.test(id)) throw recordingError('RECORDING_NOT_FOUND', '找不到录制文件。');
      const meta = active?.meta.id === id ? active.meta : records.get(id);
      if (!meta) throw recordingError('RECORDING_NOT_FOUND', '找不到录制文件。');
      if (meta.status === 'recording' || (active?.meta.id === id && active.finishing && !active.meta.endedAt)) {
        throw recordingError('RECORDING_ACTIVE', '请先停止录制并等待文件写入完成，再下载。');
      }
      return { meta: snapshot(meta), path: join(root, `${id}.jsonl`) };
    },

    /** Flush a running session; file ownership stays with this recorder, device ownership does not. */
    async close() {
      closed = true;
      if (active) await finish(active);
    },
  };
}
