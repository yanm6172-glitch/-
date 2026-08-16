// 全局配置 —— 使用云功能前必须修改这里
module.exports = {
  // ⚠️ 云开发环境ID（已配置）
  cloudEnv: 'wxc641774f15ae0cd9',

  // ⚠️ 拍照识别食物（视觉大模型）：API Key 配置在 cloudfunctions/vision/index.js 的 API_KEY
  // 智谱 AI 开放平台注册（免费）：https://open.bigmodel.cn
  vision: {
    provider: 'zhipu',
    model: 'glm-4v-flash'
  },

  // ⚠️ 订阅消息模板ID：mp后台「功能-订阅消息」选用模板后填入
  // data 的字段名（thing1/time2）要和你选的模板字段一致，不一致请照着模板改
  remind: {
    water: {
      id: 'WATER_TMPL_ID',
      data: {
        thing1: { value: '该喝水啦，今天目标 2000ml' },
        time2: { value: '15:00' }
      }
    },
    weigh: {
      id: 'WEIGH_TMPL_ID',
      data: {
        thing1: { value: '每周称重时间到，起床空腹称' },
        time2: { value: '08:00' }
      }
    },
    // 周报推送：thing1 的内容由云函数在发送时自动生成（本周数据总结），这里只给默认值
    weekly: {
      id: 'WEEKLY_TMPL_ID',
      data: {
        thing1: { value: '本周总结' },
        time2: { value: '每周一 08:00' }
      }
    }
  }
};
