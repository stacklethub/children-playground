# TTS 代理 Worker

把 Azure 语音服务的订阅 key 挡在服务端，顺带缓存高频文本（引导语、表扬语、鼓励语）。

## 为什么需要它

Azure 的 `Ocp-Apim-Subscription-Key` 若放前端，任何人 F12 即可抄走并盗刷配额。
本 Worker 是 key 唯一的存放处 —— 它只出现在出站请求头里，不进仓库、不进前端、
不进日志、不进任何响应体。

## 部署

1. 申请 Azure AI Speech，创建 **F0 免费层**资源（每月 50 万字符，不超额计费），
   记下 key 与 region（如 `eastasia`）
2. 写入 secret 并部署：

   ```bash
   cd apps/tts-proxy
   npx wrangler secret put AZURE_SPEECH_KEY
   npx wrangler secret put AZURE_SPEECH_REGION
   npx wrangler deploy
   ```

3. 把 `wrangler.toml` 里的 `ALLOWED_ORIGIN` 改成前端真实域名后重新部署
4. 前端 `apps/web-antd/.env.production` 里把 `VITE_TTS_PROXY_URL` 指向 Worker 地址

本地联调用 `npx wrangler dev`（默认 8787 端口，与 `.env.development` 里的一致）。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/voices` | 返回精选音色列表。它是白名单的**单一事实来源**，前端下拉与 `POST /tts` 的校验都用它，避免前后端各存一份后漂移 |
| POST | `/tts` | body `{ text, lang, voice?, rate?, pitch? }` → `audio/mpeg` |

`text` 上限 300 字符，超限返回 400 且不调用上游 —— 防止 Worker 被当作免费 TTS 代理刷爆额度。
`voice` 为空时按 `lang` 取该语言的第一个音色。

缓存键是 `(text, lang, voice, rate, pitch)` 的哈希。引导语与表扬语高度重复，
命中率直接决定 Azure 额度消耗。

## 上线前必须确认

- **不要升级到 S0 付费层。** 当前架构假定最坏情况只是 F0 配额被刷爆（发音暂时失效）。
  一旦产生真实账单，任何配额泄露都会变成钱。升级前先重新评估，并给 Worker 加鉴权。
- **Worker 目前没有鉴权**，知道 URL 的人都能用它合成语音。CORS 挡不住服务端调用。
  在「只挂 F0」的前提下可接受；若要对外发布，先加一层访问控制。
