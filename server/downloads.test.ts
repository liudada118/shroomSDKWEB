import test from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP_PLATFORMS, SDK_VARIANTS, SERIAL_DRIVERS } from '../app/downloads.ts';
import npmPackage from '../app/sdk-package.generated.json' with { type: 'json' };
import { sdkInstallCommand } from '../app/sdk-install.ts';

test('each desktop platform has its own published installer and registration target', () => {
  const expected = [
    ['windows', '1.1.36', 'desktop-win', 'Shroom Setup 1.1.36.exe', 'EXE', 384672158],
    ['macos', '1.1.37', 'desktop-macos', 'Shroom-1.1.37-arm64.dmg', 'DMG', 437163541],
    ['linux', '1.1.38', 'desktop-linux', 'Shroom-1.1.38-amd64.deb', 'DEB', 256686224],
  ];
  assert.equal(DESKTOP_PLATFORMS.length, 3);
  for (const [index, [id, version, source, filename, format, size]] of expected.entries()) {
    const platform = DESKTOP_PLATFORMS[index];
    const url = new URL(platform.target.url);
    assert.equal(platform.id, id);
    assert.equal(platform.version, version);
    assert.equal(platform.format, format);
    assert.equal(platform.size, size);
    assert.equal(platform.target.sdkVersion, version);
    assert.equal(platform.target.source, source);
    assert.equal(platform.target.url, platform.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.host, 'shroom.jq-industries.com');
    assert.equal(decodeURIComponent(url.pathname), `/shroom1/${filename}`);
    assert.ok(platform.target.title.includes(`${platform.label} 上位机 ${version}`));
    assert.ok(platform.target.subtitle.includes(platform.sizeLabel));
    assert.ok(platform.target.subtitle.includes(platform.format));
  }
  assert.equal(new Set(DESKTOP_PLATFORMS.map((platform) => platform.target.url)).size, 3);
});

test('installation hints reflect actual package architectures and do not reuse Monitor claims', () => {
  const mac = DESKTOP_PLATFORMS.find((platform) => platform.id === 'macos')!;
  const linux = DESKTOP_PLATFORMS.find((platform) => platform.id === 'linux')!;
  assert.ok(mac.compatibility.includes('Apple Silicon'));
  assert.ok(mac.compatibility.includes('ARM64'));
  assert.ok(mac.description.includes('不适用于 Intel Mac'));
  assert.ok(linux.compatibility.includes('amd64 / x86_64'));
  assert.ok(linux.description.includes('不适用于 ARM64'));
  for (const platform of DESKTOP_PLATFORMS) {
    assert.doesNotMatch(platform.target.subtitle, /免安装|不需要授权|ShroomMonitor|即将发布/);
    assert.equal(platform.sizeLabel, `约 ${Math.round(platform.size / 1_000_000)} MB`);
    assert.ok(platform.installNote.includes(platform.format));
  }
});

test('the public SDK download list retains only the JavaScript package', () => {
  assert.deepEqual(SDK_VARIANTS.map(({ url, source, sdkLanguage }) => ({ url, source, sdkLanguage })), [
    { url: npmPackage.url, source: 'sdk-node', sdkLanguage: 'node' },
  ]);
  assert.ok(npmPackage.url.includes(npmPackage.sha256));
  assert.match(npmPackage.url, /\.tgz$/);
});

test('primary install command uses the published package name', () => {
  assert.equal(sdkInstallCommand(), 'npm install shroom-sdk');
});

test('serial drivers link directly to the supplied Windows EXE and macOS ZIP', () => {
  assert.deepEqual(SERIAL_DRIVERS.map(({ id, format, url }) => ({ id, format, url })), [
    { id: 'windows', format: 'EXE', url: 'https://shroom.jq-industries.com/drive/CH341SER.EXE' },
    { id: 'macos', format: 'ZIP', url: 'https://shroom.jq-industries.com/drive/CH34xVCPDriver.zip' },
  ]);
  assert.ok(SERIAL_DRIVERS.find((driver) => driver.id === 'macos')!.installNote.includes('解压'));
  assert.ok(DESKTOP_PLATFORMS.find((platform) => platform.id === 'windows')!.driverNote.includes('重插设备'));
  assert.ok(DESKTOP_PLATFORMS.find((platform) => platform.id === 'macos')!.driverNote.includes('重新查询串口'));
});
