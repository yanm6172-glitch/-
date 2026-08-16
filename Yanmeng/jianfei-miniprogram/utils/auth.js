// 账号体系：微信登录（openid）、游客模式、资料管理、退出登录
const config = require('./config.js');

function cloudOn() {
  return !!(config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud);
}

function getUser() {
  return wx.getStorageSync('user') || null;
}

function setUser(u) {
  wx.setStorageSync('user', u);
}

function isLoggedIn() {
  const u = getUser();
  return !!(u && u.openid);
}

function isGuest() {
  return wx.getStorageSync('guestMode') === true;
}

function setGuest(v) {
  wx.setStorageSync('guestMode', v);
}

function hasAgreed() {
  return wx.getStorageSync('agreed') === true;
}

function setAgreed(v) {
  wx.setStorageSync('agreed', v);
}

// 微信一键登录：wx.login 拿 code → 云函数 login 换 openid → 拉取/创建 users 文档
function wechatLogin() {
  return new Promise(function (resolve, reject) {
    if (!cloudOn()) {
      reject(new Error('CLOUD_OFF'));
      return;
    }
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('NO_CODE'));
          return;
        }
        wx.cloud.callFunction({ name: 'login', data: { code: res.code } })
          .then(function (r) {
            const openid = r.result && r.result.openid;
            if (!openid) {
              reject(new Error('NO_OPENID'));
              return;
            }
            const db = wx.cloud.database();
            db.collection('users').doc(openid).get()
              .then(function (doc) {
                let p = doc.data || {};
                if (!p.nickname) {
                  p = { nickname: '', avatar: '', createdAt: Date.now() };
                  db.collection('users').doc(openid).set({ data: p }).catch(function () {});
                }
                resolve({ openid: openid, nickname: p.nickname || '', avatar: p.avatar || '' });
              })
              .catch(function () {
                // 文档不存在 → 创建
                const p = { nickname: '', avatar: '', createdAt: Date.now() };
                db.collection('users').doc(openid).set({ data: p })
                  .then(function () {
                    resolve({ openid: openid, nickname: '', avatar: '' });
                  })
                  .catch(reject);
              });
          })
          .catch(reject);
      },
      fail: reject
    });
  });
}

// 游客模式（云开发未配置时）：数据仅存本机
function guestLogin() {
  return new Promise(function (resolve) {
    setGuest(true);
    const u = { openid: '', nickname: '游客', avatar: '', guest: true };
    setUser(u);
    resolve(u);
  });
}

function logout() {
  wx.removeStorageSync('user');
  wx.removeStorageSync('openid');
  wx.setStorageSync('guestMode', false);
  // 本地打卡数据保留，重新登录后可通过云同步恢复
}

// 保存资料：本地 user + 云端 users + settings.nickname（家庭组显示用）
function saveProfile(nickname, avatar) {
  const u = getUser() || {};
  u.nickname = nickname;
  if (avatar) u.avatar = avatar;
  setUser(u);
  const settings = wx.getStorageSync('settings') || {};
  settings.nickname = nickname;
  wx.setStorageSync('settings', settings);
  if (u.openid && cloudOn()) {
    const db = wx.cloud.database();
    db.collection('users').doc(u.openid).set({
      data: { nickname: nickname, avatar: avatar || '', updatedAt: Date.now() }
    }).catch(function () {});
  }
}

// 头像上传到云存储，返回 fileID；失败则用本地临时路径
function uploadAvatar(tempPath) {
  return new Promise(function (resolve) {
    const u = getUser() || {};
    if (u.openid && cloudOn()) {
      const parts = tempPath.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'png';
      wx.cloud.uploadFile({
        cloudPath: 'avatars/' + u.openid + '_' + Date.now() + '.' + ext,
        filePath: tempPath,
        success(res) {
          resolve(res.fileID);
        },
        fail() {
          resolve(tempPath);
        }
      });
    } else {
      resolve(tempPath);
    }
  });
}

module.exports = {
  cloudOn: cloudOn,
  getUser: getUser,
  setUser: setUser,
  isLoggedIn: isLoggedIn,
  isGuest: isGuest,
  setGuest: setGuest,
  hasAgreed: hasAgreed,
  setAgreed: setAgreed,
  wechatLogin: wechatLogin,
  guestLogin: guestLogin,
  logout: logout,
  saveProfile: saveProfile,
  uploadAvatar: uploadAvatar
};
