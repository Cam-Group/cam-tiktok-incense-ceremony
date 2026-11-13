# Tạo toàn bộ âm thanh của dự án: phần tổng hợp bằng script, phần mẫu thu sẵn lấy từ Wikimedia Commons.
# Dùng: AUDIO_SRC=thư_mục_mẫu_gốc python tools/make_audio.py  -> ghi public/sounds/*.mp3 và manifest.json
# Thư mục AUDIO_SRC chứa các file gốc để nguyên tên trên Commons (danh sách trong CREDITS.md).
# Cần: numpy, scipy, soundfile, av (PyAV).
import os, re, json
import numpy as np
import av, soundfile as sf
from scipy import signal
from scipy.ndimage import uniform_filter1d

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sounds')
DL = os.environ.get('AUDIO_SRC', '')
os.makedirs(OUT, exist_ok=True)
MAN = {}

# ---------- công cụ tín hiệu ----------
def tt(n): return np.arange(n, dtype=np.float32) / SR
def white(n, seed): return np.random.default_rng(seed).standard_normal(n).astype(np.float32)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x).astype(np.float32)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x).astype(np.float32)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x).astype(np.float32)
def sine(f, t): return np.sin(2*np.pi*f*t).astype(np.float32)
def fm(f, t): return np.sin(2*np.pi*np.cumsum(f)/SR).astype(np.float32)   # tần số thay đổi theo thời gian
def pad(x, n):
    y = np.zeros(n, np.float32); m = min(n, len(x)); y[:m] = x[:m]; return y
def add(x, s, y):   # cộng y vào x từ vị trí s, phần vượt ra ngoài bị cắt
    a = max(0, s); b = min(len(x), s + len(y))
    if b > a: x[a:b] += y[a - s:b - s]
    return x
def loop_xfade(x, sec):   # vòng lặp liền mạch: đuôi hoà vào đầu
    n = int(sec*SR); L = len(x); y = x[:L-n].copy(); w = np.linspace(0, 1, n, dtype=np.float32)
    y[:n] = x[:n]*w + x[L-n:]*(1-w); return y
def reverb(x, t60=0.8, wet=0.3, seed=1):
    n = int(t60*1.6*SR); t = tt(n)
    ir = white(n, seed)*np.exp(-6.9*t/t60); ir[0] = 1; ir /= np.sqrt(np.sum(ir**2)) + 1e-9
    y = signal.fftconvolve(x, ir)[:len(x)].astype(np.float32)
    y *= (np.max(np.abs(x)) + 1e-9)/(np.max(np.abs(y)) + 1e-9)
    return (x*(1-wet) + y*wet).astype(np.float32)

def put(cue, idx, x, gain, loop=False):
    """Ghi một file MP3. Hiệu ứng chuẩn hoá theo đỉnh; vòng lặp chuẩn hoá theo độ lớn trung bình."""
    x = np.asarray(x, np.float32)
    if loop:
        x = x / (np.sqrt(np.mean(x**2)) + 1e-9) * 10**(-20/20)
        pk = np.max(np.abs(x))
        if pk > 0.9: x = x * 0.9 / pk
    else:
        x = x / (np.max(np.abs(x)) + 1e-9) * 10**(-3/20)
    fn = f'{cue}_{idx:02d}' if idx is not None else cue
    sf.write(os.path.join(OUT, fn + '.mp3'), x, SR, format='MP3', subtype='MPEG_LAYER_III')
    MAN.setdefault(cue, {'files': [], 'gain': gain, 'loop': loop})['files'].append(fn + '.mp3')

# ---------- đọc mẫu thu sẵn ----------
def load(path):
    c = av.open(path); st = c.streams.audio[0]
    res = av.AudioResampler(format='fltp', layout='mono', rate=SR); parts = []
    def take(fr):
        if fr is None: return
        for f in (fr if isinstance(fr, list) else [fr]): parts.append(f.to_ndarray().reshape(-1))
    for fr in c.decode(st): take(res.resample(fr))
    take(res.resample(None)); c.close()
    return np.concatenate(parts).astype(np.float32)
