import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "@yfwu2020/dsh-recent-sessions";
/** 只依赖 webServer：面板的全部数据来自浏览器端已有的客户端服务。 */
export declare const inject: string[];
export interface Config {
    /** 面板最多列多少条最近会话。 */
    maxItems: number;
    /** 每行第二行是否显示所属工作区名。 */
    showWorkspace: boolean;
    /** 浮层初始是否收起（默认 true：浮层盖在工作区列表上，一进来就摊开会挡路）。 */
    defaultCollapsed: boolean;
    /** 相对时间文案刷新间隔（毫秒）。 */
    refreshMs: number;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    maxItems: z<number, number, "defined">;
    showWorkspace: z<boolean, boolean, "defined">;
    defaultCollapsed: z<boolean, boolean, "defined">;
    refreshMs: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    maxItems: z<number, number, "defined">;
    showWorkspace: z<boolean, boolean, "defined">;
    defaultCollapsed: z<boolean, boolean, "defined">;
    refreshMs: z<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config: Config): void;
