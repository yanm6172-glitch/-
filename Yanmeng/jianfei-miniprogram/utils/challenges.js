// 7 天减脂挑战赛：全部基于现有打卡数据自动判定，无需手动打卡
const util = require('./util.js');

function dayCal(d) {
  const foods = d.foods || [];
  return Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
}

function hasFood(d, kw) {
  return (d.foods || []).some(function (f) { return (f.name || '').indexOf(kw) >= 0; });
}

const CHALLENGES = [
  {
    id: 'c1', icon: '🧋', name: '7天无奶茶', desc: '一周不碰奶茶、古茗、霸王茶姬',
    pass: function (d) { return !hasFood(d, '奶茶') && !hasFood(d, '古茗') && !hasFood(d, '霸王茶姬'); }
  },
  {
    id: 'c2', icon: '🚶', name: '7天八千步', desc: '每天走满 8000 步',
    pass: function (d) { return (d.steps || 0) >= 8000; }
  },
  {
    id: 'c3', icon: '💧', name: '7天喝水2L', desc: '每天喝够 2000ml 水',
    pass: function (d) { return (d.water || 0) >= 2000; }
  },
  {
    id: 'c4', icon: '🌙', name: '7天不吃夜宵', desc: '晚上 9 点后不吃任何东西',
    pass: function (d) { return !(d.foods || []).some(function (f) { return (f.time || '') >= '21:00'; }); }
  },
  {
    id: 'c5', icon: '🎯', name: '7天打卡全勤', desc: '每天完成打卡评分',
    pass: function (d) { return !!d.checked; }
  },
  {
    id: 'c6', icon: '🔥', name: '7天热量达标', desc: '每天记录热量且不超标',
    pass: function (d, ctx) { const c = dayCal(d); return c > 0 && c <= ctx.goal; }
  }
];

function getActive() {
  return wx.getStorageSync('challenge') || null;
}

function start(id) {
  wx.setStorageSync('challenge', { id: id, start: util.dateKey() });
}

function quit() {
  wx.removeStorageSync('challenge');
}

// 计算当前挑战状态：每天 pass/fail/pending/future
function status() {
  const a = getActive();
  if (!a) return null;
  const ch = CHALLENGES.filter(function (c) { return c.id === a.id; })[0];
  if (!ch) return null;
  const settings = wx.getStorageSync('settings') || {};
  const goal = Number(settings.dailyCalorie) || 1500;
  const dailies = wx.getStorageSync('dailies') || {};
  const startDate = new Date(a.start);
  const todayKey = util.dateKey();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = util.dateKey(d);
    if (key > todayKey) {
      days.push({ key: key, state: 'future' });
      continue;
    }
    const dd = dailies[key] || {};
    if (key === todayKey) {
      // 今天：有相关数据才判定，否则进行中
      const hasAny = dayCal(dd) > 0 || (dd.water || 0) > 0 || (dd.steps || 0) > 0 || !!dd.checked;
      days.push({ key: key, state: hasAny ? (ch.pass(dd, { goal: goal }) ? 'pass' : 'fail') : 'pending' });
    } else {
      days.push({ key: key, state: ch.pass(dd, { goal: goal }) ? 'pass' : 'fail' });
    }
  }
  const passDays = days.filter(function (x) { return x.state === 'pass'; }).length;
  const failDays = days.filter(function (x) { return x.state === 'fail'; }).length;
  const pastDays = days.filter(function (x) { return x.state === 'pass' || x.state === 'fail'; }).length;
  let result = 'ongoing';
  if (pastDays === 7) result = failDays === 0 ? 'success' : 'failed';
  return {
    challenge: ch,
    start: a.start,
    days: days,
    passDays: passDays,
    failDays: failDays,
    doneDays: pastDays,
    result: result
  };
}

module.exports = {
  CHALLENGES: CHALLENGES,
  getActive: getActive,
  start: start,
  quit: quit,
  status: status
};
