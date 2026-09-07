'use client';

import type { DocSectionRef, DocsPageId } from '../docs-data';

const PENDING_ANCHOR_KEY = 'shroom-knowledge-pending-anchor';
const FLASH_CLASS = 'doc-locate-flash';
const FLASH_DURATION_MS = 1_600;

export function pageForPathname(pathname: string): DocsPageId | undefined {
  if (pathname === '/docs/backend' || pathname.startsWith('/docs/backend/')) return 'backend';
  if (pathname === '/docs' || pathname.startsWith('/docs#')) return 'sdk';
  return undefined;
}

/** Scrolls to a section on the current page and briefly highlights it. */
export function flashSection(anchor: string): boolean {
  const element = document.getElementById(anchor);
  if (!element) return false;

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.focus({ preventScroll: true });
  element.classList.add(FLASH_CLASS);
  window.setTimeout(() => element.classList.remove(FLASH_CLASS), FLASH_DURATION_MS);

  // Keep the URL and the sidebar (docs-navigation listens for hashchange) in sync
  // without triggering a second, competing scroll.
  if (window.location.hash !== `#${anchor}`) {
    window.history.replaceState(null, '', `#${anchor}`);
    window.dispatchEvent(new Event('hashchange'));
  }
  return true;
}

/**
 * Jumps to a documentation section. Same-page targets scroll and flash directly;
 * anything else is handed to the router with the anchor stashed for the next page.
 */
export function jumpToSection(
  section: DocSectionRef,
  currentPage: DocsPageId | undefined,
  navigate: (href: string) => void,
): void {
  if (section.page === currentPage && flashSection(section.anchor)) return;

  try {
    window.sessionStorage.setItem(PENDING_ANCHOR_KEY, section.anchor);
  } catch {
    // Private mode or storage disabled: the hash alone still gets the user there.
  }
  navigate(section.href);
}

/** Consumes a pending cross-page jump, if one was stashed before navigating. */
export function consumePendingAnchor(): void {
  let anchor: string | null = null;
  try {
    anchor = window.sessionStorage.getItem(PENDING_ANCHOR_KEY);
    if (anchor) window.sessionStorage.removeItem(PENDING_ANCHOR_KEY);
  } catch {
    return;
  }
  if (!anchor) return;

  // The section may render a frame or two after the route commits.
  let attempts = 0;
  const tryFlash = () => {
    if (flashSection(anchor)) return;
    attempts += 1;
    if (attempts < 10) window.setTimeout(tryFlash, 60);
  };
  window.requestAnimationFrame(tryFlash);
}
