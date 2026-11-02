# 变更记录

本仓库（DSH 客户端插件）的版本记录。安装方式见 [README](README.md)：
`dsh plugin --profile <profile> add 'github:whiteguo233/dsh-openbiliclaw#<tag>'`。

## v0.6.4 (2026-11-01)

**主题：面板不再改写宿主网格（修 [#15](https://github.com/whiteguo233/dsh-openbiliclaw/issues/15)）**

- 面板挂载不再触碰 `grid-template-columns`。v0.6.3 及以前会追加第 4 轨、并把中心轨从 `minmax(400px, 1fr)` 重写成 `minmax(0px, 1fr)`，于是任何依赖「宿主三轨」的视图都会坏——ds-bot team view 的 `_centerCol` 被压成 0px（它的左栏是 `position: fixed` 自己画的，所以只剩中间区消失）。
- 新做法：给 frame 加 `padding-right` 预留面板条，面板列绝对定位在预留区里。同样是「挤开中间内容」而不是浮层覆盖，但宿主的三轨（含右栏打开时中心列的 400px 下限）原样保留，谁也不用跟一个没被改过的轨道数对齐。
- 面板宽度夹取改为扣掉「侧栏 + 右栏声明上限 + 宿主中心列下限」，不再只扣侧栏；空间不足时先让右栏按宿主自己的规则收缩，再不够才让面板降到 280px 以下（直至 0 收起），宁可面板变窄也不压在会话区上——中心列不再被牺牲。
- frame 被宿主重渲染替换时自动重挂（此前 `mount()` 只 attach 一次，换视图后会一直往已脱离文档的旧节点写）；卸载 / 重挂时把 frame 的 `padding-right`、`box-sizing`、`position` 恢复原值。定位只在 computed `position: static` 时才设为 `relative`，不抢其他插件的包含块。
- `findFrame()` 现在要求同级存在 `_centerCol`，第三方视图里的同名 `sidebarCol` 节点不会把面板骗走。
- 面板仍只覆盖内容行：绝对定位相对的是 padding box，所以把 frame 自身的 `padding-top`（Windows 标题栏留白）和 `shell.bottom` 底行高度重新算进列的 `top` / `bottom` 偏移，不会盖住别家插件塞进底行的内容，也不改变 Windows 下的垂直起点。
- 新增 `test/layout.test.mjs`（12 条，fake DOM）：断言「绝不写宿主 grid」「预留条与列宽一致」「关掉后样式复原」「frame 被替换后重挂」「static frame 变包含块」「padding-top / 底行偏移」，`npm test` 共 19 条通过。
- 新增 `screenshots.json`：插件市场详情页用的 5 张截图清单（指向 `docs/screenshots/`）。
- Chrome 实机对照（1478/1280/1160/1000/900 五个窗口宽度，脚本读 computed style）：中心列旧版 `338/140/20/0/0`，新版**全部为 400**（宿主自己的下限）；面板宽度新版 `318/280/280/280/220`，`grid-template-columns` 与宿主写入值逐字节相同、`轨道和 + 预留宽` 在五个宽度上都不超出 frame。1000px 就是 #15 的现场：旧版 `280px 0px 400px 320px`（中间 0），新版 `280px 400px 40px`。

## v0.6.3 (2026-10-26)

**运行时验证通过 + npm 包描述双语化**

- [dsh-plugin-verify](https://github.com/qing3a/dsh-plugin-verify) 在 DSH 0.2.1-rc.3（`22ddee37`）上跑通 mock-llm 完整 agent 循环：**waterfall 7/7、tools/result 是、捕获事件 13**；收录 PR：[#9](https://github.com/qing3a/dsh-plugin-verify/pull/9)。
- README 增加「运行时验证」章节（含复现命令与 native 模块的坑）。
- `package.json` 描述改为中英双语，便于 npm 与各插件目录抓取。

## v0.6.2 (2026-10-26)

**发布到 npm 的元数据版本（代码同 v0.6.1）**

- 补齐 npm 包元数据：`repository` / `homepage` / `bugs` / `keywords`（`dsh-plugin`、`deepseek-harness` 等），便于 npm 搜索与插件市场从包元数据同步。
- 包名 `@openbiliclaw/dsh-plugin`，需先创建 npm 组织 `openbiliclaw` 并 `npm login` 后 `npm publish --access public`。
- 构建可复现：CSS Modules 的类名哈希改为「仓库相对路径 + 内容」的 SHA-256 前缀（lightningcss 自带的 `[hash]` 每次进程随机），类名导出表按 key 排序。同样源码连续构建产物字节一致，之前每构建一次 `lib/client.js` 都会整文件变动。

## v0.6.1 (2026-10-26)

**修复：`save_local` 把 item_key 的平台前缀重复拼接**

- 端到端实测发现：把推荐卡里的 `item_key`（`bilibili:BV1...`）直接传给 `save_local` 时，bridge CLI 的 `--content-id` 会再拼一次平台前缀，落库成 `bilibili:bilibili:BV1...`，与卡片的身份对不上（后续去重、同步、面板匹配都会失准）。
- 现在 `save_local` 接受卡片 `item_key`（带平台前缀）、裸 content id 或 bvid：识别到已知平台前缀时自动拆分，`sourcePlatform` 未显式给出时从前缀推断；`twitter` 归一为 `x`。
- `remove_saved` 的 `itemKey` 文档明确为 `list_saved` 返回的完整 item_key。
- 新增 4 组归一化断言（含 `github:repository:<id>` 这种 content id 自带冒号的场景）。

## v0.6.0 (2026-10-26)

**主题：面板与工具共用同一条后端地址**

- 新增同源路由 `GET /openbiliclaw/connection`：node 半把解析后的 `apiUrl` 暴露给浏览器半，面板挂载前读取一次。
- 地址解析顺序统一为：面板「设置 → 通用 → 连接」里保存的值 → cordis 行 `apiUrl` → 内置默认 `http://127.0.0.1:8420`。后端不在 8420 时，面板不再显示「后端离线」。
- `webServer` 改为可选注入：headless 等没有 web 服务的 profile 不注册该路由，工具照常可用。
- 测试补到 6 条：路由 payload、`POST` 拒绝（405 + `Allow`）、headless 空操作。

## v0.5.0 (2026-10-26)

**主题：适配 DSH 0.2.1**

- 兼容声明收敛到 `engines.dsh: ^0.2.1-rc.2`（DSH 0.2 启动时会校验，不匹配的插件整包跳过），peer 全部升到 `0.2.1-rc.2`，`cordis ~4.0.5`、`schemastery ~3.18.5`，补上只引类型的 `dsh-skill` / `dsh-host-webserver`。
- 构建链改为自包含：`tsconfig` 从 `node_modules` 解析 DSH 类型，仓库自带 `tsdown.config.ts` 产出 `window.__ModuleLoader__` 闭包产物（只外置 React，CSS Modules 经 lightningcss 内联），不再依赖 DSH 源码 checkout。
- 修复 DSH 0.2 帧网格：壳层多了一条底部行，自动放置会把面板列塞到侧栏下方并抢走内容高度；现在列显式落在第 1 行、末列。
- 重新构建 `lib/`（旧产物与 `src/` 脱节：残留已删除的 `drawer.*`，`api`/`settings`/`views` 为旧版）。
- 新增 `test/abi.test.mjs`（`npm test`）+ `package-lock.json`。

## v0.4.0

- 适配 DSH 0.1.5 ABI（`bash` → `shell` 执行器、client 半拆分为 renderer/sidebar/theme/layout）。
