import { asShroomError } from './errors.js';

/**
 * 帧订阅中心：所有 device 共用这一套回调管理。
 *
 * 帧率可能到 100Hz，回调里别做重活；一个回调抛错不影响其他回调。
 */
export function createFrameHub() {
  const listeners = new Set();
  const errorListeners = new Set();
  let lastError = null;

  function emitError(error) {
    lastError = error;
    if (!errorListeners.size) console.error('[shroom]', error);
    for (const handler of [...errorListeners]) {
      try { handler(error); }
      catch (callbackError) { console.error('[shroom] onError 回调出错：', callbackError); }
    }
  }

  return {
    /** 订阅每一帧，返回取消订阅的函数 */
    onFrame(handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('onFrame 需要传一个函数');
      }
      listeners.add(handler);
      return () => listeners.delete(handler);
    },

    onError(handler) {
      if (typeof handler !== 'function') throw new TypeError('onError 需要传一个函数');
      errorListeners.add(handler);
      return () => errorListeners.delete(handler);
    },

    emitError,

    get lastError() { return lastError; },

    emit(frame) {
      for (const handler of [...listeners]) {
        try {
          handler(frame);
        } catch (err) {
          emitError(asShroomError(err, { code: 'CALLBACK_FAILED', stage: 'callback', message: '应用的 onFrame 回调执行失败' }));
        }
      }
    },

    clear() {
      listeners.clear();
      errorListeners.clear();
    },

    get count() {
      return listeners.size;
    },
  };
}
