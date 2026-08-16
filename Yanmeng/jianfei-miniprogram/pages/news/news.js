const news = require('../../utils/news.js');

Page({
  data: {
    list: []
  },

  onShow() {
    this.setData({ list: news.get() });
    news.markAllRead();
  },

  clearAll() {
    const that = this;
    wx.showModal({
      title: '清空全部消息？',
      content: '此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#ef4444',
      success(res) {
        if (res.confirm) {
          news.clearAll();
          that.setData({ list: [] });
        }
      }
    });
  }
});