def rec(prefix):   # tìm file gốc theo đầu tên, bỏ qua khác biệt giữa dấu cách và gạch dưới
    hits = sorted(f for f in os.listdir(DL) if re.sub(r'[\W_]+', '_', f).startswith(prefix)); assert hits, prefix
    return os.path.join(DL, hits[0])
def clip(x, a, d):   # đoạn [a, a+d] giây, có fade vào và ra
    s = int(a*SR); seg = x[s:s + int(d*SR)].astype(np.float32).copy(); n = len(seg); i = np.arange(n)
    return seg * np.minimum(1, i/(0.01*SR)) * np.minimum(1, (n - i)/(0.25*SR))
def pitched(x, r):   # r > 1: cao hơn và ngắn hơn
    return np.interp(np.arange(0, len(x) - 1, r), np.arange(len(x)), x).astype(np.float32)
def onsets(x, thr=10, gap=0.25):   # vị trí các cú âm (mẫu), dò theo đường năng lượng
    h = int(0.01*SR); e = np.sqrt(uniform_filter1d(x.astype(np.float64)**2, h) + 1e-12); db = 20*np.log10(e)
    base = np.percentile(db, 40); on = np.where((db[1:] >= base + thr) & (db[:-1] < base + thr))[0] + 1
    out, last = [], -1e9
    for k in on:
        if k - last >= gap*SR: out.append(int(k)); last = k
    return out

def recorded():
    x = load(rec('Listening_to_Raindrops')); put('amb_rain', None, loop_xfade(x[:30*SR], 1.5), .45, True)
    x = load(rec('Nosferatu_thunderclap')); pk = int(np.argmax(np.abs(x)))
    put('thunder', 0, clip(x, max(0, pk/SR - 0.4), 6.0), .8)
    x = load(rec('Howling_wind')); s = len(x)//3; put('amb_wind', None, loop_xfade(x[s:s + 20*SR], 2.0), .3, True)
    x = load(rec('Night_Chorus_of_Frogs')); put('amb_frogs', None, loop_xfade(x[:24*SR], 2.0), .3, True)
    x = load(rec('Street_parade_carnival')); s = len(x)//2; put('amb_festival', None, loop_xfade(x[s:s + 20*SR], 2.0), .3, True)
    x = load(rec('Applause_i_ogg')); put('applause', 0, clip(x, 1.0, 5.0), .6)
    x = load(rec('Slow_starting_applause')); put('applause', 1, clip(x, 2.0, 5.0), .6)
    x = load(rec('Bathtub_water_splashes'))
    for i, s in enumerate(onsets(x, 12, 0.3)[:6]): put('splash', i, clip(x, max(0, s/SR - 0.01), 1.6), .6)
    x = load(rec('Gong_or_bell_vibrant_short')); put('bell', 0, clip(x, 0, 4.5), .6)
    x = load(rec('Gong_or_bell_vibrant_ogg')); put('bell', 1, clip(x, 0, 6.0), .6); put('bell', 2, clip(pitched(x, 1.08), 0, 5.0), .6)
    x = load(rec('Gong55')); put('gong', 0, clip(x, 0, 7.0), .7)
    x = load(rec('02_Taiko2'))
    for i, s in enumerate(onsets(x, 10, 0.4)[:4]): put('taiko', i, clip(x, max(0, s/SR - 0.01), 1.4), .7)
    x = load(rec('Fireworks_in_distance_6'))
    for i, s in enumerate(onsets(x, 10, 1.0)[:3]): put('firework_burst', i, clip(x, max(0, s/SR - 0.02), 3.0), .6)
    x = load(rec('Scream_c'))
    for i, r in enumerate([0.9, 1.0, 1.15]): put('scream', i, clip(pitched(x, r), 0, 1.0), .6)
    x = load(rec('Church_people_walking'))
    for i, s in enumerate(onsets(x, 10, 0.35)[:8]): put('step_church', i, clip(x, max(0, s/SR - 0.005), 0.9), .6)

