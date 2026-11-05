export type ProductProtocol = '12bit' | '8bit';
export type ProductField = readonly [field: string, size: string, description: string];

/** 官网产品资料；侧别、协议与字段独立描述，并标明最低支持版本。 */
export const productCatalog = [
  {
    id: 'glove', name: '触觉手套', productId: 'handGloveSegmented', alias: 'glove',
    requiresSide: true, sideLabel: '手侧', sideNames: { left: '左手', right: '右手' },
    protocols: [], minSdkVersion: '0.4.0', development: false,
    slogan: '每一次触碰，都有对应的数据。',
    description: '合并首尾分包后，读取五指、指腹和手掌的压力分区，保留原始压力与 IMU 字节。',
    summary: ['256 个原始压力通道', '五指 + 指腹 + 手掌', '左 / 右手按实物配置'],
    connection: '921600 baud · 130 + 146 字节分包 · 一只手一个串口 · 必须明确 side: left / right',
    fields: [
      ['pressure / raw', '256 个 ADC', '设备原始扫描顺序的压力值。'],
      ['fingers.*.raw / pulp', '每指 12 + 1 点', '五指主体与独立指腹；分区映射由 SDK 处理。'],
      ['palm.matrix', '72 点 / 5 行', '真实行长为 12、15、15、15、15。'],
      ['imu.raw', '16 字节', '原始 IMU 数据，不代表已解算的姿态或手势。'],
      ['protocol / packetType', 'segmented / 0–255', 'packetType 只用于首尾包配对，不决定手侧，也不代表帧序号。分包帧没有 sequence。'],
    ],
    note: 'SDK 0.4.0 起，glove 默认使用分包协议。应用必须按该串口连接的实物确认左右手；五指、指腹和手掌合计 137 个映射位置，不要求覆盖 256 个原始通道。旧整包设备需显式使用 handGloveFullPacket。',
  },
  {
    id: 'pad', name: '手部检测垫', productId: 'hand', alias: 'pad',
    requiresSide: false, sideLabel: '', sideNames: null,
    protocols: [], minSdkVersion: '0.1.0', development: false,
    slogan: '把接触分布，读成一张压力矩阵。',
    description: '读取 32 × 32 压力矩阵，用于接触分布展示与连续采集。',
    summary: ['1,024 个压力点', '32 × 32 矩阵', '内置 mat32 点位映射'],
    connection: '1000000 baud · hand 协议 · 无需 side 参数',
    fields: [
      ['pressure / raw', '1,024 个 ADC', '设备原始扫描顺序的压力值。'],
      ['pressureMatrix', '1,024 个 ADC', '按 mat32 映射后的数据，不需要再次重排。'],
      ['values', '1,024 个浮点值', '映射后的归一化相对值，按行优先排列。'],
      ['rows / cols', '32 / 32', '产品接口内置的矩阵尺寸。'],
      ['max / avg / center', '基础 Frame 统计', '基于映射矩阵的统计，不代表标定后的物理量。'],
    ],
    note: '只适用于对应 hand 协议的 32 × 32 手垫；其他矩阵设备需先核对协议。',
  },
  {
    id: 'body', name: '人体全身', productId: 'humanBody', alias: 'body',
    requiresSide: false, sideLabel: '', sideNames: null,
    protocols: [], minSdkVersion: '0.3.0', development: false,
    slogan: '按身体部位，读取真实压力通道。',
    description: '从原始扫描数据提取 10 个物理部位，保留各分区的原始通道索引和压力值。',
    summary: ['10 个物理部位', '400 个已映射通道', '1,024 点原始扫描追溯'],
    connection: '1000000 baud · humanBody 协议 · 无需 side 参数 · SDK 0.3.0 起支持',
    fields: [
      ['regions', '10 个部位 / 400 个唯一通道', '按真实身体部位分区，不把原始扫描矩阵当作身体平面。'],
      ['regions.*.sourceIndices / raw / values / matrix', '各部位数据', '提供原始通道索引、ADC、归一化值与该部位矩阵。'],
      ['raw / pressure / pressureMatrix', '1,024 点 / 32 × 32', '保留原始扫描顺序用于追溯，32 × 32 不代表人体平面布局。'],
    ],
    note: 'SDK 0.3.0 起支持。当前提供取数和五步调用，不提供人体绘图。Node 服务端与网页端需使用同一 SDK 版本。',
  },
  {
    id: 'insole', name: '鞋垫', productId: 'jqInsole', alias: 'insole',
    requiresSide: true, sideLabel: '脚侧', sideNames: { left: '左脚', right: '右脚' },
    protocols: [{ value: '12bit', label: '12bit · 默认' }, { value: '8bit', label: '8bit' }],
    minSdkVersion: '0.3.0', development: false,
    slogan: '区分左右脚，读到每个实际传感点。',
    description: '按 formA 线序返回 112 个实际传感点，同时保留 256 通道原始扫描和 IMU 数据；协议需与设备固件匹配。',
    summary: ['112 个实际传感点', '256 通道原始扫描', '左右脚 · 12bit / 8bit'],
    connection: '默认 921600 baud · 必填脚侧 · protocol 默认 12bit，可选 8bit；进阶可用 baudRate 指定已支持速率',
    fields: [
      ['raw', '12bit：512 字节；8bit：256 字节', '原始 ADC 字节；12bit 按 uint16LE 解码，不把字节数当作传感点数。'],
      ['pressure / pressureMatrix', '256 个 ADC / 16 × 16', '原始扫描顺序；12bit 为 Uint16、0–4095，8bit 为 Uint8、0–255，不代表脚型。'],
      ['values', '256 个归一化值', '12bit 按 4095 归一化，8bit 按 255 归一化；不代表物理压力单位。'],
      ['sensors.sourceIndices / raw / values', '112 点 / 14 × 8', '按 formA 线序组织；sourceIndices 为从 0 开始的原始通道索引。'],
      ['sensors.positions', '112 个位置', '每点包含 row、col、xMm、yMm，按同一传感点顺序对应。'],
      ['imu.raw / quaternion', '40 / 16 字节；4 分量', '12bit 保留 40 字节 IMU，8bit 保留 16 字节；两协议均提供四元数。'],
      ['imu.gyroscope / acceleration', '仅 12bit', '按协议返回数值；单位未确定，不自动换算为角速度或加速度单位。'],
    ],
    note: 'SDK 0.3.0 起支持。必须确认脚侧和固件协议；当前提供取数和五步调用，不提供鞋垫绘图。Node 服务端与网页端需使用同一 SDK 版本。',
  },
] as const;

