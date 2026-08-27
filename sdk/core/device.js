/**
 * 帧订阅中心：所有 device 共用这一套回调管理。
 *
 * 帧率可能到 100Hz，回调里别做重活；一个回调抛错不影响其他回调。
 */
export function createFrameHub() {
  const listeners = new Set();

  return {
    /** 订阅每一帧，返回取消订阅的函数 */
    onFrame(handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('onFrame 需要传一个函数');
      }
      listeners.add(handler);
      return () => listeners.delete(handler);
    },

    emit(frame) {
      for (const handler of listeners) {
        try {
          handler(frame);
        } catch (err) {
          console.error('[shroom] onFrame 回调出错：', err);
        }
      }
    },

    clear() {
      listeners.clear();
    },

    get count() {
      return listeners.size;
    },
  };
}
