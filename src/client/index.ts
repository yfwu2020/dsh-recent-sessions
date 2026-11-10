/**
 * @yfwu2020/dsh-recent-sessions —— 浏览器半：侧栏底部的「最近会话」入口 + 浮层。
 *
 * ── 长什么样 ──────────────────────────────────────────────────────────
 * 侧栏页脚一行入口：`› 最近会话  12`（和「设置」同一款式，看上去就是侧栏多了一行）。
 * 点它，列表从入口**上方**浮出来盖住工作区列表；再点它或按 `Esc` 收回
 * （点浮层外**不**收起 —— 连续切几个会话时不该被手滑点到别处打断）。
 *
 * 浮层**刻意不像一个浮层**：没有卡片、没有描边、没有圆角、没有投影，满宽贴边，
 * 而且**不画底色** —— 它盖住的那段工作区列表被抠掉，露出来的是侧栏自己的背景，
 * 所以颜色天然一致；上沿只留一条浅分隔线收口（不羽化）。
 * 列表不画滚动条，改用上下两段渐隐提示"还有内容"。
 *
 * ── 挂在哪 ────────────────────────────────────────────────────────────
 * 官方侧栏外壳自上而下：品牌行 → 全局面板行 → 工作区浏览区
 * （`sidebar.workspaces`，single 席位，ui-workspace 独占）→ 页脚
 * （`sidebar.footer.action` 列表 + `sidebar.settings`）。
 *
 * 工作区浏览区是 single 席位、已被独占，外壳没有"再塞一块面板"的通用口子；
 * 所以**入口**注册进 `sidebar.footer.action`（root 作用域 list 席位）—— 位置正是
 * 工作区下方，而且是官方扩展点：不观察 DOM、不往 React 管的子树里塞外来节点。
 *
 * **浮层本体**则用 portal 挂到 `document.body` + `position:fixed`：既不会被侧栏列的
 * `overflow:hidden` 裁掉，也不怕外壳以后给祖先加 `transform`。
 *
 * 位置有两条路（见 `ANCHOR_SUPPORTED` 与组件里的 `anchored`）：
 *
 *   · **锚点定位**（Chromium 125+ 等）：给侧栏列和入口行挂上 `anchor-name`，浮层的
 *     `left/width/top` 直接用 `anchor()` / `anchor-size()` 引用它们 —— 由浏览器排版时
 *     解析，和侧栏**同一帧**到位，横向完全不经过 JS。
 *   · **量坐标**（回退）：老浏览器上仍然量一次、写回去。它每帧慢一拍（`ResizeObserver`
 *     回调在本帧排版之后，`setState` 又要等到绘制之后才落地），所以只是兜底。
 *
 * ── 侧栏收起时 ────────────────────────────────────────────────────────
 * **什么都不留**：`wide === false` 直接返回 null —— 没有圆点、没有胶囊、不占位。
 * （macOS 收起时外壳把侧栏整列收成 0 宽、改用 `shell.leading` 席位在左上角画控件，
 *  本节点本就会被裁掉；Linux/浏览器等 56px 轨道平台则靠这个 null 兜住。）
 *
 * ── 数据从哪来（不新建事实源） ────────────────────────────────────────
 * 直接订阅官方客户端服务快照：
 *   `sessions.list`   会话摘要 title / updatedAt / running / blank / retainedBy
 *   `workspaces.list` items[].sessionIds（反查工作区名）、archivedSessionIds（排除归档）
 * 排序键就是会话摘要自己的 `updatedAt`，与官方侧栏行上那个相对时间同源；
 * 当前会话用 `retainedBy.mainView > 0` 判定，与官方"选中行"永远一致。
 *
 * ── 点击怎么跳 ────────────────────────────────────────────────────────
 * 首选 `uiWorkspace.openSession(id)`（走官方 replaceMain 路径，含归档保护）；
 * 拿不到就退回"点官方那一行"：官方会话行带 `data-row-key="session:<id>"`。
 *
 * ── 配色 ──────────────────────────────────────────────────────────────
 * 全部走宿主 `--dsw-*` token，不硬编码颜色，随主题走。
 * macOS 的侧栏本身是"半透明底色 + 原生 vibrancy"，所以那里额外用
 * `backdrop-filter` 让浮层与侧栏同材质；其他平台侧栏不透明，直接用底色。
 */
import * as React from 'react'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/** 客户端 cordis 上下文：只用到官方客户端服务。 */
interface SlotsLike {
  inject: (name: string, factory: () => unknown) => () => void
  register: (entry: {
    name: string
    id: string
    order?: number
    registrant?: string
  }, component: unknown) => unknown
}

interface ClientContext {
  slots: SlotsLike
  effect: (fn: () => unknown, label?: string) => unknown
  get?: (name: string, strict?: boolean) => unknown
  logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void }
}

/** 快照存储：官方 `createSnapshotStore` 的最小面。 */
interface SnapshotStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
}

interface SessionSummary {
  sessionId?: string
  title?: string
  updatedAt?: number
  running?: boolean
  blank?: boolean
  retainedBy?: Record<string, number>
  /** 客户端快照的子代理标记（官方字段是 origin，不是 address）。 */
  origin?: 'subagent'
  /** 子代理会话指向的父会话。 */
  parentId?: string
  /** 早期快照里的同义字段，保留兼容。 */
  address?: { kind?: string }
}

interface SessionsSnapshot {
  byId?: Record<string, SessionSummary>
}

interface WorkspaceItem {
  workspaceId: string
  title?: string
  sessionIds?: string[]
}

interface WorkspacesSnapshot {
  items?: WorkspaceItem[]
  archivedSessionIds?: string[]
  pinnedSessionIds?: string[]
}

/** 官方 workspaces 客户端模型上我们会用到的动作（拿不到就降级提示）。 */
interface WorkspaceActions {
  archiveSession?: (sessionId: string, options?: { stopActivity?: boolean }) => Promise<unknown>
  unarchiveSession?: (sessionId: string) => Promise<unknown>
  pinSession?: (sessionId: string) => Promise<unknown>
  unpinSession?: (sessionId: string) => Promise<unknown>
}

/** 官方 sessions 客户端模型上我们会用到的动作。 */
interface SessionActions {
  rename?: (sessionId: string, title: string) => Promise<{ ok?: boolean; error?: { message?: string } } | void>
  fork?: (options: { sessionId: string; increaseTitle?: boolean }) => Promise<unknown>
}

interface PanelConfig {
  maxItems: number
  showWorkspace: boolean
  defaultCollapsed: boolean
  refreshMs: number
}

interface PanelRow {
  id: string
  title: string
  meta: string
  running: boolean
  current: boolean
  /** 主状态：与官方会话行前面那枚标识同一套语义。 */
  state: StatusState
  /** 是否已置顶（官方 workspaces 快照的 pinnedSessionIds）。 */
  pinned: boolean
  /** 该状态给读屏的文案。 */
  stateLabel: string
}

/**
 * 官方 `StateDot` 的状态集合。`idle` = 什么都不画。
 *
 * 优先级完全照抄 ui-workspace 的 `sessionStatuses()`：
 *   待询问(warning) > 运行中(ongoing) > 已完成未打开(done) > idle
 * —— 顺序不是随手排的：正在等你回答的会话，哪怕同时在跑，也该显示"等你"。
 */
type StatusState = 'idle' | 'ongoing' | 'warning' | 'done'

/** 会话状态条目：官方 ui-session 的 `sessionStatus` 快照值。 */
interface SessionStatusEntry {
  running?: boolean
  completionUnread?: boolean
  pendingInteraction?: { kind?: string }
}

/** 官方只把这三种待交互当作"要展示的状态"（`visiblePendingKind`）。 */
function visiblePendingKind(kind: string | undefined): string | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

/** 待询问的读屏文案（按官方三种 kind 分）。 */
function pendingLabel(kind: string): string {
  if (kind === 'approval') return '等待批准'
  if (kind === 'plan-review') return '等待计划确认'
  return '等待回答'
}

/** 量出来的几何：浮层该待在哪儿。 */
interface FloatGeometry {
  /** 视口坐标：浮层左边 */
  left: number
  /** 浮层宽度（= 侧栏列宽） */
  width: number
  /** 视口坐标：浮层底边距视口底部多远（贴着入口行上沿） */
  bottom: number
  /** 本次最多能长到多高 */
  maxHeight: number
  /** 工作区浏览区底边（视口坐标）；量不到时 = 浮层底边 */
  regionBottom: number
  /** 工作区浏览区顶边（视口坐标）—— 算裁切线要用它当原点 */
  regionTop: number
  /** 有没有量到工作区浏览区（决定浮层要不要自带底色，见下） */
  hasRegion: boolean
}

const CONFIG_URL = '/dsh-recent-sessions/api/config'
const STYLE_ID = 'dsh-recent-sessions/css'
/** 本包名：宿主 client-modules 用 `style[data-plugin="<包名>"]` 记样式归属。 */
const PLUGIN_ID = '@yfwu2020/dsh-recent-sessions'
/**
 * 收起状态 / 高度都带 `.v2`：
 *
 * 旧版是"钉在侧栏底部的常驻面板"（默认展开、高度从工作区借空间），新版是
 * "盖在工作区列表上的浮层"（默认收起、高度上限不同）。两种形态的偏好不通用 ——
 * 沿用旧键的话，老用户一进来浮层就是摊开的、还可能顶到品牌行，所以换键，
 * 让新版从自己的默认值开始；用户点一次之后照旧记住。
 */
const COLLAPSE_KEY = 'dsh.recent-sessions.collapsed.v2'
const HEIGHT_KEY = 'dsh.recent-sessions.height.v2'
/** 「从最近会话移除」的本地集合：只影响这个列表，不动会话本身。 */
const REMOVED_KEY = 'dsh.recent-sessions.removed.v1'
/** 已经从磁盘删掉的会话 id：宿主重扫前先本地过滤，避免幽灵行。 */
const DELETED_KEY = 'dsh.recent-sessions.deleted.v1'
const SESSION_INSPECT_URL = '/dsh-recent-sessions/api/sessions/inspect'
const SESSION_DELETE_URL = '/dsh-recent-sessions/api/sessions/delete'
/** 橡皮筋最多拉这么长；拉满 = 「已归档」抽屉弹出。 */
const PULL_MAX = 72
/** 抽屉露出后，无操作多久自动缩回。 */
const RAIL_HOLD_MS = 4500

/** 浮层高度下限：够三行多一点点，再小就没法选了。 */
const MIN_HEIGHT = 120
/** 默认高度（没拖过就用它）。 */
const DEFAULT_HEIGHT = 268
/** 浮层顶部与侧栏顶沿之间至少留这么多（只在量不到浏览区时当兜底）。 */
const TOP_KEEP = 24
/** 侧栏列的选择器：类名带构建哈希，用子串匹配。 */
const SIDEBAR_SEL = '[class*="_sidebarCol"]'
/** 工作区浏览区（`sidebar.workspaces` 的容器）选择器，同上。 */
const REGION_SEL = '[class*="_regionArea"]'

/**
 * 锚点名（`anchor-name` 的值，都是 dashed-ident）。
 *
 * 列名打在侧栏列上（运行时写一次，见 `ensureColumnAnchor`）；入口行名直接写在
 * **自己那两个入口**的 CSS 里（`.dsh-rs__trigger` / `.dsh-rs__titlebar`），零 JS。
 */
const ANCHOR_COL = '--dsh-rs-col'
const ANCHOR_TRIGGER = '--dsh-rs-trigger'

/**
 * 浏览器**理论上**能不能「用锚点直接给出位置和宽度」。
 *
 * 三项缺一不可：`anchor-name` 声明、`anchor()` 取坐标、`anchor-size()` 取尺寸
 * （少了最后一项，左边缘对得上、右边缘还是会差一截）。
 * 探测在模块求值时跑一次；之后渲染只看这个常量，不再问 `CSS.supports`。
 *
 * 注意这只是「浏览器会」。**真的有没有用上**是运行期的另一件事：浮层第一次挂出来时
 * 会做一次实测对账（`verifyAnchor`），对不上就永久降级成量坐标 —— 所以组件里用的是
 * 状态 `anchored`，不是这个常量。
 */
const ANCHOR_SUPPORTED: boolean = (() => {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false
  try {
    return CSS.supports('anchor-name: --dsh-rs-probe')
      && CSS.supports('left: anchor(--dsh-rs-probe left)')
      && CSS.supports('width: anchor-size(--dsh-rs-probe width)')
  } catch {
    return false
  }
})()
/** 列表底部默认留白（写在 CSS 里；内容够不着一屏、或算不出来时就用它）。 */
const LIST_PAD_BASE = 16
/** 末行要躲开下缘那条 16px 渐隐，所以底部补白至少留这么多。 */
const LIST_PAD_MIN = 20
/**
 * 滑动的"速度"：每毫秒走多少像素。
 *
 * 原型里那张卡是 210px / 320ms ≈ 0.66；**时长必须按卡片高度算**，不能写死 ——
 * 写死的话，你把浮层拖得越高，同样的时长要跑越长的距离，起步就越快、越生硬。
 * 曲线不变（还是原型那条），变的只是单位时间走多少像素。
 */
const SLIDE_PX_PER_MS = 0.66
const SLIDE_MIN_MS = 260
const SLIDE_MAX_MS = 560
/** 滑回去比滑上来略快（慢进快出）。 */
const SLIDE_OUT_RATIO = 0.88
/** 滑回去播完再等这么久才卸载节点。 */
const EXIT_SLACK_MS = 60
const SLIDE_EASE = 'cubic-bezier(.22, 1, .36, 1)'
/** 裁切容器比卡片上沿高出来的部分：给卡片自己的上边缘投影让位。 */
const CLIP_HEADROOM = 24
/** 裁切容器下沿的渐隐高度：让卡片的上边框/投影滑出时"化掉"，不会在入口线上闪一道线。 */
const CLIP_BOTTOM_FADE = 6
/**
 * 收起态再多滑一点，让边框和投影彻底出界。
 * **别调大**：卡片的行程 = 高度 + 这个值，而裁切线的行程 = 高度 —— 差多少，
 * 动画途中工作区文字就比卡片上沿早"停"多少（中间留一条空带）。那道线本身已经由
 * 裁切容器下沿的 6px 渐隐接管，所以这里只要 2px 余量就够。
 */
const SLIDE_OVERSHOOT = 2

/** 按卡片高度算这一趟滑动的时长（工作区裁切线必须用同一个值）。 */
function slideTiming(height: number): { inMs: number; outMs: number } {
  const base = Math.min(SLIDE_MAX_MS, Math.max(SLIDE_MIN_MS, Math.round(height / SLIDE_PX_PER_MS)))
  return { inMs: base, outMs: Math.round(base * SLIDE_OUT_RATIO) }
}

const DEFAULT_CONFIG: PanelConfig = {
  maxItems: 12,
  showWorkspace: true,
  // 默认收起：浮层是盖在工作区列表上的，一进来就摊开会挡住工作区
  defaultCollapsed: true,
  refreshMs: 30000,
}

