# Tạo lại toàn bộ âm thanh của dự án từ file gốc (Freesound CC0 và CC BY; nhac_nen do chủ dự án cung cấp, xem CREDITS.md).
# Dùng: AUDIO_SRC=thư_mục_gốc python tools/make_audio.py  -> ghi public/sounds/*.mp3 và manifest.json
# AUDIO_SRC có một thư mục con cho mỗi id Freesound (AUDIO_SRC/<id>/<file gốc>) và AUDIO_SRC/nhac_nen/ cho file tự cung cấp. Cách tải: CREDITS.md.
# Cần: numpy, av (PyAV).
import glob, json, os, shutil
from fractions import Fraction
import numpy as np
import av

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sounds')
SRC = os.environ.get('AUDIO_SRC', '')
LOOP_SEC = 30  # độ dài đoạn lặp của âm nền
XFADE = 2.0    # giây hoà đầu vào đuôi để vòng lặp không gãy
PEAK = 0.84    # trần đỉnh, khoảng -1.5 dBFS: MP3 giải mã có thể vượt nhẹ

# cue: (gain của bản cũ, RMS dB của bản cũ, có lặp?, [(tên file, id Freesound, giây tối đa)]). Gain mới được tính lại để độ to không đổi.
# Với âm nền có lặp, giây tối đa là độ dài đoạn lặp.
SPEC = {
    'amb_buddha': (0.35, -20.4, True, [('amb_buddha', 468041, LOOP_SEC)]),
    'amb_festival': (0.3, -20.4, True, [('amb_festival', 623605, LOOP_SEC)]),
    'amb_frogs': (0.3, -20.4, True, [('amb_frogs', 711047, LOOP_SEC)]),
    'amb_hall': (0.25, -20.4, True, [('amb_hall', 648415, LOOP_SEC)]),
    'amb_ink': (0.35, -20.4, True, [('amb_ink', 466123, LOOP_SEC)]),
    'amb_night': (0.4, -20.4, True, [('amb_night', 436528, LOOP_SEC)]),
    'amb_pond': (0.35, -22.0, True, [('amb_pond', 573823, LOOP_SEC)]),
    'amb_rain': (0.45, -28.0, True, [('amb_rain', 531871, LOOP_SEC)]),
    'amb_realm': (0.35, -20.4, True, [('amb_realm', 697217, LOOP_SEC)]),
    'amb_sky': (0.35, -20.4, True, [('amb_sky', 459981, LOOP_SEC)]),
    'amb_wind': (0.3, -20.4, True, [('amb_wind', 546759, LOOP_SEC)]),
    'applause': (0.6, -24.8, False, [('applause_00', 478412, 8), ('applause_01', 432329, 6)]),
    'bell': (0.6, -20.1, False, [('bell_00', 668647, 8), ('bell_01', 368821, 6), ('bell_02', 271626, 6)]),
    'boom': (0.8, -16.8, False, [('boom', 826058, 4)]),
    'bow': (0.5, -18.3, False, [('bow_00', 493418, 1.2), ('bow_01', 493415, 1.2)]),
    'candle': (0.25, -14.2, False, [('candle_00', 423810, 1.8), ('candle_01', 237391, 1.8), ('candle_02', 742836, 1.5)]),
    'chime': (0.4, -14.6, False, [('chime_00', 361427, 4), ('chime_01', 398494, 5), ('chime_02', 477437, 6)]),
    'collapse': (0.9, -24.2, False, [('collapse_00', 721600, 6)]),
    'crack': (0.6, -30.7, False, [('crack_00', 669453, 1.5), ('crack_01', 183453, 1.2)]),
    'creak': (0.5, -15.6, False, [('creak_00', 590157, 1.8), ('creak_01', 802573, 1.0)]),
    'debris': (0.7, -30.1, False, [('debris_00', 569742, 3), ('debris_01', 336023, 4), ('debris_02', 132929, 4)]),
    'dragon_roar': (0.9, -19.7, False, [('dragon_roar_00', 132871, 4), ('dragon_roar_01', 476083, 3)]),
    'dragon_wings': (0.6, -21.2, False, [('dragon_wings', 596541, 3.5)]),
    'drip': (0.4, -16.8, False, [('drip_00', 51754, 0.8), ('drip_01', 643661, 1.4), ('drip_02', 422873, 2.2), ('drip_03', 842162, 0.9)]),
    'firework_burst': (0.6, -31.9, False, [('firework_burst_00', 336008, 2.5), ('firework_burst_01', 336010, 1.8), ('firework_burst_02', 736642, 4)]),
    'firework_launch': (0.4, -14.4, False, [('firework_launch_00', 695731, 4.4), ('firework_launch_01', 140726, 1.8)]),
    'flood_rise': (0.5, -20.2, False, [('flood_rise', 530168, 6)]),
    'fog': (0.5, -19.7, False, [('fog', 521043, 3.5)]),
    'gift': (0.45, -14.6, False, [('gift', 510735, 2.2)]),
    'gold_dust': (0.25, -21.2, False, [('gold_dust', 521886, 4.5)]),
    'gong': (0.7, -27.0, False, [('gong_00', 194433, 12)]),
    'incense': (0.6, -30.4, False, [('incense', 650574, 4)]),
    'ink': (0.4, -20.2, False, [('ink', 428338, 2)]),
    'lantern': (0.4, -26.4, False, [('lantern_00', 181774, 2.5), ('lantern_01', 426816, 2.5)]),
    'lion_drum': (0.6, -18.6, False, [('lion_drum_00', 712299, 6), ('lion_drum_01', 878070, 4.5)]),
    'petal': (0.3, -19.2, False, [('petal_00', 443065, 3), ('petal_01', 635053, 3)]),
    'radiance': (0.5, -16.3, False, [('radiance', 521885, 6)]),
    'scream': (0.6, -14.7, False, [('scream_00', 733539, 4), ('scream_01', 675049, 4), ('scream_02', 482821, 4)]),
    'splash': (0.6, -28.7, False, [('splash_00', 867456, 1.2), ('splash_01', 867457, 1.2), ('splash_02', 867458, 1.2),
                                   ('splash_03', 867459, 1.2), ('splash_04', 867460, 1.2), ('splash_05', 867463, 1.2)]),
    'step_church': (0.6, -18.9, False, [('step_church_00', 521590, 0.6), ('step_church_01', 422686, 0.6),
                                        ('step_church_02', 231851, 0.6), ('step_church_03', 422755, 0.6)]),
    'step_water': (0.6, -20.5, False, [('step_water_00', 861369, 0.7), ('step_water_01', 624166, 0.7)]),
    'step_wood': (0.7, -21.2, False, [('step_wood_00', 367050, 0.6), ('step_wood_01', 398779, 0.6), ('step_wood_02', 398783, 0.6)]),
    'taiko': (0.7, -19.1, False, [('taiko_00', 82712, 1.5), ('taiko_01', 95624, 3), ('taiko_02', 203344, 1.2), ('taiko_03', 584131, 3)]),
    'thunder': (0.8, -21.9, False, [('thunder_00', 234736, 10)]),
    'time_stop': (0.6, -19.3, False, [('time_stop', 240934, 10)]),
    'uproot': (0.7, -19.6, False, [('uproot', 494071, 6)]),
    'whoosh': (0.5, -20.9, False, [('whoosh_00', 719636, 0.8), ('whoosh_01', 733891, 2)]),
    'wind_gust': (0.5, -19.6, False, [('wind_gust_00', 726317, 6), ('wind_gust_01', 726312, 6)]),
}


