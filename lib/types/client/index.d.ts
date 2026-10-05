/** 客户端 cordis 上下文：只用到官方客户端服务。 */
interface SlotsLike {
    inject: (name: string, factory: () => unknown) => () => void;
    register: (entry: {
        name: string;
        id: string;
        order?: number;
        registrant?: string;
    }, component: unknown) => unknown;
}
interface ClientContext {
    slots: SlotsLike;
    effect: (fn: () => unknown, label?: string) => unknown;
    get?: (name: string, strict?: boolean) => unknown;
    logger?: {
        info?: (...args: unknown[]) => void;
        warn?: (...args: unknown[]) => void;
    };
}
/**
 * 依赖的客户端服务。
 *
 * `slots` 是所有 UI 插件的硬依赖；`sessions`/`workspaces` 是会话与工作区快照的拥有者；
 * `uiSession` 是**状态**（运行中 / 等你回答 / 跑完未打开）的拥有者 —— 声明它，
 * apply 才会在它就绪之后跑，读状态源不会读到 undefined。
 */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