const PANEL_CSS = `
/* ── 入口行：住在 sidebar.footer.action 席位，长得像侧栏自己的行 ── */
.dsh-rs__trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  /* 宿主把 footer 席位排成横向 flex：排到最前，浮层就只覆盖工作区列表 */
  order: -1;
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: start;
  /* 锚点：浮层的底边钉在这一行的顶边上（见 @supports 块）。不支持时这一行被忽略 */
  anchor-name: ${ANCHOR_TRIGGER};
}
.dsh-rs__trigger:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05)); }

/* 宿主把 sidebar.footer.action 排成横向 flex（display:flex，默认 row）。
   本面板与其它「整行」插件会互相挤压，两个入口都在时改成纵向堆叠。 */
[class*="footerActions"]:has(.dsh-rs__trigger, .dsh-rs__titlebar) { flex-direction: column; }

.dsh-rs__trigger:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: -2px;
}
.dsh-rs__caret {
  flex: none;
  opacity: .55;
  transition: rotate 720ms var(--ds-ease-in-out, ease);
}
/* 收起 ›  →  展开 ⌃：浮层在入口**上方**，箭头指上去 */
.dsh-rs__trigger[aria-expanded="true"] .dsh-rs__caret { rotate: -90deg; }
.dsh-rs__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-rs__count {
  position: relative;
  flex: none;
  width: 18px;
  height: 16px;
}
.dsh-rs__num {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary, inherit);
  font-variant-numeric: tabular-nums;
  transition: opacity 480ms ease;
}

/* ── 归档标题行（入口位）：普通 / 搜索 / 选择，按工作区搜索的展开方式 ──
 * 搜索/选择都是同一行里的宽度动画：标签收起、动作区展开，360ms；
 * 搜索态变成带描边的行内输入框，选择态把选择按钮撑成三枚动作。
 */
.dsh-rs__titlebar {
  /* 归档视图的入口行与最近会话入口一致：排到 footer 席位最前 */
  order: -1;
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  /* 归档视图里入口就是这一行 —— 同样给浮层当锚点（两个入口只会存在一个） */
  anchor-name: ${ANCHOR_TRIGGER};
}
.dsh-rs__tback {
  position: relative;
  flex: none;
  width: 11px;
  height: 22px;
  margin-right: 7px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #888);
  cursor: pointer;
}
.dsh-rs__tback::after { content: ""; position: absolute; inset: -4px -6px; }
.dsh-rs__tback svg { width: 11px; height: 11px; }
.dsh-rs__tback:hover { color: var(--dsw-alias-label-secondary, #555); }
.dsh-rs__tlabels {
  position: relative;
  flex: none;
  /* 双标签是绝对定位交叉淡换的，容器宽度必须给定值；用 flex 分摊会在收回时抖动 */
  width: 64px;
  height: 16px;
  margin-right: 7px;
  overflow: hidden;
  transition:
    width 360ms var(--ds-ease-in-out, ease),
    opacity 240ms var(--ds-ease-in-out, ease),
    margin-right 360ms var(--ds-ease-in-out, ease);
}
.dsh-rs__titlebar[data-mode="search"] .dsh-rs__tlabels {
  width: 0;
  opacity: 0;
  margin-right: 0;
}
.dsh-rs__tlabel {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
  transition: opacity 240ms var(--ds-ease-in-out, ease);
}
.dsh-rs__tlabel--select { opacity: 0; }
.dsh-rs__titlebar[data-mode="select"] .dsh-rs__tlabel--normal { opacity: 0; }
.dsh-rs__titlebar[data-mode="select"] .dsh-rs__tlabel--select { opacity: 1; }
.dsh-rs__tlabel b {
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary, #888);
  font-variant-numeric: tabular-nums;
}
.dsh-rs__tact {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.dsh-rs__tsearch {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 22px;
  height: 26px;
  display: flex;
  align-items: center;
  border-radius: 7px;
  overflow: hidden;
  transition:
    max-width 360ms var(--ds-ease-in-out, ease),
    opacity 240ms var(--ds-ease-in-out, ease),
    box-shadow 240ms var(--ds-ease-in-out, ease);
}
.dsh-rs__titlebar[data-mode="search"] .dsh-rs__tsearch {
  max-width: 100%;
  box-shadow: inset 0 0 0 .5px var(--dsw-alias-border-l4, rgb(0 0 0 / .16));
}
.dsh-rs__titlebar[data-mode="select"] .dsh-rs__tsearch {
  max-width: 0;
  opacity: 0;
}
.dsh-rs__tsearch .dsh-rs__tbtn { flex: none; }
.dsh-rs__tinput {
  flex: 1 1 auto;
  min-width: 0;
  width: 0;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 11.5px;
  font-weight: 400;
  outline: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 240ms var(--ds-ease-in-out, ease);
}
.dsh-rs__titlebar[data-mode="search"] .dsh-rs__tinput {
  opacity: 1;
  pointer-events: auto;
}
.dsh-rs__tinput::placeholder { color: var(--dsw-alias-label-tertiary, #888); }
.dsh-rs__tclear {
  opacity: 0;
  pointer-events: none;
  transition: opacity 240ms var(--ds-ease-in-out, ease);
}
.dsh-rs__titlebar[data-mode="search"] .dsh-rs__tclear {
  opacity: 1;
  pointer-events: auto;
}
.dsh-rs__tselect {
  flex: none;
  max-width: 22px;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  transition:
    max-width 360ms var(--ds-ease-in-out, ease),
    opacity 240ms var(--ds-ease-in-out, ease);
}
.dsh-rs__titlebar[data-mode="select"] .dsh-rs__tselect { max-width: 94px; }
.dsh-rs__titlebar[data-mode="search"] .dsh-rs__tselect { max-width: 0; opacity: 0; }
.dsh-rs__tbtn {
  width: 22px;
  height: 22px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #888);
  cursor: pointer;
  flex: none;
}
.dsh-rs__tbtn svg { width: 14px; height: 14px; }
.dsh-rs__tbtn:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .06)); color: var(--dsw-alias-label-secondary, #555); }
.dsh-rs__tbtn:disabled { opacity: .35; cursor: default; }
.dsh-rs__tbtn:disabled:hover { background: transparent; color: var(--dsw-alias-label-tertiary, #888); }
.dsh-rs__tbtn:focus-visible,
.dsh-rs__tback:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: 1px;
}
.dsh-rs__tbtn--danger {
  color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 38%, var(--dsw-alias-label-tertiary, #888));
}
.dsh-rs__tbtn--danger:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 8%, transparent);
  color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 55%, var(--dsw-alias-label-tertiary, #888));
}

/* ── 浮层本体 ──────────────────────────────────────────────────────
 * 满宽贴边、没有卡片感，而且**默认连底色都没有**：浮层盖住的那段工作区列表
 * 已经被 mask 抠掉（见 maskRegion），所以露出来的就是侧栏自己的背景 ——
 * macOS 上是"半透明底色 + 原生 vibrancy"。同材质是构造出来的，不是调出来的，
 * 因此不会出现"浮层比侧栏实一点/蓝一点"的割裂。
 *
 * 兜底：万一外壳改了结构、拿不到浏览区，就带上 data-surface="fill" 自带底色。
 * ──────────────────────────────────────────────────────────────── */
/*
 * 裁切容器：卡片从**入口那条线底下**滑出 —— 下沿正好裁在入口上沿，
 * 上沿多留 CLIP_HEADROOM 给投影。overflow: hidden 是关键：
 * 没有它，下滑过程中卡片会盖住入口行和「设置」。
 */
.dsh-rs__float-clip {
  position: fixed;
  /* Sidebar utility stays below the host overlay (20) and explanation root (70). */
  z-index: 19;
  overflow: hidden;
  pointer-events: none;
  /* 下沿渐隐 CLIP_BOTTOM_FADE：卡片的上边框/投影滑出时"化掉"，
     不会在入口那条线上闪一道线；静止时这 6px 落在列表底部留白里，看不见 */
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - ${CLIP_BOTTOM_FADE}px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000 calc(100% - ${CLIP_BOTTOM_FADE}px), transparent 100%);
}

/*
 * ── 锚点定位：让浮层跟侧栏在**同一帧**里一起动 ──────────────────────
 *
 * 为什么要有这一段：以前浮层是「挂到 body + 每帧量侧栏宽度再写回去」，而
 * ResizeObserver 回调发生在**本帧排版之后**、setState 又要等**绘制之后**才落地 ——
 * 于是浮层永远慢一格，Math.round() 还会让左右各差 1px，表现就是「延迟 + 边界闪烁」。
 *
 * 现在把「宽度从哪来」交回布局：列和入口行各自有一个锚点名，浮层的左边/宽度/底边
 * 全部用 anchor() 引用它们。浏览器排版时解析，和侧栏同一次布局、同一帧绘制 ——
 * 没有测量、没有 React 往返、没有取整误差。
 *
 * 只在 data-anchor="true"（JS 侧探测通过）时生效；不支持锚点的浏览器根本匹配不到
 * 这个 @supports 块，继续走「量坐标」那条回退路。
 */
@supports (anchor-name: ${ANCHOR_COL}) and (width: anchor-size(${ANCHOR_COL} width)) {
  .dsh-rs__float-clip[data-anchor="true"] {
    left: anchor(${ANCHOR_COL} left);
    width: anchor-size(${ANCHOR_COL} width);
    /* 底边钉在入口行顶边：先对上那行顶边，再整体上推自身高度 */
    top: anchor(${ANCHOR_TRIGGER} top);
    bottom: auto;
    translate: 0 -100%;
  }
}

.dsh-rs__float {
  --dsh-rs-surface: var(--dsw-specific-sidebar-fill, #f7f8fa);
  position: absolute;
  top: ${CLIP_HEADROOM}px;
  left: 0;
  right: 0;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /*
   * 顶部留白放在**浮层自己身上**，不放在滚动容器里。
   *
   * 放滚动容器里的话（padding-top 写在列表上），这块留白会跟着内容一起滚走 ——
   * 一滚，行就滑进这块留白、顶到分隔线上。挪到这里之后，列表的滚动区从留白
   * 以下才开始，**这块留白永远是干净的**，内容只在它下面滚。
   * 大小：5px（标题离分隔线再算上行内自带的 5px = 10px）。
   */
  padding-top: 5px;
  /*
   * 上沿两角圆角 + 上边缘投影：浮在工作区上方的层次感。
   *
   * 内部依旧**不画底色**（背后那段列表已被抠掉，露出的是侧栏自己的背景），
   * 所以圆角不是靠"一块圆角矩形"读出来的 —— 而是靠上边框的弧线 + 阴影的轮廓：
   * 两条弧线在两侧收下去，阴影顺着这个轮廓往上散开，看着就是一张浮起来的纸，
   * 同时颜色还是侧栏自己的，不会重新引入色差。
   */
  border-radius: 12px 12px 0 0;
  border-top: 1px solid var(--dsw-alias-border-l4, rgb(0 0 0 / .16));
  /*
   * 两段投影，**收得极小**：只在浮层上沿贴一道，几乎不往工作区里铺。
   * 阴影铺得越大，浮层周围（上方那条空隙、工作区那几行）就被压得越暗，
   * 反而显得"浮层的颜色和别人不一样" —— 颜色其实一直一样（内部完全不画底色），
   * 变的是它周围被压暗了。所以这里只留 ~8px 的扩散。
   */
  box-shadow:
    0 -1px 1px rgb(15 17 21 / .04),
    0 -2px 8px rgb(15 17 21 / .08);
  background: transparent;
  /*
   * 整卡上滑：卡片从"自身高度之下"滑到位（translateY(100%) → 0），
   * 位移距离 = 自身高度，所以看着就是一张卡片被从底下推上来（不淡入）。
   */
  transition: transform var(--dsh-rs-slide-in, 320ms) ${SLIDE_EASE};
}
/* 深色下黑色阴影会被底色吃掉，加重一档 */
[data-ds-dark-theme] .dsh-rs__float {
  box-shadow:
    0 -1px 1px rgb(0 0 0 / .25),
    0 -2px 8px rgb(0 0 0 / .3);
}
/*
 * 进场：用浏览器原生的 @starting-style —— 它就是为"新插入元素从起始态开始动画"设计的，
 * **没有时序竞态**。（之前用 rAF 做"先挂上、下一帧再滑"的两步，那个 rAF 可能赶在
 * React 处理下一批更新之前触发，于是卡片一挂上就已经在终点位置，过渡根本不跑 ——
 * 表现就是"展开时几乎看不到滑动、也没有速度变化"。）
 */
@starting-style {
  .dsh-rs__float { transform: translateY(calc(100% + ${SLIDE_OVERSHOOT}px)); }
}
/* 出场态 = 同样滑到自身高度之下（被裁切容器挡住） */
.dsh-rs__float[data-leaving="true"] {
  /* 多滑 SLIDE_OVERSHOOT：边框和投影彻底出界，否则会在裁切下沿留一道线 */
  transform: translateY(calc(100% + ${SLIDE_OVERSHOOT}px));
}
.dsh-rs__float[data-leaving="true"] {
  pointer-events: none;                                    /* 滑出过程中点不到 */
  transition-duration: var(--dsh-rs-slide-out, 280ms);     /* 按高度算，比进来略快 */
}

/*
 * 工作区裁切线：**和卡片同一条时长、同一条曲线**。
 * 卡片上沿往上走多少，裁切线就跟着收多少 —— 标题是被卡片边缘"推着"逐条隐去的，
 * 而不是"裁切固定"那样一上来就整体消失、卡片从空底里滑出来。
 *
 * 用 mask-size 而不是渐变色标，就是因为前者能动画。
 */
@keyframes dsh-rs-cut-in {
  from { -webkit-mask-size: 100% 100%; mask-size: 100% 100%; }
  to   { -webkit-mask-size: 100% var(--dsh-rs-cut, 100%); mask-size: 100% var(--dsh-rs-cut, 100%); }
}
@keyframes dsh-rs-cut-out {
  from { -webkit-mask-size: 100% var(--dsh-rs-cut, 100%); mask-size: 100% var(--dsh-rs-cut, 100%); }
  to   { -webkit-mask-size: 100% 100%; mask-size: 100% 100%; }
}
/* 兜底模式：自己带底色（macOS 上再加背景模糊，尽量贴近侧栏材质） */
.dsh-rs__float[data-surface="fill"] { background: var(--dsh-rs-surface); }
/* 浮层只对工作区浏览区做了 mask 抠除，footer 席位里的其它插件不在抠除范围：
   浮层盖上去时底层文字会透出来，所以正常模式也带底色。 */
.dsh-rs__float[data-surface="none"] { background: var(--dsh-rs-surface); }
[data-platform="darwin"] .dsh-rs__float[data-surface="fill"] {
  --dsh-rs-surface: color-mix(in srgb, var(--dsw-specific-sidebar-fill, #f7f8fa) 94%, transparent);
  -webkit-backdrop-filter: blur(56px) saturate(1.7);
  backdrop-filter: blur(56px) saturate(1.7);
}
/* 兜底模式才有上缘渐隐（正常模式下浮层上沿是硬边 + 圆角边框） */
.dsh-rs__float[data-surface="fill"]::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 22px;
  background: linear-gradient(to bottom, transparent, var(--dsh-rs-surface));
  pointer-events: none;
}

/*
 * 上沿那条分隔线现在由 .dsh-rs__float 自己的 border-top 画：
 * 只有写成 border 才能跟着 border-radius 在两侧弯下去（伪元素画不出弧线）。
 * 颜色仍是 1px + border-l4（浅色 16% 黑 / 深色 20% 白）；
 * 想调深浅就换 l1(4%) / l2(10%) / l3(12%) / l4(16%)，想调粗细就改 border-top 的宽度。
 */

/* 拖动手柄 = 浮层上沿本身：骑在边框上、跨两侧各 4px 的透明命中区，无视觉元素 */
.dsh-rs__grip {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  z-index: 2;
  height: 8px;
  cursor: ns-resize;
  touch-action: none;
}
.dsh-rs__grip:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: -1px;
}
body.dsh-rs-dragging { user-select: none; }
body.dsh-rs-dragging,
body.dsh-rs-dragging * { cursor: ns-resize !important; }

/* 列表：**不画滚动条**（仍然能滚），只用下缘一条渐隐提示"下面还有" */
/* ── 两个视图（最近会话 / 已归档）──────────────────────────────
 * 并排各占满宽，切换时整页横移（push）：recent 0 → -100%，archive 100% → 0。
 * 两页互不重叠，所以透明底（vibrancy）下也不会互相透字。
 */
.dsh-rs__views {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.dsh-rs__view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 慢放 3×：页面横移 960ms，底部标题 480ms，箭头 720ms */
  transition: transform 960ms cubic-bezier(.32, .72, 0, 1);
  will-change: transform;
}
.dsh-rs__view--archive { transform: translateX(100%); }
.dsh-rs__views[data-view="archive"] .dsh-rs__view--recent { transform: translateX(-100%); }
.dsh-rs__views[data-view="archive"] .dsh-rs__view--archive { transform: none; }

.dsh-rs__list {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /*
   * 顶部不留白：那 20px 在浮层自己身上（见 .dsh-rs__float 的 padding-top）——
   * 放在这里的话它会跟着内容一起滚走。滚动区从 20px 以下才开始。
   */
  /*
   * 底部补白只是**默认值**：运行时由 syncListBottomPadding() 按当前几何覆盖成
   * "让 maxScroll 落在行边界上"的那个值（20–59px）。内容放得下、或算不出来时
   * 就保持这个 16px。
   */
  padding: 0 8px 16px;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /*
   * **只有下缘渐隐**。
   * 上缘那条一律不加：只要它存在，列表顶部那一行（停在顶部时就是第一行、
   * 往上滚过时是半行）就会被糊成半透明 —— 看着就是"标题模糊"。
   * 上沿的收口交给那条 border-top，不要再用渐隐。
   */
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 16px), transparent 100%);
}
/* 抽屉露出时：提前在 40px 处开始淡出、到 32px 处彻底收掉，
   刚好让出抽屉那一条，抽屉本身保持透明 —— 两边底色天然一致。 */
.dsh-rs__list[data-rail="true"] {
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 40px), transparent calc(100% - 32px));
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 40px), transparent calc(100% - 32px));
}
.dsh-rs__list::-webkit-scrollbar { width: 0; height: 0; display: none; }

/* ── 一行 ──────────────────────────────────────────────────────────
 * 外层是容器（负责悬停底色），里面是"整行跳转"按钮 + 右侧操作。
 * 操作**占位出现**（和工作区会话行一致）：悬停/聚焦时 display，文字让出宽度。
 * 行高 32px，和官方 workpace 会话行同高。
 */
/* 宿主页面的全局 reset 不一定覆盖到运行时注入的样式：不显式声明的话，
   width:100% + 左右 padding 会按 content-box 撑出浮层，悬停底色就贴到侧栏边上了。 */
.dsh-rs__float-clip, .dsh-rs__float-clip *,
.dsh-rs__menu, .dsh-rs__menu *,
.dsh-rs__modal, .dsh-rs__modal * { box-sizing: border-box; }

.dsh-rs__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  /* 右侧多留 4px：三枚操作不要贴着浮层边；左侧跟随入口标题的对齐列 */
  padding: 0 12px 0 max(8px, calc(var(--dsh-rs-align, 38px) - 30px));
  border-radius: var(--dsw-radius-md, 8px);
  transition: background 110ms var(--ds-ease-in-out, ease);
}
.dsh-rs__row:hover,
.dsh-rs__row:focus-within,
.dsh-rs__row[data-menu="true"] { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05)); }
.dsh-rs__row[aria-current="true"] {
  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-active, rgb(0 0 0 / .07)) 68%, transparent);
}
.dsh-rs__go {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  margin: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.dsh-rs__go:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: 2px;
}
/* 悬停操作：顺序 = 菜单 / 归档 / 移除（工作区那三枚是 16px 图标 + 15px 间距） */
.dsh-rs__acts {
  display: none;
  flex: none;
  align-items: center;
  gap: 10px;
}
.dsh-rs__row:hover .dsh-rs__acts,
.dsh-rs__row:focus-within .dsh-rs__acts,
.dsh-rs__row[data-menu="true"] .dsh-rs__acts { display: inline-flex; }
.dsh-rs__act {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #888);
  cursor: pointer;
}
/* 命中区扩到 26px，视觉仍是 16px（官方行同样是小图标） */
.dsh-rs__act::after { content: ""; position: absolute; inset: -5px; }
.dsh-rs__act:hover { color: var(--dsw-alias-label-primary, #111); }
.dsh-rs__act:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: 3px;
  border-radius: 3px;
}
.dsh-rs__row[data-menu="true"] .dsh-rs__act[data-act="menu"] { color: var(--dsw-alias-label-primary, #111); }
.dsh-rs__act svg { width: 14px; height: 14px; display: block; }
/* 叉号两笔顶满 16 栅格，同尺寸下比归档/省略号显大；收一档到 12。 */
.dsh-rs__act[data-act="remove"] svg { width: 12px; height: 12px; }
.dsh-rs__pin {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-caption, #adb2b8);
}
.dsh-rs__pin[hidden] { display: none; }
.dsh-rs__row:hover .dsh-rs__pin,
.dsh-rs__row:focus-within .dsh-rs__pin,
.dsh-rs__row[data-menu="true"] .dsh-rs__pin { display: none; }
.dsh-rs__pin svg { width: 14px; height: 14px; display: block; }
/* 到底后继续上推：rows 这一层跟着走，做出"拉出来一截"的橡皮筋 */
.dsh-rs__rows {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(0px - var(--dsh-rs-pull, 0px)));
  transition: transform 240ms cubic-bezier(.22, 1, .36, 1);
  will-change: transform;
}
.dsh-rs__list[data-pulling="true"] .dsh-rs__rows { transition: none; }
/* ── 状态标识 ──────────────────────────────────────────────────────
 * 三个状态，全部是同一颗 6px 圆点（10px 槽位，核心 inset 20%），只有颜色与动效不同：
 *   warning(待询问) → 黄点（官方 token）
 *   done(已完成未打开) → 绿点（官方 token）
 *   ongoing(运行中) → **蓝色呼吸点**（--dsw-static-deepseek-450，1.6s 明暗循环）
 *   idle → 槽位留着，里面不画点
 * 黄/绿取官方 StateDot 的 token，主题一换跟着换；运行中的蓝点按本面板原来的样式来。
 */
.dsh-rs__status {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}
.dsh-rs__dot {
  position: relative;
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  color: var(--dsw-alias-state-idle-primary, currentColor);
}
.dsh-rs__dot::after {
  content: "";
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  background: currentColor;
}
.dsh-rs__dot[data-state="done"] { color: var(--dsw-alias-state-success-primary, #22c55e); }
.dsh-rs__dot[data-state="warning"] { color: var(--dsw-alias-state-warn-primary, #f59e0b); }
.dsh-rs__dot[data-state="error"] { color: var(--dsw-alias-state-error-primary, #ef4444); }
/* 运行中：蓝点一直在闪（动效挂在核心上，槽位与布局不受影响） */
.dsh-rs__dot[data-state="ongoing"] {
  color: var(--dsw-static-deepseek-450, #5686fe);
}
.dsh-rs__dot[data-state="ongoing"]::after {
  animation: dsh-rs-pulse 1.6s ease-in-out infinite;
}
@keyframes dsh-rs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .32; }
}
/* 状态对读屏要说话，对眼睛不说话（官方 SessionStatusDots 也是这个做法） */
.dsh-rs__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
/* ── 「已归档」抽屉 ────────────────────────────────────────────────
 * 平时藏在浮层下沿外，列表拉满橡皮筋时整条弹上来，**覆盖**在列表底部。
 * 不挤压列表，所以回弹距离和它无关；停手 4.5s 自动缩回去。
 */
.dsh-rs__railclip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 32px;
  overflow: hidden;
  pointer-events: none;
  z-index: 3;
}
.dsh-rs__rail {
  /* 玻璃胶囊：一条 26px 的药丸，左右各让 8px，贴在浮层下沿（上 3px / 下 3px）。
     上下边缘都由药丸自己的圆角 + 描边 + 投影交代，不再画横线。 */
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 3px;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px 0 max(8px, calc(var(--dsh-rs-align, 38px) - 27px));
  border: 0;
  border-radius: 9px;
  /* 不涂白色：胶囊的"底"就是侧栏自己的底（vibrancy 材质靠白色涂不出来），
     形状交给一圈细描边 + 两层投影。 */
  background: transparent;
  box-shadow:
    0 0 0 .5px rgb(15 17 21 / .12),
    0 1px 2px rgb(15 17 21 / .06),
    0 7px 18px rgb(15 17 21 / .12);
  color: var(--dsw-alias-label-tertiary, #888);
  font: inherit;
  font-size: 11px;
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0;
  transform: translateY(calc(100% + 3px));
  pointer-events: auto;
  transition: transform 260ms cubic-bezier(.22, 1.3, .36, 1), opacity 150ms ease, color 110ms ease, background 140ms ease;
}
.dsh-rs__rail[data-revealed="true"] { opacity: 1; transform: none; }
.dsh-rs__rail:hover { color: var(--dsw-alias-label-secondary, #555); }
[data-ds-dark-theme] .dsh-rs__rail {
  background: transparent;
  box-shadow:
    0 0 0 .5px rgb(255 255 255 / .12),
    0 1px 2px rgb(0 0 0 / .2),
    0 7px 18px rgb(0 0 0 / .32);
}
.dsh-rs__rail svg { flex: none; width: 13px; height: 13px; opacity: .9; }
.dsh-rs__rail__label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dsh-rs__rail b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #555); }

/* ── 撤销 / 提示条 ───────────────────────────────────────────────── */
.dsh-rs__snack {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(8px + var(--dsh-rs-rail, 0px));
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 5px 0 11px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--dsw-alias-toast-bg, #353638);
  color: var(--dsw-alias-toast-label, #fff);
  box-shadow: 0 6px 18px rgb(0 0 0 / .18);
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity 140ms ease, transform 180ms var(--ds-ease-in-out, ease),
              bottom 190ms var(--ds-ease-in-out, ease);
}
.dsh-rs__snack[data-on="true"] { opacity: 1; transform: none; pointer-events: auto; }
.dsh-rs__snack__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
}
.dsh-rs__snack__undo {
  flex: none;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: rgb(255 255 255 / .14);
  color: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.dsh-rs__snack__undo:hover { background: rgb(255 255 255 / .22); }

/* ── 会话菜单（portal 到 body；规格照官方 Menu primitives） ────────── */
.dsh-rs__menu {
  position: fixed;
  visibility: hidden;
  z-index: 1100;
  min-width: 150px;
  max-width: 260px;
  padding: 4px;
  border-radius: 12px;
  background:
    linear-gradient(var(--dsw-menu-surface-fill, rgb(248 249 250 / .94)),
                    var(--dsw-menu-surface-fill, rgb(248 249 250 / .94))),
    var(--dsw-alias-bg-layer-2, #fff);
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  box-shadow:
    0 0 0 .5px var(--dsw-alias-border-l1, rgb(0 0 0 / .04)),
    0 3px 8px rgb(0 0 0 / .04),
    0 0 20px rgb(0 0 0 / .05);
  outline: none;
  user-select: none;
  font-family: var(--dsw-font-family, inherit);
}
.dsh-rs__menu[data-ready="true"] { visibility: visible; }
.dsh-rs__menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--dsw-radius-md, 12px);
  background: transparent;
  color: var(--dsw-alias-label-primary, #111);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsh-rs__menu-item:hover,
.dsh-rs__menu-item:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05));
  outline: none;
}
.dsh-rs__menu-icon {
  flex: none;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-menu-icon, #0f1115);
}
.dsh-rs__menu-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-rs__menu-key {
  flex: none;
  margin-left: auto;
  color: var(--dsw-alias-label-caption, #adb2b8);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: .4px;
  font-variant-numeric: tabular-nums;
}
/* 运行中确认：同一张菜单表面，内容换成一句话 */
.dsh-rs__menu[data-kind="confirm"] { width: 248px; padding: 12px; }
.dsh-rs__confirm-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #111);
}
.dsh-rs__confirm-head svg { flex: none; width: 16px; height: 16px; color: var(--dsw-alias-state-warn-primary, #f59e0b); }
.dsh-rs__confirm-body {
  margin: 0 0 10px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary, #555);
  text-wrap: pretty;
}
.dsh-rs__menu-actions { display: flex; justify-content: flex-end; gap: 6px; }
.dsh-rs__btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.dsh-rs__btn--ghost {
  background: transparent;
  color: var(--dsw-alias-label-secondary, #555);
  border-color: var(--dsw-alias-border-l3, rgb(0 0 0 / .12));
}
.dsh-rs__btn--ghost:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05)); }
.dsh-rs__btn--primary {
  background: var(--dsw-alias-button-primary-fill, #111);
  color: var(--dsw-alias-label-primary-foreground, #fff);
}
.dsh-rs__btn--primary:hover { background: var(--dsw-alias-button-primary-hover, #333); }

/* ── 重命名弹窗 ─────────────────────────────────────────────────── */
.dsh-rs__modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--dsw-font-family, inherit);
}
.dsh-rs__modal-scrim { position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1, rgb(0 0 0 / .24)); }
.dsh-rs__modal-card--delete { width: min(360px, calc(100vw - 48px)); }
.dsh-rs__modal-desc { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--dsw-alias-label-secondary, #555); }
.dsh-rs__delete-list { max-height: 220px; overflow: auto; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
.dsh-rs__delete-item { display: flex; align-items: baseline; gap: 12px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-primary, #111); }
.dsh-rs__delete-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-rs__delete-size { flex: none; font-size: 11px; color: var(--dsw-alias-label-tertiary, #888); font-variant-numeric: tabular-nums; }
.dsh-rs__delete-total { padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / .1)); font-size: 11.5px; color: var(--dsw-alias-label-secondary, #555); text-align: right; }
.dsh-rs__btn--danger { background: var(--dsw-alias-state-error-primary, #d24a3a); color: #fff; }
.dsh-rs__btn--danger:hover { filter: brightness(.95); }
.dsh-rs__btn--danger:disabled { opacity: .5; cursor: default; }
.dsh-rs__modal-card {
  position: relative;
  width: min(320px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-2, #fff);
  box-shadow: 0 0 0 .5px var(--dsw-alias-border-l2, rgb(0 0 0 / .1)), 0 16px 40px rgb(0 0 0 / .18);
}
.dsh-rs__modal-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, #111); }
.dsh-rs__input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / .12));
  border-radius: 10px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #111);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.dsh-rs__input:focus { border-color: var(--dsw-static-deepseek-450, #5686fe); }
.dsh-rs__modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsh-rs__modal-actions .dsh-rs__btn { height: 30px; padding: 0 12px; font-size: 12px; }

/* ── 归档视图头 ─────────────────────────────────────────────────── */
.dsh-rs__head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 5px 8px 0 max(8px, calc(var(--dsh-rs-align, 38px) - 28px));
}
.dsh-rs__back {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666);
  cursor: pointer;
}
.dsh-rs__back:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .06)); color: var(--dsw-alias-label-primary, #111); }
.dsh-rs__back svg { width: 14px; height: 14px; }
.dsh-rs__head-title { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-secondary, #555); }
.dsh-rs__head-count { font-size: 11px; color: var(--dsw-alias-label-tertiary, #888); font-variant-numeric: tabular-nums; }
.dsh-rs__row-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms var(--ds-ease-in-out, ease);
}
.dsh-rs__row:hover .dsh-rs__row-actions,
.dsh-rs__row:focus-within .dsh-rs__row-actions {
  opacity: 1;
  pointer-events: auto;
}
@media (hover: none) {
  .dsh-rs__row-actions { opacity: 1; pointer-events: auto; }
}
.dsh-rs__row-act {
  width: 22px;
  height: 22px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #888);
  cursor: pointer;
}
.dsh-rs__row-act svg { width: 14px; height: 14px; }
.dsh-rs__row-act:hover {
  background: var(--dsw-alias-interactive-bg-active, rgb(0 0 0 / .07));
  color: var(--dsw-alias-label-primary, #111);
}
.dsh-rs__row-act--danger {
  color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 38%, var(--dsw-alias-label-tertiary, #888));
}
.dsh-rs__row-act--danger:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 8%, transparent);
  color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d24a3a) 55%, var(--dsw-alias-label-tertiary, #888));
}

.dsh-rs__row[data-selecting="true"] { cursor: pointer; }
.dsh-rs__row[data-selected="true"] {
  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-active, rgb(0 0 0 / .07)) 70%, transparent);
}
.dsh-rs__check {
  flex: none;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / .22));
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-primary-foreground, #fff);
  transition: background 110ms ease, border-color 110ms ease;
}
.dsh-rs__row[data-selected="true"] .dsh-rs__check {
  background: var(--dsw-alias-button-primary-fill, #111);
  border-color: var(--dsw-alias-button-primary-fill, #111);
}

@media (prefers-reduced-motion: reduce) {
  /* 减少动态效果：蓝点定格为常亮，不再闪 */
  .dsh-rs__dot[data-state="ongoing"]::after { animation: none; }
  .dsh-rs__float { transition: none; }
  .dsh-rs__rows { transition: none; }
  .dsh-rs__rail { transition: none; }
  .dsh-rs__view { transition: none; }
  .dsh-rs__num { transition: none; }
  .dsh-rs__tlabels, .dsh-rs__tsearch, .dsh-rs__tselect, .dsh-rs__tinput, .dsh-rs__tclear, .dsh-rs__tlabel { transition: none; }
  .dsh-rs__row-actions { transition: none; }
}
.dsh-rs__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dsh-rs__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.dsh-rs__row[aria-current="true"] .dsh-rs__name { font-weight: 600; }
.dsh-rs__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, inherit);
}
.dsh-rs__empty {
  padding: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-dimmed, inherit);
}
`