export type CatalogProduct = typeof productCatalog[number];

export function getCatalogProduct(id: CatalogProduct['id']): CatalogProduct {
  return productCatalog.find(product => product.id === id)!;
}

/** 下载包至少包含所选协议时才给出安装入口，避免把较旧版本交给新产品客户。 */
export function productPackageReady(product: CatalogProduct, version?: string): boolean {
  const parts = version?.match(/^(\d+)\.(\d+)\.(\d+)(?:$|-)/)?.slice(1).map(Number);
  if (!parts) return false;
  const minimum = product.minSdkVersion.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (parts[index] !== minimum[index]) return parts[index] > minimum[index];
  return true;
}

/** 快速接入只展示所选协议真正返回的字段，8bit 不列陀螺仪和加速度。 */
export function productFields(product: CatalogProduct, protocol: ProductProtocol = '12bit'): readonly ProductField[] {
  if (product.id !== 'insole') return product.fields;
  const twelve = protocol === '12bit';
  return product.fields.filter(([field]) => twelve || field !== 'imu.gyroscope / acceleration').map<ProductField>(row => {
    const [field, , description] = row;
    if (field === 'raw') return [field, twelve ? '512 个原始 ADC 字节' : '256 个原始 ADC 字节', twelve ? 'uint16LE 解码为 256 个 ADC；不包含 IMU 字节。' : '每字节对应一个 ADC；不包含 IMU 字节。'];
    if (field === 'pressure / pressureMatrix') return [field, '256 个 ADC / 16 × 16', (twelve ? 'Uint16，范围 0–4095。' : 'Uint8，范围 0–255。') + '保留原始扫描顺序，不代表脚型。'];
    if (field === 'values') return [field, '256 个归一化值', '原始扫描 ADC 除以 ' + (twelve ? '4095' : '255') + '；不代表物理压力单位。'];
    if (field === 'imu.raw / quaternion') return [field, (twelve ? '40' : '16') + ' 字节；4 分量', '保留 IMU 原始字节并返回四元数；不推断角度或单位。'];
    return [field, row[1], description];
  });
}

/** 产品资料与实际取数使用同一稳定产品别名。 */
export function productGuideHref(product: CatalogProduct, tab: 'start' | 'guide' | 'data' = 'start') {
  return `/docs/quick-start?product=${product.id}&tab=${tab}`;
}
