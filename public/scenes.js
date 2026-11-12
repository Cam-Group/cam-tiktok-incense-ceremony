// Màn diễn của 12 cấp quà. Mọi cảnh mới đều bắt nguồn từ một sự kiện trong điện (hall),
// và trở về điện bằng sương mù phủ kín màn hình rồi tan.
// File này dùng các biến và hàm vẽ của index.html (ctx, W, H, bg, ell, lg, rg, line, petal, drawPerson, tone…).
// Mỗi cảnh: dur = thời lượng (giây), cut = lúc chuyển sang cảnh mới (1e9 = ở lại điện),
// hall(sc, s, t) vẽ đè lên điện, world(sc, s, t) vẽ cảnh mới kín màn hình. s = giây từ đầu màn, t = đồng hồ chung.

const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // số giả ngẫu nhiên cố định theo i
const FOG_S = 2.4; // sương mù đưa về điện: nửa đầu phủ kín, nửa sau tan

// ---------- Ảnh thật (assets/, nguồn ghi trong CREDITS.md) ----------
// Ảnh nào chưa tải xong hoặc thiếu thì phần vẽ bằng code ở dưới thay thế.
const R = {};
const pad2 = n => String(n).padStart(2, '0');
['bg_pond.jpg', 'bg_night.jpg', 'bg_storm.jpg', 'bg_ink.jpg', 'bg_buddha.jpg', 'bg_sky.jpg', 'bg_stars.jpg', 'bg_seaclouds.jpg',
 'lotus.png', 'lantern.png', 'pagoda.png', 'crane1.png', 'crane2.png', 'koi.png', 'lion.png', 'bolt_0.jpg', 'bolt_1.jpg', 'bolt_2.jpg',
 ...Array.from({ length: 12 }, (_, i) => `fwa_${pad2(i)}.jpg`), ...Array.from({ length: 12 }, (_, i) => `fwb_${pad2(i)}.jpg`),
].forEach(f => { const im = new Image(); im.onload = () => { R[f.split('.')[0]] = im; }; im.src = 'assets/' + f + '?v=1'; });
function bgImg(name, dark = 0) { // ảnh nền phủ kín màn hình; trả false nếu chưa có ảnh
  if (!R[name]) return false;
  ctx.drawImage(R[name], 0, 0, W, H); if (dark) fill(`rgba(0,0,0,${dark})`);
  return true;
}
function pic(name, x, y, w, rot = 0, flip = false, a = 1) { // ảnh đã tách nền, tâm tại (x, y), rộng w
  const im = R[name]; if (!im) return false;
  const h = w * im.height / im.width;
  ctx.save(); ctx.globalAlpha *= cl(a); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  return true;
}
// Sét thật: 3 khung hình tia sét trên nền tối, vẽ cộng sáng nên nền đen tự mất. p = 0..1 tiến độ một lần đánh
function boltPic(x, y, w, p) {
  const im = R['bolt_' + Math.min(2, p * 3 | 0)]; if (!im) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(im, x - w / 2, y - w * .375, w, w * .75); ctx.restore();
  return true;
}

