import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import vm from 'node:vm';

const exec = promisify(execFile);

async function build(t, backend) {
  const dir = await mkdtemp(join(tmpdir(), 'tiktok-config-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'public'));
  await copyFile(new URL('../build-config.mjs', import.meta.url), join(dir, 'build-config.mjs'));
  await copyFile(new URL('../public/backend-url.js', import.meta.url), join(dir, 'public/backend-url.js'));
  const env = { PATH: process.env.PATH, HOME: dir, TMPDIR: dir, SITE_PASSWORD: 'must-not-be-public' };
  delete env.BACKEND_URL;
  if (backend !== undefined) env.BACKEND_URL = backend;
  await exec(process.execPath, [join(dir, 'build-config.mjs')], { env });
  const source = await readFile(join(dir, 'public/config.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(source.includes(env.SITE_PASSWORD), false);
  return context.window.APP_CONFIG.eventsBase;
}

test('build lấy BACKEND_URL từ môi trường', async t => {
  assert.equal(await build(t, 'https://backend.example.com/live'), 'https://backend.example.com/live');
});

test('không đặt BACKEND_URL thì dùng cùng origin, không trỏ localhost cố định', async t => {
  assert.equal(await build(t), '');
  assert.equal(await build(t, ''), '');
});

test('URL có dấu nháy được xuất thành JavaScript hợp lệ', async t => {
  const url = "http://localhost:3100/a'b";
  assert.equal(await build(t, url), url);
});

test('chuẩn hóa URL nền và toàn bộ dấu gạch chéo cuối', async t => {
  assert.equal(await build(t, '  https://backend.example.com/live///  '), 'https://backend.example.com/live');
});

test('URL không hợp lệ khiến build thất bại', async t => {
  for (const url of [
    'not-a-url', 'javascript:alert(1)',
    'https://backend.example.com?token=secret', 'https://backend.example.com?',
    'https://backend.example.com/#section', 'https://backend.example.com/#',
    'https://user:secret@backend.example.com',
  ]) {
    await assert.rejects(build(t, url), /BACKEND_URL/);
  }
});
