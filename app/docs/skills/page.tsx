import type { Metadata } from 'next';
import Link from 'next/link';
import CopyRawButton from '../CopyRawButton';
import styles from './skills.module.css';

export const metadata: Metadata = {
  title: 'AI 接入 Skill｜Shroom Developer',
  description: '下载 Shroom SDK 接入 Skill，安装到项目，让 AI 按真实五步 API 完成设备取数、串口选择、采集与下载。',
  alternates: { canonical: '/docs/skills' },
};

const prompt = '使用 $shroom-sdk，在当前项目接入 Shroom 手部检测垫。先提供串口选择，用 readProduct 一步取数，再按需添加网页采集与下载。密钥由我在本机配置。';
const installPath = '.agents/skills/shroom-sdk/SKILL.md';

/** Skill 安装说明独立成页；下载内容是接入指引包，运行 SDK 另行安装。 */
export default function SkillsPage() {
  return (
    <div className={`docs-page ${styles.page}`}>
      <nav aria-label="文档面包屑" className="docs-breadcrumb">
        <Link href="/docs">文档中心</Link><span aria-hidden="true">/</span><span aria-current="page">AI 接入 Skill</span>
      </nav>
      <header className={styles.header}>
        <p className={styles.eyebrow}>给你的 AI 编程工具</p>
        <h1>Shroom 接入 Skill</h1>
        <p className={styles.lead}>下载到项目，让 AI 按真实 API 写接入代码。只取产品数据时，一步就够。</p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/skills/shroom-sdk-skill.zip" download="shroom-sdk-skill.zip">下载 Skill ZIP <span aria-hidden="true">↓</span></a>
          <a className={styles.textLink} href="/skills/shroom-sdk/SKILL.md" target="_blank" rel="noreferrer">查看 SKILL.md <span aria-hidden="true">↗</span></a>
        </div>
        <p className={styles.note}>指引基线 SDK 0.5.0 · SDK 依赖通过 npm 单独安装 · Node 与网页使用同一版本</p>
      </header>

      <section id="install" className={styles.section} aria-labelledby="install-title">
        <h2 id="install-title">在 Codex 中使用</h2>
        <ol className={styles.steps}>
          <li><span className={styles.number} aria-hidden="true">1</span><div>
            <h3>解压到项目的 Skills 目录</h3>
            <p>将 ZIP 内的 <code>shroom-sdk</code> 文件夹放入项目的 <code>.agents/skills/</code>，最终路径应为：</p>
            <pre className={styles.code}><code>{installPath}</code></pre>
            <p className={styles.note}>保留同目录的 agents 与 references 文件夹，不要再多套一层 shroom-sdk。</p>
          </div></li>
          <li><span className={styles.number} aria-hidden="true">2</span><div>
            <h3>在该项目打开新的 Codex 会话</h3>
            <p>输入 <code>$shroom-sdk</code> 选择此 Skill。没有出现时，先检查上方路径，再重开项目会话。</p>
          </div></li>
          <li><span className={styles.number} aria-hidden="true">3</span><div>
            <h3>告诉 AI 产品与需要的功能</h3>
            <div className={styles.prompt}>{prompt}</div>
            <CopyRawButton raw={prompt} label="复制调用提示" />
            <p className={styles.note}>手套注明左右手与分包/整包协议，鞋垫注明左右脚与协议；密钥在本机配置，无需发给 AI。</p>
          </div></li>
        </ol>
        <p className={styles.footnote}>项目安装目录参考 <a href="https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills" target="_blank" rel="noreferrer">OpenAI 官方 Skills 说明</a>。其他支持 Skills 的工具，请按其导入方式安装整个文件夹；各工具的目录和调用语法可能不同。</p>
      </section>

      <section id="scope" className={styles.section} aria-labelledby="scope-title">
        <h2 id="scope-title">AI 会按这套接口接入</h2>
        <p>接入前用 <code>listPorts()</code> 查询并让用户选择串口。业务流程保留五个函数：</p>
        <p className={styles.flow}>取数 → 创建 WS → 开始采集 → 停止采集 → 下载</p>
        <div className={styles.scope}>
          <p><strong>设备与授权</strong>Node 连接手套、手垫、人体或鞋垫；浏览器通过 WS 接收。分包手套从 SDK 0.4.0 起支持，0.5.0 可自动识别串口和左右手；人体与鞋垫从 0.3.0 起支持；驱动、SDK 密钥与真实串口在客户电脑准备。</p>
          <p><strong>重连与采集</strong>采集保存为 SQLite。串口断线会结束当前记录，恢复后需重新采集；网页 WS 断线不会停止 Node 录制。</p>
        </div>
        <Link className={styles.textLink} href="/docs/quick-start">查看五步调用与接入准备 <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
