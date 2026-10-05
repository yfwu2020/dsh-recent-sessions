import z from '@deepseek-ai/schemastery';
export const name = '@yfwu2020/dsh-recent-sessions';
/** 只依赖 webServer：面板的全部数据来自浏览器端已有的客户端服务。 */
export const inject = ['webServer'];
/** 路由前缀。 */
const API = '/dsh-recent-sessions/api';
export const Config = z.object({
    maxItems: z.natural().min(3).max(50).default(12),
    showWorkspace: z.boolean().default(true),
    defaultCollapsed: z.boolean().default(true),
    refreshMs: z.natural().min(5000).max(600000).default(30000),
});
export function apply(ctx, config) {
    const webServer = ctx.get('webServer');
    // 挂 ctx.effect：热重载 / 卸载时路由随 fiber 自动摘掉，不留孤儿路由。
    ctx.effect(() => webServer.register({
        kind: 'exact',
        path: `${API}/config`,
        handler: (_req, res) => {
            const body = JSON.stringify({
                maxItems: config.maxItems,
                showWorkspace: config.showWorkspace,
                defaultCollapsed: config.defaultCollapsed,
                refreshMs: config.refreshMs,
            });
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            res.end(body);
        },
    }), 'dsh-recent-sessions: config route');
    ctx.logger?.info?.('[dsh-recent-sessions] 面板配置就绪：' + API + '/config');
}
//# sourceMappingURL=index.js.map