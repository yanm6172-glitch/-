// 周报图片导出：canvas 绘制 → 保存到相册
const util = require('./util.js');

function dayCal(d) {
  const foods = d.foods || [];
  return Math.round(foods.reduce(function (s, f) { return s + (f.kcal || 0); }, 0));
}

function weekData() {
  const settings = wx.getStorageSync('settings') || {};
  const dailies = wx.getStorageSync('dailies') || {};
  const weights = wx.getStorageSync('weights') || { list: [] };
  const goal = Number(settings.dailyCalorie) || 1500;
  const base = util.mondayOf(new Date());
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    keys.push(util.dateKey(d));
  }
  const days = keys.map(function (k) { return dailies[k] || {}; });
  let logDays = 0, sumCal = 0, overDays = 0, sumSpend = 0, spendDays = 0, exTotal = 0, checkDays = 0;
  const bars = days.map(function (d, i) {
    const cal = dayCal(d);
    if (cal > 0) {
      logDays++;
      sumCal += cal;
      if (cal > goal) overDays++;
    }
    const spend = Number(d.spend) || 0;
    if (spend > 0) {
      sumSpend += spend;
      spendDays++;
    }
    exTotal += Number(d.exMin) || 0;
    if (d.checked) checkDays++;
    return { label: ['一', '二', '三', '四', '五', '六', '日'][i], cal: cal };
  });
  const wl = (weights.list || []).filter(function (x) { return x.date >= keys[0] && x.date <= keys[6]; });
  const wd = wl.length >= 2 ? +(wl[wl.length - 1].weight - wl[0].weight).toFixed(1) : null;
  const current = (weights.list || []).length ? weights.list[weights.list.length - 1].weight : null;
  const lost = current != null ? +Math.max(0, (Number(settings.startWeight) || 100) - current).toFixed(1) : 0;
  return {
    range: keys[0].slice(5).replace('-', '/') + ' ~ ' + keys[6].slice(5).replace('-', '/'),
    current: current,
    lost: lost,
    target: Number(settings.targetWeight) || 65,
    logDays: logDays,
    avgCal: logDays ? Math.round(sumCal / logDays) : 0,
    overDays: overDays,
    avgSpend: spendDays ? (sumSpend / spendDays).toFixed(1) : 0,
    exTotal: exTotal,
    checkDays: checkDays,
    wd: wd,
    bars: bars,
    goal: goal
  };
}

function exportWeek(page) {
  const data = weekData();
  wx.createSelectorQuery().in(page).select('#exportCanvas').fields({ node: true, size: true }).exec(function (res) {
    if (!res || !res[0] || !res[0].node) {
      wx.showToast({ title: '画布初始化失败', icon: 'none' });
      return;
    }
    const canvas = res[0].node;
    const W = 750;
    const H = 1250;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4f7f5';
    ctx.fillRect(0, 0, W, H);

    // 头部
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#16a34a');
    g.addColorStop(1, '#22c55e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('减重打卡 · 每周报告', 40, 100);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(data.range, 40, 160);

    // 概览
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('本周概览', 40, 290);
    const remain = data.current != null ? +Math.max(0, data.current - data.target).toFixed(1) : null;
    const stats = [
      ['当前体重', data.current != null ? data.current + ' kg' : '--'],
      ['已减', data.lost + ' kg'],
      ['距目标', remain != null ? remain + ' kg' : '--'],
      ['记录天数', data.logDays + ' / 7'],
      ['日均热量', data.avgCal ? data.avgCal + ' 千卡' : '--'],
      ['超标天数', data.overDays + ' 天'],
      ['日均花费', data.avgSpend ? data.avgSpend + ' 元' : '--'],
      ['运动', data.exTotal + ' 分钟'],
      ['打卡天数', data.checkDays + ' 天'],
      ['体重变化', data.wd != null ? (data.wd > 0 ? '+' : '') + data.wd + ' kg' : '--']
    ];
    stats.forEach(function (s, i) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 350;
      const y = 330 + row * 90;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '24px sans-serif';
      ctx.fillText(s[0], x, y);
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(s[1], x, y + 48);
    });

    // 柱状图
    const chartY = 850;
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('每日热量（目标 ' + data.goal + ' 千卡）', 40, chartY - 20);
    const maxH = 220;
    const scale = 1.5 * data.goal;
    data.bars.forEach(function (b, i) {
      const bw = 70;
      const gap = 22;
      const x = 40 + i * (bw + gap);
      const h = b.cal > 0 ? Math.max(8, Math.round((b.cal / scale) * maxH)) : 6;
      ctx.fillStyle = b.cal === 0 ? '#e5e7eb' : (b.cal > data.goal ? '#ef4444' : '#16a34a');
      ctx.fillRect(x, chartY + 30 + (maxH - h), bw, h);
      if (b.cal > 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '22px sans-serif';
        ctx.fillText(String(b.cal), x, chartY + 20 + (maxH - h));
      }
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(b.label, x + bw / 2 - 10, chartY + 40 + maxH + 30);
    });

    // 底部
    ctx.fillStyle = '#9ca3af';
    ctx.font = '22px sans-serif';
    ctx.fillText('记录每一天 · 遇见更好的自己', 40, H - 60);
    ctx.fillText('由「减重打卡」小程序生成', 40, H - 30);

    wx.canvasToTempFilePath({
      canvas: canvas,
      success: function (r) {
        wx.saveImageToPhotosAlbum({
          filePath: r.tempFilePath,
          success: function () {
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function (err) {
            if (err && err.errMsg && err.errMsg.indexOf('auth') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在系统设置中允许小程序保存到相册',
                showCancel: false
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: function () {
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    });
  });
}

module.exports = {
  exportWeek: exportWeek
};
