// Màn diễn của 12 cấp quà. Mọi cảnh mới đều bắt nguồn từ một sự kiện trong điện (hall),
// và trở về điện bằng sương mù phủ kín màn hình rồi tan.
// File này dùng các biến và hàm vẽ của index.html (ctx, W, H, bg, IMG, drawPerson, tone…).
// Mỗi cảnh: dur = thời lượng (giây), cut = lúc chuyển sang cảnh mới (1e9 = ở lại điện),
// hall(sc, s, t) vẽ đè lên điện, world(sc, s, t) vẽ cảnh mới kín màn hình. s = giây từ đầu màn, t = đồng hồ chung.
// sc.ps là cả hàng người tặng (1–4 người cùng cấp): cảnh nào cũng vẽ đủ cả hàng.

const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // số giả ngẫu nhiên cố định theo i
const FOG_S = 2.4; // sương mù đưa về điện: nửa đầu phủ kín, nửa sau tan

// ---------- Ảnh thật (assets/, nguồn ghi trong CREDITS.md) ----------
// Mọi hình trong màn diễn là ảnh thật. Ảnh nào chưa tải xong thì phần đó tạm chưa hiện.
const R = {};
const pad2 = n => String(n).padStart(2, '0');
const frames = (name, n, ext = 'webp') => Array.from({ length: n }, (_, i) => `${name}_${pad2(i)}.${ext}`);
['bg_pond.webp', 'bg_night.webp', 'bg_storm.webp', 'bg_ink.webp', 'bg_buddha.webp', 'bg_sky.webp', 'bg_stars.webp', 'bg_seaclouds.webp', 'bg_realm.webp',
 'lotus.webp', 'lantern.webp', 'redlantern.webp', 'pagoda.webp', 'rock.webp', 'buddha.webp', 'buddha_light.webp', 'hole.webp', 'halo_soft.webp', 'halo_lens.webp',
 'bolt_0.webp', 'bolt_1.webp', 'bolt_2.webp', 'wood_0.webp', 'wood_1.webp', 'wood_2.webp', 'wood_3.webp',
 ...frames('fwa', 12, 'webp'), ...frames('fwb', 12, 'webp'), ...frames('dragon', 12), ...frames('dragon2', 12), ...frames('dragon3', 12), ...frames('dragonj', 12), ...frames('crane', 12), ...frames('koi', 8), ...frames('lion', 8),
 ...frames('loop', 12, 'webp'), ...frames('hall_crack', 4, 'webp'), ...frames('hall_flood', 3, 'webp'), ...frames('rain', 12), ...frames('candle', 8, 'webp'),
].forEach(f => { const im = new Image(); im.onload = () => { R[f.split('.')[0]] = im; }; im.src = 'assets/' + f + '?v=1'; });
function bgImg(name, dark = 0, dy = 0) { // ảnh nền phủ kín màn hình, dy đẩy ảnh lên xuống; trả false nếu chưa có ảnh
  if (!R[name]) return false;
  ctx.drawImage(R[name], 0, dy, W, H); if (dark) fill(`rgba(0,0,0,${dark})`);
  return true;
}
function pic(name, x, y, w, rot = 0, flip = false, a = 1) { // ảnh đã tách nền, tâm tại (x, y), rộng w
  const im = R[name]; if (!im) return false;
  const h = w * im.height / im.width;
  ctx.save(); ctx.globalAlpha *= cl(a); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  return true;
}
// Ảnh nền đen vẽ cộng sáng (hình Phật bằng ánh sáng): nền đen tự mất, chỉ còn phần sáng; w = bề ngang
function glowPic(name, x, y, w, a = 1) {
  const im = R[name]; if (!im || a <= 0) return false;
  const h = w * im.height / im.width;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= cl(a); ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
  return true;
}
// Sét thật: 3 khung hình tia sét trên nền tối, vẽ cộng sáng nên nền đen tự mất. p = 0..1 tiến độ một lần đánh
function boltPic(x, y, w, p) {
  const im = R['bolt_' + Math.min(2, p * 3 | 0)]; if (!im) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(im, x - w / 2, y - w * .375, w, w * .75); ctx.restore();
  return true;
}
// Bản nhuộm màu của một ảnh (op = kiểu hoà màu của canvas), làm một lần rồi giữ lại; phần trong suốt giữ nguyên
const dyed = new Map();
function dye(im, col, op) {
  const key = im.src + col;
  if (!dyed.has(key)) {
    const cv = Object.assign(document.createElement('canvas'), { width: im.width, height: im.height }), c = cv.getContext('2d');
    c.drawImage(im, 0, 0); c.globalCompositeOperation = op; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(im, 0, 0);
    dyed.set(key, cv);
  }
  return dyed.get(key);
}

