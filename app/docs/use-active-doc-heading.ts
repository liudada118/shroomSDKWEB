'use client';

import { useEffect, useState } from 'react';
import { currentDocHeading } from './doc-position';

export function useActiveDocHeading(ids: readonly string[]) {
  const [activeId, setActiveId] = useState('');
  const headingKey = ids.join('|');

  useEffect(() => {
    if (!headingKey) return;
    let pendingFrame = 0;
    const update = () => {
      pendingFrame = 0;
      const headings = headingKey.split('|').flatMap((id) => {
        const heading = document.getElementById(id);
        return heading?.getClientRects().length ? [{ id, top: heading.getBoundingClientRect().top }] : [];
      });
      const atEnd = window.scrollY > 0
        && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      setActiveId(currentDocHeading(headings, atEnd));
    };
    const schedule = () => {
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    // Recalculate after a language switch; hidden variants never participate.
    const languageRoot = document.querySelector('.backend-guide');
    const observer = new MutationObserver(schedule);
    if (languageRoot) observer.observe(languageRoot, { attributes: true, attributeFilter: ['data-language'] });
    return () => {
      window.cancelAnimationFrame(pendingFrame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
      observer.disconnect();
    };
  }, [headingKey]);

  return activeId;
}
