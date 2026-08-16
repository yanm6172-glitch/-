// 消息中心：打卡动态、里程碑、成就解锁等事件日志（本地存储）
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function fmt(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function get() {
  return wx.getStorageSync('news') || [];
}

function add(icon, title, text) {
  const list = get();
  list.unshift({ id: Date.now(), icon: icon, title: title, text: text, time: fmt(new Date()), read: false });
  wx.setStorageSync('news', list.slice(0, 100));
}

function unread() {
  return get().filter(function (n) { return !n.read; }).length;
}

function markAllRead() {
  const l = get().map(function (n) { n.read = true; return n; });
  wx.setStorageSync('news', l);
}

function clearAll() {
  wx.setStorageSync('news', []);
}

module.exports = {
  get: get,
  add: add,
  unread: unread,
  markAllRead: markAllRead,
  clearAll: clearAll
};
