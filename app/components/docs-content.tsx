import type { ReactNode } from 'react';
import Link from 'next/link';

export type DocsBreadcrumbItem = {
  label: string;
  href?: string;
};

export function DocsBreadcrumb({ items }: { items: readonly DocsBreadcrumbItem[] }) {
  return (
    <nav aria-label="面包屑" className="inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] shadow-sm">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="text-[var(--focus)]">/</span> : null}
              {item.href && !current ? (
                <Link href={item.href} className="transition hover:text-[var(--accent-strong)] hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DocsPageIntro({
  breadcrumb,
  title,
  description,
  children,
}: {
  breadcrumb: readonly DocsBreadcrumbItem[];
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <DocsBreadcrumb items={breadcrumb} />
      <h1 className="mt-6 max-w-3xl text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-[var(--text-strong)]">
        {title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-muted)]">{description}</p>
      {children}
    </>
  );
}

export function DocsSectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">{eyebrow}</p>
      ) : null}
      <h2 className={`${eyebrow ? 'mt-3' : ''} text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)] sm:text-[2rem]`}>{title}</h2>
      <div className="mt-4 text-[15px] leading-7 text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

export function DocsInlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.86em] text-[var(--accent-strong)]">
      {children}
    </code>
  );
}