/**
 * 幂等注入面板样式：**取或建**，并把内容刷成当前 CSS。
 *
 * ── 为什么必须自己打 `data-plugin` 标签 ────────────────────────────────
 * 宿主的 client-modules 在**每个**插件工厂物化之后都会做一次"认领"：
 *   claimStyles(id)  → document.querySelectorAll('style:not([data-plugin])')
 *                      全部打上**那个**插件的包名
 * 热重载那个插件时再按归属删除：
 *   removeOwnedStyles(id) → style[data-plugin=<那个包名>] 一并 remove()
 * （`dsh-client-modules/lib/client.js` 的 replace / updateManifest / prune
 *  三条路径都会调 removeOwnedStyles。）
 *
 * 所以：**运行时**注入、又没打标签的 <style>，会被"下一个物化的插件"顺手
 * 认领走；用户随后一改那个插件（重建 → replace → removeOwnedStyles）就把它
 * 删了。而本组件此时早已挂载，`useEffect(..., [])` 不会再跑 —— 面板于是裸成
 * 一个默认样式的 <button>：带边框的「› 最近会话 12」。这正是"每次改别的插件
 * 它就变样"的原因。
 *
 * 打上自己的标签之后没人认领得了，只有**本插件自己**被重载才会被摘 —— 而那时
 * 模块会重新物化，本函数会再跑一遍（模块作用域调用见下方），样式立刻回来。
 */
function ensurePanelStyle(): void {
  if (typeof document === 'undefined') return
  let el = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
  if (el === null) {
    el = document.createElement('style')
    el.id = STYLE_ID
    el.setAttribute('data-plugin', PLUGIN_ID)
    el.setAttribute('data-plugin-css', STYLE_ID)
    document.head.appendChild(el)
  }
  // 只在内容变了才写：渲染期每次都调，写同值会白白让浏览器重解析一遍样式表
  if (el.textContent !== PANEL_CSS) el.textContent = PANEL_CSS
}

/*
 * 模块作用域调用：client bundle 的工厂体在**物化那一刻**执行，正好赶在宿主
 * claimStyles 之前落地，标签一贴上就归本插件所有 —— 写进 React 生命周期里
 * 已经太晚了（那时别的插件可能已经认领走或删掉过一遍）。
 */
ensurePanelStyle()

