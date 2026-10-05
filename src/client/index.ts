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
 * **浮层本体**则用 portal 挂到 `document.body` + `position:fixed`，坐标从侧栏列
 * （`[class*="_sidebarCol"]`）和入口自身量出来：既不会被侧栏列的 `overflow:hidden`
 * 裁掉，也不怕外壳以后给祖先加 `transform`。
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
  width: 100%;
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
}
.dsh-rs__trigger:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05)); }
.dsh-rs__trigger:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: -2px;
}
.dsh-rs__caret {
  flex: none;
  opacity: .55;
  transition: rotate 240ms var(--ds-ease-in-out, ease);
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
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary, inherit);
  font-variant-numeric: tabular-nums;
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
  z-index: 30;
  overflow: hidden;
  pointer-events: none;
  /* 下沿渐隐 CLIP_BOTTOM_FADE：卡片的上边框/投影滑出时"化掉"，
     不会在入口那条线上闪一道线；静止时这 6px 落在列表底部留白里，看不见 */
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - ${CLIP_BOTTOM_FADE}px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000 calc(100% - ${CLIP_BOTTOM_FADE}px), transparent 100%);
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
.dsh-rs__list {
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
.dsh-rs__list::-webkit-scrollbar { width: 0; height: 0; display: none; }

.dsh-rs__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background 110ms var(--ds-ease-in-out, ease);
}
.dsh-rs__row:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / .05)); }
.dsh-rs__row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: -2px;
}
.dsh-rs__row[aria-current="true"] {
  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-active, rgb(0 0 0 / .07)) 68%, transparent);
}
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
@media (prefers-reduced-motion: reduce) {
  /* 减少动态效果：蓝点定格为常亮，不再闪 */
  .dsh-rs__dot[data-state="ongoing"]::after { animation: none; }
  .dsh-rs__float { transition: none; }
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

  function recompute(): void {
    const byId = sessions?.list?.getSnapshot()?.byId ?? {}
    const workspaceSnapshot = workspaces?.list?.getSnapshot()
    const archived = new Set(workspaceSnapshot?.archivedSessionIds ?? [])
    const names = workspaceNames(workspaceSnapshot?.items)
    const statuses = uiSession?.sessionStatus?.getSnapshot()
    let currentId: string | undefined
    for (const [key, summary] of Object.entries(byId)) {
      if ((summary.retainedBy?.mainView ?? 0) > 0) currentId = idOf(key, summary)
    }
    const now = Date.now()
    cache = Object.entries(byId)
      .filter(([key, summary]) => {
        const id = idOf(key, summary)
        // 子代理不是"对话"，归档会话已移出浏览区，两者都不进最近列表
        if (summary.address?.kind === 'subagent') return false
        if (archived.has(id)) return false
        return Number.isFinite(summary.updatedAt) && (summary.updatedAt ?? 0) > 0
      })
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
      .slice(0, config.maxItems)
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

        return { id, title, meta, running, current: id === currentId, state, stateLabel }
      })
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

