// Chung cho build và trình duyệt: URL nền không mang thông tin đăng nhập, query hay fragment.
function normalizeBackendURL(value) {
  const base = value.trim();
  if (!base) return '';
  let url;
  try { url = new URL(base); } catch {}
  if (!url || !['http:', 'https:'].includes(url.protocol) ||
      url.username || url.password || /[?#\u0000-\u0020\u007f]/.test(base)) {
    throw new Error('BACKEND_URL phải là URL HTTP(S) nền, không chứa mật khẩu, query hay fragment.');
  }
  return url.href.replace(/\/+$/, '');
}
if (typeof module !== 'undefined') module.exports = normalizeBackendURL;