def load(path):
    """Giải mã thành mono float ở SR."""
    rs = av.AudioResampler(format='fltp', layout='mono', rate=SR)
    parts = []
    with av.open(path) as c:
        for f in c.decode(audio=0):
            parts += [r.to_ndarray()[0] for r in rs.resample(f)]
        parts += [r.to_ndarray()[0] for r in rs.resample(None)]
    return np.concatenate(parts).astype(np.float64)


def source(sid):
    files = glob.glob(os.path.join(SRC, str(sid), '*'))
    if len(files) != 1:
        raise SystemExit(f'cần đúng một file trong {SRC}/{sid}/, hiện có {len(files)}')
    return files[0]


def shot(x, sec):
    """Âm một lần: bỏ im lặng đầu và cuối, lấy tối đa sec giây, mờ hai đầu để không click."""
    idx = np.flatnonzero(np.abs(x) > 0.01)  # khoảng -40 dBFS
    s = max(0, int(idx[0]) - int(0.003 * SR)) if len(idx) else 0
    y = x[s:s + int(sec * SR)].copy()
    act = np.flatnonzero(np.abs(y) > 0.003)  # còn lại dưới -50 dBFS thì cắt, giữ 30 ms đuôi
    if len(act):
        y = y[:min(len(y), int(act[-1]) + int(0.03 * SR))]
    n = len(y)
    fi, fo = min(int(0.002 * SR), n), min(int(0.03 * SR), n)
    y[:fi] *= np.linspace(0, 1, fi)
    y[n - fo:] *= np.linspace(1, 0, fo)
    return y