/** 面板组件工厂：由 slot 渲染器以 React 组件调用。 */
function createPanel(ctx: ClientContext, config: PanelConfig) {
  const rows = createRowsStore(ctx, config)
  const uiSessionReady = rows.hasStatusSource
  const h = React.createElement

  return function RecentSessionsPanel(props: { wide?: boolean }) {
    const items = useSyncExternalStore(rows.subscribe, rows.getSnapshot, rows.getSnapshot)
    const [collapsed, setCollapsed] = React.useState(() => readCollapse(config.defaultCollapsed))
    // 浮层高度（px）：null = 没拖过，走默认
    const [height, setHeight] = React.useState<number | null>(() => readHeight())
    const [geo, setGeo] = React.useState<FloatGeometry | null>(null)
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
    const floatRef = React.useRef<HTMLDivElement | null>(null)
    const listRef = React.useRef<HTMLDivElement | null>(null)
    const dragRef = React.useRef<{ startY: number; startHeight: number; max: number } | null>(null)

    // 轨道态（wide === false）：**什么都不留**
    const narrow = props.wide === false

    // 一次性挂样式：重载时同名 <style> 被复用而不是叠加
    React.useEffect(() => {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = PANEL_CSS
      document.head.appendChild(style)
    }, [])

    // 量几何：窗口缩放、侧栏拖宽、侧栏收起/展开、行数变化都要重算
    React.useEffect(() => {
      if (narrow || collapsed) return
      const update = () => setGeo(measure(triggerRef.current))
      update()
      const raf = window.requestAnimationFrame(update)
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
      const col = document.querySelector(SIDEBAR_SEL)
      if (observer && col) observer.observe(col)
      if (observer && triggerRef.current) observer.observe(triggerRef.current)
      window.addEventListener('resize', update)
      return () => {
        window.cancelAnimationFrame(raf)
        observer?.disconnect()
        window.removeEventListener('resize', update)
      }
    }, [narrow, collapsed, items.length])

    // 收起：只有两个途径 —— 再点入口本身，或按 Esc。
    // **点浮层外不收起**：连续切好几个会话时不该被"手滑点到别处"打断。
    React.useEffect(() => {
      if (narrow || collapsed) return
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        setCollapsed(true)
        writeCollapse(true)
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [narrow, collapsed])

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
    }, [narrow, collapsed, items.length])

    // 调试抓手：控制台 __dshRecentSessions 能立刻看出入口是否挂上、列了几行、
    // 每行是什么状态（黄点/绿点/转圈），排"点没出来"时一眼定位
    React.useEffect(() => {
      const handle = (window as unknown as Record<string, unknown>).__dshRecentSessions as
        | Record<string, unknown>
        | undefined
      const next = {
        mounted: !narrow,
        rows: items.length,
        collapsed: narrow ? true : collapsed,
        height: height ?? DEFAULT_HEIGHT,
        geometry: geo,
        statusSource: uiSessionReady,
        states: items.map((row) => `${row.state}:${row.stateLabel}`),
      }
      if (handle) Object.assign(handle, next)
      else (window as unknown as Record<string, unknown>).__dshRecentSessions = next
    }, [narrow, items.length, collapsed, height, geo, uiSessionReady, items])

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
      const cardTop = window.innerHeight - geo.bottom - currentHeight
      const visible = cardTop - geo.regionTop
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

    const trigger = h(
      'button',
      {
        ref: triggerRef,
        type: 'button',
        className: 'dsh-rs__trigger',
        'aria-expanded': collapsed ? 'false' : 'true',
        'aria-controls': 'dsh-rs-float',
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
      h('span', { className: 'dsh-rs__label' }, '最近会话'),
      h('span', { className: 'dsh-rs__count' }, String(items.length)),
    )

    // 轨道态：连入口都不渲染
    if (narrow) return null

    const body = items.length === 0
      ? h('div', { className: 'dsh-rs__empty' }, '还没有历史会话')
      : h(
        'div',
        {
          className: 'dsh-rs__list',
          role: 'list',
          ref: listRef,
        },
        items.map((row) =>
          h(
            'button',
            {
              key: row.id,
              type: 'button',
              role: 'listitem',
              className: 'dsh-rs__row',
              title: row.title,
              'data-session-id': row.id,
              'data-state': row.state,
              'aria-current': row.current ? 'true' : undefined,
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
        ),
      )

    // 浮层：portal 到 body —— 外层 .dsh-rs__float-clip 负责坐标与裁切，
    // 内层 .dsh-rs__float 只负责"整卡上滑"（translateY(100%) → 0）。
    const float = !mounted || !geo
      ? null
      : createPortal(
        h(
          'div',
          {
            className: 'dsh-rs__float-clip',
            style: {
              left: `${Math.round(geo.left)}px`,
              width: `${Math.round(geo.width)}px`,
              bottom: `${Math.round(geo.bottom)}px`,
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
            role: 'region',
            'aria-label': '最近会话',
            style: { height: `${Math.round(currentHeight)}px` },
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
            body,
          ),
        ),
        document.body,
      )

    return h(React.Fragment, null, trigger, float)
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
