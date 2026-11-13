// Tối đa maxRows hàng hiển thị (kể cả hàng đang thắp). Cùng cấp xếp chung hàng, tối đa perRow người một hàng.
// Tối đa 200 người chờ: bỏ bình luận trước, rồi bỏ màn diễn quà cũ nhất.
// Điểm quà được cộng bên ngoài queue, kể cả khi không giữ được màn diễn.
function makeQueue(maxRows, perRow, waitMs, isVip = () => false) {
  const MAX_WAITING = 200, COMMENT_TTL_MS = 60000;
  let order = 0, nextExpiry = Infinity;
  const q = {
    rows: [], offering: null, pending: [], skipped: 0,

    add(name, now, tier = 1) {
      const person = { name, tier, since: now, order: order++ };
      refill(now, person);
      return q.rows.some(r => r.people.includes(person)) || q.pending.includes(person);
    },

    depart(now) {
      if (now >= nextExpiry) refill(now);
      const row = q.rows[0];
      if (q.offering || !row) return null;
      if (row.people.length < perRow && now - row.since < waitMs) return null;
      return (q.offering = q.rows.shift());
    },

    finish(now) {
      q.offering = null;
      refill(now);
    },
  };

  function refill(now, incoming) {
    const waiting = [...q.rows.flatMap(r => r.people), ...q.pending];
    if (incoming) waiting.push(incoming);
    const fresh = waiting.filter(p => p.tier !== 1 || now - p.since < COMMENT_TTL_MS);
    q.skipped += waiting.length - fresh.length;
    fresh.sort((a, b) => a.order - b.order);
    while (fresh.length > MAX_WAITING) {
      const comment = fresh.findIndex(p => p.tier === 1);
      fresh.splice(comment < 0 ? 0 : comment, 1);
      q.skipped++;
    }
    // VIP vượt người chờ thường, không ngắt lượt đang diễn và không vượt số hàng hiển thị.
    fresh.sort((a, b) => Number(isVip(b.tier)) - Number(isVip(a.tier)) || a.order - b.order);
    q.rows = [];
    q.pending = [];
    nextExpiry = Infinity;
    for (const p of fresh) {
      if (p.tier === 1) nextExpiry = Math.min(nextExpiry, p.since + COMMENT_TTL_MS);
      const row = q.rows.find(r => r.tier === p.tier && r.people.length < perRow);
      if (row) row.people.push(p);
      else if (q.rows.length < maxRows - (q.offering ? 1 : 0)) {
        q.rows.push({ tier: p.tier, people: [p], since: p.since });
      } else q.pending.push(p);
    }
  }
  return q;
}
if (typeof module !== 'undefined') module.exports = makeQueue;
