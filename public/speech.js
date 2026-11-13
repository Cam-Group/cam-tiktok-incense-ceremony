// Web Speech là luồng riêng với AudioContext. enable() phải gọi trực tiếp từ thao tác người dùng.
function createSpeechController({ synthesis, Utterance, rate = 1.1, onState = () => {} }) {
  const supported = !!synthesis && typeof synthesis.speak === 'function' && typeof Utterance === 'function';
  let enabled = false, phase = '', active = null, pending = null;
  const report = (next, message) => { phase = next; onState({ phase, message }); };
  const cancelNative = () => { try { synthesis?.cancel(); } catch {} };
  const voice = () => {
    try { return synthesis.getVoices().find(v => /^vi(?:[-_]|$)/i.test(v.lang)); } catch { return undefined; }
  };
  const hint = () => {
    if (!supported) report('unavailable', 'Trình duyệt không hỗ trợ giọng đọc. Game vẫn chạy; hãy thử trình duyệt khác.');
    else report('idle', voice() ? 'Giọng đọc tự bật khi bạn chạm vào trang lần đầu.' :
      'Giọng đọc tự bật khi bạn chạm vào trang. Danh sách giọng Việt chưa sẵn sàng, máy sẽ dùng giọng mặc định.');
  };
  const errorText = code => {
    if (code === 'not-allowed') return 'Trình duyệt chưa cho phép đọc. Chạm lại vào trang để thử lại.';
    if (code === 'language-unavailable' || code === 'voice-unavailable')
      return 'Máy chưa cung cấp giọng tiếng Việt. Kiểm tra giọng Việt trong cài đặt giọng nói, rồi chạm lại vào trang để thử lại.';
    if (code === 'start-timeout') return 'Trình duyệt chưa bắt đầu đọc. Chạm lại vào trang để thử lại khi trang đang mở.';
    if (code === 'timeout') return 'Giọng đọc bị treo hoặc gián đoạn. Chạm lại vào trang để thử lại.';
    if (code === 'audio-busy' || code === 'audio-hardware') return 'Không mở được âm thanh cho giọng đọc. Kiểm tra âm thanh của máy rồi chạm lại vào trang để thử lại.';
    return 'Giọng đọc bị lỗi hoặc bị ngắt. Chạm lại vào trang để thử lại; game vẫn tiếp tục.';
  };

  function job(done, probe = false) {
    const current = { probe, timers: [], utterance: null, settled: false };
    current.finish = (error, cancelled = false) => {
      if (current.settled) return;
      current.settled = true;
      current.timers.forEach(clearTimeout);
      if (active === current) active = null;
      if (error) {
        enabled = false;
        cancelNative();
        report('error', errorText(error));
      } else if (probe && !cancelled) {
        enabled = true;
        if (phase !== 'ready') report('ready', 'Giọng đọc đã bật.');
      }
      done();
      const next = pending;
      pending = null;
      if (next) speak(next.text, next.done);
    };
    active = current; // giữ tham chiếu utterance đến khi đọc xong, tránh bị thu hồi giữa chừng
    return current;
  }

  function stop() {
    const next = pending;
    pending = null;
    active?.finish(null, true);
    cancelNative();
    next?.done();
  }

  function start(text, done, probe = false) {
    const current = job(done, probe);
    if (!supported || (!enabled && !probe)) {
      // Không có giọng hoặc chưa bật: giữ đủ thời gian đọc chữ, nhưng không khóa hàng đợi.
      current.timers.push(setTimeout(() => current.finish(), Math.max(5000, text.length * 70)));
      return;
    }
    try {
      const utterance = new Utterance(text);
      current.utterance = utterance;
      utterance.lang = 'vi-VN'; utterance.rate = rate;
      const selected = voice();
      if (selected) utterance.voice = selected;
      // Danh sách giọng có thể rỗng/tải chậm trên iOS. Vẫn yêu cầu vi-VN, không bỏ đọc.
      const starting = setTimeout(() => current.finish('start-timeout'), 5000);
      current.timers.push(starting);
      current.timers.push(setTimeout(() => current.finish('timeout'), 8000 + text.length * 150));
      utterance.onstart = () => {
        if (current.settled) return;
        clearTimeout(starting);
        enabled = true;
        if (phase !== 'ready') report('ready', 'Giọng đọc đã bật.');
      };
      utterance.onend = () => current.finish();
      utterance.onerror = event => current.finish(event.error || 'unknown');
      synthesis.speak(utterance); // không await/timer ở trước lời gọi này: giữ user activation của click
    } catch {
      current.finish('unknown');
    }
  }

  function speak(text, done) {
    if (active?.probe) {
      // Chỉ giữ một lượt game trong lúc câu thử đang đọc; không chen hoặc tạo hàng đợi TTS vô hạn.
      pending?.done();
      pending = { text, done };
      return;
    }
    if (active) { active.finish(null, true); cancelNative(); }
    start(text, done);
  }

  const controller = {
    enable() {
      if (!supported || phase === 'testing') return;
      stop();
      enabled = false;
      report('testing', 'Đang thử giọng đọc tiếng Việt…');
      start('Đã bật giọng đọc. Kính chúc quý vị bình an.', () => {}, true);
    },
    speak,
    ensure() { if (!enabled) controller.enable(); }, // giọng đọc mặc định bật: chạm vào trang mà chưa bật thì bật lại, không có lệnh tắt
    reset() {
      stop(); enabled = false;
      if (supported) report('idle', 'Trang vừa bị gián đoạn. Chạm lại vào trang để giọng đọc tiếp tục.');
    },
  };
  if (supported) {
    const refresh = () => { if (phase === 'idle') hint(); };
    if (typeof synthesis.addEventListener === 'function') synthesis.addEventListener('voiceschanged', refresh);
    else synthesis.onvoiceschanged = refresh;
  }
  hint();
  return controller;
}
if (typeof module !== 'undefined') module.exports = createSpeechController;
