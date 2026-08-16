const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// API Key 从 key.local.js 读取（gitignore 排除）
let LOCAL_KEY = '';
try {
  LOCAL_KEY = require('./key.local.js').key || '';
} catch (e) {
  LOCAL_KEY = '';
}
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4-flash';

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
  const key = process.env.ZHIPU_KEY || LOCAL_KEY;
  if (!key) return { ok: false, msg: '未配置 AI 密钥（请在 cloudfunctions/ai/key.local.js 填写）' };
  const input = event && event.text ? String(event.text).slice(0, 3000) : '';
  if (!input) return { ok: false, msg: '缺少饮食数据' };
  try {
    const prompt = '你是一位专业又亲切的减肥饮食教练。根据下面的用户今日数据，写一段点评，要求：\n'
      + '1. 分三段，每段以「👍」「⚠️」「💡」开头\n'
      + '2. 👍做得好的（至少1条）；⚠️要注意的（如有）；💡明天的具体建议（1-2条）\n'
      + '3. 口语化、鼓励为主、不说教，总字数180字以内，每段内容用换行分隔，不要标题和多余开场。\n\n'
      + '用户今日数据：\n' + input;
    const res = await postJson(API_URL, { Authorization: 'Bearer ' + key }, {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
    if (res.status !== 200) return { ok: false, msg: 'AI 服务错误 ' + res.status };
    const data = JSON.parse(res.body);
    let text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (Array.isArray(text)) text = text.map(function (t) { return t.text || ''; }).join('');
    text = String(text || '').trim();
    if (!text) return { ok: false, msg: 'AI 无返回内容，稍后再试' };
    return { ok: true, text: text.slice(0, 600) };
  } catch (e) {
    return { ok: false, msg: '点评失败：' + (e && e.message ? e.message : '网络错误') };
  }
};
