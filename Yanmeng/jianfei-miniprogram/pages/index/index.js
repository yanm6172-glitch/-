const util = require('../../utils/util.js');
const remind = require('../../utils/remind.js');
const smart = require('../../utils/smart.js');
const auth = require('../../utils/auth.js');
const ach = require('../../utils/achievements.js');
const news = require('../../utils/news.js');

const DEFAULTS = {
  height: 168,
  startWeight: 100,
  targetWeight: 65,
  weeklyGoal: 0.75,
  dailyBudget: 42,
  dailyCalorie: 1500
};

Page({
  data: {
    today: '',
    settings: DEFAULTS,
    currentWeight: null,
    bmi: null,
    lost: '0.0',
    remain: '0.0',
    total: '0.0',
    pct: 0,
    streak: 0,
    tips: [],
    // 喝水
    water: 0,
    waterBlocks: [0, 1, 2, 3, 4, 5, 6, 7],
    // 步数
    steps: 0,
    stepsInput: '',
    stepGoal: 8000,
    // 211 饮食
    veg: 0,
    protein: 0,
    staple: 0,
    mealTypes: ['早餐', '午餐', '晚餐', '加餐'],
    mealTypeIdx: 0,
    mealText: '',
    meals: [],
    // 运动
    exMin: 0,
    exGoal: 30,
    exList: [],
    // 花费
    spend: 0,
    spendInput: '',
    budget: 42,
    remainBudget: 0,
    // 热量
    calTotal: 0,
    calGoal: 1500,
    calPct: 0,
    // 打卡
    checked: false,
    score: 0,
    missedText: '',
    // 喝水达标动画
    waterCelebrate: false,
    // AI 点评
    aiLoading: false,
    aiText: ''
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    // 登录守卫：未登录且非游客（如通过分享链接直接进入）→ 回登录页
    if (!auth.isLoggedIn() && !auth.isGuest()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadAll();
    remind.maybePrompt();
  },

  loadAll() {
    const settings = wx.getStorageSync('settings') || DEFAULTS;
    const dailies = wx.getStorageSync('dailies') || {};
    const weights = wx.getStorageSync('weights') || { list: [] };
    const today = util.dateKey();
    const d = dailies[today] || {};
    const list = weights.list || [];

    const currentWeight = list.length ? list[list.length - 1].weight : null;
    const height = Number(settings.height) || 168;
    const bmi = currentWeight != null ? +(currentWeight / Math.pow(height / 100, 2)).toFixed(1) : null;
    const start = Number(settings.startWeight) || 100;
    const target = Number(settings.targetWeight) || 65;
    const lost = currentWeight != null ? Math.max(0, start - currentWeight) : 0;
    const remain = currentWeight != null ? Math.max(0, currentWeight - target) : Math.max(0, start - target);
    const total = Math.max(0.1, start - target);
    const pct = Math.min(100, Math.round((lost / total) * 100));
    const budget = Number(settings.dailyBudget) || 42;
    const spend = Number(d.spend) || 0;
    const foods = d.foods || [];
    const calTotal = Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
    const calGoal = Number(settings.dailyCalorie) || 1500;
    const calPct = Math.min(100, Math.round((calTotal / calGoal) * 100));
    const aiReview = wx.getStorageSync('aiReview') || {};

    this.setData({
      today: today,
      settings: settings,
      currentWeight: currentWeight,
      bmi: bmi,
      lost: lost.toFixed(1),
      remain: remain.toFixed(1),
      total: total.toFixed(1),
      pct: pct,
      streak: smart.getStreak(dailies),
      tips: smart.dailyAdvice(),
      water: d.water || 0,
      steps: d.steps || 0,
      veg: d.veg || 0,
      protein: d.protein || 0,
      staple: d.staple || 0,
      meals: d.meals || [],
      exMin: d.exMin || 0,
      exList: d.exList || [],
      spend: spend,
      budget: budget,
      remainBudget: +(budget - spend).toFixed(2),
      calTotal: calTotal,
      calGoal: calGoal,
      calPct: calPct,
      checked: !!d.checked,
      score: d.score || 0,
      aiText: aiReview.date === today ? (aiReview.text || '') : ''
    });
  },

  saveDay(partial) {
    const dailies = wx.getStorageSync('dailies') || {};
    const cur = dailies[this.data.today] || {};
    dailies[this.data.today] = Object.assign({}, cur, partial);
    wx.setStorageSync('dailies', dailies);
  },

  /* ---- 喝水 ---- */
  celebrateWater() {
    const that = this;
    if (this.data.water >= 2000 && !this.data.waterCelebrate) {
      this.setData({ waterCelebrate: true });
      setTimeout(function () { that.setData({ waterCelebrate: false }); }, 2600);
    }
  },

  setWater(e) {
    const i = Number(e.currentTarget.dataset.i);
    const water = (i + 1) * 250;
    this.setData({ water: water });
    this.saveDay({ water: water });
    this.refreshTips();
    this.celebrateWater();
  },

  waterMinus() {
    const water = Math.max(0, this.data.water - 250);
    this.setData({ water: water });
    this.saveDay({ water: water });
    this.refreshTips();
    this.celebrateWater();
  },

  /* ---- 步数 ---- */
  onStepsInput(e) {
    this.setData({ stepsInput: e.detail.value });
  },

  commitSteps() {
    const v = parseInt(this.data.stepsInput, 10);
    const steps = isNaN(v) ? this.data.steps : Math.max(0, v);
    this.setData({ steps: steps, stepsInput: '' });
    this.saveDay({ steps: steps });
    this.refreshTips();
  },

  addSteps(e) {
    const v = Number(e.currentTarget.dataset.v);
    const steps = this.data.steps + v;
    this.setData({ steps: steps });
    this.saveDay({ steps: steps });
    this.refreshTips();
  },

  /* ---- 211 计数器 ---- */
  changeCounter(e) {
    const field = e.currentTarget.dataset.field;
    const delta = Number(e.currentTarget.dataset.delta);
    const val = Math.max(0, Math.min(9, this.data[field] + delta));
    const patch = {};
    patch[field] = val;
    this.setData(patch);
    this.saveDay(patch);
    this.refreshTips();
  },

  /* ---- 饮食记录 ---- */
  onMealType(e) {
    this.setData({ mealTypeIdx: Number(e.detail.value) });
  },

  onMealInput(e) {
    this.setData({ mealText: e.detail.value });
  },

  addMeal() {
    const text = (this.data.mealText || '').trim();
    if (!text) {
      wx.showToast({ title: '先写吃了什么', icon: 'none' });
      return;
    }
    const meals = this.data.meals.slice();
    meals.unshift({
      id: Date.now(),
      type: this.data.mealTypes[this.data.mealTypeIdx],
      text: text
    });
    this.setData({ meals: meals, mealText: '' });
    this.saveDay({ meals: meals });
  },

  delMeal(e) {
    const id = Number(e.currentTarget.dataset.id);
    const meals = this.data.meals.filter(function (m) { return m.id !== id; });
    this.setData({ meals: meals });
    this.saveDay({ meals: meals });
  },

  /* ---- 运动 ---- */
  addEx(e) {
    const type = e.currentTarget.dataset.type;
    const min = Number(e.currentTarget.dataset.min);
    const exList = this.data.exList.slice();
    exList.unshift({ id: Date.now(), type: type, min: min });
    const exMin = exList.reduce(function (s, x) { return s + x.min; }, 0);
    this.setData({ exList: exList, exMin: exMin });
    this.saveDay({ exMin: exMin, exList: exList });
    this.refreshTips();
  },

  delEx(e) {
    const id = Number(e.currentTarget.dataset.id);
    const exList = this.data.exList.filter(function (x) { return x.id !== id; });
    const exMin = exList.reduce(function (s, x) { return s + x.min; }, 0);
    this.setData({ exList: exList, exMin: exMin });
    this.saveDay({ exMin: exMin, exList: exList });
    this.refreshTips();
  },

  /* ---- 花费 ---- */
  onSpendInput(e) {
    this.setData({ spendInput: e.detail.value });
  },

  commitSpend() {
    const v = parseFloat(this.data.spendInput);
    const spend = isNaN(v) ? this.data.spend : Math.max(0, +v.toFixed(2));
    const remainBudget = +(this.data.budget - spend).toFixed(2);
    this.setData({ spend: spend, spendInput: '', remainBudget: remainBudget });
    this.saveDay({ spend: spend });
    this.refreshTips();
  },

  refreshTips() {
    this.setData({ tips: smart.dailyAdvice() });
  },

  /* ---- 完成打卡 ---- */
  missList(ok) {
    const names = ['喝水2L', '8000步', '211饮食', '运动30分钟', '花费不超预算', '热量不超标'];
    return names.filter(function (n, i) { return !ok[i]; });
  },

  doCheckin() {
    const d = this.data;
    const ok = [
      d.water >= 2000,
      d.steps >= d.stepGoal,
      d.veg >= 2 && d.protein >= 2,
      d.exMin >= d.exGoal,
      d.spend > 0 && d.spend <= d.budget,
      d.calTotal > 0 && d.calTotal <= d.calGoal
    ];
    const score = Math.round((ok.filter(Boolean).length / ok.length) * 100);
    const msgs = ['别灰心，明天再战！', '差一点就达标啦，继续加油！', '不错，坚持住！', '今天表现很棒！', '满分！太自律了！'];
    const idx = Math.min(4, Math.floor(score / 25));
    const missed = this.missList(ok);
    this.saveDay({ checked: true, score: score });
    this.setData({
      checked: true,
      score: score,
      missedText: missed.length ? '未达标：' + missed.join('、') : '全部达标 🎉',
      streak: smart.getStreak(wx.getStorageSync('dailies') || {})
    });
    wx.showModal({
      title: '今日得分 ' + score + ' 分',
      content: msgs[idx] + (missed.length ? '\n未达标：' + missed.join('、') : ''),
      showCancel: false,
      confirmText: '好的'
    });
    // 消息 + 成就
    news.add('✅', '完成今日打卡', '得分 ' + score + (missed.length ? ' · 未达标：' + missed.join('、') : ' · 全部达标'));
    const fresh = ach.checkNew();
    if (fresh.length) {
      const that = this;
      setTimeout(function () {
        wx.showModal({
          title: '🏅 解锁新成就',
          content: fresh.map(function (b) { return b.icon + ' ' + b.name; }).join('\n'),
          showCancel: false,
          confirmText: '太棒了'
        });
      }, 700);
    }
  },

  goWeight() {
    wx.switchTab({ url: '/pages/weight/weight' });
  },

  goCalorie() {
    wx.switchTab({ url: '/pages/calorie/calorie' });
  },

  goKnowledge() {
    wx.navigateTo({ url: '/pages/knowledge/knowledge' });
  },

  goMeasure() {
    wx.navigateTo({ url: '/pages/measure/measure' });
  },

  goChallenge() {
    wx.navigateTo({ url: '/pages/challenge/challenge' });
  },

  /* ---- AI 饮食点评 ---- */
  askAI() {
    const config = require('../../utils/config.js');
    if (!(config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud)) {
      wx.showModal({
        title: 'AI 点评需要云开发',
        content: '请先开通云开发并部署 ai 云函数（README 第 4 步）。',
        showCancel: false
      });
      return;
    }
    const dailies = wx.getStorageSync('dailies') || {};
    const d = dailies[this.data.today] || {};
    const foods = d.foods || [];
    if (!foods.length) {
      wx.showToast({ title: '先去「热量」页记录今天吃的', icon: 'none' });
      return;
    }
    if (this.data.aiLoading) return;
    this.setData({ aiLoading: true });
    const settings = wx.getStorageSync('settings') || {};
    const goal = Number(settings.dailyCalorie) || 1500;
    const lines = [
      '今日摄入热量：' + this.data.calTotal + ' / ' + goal + ' 千卡',
      '饮水：' + (d.water || 0) + 'ml',
      '步数：' + (d.steps || 0),
      '运动：' + (d.exMin || 0) + '分钟'
    ];
    foods.forEach(function (f) {
      lines.push('食物：' + f.name + ' ' + f.grams + 'g ' + f.kcal + '千卡');
    });
    if (this.data.currentWeight != null) {
      lines.push('当前体重：' + this.data.currentWeight + 'kg，目标 ' + (settings.targetWeight || 65) + 'kg');
    }
    const that = this;
    wx.cloud.callFunction({ name: 'ai', data: { text: lines.join('\n') } })
      .then(function (r) {
        that.setData({ aiLoading: false });
        const v = r.result || {};
        if (v.ok) {
          that.setData({ aiText: v.text });
          wx.setStorageSync('aiReview', { date: that.data.today, text: v.text });
          wx.showToast({ title: '点评完成', icon: 'success' });
        } else {
          wx.showModal({ title: '点评失败', content: (v.msg || '请稍后再试') + '。请确认 ai 云函数已部署。', showCancel: false });
        }
      })
      .catch(function () {
        that.setData({ aiLoading: false });
        wx.showModal({ title: '点评失败', content: 'ai 云函数未部署或网络异常，稍后再试。', showCancel: false });
      });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/me' });
  },

  onShareAppMessage() {
    return {
      title: '和我一起打卡减肥！',
      path: '/pages/index/index'
    };
  }
});
