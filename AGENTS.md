# AGENTS.md — 密码机 技术全景文档

> 本文档面向 AI Agent。目标是让你在不阅读任何源码的情况下，对这个项目的架构、逻辑、UI 和已知问题有完整认知。

---

## 一、项目概述

**密码机（Mastermind）** 是一个基于经典桌游 Mastermind 的网页猜色解码游戏，支持四个一级模式，其中 `单人闯关` 内含 4 档官方预设难度。灵感来自 GiiKER 计客超级密码机。

- **入口**：`index.html`（单页应用，零路由）
- **运行方式**：需要本地 HTTP 服务器（`python3 -m http.server 3000`），因为使用了 ES Modules
- **测试**：`npm test`（Vitest，55 个测试，全部通过）
- **外部依赖**：生产端零依赖，`devDependencies` 只有 `vitest@3.2.4`

---

## 二、技术栈

| 层次 | 技术 |
|------|------|
| 语言 | 纯 Vanilla JavaScript（ES Modules，`type="module"`） |
| HTML | 语义化 HTML5，带完整 ARIA 属性 |
| CSS | 原生 CSS3：自定义属性、Grid、Flexbox、`backdrop-filter`、`env(safe-area-inset-bottom)` |
| 测试 | Vitest 3.2.4 |
| 持久化 | `localStorage`（版本化 key，`v1` 后缀） |
| 分享 | Web Share API + Clipboard API 降级 |

---

## 三、目录结构与文件职责

```
密码机/
├── index.html                  # 所有 HTML 结构，5 个 screen + result overlay
├── css/
│   ├── variables.css           # 所有 CSS 自定义变量（颜色、间距、字体、阴影）
│   ├── base.css                # 全局重置、基础排版、响应式 body 类（game-phase--guessing）
│   ├── components.css          # 按钮、卡片、弹窗、统计面板、legend 等 UI 组件
│   └── game.css                # 棋盘行、调色盘、球体元素、移动端固定布局
├── js/
│   ├── constants.js            # COLORS 数组、getAvailableColors、DEFAULT_MODE_ID
│   ├── mode-config.js          # MODE_CONFIGS、SINGLE_PRESET_IDS、getModeConfig(modeId)
│   ├── engine.js               # calcFeedback、generateSecret、isWinningFeedback、shuffle（纯函数）
│   ├── state.js                # GameState 单例对象（可变）
│   ├── daily.js                # dateToChallengeKey、hashStringToSeed、createSeededRng、generateDailySecret
│   ├── stats.js                # recordGameResult、hasCompletedDaily、getAverageRounds、isConsecutiveDay
│   ├── storage.js              # loadSession/saveSession/clearSession、loadStats/saveStats、loadPreferences/savePreferences
│   ├── share.js                # buildShareText、feedbackToEmoji、shareResult（Web Share API + 剪贴板降级）
│   ├── ui.js                   # 所有 DOM 渲染与 UI 交互函数（纯渲染，无游戏逻辑）
│   └── game.js                 # 游戏逻辑主入口：事件绑定、各模式启动、猜测流程、reset/replay
└── tests/
    ├── engine.test.js          # 16 个测试：反馈算法、密码生成、5 槽场景
    ├── daily.test.js           # 10 个测试：每日挑战确定性、日期/哈希/RNG
    ├── stats.test.js           # 11 个测试：统计、连胜、预设分桶
    ├── storage.test.js         # 9 个测试：序列化/恢复/版本校验
    ├── share.test.js           # 5 个测试：分享文本格式
    └── mode-config.test.js     # 4 个测试：模式参数
```

---

## 四、核心常量

### 颜色表（`js/constants.js`）

```js
COLORS = [
  { id: 'c1', name: '红', bg: '#ff453a' },
  { id: 'c2', name: '橙', bg: '#ff9f0a' },
  { id: 'c3', name: '黄', bg: '#ffd60a' },
  { id: 'c4', name: '绿', bg: '#32d74b' },
  { id: 'c5', name: '蓝', bg: '#0a84ff' },
  { id: 'c6', name: '紫', bg: '#bf5af2' },
  { id: 'c7', name: '白', bg: '#ffffff' },
  { id: 'c8', name: '青', bg: '#64d2ff' },
]
DEFAULT_MODE_ID = 'classic'
getAvailableColors(colorCount) // 返回前 N 个颜色，颜色顺序即难度顺序
```

