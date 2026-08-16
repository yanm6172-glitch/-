const util = require('../../utils/util.js');
const smart = require('../../utils/smart.js');
const exporter = require('../../utils/export.js');

Page({
  data: {
    tips: [],
    weekOffset: 0,
    weekLabel: '本周',
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    bars: [],
    stats: {
      logDays: 0,
      avgCal: '--',
      overDays: 0,
      avgSpend: '--',
      exTotal: 0,
      avgSteps: '--',
      weightDelta: '--',
      checkDays: 0,
      avgScore: '--'
    },
    goal: 1500,
    budget: 42,
    // 日历
    calYear: 0,
    calMonth: 0,
    calTitle: '',
    calCells: [],
    calStats: { count: 0, avg: '--' }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.buildWeek();
    this.buildCalendar();
    this.setData({ tips: smart.weekSummary() });
  },

  dayCal(d) {
    const foods = d.foods || [];
    return Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
  },

  dayHasData(d) {
    return this.dayCal(d) > 0 || (d.water || 0) > 0 || (d.steps || 0) > 0 || (d.spend || 0) > 0 || (d.exMin || 0) > 0;
  },

  buildWeek() {
    const settings = wx.getStorageSync('settings') || {};
    const goal = Number(settings.dailyCalorie) || 1500;
    const budget = Number(settings.dailyBudget) || 42;
    const dailies = wx.getStorageSync('dailies') || {};
    const weights = wx.getStorageSync('weights') || { list: [] };
    const offset = this.data.weekOffset;

    const base = util.mondayOf(new Date());
    base.setDate(base.getDate() + offset);
    const keys = [];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      keys.push(util.dateKey(d));
      days.push(dailies[util.dateKey(d)] || {});
    }

    let sumCal = 0, logDays = 0, overDays = 0;
    let sumSpend = 0, spendDays = 0, exTotal = 0;
    let sumSteps = 0, stepDays = 0, sumScore = 0, checkDays = 0;
    const bars = [];
    for (let i = 0; i < 7; i++) {
      const d = days[i];
      const cal = this.dayCal(d);
      const spend = Number(d.spend) || 0;
      const steps = Number(d.steps) || 0;
      const exMin = Number(d.exMin) || 0;
      if (cal > 0) {
        sumCal += cal;
        logDays++;
        if (cal > goal) overDays++;
      }
      if (spend > 0) {
        sumSpend += spend;
        spendDays++;
      }
      exTotal += exMin;
      if (steps > 0) {
        sumSteps += steps;
        stepDays++;
      }
      if (d.checked) {
        sumScore += (d.score || 0);
        checkDays++;
      }
      const h = cal > 0 ? Math.max(6, Math.min(100, Math.round((cal / (goal * 1.5)) * 100))) : 6;
      bars.push({
        label: this.data.weekDays[i],
        date: keys[i].slice(5),
        kcal: cal,
        h: h,
        state: cal === 0 ? 'empty' : (cal > goal ? 'over' : 'ok')
      });
    }

    let weightDelta = '--';
    const wl = (weights.list || []).filter(function (x) { return x.date >= keys[0] && x.date <= keys[6]; });
    if (wl.length >= 2) {
      const d = +(wl[wl.length - 1].weight - wl[0].weight).toFixed(1);
      weightDelta = (d > 0 ? '+' : '') + d;
    } else if (wl.length === 1) {
      weightDelta = '仅1次';
    }

    this.setData({
      goal: goal,
      budget: budget,
      weekLabel: offset === 0 ? '本周' : '上周',
      bars: bars,
      stats: {
        logDays: logDays,
        avgCal: logDays ? Math.round(sumCal / logDays) : '--',
        overDays: overDays,
        avgSpend: spendDays ? (sumSpend / spendDays).toFixed(1) : '--',
        exTotal: exTotal,
        avgSteps: stepDays ? Math.round(sumSteps / stepDays) : '--',
        weightDelta: weightDelta,
        checkDays: checkDays,
        avgScore: checkDays ? Math.round(sumScore / checkDays) : '--'
      }
    });
  },

  buildCalendar() {
    const now = new Date();
    const year = this.data.calYear || now.getFullYear();
    const month = this.data.calMonth || (now.getMonth() + 1);
    const info = util.monthInfo(year, month);
    const dailies = wx.getStorageSync('dailies') || {};
    const todayKey = util.dateKey();
    const cells = [];
    for (let i = 0; i < info.firstWeekday; i++) cells.push({ blank: true, key: 'b' + i });
    let count = 0, sum = 0;
    for (let day = 1; day <= info.days; day++) {
      const key = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
      const d = dailies[key] || {};
      const checked = !!d.checked;
      if (checked) {
        count++;
        sum += (d.score || 0);
      }
      cells.push({
        day: day,
        key: key,
        checked: checked,
        score: d.score || 0,
        hasData: this.dayHasData(d),
        future: key > todayKey,
        today: key === todayKey
      });
    }
    while (cells.length % 7 !== 0) cells.push({ blank: true, key: 'b' + cells.length });
    this.setData({
      calYear: year,
      calMonth: month,
      calTitle: year + '年' + month + '月',
      calCells: cells,
      calStats: { count: count, avg: count ? Math.round(sum / count) : '--' }
    });
  },

  prevMonth() {
    let y = this.data.calYear, m = this.data.calMonth - 1;
    if (m < 1) { m = 12; y--; }
    this.setData({ calYear: y, calMonth: m });
    this.buildCalendar();
  },

  nextMonth() {
    let y = this.data.calYear, m = this.data.calMonth + 1;
    if (m > 12) { m = 1; y++; }
    this.setData({ calYear: y, calMonth: m });
    this.buildCalendar();
  },

  setWeek(e) {
    this.setData({ weekOffset: Number(e.currentTarget.dataset.offset) });
    this.buildWeek();
  },

  exportImage() {
    exporter.exportWeek(this);
  },

  goAchieve() {
    wx.navigateTo({ url: '/pages/achieve/achieve' });
  },

  goNews() {
    wx.navigateTo({ url: '/pages/news/news' });
  },

  tapDay(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const dailies = wx.getStorageSync('dailies') || {};
    const d = dailies[key] || {};
    if (!this.dayHasData(d) && !d.checked) {
      wx.showToast({ title: key + ' 暂无记录', icon: 'none' });
      return;
    }
    const lines = [
      '📅 ' + key,
      d.checked ? '✅ 已打卡 · 得分 ' + (d.score || 0) : '⭕ 未打卡',
      '🔥 热量 ' + this.dayCal(d) + ' / ' + this.data.goal + ' 千卡',
      '💰 花费 ' + (d.spend || 0) + ' / ' + this.data.budget + ' 元',
      '💧 饮水 ' + (d.water || 0) + ' ml',
      '🚶 步数 ' + (d.steps || 0),
      '🏃 运动 ' + (d.exMin || 0) + ' 分钟'
    ];
    wx.showModal({ title: '当日详情', content: lines.join('\n'), showCancel: false, confirmText: '好的' });
  },

  onShareAppMessage() {
    return { title: '我的减肥打卡周报和日历，来看看！', path: '/pages/report/report' };
  }
});
