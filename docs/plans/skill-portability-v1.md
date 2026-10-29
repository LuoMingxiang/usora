# Usora Skill Portability v1 — Codex 自主实施计划

> 状态：阶段 1–5 完成；阶段 6 本地验收通过（133 测试），真实宿主加载通过、模型任务被网络 403 阻塞；阶段 7 交付进行中。
> 基线：`master`；工作分支：`feat/skill-portability-v1`。
> 目标：在不破坏 Foundry 现有生命周期的前提下，交付可校验、可独立安装、可移植的 Agent Skills 导出能力。
> 原则：仅实现通用 Agent Skills 规范下的校验、目录导出和 ZIP 分发；不开发赛事、特定厂商或市场上传适配。

## 0. Codex 自主执行协议

- 从本分支开始工作，先核实 `git status`、HEAD、主分支差异；不得覆盖用户未提交的修改。若发现计划与源码冲突，以实际源码为准，并回写原因。
- **无需逐阶段询问用户**。自主完成扫描、设计、实现、测试、修复、复测、文档、提交和 PR；仅在需要凭据、外部授权、不可逆发布或无法合理判断的产品决策时停下。
- 每完成一个阶段，更新本计划复选框，并在 `docs/plans/skill-portability-v1-progress.md` 记录时间、变更文件、执行命令、输出摘要、失败与修复、测试结果、commit SHA、下一步。
- 每阶段必须有可验证的验收证据；失败不得标记完成。不得虚构测试、提交、平台兼容性或部署成功。
- 采用小步提交；避免无关重构；保持已有 Codex/CodeBuddy 插件、MCP、市场发布和 Hub schema 兼容。
- 遇到可自行解决的错误，应排查并重试；如连续无法解决，记录阻塞证据、最小复现和建议，而非静默跳过。
- 所有完成项以真实测试为准；最终 PR 必须包含风险说明、测试矩阵、演示方式和遗留项。

## 范围边界

**本期包含**：标准 Skill 元数据与内容校验、依赖分析、资源安全收集、目录导出、ZIP 导出、MCP 接口、独立运行验证、自动化测试与文档。

**本期不包含**：华为云或任何赛事规则、CodeArts/OfficeAce/小红书适配、第三方市场上传、云端同步、自动安装、跨平台发布 API、UI 改造。不得为了未来可能的赛事需求增加抽象或依赖。

## 1. 仓库现状审计

- [x] 记录当前 HEAD、工作树状态、Node/Bun 版本、脚本、CI、测试框架及主分支差异。
- [x] 扫描 `plugins/foundry/src`、`plugins/foundry/skills`、`plugins/foundry/scripts`、`docs` 和测试目录，定位 `skill_create`、`skill_generate`、`skill_evaluate`、`skill_publish`、`skill_evolve`、`skill_get`、存储序列化及 MCP 工具注册代码。
- [x] 确认已发布 Skill 的实际存储格式、字段、Markdown 内容、版本、状态、关联资源和路径解析方式，确认是否已有导出/打包工具，避免重复实现。
- [x] 核实 `SKILL.md` frontmatter 与 Agent Skills 规范的符合程度；区分插件自带 Skill 与用户生成的 Skill。
- [x] 检查 `USORA_HOME`、schema v1/v2 迁移、Maintainer 权限、路径安全和旧数据兼容。
- [x] 核实 Agent Skills 通用规范（以官方规范版本为准）、跨宿主常见差异及目录打包约定；记录规范来源和版本，不假定所有宿主行为一致。
- [x] 输出 `docs/plans/skill-portability-v1-audit.md`：真实文件路径、调用链、复用模块、缺口、风险、架构建议。
- **门禁**：审计报告可追溯到源码；确认核心数据模型与导出源后才开始编码。

## 2. 设计与接口契约

- [x] 明确 Publish（内部状态）、Export（只读快照）、Distribute（外部发布）的边界；Export 不得自动发布或修改 Skill。
- [x] 定义 `skill_validate` 与 `skill_export` MCP 输入输出 schema，覆盖 skill_id、格式、输出路径、冲突策略、dry_run、结构化诊断。
- [x] 设计统一中间表示、Agent Skills renderer、资源收集器、验证器、文件系统写入器、ZIP 打包器；复用仓库现有抽象。
- [x] 明确导出状态策略：默认仅已发布 Skill；草稿导出若支持，必须显式标注，且不能绕过审核。
- [x] 定义稳定文件命名、frontmatter 字段、相对资源引用、换行与 UTF-8、可重复导出、确定性 ZIP（如可行）。
- [x] 设计输出路径限制、符号链接处理、ZIP Slip 防护、秘密扫描、文件大小/数量限制及错误码。
- [x] 设计依赖声明：如果 Skill 依赖 Usora MCP，明确不可独立运行或提供可移植替代；绝不能把仅有 Markdown 的包装误报为独立可执行。
- [x] 记录方案到 `docs/plans/skill-portability-v1-design.md`，含接口示例、目录结构、失败行为、兼容性矩阵。
- **门禁**：设计能支持无需 Usora 的独立 Skill；对不支持的场景给出明确拒绝或依赖报告。

## 3. 核心校验能力

- [x] 实现标准 Skill 元数据、必需文件、frontmatter、名称/描述、引用资源及相对路径校验。
- [x] 返回结构化结果：`valid`、`errors`、`warnings`、`files`、`dependencies`、`compatibility`。
- [x] 处理无效 YAML、缺失正文、非法名称、重名、损坏资源、越界路径、循环/外链引用。
- [x] 检查明文 token、私钥、敏感配置；安全问题不得静默打包。
- [x] 校验规则遵循通用 Agent Skills 规范；不引入赛事或厂商专属 profile。宿主差异仅作为兼容性提示，不扩展本期范围。
- [x] 增加成功与失败单元测试，错误提示可操作。
- **门禁**：测试覆盖合法与非法输入，不修改原始 Skill。

