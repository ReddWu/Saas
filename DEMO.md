# 🎬 Live Demo Script — 5 分钟（管线 ~4 min + 旁白缓冲）

**启动命令（演示配置）**：`USE_REPLICAS=1 npm start`
（fleet 默认只跑 Round 1 = 最佳时长/冲击比；全 fleet 加 `DARWIN_FLEET_ROUNDS=2` ≈ +1.5 min）

## 开场（15 秒，先把承诺甩出来）
> "This is DarwinSaaS — a SaaS factory that evolves. In the next 3 minutes it will:
> find a market gap, debate it to death, ship a real website to the public internet,
> bet on its own success, fail that bet, rewrite its own code, and win.
> Nobody touches a keyboard. Watch."

按下 **⚡ AWAKEN DARWIN**。（按完手离开键盘，全程不再碰——这是产品的核心承诺）

## 第一幕：Scout + Boardroom（~2.5 分钟，让 kill feed 自己表演）
- 指出开场日志：**"📡 Ingested 10 LIVE trend signals from the Hacker News front page"**
  → "这是此时此刻 HN 的真实头条。" + **"⚡ All model calls routed through the InsForge
  Model Gateway"** → "每一次模型调用都走 InsForge——它也是整个系统的 system of record。"
- 10 个想法出现 → 4 个杀手 persona 并行开喷。**别念 feed，挑一条带判例的读出来**
  （"dies the Sidecar death"、"Clay.com raised $62M and already does this"）。
  每块墓碑都有"✅ 最强论点 + ☠️ 死因"→ "没有想法死得不明不白。"
- 🛰️ **Replicas 时刻**（Round 2 决赛轮，核心卖点，指着 feed 念）：
  "spawning 4 VM-isolated agents… agent The Biased Investor live"
  → "决赛轮升级了：这四个评委现在是 **Replicas 上四台隔离 VM 里的四个真实 agent**，
  每人读过不同的书，而且手里拿着 **5,954 家 YC 公司的生死注册表**——
  feed 里那条 'consulted the live YC registry: N dead neighbors found' 就是证据。"
- 死掉的想法逐个划线、显示死因 → "每个死掉的想法都有验尸报告。"
- 幸存者高亮 + Prediction Matrix 出现 → "现在它对自己的发布下注：SEO 必须到 9X 分，
  否则物种死亡。这是公开的、可验证的赌注。"

## 第二幕：Factory + 红色警报（~40 秒，情绪低谷）
- 部署 URL 出现 → **当场点开** `https://<slug>.vercel.app` → "这是一个真实的、
  公网的网站，Darwin 刚刚自己上线的。"
- Lighthouse 仪表盘亮红 + 红色横幅 BET FAILING → "它输了自己的赌注。第一版是个
  裸 MVP——没有 meta description、没有结构化数据、没有 sitemap。现在看它自救。"

## 第三幕：Mutation 翻盘（~30 秒，高潮）
- Ops agent 日志滚动（自我改写源码）→ v2 重新部署 → 仪表盘跳绿 → 🟢 **BET WON**
- **二维码出现** → "扫它。你们手机上现在打开的网站，是一个 AI 在过去三分钟里
  构思、辩论、上线、然后为了赢回自己的赌注而重写的。"

## 第四幕：Founder 压轴（~50 秒，立意拔高）
- 绿色胜利后别急着结束——**🧭 Founder 阶段滑出**：
  "刚才拼命杀它的四个评委，现在转为它辩护。" 指 Founder's Brief：
  为什么它赢（带判例）、机遇、风险，然后重点指 **🔧 What makes it USABLE**：
  "Darwin 明确告诉你：构建哪 3 个功能就算可用、砍掉什么、用什么栈——
  这不是网页生成器，是产品定义。"
- 指 30 天双轨计划："🔨 BUILD 每周一个里程碑把它做成真产品，📣 GROWTH 同步铺内容
  和发布——**每个任务都带可证伪的假设**：发完 20 篇博客，搜索展现量 +1000。"
- **🚀 Hand-off 卡（终极一击）**："Darwin 刚刚自己开了一个 GitHub 仓库——
  里面是这个网站的源码和一份 BUILDME.md 接力 prompt。clone 下来打开 Claude Code，
  它会接着把这个 MVP 造完。**从想法到第一行真代码，人类只需要点一次按钮。**"
  （可当场点开 repo 链接给评委看 BUILDME.md）

## 谢幕（15 秒）
- 切到 **/archive**（Species Archive）→
  "Darwin 记得它创造的每一个物种、杀死的每一个想法——全部存在 InsForge 里。
  这不是一个 demo，这是一个 long-term 创业 copilot 的第一天。"

---

## 保险预案
| 风险 | 动作 |
|------|------|
| 现场网络挂了 | `.env.local` 设 `DARWIN_MOCK=1` + `DARWIN_VERCEL=0`，重启 → 离线全弧线照常跑（file:// 部署 + 离线打分） |
| LLM 慢/超时 | 不用管——每段都有自动回退，管线永不卡死 |
| 管线中途出错 | 红色 Pipeline error 横幅出现 → 重按 AWAKEN（历史已在 InsForge，archive 不丢） |
| Replicas fleet 慢 | 默认关。只有排练 <2 min 才设 `REPLICAS_API_KEY` 上台 |

## 演示前检查单
- [ ] **先清端口**：`lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill`——确保只有一个 server！
  （今天所有"灵异故障"都是双 server 抢端口导致的：旧代码接管请求、日志互相覆盖）
- [ ] `npm run build && npm start`（生产模式比 dev 稳）
- [ ] 浏览器开两个 tab：`localhost:3000` 和 `/archive`
- [ ] 手机连好网，准备扫码
- [ ] 终端藏起来，全屏浏览器
- [ ] 提前 10 分钟跑一轮垫场（暖 LLM 缓存 + archive 里多一条记录）