# ---------- âm tổng hợp ----------
def step_wood(v):
    r = np.random.default_rng(100 + v); n = int(0.28*SR); t = tt(n); f = r.uniform(120, 190)
    heel = lp(white(n, 110 + v), r.uniform(700, 1000))*np.exp(-t/0.03)
    board = sine(f, t)*np.exp(-t/0.09) + 0.35*sine(2.31*f, t)*np.exp(-t/0.04)
    click = hp(white(n, 120 + v), 3500)*np.exp(-t/0.006)*0.4
    return heel*0.9 + board*0.45 + click
def step_water(v):
    r = np.random.default_rng(130 + v); n = int(0.45*SR); t = tt(n)
    x = bp(white(n, 140 + v), 700, 3200)*np.exp(-t/0.10)*np.clip(t/0.005, 0, 1)*0.9
    for _ in range(int(r.integers(2, 5))):
        t2 = tt(int(0.08*SR)); x = add(x, int(r.uniform(0.05, 0.3)*SR), sine(r.uniform(1100, 1900), t2)*np.exp(-t2/0.03)*0.35)
    return x
def debris(v):
    r = np.random.default_rng(200 + v); x = np.zeros(int(1.6*SR), np.float32); t0, amp = 0.0, 1.0
    for k in range(int(r.integers(4, 8))):
        m = int(0.25*SR); t2 = tt(m)
        x = add(x, int(t0*SR), (bp(white(m, 210 + 10*v + k), 900, 3800)*np.exp(-t2/0.03) + sine(r.uniform(400, 1100), t2)*np.exp(-t2/0.05)*0.3)*amp)
        t0 += r.uniform(0.07, 0.22); amp *= r.uniform(0.45, 0.7)
    return x
def creak(v):
    r = np.random.default_rng(300 + v); n = int(1.1*SR); t = tt(n)
    f = np.linspace(r.uniform(180, 240), r.uniform(260, 380), n)*(1 + 0.02*np.sin(2*np.pi*r.uniform(4, 9)*t))
    ton = fm(f, t); nz = bp(white(n, 310 + v), 400, 1800)*(0.5 + 0.5*np.sin(2*np.pi*r.uniform(9, 15)*t))
    return (ton*0.4 + nz*0.6)*np.sin(np.pi*np.clip(t/1.1, 0, 1))**1.5
def collapse():   # trần nhà sập: kêu rên, nứt, ầm trầm, mảnh vỡ, dầm đổ, bụi
    n = int(6.0*SR); x = np.zeros(n, np.float32)
    x = add(x, 0, creak(9)*0.8)
    m = int(0.5*SR); t = tt(m)
    x = add(x, int(0.85*SR), hp(white(m, 901), 1500)*np.exp(-t/0.02) + sine(780, t)*np.exp(-t/0.05)*0.6)
    m = int(4.6*SR); t = tt(m); br = lp(np.cumsum(white(m, 902)), 160); br /= np.max(np.abs(br)) + 1e-9
    x = add(x, int(1.0*SR), br*np.clip(t/1.0, 0, 1)*np.exp(-np.maximum(t - 1.0, 0)/1.5)*0.9)
    r = np.random.default_rng(403)
    for k in range(38):
        s = 1.0 + r.uniform(0, 3.6); m2 = int(0.35*SR); t2 = tt(m2); a = r.uniform(0.25, 0.9)*np.exp(-(s - 1.0)/1.6)
        x = add(x, int(s*SR), (bp(white(m2, 1000 + k), 700, 3500)*np.exp(-t2/0.035) + sine(r.uniform(300, 900), t2)*np.exp(-t2/0.06)*0.25)*a)
    for s0 in (1.25, 2.1, 3.3):
        m2 = int(0.6*SR); t2 = tt(m2)
        x = add(x, int(s0*SR), (sine(58, t2)*np.exp(-t2/0.25) + lp(white(m2, 1100 + int(s0*10)), 400)*np.exp(-t2/0.08)*0.6)*0.9)
    m2 = int(5.0*SR); t2 = tt(m2)
    return add(x, int(1.0*SR), hp(white(m2, 1200), 3500)*np.clip(t2/0.3, 0, 1)*np.exp(-t2/2.2)*0.12)
