import { test } from 'node:test';
import assert from 'node:assert/strict';
import levels from '../public/levels.js';

const { LEVELS, levelOfDiamonds, makeBoard } = levels;

test('có ít nhất 10 cấp, cấp 1 là bình luận, ngưỡng tăng dần', () => {
  assert.ok(LEVELS.length >= 10);
  assert.equal(LEVELS[0].min, 0);
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].min > LEVELS[i - 1].min);
});

test('quà luôn từ cấp 2, đúng ngưỡng từng cấp', () => {
  assert.equal(levelOfDiamonds(0), 2);
  assert.equal(levelOfDiamonds(NaN), 2);
  assert.equal(levelOfDiamonds(1), 2);
  assert.equal(levelOfDiamonds(2), 3);
  assert.equal(levelOfDiamonds(4), 3);
  assert.equal(levelOfDiamonds(5), 4);
  assert.equal(levelOfDiamonds(499), 9);
  assert.equal(levelOfDiamonds(500), 10);
  assert.equal(levelOfDiamonds(2999), 11);
  assert.equal(levelOfDiamonds(3000), 12);
  assert.equal(levelOfDiamonds(1e6), 12);
});

test('bảng điểm chỉ nhận số nguyên dương an toàn, không nối chuỗi hay nhận NaN', () => {
  const b = makeBoard();
  b.add('a', 'An', 10);
  for (const value of ['10', null, true, NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(b.add('a', 'An', value), false);
  }
  b.add('a', 'An', 10);
  assert.equal(b.top()[0].diamonds, 20);
});

test('bảng xếp hạng cộng dồn theo người, lấy top 5 giảm dần', () => {
  const b = makeBoard();
  b.add('a', 'An', 10); b.add('b', 'Bình', 50); b.add('a', 'An mới', 45);
  ['c', 'd', 'e', 'f'].forEach((k, i) => b.add(k, k, i + 1));
  const top = b.top(5);
  assert.equal(top.length, 5);
  assert.deepEqual(top.slice(0, 2), [{ name: 'An mới', diamonds: 55 }, { name: 'Bình', diamonds: 50 }]);
  assert.deepEqual(top.map(e => e.diamonds), [55, 50, 4, 3, 2]);
});
