# 全局文件搜索（Global File Search）

在 fly-island 中集成的 Everything 风格本地文件搜索。按 `Ctrl+Shift+G` 或从托盘菜单
「Search Files」唤出：岛屿展开并切到搜索页（与剪贴板历史同级）；若岛屿窗口不可用
则回退打开独立搜索窗口。输入即搜。

## 功能

- **即时搜索**：后台维护内存索引，输入关键词后防抖 140ms 查询，按相关度排序返回。
- **多关键词**：空格分隔的多个词按 AND 匹配（如 `report 2026` 同时满足两个词）。
- **过滤语法**：
  - `ext:rs` 或 `ext:rs,toml` — 按扩展名过滤。
  - `path:work` — 按所在文件夹路径过滤。
  - 普通词按文件名大小写不敏感子串匹配。
- **文件操作**：双击/回车打开文件，`在文件夹中显示` 在资源管理器中定位，`复制路径`
  把完整路径写入剪贴板。所有操作仅接受索引中存在的路径，避免任意路径执行。
- **索引状态**：窗口显示索引条目数或构建进度，可手动「重新索引」。
- **多语言**：中英文文案齐全，跟随岛屿语言设置。

## 实现结构

| 位置 | 职责 |
|---|---|
| `src-tauri/src/file_search/model.rs` | 索引条目、缓存序列化、纯搜索匹配与评分（可单测） |
| `src-tauri/src/file_search/indexer.rs` | 多线程后台遍历固定盘符，跳过 junction / 系统目录防循环 |
| `src-tauri/src/file_search/skip.rs` | 目录跳过规则（卷根系统目录 vs 任意层级开发缓存，纯逻辑可单测） |
| `src-tauri/src/file_search/service.rs` | 全局状态、缓存生命周期、进度事件、可取消重建 |
| `src-tauri/src/file_search/hotkey.rs` | `Ctrl+Shift+G` 全局热键注册 |
| `src-tauri/src/file_search/mod.rs` | Tauri 命令薄层 |
| `src-tauri/src/search_window/mod.rs` | 按需创建、居中显示搜索窗口 |
| `src-tauri/src/win32/drives.rs` | 安全枚举固定盘符 |
| `src/features/file-search/` | 前端 API 封装、hook、面板与结果行 |
| `src/windows/search/` | 搜索窗口外壳（标题栏、拖拽、缩放） |

命令（对外契约）：`search_files`、`get_file_search_status`、
`rebuild_file_search_index`、`open_search_result`、`reveal_search_result`、
`copy_search_result_path`、`open_search_window`、`close_search_window`。
事件：`file-search-index-status`、`file-search-shortcut-error`、
`file-search-open-island`（热键/托盘请岛屿切到搜索页）。
窗口 label：`search`（独立窗口，回退用）。快捷键：`Ctrl+Shift+G`。

## 岛屿集成

- 搜索是岛屿的一个内置页面（`PageDot::search` / `BuiltinPage::search`），头部有独立
  入口点；`设置 → 功能模块 → 全局文件搜索` 可整体开关（`searchEnabled`）。
- 热键与托盘通过 `file-search-open-island` 事件让已运行的岛屿切页，不再另开窗口；
  页面记忆、展开高度（搜索页 520px）与中英文案均已接入。
- 内存紧凑化：索引条目只存原始路径（`Box<str>` + 名称/扩展名偏移），匹配时做
  逐字节 ASCII 大小写不敏感比较，不再为 166 万条路径各存一份小写副本。
  实测稳态内存约 380MB（优化前约 800MB）。

## 与 Everything 的差异（设计权衡）

Everything 直读 NTFS 的 `$MFT`，需管理员权限且实现复杂。本实现是普通权限常驻应用，
采用「递归扫描 + JSON 缓存 + 后台重建」：

- 首次启动全盘扫描（多线程按目录分配任务），条目数取决于磁盘；缓存在应用数据目录
  `file-search-index.json`，下次启动先加载缓存立即可用，再后台刷新。实测 166 万条目
  重建约 5 分钟。
- 跳过规则分两类（见 `file_search/skip.rs`）：
  - 只在**卷根**跳过系统目录：`C:\Windows`、`C:\ProgramData`、`C:\Recovery`、
    `$Recycle.Bin`、`System Volume Information` 等。用户目录里同名文件夹（例如
    `C:\Users\me\Projects\Windows`）**不跳过**，否则其中的文件会从结果里消失。
  - **任意层级**跳过开发缓存：`node_modules`、`.git`、`$Windows.~WS`、`$Windows.~BT`。
  - 所有符号链接/junction 一律不跟随，避免目录循环与重复卷。
- 只索引固定磁盘，不含 U 盘、网络驱动器。
- 后续可演进为 NTFS USN Journal 增量更新以接近 Everything 的实时性。

## 验证

- 前端：`pnpm check`（类型 + lint + 行数 + 单测）、`pnpm build` 均通过；
  新增单测 `tests/unit/file-search.test.mjs` 覆盖格式化与高亮逻辑。
- Rust：`cargo test --manifest-path src-tauri/Cargo.toml` 与
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` 见交付说明。
