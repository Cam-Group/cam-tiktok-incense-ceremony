// Giới hạn bình luận thành người thắp hương cấp 1 (luật của game, không nằm trong backend):
// - mỗi người được tính một lần trong cooldownMs;
// - cả phòng, hai bình luận được tính cách nhau ít nhất gapMs.
// allow(key) trả true nếu được tính; key là khoá người dùng. Bình luận bị loại không được lưu lại.
// Dùng được trong trình duyệt (biến toàn cục) và trong Node để kiểm thử.
function createCommentLimit({ cooldownMs, gapMs, now = () => Date.now() }) {
  const lastByUser = new Map(); // khoá → thời điểm được tính lần gần nhất
  let lastAny = -Infinity;      // thời điểm bình luận được tính gần nhất của cả phòng
  return function allow(key) {
    const t = now();
    const last = lastByUser.get(key);
    if (last !== undefined && t - last < cooldownMs) return false;
    if (t - lastAny < gapMs) return false;
    if (lastByUser.size > 5000) for (const [k, v] of lastByUser) if (t - v >= cooldownMs) lastByUser.delete(k);
    lastByUser.set(key, t);
    lastAny = t;
    return true;
  };
}
if (typeof module !== 'undefined') module.exports = createCommentLimit;
