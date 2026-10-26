window.__ModuleLoader__.load({
	id: "@yfwu2020/dsh-recent-sessions",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_dom = require("react-dom");
		//#region src/client/index.ts
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
		/** 官方只把这三种待交互当作"要展示的状态"（`visiblePendingKind`）。 */
		function visiblePendingKind(kind) {
			switch (kind) {
				case "approval":
				case "plan-review":
				case "question": return kind;
				default: return;
			}
		}
		/** 待询问的读屏文案（按官方三种 kind 分）。 */
		function pendingLabel(kind) {
			if (kind === "approval") return "等待批准";
			if (kind === "plan-review") return "等待计划确认";
			return "等待回答";
		}
		const CONFIG_URL = "/dsh-recent-sessions/api/config";
		const STYLE_ID = "dsh-recent-sessions/css";
		/** 本包名：宿主 client-modules 用 `style[data-plugin="<包名>"]` 记样式归属。 */
		const PLUGIN_ID = "@yfwu2020/dsh-recent-sessions";
		/**
		* 收起状态 / 高度都带 `.v2`：
		*
		* 旧版是"钉在侧栏底部的常驻面板"（默认展开、高度从工作区借空间），新版是
		* "盖在工作区列表上的浮层"（默认收起、高度上限不同）。两种形态的偏好不通用 ——
		* 沿用旧键的话，老用户一进来浮层就是摊开的、还可能顶到品牌行，所以换键，
		* 让新版从自己的默认值开始；用户点一次之后照旧记住。
		*/
		const COLLAPSE_KEY = "dsh.recent-sessions.collapsed.v2";
		const HEIGHT_KEY = "dsh.recent-sessions.height.v2";
		/** 「从最近会话移除」的本地集合：只影响这个列表，不动会话本身。 */
		const REMOVED_KEY = "dsh.recent-sessions.removed.v1";
		/** 橡皮筋最多拉这么长；拉满 = 「已归档」抽屉弹出。 */
		const PULL_MAX = 72;
		/** 抽屉露出后，无操作多久自动缩回。 */
		const RAIL_HOLD_MS = 4500;
		/** 浮层高度下限：够三行多一点点，再小就没法选了。 */
		const MIN_HEIGHT = 120;
		/** 默认高度（没拖过就用它）。 */
		const DEFAULT_HEIGHT = 268;
		/** 浮层顶部与侧栏顶沿之间至少留这么多（只在量不到浏览区时当兜底）。 */
		const TOP_KEEP = 24;
		/** 侧栏列的选择器：类名带构建哈希，用子串匹配。 */
		const SIDEBAR_SEL = "[class*=\"_sidebarCol\"]";
		/** 工作区浏览区（`sidebar.workspaces` 的容器）选择器，同上。 */
		const REGION_SEL = "[class*=\"_regionArea\"]";
		/** 列表底部默认留白（写在 CSS 里；内容够不着一屏、或算不出来时就用它）。 */
		const LIST_PAD_BASE = 16;
		/** 末行要躲开下缘那条 16px 渐隐，所以底部补白至少留这么多。 */
		const LIST_PAD_MIN = 20;
		/**
		* 滑动的"速度"：每毫秒走多少像素。
		*
		* 原型里那张卡是 210px / 320ms ≈ 0.66；**时长必须按卡片高度算**，不能写死 ——
		* 写死的话，你把浮层拖得越高，同样的时长要跑越长的距离，起步就越快、越生硬。
		* 曲线不变（还是原型那条），变的只是单位时间走多少像素。
		*/
		const SLIDE_PX_PER_MS = .66;
		const SLIDE_MIN_MS = 260;
		const SLIDE_MAX_MS = 560;
		/** 滑回去比滑上来略快（慢进快出）。 */
		const SLIDE_OUT_RATIO = .88;
		/** 滑回去播完再等这么久才卸载节点。 */
		const EXIT_SLACK_MS = 60;
		const SLIDE_EASE = "cubic-bezier(.22, 1, .36, 1)";
		/** 裁切容器比卡片上沿高出来的部分：给卡片自己的上边缘投影让位。 */
		const CLIP_HEADROOM = 24;
		/** 裁切容器下沿的渐隐高度：让卡片的上边框/投影滑出时"化掉"，不会在入口线上闪一道线。 */
		const CLIP_BOTTOM_FADE = 6;
		/**
		* 收起态再多滑一点，让边框和投影彻底出界。
		* **别调大**：卡片的行程 = 高度 + 这个值，而裁切线的行程 = 高度 —— 差多少，
		* 动画途中工作区文字就比卡片上沿早"停"多少（中间留一条空带）。那道线本身已经由
		* 裁切容器下沿的 6px 渐隐接管，所以这里只要 2px 余量就够。
		*/
		const SLIDE_OVERSHOOT = 2;
		/** 按卡片高度算这一趟滑动的时长（工作区裁切线必须用同一个值）。 */
		function slideTiming(height) {
			const base = Math.min(SLIDE_MAX_MS, Math.max(SLIDE_MIN_MS, Math.round(height / SLIDE_PX_PER_MS)));
			return {
				inMs: base,
				outMs: Math.round(base * SLIDE_OUT_RATIO)
			};
		}
		const DEFAULT_CONFIG = {
			maxItems: 12,
			showWorkspace: true,
			defaultCollapsed: true,
			refreshMs: 3e4
		};
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
/* 归档视图：入口行原地变成「返回 + 已归档 N」，箭头指左 */
.dsh-rs__trigger[aria-expanded="true"][data-mode="archive"] .dsh-rs__caret { rotate: 180deg; }
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
  /* Sidebar utility stays below the host overlay (20) and explanation root (70). */
  z-index: 19;
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
.dsh-rs__restore {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #555);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dsh-rs__restore svg { width: 12px; height: 12px; color: var(--dsw-alias-label-tertiary, #888); }
.dsh-rs__restore:hover { background: var(--dsw-alias-interactive-bg-active, rgb(0 0 0 / .07)); color: var(--dsw-alias-label-primary, #111); }

@media (prefers-reduced-motion: reduce) {
  /* 减少动态效果：蓝点定格为常亮，不再闪 */
  .dsh-rs__dot[data-state="ongoing"]::after { animation: none; }
  .dsh-rs__float { transition: none; }
  .dsh-rs__rows { transition: none; }
  .dsh-rs__rail { transition: none; }
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
`;
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
		function ensurePanelStyle() {
			if (typeof document === "undefined") return;
			let el = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`);
			if (el === null) {
				el = document.createElement("style");
				el.id = STYLE_ID;
				el.setAttribute("data-plugin", PLUGIN_ID);
				el.setAttribute("data-plugin-css", STYLE_ID);
				document.head.appendChild(el);
			}
			if (el.textContent !== PANEL_CSS) el.textContent = PANEL_CSS;
		}
		ensurePanelStyle();
		/** 相对时间：中文短文案，跨天走日期。 */
		function relativeTime(updatedAt, now) {
			if (!Number.isFinite(updatedAt) || updatedAt <= 0) return "时间未知";
			const diff = Math.max(0, now - updatedAt);
			const minute = 6e4;
			const hour = 60 * minute;
			const day = 24 * hour;
			if (diff < minute) return "刚刚";
			if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
			if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
			if (diff < 2 * day) return "昨天";
			if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
			const at = new Date(updatedAt);
			const md = `${at.getMonth() + 1} 月 ${at.getDate()} 日`;
			return at.getFullYear() === new Date(now).getFullYear() ? md : `${at.getFullYear()} 年 ${md}`;
		}
		/** 会话 id：快照键与摘要字段两种写法都认。 */
		function idOf(key, summary) {
			return summary.sessionId ?? key;
		}
		/** 工作区名：会话 → 工作区的反向索引。 */
		function workspaceNames(items) {
			const map = /* @__PURE__ */ new Map();
			for (const item of items ?? []) {
				const title = item.title?.trim();
				if (!title) continue;
				for (const sessionId of item.sessionIds ?? []) if (!map.has(sessionId)) map.set(sessionId, title);
			}
			return map;
		}
		function readRemoved() {
			try {
				const raw = window.localStorage.getItem(REMOVED_KEY);
				if (!raw) return /* @__PURE__ */ new Set();
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return /* @__PURE__ */ new Set();
				return new Set(parsed.filter((id) => typeof id === "string"));
			} catch {
				return /* @__PURE__ */ new Set();
			}
		}
		function writeRemoved(ids) {
			try {
				window.localStorage.setItem(REMOVED_KEY, JSON.stringify([...ids]));
			} catch {}
		}
		function readCollapse(fallback) {
			try {
				const raw = window.localStorage.getItem(COLLAPSE_KEY);
				return raw === null ? fallback : raw === "1";
			} catch {
				return fallback;
			}
		}
		function writeCollapse(collapsed) {
			try {
				window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
			} catch {}
		}
		/** 记下来的浮层高度；没拖过就是 null（走默认高度）。 */
		function readHeight() {
			try {
				const raw = window.localStorage.getItem(HEIGHT_KEY);
				if (raw === null) return null;
				const parsed = Number.parseInt(raw, 10);
				return Number.isFinite(parsed) ? Math.max(MIN_HEIGHT, parsed) : null;
			} catch {
				return null;
			}
		}
		function writeHeight(height) {
			try {
				if (height === null) window.localStorage.removeItem(HEIGHT_KEY);
				else window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
			} catch {}
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
		function measure(trigger) {
			if (!trigger) return null;
			const t = trigger.getBoundingClientRect();
			if (t.width === 0 && t.height === 0) return null;
			const c = document.querySelector(SIDEBAR_SEL)?.getBoundingClientRect();
			const left = c ? c.left : t.left;
			const width = c ? c.width : 280;
			if (width < 80) return null;
			const r = document.querySelector(REGION_SEL)?.getBoundingClientRect();
			const topLimit = r ? r.top : c ? c.top + TOP_KEEP : 0;
			return {
				left,
				width,
				bottom: Math.max(0, window.innerHeight - t.top),
				maxHeight: Math.max(MIN_HEIGHT, Math.round(t.top - topLimit)),
				regionBottom: r ? r.bottom : t.top,
				regionTop: r ? r.top : t.top,
				hasRegion: Boolean(r)
			};
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
		function setRegionCut(visiblePx, animate, closing, timing) {
			const region = document.querySelector(REGION_SEL);
			if (!region) return false;
			const h = region.getBoundingClientRect().height;
			const cut = visiblePx === null ? h : Math.max(0, Math.min(h, Math.round(visiblePx)));
			region.style.setProperty("--dsh-rs-cut", `${cut}px`);
			region.style.maskImage = "linear-gradient(#000, #000)";
			region.style.webkitMaskImage = "linear-gradient(#000, #000)";
			region.style.maskRepeat = "no-repeat";
			region.style.webkitMaskRepeat = "no-repeat";
			region.style.maskPosition = "top";
			region.style.webkitMaskPosition = "top";
			if (!animate) {
				region.style.animation = "";
				region.style.maskSize = `100% ${cut}px`;
				region.style.webkitMaskSize = `100% ${cut}px`;
				return true;
			}
			region.style.maskSize = "";
			region.style.webkitMaskSize = "";
			region.style.animation = closing ? `dsh-rs-cut-out ${timing.outMs}ms ${SLIDE_EASE} both` : `dsh-rs-cut-in ${timing.inMs}ms ${SLIDE_EASE} both`;
			return true;
		}
		function unmaskRegion() {
			const region = document.querySelector(REGION_SEL);
			if (!region) return;
			region.style.animation = "";
			region.style.maskImage = "";
			region.style.webkitMaskImage = "";
			region.style.maskRepeat = "";
			region.style.webkitMaskRepeat = "";
			region.style.maskPosition = "";
			region.style.webkitMaskPosition = "";
			region.style.maskSize = "";
			region.style.webkitMaskSize = "";
			region.style.removeProperty("--dsh-rs-cut");
		}
		/**
		* 找"离当前滚动位置最近的行上沿"（内容坐标）。
		*
		* 用每行实测位置算，不假设行高等距 —— 以后行高改了、或加了行间距，
		* 这里也不会算错。
		*/
		function nearestRowTop(list, maxScroll) {
			const rows = list.querySelectorAll(".dsh-rs__row");
			if (rows.length === 0) return null;
			const listTop = list.getBoundingClientRect().top;
			const scrollTop = list.scrollTop;
			let best = null;
			let bestDistance = Infinity;
			for (const row of Array.from(rows)) {
				const top = row.getBoundingClientRect().top - listTop + scrollTop;
				if (top > maxScroll + .5) continue;
				const distance = Math.abs(top - scrollTop);
				if (distance < bestDistance) {
					bestDistance = distance;
					best = top;
				}
			}
			return best;
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
		function settleListToRow(list) {
			if (!list) return;
			syncListBottomPadding(list);
			const max = Math.max(0, list.scrollHeight - list.clientHeight);
			const target = nearestRowTop(list, max);
			if (target === null) return;
			const clamped = Math.min(Math.max(0, target), max);
			if (Math.abs(list.scrollTop - clamped) <= .5) return;
			const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
			list.scrollTo({
				top: clamped,
				behavior: reduceMotion ? "auto" : "smooth"
			});
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
		function syncListBottomPadding(list) {
			if (!list) return;
			const rows = Array.from(list.querySelectorAll(".dsh-rs__row"));
			if (rows.length < 2) {
				list.style.paddingBottom = "";
				return;
			}
			const first = rows[0].getBoundingClientRect();
			const second = rows[1].getBoundingClientRect();
			const last = rows[rows.length - 1].getBoundingClientRect();
			const pitch = second.top - first.top;
			const rowsHeight = last.bottom - first.top;
			const viewport = list.clientHeight;
			if (!(pitch > 1) || viewport <= 0) {
				list.style.paddingBottom = "";
				return;
			}
			if (rowsHeight + LIST_PAD_BASE <= viewport) {
				list.style.paddingBottom = "";
				return;
			}
			const need = ((viewport - rowsHeight) % pitch + pitch) % pitch;
			const pad = need >= LIST_PAD_MIN ? need : need + pitch;
			list.style.paddingBottom = `${Math.round(pad)}px`;
		}
		/**
		* 打开一个会话。
		*
		* 优先走 ui-workspace 的官方导航（它会做归档校验、释放旧引用、切回主面板）；
		* 拿不到该服务时退回点击官方侧栏里那一行 —— 官方行带 `data-row-key`，
		* React 自己的 onOpen 会接手，语义与手点一致。
		*/
		function openSession(ctx, sessionId) {
			const uiWorkspace = ctx.get?.("uiWorkspace", false);
			if (uiWorkspace?.openSession) try {
				uiWorkspace.openSession(sessionId);
				return;
			} catch (error) {
				ctx.logger?.warn?.("[dsh-recent-sessions] openSession 失败，改用行点击：", error);
			}
			const row = document.querySelector(`[data-row-key="session:${CSS.escape(sessionId)}"]`);
			if (row) row.dispatchEvent(new MouseEvent("click", {
				bubbles: true,
				cancelable: true
			}));
		}
		/**
		* 面板的数据接线：把两个官方快照折成一份**引用稳定**的行数组。
		*
		* `useSyncExternalStore` 要求 getSnapshot 每次返回同一个引用，所以行数组只在
		* 快照真的变了才重算（`recompute` 由 store 订阅驱动）。
		*/
		function createRowsStore(ctx, config) {
			const sessions = ctx.get?.("sessions", false);
			const workspaces = ctx.get?.("workspaces", false);
			/**
			* 官方 ui-session 的状态源：`Map<sessionId, {running, pendingInteraction, completionUnread}>`。
			*
			* 这是官方会话行前面那枚标识的**同一个事实源** —— 不是我们从 transport 另推一份，
			* 所以我们的点跟官方行上的点永远不会各说各话（"已完成未打开"的判定、
			* "正在等你回答"的判定都只发生在宿主那一侧）。
			*/
			const uiSession = ctx.get?.("uiSession", false);
			let cache = [];
			let archivedCache = [];
			function recompute() {
				const byId = sessions?.list?.getSnapshot()?.byId ?? {};
				const workspaceSnapshot = workspaces?.list?.getSnapshot();
				const archived = new Set(workspaceSnapshot?.archivedSessionIds ?? []);
				const pinned = new Set(workspaceSnapshot?.pinnedSessionIds ?? []);
				const names = workspaceNames(workspaceSnapshot?.items);
				const statuses = uiSession?.sessionStatus?.getSnapshot();
				let currentId;
				for (const [key, summary] of Object.entries(byId)) if ((summary.retainedBy?.mainView ?? 0) > 0) currentId = idOf(key, summary);
				const now = Date.now();
				const rows = Object.entries(byId).filter(([key, summary]) => {
					idOf(key, summary);
					if (summary.address?.kind === "subagent") return false;
					return Number.isFinite(summary.updatedAt) && (summary.updatedAt ?? 0) > 0;
				}).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0)).map(([key, summary]) => {
					const id = idOf(key, summary);
					const title = summary.blank ? "新会话" : summary.title?.trim() || "未命名会话";
					const workspace = names.get(id);
					const meta = [relativeTime(summary.updatedAt ?? 0, now), config.showWorkspace && workspace ? workspace : ""].filter(Boolean).join(" · ");
					const status = statuses?.get(id);
					const pendingKind = visiblePendingKind(status?.pendingInteraction?.kind);
					const running = status?.running ?? summary.running === true;
					let state = "idle";
					let stateLabel = "空闲";
					if (pendingKind !== void 0) {
						state = "warning";
						stateLabel = pendingLabel(pendingKind);
					} else if (running) {
						state = "ongoing";
						stateLabel = "运行中";
					} else if (status?.completionUnread === true) {
						state = "done";
						stateLabel = "已完成";
					}
					return {
						id,
						title,
						meta,
						running,
						current: id === currentId,
						state,
						stateLabel,
						pinned: pinned.has(id)
					};
				});
				cache = rows.filter((row) => !archived.has(row.id)).slice(0, config.maxItems);
				archivedCache = rows.filter((row) => archived.has(row.id));
			}
			recompute();
			return {
				subscribe(listener) {
					const notify = () => {
						recompute();
						listener();
					};
					const offs = [
						sessions?.list?.subscribe(notify),
						workspaces?.list?.subscribe(notify),
						uiSession?.sessionStatus?.subscribe(notify)
					].filter((off) => typeof off === "function");
					const timer = window.setInterval(notify, config.refreshMs);
					return () => {
						window.clearInterval(timer);
						for (const off of offs) off();
					};
				},
				getSnapshot() {
					return cache;
				},
				/** 归档视图的数据源（与最近列表同一份投影，只是不做 maxItems 截断）。 */
				getArchived() {
					return archivedCache;
				},
				refresh: recompute,
				/** 状态源是否拿到（拿不到就只剩运行中/空闲两态，黄绿点不会出现）。 */
				hasStatusSource: uiSession?.sessionStatus !== void 0
			};
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
		function statusIndicator(h, state, label) {
			const idle = state === "idle";
			return h("span", { className: "dsh-rs__status" }, idle ? null : h("span", {
				className: "dsh-rs__dot",
				"data-state": state,
				"aria-hidden": "true"
			}), idle ? null : h("span", { className: "dsh-rs__sr" }, label));
		}
		/** 会话行 / 菜单用的 16 栅格线性图标（路径取自宿主 ui-primitives）。 */
		const ICONS = {
			archive: [
				{ d: "M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z" },
				{ d: "M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5" },
				{ d: "M6.5 9.5H9.5" }
			],
			close: [{ d: "M2.5 2.5L13.5 13.5" }, { d: "M13.5 2.5L2.5 13.5" }],
			pin: [{
				d: "M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z",
				strokeLinejoin: "round"
			}, {
				d: "M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z",
				fill: "currentColor"
			}],
			pinFill: [{
				d: "M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z",
				fill: "currentColor",
				strokeLinejoin: "round"
			}, {
				d: "M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z",
				fill: "currentColor"
			}],
			edit: [{
				d: "M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z",
				fill: "currentColor"
			}, { d: "M7.7849 8.23878L13.888 2.13574" }],
			branch: [
				{ d: "M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564" },
				{ d: "M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944" },
				{ d: "M13.9 3.3a1.45 1.45 0 1 1-2.9 0 1.45 1.45 0 0 1 2.9 0Z" },
				{ d: "M13.9 12.7a1.45 1.45 0 1 1-2.9 0 1.45 1.45 0 0 1 2.9 0Z" }
			],
			copy: [{ d: "M1.52075 4.07373H11.91395C12.91395 4.07373 13.91395 5.07373 13.91395 6.07373V12.46693C13.91395 13.46693 12.91395 14.46693 11.91395 14.46693H3.52075C2.52075 14.46693 1.52075 13.46693 1.52075 12.46693V4.07373Z" }, {
				d: "M11.9792 1.53296C13.36 1.53296 14.4792 2.65225 14.4792 4.03296V9.42847C14.4792 10.3756 13.9521 11.1987 13.1755 11.6228V10.3298C13.3652 10.0787 13.4792 9.7674 13.4792 9.42847V4.03296C13.4792 3.20453 12.8077 2.53296 11.9792 2.53296H6.58374C6.27966 2.53301 5.99684 2.6235 5.7605 2.77905H4.42358C4.85652 2.03463 5.66056 1.53304 6.58374 1.53296H11.9792Z",
				fill: "currentColor"
			}],
			restore: [
				{ d: "M1.5 2.5H14.5V5.5H1.5V2.5Z" },
				{ d: "M2.5 5.5V13C2.5 13.5523 2.94772 14 3.5 14H12.5C13.0523 14 13.5 13.5523 13.5 13V5.5" },
				{ d: "M8 13V8" },
				{ d: "M5.8 10L8 7.8L10.2 10" }
			],
			alert: [
				{
					d: "M8 2.2L14.2 13.4H1.8L8 2.2Z",
					strokeLinejoin: "round"
				},
				{ d: "M8 6.2V9.4" },
				{ d: "M8 11.7H8.01" }
			],
			back: [{ d: "M10 3L5 8L10 13" }],
			chevron: [{ d: "M6 3.5L10.5 8L6 12.5" }]
		};
		function sessionIcon(h, name, size = 14) {
			if (name === "ellipsis") return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "currentColor",
				stroke: "none",
				"aria-hidden": "true"
			}, [
				3,
				8,
				13
			].map((cx) => h("circle", {
				key: cx,
				cx,
				cy: 8,
				r: 1
			})));
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true"
			}, (ICONS[name] ?? []).map((props, index) => h("path", {
				key: index,
				...props
			})));
		}
		/** 面板组件工厂：由 slot 渲染器以 React 组件调用。 */
		function createPanel(ctx, config) {
			const rows = createRowsStore(ctx, config);
			const workspacesApi = ctx.get?.("workspaces", false);
			const sessionsApi = ctx.get?.("sessions", false);
			rows.hasStatusSource;
			const h = react.createElement;
			return function RecentSessionsPanel(props) {
				const items = (0, react.useSyncExternalStore)(rows.subscribe, rows.getSnapshot, rows.getSnapshot);
				const [collapsed, setCollapsed] = react.useState(() => readCollapse(config.defaultCollapsed));
				const [height, setHeight] = react.useState(() => readHeight());
				const [geo, setGeo] = react.useState(null);
				const [dragging, setDragging] = react.useState(false);
				/** 浮层节点是否留在 DOM 里（退场动画期间仍为 true，播完才卸载） */
				const [mounted, setMounted] = react.useState(false);
				/** 正在播退场（滑回去） */
				const [leaving, setLeaving] = react.useState(false);
				/** 上一帧的"卡片是否已出现 / 是否在收回" —— 用来识别状态翻转的那一瞬间 */
				const cutPhaseRef = react.useRef({
					shown: false,
					leaving: false
				});
				/** 当前高度给动画编排 effect 读（放依赖会让它每次改高度都重跑） */
				const liveHeightRef = react.useRef(0);
				const triggerRef = react.useRef(null);
				const floatRef = react.useRef(null);
				const listRef = react.useRef(null);
				const dragRef = react.useRef(null);
				const [removed, setRemoved] = react.useState(() => readRemoved());
				const [view, setView] = react.useState("recent");
				const [menu, setMenu] = react.useState(null);
				const [snack, setSnack] = react.useState(null);
				const [rename, setRename] = react.useState(null);
				const [railOpen, setRailOpen] = react.useState(false);
				const railOpenRef = react.useRef(false);
				const menuRef = react.useRef(null);
				react.useRef(null);
				const triggerLabelRef = react.useRef(null);
				const renameInputRef = react.useRef(null);
				const snackTimerRef = react.useRef(0);
				const railTimerRef = react.useRef(0);
				const settleTimerRef = react.useRef(0);
				const pullRef = react.useRef(0);
				const pullingRef = react.useRef(false);
				const visibleItems = items.filter((row) => !removed.has(row.id));
				const archivedItems = rows.getArchived();
				const narrow = props.wide === false;
				ensurePanelStyle();
				react.useEffect(() => {
					if (narrow || collapsed) return;
					const update = () => setGeo(measure(triggerRef.current));
					update();
					const raf = window.requestAnimationFrame(update);
					const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
					const col = document.querySelector(SIDEBAR_SEL);
					if (observer && col) observer.observe(col);
					if (observer && triggerRef.current) observer.observe(triggerRef.current);
					window.addEventListener("resize", update);
					return () => {
						window.cancelAnimationFrame(raf);
						observer?.disconnect();
						window.removeEventListener("resize", update);
					};
				}, [
					narrow,
					collapsed,
					items.length
				]);
				react.useEffect(() => {
					if (narrow) return;
					const onKey = (event) => {
						if (event.key !== "Escape") return;
						if (menu) {
							setMenu(null);
							return;
						}
						if (rename) {
							setRename(null);
							return;
						}
						if (view === "archive") {
							setView("recent");
							return;
						}
						if (!collapsed) {
							setCollapsed(true);
							writeCollapse(true);
						}
					};
					document.addEventListener("keydown", onKey);
					return () => document.removeEventListener("keydown", onKey);
				}, [
					narrow,
					collapsed,
					menu,
					rename,
					view
				]);
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
				react.useEffect(() => {
					if (narrow) return;
					if (!collapsed) {
						setLeaving(false);
						setMounted(true);
						return;
					}
					if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) {
						setMounted(false);
						return;
					}
					setLeaving(true);
					const { outMs } = slideTiming(liveHeightRef.current);
					const timer = window.setTimeout(() => {
						setMounted(false);
						setLeaving(false);
					}, outMs + EXIT_SLACK_MS);
					return () => window.clearTimeout(timer);
				}, [collapsed, narrow]);
				react.useEffect(() => {
					if (!dragging) return;
					document.body.classList.add("dsh-rs-dragging");
					return () => document.body.classList.remove("dsh-rs-dragging");
				}, [dragging]);
				/**
				* A′：松手后把列表修正到整行边界。
				*
				* 优先用 `scrollend`（Chromium 114+ 原生支持，正是"惯性停下"那一刻）；
				* 没有就退化成"最后一次 scroll 之后 120ms" —— 效果一样，只是判定稍粗。
				* 我们自己的平滑修正会再触发一轮事件，但那时已经对齐，`settleListToRow`
				* 直接返回，不会来回拉锯。
				*/
				react.useEffect(() => {
					if (narrow || collapsed) return;
					const list = listRef.current;
					if (!list) return;
					const settle = () => settleListToRow(list);
					const supportsScrollEnd = "onscrollend" in window;
					let timer = 0;
					const onScroll = () => {
						window.clearTimeout(timer);
						timer = window.setTimeout(settle, 120);
					};
					if (supportsScrollEnd) list.addEventListener("scrollend", settle);
					else list.addEventListener("scroll", onScroll, { passive: true });
					return () => {
						window.clearTimeout(timer);
						if (supportsScrollEnd) list.removeEventListener("scrollend", settle);
						else list.removeEventListener("scroll", onScroll);
					};
				}, [
					narrow,
					collapsed,
					mounted,
					items.length
				]);
				react.useEffect(() => {
					railOpenRef.current = railOpen;
				}, [railOpen]);
				react.useEffect(() => {
					if (collapsed || view !== "recent") setRailOpen(false);
				}, [collapsed, view]);
				const armRailTimer = () => {
					window.clearTimeout(railTimerRef.current);
					railTimerRef.current = window.setTimeout(() => setRailOpen(false), RAIL_HOLD_MS);
				};
				const revealRail = () => {
					if (rows.getArchived().length === 0) return;
					setRailOpen(true);
					armRailTimer();
				};
				const applyPull = (value) => {
					pullingRef.current = true;
					pullRef.current = value;
					const list = listRef.current;
					if (!list) return;
					list.dataset.pulling = "true";
					list.style.setProperty("--dsh-rs-pull", `${value.toFixed(1)}px`);
				};
				const releasePull = () => {
					window.clearTimeout(settleTimerRef.current);
					pullingRef.current = false;
					pullRef.current = 0;
					const list = listRef.current;
					if (!list) return;
					list.dataset.pulling = "false";
					list.style.setProperty("--dsh-rs-pull", "0px");
				};
				const popRail = () => {
					releasePull();
					revealRail();
				};
				/**
				* 到底后继续上推：按阻尼把行容器往上拉，拉满才弹抽屉。
				* 抽屉是覆盖层：不缩列表、不补滚动，回弹距离和它无关。
				*/
				react.useEffect(() => {
					if (narrow || collapsed || view !== "recent") return;
					const list = listRef.current;
					if (!list) return;
					const onWheel = (event) => {
						if (railOpenRef.current) {
							armRailTimer();
							return;
						}
						if (!(list.scrollHeight - list.scrollTop - list.clientHeight <= 1)) {
							if (pullingRef.current) releasePull();
							return;
						}
						if (event.deltaY < 0) {
							if (!pullingRef.current) return;
							event.preventDefault();
							const next = Math.max(0, pullRef.current + event.deltaY * .5);
							if (next <= .5) releasePull();
							else applyPull(next);
							window.clearTimeout(settleTimerRef.current);
							settleTimerRef.current = window.setTimeout(() => {
								if (!railOpenRef.current) releasePull();
							}, 220);
							return;
						}
						if (event.deltaY === 0) return;
						event.preventDefault();
						const room = Math.max(0, 1 - pullRef.current / PULL_MAX);
						applyPull(Math.min(PULL_MAX, pullRef.current + event.deltaY * .36 * (.42 + .58 * room)));
						window.clearTimeout(settleTimerRef.current);
						settleTimerRef.current = window.setTimeout(() => {
							if (!railOpenRef.current) releasePull();
						}, 220);
						if (pullRef.current >= 71.5) popRail();
					};
					let touchY = null;
					let touchBottom = false;
					const onTouchStart = (event) => {
						if (railOpenRef.current) armRailTimer();
						touchY = event.touches[0]?.clientY ?? null;
						touchBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 1;
					};
					const onTouchMove = (event) => {
						if (touchY === null || !touchBottom || railOpenRef.current) return;
						const dy = touchY - (event.touches[0]?.clientY ?? touchY);
						if (dy <= 0) return;
						if (event.cancelable) event.preventDefault();
						applyPull(Math.min(PULL_MAX, dy * .42));
						if (pullRef.current >= 71.5) popRail();
					};
					const onTouchEnd = () => {
						touchY = null;
						touchBottom = false;
						if (pullingRef.current && !railOpenRef.current) releasePull();
					};
					const onScroll = () => {
						if (railOpenRef.current) armRailTimer();
					};
					list.addEventListener("wheel", onWheel, { passive: false });
					list.addEventListener("touchstart", onTouchStart, { passive: true });
					list.addEventListener("touchmove", onTouchMove, { passive: false });
					list.addEventListener("touchend", onTouchEnd);
					list.addEventListener("scroll", onScroll, { passive: true });
					return () => {
						list.removeEventListener("wheel", onWheel);
						list.removeEventListener("touchstart", onTouchStart);
						list.removeEventListener("touchmove", onTouchMove);
						list.removeEventListener("touchend", onTouchEnd);
						list.removeEventListener("scroll", onScroll);
						if (pullingRef.current) releasePull();
					};
				}, [
					narrow,
					collapsed,
					mounted,
					view,
					items.length,
					railOpen
				]);
				react.useEffect(() => {
					if (!railOpen) return;
					const reset = () => armRailTimer();
					document.addEventListener("pointerdown", reset, true);
					return () => document.removeEventListener("pointerdown", reset, true);
				}, [railOpen]);
				react.useEffect(() => () => {
					window.clearTimeout(snackTimerRef.current);
					window.clearTimeout(railTimerRef.current);
					window.clearTimeout(settleTimerRef.current);
				}, []);
				react.useLayoutEffect(() => {
					const el = menuRef.current;
					if (!menu || !el) return;
					const rect = menu.anchor.getBoundingClientRect();
					const width = el.offsetWidth;
					const height = el.offsetHeight;
					const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
					let top = rect.bottom + 5;
					if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 5);
					el.style.left = `${Math.round(left)}px`;
					el.style.top = `${Math.round(top)}px`;
					el.dataset.ready = "true";
					if (menu.viaKeyboard) el.querySelector(".dsh-rs__menu-item, .dsh-rs__btn")?.focus();
				}, [menu]);
				react.useEffect(() => {
					if (!menu) return;
					const onPointerDown = (event) => {
						const target = event.target;
						if (menuRef.current?.contains(target)) return;
						if (target?.closest?.(".dsh-rs__act[data-act=\"menu\"]")) return;
						setMenu(null);
					};
					const onKey = (event) => {
						if (event.key === "Escape") {
							setMenu(null);
							return;
						}
						if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
						const nodes = Array.from(menuRef.current?.querySelectorAll(".dsh-rs__menu-item, .dsh-rs__btn") ?? []);
						if (nodes.length === 0) return;
						event.preventDefault();
						nodes[(nodes.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : nodes.length - 1)) % nodes.length].focus();
					};
					const onDismiss = () => setMenu(null);
					document.addEventListener("pointerdown", onPointerDown, true);
					document.addEventListener("keydown", onKey);
					window.addEventListener("resize", onDismiss);
					document.addEventListener("scroll", onDismiss, true);
					return () => {
						document.removeEventListener("pointerdown", onPointerDown, true);
						document.removeEventListener("keydown", onKey);
						window.removeEventListener("resize", onDismiss);
						document.removeEventListener("scroll", onDismiss, true);
					};
				}, [menu]);
				react.useLayoutEffect(() => {
					if (!rename) return;
					renameInputRef.current?.focus();
					renameInputRef.current?.select();
				}, [rename]);
				const notify = (text, undo) => {
					setSnack({
						text,
						undo
					});
					window.clearTimeout(snackTimerRef.current);
					snackTimerRef.current = window.setTimeout(() => setSnack(null), 5200);
				};
				const messageOf = (error) => {
					if (error instanceof Error) return error.message;
					if (typeof error === "string") return error;
					return "未知错误";
				};
				const toggleMenu = (row, anchor, viaKeyboard = false) => {
					setMenu((current) => current && current.rowId === row.id && current.kind === "menu" ? null : {
						rowId: row.id,
						anchor,
						kind: "menu",
						viaKeyboard
					});
				};
				const doArchive = async (row, anchor, stopActivity) => {
					setMenu(null);
					const api = workspacesApi;
					if (!api?.archiveSession) {
						notify("当前宿主不支持归档");
						return;
					}
					try {
						await api.archiveSession(row.id, stopActivity ? { stopActivity: true } : void 0);
						notify("会话已归档");
					} catch (error) {
						const code = error.rpcError?.code ?? error.code;
						if (!stopActivity && code === "workspace/session-active") {
							setMenu({
								rowId: row.id,
								anchor,
								kind: "confirm",
								viaKeyboard: false
							});
							return;
						}
						notify(`归档失败：${messageOf(error)}`);
					}
				};
				const archiveRow = (row, anchor) => {
					if (row.running) {
						setMenu({
							rowId: row.id,
							anchor,
							kind: "confirm",
							viaKeyboard: false
						});
						return;
					}
					doArchive(row, anchor, false);
				};
				const restoreRow = async (row) => {
					const api = workspacesApi;
					if (!api?.unarchiveSession) {
						notify("当前宿主不支持恢复归档");
						return;
					}
					try {
						await api.unarchiveSession(row.id);
						notify("已恢复会话");
						if (rows.getArchived().length === 0) setView("recent");
					} catch (error) {
						notify(`恢复失败：${messageOf(error)}`);
					}
				};
				const togglePin = async (row) => {
					setMenu(null);
					const api = workspacesApi;
					const action = row.pinned ? api?.unpinSession : api?.pinSession;
					if (!action) {
						notify("当前宿主不支持置顶");
						return;
					}
					try {
						await action(row.id);
						notify(row.pinned ? "已取消置顶" : "已置顶");
					} catch (error) {
						notify(`置顶失败：${messageOf(error)}`);
					}
				};
				const forkRow = async (row) => {
					setMenu(null);
					const api = sessionsApi;
					if (!api?.fork) {
						notify("当前宿主不支持分叉");
						return;
					}
					try {
						const result = await api.fork({
							sessionId: row.id,
							increaseTitle: true
						});
						if (result && typeof result === "object" && "ok" in result && result.ok === false) {
							notify("分叉失败，请稍后重试");
							return;
						}
						notify(`已分叉「${row.title}」`);
					} catch (error) {
						notify(`分叉失败：${messageOf(error)}`);
					}
				};
				const copyId = async (row) => {
					setMenu(null);
					try {
						await navigator.clipboard.writeText(row.id);
						notify("Session ID 已复制");
					} catch {
						notify("复制失败，请重试");
					}
				};
				const removeRow = (row) => {
					setMenu(null);
					const next = new Set(removed);
					next.add(row.id);
					writeRemoved(next);
					setRemoved(next);
					notify(`已从最近会话列表移除「${row.title}」`, () => {
						const back = new Set(removed);
						back.delete(row.id);
						writeRemoved(back);
						setRemoved(back);
					});
				};
				const openRename = (row) => {
					setMenu(null);
					setRename({
						id: row.id,
						title: row.title
					});
				};
				const saveRename = async () => {
					if (!rename) return;
					const value = (renameInputRef.current?.value ?? "").trim();
					if (!value) {
						renameInputRef.current?.focus();
						return;
					}
					const api = sessionsApi;
					if (!api?.rename) {
						notify("当前宿主不支持重命名");
						return;
					}
					try {
						const result = await api.rename(rename.id, value);
						if (result && typeof result === "object" && "ok" in result && result.ok === false) {
							notify(`重命名失败：${result.error?.message ?? "未知错误"}`);
							return;
						}
						setRename(null);
						notify("已重命名会话");
					} catch (error) {
						notify(`重命名失败：${messageOf(error)}`);
					}
				};
				react.useLayoutEffect(() => {
					const float = floatRef.current;
					const label = triggerLabelRef.current;
					if (!float || !label) return;
					const left = label.getBoundingClientRect().left - float.getBoundingClientRect().left;
					if (Number.isFinite(left) && left > 0) float.style.setProperty("--dsh-rs-align", `${left.toFixed(1)}px`);
				}, [
					mounted,
					collapsed,
					geo?.width,
					height
				]);
				const currentHeight = Math.min(height ?? DEFAULT_HEIGHT, geo?.maxHeight ?? DEFAULT_HEIGHT);
				/** 这一趟滑动的时长（按高度算）—— 卡片过渡、裁切 keyframes、卸载等待共用同一个值 */
				const timing = slideTiming(currentHeight);
				liveHeightRef.current = currentHeight;
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
				react.useLayoutEffect(() => {
					if (narrow || collapsed || dragging) return;
					syncListBottomPadding(listRef.current);
				}, [
					narrow,
					collapsed,
					dragging,
					items.length,
					currentHeight
				]);
				react.useLayoutEffect(() => {
					const prev = cutPhaseRef.current;
					const shown = mounted && geo !== null;
					const justShown = shown && !prev.shown;
					const closed = !prev.leaving && leaving;
					cutPhaseRef.current = {
						shown,
						leaving
					};
					if (narrow || !mounted || !geo || !geo.hasRegion) {
						unmaskRegion();
						return;
					}
					const visible = window.innerHeight - geo.bottom - currentHeight - geo.regionTop;
					const timing = slideTiming(currentHeight);
					if (justShown) {
						setRegionCut(visible, true, false, timing);
						return;
					}
					if (closed) {
						setRegionCut(visible, true, true, timing);
						return;
					}
					if (leaving) return;
					if (collapsed) {
						setRegionCut(null, false, false, timing);
						return;
					}
					setRegionCut(visible, false, false, timing);
				}, [
					narrow,
					mounted,
					leaving,
					collapsed,
					dragging,
					geo,
					currentHeight
				]);
				/** 落高度：夹在 [下限, 本次上限] 内并持久化。 */
				const applyHeight = (next, max) => {
					const clamped = Math.round(Math.min(Math.max(next, MIN_HEIGHT), max));
					setHeight(clamped);
					writeHeight(clamped);
				};
				const onGripDown = (event) => {
					if (!geo) return;
					event.preventDefault();
					event.currentTarget.setPointerCapture(event.pointerId);
					const start = floatRef.current?.getBoundingClientRect().height ?? currentHeight;
					dragRef.current = {
						startY: event.clientY,
						startHeight: start,
						max: geo.maxHeight
					};
					setDragging(true);
				};
				const onGripMove = (event) => {
					const drag = dragRef.current;
					if (!drag) return;
					applyHeight(drag.startHeight + (drag.startY - event.clientY), drag.max);
				};
				const onGripEnd = (event) => {
					if (!dragRef.current) return;
					dragRef.current = null;
					setDragging(false);
					if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
				};
				/** 键盘等价操作：↑ 变高 / ↓ 变矮，Shift 加大步长。 */
				const onGripKey = (event) => {
					if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
					if (!geo) return;
					event.preventDefault();
					const step = event.shiftKey ? 96 : 24;
					applyHeight(currentHeight + (event.key === "ArrowUp" ? step : -step), geo.maxHeight);
				};
				/** 双击复位到默认高度（等于"我没拖过"）。 */
				const onGripReset = () => {
					setHeight(null);
					writeHeight(null);
				};
				const trigger = h("button", {
					ref: triggerRef,
					type: "button",
					className: "dsh-rs__trigger",
					"aria-expanded": collapsed ? "false" : "true",
					"aria-controls": "dsh-rs-float",
					"data-mode": view === "archive" ? "archive" : void 0,
					title: view === "archive" ? "返回最近会话" : collapsed ? "展开最近会话" : "收起最近会话",
					onClick: () => {
						if (view === "archive") {
							setView("recent");
							return;
						}
						setCollapsed((previous) => {
							writeCollapse(!previous);
							return !previous;
						});
					}
				}, h("svg", {
					className: "dsh-rs__caret",
					width: 11,
					height: 11,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 3,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true"
				}, h("path", { d: "m9 6 6 6-6 6" })), h("span", {
					ref: triggerLabelRef,
					className: "dsh-rs__label"
				}, view === "archive" ? "已归档" : "最近会话"), h("span", { className: "dsh-rs__count" }, String(view === "archive" ? archivedItems.length : visibleItems.length)));
				if (narrow) return null;
				const renderRecentRow = (row) => h("div", {
					key: row.id,
					className: "dsh-rs__row",
					role: "listitem",
					"data-session-id": row.id,
					"data-state": row.state,
					"data-menu": menu && menu.rowId === row.id ? "true" : void 0,
					"aria-current": row.current ? "true" : void 0
				}, h("button", {
					className: "dsh-rs__go",
					type: "button",
					title: row.title,
					onClick: () => openSession(ctx, row.id)
				}, statusIndicator(h, row.state, row.stateLabel), h("span", { className: "dsh-rs__main" }, h("span", { className: "dsh-rs__name" }, row.title), h("span", { className: "dsh-rs__meta" }, row.meta))), row.pinned ? h("span", {
					className: "dsh-rs__pin",
					title: "已置顶",
					"aria-label": "已置顶"
				}, sessionIcon(h, "pinFill", 14)) : null, h("span", { className: "dsh-rs__acts" }, h("button", {
					className: "dsh-rs__act",
					"data-act": "menu",
					type: "button",
					"aria-haspopup": "menu",
					"aria-expanded": menu?.rowId === row.id && menu.kind === "menu" ? "true" : "false",
					"aria-label": `会话「${row.title}」的操作`,
					title: "更多操作",
					onClick: (event) => {
						event.stopPropagation();
						toggleMenu(row, event.currentTarget, event.detail === 0);
					}
				}, sessionIcon(h, "ellipsis", 14)), h("button", {
					className: "dsh-rs__act",
					"data-act": "archive",
					type: "button",
					"aria-label": `归档「${row.title}」`,
					title: "归档会话",
					onClick: (event) => {
						event.stopPropagation();
						archiveRow(row, event.currentTarget);
					}
				}, sessionIcon(h, "archive", 14)), h("button", {
					className: "dsh-rs__act",
					"data-act": "remove",
					type: "button",
					"aria-label": `从最近会话列表移除「${row.title}」`,
					title: "从最近会话列表移除",
					onClick: (event) => {
						event.stopPropagation();
						removeRow(row);
					}
				}, sessionIcon(h, "close", 12))));
				const renderArchivedRow = (row) => h("div", {
					key: row.id,
					className: "dsh-rs__row",
					role: "listitem",
					"data-session-id": row.id
				}, h("span", { className: "dsh-rs__go" }, statusIndicator(h, row.state, row.stateLabel), h("span", { className: "dsh-rs__main" }, h("span", { className: "dsh-rs__name" }, row.title), h("span", { className: "dsh-rs__meta" }, row.meta))), h("button", {
					className: "dsh-rs__restore",
					type: "button",
					"aria-label": `恢复「${row.title}」`,
					onClick: () => {
						restoreRow(row);
					}
				}, sessionIcon(h, "restore", 12), h("span", null, "恢复")));
				const recentList = h("div", {
					className: "dsh-rs__list",
					role: "list",
					ref: listRef,
					"data-rail": railOpen ? "true" : void 0
				}, visibleItems.length === 0 ? h("div", { className: "dsh-rs__empty" }, "还没有历史会话") : h("div", { className: "dsh-rs__rows" }, visibleItems.map(renderRecentRow)));
				const archiveView = h(react.Fragment, null, h("div", {
					className: "dsh-rs__list",
					role: "list"
				}, archivedItems.length === 0 ? h("div", { className: "dsh-rs__empty" }, "还没有归档的会话") : archivedItems.map(renderArchivedRow)));
				const railElement = h("div", {
					className: "dsh-rs__railclip",
					hidden: archivedItems.length === 0 || view === "archive"
				}, h("button", {
					className: "dsh-rs__rail",
					type: "button",
					"data-revealed": railOpen ? "true" : "false",
					"aria-hidden": railOpen ? void 0 : "true",
					tabIndex: railOpen ? 0 : -1,
					"aria-label": "查看已归档会话",
					onClick: () => {
						setRailOpen(false);
						setView("archive");
					}
				}, sessionIcon(h, "archive", 13), h("span", { className: "dsh-rs__rail__label" }, "已归档 ", h("b", null, String(archivedItems.length))), sessionIcon(h, "chevron", 12)));
				const snackElement = h("div", {
					className: "dsh-rs__snack",
					"data-on": snack ? "true" : "false",
					role: "status",
					"aria-live": "polite"
				}, h("span", { className: "dsh-rs__snack__text" }, snack?.text ?? ""), snack?.undo ? h("button", {
					className: "dsh-rs__snack__undo",
					type: "button",
					onClick: () => {
						const undo = snack.undo;
						setSnack(null);
						undo?.();
					}
				}, "撤销") : null);
				const menuRow = menu ? visibleItems.find((row) => row.id === menu.rowId) ?? archivedItems.find((row) => row.id === menu.rowId) : void 0;
				const menuElement = menu && menuRow ? (0, react_dom.createPortal)(h("div", {
					ref: menuRef,
					className: "dsh-rs__menu",
					"data-kind": menu.kind,
					role: menu.kind === "confirm" ? "dialog" : "menu",
					"aria-label": menu.kind === "confirm" ? "停止并归档此会话" : "会话操作",
					tabIndex: -1
				}, ...menu.kind === "confirm" ? [
					h("div", {
						className: "dsh-rs__confirm-head",
						key: "head"
					}, sessionIcon(h, "alert", 16), h("span", null, "停止并归档此会话？")),
					h("p", {
						className: "dsh-rs__confirm-body",
						key: "body"
					}, "它仍有正在进行的工作。归档会先停止这些工作；之后可以在「已归档」里恢复。"),
					h("div", {
						className: "dsh-rs__menu-actions",
						key: "actions"
					}, h("button", {
						className: "dsh-rs__btn dsh-rs__btn--ghost",
						type: "button",
						onClick: () => setMenu(null)
					}, "取消"), h("button", {
						className: "dsh-rs__btn dsh-rs__btn--primary",
						type: "button",
						onClick: () => {
							doArchive(menuRow, menu.anchor, true);
						}
					}, "停止并归档"))
				] : [
					{
						act: "pin",
						icon: menuRow.pinned ? "pinFill" : "pin",
						label: menuRow.pinned ? "取消置顶" : "置顶会话",
						key: ""
					},
					{
						act: "rename",
						icon: "edit",
						label: "重命名",
						key: "⌥⌘G"
					},
					{
						act: "fork",
						icon: "branch",
						label: "分叉会话",
						key: "⌥⌘F"
					},
					{
						act: "archive",
						icon: "archive",
						label: "归档会话",
						key: "⇧⌘A"
					},
					{
						act: "copy",
						icon: "copy",
						label: "复制 Session ID",
						key: ""
					}
				].map((entry) => h("button", {
					key: entry.act,
					className: "dsh-rs__menu-item",
					type: "button",
					role: "menuitem",
					onClick: () => {
						if (!menuRow) return;
						switch (entry.act) {
							case "pin":
								togglePin(menuRow);
								break;
							case "rename":
								openRename(menuRow);
								break;
							case "fork":
								forkRow(menuRow);
								break;
							case "archive":
								archiveRow(menuRow, menu.anchor);
								break;
							case "copy": copyId(menuRow);
						}
					}
				}, h("span", { className: "dsh-rs__menu-icon" }, sessionIcon(h, entry.icon, 14)), h("span", { className: "dsh-rs__menu-label" }, entry.label), entry.key ? h("span", { className: "dsh-rs__menu-key" }, entry.key) : null))), document.body) : null;
				const renameElement = rename ? (0, react_dom.createPortal)(h("div", { className: "dsh-rs__modal" }, h("div", {
					className: "dsh-rs__modal-scrim",
					onClick: () => setRename(null)
				}), h("div", {
					className: "dsh-rs__modal-card",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "重命名会话"
				}, h("h2", { className: "dsh-rs__modal-title" }, "重命名会话"), h("input", {
					key: rename.id,
					ref: renameInputRef,
					className: "dsh-rs__input",
					defaultValue: rename.title,
					"aria-label": "会话名称",
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							saveRename();
						}
					}
				}), h("div", { className: "dsh-rs__modal-actions" }, h("button", {
					className: "dsh-rs__btn dsh-rs__btn--ghost",
					type: "button",
					onClick: () => setRename(null)
				}, "取消"), h("button", {
					className: "dsh-rs__btn dsh-rs__btn--primary",
					type: "button",
					onClick: () => {
						saveRename();
					}
				}, "保存")))), document.body) : null;
				const float = !mounted || !geo ? null : (0, react_dom.createPortal)(h("div", {
					className: "dsh-rs__float-clip",
					style: {
						left: `${Math.round(geo.left)}px`,
						width: `${Math.round(geo.width)}px`,
						bottom: `${Math.round(geo.bottom)}px`,
						height: `${Math.round(currentHeight + CLIP_HEADROOM)}px`,
						"--dsh-rs-slide-in": `${timing.inMs}ms`,
						"--dsh-rs-slide-out": `${timing.outMs}ms`
					}
				}, h("div", {
					id: "dsh-rs-float",
					ref: floatRef,
					className: "dsh-rs__float",
					"data-surface": geo.hasRegion ? "none" : "fill",
					"data-leaving": leaving ? "true" : "false",
					"data-arch": railOpen ? "true" : "false",
					role: "region",
					"aria-label": "最近会话",
					style: {
						height: `${Math.round(currentHeight)}px`,
						"--dsh-rs-rail": railOpen ? "34px" : "0px"
					}
				}, h("div", {
					className: "dsh-rs__grip",
					role: "separator",
					"aria-orientation": "horizontal",
					"aria-label": "上下拖动调整最近会话高度",
					"aria-valuemin": MIN_HEIGHT,
					"aria-valuenow": Math.round(currentHeight),
					tabIndex: 0,
					title: "上下拖动调整高度 · 双击复位",
					onPointerDown: onGripDown,
					onPointerMove: onGripMove,
					onPointerUp: onGripEnd,
					onPointerCancel: onGripEnd,
					onDoubleClick: onGripReset,
					onKeyDown: onGripKey
				}), view === "archive" ? archiveView : recentList, railElement, snackElement)), document.body);
				return h(react.Fragment, null, trigger, float, menuElement, renameElement);
			};
		}
		/**
		* 依赖的客户端服务。
		*
		* `slots` 是所有 UI 插件的硬依赖；`sessions`/`workspaces` 是会话与工作区快照的拥有者；
		* `uiSession` 是**状态**（运行中 / 等你回答 / 跑完未打开）的拥有者 —— 声明它，
		* apply 才会在它就绪之后跑，读状态源不会读到 undefined。
		*/
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"uiSession"
		];
		function apply(ctx) {
			const config = { ...DEFAULT_CONFIG };
			fetch(CONFIG_URL, { headers: { accept: "application/json" } }).then((res) => res.ok ? res.json() : null).then((json) => {
				if (!json || typeof json !== "object") return;
				Object.assign(config, json);
			}).catch(() => {});
			const Panel = createPanel(ctx, config);
			ctx.effect(() => ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-recent-sessions/panel",
				order: 10,
				registrant: "dsh-recent-sessions"
			}, Panel)), "dsh-recent-sessions: sidebar entry + float");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map