def crack_floor(v):
    n = int(0.9*SR); t = tt(n)
    return hp(white(n, 400 + v), 1200)*np.exp(-t/0.02) + sine(650 + 60*v, t)*np.exp(-t/0.12)*0.5 + lp(white(n, 410 + v), 180)*np.exp(-t/0.35)*0.8
def drip(v):
    r = np.random.default_rng(500 + v); n = int(0.35*SR); t = tt(n)
    f = np.linspace(r.uniform(1400, 1900), r.uniform(450, 650), n)
    return fm(f, t)*np.exp(-t/0.09) + sine(r.uniform(2000, 2800), t)*np.exp(-t/0.02)*0.2
def flood_rise():   # nước dâng: tiếng gù gù và giọt rơi rải rác
    dur = 3.2; n = int(dur*SR); t = tt(n)
    g = lp(white(n, 650), 650)*(0.55 + 0.45*np.sin(2*np.pi*4.5*t + 2*np.sin(2*np.pi*0.7*t)))
    x = g*np.clip(t/0.6, 0, 1)*np.exp(-np.maximum(t - 2.4, 0)/0.6); r = np.random.default_rng(660)
    for k in range(18): x = add(x, int(r.uniform(0.2, 3.0)*SR), drip(k % 4)*0.4)
    return x
def dragon_roar(v):   # rồng gầm: sóng răng cưa hạ dần cao độ, qua bộ lọc âm sắc giống giọng, có hơi thở và tiếng trầm
    r = np.random.default_rng(500 + v); dur = 3.6; n = int(dur*SR); t = tt(n)
    f0 = np.linspace(r.uniform(85, 100), r.uniform(55, 65), n); ph = 2*np.pi*np.cumsum(f0)/SR
    src = sum(np.sin(k*ph)/k for k in range(1, 14)).astype(np.float32)*(1 + 0.03*np.sin(2*np.pi*r.uniform(6, 9)*t))
    voiced = bp(src, 250, 450) + 0.7*bp(src, 600, 900) + 0.35*bp(src, 1200, 1800)
    breath = bp(white(n, 510 + v), 700, 2400)*0.35*(0.6 + 0.4*np.sin(2*np.pi*11*t))
    rumble = lp(white(n, 520 + v), 90)*0.8
    env = np.minimum(1, t/0.35)*np.clip((dur - t)/0.8, 0, 1)*(0.75 + 0.25*np.sin(2*np.pi*4*t))
    return reverb((voiced*0.9 + breath + rumble)*env, 0.9, 0.35, 530 + v)
def dragon_wings():   # vỗ cánh: nhịp gió ~3 lần mỗi giây
    dur = 2.6; n = int(dur*SR); t = tt(n); flap = np.sin(2*np.pi*3.2*t)**4
    x = bp(white(n, 610), 250, 1100)*flap*0.8 + lp(white(n, 611), 300)*0.5*(0.5 + 0.5*np.sin(2*np.pi*3.2*t))
    return reverb(x*np.minimum(1, t/0.4)*np.clip((dur - t)/0.6, 0, 1), 0.5, 0.2, 612)
def wind_gust(v):
    dur = 2.6; n = int(dur*SR); t = tt(n); r = np.random.default_rng(700 + v)
    w = lp(white(n, 710 + v), r.uniform(900, 1600)) + bp(white(n, 720 + v), 300, 800)*0.5
    return w*np.sin(np.pi*np.clip(t/dur, 0, 1))**2*(1 + 0.35*np.sin(2*np.pi*r.uniform(1.0, 2.5)*t))
def whoosh(v):
    n = int(1.1*SR); t = tt(n); return hp(white(n, 1400 + v), 900)*np.sin(np.pi*np.clip(t/1.1, 0, 1))**2*0.7
def fog():
    n = int(2.2*SR); t = tt(n); return lp(white(n, 1900), 700)*np.sin(np.pi*np.clip(t/2.2, 0, 1))**2*0.7
