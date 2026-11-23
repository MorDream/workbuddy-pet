# WorkBuddy Pet

一只住在你桌面上的 WorkBuddy 宠物：**工作时认真干活，闲下来自己摸鱼**。它不靠猜时间，而是直接读 WorkBuddy 的真实 hook 事件（用户提问、工具调用、工具失败、等待确认、回合完成……），实时切换动作和头顶气泡。

灵感来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 与 codex-pet 的思路：**宠物是 Agent 状态信号灯，不是情绪玩偶**。当前动画素材直接复用 dsh-pet 的 VP9-alpha WebM（见「素材来源」）。

```
WorkBuddy hooks ──stdin JSON──> bin/forward.mjs ──HTTP POST /event──> 本地控制服务 (127.0.0.1:17340)
                                                                          │
                                                                  状态机 (state.mjs)
                                                                          │
                                                          Electron 透明窗 <──long-poll /state
                                                          (renderer 播放 WebM)
```

## 它做什么

| Agent 事件 | 宠物动作 | 动画素材 |
|---|---|---|
| 用户提交指令 / 上下文压缩 | 思考 | 工作状态-思考冒泡 |
| 工具调用中 / 子任务启动 | 忙碌 | 工作状态-忙碌点按 |
| 工具返回 / 子任务结束 | 整理 | 工作状态-清点归档 |
| 需要你确认 / 权限请求 | 等你 | 工作状态-原地踱步张望 |
| 回合完成 | 庆祝 | 工作状态-雀跃庆祝 |
| 工具失败 / 权限拒绝 | 出错 | 工作状态-垂头叹气冒汗 |
| 无任务（TTL 到期）/ 会话开始 | 摸鱼、伸懒腰、玩魔方、吃零食…… | 闲暇动画池随机 |

睡觉时所有事件都被拦住（和 dsh-pet 的闸门一致），叫醒后才恢复。

## 安装

需要 Node.js ≥ 20。

```bash
git clone https://github.com/MorDream/workbuddy-pet.git
cd workbuddy-pet
npm install                 # 仅安装 Electron
npm run fetch-assets        # 从 GitHub API 拉取 WebM 动画素材
```

## 启动

```bash
npm start                   # 启动本地控制服务 + 透明桌宠窗口
```

也可以只跑控制服务（配合浏览器或自己的窗口）：

```bash
npm run serve               # http://127.0.0.1:17340/
```

服务**只监听 127.0.0.1**，无鉴权，请勿转发到公网。

## 接入 WorkBuddy hooks（自动转发）

```bash
npm run install-hooks
```

安装器会把 18 个 hook 事件（`UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Notification` / `Stop` / `SubagentStop` / `PostToolUseFailure` 等）写入 `~/.workbuddy/settings.json`，每个 hook 调用 `bin/forward.mjs`：读 stdin 的 hook JSON → POST 到本地 `/event` → 输出 `{"continue":true,"suppressOutput":true}`，不往 agent 上下文塞任何文字，也不阻塞流程（2 秒超时，失败静默）。

> WorkBuddy 要求外部修改的 hooks 在 `/hooks` 面板审核后生效。安装后打开面板确认一次即可。
> 卸载：`npm run uninstall-hooks`。安装前会自动备份 settings.json。

## 手动控制（CLI）

```bash
npx wbpet status                 # 查看当前状态
npx wbpet working "重构登录模块"   # 进入工作档
npx wbpet result                 # 整理档
npx wbpet success                # 完成档
npx wbpet idle                   # 回去摸鱼
npx wbpet sleep / wake           # 睡觉 / 叫醒
npx wbpet anim 玩水枪             # 点播动画
npx wbpet say "先去吃个饭"         # 气泡
npx wbpet anims                  # 列出全部动画
```

## HTTP API（本机）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 服务信息 |
| GET | `/state` | 当前状态；`?since=<counter>&timeout=<ms>` 长轮询 |
| POST | `/event` | 注入 hook JSON，经状态机映射 |
| POST | `/work-status` | `{ state, task? }`，state 六档之一 |
| DELETE | `/work-status` | 清空，回摸鱼 |
| POST | `/anim` / `/say` / `/idle` / `/sleep` / `/wake` | 手动控制 |
| GET | `/animations` | 素材清单 |
| GET | `/assets/webm/<name>.webm` | 动画文件 |
| POST | `/shutdown` | 优雅停机 |

`GET /state` 返回：

```jsonc
{
  "counter": 42,          // 状态版本号，长轮询判据
  "mode": "work",         // idle | work | sleep
  "tier": "working",      // thinking/working/result/waiting/success/error/idle
  "anim": "工作状态-忙碌点按",
  "bubble": "正在处理任务呢",
  "task": "帮我写一个网站",
  "history": [ ... ]      // 最近 20 条状态变化
}
```

## 测试

```bash
npm test                    # 控制服务 + 状态机端到端冒烟测试
```

## 素材来源与许可

- 代码：MIT
- 动画 WebM：来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，形象与素材为 **CC BY-NC-SA 4.0**，原作者 [PC2005-cloud](https://github.com/PC2005-cloud)。**不可商用**；再分发请遵守原协议并保留署名。
- 本项目仅在本机运行，不上传任何任务内容。
