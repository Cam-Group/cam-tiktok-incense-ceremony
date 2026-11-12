import { test } from 'node:test';
import assert from 'node:assert/strict';
import createLiveEventHandler from '../public/live-events.js';

// Theo TiktokLive/src/events.js: diamonds là tổng combo, ID giữ nguyên dạng chuỗi.
const user = { id: '7390000000000000001', uniqueId: 'alice', nickname: 'Alice' };
const gift = overrides => ({ eventId: '7390000000000000102', roomId: '7390000000000000003', user,
  gift: 'Rose', diamonds: 10, diamondCount: 2, repeatCount: 5, isStreakOver: true, ...overrides });
function setup() {
  const gifts = [], chats = [], statuses = [], invalid = [];
  const handle = createLiveEventHandler({
    onGift: (name, diamonds, key) => gifts.push({ name, diamonds, key }),
    onChat: (name, key) => chats.push({ name, key }),
    onStatus: text => statuses.push(text), onInvalid: () => invalid.push(true),
  });
  return { handle, gifts, chats, statuses, invalid, send: (type, data) => handle(type, JSON.stringify(data)) };
}

test('quà đúng schema backend: cộng tổng combo một lần, không nhân repeatCount', () => {
  const s = setup();
  assert.equal(s.send('gift', gift()), true);
  assert.deepEqual(s.gifts, [{ name: 'Alice', diamonds: 10, key: 'id:7390000000000000001' }]);
  s.send('chat', { user, text: 'Hello', eventId: 'chat1', roomId: 'room' });
  s.send('status', { text: 'Connected' });
  assert.equal(s.chats[0].name, 'Alice');
  assert.deepEqual(s.statuses, ['Connected']);
});

test('bỏ payload lỗi, không ép kiểu số sai và vẫn nhận sự kiện hợp lệ tiếp theo', () => {
  const s = setup();
  for (const data of [null, [], {}, gift({ user: null }), gift({ user: { ...user, id: 123 } }),
    gift({ diamonds: '10' }), gift({ diamonds: 0 }), gift({ diamonds: -1 }),
    gift({ diamonds: 1.5 }), gift({ diamonds: Number.MAX_SAFE_INTEGER + 1 }),
    gift({ isStreakOver: false }), gift({ eventId: 123 })]) {
    assert.equal(s.send('gift', data), false);
  }
  assert.equal(s.handle('gift', '{broken'), false);
  assert.equal(s.send('chat', { user, text: null }), false);
  assert.equal(s.send('status', { text: {} }), false);
  assert.equal(s.gifts.length, 0);
  assert.equal(s.invalid.length, 15);
  assert.equal(s.send('gift', gift()), true);
  assert.equal(s.gifts.length, 1);
});

test('ưu tiên user.id, không gộp hai người trùng nickname hay người không có ID', () => {
  const s = setup();
  s.send('gift', gift({ eventId: 'a', user: { ...user, uniqueId: 'old' } }));
  s.send('gift', gift({ eventId: 'b', user: { ...user, uniqueId: 'new' } }));
  s.send('gift', gift({ eventId: 'c', user: { ...user, id: 'another' } }));
  assert.equal(s.gifts[0].key, s.gifts[1].key);
  assert.notEqual(s.gifts[0].key, s.gifts[2].key);
  s.send('gift', gift({ eventId: '', user: { id: '', uniqueId: '', nickname: '' } }));
  s.send('gift', gift({ eventId: '', user: { id: '', uniqueId: '', nickname: '' } }));
  assert.notEqual(s.gifts[3].key, s.gifts[4].key);
  assert.equal(s.gifts[3].name, 'Khách');
  s.send('gift', gift({ eventId: 'd', user: { ...user, id: '' } }));
  assert.equal(s.gifts[5].key, 'username:alice');
});

test('lọc trùng bằng loại + roomId + eventId, không dùng giftId để lọc', () => {
  const s = setup();
  s.send('gift', gift({ giftId: 'rose' }));
  assert.equal(s.send('gift', gift({ giftId: 'rose' })), false);
  s.send('gift', gift({ eventId: 'different', giftId: 'rose' }));
  s.send('gift', gift({ roomId: 'another-room', giftId: 'rose' }));
  s.send('chat', { user, text: 'Hi', eventId: gift().eventId, roomId: gift().roomId });
  assert.equal(s.gifts.length, 3);
  assert.equal(s.chats.length, 1);
});

test('bộ lọc trùng hữu hạn 2000 ID, không loại các quà thiếu eventId', () => {
  const s = setup();
  for (let i = 0; i <= 2000; i++) s.send('gift', gift({ eventId: String(i) }));
  assert.equal(s.send('gift', gift({ eventId: '0' })), true);
  assert.equal(s.send('gift', gift({ eventId: '2000' })), false);
  s.send('gift', gift({ eventId: '' })); s.send('gift', gift({ eventId: '' }));
  assert.equal(s.gifts.length, 2004);
});