def time_stop():   # thời gian ngừng: chuông ngân kéo dài, gió hút vào rồi im lặng
    n = int(2.6*SR); t = tt(n)
    ring = sine(1568, t)*np.exp(-t/1.2)*0.25 + sine(2350, t)*np.exp(-t/0.9)*0.1
    return ring + hp(white(n, 1700), 2000)*np.exp(-t/0.9)*np.clip(t/0.7, 0, 1)*0.4
def ink():   # cọ mực quét: tiếng cọ lướt chậm, nhịp thở
    n = int(3.0*SR); t = tt(n)
    return bp(white(n, 1800), 300, 900)*0.8*(0.5 + 0.5*np.sin(2*np.pi*0.7*t))*np.sin(np.pi*np.clip(t/3.0, 0, 1))
def incense():   # que diêm bật, lửa bùng, than nổ lách tách, khói bay
    n = int(1.8*SR); t = tt(n); r = np.random.default_rng(1500); x = np.zeros(n, np.float32)
    t2 = tt(int(0.05*SR)); x = add(x, 0, hp(white(len(t2), 1501), 2500)*np.exp(-t2/0.02)*0.9)
    t2 = tt(int(0.2*SR)); x = add(x, 0, bp(white(len(t2), 1502), 2500, 5000)*np.exp(-t2/0.06)*0.5)
    x += lp(white(n, 1503), 1500)*0.3*np.clip((t - 0.15)/0.4, 0, 1)*np.exp(-np.maximum(t - 0.4, 0)/0.7)
    for k in range(40):
        m = 176; t2 = tt(m)
        x = add(x, int(r.uniform(0.2, 1.6)*SR), hp(white(m, 1600 + k), 2000)*np.exp(-t2/0.004)*r.uniform(0.2, 0.6))
    return x
def tinkle(f, dur):   # tiếng chuông thuỷ tinh: nhiều bồi âm, tắt dần
    n = int(dur*SR); t = tt(n)
    return sum(sine(f*p, t)*a*np.exp(-t/(dur/(1 + 0.6*i))) for i, (p, a) in enumerate([(1, .6), (2.76, .3), (5.4, .15), (8.93, .08)])).astype(np.float32)
def gold_dust():   # kim sa rơi: hàng trăm hạt sáng li ti
    n = int(2.0*SR); x = np.zeros(n, np.float32); r = np.random.default_rng(970)
    for _ in range(60):
        m = int(0.03*SR); t2 = tt(m); x = add(x, int(r.uniform(0, 1.9)*SR), sine(r.uniform(4000, 7000), t2)*np.exp(-t2/0.01)*r.uniform(0.05, 0.2))
    return x
def lantern(v):   # đèn trời: tiếng giấy sột soạt và ngọn lửa bùng lên
    n = int(3.0*SR); t = tt(n); r = np.random.default_rng(980 + v); x = np.zeros(n, np.float32)
    for k in range(int(r.integers(10, 18))):
        m = int(r.uniform(0.04, 0.12)*SR); t2 = tt(m)
        x = add(x, int(r.uniform(0, 1.6)*SR), hp(white(m, 990 + k), 2500)*np.exp(-t2/0.03)*r.uniform(0.2, 0.6))
    return x + lp(white(n, 985 + v), 1200)*np.clip(t/0.4, 0, 1)*np.exp(-np.maximum(t - 1.4, 0)/1.0)*0.35
def petal(v):   # cánh hoa lướt gió
    n = int(0.8*SR); t = tt(n); return bp(white(n, 1000 + v), 1500, 5000)*np.sin(np.pi*np.clip(t/0.8, 0, 1))**2*0.6
def chime(v):   # đàn ngân ngũ cung
    return tinkle([523.25, 659.25, 783.99][v], 1.5)
def gift():     # âm báo quà được nhận
    return tinkle(1320, 0.8)*0.8
def bow(v):     # áo dài sột soạt khi cúi đầu
    n = int(0.9*SR); t = tt(n)
    return bp(white(n, 1100 + v), 500, 2400)*np.sin(np.pi*np.clip(t/0.9, 0, 1))**2*0.6 + sine(70, t)*np.exp(-t/0.08)*0.5
