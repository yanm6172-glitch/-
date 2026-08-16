const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 发布时改成 'formal'；体验版用 'trial'；开发调试用 'developer'
const MINI_STATE = 'formal';

function bjDateKey(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function dayCal(d) {
  const foods = d.foods || [];
  return Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
}

// 周报推送：从云端同步数据生成本周总结文案
async function buildWeeklyData(openid, tmplData) {
  try {
    const sres = await db.collection('sync').doc(openid).get();
    // sync 文档结构：{ data: {settings,dailies,...}, ts: {...}, updatedAt }
    const dd = (sres.data && sres.data.data) || {};
    const dailies = dd.dailies || {};
    const settings = dd.settings || {};
    const goal = Number(settings.dailyCalorie) || 1500;
    let logDays = 0, sumCal = 0, okDays = 0, exTotal = 0, checkDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = dailies[bjDateKey(i)] || {};
      const cal = dayCal(d);
      if (cal > 0) {
        logDays++;
        sumCal += cal;
        if (cal <= goal) okDays++;
      }
      exTotal += Number(d.exMin) || 0;
      if (d.checked) checkDays++;
    }
    if (!logDays) return null; // 无数据则不推送
    const avgCal = Math.round(sumCal / logDays);
    let summary = '本周记录 ' + logDays + ' 天，日均热量 ' + avgCal + ' 千卡';
    summary += '，达标 ' + okDays + ' 天';
    summary += '，运动 ' + exTotal + ' 分钟';
    summary += '，打卡 ' + checkDays + ' 天';
    if (avgCal <= goal) summary += '，控制得不错，下周继续保持！';
    else summary += '，注意主食和零食哦。';
    const data = JSON.parse(JSON.stringify(tmplData || {}));
    if (data.thing1) data.thing1.value = summary.slice(0, 20);
    if (data.time2) data.time2.value = data.time2.value || '每周一';
    return data;
  } catch (e) {
    return null;
  }
}

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
          type: t.type || '',
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
    let sendData = r.data;
    if (r.type === 'weekly') {
      sendData = await buildWeeklyData(r._openid || r.openid, r.data);
      if (!sendData) {
        // 无同步数据，跳过并标记完成
        await db.collection('reminders').doc(r._id).update({ data: { done: true } });
        continue;
      }
    }
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r._openid || r.openid,
        templateId: r.tmplId,
        page: 'pages/index/index',
        miniprogramState: MINI_STATE,
        lang: 'zh_CN',
        data: sendData
      });
      sent++;
    } catch (e) {
      // 43101=用户拒收；其他错误如模板不匹配等
    }
    await db.collection('reminders').doc(r._id).update({ data: { done: true } });
  }
  return { sent: sent };
};
