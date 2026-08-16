const util = require('../../utils/util.js');
const FOODS_CN = require('../../data/foods-cn.js');
const smart = require('../../utils/smart.js');
const ach = require('../../utils/achievements.js');
const config = require('../../utils/config.js');

const CATS = ['全部', '主食', '肉蛋', '水产', '豆制品', '蔬菜', '水果', '奶饮', '零食', '快餐'];

// 常用食物每100g热量（千卡），参考中国食物成分表，均为估算值
const PRESETS = [
  { name: '米饭（熟）', kcal100: 116, grams: 150 },
  { name: '馒头', kcal100: 223, grams: 100 },
  { name: '鸡蛋（全蛋）', kcal100: 144, grams: 60 },
  { name: '鸡胸肉', kcal100: 133, grams: 100 },
  { name: '猪瘦肉', kcal100: 143, grams: 100 },
  { name: '牛肉（瘦）', kcal100: 125, grams: 100 },
  { name: '豆腐', kcal100: 81, grams: 100 },
  { name: '苹果', kcal100: 53, grams: 200 },
  { name: '香蕉', kcal100: 93, grams: 120 },
  { name: '纯牛奶', kcal100: 54, grams: 250 },
  { name: '酸奶', kcal100: 72, grams: 150 },
  { name: '可乐', kcal100: 43, grams: 330 }
];

