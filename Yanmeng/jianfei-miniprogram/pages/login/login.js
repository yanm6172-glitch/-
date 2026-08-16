const auth = require('../../utils/auth.js');

Page({
  data: {
    agreed: false,
    loading: false,
    cloudOff: false
  },

  onLoad(options) {
    this.setData({ cloudOff: !auth.cloudOn() });
    const force = options && options.force === '1';
    // 已登录 → 直接进首页；游客且非主动升级 → 也进首页
    if (auth.isLoggedIn()) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    if (auth.isGuest() && !force) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  doLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });
    auth.setAgreed(true);

    const enter = function () {
      setTimeout(function () {
        wx.switchTab({ url: '/pages/index/index' });
      }, 500);
    };

    if (!auth.cloudOn()) {
      // 未配置云开发 → 本地体验模式
      auth.guestLogin().then(function () {
        wx.showToast({ title: '已进入（本地体验模式）', icon: 'none' });
        enter();
      });
      return;
    }

    auth.wechatLogin().then(function (u) {
      auth.setUser(u);
      wx.showToast({ title: '登录成功', icon: 'success' });
      enter();
    }).catch(function () {
      this.setData({ loading: false });
      wx.showModal({
        title: '登录失败',
        content: '请检查云函数 login 是否已部署（详见 README「云开发配置」）。也可以先以游客模式使用。',
        confirmText: '游客模式',
        cancelText: '重试',
        success(res) {
          if (res.confirm) {
            auth.setAgreed(true);
            auth.guestLogin().then(function () {
              wx.showToast({ title: '已进入（本地体验模式）', icon: 'none' });
              enter();
            });
          }
        }
      });
    }.bind(this));
  },

  goUser() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=user' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  }
});
