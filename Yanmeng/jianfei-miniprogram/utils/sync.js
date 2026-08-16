// 云同步工具：个人数据多设备同步（云开发数据库 sync 集合，每用户一个文档）
const config = require('./config.js');

const KEYS = ['settings', 'dailies', 'weights', 'favfoods'];

function enabled() {
  return !!(config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud);
}

function getOpenid() {
  return wx.getStorageSync('openid') || '';
}

function login() {
  return new Promise(function (resolve) {
    if (getOpenid()) {
      resolve(getOpenid());
      return;
    }
    wx.cloud.callFunction({ name: 'login' }).then(function (res) {
      const openid = res.result && res.result.openid;
      if (openid) wx.setStorageSync('openid', openid);
      resolve(openid || '');
    }).catch(function () {
      resolve('');
    });
  });
}

function localStamp(key) {
  return wx.getStorageSync('ts_' + key) || 0;
}

function snapshot() {
  const data = {};
  const ts = {};
  KEYS.forEach(function (k) {
    const v = wx.getStorageSync(k);
    if (v !== '' && v != null) {
      data[k] = v;
      ts[k] = localStamp(k) || Date.now();
    }
  });
  return { data: data, ts: ts };
}

function applyRemote(remote) {
  let changed = false;
  KEYS.forEach(function (k) {
    const rv = remote.data ? remote.data[k] : null;
    const rts = remote.ts ? remote.ts[k] : 0;
    if (rv != null && (!localStamp(k) || rts >= localStamp(k))) {
      wx.setStorageSync(k, rv);
      wx.setStorageSync('ts_' + k, rts);
      changed = true;
    }
  });
  return changed;
}

// 从云端拉取（云端较新的覆盖本地）
async function pull() {
  if (!enabled()) return false;
  const openid = await login();
  if (!openid) return false;
  const db = wx.cloud.database();
  try {
    const res = await db.collection('sync').doc(openid).get();
    const doc = res.data;
    // 文档结构：{ data: {...有效载荷...}, ts: {...各key时间戳...}, updatedAt }
    if (!doc || !doc.data) return false;
    return applyRemote(doc);
  } catch (e) {
    return false;
  }
}

// 上传本地（逐 key 保留较新的一方）
async function push() {
  if (!enabled()) return false;
  const openid = await login();
  if (!openid) return false;
  const db = wx.cloud.database();
  const snap = snapshot();
  if (!Object.keys(snap.data).length) return false;
  try {
    let remote = null;
    try {
      const res = await db.collection('sync').doc(openid).get();
      remote = res.data && res.data.data ? res.data : null;
    } catch (e) {
      remote = null;
    }
    const mergedData = Object.assign({}, remote ? remote.data : {}, snap.data);
    const mergedTs = Object.assign({}, remote ? remote.ts : {}, snap.ts);
    if (remote) {
      KEYS.forEach(function (k) {
        const rts = remote.ts ? remote.ts[k] : 0;
        if (rts > snap.ts[k]) {
          mergedData[k] = remote.data[k];
          mergedTs[k] = rts;
        }
      });
    }
    await db.collection('sync').doc(openid).set({
      data: { data: mergedData, ts: mergedTs, updatedAt: Date.now() }
    });
    wx.setStorageSync('lastSyncAt', Date.now());
    return true;
  } catch (e) {
    return false;
  }
}

// 完整同步：先拉后推
async function doSync() {
  const pulled = await pull();
  const pushed = await push();
  wx.setStorageSync('lastSyncAt', Date.now());
  return { pulled: pulled, pushed: pushed };
}

module.exports = {
  enabled: enabled,
  login: login,
  pull: pull,
  push: push,
  doSync: doSync,
  getOpenid: getOpenid
};
