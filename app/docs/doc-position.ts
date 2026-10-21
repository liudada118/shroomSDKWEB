export type HeadingPosition = { id: string; top: number };

export type DocOutlineItem = {
  id: string;
  text: string;
  level: number;
  language?: 'node' | 'python';
  description?: string;
};

export function groupDocOutline(items: readonly DocOutlineItem[], language: 'node' | 'python') {
  const groups: { heading: DocOutlineItem; children: DocOutlineItem[] }[] = [];
  for (const item of items) {
    if (item.language && item.language !== language) continue;
    if (item.level === 2 || !groups.length) groups.push({ heading: item, children: [] });
    else groups[groups.length - 1].children.push(item);
  }
  return groups;
}

/** Only visible headings participate; scrolling never rewrites the URL. */
export function currentDocHeading(headings: readonly HeadingPosition[], atEnd = false, offset = 128) {
  if (atEnd) return headings.at(-1)?.id ?? '';
  let current = '';
  let closest = -Infinity;
  for (const heading of headings) {
    if (heading.top <= offset && heading.top >= closest) {
      current = heading.id;
      closest = heading.top;
    }
  }
  return current;
}