Page({
  data: {
    goal: 1500,
    foods: [],
    total: 0,
    remain: 0,
    pct: 0,
    // 扫码
    scanning: false,
    scanResult: null,
    scanGrams: '',
    scanError: '',
    // 拍照识别
    photoLoading: false,
    photoResult: null,
    photoGrams: '',
    photoError: '',
    photoText: '',
    photoReviewing: false,
    // 收藏
    favfoods: [],
    favOn: false,
    // 常用食物
    presetIdx: 0,
    presetNames: [],
    presetGrams: '',
    // 手动输入
    manualName: '',
    manualKcal: '',
    manualGrams: '',
    // 中国食物库
    categories: CATS,
    catIdx: 0,
    q: '',
    results: []
  },

  onLoad() {
    this.setData({
      presetNames: PRESETS.map(function (p) { return p.name + ' · ' + p.kcal100 + ' 千卡/100g'; })
    });
    this.applyFilter();
  },

  onShow() {
    this.loadAll();
  },

  loadAll() {
    const settings = wx.getStorageSync('settings') || {};
    const dailies = wx.getStorageSync('dailies') || {};
    this.today = util.dateKey();
    const d = dailies[this.today] || {};
    const foods = d.foods || [];
    const total = Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
    const goal = Number(settings.dailyCalorie) || 1500;
    const remain = goal - total;
    const pct = Math.min(100, Math.round((total / goal) * 100));
    const favfoods = wx.getStorageSync('favfoods') || [];
    this.setData({ foods: foods, total: total, goal: goal, remain: remain, pct: pct, favfoods: favfoods });
  },

  saveFoods(foods) {
    const dailies = wx.getStorageSync('dailies') || {};
    const cur = dailies[this.today] || {};
    dailies[this.today] = Object.assign({}, cur, { foods: foods });
    wx.setStorageSync('dailies', dailies);
  },

  addFood(item) {
    const foods = this.data.foods.slice();
    const t = new Date();
    const hm = (t.getHours() < 10 ? '0' : '') + t.getHours() + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
    foods.unshift(Object.assign({ id: Date.now(), time: hm }, item));
    this.saveFoods(foods);
    this.loadAll();
    // 智能预警：高热量 / 本周超频
    const warns = smart.foodWarn(item);
    if (warns.length) {
      wx.showModal({
        title: '⚠️ 吃前提醒',
        content: warns.join('\n'),
        showCancel: false,
        confirmText: '知道了'
      });
    }
    // 成就检查
    const fresh = ach.checkNew();
    if (fresh.length) {
      setTimeout(function () {
        wx.showModal({
          title: '🏅 解锁新成就',
          content: fresh.map(function (b) { return b.icon + ' ' + b.name; }).join('\n'),
          showCancel: false,
          confirmText: '太棒了'
        });
      }, 700);
    }
  },

  delFood(e) {
    const id = Number(e.currentTarget.dataset.id);
    const foods = this.data.foods.filter(function (f) { return f.id !== id; });
    this.saveFoods(foods);
    this.loadAll();
  },

  /* ---- 拍食物：AI 识别估重算热量 ---- */
  takePhoto() {
    const that = this;
    const cloudOn = !!(config.cloudEnv && config.cloudEnv !== 'YOUR-ENV-ID' && wx.cloud);
    if (!cloudOn) {
      wx.showModal({
        title: '拍照识别需要云开发',
        content: '请先按 README 开通云开发、部署 vision 云函数并配置 AI 密钥。现在可以先用下方「手动添加」记录。',
        showCancel: false
      });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success(res) {
        const temp = res.tempFiles && res.tempFiles[0] ? res.tempFiles[0].tempFilePath : '';
        if (!temp) return;
        that.setData({ photoLoading: true, photoError: '', photoResult: null, photoText: '' });
        wx.cloud.uploadFile({
          cloudPath: 'photos/' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.jpg',
          filePath: temp,
          success(up) {
            wx.cloud.callFunction({ name: 'vision', data: { fileID: up.fileID } })
              .then(function (r) {
                const v = r.result || {};
                if (v.ok) {
                  that.setData({
                    photoLoading: false,
                    photoResult: { name: v.name, grams: v.grams, kcal100: v.kcal100, kcal: v.kcal, image: temp, fileID: up.fileID },
                    photoGrams: String(v.grams)
                  });
                } else {
                  that.setData({ photoLoading: false, photoError: (v.msg || '识别失败') + '。可先用下方「手动添加」记录。' });
                }
              })
              .catch(function () {
                that.setData({ photoLoading: false, photoError: '识别服务调用失败（vision 云函数未部署？）。可先用下方「手动添加」记录。' });
              });
          },
          fail() {
            that.setData({ photoLoading: false, photoError: '图片上传失败，可先用下方「手动添加」记录。' });
          }
        });
      },
      fail() {}
    });
  },

  onPhotoGrams(e) {
    this.setData({ photoGrams: e.detail.value });
  },

  addPhoto() {
    const r = this.data.photoResult;
    if (!r) return;
    const grams = parseFloat(this.data.photoGrams);
    if (isNaN(grams) || grams <= 0) {
      wx.showToast({ title: '请填克数', icon: 'none' });
      return;
    }
    const kcal = Math.round((r.kcal100 * grams) / 100);
    this.addFood({ name: r.name, kcal100: r.kcal100, grams: Math.round(grams), kcal: kcal, source: 'photo', image: r.fileID || '' });
    this.setData({ photoResult: null, photoGrams: '', photoText: '' });
    wx.showToast({ title: '已计入 ' + kcal + ' 千卡', icon: 'success' });
  },

  /* ---- AI 点评这顿饭 ---- */
  reviewPhoto() {
    const r = this.data.photoResult;
    if (!r || !r.fileID) {
      wx.showToast({ title: '先拍一张食物照片', icon: 'none' });
      return;
    }
    if (this.data.photoReviewing) return;
    const that = this;
    this.setData({ photoReviewing: true });
    wx.cloud.callFunction({ name: 'vision', data: { action: 'review', fileID: r.fileID } })
      .then(function (res) {
        that.setData({ photoReviewing: false });
        const v = res.result || {};
        if (v.ok) {
          that.setData({ photoText: v.text || '这顿饭整体不错，继续保持！' });
          wx.showToast({ title: '点评完成', icon: 'success' });
        } else {
          wx.showModal({ title: '点评失败', content: (v.msg || '请稍后再试'), showCancel: false });
        }
      })
      .catch(function () {
        that.setData({ photoReviewing: false });
        wx.showModal({ title: '点评失败', content: 'vision 云函数未部署或网络异常。', showCancel: false });
      });
  },

  favPhoto() {
    const r = this.data.photoResult;
    if (!r) return;
    let favfoods = wx.getStorageSync('favfoods') || [];
    if (!favfoods.some(function (f) { return f.name === r.name; })) {
      favfoods = favfoods.slice();
      favfoods.unshift({ name: r.name, brand: '', kcal100: r.kcal100 });
      wx.setStorageSync('favfoods', favfoods);
      this.setData({ favfoods: favfoods });
    }
    wx.showToast({ title: '已收藏 ⭐', icon: 'success' });
  },

  /* ---- 快捷分量选择：50~300g 一键计入 ---- */
  quickAdd(name, kcal100) {
    const that = this;
    wx.showActionSheet({
      itemList: ['50g', '100g', '150g', '200g', '250g', '300g', '自定义克数'],
      success(res) {
        const i = res.tapIndex;
        const gs = [50, 100, 150, 200, 250, 300];
        if (i >= 0 && i < 6) {
          const grams = gs[i];
          const kcal = Math.round((kcal100 * grams) / 100);
          that.addFood({ name: name, kcal100: kcal100, grams: grams, kcal: kcal, source: 'quick' });
          wx.showToast({ title: '已计入 ' + kcal + ' 千卡', icon: 'success' });
        } else if (i === 6) {
          that.setData({ manualName: name, manualKcal: String(kcal100), manualGrams: '' });
          wx.showToast({ title: '已填入手动区，填克数后计入', icon: 'none' });
        }
      }
    });
  },

  /* ---- 扫一扫 ---- */
  scan() {
    const that = this;
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['barCode'],
      success(res) {
        that.lookup(res.result);
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '扫码失败，试试手动输入', icon: 'none' });
      }
    });
  },

  lookup(code) {
    const that = this;
    this.setData({ scanning: true, scanError: '', scanResult: null });
    wx.request({
      url: 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json',
      data: { fields: 'product_name,brands,quantity,image_front_url,nutriments' },
      header: { 'User-Agent': 'JianfeiDaka/1.0 (WeChat MiniProgram)' },
      success(res) {
        const data = res.data || {};
        if (data.status !== 1 || !data.product) {
          that.setData({
            scanning: false,
            scanError: '没查到条码 ' + code + ' 对应的商品\n可对照包装上的营养成分表，用下方「手动添加」记录'
          });
          return;
        }
        const p = data.product;
        const n = p.nutriments || {};
        let kcal100 = null;
        if (typeof n['energy-kcal_100g'] === 'number') {
          kcal100 = n['energy-kcal_100g'];
        } else if (typeof n['energy_100g'] === 'number') {
          kcal100 = Math.round(n['energy_100g'] / 4.184);
        }
        if (kcal100 == null) {
          that.setData({
            scanning: false,
            scanError: '查到了「' + (p.product_name || '该商品') + '」，但数据库里没有热量数据\n可对照包装营养成分表手动添加'
          });
          return;
        }
        let grams = 100;
        const q = String(p.quantity || '');
        const m = q.match(/(\d+(?:\.\d+)?)\s*(g|ml|kg|l)/i);
        if (m) {
          let v = parseFloat(m[1]);
          if (m[2].toLowerCase() === 'kg' || m[2].toLowerCase() === 'l') v = v * 1000;
          grams = Math.round(v);
        }
        that.setData({
          scanning: false,
          scanResult: {
            name: p.product_name || '未命名商品',
            brand: p.brands || '',
            kcal100: kcal100,
            image: p.image_front_url || '',
            grams: grams
          },
          scanGrams: String(grams)
        });
      },
      fail() {
        that.setData({
          scanning: false,
          scanError: '请求失败（网络不通或域名未配置）\n请用「手动添加」记录；正式使用需按 README 配置 request 合法域名'
        });
      }
    });
  },

  onScanGrams(e) {
    this.setData({ scanGrams: e.detail.value });
  },

  addScanned() {
    const r = this.data.scanResult;
    if (!r) return;
    const grams = parseFloat(this.data.scanGrams);
    if (isNaN(grams) || grams <= 0) {
      wx.showToast({ title: '请填写克数', icon: 'none' });
      return;
    }
    const kcal = Math.round((r.kcal100 * grams) / 100);
    this.addFood({
      name: r.name,
      brand: r.brand,
      kcal100: r.kcal100,
      grams: Math.round(grams),
      kcal: kcal,
      source: 'scan'
    });
    this.setData({ scanResult: null, scanGrams: '' });
    wx.showToast({ title: '已计入 ' + kcal + ' 千卡', icon: 'success' });
  },

  /* ---- 食物收藏夹 ---- */
  addFavorite() {
    const r = this.data.scanResult;
    if (!r) return;
    let favfoods = wx.getStorageSync('favfoods') || [];
    const exists = favfoods.some(function (f) { return f.name === r.name; });
    if (exists) {
      wx.showToast({ title: '已经在收藏夹里了', icon: 'none' });
      return;
    }
    favfoods = favfoods.slice();
    favfoods.unshift({ name: r.name, brand: r.brand || '', kcal100: r.kcal100 });
    wx.setStorageSync('favfoods', favfoods);
    this.setData({ favfoods: favfoods });
    wx.showToast({ title: '已收藏 ⭐', icon: 'success' });
  },

  useFav(e) {
    const i = Number(e.currentTarget.dataset.i);
    const f = this.data.favfoods[i];
    if (!f) return;
    this.quickAdd(f.name, f.kcal100);
  },

  delFav(e) {
    const i = Number(e.currentTarget.dataset.i);
    const favfoods = this.data.favfoods.filter(function (f, idx) { return idx !== i; });
    wx.setStorageSync('favfoods', favfoods);
    this.setData({ favfoods: favfoods });
  },

  toggleFav(e) {
    this.setData({ favOn: e.detail.value });
  },

  /* ---- 常用食物 ---- */
  onPreset(e) {
    this.setData({ presetIdx: Number(e.detail.value) });
  },

  onPresetGrams(e) {
    this.setData({ presetGrams: e.detail.value });
  },

  addPreset() {
    const p = PRESETS[this.data.presetIdx];
    if (!p) return;
    this.quickAdd(p.name, p.kcal100);
  },

  /* ---- 手动添加 ---- */
  onManualName(e) {
    this.setData({ manualName: e.detail.value });
  },

  onManualKcal(e) {
    this.setData({ manualKcal: e.detail.value });
  },

  onManualGrams(e) {
    this.setData({ manualGrams: e.detail.value });
  },

  addManual() {
    const name = (this.data.manualName || '').trim();
    const kcal100 = parseFloat(this.data.manualKcal);
    const grams = parseFloat(this.data.manualGrams);
    if (!name) {
      wx.showToast({ title: '填食品名称', icon: 'none' });
      return;
    }
    if (isNaN(kcal100) || kcal100 <= 0) {
      wx.showToast({ title: '填每100g千卡（看包装）', icon: 'none' });
      return;
    }
    if (isNaN(grams) || grams <= 0) {
      wx.showToast({ title: '填吃了多少克', icon: 'none' });
      return;
    }
    const kcal = Math.round((kcal100 * grams) / 100);
    this.addFood({ name: name, kcal100: kcal100, grams: Math.round(grams), kcal: kcal, source: 'manual' });
    if (this.data.favOn) {
      let favfoods = wx.getStorageSync('favfoods') || [];
      if (!favfoods.some(function (f) { return f.name === name; })) {
        favfoods = favfoods.slice();
        favfoods.unshift({ name: name, brand: '', kcal100: kcal100 });
        wx.setStorageSync('favfoods', favfoods);
        this.setData({ favfoods: favfoods });
      }
    }
    this.setData({ manualName: '', manualKcal: '', manualGrams: '', favOn: false });
    wx.showToast({ title: '已计入 ' + kcal + ' 千卡', icon: 'success' });
  },

  /* ---- 中国食物库 ---- */
  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.applyFilter();
  },

  onCat(e) {
    this.setData({ catIdx: Number(e.currentTarget.dataset.i) });
    this.applyFilter();
  },

  applyFilter() {
    const cat = this.data.categories[this.data.catIdx];
    const q = (this.data.q || '').trim();
    let list = FOODS_CN;
    if (cat !== '全部') {
      list = list.filter(function (f) { return f.g === cat; });
    }
    if (q) {
      list = list.filter(function (f) {
        return f.n.indexOf(q) >= 0 || (f.note && f.note.indexOf(q) >= 0);
      });
    }
    this.setData({ results: list.slice(0, 50) });
  },

  useFood(e) {
    const i = Number(e.currentTarget.dataset.i);
    const f = this.data.results[i];
    if (!f) return;
    this.quickAdd(f.n, f.c);
  },

  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  },

  onShareAppMessage() {
    return { title: '扫描食品记热量，和我一起减肥！', path: '/pages/calorie/calorie' };
  }
});
