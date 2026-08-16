const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// 北京时间 YYYY-MM-DD（云函数运行在 UTC 时区，需 +8）
function bjDateKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;
  const fam = db.collection('families');

  if (action === 'createGroup') {
    const exist = await fam.where({ members: OPENID }).limit(1).get();
    if (exist.data.length) {
      return { ok: true, groupId: exist.data[0]._id, inviteCode: exist.data[0].inviteCode, already: true };
    }
    let code = genCode();
    for (let i = 0; i < 3; i++) {
      const dup = await fam.where({ inviteCode: code }).count();
      if (!dup.total) break;
      code = genCode();
    }
    const res = await fam.add({ data: { inviteCode: code, members: [OPENID], createdAt: Date.now() } });
    return { ok: true, groupId: res._id, inviteCode: code };
  }

  if (action === 'joinGroup') {
    const code = String((event && event.inviteCode) || '').trim().toUpperCase();
    if (!code) return { ok: false, msg: '请输入邀请码' };
    const res = await fam.where({ inviteCode: code }).limit(1).get();
    if (!res.data.length) return { ok: false, msg: '邀请码不存在' };
    const doc = res.data[0];
    if (doc.members.indexOf(OPENID) >= 0) {
      return { ok: true, groupId: doc._id, already: true };
    }
    await fam.doc(doc._id).update({ data: { members: _.push(OPENID) } });
    return { ok: true, groupId: doc._id };
  }

  if (action === 'getGroupData') {
    const res = await fam.where({ members: OPENID }).limit(1).get();
    if (!res.data.length) return { ok: false, msg: '你还没加入家庭组' };
    const group = res.data[0];
    const syncCol = db.collection('sync');
    const members = [];
    for (const openid of group.members) {
      let nickname = '家人' + openid.slice(-4);
      let today = null;
      try {
        const sres = await syncCol.doc(openid).get();
        // sync 文档结构：{ data: {settings,dailies,...}, ts: {...}, updatedAt }
        const dd = (sres.data && sres.data.data) || {};
        if (dd.settings && dd.settings.nickname) nickname = dd.settings.nickname;
        if (dd.dailies) {
            const key = bjDateKey();
            const d = dd.dailies[key] || {};
            const foods = d.foods || [];
            let cal = 0;
            foods.forEach(function (f) { cal += f.kcal || 0; });
            today = {
              checked: !!d.checked,
              score: d.score || 0,
              cal: Math.round(cal),
              water: d.water || 0,
              steps: d.steps || 0
            };
          }
      } catch (e) {
        // 忽略单个成员读取失败
      }
      members.push({ openid: openid.slice(-4), nickname: nickname, today: today });
    }
    return { ok: true, members: members };
  }

  return { ok: false, msg: '未知操作' };
};
