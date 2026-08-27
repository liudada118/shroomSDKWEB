/**
 * Node 端最小示例。
 *
 *   node sdk/node/demo.js            用模拟数据（不用插硬件）
 *   node sdk/node/demo.js COM3       连真实串口
 *   node sdk/node/demo.js --list     列出可用串口
 */
import { Shroom } from './index.js';

const arg = process.argv[2];

async function main() {
  if (arg === '--list') {
    const ports = await Shroom.listPorts();
    if (ports.length === 0) console.log('没有检测到串口设备');
    for (const p of ports) console.log(`${p.path}\t${p.manufacturer ?? ''}`);
    return;
  }

  const device = arg
    ? await Shroom.connect({ path: arg, baudRate: 1000000 })
    : Shroom.mock({ rows: 32, cols: 32, fps: 20 });

  console.log(`数据源：${device.info.source}，Ctrl+C 退出\n`);

  let frames = 0;
  let last = Date.now();
  let fps = 0;

  device.onFrame((frame) => {
    frames += 1;
    const now = Date.now();
    if (now - last >= 1000) {
      fps = frames;
      frames = 0;
      last = now;
    }
    // 每帧重画：光标回到左上角覆盖上一帧，不刷屏
    process.stdout.write('\x1b[H\x1b[J');
    process.stdout.write(Shroom.renderAscii(frame, { width: 32 }) + '\n');
    process.stdout.write(
      `max ${frame.max.toFixed(3)}  avg ${frame.avg.toFixed(3)}  ` +
        `点数 ${frame.area}  重心 (${frame.center.x.toFixed(2)}, ${frame.center.y.toFixed(2)})  ${fps} fps\n`
    );
  });

  process.on('SIGINT', async () => {
    await device.close();
    process.stdout.write('\x1b[?25h\n已断开\n');
    process.exit(0);
  });

  process.stdout.write('\x1b[?25l'); // 隐藏光标，免得闪
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
