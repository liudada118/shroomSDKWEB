/** 官网分发的接入 Skill：只打包明确列出的说明，不包含 SDK、配置或客户数据。 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SKILL_NAME = 'shroom-sdk';
export const SKILL_ARCHIVE = 'shroom-sdk-skill.zip';
export const SKILL_FILES = Object.freeze(['SKILL.md', 'agents/openai.yaml', 'references/integration.md']);

/** 拒绝源码目录内的链接，防止白名单文件间接指向本机配置。 */
async function readSkillFile(projectRoot, file) {
  let current = projectRoot;
  for (const segment of ['skills', SKILL_NAME, ...file.split('/')]) {
    current = join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('Skill 打包不接受符号链接：' + file);
  }
  if (!(await lstat(current)).isFile()) throw new Error('Skill 必须是普通文件：' + file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(current));
  return Buffer.from(text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), 'utf8');
}

/** 固定文件顺序、换行与 DOS 时间，使用现有 fflate 生成可复现的标准 ZIP。 */
export async function createIntegrationSkillArchive({ projectRoot = ROOT } = {}) {
  const entries = {};
  const files = new Map();
  for (const file of [...SKILL_FILES].sort()) {
    const bytes = await readSkillFile(projectRoot, file);
    files.set(file, bytes);
    entries[`${SKILL_NAME}/${file}`] = bytes;
  }
  if (!/^---\nname: shroom-sdk\ndescription: .+\n---\n/.test(files.get('SKILL.md').toString())) {
    throw new Error('Skill 缺少有效的 name / description frontmatter。');
  }
  const bytes = Buffer.from(zipSync(entries, { level: 9, mtime: new Date(2026, 0, 1, 0, 0, 0) }));
  return { bytes, files, manifest: {
    schema: 'shroom.integration-skill.v1',
    name: SKILL_NAME,
    sdkBaseline: '0.4.0',
    file: SKILL_ARCHIVE,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    entries: [...files.keys()].map(file => `${SKILL_NAME}/${file}`),
  } };
}

/** 写入官网静态下载目录；原文供下载前查看，清单用于独立核对制品。 */
export async function packIntegrationSkill({ projectRoot = ROOT, outputDirectory, log = console.log } = {}) {
  const result = await createIntegrationSkillArchive({ projectRoot });
  const output = resolve(outputDirectory ?? join(projectRoot, 'public', 'skills'));
  await mkdir(output, { recursive: true });
  await writeFile(join(output, SKILL_ARCHIVE), result.bytes);
  await writeFile(join(output, 'shroom-sdk-skill.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  for (const [file, bytes] of result.files) {
    const target = join(output, SKILL_NAME, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  log(`Shroom Skill 已生成：${SKILL_ARCHIVE}（${result.manifest.size} bytes，3 个文件）`);
  return { ...result, outputDirectory: output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  packIntegrationSkill().catch(error => { console.error(error.message); process.exitCode = 1; });
}
