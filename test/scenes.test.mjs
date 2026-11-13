import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/game.mjs';

// Cảnh 4 (nứt rồi ngập): chỉ trả về các ảnh còn nhìn thấy; ảnh đã phủ kín thì che các ảnh dưới nó
test('cảnh 4: hallFrames chọn đúng ảnh và độ mờ theo thời gian', () => {
  const game = createGame();
  game.read('HALL_STEPS.forEach(([name]) => { R[name] = {}; }), true'); // sandbox không tải ảnh, đánh dấu là đã có
  const names = s => game.read(`hallFrames(${s})`).map(([name]) => name);

  assert.deepEqual(game.read('hallFrames(0.1)'), []);
  assert.deepEqual(names(0.5), ['hall_crack_00', 'hall_crack_01']);

  const mid = game.read('hallFrames(1.2)');
  assert.deepEqual(mid.map(([name]) => name), ['hall_crack_02', 'hall_crack_03']);
  assert.equal(mid[0][1], 1); // crack_02 đã phủ kín, các ảnh trước không cần vẽ
  assert.ok(mid[1][1] > 0 && mid[1][1] < 1);

  assert.deepEqual(names(2.6), ['hall_flood_02']);
});
