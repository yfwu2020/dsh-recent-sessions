# dsh-recent-sessions · 最近会话

侧栏底部的**一行入口 + 一个浮层**：入口长在**工作区列表下方、Settings 上方**（官方
`sidebar.footer.action` 席位），点它，最近的会话按**最后活动时间倒序**从入口**上方**
浮出来盖住工作区列表；点一行直接切过去。

浮层刻意**不像一个浮层** —— 没有卡片、没有描边、没有圆角、没有投影，满宽贴边、
底色就是侧栏底色，上缘用一段渐隐把工作区列表"化"进来。目标只有一个：**看着像侧栏
自己多出来的一截**，而不是一个飘在上面的窗口。

## 它长什么样

- **入口**：`› 最近会话  12` —— 和下面的「设置」同一款式，就是侧栏多了一行；
  点它展开/收起（状态记在 `localStorage`）
- **展开**：列表从入口上方长出来，盖住工作区列表；入口原地不动（位置不跳）
- **收起方式**：只有两个途径 —— 再点入口，或按 `Esc`。
  **点浮层外不收起**（连续切好几个会话时，不该被手滑点到别处打断）
- **每行两行字**：**会话标题** + `相对时间 · 工作区名`
- **标题前有状态标识**（与官方会话行前面那枚完全同一套语义与配色，见下节）
- **当前会话**整行高亮（`aria-current`）
- **没有滚动条**：列表照常能滚，用上下两段渐隐提示"还有内容"
- **侧栏收起时什么都不留**：没有圆点、没有胶囊、不占位（见下）

## 标题前的状态标识

三种状态是**同一颗 6px 圆点**（10px 槽位、核心 inset 20%），只有颜色与动效不同。
只画**主状态**，优先级与官方 `sessionStatuses()` 逐条对齐：

| 状态 | 视觉 | 什么时候 |
| --- | --- | --- |
| `warning` | **黄点**（`--dsw-alias-state-warn-primary`） | 会话在等你：`question`（等待回答）/ `approval`（等待批准）/ `plan-review`（等待计划确认） |
| `ongoing` | **蓝色呼吸点**（`--dsw-static-deepseek-450`，1.6s 明暗循环） | 正在跑（`running`） |
| `done` | **绿点**（`--dsw-alias-state-success-primary`） | **跑完了但还没打开过**（`completionUnread`） |
| `idle` | 槽位留着，里面不画点 | 其余 |

优先级不是随手排的：**正在等你回答的会话，哪怕同时在跑，也该显示"等你"**（黄 > 蓝 > 绿）。

⚠️ **槽位永远占位**（`.dsh-rs__status` 固定 14px）。踩过一次：idle 写成 `return null`
让没有状态的行少了 14px 前导宽度，标题整排往左跳、和有点的行对不齐。所以 idle 只省略
**里面的图形**，不省略**外面的槽**。

数据取自官方 `uiSession` 服务的 `sessionStatus` 源（`Map<sessionId, {running, pendingInteraction, completionUnread}>`）
—— 就是官方侧栏那枚点用的**同一个事实源**，不是我们从 transport 另推一份。所以"已完成未打开"
的判定（打开即清）、"正在等你回答"的判定都只发生在宿主那一侧，两边永远不会各说各话。

状态对读屏是有语义的，所以每个状态都配了一段 visually-hidden 文案（`运行中` / `等待回答` /
`等待批准` / `等待计划确认` / `已完成`），做法与官方 `SessionStatusDots` 一致 —— 状态不只做成一个颜色。

排查用：控制台 `__dshRecentSessions.states` 直接列出当前每行的 `状态:文案`，
`__dshRecentSessions.statusSource` 说明状态源有没有拿到。

## 为什么"看不出来是浮层"

