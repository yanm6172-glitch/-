// 云函数 + 云端客户端逻辑测试（wx-server-sdk / wx.cloud 模拟）
// 运行：node run_cloud.js
const path = require('path');
const SRC = process.env.MP_SRC || path.join(__dirname, '..', 'jianfei-miniprogram');

// ---------- 云数据库模拟 ----------
function makeDb(initial) {
  const state = initial || {};
  function collection(name) {
    if (!state[name]) state[name] = { docs: {}, seq: 0 };
    const col = state[name];
    const b = {
      _q: null,
      _lim: 0,
      where(c) { this._q = c; return this; },
      limit(n) { this._lim = n; return this; },
      async get() {
        let arr = Object.keys(col.docs).map((id) => Object.assign({ _id: id }, col.docs[id]));
        const q = this._q;
        if (q) {
          arr = arr.filter((d) => Object.keys(q).every((k) => {
            const v = q[k];
            if (Array.isArray(d[k])) return d[k].indexOf(v) >= 0;
            if (v && typeof v === 'object') {
              if ('__lte' in v) return d[k] <= v.__lte;
              if ('__gte' in v) return d[k] >= v.__gte;
            }
            return d[k] === v;
          }));
        }
        if (this._lim) arr = arr.slice(0, this._lim);
        return { data: arr };
      },
      async count() {
        const r = await this.get();
        return { total: r.data.length };
      },
      async add(o) {
        const id = 'auto_' + (++col.seq);
        col.docs[id] = o.data || {};
        return { _id: id };
      },
      doc(id) {
        return {
          async get() {
            if (!col.docs[id]) { const e = new Error('document not found'); throw e; }
            return { data: Object.assign({ _id: id }, col.docs[id]) };
          },
          async set(o) { col.docs[id] = o.data || {}; return {}; },
          async update(o) {
            if (!col.docs[id]) col.docs[id] = {};
            const data = o.data || {};
            Object.keys(data).forEach((k) => {
              const v = data[k];
              if (v && typeof v === 'object' && Array.isArray(v.__push)) {
                col.docs[id][k] = (col.docs[id][k] || []).concat(v.__push);
              } else {
                col.docs[id][k] = v;
              }
            });
            return {};
          }
        };
      }
    };
    return b;
  }
  return {
    collection: collection,
    command: {
      push: (v) => ({ __push: [v] }),
      lte: (v) => ({ __lte: v }),
      gte: (v) => ({ __gte: v })
    }
  };
}

// ---------- Module 拦截：wx-server-sdk / config.js ----------
const Module = require('module');
const origLoad = Module._load;
let currentCloud = null;
let currentConfig = null;
let currentHttps = null;
Module._load = function (request, parent) {
  if (request === 'wx-server-sdk') return currentCloud;
  if (request === 'https' && currentHttps !== null) return currentHttps;
  if (request === './config.js' && parent && parent.filename.indexOf('utils') >= 0) return currentConfig;
  return origLoad.apply(this, arguments);
};

// ---------- wx 客户端模拟 ----------
function makeWx(dbState, opts) {
  opts = opts || {};
  const store = opts.store || {};
  const calls = opts.calls || { callFunction: [] };
  const db = makeDb(dbState);
  const wx = {
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v; },
    removeStorageSync: (k) => { delete store[k]; },
    showToast: () => {}, showModal: () => {}, showLoading: () => {}, hideLoading: () => {},
    login: (o) => o && o.success && o.success({ code: 'mock-code' }),
    cloud: {
      database: () => db,
      callFunction: (o) => {
        calls.callFunction.push(o);
        return Promise.resolve({ result: { openid: opts.openid || 'o_client' } });
      },
      uploadFile: (o) => { o.success({ fileID: 'cloud://avatars/x.png' }); }
    }
  };
  return { wx, store, calls, dbState: dbState };
}

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name + ' => ' + JSON.stringify(a));

function bjToday() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (x) => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