### 模式配置表（`js/mode-config.js`）

```js
SINGLE_PRESET_IDS = ['starter', 'classic', 'hard', 'expert']

MODE_CONFIGS = {
  starter:    { label: '入门模式',   codeLength: 4, maxGuesses: 10, allowDuplicates: false, paletteColorCount: 6 },
  classic:    { label: '经典模式',   codeLength: 4, maxGuesses: 10, allowDuplicates: false, paletteColorCount: 7 },
  hard:       { label: '困难模式',   codeLength: 5, maxGuesses: 12, allowDuplicates: false, paletteColorCount: 7 },
  expert:     { label: '专家模式',   codeLength: 5, maxGuesses: 10, allowDuplicates: false, paletteColorCount: 8 },
  daily:      { label: '每日挑战',   codeLength: 4, maxGuesses: 10, allowDuplicates: false, paletteColorCount: 7 },
  duplicates: { label: '重复色模式', codeLength: 4, maxGuesses: 10, allowDuplicates: true,  paletteColorCount: 7 },
}
```
`paletteColorCount` 决定该模式实际参与渲染和密码生成的颜色数量；颜色顺序固定来自 `COLORS` 的前 N 项。

---

## 五、模块详解

### 5.1 游戏引擎（`engine.js`）— 纯函数，无副作用

```js
// 两遍扫描算法：第一遍精确匹配，第二遍颜色匹配（消耗机制防止重复计数）
calcFeedback(guess, secret) → ['exact' | 'misplaced' | 'none', ...]

// Fisher-Yates shuffle，接受可选 rng 参数（用于确定性测试）
shuffle(array, rng?)

// 生成随机/确定性密码，allowDuplicates=true 时每位独立随机
generateSecret({ colors, codeLength, allowDuplicates, rng? })

// 所有位都是 'exact' 才为 true
isWinningFeedback(feedback, codeLength)

FEEDBACK = { EXACT: 'exact', MISPLACED: 'misplaced', NONE: 'none' }
```

### 5.2 每日挑战系统（`daily.js`）

每日挑战的密码由日期字符串确定性生成，**全球同一天同一题**，且永远不变：

```
日期 → dateToChallengeKey()  → "2026-03-10"（使用本地时区，Intl.DateTimeFormat）
     → hashStringToSeed()    → FNV-1a 哈希算法 → uint32 seed（不可更改算法）
     → createSeededRng()     → LCG 线性同余伪随机数生成器
     → generateDailySecret() → 固定颜色数组
```

> **重要约束**：`hashStringToSeed` 的 FNV-1a 实现一旦修改，所有历史每日题目密码都会改变。此函数绝对不能动。

`isDailySessionForKey(session, challengeKey)` — 判断已存档的 session 是否是今日每日挑战的进度。

### 5.3 状态管理（`state.js`）— 可变单例

`GameState` 是整个应用的唯一状态容器，挂载在模块级别。

