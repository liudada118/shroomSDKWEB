'use client';

import { useEffect } from 'react';
import { consumePendingAnchor } from './knowledge-jump';

/** Highlights the section a cross-page AI jump was aimed at, once it exists. */
export default function SectionLocateFlash() {
  useEffect(() => {
    consumePendingAnchor();
  }, []);

  return null;
}