// ---------- Hình vẽ dùng chung ----------
function fill(style) { ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); }
function sky(...ss) { fill(lg(ctx, 0, 0, 0, H, ...ss)); }
function flash(a, col = '255,255,255') { if (a > 0) fill(`rgba(${col},${cl(a)})`); }
function stars(t, n = 90, maxY = 800) {
  for (let i = 0; i < n; i++) ell(ctx, hash(i) * W, hash(i + 500) * maxY, 1.5, 1.5, `rgba(255,255,230,${.4 + .6 * Math.sin(t * 2 + i)})`);
}
function cloudBlob(x, y, w, a = 1, col) {
  ctx.save(); ctx.globalAlpha *= cl(a);
  if (IMG.cloud && !col) { const h = w * IMG.cloud.height / IMG.cloud.width; ctx.drawImage(IMG.cloud, x - w / 2, y - h / 2, w, h); }
  else [[-.28, .06, .26], [.26, .08, .24], [0, -.04, .34]].forEach(([dx, dy, r]) => ell(ctx, x + dx * w, y + dy * w, r * w, r * w * .62, `rgb(${col || '240,242,246'})`));
  ctx.restore();
}
function fogCover(a, t) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = cl(a); fill('#e6e8ee');
  for (let i = 0; i < 10; i++) cloudBlob(((hash(i) * 1000 + t * (20 + hash(i + 1) * 40)) % 1000) - 140, hash(i + 2) * H, 420 + hash(i + 3) * 300, .8);
  ctx.restore();
}
function aura(x, y, r, col = '255,235,150', a = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ell(ctx, x, y, r, r, rg(ctx, x, y, r * .1, r, [0, `rgba(${col},${.8 * cl(a)})`], [1, `rgba(${col},0)`]));
  ctx.restore();
}
function beam(x0, y0, x1, y1, a) { // luồng sáng từ trên rọi xuống
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lg(ctx, 0, y0, 0, y1, [0, `rgba(255,250,215,${.75 * a})`], [1, `rgba(255,250,215,${.2 * a})`]);
  ctx.beginPath(); ctx.moveTo(x0 - 16, y0); ctx.lineTo(x0 + 16, y0); ctx.lineTo(x1 + 110, y1); ctx.lineTo(x1 - 110, y1); ctx.fill();
  ctx.restore();
}
function crown(x, y, t) { // hào quang toả tia quanh người tặng
  aura(x, y, 270, '255,240,170', 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(t * .5); ctx.fillStyle = 'rgba(255,245,190,.3)';
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -340); ctx.lineTo(16, -340); ctx.fill(); }
  ctx.restore();
}
function bigName(text, x, y, size, a = 1, col = '#ffe9a0') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = cl(a); ctx.font = `bold ${size}px ${SERIF}`; ctx.textAlign = 'center';
  ctx.lineWidth = size / 7; ctx.strokeStyle = 'rgba(70,10,5,.9)'; ctx.strokeText(text, x, y, 680);
  ctx.shadowColor = col; ctx.shadowBlur = size / 2; ctx.fillStyle = col; ctx.fillText(text, x, y, 680);
  ctx.restore();
}
// Vẽ một nhân vật ở vị trí và cỡ tuỳ ý (k = 1 là cỡ đứng sát camera), kèm thẻ tên
function hero(p, x, y, k, t) {
  const s0 = .5 + p.y / 1300;
  ctx.save(); ctx.translate(x, y); ctx.scale(k / s0, k / s0); ctx.translate(-p.x, -p.y); drawPerson(p, t); ctx.restore();
}
const stand = (sc, t) => sc.ps.forEach(p => drawPerson(p, t));
const mid = sc => sc.ps.reduce((a, p) => a + p.x, 0) / sc.ps.length;
function rain(t, x0, x1, y0, y1, a) {
  ctx.strokeStyle = `rgba(190,215,255,${.55 * a})`; ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) { const x = x0 + hash(i) * (x1 - x0), y = y0 + ((hash(i + 1) * 900 + t * 1500) % (y1 - y0)); line(ctx, x, y, x - 5, y + 46); }
}
function lantern(x, y, k, a = 1) { // đèn trời
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= a;
  aura(0, 0, 70, '255,170,70', .6);
  if (pic('lantern', 0, 0, 74)) { ctx.restore(); return; } // đèn trời thật
  ctx.fillStyle = lg(ctx, 0, -34, 0, 30, [0, '#ffd27a'], [.7, '#ff8a2a'], [1, '#c2410c']);
  ctx.beginPath(); ctx.moveTo(-20, -32); ctx.quadraticCurveTo(-30, 0, -15, 30); ctx.lineTo(15, 30); ctx.quadraticCurveTo(30, 0, 20, -32); ctx.closePath(); ctx.fill();
  ell(ctx, 0, 26, 7, 5, '#fff6c0');
  ctx.restore();
}
function pagoda(x, y, k, col = '#150a20', roof = col) { // chùa ba tầng mái cong, gốc toạ độ ở chân
  if (roof !== col && R.pagoda) { const w = 330 * k, h = w * R.pagoda.height / R.pagoda.width; ctx.drawImage(R.pagoda, x - w / 2, y - h + 14 * k, w, h); return; } // chùa Một Cột thật
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (let i = 0; i < 3; i++) {
    const w = 150 - i * 36, yy = -i * 78;
    ctx.fillStyle = col; ctx.fillRect(-w * .55, yy - 70, w * 1.1, 70);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-w - 30, yy - 62); ctx.quadraticCurveTo(-w * .6, yy - 78, -w * .5, yy - 100); ctx.lineTo(w * .5, yy - 100);
    ctx.quadraticCurveTo(w * .6, yy - 78, w + 30, yy - 62); ctx.quadraticCurveTo(0, yy - 84, -w - 30, yy - 62); ctx.fill();
  }
  ctx.fillStyle = roof; ctx.fillRect(-4, -292, 8, 40);
  ctx.restore();
}
function firework(x, y, age, col) {
  if (age < 0 || age > 1.6) return;
  const fr = R[(col.length % 2 ? 'fwa_' : 'fwb_') + pad2(Math.min(11, age / 1.6 * 12 | 0))];
  if (fr) { // pháo hoa thật: 12 khung hình liên tiếp, chỉ lấy nửa trên (nửa dưới là bóng phản chiếu trên nước)
    const w = 420, h = w * fr.height * .55 / fr.width;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(fr, 0, 0, fr.width, fr.height * .55, x - w / 2, y - h * .4, w, h); ctx.restore();
    return;
  }
  const r = (1 - Math.pow(1 - cl(age / 1.2), 3)) * 150, a = cl(1.6 - age);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 36; i++) {
    const g = i / 36 * 6.283, k = i % 2 ? 1 : .62, px = x + Math.cos(g) * r * k, py = y + Math.sin(g) * r * k + age * age * 30;
    ell(ctx, px, py, 9, 9, `rgba(${col},${a * .25})`); ell(ctx, px, py, 3, 3, `rgba(${col},${a})`);
  }
  ctx.restore();
}
function koi(x, y, ang, k = 1) { // cá chép
  if (pic('koi', x, y, 84 * k, ang + 2.2)) return; // đàn cá chép thật (trong ảnh gốc cá bơi chéo xuống phải)
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
  ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-58, -16); ctx.lineTo(-52, 0); ctx.lineTo(-58, 16); ctx.fill();
  ell(ctx, 0, 0, 38, 14, lg(ctx, 0, -14, 0, 14, [0, '#ffb347'], [.5, '#ff6a00'], [1, '#fff1e0']));
  ell(ctx, 8, -3, 12, 6, '#fff7ef'); ell(ctx, 26, -3, 2.5, 2.5, '#111');
  ctx.restore();
}
function crane(x, y, k, t) { // hạc vẽ bằng nét mực
  if (pic((t * 2 | 0) % 2 ? 'crane1' : 'crane2', x, y, 150 * k)) return; // hạc đầu đỏ thật, hai dáng bay
  const f = Math.sin(t * 5) * 14;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = '#1c1a18'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-34, -f); ctx.quadraticCurveTo(-14, -12 - f * .3, 0, 0); ctx.quadraticCurveTo(14, -12 - f * .3, 34, -f); ctx.stroke();
  line(ctx, -4, 2, 20, 6); ell(ctx, 22, 6, 3, 3, '#c8372d');
  ctx.restore();
}
function lion(x, y, k, t, bow = 0) { // lân múa, đầu quay về bên trái
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  if (R.lion) { ctx.translate(80, -82 + bow * 14); ctx.rotate(-bow * .3); ctx.scale(-1, 1); ctx.drawImage(R.lion, -90, -90, 180, 180); ctx.restore(); return; } // lân thật (ảnh gốc quay phải nên lật lại)
  for (let i = 5; i >= 1; i--) {
    const bx = i * 34, by = -70 + Math.sin(t * 8 + i) * 8;
    ell(ctx, bx, by, 30, 26, i % 2 ? '#e0322a' : '#ffc93a');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 26, .2, 2.9); ctx.stroke();
  }
  ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 9; [20, 60, 130, 170].forEach((lx, i) => line(ctx, lx, -50, lx + Math.sin(t * 12 + i * 1.6) * 12, 0));
  ctx.translate(-10, -80 + bow * 40); ctx.rotate(-bow * .5);
  ell(ctx, 0, 0, 52, 46, rg(ctx, -10, -10, 5, 52, [0, '#ffe07a'], [1, '#e0322a']));
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 18, 46, 0, Math.PI); ctx.fill();
  ell(ctx, 0, 24, 26, 12, '#7a0c0c');
  [-20, 20].forEach(ex => { ell(ctx, ex, -12, 13, 15, '#fff'); ell(ctx, ex - 3, -10, 6, 7, '#111'); });
  ell(ctx, 0, -46, 10, 16, '#ffc93a'); ell(ctx, 0, 4, 9, 6, '#ffc93a');
  ctx.restore();
}
// Rồng: at(i) trả [x, y] của đốt thứ i (0 = đầu). Vẽ từ đuôi lên đầu để đầu nằm trên.
function dragon(at, n, size, t, col = ['#fff3b0', '#e0a520', '#8a4a08']) {
  const P = []; for (let i = 0; i <= n; i++) P.push(at(i));
  for (let i = n; i >= 1; i--) {
    const [x, y] = P[i], r = size * (1 - i / n * .8);
    if (i % 2 === 0) { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x - r * .4, y - r * .8); ctx.lineTo(x, y - r * 1.7); ctx.lineTo(x + r * .4, y - r * .8); ctx.fill(); }
    ell(ctx, x, y, r, r, rg(ctx, x - r * .3, y - r * .3, r * .1, r, [0, col[0]], [.6, col[1]], [1, col[2]]));
  }
  const [hx, hy] = P[0], a = Math.atan2(hy - P[1][1], hx - P[1][0]), s = size;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
  ctx.fillStyle = '#c0392b'; [-1, 0, 1].forEach(k => { ctx.beginPath(); ctx.moveTo(-s * .6, k * s * .6); ctx.lineTo(-s * 2.4, k * s * 1.1); ctx.lineTo(-s * .9, k * s * .2); ctx.fill(); }); // bờm
  ell(ctx, 0, 0, s * 1.5, s * 1.1, rg(ctx, -s * .3, -s * .3, s * .1, s * 1.5, [0, col[0]], [.6, col[1]], [1, col[2]]));
  ell(ctx, s * 1.5, s * .15, s * .9, s * .6, col[1]);
  ctx.strokeStyle = col[0]; ctx.lineCap = 'round'; ctx.lineWidth = s * .16;
  line(ctx, -s * .2, -s * .8, -s * 1.3, -s * 1.9); line(ctx, s * .3, -s * .8, -s * .5, -s * 2);                                     // sừng
  ctx.lineWidth = s * .08; ctx.beginPath(); ctx.moveTo(s * 2.1, s * .2); ctx.quadraticCurveTo(s * 3.2, s * (.9 + Math.sin(t * 4) * .3), s * 2.3, s * 1.9); ctx.stroke(); // râu
  ell(ctx, s * .7, -s * .35, s * .28, s * .22, '#fff'); ell(ctx, s * .78, -s * .35, s * .12, s * .14, '#300');
  ctx.restore();
}
// Dáng Phật ngồi thiền, chỉ là hình khối không vẽ mặt. kind: 'gold' = tượng vàng, 'light' = thân ánh sáng. Gốc toạ độ ở đáy.
function buddha(x, y, k, kind) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const f = kind === 'gold' ? lg(ctx, 0, -566, 0, 0, [0, '#fff0a8'], [.5, '#e9b534'], [1, '#a86a12']) : 'rgba(255,255,244,.96)';
  ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(-230, 0); ctx.quadraticCurveTo(-250, -90, -150, -120); ctx.quadraticCurveTo(-190, -230, -150, -320);
  ctx.quadraticCurveTo(-90, -370, -40, -372); ctx.lineTo(40, -372); ctx.quadraticCurveTo(90, -370, 150, -320); ctx.quadraticCurveTo(190, -230, 150, -120);
  ctx.quadraticCurveTo(250, -90, 230, 0); ctx.closePath(); ctx.fill();
  ell(ctx, 0, -450, 72, 86, f); ell(ctx, 0, -540, 30, 26, f); ell(ctx, -74, -440, 12, 34, f); ell(ctx, 74, -440, 12, 34, f);
  ctx.restore();
}
function lotusSeat(x, y, k) { // đài sen
  if (pic('lotus', x, y - 26 * k, 470 * k)) return; // hoa sen thật
  for (let i = -4; i <= 4; i++) petal(ctx, x + i * 52 * k, y + 20 * k, 36 * k, (72 - Math.abs(i) * 6) * k, '#ffb3cf', '#d35a8f');
}
function lotusFlower(x, y, r) {
  if (pic('lotus', x, y - r * .4, r * 1.7)) return;
  for (let i = -2; i <= 2; i++) petal(ctx, x + i * r * .35, y, r * .3, r * (1 - Math.abs(i) * .18), '#ff9ec4', '#d35a8f');
}
// Lỗ thủng trên mái: e = độ mở 0..1, paint() vẽ bầu trời nhìn qua lỗ
function roofHole(e, paint) {
  if (e <= 0) return;
  const edge = new Path2D(); // giữ mép lỗ riêng: paint() vẽ hình khác nên không dùng được đường vẽ hiện tại của ctx
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * 6.283, k = e * (1 + (hash(i) - .5) * .35), x = 360 + Math.cos(a) * 330 * k, y = 110 + Math.sin(a) * 210 * k;
    i ? edge.lineTo(x, y) : edge.moveTo(x, y);
  }
  edge.closePath();
  ctx.save(); ctx.clip(edge); paint(); ctx.restore();
  ctx.save(); ctx.lineWidth = 12; ctx.strokeStyle = '#2a1408'; ctx.stroke(edge); ctx.lineWidth = 4; ctx.strokeStyle = '#7a4a22'; ctx.stroke(edge); ctx.restore();
}
// Cõi Phật: nền vàng rực, tia sáng xoay, Phật bằng ánh sáng trên đài sen
function realm(t) {
  fill(rg(ctx, 360, 420, 30, 1150, [0, '#fffbe0'], [.35, '#ffd86b'], [1, '#c4721c']));
  ctx.save(); ctx.translate(360, 440); ctx.rotate(t * .12); ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 18; i++) { ctx.rotate(6.283 / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -1400); ctx.lineTo(40, -1400); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 3; i++) { const r = 150 + i * 46 + Math.sin(t * 2 + i) * 5; ctx.lineWidth = 5; ell(ctx, 360, 441, r, r, null, `rgba(255,255,255,${.5 - i * .13})`); }
  ell(ctx, 360, 560, 270, 270, rg(ctx, 360, 560, 40, 270, [0, 'rgba(176,96,14,.75)'], [.7, 'rgba(196,114,28,.45)'], [1, 'rgba(196,114,28,0)'])); // nền sẫm để thân ánh sáng nổi lên
  ctx.save(); ctx.shadowColor = '#fff8c8'; ctx.shadowBlur = 60; buddha(360, 720, .62, 'light'); ctx.restore();
  lotusSeat(360, 724, 1.25);
  for (let i = 0; i < 9; i++) cloudBlob(((hash(i) * 900 + t * 12) % 900) - 90, 800 + hash(i + 2) * 140, 300, .85);
  for (let i = 0; i < 30; i++) { ctx.save(); ctx.translate(i * 97 % W + Math.sin(t + i) * 30, (t * 80 + i * 131) % H); ctx.rotate(t + i); ell(ctx, 0, 0, 8, 4.5, 'rgba(255,170,200,.8)'); ctx.restore(); }
}

