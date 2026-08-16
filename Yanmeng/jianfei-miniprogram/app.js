const util = require('./utils/util.js');
const config = require('./utils/config.js');

App({
  globalData: {
    settings: null,
    cloudChanged: 0
  },

  onLaunch() {
    // 首次启动写入默认设置（身高168 / 初始100kg / 目标65kg / 每日预算42元 / 热量1500千卡）
    let settings = wx.getStorageSync('settings');
    if (!settings || typeof settings !== 'object') {
      settings = {
        height: 168,
        startWeight: 100,
        targetWeight: 65,
        weeklyGoal: 0.75,
        dailyBudget: 42,
        dailyCalorie: 1500,
        startDate: util.dateKey()
      };
      wx.setStorageSync('settings', settings);
    }
    this.globalData.settings = settings;

    // 云开发初始化（config.js 里填了环境ID才生效）
    if (config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud) {
      wx.cloud.init({ env: config.cloudEnv, traceUser: true });
      this.wrapStorage();
      const sync = require('./utils/sync.js');
      const app = this;
      sync.pull().then(function (changed) {
        if (changed) app.globalData.cloudChanged = Date.now();
      });
    }
  },

  // 拦截本地存储写入：自动打时间戳，防抖3秒后上传云端
  wrapStorage() {
    const sync = require('./utils/sync.js');
    const orig = wx.setStorageSync;
    const keys = ['settings', 'dailies', 'weights', 'favfoods'];
    let timer = null;
    wx.setStorageSync = function (key, data) {
      const r = orig.call(wx, key, data);
      if (keys.indexOf(key) >= 0) {
        orig.call(wx, 'ts_' + key, Date.now());
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          sync.push();
        }, 3000);
      }
      return r;
    };
  }
});
