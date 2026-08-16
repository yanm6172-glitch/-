# DeepSeek Harness 多媒体能力增强（图像识别 + 图像生成 + 视频生成）

> 配置位置：`C:\Users\user\.dsh\profiles\web\cordis.patch.yml`（该文件被 harness 热监听，改动即生效）

## 已集成的能力

| 能力 | 工具名 | 来源插件 | 模型 |
|---|---|---|---|
| 图像识别（OCR/UI/截图/图表） | `mcp__luma__image_understand` | [luma-mcp](https://github.com/JochenYang/luma-mcp) | qwen3-vl-flash（可换 GLM-4.6V / DeepSeek-OCR / 豆包 / 混元） |
| 图像生成 | `mcp__media-gen__generate_image` | [media-gen-mcp](https://github.com/wangdong233/media-gen-mcp) | 通义万相 wan2.2-t2i |
| 视频生成 | `mcp__media-gen__generate_video` | 同上 | 通义万相 wan2.2-t2v（最长约 10 分钟，工具超时已放宽到 11 分钟） |

三者共用同一个 **阿里云百炼 DashScope API Key**，通过 harness 内置的
`@deepseek-ai/dsh-mcp-client`（stdio 传输）接入，工具以 `mcp__<服务器>__<工具>` 命名。

## 启用步骤

1. 注册并领取 [阿里云百炼](https://bailian.console.aliyun.com/) 的 API Key（qwen3-vl-flash 与 wanx 系列对新用户有免费额度）。
2. 设置环境变量并重启 DSH：

   ```powershell
   setx DASHSCOPE_API_KEY "sk-你的key"
   ```

3. 重启 DSH（或任意改动 `cordis.patch.yml` 触发热重载）。
   - 无 key 时 `media-gen` 行自动休眠（避免崩溃重连风暴）；
   - `luma` 行始终在线，无 key 时调用会返回明确的鉴权错误。

## 可选配置

- 换视觉提供商：设 `MCP_VISION_PROVIDER=zhipu|siliconflow|volcengine|hunyuan` 并配置对应 key
  （`ZHIPU_API_KEY` / `SILICONFLOW_API_KEY` / `VOLCENGINE_API_KEY` / `HUNYUAN_API_KEY`）。
  - `siliconflow` = DeepSeek-OCR（硅基流动，免费额度）
  - `zhipu` = GLM-4.6V（深度理解最佳）
- 不想放环境变量：直接把 patch 里 `env` 的 `!!js` 表达式换成明文 key 字符串。

## 备选/未采用的 GitHub 项目

- [glm4v-vision-mcp](https://github.com/ethanweave/glm4v-vision-mcp) — GLM-4.6V 识图，专为 DeepSeek Harness 设计（Python/uv 运行，未上 npm）
- [llm-vision-mcp](https://github.com/me9rez/llm-vision-mcp) — ModelScope 免费通义千问 VL 识图
- [nanobanana-mcp](https://github.com/YCSE/nanobanana-mcp) — Gemini 视觉 + 生图
- [ai-video-api](https://github.com/starryrbs/ai-video-api) — OpenAI/Stability/Runway 视频接口聚合（需多平台 key）
- [awesome-free-models](https://github.com/12britz/awesome-free-models) — 免费模型/API 清单（含 Pollinations 免费生图）
- Pollinations.ai — 免 key 生图 HTTP API，可作为后续免 key 备胎方案
