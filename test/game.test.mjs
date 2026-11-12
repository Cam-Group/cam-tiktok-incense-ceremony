import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/game.mjs';

const user = { id: '7390000000000000001', uniqueId: 'alice', nickname: 'Alice' };
const gift = eventId => ({ eventId, roomId: 'room', user, diamonds: 10, repeatCount: 5, isStreakOver: true });
const waiting = 'q.rows.reduce((n, r) => n + r.people.length, 0) + q.pending.length';

test('script thật: URL nền, gift/status lỗi và lọc trùng được nối vào game', () => {
  const game = createGame();
  const source = game.sources[0];
  assert.equal(source.url, 'https://backend.example.com/live/events?username=alice');
  source.emit('gift', gift('a')); source.emit('gift', gift('a'));
  source.emit('gift', '{broken'); source.emit('gift', gift('b'));
  source.emit('status', null); source.emit('status', { text: 'Connected' });
  assert.equal(game.read('board.top()[0].diamonds'), 20);
  assert.equal(game.read(waiting), 2);
  assert.equal(game.read("document.getElementById('link').textContent"), 'Connected');
});

test('quá tải bỏ màn diễn cũ nhưng mọi quà hợp lệ vẫn được cộng điểm', () => {
  const game = createGame();
  const source = game.sources[0];
  source.emit('gift', gift('current')); game.advance(.1);
  for (let i = 0; i < 300; i++) source.emit('gift', gift('gift' + i));
  assert.equal(game.read('board.top()[0].diamonds'), 3010);
  assert.equal(game.read(waiting), 200);
  assert.equal(game.read('q.rows.length'), 3);
  assert.equal(game.read('q.offering.people[0].name'), 'Alice');
  assert.equal(game.read('q.skipped'), 100);
});

test('bình luận dùng cooldown theo user.id, không theo nickname hay username đổi được', () => {
  const game = createGame();
  const source = game.sources[0];
  source.emit('chat', { eventId: 'a', user, text: 'Hi' });
  game.advance(1);
  source.emit('chat', { eventId: 'b', user: { ...user, uniqueId: 'new' }, text: 'Hi' });
  source.emit('chat', { eventId: 'c', user: { ...user, id: 'another' }, text: 'Hi' });
  assert.equal(game.read(waiting), 2);
});

test('override server được chuẩn hóa; URL có query/fragment/credentials bị bỏ qua', () => {
  const good = createGame({ search: '?ve&username=alice&server=' + encodeURIComponent('https://override.example/path///') });
  assert.equal(good.sources[0].url, 'https://override.example/path/events?username=alice');
  for (const base of ['https://override.example?x=1', 'https://override.example/#x', 'https://user:secret@override.example']) {
    const game = createGame({ search: '?ve&username=alice&server=' + encodeURIComponent(base) });
    assert.equal(game.sources[0].url, 'https://backend.example.com/live/events?username=alice');
  }
});

test('nút giọng đọc gọi TTS trực tiếp dù danh sách giọng iPhone còn rỗng', () => {
  const calls = [];
  const synthesis = { getVoices: () => [], speak: u => calls.push(u), cancel() {}, addEventListener() {} };
  class Utterance { constructor(text) { this.text = text; } }
  const game = createGame({ speech: { synthesis, Utterance } });
  assert.equal(calls.length, 0);
  game.click('voice-enable');
  assert.equal(calls.length, 1, 'phải gọi speak ngay trong thao tác click, không chờ timer hay voiceschanged');
  assert.equal(calls[0].lang, 'vi-VN');
  calls[0].onerror({ error: 'not-allowed' });
  assert.match(game.read("document.getElementById('voice').textContent"), /cho phép|Thử lại/);
  assert.equal(game.read("document.getElementById('voice-enable').disabled"), false);
  game.click('voice-enable'); calls[1].onstart(); calls[1].onend();
  game.hide();
  assert.equal(game.read("document.getElementById('voice-controls').dataset.state"), 'idle');
  assert.equal(game.read("document.getElementById('voice-enable').textContent"), 'Bật giọng đọc');
});

test('cả 12 cấp hoàn tất qua update/draw/frame thật, không kẹt hàng', () => {
  for (let tier = 1; tier <= 12; tier++) {
    const game = createGame({ search: '?ve' });
    game.add('Dummy', tier);
    let completed = false;
    for (let seconds = 1; seconds <= 120; seconds++) {
      game.advance(1);
      if (game.read('!q.offering && !q.rows.length && !q.pending.length')) { completed = true; break; }
    }
    assert.equal(completed, true, 'cấp ' + tier);
  }
});
