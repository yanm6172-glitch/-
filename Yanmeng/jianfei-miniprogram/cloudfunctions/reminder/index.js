const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 发布时改成 'formal'；体验版用 'trial'；开发调试用 'developer'
const MINI_STATE = 'formal';

exports.main = async (event) => {
  // 客户端注册票据
  if (event && event.action === 'register') {
    const { OPENID } = cloud.getWXContext();
    const tickets = event.tickets || [];
    for (const t of tickets) {
      await db.collection('reminders').add({
        data: {
          _openid: OPENID,
          openid: OPENID,
          tmplId: t.tmplId,
          sendAt: t.sendAt,
          data: t.data,
          done: false,
          createdAt: Date.now()
        }
      });
    }
    return { ok: true, count: tickets.length };
  }

  // 定时触发：发送到点的提醒
  const now = Date.now();
  const res = await db.collection('reminders')
    .where({ done: false, sendAt: _.lte(now + 5 * 60 * 1000) })
    .limit(100)
    .get();
  let sent = 0;
  for (const r of res.data) {
    if (r.sendAt < now - 2 * 3600 * 1000) {
      // 过期超2小时，跳过不再发送
      await db.collection('reminders').doc(r._id).update({ data: { done: true } });
      continue;
    }
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r._openid || r.openid,
        templateId: r.tmplId,
        page: 'pages/index/index',
        miniprogramState: MINI_STATE,
        lang: 'zh_CN',
        data: r.data
      });
      sent++;
    } catch (e) {
      // 43101=用户拒收；其他错误如模板不匹配等
    }
    await db.collection('reminders').doc(r._id).update({ data: { done: true } });
  }
  return { sent: sent };
};