/** 相对时间：中文短文案，跨天走日期。 */
function relativeTime(updatedAt: number, now: number): string {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return '时间未知'
  const diff = Math.max(0, now - updatedAt)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const at = new Date(updatedAt)
  const md = `${at.getMonth() + 1} 月 ${at.getDate()} 日`
  return at.getFullYear() === new Date(now).getFullYear() ? md : `${at.getFullYear()} 年 ${md}`
}

/** 会话 id：快照键与摘要字段两种写法都认。 */
function idOf(key: string, summary: SessionSummary): string {
  return summary.sessionId ?? key
}

/** 工作区名：会话 → 工作区的反向索引。 */
function workspaceNames(items: WorkspaceItem[] | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items ?? []) {
    const title = item.title?.trim()
    if (!title) continue
    for (const sessionId of item.sessionIds ?? []) {
      if (!map.has(sessionId)) map.set(sessionId, title)
    }
  }
  return map
}

function readRemoved(): Set<string> {
  try {
    const raw = window.localStorage.getItem(REMOVED_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeRemoved(ids: Set<string>): void {
  try {
    window.localStorage.setItem(REMOVED_KEY, JSON.stringify([...ids]))
  } catch {
    /* 隐私模式下写不进去，忽略即可 */
  }
}

function readDeleted(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DELETED_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeDeleted(ids: Set<string>): void {
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = payload !== null && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

function readCollapse(fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY)
    return raw === null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

function writeCollapse(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  } catch {
    /* 隐私模式下写不进去，忽略即可 */
  }
}

/** 记下来的浮层高度；没拖过就是 null（走默认高度）。 */
function readHeight(): number | null {
  try {
    const raw = window.localStorage.getItem(HEIGHT_KEY)
    if (raw === null) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? Math.max(MIN_HEIGHT, parsed) : null
  } catch {
    return null
  }
}

function writeHeight(height: number | null): void {
  try {
    if (height === null) window.localStorage.removeItem(HEIGHT_KEY)
    else window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)))
  } catch {
    /* 隐私模式下写不进去，忽略即可 */
  }
}

/**
 * 量一次几何：浮层该贴在哪儿。
 *
 * 宽度直接取侧栏列，底边贴着入口行上沿（所以入口始终看得见、位置也不跳），
 * 高度上限 = **工作区浏览区的高度** —— 浮层最多把工作区列表整个接管，
 * 不会再往上顶到品牌行或"新的对话"那几行。
 *
 * 同时回报工作区浏览区的底边：浮层靠它算"要把浏览区抠掉多少"。
 */
function measure(trigger: HTMLElement | null): FloatGeometry | null {
  if (!trigger) return null
  const t = trigger.getBoundingClientRect()
  if (t.width === 0 && t.height === 0) return null
  const col = document.querySelector(SIDEBAR_SEL) as HTMLElement | null
  const c = col?.getBoundingClientRect()
  const left = c ? c.left : t.left
  const width = c ? c.width : 280
  // macOS 收起时侧栏整列是 0 宽（外壳改用 shell.leading 画左上角控件）：
  // 这种宽度没有"浮在工作区上面"可言，干脆不渲染。
  if (width < 80) return null
  const region = document.querySelector(REGION_SEL) as HTMLElement | null
  const r = region?.getBoundingClientRect()
  // 上限：浏览区顶（量不到就退回"列顶 + 保活"）
  const topLimit = r ? r.top : (c ? c.top + TOP_KEEP : 0)
  return {
    left,
    width,
    bottom: Math.max(0, window.innerHeight - t.top),
    maxHeight: Math.max(MIN_HEIGHT, Math.round(t.top - topLimit)),
    regionBottom: r ? r.bottom : t.top,
    regionTop: r ? r.top : t.top,
    hasRegion: Boolean(r),
  }
}

/**
 * 给侧栏列挂上锚点名（幂等，一次就够，不是每帧）。
 *
 * 列不归我们渲染，只能运行时写一条内联属性；写的是 `anchor-name` 这种普通属性，
 * React 不认领它，宿主重渲染也不会把它抹掉。
 *
 * 为什么不放在 `apply()` 里：那时外壳还没挂载，`querySelector` 拿不到列。
 */
function ensureColumnAnchor(enabled: boolean): void {
  if (!enabled) return
  const col = document.querySelector(SIDEBAR_SEL) as HTMLElement | null
  if (!col) return
  if (col.style.getPropertyValue('anchor-name') !== ANCHOR_COL) {
    col.style.setProperty('anchor-name', ANCHOR_COL)
  }
}

/** 撤掉锚点名（卸载、或降级成量坐标时用）。 */
function releaseColumnAnchor(): void {
  const col = document.querySelector(SIDEBAR_SEL) as HTMLElement | null
  if (col && col.style.getPropertyValue('anchor-name') === ANCHOR_COL) {
    col.style.removeProperty('anchor-name')
  }
}

/**
 * 两次量出来的几何是不是"同一份"。
 *
 * 为什么要比：`measure()` 每次返回新对象，不比较的话 `ResizeObserver` 每回调一次就
 * 重渲染整棵面板。而锚点模式下，横向几何（`left`/`width`）已经不参与计算了 ——
 * 侧栏拉宽拉窄时这里应该**判等**，于是整段拖拽一次都不重渲染。
 *
 * 浮点直接 `===`：同一份布局量两次得到的是同一串数字，本来就是精确相等的。
 *
 * `anchored` 必须显式传进来，不能读模块常量：运行期可能已经从锚点降级成量坐标，
 * 那时横向字段又变成要比较的了。
 */
function sameGeometry(
  a: FloatGeometry | null,
  b: FloatGeometry | null,
  anchored: boolean,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.hasRegion !== b.hasRegion) return false
  if (a.bottom !== b.bottom || a.maxHeight !== b.maxHeight) return false
  if (a.regionTop !== b.regionTop || a.regionBottom !== b.regionBottom) return false
  if (anchored) return true
  return a.left === b.left && a.width === b.width
}

/**
 * 实测对账：浮层**真的**贴在侧栏列上了吗？
 *
 * 为什么要这一步：锚点是「静默失败」的 —— 列上没有 `anchor-name`、名字被占、
 * 或者宿主把列节点换了个新的，`anchor()` 都会退化成 `auto`，元素跑到静态位置
 * （左上角、宽度按内容收缩），**不报错、不 throw**。光靠 `CSS.supports` 只能知道
 * 「浏览器会」，不知道「这次真的对上了」。
 *
 * 所以浮层第一次挂出来后量一次：左边、宽度、底边三项都要和列/入口行对得上
 * （容差 1px）。对不上就不是小误差，是整套定位没生效 → 由调用方降级成量坐标。
 *
 * @returns 最大偏差（px）；量不到时返回 null（不判定）。
 */
function anchorDrift(clip: HTMLElement | null, trigger: HTMLElement | null): number | null {
  if (!clip || !trigger) return null
  const col = document.querySelector(SIDEBAR_SEL) as HTMLElement | null
  if (!col) return null
  const k = clip.getBoundingClientRect()
  const c = col.getBoundingClientRect()
  const t = trigger.getBoundingClientRect()
  if (c.width < 80) return null          // 侧栏正收起，没有可比性
  return Math.max(
    Math.abs(k.left - c.left),
    Math.abs(k.width - c.width),
    Math.abs(k.bottom - t.top),
  )
}

/**
 * 把工作区浏览区"从浮层背后抠掉"。
 *
 * 为什么需要它：浮层的颜色要和侧栏**一模一样**，唯一可靠的办法是让浮层
 * 根本没有自己的底色 —— 露出来的就是侧栏自己的背景（macOS 上是"半透明底色 +
 * 原生 vibrancy"，任何自己调出来的实色都会有割裂感）。
 *
 * 但工作区列表是别人的 DOM，直接露出来会跟浮层文字叠在一起。所以在浏览区上挂一条
 * mask：**浮层盖住的那一段整个透明掉**，上沿**不羽化** —— 一条清楚的分界，
 * 由浮层顶部那条浅分隔线收口。
 */
function setRegionCut(
  visiblePx: number | null,
  animate: boolean,
  closing: boolean,
  timing: { inMs: number; outMs: number },
): boolean {
  const region = document.querySelector(REGION_SEL) as HTMLElement | null
  if (!region) return false
  const h = region.getBoundingClientRect().height
  const cut = visiblePx === null ? h : Math.max(0, Math.min(h, Math.round(visiblePx)))
  // 关键帧里要用到这个名字（dsh-rs-cut-in/out 的 to 值）
  region.style.setProperty('--dsh-rs-cut', `${cut}px`)
  region.style.maskImage = 'linear-gradient(#000, #000)'
  region.style.webkitMaskImage = 'linear-gradient(#000, #000)'
  region.style.maskRepeat = 'no-repeat'
  region.style.webkitMaskRepeat = 'no-repeat'
  region.style.maskPosition = 'top'
  region.style.webkitMaskPosition = 'top'
  if (!animate) {
    region.style.animation = ''
    region.style.maskSize = `100% ${cut}px`
    region.style.webkitMaskSize = `100% ${cut}px`
    return true
  }
  region.style.maskSize = ''
  region.style.webkitMaskSize = ''
  // 和卡片**同一个时长同一个曲线** —— 差一点卡片边缘就会和工作区文字错开
  region.style.animation = closing
    ? `dsh-rs-cut-out ${timing.outMs}ms ${SLIDE_EASE} both`
    : `dsh-rs-cut-in ${timing.inMs}ms ${SLIDE_EASE} both`
  return true
}

function unmaskRegion(): void {
  const region = document.querySelector(REGION_SEL) as HTMLElement | null
  if (!region) return
  region.style.animation = ''
  region.style.maskImage = ''
  region.style.webkitMaskImage = ''
  region.style.maskRepeat = ''
  region.style.webkitMaskRepeat = ''
  region.style.maskPosition = ''
  region.style.webkitMaskPosition = ''
  region.style.maskSize = ''
  region.style.webkitMaskSize = ''
  region.style.removeProperty('--dsh-rs-cut')
}

/**
 * 找"离当前滚动位置最近的行上沿"（内容坐标）。
 *
 * 用每行实测位置算，不假设行高等距 —— 以后行高改了、或加了行间距，
 * 这里也不会算错。
 */
function nearestRowTop(list: HTMLElement, maxScroll: number): number | null {
  const rows = list.querySelectorAll<HTMLElement>('.dsh-rs__row')
  if (rows.length === 0) return null
  const listTop = list.getBoundingClientRect().top
  const scrollTop = list.scrollTop
  let best: number | null = null
  let bestDistance = Infinity
  for (const row of Array.from(rows)) {
    const top = row.getBoundingClientRect().top - listTop + scrollTop
    // 够不着的行边界直接跳过：超过 maxScroll 的位置浏览器根本滚不到，
    // 硬选它只会被夹回 maxScroll，等于没对齐
    if (top > maxScroll + 0.5) continue
    const distance = Math.abs(top - scrollTop)
    if (distance < bestDistance) {
      bestDistance = distance
      best = top
    }
  }
  return best
}

/**
 * 松手后把列表修正到整行边界（A′ 方案）。
 *
 * 只在滚动**停下来**的那一刻动手，滚动过程完全交给浏览器原生惯性 ——
 * 所以没有 CSS `scroll-snap-type: mandatory` 那种"咔哒"感。
 * 效果：列表顶部永远是**完整一行**，不会出现"上一行被切掉大半个、
 * 标题只剩半截"。
 *
 * 进来先按当前几何对一次底部补白：`maxScroll` 落在行边界上，最底部才有的可落。
 * 两个例外都不做无意义的动画：
 *   · 已经对齐（差 ≤ 0.5px）→ 直接返回
 *   · 行边界够不着（`top > maxScroll`）→ `nearestRowTop` 里就筛掉了
 */
function settleListToRow(list: HTMLElement | null): void {
  if (!list) return
  syncListBottomPadding(list)
  const max = Math.max(0, list.scrollHeight - list.clientHeight)
  const target = nearestRowTop(list, max)
  if (target === null) return
  const clamped = Math.min(Math.max(0, target), max)
  if (Math.abs(list.scrollTop - clamped) <= 0.5) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  list.scrollTo({ top: clamped, behavior: reduceMotion ? 'auto' : 'smooth' })
}

/**
 * 按几何算一次底部补白：让 `maxScroll = 行合计 + pad − 视口高` 正好是**行距的整数倍**。
 *
 * 为什么不能固定一个值：`pad ≡ 视口高 − 行合计 (mod 行距)`，而视口高随你拖动、
 * 行合计随条目数变 —— 固定值只在某些高度下成立。
 *
 * 为什么**不放在滚动里算**：`pad` 只跟"视口高"和"行合计"有关，这两个只在
 * 拖动结束 / 条目变化 / 浮层展开时变，滚动一百次也不会变。
 *
 * 取"最小可行值"而不是固定两行：`need` 落在 [0, 行距)，够 20px 就用它，
 * 不够才加一个行距（为了躲开下缘那条渐隐）→ 滚到底时末尾空白 20–59px，
 * 比恒定 80px 紧。内容本来就放得下时**不加**补白，短列表末尾不会凭空多一块。
 */
function syncListBottomPadding(list: HTMLElement | null): void {
  if (!list) return
  const rows = Array.from(list.querySelectorAll<HTMLElement>('.dsh-rs__row'))
  if (rows.length < 2) {
    list.style.paddingBottom = ''
    return
  }
  const first = rows[0].getBoundingClientRect()
  const second = rows[1].getBoundingClientRect()
  const last = rows[rows.length - 1].getBoundingClientRect()
  const pitch = second.top - first.top
  const rowsHeight = last.bottom - first.top
  const viewport = list.clientHeight
  if (!(pitch > 1) || viewport <= 0) {
    list.style.paddingBottom = ''
    return
  }
  // 内容本来就放得下：保持 CSS 里的默认留白，不额外加
  if (rowsHeight + LIST_PAD_BASE <= viewport) {
    list.style.paddingBottom = ''
    return
  }
  const need = (((viewport - rowsHeight) % pitch) + pitch) % pitch
  const pad = need >= LIST_PAD_MIN ? need : need + pitch
  list.style.paddingBottom = `${Math.round(pad)}px`
}


/**
 * 打开一个会话。
 *
 * 优先走 ui-workspace 的官方导航（它会做归档校验、释放旧引用、切回主面板）；
 * 拿不到该服务时退回点击官方侧栏里那一行 —— 官方行带 `data-row-key`，
 * React 自己的 onOpen 会接手，语义与手点一致。
 */