**字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mode` | `'single' \| 'dual'` | 游戏组织形式 |
| `variant` | `'starter' \| 'classic' \| 'hard' \| 'expert' \| 'daily' \| 'duplicates'` | 规则变体 |
| `activeConfig` | `ModeConfig` | 当前模式的参数对象 |
| `startedAt` | `string \| null` | ISO 时间戳 |
| `challengeKey` | `string \| null` | 每日挑战日期 key，如 `"2026-03-10"` |
| `isChallenge` | `boolean` | 是否是通过专属 URL 进来的异步对战 |
| `challengeUrl` | `string \| null` | 原始挑战 URL，会在过关后附在分享链接中带出 |
| `secretCode` | `string[]` | 长度为 `codeLength` 的颜色 ID 数组，`null` 表示空槽 |
| `currentGuess` | `string[]` | 当前正在填写的猜测行 |
| `guessHistory` | `{guess, feedback}[]` | 所有已提交的历史记录 |
| `setupActiveSlot` | `number` | 密码设置阶段当前焦点槽位 |
| `guessActiveSlot` | `number` | 猜测阶段当前焦点槽位 |
| `screenId` | `string` | 当前屏幕 ID |
| `status` | `'idle' \| 'in_progress' \| 'won' \| 'lost'` | 游戏状态 |

**已知问题**：`reset()` 中 `mode` 硬编码为 `'dual'`（`state.js:183`），与 `DEFAULT_MODE_ID = 'classic'` 不一致，但实际 `reset()` 调用后都会立即 `setMode()`，不会产生用户可见的 bug。

**焦点模型**：点击空槽 → 聚焦（`setGuessFocus`）；点击已填槽 → 清除并聚焦（`clearGuessSlot`）；填色后自动推进到下一个空槽（`advanceGuessSlot`）。

### 5.4 统计系统（`stats.js`）

**数据结构**：
```js
{
  version: 1,
  totals: { gamesPlayed, wins, losses },
  streaks: { currentDailyWin, bestDailyWin },
  modes: {
    starter: { bestRounds, totalRoundsSum, gameCount, wins, losses },
    classic: { bestRounds, totalRoundsSum, gameCount, wins, losses },
    hard:    { bestRounds, totalRoundsSum, gameCount, wins, losses },
    expert:  { bestRounds, totalRoundsSum, gameCount, wins, losses },
    daily:   { bestRounds, totalRoundsSum, gameCount, wins, losses },
    duplicates: { bestRounds, totalRoundsSum, gameCount, wins, losses },
    dual:    { gamesPlayed },
  },
  completedDailyKeys: string[],  // 最多保留 365 条
  lastDailyPlayedKey: string | null,
  achievements: string[],        // 解锁的成就 ID 数组，如 'FIRST_TRY', 'LAST_CHANCE', 'BLIND'
}
```

**展示层口径**：
- 首页摘要：`已玩 N 局 · 单人最佳 <档位名> <最佳步数> / - · 每日连胜 N`
- 详细统计面板：分为 `单人闯关 / 每日挑战 / 其他模式` 三组卡片
- 单人和重复色卡片显示：最佳、平均、胜率、场次
- 每日卡片额外显示：当前连胜、最佳连胜
- 双人卡片仅显示：总场次

**连胜逻辑**（`recordGameResult`，已修复）：
- 每日胜利时，调用 `isConsecutiveDay(lastDailyPlayedKey, result.challengeKey)` 检查日期连续性
- 连续 → `currentDailyWin + 1`；不连续（包括首次、跳天）→ 重置为 `1`
- 每日失败 → `currentDailyWin = 0`
- 防重复计算：`hasCompletedDaily()` 检查 `completedDailyKeys`，已完成的每日不再重复计入

`isConsecutiveDay(prevKey, currentKey)` — 使用本地时间 `new Date(year, month-1, day+1)` 计算下一天，处理月末/年末溢出。

### 5.5 持久化（`storage.js`）

**三个 localStorage key**：
- `mastermind:session:v1` — 游戏进度快照（`in_progress` 时实时存储）
- `mastermind:stats:v1` — 统计数据
- `mastermind:preferences:v1` — 偏好设置（目前只有 `firstRunDismissed`）

**版本校验**：所有 key 都带版本号，版本不符直接清空并使用默认值。  
**防抖存储**：`scheduleSave()` 使用 `queueMicrotask` 批量延迟写入，避免每次状态变更都触发 IO。  
**游戏结束**：`clearSession()` 删除进度快照（统计单独保存）。

**Session 快照字段**（完整列表）：
`version, mode, variant, startedAt, challengeKey, isChallenge, challengeUrl, secretCode, currentGuess, guessHistory, setupActiveSlot, guessActiveSlot, screenId, status`

### 5.6 分享（`share.js`）

```
shareResult(payload) → 优先 navigator.share（移动端原生弹窗）→ 降级 navigator.clipboard.writeText
```

**分享文本格式**（不含颜色信息，防剧透）：
```
密码机 每日挑战 2026-03-10   ← 或：密码机 经典模式 / 密码机 专家模式 / 密码机 双人对战
4/10                          ← 失败显示 X/10
🟢🟠⚪⚪
🟢🟢🟠⚪
🟢🟢🟢🟢
https://mastermind.rustypiano.com/
```

### 5.7 UI 渲染（`ui.js`）

UI 模块只负责渲染，不包含游戏逻辑。所有函数从 `GameState` 读取状态，通过传入的回调处理事件。

**主要导出函数**：

| 函数 | 说明 |
|------|------|
| `makeBall(colorId, sizeVar?)` | 创建球体 div，`colorId=null` → 空槽样式 |
| `buildBoard()` | 初始化全部猜测行（`maxGuesses` 行），每行含行号、`codeLength` 个球槽、`codeLength` 个反馈点 |
| `buildSecretRow(onClickSlot)` | 密码设置阶段的 `codeLength` 个槽位 |
| `buildSetupPalette(onClick)` | 密码设置调色盘，使用 `paletteColorCount` 个颜色，已用色加 `.ball--used` |
| `buildGuessPalette(onClick)` | 猜测调色盘，使用 `paletteColorCount` 个颜色，已选色加 `.ball--used` |
| `updateCurrentGuessDisplay(onClickSlot)` | 刷新当前行的球体展示 |
| `restoreBoardHistory(onClickSlot)` | 从 `guessHistory` 恢复历史棋盘（session 恢复用） |
| `highlightActiveRow()` | 在活跃行添加 `▶` 箭头，`scrollIntoView` |
| `freezeRow(r)` | 锁定第 r 行（克隆 DOM 节点去除事件，改 cursor） |
| `renderFeedback(round, feedback)` | 渲染反馈点（feedback 先排序：exact → misplaced → none） |
| `showResult(win, rounds)` | 显示结果弹窗，单人预设使用当前模式名，每日模式下将"再来一局"按钮文案改为"试试经典模式" |
| `applyModeLabels(mode, variant, challengeKey?)` | 更新 `setupTitle` 和 `guessTitle`，单人预设直接使用 config label |
| `updateDailyModeEntry(...)` | 更新模式选择页每日挑战按钮文案和说明文字 |
| `renderStatsPanel(stats)` | 渲染首页统计摘要和分组卡片 |
| `renderResultStats(stats, result)` | 渲染结果弹窗中的统计区域 |
| `updateStatus(msg)` | 更新猜测阶段状态文字（**使用 `innerHTML`，见已知问题**） |
| `showScreen(screenId)` | 切换屏幕，切换 `game-phase--guessing` body 类 |

**CSS 动效追加**：
- `submitGuess()` 失败且输入未完整时触发外围 `.shake`。
- 胜利展示区颜色球会额外附加 `waveBounce` 视觉跃动。
- `fb-dot` 圆点通过 `animation-delay: \${i * 150}ms` 实现错落出现。

**球体尺寸变量**：
- `--ball-sm`（34px）— 棋盘行球槽
- `--ball-md`（40px）— 调色盘球
- `--ball-lg`（44px）— 结果展示答案球

**反馈点排序规则**：反馈点展示时会将 exact 排在前面、misplaced 其次、none 最后，所以反馈点的位置**不对应猜测的具体位置**，这是规则设计的一部分。

### 5.8 游戏逻辑主入口（`game.js`）

```js
// 模块级变量
let saveScheduled = false       // 防抖存储标志
const challengeTimeZone = ...   // 本地时区，用于每日挑战
let latestResult = null         // 上局结果，用于分享
```

**各模式启动流程**：

```
openSingleModes()    → screenSingleModes
startSingleMode(v)   → reset → setMode('single') → setVariant(v) → generateRandomSecret(前 N 色) → screenGuess
startDailyMode()     → reset → setMode('single') → setVariant('daily')   → generateDailySecret  → screenGuess
startDuplicatesMode()→ reset → setMode('single') → setVariant('duplicates')→ generateRandomSecret → screenGuess
startDualMode()      → reset → setMode('dual')   → setVariant('classic') → screenSetup（玩家一手动设置密码）
```

**提交猜测流程**（`submitGuess`）：
1. `calcFeedback()` → `freezeRow(r)` → `GameState.pushGuess(feedback)` → `renderFeedback()`
2. 胜利检测：`isWinningFeedback()` → `setStatus('won')` → `recordFinishedGame()` → `clearSession()` → 400ms 后 `showResult(true)` + `renderResultStats()`
3. 失败检测：`r + 1 >= maxGuesses` → 同上（`showResult(false)`）
4. 继续：`clearGuess()` → 刷新 UI → `updateStatus(getRoundSummaryMessage())` → `highlightActiveRow()` → `scheduleSave()`

**replayGame()**（已修复）：
- `daily` → `startSingleMode()`（不再重复进入已完成的每日挑战）
- `duplicates` → `startDuplicatesMode()`
- `single` 预设难度 → `startSingleMode(variant)`（同难度重开）
- `dual` → `startDualMode()`

**Session 恢复**（`init()`）：
启动时检测 `loadSession()`，如有有效 session 则 `GameState.restore()` + `hydrateRecoveredSession()`，根据 `screenId` 直接跳转到对应屏幕。

---

## 六、HTML 结构

```
body
├── header.header           # 标题 "密码机" + 副标题
├── main.main-layout
│   ├── section.board       # 棋盘区（左栏，桌面端）
│   │   └── #rowsContainer  # 动态生成的猜测行
│   └── aside.side-panel    # 操作面板（右栏，移动端全屏）
│       ├── #screenMode     # Screen 0：模式选择
│       ├── #screenSingleModes # Screen 1：单人闯关难度选择
│       ├── #screenSetup    # Screen 2：密码设置（双人模式）
│       ├── #screenTransition # Screen 3：设备交接（双人模式）
│       └── #screenGuess    # Screen 4：猜测阶段
└── #overlay                # 结果弹窗（role="dialog"）
```

**Screen 切换机制**：`showScreen(screenId)` 切换 `.screen.active` 类，同时切换 `body.game-phase--guessing`（猜测阶段启用固定分屏布局）。

---

## 七、完整文案清单

### Screen 0 — 模式选择

| 元素 | 文案 |
|------|------|
| 卡片标题 | 选择模式 |
| hint | 猜出颜色密码的推理游戏。想每天回来玩，从每日挑战开始。 |
| 新手引导标题 | 第一次玩先看这里 |
| 新手引导正文 | 目标是在限定次数内猜中颜色组成的密码。单人闯关和每日挑战不允许重复色，重复色模式则允许。 |
| 新手图例 | 🟢 颜色和位置都正确 / 🟠 颜色正确但位置错误 |
| 统计摘要行（动态） | 已玩 N 局 · 单人最佳 `<模式名> N步` / `-` · 每日连胜 N |
| 统计面板切换 | 查看详细统计 / 收起详细统计 |
| 统计面板内容 | 单人闯关 4 张卡 + 每日 1 张卡 + 其他模式 2 张卡 |
| 每日卡片标签 | 今日目标 |
| 每日按钮（动态） | 每日挑战 / 继续每日挑战 |
| 每日 meta（动态） | `${key} 今日题目，通关后会记入每日连胜。` / `${key} 已完成 ✓，明天继续冲击连胜。` / `继续 ${key} 的进度，保住你的每日连胜。` |
| 单人卡片标签 | 难度闯关 |
| 单人按钮 | 单人闯关 |
| 单人 meta | 从入门到专家，逐步增加颜色和槽位。 |
| 重复色卡片标签 | 进阶变体 |
| 重复色按钮 | 重复色模式 |
| 重复色 meta | 密码和猜测都允许重复色，推理难度更高。 |
| 双人卡片标签 | 双人对战 |
| 双人按钮 | 双人对战 |
| 双人 meta | 一人出题一人破解，适合当面轮流挑战。 |

### Screen 1 — 单人闯关难度选择

| 元素 | 文案 |
|------|------|
| 卡片标题 | 单人闯关 |
| hint | 从入门到专家，颜色数和槽位会逐步增加。 |
| 入门卡片 | 入门模式 / 6 色 · 4 槽 · 10 次 |
| 经典卡片 | 经典模式 / 7 色 · 4 槽 · 10 次 |
| 困难卡片 | 困难模式 / 7 色 · 5 槽 · 12 次 |
| 专家卡片 | 专家模式 / 8 色 · 5 槽 · 10 次 |
| 返回按钮 | 返回主页 |

### Screen 2 — 密码设置（双人）

| 元素 | 文案 |
|------|------|
| 卡片标题 | 玩家一 · 设置密码 |
| hint | 从7色中选 **4种不同颜色**，顺序即密码 |
| 辅助文字 | 点击已选颜色可移除 |
| 确认按钮（disabled 前） | 确认密码 → |
| 返回按钮 | 返回主页 |

### Screen 3 — 设备交接（双人专属）

| 元素 | 文案 |
|------|------|
| 卡片标题 | 密码已锁定 |
| 图标 | 🔒 |
| 说明 | 请将设备交给**玩家二** 确保玩家一已离开屏幕后继续 |
| 继续按钮 | 玩家二准备好了 → |
| 挑战链接按钮 | 生成挑战链接 (调用 Web Share API 生成包含参数的 URL) |
| 返回按钮 | 返回主页 |

### Screen 4 — 猜测阶段

| 元素 | 文案（动态） |
|------|------|
| 卡片标题 | 入门模式 · 你来猜测 / 经典模式 · 你来猜测 / 困难模式 · 你来猜测 / 专家模式 · 你来猜测 / 每日挑战 · 2026-03-10 / 重复色模式 · 允许重复颜色 / 玩家二 · 猜测颜色 |
| 操作提示 | 点击槽位切换选色位置 |
| 状态框（初始） | `选满 ${codeLength} 色后提交` |
| 状态框（满色） | `已选满 ${codeLength} 色，点击提交` |
| 状态框（每日前缀） | `每日挑战 ${key} · ` + 上述文本 |
| 状态框（轮后） | `第 N 轮 · 🟢 N · 🟠 N · 剩余 N 次` |
| 反馈说明按钮 | 反馈说明 |
| 重选按钮 | 重选 |
| 提交按钮 | 提交猜测 |
| 返回按钮 | 返回主页 |

### 反馈说明面板（legendSheet）

| 元素 | 文案 |
|------|------|
| 绿点说明 | 颜色 & 位置均正确 |
| 橙点说明 | 颜色正确，位置错误 |
| 空点说明 | 颜色不在密码中 |
| 策略提示 | 每轮结束后先看 🟢 数量，再根据 🟠 调整颜色位置。 |
| 规则摘要 | 规则会随模式变化：在限定次数内猜中所有槽位即可通关；单人闯关和每日挑战不允许重复色。 |

### 结果弹窗（overlay）

| 状态 | 元素 | 文案 |
|------|------|------|
| 胜利 | Emoji | 🎉 |
| 胜利 | 标题 | 密码破解成功！ |
| 胜利/单人预设 | 正文 | 你用了 **N** 次 破解了密码。 |
| 胜利/每日 | 正文 | 你用了 **N** 次 完成今天这题。 |
| 胜利/重复色 | 正文 | 你用了 **N** 次 破解重复色规则。 |
| 失败 | Emoji | 😵 |
| 失败 | 标题 | 挑战失败 |
| 失败/每日 | 正文 | 你没能在 N 次 内完成今天这题。 |
| 失败/重复色 | 正文 | 你没能在 N 次 内破解重复色规则。 |
| 失败/单人预设 | 正文 | 你没能在 N 次 内破解密码。 |
| 每日统计 | 正文 | `今日挑战已完成\n当前每日连胜 N · 最佳 N` |
| 每日失败统计 | 正文 | `今天这题还没拿下\n明天还有新的每日挑战` |
| 单人统计 | 正文 | `${模式名}最佳 N步/- · 平均 N步/- · 胜率 N%` |
| 评级补充文案 | 教练指导 | 仅单人闯关和每日挑战弹出。 S、A、B、C 等级鼓励语，针对回合数的表现进行文字评价。 |
| 按钮1（非每日） | 文案 | 再来一局 |
| 按钮1（每日） | 文案 | 试试经典模式（已修复：不再重复每日题目） |
| 按钮2 | 文案 | 分享结果 |
| 按钮3 | 文案 | 回到主页 |

### 系统状态消息

```
分享成功
已复制结果，可直接粘贴分享
当前浏览器不支持直接分享，请手动复制结果
当前没有可分享的结果
```

---

## 八、完整用户流程

```
启动
  ├─ localStorage 有 in_progress session → restore → hydrateRecoveredSession
  │   └─ 根据 session.screenId 直接跳至 Setup / Transition / Guess
  └─ 无 session → screenMode
       ├─ firstRunDismissed=false → 显示新手引导卡
       └─ 刷新每日挑战状态 + 统计面板

