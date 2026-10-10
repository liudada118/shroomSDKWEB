# 数据存储

SDK 负责提供实时数据帧。文件写入、数据库、历史查询和回放由应用实现。本节展示应用侧保存方式，不需要新增 SDK 接口。

## 选择保存内容

- 后续重新解析：保存 `raw`，同时记录协议、产品、点位配置与时间戳。
- 数据分析与图表：保存 `values`、矩阵尺寸、时间戳和所需统计字段。
- 已有后端的数据：遵循后端帧的实际字段与单位，先确定持久化格式。

JavaScript 串口帧的原始字节视图可能被后续读取复用。长期保存时立即复制字节或转成普通数组；不要把帧对象直接堆进一个无限增长的列表。

## Node.js 保存 JSONL

以下小样例放在 SDK 根目录，收集最多 100 帧模拟数据，结束后一次写入 `frames.jsonl`。每行是一个独立 JSON 对象：

```js
import { writeFile } from 'node:fs/promises';
import { Shroom } from './node/index.js';

const snapshots = [];
const device = Shroom.mock({ rows: 32, cols: 32, fps: 20 });
const unsubscribe = device.onFrame((frame) => {
  if (snapshots.length >= 100) return;
  snapshots.push({
    timestamp: frame.timestamp,
    rows: frame.rows,
    cols: frame.cols,
    raw: Array.from(frame.raw),
    values: Array.from(frame.values),
  });
});

try {
  await new Promise((resolve) => setTimeout(resolve, 2500));
} finally {
  unsubscribe();
  await device.close();
}
await writeFile('frames.jsonl', snapshots.map((frame) => JSON.stringify(frame)).join('\n') + '\n', 'utf8');
console.log(`已保存 ${snapshots.length} 帧`);
```

真实设备只需替换设备创建语句，见[串口接入](SERIAL.md)。持续采集需要有界队列、批量落盘、文件轮转与磁盘错误处理；本例仅用于短时间验证。

## Python 保存 JSONL

安装 Python 包后，可用现有 CLI 输出有限数量的数据帧，再由 shell 写入文件：

```bash
python -m shroom_sdk --frames 100 --json > frames.jsonl
```

省略端口使用模拟设备。真实设备示例为 `python -m shroom_sdk COM3 --rows 32 --cols 32 --frames 100 --json > frames.jsonl`。字段与超时参数见[Python SDK](../python/README.md)。

## 数据库与后端采集

应用可在采集端批量写入自己的 SQLite、PostgreSQL 或其他数据库；SDK 没有内置数据库客户端、表结构或历史查询 API。

`BackendSdkClient.startCollection()` 是请求已经运行的后端启动采集。是否保存文件、文件路径及数据库结构取决于该后端，不代表 SDK 自带存储引擎。已有接口见[后端通讯](../BACKEND.md)。

## 前端职责

前端订阅数据并渲染，长期保存宜交给应用后端。浏览器会话缓存不能代替可靠的采集存储。根据当前应用的数据规模与部署方式决定保存位置。