function openSession(ctx: ClientContext, sessionId: string): void {
  // strict=false：ui-workspace 若被换掉/停用，这里返回 undefined 走行点击兜底，而不是抛错
  const uiWorkspace = ctx.get?.('uiWorkspace', false) as { openSession?: (id: string) => void } | undefined
  if (uiWorkspace?.openSession) {
    try {
      uiWorkspace.openSession(sessionId)
      return
    } catch (error) {
      ctx.logger?.warn?.('[dsh-recent-sessions] openSession 失败，改用行点击：', error)
    }
  }
  const row = document.querySelector(`[data-row-key="session:${CSS.escape(sessionId)}"]`)
  if (row) row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

/**
 * 面板的数据接线：把两个官方快照折成一份**引用稳定**的行数组。
 *
 * `useSyncExternalStore` 要求 getSnapshot 每次返回同一个引用，所以行数组只在
 * 快照真的变了才重算（`recompute` 由 store 订阅驱动）。
 */
function createRowsStore(ctx: ClientContext, config: PanelConfig) {
  const sessions = ctx.get?.('sessions', false) as { list?: SnapshotStore<SessionsSnapshot> } | undefined
  const workspaces = ctx.get?.('workspaces', false) as { list?: SnapshotStore<WorkspacesSnapshot> } | undefined
  /**
   * 官方 ui-session 的状态源：`Map<sessionId, {running, pendingInteraction, completionUnread}>`。
   *
   * 这是官方会话行前面那枚标识的**同一个事实源** —— 不是我们从 transport 另推一份，
   * 所以我们的点跟官方行上的点永远不会各说各话（"已完成未打开"的判定、
   * "正在等你回答"的判定都只发生在宿主那一侧）。
   */
  const uiSession = ctx.get?.('uiSession', false) as
    | { sessionStatus?: SnapshotStore<Map<string, SessionStatusEntry>> }
    | undefined

  let cache: PanelRow[] = []
  let archivedCache: PanelRow[] = []

  function recompute(): void {
    const byId = sessions?.list?.getSnapshot()?.byId ?? {}
    const workspaceSnapshot = workspaces?.list?.getSnapshot()
    const archived = new Set(workspaceSnapshot?.archivedSessionIds ?? [])
    const pinned = new Set(workspaceSnapshot?.pinnedSessionIds ?? [])
    const names = workspaceNames(workspaceSnapshot?.items)
    const statuses = uiSession?.sessionStatus?.getSnapshot()
    let currentId: string | undefined
    for (const [key, summary] of Object.entries(byId)) {
      if ((summary.retainedBy?.mainView ?? 0) > 0) currentId = idOf(key, summary)
    }
    const now = Date.now()
    const rows = Object.entries(byId)
      .filter(([key, summary]) => {
        const id = idOf(key, summary)
        // 子代理不是"对话"，不进最近列表：官方快照的字段是 origin
        if (summary.origin === 'subagent' || summary.address?.kind === 'subagent') return false
        return Number.isFinite(summary.updatedAt) && (summary.updatedAt ?? 0) > 0
      })
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
      .map(([key, summary]) => {
        const id = idOf(key, summary)
        const title = summary.blank ? '新会话' : summary.title?.trim() || '未命名会话'
        const workspace = names.get(id)
        const meta = [
          relativeTime(summary.updatedAt ?? 0, now),
          config.showWorkspace && workspace ? workspace : '',
        ]
          .filter(Boolean)
          .join(' · ')

        // ── 主状态：优先级照抄官方 sessionStatuses() ──────────────────
        const status = statuses?.get(id)
        const pendingKind = visiblePendingKind(status?.pendingInteraction?.kind)
        const running = status?.running ?? summary.running === true
        let state: StatusState = 'idle'
        let stateLabel = '空闲'
        if (pendingKind !== undefined) {
          state = 'warning'
          stateLabel = pendingLabel(pendingKind)
        } else if (running) {
          state = 'ongoing'
          stateLabel = '运行中'
        } else if (status?.completionUnread === true) {
          // 跑完了但还没打开过这个会话 —— 官方就是靠 completionUnread 判"绿点"
          state = 'done'
          stateLabel = '已完成'
        }

        return { id, title, meta, running, current: id === currentId, state, stateLabel, pinned: pinned.has(id) }
      })

    cache = rows.filter((row) => !archived.has(row.id)).slice(0, config.maxItems)
    archivedCache = rows.filter((row) => archived.has(row.id))
  }

  recompute()

  return {
    subscribe(listener: () => void): () => void {
      const notify = () => {
        recompute()
        listener()
      }
      const offs = [
        sessions?.list?.subscribe(notify),
        workspaces?.list?.subscribe(notify),
        // 状态源也要订阅：绿点（跑完未打开）、黄点（等你回答）都从它来
        uiSession?.sessionStatus?.subscribe(notify),
      ].filter((off): off is () => void => typeof off === 'function')
      // 相对时间要随时间走：定时重算一次，引用变了 React 自然重渲染
      const timer = window.setInterval(notify, config.refreshMs)
      return () => {
        window.clearInterval(timer)
        for (const off of offs) off()
      }
    },
    getSnapshot(): PanelRow[] {
      return cache
    },
    /** 归档视图的数据源（与最近列表同一份投影，只是不做 maxItems 截断）。 */
    getArchived(): PanelRow[] {
      return archivedCache
    },
    refresh: recompute,
    /** 状态源是否拿到（拿不到就只剩运行中/空闲两态，黄绿点不会出现）。 */
    hasStatusSource: uiSession?.sessionStatus !== undefined,
  }
}

/**
 * 会话标题前面那枚状态标识。
 *
 * 三种状态是**同一颗 6px 圆点**，只有颜色与动效不同：
 *   warning（等你回答/批准）→ 黄点
 *   done（跑完了还没打开过）→ 绿点
 *   ongoing（运行中）→ **蓝色呼吸点**，一直在闪
 *   idle → 槽位留着，里面不画点
 *
 * ⚠️ **槽位必须永远占位**（`.dsh-rs__status` 固定 14px）。
 * 一开始写成 idle 直接 `return null`，结果没有状态的那些行少了 14px 的前导宽度，
 * 标题整排往左跳、和有点的行对不齐 —— 所以 idle 只省略**里面的图形**，
 * 不省略**外面的槽**。官方会话行也是这个做法（前导位始终存在）。
 *
 * 状态对读屏是**有语义的**，所以每个状态配一段 visually-hidden 文案
 * （官方 `SessionStatusDots` 的做法）—— 别把状态只做成一个颜色。
 */
function statusIndicator(
  h: typeof React.createElement,
  state: StatusState,
  label: string,
): React.ReactElement {
  const idle = state === 'idle'
  return h(
    'span',
    { className: 'dsh-rs__status' },
    idle ? null : h('span', { className: 'dsh-rs__dot', 'data-state': state, 'aria-hidden': 'true' }),
    idle ? null : h('span', { className: 'dsh-rs__sr' }, label),
  )
}


/** 会话行 / 菜单用的 16 栅格线性图标（路径取自宿主 ui-primitives）。 */
const ICONS: Record<string, Array<Record<string, string | number>>> = {
  archive: [
    { d: 'M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z' },
    { d: 'M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5' },
    { d: 'M6.5 9.5H9.5' },
  ],
  close: [{ d: 'M2.5 2.5L13.5 13.5' }, { d: 'M13.5 2.5L2.5 13.5' }],
  pin: [
    { d: 'M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z', strokeLinejoin: 'round' },
    { d: 'M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z', fill: 'currentColor' },
  ],
  pinFill: [
    { d: 'M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z', fill: 'currentColor', strokeLinejoin: 'round' },
    { d: 'M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z', fill: 'currentColor' },
  ],
  edit: [
    { d: 'M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z', fill: 'currentColor' },
    { d: 'M7.7849 8.23878L13.888 2.13574' },
  ],
  branch: [
    { d: 'M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564' },
    { d: 'M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944' },
    { d: 'M13.9 3.3a1.45 1.45 0 1 1-2.9 0 1.45 1.45 0 0 1 2.9 0Z' },
    { d: 'M13.9 12.7a1.45 1.45 0 1 1-2.9 0 1.45 1.45 0 0 1 2.9 0Z' },
  ],
  copy: [
    { d: 'M1.52075 4.07373H11.91395C12.91395 4.07373 13.91395 5.07373 13.91395 6.07373V12.46693C13.91395 13.46693 12.91395 14.46693 11.91395 14.46693H3.52075C2.52075 14.46693 1.52075 13.46693 1.52075 12.46693V4.07373Z' },
    { d: 'M11.9792 1.53296C13.36 1.53296 14.4792 2.65225 14.4792 4.03296V9.42847C14.4792 10.3756 13.9521 11.1987 13.1755 11.6228V10.3298C13.3652 10.0787 13.4792 9.7674 13.4792 9.42847V4.03296C13.4792 3.20453 12.8077 2.53296 11.9792 2.53296H6.58374C6.27966 2.53301 5.99684 2.6235 5.7605 2.77905H4.42358C4.85652 2.03463 5.66056 1.53304 6.58374 1.53296H11.9792Z', fill: 'currentColor' },
  ],
  restore: [
    { d: 'M1.5 2.5H14.5V5.5H1.5V2.5Z' },
    { d: 'M2.5 5.5V13C2.5 13.5523 2.94772 14 3.5 14H12.5C13.0523 14 13.5 13.5523 13.5 13V5.5' },
    { d: 'M8 13V8' },
    { d: 'M5.8 10L8 7.8L10.2 10' },
  ],
  alert: [
    { d: 'M8 2.2L14.2 13.4H1.8L8 2.2Z', strokeLinejoin: 'round' },
    { d: 'M8 6.2V9.4' },
    { d: 'M8 11.7H8.01' },
  ],
  back: [{ d: 'M10 3L5 8L10 13' }],
  chevron: [{ d: 'M6 3.5L10.5 8L6 12.5' }],
  search: [
    { d: 'M10.2 10.2L14 14' },
    { d: 'M7 11.2C9.3 11.2 11.2 9.3 11.2 7C11.2 4.7 9.3 2.8 7 2.8C4.7 2.8 2.8 4.7 2.8 7C2.8 9.3 4.7 11.2 7 11.2Z' },
  ],
  listcheck: [
    { d: 'M2.5 4.5H8' },
    { d: 'M2.5 9.5H6' },
    { d: 'M8.8 9.6L10.6 11.4L14 7' },
  ],
  trash: [
    { d: 'M2.5 4.5H13.5' },
    { d: 'M6 4.5V3.2C6 2.8 6.3 2.5 6.7 2.5H9.3C9.7 2.5 10 2.8 10 3.2V4.5' },
    { d: 'M4 4.5L4.8 13C4.9 13.6 5.4 14 6 14H10C10.6 14 11.1 13.6 11.2 13L12 4.5' },
    { d: 'M6.5 7.2V11.4' },
    { d: 'M9.5 7.2V11.4' },
  ],
  checkSquare: [
    { d: 'M11.5 2H4.5C3.1 2 2 3.1 2 4.5V11.5C2 12.9 3.1 14 4.5 14H11.5C12.9 14 14 12.9 14 11.5V4.5C14 3.1 12.9 2 11.5 2Z' },
    { d: 'M4.8 8.2L7 10.4L11.2 6.2' },
  ],
  xSquare: [
    { d: 'M11.5 2H4.5C3.1 2 2 3.1 2 4.5V11.5C2 12.9 3.1 14 4.5 14H11.5C12.9 14 14 12.9 14 11.5V4.5C14 3.1 12.9 2 11.5 2Z' },
    { d: 'M5.5 5.5L10.5 10.5' },
    { d: 'M10.5 5.5L5.5 10.5' },
  ],
}

function sessionIcon(
  h: typeof React.createElement,
  name: string,
  size = 14,
): React.ReactElement {
  if (name === 'ellipsis') {
    return h(
      'svg',
      { width: size, height: size, viewBox: '0 0 16 16', fill: 'currentColor', stroke: 'none', 'aria-hidden': 'true' },
      [3, 8, 13].map((cx) => h('circle', { key: cx, cx, cy: 8, r: 1 })),
    )
  }
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    (ICONS[name] ?? []).map((props, index) => h('path', { key: index, ...props })),
  )
}

/** 打开中的会话菜单（kind=confirm 时是"停止并归档"确认）。 */
type PanelMenu = {
  rowId: string
  anchor: HTMLElement
  kind: 'menu' | 'confirm'
  viaKeyboard: boolean
}