[screenMode]
  ├─ 每日挑战 → startDailyMode() → screenGuess
  ├─ 单人闯关 → screenSingleModes
  ├─ 重复色模式 → startDuplicatesMode() → screenGuess
  └─ 双人对战 → startDualMode() → screenSetup

[screenSingleModes]
  ├─ 入门模式 → startSingleMode('starter') → screenGuess
  ├─ 经典模式 → startSingleMode('classic') → screenGuess
  ├─ 困难模式 → startSingleMode('hard') → screenGuess
  ├─ 专家模式 → startSingleMode('expert') → screenGuess
  └─ 返回主页 → screenMode

[screenSetup]（仅双人）
  ├─ 点调色盘 → setSecretColor() → 自动推进焦点
  ├─ 点已填槽 → clearSecretSlot() → 焦点回该槽
  ├─ 4色满 → 启用"确认密码"按钮
  ├─ 确认密码 → screenTransition
  └─ 返回主页 → resetGame()

[screenTransition]（仅双人）
  ├─ 玩家二准备好了 → screenGuess
  ├─ 生成挑战链接 → generateChallenge() → 分享编码 URL
  └─ 返回主页 → resetGame()

[screenGuess]
  ├─ 点调色盘 → setGuessColor() → 自动推进焦点 → 更新状态文字
  ├─ 点已填槽 → clearGuessSlot() → 焦点回该槽
  ├─ 重选 → clearGuess() → 状态重置
  ├─ 选满 `codeLength` 色 → 启用"提交猜测"
  └─ 提交猜测 → submitGuess()
       ├─ 胜利 → setStatus('won') → recordFinishedGame → clearSession → 400ms → overlay
       ├─ 达到 maxGuesses → setStatus('lost') → 同上
       └─ 继续 → 下一行 → highlightActiveRow → scheduleSave

