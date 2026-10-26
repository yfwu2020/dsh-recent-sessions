/**
 * @yfwu2020/dsh-recent-sessions —— host 半。
 *
 * 职责极小：把面板的配置以只读 JSON 暴露给浏览器端。会话数据本身**不经过这里**
 * —— 浏览器端直接读客户端的 session / workspace 快照（与官方侧栏同一份事实），
 * 所以这个插件不新增任何会话存储、也不做任何 Host 侧投影。
 */
import { promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, sep } from 'node:path';
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
/** 会话 id 会直接作为目录名（JSONL 后端对安全字符不做转义）。 */
const SESSION_ID = /^[A-Za-z0-9._-]{1,200}$/;
/** 一次最多处理多少个会话，避免误传大数组。 */
const MAX_DELETE = 200;
/** 会话根目录：与 JSONL 持久化默认值一致，尊重 DSH_HOME。 */
function sessionsRoot() {
    const home = process.env.DSH_HOME?.trim();
    return join(home && home.length > 0 ? home : join(homedir(), '.dsh'), 'sessions');
}
/** 在 sessions/<project>/<id> 里找到这个会话目录，并做根目录边界校验。 */
async function findSessionDir(id) {
    if (!SESSION_ID.test(id))
        return undefined;
    const root = sessionsRoot();
    let rootReal;
    try {
        rootReal = await fsp.realpath(root);
    }
    catch {
        return undefined;
    }
    let projects;
    try {
        projects = await fsp.readdir(root, { withFileTypes: true });
    }
    catch {
        return undefined;
    }
    for (const project of projects) {
        if (!project.isDirectory())
            continue;
        const dir = join(root, project.name, id);
        let stat;
        try {
            stat = await fsp.lstat(dir);
        }
        catch {
            continue;
        }
        if (!stat.isDirectory())
            continue;
        let real;
        try {
            real = await fsp.realpath(dir);
        }
        catch {
            continue;
        }
        if (!real.startsWith(rootReal + sep) || basename(real) !== id)
            continue;
        return real;
    }
    return undefined;
}
/** 会话目录的磁盘占用（通常只有 .zstd 日志和 0 字节 lock）。 */
async function directoryBytes(dir) {
    let total = 0;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            total += await directoryBytes(path);
        else if (entry.isFile())
            total += (await fsp.stat(path)).size;
    }
    return total;
}
function sendJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
}
/** 读取 JSON body（上限 1 MiB）。 */
async function readJsonBody(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buf.length;
        if (size > 1024 * 1024)
            throw new Error('request body too large');
        chunks.push(buf);
    }
    if (chunks.length === 0)
        return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function parseIds(body) {
    if (typeof body !== 'object' || body === null)
        throw new Error('invalid body');
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0)
        throw new Error('ids is required');
    if (ids.length > MAX_DELETE)
        throw new Error(`too many ids (max ${MAX_DELETE})`);
    const unique = [];
    for (const id of ids) {
        if (typeof id !== 'string' || !SESSION_ID.test(id))
            throw new Error('invalid session id');
        if (!unique.includes(id))
            unique.push(id);
    }
    return unique;
}
/** 宿主进程里如果还有这个会话的实例，就不要删它的磁盘目录。 */
function isLiveSession(ctx, id) {
    try {
        const sessions = ctx.get?.('sessions', false);
        return sessions?.get?.(id) !== undefined;
    }
    catch {
        return false;
    }
}
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
    // 已归档会话：查询大小 / 删除日志目录（附件库不动）。
    ctx.effect(() => webServer.register({
        kind: 'exact',
        path: `${API}/sessions/inspect`,
        handler: (req, res) => {
            void (async () => {
                try {
                    const body = await readJsonBody(req);
                    const ids = parseIds(body);
                    const sessions = [];
                    let totalBytes = 0;
                    for (const id of ids) {
                        const dir = await findSessionDir(id);
                        if (dir === undefined) {
                            sessions.push({ id, error: 'not-found' });
                            continue;
                        }
                        try {
                            const bytes = await directoryBytes(dir);
                            totalBytes += bytes;
                            sessions.push({ id, bytes });
                        }
                        catch (error) {
                            sessions.push({ id, error: error instanceof Error ? error.message : 'unreadable' });
                        }
                    }
                    sendJson(res, 200, { sessions, totalBytes });
                }
                catch (error) {
                    sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid request' });
                }
            })();
        },
    }), 'dsh-recent-sessions: session inspect route');
    ctx.effect(() => webServer.register({
        kind: 'exact',
        path: `${API}/sessions/delete`,
        handler: (req, res) => {
            void (async () => {
                try {
                    const body = await readJsonBody(req);
                    const ids = parseIds(body);
                    const deleted = [];
                    const failed = [];
                    for (const id of ids) {
                        if (isLiveSession(ctx, id)) {
                            failed.push({ id, error: 'in-use' });
                            continue;
                        }
                        const dir = await findSessionDir(id);
                        if (dir === undefined) {
                            failed.push({ id, error: 'not-found' });
                            continue;
                        }
                        try {
                            const bytes = await directoryBytes(dir);
                            await fsp.rm(dir, { recursive: true, force: false });
                            deleted.push({ id, bytes });
                        }
                        catch (error) {
                            failed.push({ id, error: error instanceof Error ? error.message : 'delete failed' });
                        }
                    }
                    sendJson(res, 200, {
                        deleted,
                        failed,
                        totalBytes: deleted.reduce((sum, entry) => sum + entry.bytes, 0),
                    });
                    ctx.logger?.info?.(`[dsh-recent-sessions] 删除会话 ${deleted.length} 个，失败 ${failed.length} 个`);
                }
                catch (error) {
                    sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid request' });
                }
            })();
        },
    }), 'dsh-recent-sessions: session delete route');
    ctx.logger?.info?.('[dsh-recent-sessions] 面板配置就绪：' + API + '/config');
}
//# sourceMappingURL=index.js.map