// ---------- 12 màn ----------
const SCENES = {
  // 1 · Bình luận: sen nở dưới chân, lư hương bừng sáng
  1: { dur: 2, cut: 1e9, glow: .2,
    hall(sc, s) {
      const e = sm(0, .8, s), a = 1 - sm(1.5, 2, s);
      sc.ps.forEach(p => {
        if (pic('lotus', p.x, p.y - 4, 105 * e * (.5 + p.y / 1300), 0, false, a)) return; // hoa sen thật nở dưới chân
        ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y + 4); ctx.scale(1, .38);
        for (let k = 0; k < 10; k++) { ctx.rotate(.6283); ell(ctx, 30 * e, 0, 22 * e, 9 * e, 'rgba(255,165,200,.9)', 'rgba(200,80,130,.8)'); }
        ell(ctx, 0, 0, 10 * e, 10 * e, '#ffd76a'); ctx.restore();
      });
      aura(BX, RIM - 60, 160 * e, '255,200,110', a * .7);
    } },

  // 2 · Chuông tự rung, điện rung, Phật quang rọi xuống người tặng, kim sa rơi
  2: { dur: 4, cut: 1e9, glow: .7, shake: s => s < 1.2 ? 3 : 0,
    hall(sc, s) {
      const a = sm(0, .6, s) * (1 - sm(3.2, 4, s));
      ctx.globalCompositeOperation = 'lighter';
      sc.ps.forEach(p => {
        ctx.fillStyle = lg(ctx, 0, BUD_Y, 0, p.y, [0, `rgba(255,240,170,${.5 * a})`], [1, `rgba(255,240,170,${.12 * a})`]);
        ctx.beginPath(); ctx.moveTo(350, BUD_Y); ctx.lineTo(370, BUD_Y); ctx.lineTo(p.x + 55, p.y); ctx.lineTo(p.x - 55, p.y); ctx.fill();
      });
      for (let i = 0; i < 90; i++) ell(ctx, hash(i) * W, (s * (180 + hash(i + 7) * 160) + hash(i + 3) * H) % H, 2.2, 2.2, `rgba(255,225,130,${a * (.4 + .6 * hash(i + 1))})`);
    } },

  // 3 · Lư hương phun khói kín màn hình → điện trong đêm với trăm ngọn nến lơ lửng
  3: { dur: 9, cut: 2.2, glow: .3,
    hall(sc, s) {
      const e = sm(0, 2.2, s);
      for (let i = 0; i < 30; i++) cloudBlob(BX + (hash(i + 2) - .5) * W * 1.3 * e, RIM - 40 + (hash(i + 4) - .55) * H * e, 60 + 420 * e * (.5 + hash(i)), e * 1.6);
      flash(sm(1.2, 2.2, s), '233,235,240');
    },
    world(sc, s, t) {
      ctx.drawImage(bg, 0, 0); fill('rgba(4,8,40,.8)');
      sc.ps.forEach(p => aura(p.x, p.y - 100, 190, '255,200,120', .55)); stand(sc, t);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 80; i++) {
        const k = .6 + hash(i + 5) * .9, x = hash(i) * W + Math.sin(t * .5 + i) * 12, y = 120 + hash(i + 11) * 980 + Math.sin(t * .9 + i * 2) * 14 - (s - 2.2) * 8;
        ell(ctx, x, y, 30 * k, 30 * k, rg(ctx, x, y, 1, 30 * k, [0, 'rgba(255,190,90,.55)'], [1, 'rgba(255,190,90,0)'])); ell(ctx, x, y - 3 * k, 2.5 * k, 6 * k, '#fff3c0');
      }
      for (let i = 0; i < 40; i++) ell(ctx, hash(i + 40) * W + Math.sin(t * .7 + i) * 50, 300 + hash(i + 60) * 900 + Math.cos(t * .6 + i) * 40, 2, 2, `rgba(200,255,150,${Math.sin(t * 3 + i * 1.7) * .5 + .5})`);
      ctx.globalCompositeOperation = 'source-over'; flash(1 - sm(2.2, 3.2, s), '233,235,240');
    } },

  // 4 · Nền gạch nứt, nước trào lên → hồ sen, cá chép nhảy quanh
  4: { dur: 10, cut: 2.6, glow: .3, shake: s => s > .3 && s < 2.6 ? 4 : 0, start() { tone(60, 1.6, .25, .3, 'sawtooth'); },
    hall(sc, s) {
      const cx = mid(sc), e = sm(.2, 1.6, s);
      for (let i = 0; i < 9; i++) {
        let x = cx, y = OFFER_Y + 14, a = i / 9 * 6.283 + .3; ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 1; k <= 8 * e; k++) { a += (hash(i * 9 + k) - .5) * .9; x += Math.cos(a) * 46; y += Math.sin(a) * 18; ctx.lineTo(x, y); }
        ctx.strokeStyle = 'rgba(120,220,255,.7)'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#06131c'; ctx.lineWidth = 3; ctx.stroke();
      }
      const wy = H - (H - 420) * sm(1.2, 2.6, s);
      ctx.fillStyle = lg(ctx, 0, wy, 0, H, [0, 'rgba(150,225,240,.8)'], [1, 'rgba(20,90,130,.92)']); ctx.fillRect(0, wy, W, H - wy);
      flash(sm(2.1, 2.6, s), '190,235,245');
    },
    world(sc, s, t) {
      const cx = mid(sc);
      sky([0, '#f6e7c8'], [.3, '#bfe3df'], [.44, '#9fd3cf']);
      ell(ctx, 160, 560, 330, 120, '#9cc5b8'); ell(ctx, 590, 560, 300, 90, '#8dbbb0');
      ctx.fillStyle = lg(ctx, 0, 560, 0, H, [0, '#a5dad2'], [1, '#1f6f78']); ctx.fillRect(0, 560, W, H - 560);
      const pond = bgImg('bg_pond');
      ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const r = ((t * .25 + hash(i)) % 1); ell(ctx, hash(i + 3) * W, 620 + hash(i + 5) * 620, r * 90, r * 26, null, `rgba(255,255,255,${.5 * (1 - r)})`); }
      for (let i = 0; i < 22; i++) {
        const x = hash(i) * W, y = 600 + hash(i + 3) * 640, r = 20 + (y - 560) / 720 * 60;
        if (!pond) ell(ctx, x, y, r, r * .32, i % 2 ? '#2f8f5a' : '#3da56a');
        if (i % 3 === 0) lotusFlower(x, y - r * .1, r * .6);
      }
      ell(ctx, cx, OFFER_Y + 8, 60 + sc.ps.length * 62, 34, pond ? 'rgba(24,84,52,.8)' : '#2f8f5a', '#1d6a40'); stand(sc, t);
      for (let i = 0; i < 5; i++) {
        const u = (s * .45 + hash(i + 20)) % 1, d = i % 2 ? 1 : -1, yb = 700 + hash(i + 31) * 420;
        koi(120 + hash(i + 30) * 480 + (u - .5) * d * 260, yb - Math.sin(u * Math.PI) * 240, Math.atan2(-Math.cos(u * Math.PI) * 754, d * 260), 1 + (yb - 700) / 500);
      }
      flash(1 - sm(2.6, 3.4, s), '190,235,245');
    } },

  // 5 · Gió giật tung cửa cuốn đèn trời mang tên ra ngoài → sân chùa đêm, nghìn đèn trời
  5: { dur: 11, cut: 2.8, glow: .3,
    hall(sc, s, t) {
      const h = sc.ps[0], e = sm(.3, 2.8, s);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const x = W - ((t * (700 + hash(i) * 600) + hash(i + 1) * 900) % 900), y = hash(i + 2) * H; line(ctx, x, y, x + 60 + hash(i) * 80, y - 6); }
      lantern(h.x + (360 - h.x) * e, h.y - 210 - 420 * e * e, 1 + e * 1.5);
      flash(sm(2.2, 2.8, s), '10,14,50');
    },
    world(sc, s, t) {
      const h = sc.ps[0], u = s - 2.8, lx = 360 + Math.sin(t * .8) * 16, ly = 1000 - 560 * sm(0, 6.5, u);
      sky([0, '#050a2a'], [.6, '#1b2a63'], [1, '#4a3566']); stars(t); aura(560, 230, 190, '255,246,216', .5); ell(ctx, 560, 230, 62, 62, '#fff6d8');
      pagoda(360, 1290, 2.1, '#070512');
      bgImg('bg_stars'); // dải Ngân Hà thật trên rừng núi
      for (let i = 0; i < 110; i++) { const k = .2 + hash(i) * .6; lantern(hash(i + 5) * W + Math.sin(t * .6 + i) * 18, H + 80 - ((u * (40 + k * 90) + hash(i + 3) * 1500) % 1500), k, .9); }
      lantern(lx, ly, 3); bigName(h.name, lx, ly + 150, 44);
      hero(h, 360, 1255, 1.05, t);
      flash(1 - sm(2.8, 3.6, s), '10,14,50');
    } },

  // 6 · Trống tự đánh, hai bức tường mở ra như cánh cổng → lễ hội: pháo hoa, lân chạy vào cúi chào
  6: { dur: 11, cut: 1.6, glow: .3, shake: s => s < 1.6 && (s * 4 % 1) < .3 ? 6 : 0,
    start() { for (let i = 0; i < 7; i++) tone(75, .22, .3, i / 4); for (let i = 0; i < 20; i++) tone(i % 4 === 3 ? 110 : 75, .2, .22, 2 + i * .42); },
    hall(sc, s) { ctx.fillStyle = `rgba(255,225,160,${sm(.4, 1.6, s)})`; ctx.fillRect(356, 0, 8, H); },
    world(sc, s, t) {
      const h = sc.ps[0], u = s - 1.6, e = sm(1.6, 3, s);
      sky([0, '#12062e'], [.6, '#3a1a52'], [1, '#7a3050']); stars(t, 70, 600);
      pagoda(130, 1010, 1.2); pagoda(600, 1000, 1.4); ctx.fillStyle = '#2a1626'; ctx.fillRect(0, 990, W, 300);
      bgImg('bg_night', .3); // núi Bà Đen lên đèn về đêm
      for (let i = 0; i < 6; i++) { const c = u / 2.4 + hash(i), n = Math.floor(c); firework(80 + hash(i * 7 + n) * 560, 160 + hash(i * 5 + n + 1) * 300, (c - n) * 2.4, HALO[(i + n) % HALO.length]); }
      for (let r = 0; r < 3; r++) for (let k = 0; k <= 12; k++) {
        const x = k * 60, y = 540 + r * 80 + Math.sin(k / 12 * Math.PI) * 50;
        ell(ctx, x, y + 12, 22, 22, 'rgba(255,90,60,.18)'); ell(ctx, x, y + 12, 10, 13, '#e0322a'); ell(ctx, x, y + 12, 4, 13, '#ffb347');
      }
      lion(900 - 380 * sm(1, 4, u), 1085 - Math.abs(Math.sin(t * 6)) * 30 * (1 - sm(4, 4.6, u)), 1.5, t, sm(4.6, 5.4, u));
      hero(h, 300, 1100, 1.25, t);
      bigName(h.name, 360, 330, 58, sm(1.5, 2.5, u));
      if (e < 1) { // hai nửa bức tường trượt ra hai bên
        ctx.drawImage(bg, 0, 0, 360, H, -e * 400, 0, 360, H); ctx.drawImage(bg, 360, 0, 360, H, 360 + e * 400, 0, 360, H);
        ctx.fillStyle = 'rgba(255,225,160,.9)'; ctx.fillRect(360 - e * 400 - 4, 0, 4, H); ctx.fillRect(360 + e * 400, 0, 4, H);
      }
    } },

  // 7 · Sét đánh thủng mái, mưa đổ qua lỗ thủng, cá chép bơi ngược dòng mưa → vượt mây hoá rồng
  7: { dur: 12, cut: 4.6, glow: .2, shake: s => s > .8 && s < 1.6 ? 10 : 0, start() { tone(45, 2.2, .3, .8, 'sawtooth'); tone(900, .15, .2, .8, 'square'); },
    hall(sc, s, t) {
      fill(`rgba(0,0,25,${.5 * sm(0, .6, s)})`);
      roofHole(sm(.9, 1.7, s) * .62, () => { fill('#1a2140'); bgImg('bg_storm'); });
      if (s > .7 && s < 1.3) boltPic(330, 260, 760, (s - .7) / .6);
      if (s > .7 && s < 1.15) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.shadowColor = '#9cf'; ctx.shadowBlur = 30;
        let x = 300, y = 0; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (hash(k + 3) - .4) * 90; y += 70; ctx.lineTo(x, y); } ctx.stroke();
        ctx.shadowBlur = 0; flash(.7 * (1 - sm(.7, 1.15, s)));
      }
      if (s > 1.4) rain(t, 250, 470, 60, 900, sm(1.4, 2, s));
      const e = sm(2.2, 4.5, s);
      if (s > 2.2) koi(BX + (360 - BX) * e + Math.sin(s * 9) * 22, RIM - 30 - (RIM - 140) * e, -1.57 + Math.sin(s * 9) * .3, 1.2);
      flash(sm(4.2, 4.6, s));
    },
    world(sc, s, t) {
      const h = sc.ps[0], u = s - 4.6, T = 1.8;
      sky([0, '#0b1026'], [.6, '#2a3555'], [1, '#55617f']); bgImg('bg_storm', .25);
      for (let i = 0; i < 16; i++) cloudBlob(hash(i) * 900 - 90, ((hash(i + 2) * 1500 + u * 260) % 1500) - 150, 300 + hash(i + 4) * 260, .5, '60,70,100');
      rain(t, 0, W, 0, H, .5);
      { const n = u / 2.3 | 0, lt = u - n * 2.3; if (lt < .5) { boltPic(140 + hash(n) * 440, 330, 900, lt / .5); flash(.25 * (1 - lt / .5)); } } // sét thật đánh từng đợt
      if (u < T) koi(360 + Math.sin(u * 9) * 26, 1100 - 480 * (u / T), -1.57 + Math.sin(u * 9) * .3, 1.5 + u);
      else {
        const th = (u - T) * 1.7;
        dragon(i => { const a = th - i * .16; return [360 + Math.sin(a) * 250, 560 + Math.sin(a * 2) * 190]; }, 22, 30, t);
        flash(1 - sm(T, T + .7, u), '255,230,150');
      }
      ctx.fillStyle = '#0a0a14'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1235); ctx.quadraticCurveTo(360, 1150, W, 1235); ctx.lineTo(W, H); ctx.fill(); // mái chùa
      hero(h, 360, 1212, 1, t);
      bigName(h.name, 360, 180, 54, sm(T + .6, T + 1.6, u)); bigName('Cá chép hoá rồng', 360, 232, 30, sm(T + .9, T + 1.9, u));
      flash(1 - sm(4.6, 5.2, s));
    } },

  // 8 · Thời gian ngừng, màu rút hết, bức tranh mở ra nuốt cả điện → thế giới thuỷ mặc
  8: { dur: 12, cut: 3.2, glow: 0, start() { tone(1568, 2.5, .05); },
    hall(sc, s, t) {
      ctx.globalCompositeOperation = 'saturation'; fill(`rgba(128,128,128,${sm(0, 1, s)})`); ctx.globalCompositeOperation = 'source-over';
      if (s <= 1.3) return;
      const e = Math.pow(sm(1.3, 3.2, s), 2), w = 110 + 620 * e, hh = 180 + 1120 * e, cy = 470 + 170 * e;
      ctx.save(); ctx.beginPath(); ctx.rect(360 - w / 2, cy - hh / 2, w, hh); ctx.save(); ctx.clip(); this.world(sc, 3.2, t); ctx.restore();
      ctx.lineWidth = 8; ctx.strokeStyle = '#5a3a1a'; ctx.stroke(); ctx.restore();
    },
    world(sc, s, t) {
      const h = sc.ps[0], u = Math.max(0, s - 3.2);
      fill('#efe4c8'); ell(ctx, 540, 300, 72, 72, '#c8372d');
      for (let L = 0; L < 4; L++) { // núi mực nhiều lớp, mỗi lớp chìm trong sương
        const base = 520 + L * 150, g = 150 - L * 34;
        ctx.fillStyle = `rgb(${g},${g},${g - 6})`; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, base - Math.abs(Math.sin(x * .006 * (L + 1) + L * 2.1)) * (230 - L * 30) - hash(x + L * 99) * 24);
        ctx.lineTo(W, H); ctx.fill();
        ctx.fillStyle = lg(ctx, 0, base - 40, 0, base + 150, [0, 'rgba(239,228,200,0)'], [1, 'rgba(239,228,200,.9)']); ctx.fillRect(0, base - 40, W, 190);
      }
      const ink = bgImg('bg_ink'); // tranh sơn thuỷ thời Minh
      for (let i = 0; i < 6; i++) crane(((u * 70 + i * 150) % 900) - 90, 380 + i * 36 + Math.sin(t * 2 + i) * 10, .8, t + i);
      if (!ink) { ctx.fillStyle = '#1c1a18'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 1090); ctx.lineTo(180, 1120); ctx.lineTo(330, 1150); ctx.lineTo(390, 1210); ctx.lineTo(430, H); ctx.fill(); }
      hero(h, 220, 1135, 1.15, t);
      const cs = [...h.name].filter(c => c.trim()).slice(0, 9); // tên viết dọc như lạc khoản
      if (ink) { ctx.fillStyle = 'rgba(239,228,200,.82)'; ctx.fillRect(606, 430, 68, 110 + cs.length * 52); } // nền giấy cho lạc khoản dễ đọc trên tranh
      ctx.font = `bold 44px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillStyle = '#1c1a18';
      cs.forEach((c, i) => { ctx.globalAlpha = sm(.8 + i * .25, 1.3 + i * .25, u); ctx.fillText(c, 640, 480 + i * 52); });
      ctx.globalAlpha = sm(1 + cs.length * .25, 1.6 + cs.length * .25, u);
      ctx.fillStyle = '#c8372d'; ctx.fillRect(616, 470 + cs.length * 52, 48, 48); ctx.fillStyle = '#fff'; ctx.font = `bold 17px ${SERIF}`; ctx.fillText('Phúc', 640, 500 + cs.length * 52);
      ctx.globalAlpha = 1;
    } },

  // 9 · Tượng Phật nứt vỏ vàng, lớn dần đội thủng mái → tượng cao hơn núi, người tặng đứng trên lòng bàn tay
  9: { dur: 12, cut: 2.8, glow: 1, shake: s => s > .4 && s < 2.8 ? 2 + 5 * sm(.4, 2.8, s) : 0, start() { tone(55, 2.6, .28, .3, 'sawtooth'); },
    hall(sc, s, t) {
      const e = sm(.3, 2.4, s); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const a = hash(i) * 6.283, r = (60 + hash(i + 1) * 520) * e;
        ctx.strokeStyle = `rgba(255,240,170,${.5 + .4 * Math.sin(t * 9 + i)})`; ctx.lineWidth = 3 + hash(i + 2) * 9;
        line(ctx, 360 + Math.cos(a) * 30, BUD_Y + Math.sin(a) * 40, 360 + Math.cos(a) * r, BUD_Y + Math.sin(a) * r);
      }
      ctx.globalCompositeOperation = 'source-over'; flash(sm(1.9, 2.8, s), '255,246,200');
    },
    world(sc, s, t) {
      const h = sc.ps[0], u = s - 2.8, z = 2.6 - 1.6 * sm(0, 4.5, u);
      sky([0, '#ffc566'], [.5, '#ffe6b8'], [1, '#f2a579']);
      const real = !!R.bg_buddha, zx = real ? 420 : 575, zy = real ? 420 : 800;
      ctx.save(); ctx.translate(zx, zy); ctx.scale(z, z); ctx.translate(-zx, -zy); // máy quay lùi dần từ chỗ người tặng ra toàn cảnh
      aura(360, 640, 520, '255,250,210', .9);
      [['#b3a3c4', 1090, 130], ['#8d7fa8', 1150, 90]].forEach(([c, base, amp], L) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-400, H + 200);
        for (let x = -400; x <= W + 400; x += 40) ctx.lineTo(x, base - Math.abs(Math.sin(x * .011 + L * 2)) * amp);
        ctx.lineTo(W + 400, H + 200); ctx.fill();
      });
      buddha(360, 1120, 1, 'gold');
      ctx.strokeStyle = '#d9a52e'; ctx.lineWidth = 56; ctx.lineCap = 'round'; line(ctx, 470, 900, 560, 826);
      ell(ctx, 575, 800, 80, 27, '#f3c64a', '#a86a12');
      if (real) { ctx.drawImage(R.bg_buddha, 0, 0, W, H); aura(340, 250, 200, '255,246,200', .3); aura(440, 440, 60, '255,246,200', .7); hero(h, 440, 478, .3, t); } // tượng Phật thật trên đỉnh núi
      else hero(h, 575, 796, .5, t);
      if (!real) { for (let i = 0; i < 7; i++) cloudBlob(((hash(i) * 1100 + t * 10) % 1100) - 190, 1060 + hash(i + 2) * 90, 300, .9); pagoda(130, 1250, .3, '#3a2a4a'); }
      ctx.restore();
      bigName(h.name, 360, 250, 60, sm(3.5, 4.5, u)); bigName(R.bg_buddha ? 'đứng bên Đại Phật trên đỉnh núi' : 'đứng trên lòng bàn tay Phật', 360, 302, 28, sm(3.8, 4.8, u));
      flash(1 - sm(2.8, 3.6, s), '255,246,200');
    } },

  // 10 · Trần nhà sập, mọi người bỏ chạy, rồng vàng chui qua lỗ thủng → cưỡi rồng trên chín tầng mây
  10: { dur: 14, cut: 5.6, glow: .4, flee: true, shake: s => s < 5.6 ? 3 + 9 * sm(0, 2, s) * (1 - sm(4.8, 5.6, s)) : 0,
    start() { tone(40, 4.5, .32, 0, 'sawtooth'); for (let i = 0; i < 10; i++) tone(60 + hash(i) * 50, .3, .25, .4 + i * .35, 'square'); },
    hall(sc, s, t) {
      const h = sc.ps[0], e = sm(1, 2.8, s);
      roofHole(e, () => { sky([0, '#3b82d6'], [.25, '#bfe3ff']); cloudBlob(260, 90, 260, .9); cloudBlob(500, 170, 220, .9); });
      if (e > 0) { // nắng rọi qua lỗ thủng
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg(ctx, 0, 100, 0, 1000, [0, `rgba(255,250,220,${.4 * e})`], [1, 'rgba(255,250,220,0)']);
        ctx.beginPath(); ctx.moveTo(360 - 250 * e, 110); ctx.lineTo(360 + 250 * e, 110); ctx.lineTo(h.x + 260, 1000); ctx.lineTo(h.x - 260, 1000); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < 46; i++) { // xà gỗ và ngói rơi
        const d = s - hash(i) * 3.4, y = -40 + d * d * 700; if (d < 0 || y > H) continue;
        ctx.save(); ctx.translate(hash(i + 9) * W, y); ctx.rotate(d * (3 + hash(i + 4) * 6)); ctx.fillStyle = i % 3 ? '#5a3418' : '#8a5a2a';
        ctx.fillRect(-18 - hash(i + 5) * 30, -8, 36 + hash(i + 5) * 60, 16); ctx.restore();
      }
      fill(`rgba(150,120,90,${.25 * sm(.2, 1.5, s) * (1 - sm(3, 4.5, s))})`);
      if (s > 3) { const y = -260 + 760 * sm(3, 5.2, s); dragon(i => [360 + Math.sin(s * 2.4 - i * .45) * 70, y - i * 44], 14, 34, t); }
      flash(sm(5, 5.6, s));
    },
    world(sc, s, t) {
      const h = sc.ps[0], u = s - 5.6, at = i => [500 - i * 36, 640 + Math.sin(t * 3 - i * .42) * 64 + Math.sin(t * .7) * 40];
      const layer = L => { for (let i = 0; i < 7; i++) cloudBlob(W + 200 - ((u * (120 + L * 170) + hash(i + L * 10) * 1300) % 1300), [420, 860, 1120][L] + hash(i + L * 20) * 150, 240 + L * 110, .95); };
      sky([0, '#2f78d0'], [.55, '#9fd4f5'], [1, '#fff0c8']); aura(570, 250, 260, '255,250,200', 1); ell(ctx, 570, 250, 60, 60, '#fffbe6');
      bgImg('bg_sky'); // trời nhìn từ trên mây
      layer(0); layer(1);
      dragon(at, 17, 34, t); const [rx, ry] = at(3); hero(h, rx, ry - 26, .8, t);
      layer(2);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const x = W - ((t * (900 + hash(i) * 700) + hash(i + 1) * 900) % 900), y = hash(i + 2) * H; line(ctx, x, y, x + 90, y); }
      bigName(h.name, 360, 300, 64, sm(.6, 1.6, u)); bigName('cưỡi rồng vàng du ngoạn chín tầng mây', 360, 352, 28, sm(.9, 1.9, u));
      flash(1 - sm(5.6, 6.3, s));
    } },

  // 11 · Người tặng phát hào quang, bay vút xuyên mái → qua mây, qua trời sao → diện kiến Phật Tổ
  11: { dur: 15, cut: 3.6, glow: 1, shake: s => s < 3.6 ? 2 * sm(1, 3, s) : 0, start() { chime(); tone(220, 3.4, .08, .2); tone(330, 3.2, .06, .4); },
    update(sc, s) { const h = sc.ps[0]; if (s < 3.6) h.y = h.ty = OFFER_Y - 880 * Math.pow(sm(1.4, 3.6, s), 2); },
    hall(sc, s) {
      const h = sc.ps[0], e = sm(0, 1.4, s);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lg(ctx, h.x - 90, 0, h.x + 90, 0, [0, 'rgba(255,240,170,0)'], [.5, `rgba(255,240,170,${.55 * e})`], [1, 'rgba(255,240,170,0)']); ctx.fillRect(h.x - 90, 0, 180, OFFER_Y + 10);
      ctx.globalCompositeOperation = 'source-over';
      aura(h.x, h.y - 90 * (.5 + h.y / 1300), 90 + 230 * e, '255,236,150', .9);
      for (let i = 0; i < 3; i++) { const r = (s * .8 + i / 3) % 1; ctx.lineWidth = 4; ell(ctx, h.x, OFFER_Y, r * 300, r * 90, null, `rgba(255,230,140,${(1 - r) * e})`); }
      flash(sm(3, 3.6, s), '255,250,225');
    },
    world(sc, s, t) {
      const h = sc.ps[0];
      if (s < 8) { // bay thẳng lên: trời xanh → mây → trời sao
        const u = sm(3.6, 8, s), v = s - 3.6;
        sky([0, '#2f78d0'], [1, '#bfe6ff']); bgImg('bg_sky'); fill(`rgba(8,6,44,${u})`); ctx.save(); ctx.globalAlpha = u; if (!bgImg('bg_stars')) stars(t, 120, H); ctx.restore(); // trời mây thật nhường dần cho dải Ngân Hà thật
        for (let i = 0; i < 14; i++) cloudBlob(hash(i) * W, ((hash(i + 3) * 1700 + v * 1500) % 1900) - 200, 260 + hash(i + 5) * 240, (1 - u) * .9);
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) { const x = hash(i + 50) * W, y = (hash(i + 60) * H + v * 2600) % H; line(ctx, x, y, x, y + 90); }
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg(ctx, 0, 700, 0, H, [0, 'rgba(255,240,170,.7)'], [1, 'rgba(255,240,170,0)']); ctx.fillRect(310, 700, 100, 580);
        ctx.globalCompositeOperation = 'source-over';
        aura(360, 620, 240, '255,236,150', 1); hero(h, 360, 700, 1.3, t);
        flash(1 - sm(3.6, 4.2, s), '255,250,225'); flash(sm(7.3, 8, s), '255,246,200');
      } else { // cõi Phật
        const u = s - 8, hy = 1330 - 330 * sm(0, 3, u);
        realm(t);
        if (u > 2.5) beam(360, 560, 360, hy - 120, sm(2.5, 3.5, u));
        lotusSeat(360, hy + 6, .5); aura(360, hy - 110, 200, '255,246,200', .8); hero(h, 360, hy, 1.25, t);
        bigName(h.name, 360, 1190, 56, sm(3, 4, u)); bigName('diện kiến Phật Tổ', 360, 1238, 30, sm(3.3, 4.3, u));
        flash(1 - sm(0, .8, u), '255,246,200');
      }
    } },

  // 12 · Cả điện tan thành nghìn cánh sen, ngôi chùa nhổ khỏi mặt đất bay lên trời, mọi người cùng bay theo → cõi Phật
  12: { dur: 20, cut: 3.2, glow: 1, shake: s => s < 3.2 ? 4 + 8 * sm(0, 3, s) : 0,
    start() {
      chime(); bell(); tone(40, 3, .3, 0, 'sawtooth'); for (let i = 0; i < 24; i++) tone(i % 4 ? 75 : 110, .2, .22, 3.4 + i * .4);
      const pick = [...FAIRY_IMGS].sort(() => Math.random() - .5); FAIRY[0].img = pick[0]; FAIRY[1].img = pick[1] || pick[0];
    },
    hall(sc, s, t) {
      const e = sm(0, 3, s);
      for (let i = 0; i < 220 * e; i++) {
        const a = t * (1 + hash(i)) + i, r = 60 + hash(i + 1) * 700 * e;
        ctx.save(); ctx.translate(360 + Math.cos(a) * r, 640 + Math.sin(a) * r * 1.5); ctx.rotate(a * 2); ell(ctx, 0, 0, 13, 7, i % 2 ? 'rgba(255,170,200,.9)' : 'rgba(255,230,160,.9)'); ctx.restore();
      }
      flash(sm(1.8, 3.2, s), '255,244,225');
    },
    world(sc, s, t) {
      const h = sc.ps[0], others = q.rows.flatMap(r => r.people).filter(p => p.x !== undefined).slice(0, 16);
      if (s < 10.5) { // chùa bay lên trời, mọi người bay theo quanh chân đảo, người tặng ở trên cùng
        const u = s - 3.2, up = sm(0, 6, u), iy = 900 + Math.sin(t * 1.2) * 10;
        sky([0, '#2a6fd0'], [.6, '#9fd4f5'], [1, '#ffe9c0']);
        ell(ctx, 360, 1150 + up * 600, 700, 220, '#3f8f58');
        if (R.bg_seaclouds) ctx.drawImage(R.bg_seaclouds, 0, up * 260, W, H); // núi đá và biển mây thật lùi dần xuống dưới
        for (let i = 0; i < 12; i++) cloudBlob(hash(i) * W, ((hash(i + 3) * 1700 + u * 420) % 1900) - 200, 280 + hash(i + 5) * 200, .85);
        ctx.fillStyle = lg(ctx, 0, iy, 0, iy + 270, [0, '#6b4a2a'], [1, '#2a1a10']);
        ctx.beginPath(); ctx.moveTo(140, iy); ctx.lineTo(580, iy); ctx.lineTo(470, iy + 150); ctx.lineTo(380, iy + 270); ctx.lineTo(300, iy + 170); ctx.lineTo(210, iy + 120); ctx.fill();
        ell(ctx, 360, iy, 222, 22, '#4f9a5c'); pagoda(360, iy, 1.25, '#7a1616', '#2a1408');
        [0, 1].forEach(k => dragon(i => { const a = t * 1.3 + k * 3.14 - i * .17; return [360 + Math.cos(a) * 310, iy - 120 + Math.sin(a) * 110]; }, 18, 22, t, k ? ['#d8ffe0', '#2fa866', '#0c4a2a'] : undefined));
        others.forEach((p, i) => { const a = i / others.length * 6.283 + t * .35; hero(p, 360 + Math.cos(a) * 270, iy + 250 + Math.sin(a) * 50 + Math.sin(t * 2 + i) * 8, .5, t); });
        drawFairy(110, 470, t, false, FAIRY[0]); drawFairy(610, 470, t, true, FAIRY[1]);
        crown(360, 400, t); hero(h, 360, 520, 1.5, t);
        bigName(h.name, 360, 170, 72, sm(.8, 1.8, u)); bigName('đưa cả ngôi chùa bay lên trời', 360, 224, 28, sm(1.1, 2.1, u));
        flash(1 - sm(3.2, 4, s), '255,244,225'); flash(sm(9.8, 10.5, s), '255,246,200');
      } else { // cõi Phật: mọi người quỳ thành vòng cung phía dưới, người tặng đứng giữa luồng sáng
        const u = s - 10.5;
        realm(t);
        for (let i = 0; i < 4; i++) { const c = u / 2.2 + hash(i), n = Math.floor(c); firework(90 + hash(i * 7 + n) * 540, 120 + hash(i * 5 + n) * 200, (c - n) * 2.2, '255,240,170'); }
        others.forEach((p, i) => { const k = (i + .5) / others.length - .5; hero(p, 360 + k * 620, 1100 + k * k * 240, .5, t); });
        beam(360, 560, 360, 960, 1); crown(360, 830, t); hero(h, 360, 960, 1.45, t);
        bigName(h.name, 360, 1228, 64, sm(.6, 1.6, u)); bigName('Thần tiên giáng trần', 360, 1268, 28, sm(.9, 1.9, u));
        flash(1 - sm(0, .8, u), '255,246,200');
      }
    } },
};

// ---------- Dấu ấn giữ lại trong điện đến hết phiên live (mất khi tải lại trang) ----------
const marks = { glow: 0, hole: '', stars: [], lotus: [] };
function leaveMark(sc) {
  const name = sc.ps[0].name;
  if (sc.lvl === 9) marks.glow = .35;                                 // tượng Phật giữ hào quang
  if (sc.lvl === 10 && !marks.hole) marks.hole = 'day';               // lỗ thủng trên mái vẫn còn, nhìn thấy trời
  if (sc.lvl === 11) marks.lotus = [...marks.lotus, name].slice(-3);  // đài sen vàng mang tên lơ lửng trong điện
  if (sc.lvl === 12) { marks.hole = 'night'; marks.stars = [name, ...marks.stars.filter(n => n !== name)].slice(0, 4); } // trời sao qua lỗ mái, giữ tên 4 người gần nhất
}
function drawMarks(t) {
  if (marks.hole) roofHole(marks.stars.length > 1 ? .64 : .5, () => {
    if (marks.hole === 'day') { sky([0, '#3b82d6'], [.2, '#bfe3ff']); cloudBlob(330 + Math.sin(t * .1) * 70, 90, 200, .9); }
    else { // tên mới nhất to ở giữa, các tên trước nhỏ hơn xung quanh, mỗi tên kèm một ngôi sao sáng
      fill('#0a0e30'); if (!bgImg('bg_stars')) stars(t, 130, 260);
      marks.stars.forEach((name, i) => {
        const [x, y, size] = [[360, 118, 28], [250, 62, 17], [470, 62, 17], [360, 178, 17]][i];
        aura(x, i === 3 ? y + 18 : y - size - 4, 14 + Math.sin(t * 3 + i * 2) * 4, '255,250,210', 1); bigName(name, x, y, size); // tên dưới cùng: sao nằm phía dưới để không đè chữ
      });
    }
  });
  marks.lotus.forEach((name, i) => {
    const x = [110, 610, 110][i], y = [330, 330, 480][i] + Math.sin(t * 1.2 + i * 2) * 8;
    aura(x, y - 6, 70, '255,225,140', .7); lotusSeat(x, y - 14, .32); bigName(name, x, y + 34, 17);
  });
}

// ---------- Điều khiển màn diễn ----------
function startScene(lvl, ps) {
  SCENES[lvl].start?.();
  return { lvl, s: 0, ps, home: false };
}
const backAt = d => d.cut < 1e9 ? d.dur - FOG_S : 1e9; // lúc sương mù bắt đầu phủ

// Gọi mỗi khung hình. Trả true khi màn diễn kết thúc. Đặt shake (rung) và flee (mọi người bỏ chạy) cho index.html.
function tickScene(sc, dt) {
  const d = SCENES[sc.lvl];
  sc.s += dt;
  d.update?.(sc, sc.s);
  if (sc.s >= backAt(d) + FOG_S / 2 && !sc.home) { sc.home = true; leaveMark(sc); sc.ps.forEach(p => { p.y = p.ty = OFFER_Y; }); } // sương phủ kín: đưa người về chỗ cũ
  const done = sc.s >= d.dur;
  shake = done ? 0 : d.shake?.(sc.s) || 0;
  flee = !done && !!d.flee && sc.s > .5 && !sc.home;
  return done;
}

function drawScene(sc, t) {
  const d = SCENES[sc.lvl], s = sc.s, back = backAt(d);
  ctx.save();
  if (s >= d.cut && s < back + FOG_S / 2) d.world(sc, s, t);
  else if (s < d.cut) d.hall?.(sc, s, t);
  ctx.restore();
  if (s >= back) fogCover(s < back + FOG_S / 2 ? sm(back, back + FOG_S / 2 - .1, s) : 1 - sm(back + FOG_S / 2, d.dur, s), t);
}
