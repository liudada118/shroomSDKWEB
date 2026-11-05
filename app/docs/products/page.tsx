import type { Metadata } from 'next';
import Link from 'next/link';
import { productCatalog, productGuideHref } from '../../product-catalog';
import styles from './products.module.css';

export const metadata: Metadata = {
  title: '产品接口参考｜Shroom Developer',
  description: '查看 Shroom SDK 已封装产品的协议、数据字段和取数入口。',
};

/** 展示全部已封装产品的实际数据合同，不把展示线序或别名当成独立设备。 */
export default function ProductCatalogPage() {
  return <div className={`docs-page ${styles.page}`}>
    <nav aria-label="文档面包屑" className="docs-breadcrumb"><Link href="/docs">文档中心</Link><span aria-hidden="true">/</span><span aria-current="page">产品接口参考</span></nav>
    <header className={styles.heading}><p>PRODUCT REFERENCE</p><h1>先了解产品，再接入数据。</h1><div>查看 {productCatalog.length} 类产品的协议和字段。分包手套从 SDK 0.4.0 起支持；鞋垫与人体全身从 0.3.0 起支持。</div></header>
    <nav className={styles.index} aria-label="全部产品列表">{productCatalog.map(product => <a key={product.id} href={`#${product.id}`}>{product.name}<span aria-hidden="true">↓</span></a>)}</nav>
    {productCatalog.map(product => <article key={product.id} id={product.id} className={styles.product} aria-labelledby={`${product.id}-title`}>
      <div className={styles.titleRow}><div><p className={styles.alias}>product: &apos;{product.alias}&apos;</p><h2 id={`${product.id}-title`}>{product.name}</h2></div><Link className={styles.action} href={productGuideHref(product)}>查看取数示例 <span aria-hidden="true">→</span></Link></div>
      <p className={styles.slogan}>{product.slogan}</p><p>{product.description}</p>
      <p className={styles.note}>SDK {product.minSdkVersion} 起支持，使用 npm 安装或升级后接入。</p>
      <ul className={styles.facts}>{product.summary.map(fact => <li key={fact}>{fact}</li>)}</ul>
      <p className={styles.connection}>{product.connection}</p>
      <div className={styles.tableScroll} role="region" aria-label={`${product.name}数据字段`} tabIndex={0}><table><caption>{product.name}数据字段</caption><thead><tr><th>字段</th><th>规模</th><th>含义</th></tr></thead><tbody>{product.fields.map(([field, size, detail]) => <tr key={field}><th scope="row"><code>{field}</code></th><td>{size}</td><td>{detail}</td></tr>)}</tbody></table></div>
      <p className={styles.note}>{product.note}</p><Link href={productGuideHref(product, 'guide')} className={styles.textLink}>接入准备与驱动 →</Link>
    </article>)}
    <aside className={styles.custom}><h2>使用其他传感器？</h2><p>通用串口接口支持按协议配置分帧、解析和映射。确认协议后，再扩展产品适配器；不直接套用手套或手垫参数。</p><Link className={styles.textLink} href="/docs/custom">查看基础与自定义 API →</Link></aside>
  </div>;
}
