import { test } from 'node:test';
import assert from 'node:assert/strict';
import createCommentLimit from '../public/comment-limit.js';

// Đồng hồ giả: thời gian là số mili-giây do test đặt
function clock() {
  let t = 0;
  return { now: () => t, set: ms => { t = ms; } };
}

test('mỗi người tính một lần trong cooldown', () => {
  const c = clock();
  const allow = createCommentLimit({ cooldownMs: 30000, gapMs: 0, now: c.now });
  assert.equal(allow('ann'), true);
  c.set(29999);
  assert.equal(allow('ann'), false);
  c.set(30000);
  assert.equal(allow('ann'), true);
});

test('cả phòng: hai bình luận được tính cách nhau ít nhất gapMs', () => {
  const c = clock();
  const allow = createCommentLimit({ cooldownMs: 0, gapMs: 1000, now: c.now });
  assert.equal(allow('a'), true);
  assert.equal(allow('b'), false);
  c.set(999);
  assert.equal(allow('b'), false);
  c.set(1000);
  assert.equal(allow('b'), true);
});

test('bị chặn vì phòng thì không tính vào cooldown của người đó', () => {
  const c = clock();
  const allow = createCommentLimit({ cooldownMs: 30000, gapMs: 1000, now: c.now });
  assert.equal(allow('a'), true);
  assert.equal(allow('b'), false); // cùng giây: phòng chưa cho
  c.set(1000);
  assert.equal(allow('b'), true);  // b chưa được tính lần nào nên vào ngay khi phòng rảnh
});

test('bị chặn vì người đó thì không chiếm chỗ của phòng', () => {
  const c = clock();
  const allow = createCommentLimit({ cooldownMs: 30000, gapMs: 1000, now: c.now });
  assert.equal(allow('a'), true);
  c.set(1000);
  assert.equal(allow('a'), false); // a vẫn trong cooldown 30 giây
  assert.equal(allow('c'), true);  // lần bị chặn của a không làm phòng phải chờ thêm
});

test('dọn người đã hết cooldown khi danh sách quá dài, không ảnh hưởng người mới', () => {
  const c = clock();
  const allow = createCommentLimit({ cooldownMs: 1000, gapMs: 0, now: c.now });
  for (let i = 0; i < 5001; i++) allow('u' + i);
  c.set(1000);
  assert.equal(allow('new'), true);
  assert.equal(allow('u0'), true);
});
