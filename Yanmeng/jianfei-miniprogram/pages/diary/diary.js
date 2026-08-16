const util = require('../../utils/util.js');

Page({
  data: {
    groups: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const dailies = wx.getStorageSync('dailies') || {};
    const groups = [];
    // 最近 30 天
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = util.dateKey(d);
      const dd = dailies[key] || {};
      const foods = (dd.foods || []).filter(function (f) {
        return f.image && f.image.indexOf('cloud://') >= 0;
      });
      if (foods.length) {
        groups.push({ key: key, label: util.fmtMD(key), foods: foods });
      }
    }
    this.setData({ groups: groups });
  },

  goCalorie() {
    wx.switchTab({ url: '/pages/calorie/calorie' });
  },

  onShareAppMessage() {
    return { title: '我的饮食拍照日记', path: '/pages/diary/diary' };
  }
});
