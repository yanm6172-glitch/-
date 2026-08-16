// 智能分析工具：建议生成、周报点评、体重反馈、食物预警（全部本地计算）
const util = require('./util.js');

function dayCal(d) {
  const foods = d.foods || [];
  return Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
}

// 本周一为基础，offsetDays：0=本周，-7=上周
function weekKeys(offsetDays) {
  const base = util.mondayOf(new Date());
  base.setDate(base.getDate() + (offsetDays || 0));
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    keys.push(util.dateKey(d));
  }
  return keys;
}

// 连续打卡天数（今天没打卡则从昨天往回数）
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

// 今日动态建议（最多4条）
function dailyAdvice() {
  const settings = wx.getStorageSync('settings') || {};
  const dailies = wx.getStorageSync('dailies') || {};
  const d = dailies[util.dateKey()] || {};
  const goal = Number(settings.dailyCalorie) || 1500;
  const budget = Number(settings.dailyBudget) || 42;
  const cal = dayCal(d);
  const hour = new Date().getHours();
  const tips = [];
  if ((d.water || 0) < 2000) tips.push('还差 ' + (2000 - (d.water || 0)) + ' ml 水，饭前喝一杯');
  if ((d.steps || 0) < 8000) tips.push('步数 ' + (d.steps || 0) + '/8000，下班骑行或快走 30 分钟');
  if (cal === 0) tips.push('还没记热量，去「热量」页扫码记一下');
  else if (cal > goal) tips.push('热量已超 ' + (cal - goal) + ' 千卡，晚餐以蔬菜和蛋白质为主');
  else if (cal > goal * 0.75 && hour >= 16) tips.push('热量已用 ' + cal + '/' + goal + '，晚餐清淡点');
  else tips.push('热量 ' + cal + '/' + goal + '，节奏不错');
  if ((d.veg || 0) < 2 || (d.protein || 0) < 2) tips.push('蔬菜/蛋白质还没吃够 211，晚饭补上');
  const spend = Number(d.spend) || 0;
  if (spend > budget) tips.push('今天超预算 ' + (spend - budget).toFixed(1) + ' 元，明天扣回来');
  if (hour >= 21) tips.push('晚上 9 点后别吃夜宵，饿就喝水或吃个鸡蛋');
  return tips.slice(0, 4);
}

// 本周智能点评（对比上周）
function weekSummary() {
  const settings = wx.getStorageSync('settings') || {};
  const dailies = wx.getStorageSync('dailies') || {};
  const weights = wx.getStorageSync('weights') || { list: [] };
  const goal = Number(settings.dailyCalorie) || 1500;
  const budget = Number(settings.dailyBudget) || 42;

  function analyze(keys) {
    let days = 0, calSum = 0, overDays = 0, spendSum = 0, checkDays = 0, exSum = 0;
    keys.forEach(function (k) {
      const d = dailies[k] || {};
      const cal = dayCal(d);
      if (cal > 0) {
        days++;
        calSum += cal;
        if (cal > goal) overDays++;
      }
      const spend = Number(d.spend) || 0;
      if (spend > 0) spendSum += spend;
      if (d.checked) checkDays++;
      exSum += Number(d.exMin) || 0;
    });
    return { days: days, avgCal: days ? Math.round(calSum / days) : 0, overDays: overDays, spendSum: spendSum, checkDays: checkDays, exSum: exSum };
  }

  const cur = analyze(weekKeys(0));
  const prev = analyze(weekKeys(-7));
  const tips = [];
  if (cur.days === 0) {
    tips.push('本周还没记录热量，去「热量」页扫码或手动记一笔');
  } else {
    if (cur.avgCal <= goal) tips.push('日均热量 ' + cur.avgCal + ' 千卡，控制在目标内 👍');
    else tips.push('日均热量 ' + cur.avgCal + ' 千卡，超目标 ' + (cur.avgCal - goal) + ' 千卡，注意主食和零食');
    if (cur.overDays > 0) tips.push('有 ' + cur.overDays + ' 天热量超标');
    if (prev.days > 0) {
      const diff = cur.avgCal - prev.avgCal;
      if (diff < 0) tips.push('日均热量比上周减少 ' + (-diff) + ' 千卡 🎉');
      else if (diff > 0) tips.push('日均热量比上周增加 ' + diff + ' 千卡，警惕反弹');
    }
  }
  if (cur.spendSum > 0) {
    tips.push('本周花费 ' + cur.spendSum.toFixed(1) + ' 元' + (cur.spendSum > budget * 7 ? '，超周预算' : '，预算内'));
  }
  if (cur.exSum > 0) tips.push('本周运动 ' + cur.exSum + ' 分钟' + (cur.exSum >= 150 ? '，达标 ✅' : '，目标150分钟'));
  if (cur.checkDays >= 5) tips.push('打卡 ' + cur.checkDays + ' 天，非常自律！');
  else if (cur.days > 0) tips.push('只打卡 ' + cur.checkDays + ' 天，别断签哦');
  const keys = weekKeys(0);
  const wl = (weights.list || []).filter(function (x) { return x.date >= keys[0] && x.date <= keys[6]; });
  if (wl.length >= 2) {
    const delta = +(wl[wl.length - 1].weight - wl[0].weight).toFixed(1);
    if (delta < 0) tips.push('本周体重 -' + Math.abs(delta) + ' kg，方向正确');
    else if (delta === 0) tips.push('本周体重持平，平台期正常，继续坚持');
    else tips.push('本周体重 +' + delta + ' kg，注意最近饮食');
  }
  return tips;
}

