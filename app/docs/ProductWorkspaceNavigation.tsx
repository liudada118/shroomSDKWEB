'use client';

import Link from 'next/link';
import { useProductWorkspace } from './product-workspace-state';
import { workspaceProducts, type WorkspaceTab } from './product-workspace-model';
import styles from './ProductWorkspaceNavigation.module.css';

/** 产品工作台按接入准备、调用流程和参考任务导航。 */
export default function ProductWorkspaceNavigation({ onNavigate }: { onNavigate: () => void }) {
  const { state, setTab } = useProductWorkspace();
  const currentProduct = workspaceProducts.find(product => product.id === state.product)!;
  const references: { tab: WorkspaceTab; label: string }[] = [
    { tab: 'guide', label: '接入准备' },
    { tab: 'start', label: '调用流程' },
    { tab: 'data', label: '数据字段与映射' },
    { tab: 'debug', label: '问题排查' },
    { tab: 'downloads', label: 'SDK 与驱动下载' },
  ];

  return <nav aria-label="产品接入文档目录" className={`docs-navigation ${styles.navigation}`}>
    <Link href="/docs" onClick={onNavigate} className="docs-quick-link">← 文档中心</Link>
    <div className="docs-menu-group">
      <p className="docs-menu-caption">快速接入</p>
      {references.map(reference => <button type="button" key={reference.tab}
        className={`docs-menu-link ${styles.referenceLink}`} aria-current={state.tab === reference.tab ? 'page' : undefined}
        onClick={() => { setTab(reference.tab); onNavigate(); }}>{reference.label}</button>)}
    </div>
    <div className="docs-menu-group">
      <p className="docs-menu-caption">产品资料</p>
      <div className={styles.currentProduct}><span>{currentProduct.label}</span><span className={styles.currentLabel}>当前示例</span></div>
      <Link href="/docs/products" onClick={onNavigate} className="docs-menu-link">所有产品资料 →</Link>
    </div>
    <div className="docs-menu-group">
      <p className="docs-menu-caption">开发支持</p>
      <Link href="/docs/drivers" onClick={onNavigate} className="docs-menu-link">驱动与运行环境</Link>
      <Link href="/docs/license" onClick={onNavigate} className="docs-menu-link">SDK 授权说明</Link>
    </div>
    <div className="docs-menu-group">
      <p className="docs-menu-caption">开发参考</p>
      <Link href="/docs/custom" onClick={onNavigate} className="docs-menu-link">基础与自定义 API →</Link>
    </div>
    <div className="docs-menu-help"><Link href="/knowledge" onClick={onNavigate} className="docs-menu-link">AI 文档助手 ↗</Link></div>
  </nav>;
}