[overlay]
  ├─ 试试经典模式（每日） / 再来一局 → replayGame()
  │   ├─ daily → startSingleMode()（不重复进入同题）
  │   ├─ duplicates → startDuplicatesMode()
  │   ├─ starter/classic/hard/expert → startSingleMode(variant)
  │   └─ dual → startDualMode()
  ├─ 分享结果 → shareResult() → Web Share API / clipboard 降级
  └─ 回到主页 → resetGame() → screenMode
```

---

## 九、已知问题与待办事项

### ✅ 已修复

| 问题 | 修复方式 | 文件 |
|------|----------|------|
| 每日连胜不检测断档，跨天不归零 | 新增 `isConsecutiveDay()`，检查日期连续性 | `js/stats.js` |
| 每日模式"再来一局"重复进入同题 | `replayGame()` 改为 `startSingleMode()`，overlay 按钮文案改为"试试经典模式" | `js/game.js`, `js/ui.js` |
| 新手引导文案预设用户选了经典/每日模式 | 改为涵盖所有模式的通用说明 | `index.html` |
| 模式选择页 hint 对新用户没有游戏介绍 | 加入一句话游戏定义 | `index.html` |
| "清除"语义模糊（用户担心清空历史） | 改为"重选" | `index.html` |
| "点当前行切换位置"表达不直觉 | 改为"点击槽位切换选色位置" | `index.html` |
| 反馈说明面板不包含游戏规则，关闭新手引导后无处查规则 | 在 legendSheet 底部追加规则摘要 | `index.html` |
| README 目录结构过时（只列 4 个 JS 文件，包含不存在的 mastermind.html） | 全面重写 README | `README.md` |

### ⚠️ 待处理

| 问题 | 位置 | 影响 | 优先级 |
|------|------|------|--------|
| `updateStatus` 使用 `innerHTML` | `ui.js:223` | 若 msg 来源变为用户输入则有 XSS 风险；目前 msg 均来自内部拼接，可控 | 低 |
| 颜色球用 `div` 而非 `button`，无 `role="button"` 和键盘支持 | `ui.js:makeBall()`, `buildPalette()` | 无法通过键盘操作，对辅助技术不友好 | 中 |
| 无色盲辅助（仅靠颜色区分，无形状/字母辅助） | `constants.js` 颜色定义, `ui.js:makeBall()` | 红绿色盲用户体验差 | 低 |
| `reset()` 中 `mode` 硬编码 `'dual'`，与 `DEFAULT_MODE_ID = 'classic'` 不一致 | `state.js:183` | 不影响用户，但语义混乱，每次 reset 后都会立即调用 setMode() 覆盖 | 低 |
| 双人模式密码明文存于 localStorage | `storage.js`, `state.js` | 玩家二可打开 DevTools 查看密码；已知限制，适合当面玩 | 低（设计局限） |
| 移动端矮屏（< 820px 高）猜测阶段隐藏 header，无模式提示 | `base.css:107-109` | 用户在猜测中可能忘记自己在哪个模式；`guessTitle` 仍可见 | 低 |

---

## 十、CSS 架构要点

**响应式策略**：
- 桌面（>= 960px）：`main-layout` 两栏布局（棋盘左 + 操作面板右）
- 移动端 + 猜测阶段：`body.game-phase--guessing` 触发固定分屏，棋盘历史可滚动，操作面板固定底部
- `env(safe-area-inset-bottom)` 处理 iPhone 底部安全区

**颜色系统**（`variables.css`）：
- 背景 `--bg-base: #121212`，卡片 `--bg-card: #1c1c1e`，细节 `--bg-subtle: #2c2c2e`
- 主色调 `--color-accent: #0a84ff`（蓝色），强调 `--color-correct: #32d74b`（绿）、`--color-misplaced: #ff9f0a`（橙）

