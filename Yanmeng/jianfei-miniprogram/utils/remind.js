// 打卡提醒工具：订阅消息授权 + 注册发送票据（云函数 reminder 定时发送）
const config = require('./config.js');

const DEFAULT_SET = {
  waterOn: false,
  waterTime: '15:00',
  weighOn: false,
  weighTime: '08:00',
  weighDay: 1 // 1=周一 ... 7=周日
};

function getSet() {
  const s = wx.getStorageSync('remindSet') || {};
  return Object.assign({}, DEFAULT_SET, s);
}

function saveSet(s) {
  wx.setStorageSync('remindSet', s);
}

function cloudOn() {
  return !!(config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud);
}

function validId(id) {
  return id && String(id).indexOf('TMPL') < 0;
}

function templateIds(rs) {
  const ids = [];
  if (rs.waterOn && validId(config.remind.water.id)) ids.push(config.remind.water.id);
  if (rs.weighOn && validId(config.remind.weigh.id)) ids.push(config.remind.weigh.id);
  return ids;
}

function parseTime(str) {
  const p = String(str || '08:00').split(':');
  return { h: parseInt(p[0], 10) || 8, m: parseInt(p[1], 10) || 0 };
}

// 北京时间下一次 hh:mm（已过则明天）
function nextDaily(h, m) {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const target = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), h, m, 0, 0));
  let ms = target.getTime();
  if (ms <= Date.now()) ms += 24 * 3600 * 1000;
  return ms;
}

// 北京时间下一个星期几 hh:mm
function nextWeekday(wd, h, m) {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const curWd = t.getUTCDay() === 0 ? 7 : t.getUTCDay();
  const add = (wd - curWd + 7) % 7;
  const target = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + add, h, m, 0, 0));
  let ms = target.getTime();
  if (ms <= Date.now()) ms += 7 * 24 * 3600 * 1000;
  return ms;
}

function buildTickets(rs, accepted) {
  const tickets = [];
  const w = config.remind.water;
  const g = config.remind.weigh;
  if (rs.waterOn && accepted[w.id] === 'accept') {
    const t = parseTime(rs.waterTime);
    const data = JSON.parse(JSON.stringify(w.data));
    if (data.time2) data.time2.value = rs.waterTime || '15:00';
    tickets.push({ tmplId: w.id, sendAt: nextDaily(t.h, t.m), data: data });
  }
  if (rs.weighOn && accepted[g.id] === 'accept') {
    const t = parseTime(rs.weighTime);
    const data = JSON.parse(JSON.stringify(g.data));
    if (data.time2) data.time2.value = rs.weighTime || '08:00';
    tickets.push({ tmplId: g.id, sendAt: nextWeekday(rs.weighDay || 1, t.h, t.m), data: data });
  }
  return tickets;
}

// 请求订阅并把票据注册到云端（需用户点击触发）
function subscribe() {
  const rs = getSet();
  if (!cloudOn()) {
    wx.showToast({ title: '请先配置云开发环境', icon: 'none' });
    return;
  }
  const ids = templateIds(rs);
  if (!ids.length) {
    wx.showModal({
      title: '未配置模板ID',
      content: '请在小程序后台选用订阅消息模板，并把模板ID填入 utils/config.js',
      showCancel: false
    });
    return;
  }
  wx.requestSubscribeMessage({
    tmplIds: ids,
    success(res) {
      const tickets = buildTickets(rs, res);
      if (!tickets.length) {
        wx.showToast({ title: '未授权，下次再试', icon: 'none' });
        return;
      }
      wx.cloud.callFunction({ name: 'reminder', data: { action: 'register', tickets: tickets } })
        .then(function () {
          wx.showToast({ title: '订阅成功 ✅', icon: 'success' });
        })
        .catch(function () {
          wx.showToast({ title: '注册失败，检查云函数部署', icon: 'none' });
        });
    },
    fail() {
      wx.showToast({ title: '订阅失败', icon: 'none' });
    }
  });
}

// 每天第一次打开小程序时，提醒订阅当天通知（一次性订阅每天需要重新授权）
function maybePrompt() {
  const rs = getSet();
  if (!(rs.waterOn || rs.weighOn) || !cloudOn()) return;
  const today = new Date();
  const key = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  const last = wx.getStorageSync('lastRemindPrompt') || '';
  if (last === key) return;
  wx.setStorageSync('lastRemindPrompt', key);
  wx.showModal({
    title: '订阅今天的提醒？',
    content: '到点会收到微信服务通知。一次性订阅每次只发一条，建议每天打开小程序时顺手订阅。',
    confirmText: '订阅',
    cancelText: '下次',
    success(res) {
      if (res.confirm) subscribe();
    }
  });
}

module.exports = {
  getSet: getSet,
  saveSet: saveSet,
  subscribe: subscribe,
  maybePrompt: maybePrompt
};
