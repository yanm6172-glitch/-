const util = require('../../utils/util.js');
const sync = require('../../utils/sync.js');
const remind = require('../../utils/remind.js');
const auth = require('../../utils/auth.js');
const news = require('../../utils/news.js');

function fmtLastSync(ms) {
  if (!ms) return '从未同步';
  const d = new Date(ms);
  const p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

Page({
  data: {
    height: '168',
    startWeight: '100',
    targetWeight: '65',
    weeklyGoalIdx: 1,
    weeklyGoals: ['0.5', '0.75', '1'],
    budget: '42',
    calorie: '1500',
    startDate: '',
    // 云同步
    syncOn: false,
    lastSyncText: '从未同步',
    // 账号资料
    loggedIn: false,
    avatar: '',
    editing: false,
    // 家人监督
    nickname: '',
    myInvite: '',
    joinCode: '',
    familyMembers: [],
    // 提醒
    waterOn: false,
    waterTime: '15:00',
    weighOn: false,
    weighTime: '08:00',
    weighDayIdx: 0,
    weighDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    unreadNews: 0
  },

  onLoad() {
    const s = wx.getStorageSync('settings') || {};
    const idx = this.data.weeklyGoals.indexOf(String(s.weeklyGoal));
    const rs = remind.getSet();
    this.setData({
      height: s.height != null ? String(s.height) : '168',
      startWeight: s.startWeight != null ? String(s.startWeight) : '100',
      targetWeight: s.targetWeight != null ? String(s.targetWeight) : '65',
      weeklyGoalIdx: idx >= 0 ? idx : 1,
      budget: s.dailyBudget != null ? String(s.dailyBudget) : '42',
      calorie: s.dailyCalorie != null ? String(s.dailyCalorie) : '1500',
      startDate: s.startDate || util.dateKey(),
      nickname: s.nickname || '',
      waterOn: !!rs.waterOn,
      waterTime: rs.waterTime || '15:00',
      weighOn: !!rs.weighOn,
      weighTime: rs.weighTime || '08:00',
      weighDayIdx: (rs.weighDay || 1) - 1
    });
  },

  onShow() {
    this.loadProfile();
    this.setData({
      syncOn: sync.enabled(),
      lastSyncText: fmtLastSync(wx.getStorageSync('lastSyncAt') || 0),
      unreadNews: news.unread()
    });
  },

  loadProfile() {
    const u = auth.getUser() || {};
    const s = wx.getStorageSync('settings') || {};
    this.setData({
      loggedIn: auth.isLoggedIn(),
      nickname: u.nickname || s.nickname || '',
      avatar: u.avatar || ''
    });
  },

  /* ---- 账号资料 ---- */
  toggleEdit() {
    this.setData({ editing: !this.data.editing });
  },

  onChooseAvatar(e) {
    const temp = e.detail.avatarUrl;
    if (!temp) return;
    const that = this;
    auth.uploadAvatar(temp).then(function (url) {
      that.setData({ avatar: url });
    });
  },

  saveProfile() {
    const name = (this.data.nickname || '').trim();
    if (!name) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    auth.saveProfile(name, this.data.avatar);
    this.setData({ editing: false });
    wx.showToast({ title: '资料已保存', icon: 'success' });
  },

  doLogout() {
    wx.showModal({
      title: '退出登录？',
      content: '本地打卡数据会保留，重新登录后可继续使用云同步。',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?force=1' });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=user' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },

  goAchieve() {
    wx.navigateTo({ url: '/pages/achieve/achieve' });
  },

  goNews() {
    wx.navigateTo({ url: '/pages/news/news' });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = e.detail.value;
    this.setData(patch);
  },

  onGoal(e) {
    this.setData({ weeklyGoalIdx: Number(e.detail.value) });
  },

  save() {
    const height = parseFloat(this.data.height);
    const startWeight = parseFloat(this.data.startWeight);
    const targetWeight = parseFloat(this.data.targetWeight);
    const budget = parseFloat(this.data.budget);
    if (isNaN(height) || height < 100 || height > 250) {
      wx.showToast({ title: '请检查身高', icon: 'none' });
      return;
    }
    if (isNaN(startWeight) || startWeight < 30 || startWeight > 300) {
      wx.showToast({ title: '请检查初始体重', icon: 'none' });
      return;
    }
    if (isNaN(targetWeight) || targetWeight < 30 || targetWeight >= startWeight) {
      wx.showToast({ title: '目标体重需小于初始体重', icon: 'none' });
      return;
    }
    if (isNaN(budget) || budget < 0) {
      wx.showToast({ title: '请检查每日预算', icon: 'none' });
      return;
    }
    const calorie = parseFloat(this.data.calorie);
    if (isNaN(calorie) || calorie < 500 || calorie > 5000) {
      wx.showToast({ title: '热量目标建议800~2500千卡', icon: 'none' });
      return;
    }
    const settings = wx.getStorageSync('settings') || {};
    const next = Object.assign({}, settings, {
      height: height,
      startWeight: startWeight,
      targetWeight: targetWeight,
      weeklyGoal: Number(this.data.weeklyGoals[this.data.weeklyGoalIdx]),
      dailyBudget: +budget.toFixed(2),
      dailyCalorie: Math.round(calorie),
      startDate: settings.startDate || util.dateKey()
    });
    wx.setStorageSync('settings', next);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  /* ---- 云同步 ---- */
  checkCloud() {
    if (sync.enabled()) return true;
    wx.showModal({
      title: '未配置云开发',
      content: '云同步/家庭组/订阅提醒都需要云开发。请按 README「云开发配置」章节开通，并把环境ID填入 utils/config.js 的 cloudEnv。',
      showCancel: false
    });
    return false;
  },

  doSync() {
    if (!this.checkCloud()) return;
    const that = this;
    wx.showLoading({ title: '同步中' });
    sync.doSync().then(function (res) {
      wx.hideLoading();
      that.onLoad();
      that.setData({ lastSyncText: fmtLastSync(Date.now()) });
      wx.showToast({
        title: res.pulled ? '已从云端更新' : (res.pushed ? '已上传云端' : '云端无数据，已上传本地'),
        icon: 'success'
      });
    });
  },

  /* ---- 家人监督 ---- */
  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },

  createFamily() {
    if (!this.checkCloud()) return;
    wx.showLoading({ title: '创建中' });
    wx.cloud.callFunction({ name: 'family', data: { action: 'createGroup' } })
      .then(function (res) {
        wx.hideLoading();
        const r = res.result || {};
        if (r.ok) {
          news.add('👨‍👩‍👧', r.already ? '已在家庭组' : '家庭组创建成功', '邀请码：' + r.inviteCode);
          wx.showModal({
            title: r.already ? '你已在家庭组' : '创建成功',
            content: '邀请码：' + r.inviteCode + '\n把邀请码告诉家人，让他们在「我的」页输入加入',
            showCancel: false
          });
        } else {
          wx.showToast({ title: r.msg || '创建失败', icon: 'none' });
        }
      })
      .catch(function () {
        wx.hideLoading();
        wx.showToast({ title: '调用失败，检查云函数部署', icon: 'none' });
      });
  },

  onJoinCode(e) {
    this.setData({ joinCode: e.detail.value });
  },

  joinFamily() {
    if (!this.checkCloud()) return;
    const code = (this.data.joinCode || '').trim();
    if (!code) {
      wx.showToast({ title: '输入邀请码', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加入中' });
    wx.cloud.callFunction({ name: 'family', data: { action: 'joinGroup', inviteCode: code } })
      .then(function (res) {
        wx.hideLoading();
        const r = res.result || {};
        if (r.ok) {
          news.add('👨‍👩‍👧', r.already ? '已在家庭组' : '加入家庭组成功', '');
          wx.showToast({ title: r.already ? '已在该组' : '加入成功 ✅', icon: 'success' });
        } else {
          wx.showToast({ title: r.msg || '加入失败', icon: 'none' });
        }
      })
      .catch(function () {
        wx.hideLoading();
        wx.showToast({ title: '调用失败', icon: 'none' });
      });
  },

  viewFamily() {
    if (!this.checkCloud()) return;
    const that = this;
    wx.showLoading({ title: '查询中' });
    wx.cloud.callFunction({ name: 'family', data: { action: 'getGroupData' } })
      .then(function (res) {
        wx.hideLoading();
        const r = res.result || {};
        if (r.ok) {
          that.setData({ familyMembers: r.members || [] });
        } else {
          wx.showToast({ title: r.msg || '查询失败', icon: 'none' });
        }
      })
      .catch(function () {
        wx.hideLoading();
        wx.showToast({ title: '查询失败', icon: 'none' });
      });
  },

  /* ---- 提醒设置 ---- */
  onWaterOn(e) {
    const rs = remind.getSet();
    rs.waterOn = e.detail.value;
    remind.saveSet(rs);
    this.setData({ waterOn: rs.waterOn });
  },

  onWaterTime(e) {
    const rs = remind.getSet();
    rs.waterTime = e.detail.value;
    remind.saveSet(rs);
    this.setData({ waterTime: rs.waterTime });
  },

  onWeighOn(e) {
    const rs = remind.getSet();
    rs.weighOn = e.detail.value;
    remind.saveSet(rs);
    this.setData({ weighOn: rs.weighOn });
  },

  onWeighTime(e) {
    const rs = remind.getSet();
    rs.weighTime = e.detail.value;
    remind.saveSet(rs);
    this.setData({ weighTime: rs.weighTime });
  },

  onWeighDay(e) {
    const i = Number(e.detail.value);
    const rs = remind.getSet();
    rs.weighDay = i + 1;
    remind.saveSet(rs);
    this.setData({ weighDayIdx: i });
  },

  subscribeRemind() {
    if (!this.checkCloud()) return;
    remind.subscribe();
  },

  clearData() {
    wx.showModal({
      title: '清除全部打卡数据？',
      content: '包括每日打卡和体重记录，目标设置会保留。此操作不可恢复。',
      confirmText: '清除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('dailies');
          wx.removeStorageSync('weights');
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  onShareAppMessage() {
    return { title: '和我一起打卡减肥！', path: '/pages/index/index' };
  }
});
