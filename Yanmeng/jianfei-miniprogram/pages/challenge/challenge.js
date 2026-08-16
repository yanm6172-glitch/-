const ch = require('../../utils/challenges.js');
const news = require('../../utils/news.js');

Page({
  data: {
    all: [],
    active: null,
    status: null
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({
      all: ch.CHALLENGES,
      active: ch.getActive(),
      status: ch.status()
    });
    const s = this.data.status;
    if (s && s.result === 'success' && !wx.getStorageSync('challengeDone_' + s.challenge.id)) {
      wx.setStorageSync('challengeDone_' + s.challenge.id, true);
      news.add('🏅', '挑战成功！', '「' + s.challenge.name + '」7 天达成 🎉');
      wx.showModal({
        title: '🎉 挑战成功！',
        content: '「' + s.challenge.name + '」坚持 7 天，太自律了！',
        showCancel: false,
        confirmText: '太棒了'
      });
    }
  },

  startChallenge(e) {
    const id = e.currentTarget.dataset.id;
    ch.start(id);
    news.add('🎯', '开始挑战', '「' + (ch.CHALLENGES.filter(function (c) { return c.id === id; })[0] || {}).name + '」从今天开始，坚持 7 天');
    this.refresh();
    wx.showToast({ title: '挑战已开始，加油！', icon: 'success' });
  },

  quitChallenge() {
    const that = this;
    wx.showModal({
      title: '放弃当前挑战？',
      content: '放弃后可以随时重新开始。',
      confirmText: '放弃',
      confirmColor: '#ef4444',
      success(res) {
        if (res.confirm) {
          ch.quit();
          that.refresh();
        }
      }
    });
  },

  onShareAppMessage() {
    return { title: '来和我一起 7 天减脂挑战！', path: '/pages/challenge/challenge' };
  }
});
