// 12 cấp của game. Cấp 1 chỉ dành cho bình luận; từ cấp 2 là quà, tính theo tổng kim cương của một lần tặng.
// Dùng được trong trình duyệt (biến toàn cục) và trong Node để kiểm thử.
const LEVELS = [
  { name: 'Khách thập phương', min: 0 },
  { name: 'Tín chủ', min: 1 },
  { name: 'Thiện tín', min: 2 },
  { name: 'Cư sĩ', min: 5 },
  { name: 'Thiện nhân', min: 10 },
  { name: 'Đàn việt', min: 20 },
  { name: 'Hộ pháp', min: 50 },
  { name: 'Trưởng giả', min: 100 },
  { name: 'Hiền giả', min: 200 },
  { name: 'Phật quang', min: 500 },
  { name: 'Thiên tiên', min: 1000 },
  { name: 'Thần tiên giáng trần', min: 3000 },
];

// Quà luôn từ cấp 2 trở lên, kể cả khi số kim cương không đọc được
function levelOfDiamonds(diamonds) {
  for (let i = LEVELS.length - 1; i > 1; i--) if (diamonds >= LEVELS[i].min) return i + 1;
  return 2;
}

// Bảng xếp hạng người tặng nhiều kim cương nhất trong phiên live (chỉ nằm trong bộ nhớ của trang)
function makeBoard() {
  const byUser = new Map(); // khoá người dùng → { name, diamonds }
  return {
    add(key, name, diamonds) {
      if (!Number.isSafeInteger(diamonds) || diamonds <= 0) return false;
      const e = byUser.get(key) || { name, diamonds: 0 };
      e.name = name; e.diamonds += diamonds;
      byUser.set(key, e);
      return true;
    },
    top(n = 5) { return [...byUser.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, n); },
  };
}

if (typeof module !== 'undefined') module.exports = { LEVELS, levelOfDiamonds, makeBoard };
