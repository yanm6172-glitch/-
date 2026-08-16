function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 返回 YYYY-MM-DD
function dateKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// YYYY-MM-DD -> M/D
function fmtMD(key) {
  const p = String(key).split('-');
  if (p.length < 3) return key;
  return parseInt(p[1], 10) + '/' + parseInt(p[2], 10);
}

// 周一=0 ... 周日=6
function weekdayCN(d) {
  return (d.getDay() + 6) % 7;
}

// 某月天数与1号是周几（周一=0）
function monthInfo(year, month) {
  const days = new Date(year, month, 0).getDate();
  const firstWeekday = weekdayCN(new Date(year, month - 1, 1));
  return { days: days, firstWeekday: firstWeekday };
}

// 所在周的周一
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - weekdayCN(d));
  return d;
}

module.exports = {
  dateKey: dateKey,
  fmtMD: fmtMD,
  weekdayCN: weekdayCN,
  monthInfo: monthInfo,
  mondayOf: mondayOf
};
