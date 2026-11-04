import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogProduct, productCatalog, productFields, productGuideHref, productPackageReady } from '../app/product-catalog.ts';
import { listDeviceProducts } from '../sdk/src/node/index.js';

test('all product references cover registered protocols without treating aliases as extra devices', () => {
  const supported = listDeviceProducts();
  assert.deepEqual(productCatalog.map(product => product.productId).sort(), supported.map(product => product.product).sort());
  for (const product of productCatalog) {
    const url = new URL(productGuideHref(product), 'https://sdk.example');
    assert.equal(url.pathname, '/docs/quick-start');
    assert.equal(url.searchParams.get('product'), product.id);
    assert.equal(url.searchParams.get('tab'), 'start');
    assert.ok(product.fields.length > 0);
  }
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
  assert.equal(productPackageReady(getCatalogProduct('glove'), '0.2.0'), true);
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
