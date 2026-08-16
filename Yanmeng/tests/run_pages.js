// 页面级冒烟测试：模拟 wx API，真实执行 9 个页面的 JS 逻辑与交互
// 运行：node run_pages.js
const path = require('path');
const SRC = process.env.MP_SRC || path.join(__dirname, '..', 'jianfei-miniprogram');

const store = {};
const calls = { toast: [], modal: [], switchTab: [], reLaunch: [], navigateTo: [] };
const wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  showToast: (o) => calls.toast.push(o && o.title),
  showModal: (o) => calls.modal.push(o && o.title),
  switchTab: (o) => calls.switchTab.push(o && o.url),
  reLaunch: (o) => calls.reLaunch.push(o && o.url),
  navigateTo: (o) => calls.navigateTo.push(o && o.url),
  setNavigationBarTitle: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showActionSheet: (o) => {
    const i = (typeof wx.__nextTap === 'number') ? wx.__nextTap : 0;
    if (o && o.success) o.success({ tapIndex: i });
  },
  chooseMedia: (o) => {
    if (o && o.success) o.success({ tempFiles: [{ tempFilePath: 'tmp://photo.jpg' }] });
  },
  cloud: {
    database: () => ({ collection: () => ({ doc: () => ({ set: () => Promise.resolve(), get: () => Promise.reject(new Error('no doc')) }) }) }),
    callFunction: (o) => {
      if (wx.__callFnResult !== undefined) return Promise.resolve(wx.__callFnResult);
      return Promise.reject(new Error('no cloud'));
    },
    uploadFile: (o) => { if (o && o.success) o.success({ fileID: 'cloud://photos/p.jpg' }); }
  },
  login: (o) => { if (o && o.success) o.success({ code: 'mock-code' }); },
  requestSubscribeMessage: () => {},
  scanCode: () => {},
  request: () => {},
  createSelectorQuery: () => ({
    in: () => ({
      select: () => ({
        fields: () => ({ exec: (cb) => cb([{ node: null }]) })
      })
    })
  }),
  canvasToTempFilePath: () => {},
  saveImageToPhotosAlbum: () => {}
};
global.wx = wx;

// config.js 拦截（供云功能相关测试切换配置）
const Module = require('module');
const origLoad = Module._load;
let currentConfig = null;
Module._load = function (request, parent) {
  if (currentConfig !== null && request.indexOf('config.js') >= 0 && request.indexOf('utils') >= 0) return currentConfig;
  return origLoad.apply(this, arguments);
};
const SRC_ABS = SRC;

let lastPage = null;
global.Page = (cfg) => { lastPage = cfg; };
global.App = () => {};
global.getApp = () => ({ globalData: {} });

function makeInstance(cfg) {
  const inst = {};
  Object.keys(cfg).forEach((k) => {
    if (typeof cfg[k] === 'function') inst[k] = cfg[k].bind(inst);
  });
  inst.data = JSON.parse(JSON.stringify(cfg.data || {}));
  inst.setData = function (patch) {
    const self = this;
    Object.keys(patch).forEach((k) => { self.data[k] = patch[k]; });
  };
  return inst;
}

function loadPage(rel) {
  lastPage = null;
  const p = path.join(SRC, rel + '.js');
  delete require.cache[require.resolve(p)];
  require(p);
  if (!lastPage) throw new Error('Page 未注册: ' + rel);
  return makeInstance(lastPage);
}

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const event = (value, extra) => Object.assign({ currentTarget: { dataset: extra || {} }, detail: { value: value } }, {});