// ---------- Ánh sáng thật ----------
// Hai ảnh hào quang nền đen, vẽ cộng sáng nên nền đen tự mất. Số đi kèm: ảnh rộng gấp mấy lần vùng sáng nhìn thấy.
const LIGHT = { halo_soft: 3, halo_lens: 1 };
// Tâm sáng tại (x, y); rx, ry = bán kính vùng sáng theo hai chiều (lệch nhau thì thành vệt sáng dài), rot = góc xoay, tint = nhuộm màu 'r,g,b'
function light(name, x, y, rx, ry = rx, a = 1, rot = 0, tint) {
  let im = R[name]; if (!im || a <= 0) return false;
  if (tint) im = dye(im, `rgb(${tint})`, 'color');
  const w = rx * LIGHT[name] * 2, h = ry * LIGHT[name] * 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= cl(a); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  return true;
}
const halo = (x, y, r, a = 1) => light('halo_soft', x, y, r, r, a); // quầng sáng tròn bán kính r
function beam(x0, y0, x1, y1, w, a = 1) { // luồng sáng rọi từ (x0, y0) tới (x1, y1), rộng w: hào quang kéo dài, chỉ lấy phần phía trước nguồn sáng
  const im = R.halo_soft; if (!im || a <= 0) return;
  const len = Math.hypot(x1 - x0, y1 - y0) * 3.4, hw = w * 1.5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= cl(a); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
  ctx.beginPath(); ctx.rect(-hw, 0, 2 * hw, len); ctx.clip(); ctx.drawImage(im, -hw, -len, 2 * hw, 2 * len); ctx.restore();
  halo(x0, y0, w * .5, a); // quầng tròn ở nguồn sáng che chỗ luồng sáng bị cắt ngang
}
function crown(x, y, t) { halo(x, y, 270); light('halo_lens', x, y, 340, 340, .8, t * .5); } // hào quang toả tia xoay quanh người tặng
function sparkPic(x, y, kx, a = 1, ky = kx) { // tia lửa thật, vẽ cộng sáng; kx, ky lệch nhau thì thành vệt sáng dài
  const im = IMG.spark; if (!im || a <= 0) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= cl(a); ctx.drawImage(im, x - kx, y - ky * 1.3, kx * 2, ky * 2.25); ctx.restore();
  return true;
}
function petalPic(x, y, rot, k = 1) { // cánh sen thật (ảnh đã cắt sát vật thể): vẽ cả cánh, tâm tại (x, y)
  const im = IMG.petal; if (!im) return false;
  const h = 26 * k, w = h * im.width / im.height;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  return true;
}
// Khói hương thật từ tay người đang thắp: ba làn khói ảnh thật, mỗi làn lệch nhịp để không giống hệt nhau
function incense(x, y, k, t) {
  const im = IMG.smoke; if (!im) return;
  for (let j = 0; j < 3; j++) {
    const ph = (t * .4 + j / 3 + hash(x)) % 1, h = (60 + ph * 120) * k, w = h * im.width / im.height;
    ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * .7; ctx.drawImage(im, x - w / 2, y - 110 * k - ph * 40 * k - h * .85, w, h); ctx.restore();
  }
}

