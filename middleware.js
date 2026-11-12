// Cổng mật khẩu cho toàn bộ trang game. Chạy ở Vercel Edge, trước khi trả các file trong public/.
// Mật khẩu lấy từ biến môi trường SITE_PASSWORD (không nằm trong code). Trình duyệt chỉ giữ một cookie
// chứa băm SHA-256 của mật khẩu, không giữ mật khẩu. Đây không phải backend: không có dữ liệu, không lưu trạng thái.
export const config = { matcher: '/:path*' };

const COOKIE = 'gate';
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = text => crypto.subtle.digest('SHA-256', enc.encode(text)).then(hex);
const same = (a, b) => { // so sánh hết chuỗi, không dừng ở ký tự khác đầu tiên
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Chỉ cho quay về đường dẫn trong cùng trang, không chuyển sang trang khác
const safeNext = s => typeof s === 'string' && s.startsWith('/') && !s.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(s) ? s : '/';

function loginPage(next, error, status = 200) {
  return new Response(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dâng hương</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box; background: #1b0f0a; color: #f5e6c8; font: 16px/1.5 system-ui, sans-serif; }
  form { width: 100%; max-width: 320px; display: grid; gap: 12px; }
  h1 { margin: 0; font-size: 22px; text-align: center; color: #ffd76a; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 6px; border: 1px solid #8a6a2a; box-sizing: border-box; width: 100%; }
  input { background: #2a1912; color: #f5e6c8; }
  button { background: #8a1416; color: #ffd76a; border-color: #d4a017; cursor: pointer; }
  p { margin: 0; min-height: 1.5em; text-align: center; color: #ffb38a; }
</style>
</head>
<body>
<form method="post" action="/__login">
  <h1>Nhập mật khẩu</h1>
  <input type="hidden" name="next" value="${esc(next)}">
  <input name="password" type="password" placeholder="Mật khẩu" required autofocus autocomplete="current-password">
  <button type="submit">Vào trang</button>
  <p role="alert">${esc(error || '')}</p>
</form>
</body>
</html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return new Response('Chưa đặt biến SITE_PASSWORD trên Vercel nên trang đang bị khoá.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  const url = new URL(request.url);
  const token = await sha(`gate:${password}`);

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const next = safeNext(form?.get('next'));
    if (!same(await sha(String(form?.get('password') ?? '')), await sha(password))) {
      await new Promise(r => setTimeout(r, 600)); // mỗi lần sai đều chậm lại, khó thử đoán
      return loginPage(next, 'Mật khẩu chưa đúng.', 401);
    }
    return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` } });
  }

  const authed = (request.headers.get('cookie') || '').split(';').some(c => {
    const i = c.indexOf('=');
    return i > 0 && c.slice(0, i).trim() === COOKIE && same(c.slice(i + 1).trim(), token);
  });
  if (authed) return undefined; // đã đăng nhập: cho đi tiếp tới file tĩnh
  return loginPage(url.pathname + url.search);
}
