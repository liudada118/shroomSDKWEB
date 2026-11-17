import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogProduct, productCatalog, productFields, productGuideHref, productPackageReady } from '../app/product-catalog.ts';
import { listDeviceProducts } from '../sdk/src/node/index.js';

test('all product references cover registered protocols without treating aliases as extra devices', () => {
  const supported = listDeviceProducts();
  assert.deepEqual([...productCatalog.map(product => product.productId), 'handGloveFullPacket'].sort(), supported.map(product => product.product).sort(), '整包协议作为同类手套的兼容入口保留，所有独立产品均有资料');
  for (const product of productCatalog) {
    const url = new URL(productGuideHref(product), 'https://sdk.example');
    assert.equal(url.pathname, '/docs/quick-start');
    assert.equal(url.searchParams.get('product'), product.id);
    assert.equal(url.searchParams.get('tab'), 'start');
    assert.ok(product.fields.length > 0);
  }
});

test('tactile foot describes the original segmented data separately from jqInsole', () => {
  const foot = getCatalogProduct('foot');
  assert.equal(foot.productId, 'footVideo');
  assert.equal(foot.alias, 'foot');
  assert.equal(foot.minSdkVersion, '0.7.1');
  assert.equal(productPackageReady(foot, '0.6.0'), false);
  assert.equal(productPackageReady(foot, '0.7.0'), false);
  assert.equal(productPackageReady(foot, '0.7.1'), true);
  assert.equal(foot.requiresSide, true);
  assert.equal(foot.protocols.length, 0);
  const fields = productFields(foot).map(row => row.join(' ')).join('\n');
  assert.match(fields, /60 个 uint8 ADC/);
  assert.match(fields, /6 列 × 10 行/);
  assert.match(fields, /rows=10、cols=6/);
  assert.doesNotMatch(fields, /256 个|16 × 16/);
  assert.match(fields, /16 字节/);
  assert.match(fields, /134 \+ 150 字节/);
  assert.match(fields, /3=左脚、4=右脚/);
  assert.doesNotMatch(fields, /sensors|fingers|palm|imu\.quaternion/);
  assert.match(foot.note, /显式 side 只筛选/);
  assert.notEqual(foot.productId, getCatalogProduct('insole').productId);
});

test('released protocols retain their minimum version and reject older installation packages', () => {
  for (const id of ['body', 'insole'] as const) {
    const product = getCatalogProduct(id);
    assert.equal(product.development, false);
    assert.equal(product.minSdkVersion, '0.3.0');
    assert.equal(productPackageReady(product, '0.2.0'), false);
    assert.equal(productPackageReady(product), false);
    assert.equal(productPackageReady(product, 'unknown'), false);
    assert.equal(productPackageReady(product, '0.3.0'), true);
    assert.equal(productPackageReady(product, '0.3.0-dev.1'), true);
    assert.doesNotMatch(product.note, /开发版|未发布/);
    assert.match(product.note, /SDK 0\.3\.0 起支持/);
  }
  const glove = getCatalogProduct('glove');
  assert.equal(glove.productId, 'handGloveSegmented');
  assert.equal(glove.minSdkVersion, '0.4.0');
  assert.equal(productPackageReady(glove, '0.3.0'), false);
  assert.equal(productPackageReady(glove, '0.4.0'), true);
  assert.equal(productPackageReady(getCatalogProduct('pad'), '0.2.0'), true);
});

test('insole field descriptions follow the selected protocol and keep scan bytes separate from sensor points', () => {
  const product = getCatalogProduct('insole');
  assert.equal(product.requiresSide, true); assert.equal(product.sideLabel, '脚侧');
  const fields12 = productFields(product, '12bit'), fields8 = productFields(product, '8bit');
  assert.equal(fields12.find(([field]) => field === 'raw')?.[1], '512 个原始 ADC 字节');
  assert.equal(fields8.find(([field]) => field === 'raw')?.[1], '256 个原始 ADC 字节');
  assert.ok(fields12.some(([field]) => field === 'imu.gyroscope / acceleration'));
  assert.ok(!fields8.some(([field]) => field === 'imu.gyroscope / acceleration'));
  for (const fields of [fields12, fields8]) {
    assert.equal(fields.find(([field]) => field === 'sensors.sourceIndices / raw / values')?.[1], '112 点 / 14 × 8');
    assert.match(fields.find(([field]) => field === 'pressure / pressureMatrix')?.[2] ?? '', /不代表脚型/);
  }
  const body = getCatalogProduct('body');
  assert.equal(body.requiresSide, false);
  assert.match(body.fields.find(([field]) => field === 'raw / pressure / pressureMatrix')?.[2] ?? '', /不代表人体平面/);
});
