import { test } from 'node:test';
import assert from 'node:assert/strict';
import makeQueue from '../public/queue.js';

const names = q => [...q.rows.flatMap(r => r.people), ...q.pending].map(p => p.name);
const gameQueue = () => makeQueue(4, 4, 6000, tier => tier >= 5 ? 1 : 4, tier => tier >= 7);

test('gom theo cấp, giữ chỗ hàng đang thắp và đưa người chờ vào khi xong', () => {
  const q = makeQueue(3, 2, 1000);
  for (const name of 'abcdefgh') q.add(name, 0);
  assert.deepEqual(q.rows.map(r => r.people.map(p => p.name).join('')), ['ab', 'cd', 'ef']);
  assert.deepEqual(q.pending.map(p => p.name), ['g', 'h']);
  assert.equal(q.depart(0).people.map(p => p.name).join(''), 'ab');
  assert.equal(q.depart(0), null);
  q.add('i', 0);
  assert.equal(q.rows.length, 2);
  assert.deepEqual(q.pending.map(p => p.name), ['g', 'h', 'i']);
  q.finish(10);
  assert.deepEqual(q.rows.map(r => r.people.map(p => p.name).join('')), ['cd', 'ef', 'gh']);
  assert.deepEqual(q.pending.map(p => p.name), ['i']);
});

test('hàng thiếu người chỉ lên khi hết thời gian chờ, không trộn cấp', () => {
  const q = makeQueue(3, 2, 1000);
  q.add('a', 0, 1); q.add('b', 0, 3); q.add('c', 0, 1); q.add('d', 0, 3); q.add('e', 0, 2);
  assert.deepEqual(q.rows.map(r => [r.tier, r.people.map(p => p.name).join('')]), [[1, 'ac'], [3, 'bd'], [2, 'e']]);
  q.depart(0); q.finish(10); q.depart(10); q.finish(20);
  assert.equal(q.depart(999), null);
  assert.equal(q.depart(1000).people[0].name, 'e');
});

test('VIP ưu tiên FIFO sau lượt đang diễn, nhưng không vượt số hàng hiển thị', () => {
  const q = gameQueue();
  q.add('current', 0, 5); q.depart(0);
  for (let i = 0; i < 10; i++) q.add('normal' + i, i, 5);
  for (let i = 0; i < 100; i++) q.add('vip' + i, i, 7);
  assert.equal(q.offering.people[0].name, 'current');
  assert.equal(q.rows.length, 3);
  assert.equal(q.rows[0].people[0].name, 'vip0');
  q.finish(1000);
  assert.equal(q.rows.length, 4);
  assert.equal(q.depart(1000).people[0].name, 'vip0');
  q.finish(2000);
  assert.equal(q.depart(2000).people[0].name, 'vip1');
});

test('tối đa 200 người chờ, bỏ bình luận trước rồi bỏ quà cũ nhất', () => {
  const q = gameQueue();
  q.add('comment', 0, 1);
  for (let i = 0; i < 200; i++) q.add('gift' + i, i, 5);
  assert.equal(names(q).length, 200);
  assert.ok(!names(q).includes('comment'));
  q.add('new-gift', 1000, 7);
  assert.equal(names(q).length, 200);
  assert.ok(!names(q).includes('gift0'));
  assert.ok(names(q).includes('new-gift'));
  assert.equal(q.skipped, 2);
  assert.equal(q.add('new-comment', 1001, 1), false);
  assert.ok(!names(q).includes('new-comment'));
});

test('bình luận chờ quá 60 giây hết hạn, quà và lượt đang diễn được giữ', () => {
  const q = gameQueue();
  q.add('current', 0, 1); q.depart(6000);
  q.add('stale', 0, 1); q.add('gift', 0, 5);
  q.finish(60000);
  assert.deepEqual(names(q), ['gift']);
  assert.equal(q.skipped, 1);
  assert.equal(q.depart(60000).people[0].name, 'gift');
});

test('hết hạn cả khi không có sự kiện mới, không khởi động lại đồng hồ chờ', () => {
  const q = gameQueue();
  q.add('old', 0, 1);
  q.add('new', 59000, 1);
  assert.equal(q.depart(60000), null);
  assert.deepEqual(names(q), ['new']);
  assert.equal(q.depart(65000).people[0].name, 'new');
});

test('nạp liên tục 10 phút vẫn hữu hạn và không bỏ lượt đang diễn', () => {
  const q = gameQueue();
  q.add('current', 0, 5); q.depart(0);
  for (let i = 1; i <= 600; i++) {
    q.add('comment' + i, i * 1000, 1);
    q.add('gift' + i, i * 1000, 7);
    assert.ok(names(q).length <= 200);
    assert.ok(q.rows.length <= 3);
    assert.equal(q.offering.people[0].name, 'current');
  }
});