**关键 CSS 类**：
- `.ball--empty` — 空槽（虚线边框）
- `.ball--used` — 已选（透明度 0.2，禁止再次点击）
- `.ball--focused` — 当前焦点（白色描边）
- `.game-phase--guessing` — 切换到猜测阶段分屏布局
- `.legend-sheet--open` — 反馈说明面板展开动画

---

## 十一、测试覆盖范围

```
tests/engine.test.js     16 个 — calcFeedback（含 5 槽）、generateSecret（含 8 色 / 5 槽）、isWinningFeedback
tests/daily.test.js      10 个 — dateToChallengeKey，hashStringToSeed，createSeededRng，generateDailySecret，isDailySessionForKey，hasCompletedDaily
tests/stats.test.js      11 个 — 首局初始化，预设分桶，连续连胜，失败归零，非连续归一，首次归一，平均步数，防重复计算，365 条上限
tests/storage.test.js     9 个 — 序列化/恢复，旧 session 补位，版本校验，显式清除，默认值，normalizeStats
tests/share.test.js       5 个 — feedbackToEmoji，各模式分享标题，失败显示 X，不泄露颜色 ID
tests/mode-config.test.js 4 个 — 单人预设参数、重复规则、预设列表
```

**不在测试范围内**：DOM 操作（`ui.js`）、事件绑定（`game.js`）、CSS 样式。