| 手法 | 具体做法 |
| --- | --- |
| 不画卡片 | 没有 `border` / `border-radius` / `box-shadow`；`left:0; right:0` 满宽贴边 |
| **不画底色** | 浮层 `background: transparent` —— 它**没有自己的颜色**，露出来的就是侧栏自己的背景。这是"颜色不割裂"的关键：macOS 的侧栏是"半透明底色 + 原生 vibrancy"，任何自己调出来的实色（94% 也好、72% 也好）都会比周围实一点/蓝一点 |
| 把背后抠掉 | 工作区列表是别人的 DOM，直接露出来会和浮层文字叠在一起。所以在 `[class*="_regionArea"]` 上挂一条 `mask-image`：**浮层盖住的那一段整个透明掉**，上沿**硬边、不羽化**（`linear-gradient(to top, transparent Npx, #000 Npx)`，两个色标同位置） |
| 上方留出空白 | 抠除边界抬到浮层上沿**再往上 `REGION_GAP`(14px)**，所以浮层标题和工作区标题之间永远隔着一块干净的侧栏底色 |
| 对齐行边界 | 抬上去之后用 `snapToRow()` 把边界**吸附到行边界**（找包含切割线的最小元素，从它的上沿开始抠）—— 否则会有一行字被横着切一半，看着像渲染坏了 |
| 上沿圆角 + 投影 | `border-radius: 12px 12px 0 0` + 两段**极小**的 `box-shadow`（`0 -1px 1px / .04` + `0 -2px 8px / .08`，深色模式加重一档）。**因为浮层不画底色，圆角是靠上边框的弧线 + 阴影轮廓"读"出来的** —— 所以上沿那条线必须是 `border-top`（只有 border 会跟着 `border-radius` 在两侧弯下去，伪元素画不出弧线），配 `box-sizing: border-box` 免得吃高度。阴影刻意收得极小：铺大了会把浮层周围压暗，反而显得"浮层的颜色和别人不一样"（实测 10px 之外已完全恢复底色） |
| 上沿一条分隔线 | 就是上面那条 `border-top`：**1px + `--dsw-alias-border-l4`**（浅色 16% 黑 / 深色 20% 白）。外壳自己那些 0.5px + l3 的分隔线在这里偏弱，浮层上沿需要一个能看清的收口 |
| 顶部留白（不跟着滚） | **`padding-top: 5px` 写在浮层自己身上**（`.dsh-rs__float`），不是写在滚动容器上。写在列表上的话这块留白会跟着内容一起滚走 —— 一滚，行就滑进留白、顶到分隔线。现在列表的滚动区从留白以下才开始，**这块留白永远是干净的**，内容只在它下面滚 |
| 顶部几何（算空隙时以哪条线为准） | 自上而下四条基准：**① 工作区列表切割线 = border 0**（`REGION_GAP = 0`，列表就在分隔线上切断） → **② 阴影外缘 = border −8px** → **③ `border-top` 分隔线 = 0** → **④ 第一行标题顶端 = border +10px**（浮层 5px + 行内 5px）。⚠️ **视觉上的"上沿"是 ②（阴影外缘），不是 ③** —— 按视觉算，标题到上沿是 **②→④ = 18px**。以后调空隙都按 ② 起算 |
| 兜底 | 万一外壳改结构、拿不到浏览区，浮层自动带上 `data-surface="fill"` 自己画底色（macOS 上再加 `backdrop-filter`），功能不受影响 |
| 无滚动条 | `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`；列表用 `mask-image` 做渐隐代替滚动条 —— **只留下缘那一条**（"下面还有"）。上缘一律不加渐隐：只要它存在，列表顶部那一行（停在顶部时是第一行、往上滚过时是半行）就会被糊成半透明，看着就是"标题模糊"。代价是往上滚时最上面那行在浮层上沿被硬切，由那条分隔线收口 |
| 行同款 | 行距、字号、缩进、hover 底色都对齐侧栏自己的工作区行 |

## 侧栏收起时

**什么都不渲染。** `wide === false` 时组件直接返回 `null`：

- **macOS**：收起时外壳把侧栏整列收成 **0 宽**（`computeColumns()` 里
  `collapsedWidth = darwin ? 0 : 56`），改用 `shell.leading` 席位在内容区左上角画控件 ——
  本节点本就会被裁掉；`measure()` 里还有一道 `width < 80 → 不渲染` 的兜底。
- **Linux / 浏览器等 56px 轨道平台**：靠这个 `null` 兜住，不给细柱子里塞任何东西。

## 挂在哪（两个位置）

```
官方侧栏外壳：品牌行 → 全局面板行 → 工作区/会话浏览区(sidebar.workspaces, single, ui-workspace 独占)
            → 页脚(sidebar.footer.action 列表 + sidebar.settings)
```

1. **入口**注册进 `sidebar.footer.action`（root 作用域 list 席位）—— 位置正是工作区
   下方，而且是官方扩展点：不观察 DOM、不往 React 管的子树里塞外来节点。
2. **浮层本体**用 `createPortal` 挂到 `document.body` + `position:fixed`，坐标从侧栏列
   （`[class*="_sidebarCol"]`）和入口自身量出来。这样既不会被侧栏列的 `overflow:hidden`
   裁掉，也不怕外壳以后给祖先加 `transform`（`position:fixed` 会被 transform 关进盒子里）。

量出来的几何：宽度 = 侧栏列宽；底边 = 入口行上沿（所以入口永远看得见）；
**高度上限 = 工作区浏览区的高度** —— 浮层最多把工作区列表整个接管，
不会往上顶到品牌行或"新的对话"那几行。同一趟还量出浏览区的底边，用来算要抠掉多少。

## 高度拖动

