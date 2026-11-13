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
  source.emit('gift', gift('current')); game.advance(6); // hàng chưa đủ người nên chờ hết 6 giây rồi mới lên diễn
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

test('giọng đọc mặc định bật: chạm đầu tiên nói ngay trong thao tác, lỗi thì chạm lại là thử lại, live không có nút tắt', () => {
  const calls = [];
  const synthesis = { getVoices: () => [], speak: u => calls.push(u), cancel() {}, addEventListener() {} };
  class Utterance { constructor(text) { this.text = text; } }
  const game = createGame({ speech: { synthesis, Utterance } });
  assert.equal(calls.length, 0, 'chưa chạm thì chưa nói');
  game.dispatch('pointerdown', {});
  assert.equal(calls.length, 1, 'chạm đầu tiên phải gọi speak ngay trong thao tác, không chờ timer hay voiceschanged');
  assert.equal(calls[0].lang, 'vi-VN');
  calls[0].onerror({ error: 'not-allowed' });
  assert.match(game.read("document.getElementById('voice').textContent"), /chưa cho phép/);
  game.dispatch('keydown', {});
  assert.equal(calls.length, 2, 'sau lỗi, chạm lại là tự thử lại');
  calls[1].onstart(); calls[1].onend();
  game.dispatch('pointerdown', {});
  assert.equal(calls.length, 2, 'đã bật thì không đọc lại câu thử');
  game.hide();
  game.dispatch('pointerdown', {});
  assert.equal(calls.length, 3, 'trang quay lại từ nền: chạm một lần là bật lại');
});

test('trang thử: nút Thử giọng đọc gọi TTS ngay trong thao tác click', () => {
  const calls = [];
  const synthesis = { getVoices: () => [], speak: u => calls.push(u), cancel() {}, addEventListener() {} };
  class Utterance { constructor(text) { this.text = text; } }
  const game = createGame({ search: '?ve', speech: { synthesis, Utterance } });
  game.click('voice-test');
  assert.equal(calls.length, 1, 'phải gọi speak ngay trong thao tác click');
  assert.equal(calls[0].lang, 'vi-VN');
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

test('bốn người cùng cấp cao xếp chung một hàng, cả hàng lên một màn và hoàn tất', () => {
  const game = createGame({ search: '?ve' });
  for (const name of ['An', 'Bình', 'Chi', 'Dũng']) game.add(name, 12);
  game.advance(.1);
  assert.equal(game.read('q.offering.people.length'), 4);
  let completed = false;
  for (let seconds = 1; seconds <= 120 && !completed; seconds++) {
    game.advance(1);
    completed = game.read('!q.offering && !q.rows.length && !q.pending.length');
  }
  assert.equal(completed, true);
});
