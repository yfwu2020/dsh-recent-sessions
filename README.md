# 最近会话 · 侧栏浮层

**一条入口行，随时回到刚才的会话。**

这是 DeepSeek Harness 的侧栏插件。工作区列表下方多出一行「最近会话」，点开是一张浮在工作区列表上方的卡片：按最后活动时间列出最近的会话，点一行直接切过去；再点入口行或按 `Esc` 收起。

[下载安装包](https://github.com/yfwu2020/dsh-recent-sessions/releases/latest) · [报告问题](https://github.com/yfwu2020/dsh-recent-sessions/issues) · [更新记录](#更新记录)

![最近会话浮层：侧栏底部的入口行展开后，会话列表浮在工作区上方](https://raw.githubusercontent.com/yfwu2020/dsh-recent-sessions/main/docs/images/floating-panel.png)

> 配图是插件界面本身（样式取自插件构建产物），会话与工作区为演示数据。

## 它能做什么

- **一行入口**：`最近会话 7` 落在工作区列表下方、设置上方，和侧栏其他行同一款式 —— 看上去就是侧栏多了一行。
- **浮层不抢眼**：卡片不画自己的底色，直接用侧栏自己的背景，展开后仍然像侧栏的一部分，不像多出来一个窗口。
- **点一行切过去**：走官方导航，当前会话整行高亮；正在运行的会话标题前有一枚呼吸点。
- **每行带状态**：等待批准、等待计划确认、等待回答、跑完未读 —— 一眼看出哪个会话在等自己。
- **高度可调**：往上拖卡片顶边改高度，双击复位；上限是工作区列表的高度，不会盖住上方内容。
- **滚动不切字**：滚动停下后自动对齐到整行，列表顶部不会停在一行字的中间。
- **不打扰**：点卡片外面不会收起，连续切几个会话不会被打断；`Esc` 或再点入口行才收起。
- **侧栏收起就消失**：侧栏收成细轨道时，入口行和浮层一起隐藏 —— 不留圆点、不占位。

## 怎么用

1. 看向左侧栏底部，在「设置」上方找到 **`最近会话`** 这一行，右侧数字是列表里的条数。
2. 点这一行，列表从它上方浮出来，盖住工作区列表。
3. 点其中一行切换会话；浮层会保持展开，方便连着切几个。
4. 再点这一行、或按 `Esc` 收起。想调高度就拖浮层的顶边，双击顶边复位。

## 安装

在 Harness 左侧的 **插件** 页面点 **添加插件**，填写下面任一个地址：

```text
github:yfwu2020/dsh-recent-sessions

# 或固定版本
github:yfwu2020/dsh-recent-sessions#v0.2.0

# 或直接给安装包地址（从 Releases 下载）
https://github.com/yfwu2020/dsh-recent-sessions/releases/download/v0.2.0/yfwu2020-dsh-recent-sessions-0.2.0.tgz
```

也可以用 npm 包名：

```text
@yfwu2020/dsh-recent-sessions
```

安装后在已安装列表里打开 **`@yfwu2020/dsh-recent-sessions`** 的开关。仓库和安装包都带有构建好的插件文件，不需要自行编译。如果直链打不开，可以从 [Releases](https://github.com/yfwu2020/dsh-recent-sessions/releases/latest) 下载 `.tgz`，解压后在「添加插件」里填写包含 `package.json` 的目录绝对路径。

## 配置

在 profile 的 `cordis.patch.yml` 里，找到 `id: recent-sessions` 那一行改配置：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `maxItems` | `12` | 列表最多显示几条（3–50） |
| `showWorkspace` | `true` | 每行第二行是否显示所属工作区名 |
| `defaultCollapsed` | `true` | 打开 Harness 时浮层是否处于收起状态 |
| `refreshMs` | `30000` | 相对时间文案的刷新间隔（毫秒） |

折叠状态与高度会记在本机，不需要每次重设。

## 兼容范围

在 **macOS Desktop** 上验证。插件挂在 Harness 侧栏的官方扩展点上，需要宿主提供：

- 侧栏页脚的操作席位 `sidebar.footer.action`（入口行）
- 侧栏的工作区浏览区与侧栏列（浮层定位和裁切要用）

宿主改掉侧栏结构时，浮层会自动退回"自带底色"的兜底形态，入口行照常可用。

## 开发

```sh
npm install
bash scripts/build.sh   # host tsc → lib/ + client tsdown → lib/client.js
```

改动客户端代码后需要刷新一次 Harness 窗口才会加载新的 `lib/client.js`。
仓库里提交了构建产物，所以从 GitHub 安装的用户不需要自己编译。

## 更新记录

### 0.2.0

- 侧栏底部的入口行改成浮层：卡片浮在工作区上方，不再从工作区借高度。
- 卡片融入侧栏背景；展开与收起都是整卡滑出 / 滑回，工作区列表被卡片边缘逐条让开。
- 滚动停下后自动对齐到整行；列表底部留白按高度换算，最后一行始终完整可见。
- 每行增加状态标识：运行中、等待批准、等待计划确认、等待回答、跑完未读。
- 侧栏收成细轨道时，入口行与浮层一起隐藏。

## 许可

MIT
