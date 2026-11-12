import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));

test('Vercel dùng frontend tĩnh, không suy diễn npm start thành Node server', async () => {
  const deploy = await load('vercel.json');
  const pkg = await load('package.json');
  // null là Framework Preset "Other", ghi đè cả lựa chọn trong Project Settings.
  assert.equal(deploy.framework, null);
  assert.equal(deploy.buildCommand, 'npm run build');
  assert.equal(deploy.outputDirectory, 'public');
  await access(new URL(`${deploy.outputDirectory}/index.html`, root));
  assert.equal(pkg.main, undefined);
  assert.equal(pkg.scripts.start, 'node server.mjs');
});