def uproot():   # ngôi chùa nhổ khỏi đất: ầm trầm, gỗ rên, gió bốc
    dur = 4.5; n = int(dur*SR); t = tt(n)
    return lp(white(n, 1400), 110)*np.clip(t/1.5, 0, 1)*np.exp(-np.maximum(t - 2.5, 0)/0.9)*2.0 + pad(creak(4), n)*0.6 + hp(white(n, 1410), 500)*0.3*np.sin(np.pi*np.clip(t/dur, 0, 1))
def radiance():   # hào quang: hợp âm mở, lấp lánh
    dur = 4.5; n = int(dur*SR); t = tt(n); swell = np.clip(t/2.0, 0, 1)**1.5*np.exp(-np.maximum(t - 3.2, 0)/0.9)
    x = sum(sine(f*(1 + d), t)*0.12 for f, d in [(220, 0), (220, .004), (330, .002), (440, -.003), (660, .001)])
    return reverb((x + sine(1760, t)*(0.5 + 0.5*np.sin(2*np.pi*5*t))*0.08)*swell, 1.6, 0.4, 1420)
def lion_drum(v):   # trống lân và chũm chọe
    n = int(1.6*SR); t = tt(n)
    body = fm(110*np.exp(-t/0.12) + 52, t)*np.exp(-t/0.42)
    return body*0.9 + lp(white(n, 1200 + v), 1800)*np.exp(-t/0.01)*0.5 + hp(white(n, 1210 + v), 5000)*np.exp(-np.maximum(t - 0.02, 0)/0.9)*0.25
def firework_launch(v):   # pháo bay lên: tiếng rít tăng dần
    n = int(1.3*SR); t = tt(n)
    return fm(np.linspace(500, 2400 + 300*v, n), t)*0.25*np.exp(-t/1.0) + hp(white(n, 1460 + v), 3000)*0.05
def boom():     # tiếng ầm chuyển cảnh
    n = int(2.4*SR); t = tt(n); return lp(white(n, 1470), 160)*np.exp(-t/0.5) + sine(48, t)*np.exp(-t/0.6)*0.8

def ambience():
    n = int(20*SR); t = tt(n)
    x = lp(white(n, 801), 260)*0.5 + lp(white(n, 802), 90)*0.6 + sine(50, t)*0.05   # chùa: tiếng phòng trầm
    x = x*(0.8 + 0.2*np.sin(2*np.pi*0.05*t)); r = np.random.default_rng(803)
    for k in range(6): x = add(x, int(r.uniform(1, 18)*SR), creak(20 + k)*0.12)
    put('amb_hall', None, loop_xfade(x, 2.0), .25, True)
    x = sum(sine(f, t)*a for f, a in [(110, .25), (165, .12), (220, .08), (330, .03)])*(0.8 + 0.2*np.sin(2*np.pi*0.03*t))
    put('amb_ink', None, loop_xfade(x + bp(white(n, 901), 250, 700)*0.08*(0.5 + 0.5*np.sin(2*np.pi*0.11*t)), 3.0), .35, True)
    x = sum(sine(f*(1 + d), t)*a for f, d, a in [(55, 0, .3), (82.5, .002, .18), (110, -.003, .12), (165, .004, .05)])*(0.8 + 0.2*np.sin(2*np.pi*0.04*t))
    put('amb_buddha', None, loop_xfade(x + hp(white(n, 911), 4000)*0.01*(0.5 + 0.5*np.sin(2*np.pi*0.2*t)), 3.0), .35, True)
    x = sum(sine(f*(1 + 0.002*np.sin(2*np.pi*0.1*t + i)), t)*0.06 for i, f in enumerate([220, 277, 330, 440, 554]))*(0.7 + 0.3*np.sin(2*np.pi*0.05*t))
    put('amb_realm', None, loop_xfade(x + bp(white(n, 921), 600, 2400)*0.02*(0.5 + 0.5*np.sin(2*np.pi*0.09*t)), 3.0), .35, True)
    x = lp(white(n, 931), 500)*0.10*(0.6 + 0.4*np.sin(2*np.pi*0.07*t)); r = np.random.default_rng(930)
    for _ in range(3):   # dế kêu: nhiều nguồn, mỗi nguồn một nhịp
        f = r.uniform(4300, 5200); rate = r.uniform(38, 46); s = int(r.uniform(0, 2)*SR)
        while s < n - SR:
            m = min(int(r.uniform(0.6, 1.3)*SR), n - s); t2 = tt(m)
            x = add(x, s, sine(f, t2)*(np.sin(2*np.pi*rate*t2) > 0.2).astype(np.float32)*0.05*r.uniform(0.6, 1.0))
            s += m + int(r.uniform(0.8, 2.2)*SR)
    put('amb_night', None, loop_xfade(x, 2.0), .4, True)
    x = bp(white(n, 941), 400, 1600)*0.10*(0.5 + 0.5*np.sin(2*np.pi*0.25*t)) + lp(white(n, 942), 250)*0.06; r = np.random.default_rng(940)
    for k in range(10): x = add(x, int(r.uniform(0, 19.5)*SR), drip(k % 4)*0.25)
    put('amb_pond', None, loop_xfade(x, 2.0), .35, True)
    w = bp(white(n, 951), 500, 2200)*0.18*(0.5 + 0.5*np.sin(2*np.pi*0.13*t)) + lp(white(n, 952), 300)*0.12
    put('amb_sky', None, loop_xfade(w + fm(1700 + 200*np.sin(2*np.pi*0.1*t), t)*0.02*(0.5 + 0.5*np.sin(2*np.pi*0.07*t)), 2.0), .35, True)