## 4. 导出与 ZIP 打包

- [x] 从已发布 Skill 读取一致性快照，不改变原始记录、revision、状态、事件和统计。
- [x] 生成 `<skill-name>/SKILL.md`；按需生成 `scripts/`、`references/`、`assets/`，不创建空目录。
- [x] 对引用的资源进行白名单收集与安全复制，拒绝路径穿越、危险符号链接和目标目录逃逸。
- [x] 支持目录导出与 ZIP 导出；提供 dry_run 预览、冲突检测和显式覆盖策略；默认不覆盖。
- [x] 写入采用临时目录与原子提交或等价安全策略；失败后清理临时文件，不留下半成品。
- [x] ZIP 解压校验目录层级、文件数、字节数、编码、文件内容及路径安全。
- [x] 对运行时依赖、平台特定命令、外部服务和凭据生成可读报告。
- **门禁**：真实导出样例可解压、可验证、可重复执行，原始数据未改变。

## 5. MCP 集成与用户体验

- [x] 在现有 MCP 注册体系中增加 `skill_validate`、`skill_export`，遵循项目命名、错误和权限惯例。
- [x] 更新 `plugins/foundry/skills/usora-skill-hub/SKILL.md` 自然语言工具映射和正确调用顺序。
- [x] 增加 `skill_get` / `skill_query` 到导出的使用示例，但避免无必要的全量扫描。
- [x] 处理无 Hub、旧 schema、缺少 Skill、未发布 Skill、权限不足、非法路径、文件已存在和资源缺失。
- [x] 不改变 `skill_publish`、`skill_evolve` 和既有 marketplace 分发语义。
- **门禁**：MCP 客户端可以按 `查询 → 校验 → 导出 → 检查产物` 完成流程。

## 6. 自动化测试与独立运行验收

- [x] 单元测试：frontmatter、名称、依赖、引用、资源收集、路径、ZIP、冲突策略、敏感信息。
- [x] 集成测试：模拟真实 Hub 已发布 Skill，调用 MCP 导出，验证内容与元数据一致。
- [x] 回归测试：Candidate → Draft → Evaluate → Publish → Export 不破坏现有生命周期。
- [ ] 隔离测试：将导出包复制到不含 Usora Hub/MCP 的干净环境，使用兼容 Agent Skills 的宿主加载并完成真实任务；记录宿主版本和输出。
- [x] 如果 Skill 本质依赖 Foundry MCP，测试应明确失败或声明依赖，不得宣称可脱离运行。
- [x] 执行仓库现有 `check`、lint、typecheck、test、build、doctor、打包等适用命令；修复新增回归。
- [x] 验证 Windows 路径、空格、中文文件名和跨平台压缩包。
- [x] 不执行任何第三方市场上传、平台发布或赛事提交；本期仅验证标准 Skill 包在独立宿主中的加载与执行。
- **门禁**：所有可本地执行的测试通过，失败项有证据和明确限制。

## 7. 文档、交付与 PR

- [ ] 更新 README（中英文如现有规范要求）、插件指南、API 说明、示例目录及故障排查。
- [ ] 提供最小演示：创建或选取已发布 Skill → validate → export directory → export ZIP → 解压 → 独立宿主运行。
- [ ] 更新 `docs/plans/skill-portability-v1-progress.md`，列出每阶段完成项、文件、命令、结果、SHA、未完成事项。
- [ ] 如涉及插件 manifest 或 MCP 入口，运行现有同步、打包和发布前检查；不自行发布生产版本。
- [ ] 整理 diff，确保无秘密、构建垃圾、测试临时文件和无关改动。
- [ ] 提交分阶段 commits，推送当前分支并创建指向 `master` 的 PR。
- [ ] PR 描述包含：需求、架构、兼容性、使用示例、测试证据、风险、已知限制和后续事项。
- **最终门禁**：PR 可审查，核心导出闭环有实际测试证据；不可完成事项显式标注而非伪造完成。

## 8. 建议验收样例

1. 选择一个真实已发布 Skill，校验通过并导出目录及 ZIP。
2. 解压 ZIP，确认顶层只有目标 Skill 目录，存在有效 `SKILL.md`。
3. 校验资源引用都可解析；无绝对路径、泄漏凭据、危险链接。
4. 重复导出不覆盖已有产物；显式覆盖仅作用于允许的目标。
5. 导出前后原 Skill 状态、revision、文件和事件不变。
6. 在独立环境加载并运行不依赖 Foundry 的样例；对依赖 Foundry 的样例准确报告限制。
7. 输出最终测试矩阵与日志位置。

## 9. 阶段结果回写模板

在 `docs/plans/skill-portability-v1-progress.md` 为每阶段记录：

```markdown
### 阶段 N — 标题

- 状态：待执行 / 进行中 / 已完成 / 阻塞
- 基线 HEAD：
- 修改文件：
- 关键设计与决策：
- 验证命令：
- 验证结果（含通过/失败数量）：
- 遇到的问题及修复：
- Commit SHA：
- 遗留风险：
- 下一阶段：
```

## 10. 最终汇报格式

- 完成的阶段与主要功能
- PR URL、分支、HEAD SHA
- 真实导出示例和使用命令
- 测试矩阵与失败/跳过说明
- 与通用 Agent Skills 规范的符合项、跨宿主验证结果及未核实项
- 遗留风险和下一步建议

**停止条件**：所有本地阶段门禁通过、PR 已创建，或存在需要用户授权/外部凭据/无法自行消除的阻塞。严禁将“未验证”写成“已通过”。
