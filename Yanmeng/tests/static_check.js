// 静态检查：页面文件完整性、tabBar、require 路径、WXML 事件绑定、WXML 标签配对
// 运行：node static_check.js
const path = require('path');
const fs = require('fs');

const SRC = process.env.MP_SRC || path.join(__dirname, '..', 'jianfei-miniprogram');
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

// 1. app.json 页面完整性
console.log('== 页面完整性 ==');
const appJson = JSON.parse(read(path.join(SRC, 'app.json')));
const pages = appJson.pages;
pages.forEach(p => {
  const dir = path.join(SRC, p);
  const ok4 = ['js', 'json', 'wxml', 'wxss'].every(ext => read(dir + '.' + ext) !== null);
  ok(ok4, p + ' 四件套齐全');
});
appJson.tabBar.list.forEach(t => {
  ok(pages.indexOf(t.pagePath) >= 0, 'tabBar 页在 pages 中: ' + t.pagePath);
});
ok(pages[0] === 'pages/login/login', '入口页为登录页');
ok(fs.existsSync(path.join(SRC, 'theme.json')), 'theme.json 存在');
ok(fs.existsSync(path.join(SRC, 'sitemap.json')), 'sitemap.json 存在');

// 2. require 路径解析
console.log('== require 路径 ==');
function walk(dir, out) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  });
}
const jsFiles = [];
walk(SRC, jsFiles);
let reqBad = 0;
jsFiles.forEach(f => {
  const src = read(f);
  const re = /require\((['"])(\.[^'"]+)\1\)/g;
  let m;
  while ((m = re.exec(src))) {
    let target = path.resolve(path.dirname(f), m[2]);
    if (!target.endsWith('.js')) target += '.js';
    if (!fs.existsSync(target)) { reqBad++; console.log('  MISS', path.relative(SRC, f), '->', m[2]); }
  }
});
ok(reqBad === 0, '所有 require 路径可解析');

// 3. WXML 事件处理器与标签配对
console.log('== WXML 检查 ==');
const SELF_CLOSE = new Set(['input', 'image', 'switch', 'canvas', 'import', 'include', 'progress']);
let handlerBad = 0;
pages.forEach(p => {
  const wxml = read(path.join(SRC, p + '.wxml'));
  const js = read(path.join(SRC, p + '.js'));
  if (!wxml || !js) return;
  // 处理器
  const hre = /(?:bind|catch)[a-z]+\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"|bindtap="\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}"/g;
  let m;
  while ((m = hre.exec(wxml))) {
    const name = m[1] || m[2];
    if (!new RegExp('\\b' + name + '\\s*\\(').test(js)) {
      handlerBad++;
      console.log('  MISS HANDLER', p, '->', name);
    }
  }
  // 标签配对
  const stack = [];
  const tre = /<(\/?)([a-z-]+)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
  while ((m = tre.exec(wxml))) {
    const [, close, tag, , selfc] = m;
    if (selfc || SELF_CLOSE.has(tag)) continue;
    if (!close) stack.push(tag);
    else {
      const top = stack.pop();
      if (top !== tag) {
        handlerBad++;
        console.log('  TAG MISMATCH', p, '期望 </' + top + '> 得到 </' + tag + '>');
      }
    }
  }
  if (stack.length) {
    handlerBad++;
    console.log('  TAG UNCLOSED', p, stack.join(','));
  }
});
ok(handlerBad === 0, 'WXML 处理器与标签配对正确');

// 4. WXSS 花括号配平 + 真机不兼容语法（* 通配选择器）
console.log('== WXSS 检查 ==');
let wxssBad = 0;
pages.forEach(p => {
  const wxss = read(path.join(SRC, p + '.wxss'));
  if (!wxss) return;
  // 去除注释后检查 * 选择器（WXSS 真机编译不支持）
  const noComment = wxss.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/(^|[\s,>+~])\*/.test(noComment)) {
    wxssBad++;
    console.log('  WXSS 含 * 通配选择器（真机编译报错）:', p);
  }
  let depth = 0, inComment = false, line = 1;
  for (let i = 0; i < wxss.length; i++) {
    const c = wxss[i];
    const c2 = wxss[i + 1];
    if (inComment) {
      if (c === '*' && c2 === '/') { inComment = false; i++; }
      continue;
    }
    if (c === '/' && c2 === '*') { inComment = true; i++; continue; }
    if (c === '\n') line++;
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth < 0) {
      wxssBad++;
      console.log('  WXSS 多余 }', p, '第' + line + '行');
      depth = 0;
    }
  }
  if (depth !== 0) {
    wxssBad++;
    console.log('  WXSS 花括号未闭合', p, '差', depth);
  }
});
ok(wxssBad === 0, '所有 WXSS 花括号配平');

// 5. 云函数完整性
console.log('== 云函数 ==');
['login', 'family', 'reminder', 'vision'].forEach(fn => {
  const dir = path.join(SRC, 'cloudfunctions', fn);
  ok(read(path.join(dir, 'index.js')) && read(path.join(dir, 'package.json')), fn + ' 云函数文件齐全');
});
ok(read(path.join(SRC, 'cloudfunctions', 'reminder', 'config.json')), 'reminder 触发器配置存在');

console.log('');
console.log('========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
