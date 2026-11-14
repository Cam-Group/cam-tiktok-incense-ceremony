// Âm thanh theo từng cảnh, dùng cùng SOUND (sound.js). Tên âm khớp với sounds/manifest.json.
// amb: [giây, [các lớp nền]]: đổi nền khi tới đúng lúc (giây tính từ đầu cảnh).
// cues: [giây, tên âm, tuỳ chọn]: phát một âm khi tới đúng lúc. Chuyển cảnh (cắt, sương mù) do scenes.js tự phát.
const SCENE_SOUND = {
  1: { amb: [[0, ['amb_hall', 'nhac_nen']]], cues: [[.1, 'incense'], [.3, 'chime', { gain: .6 }]] },
  2: { amb: [[0, ['amb_hall', 'nhac_nen']]], cues: [[0, 'bell'], [.3, 'creak'], [.4, 'radiance'], [.8, 'gold_dust']] },
  3: { amb: [[0, ['amb_hall', 'nhac_nen']]], cues: [[0, 'fog'], [.3, 'incense'], [1.2, 'candle'], [2, 'candle'], [3.1, 'candle'], [4.2, 'candle'], [5.5, 'chime']] },
  4: {
    amb: [[0, ['amb_hall', 'nhac_nen']], [2.6, ['amb_pond', 'amb_frogs']]],
    cues: [[.2, 'crack'], [.7, 'crack'], [1, 'creak'], [1.2, 'flood_rise'], [1.6, 'drip'], [2.1, 'drip'], [2.6, 'splash'], [4.5, 'splash'], [6.8, 'splash'], [8.9, 'splash']],
  },
  5: {
    amb: [[0, ['amb_hall']], [2.8, ['amb_night']]],
    cues: [[.2, 'wind_gust'], [.6, 'lantern'], [1.2, 'lantern'], [1.8, 'lantern'], [2.2, 'whoosh'], [3.5, 'lantern'], [5, 'chime']],
  },
  6: {
    amb: [[0, ['amb_hall']], [1.6, ['amb_festival']]],
    cues: [[0, 'taiko'], [.25, 'taiko'], [.5, 'taiko'], [.75, 'taiko'], [1, 'taiko'], [1.25, 'taiko'], [1.5, 'taiko'], [.3, 'creak'], [1.6, 'boom'],
      [2.2, 'firework_launch'], [3, 'firework_burst'], [4, 'lion_drum'], [4.6, 'firework_burst'], [6, 'firework_launch'], [7, 'firework_burst'], [8.2, 'applause']],
  },
  7: {
    amb: [[0, ['amb_hall']], [.8, ['amb_rain', 'amb_wind']]],
    cues: [[.8, 'thunder'], [.9, 'crack'], [1, 'debris'], [1.4, 'drip'], [2.3, 'thunder'], [3.6, 'debris'], [4.7, 'splash'], [6, 'dragon_wings'], [6.4, 'dragon_roar'], [9, 'splash']],
  },
  8: { amb: [[0, ['amb_ink']]], cues: [[0, 'time_stop'], [.6, 'ink'], [2.2, 'whoosh'], [3.2, 'fog'], [5, 'drip']] },
  9: { amb: [[0, ['amb_buddha']]], cues: [[.3, 'gong'], [.3, 'radiance'], [1.5, 'chime'], [2.8, 'bell'], [3.5, 'wind_gust']] },
  10: {
    amb: [[0, ['amb_wind']], [5.6, ['amb_sky']]],
    cues: [[0, 'collapse'], [.1, 'scream'], [.6, 'scream'], [1.4, 'debris'], [2, 'dragon_roar'], [2.3, 'dragon_wings'], [3.6, 'debris'], [4.4, 'dragon_roar', { gain: .7 }], [5.6, 'wind_gust']],
  },
  11: {
    amb: [[0, ['amb_sky']], [3.6, ['amb_realm']]],
    cues: [[0, 'chime'], [.2, 'whoosh'], [.5, 'wind_gust'], [1.5, 'petal'], [2.4, 'chime', { gain: .8 }], [3.6, 'radiance']],
  },
  12: {
    amb: [[0, ['amb_wind']], [3.2, ['amb_realm']]],
    cues: [[0, 'bell'], [.1, 'uproot'], [.2, 'petal'], [1, 'wind_gust'], [1.6, 'petal'], [2.2, 'bow'], [3.2, 'radiance'], [3.4, 'chime']],
  },
};
