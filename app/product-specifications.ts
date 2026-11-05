const SPECIFICATIONS_BASE_URL = 'https://shroom.jq-industries.com/book/';

/** 规格书的展示文件名可独立调整，链接始终使用资料站的原始文件名。 */
export const productSpecifications = [
  { id: 'insole', name: '12bit 鞋垫', fileName: 'JQGY-YL-668-12bit鞋垫规格书.pdf' },
  { id: 'robot-skin', name: '触觉手套', fileName: '机器人皮肤说规格书.pdf', displayFileName: '触觉手套规格书.pdf' },
  { id: 'hand-pad', name: '高密度手部压力监测垫', fileName: '高密度手部压力监测垫.pdf' },
  { id: 'body-skin', name: '全身触觉皮肤', fileName: '【矩侨精密】全身触觉皮肤产品规格书 20260828 V1.0(1).pdf', displayFileName: '【矩侨精密】全身触觉皮肤产品规格书 20260828 V1.0.pdf' },
].map(specification => ({
  ...specification,
  displayFileName: specification.displayFileName ?? specification.fileName,
  href: SPECIFICATIONS_BASE_URL + encodeURIComponent(specification.fileName),
}));
