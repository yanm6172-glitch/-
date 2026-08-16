// 本地测试：用 wx API 模拟器运行核心业务逻辑（utils 模块）
// 运行：node run_tests.js
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.MP_SRC || path.join(ROOT, 'jianfei-miniprogram');

// ---------- wx 模拟 ----------
const store = {};
const wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  cloud: { database: () => ({ collection: () => ({ doc: () => ({ set: () => Promise.resolve(), get: () => Promise.reject(new Error('no doc')) }) }) }) },
  showModal: () => {},
  showToast: () => {},
  requestSubscribeMessage: () => {},
  callFunction: () => Promise.reject(new Error('cloud not mocked')),
  setNavigationBarTitle: () => {}
};
global.wx = wx;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' => ' + JSON.stringify(a)); }

// 种子数据：模拟 12 天使用（以真实"今天"为基准）
function seed() {
  const dailies = {};
  const day = (n) => {
    const d = new Date(); // 真实今天
    d.setDate(d.getDate() - n);
    const p = (x) => (x < 10 ? '0' : '') + x;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  for (let i = 0; i < 12; i++) {
    const k = day(i);
    const foods = [];
    if (i !== 3 && i !== 8) {
      foods.push({ name: '米饭(熟)', kcal100: 116, grams: 150, kcal: 174 });
      foods.push({ name: '鸡胸肉', kcal100: 133, grams: 100, kcal: 133 });
      foods.push({ name: '苹果', kcal100: 53, grams: 200, kcal: 106 });
      if (i === 1) foods.push({ name: '螺蛳粉', kcal100: 160, grams: 350, kcal: 560 });
    }
    const cal = foods.reduce((s, f) => s + f.kcal, 0);
    dailies[k] = {
      water: 2000, steps: 9200, veg: 2, protein: 2, staple: 1,
      exMin: i % 2 === 0 ? 30 : 45,
      foods: foods,
      spend: 35,
      checked: i < 10, // 最近10天打卡 → 连续10天
      score: 83
    };
  }
  store.dailies = dailies;
  store.weights = {
    list: [
      { date: day(30), weight: 100 },
      { date: day(23), weight: 99.4 },
      { date: day(16), weight: 99.0 },
      { date: day(9), weight: 98.6 },
      { date: day(2), weight: 98.2 }
    ]
  };
  store.settings = { height: 168, startWeight: 105, targetWeight: 65, weeklyGoal: 0.75, dailyBudget: 42, dailyCalorie: 1500, startDate: day(30) };
  store.favfoods = [{ name: '米饭(熟)', kcal100: 116 }];
}

// ---------- util ----------
console.log('== utils/util.js ==');
seed();
const util = require(path.join(SRC, 'utils', 'util.js'));
eq(util.dateKey(new Date(2026, 7, 17)), '2026-08-17', 'dateKey');
eq(util.fmtMD('2026-08-17'), '8/17', 'fmtMD');
eq(util.weekdayCN(new Date(2026, 7, 17)), 0, 'weekdayCN 周一=0');
eq(util.weekdayCN(new Date(2026, 7, 16)), 6, 'weekdayCN 周日=6');
eq(util.monthInfo(2026, 8), { days: 31, firstWeekday: 5 }, 'monthInfo 2026-08');
eq(util.dateKey(util.mondayOf(new Date(2026, 7, 18))), '2026-08-17', 'mondayOf');

// ---------- smart ----------
console.log('== utils/smart.js ==');
const smart = require(path.join(SRC, 'utils', 'smart.js'));
eq(smart.getStreak(store.dailies), 10, 'getStreak=10');
ok(smart.dailyAdvice().length >= 1, 'dailyAdvice 非空');
ok(smart.weekSummary().length >= 3, 'weekSummary 至少3条');
const fb = smart.weightFeedback();
ok(!!fb.title && fb.text.length > 0, 'weightFeedback 有标题和内容');
ok(smart.predictText().length > 5, 'predictText 有内容');
const warns = smart.foodWarn({ name: '螺蛳粉', kcal100: 160 });
ok(warns.length >= 1 && warns.some(w => w.indexOf('螺蛳粉') >= 0), 'foodWarn 螺蛳粉次数提醒');

// ---------- achievements ----------
console.log('== utils/achievements.js ==');
const ach = require(path.join(SRC, 'utils', 'achievements.js'));
const r = ach.compute();
const ids = r.unlocked.map(b => b.id);
['first_day', 'streak_3', 'streak_7', 'weigh_4', 'cal_days_7', 'water_7', 'step_7', 'weight_5'].forEach(id => {
  ok(ids.indexOf(id) >= 0, '勋章应解锁: ' + id);
});
ok(r.unlocked.length + r.locked.length === r.total && r.total === 19, '勋章总数=19');
const fresh = ach.checkNew();
ok(fresh.length === r.unlocked.length, 'checkNew 首次全部为新解锁');
eq(ach.checkNew().length, 0, 'checkNew 第二次无新解锁');

// ---------- news ----------
console.log('== utils/news.js ==');
const news = require(path.join(SRC, 'utils', 'news.js'));
news.clearAll();
news.add('✅', '测试', '内容');
ok(news.get().length === 1, 'news.add');
ok(news.unread() === 1, 'news.unread=1');
news.markAllRead();
ok(news.unread() === 0, 'markAllRead 后 unread=0');
news.clearAll();
ok(news.get().length === 0, 'news.clearAll');

// ---------- auth（本地部分） ----------
console.log('== utils/auth.js ==');
const auth = require(path.join(SRC, 'utils', 'auth.js'));
delete store.user; delete store.guestMode;
ok(!auth.isLoggedIn() && !auth.isGuest(), '初始未登录');
auth.setUser({ openid: 'o123', nickname: '颜萌', avatar: '' });
ok(auth.isLoggedIn(), 'setUser 后已登录');
auth.saveProfile('新昵称', '');
eq(auth.getUser().nickname, '新昵称', 'saveProfile 更新昵称');
eq(store.settings.nickname, '新昵称', 'saveProfile 同步 settings.nickname');
auth.logout();
ok(!auth.isLoggedIn() && !auth.isGuest(), 'logout 后未登录');

// ---------- remind ----------
console.log('== utils/remind.js ==');
const remind = require(path.join(SRC, 'utils', 'remind.js'));
const rs0 = remind.getSet();
ok(rs0.waterTime === '15:00' && rs0.weighDay === 1, 'remindSet 默认值');
remind.saveSet({ waterOn: true, waterTime: '16:30', weighOn: false, weighTime: '08:00', weighDay: 3 });
eq(remind.getSet().waterTime, '16:30', 'remindSet 保存/读取');

// ---------- sync（云端已配置） ----------
console.log('== utils/sync.js ==');
const config = require(path.join(SRC, 'utils', 'config.js'));
ok(config.cloudEnv === 'wxc641774f15ae0cd9', 'config 云环境已配置');
const sync = require(path.join(SRC, 'utils', 'sync.js'));
ok(sync.enabled() === true, 'sync.enabled=true（环境已配置）');

// ---------- 食物库 ----------
console.log('== data/foods-cn.js ==');
const FOODS = require(path.join(SRC, 'data', 'foods-cn.js'));
ok(FOODS.length >= 150, '食物库 >=150 种');
let bad = 0;
const names = {};
FOODS.forEach(f => {
  if (!f.n || typeof f.c !== 'number' || !f.g) bad++;
  if (names[f.n]) bad++;
  names[f.n] = true;
});
ok(bad === 0, '食物库字段完整且名称唯一');

console.log('');
console.log('========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
