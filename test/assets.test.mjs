import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createGame } from './helpers/game.mjs';

// Mọi ảnh assets/ mà trang yêu cầu lúc tải (ảnh nhân vật, ảnh cảnh, ảnh hiệu ứng) đều phải có file, nếu không trình duyệt báo 404
test('mọi ảnh assets/ mà trang yêu cầu đều có file trên đĩa', () => {
  const game = createGame({ search: '?username=alice' }); // không có ?ve: chế độ ảnh thật
  const requested = [...new Set(game.images.filter(src => src.startsWith('assets/')).map(src => src.split('?')[0]))];
  assert.ok(requested.length > 50, 'phải ghi lại được các ảnh của cảnh');
  const missing = requested.filter(path => !existsSync(new URL('../public/' + path, import.meta.url)));
  assert.deepEqual(missing, []);
});