/** 面板组件工厂：由 slot 渲染器以 React 组件调用。 */
function createPanel(ctx: ClientContext, config: PanelConfig) {
  const rows = createRowsStore(ctx, config)
  const workspacesApi = ctx.get?.('workspaces', false) as WorkspaceActions | undefined
  const sessionsApi = ctx.get?.('sessions', false) as SessionActions | undefined
  const uiSessionReady = rows.hasStatusSource
  const h = React.createElement

  return function RecentSessionsPanel(props: { wide?: boolean }) {
    const items = useSyncExternalStore(rows.subscribe, rows.getSnapshot, rows.getSnapshot)
    const [collapsed, setCollapsed] = React.useState(() => readCollapse(config.defaultCollapsed))
    // 浮层高度（px）：null = 没拖过，走默认
    const [height, setHeight] = React.useState<number | null>(() => readHeight())
    const [geo, setGeo] = React.useState<FloatGeometry | null>(null)
    /**
     * 运行期要不要用锚点定位。
     *
     * 初值 = 浏览器能力探测（`ANCHOR_SUPPORTED`）；浮层第一次挂出来后实测对账，
     * 对不上就置 false 并**永久**退回量坐标（本页面会话内不再尝试）—— 见 `anchorDrift`。
     */
    const [anchored, setAnchored] = React.useState(ANCHOR_SUPPORTED)
    /** 自检是否已经做过（每次"面板重新展开"都允许重做一次） */
    const anchorCheckedRef = React.useRef(false)
    /** 复核的 rAF 是否已排上（防止同一帧排两次） */
    const anchorCheckPendingRef = React.useRef(false)
    const [dragging, setDragging] = React.useState(false)
    /** 浮层节点是否留在 DOM 里（退场动画期间仍为 true，播完才卸载） */
    const [mounted, setMounted] = React.useState(false)
    /** 正在播退场（滑回去） */
    const [leaving, setLeaving] = React.useState(false)
    /** 上一帧的"卡片是否已出现 / 是否在收回" —— 用来识别状态翻转的那一瞬间 */
    const cutPhaseRef = React.useRef({ shown: false, leaving: false })
    /** 当前高度给动画编排 effect 读（放依赖会让它每次改高度都重跑） */
    const liveHeightRef = React.useRef(0)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const clipRef = React.useRef<HTMLDivElement | null>(null)
    const floatRef = React.useRef<HTMLDivElement | null>(null)
    const listRef = React.useRef<HTMLDivElement | null>(null)
    const dragRef = React.useRef<{ startY: number; startHeight: number; max: number } | null>(null)

    // ── 行操作 / 菜单 / 移除 / 已归档抽屉 ─────────────────────────────
    const [removed, setRemoved] = React.useState<Set<string>>(() => readRemoved())
    const [deleted, setDeleted] = React.useState<Set<string>>(() => readDeleted())
    const [selecting, setSelecting] = React.useState(false)
    const [selected, setSelected] = React.useState<Set<string>>(new Set())
    const [searchOpen, setSearchOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [deleteDialog, setDeleteDialog] = React.useState<{
      targets: Array<{ id: string; title: string; bytes?: number }>
      totalBytes: number
      loading: boolean
    } | null>(null)
    const [deleteBusy, setDeleteBusy] = React.useState(false)
    const [view, setView] = React.useState<'recent' | 'archive'>('recent')
    const [menu, setMenu] = React.useState<PanelMenu | null>(null)
    const [snack, setSnack] = React.useState<{ text: string; undo?: () => void } | null>(null)
    const [rename, setRename] = React.useState<{ id: string; title: string } | null>(null)
    const [railOpen, setRailOpen] = React.useState(false)
    const railOpenRef = React.useRef(false)
    const menuRef = React.useRef<HTMLDivElement | null>(null)
    const rowsRef = React.useRef<HTMLDivElement | null>(null)
    const triggerLabelRef = React.useRef<HTMLSpanElement | null>(null)
    const renameInputRef = React.useRef<HTMLInputElement | null>(null)
    const snackTimerRef = React.useRef(0)
    const railTimerRef = React.useRef(0)
    const settleTimerRef = React.useRef(0)
    const pullRef = React.useRef(0)
    const pullingRef = React.useRef(false)

    const visibleItems = items.filter((row) => !removed.has(row.id) && !deleted.has(row.id))
    const archivedItems = rows.getArchived().filter((row) => !deleted.has(row.id))
    const archivedQuery = searchOpen ? query.trim().toLowerCase() : ''
    const archivedVisible = archivedQuery.length === 0
      ? archivedItems
      : archivedItems.filter((row) => row.title.toLowerCase().includes(archivedQuery))

    // 轨道态（wide === false）：**什么都不留**
    const narrow = props.wide === false

    // 样式在模块作用域已经装好（并贴了归属标签，见 ensurePanelStyle）；这里每次
    // 渲染再 ensure 一次 —— 幂等、不碰 React 状态，兼作自愈：万一标签还是被谁
    // 摘掉了（例如本插件自己被热重载的那一刻），下一次渲染就补回来。
    ensurePanelStyle()

    // 量几何：窗口缩放、侧栏拖宽、侧栏收起/展开、行数变化都要重算
    //
    // 锚点模式下这里只剩「冷几何」：`bottom`（入口行高度）、`maxHeight`、浏览区上下沿。
    // 它们只在竖向布局变动时才变，拉侧栏时 `sameGeometry` 判等 → 一次都不重渲染；
    // 横向由 CSS 锚点负责，详见 `ANCHOR_SUPPORTED` 与 `.dsh-rs__float-clip[data-anchor]`。
    /**
     * 量一次几何并按需写回 state。
     *
     * 抽成回调，是因为有三处要用它：初次 / ResizeObserver / 落定期补测（见下面两个 effect）。
     */
    const syncGeometry = React.useCallback((): void => {
      ensureColumnAnchor(anchored)
      const next = measure(triggerRef.current)
      setGeo((previous) => (sameGeometry(previous, next, anchored) ? previous : next))
    }, [anchored])

    React.useEffect(() => {
      if (narrow || collapsed) return
      syncGeometry()
      const raf = window.requestAnimationFrame(syncGeometry)
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncGeometry)
      const col = document.querySelector(SIDEBAR_SEL)
      if (observer && col) observer.observe(col)
      if (observer && triggerRef.current) observer.observe(triggerRef.current)
      /*
       * ⚠️ ResizeObserver 只在**尺寸**变化时回调，而 `bottom` 取的是入口行的**位置**。
       *
       * 上方工作区内容一重排（换主题、字体落定、热替换后子树重挂载），入口行会整体
       * 上移或下移，**尺寸一个像素都没变** —— 观察器不会回调，`bottom` 于是永远停在旧值。
       * 后果：工作区裁切线（按 `bottom` 算）和浮层上沿（锚在入口行上）错开，
       * 症状就是"工作区某一行从浮层顶部的留白里露出来"，而且只有再去拖一次侧栏才恢复。
       *
       * 入口行被顶动，必然是工作区浏览区的高度变了 → 所以补一条对浏览区的观察。
       */
      const region = document.querySelector(REGION_SEL)
      if (observer && region) observer.observe(region)
      window.addEventListener('resize', syncGeometry)
      return () => {
        window.cancelAnimationFrame(raf)
        observer?.disconnect()
        window.removeEventListener('resize', syncGeometry)
      }
    }, [narrow, collapsed, items.length, anchored, syncGeometry])

    /*
     * 落定期补测：浮层刚挂出来时（展开、或热替换后重挂载），宿主那边常常还在收尾 ——
     * 字体、主题、侧栏重排都会让入口行再挪一点，而那种挪动**不改变任何元素尺寸**，
     * 上面那些观察器一个都不会响。补两次延时重测把这段窗口盖住；
     * 量出来没变的话 `sameGeometry` 直接判等，不产生任何渲染。
     */
    React.useEffect(() => {
      if (narrow || collapsed) return
      const timers = [
        window.setTimeout(syncGeometry, 120),
        window.setTimeout(syncGeometry, 480),
      ]
      return () => {
        for (const timer of timers) window.clearTimeout(timer)
      }
    }, [narrow, collapsed, mounted, syncGeometry])

    // 锚点名只挂一次、只在本组件整体卸载时摘掉（放进上面那个 effect 会被每秒重跑的一次次摘掉）
    React.useEffect(() => {
      if (!anchored || narrow) return
      ensureColumnAnchor(true)
      return releaseColumnAnchor
    }, [narrow, anchored])

    /**
     * 自检 + 自动降级。
     *
     * 在**布局阶段**跑：此时锚点已经解析完，量到的就是屏幕上真实的位置。
     * 三项（左缘 / 宽度 / 底边）只要有一项差超过 1px，就不是"差一点点"，
     * 而是整套锚点没生效 —— 再等一帧复核一次（避开偶发的中间态），仍然对不上就降级。
     *
     * 降级时**同步**重新量一次几何：否则那一帧会用旧的 `geo.left/width` 摆位置，
     * 等于先跳一下再回正。
     *
     * 注意这里**不挂清理函数**：rAF 一旦排上就得跑完（它自己会判 ref 是否还在）。
     * 挂清理的话，`geo` 恰好在那一帧变一下就会把复核取消掉，而 `anchorCheckedRef`
     * 已经置位 —— 等于这次页面会话再也不对账了。
     */
    React.useLayoutEffect(() => {
      if (!anchored || !mounted || !geo || anchorCheckedRef.current) return
      const first = anchorDrift(clipRef.current, triggerRef.current)
      if (first === null) return              // 列正收起/量不到，下次布局再试
      anchorCheckedRef.current = true
      if (first <= 1) return
      if (anchorCheckPendingRef.current) return
      anchorCheckPendingRef.current = true
      window.requestAnimationFrame(() => {
        anchorCheckPendingRef.current = false
        const again = anchorDrift(clipRef.current, triggerRef.current)
        if (again === null || again <= 1) return
        releaseColumnAnchor()
        setGeo(measure(triggerRef.current))
        setAnchored(false)
      })
    }, [anchored, mounted, geo])

    // 面板收起来时把自检"上膛"，下次展开重新对账（宿主可能在这期间换过节点）
    React.useEffect(() => {
      if (mounted) return
      anchorCheckedRef.current = false
    }, [mounted])

    // 收起：再点入口本身，或按 Esc。Esc 先逐层关掉菜单 / 重命名 / 归档视图。
    // **点浮层外不收起**：连续切好几个会话时不该被"手滑点到别处"打断。
    React.useEffect(() => {
      if (narrow) return
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        if (menu) { setMenu(null); return }
        if (rename) { setRename(null); return }
        if (deleteDialog) { if (!deleteBusy) setDeleteDialog(null); return }
        if (view === 'archive') {
          if (selecting) { cancelSelecting(); return }
          if (searchOpen) { closeSearch(); return }
          setView('recent')
          return
        }
        if (!collapsed) {
          setCollapsed(true)
          writeCollapse(true)
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [narrow, collapsed, menu, rename, view, selecting, searchOpen, deleteDialog, deleteBusy])

    /**
     * 展开 / 收回的动画编排（A · 整卡上滑）。
     *
     * 展开：卡片挂上时由 `@starting-style` 给它"自身高度之下"的起始态 → 滑上来；
     * 同一帧里工作区裁切线从"不抠"收拢到卡片上沿。
     * 两条动画落在同一帧、用同一对时长/曲线，所以卡片边缘永远压在裁切线上。
     *
     * 收回：打 `data-leaving` 让它滑回去（裁切线同步放回），播完再摘节点 ——
     * 否则 React 一卸载，节点当场消失，收回就没有动画了。
     *
     * 快速连点：cleanup 会清掉 rAF / 定时器，不会"展开到一半被卸载"。
     */
    React.useEffect(() => {
      if (narrow) return
      if (!collapsed) {
        setLeaving(false)
        setMounted(true)
        return
      }
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
        // 系统关了动效：没有过渡可等，直接摘
        setMounted(false)
        return
      }
      setLeaving(true)
      // 卸载等待按"这一趟的实际时长"算：高度不同时长不同（读 ref，避免把
      // currentHeight 放进依赖 —— 那会让 effect 每次改高度都重跑、动画重播）
      const { outMs } = slideTiming(liveHeightRef.current)
      const timer = window.setTimeout(() => {
        setMounted(false)
        setLeaving(false)
      }, outMs + EXIT_SLACK_MS)
      return () => window.clearTimeout(timer)
    }, [collapsed, narrow])

    // 拖动中给 body 打标记：整页禁选中、光标不抖
    React.useEffect(() => {
      if (!dragging) return
      document.body.classList.add('dsh-rs-dragging')
      return () => document.body.classList.remove('dsh-rs-dragging')
    }, [dragging])

    /**
     * A′：松手后把列表修正到整行边界。
     *
     * 优先用 `scrollend`（Chromium 114+ 原生支持，正是"惯性停下"那一刻）；
     * 没有就退化成"最后一次 scroll 之后 120ms" —— 效果一样，只是判定稍粗。
     * 我们自己的平滑修正会再触发一轮事件，但那时已经对齐，`settleListToRow`
     * 直接返回，不会来回拉锯。
     */
    React.useEffect(() => {
      if (narrow || collapsed) return
      const list = listRef.current
      if (!list) return
      const settle = () => settleListToRow(list)
      const supportsScrollEnd = 'onscrollend' in window
      let timer = 0
      const onScroll = () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(settle, 120)
      }
      if (supportsScrollEnd) list.addEventListener('scrollend', settle)
      else list.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        window.clearTimeout(timer)
        if (supportsScrollEnd) list.removeEventListener('scrollend', settle)
        else list.removeEventListener('scroll', onScroll)
      }
    }, [narrow, collapsed, mounted, items.length])

    /* ── 已归档抽屉 / 橡皮筋 ─────────────────────────────────────── */
    React.useEffect(() => {
      railOpenRef.current = railOpen
    }, [railOpen])

    React.useEffect(() => {
      if (collapsed || view !== 'recent') setRailOpen(false)
    }, [collapsed, view])

    const armRailTimer = (): void => {
      window.clearTimeout(railTimerRef.current)
      railTimerRef.current = window.setTimeout(() => setRailOpen(false), RAIL_HOLD_MS)
    }

    const revealRail = (): void => {
      if (rows.getArchived().length === 0) return
      setRailOpen(true)
      armRailTimer()
    }

    const applyPull = (value: number): void => {
      pullingRef.current = true
      pullRef.current = value
      const list = listRef.current
      if (!list) return
      list.dataset.pulling = 'true'
      list.style.setProperty('--dsh-rs-pull', `${value.toFixed(1)}px`)
    }

    const releasePull = (): void => {
      window.clearTimeout(settleTimerRef.current)
      pullingRef.current = false
      pullRef.current = 0
      const list = listRef.current
      if (!list) return
      list.dataset.pulling = 'false'
      list.style.setProperty('--dsh-rs-pull', '0px')
    }

    const popRail = (): void => {
      releasePull()
      revealRail()
    }

    /**
     * 到底后继续上推：按阻尼把行容器往上拉，拉满才弹抽屉。
     * 抽屉是覆盖层：不缩列表、不补滚动，回弹距离和它无关。
     */
    React.useEffect(() => {
      if (narrow || collapsed || view !== 'recent') return
      const list = listRef.current
      if (!list) return

      const onWheel = (event: WheelEvent): void => {
        if (railOpenRef.current) { armRailTimer(); return }
        const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 1
        if (!atBottom) {
          if (pullingRef.current) releasePull()
          return
        }
        if (event.deltaY < 0) {
          if (!pullingRef.current) return
          event.preventDefault()
          const next = Math.max(0, pullRef.current + event.deltaY * 0.5)
          if (next <= 0.5) releasePull()
          else applyPull(next)
          window.clearTimeout(settleTimerRef.current)
          settleTimerRef.current = window.setTimeout(() => {
            if (!railOpenRef.current) releasePull()
          }, 220)
          return
        }
        if (event.deltaY === 0) return
        event.preventDefault()
        const room = Math.max(0, 1 - pullRef.current / PULL_MAX)
        applyPull(Math.min(PULL_MAX, pullRef.current + event.deltaY * 0.36 * (0.42 + 0.58 * room)))
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = window.setTimeout(() => {
          if (!railOpenRef.current) releasePull()
        }, 220)
        if (pullRef.current >= PULL_MAX - 0.5) popRail()
      }

      let touchY: number | null = null
      let touchBottom = false
      const onTouchStart = (event: TouchEvent): void => {
        if (railOpenRef.current) armRailTimer()
        touchY = event.touches[0]?.clientY ?? null
        touchBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 1
      }
      const onTouchMove = (event: TouchEvent): void => {
        if (touchY === null || !touchBottom || railOpenRef.current) return
        const dy = touchY - (event.touches[0]?.clientY ?? touchY)
        if (dy <= 0) return
        if (event.cancelable) event.preventDefault()
        applyPull(Math.min(PULL_MAX, dy * 0.42))
        if (pullRef.current >= PULL_MAX - 0.5) popRail()
      }
      const onTouchEnd = (): void => {
        touchY = null
        touchBottom = false
        if (pullingRef.current && !railOpenRef.current) releasePull()
      }
      const onScroll = (): void => {
        if (railOpenRef.current) armRailTimer()
      }

      list.addEventListener('wheel', onWheel, { passive: false })
      list.addEventListener('touchstart', onTouchStart, { passive: true })
      list.addEventListener('touchmove', onTouchMove, { passive: false })
      list.addEventListener('touchend', onTouchEnd)
      list.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        list.removeEventListener('wheel', onWheel)
        list.removeEventListener('touchstart', onTouchStart)
        list.removeEventListener('touchmove', onTouchMove)
        list.removeEventListener('touchend', onTouchEnd)
        list.removeEventListener('scroll', onScroll)
        if (pullingRef.current) releasePull()
      }
    }, [narrow, collapsed, mounted, view, items.length, railOpen])

    // 抽屉露出后：点按 / 滚动只续命，不收回
    React.useEffect(() => {
      if (!railOpen) return
      const reset = (): void => armRailTimer()
      document.addEventListener('pointerdown', reset, true)
      return () => document.removeEventListener('pointerdown', reset, true)
    }, [railOpen])

    // 卸载时清掉所有定时器
    React.useEffect(() => () => {
      window.clearTimeout(snackTimerRef.current)
      window.clearTimeout(railTimerRef.current)
      window.clearTimeout(settleTimerRef.current)
    }, [])

    /* ── 菜单：定位 / 键盘 / 点外面关 ─────────────────────────────── */
    React.useLayoutEffect(() => {
      const el = menuRef.current
      if (!menu || !el) return
      const rect = menu.anchor.getBoundingClientRect()
      const width = el.offsetWidth
      const height = el.offsetHeight
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
      let top = rect.bottom + 5
      if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 5)
      el.style.left = `${Math.round(left)}px`
      el.style.top = `${Math.round(top)}px`
      el.dataset.ready = 'true'
      if (menu.viaKeyboard) {
        el.querySelector<HTMLElement>('.dsh-rs__menu-item, .dsh-rs__btn')?.focus()
      }
    }, [menu])

    React.useEffect(() => {
      if (!menu) return
      const onPointerDown = (event: PointerEvent): void => {
        const target = event.target as HTMLElement | null
        if (menuRef.current?.contains(target)) return
        if (target?.closest?.('.dsh-rs__act[data-act="menu"]')) return
        setMenu(null)
      }
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') { setMenu(null); return }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const nodes = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('.dsh-rs__menu-item, .dsh-rs__btn') ?? [],
        )
        if (nodes.length === 0) return
        event.preventDefault()
        const index = nodes.indexOf(document.activeElement as HTMLElement)
        const next = (index + (event.key === 'ArrowDown' ? 1 : nodes.length - 1)) % nodes.length
        nodes[next].focus()
      }
      const onDismiss = (): void => setMenu(null)
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKey)
      window.addEventListener('resize', onDismiss)
      document.addEventListener('scroll', onDismiss, true)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true)
        document.removeEventListener('keydown', onKey)
        window.removeEventListener('resize', onDismiss)
        document.removeEventListener('scroll', onDismiss, true)
      }
    }, [menu])

    // 重命名弹窗：自动聚焦并全选
    React.useLayoutEffect(() => {
      if (!rename) return
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, [rename])

    /* ── 提示条 / 动作 ───────────────────────────────────────────── */
    const notify = (text: string, undo?: () => void): void => {
      setSnack({ text, undo })
      window.clearTimeout(snackTimerRef.current)
      snackTimerRef.current = window.setTimeout(() => setSnack(null), 5200)
    }

    const messageOf = (error: unknown): string => {
      if (error instanceof Error) return error.message
      if (typeof error === 'string') return error
      return '未知错误'
    }

    const toggleMenu = (row: PanelRow, anchor: HTMLElement, viaKeyboard = false): void => {
      setMenu((current) => current && current.rowId === row.id && current.kind === 'menu'
        ? null
        : { rowId: row.id, anchor, kind: 'menu', viaKeyboard })
    }

    const doArchive = async (row: PanelRow, anchor: HTMLElement, stopActivity: boolean): Promise<void> => {
      setMenu(null)
      const api = workspacesApi
      if (!api?.archiveSession) { notify('当前宿主不支持归档'); return }
      try {
        await api.archiveSession(row.id, stopActivity ? { stopActivity: true } : undefined)
        notify('会话已归档')
      } catch (error) {
        const code = (error as { rpcError?: { code?: string }; code?: string }).rpcError?.code
          ?? (error as { code?: string }).code
        if (!stopActivity && code === 'workspace/session-active') {
          setMenu({ rowId: row.id, anchor, kind: 'confirm', viaKeyboard: false })
          return
        }
        notify(`归档失败：${messageOf(error)}`)
      }
    }

    const archiveRow = (row: PanelRow, anchor: HTMLElement): void => {
      if (row.running) {
        setMenu({ rowId: row.id, anchor, kind: 'confirm', viaKeyboard: false })
        return
      }
      void doArchive(row, anchor, false)
    }

    const restoreRow = async (row: PanelRow): Promise<void> => {
      const api = workspacesApi
      if (!api?.unarchiveSession) { notify('当前宿主不支持恢复归档'); return }
      try {
        await api.unarchiveSession(row.id)
        notify('已恢复会话')
        if (rows.getArchived().length === 0) setView('recent')
      } catch (error) {
        notify(`恢复失败：${messageOf(error)}`)
      }
    }

    const togglePin = async (row: PanelRow): Promise<void> => {
      setMenu(null)
      const api = workspacesApi
      const action = row.pinned ? api?.unpinSession : api?.pinSession
      if (!action) { notify('当前宿主不支持置顶'); return }
      try {
        await action(row.id)
        notify(row.pinned ? '已取消置顶' : '已置顶')
      } catch (error) {
        notify(`置顶失败：${messageOf(error)}`)
      }
    }

    const forkRow = async (row: PanelRow): Promise<void> => {
      setMenu(null)
      const api = sessionsApi
      if (!api?.fork) { notify('当前宿主不支持分叉'); return }
      try {
        const result = await api.fork({ sessionId: row.id, increaseTitle: true })
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
          notify('分叉失败，请稍后重试')
          return
        }
        notify(`已分叉「${row.title}」`)
      } catch (error) {
        notify(`分叉失败：${messageOf(error)}`)
      }
    }

    const copyId = async (row: PanelRow): Promise<void> => {
      setMenu(null)
      try {
        await navigator.clipboard.writeText(row.id)
        notify('Session ID 已复制')
      } catch {
        notify('复制失败，请重试')
      }
    }

    const removeRow = (row: PanelRow): void => {
      setMenu(null)
      const next = new Set(removed)
      next.add(row.id)
      writeRemoved(next)
      setRemoved(next)
      notify(`已从最近会话列表移除「${row.title}」`, () => {
        const back = new Set(removed)
        back.delete(row.id)
        writeRemoved(back)
        setRemoved(back)
      })
    }

    const openRename = (row: PanelRow): void => {
      setMenu(null)
      setRename({ id: row.id, title: row.title })
    }

    const saveRename = async (): Promise<void> => {
      if (!rename) return
      const value = (renameInputRef.current?.value ?? '').trim()
      if (!value) { renameInputRef.current?.focus(); return }
      const api = sessionsApi
      if (!api?.rename) { notify('当前宿主不支持重命名'); return }
      try {
        const result = await api.rename(rename.id, value)
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
          notify(`重命名失败：${result.error?.message ?? '未知错误'}`)
          return
        }
        setRename(null)
        notify('已重命名会话')
      } catch (error) {
        notify(`重命名失败：${messageOf(error)}`)
      }
    }

    // 入口标题（最近会话）的 x 是侧栏的标题列；列表行标题、已归档入口、
    // 归档视图标题都对齐到这一列，而不是各拍各的。
    React.useLayoutEffect(() => {
      const float = floatRef.current
      const label = triggerLabelRef.current
      if (!float || !label) return
      const left = label.getBoundingClientRect().left - float.getBoundingClientRect().left
      if (Number.isFinite(left) && left > 0) {
        float.style.setProperty('--dsh-rs-align', `${left.toFixed(1)}px`)
      }
      /*
       * 依赖里**不**放 `geo?.width`：这里量的是「入口标题相对浮层左边缘的偏移」，
       * 两者都跟着侧栏列走，偏移与列宽无关。锚点模式下 `geo` 本来也不再因宽度变化，
       * 留着它只会让人误以为"宽度变了这里会重算"。
       */
    }, [mounted, collapsed, height])

    React.useEffect(() => {
      if (!searchOpen) return
      searchInputRef.current?.focus()
    }, [searchOpen])

    // 离开归档视图就退出选择模式
    React.useEffect(() => {
      if (view !== 'archive') {
        setSelecting(false)
        setSelected(new Set())
        setSearchOpen(false)
        setQuery('')
        setDeleteDialog(null)
      }
    }, [view])

    const archiveBack = (): void => {
      if (selecting) { cancelSelecting(); return }
      if (searchOpen) { searchInputRef.current?.blur(); setSearchOpen(false); setQuery(''); return }
      setView('recent')
    }

    const startSelecting = (): void => {
      setSearchOpen(false)
      setQuery('')
      setSelecting(true)
      setSelected(new Set())
    }

    const startSearch = (): void => {
      setSelecting(false)
      setSelected(new Set())
      setQuery('')
      setSearchOpen(true)
    }

    const closeSearch = (): void => {
      searchInputRef.current?.blur()
      setSearchOpen(false)
      setQuery('')
    }

    const allArchivedSelected = archivedItems.length > 0 && archivedItems.every((row) => selected.has(row.id))

    const toggleAllArchived = (): void => {
      setSelected(allArchivedSelected ? new Set() : new Set(archivedItems.map((row) => row.id)))
    }

    const restoreSelected = async (): Promise<void> => {
      const targets = archivedItems.filter((row) => selected.has(row.id))
      if (targets.length === 0) return
      const api = workspacesApi
      if (!api?.unarchiveSession) { notify('当前宿主不支持恢复归档'); return }
      let restored = 0
      for (const row of targets) {
        try {
          await api.unarchiveSession(row.id)
          restored += 1
        } catch (error) {
          notify(`恢复「${row.title}」失败：${messageOf(error)}`)
        }
      }
      setSelected(new Set())
      setSelecting(false)
      if (restored > 0) notify(`已恢复 ${restored} 个会话`)
    }

    const cancelSelecting = (): void => {
      setSelecting(false)
      setSelected(new Set())
    }

    const toggleSelected = (id: string): void => {
      setSelected((previous) => {
        const next = new Set(previous)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    const openDeleteDialogFor = async (
      targets: Array<{ id: string; title: string }>,
    ): Promise<void> => {
      if (targets.length === 0) return
      setDeleteDialog({ targets, totalBytes: 0, loading: true })
      try {
        const result = await postJson<{
          sessions: Array<{ id: string; bytes?: number; error?: string }>
          totalBytes?: number
        }>(SESSION_INSPECT_URL, { ids: targets.map((target) => target.id) })
        const sizes = new Map(result.sessions.map((entry) => [entry.id, entry]))
        const merged = targets.map((target) => ({ ...target, bytes: sizes.get(target.id)?.bytes }))
        setDeleteDialog({
          targets: merged,
          totalBytes: result.totalBytes ?? merged.reduce((sum, target) => sum + (target.bytes ?? 0), 0),
          loading: false,
        })
      } catch (error) {
        setDeleteDialog({ targets, totalBytes: 0, loading: false })
        notify(`读取会话大小失败：${messageOf(error)}`)
      }
    }

    const openDeleteDialog = async (): Promise<void> => {
      await openDeleteDialogFor(
        archivedItems
          .filter((row) => selected.has(row.id))
          .map((row) => ({ id: row.id, title: row.title })),
      )
    }

    const openDeleteRowDialog = (row: PanelRow): void => {
      void openDeleteDialogFor([{ id: row.id, title: row.title }])
    }

    const confirmDelete = async (): Promise<void> => {
      if (!deleteDialog || deleteDialog.loading || deleteBusy) return
      const ids = deleteDialog.targets.map((target) => target.id)
      setDeleteBusy(true)
      try {
        const result = await postJson<{
          deleted: Array<{ id: string; bytes: number }>
          failed: Array<{ id: string; error: string }>
          totalBytes?: number
        }>(SESSION_DELETE_URL, { ids })
        const freed = result.deleted.reduce((sum, entry) => sum + entry.bytes, 0)
        setDeleted((previous) => {
          const next = new Set(previous)
          for (const entry of result.deleted) next.add(entry.id)
          writeDeleted(next)
          return next
        })
        setDeleteDialog(null)
        setSelecting(false)
        setSelected(new Set())
        const failed = result.failed.length
        notify(
          `已删除 ${result.deleted.length} 个会话${freed > 0 ? `，释放 ${formatBytes(freed)}` : ''}` +
          `${failed > 0 ? `；${failed} 个失败` : ''}。附件未动，可运行 prune-attachments 查看可清理附件。`,
        )
      } catch (error) {
        notify(`删除失败：${messageOf(error)}`)
      } finally {
        setDeleteBusy(false)
      }
    }

    const currentHeight = Math.min(height ?? DEFAULT_HEIGHT, geo?.maxHeight ?? DEFAULT_HEIGHT)
    /** 这一趟滑动的时长（按高度算）—— 卡片过渡、裁切 keyframes、卸载等待共用同一个值 */
    const timing = slideTiming(currentHeight)
    // 给动画编排 effect 读；直接在渲染里写，避免把 currentHeight 塞进它的依赖
    liveHeightRef.current = currentHeight

    /**
     * 把浮层背后的工作区列表"抠掉"。
     *
     * 浮层自己不画底色（`data-surface="none"`），同材质就靠这一步：浏览区在浮层
     * 覆盖范围内整个透明掉，露出来的只有侧栏自己的背景（macOS 上是半透明底色 +
     * 原生 vibrancy）—— 颜色因此是**构造出来的一致**，不是调出来的一堆近似值。
     * 拿不到浏览区（外壳改结构）时退回自带底色，功能不受影响。
     *
     * 依赖里带上 currentHeight：拖动改高度时抠掉的量要跟着变。
     *
     * 用 layout effect：必须在浏览器绘制之前挂上 mask，否则展开的第一帧会是
     * "浮层已经透明、列表还没抠掉" —— 两层文字叠在一起闪一下。
     */
    /**
     * 底部补白：**只在几何变化时算**（拖动结束、条目数变化、展开、窗口缩放），
     * 拖动过程中不插手 —— 免得每帧都读 rect、也免得拖到一半末尾空白跟着抖。
     */
    React.useLayoutEffect(() => {
      if (narrow || collapsed || dragging) return
      syncListBottomPadding(listRef.current)
    }, [narrow, collapsed, dragging, items.length, currentHeight])

    /*
     * 工作区裁切线：**跟着卡片上沿走**（和卡片同一对时长/曲线的 keyframes）。
     *
     *   · 刚挂上那一帧 → 先完全不抠（下一帧才和卡片一起动）
     *   · 展开中 / 已展开 → 裁到卡片最终上沿
     *   · 收回中 → 放回 100%，和卡片下滑同步
     *   · 拖动改高度 → 直接就位，不重播动画（否则拉着拉着裁切线一直重新跑）
     */
    React.useLayoutEffect(() => {
      const prev = cutPhaseRef.current
      // 卡片第一次出现那一帧 = 展开动画的起点（和卡片的 @starting-style 同一次样式计算）
      const shown = mounted && geo !== null
      const justShown = shown && !prev.shown
      const closed = !prev.leaving && leaving     // 刚打上 leaving = 收回动画的起点
      cutPhaseRef.current = { shown, leaving }

      if (narrow || !mounted || !geo || !geo.hasRegion) {
        unmaskRegion()
        return
      }
      /*
       * 上沿用**现量**的入口行位置，不用 `geo.bottom`：
       * 浮层是靠锚点贴着入口行的，而 `geo` 可能比真实布局旧一帧到几帧
       * （位置变化没有被 ResizeObserver 覆盖到）。两边用同一个来源，裁切线和
       * 浮层上沿才永远压在一起 —— 差一点，工作区就会从浮层顶部漏出来。
       */
      const triggerTop = triggerRef.current?.getBoundingClientRect().top
        ?? (window.innerHeight - geo.bottom)
      const regionTop = (document.querySelector(REGION_SEL) as HTMLElement | null)
        ?.getBoundingClientRect().top ?? geo.regionTop
      const visible = triggerTop - currentHeight - regionTop
      const timing = slideTiming(currentHeight)
      if (justShown) {
        setRegionCut(visible, true, false, timing)
        return
      }
      if (closed) {
        /*
         * 收回的起点必须是**当前展开态的裁切值**（visible），不能传 null。
         * 传 null 会把 --dsh-rs-cut 写成"整个浏览区高度"，于是 dsh-rs-cut-out
         * 的 from 和 to 完全一样 → 全程不抠 → 工作区内容整段露着，
         * 而浮层是不画底色的透明卡片，滑下来就和工作区的行/图标叠在一起。
         */
        setRegionCut(visible, true, true, timing)
        return
      }
      if (leaving) return                          // 收回动画进行中：别去动它
      if (collapsed) {
        // 已经收起（例如系统关了动效、没有动画可等）：直接就位
        setRegionCut(null, false, false, timing)
        return
      }
      // 其余情况（拖动改高度、几何重算…）：直接就位，**不重播动画** ——
      // 重播会先跳回"不抠"再收拢，工作区标题会闪一下。
      setRegionCut(visible, false, false, timing)
    }, [narrow, mounted, leaving, collapsed, dragging, geo, currentHeight])

    /** 落高度：夹在 [下限, 本次上限] 内并持久化。 */
    const applyHeight = (next: number, max: number): void => {
      const clamped = Math.round(Math.min(Math.max(next, MIN_HEIGHT), max))
      setHeight(clamped)
      writeHeight(clamped)
    }

    const onGripDown = (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!geo) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const start = floatRef.current?.getBoundingClientRect().height ?? currentHeight
      dragRef.current = { startY: event.clientY, startHeight: start, max: geo.maxHeight }
      setDragging(true)
    }

    const onGripMove = (event: React.PointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current
      if (!drag) return
      // 浮层钉在入口上方：往上拖（clientY 变小）= 变高
      applyHeight(drag.startHeight + (drag.startY - event.clientY), drag.max)
    }

    const onGripEnd = (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragRef.current) return
      dragRef.current = null
      setDragging(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }

    /** 键盘等价操作：↑ 变高 / ↓ 变矮，Shift 加大步长。 */
    const onGripKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      if (!geo) return
      event.preventDefault()
      const step = event.shiftKey ? 96 : 24
      applyHeight(currentHeight + (event.key === 'ArrowUp' ? step : -step), geo.maxHeight)
    }

    /** 双击复位到默认高度（等于"我没拖过"）。 */
    const onGripReset = (): void => {
      setHeight(null)
      writeHeight(null)
    }

    const archiveMode: 'normal' | 'search' | 'select' = selecting ? 'select' : searchOpen ? 'search' : 'normal'

    const archiveTitlebar = h(
      'div',
      {
        ref: triggerRef,
        className: 'dsh-rs__titlebar',
        'data-mode': archiveMode,
        role: 'group',
        'aria-label': '已归档会话',
      },
      h(
        'button',
        {
          className: 'dsh-rs__tback',
          type: 'button',
          title: selecting ? '退出选择' : searchOpen ? '退出搜索' : '返回最近会话',
          'aria-label': selecting ? '退出选择' : searchOpen ? '退出搜索' : '返回最近会话',
          onClick: archiveBack,
        },
        sessionIcon(h, 'back', 11),
      ),
      h(
        'span',
        { ref: triggerLabelRef, className: 'dsh-rs__tlabels' },
        h(
          'span',
          {
            className: 'dsh-rs__tlabel dsh-rs__tlabel--normal',
            'aria-hidden': archiveMode === 'select' ? 'true' : undefined,
          },
          '已归档',
          h('b', null, String(archivedItems.length)),
        ),
        h(
          'span',
          {
            className: 'dsh-rs__tlabel dsh-rs__tlabel--select',
            'aria-hidden': archiveMode === 'select' ? undefined : 'true',
          },
          '已选',
          h('b', null, String(selected.size)),
        ),
      ),
      h(
        'div',
        { className: 'dsh-rs__tact' },
        h(
          'div',
          { className: 'dsh-rs__tsearch' },
          h(
            'button',
            {
              className: 'dsh-rs__tbtn',
              type: 'button',
              title: '搜索',
              'aria-label': '搜索',
              tabIndex: archiveMode === 'normal' ? 0 : -1,
              onClick: startSearch,
            },
            sessionIcon(h, 'search', 14),
          ),
          h('input', {
            ref: searchInputRef,
            className: 'dsh-rs__tinput',
            type: 'text',
            placeholder: '搜索已归档…',
            value: query,
            tabIndex: searchOpen ? 0 : -1,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
            'aria-label': '搜索已归档',
            spellCheck: false,
          }),
          h(
            'button',
            {
              className: 'dsh-rs__tbtn dsh-rs__tclear',
              type: 'button',
              title: '清除搜索',
              'aria-label': '清除搜索',
              tabIndex: searchOpen ? 0 : -1,
              onClick: closeSearch,
            },
            sessionIcon(h, 'close', 14),
          ),
        ),
        h(
          'div',
          { className: 'dsh-rs__tselect' },
          h(
            'button',
            {
              className: 'dsh-rs__tbtn',
              type: 'button',
              title: selecting ? (allArchivedSelected ? '取消选择' : '全选') : '选择',
              'aria-label': selecting ? (allArchivedSelected ? '取消选择' : '全选') : '选择会话',
              tabIndex: searchOpen ? -1 : 0,
              disabled: selecting && archivedItems.length === 0,
              onClick: () => {
                if (selecting) {
                  toggleAllArchived()
                } else {
                  startSelecting()
                }
              },
            },
            sessionIcon(
              h,
              selecting ? (allArchivedSelected ? 'xSquare' : 'checkSquare') : 'listcheck',
              14,
            ),
          ),
          h(
            'button',
            {
              className: 'dsh-rs__tbtn',
              type: 'button',
              title: '恢复选中',
              'aria-label': '恢复选中',
              tabIndex: selecting && selected.size > 0 ? 0 : -1,
              disabled: !selecting || selected.size === 0,
              onClick: () => { void restoreSelected() },
            },
            sessionIcon(h, 'restore', 14),
          ),
          h(
            'button',
            {
              className: 'dsh-rs__tbtn dsh-rs__tbtn--danger',
              type: 'button',
              title: '删除选中',
              'aria-label': '删除选中',
              tabIndex: selecting && selected.size > 0 ? 0 : -1,
              disabled: !selecting || selected.size === 0,
              onClick: () => { void openDeleteDialog() },
            },
            sessionIcon(h, 'trash', 14),
          ),
          h(
            'button',
            {
              className: 'dsh-rs__tbtn',
              type: 'button',
              title: '退出选择',
              'aria-label': '退出选择',
              tabIndex: selecting ? 0 : -1,
              onClick: cancelSelecting,
            },
            sessionIcon(h, 'close', 14),
          ),
        ),
      ),
    )

    const trigger = view === 'archive' ? archiveTitlebar : h(
      'button',
      {
        ref: triggerRef,
        type: 'button',
        className: 'dsh-rs__trigger',
        'aria-expanded': collapsed ? 'false' : 'true',
        'aria-controls': 'dsh-rs-float',
        'aria-label': collapsed ? '展开最近会话' : '收起最近会话',
        title: collapsed ? '展开最近会话' : '收起最近会话',
        onClick: () => setCollapsed((previous) => {
          writeCollapse(!previous)
          return !previous
        }),
      },
      h(
        'svg',
        {
          className: 'dsh-rs__caret',
          width: 11,
          height: 11,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'm9 6 6 6-6 6' }),
      ),
      h('span', { ref: triggerLabelRef, className: 'dsh-rs__label' }, '最近会话'),
      h(
        'span',
        { className: 'dsh-rs__count' },
        h('span', { className: 'dsh-rs__num dsh-rs__num--recent' }, String(visibleItems.length)),
      ),
    )

    // 轨道态：连入口都不渲染
    if (narrow) return null

    const renderRecentRow = (row: PanelRow): React.ReactElement => h(
      'div',
      {
        key: row.id,
        className: 'dsh-rs__row',
        role: 'listitem',
        'data-session-id': row.id,
        'data-state': row.state,
        'data-menu': menu && menu.rowId === row.id ? 'true' : undefined,
        'aria-current': row.current ? 'true' : undefined,
      },
      h(
        'button',
        {
          className: 'dsh-rs__go',
          type: 'button',
          title: row.title,
          onClick: () => openSession(ctx, row.id),
        },
        statusIndicator(h, row.state, row.stateLabel),
        h(
          'span',
          { className: 'dsh-rs__main' },
          h('span', { className: 'dsh-rs__name' }, row.title),
          h('span', { className: 'dsh-rs__meta' }, row.meta),
        ),
      ),
      row.pinned
        ? h(
            'span',
            { className: 'dsh-rs__pin', title: '已置顶', 'aria-label': '已置顶' },
            sessionIcon(h, 'pinFill', 14),
          )
        : null,
      h(
        'span',
        { className: 'dsh-rs__acts' },
        h(
          'button',
          {
            className: 'dsh-rs__act',
            'data-act': 'menu',
            type: 'button',
            'aria-haspopup': 'menu',
            'aria-expanded': menu?.rowId === row.id && menu.kind === 'menu' ? 'true' : 'false',
            'aria-label': `会话「${row.title}」的操作`,
            title: '更多操作',
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              toggleMenu(row, event.currentTarget, event.detail === 0)
            },
          },
          sessionIcon(h, 'ellipsis', 14),
        ),
        h(
          'button',
          {
            className: 'dsh-rs__act',
            'data-act': 'archive',
            type: 'button',
            'aria-label': `归档「${row.title}」`,
            title: '归档会话',
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              archiveRow(row, event.currentTarget)
            },
          },
          sessionIcon(h, 'archive', 14),
        ),
        h(
          'button',
          {
            className: 'dsh-rs__act',
            'data-act': 'remove',
            type: 'button',
            'aria-label': `从最近会话列表移除「${row.title}」`,
            title: '从最近会话列表移除',
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              removeRow(row)
            },
          },
          sessionIcon(h, 'close', 12),
        ),
      ),
    )

    const renderArchivedRow = (row: PanelRow): React.ReactElement => {
      const checked = selected.has(row.id)
      return h(
        'div',
        {
          key: row.id,
          className: 'dsh-rs__row',
          role: 'listitem',
          'data-session-id': row.id,
          'data-selecting': selecting ? 'true' : undefined,
          'data-selected': checked ? 'true' : undefined,
          'aria-selected': selecting ? (checked ? 'true' : 'false') : undefined,
          onClick: selecting ? () => toggleSelected(row.id) : undefined,
        },
        selecting
          ? h(
              'span',
              { className: 'dsh-rs__check', 'aria-hidden': 'true' },
              checked
                ? h(
                    'svg',
                    {
                      width: 10,
                      height: 10,
                      viewBox: '0 0 12 12',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    },
                    h('path', { d: 'M2.5 6.5L5 9L9.5 3.5' }),
                  )
                : null,
            )
          : null,
        h(
          'span',
          { className: 'dsh-rs__go' },
          selecting ? null : statusIndicator(h, row.state, row.stateLabel),
          h(
            'span',
            { className: 'dsh-rs__main' },
            h('span', { className: 'dsh-rs__name' }, row.title),
            h('span', { className: 'dsh-rs__meta' }, row.meta),
          ),
        ),
        selecting
          ? null
          : h(
              'span',
              { className: 'dsh-rs__row-actions' },
              h(
                'button',
                {
                  className: 'dsh-rs__row-act',
                  type: 'button',
                  title: '恢复',
                  'aria-label': `恢复「${row.title}」`,
                  onClick: () => { void restoreRow(row) },
                },
                sessionIcon(h, 'restore', 14),
              ),
              h(
                'button',
                {
                  className: 'dsh-rs__row-act dsh-rs__row-act--danger',
                  type: 'button',
                  title: '删除',
                  'aria-label': `删除「${row.title}」`,
                  onClick: () => openDeleteRowDialog(row),
                },
                sessionIcon(h, 'trash', 14),
              ),
            ),
      )
    }

    // 两个视图并排渲染，进入/退出靠整页横移（push）：最近会话 ←→ 归档。
    // 两页都不需要不透明底，横移时也不会互相透字 —— 这是透明浮层下最稳的做法。
    const recentView = h(
      'section',
      {
        className: 'dsh-rs__view dsh-rs__view--recent',
        'aria-hidden': view === 'archive' ? 'true' : undefined,
        inert: view === 'archive' ? '' : undefined,
      },
      h(
        'div',
        {
          className: 'dsh-rs__list',
          role: 'list',
          ref: listRef,
          'data-rail': railOpen ? 'true' : undefined,
        },
        visibleItems.length === 0
          ? h('div', { className: 'dsh-rs__empty' }, '还没有历史会话')
          : h('div', { className: 'dsh-rs__rows' }, visibleItems.map(renderRecentRow)),
      ),
    )

    const archiveView = h(
      'section',
      {
        className: 'dsh-rs__view dsh-rs__view--archive',
        'aria-hidden': view === 'recent' ? 'true' : undefined,
        inert: view === 'recent' ? '' : undefined,
      },
      h(
        'div',
        { className: 'dsh-rs__list', role: 'list' },
        archivedVisible.length === 0
          ? h('div', { className: 'dsh-rs__empty' }, searchOpen ? '没有匹配的会话' : '还没有归档的会话')
          : archivedVisible.map(renderArchivedRow),
      ),
    )

    const views = h(
      'div',
      { className: 'dsh-rs__views', 'data-view': view },
      recentView,
      archiveView,
    )

    const railElement = h(
      'div',
      {
        className: 'dsh-rs__railclip',
        hidden: archivedItems.length === 0,
      },
      h(
        'button',
        {
          className: 'dsh-rs__rail',
          type: 'button',
          'data-revealed': railOpen ? 'true' : 'false',
          'aria-hidden': railOpen ? undefined : 'true',
          tabIndex: railOpen ? 0 : -1,
          'aria-label': '查看已归档会话',
          onClick: () => {
            setRailOpen(false)
            setView('archive')
          },
        },
        sessionIcon(h, 'archive', 13),
        h(
          'span',
          { className: 'dsh-rs__rail__label' },
          '已归档 ',
          h('b', null, String(archivedItems.length)),
        ),
        sessionIcon(h, 'chevron', 12),
      ),
    )

    const snackElement = h(
      'div',
      {
        className: 'dsh-rs__snack',
        'data-on': snack ? 'true' : 'false',
        role: 'status',
        'aria-live': 'polite',
      },
      h('span', { className: 'dsh-rs__snack__text' }, snack?.text ?? ''),
      snack?.undo
        ? h(
            'button',
            {
              className: 'dsh-rs__snack__undo',
              type: 'button',
              onClick: () => {
                const undo = snack.undo
                setSnack(null)
                undo?.()
              },
            },
            '撤销',
          )
        : null,
    )

    const menuRow = menu
      ? visibleItems.find((row) => row.id === menu.rowId) ?? archivedItems.find((row) => row.id === menu.rowId)
      : undefined

    const menuElement = menu && menuRow
      ? createPortal(
          h(
            'div',
            {
              ref: menuRef,
              className: 'dsh-rs__menu',
              'data-kind': menu.kind,
              role: menu.kind === 'confirm' ? 'dialog' : 'menu',
              'aria-label': menu.kind === 'confirm' ? '停止并归档此会话' : '会话操作',
              tabIndex: -1,
            },
            ...(menu.kind === 'confirm'
              ? [
                  h(
                    'div',
                    { className: 'dsh-rs__confirm-head', key: 'head' },
                    sessionIcon(h, 'alert', 16),
                    h('span', null, '停止并归档此会话？'),
                  ),
                  h(
                    'p',
                    { className: 'dsh-rs__confirm-body', key: 'body' },
                    '它仍有正在进行的工作。归档会先停止这些工作；之后可以在「已归档」里恢复。',
                  ),
                  h(
                    'div',
                    { className: 'dsh-rs__menu-actions', key: 'actions' },
                    h(
                      'button',
                      { className: 'dsh-rs__btn dsh-rs__btn--ghost', type: 'button', onClick: () => setMenu(null) },
                      '取消',
                    ),
                    h(
                      'button',
                      {
                        className: 'dsh-rs__btn dsh-rs__btn--primary',
                        type: 'button',
                        onClick: () => { void doArchive(menuRow, menu.anchor, true) },
                      },
                      '停止并归档',
                    ),
                  ),
                ]
              : [
                  { act: 'pin', icon: menuRow.pinned ? 'pinFill' : 'pin', label: menuRow.pinned ? '取消置顶' : '置顶会话', key: '' },
                  { act: 'rename', icon: 'edit', label: '重命名', key: '⌥⌘G' },
                  { act: 'fork', icon: 'branch', label: '分叉会话', key: '⌥⌘F' },
                  { act: 'archive', icon: 'archive', label: '归档会话', key: '⇧⌘A' },
                  { act: 'copy', icon: 'copy', label: '复制 Session ID', key: '' },
                ].map((entry) => h(
                  'button',
                  {
                    key: entry.act,
                    className: 'dsh-rs__menu-item',
                    type: 'button',
                    role: 'menuitem',
                    onClick: () => {
                      if (!menuRow) return
                      switch (entry.act) {
                        case 'pin': void togglePin(menuRow); break
                        case 'rename': openRename(menuRow); break
                        case 'fork': void forkRow(menuRow); break
                        case 'archive': archiveRow(menuRow, menu.anchor); break
                        case 'copy': void copyId(menuRow); break
                        default: break
                      }
                    },
                  },
                  h('span', { className: 'dsh-rs__menu-icon' }, sessionIcon(h, entry.icon, 14)),
                  h('span', { className: 'dsh-rs__menu-label' }, entry.label),
                  entry.key ? h('span', { className: 'dsh-rs__menu-key' }, entry.key) : null,
                ))),
          ),
          document.body,
        )
      : null

    const renameElement = rename
      ? createPortal(
          h(
            'div',
            { className: 'dsh-rs__modal' },
            h('div', { className: 'dsh-rs__modal-scrim', onClick: () => setRename(null) }),
            h(
              'div',
              {
                className: 'dsh-rs__modal-card',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '重命名会话',
              },
              h('h2', { className: 'dsh-rs__modal-title' }, '重命名会话'),
              h('input', {
                key: rename.id,
                ref: renameInputRef,
                className: 'dsh-rs__input',
                defaultValue: rename.title,
                'aria-label': '会话名称',
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveRename()
                  }
                },
              }),
              h(
                'div',
                { className: 'dsh-rs__modal-actions' },
                h(
                  'button',
                  { className: 'dsh-rs__btn dsh-rs__btn--ghost', type: 'button', onClick: () => setRename(null) },
                  '取消',
                ),
                h(
                  'button',
                  { className: 'dsh-rs__btn dsh-rs__btn--primary', type: 'button', onClick: () => { void saveRename() } },
                  '保存',
                ),
              ),
            ),
          ),
          document.body,
        )
      : null

    const deleteElement = deleteDialog
      ? createPortal(
          h(
            'div',
            { className: 'dsh-rs__modal' },
            h('div', {
              className: 'dsh-rs__modal-scrim',
              onClick: () => { if (!deleteBusy) setDeleteDialog(null) },
            }),
            h(
              'div',
              {
                className: 'dsh-rs__modal-card dsh-rs__modal-card--delete',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '删除已归档会话',
              },
              h('h2', { className: 'dsh-rs__modal-title' }, `删除 ${deleteDialog.targets.length} 个已归档会话？`),
              h('p', { className: 'dsh-rs__modal-desc' }, '只删除会话日志，附件库不动；删除后不可恢复。'),
              h(
                'div',
                { className: 'dsh-rs__delete-list' },
                deleteDialog.targets.map((target) => h(
                  'div',
                  { key: target.id, className: 'dsh-rs__delete-item' },
                  h('span', { className: 'dsh-rs__delete-name' }, target.title),
                  h(
                    'span',
                    { className: 'dsh-rs__delete-size' },
                    target.bytes !== undefined
                      ? formatBytes(target.bytes)
                      : deleteDialog.loading ? '检查中…' : '—',
                  ),
                )),
              ),
              h(
                'div',
                { className: 'dsh-rs__delete-total' },
                deleteDialog.loading ? '正在读取占用…' : `共 ${formatBytes(deleteDialog.totalBytes)}`,
              ),
              h(
                'div',
                { className: 'dsh-rs__modal-actions' },
                h(
                  'button',
                  {
                    className: 'dsh-rs__btn dsh-rs__btn--ghost',
                    type: 'button',
                    disabled: deleteBusy,
                    onClick: () => setDeleteDialog(null),
                  },
                  '取消',
                ),
                h(
                  'button',
                  {
                    className: 'dsh-rs__btn dsh-rs__btn--danger',
                    type: 'button',
                    disabled: deleteDialog.loading || deleteBusy,
                    onClick: () => { void confirmDelete() },
                  },
                  deleteBusy ? '删除中…' : '删除',
                ),
              ),
            ),
          ),
          document.body,
        )
      : null

    // 浮层：portal 到 body —— 外层 .dsh-rs__float-clip 负责坐标与裁切，
    // 内层 .dsh-rs__float 只负责"整卡上滑"（translateY(100%) → 0）。
    //
    // 锚点模式下**不写 left/width**：横向坐标和宽度由 CSS 的 anchor()/anchor-size()
    // 在排版时直接给出（同一帧、零测量），这里只留高度与两个动画时长。
    // 回退模式下照旧把量来的像素写进去。
    const float = !mounted || !geo
      ? null
      : createPortal(
        h(
          'div',
          {
            className: 'dsh-rs__float-clip',
            ref: clipRef,
            'data-anchor': anchored ? 'true' : undefined,
            style: {
              ...(anchored
                ? null
                : {
                  left: `${Math.round(geo.left)}px`,
                  width: `${Math.round(geo.width)}px`,
                  bottom: `${Math.round(geo.bottom)}px`,
                }),
              height: `${Math.round(currentHeight + CLIP_HEADROOM)}px`,
              // 卡片过渡与工作区裁切线共用这两个值 —— 必须是**同一个**时长
              '--dsh-rs-slide-in': `${timing.inMs}ms`,
              '--dsh-rs-slide-out': `${timing.outMs}ms`,
            } as React.CSSProperties,
          },
          h(
            'div',
            {
              id: 'dsh-rs-float',
              ref: floatRef,
              className: 'dsh-rs__float',
              'data-surface': geo.hasRegion ? 'none' : 'fill',
              'data-leaving': leaving ? 'true' : 'false',
              'data-arch': railOpen ? 'true' : 'false',
              role: 'region',
              'aria-label': '最近会话',
              style: {
                height: `${Math.round(currentHeight)}px`,
                '--dsh-rs-rail': railOpen ? '34px' : '0px',
              } as React.CSSProperties,
            },
            h('div', {
              className: 'dsh-rs__grip',
              role: 'separator',
              'aria-orientation': 'horizontal',
              'aria-label': '上下拖动调整最近会话高度',
              'aria-valuemin': MIN_HEIGHT,
              'aria-valuenow': Math.round(currentHeight),
              tabIndex: 0,
              title: '上下拖动调整高度 · 双击复位',
              onPointerDown: onGripDown,
              onPointerMove: onGripMove,
              onPointerUp: onGripEnd,
              onPointerCancel: onGripEnd,
              onDoubleClick: onGripReset,
              onKeyDown: onGripKey,
            }),
            views,
            railElement,
            snackElement,
          ),
        ),
        document.body,
      )

    return h(React.Fragment, null, trigger, float, menuElement, renameElement, deleteElement)

  }
}