// ---------- Hình dùng chung ----------
function fill(style) { ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); }
function flash(a, col = '255,255,255') { if (a > 0) fill(`rgba(${col},${cl(a)})`); }
function cloudBlob(x, y, w, a = 1, dark = false) { // mây thật; dark = mây giông (cùng ảnh, nhuộm tối)
  let im = IMG.cloud; if (!im) return;
  if (dark) im = dye(im, '#3c4664', 'multiply');
  const h = w * im.height / im.width;
  ctx.save(); ctx.globalAlpha *= cl(a); ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
}
function fogCover(a, t) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = cl(a); fill('#e6e8ee');
  for (let i = 0; i < 10; i++) cloudBlob(((hash(i) * 1000 + t * (20 + hash(i + 1) * 40)) % 1000) - 140, hash(i + 2) * H, 420 + hash(i + 3) * 300, .8);
  ctx.restore();
}
function bigName(text, x, y, size, a = 1, maxW = 680) {
  if (a <= 0) return;
  const col = '#ffe9a0';
  ctx.save(); ctx.globalAlpha = cl(a); ctx.textAlign = 'center'; ctx.font = `bold ${size}px ${SERIF}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = `bold ${size = Math.max(size * maxW / w, 22)}px ${SERIF}`; // tên dài: chữ nhỏ lại thay vì bị ép dẹt
  ctx.lineWidth = size / 7; ctx.strokeStyle = 'rgba(70,10,5,.9)'; ctx.strokeText(text, x, y, maxW);
  ctx.shadowColor = col; ctx.shadowBlur = size / 2; ctx.fillStyle = col; ctx.fillText(text, x, y, maxW);
  ctx.restore();
}
// Tên cả hàng người tặng, mỗi dòng tối đa hai tên. y là dòng dưới cùng; thêm dòng thì chồng lên phía trên
function nameTitle(sc, x, y, size, a = 1) {
  const ns = sc.ps.map(p => p.name), n = Math.ceil(ns.length / 2);
  for (let i = 0; i < n; i++) bigName(ns.slice(i * 2, i * 2 + 2).join(' · '), x, y - (n - 1 - i) * size * .95, size, a);
}
// Vẽ một nhân vật ở vị trí và cỡ tuỳ ý (k = 1 là cỡ đứng sát camera), kèm thẻ tên. bow = cúi lạy dù người đó đang không lạy
function hero(p, x, y, k, t, bow = p.bow) {
  const s0 = .5 + p.y / 1300, was = p.bow;
  p.bow = bow;
  ctx.save(); ctx.translate(x, y); ctx.scale(k / s0, k / s0); ctx.translate(-p.x, -p.y); drawPerson(p, t); ctx.restore();
  p.bow = was;
}
// Chỗ đứng của cả hàng người tặng: dàn ngang trong bề rộng w quanh x, trả về [người, x, cỡ].
// Một người thì đứng đúng x với cỡ k; đông người thì mỗi người nhỏ lại để thẻ tên không đè nhau
const spots = (sc, x, k, w = 640) => { const n = sc.ps.length, slot = Math.min(w / n, 150 * k); return sc.ps.map((p, i) => [p, x + (i - (n - 1) / 2) * slot, slot / 150]); };
const heroes = (sc, x, y, k, t, w) => spots(sc, x, k, w).forEach(([p, px, pk]) => hero(p, px, y, pk, t));
const stand = (sc, t) => sc.ps.forEach(p => drawPerson(p, t));
const mid = sc => sc.ps.reduce((a, p) => a + p.x, 0) / sc.ps.length;
// Ảnh nền phủ kín 720×1280, cắt đều hai bên hoặc trên dưới để giữ tỉ lệ
function cover(im) { const k = Math.max(W / im.width, H / im.height), w = im.width * k, h = im.height * k; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
function rain(t, x0, x1, y0, y1, a) { // mưa thật: 12 khung vệt mưa trắng trong suốt, lát liền thành lưới; hai lớp lệch nhau để đỡ lặp; cắt theo vùng mưa
  const f1 = R[`rain_${pad2(Math.floor(t * 11) % 12)}`], f2 = R[`rain_${pad2((Math.floor(t * 11) + 6) % 12)}`], S = 362;
  if (!f1 || !f2) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.globalAlpha *= cl(a) * .9;
  for (const [f, o] of [[f1, 0], [f2, S / 2]]) for (let x = Math.floor(x0 / S) * S + o - S; x < x1; x += S) for (let y = Math.floor(y0 / S) * S + o - S; y < y1; y += S) ctx.drawImage(f, x, y, S, S);
  ctx.restore();
}
function lantern(x, y, k, a = 1) { halo(x, y, 70 * k, .6 * a); pic('lantern', x, y, 74 * k, 0, false, a); } // đèn trời thật toả sáng
const lanternK = n => Math.min(3, W / (n + 1) / 87); // cỡ đèn trời mang tên: một người một đèn, đông người thì đèn nhỏ lại cho vừa hàng ngang
function firework(x, y, age, v) { // pháo hoa GIF: 12 khung, vẽ cả khung cộng sáng (nền đen tự mất); v chọn chuỗi vàng hoặc nhiều màu
  const fr = R[(v % 2 ? 'fwa_' : 'fwb_') + pad2(Math.min(11, age / 1.6 * 12 | 0))];
  if (!fr || age < 0 || age > 1.6) return;
  const w = 420, h = w * fr.height / fr.width;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(fr, x - w / 2, y - h / 2, w, h); ctx.restore();
}
const koi = (x, y, ang, k = 1) => pic(`koi_${pad2((performance.now() / 110 | 0) % 8)}`, x, y, 74 * k, ang + Math.PI / 2); // cá chép thật, 8 khung bơi; ảnh gốc đầu hướng lên nên xoay thêm π/2
const crane = (x, y, k, t) => pic(`crane_${pad2(Math.floor(t * 8) % 12)}`, x, y, 150 * k); // hạc đầu đỏ thật, 12 khung vỗ cánh
function lion(x, y, k, t, bow = 0) { // lân thật, 8 khung múa, đầu quay về bên trái; bow = cúi chào
  const lf = R[`lion_${pad2(Math.floor(t * 8) % 8)}`]; if (!lf) return;
  const s = 180 / Math.max(lf.width, lf.height);
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(80, -82 + bow * 14); ctx.rotate(-bow * .3); ctx.scale(-1, 1);
  ctx.drawImage(lf, -lf.width * s / 2, -lf.height * s / 2, lf.width * s, lf.height * s); ctx.restore();
}
// Rồng thật, 12 khung bay: bộ 'dragon' (vàng 1), 'dragon2' (vàng 2), 'dragon3' (vàng 3), 'dragonj' (ngọc). at(0) là mũi rồng, at(1) cho hướng bay; mũi nằm tại DRAGON_ANCHOR của bộ khung.
// Trả về hàm đổi một điểm trên mình rồng (dx lùi về phía đuôi, dy xuống dưới, đơn vị là size) ra toạ độ màn hình, để đặt người cưỡi
const DRAGON_ANCHOR = { dragon: [0.989, 0.427], dragon2: [0.988, 0.416], dragon3: [0.988, 0.474], dragonj: [0.990, 0.418] }; // tỉ lệ (x, y) của mũi rồng trong khung, đo từ GIF
function dragon(at, size, t, set = 'dragon') {
  const [hx, hy] = at(0), [px, py] = at(1), a = Math.atan2(hy - py, hx - px), f = Math.cos(a) < 0 ? -1 : 1, df = R[`${set}_${pad2(Math.floor(t * 8) % 12)}`], [AX, AY] = DRAGON_ANCHOR[set];
  if (df) {
    const w = size * 16, h = w * df.height / df.width;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); ctx.scale(1, f); ctx.drawImage(df, -w * AX, -h * AY, w, h); ctx.restore();
  }
  return (dx, dy) => [hx - (Math.cos(a) * dx + Math.sin(a) * dy * f) * size, hy - (Math.sin(a) * dx - Math.cos(a) * dy * f) * size];
}
const SEATS = [[3.2, -.76], [6, .2], [9, 1.35], [11.3, 2.06]]; // chỗ ngồi trên lưng rồng, từ cổ lùi dần về đuôi
const lotusSeat = (x, y, k) => pic('lotus', x, y - 26 * k, 470 * k); // đài sen thật, gốc toạ độ ở đáy
const lotusFlower = (x, y, r) => pic('lotus', x, y - r * .4, r * 1.7);
// Lỗ thủng trần: ảnh chụp thật một mảng trần bê tông vỡ, phần trời trong ảnh đã để trong suốt (hole.webp, lỗ rộng bằng 1/1.112 bề ngang ảnh).
// e = độ mở 0..1, paint() vẽ bầu trời nhìn qua lỗ. HOLE là đa giác nằm trọn trong phần mép đặc của ảnh, tính theo bề ngang lỗ:
// trời chỉ được vẽ trong đa giác đó rồi mép vỡ thật phủ lên trên, nên không hở mà cũng không tràn ra ngoài.
const HOLE = [[.427, 0], [.4, .053], [.39, .104], [.362, .15], [.319, .184], [.278, .214], [.238, .238], [.195, .254], [.153, .266], [.116, .279], [.079, .295], [.041, .308],
  [0, .32], [-.042, .323], [-.085, .318], [-.129, .311], [-.177, .307], [-.224, .292], [-.3, .3], [-.393, .302], [-.441, .254], [-.462, .191], [-.496, .133], [-.511, .067],
  [-.488, 0], [-.462, -.061], [-.432, -.116], [-.383, -.159], [-.295, -.17], [-.259, -.199], [-.217, -.217], [-.182, -.237], [-.146, -.253], [-.109, -.263], [-.07, -.262], [-.036, -.274],
  [0, -.276], [.037, -.282], [.077, -.288], [.122, -.295], [.18, -.312], [.243, -.317], [.332, -.332], [.423, -.324], [.481, -.278], [.516, -.214], [.492, -.132], [.457, -.06]];
function roofHole(e, paint) {
  if (e <= 0 || !R.hole) return;
  const w = 660 * e;
  ctx.save(); ctx.beginPath(); HOLE.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](360 + x * w, 110 + y * w)); ctx.clip(); paint(); ctx.restore();
  pic('hole', 360, 110, w * 1.112);
}
// Cõi Phật: mặt trời mọc trên biển mây vàng (mặt trời trong ảnh nằm đúng sau đầu tượng), Phật Tổ ngự trên đài sen giữa hào quang
function realm(t, kind = 'statue') {
  if (kind === 'light') { // cấp 11: hình bóng Phật bằng ánh sáng trên nền trời sao tối, vẽ cộng sáng nên không bị chói
    bgImg('bg_stars', .1);
    halo(360, 540, 300, .3); light('halo_lens', 360, 540, 380, 380, .15, t * .1);
    lotusSeat(360, 769, 1.15); glowPic('buddha_light', 360, 548, 590, .95);
  } else { // cấp 12: mặt trời mọc trên biển mây, tượng Phật Tổ thật
    bgImg('bg_realm');
    halo(360, 448, 480, .7); light('halo_lens', 360, 448, 560, 560, .5, t * .12);
    lotusSeat(360, 769, 1.15); pic('buddha', 360, 538, 500);
  } // tượng Phật Tổ thật, cắt từ ảnh chánh điện; vẽ thường nên nhìn rõ hình Phật
  for (let i = 0; i < 9; i++) cloudBlob(((hash(i) * 900 + t * 12) % 900) - 90, 800 + hash(i + 2) * 140, 300, .85);
  for (let i = 0; i < 30; i++) petalPic(i * 97 % W + Math.sin(t + i) * 30, (t * 80 + i * 131) % H, t + i);
}

// ---------- 12 màn ----------
const SCENES = {
  // 1 · Bình luận: sen nở dưới chân, lư hương bừng sáng
  1: { dur: 2, cut: 1e9, glow: .2,
    hall(sc, s) {
      const e = sm(0, .8, s), a = 1 - sm(1.5, 2, s);
      sc.ps.forEach(p => pic('lotus', p.x, p.y - 4, 105 * e * (.5 + p.y / 1300), 0, false, a));
      halo(BX, RIM - 60, 160 * e, a * .7);
    } },

  // 2 · Chuông tự rung, điện rung, Phật quang rọi xuống người tặng, kim sa rơi
  2: { dur: 4, cut: 1e9, glow: .7, shake: s => s < 1.2 ? 3 : 0,
    hall(sc, s) {
      const a = sm(0, .6, s) * (1 - sm(3.2, 4, s));
      sc.ps.forEach(p => beam(360, BUD_Y, p.x, p.y, 110, .6 * a));
      for (let i = 0; i < 90; i++) sparkPic(hash(i) * W, (s * (180 + hash(i + 7) * 160) + hash(i + 3) * H) % H, 7, a * (.4 + .6 * hash(i + 1)));
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
      sc.ps.forEach(p => halo(p.x, p.y - 100, 190, .55)); stand(sc, t);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 80; i++) { // nến thật lơ lửng (ảnh nền đen, vẽ cộng sáng), mỗi cây cháy lệch nhịp nhau
        const k = .35 + hash(i + 5) * .5, x = hash(i) * W + Math.sin(t * .5 + i) * 12, y = 120 + hash(i + 11) * 980 + Math.sin(t * .9 + i * 2) * 14 - (s - 2.2) * 8;
        const f = R[`candle_${pad2((Math.floor(t * 9) + i) % 8)}`];
        if (f) ctx.drawImage(f, x - 23 * k, y - 20 * k, 46 * k, 111 * k);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 40; i++) sparkPic(hash(i + 40) * W + Math.sin(t * .7 + i) * 50, 300 + hash(i + 60) * 900 + Math.cos(t * .6 + i) * 40, 6, Math.sin(t * 3 + i * 1.7) * .5 + .5);
      flash(1 - sm(2.2, 3.2, s), '233,235,240');
    } },

  // 4 · Nền gạch nứt, nước trào lên → hồ sen, cá chép nhảy quanh
  4: { dur: 10, cut: 2.6, glow: .3, base: true, shake: s => s > .3 && s < 2.6 ? 4 : 0,
    hall(sc, s) {
      hallFrames(s).forEach(([name, a]) => { ctx.globalAlpha = a; cover(R[name]); });
      ctx.globalAlpha = 1;
      flash(sm(2.1, 2.6, s), '190,235,245');
    },
    world(sc, s, t) {
      bgImg('bg_pond');
      for (let i = 0; i < 22; i += 3) { const y = 600 + hash(i + 3) * 640, r = 20 + (y - 560) / 720 * 60; lotusFlower(hash(i) * W, y - r * .1, r * .6); }
      sc.ps.forEach(p => pic('lotus', p.x, p.y + 2, 150 * (.5 + p.y / 1300))); stand(sc, t); // mỗi người đứng trên một đoá sen thật giữa hồ
      for (let i = 0; i < 5; i++) {
        const u = (s * .45 + hash(i + 20)) % 1, d = i % 2 ? 1 : -1, yb = 700 + hash(i + 31) * 420;
        koi(120 + hash(i + 30) * 480 + (u - .5) * d * 260, yb - Math.sin(u * Math.PI) * 240, Math.atan2(-Math.cos(u * Math.PI) * 754, d * 260), 1 + (yb - 700) / 500);
      }
      flash(1 - sm(2.6, 3.4, s), '190,235,245');
    } },

  // 5 · Gió giật tung cửa cuốn đèn trời mang tên ra ngoài → sân chùa đêm, nghìn đèn trời
  5: { dur: 11, cut: 2.8, glow: .3,
    hall(sc, s, t) {
      const e = sm(.3, 2.8, s), n = sc.ps.length;
      for (let i = 0; i < 40; i++) petalPic(W - ((t * (700 + hash(i) * 600) + hash(i + 1) * 900) % 900), hash(i + 2) * H + Math.sin(t * 3 + i) * 24, t * 5 + i, 1.2); // gió cuốn cánh hoa bay ngang điện
      sc.ps.forEach((p, i) => lantern(p.x + (W * (i + 1) / (n + 1) - p.x) * e, p.y - 210 - 420 * e * e, 1 + e * (lanternK(n) - 1.5))); // mỗi người một đèn trời
      flash(sm(2.2, 2.8, s), '10,14,50');
    },
    world(sc, s, t) {
      const u = s - 2.8, n = sc.ps.length, k = lanternK(n), ly = 1000 - 560 * sm(0, 6.5, u);
      bgImg('bg_stars'); // dải Ngân Hà thật trên rừng núi
      for (let i = 0; i < 110; i++) { const kk = .2 + hash(i) * .6; lantern(hash(i + 5) * W + Math.sin(t * .6 + i) * 18, H + 80 - ((u * (40 + kk * 90) + hash(i + 3) * 1500) % 1500), kk, .9); }
      sc.ps.forEach((p, i) => { // đèn trời lớn mang tên từng người
        const lx = W * (i + 1) / (n + 1) + Math.sin(t * .8 + i) * 16;
        lantern(lx, ly, k); bigName(p.name, lx, ly + 50 * k, Math.max(26, 44 * k / 3), 1, n > 1 ? W / (n + 1) * .72 : 680);
      });
      heroes(sc, 360, 1255, 1.05, t);
      flash(1 - sm(2.8, 3.6, s), '10,14,50');
    } },

  // 6 · Trống tự đánh, hai bức tường mở ra như cánh cổng → lễ hội: pháo hoa, lân chạy vào cúi chào
  6: { dur: 11, cut: 1.6, glow: .3, shake: s => s < 1.6 && (s * 4 % 1) < .3 ? 6 : 0,

    hall(sc, s) { light('halo_soft', 360, 640, 10, 760, sm(.4, 1.6, s)); }, // khe sáng giữa hai bức tường
    world(sc, s, t) {
      const u = s - 1.6, e = sm(1.6, 3, s);
      bgImg('bg_night', .3); // núi Bà Đen lên đèn về đêm
      for (let i = 0; i < 6; i++) { const c = u / 2.4 + hash(i), n = Math.floor(c); firework(80 + hash(i * 7 + n) * 560, 160 + hash(i * 5 + n + 1) * 300, (c - n) * 2.4, i + n); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; // ba dây đèn lồng đỏ thật võng ngang trời (ảnh nền đen, vẽ cộng sáng)
      for (let r = 0; r < 3; r++) for (let k = 0; k <= 12; k++) pic('redlantern', k * 60, 552 + r * 80 + Math.sin(k / 12 * Math.PI) * 50, 46);
      ctx.restore();
      lion(900 - 380 * sm(1, 4, u), 1085 - Math.abs(Math.sin(t * 6)) * 30 * (1 - sm(4, 4.6, u)), 1.5, t, sm(4.6, 5.4, u));
      heroes(sc, 300, 1100, 1.25, t, 400);
      nameTitle(sc, 360, 330, 58, sm(1.5, 2.5, u));
      if (e < 1) { // hai nửa bức tường trượt ra hai bên, mép tường viền sáng
        ctx.drawImage(bg, 0, 0, 360, H, -e * 400, 0, 360, H); ctx.drawImage(bg, 360, 0, 360, H, 360 + e * 400, 0, 360, H);
        light('halo_soft', 360 - e * 400, 640, 8, 760); light('halo_soft', 360 + e * 400, 640, 8, 760);
      }
    } },

  // 7 · Sét đánh thủng mái, mưa đổ qua lỗ thủng, cá chép bơi ngược dòng mưa → vượt mây hoá rồng
  7: { dur: 12, cut: 4.6, glow: .2, shake: s => s > .8 && s < 1.6 ? 10 : 0,
    hall(sc, s, t) {
      fill(`rgba(0,0,25,${.5 * sm(0, .6, s)})`);
      roofHole(sm(.9, 1.7, s) * .62, () => bgImg('bg_storm', 0, -600)); // nhìn qua lỗ thấy mây giông (đẩy ảnh lên để lọt đúng phần mây)
      if (s > .7 && s < 1.3) boltPic(330, 260, 760, (s - .7) / .6);
      if (s > .7 && s < 1.15) flash(.7 * (1 - sm(.7, 1.15, s)));
      if (s > 1.4) rain(t, 250, 470, 60, 900, sm(1.4, 2, s));
      const e = sm(2.2, 4.5, s);
      if (s > 2.2) koi(BX + (360 - BX) * e + Math.sin(s * 9) * 22, RIM - 30 - (RIM - 140) * e, -1.57 + Math.sin(s * 9) * .3, 1.2);
      flash(sm(4.2, 4.6, s));
    },
    world(sc, s, t) {
      const u = s - 4.6, T = 1.8;
      bgImg('bg_storm', .25);
      for (let i = 0; i < 16; i++) cloudBlob(hash(i) * 900 - 90, ((hash(i + 2) * 1500 + u * 260) % 1500) - 150, 300 + hash(i + 4) * 260, .5, true);
      rain(t, 0, W, 0, H, .5);
      { const n = u / 2.3 | 0, lt = u - n * 2.3; if (lt < .5) { boltPic(140 + hash(n) * 440, 330, 900, lt / .5); flash(.25 * (1 - lt / .5)); } } // sét thật đánh từng đợt
      if (u < T) koi(360 + Math.sin(u * 9) * 26, 1100 - 480 * (u / T), -1.57 + Math.sin(u * 9) * .3, 1.5 + u);
      else {
        const th = (u - T) * 1.7;
        dragon(i => { const a = th - i * .16; return [360 + Math.sin(a) * 250, 560 + Math.sin(a * 2) * 190]; }, 30, t);
        flash(1 - sm(T, T + .7, u), '255,230,150');
      }
      if (R.pagoda) ctx.drawImage(dye(R.pagoda, '#4d5270', 'multiply'), -215, 1085, 928, 756); // nóc chùa Một Cột thật trong đêm giông, người tặng đứng trên mái
      heroes(sc, 360, 1212, 1, t);
      nameTitle(sc, 360, 180, 54, sm(T + .6, T + 1.6, u)); bigName('Cá chép hoá rồng', 360, 232, 30, sm(T + .9, T + 1.9, u));
      flash(1 - sm(4.6, 5.2, s));
    } },

  // 8 · Thời gian ngừng, màu rút hết, bức tranh mở ra nuốt cả điện → thế giới thuỷ mặc
  8: { dur: 12, cut: 3.2, glow: 0,
    hall(sc, s, t) {
      ctx.globalCompositeOperation = 'saturation'; fill(`rgba(128,128,128,${sm(0, 1, s)})`); ctx.globalCompositeOperation = 'source-over';
      if (s <= 1.3) return;
      const e = Math.pow(sm(1.3, 3.2, s), 2), w = 110 + 620 * e, hh = 180 + 1120 * e, cy = 470 + 170 * e;
      ctx.save(); ctx.beginPath(); ctx.rect(360 - w / 2, cy - hh / 2, w, hh); ctx.save(); ctx.clip(); this.world(sc, 3.2, t); ctx.restore();
      ctx.lineWidth = 8; ctx.strokeStyle = '#5a3a1a'; ctx.stroke(); ctx.restore(); // khung tranh
    },
    world(sc, s, t) {
      const u = Math.max(0, s - 3.2);
      bgImg('bg_ink'); // tranh sơn thuỷ thời Minh
      for (let i = 0; i < 6; i++) crane(((u * 70 + i * 150) % 900) - 90, 380 + i * 36 + Math.sin(t * 2 + i) * 10, .8, t + i);
      heroes(sc, 220, 1135, 1.15, t, 400);
      ctx.textAlign = 'center';
      sc.ps.forEach((p, j) => { // tên viết dọc như lạc khoản, mỗi người một cột từ phải sang trái; cột cuối đóng dấu son (chữ đỏ)
        const cs = [...p.name].filter(c => c.trim()).slice(0, 9), x = 640 - j * 74, seal = j === sc.ps.length - 1, hgt = 60 + cs.length * 52 + (seal ? 50 : 0);
        if (IMG.paper) { ctx.globalAlpha = .88; ctx.drawImage(IMG.paper, 200, 20, 136, hgt * 2, x - 34, 430, 68, hgt); } // nền giấy thật cho lạc khoản dễ đọc trên tranh
        ctx.font = `bold 44px ${SERIF}`; ctx.fillStyle = '#1c1a18';
        cs.forEach((c, i) => { ctx.globalAlpha = sm(.8 + i * .25, 1.3 + i * .25, u); ctx.fillText(c, x, 480 + i * 52); });
        if (!seal) return;
        ctx.globalAlpha = sm(1 + cs.length * .25, 1.6 + cs.length * .25, u);
        ctx.fillStyle = '#c8372d'; ctx.font = `bold 26px ${SERIF}`; ctx.fillText('Phúc', x, 520 + cs.length * 52);
      });
      ctx.globalAlpha = 1;
    } },

  // 9 · Tượng Phật bừng hào quang chói loà → Đại Phật trên đỉnh núi, người tặng đứng bên tượng
  9: { dur: 12, cut: 2.8, glow: 1, shake: s => s > .4 && s < 2.8 ? 2 + 5 * sm(.4, 2.8, s) : 0,
    hall(sc, s, t) {
      const e = sm(.3, 2.4, s);
      halo(360, BUD_Y, 60 + 420 * e, .9); light('halo_lens', 360, BUD_Y, 80 + 560 * e, 80 + 560 * e, .6 + .3 * Math.sin(t * 9), t * .6); // hào quang thật toả ra từ tượng
      flash(sm(1.9, 2.8, s), '255,246,200');
    },
    world(sc, s, t) {
      const u = s - 2.8, z = 2.6 - 1.6 * sm(0, 4.5, u);
      ctx.save(); ctx.translate(420, 420); ctx.scale(z, z); ctx.translate(-420, -420); // máy quay lùi dần từ chỗ người tặng ra toàn cảnh
      bgImg('bg_buddha'); halo(340, 250, 200, .3); halo(440, 440, 60, .7); heroes(sc, 440, 478, .3, t); // tượng thật trên đỉnh núi
      ctx.restore();
      nameTitle(sc, 360, 250, 60, sm(3.5, 4.5, u)); bigName('đứng bên Đại Phật trên đỉnh núi', 360, 302, 28, sm(3.8, 4.8, u));
      flash(1 - sm(2.8, 3.6, s), '255,246,200');
    } },

  // 10 · Trần nhà sập, mọi người bỏ chạy, rồng vàng chui qua lỗ thủng → cưỡi rồng trên chín tầng mây
  10: { dur: 14, cut: 5.6, glow: .4, flee: true, shake: s => s < 5.6 ? 3 + 9 * sm(0, 2, s) * (1 - sm(4.8, 5.6, s)) : 0,

    hall(sc, s, t) {
      const e = sm(1, 2.8, s), lp = R[`loop_${pad2(Math.floor(t * 7) % 12)}`];
      roofHole(e, () => bgImg('bg_sky'));
      if (e > 0 && lp) { // nắng rọi qua lỗ thủng: tia sáng thật (nền đen) vẽ kiểu màn hình, sáng theo độ mở lỗ
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .7 * e; ctx.drawImage(lp, 0, 0, W, H); ctx.restore();
      }
      for (let i = 0; i < 46; i++) { // xà gỗ rơi: 5 mảnh gỗ thật
        const d = s - hash(i) * 3.4, y = -40 + d * d * 700; if (d < 0 || y > H) continue;
        pic('wood_' + (i % 4), hash(i + 9) * W, y, 90 + hash(i + 5) * 60, d * (3 + hash(i + 4) * 6));
      }
      fill(`rgba(150,120,90,${.25 * sm(.2, 1.5, s) * (1 - sm(3, 4.5, s))})`);
      if (s > 3) { const y = -260 + 760 * sm(3, 5.2, s); dragon(i => [360 + Math.sin(s * 2.4 - i * .45) * 70, y - i * 44], 34, t, 'dragon2'); }
      flash(sm(5, 5.6, s));
    },
    world(sc, s, t) {
      const u = s - 5.6, at = i => [500 - i * 36, 640 + Math.sin(t * 3 - i * .42) * 64 + Math.sin(t * .7) * 40];
      const layer = L => { for (let i = 0; i < 7; i++) cloudBlob(W + 200 - ((u * (120 + L * 170) + hash(i + L * 10) * 1300) % 1300), [420, 860, 1120][L] + hash(i + L * 20) * 150, 240 + L * 110, .95); };
      bgImg('bg_sky'); // trời nhìn từ trên mây
      layer(0); layer(1);
      const seat = dragon(at, 34, t, 'dragon2');
      sc.ps.forEach((p, i) => { const [rx, ry] = seat(...SEATS[i % SEATS.length]); hero(p, rx, ry, .8, t); }); // cả hàng ngồi dọc lưng rồng
      layer(2);
      for (let i = 0; i < 24; i++) sparkPic(W - ((t * (900 + hash(i) * 700) + hash(i + 1) * 900) % 900), hash(i + 2) * H, 45, .5, 4); // vệt sáng lướt ngang: đang bay nhanh
      nameTitle(sc, 360, 300, 64, sm(.6, 1.6, u)); bigName('cưỡi rồng vàng du ngoạn chín tầng mây', 360, 352, 28, sm(.9, 1.9, u));
      flash(1 - sm(5.6, 6.3, s));
    } },

  // 11 · Người tặng phát hào quang, bay vút xuyên mái → qua mây, qua trời sao → diện kiến Phật Tổ
  11: { dur: 15, cut: 3.6, glow: 1, shake: s => s < 3.6 ? 2 * sm(1, 3, s) : 0,
    update(sc, s) { if (s < 3.6) sc.ps.forEach(p => { p.y = p.ty = OFFER_Y - 880 * Math.pow(sm(1.4, 3.6, s), 2); }); },
    hall(sc, s) {
      const e = sm(0, 1.4, s);
      sc.ps.forEach(p => {
        light('halo_soft', p.x, 440, 60, 520, .55 * e); // cột sáng từ trần xuống chân
        halo(p.x, p.y - 90 * (.5 + p.y / 1300), 90 + 230 * e, .9);
        for (let i = 0; i < 3; i++) { const r = (s * .8 + i / 3) % 1; light('halo_soft', p.x, OFFER_Y, r * 300, r * 90, (1 - r) * e); } // quầng sáng loang trên sàn
      });
      flash(sm(3, 3.6, s), '255,250,225');
    },
    world(sc, s, t) {
      if (s < 8) { // bay thẳng lên: trời xanh → mây → trời sao
        const u = sm(3.6, 8, s), v = s - 3.6;
        bgImg('bg_sky'); fill(`rgba(8,6,44,${u})`); ctx.save(); ctx.globalAlpha = u; bgImg('bg_stars'); ctx.restore(); // trời mây thật nhường dần cho dải Ngân Hà thật
        for (let i = 0; i < 14; i++) cloudBlob(hash(i) * W, ((hash(i + 3) * 1700 + v * 1500) % 1900) - 200, 260 + hash(i + 5) * 240, (1 - u) * .9);
        for (let i = 0; i < 40; i++) sparkPic(hash(i + 50) * W, (hash(i + 60) * H + v * 2600) % H, 4, .5, 40); // vệt sáng lao xuống: đang bay vút lên
        light('halo_soft', 360, 860, 60, 420, .7); halo(360, 620, 240); // vệt sáng kéo dài dưới chân
        heroes(sc, 360, 700, 1.3, t);
        flash(1 - sm(3.6, 4.2, s), '255,250,225'); flash(sm(7.3, 8, s), '255,246,200');
      } else { // cõi Phật: Phật Tổ rọi sáng xuống cả hàng, mỗi người đứng trên một đài sen
        const u = s - 8, hy = 1330 - 330 * sm(0, 3, u);
        realm(t, 'light');
        beam(360, 770, 360, hy - 120, 200, .6 * sm(2.5, 3.5, u)); // luồng sáng bắt đầu từ đài sen của Phật, không che tượng
        spots(sc, 360, 1.25).forEach(([p, x, k]) => { lotusSeat(x, hy + 6, .4 * k); halo(x, hy - 110, 160 * k, .5); hero(p, x, hy, k, t); });
        nameTitle(sc, 360, 1190, 56, sm(3, 4, u)); bigName('diện kiến Phật Tổ', 360, 1238, 30, sm(3.3, 4.3, u));
        flash(1 - sm(0, .8, u), '255,246,200');
      }
    } },

  // 12 · Cả điện tan thành nghìn cánh hoa, ngôi chùa nhổ khỏi mặt đất bay lên trời, mọi người cùng bay theo → cõi Phật
  12: { dur: 20, cut: 3.2, glow: 1, shake: s => s < 3.2 ? 4 + 8 * sm(0, 3, s) : 0,

    hall(sc, s, t) {
      const e = sm(0, 3, s);
      for (let i = 0; i < 220 * e; i++) { const a = t * (1 + hash(i)) + i, r = 60 + hash(i + 1) * 700 * e; petalPic(360 + Math.cos(a) * r, 640 + Math.sin(a) * r * 1.5, a * 2, 1.3); }
      flash(sm(1.8, 3.2, s), '255,244,225');
    },
    world(sc, s, t) {
      // người đang xếp hàng phía sau cũng cúi lạy và thắp hương, đi theo người tặng
      const others = q.rows.flatMap(r => r.people).filter(p => p.x !== undefined).slice(0, 16);
      if (s < 10.5) { // chùa bay lên trời, mọi người bay theo quanh chân đảo, người tặng ở trên cùng
        const u = s - 3.2, up = sm(0, 6, u), iy = 900 + Math.sin(t * 1.2) * 10;
        if (R.bg_seaclouds) ctx.drawImage(R.bg_seaclouds, -72, -256 + up * 256, 864, 1536); // núi đá và biển mây thật (phóng to 1.2 lần) lùi dần xuống dưới
        for (let i = 0; i < 12; i++) cloudBlob(hash(i) * W, ((hash(i + 3) * 1700 + u * 420) % 1900) - 200, 280 + hash(i + 5) * 200, .85);
        pic('rock', 360, iy + 150, 400); pic('pagoda', 360, iy - 150, 412); // chùa Một Cột thật trên đảo đá thật
        [0, 1].forEach(k => dragon(i => { const a = t * 1.3 + k * 3.14 - i * .17; return [360 + Math.cos(a) * 310, iy - 120 + Math.sin(a) * 110]; }, 22, t + k * .75, k ? 'dragonj' : 'dragon3')); // rồng vàng 3 và rồng ngọc, lệch nhịp vỗ cánh
        others.forEach((p, i) => {
          const a = i / others.length * 6.283 + t * .35, x = 360 + Math.cos(a) * 270, y = iy + 250 + Math.sin(a) * 50 + Math.sin(t * 2 + i) * 8;
          hero(p, x, y, .5, t, true); incense(x, y, .5, t + i);
        });
        const [fa, fb] = fairyPair(sc); drawFairy(110, 470, t, false, fa); drawFairy(610, 470, t, true, fb);
        crown(360, 400, t); heroes(sc, 360, 520, 1.5, t, 420);
        nameTitle(sc, 360, 170, 72, sm(.8, 1.8, u)); bigName('đưa cả ngôi chùa bay lên trời', 360, 224, 28, sm(1.1, 2.1, u));
        flash(1 - sm(3.2, 4, s), '255,244,225'); flash(sm(9.8, 10.5, s), '255,246,200');
      } else { // cõi Phật: người phía sau cúi lạy thành vòng cung dưới Phật, người tặng đứng giữa luồng sáng
        const u = s - 10.5;
        realm(t);
        for (let i = 0; i < 4; i++) { const c = u / 2.2 + hash(i), n = Math.floor(c); firework(90 + hash(i * 7 + n) * 540, 120 + hash(i * 5 + n) * 200, (c - n) * 2.2, 1); }
        others.forEach((p, i) => {
          const k = (i + .5) / others.length - .5, x = 360 + k * 620, y = 1120 + k * k * 240;
          hero(p, x, y, .5, t, true); incense(x, y, .5, t + i);
        });
        beam(360, 770, 360, 1000, 240); crown(360, 900, t); heroes(sc, 360, 1000, 1.2, t);
        nameTitle(sc, 360, 1228, 64, sm(.6, 1.6, u)); bigName('Thần tiên giáng trần', 360, 1268, 28, sm(.9, 1.9, u));
        flash(1 - sm(0, .8, u), '255,246,200');
      }
    } },
};

// ---------- Dấu ấn giữ lại trong điện đến hết phiên live (mất khi tải lại trang) ----------
const marks = { glow: 0, hole: '', stars: [], lotus: [] };
function leaveMark(sc) {
  const names = sc.ps.map(p => p.name);
  if (sc.lvl === 9) marks.glow = .35;                                    // tượng Phật giữ hào quang
  if (sc.lvl === 10 && !marks.hole) marks.hole = 'day';                  // lỗ thủng trên mái vẫn còn, nhìn thấy trời
  if (sc.lvl === 11) marks.lotus = [...marks.lotus, ...names].slice(-3); // đài sen mang tên lơ lửng trong điện
  if (sc.lvl === 12) { marks.hole = 'night'; marks.stars = [...names, ...marks.stars.filter(n => !names.includes(n))].slice(0, 4); } // trời sao qua lỗ mái, giữ tên 4 người gần nhất
}
function drawMarks(t) {
  if (marks.hole) roofHole(marks.stars.length > 1 ? .64 : .5, () => {
    if (marks.hole === 'day') { bgImg('bg_sky'); cloudBlob(330 + Math.sin(t * .1) * 70, 90, 200, .9); }
    else { // tên mới nhất to ở giữa, các tên trước nhỏ hơn xung quanh, mỗi tên kèm một ngôi sao sáng
      bgImg('bg_stars');
      marks.stars.forEach((name, i) => {
        const [x, y, size] = [[360, 118, 28], [250, 62, 17], [470, 62, 17], [360, 178, 17]][i];
        halo(x, i === 3 ? y + 18 : y - size - 4, 14 + Math.sin(t * 3 + i * 2) * 4); bigName(name, x, y, size); // tên dưới cùng: sao nằm phía dưới để không đè chữ
      });
    }
  });
  marks.lotus.forEach((name, i) => {
    const x = [110, 610, 110][i], y = [330, 330, 480][i] + Math.sin(t * 1.2 + i * 2) * 8;
    halo(x, y - 6, 70, .7); lotusSeat(x, y - 14, .32); bigName(name, x, y + 34, 17);
  });
}

// ---------- Điều khiển màn diễn ----------
// Âm thanh theo cảnh (sound-cues.js): tới đúng giây nào thì phát âm hoặc đổi lớp nền ở giây đó
function fireCues(sc, from, to) {
  const c = SCENE_SOUND[sc.lvl] || {};
  (c.cues || []).forEach(([t, name, opt]) => { if (t > from && t <= to) SOUND.play(name, opt); });
  (c.amb || []).forEach(([t, names]) => { if (t > from && t <= to) SOUND.setLayers(names, 1.5); });
}
function startScene(lvl, ps) {
  const sc = { lvl, s: 0, ps, home: false };
  fireCues(sc, -1, 0); // âm ở giây 0 phát ngay khi cảnh bắt đầu
  return sc;
}
// Cảnh 4: sàn nứt lan dần rồi nước dâng. Mỗi ảnh hiện dần trong .35 giây lên trên ảnh trước
const HALL_STEPS = [['hall_crack_00', .2], ['hall_crack_01', .45], ['hall_crack_02', .7], ['hall_crack_03', 1], ['hall_flood_00', 1.3], ['hall_flood_01', 1.8], ['hall_flood_02', 2.2]];
function hallFrames(s) { // [tên ảnh, độ mờ] của các ảnh cần vẽ lúc s
  let below = 0; // ảnh đã phủ kín màn: các ảnh dưới bị che nên không cần vẽ
  HALL_STEPS.forEach(([name, t0], k) => { if (R[name] && s >= t0 + .35) below = k; });
  const out = [];
  HALL_STEPS.forEach(([name, t0], k) => { const a = sm(t0, t0 + .35, s); if (k >= below && R[name] && a > 0) out.push([name, a]); });
  return out;
}
const backAt = d => d.cut < 1e9 ? d.dur - FOG_S : 1e9; // lúc sương mù bắt đầu phủ

// Gọi mỗi khung hình. Trả true khi màn diễn kết thúc. Đặt shake (rung) và flee (mọi người bỏ chạy) cho index.html.
function tickScene(sc, dt) {
  const d = SCENES[sc.lvl], prev = sc.s;
  sc.s += dt;
  fireCues(sc, prev, sc.s);
  if (prev < d.cut && sc.s >= d.cut) SOUND.play('whoosh'); // đổi môi trường: cắt sang cảnh mới
  if (prev < backAt(d) && sc.s >= backAt(d)) SOUND.play('fog'); // sương mù bắt đầu phủ
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