def effects():
    for i in range(3): put('step_wood', i, step_wood(i), .7)
    for i in range(2): put('step_water', i, step_water(i), .6)
    for i in range(3): put('debris', i, debris(i), .7)
    put('collapse', 0, collapse(), .9)
    for i in range(2): put('creak', i, creak(i), .5)
    for i in range(2): put('crack', i, crack_floor(i), .6)
    for i in range(4): put('drip', i, drip(i), .4)
    put('flood_rise', None, flood_rise(), .5)
    for i in range(2): put('dragon_roar', i, dragon_roar(i), .9)
    put('dragon_wings', None, dragon_wings(), .6)
    for i in range(2): put('wind_gust', i, wind_gust(i), .5)
    for i in range(2): put('whoosh', i, whoosh(i), .5)
    put('fog', None, fog(), .5); put('time_stop', None, time_stop(), .6); put('ink', None, ink(), .4)
    put('incense', None, incense(), .6)
    for i, f in enumerate([2400, 2900, 3400]): put('candle', i, tinkle(f, .7), .25)
    for i in range(2): put('lantern', i, lantern(i), .4); put('petal', i, petal(i), .3)
    put('gold_dust', None, gold_dust(), .25)
    for i in range(3): put('chime', i, chime(i), .4)
    put('gift', None, gift(), .45)
    for i in range(2): put('bow', i, bow(i), .5)
    put('uproot', None, uproot(), .7); put('radiance', None, radiance(), .5)
    for i in range(2): put('lion_drum', i, lion_drum(i), .6); put('firework_launch', i, firework_launch(i), .4)
    put('boom', None, boom(), .8)

if __name__ == '__main__':
    if not os.path.isdir(DL): raise SystemExit('Đặt AUDIO_SRC là thư mục chứa các file gốc từ Commons (xem CREDITS.md)')
    recorded(); ambience(); effects()
    json.dump(MAN, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = 0
    for cue, m in sorted(MAN.items()):
        secs = [sf.info(os.path.join(OUT, f)).duration for f in m['files']]
        size = sum(os.path.getsize(os.path.join(OUT, f)) for f in m['files']); total += size
        print(f"{cue:16s} files={len(m['files'])} loop={m['loop']!s:5s} dur={min(secs):5.2f}-{max(secs):5.2f}s size={size//1024}KB")
    print('cues', len(MAN), 'files', sum(len(m['files']) for m in MAN.values()), 'total KB', total//1024)
