const ach = require('../../utils/achievements.js');

Page({
  data: {
    unlocked: [],
    locked: [],
    total: 0,
    pct: 0
  },

  onShow() {
    const r = ach.compute();
    this.setData({
      unlocked: r.unlocked,
      locked: r.locked,
      total: r.total,
      pct: Math.round((r.unlocked.length / r.total) * 100)
    });
  },

  onShareAppMessage() {
    return {
      title: '我已解锁 ' + this.data.unlocked.length + ' 枚减肥勋章！',
      path: '/pages/achieve/achieve'
    };
  }
});
