const util = require('../../utils/util.js');
const smart = require('../../utils/smart.js');
const ach = require('../../utils/achievements.js');
const news = require('../../utils/news.js');

Page({
  data: {
    input: '',
    focusInput: false,
    predictText: '--',
    measureSub: '体重不动时，围度告诉你脂肪在减',
    pairs: [],
    list: [],
    chart: [],
    settings: { height: 168, startWeight: 100, targetWeight: 65, weeklyGoal: 0.75 },
    latest: null,
    bmi: null,
    bmiText: '--',
    lost: '0.0',
    remain: '0.0',
    pct: 0,
    months: '--',
    total: '0.0'
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const settings = wx.getStorageSync('settings') || { height: 168, startWeight: 100, targetWeight: 65, weeklyGoal: 0.75 };
    const weights = wx.getStorageSync('weights') || { list: [] };
    const height = Number(settings.height) || 168;
    const start = Number(settings.startWeight) || 100;
    const target = Number(settings.targetWeight) || 65;
    const wg = Number(settings.weeklyGoal) || 0.75;

    const raw = (weights.list || []).slice();
    let prev = null;
    const list = raw.map(function (x) {
      const bmi = +(x.weight / Math.pow(height / 100, 2)).toFixed(1);
      const delta = prev == null ? null : +(x.weight - prev).toFixed(1);
      prev = x.weight;
      return { date: x.date, label: util.fmtMD(x.date), weight: x.weight, bmi: bmi, delta: delta };
    });

    const latest = list.length ? list[list.length - 1] : null;
    const lost = latest ? Math.max(0, start - latest.weight) : 0;
    const remain = latest ? Math.max(0, latest.weight - target) : Math.max(0, start - target);
    const total = Math.max(0.1, start - target);
    const pct = Math.min(100, Math.round((lost / total) * 100));
    const months = latest ? Math.max(1, Math.ceil(remain / (wg * 4.3))) : '--';

    const chart = list.slice(-14).map(function (r) {
      const ratio = (r.weight - target) / (start - target);
      const h = Math.max(8, Math.min(100, Math.round(ratio * 100)));
      return { label: r.label, h: h, value: r.weight, down: r.delta != null && r.delta <= 0 };
    });

    // 体重·腰围对比（最近8次体重日期，匹配7天内最近的腰围）
    const measures = (wx.getStorageSync('measures') || { list: [] }).list || [];
    const pairs = list.slice(-8).map(function (r) {
      const wH = Math.max(8, Math.min(100, Math.round(((r.weight - target) / (start - target)) * 100)));
      const rd = new Date(r.date).getTime();
      let mVal = null;
      let best = null;
      measures.forEach(function (m) {
        const diff = Math.abs(new Date(m.date).getTime() - rd);
        if (diff <= 7 * 86400000 && (best === null || diff < best)) {
          best = diff;
          mVal = m.waist != null ? m.waist : null;
        }
      });
      const mH = mVal != null ? Math.max(8, Math.min(100, Math.round((mVal / 130) * 100))) : 0;
      return { label: r.label, wH: wH, wVal: r.weight, mH: mH, mVal: mVal };
    });

    let bmiText = '--';
    if (latest) {
      const b = latest.bmi;
      if (b < 18.5) bmiText = '偏瘦';
      else if (b < 24) bmiText = '正常';
      else if (b < 28) bmiText = '超重';
      else bmiText = '肥胖';
    }

    this.setData({
      settings: settings,
      list: list.slice().reverse().slice(0, 15),
      chart: chart,
      latest: latest,
      bmi: latest ? latest.bmi : null,
      bmiText: bmiText,
      lost: lost.toFixed(1),
      remain: remain.toFixed(1),
      pct: pct,
      months: months,
      total: total.toFixed(1),
      predictText: smart.predictText(),
      measureSub: this.measureSummary(),
      pairs: pairs
    });
  },

  measureSummary() {
    const measures = wx.getStorageSync('measures') || { list: [] };
    const ml = measures.list || [];
    if (!ml.length || !ml[ml.length - 1].waist) return '体重不动时，围度告诉你脂肪在减';
    const latest = ml[ml.length - 1];
    const first = ml[0];
    const d = +(latest.waist - first.waist).toFixed(1);
    const sign = d <= 0 ? '−' : '+';
    return '最新腰围 ' + latest.waist + ' cm · 较首次 ' + sign + Math.abs(d).toFixed(1) + ' cm';
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  save() {
    const w = parseFloat(this.data.input);
    if (isNaN(w) || w < 30 || w > 300) {
      wx.showToast({ title: '请输入有效体重(kg)', icon: 'none' });
      return;
    }
    const weights = wx.getStorageSync('weights') || { list: [] };
    const list = (weights.list || []).slice();
    const today = util.dateKey();
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].date === today) { idx = i; break; }
    }
    const rec = { date: today, weight: +w.toFixed(1) };
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    wx.setStorageSync('weights', { list: list });
    this.setData({ input: '', focusInput: false });
    this.refresh();
    const fb = smart.weightFeedback();
    news.add('⚖️', '记录体重 ' + rec.weight + ' kg', fb.title + (fb.text ? '\n' + fb.text : ''));
    if (fb.title) {
      wx.showModal({
        title: fb.title,
        content: fb.text,
        showCancel: false,
        confirmText: '好的'
      });
    }
    const fresh = ach.checkNew();
    if (fresh.length) {
      setTimeout(function () {
        wx.showModal({
          title: '🏅 解锁新成就',
          content: fresh.map(function (b) { return b.icon + ' ' + b.name; }).join('\n'),
          showCancel: false,
          confirmText: '太棒了'
        });
      }, 700);
    } else if (fb.milestone) {
      setTimeout(function () {
        wx.showModal({
          title: '🎉 里程碑突破！',
          content: '体重突破 ' + fb.milestone + ' kg 大关，离目标又近了一步！',
          showCancel: false,
          confirmText: '开心！'
        });
      }, 800);
    }
  },

  focusFirst() {
    this.setData({ focusInput: true });
  },

  goMeasure() {
    wx.navigateTo({ url: '/pages/measure/measure' });
  },

  clearAll() {
    const that = this;
    wx.showModal({
      title: '清空所有体重记录？',
      content: '每日打卡数据不会被删除，只清空体重历史。',
      confirmText: '清空',
      confirmColor: '#ef4444',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('weights');
          that.refresh();
        }
      }
    });
  },

  onShareAppMessage() {
    return { title: '和我一起打卡减肥！', path: '/pages/weight/weight' };
  }
});
