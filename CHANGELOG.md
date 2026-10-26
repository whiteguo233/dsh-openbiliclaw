# 变更记录

本仓库（DSH 客户端插件）的版本记录。安装方式见 [README](README.md)：
`dsh plugin --profile <profile> add 'github:whiteguo233/dsh-openbiliclaw#<tag>'`。

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