/**
 * 依赖的客户端服务。
 *
 * `slots` 是所有 UI 插件的硬依赖；`sessions`/`workspaces` 是会话与工作区快照的拥有者；
 * `uiSession` 是**状态**（运行中 / 等你回答 / 跑完未打开）的拥有者 —— 声明它，
 * apply 才会在它就绪之后跑，读状态源不会读到 undefined。
 */
export const inject = ['slots', 'sessions', 'workspaces', 'uiSession']

export function apply(ctx: ClientContext): void {
  const config: PanelConfig = { ...DEFAULT_CONFIG }

  // 配置就绪后按 Host 配置生效（默认值先顶上，不阻塞首屏）。
  void fetch(CONFIG_URL, { headers: { accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((json: unknown) => {
      if (!json || typeof json !== 'object') return
      Object.assign(config, json as Partial<PanelConfig>)
    })
    .catch(() => {
      /* Host 路由不可用时保持默认配置，面板照常工作 */
    })

  // 组件只建一次：rows store 的订阅与缓存跟着组件走，每次渲染重建组件
  // 等于每次重建订阅。
  const Panel = createPanel(ctx, config)

  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () =>
    // ⚠️ register(options, component) 是**两个参数**：component 走第二个。
    // 塞进 options 会被静默忽略（entry.component 为 undefined，渲染时才炸）。
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'dsh-recent-sessions/panel',
      order: 10,
      registrant: 'dsh-recent-sessions',
    }, Panel),
  ), 'dsh-recent-sessions: sidebar entry + float')
}
