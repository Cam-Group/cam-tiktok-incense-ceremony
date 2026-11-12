// Schema: TiktokLive/src/events.js. diamonds đã là tổng combo hoàn tất, không nhân repeatCount.
function createLiveEventHandler({ onGift, onChat, onStatus, onInvalid = () => {} }) {
  const seen = new Set();
  let anonymous = 0;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const invalid = () => { onInvalid(); return false; };

  return function handle(type, raw) {
    let data;
    try { data = JSON.parse(raw); } catch { return invalid(); }
    if (!record(data)) return invalid();
    if (type === 'status') {
      if (typeof data.text !== 'string') return invalid();
      onStatus(data.text);
      return true;
    }
    if (!['gift', 'chat'].includes(type) || !record(data.user) ||
        ['id', 'uniqueId', 'nickname'].some(k => typeof data.user[k] !== 'string') ||
        ['eventId', 'roomId'].some(k => data[k] !== undefined && typeof data[k] !== 'string')) return invalid();
    if (type === 'gift' && (!Number.isSafeInteger(data.diamonds) || data.diamonds <= 0 || data.isStreakOver !== true)) return invalid();
    if (type === 'chat' && typeof data.text !== 'string') return invalid();

    // Best-effort trong phiên: backend không lưu/replay hay bảo đảm đúng một lần.
    if (data.eventId) {
      const eventKey = JSON.stringify([type, data.roomId || '', data.eventId]);
      if (seen.has(eventKey)) return false;
      seen.add(eventKey);
      if (seen.size > 2000) seen.delete(seen.values().next().value);
    }
    const u = data.user;
    const name = u.nickname.trim() || u.uniqueId.trim() || 'Khách';
    const key = u.id ? `id:${u.id}` : u.uniqueId ? `username:${u.uniqueId}` : `anonymous:${anonymous++}`;
    if (type === 'gift') onGift(name, data.diamonds, key);
    else onChat(name, key);
    return true;
  };
}
if (typeof module !== 'undefined') module.exports = createLiveEventHandler;