**手柄就是浮层顶边本身，不画任何东西** —— 一个骑在边框上、跨两侧各 4px 的**透明**命中区
（形态照抄官方侧栏分隔线手柄 `_handle`：`cursor:col-resize / width:8px / margin-left:-4px /
absolute`，这里从竖直改成水平：`ns-resize` + 上下各 4px）。

- 往上拖 = 变高（浮层钉在入口上方），下限 120px
- 拖出来的高度存 `localStorage['dsh.recent-sessions.height.v2']`；双击清掉该键回到默认 268px
- 用 Pointer Events + `setPointerCapture`：拖出浮层范围、拖到窗口边缘都不丢事件
- 拖动中给 `<body>` 打 `dsh-rs-dragging`：整页禁选中、光标全程 `ns-resize`
- 键盘可达：手柄是 `role="separator"` 可聚焦节点，`↑`/`↓` 等效拖动（`Shift` 大步），
  `aria-valuenow` 报当前高度

> **存储键带 `.v2`**：旧版是"钉在底部的常驻面板"（默认展开、高度从工作区借空间），
> 新版是"盖在列表上的浮层"（默认收起、高度上限不同）。两种形态的偏好不通用，
> 沿用旧键会让老用户一进来就是摊开的，所以换键、从新默认值开始。

## 数据从哪来（不新建事实源）

直接订阅官方客户端服务：

| 服务 | 用途 |
| --- | --- |
| `sessions.list` | 会话摘要：`title` / `updatedAt` / `running` / `blank` / `retainedBy` |
| `workspaces.list` | `items[].sessionIds`（反查工作区名）、`archivedSessionIds`（排除归档） |

- 排序键就是会话摘要自己的 `updatedAt`，与官方侧栏行上那个相对时间同源；
- 当前会话用 `retainedBy.mainView > 0` 判定，与官方"选中行"永远一致；
- 过滤掉**子代理**会话（不是对话）与**已归档**会话。

## 点击怎么跳

1. 首选 `uiWorkspace.openSession(id)` —— ui-workspace 注册的客户端服务，走官方
   `replaceMain` 路径，含归档校验、引用释放、切回主面板；
2. 拿不到就退回"点官方那一行"：官方会话行带 `data-row-key="session:<id>"`，派发一个
   冒泡 `click`，React 自己的 `onOpen` 接手，语义与手点完全一致。

## 配色 / 箭头

- 颜色全部走宿主 `--dsw-*` token，不硬编码，随主题（浅色/深色）走。
- 入口箭头：**收起 `›`、展开 `⌃`** —— 浮层在入口上方，所以展开时箭头指上去
  （CSS 一行：`.dsh-rs__trigger[aria-expanded="true"] .dsh-rs__caret { rotate: -90deg }`，
  想要"官方惯例"的展开朝下就把它改成 `90deg`）。

## 配置

改 profile 的 `cordis.patch.yml` 里同 `id: recent-sessions` 行：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `maxItems` | 12 | 最多列几条（3–50） |
| `showWorkspace` | true | 是否显示工作区名 |
| `defaultCollapsed` | **true** | 浮层初始是否收起（浮层盖在列表上，默认收起更不挡路） |
| `refreshMs` | 30000 | 相对时间刷新间隔 |

Host 只暴露一个只读配置路由 `/dsh-recent-sessions/api/config`；**会话数据不经过 Host**。

## 开发

```bash
npm install
bash scripts/build.sh      # host tsc → lib/ + client tsdown → lib/client.js
```

装到本机（免重启）：

```bash
dsh plugin --profile desktop add @yfwu2020/dsh-recent-sessions   # 生产：重启后由 bundles 接管
```

或运行时注入 / 热重载：对 AI 说 `dev_inject_plugin {"dir": "<本目录>"}` /
`dev_reload_package {"packageName": "dsh-recent-sessions"}`。

改完 client 需要**刷新一次 GUI 窗口**（客户端 bundle 不走 dev:web 热更新）。

## 排错

- 入口没出现 → 控制台执行 `__dshRecentSessions`，看 `mounted` / `rows` / `collapsed` / `geometry`
- 展开后浮层不出现 → 看 `geometry` 是不是 `null`：`null` 表示量不到侧栏
  （`[class*="_sidebarCol"]` 宽度 < 80，比如侧栏正收起），或入口此时不可见
- 浮层位置不对 → 外壳侧栏列类名变了，改 `SIDEBAR_SEL` 的子串
- `slots.register` 报 `slot "sidebar.footer.action" is not declared`
  → 侧栏外壳版本变了，用当前版本 `lib/client.js` 里声明的席位名替换
- 配色不对 → 面板只用 `--dsw-*` token，检查主题是否注入了这些变量
