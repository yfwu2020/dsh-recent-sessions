/**
 * @yfwu2020/dsh-recent-sessions —— host 半。
 *
 * 职责极小：把面板的配置以只读 JSON 暴露给浏览器端。会话数据本身**不经过这里**
 * —— 浏览器端直接读客户端的 session / workspace 快照（与官方侧栏同一份事实），
 * 所以这个插件不新增任何会话存储、也不做任何 Host 侧投影。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = '@yfwu2020/dsh-recent-sessions'

/** 只依赖 webServer：面板的全部数据来自浏览器端已有的客户端服务。 */
export const inject = ['webServer']

/** 路由前缀。 */
const API = '/dsh-recent-sessions/api'

export interface Config {
  /** 面板最多列多少条最近会话。 */
  maxItems: number
  /** 每行第二行是否显示所属工作区名。 */
  showWorkspace: boolean
  /** 浮层初始是否收起（默认 true：浮层盖在工作区列表上，一进来就摊开会挡路）。 */
  defaultCollapsed: boolean
  /** 相对时间文案刷新间隔（毫秒）。 */
  refreshMs: number
}

export const Config = z.object({
  maxItems: z.natural().min(3).max(50).default(12),
  showWorkspace: z.boolean().default(true),
  defaultCollapsed: z.boolean().default(true),
  refreshMs: z.natural().min(5000).max(600000).default(30000),
})

/**
 * 路由表服务。
 *
 * 这里刻意**不 import** `@deepseek-ai/dsh-host-webserver` 的类型：npm 上那个包
 * 在 0.1.x 还叫 `httpServer`、0.2.x 才改名 `webServer`，而类型只用于编译期。
 * 结构化声明让本插件在两个版本下都编译得过，且始终认运行时的 `webServer`。
 */
interface WebServerLike {
  register: (route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void
  }) => () => void
}

export function apply(ctx: Context, config: Config): void {
  const webServer = ctx.get('webServer') as unknown as WebServerLike

  // 挂 ctx.effect：热重载 / 卸载时路由随 fiber 自动摘掉，不留孤儿路由。
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: `${API}/config`,
    handler: (_req: IncomingMessage, res: ServerResponse) => {
      const body = JSON.stringify({
        maxItems: config.maxItems,
        showWorkspace: config.showWorkspace,
        defaultCollapsed: config.defaultCollapsed,
        refreshMs: config.refreshMs,
      })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(body)
    },
  }), 'dsh-recent-sessions: config route')

  ctx.logger?.info?.('[dsh-recent-sessions] 面板配置就绪：' + API + '/config')
}
