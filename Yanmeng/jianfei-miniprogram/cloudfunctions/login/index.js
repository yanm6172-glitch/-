const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 返回当前用户 openid
exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  return { openid: OPENID };
};