---

## 十二、扩展开发指南

### 调整单人预设难度

1. `js/mode-config.js`：修改 `starter / classic / hard / expert` 的 `codeLength`、`maxGuesses`、`paletteColorCount`
2. `index.html`：同步更新 `screenSingleModes` 中对应卡片的规格文案
3. 如增加或减少档位：同步调整 `SINGLE_PRESET_IDS`、`js/game.js` 中按钮映射和统计展示预期

### 修改颜色数量

1. `constants.js`：修改 `COLORS` 数组（id 格式为 `c1`、`c2`...）
2. 检查 `mode-config.js` 中各模式的 `paletteColorCount` 与 `codeLength`，确保 `!allowDuplicates` 时 `paletteColorCount >= codeLength`
3. 调色盘布局在 `game.css` 中通过 `palette` 的 `flex-wrap` 自动换行；当前 8 色会形成 `4 + 4`

### 修改最大猜测次数

1. `mode-config.js` 中修改对应模式的 `maxGuesses`
2. **注意**：`storage.js` 的版本号不需要变（结构未变），但如果想清除旧存档，把 `STORAGE_VERSION` 从 `1` 改为 `2`

### 添加新的统计字段

1. `stats.js:createDefaultStats()` 中加字段
2. `stats.js:normalizeStats()` 中加合并逻辑（保证向后兼容旧存档）
3. `stats.js:recordGameResult()` 中更新字段
4. `stats.js:buildStatsPanelSections()` 中补齐聚合逻辑
5. `ui.js:renderStatsPanel()` 中渲染

### 升级存档格式

将 `storage.js` 中的 `STORAGE_VERSION` 递增，旧存档会被自动清除并使用默认值（当前策略，无迁移逻辑）。
