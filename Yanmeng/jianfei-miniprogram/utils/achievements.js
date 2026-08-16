// 成就勋章系统：本地计算解锁状态
const util = require('./util.js');

const BADGES = [
  { id: 'first_day', icon: '🎯', name: '首日打卡', desc: '完成第一次每日打卡' },
  { id: 'streak_3', icon: '🔥', name: '连续3天', desc: '连续打卡 3 天' },
  { id: 'streak_7', icon: '🔥', name: '连续7天', desc: '连续打卡 7 天' },
  { id: 'streak_21', icon: '⚡', name: '连续21天', desc: '连续打卡 21 天，习惯已养成' },
  { id: 'checkin_30', icon: '📅', name: '打卡30天', desc: '累计打卡 30 天' },
  { id: 'weigh_4', icon: '⚖️', name: '称重4周', desc: '记录满 4 周体重' },
  { id: 'weight_5', icon: '📉', name: '减重5kg', desc: '累计减重 5 kg' },
  { id: 'weight_10', icon: '📉', name: '减重10kg', desc: '累计减重 10 kg' },
  { id: 'weight_20', icon: '🏆', name: '减重20kg', desc: '累计减重 20 kg' },
  { id: 'bmi_30', icon: '🚪', name: '告别肥胖', desc: 'BMI 降到 30 以下' },
  { id: 'cal_days_7', icon: '🔥', name: '记录7天热量', desc: '累计 7 天记录食物热量' },
  { id: 'cal_ok_7', icon: '✅', name: '热量达标7天', desc: '累计 7 天热量不超标' },
  { id: 'water_7', icon: '💧', name: '喝水7天', desc: '累计 7 天喝够 2L 水' },
  { id: 'step_7', icon: '🚶', name: '万步7天', desc: '累计 7 天走够 8000 步' },
  { id: 'ex_600', icon: '🏃', name: '运动600分钟', desc: '累计运动 600 分钟' },
  { id: 'ex_3000', icon: '💪', name: '运动3000分钟', desc: '累计运动 3000 分钟' },
  { id: 'budget_30', icon: '💰', name: '预算达人', desc: '累计 30 天花费不超预算' },
  { id: 'food_100', icon: '🍱', name: '记录100餐', desc: '累计记录 100 次食物' },
  { id: 'target', icon: '👑', name: '达成目标', desc: '达到目标体重' }
];

function getStreak(dailies) {
  let streak = 0;
  const t = new Date();
  const today = util.dateKey();
  if (!(dailies[today] || {}).checked) t.setDate(t.getDate() - 1);
  for (;;) {
    const k = util.dateKey(t);
    if ((dailies[k] || {}).checked) {
      streak++;
      t.setDate(t.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function compute() {
  const settings = wx.getStorageSync('settings') || {};
  const dailies = wx.getStorageSync('dailies') || {};
  const weights = wx.getStorageSync('weights') || { list: [] };
  const wl = weights.list || [];
  const keys = Object.keys(dailies).sort();
  const start = Number(settings.startWeight) || 100;
  const target = Number(settings.targetWeight) || 65;
  const height = Number(settings.height) || 168;
  const calGoal = Number(settings.dailyCalorie) || 1500;
  const budget = Number(settings.dailyBudget) || 42;

  let checkedDays = 0, calDays = 0, calOkDays = 0, waterDays = 0, stepDays = 0, budgetOkDays = 0, foodCount = 0, exTotal = 0;
  keys.forEach(function (k) {
    const d = dailies[k] || {};
    if (d.checked) checkedDays++;
    const foods = d.foods || [];
    let cal = 0;
    foods.forEach(function (f) { cal += f.kcal || 0; });
    foodCount += foods.length;
    if (cal > 0) {
      calDays++;
      if (cal <= calGoal) calOkDays++;
    }
    if ((d.water || 0) >= 2000) waterDays++;
    if ((d.steps || 0) >= 8000) stepDays++;
    const spend = Number(d.spend) || 0;
    if (spend > 0 && spend <= budget) budgetOkDays++;
    exTotal += Number(d.exMin) || 0;
  });

  const current = wl.length ? wl[wl.length - 1].weight : null;
  const bmi = current != null ? +(current / Math.pow(height / 100, 2)).toFixed(1) : null;
  const lost = current != null ? Math.max(0, start - current) : 0;
  const reachedTarget = current != null && current <= target;

  const weekSet = {};
  wl.forEach(function (x) {
    weekSet[util.dateKey(util.mondayOf(new Date(x.date)))] = true;
  });

  const ctx = {
    checkedDays: checkedDays,
    streak: getStreak(dailies),
    weighWeeks: Object.keys(weekSet).length,
    lost: lost,
    bmi: bmi,
    calDays: calDays,
    calOkDays: calOkDays,
    waterDays: waterDays,
    stepDays: stepDays,
    exTotal: exTotal,
    budgetOkDays: budgetOkDays,
    foodCount: foodCount,
    reachedTarget: reachedTarget
  };

  const unlocked = [];
  const locked = [];
  BADGES.forEach(function (b) {
    if (isUnlocked(b, ctx)) unlocked.push({ id: b.id, icon: b.icon, name: b.name, desc: b.desc });
    else locked.push({ id: b.id, icon: b.icon, name: b.name, desc: b.desc });
  });

  return { unlocked: unlocked, locked: locked, total: BADGES.length, ctx: ctx };
}

function isUnlocked(b, ctx) {
  const map = {
    first_day: ctx.checkedDays >= 1,
    streak_3: ctx.streak >= 3,
    streak_7: ctx.streak >= 7,
    streak_21: ctx.streak >= 21,
    checkin_30: ctx.checkedDays >= 30,
    weigh_4: ctx.weighWeeks >= 4,
    weight_5: ctx.lost >= 5,
    weight_10: ctx.lost >= 10,
    weight_20: ctx.lost >= 20,
    bmi_30: ctx.bmi != null && ctx.bmi < 30,
    cal_days_7: ctx.calDays >= 7,
    cal_ok_7: ctx.calOkDays >= 7,
    water_7: ctx.waterDays >= 7,
    step_7: ctx.stepDays >= 7,
    ex_600: ctx.exTotal >= 600,
    ex_3000: ctx.exTotal >= 3000,
    budget_30: ctx.budgetOkDays >= 30,
    food_100: ctx.foodCount >= 100,
    target: ctx.reachedTarget
  };
  return !!map[b.id];
}

// 与上次快照对比，返回新解锁的勋章并记录（用于弹窗庆祝）
function checkNew() {
  const res = compute();
  const seen = wx.getStorageSync('badgesSeen') || {};
  const fresh = res.unlocked.filter(function (b) { return !seen[b.id]; });
  if (fresh.length) {
    fresh.forEach(function (b) { seen[b.id] = true; });
    wx.setStorageSync('badgesSeen', seen);
  }
  return fresh;
}

module.exports = {
  BADGES: BADGES,
  compute: compute,
  checkNew: checkNew
};
