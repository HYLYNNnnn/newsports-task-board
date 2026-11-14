# Nextplay · Kanban Task Board

一个可以直接运行、便于继续修改的 assessment 初版。采用 React + TypeScript + Vite，使用 dnd-kit 拖拽，支持 Supabase 数据库与匿名登录。

## 现在的完成情况

- 四列看板：To Do / In Progress / In Review / Done。
- 鼠标拖拽换列；触屏长按拖拽；编辑界面中也可更改状态。
- 创建、编辑、删除任务，标题必填；支持描述、优先级、截止日期、成员分配和多标签。
- 本地访客工作区与浏览器存储；刷新后保留。首次进入自动加入 10 条示例任务。
- 标题及描述搜索，按优先级、成员、标签筛选，按日期或名称排序。
- 看板与列表视图、项目概览、任务统计和逾期提醒。
- 成员管理、评论、任务活动记录、JSON 导出。
- 自定义标签名称及颜色，编辑任务时可直接创建；一个任务最多 20 个标签，并可按自定义标签筛选。
- 活动时间线逐项记录标题、描述、状态、优先级、负责人、日期和标签修改；不重复记录未变化的保存。
- 逾期、今天、明天和未来 3 天的截止提醒；已完成任务不计入逾期。
- 评论按时间先后排列，并显示完整日期时间；活动同时显示相对时间和完整时间。
- 高对比彩色界面：浅色导航、醒目主操作、蓝/橙/紫/绿四个状态列，以及更清晰的标题和紧急程度。
- 单击卡片在原位展开完整描述、信息、评论和活动；再次单击或点击 Collapse details 收起。
- 双击卡片或点击右上角铅笔进入编辑。已有评论时显示独立评论图标，点击只打开评论面板，可继续评论并实时更新数量。
- 列表视图中，单击打开只读概览，双击或铅笔按钮进入编辑；弹窗会暂时隔离背景输入，避免误操作。
- 拖拽反馈包含卡片抬起与倾斜、原位占位、目标列高亮、落下回弹及完成反馈；支持取消，并遵循系统减少动态效果设置。
- 加载、空状态、保存状态及错误反馈，响应式布局、弹窗焦点管理。
- Supabase 已配置，用户已确认云端功能可用；自动化云端测试脚本尚未运行。

**尚未完成 assessment 的全部提交要求。** 后续还需要发布 GitHub 仓库、部署在线演示，并填写最终提交材料中的真实链接。本地 Git 仓库已初始化。

## 本地运行

需要 Node.js 22.12+ 和 pnpm（或 npm）。

```bash
pnpm install
pnpm dev
```

打开 http://127.0.0.1:5173 。第一次运行不用配置任何账号或密钥。

若已启动，不要重复启动同一端口。停止服务时在运行服务的终端按 `Ctrl+C`。

当前电脑未将 Node / pnpm 加入系统 PATH，项目提供 `./start.command`，可以直接双击或执行：

```bash
./start.command
```

它优先使用系统 Node / pnpm；没有时使用本机现有的 Codex 运行环境。其他电脑按照上面的标准方式运行即可。

```bash
pnpm build     # TypeScript 检查与生产构建，产物在 dist/
pnpm preview   # 在 http://127.0.0.1:4173 预览生产构建
pnpm test      # 先检查数据适配器和本地 PostgreSQL，再运行浏览器回归测试
pnpm test:repository # 默认标签初始化：重复、大小写、并发及失败重试
pnpm test:db   # PGlite 本地 PostgreSQL：迁移、标签、RLS、触发器与删除级联
pnpm test:e2e  # 浏览器测试，使用本机 Chrome
```

## 后续接入 Supabase

1. 新建免费的 Supabase 项目。
2. 在 SQL Editor 中运行 `supabase/schema.sql` 完整文件。
3. 在 Authentication → Sign In / Providers 中开启 Anonymous Sign-Ins（匿名登录）。不同版本的控制台名称可能略有差别。
4. 复制 `.env.example` 为 `.env`，填写项目 URL 和 **publishable/anon 公钥**：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

5. 重启开发服务。右上角会由 `Local demo` 变为 `Cloud workspace`。
6. 云端首次创建的账号使用空白看板，本地示例数据不会自动上传。添加任务验证后，在另一个无痕窗口打开页面，确认两个账号的数据相互隔离。

