import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Kiểm tra logic handler; việc Vercel nhận diện/bundle middleware vẫn cần Preview deployment.
const source = await readFile(new URL('../middleware.js', import.meta.url), 'utf8');
const { default: middleware } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
let original;
beforeEach(() => { original = process.env.SITE_PASSWORD; process.env.SITE_PASSWORD = 'dummy-test-password'; });
afterEach(() => { if (original === undefined) delete process.env.SITE_PASSWORD; else process.env.SITE_PASSWORD = original; });
const request = (path, options) => new Request('https://game.example.com' + path, options);
const login = (password, next = '/') => middleware(request('/__login', {
  method: 'POST', body: new URLSearchParams({ password, next }),
}));

async function authenticated() {
  const response = await login('dummy-test-password', '/?username=alice');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/?username=alice');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
  return cookie.split(';')[0];
}

test('thiếu SITE_PASSWORD thì khóa cả trang và assets', async () => {
  delete process.env.SITE_PASSWORD;
  for (const path of ['/', '/config.js', '/assets/hall.jpg']) assert.equal((await middleware(request(path))).status, 503);
});

test('khách chưa đăng nhập chỉ nhận form, không cache hay lộ mật khẩu', async () => {
  for (const path of ['/?username=alice', '/config.js', '/assets/hall.jpg']) {
    const response = await middleware(request(path));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const html = await response.text();
    assert.match(html, /name="password"/);
    assert.ok(!html.includes(process.env.SITE_PASSWORD));
  }
});

test('mật khẩu đúng cho cookie bảo mật và đi tiếp; cookie giả vẫn bị chặn', async () => {
  const cookie = await authenticated();
  assert.equal(await middleware(request('/config.js', { headers: { cookie } })), undefined);
  assert.match(await (await middleware(request('/', { headers: { cookie: 'gate=forged' } }))).text(), /name="password"/);
});

test('mật khẩu sai hoặc form hỏng không tạo cookie', async () => {
  const wrong = await login('wrong');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  const malformed = await middleware(request('/__login', { method: 'POST', body: 'not-a-form' }));
  assert.equal(malformed.status, 401);
  assert.equal(malformed.headers.get('set-cookie'), null);
});

test('đổi mật khẩu vô hiệu hóa cookie trước đó', async () => {
  const cookie = await authenticated();
  process.env.SITE_PASSWORD = 'different-dummy-password';
  const response = await middleware(request('/', { headers: { cookie } }));
  assert.match(await response.text(), /name="password"/);
});

test('next không thể chuyển ra ngoài bằng URL tuyệt đối, backslash hay ký tự điều khiển', async () => {
  for (const next of ['https://outside.example', '//outside.example', '/\\outside.example', '/\t/outside.example', '/\n/outside.example']) {
    assert.equal((await login('dummy-test-password', next)).headers.get('location'), '/');
  }
});