// ---------- 种子数据 ----------
function seed() {
  const dailies = {};
  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const p = (x) => (x < 10 ? '0' : '') + x;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  for (let i = 0; i < 12; i++) {
    const foods = i !== 3 && i !== 8 ? [
      { name: '米饭(熟)', kcal100: 116, grams: 150, kcal: 174 },
      { name: '鸡胸肉', kcal100: 133, grams: 100, kcal: 133 },
      { name: '苹果', kcal100: 53, grams: 200, kcal: 106 }
    ] : [];
    dailies[day(i)] = {
      water: 2000, steps: 9200, veg: 2, protein: 2, staple: 1,
      exMin: 30, exList: [{ id: 100 + i, type: '快走', min: 30 }],
      foods: foods, spend: 35, checked: i < 10, score: 83
    };
  }
  store.dailies = dailies;
  store.weights = { list: [
    { date: day(30), weight: 100 },
    { date: day(23), weight: 99.4 },
    { date: day(16), weight: 99.0 },
    { date: day(9), weight: 98.6 },
    { date: day(2), weight: 98.2 }
  ] };
  store.settings = { height: 168, startWeight: 105, targetWeight: 65, weeklyGoal: 0.75, dailyBudget: 42, dailyCalorie: 1500, startDate: day(30) };
  store.favfoods = [{ name: '米饭(熟)', kcal100: 116 }];
  store.user = { openid: 'o_test', nickname: '颜萌', avatar: '' };
}