**如果之前已运行旧版 SQL**：运行 `supabase/migrations/20261112_advanced_features.sql` 升级。它保留任务、成员、评论和原有活动，新增标签表及详细活动触发器。首次接入的新项目只需运行完整的 `supabase/schema.sql`。

匿名用户使用 `authenticated` 数据库角色。所有表都启用 RLS，以 `auth.uid() = user_id` 限制访问；评论和成员分配通过复合外键防止引用其他用户的记录。活动记录由数据库触发器生成，客户端只读。前端只使用公钥，不能使用 service_role/secret 密钥。

配置后可额外运行 `pnpm test:cloud`。它创建两个测试访客，验证任务及标签隔离、跨用户评论与成员引用限制以及删除级联；清理测试任务，但保留 Supabase 匿名 auth 用户及其测试标签。**用户已确认功能验收通过，尚未运行此自动化云端脚本。** 本地 PostgreSQL 测试使用模拟的 `auth.uid()`，不能代替真实 Supabase 匿名登录和网络验证。`pnpm test:e2e` 使用本地示例数据，应在未配置云端的独立开发服务上运行。

如果曾出现 `labels_owner_name_ci_idx` 重复错误，更新前端后刷新即可。初始化会保留已有标签的名称与颜色，仅补齐缺少的默认标签；兼容大小写差异和同时加载，无需删除标签或重建数据库。

没有配置时才启用本地模式。配置不完整、登录失败或数据库错误会显示明确提示，不会静默切换到本地、掩盖云端错误。

Supabase 官方参考：[Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)、[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 文件组织

```text
src/
  App.tsx                   页面、过滤和操作协调
  components/Board.tsx      看板、拖拽、卡片及列表
  components/TaskDialog.tsx  新建与编辑任务
  components/TaskDetails.tsx 原位展开、只读概览与独立评论面板
  components/TaskDiscussion.tsx  复用的评论及活动时间线
  components/Labels.tsx      标签管理、颜色及详情内创建
  components/Modal.tsx       通用弹窗及键盘焦点管理
  lib/repository.ts         本地存储与 Supabase 数据适配器
  lib/seed.ts               本地示例数据
  lib/utils.ts              日期与显示工具
  types.ts                  共享类型
  styles.css                界面和响应式样式
  theme.css                 彩色主题、视觉层级及拖拽动效（修改颜色可从这里开始）
supabase/schema.sql         表结构、约束、索引、RLS、触发器
supabase/migrations/        旧数据库的增量升级
tests/                      本地 PostgreSQL、浏览器与云端测试
docs/submission-draft.md     最终说明文档的可修改草稿
```

## 部署与提交

前端是静态构建，可用免费的 Vercel、Netlify 或 Cloudflare Pages。构建命令 `pnpm build`，发布目录 `dist`。在托管平台中设置同名的两项 Supabase 环境变量，然后重新构建。最终部署地址需要配置进 Supabase 的 URL 设置（如启用验证码，也需配置相应域名）。

本文件夹中的 assessment 原 PDF 不得上传或公开分享，`.gitignore` 已排除 PDF/Word、环境配置及本地依赖。不要将评估材料纳入 GitHub。最终代码仓库和演示分享遵循题目要求。

`docs/submission-draft.md` 提供后续提交的内容草稿。填写姓名、GitHub 和在线地址后，再导出为题目要求的 PDF/DOCX。

## 当前取舍

- 本地存储按浏览器配置文件隔离，仅用于演示，不能替代 Supabase/RLS。清除站点存储会删除本地数据；可先导出 JSON 留档。
- 团队成员是当前访客的分配对象，不是真实邀请或协作账号。
- 支持创建自定义标签及选择颜色；暂不提供标签改名和删除，以保留历史引用。
- 支持跨列拖拽；列内按选定规则排序，尚未实现手动位置排序。
- 数据在加载、保存、拖拽落下或手动刷新时同步；不包含多人实时订阅及冲突合并。
- 匿名云账号与当前浏览器会话绑定；清空存储或换设备后无法恢复原访客账号。

字体 DM Sans / Manrope 已保存在 `public/fonts` 中，运行时不需要连接 Google Fonts。对应的开源许可证也保存在该目录。