(async () => {
  const cloudFnDir = path.join(SRC, 'cloudfunctions');

  // ============ A. login 云函数 ============
  console.log('== 云函数 login ==');
  {
    const state = { openid: 'o_user_1', sent: [] };
    currentCloud = {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      getWXContext: () => ({ OPENID: state.openid }),
      database: () => makeDb({}),
      openapi: { subscribeMessage: { send: async () => {} } }
    };
    const loginPath = path.join(cloudFnDir, 'login', 'index.js');
    delete require.cache[require.resolve(loginPath)];
    const login = require(loginPath);
    const res = await login.main({});
    eq(res.openid, 'o_user_1', '返回 openid');
  }

  // ============ B. family 云函数 ============
  console.log('== 云函数 family ==');
  {
    const dbState = { families: { docs: {}, seq: 0 }, sync: { docs: {}, seq: 0 } };
    const state = { openid: 'o_me' };
    const cloud = {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      getWXContext: () => ({ OPENID: state.openid }),
      database: () => makeDb(dbState),
      openapi: {}
    };
    currentCloud = cloud;
    const famPath = path.join(cloudFnDir, 'family', 'index.js');
    delete require.cache[require.resolve(famPath)];
    const family = require(famPath);

    // 创建组
    const r1 = await family.main({ action: 'createGroup' });
    ok(r1.ok && /^[A-Z0-9]{6}$/.test(r1.inviteCode), '创建家庭组，邀请码6位');
    // 重复创建 → 返回同一个
    const r1b = await family.main({ action: 'createGroup' });
    ok(r1b.already === true && r1b.inviteCode === r1.inviteCode, '重复创建返回原组');
    // 家人加入
    state.openid = 'o_family_1';
    const r2 = await family.main({ action: 'joinGroup', inviteCode: r1.inviteCode });
    ok(r2.ok === true, '家人凭邀请码加入');
    const r2bad = await family.main({ action: 'joinGroup', inviteCode: 'ZZZZZZ' });
    ok(r2bad.ok === false, '错误邀请码被拒绝');
    // 种子：成员同步数据（结构：{ data: {settings,dailies}, ts: {} }）
    const db = makeDb(dbState);
    await db.collection('sync').doc('o_me').set({ data: { data: {
      settings: { nickname: '颜萌' },
      dailies: { [bjToday()]: { checked: true, score: 83, foods: [{ kcal: 400 }], water: 2000 } }
    }, ts: {} } });
    await db.collection('sync').doc('o_family_1').set({ data: { data: {
      settings: { nickname: '妈妈' },
      dailies: { [bjToday()]: { checked: false, foods: [{ kcal: 650 }] } }
    }, ts: {} } });
    state.openid = 'o_me';
    const r3 = await family.main({ action: 'getGroupData' });
    ok(r3.ok && r3.members.length === 2, '查看家人：2 名成员');
    const me = r3.members.find((m) => m.nickname === '颜萌');
    const mom = r3.members.find((m) => m.nickname === '妈妈');
    ok(me && me.today && me.today.checked === true && me.today.cal === 400, '成员今日数据（打卡+热量）');
    ok(mom && mom.today && mom.today.checked === false, '家人未打卡状态');
    // 未加入组的人查询
    state.openid = 'o_stranger';
    const r4 = await family.main({ action: 'getGroupData' });
    ok(r4.ok === false, '未入组者无法查看');
  }

  // ============ C. reminder 云函数 ============
  console.log('== 云函数 reminder ==');
  {
    const now = Date.now();
    const dbState = {
      reminders: { docs: {}, seq: 0 }
    };
    dbState.reminders.docs = {
      r1: { _openid: 'o_a', tmplId: 'T1', sendAt: now - 10 * 60000, data: { thing1: { value: 'x' } }, done: false },
      r2: { _openid: 'o_b', tmplId: 'T1', sendAt: now - 3 * 3600000, data: {}, done: false },
      r3: { _openid: 'o_c', tmplId: 'T1', sendAt: now + 3600000, data: {}, done: false },
      r4: { _openid: 'o_d', tmplId: 'T1', sendAt: now - 5 * 60000, data: {}, done: false }
    };
    const state = { openid: 'o_a', attempts: [], failSend: 'o_d' };
    currentCloud = {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      getWXContext: () => ({ OPENID: state.openid }),
      database: () => makeDb(dbState),
      openapi: {
        subscribeMessage: {
          send: async (o) => {
            state.attempts.push(o.touser);
            if (o.touser === state.failSend) { const e = new Error('43101'); throw e; }
          }
        }
      }
    };
    const remPath = path.join(cloudFnDir, 'reminder', 'index.js');
    delete require.cache[require.resolve(remPath)];
    const reminder = require(remPath);

    // 注册票据（10分钟后到点 → 本轮定时不会发送；用独立 openid 便于断言）
    state.openid = 'o_reg';
    const reg = await reminder.main({ action: 'register', tickets: [
      { tmplId: 'T9', sendAt: now + 10 * 60000, data: { thing1: { value: 'hi' } } }
    ] });
    state.openid = 'o_a';
    ok(reg.ok === true && reg.count === 1, '注册提醒票据');
    const all = await makeDb(dbState).collection('reminders').where({}).get();
    ok(all.data.some((r) => r.tmplId === 'T9' && r._openid === 'o_reg'), '票据写入数据库');

    // 定时发送
    const run = await reminder.main({});
    ok(state.attempts.indexOf('o_a') >= 0, '到点票据已发送');
    ok(state.attempts.indexOf('o_d') >= 0, '发送失败的票据也尝试过（不崩溃）');
    ok(state.attempts.indexOf('o_b') < 0, '过期超2小时票据不再发送');
    ok(state.attempts.indexOf('o_c') < 0, '未到点票据不发送');
    ok(state.attempts.indexOf('o_reg') < 0, '10分钟后的票据本轮不发送');
    const docs = dbState.reminders.docs;
    ok(docs.r1.done === true, '已发送票据标记完成');
    ok(docs.r2.done === true, '过期票据标记完成');
    ok(docs.r3.done === false, '未来票据保持待发');
    ok(docs.r4.done === true, '发送失败票据也标记完成（避免重发风暴）');
    ok(run.sent === 1, '本次实际成功发送 1 条');
  }

  // ============ D. 客户端 sync（推拉合并） ============
  console.log('== 客户端 sync ==');
  currentConfig = { cloudEnv: 'test-env', remind: { water: { id: 'W1', data: {} }, weigh: { id: 'W2', data: {} } } };
  {
    const dbState = { sync: { docs: {}, seq: 0 } };
    const store = { openid: 'o_sync' };
    const { wx } = makeWx(dbState, { store, openid: 'o_sync' });
    global.wx = wx;
    const syncPath = path.join(SRC, 'utils', 'sync.js');
    delete require.cache[require.resolve(syncPath)];
    const sync = require(syncPath);
    ok(sync.enabled() === true, '配置云环境后 sync 启用');

    // 场景1：云端较新 → pull 覆盖本地
    store.dailies = { old: true };
    store.ts_dailies = 100;
    await makeDb(dbState).collection('sync').doc('o_sync').set({ data: { data: { dailies: { fresh: true } }, ts: { dailies: 200 } } });
    const changed = await sync.pull();
    ok(changed === true, 'pull 返回有更新');
    eq(store.dailies, { fresh: true }, '本地被云端覆盖');
    eq(store.ts_dailies, 200, '时间戳同步为云端');

    // 场景2：本地较新 → push 上传；云端另一 key 较新 → 保留云端
    store.dailies = { localNew: true };
    store.ts_dailies = 500;
    store.weights = { list: [{ date: '2026-08-01', weight: 99 }] };
    store.ts_weights = 50;
    await makeDb(dbState).collection('sync').doc('o_sync').set({ data: { data: { dailies: { fresh: true }, weights: { list: [{ date: '2026-08-02', weight: 98 }] } }, ts: { dailies: 200, weights: 400 } } });
    const pushed = await sync.push();
    ok(pushed === true, 'push 成功');
    const doc = await makeDb(dbState).collection('sync').doc('o_sync').get();
    eq(doc.data.data.dailies, { localNew: true }, '较新的本地 dailies 已上传');
    eq(doc.data.data.weights.list[0].weight, 98, '较新的云端 weights 保留');
    ok(doc.data.ts.dailies === 500 && doc.data.ts.weights === 400, '时间戳逐 key 合并');
  }

  // ============ E. 客户端 auth（微信登录 + 头像上传） ============
  console.log('== 客户端 auth ==');
  {
    const dbState = { users: { docs: {}, seq: 0 } };
    const store = {};
    const { wx, calls } = makeWx(dbState, { store, openid: 'o_auth' });
    global.wx = wx;
    const authPath = path.join(SRC, 'utils', 'auth.js');
    delete require.cache[require.resolve(authPath)];
    const auth = require(authPath);
    ok(auth.cloudOn() === true, '配置后 cloudOn=true');
    // 首次登录 → 创建 users 文档
    const u1 = await auth.wechatLogin();
    eq(u1.openid, 'o_auth', '首次登录获取 openid');
    eq(u1.nickname, '', '首次登录无昵称');
    const docs1 = dbState.users.docs;
    ok(Object.keys(docs1).length === 1, 'users 文档已创建');
    // 保存资料
    auth.setUser(u1);
    auth.saveProfile('颜萌', '');
    // 二次登录 → 拉取资料
    const u2 = await auth.wechatLogin();
    eq(u2.nickname, '颜萌', '二次登录拉取云端昵称');
    // 头像上传
    const url = await auth.uploadAvatar('/tmp/avatar.png');
    eq(url, 'cloud://avatars/x.png', '头像上传返回 fileID');
    // 退出
    auth.logout();
    ok(!auth.isLoggedIn(), '退出后未登录');
  }

  // ============ F. vision 云函数（拍照识别） ============
  console.log('== 云函数 vision ==');
  {
    let respondBody = '';
    let respondStatus = 200;
    const httpsMock = {
      request(opts, cb) {
        const res = {
          statusCode: respondStatus,
          on(ev, fn) {
            if (ev === 'data' && respondBody) fn(respondBody);
            if (ev === 'end') fn();
            return this;
          }
        };
        setTimeout(function () { cb(res); }, 0);
        return { on() { return this; }, write() {}, end() {} };
      }
    };
    currentHttps = httpsMock;
    currentCloud = {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      getWXContext: () => ({ OPENID: 'o_v' }),
      database: () => makeDb({}),
      downloadFile: async () => ({ fileContent: Buffer.from('fake-image-bytes') })
    };
    const visPath = path.join(cloudFnDir, 'vision', 'index.js');
    delete require.cache[require.resolve(visPath)];
    const vision = require(visPath);

    // 缺少图片参数
    delete process.env.ZHIPU_KEY;
    const r0 = await vision.main({});
    ok(r0.ok === false && r0.msg.indexOf('缺少图片') >= 0, '缺少图片参数返回提示');

    // 成功识别（干净 JSON）
    process.env.ZHIPU_KEY = 'TEST_KEY';
    respondStatus = 200;
    respondBody = JSON.stringify({ choices: [{ message: { content: '{"name":"鸡腿饭","grams":400,"kcal100":180}' } }] });
    const r1 = await vision.main({ fileID: 'cloud://x.jpg' });
    ok(r1.ok === true && r1.name === '鸡腿饭', '识别成功返回食物名');
    ok(r1.grams === 400 && r1.kcal100 === 180 && r1.kcal === 720, '克重与热量换算正确');

    // 带代码块围栏的 JSON（正则兜底解析）
    respondBody = JSON.stringify({ choices: [{ message: { content: '```json\n{"name":"面条","grams":300,"kcal100":110}\n```' } }] });
    const r2 = await vision.main({ fileID: 'cloud://x.jpg' });
    ok(r2.ok === true && r2.name === '面条' && r2.kcal === 330, '围栏 JSON 也能解析');

    // AI 服务异常
    respondStatus = 500;
    respondBody = 'Internal Server Error';
    const r3 = await vision.main({ fileID: 'cloud://x.jpg' });
    ok(r3.ok === false && r3.msg.indexOf('500') >= 0, '服务异常返回错误提示');
    respondStatus = 200;
    currentHttps = null;
    delete process.env.ZHIPU_KEY;
  }

  console.log('');
  console.log('========== 云端逻辑测试: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
  process.exit(fail ? 1 : 0);
})();
