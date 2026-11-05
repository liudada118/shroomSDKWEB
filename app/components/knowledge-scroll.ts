'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** 离底部这么近就算回到了最新内容，恢复跟随。 */
const FOLLOW_THRESHOLD_PX = 80;

/**
 * 回答流式输出时让对话框跟着新内容往下走；用户往上翻看时不再把人拽回底部，
 * 滚回底部附近或发出新问题后恢复跟随。
 *
 * 用户有没有往上翻，靠对比「上次自动滚到的位置」判断，不监听 scroll 事件：
 * 它要到下一帧才派发，回答一秒更新几十次，事件还没到就被下一次自动滚动盖掉了。
 */
export function useFollowLatest(
  containerRef: RefObject<HTMLElement | null>,
  messages: readonly unknown[],
  active = true,
) {
  const followRef = useRef(true);
  const messageCountRef = useRef(messages.length);
  const lastAutoScrollRef = useRef<{ element: HTMLElement; top: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const last = lastAutoScrollRef.current?.element === container ? lastAutoScrollRef.current : null;
    const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (messages.length > messageCountRef.current || !last) {
      // 新提问总要露出来；弹窗重新打开时换了滚动容器，也从最新内容开始
      followRef.current = true;
    } else if (container.scrollTop < last.top - 4) {
      followRef.current = false;
    } else if (fromBottom <= FOLLOW_THRESHOLD_PX) {
      followRef.current = true;
    }
    messageCountRef.current = messages.length;

    if (!followRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    lastAutoScrollRef.current = { element: container, top: container.scrollTop };
  }, [containerRef, messages, active]);
}