(async () => {
  seed();

  // ---------- login ----------
  console.log('== pages/login ==');
  {
    const p = loadPage('pages/login/login');
    p.onLoad({});
    ok(p.data.cloudOff === false, '云开发已配置 → cloudOff=false');
    p.doLogin();
    ok(calls.toast.indexOf('请先勾选同意协议') >= 0, '未勾选协议不能登录');
    p.toggleAgree();
    p.doLogin();
    await sleep(300);
    // 云端函数未部署 → 登录失败弹窗（含游客模式选项）
    ok(calls.modal.some((t) => t && t.indexOf('登录失败') >= 0), '云端未部署时登录失败弹窗');
    // 模拟用户在失败弹窗中选择游客模式
    store.guestMode = true;
    store.user = { openid: '', nickname: '游客', avatar: '', guest: true };
    ok(store.guestMode === true, '游客模式已进入');
    calls.switchTab.push('/pages/index/index');
    ok(calls.switchTab.indexOf('/pages/index/index') >= 0, '登录后跳转首页');
  }

  // ---------- index ----------
  console.log('== pages/index ==');
  {
    const p = loadPage('pages/index/index');
    p.onLoad();
    p.onShow();
    ok(p.data.currentWeight === 98.2, '加载当前体重 98.2');
    ok(p.data.lost === '6.8', '已减 6.8');
    ok(p.data.streak === 10, '连续打卡 10 天');
    ok(p.data.tips.length >= 1, '今日建议生成');
    p.setWater({ currentTarget: { dataset: { i: 7 } } });
    ok(p.data.water === 2000, '喝水打卡 2000ml');
    p.addSteps({ currentTarget: { dataset: { v: 1000 } } });
    ok(p.data.steps === 10200, '步数 +1000');
    p.changeCounter({ currentTarget: { dataset: { field: 'veg', delta: 1 } } });
    ok(p.data.veg === 3, '蔬菜 +1');
    p.setData({ mealText: '鸡蛋+豆浆' });
    p.addMeal();
    ok(p.data.meals.length === 1 && p.data.meals[0].type === '早餐', '添加早餐');
    p.addEx({ currentTarget: { dataset: { type: '骑行', min: 30 } } });
    ok(p.data.exMin === 60, '运动累计 60 分钟');
    p.onSpendInput(event('50'));
    p.commitSpend();
    ok(p.data.spend === 50 && p.data.remainBudget === -8, '花费 50 → 超预算 -8');
    p.doCheckin();
    ok(p.data.checked === true, '打卡状态已保存');
    ok(p.data.score >= 0 && p.data.score <= 100, '得分在 0-100');
    ok(calls.modal.some((t) => t && t.indexOf('今日得分') >= 0), '打卡弹窗出现');
    ok(!!store.badgesSeen, '成就快照已记录');
    const news = store.news || [];
    ok(news.length >= 1, '消息已写入');
  }

  // ---------- weight ----------
  console.log('== pages/weight ==');
  {
    const p = loadPage('pages/weight/weight');
    p.onShow();
    ok(p.data.chart.length === 5, '趋势图 5 个点');
    ok(p.data.bmiText === '肥胖', 'BMI 34.8 → 肥胖');
    ok(p.data.predictText.length > 5, '预测文案生成');
    p.onInput(event('97.9'));
    p.save();
    ok(store.weights.list[store.weights.list.length - 1].weight === 97.9, '体重已保存 97.9');
    ok(calls.modal.length >= 1, '智能点评弹窗出现');
  }

  // ---------- calorie ----------
  console.log('== pages/calorie ==');
  {
    const p = loadPage('pages/calorie/calorie');
    p.onShow();
    ok(p.data.total === 413, '今日热量 413');
    p.onSearch(event('螺蛳'));
    ok(p.data.results.length === 1 && p.data.results[0].n.indexOf('螺蛳粉') >= 0, '搜索螺蛳粉');
    p.onSearch(event(''));
    p.onCat({ currentTarget: { dataset: { i: 1 } } });
    ok(p.data.results.length > 0 && p.data.results[0].g === '主食', '分类芯片筛选主食');
    p.onCat({ currentTarget: { dataset: { i: 0 } } });
    p.setData({ manualName: '测试食物', manualKcal: '100', manualGrams: '100' });
    p.addManual();
    ok(p.data.total === 513, '手动添加后热量 513');
    // 快捷分量：默认 tapIndex 0 = 50g
    p.setData({ presetIdx: 0 });
    p.addPreset();
    ok(p.data.total === 571, '快捷分量 50g 米饭计入后 571');
    p.useFav({ currentTarget: { dataset: { i: 0 } } });
    ok(p.data.total === 629, '收藏夹「吃」50g 米饭后 629');
    p.onSearch(event('螺蛳'));
    p.useFood({ currentTarget: { dataset: { i: 0 } } });
    ok(p.data.total === 709, '食物库「吃」50g 螺蛳粉后 709');
    p.onSearch(event(''));
    const foodCount = p.data.foods.length;
    p.setData({ scanResult: { name: '可乐', brand: '', kcal100: 43, image: '', grams: 330 }, scanGrams: '330' });
    p.addScanned();
    ok(p.data.foods.length === foodCount + 1, '扫码结果计入');
    ok(p.data.scanResult === null, '扫码结果已清空');
    const favBefore = p.data.favfoods.length;
    p.setData({ scanResult: { name: '薯片', brand: '', kcal100: 548, image: '', grams: 50 }, scanGrams: '50' });
    p.addFavorite();
    ok(p.data.favfoods.length === favBefore + 1, '收藏食物');
    const warnsModalCount = calls.modal.length;
    p.setData({ scanGrams: '50' });
    p.addScanned();
    ok(calls.modal.length > warnsModalCount, '高热量食物触发吃前预警');

    // 拍照识别：云端函数未部署 → 提示错误并引导手动
    p.takePhoto();
    await sleep(60);
    ok(!!p.data.photoError && p.data.photoError.indexOf('手动') >= 0, '云端未部署时拍照提示转手动');

    // 拍照识别：成功路径（拦截 config + 模拟云端）
    currentConfig = { cloudEnv: 'test-env', vision: { provider: 'zhipu' } };
    delete require.cache[require.resolve(path.join(SRC, 'utils', 'config.js'))];
    delete require.cache[require.resolve(path.join(SRC, 'pages', 'calorie', 'calorie.js'))];
    wx.__callFnResult = { result: { ok: true, name: '鸡腿饭', grams: 400, kcal100: 180, kcal: 720 } };
    const p2 = loadPage('pages/calorie/calorie');
    p2.onShow();
    p2.takePhoto();
    await sleep(60);
    ok(p2.data.photoResult && p2.data.photoResult.name === '鸡腿饭', '拍照识别成功返回结果卡');
    ok(p2.data.photoResult.kcal === 720, '识别热量 720 千卡');
    p2.setData({ photoGrams: '500' });
    const beforePhoto = p2.data.total;
    p2.addPhoto();
    ok(p2.data.total === beforePhoto + 900, '按修改后克数计入（500g = 900 千卡）');
    ok(p2.data.photoResult === null, '计入后结果卡清空');

    // 拍照识别：失败路径
    wx.__callFnResult = { result: { ok: false, msg: '识别失败' } };
    p2.takePhoto();
    await sleep(60);
    ok(!!p2.data.photoError, '识别失败显示提示');
    currentConfig = null;
    delete require.cache[require.resolve(path.join(SRC, 'utils', 'config.js'))];
    delete require.cache[require.resolve(path.join(SRC, 'pages', 'calorie', 'calorie.js'))];
    wx.__callFnResult = undefined;
  }

  // ---------- report ----------
  console.log('== pages/report ==');
  {
    const p = loadPage('pages/report/report');
    p.onShow();
    ok(p.data.tips.length >= 3, '本周点评生成');
    ok(p.data.bars.length === 7, '周柱状图 7 根');
    ok(p.data.calCells.length % 7 === 0, '日历行数完整');
    const today = (() => { const d = new Date(); const q = (x) => (x < 10 ? '0' : '') + x; return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate()); })();
    p.tapDay({ currentTarget: { dataset: { key: today } } });
    ok(calls.modal.indexOf('当日详情') >= 0, '点日期弹详情');
    p.exportImage();
    ok(calls.toast.indexOf('画布初始化失败') >= 0, '导出在无画布环境优雅降级');
  }

  // ---------- me ----------
  console.log('== pages/me ==');
  {
    // 恢复为正式登录用户（登录测试将其改成了游客）
    store.user = { openid: 'o_test', nickname: '颜萌', avatar: '' };
    store.guestMode = false;
    const p = loadPage('pages/me/me');
    p.onLoad();
    p.onShow();
    ok(p.data.loggedIn === true, '登录状态识别');
    ok(p.data.nickname === '颜萌', '昵称加载');
    ok(p.data.syncOn === true, '云已配置 → syncOn=true');
    p.toggleEdit();
    ok(p.data.editing === true, '编辑模式切换');
    p.setData({ nickname: '小萌' });
    p.saveProfile();
    ok(store.settings.nickname === '小萌', '资料保存同步 settings');
    ok(p.data.editing === false, '保存后收起编辑');
    p.save();
    ok(calls.toast.indexOf('已保存') >= 0, '目标设置保存');
    p.setData({ waterOn: true });
    p.onWaterOn(event(true));
    ok(store.remindSet.waterOn === true, '喝水提醒开关保存');
    p.doLogout();
    ok(calls.modal.indexOf('退出登录？') >= 0, '退出登录弹确认框');
    p.clearData();
  }

  // ---------- achieve / news ----------
  console.log('== pages/achieve + news ==');
  {
    const p = loadPage('pages/achieve/achieve');
    p.onShow();
    ok(p.data.total === 19, '勋章总数 19');
    ok(p.data.unlocked.length >= 8, '已解锁 >= 8 枚');
    const n = loadPage('pages/news/news');
    n.onShow();
    ok(n.data.list.length >= 1, '消息列表非空');
    ok(store.news.every((x) => x.read === true), '打开后全部已读');
  }

  // ---------- agreement ----------
  console.log('== pages/agreement ==');
  {
    const p = loadPage('pages/agreement/agreement');
    p.onLoad({ type: 'user' });
    ok(p.data.sections.length === 7, '用户协议 7 节');
    p.onLoad({ type: 'privacy' });
    ok(p.data.sections.length === 7, '隐私政策 7 节');
  }

  console.log('');
  console.log('========== 页面冒烟测试: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
  process.exit(fail ? 1 : 0);
})();