def loop(x, sec):
    """Âm nền lặp: đầu đoạn được hoà với phần nối tiếp ngay sau nó, nên điểm nối đuôi-đầu liền mạch."""
    xf = int(XFADE * SR)
    L = min(int(sec * SR), len(x) - xf)
    seg = x[:L + xf]
    body = seg[:L].copy()
    w = np.linspace(0, np.pi / 2, xf)
    body[:xf] = seg[L:L + xf] * np.cos(w) + seg[:xf] * np.sin(w)
    return body


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def level(y):
    """Chuẩn hoá đỉnh về PEAK: giữ độ động tự nhiên của âm, không nén."""
    return y * (PEAK / (np.max(np.abs(y)) + 1e-12))


def mp3(path, x, bitrate):
    """Mã hoá libmp3lame (FFmpeg qua PyAV) để có thẻ LAME: trình duyệt cắt đúng độ trễ và phần đệm, vòng lặp khớp."""
    c = av.open(path, mode='w', format='mp3')
    st = c.add_stream('libmp3lame', rate=SR)
    st.layout = 'mono'
    st.bit_rate = bitrate
    fmt = st.codec_context.format.name
    x = np.clip(x, -1, 1)
    if fmt in ('s16p', 's16'):
        x = (x * 32767).astype(np.int16)
    elif fmt in ('s32p', 's32'):
        x = (x * 2147483647).astype(np.int32)
    else:
        x = x.astype(np.float32)
    fs = st.codec_context.frame_size or 1152
    for i in range(0, len(x), fs):
        f = av.AudioFrame.from_ndarray(x[i:i + fs].reshape(1, -1), format=fmt, layout='mono')
        f.sample_rate = SR
        f.pts = i
        f.time_base = Fraction(1, SR)
        for pkt in st.encode(f):
            c.mux(pkt)
    for pkt in st.encode(None):
        c.mux(pkt)
    c.close()


def build():
    os.makedirs(OUT, exist_ok=True)
    man, total = {}, 0
    for cue, (gain_old, rms_old, loops, items) in SPEC.items():
        files, secs, dbs = [], [], []
        for name, sid, sec in items:
            x = load(source(sid))
            y = level(loop(x, sec) if loops else shot(x, sec))
            fn = name + '.mp3'
            mp3(os.path.join(OUT, fn), y, 96000 if loops else 128000)
            files.append(fn)
            secs.append(len(y) / SR)
            dbs.append(db(np.sqrt(np.mean(y ** 2))))
        # độ to hiệu dụng của bản cũ = RMS × gain. Gain mới giữ đúng độ to đó, không vượt 1.
        gain = round(min(1.0, 10 ** ((rms_old + db(gain_old) - np.mean(dbs)) / 20)), 3)
        size = sum(os.path.getsize(os.path.join(OUT, f)) for f in files)
        total += size
        man[cue] = {'files': files, 'gain': gain, 'loop': loops}
        print(f"{cue:16s} gain {gain_old:.2f}->{gain:.3f} loop={loops!s:5s} dur={min(secs):5.2f}-{max(secs):5.2f}s size={size // 1024}KB")
    shutil.copyfile(source('nhac_nen'), os.path.join(OUT, 'nhac_nen.mp3'))  # nhạc nền: bản gốc, không cắt, phát liên tục
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('cues', len(man), 'files', sum(len(m['files']) for m in man.values()), 'total KB', total // 1024)


if __name__ == '__main__':
    if not os.path.isdir(SRC):
        raise SystemExit('Đặt AUDIO_SRC là thư mục có một thư mục con cho mỗi id Freesound (xem CREDITS.md)')
    build()
