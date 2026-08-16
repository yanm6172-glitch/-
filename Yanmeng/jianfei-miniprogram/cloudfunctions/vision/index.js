const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// ⚠️ 智谱 AI 开放平台 https://open.bigmodel.cn 的 API Key（已配置）
const API_KEY = '8cd8155c10ac4a0eb696abccce96e967.kE9yjf49163jOMCN';
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4v-flash';

function postJson(url, headers, body) {
  return new Promise(function (resolve, reject) {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }, headers)
    }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.main = async (event) => {
  const fileID = event && event.fileID;
  if (!fileID) return { ok: false, msg: '缺少图片' };
  const key = process.env.ZHIPU_KEY || API_KEY;
  if (!key || key === 'YOUR_ZHIPU_KEY') return { ok: false, msg: '未配置 AI 密钥（cloudfunctions/vision/index.js 的 API_KEY）' };
  try {
    const dl = await cloud.downloadFile({ fileID: fileID });
    const base64 = dl.fileContent.toString('base64');
    const prompt = '识别图片中的食物。只返回一个JSON对象，格式：{"name":"食物名称","grams":估计的克重数字,"kcal100":每100克的热量千卡数字}。只输出JSON本身，不要任何其他文字或代码块标记。';
    const res = await postJson(API_URL, { Authorization: 'Bearer ' + key }, {
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } }
        ]
      }],
      temperature: 0.1
    });
    if (res.status !== 200) return { ok: false, msg: 'AI 服务错误 ' + res.status };
    const data = JSON.parse(res.body);
    let text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (Array.isArray(text)) text = text.map(function (t) { return t.text || ''; }).join('');
    let obj = null;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      const m = String(text).match(/\{[\s\S]*\}/);
      if (m) {
        try { obj = JSON.parse(m[0]); } catch (e2) { obj = null; }
      }
    }
    if (!obj || !obj.name) return { ok: false, msg: '识别失败，请手动输入' };
    const grams = Math.max(1, Math.min(2000, parseInt(obj.grams, 10) || 100));
    const kcal100 = Math.max(0, Math.min(900, parseInt(obj.kcal100, 10) || 0));
    const kcal = Math.round((kcal100 * grams) / 100);
    return { ok: true, name: String(obj.name).slice(0, 20), grams: grams, kcal100: kcal100, kcal: kcal };
  } catch (e) {
    return { ok: false, msg: '识别失败：' + (e && e.message ? e.message : '网络错误') };
  }
};
