/** 官网暂时只展示 JavaScript 接入；SDK 源文档和安装包仍保留完整语言能力。 */
export function siteDocumentDefinition(doc) {
  if (doc.slug === 'python') return null;
  return {
    ...doc,
    ...(doc.slug === 'backend' ? {
      summary: '查阅 Node.js 产品连接、模拟、解析、后端通讯与存储 API 的参数和示例。',
    } : {}),
    ...(doc.tocDescriptions ? {
      tocDescriptions: Object.fromEntries(Object.entries(doc.tocDescriptions)
        .filter(([id]) => !id.startsWith('python-'))),
    } : {}),
  };
}

// 在隐藏章节前固定旧编号，保留其他页面和历史书签中的 #sN 链接。
function stableHeadings(source) {
  let fence = null;
  let index = 0;
  return source.split('\n').map(line => {
    const delimiter = line.match(/^\s*(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1][0];
      else if (fence === delimiter[1][0]) fence = null;
      return line;
    }
    if (!fence && /^#{2,3} /.test(line)) {
      index += 1;
      if (!/\{#[a-z][a-z0-9-]*\}\s*$/.test(line)) return `${line} {#s${index}}`;
    }
    return line;
  }).join('\n');
}

/** 隐藏完整的语言专属章节，不让代码或说明游离到下一个 JS 章节。 */
function withoutPythonSections(source) {
  let hiddenLevel = 0;
  let fence = null;
  return source.split('\n').filter(line => {
    const delimiter = line.match(/^\s*(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1][0];
      else if (fence === delimiter[1][0]) fence = null;
    }
    const heading = !fence && line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (hiddenLevel && heading[1].length <= hiddenLevel) hiddenLevel = 0;
      if (!hiddenLevel && /python/i.test(heading[2])) hiddenLevel = heading[1].length;
    }
    return !hiddenLevel;
  }).join('\n');
}

/** 混合参数表投影为 JS 字段，不能留下 snake_case / bytes 等另一套 API 提示。 */
function javascriptText(text) {
  return text
    .replace('提供 **浏览器 / Node.js / Python** 三种入口。', '提供 **浏览器 / Node.js** 两种入口。')
    .replace('官网下载时可选择 **Python** 或 **Node.js（含浏览器）**', '官网提供 **Node.js（含浏览器）** SDK')
    .replace('`shroom-sdk-python.zip` / `shroom-sdk-node.zip`', '`shroom-sdk-node.zip`')
    .replace('使用顶部下拉框切换 Node.js / Python', '集中展示 Node.js 示例')
    .replace('；语言下拉框同时切换正文与本页目录', '')
    .replace('语言切换不会让两种语言自动具备相同扩展能力。', '')
    .replace('不同语言的功能范围以各自文档为准。', '')
    .replace(' 或 `shroom_sdk.__version__`', '')
    .replace('JS `connect()` / Python `connect()`', 'JS `connect()`')
    .replace('Python 用关键字参数，JS 放进 options', '参数放进 options')
    .replace('Python 用 `with` 释放连接；Node.js', 'Node.js')
    .replace('JavaScript 用 `device.getDiagnostics()`，Python 用 `device.get_diagnostics()`', '使用 `device.getDiagnostics()`')
    .replace('Python 使用 `center.x / center.y`；', '')
    .replace('JS 的未知排列名称仍按 raw 回退，Python 会拒绝未知名称；两种语言都不会', 'JS 的未知排列名称仍按 raw 回退，不会')
    .replace('以下是通用矩阵的 JavaScript `onFrame` 基础字段；Python 使用 `Frame` 数据类，`raw` 为 bytes、`values` 为 array(\'f\')：', '以下是通用矩阵的 JavaScript `onFrame` 基础字段：')
    .replace('其他手套型号与 Python 手套接入仍需另行适配', '其他手套型号接入仍需另行适配')
    .replace('Node.js `Shroom.renderAscii()` 返回 ANSI 彩色字符串；Python `Shroom.render_ascii()` 返回纯字符。', 'Node.js `Shroom.renderAscii()` 返回 ANSI 彩色字符串。')
    .replace('参数、返回值与示例均在 [后端 API](BACKEND-GUIDE.md#serial)，Python 可在该页面切换语言。', '参数、返回值与示例见 [后端 API](BACKEND-GUIDE.md#serial)。')
    .replace(/Python\s*(?:与|和)\s*(?=Node\.js|通用 Mock)/g, '')
    .replace(/(?:Node\.js|JS)\s*\/\s*Python/g, match => match.startsWith('JS') ? 'JS' : 'Node.js')
    .replace(/(?:、|，|\s*与\s*|\s*和\s*)Python(?=\s*(?:或|没有|不|仍|使用|、|，|文档))/g, '')
    .replace(/Node\.js、Python 或/g, 'Node.js 或')
    .replace(/\*\*Python\*\* 或 /g, '')
    .replace(/(?:、Python|Python、)/g, '')
    .replace('Python 文件输出', '文件输出')
    .replace('两语言支持范围不同', '支持 raw、内置布局名称或自定义排列')
    .replace('两种语言都有', '设备提供')
    .replace('两种语言的帧长', '设备帧长')
    .replace('同一发行版本中的不同语言能力以各自文档为准。', '')
    .replaceAll('fullScale / full_scale', 'fullScale')
    .replaceAll('Uint8Array / bytes', 'Uint8Array')
    .replaceAll("Float32Array / array('f')", 'Float32Array')
    .replaceAll('number / int', 'number')
    .replaceAll('number / float', 'number')
    .replaceAll('{ x, y } / Center', '{ x, y }')
    .replaceAll('bytesReceived / bytes_received', 'bytesReceived')
    .replaceAll('frameCount / frame_count', 'frameCount')
    .replaceAll('droppedCount / dropped_count', 'droppedCount')
    .replaceAll('frameLength / frame_length', 'frameLength')
    .replaceAll('lastError / last_error', 'lastError')
    .replaceAll('getDiagnostics() / get_diagnostics()', 'getDiagnostics()')
    .replaceAll('null / None', 'null');
}

export function siteDocumentMarkdown(source) {
  const normalized = stableHeadings(source.replace(/\r\n?/g, '\n'))
    .replace(/<div data-sdk-language="python">[\s\S]*?<\/div>/g, '')
    .replace(/^([`~]{3,})python[^\n]*\n[\s\S]*?^\1\s*$/gmi, '');
  const withoutSections = withoutPythonSections(normalized);
  let inFence = false;
  const projected = withoutSections.split('\n').map(line => {
    if (/^\s*(?:`{3,}|~{3,})/.test(line)) inFence = !inFence;
    if (inFence || /^\s*(?:`{3,}|~{3,})/.test(line)) {
      // 混合语言 bash 命令和源码树只去除专属行，JS 代码不做文本替换。
      return /python|pyserial|pip install/i.test(line) ? '' : line;
    }
    const text = javascriptText(line);
    if (!/python|pyserial|pip install/i.test(text)) return text;
    if (/^\s*\|/.test(text)) return '';
    // 混合说明按中文句子/分句移除专属说明，保留同段中的 JS 行为与边界。
    let visible = (text.match(/[^。；]+[。；]?/g) ?? [])
      .filter(sentence => !/python|pyserial|pip install/i.test(sentence)).join('');
    if (/^\s*[-*] /.test(line) && visible && !/^\s*[-*] /.test(visible)) visible = `- ${visible}`;
    return visible.replace(/；\s*$/, '。');
  }).join('\n');
  return projected.replace(/^(`{3,}|~{3,})(?:bash|sh|shell|text)?[ \t]*\n(?:[ \t]*\n)*\1[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
