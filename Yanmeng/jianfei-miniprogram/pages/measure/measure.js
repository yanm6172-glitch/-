const util = require('../../utils/util.js');

Page({
  data: {
    // 表单
    waist: '', hip: '', chest: '', thigh: '', arm: '',
    // 数据
    list: [],
    chart: [],
    latest: null,
    whr: null,
    whrText: '',
    waistDelta: '--',
    tipText: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const measures = wx.getStorageSync('measures') || { list: [] };
    const list = (measures.list || []).slice();
    const latest = list.length ? list[list.length - 1] : null;
    let waistDelta = '--';
    if (list.length >= 2) {
      const d = +(list[list.length - 1].waist - list[list.length - 2].waist).toFixed(1);
      waistDelta = (d > 0 ? '+' : '') + d;
    }
    let whr = null;
    let whrText = '--';
    let tipText = '记录 2 次以上就能看到变化趋势';
    if (latest && latest.waist && latest.hip) {
      whr = +(latest.waist / latest.hip).toFixed(2);
      if (whr < 0.8) whrText = '腰臀比 ' + whr + ' · 良好';
      else if (whr < 0.9) whrText = '腰臀比 ' + whr + ' · 正常';
      else whrText = '腰臀比 ' + whr + ' · 偏高，内脏脂肪要留意';
      const first = list[0];
      if (latest.waist < first.waist) {
        tipText = '腰围比首次记录减少 ' + (first.waist - latest.waist).toFixed(1) + ' cm，内脏脂肪在下降 🎉';
      } else if (latest.waist > first.waist) {
        tipText = '腰围比首次记录增加 ' + (latest.waist - first.waist).toFixed(1) + ' cm，注意近期饮食';
      } else if (list.length >= 2) {
        tipText = '腰围与首次持平，继续保持';
      }
    }
    const chart = list.slice(-8).map(function (m) {
      const max = 120;
      const h = Math.max(10, Math.min(100, Math.round((m.waist / max) * 100)));
      return { label: util.fmtMD(m.date), h: h, value: m.waist };
    });
    this.setData({
      list: list.slice().reverse().slice(0, 10).map(function (m) {
        return Object.assign({}, m, { label: util.fmtMD(m.date) });
      }),
      chart: chart,
      latest: latest,
      whr: whr,
      whrText: whrText,
      waistDelta: waistDelta,
      tipText: tipText
    });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = e.detail.value;
    this.setData(patch);
  },

  save() {
    const pick = (v) => parseFloat(v);
    const vals = {
      waist: pick(this.data.waist),
      hip: pick(this.data.hip),
      chest: pick(this.data.chest),
      thigh: pick(this.data.thigh),
      arm: pick(this.data.arm)
    };
    const okVals = Object.keys(vals).filter(function (k) { return !isNaN(vals[k]) && vals[k] > 20 && vals[k] < 250; });
    if (!okVals.length) {
      wx.showToast({ title: '至少填一项有效围度（cm）', icon: 'none' });
      return;
    }
    const rec = { date: util.dateKey() };
    okVals.forEach(function (k) { rec[k] = +vals[k].toFixed(1); });
    const measures = wx.getStorageSync('measures') || { list: [] };
    const list = (measures.list || []).slice();
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].date === rec.date) { idx = i; break; }
    }
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    wx.setStorageSync('measures', { list: list });
    this.setData({ waist: '', hip: '', chest: '', thigh: '', arm: '' });
    this.refresh();
    wx.showToast({ title: '围度已记录', icon: 'success' });
  },

  clearAll() {
    const that = this;
    wx.showModal({
      title: '清空全部围度记录？',
      confirmText: '清空',
      confirmColor: '#ef4444',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('measures');
          that.refresh();
        }
      }
    });
  },

  onShareAppMessage() {
    return { title: '体重之外，围度也在悄悄变好', path: '/pages/measure/measure' };
  }
});