// 体重记录后的智能反馈：节奏评价 + 达标预测 + 里程碑
function weightFeedback() {
  const settings = wx.getStorageSync('settings') || {};
  const weights = wx.getStorageSync('weights') || { list: [] };
  const list = weights.list || [];
  const target = Number(settings.targetWeight) || 65;
  const out = { title: '', text: '', milestone: null };
  if (!list.length) return out;
  const last = list[list.length - 1];
  if (list.length < 2) {
    out.title = '已记录 ' + last.weight + ' kg';
    out.text = '再坚持每周称一次，数据多了就能看趋势和预测啦';
    return out;
  }
  const prev = list[list.length - 2];
  const miles = [95, 90, 85, 80, 75, 70];
  for (let i = 0; i < miles.length; i++) {
    if (prev.weight >= miles[i] && last.weight < miles[i]) {
      out.milestone = miles[i];
      break;
    }
  }
  const now = Date.now();
  const month = list.filter(function (x) { return new Date(x.date).getTime() > now - 30 * 86400000; });
  let weeklyPace = null;
  if (month.length >= 2) {
    const days = (new Date(month[month.length - 1].date).getTime() - new Date(month[0].date).getTime()) / 86400000;
    if (days >= 3) weeklyPace = ((month[month.length - 1].weight - month[0].weight) / days) * 7;
  }
  const delta = +(last.weight - prev.weight).toFixed(1);
  if (delta > 0.5) out.title = '⚠️ 反弹 ' + delta + ' kg';
  else if (delta >= 0) out.title = '📊 持平（' + (delta > 0 ? '+' + delta : '0') + ' kg）';
  else out.title = '🎉 减了 ' + Math.abs(delta) + ' kg';
  const texts = [];
  if (weeklyPace != null) {
    const ap = Math.abs(weeklyPace);
    if (weeklyPace < -1.2) texts.push('近30天每周约减 ' + ap.toFixed(1) + ' kg，速度偏快，蛋白质要吃够');
    else if (weeklyPace < -0.4) texts.push('近30天每周约减 ' + ap.toFixed(1) + ' kg，节奏健康，保持！');
    else if (weeklyPace > 0.1) texts.push('近30天趋势在涨，最近是不是零食和奶茶多了？');
    else texts.push('近30天几乎没变化，试试晚餐主食减半 + 骑行通勤');
    if (weeklyPace < -0.1 && last.weight > target) {
      const weeks = (last.weight - target) / ap;
      const d = new Date(Date.now() + weeks * 7 * 86400000);
      texts.push('按当前节奏，预计 ' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月可达标 ' + target + ' kg');
    }
  } else {
    texts.push('再记几次体重，就能预测达标日期了');
  }
  out.text = texts.join('\n');
  return out;
}

// 体重页：达标预测文案
function predictText() {
  const settings = wx.getStorageSync('settings') || {};
  const weights = wx.getStorageSync('weights') || { list: [] };
  const list = weights.list || [];
  const target = Number(settings.targetWeight) || 65;
  if (list.length < 2) return '数据不足，再记一两次就能预测';
  const last = list[list.length - 1];
  const now = Date.now();
  const month = list.filter(function (x) { return new Date(x.date).getTime() > now - 30 * 86400000; });
  if (month.length < 2) return '近30天记录不足，继续每周称重';
  const days = (new Date(month[month.length - 1].date).getTime() - new Date(month[0].date).getTime()) / 86400000;
  if (days < 3) return '记录间隔太近，再等几天看趋势';
  const pace = ((month[month.length - 1].weight - month[0].weight) / days) * 7;
  if (pace >= -0.1) return '近30天体重没有下降趋势，先稳住饮食再谈预测';
  const weeks = (last.weight - target) / Math.abs(pace);
  const d = new Date(Date.now() + weeks * 7 * 86400000);
  return '按近30天节奏（每周约减 ' + Math.abs(pace).toFixed(1) + ' kg），预计 ' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月达标';
}

// 食物预警：高热量 + 本周次数限制（螺蛳粉/奶茶/汉堡/炸鸡）
function foodWarn(item) {
  const dailies = wx.getStorageSync('dailies') || {};
  const keys = weekKeys(0);
  const name = item.name || '';
  const warns = [];
  if ((item.kcal100 || 0) >= 300) warns.push('每100g 有 ' + item.kcal100 + ' 千卡，属于高热量，注意份量');
  const rules = [
    { kw: '螺蛳粉', limit: 2, unit: '次' },
    { kw: '奶茶', limit: 1, unit: '杯' },
    { kw: '汉堡', limit: 1, unit: '个' },
    { kw: '炸鸡', limit: 1, unit: '次' }
  ];
  rules.forEach(function (r) {
    if (name.indexOf(r.kw) < 0) return;
    let count = 0;
    keys.forEach(function (k) {
      const d = dailies[k] || {};
      (d.foods || []).forEach(function (f) {
        if ((f.name || '').indexOf(r.kw) >= 0) count++;
      });
    });
    if (count >= r.limit) warns.push(r.kw + '本周已 ' + count + '/' + r.limit + ' ' + r.unit + '，超限啦 ⚠️');
    else warns.push(r.kw + '本周已 ' + count + '/' + r.limit + ' ' + r.unit);
  });
  return warns;
}

module.exports = {
  dayCal: dayCal,
  getStreak: getStreak,
  dailyAdvice: dailyAdvice,
  weekSummary: weekSummary,
  weightFeedback: weightFeedback,
  predictText: predictText,
  foodWarn: foodWarn
};
