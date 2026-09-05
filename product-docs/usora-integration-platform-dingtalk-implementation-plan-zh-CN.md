# Usora Integration Platform × 钉钉完整实施计划

> **状态：** 可直接执行
> **唯一主执行者：** Codex
> **目标仓库：** `LuoMingxiang/usora`
> **首个正式 Integration Provider：** DingTalk / 钉钉
> **后续扩展目标：** 飞书、企业微信、Slack、Discord 及其他协作平台
> **计划版本：** v1.0
> **计划日期：** 2026-09-03
> **核心要求：** Codex 不仅要按本计划实施，还必须在执行过程中持续回写本文件，使本文件同时承担「实施计划 + 执行状态 + 决策记录 + 验收记录 + 中断恢复入口」的职责。

---

# 0. Codex 必读：本计划就是执行状态源

本文件不是架构建议，也不是供人工参考后再拆任务的需求说明。

**Codex 获得本文件后，应直接负责从仓库审计、任务拆分、架构决策、编码、迁移、测试、文档到最终验收的全过程。**

除遇到以下情况外，不应频繁要求用户介入：

- 必须由用户提供的钉钉凭据、企业/应用权限或人工授权；
- 存在两个不可兼容且会显著改变产品方向的方案；
- 需要执行不可逆的远端操作；
- 仓库实际情况与本计划目标发生根本冲突。

普通代码细节、目录调整、测试方式、类型设计、重构顺序，应由 Codex 根据仓库实际自行决策。

---

## 0.1 强制回写规则

**这是本计划最高优先级的执行规则之一。**

Codex 每完成一个可独立验收的任务或阶段，都必须立即回写本 Markdown 文件，而不是等全部开发结束后再统一总结。

禁止出现：

```text
完成 A
完成 B
完成 C
最后一次性更新计划
```

必须：

```text
完成 A
→ 验证 A
→ 回写 A 状态
→ 记录实际改动
→ 记录验证结果
→ 再开始 B
```

### 每个 TODO 必须使用状态标记

```text
[ ] 未开始
[~] 进行中
[x] 已完成
[!] 阻塞
[-] 取消 / 经 ADR 确认不再需要
```

开始任务时：

```markdown
- [~] C4. 实现 Integration Checkpoint
```

完成并验证后：

```markdown
- [x] C4. 实现 Integration Checkpoint
```

### 每个完成任务必须追加执行记录

格式：

```markdown
#### 执行记录

- 状态：已完成
- 完成时间：YYYY-MM-DD HH:mm
- 实际修改：
  - `packages/integration/src/...`
  - `plugins/foundry/src/...`
- 实现摘要：
  - ...
- 验证：
  - `bun test ...` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - ...
- 后续影响：
  - ...
```

如果失败或阻塞：

```markdown
#### 执行记录

- 状态：阻塞
- 原因：
- 已尝试：
- 证据：
- 是否影响其他任务：
- 推荐下一步：
```

---

## 0.2 阶段回写规则

每完成一个 Phase，Codex 必须更新该 Phase 的「阶段验收记录」。

格式：

```markdown
### Phase X 阶段验收记录

- 状态：✅ Completed
- 开始时间：
- 完成时间：
- Commit / 工作树状态：
- 完成任务：X / X
- 测试结果：
- Breaking Change：
- Migration：
- ADR：
- 遗留问题：
- 是否允许进入下一阶段：是 / 否
```

**阶段验收未通过，不允许把下一阶段标记为完成。**

---

## 0.3 中断恢复协议

本计划必须支持：

- Codex 会话中断；
- Context 丢失；
- 换模型；
- 换 Agent；
- 几天后继续；
- 用户重新把计划交给新的 Codex 会话。

因此 Codex 每次开始工作前必须：

1. 读取本计划；
2. 找到 `执行总览`；
3. 找到所有 `[~]`、`[!]` 和最近完成的 `[x]`；
4. 阅读最近的执行记录；
5. 查看 `当前实施基线`；
6. 对照 Git 工作树确认计划状态没有过期；
7. 只从第一个未完成且依赖满足的任务继续。

禁止仅依赖之前对话上下文恢复工作。

如果计划与代码状态不一致：

> **以代码和测试事实为准，并先修正本计划，再继续。**

---

# 1. 执行总览

> Codex 必须持续维护本节。

## 当前状态

```text
总体状态：IN_PROGRESS
当前 Phase：L — 修复验证 / 企业验收待执行
当前任务：修复和自审已完成，真实企业验收待执行
阻塞项：真实企业凭据、文档授权与已发布互动卡片模板尚未提供
最后回写：2026-09-06 00:03
```

## Phase 状态

| Phase | 内容 | 状态 |
|---|---|---|
| A | 仓库审计与架构锁定 | ✅ |
| B | Integration Core Contracts | ✅ |
| C | Event Migration & Delivery Runtime | ✅ |
| D | DingTalk Plugin Foundation | ✅ |
| E | 钉钉 Outbound Messaging | ✅ |
| F | Identity & Interactive Actions | ✅ |
| G | DingTalk Bot Commands | ✅ |
| H | DingTalk Resource Integration | ✅ |
| I | DingTalk Practice Source | ✅ |
| J | Developer Experience | ✅ |
| K | 多平台可扩展性证明 | ✅ |
| L | 全量验证与 Release Readiness | 🟡 |

状态：

```text
⬜ Not Started
🟡 In Progress
🟥 Blocked
✅ Completed
```

---

# 2. 项目目标

当前目标不是：

> 给 Usora 增加一个钉钉机器人。

而是：

> **建立 Usora Integration Platform，并将钉钉作为第一个完整的官方 Provider。**

Integration Platform 必须让 Usora 同时支持：

```text
Usora → 协作平台
```

以及：

```text
协作平台 → Usora
```

最终结构：

```text
                Practice Interfaces

       Codex / CodeBuddy / Claude / Kimi
                        │
                        ▼
               ┌─────────────────┐
               │      Usora      │
               │                 │
               │ Foundry         │
               │ Activity        │
               │ Pattern         │
               │ Candidate       │
               │ Skill           │
               │ Governance      │
               └────────┬────────┘
                        │
                  Domain Events
                        │
                        ▼
            ┌──────────────────────┐
            │ Integration Platform │
            │                      │
            │ Event Contract       │
            │ Message Contract     │
            │ Command Contract     │
            │ Action Contract      │
            │ Identity Contract    │
            │ Resource Contract    │
            │ Delivery Runtime     │
            └──────────┬───────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       DingTalk      Feishu       WeCom
       Official      Future       Future
```

核心原则：

> **DingTalk is a provider, not the platform.**

---

# 3. 当前仓库基线

Codex 开始执行后必须重新验证本节。

目前已知 Usora 根目录采用：

```text
plugins/*
packages/*
```

workspace。

已有通用能力包括：

```text
plugin:create
discover
build
package
release
affected
runtime:check
marketplace:check
validate
test
typecheck
lint
```

因此新增：

```text
packages/integration
plugins/dingtalk
```

与现有 Monorepo 方向一致。

Foundry 已具有大致边界：

```text
plugins/foundry/src/
├── adapters/
├── core/
├── hooks/
├── mcp/
└── sources/
```

现有 `adapters` 主要承担：

```text
AI Host / Session → Usora
```

例如 Codex / CodeBuddy Session Adapter。

钉钉属于另一方向：

```text
Usora ↔ Collaboration Platform
```

所以禁止简单加入：

```text
plugins/foundry/src/adapters/dingtalk.ts
```

---

# 4. 核心架构约束

以下约束除非通过 ADR 明确推翻，否则视为强制要求。

## 4.1 Foundry 不认识 DingTalk

禁止：

```ts
import "@usora/dingtalk";
```

出现在 Foundry Core。

## 4.2 DingTalk 不访问 Foundry 私有实现

禁止：

```ts
import "../foundry/src/core/candidates";
```

允许的边界只有：

```text
Event
Command
Action
Identity
Resource
Public Capability
```

## 4.3 保持 Local-first

禁止为了 Integration 默认引入：

```text
Kafka
Redis
RabbitMQ
强制云服务
中央 Integration Server
```

除非仓库实际证明本地模式无法满足需求，并通过 ADR 说明。

## 4.4 Practice First

钉钉文档、日志、聊天等数据不能直接生成 Skill。

必须：

```text
DingTalk Resource
        ↓
Practice Source
        ↓
Activity
        ↓
Foundry
        ↓
Pattern
        ↓
Candidate
        ↓
Skill
```

## 4.5 Human Governance 不得绕过

钉钉按钮不能因为“方便”而绕过现有 Maintainer 权限。

---

# 5. 目标目录

目标形态：

```text
packages/
└── integration/
    ├── src/
    │   ├── events/
    │   ├── messages/
    │   ├── commands/
    │   ├── actions/
    │   ├── identity/
    │   ├── resources/
    │   ├── capabilities/
    │   ├── subscriptions/
    │   ├── delivery/
    │   ├── runtime/
    │   └── testing/
    └── package.json

plugins/
├── foundry/
│   └── ...
│
└── dingtalk/
    ├── src/
    │   ├── provider.ts
    │   ├── config/
    │   ├── transport/
    │   ├── messaging/
    │   ├── interaction/
    │   ├── commands/
    │   ├── identity/
    │   ├── resources/
    │   ├── sources/
    │   ├── mcp/
    │   └── cli/
    ├── tests/
    ├── plugin.json
    ├── package.json
    └── tsconfig.json
```

目录只是目标边界，不是要求机械照搬。

Codex 应优先遵循仓库已有代码风格。

---

# 6. ADR 要求

至少创建：

```text
ADR-001 Integration Platform Boundary
ADR-002 Local-first Event Delivery
ADR-003 Capability-based Provider
ADR-004 Provider-neutral Message Model
ADR-005 Command Boundary
ADR-006 External Identity Mapping
ADR-007 Secret Separation
```

建议：

```text
D:\usora-docs\content\docs\integration.mdx
```

每个 ADR 至少记录：

```text
Context
Decision
Alternatives
Consequences
Migration Impact
Status
```

如执行中发现计划需要修改，优先：

```text
新增 / 更新 ADR
        ↓
回写计划
        ↓
调整 TODO
        ↓
继续编码
```

而不是悄悄偏离计划。

---

# 7. Integration Capability Model

不要设计成：

```ts
interface DingTalkIntegration {}
```

也不要只有：

```ts
sendMessage()
```

必须采用 Capability-based Provider。

建议：

```ts
interface IntegrationProvider {
  readonly id: string;
  readonly capabilities: IntegrationCapabilities;

  messaging?: MessagingCapability;
  interaction?: InteractionCapability;
  command?: CommandCapability;
  source?: SourceCapability;
  identity?: IdentityCapability;
  resource?: ResourceCapability;
}
```

能力：

```text
Messaging
Interaction
Command
Source
Identity
Resource
```

未来：

```text
DingTalk
  Messaging     ✓
  Interaction   ✓
  Command       ✓
  Source        ✓
  Identity      ✓
  Resource      ✓

Slack
  Messaging     ✓
  Interaction   ✓
  Command       ✓
  Source        optional
```

不能要求所有 Provider 功能完全一致。

---

# 8. Event Contract

当前 Foundry 已存在生命周期 Event 持久化。

Integration Platform 应将其演进为正式公共 Contract。

建议：

```ts
export interface UsoraEvent<TData = unknown> {
  id: string;
  schemaVersion: number;
  type: string;
  occurredAt: string;

  producer: {
    plugin: string;
    version?: string;
  };

  actor?: UsoraActor;

  subject?: {
    type: string;
    id: string;
  };

  data: TData;

  metadata?: Record<string, unknown>;
}
```

要求：

```text
唯一 ID
Schema Version
Immutable
Durable
Provider-neutral
Backward-readable
```

---

# 9. Event Catalog

Codex 必须先扫描所有现有 Event，再锁定最终 Catalog。

建议标准化为 dotted naming：

```text
activity.created
activity.updated
activity.processed

pattern.detected

candidate.created
candidate.updated
candidate.approved
candidate.rejected
candidate.archived

skill.created
skill.updated
skill.published
skill.deprecated
skill.retired

governance.finding
governance.resolved

foundry.started
foundry.completed
foundry.failed

hub.initialized
hub.migrated
```

迁移原则优先：

```text
旧格式可读
新格式可读
新代码只写新格式
```

禁止直接让已有 Hub Event 全部失效。

---

# 10. Integration Message

Core 不允许出现钉钉 Card Schema。

Provider-neutral：

```ts
interface IntegrationMessage {
  id?: string;
  title?: string;
  summary?: string;
  body?: string;

  sections?: IntegrationMessageSection[];
  actions?: IntegrationAction[];
  resources?: IntegrationResource[];

  metadata?: Record<string, unknown>;
}
```

然后：

```text
IntegrationMessage
        │
        ├── DingTalk Renderer
        ├── Feishu Renderer
        ├── Slack Renderer
        └── Discord Renderer
```

禁止将以下字段提升到 Core：

```text
cardTemplateId
openConversationId
DingTalk-specific callback data
Feishu-specific card schema
Slack block schema
```

---

# 11. Command Contract

外部平台不能直接调用 Foundry 私有方法。

必须：

```text
DingTalk
   ↓
IntegrationCommand
   ↓
Usora Command Dispatcher
   ↓
Domain Handler
```

建议：

```ts
interface IntegrationCommand<TArgs = unknown> {
  id: string;
  name: string;
  actor: UsoraActor;
  args: TArgs;

  source: {
    provider: string;
    resource?: IntegrationResource;
  };

  issuedAt: string;
}
```

初始命令：

```text
hub.status
candidate.list
candidate.get
candidate.approve
candidate.reject
skill.get
governance.scan
governance.resolve
foundry.run
digest.get
```

不要为了这个功能引入庞大的 CQRS 框架。

---

# 12. Identity

必须提前设计。

```ts
interface UsoraActor {
  id: string;
  kind: "user" | "agent" | "system";
  identities?: ExternalIdentity[];
}
```

```ts
interface ExternalIdentity {
  provider: string;
  externalUserId: string;
  externalTenantId?: string;
  displayName?: string;
}
```

链路：

```text
DingTalk User
      ↓
ExternalIdentity
      ↓
UsoraActor
      ↓
Authorization
```

禁止：

```text
任何能点卡片的人 = Maintainer
```

---

# 13. Resource Contract

统一表示：

```text
Document
Message
Conversation
Todo
Log
Calendar
User
Group
Card
```

建议：

```ts
interface IntegrationResource {
  provider: string;
  type: string;
  externalId: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}
```

未来 Candidate Evidence 可以引用：

```text
Codex Session
DingTalk Document
DingTalk Conversation
```

---

# 14. Event Delivery Runtime

继续保持 Local-first。

建议状态：

```text
.usora/
├── events/
│
└── integrations/
    └── dingtalk/
        ├── state.json
        ├── deliveries/
        ├── checkpoints/
        └── dead-letter/
```

具体布局由 Codex 根据现有 Storage 设计决定。

必须支持：

```text
Checkpoint
Retry
Deduplication
Idempotency
Dead Letter
Replay
Crash Recovery
```

推荐 Dedup Key：

```text
provider + subscription + event.id
```

---

# 15. Subscription

禁止：

```ts
if (event.type === "candidate.created") {
  dingtalk.send(...)
}
```

应：

```text
Event
 ↓
Subscription Matcher
 ↓
Message Builder
 ↓
Provider
```

配置概念：

```yaml
integrations:
  dingtalk:
    enabled: true

    subscriptions:
      - id: candidate-created
        event: candidate.created
        message: candidate-created

      - id: skill-published
        event: skill.published
        message: skill-published

      - id: governance-finding
        event: governance.finding
        message: governance-finding

      - id: foundry-digest
        event: foundry.completed
        message: foundry-digest
```

V1 不引入复杂表达式 DSL。

---

# 16. DingTalk Provider

钉钉是第一个完整 Provider。

目标能力：

```text
Messaging
Interaction
Command
Identity
Resource
Source
```

---

## 16.1 Messaging

实现：

```text
Text
Markdown
Interactive Card
Direct Message（能力允许时）
Group Message（能力允许时）
Fallback
```

首批事件：

```text
candidate.created
skill.published
governance.finding
governance.resolved
foundry.completed
```

---

## 16.2 Candidate Card

示意：

```text
✨ New Skill Candidate

vue-memory-leak-diagnosis

Confidence  87%
Evidence    4 Activities
Source      CodeBuddy

[查看]
[批准]
[拒绝]
```

批准 / 拒绝按钮只有在：

```text
Callback Verification
Identity
Authorization
Command Dispatcher
```

全部完成后才允许启用。

---

## 16.3 Governance

示意：

```text
⚠️ Governance Finding

vue2-eventbus-pattern

Reason
Unused for 94 days

Suggested
DEPRECATE

[KEEP]
[EVOLVE]
[DEPRECATE]
[RETIRE]
```

所有 destructive action 必须重新执行权限校验。

---

## 16.4 Foundry Digest

作为第一等场景：

```text
Usora · Daily Foundry

Activities      18
Patterns         5
Candidates       3
Published        1
Governance       2
```

只展示可以可靠计算的数据。

禁止编造指标。

---

# 17. DingTalk Bot

目标：

```text
@Usora status
@Usora candidates
@Usora candidate xxx
@Usora skill xxx
@Usora governance
@Usora governance scan
@Usora foundry run
@Usora digest
```

内部不能依赖字符串命令本身。

必须归一化为：

```text
hub.status
candidate.list
...
```

钉钉最终承担：

> **Usora Remote / Mobile Console**

---

# 18. DingTalk → Practice Source

长期必须实现，不只是通知。

目标：

```text
DingTalk
├── Document
├── Log
├── Todo
└── Conversation
       ↓
Integration Resource
       ↓
Practice Source
       ↓
Activity
       ↓
Foundry
```

首版优先 Manual Capture：

```text
capture this document
capture this conversation
capture this log
```

稳定后再做 Allowlist-based Automatic Capture。

默认不能扫描整个企业内容。

---

# 19. Secrets

知识数据和平台凭据严格分离。

环境变量示例：

```text
USORA_DINGTALK_CLIENT_ID
USORA_DINGTALK_CLIENT_SECRET
USORA_DINGTALK_WEBHOOK_URL
USORA_DINGTALK_WEBHOOK_SECRET
```

按实际实现删减。

要求：

```text
不进入 Event
不进入 Activity
不进入 Candidate
不进入 Skill
不进入 Git
不进入诊断输出
日志自动脱敏
```

---

# 20. Security

必须做专门 Security Review。

Inbound：

```text
Callback authenticity verification
Schema validation
Replay protection
Duplicate protection
Identity resolution
Authorization
Command allowlist
```

Outbound：

```text
TLS
Timeout
Bounded Retry
Secret Redaction
Structured Error
```

禁止：

```text
钉钉聊天文本 → shell
钉钉聊天文本 → 任意 MCP method
钉钉参数 → 任意 dynamic import
```

---

# 21. Testing Harness

`packages/integration` 必须提供可复用测试工具。

目标：

```ts
createIntegrationHarness()
assertProviderContract()
createMockEvent()
createMockIdentity()
createMockAction()
createMockResource()
```

以后 Feishu Provider 应复用同一套 Contract Tests。

必须覆盖：

```text
Event compatibility
Subscription
Delivery
Retry
Checkpoint
Idempotency
Dead Letter
Replay
Capability validation
Identity
Authorization
Command
Provider rendering
Callback verification
Crash recovery
Migration
```

---

# 22. Breaking Change

允许 Breaking Change。

但每次必须：

```text
记录旧行为
记录新行为
Migration
Schema Version
Fixture
Tests
Changelog
计划回写
```

不能因为“反正还在开发”而无记录地破坏已有 Hub。

---

# 23. Detailed TODO

> **Codex 必须在正式编码前把本节进一步拆成实施子任务。**
>
> 每个子任务必须记录：
>
> - 执行者：主 Agent / 子 Agent
> - 模型选择：高推理 / 常规实现 / 其他合适模型
> - 选择理由
> - Dependencies
> - 是否可并行
> - Acceptance Criteria
> - 当前状态
>
> Codex 应自行决定实际可用模型，不要机械绑定某个历史型号名称。

---

## Phase A — 仓库审计与架构锁定

### Phase A 子任务拆分

| 子任务 | 执行者 | 模型选择 | 选择理由 | Dependencies | 可并行 | Acceptance Criteria | 状态 |
|---|---|---|---|---|---|---|---|
| A1 | 主 Agent | 高推理 | Foundry 边界、事件、迁移和治理权限会影响公共 Integration Contract | 无 | 否 | 计划中的 Foundry 假设被代码事实验证或修正 | [x] |
| A2 | 主 Agent | 常规实现 | Monorepo tooling 是文件和脚本审计，风险较低 | A1 可部分并行，但为减少错判先完成 A1 | 否 | 确认 `packages/integration` 与 `plugins/dingtalk` 进入现有工具链路径 | [x] |
| A3 | 主 Agent | 高推理 | 钉钉能力、权限和安全验证会影响 Provider 边界 | A1 | 否 | 官方文档来源、采用 API、权限和限制已记录 | [x] |
| A4 | 主 Agent | 高推理 | ADR 锁定跨插件边界、事件、身份、密钥和本地交付语义 | A1-A3 | 否 | ADR-001 至 ADR-007 已创建并与计划一致 | [x] |

### A1. [x] Foundry 边界审计

- [x] 检查 `plugins/foundry` 完整目录。
- [x] 检查 Core。
- [x] 检查 Adapters。
- [x] 检查 Sources。
- [x] 检查 MCP。
- [x] 检查 Hooks。
- [x] 检查所有 Event 写入。
- [x] 检查 Event 读取。
- [x] 检查 Storage。
- [x] 检查 Governance。
- [x] 检查 Candidate。
- [x] 检查 Hub Schema。
- [x] 检查 Config Migration。
- [x] 检查相关测试。

验收：

```text
计划中的每一个仓库假设都被验证或修正。
```

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 18:56
- 实际修改：
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 确认 Foundry 当前边界是 `plugins/foundry/src/core` 域逻辑、`adapters` 负责 AI host session 输入、`sources` 负责 Activity Source、`mcp` 负责公开工具分发、`hooks` 负责 SessionEnd 捕获。
  - 确认生命周期事件统一通过 `writeEvent(type, data)` 写入 Knowledge Hub 的 `events`，当前事件格式为 `{ schema_version, type, timestamp, data }`，事件名为 PascalCase。
  - 确认现有治理权限在 `skill_publish` 和 destructive governance actions 中校验 `config.maintainer`，钉钉交互不得绕过该公共命令/权限边界。
  - 确认 Hub schema 当前为 v2，Activity/Candidate/Skill metadata 为 v2，Event schema 当前为 v1；迁移已有 v1->v2 显式流程和备份。
- 验证：
  - 代码审计：`rg --files`、`rg "writeEvent\(" plugins/foundry/src` ✅
  - 读取文件：`storage.ts`、`events.ts`、`activities.ts`、`candidates.ts`、`skills.ts`、`governance.ts`、`migration.ts`、`patterns.ts`、`sessions.ts`、`adapters/*`、`sources/*`、`hooks/session-hook.ts`、`mcp/handlers.ts`、`foundry-baseline.test.ts` ✅
- 与原计划偏差：
  - 计划文件位于 `product-docs/*`，被 `.gitignore` 忽略；继续按计划要求回写该文件，但 Git diff 不会显示该文件变更。
- 新发现：
  - Plan 中建议的 dotted event catalog 尚未存在；后续必须做 legacy PascalCase -> dotted 的兼容层，新代码只写新格式。
  - Host Practice 数据与 shared Knowledge 数据已经分离：Activities/Sessions 偏 host，Candidates/Skills/Events/Indexes 偏 Knowledge。
- 后续影响：
  - `packages/integration` 应提供事件兼容读取/标准化，而不是让 Foundry 直接依赖钉钉。
  - DingTalk inbound destructive action 必须归一化为 command，再复用 Maintainer authorization。

---

### A2. [x] Monorepo Tooling 审计

- [x] `create-plugin.ts`
- [x] discover
- [x] build
- [x] package
- [x] release
- [x] affected
- [x] runtime check
- [x] marketplace
- [x] packages workspace resolution

验收：

```text
确认 packages/integration + plugins/dingtalk 能完整进入现有工具链。
```

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 18:56
- 实际修改：
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 根 `package.json` 使用 Bun workspace：`plugins/*` 和 `packages/*`。
  - `tsconfig.json` 覆盖 `packages/**/*.ts` 与 `plugins/**/*.ts`；新增 `packages/integration` 会进入 typecheck。
  - 插件发现、构建、打包、runtime check、marketplace 同步均基于 `plugins/*/plugin.json`；新增 `plugins/dingtalk` 必须提供现有 manifest、entrypoints、dist、skills/hooks/assets、Codex/CodeBuddy metadata。
  - `affected` 对 `packages/<name>` 变化会标记依赖该 package 的插件；如果无插件依赖该 package，则保守标记所有插件。
- 验证：
  - `bun run discover --names` ✅ 输出 `["foundry"]`
  - `bun run affected packages/integration/src/index.ts plugins/dingtalk/plugin.json package.json` ✅ 输出 `foundry`
- 与原计划偏差：
  - 无
- 新发现：
  - `scripts/validate-plugin.ts` 当前硬编码校验 foundry；后续新增 dingtalk 前需要扩展 validation，否则 `bun run validate` 无法成为全插件验收。
- 后续影响：
  - `plugins/dingtalk/package.json` 需要依赖 `@usora/integration` 后，`affected` 才能精准关联 integration package 到 dingtalk。
  - `build-plugin.ts` 只构建 manifest 中声明的 entrypoints，不会自动构建 package。

---

### A3. [x] 钉钉官方能力审计

实施前重新检查钉钉官方文档。

- [x] Bot / Agent。
- [x] 企业应用。
- [x] Webhook Robot。
- [x] Message API。
- [x] Interactive Card。
- [x] Callback。
- [x] Signature / Token Verification。
- [x] User Identity。
- [x] Document。
- [x] Log。
- [x] Todo。
- [x] Conversation / Message。
- [x] MCP。
- [x] 官方 SDK。
- [x] API 权限要求。

必须记录：

```text
采用 API
采用 SDK / REST
权限
限制
文档来源
```

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 18:58
- 实际修改：
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - V1 outbound 优先采用自定义机器人 Webhook：文本/Markdown/ActionCard/FeedCard 等消息可通过 Webhook 发送，签名使用 timestamp + secret 计算，适合本地优先交付。
  - 应用级能力采用企业内部应用 + OpenAPI：工作通知、用户身份、部门/通讯录、待办、文档/文件、日志/审批等能力需要按接口申请权限和 access token。
  - Inbound Bot、事件订阅、互动卡片回调优先评估 Stream Mode；它覆盖机器人接收消息、事件订阅和卡片回调，避免 V1 必须暴露公网 callback endpoint。
  - 官方 SDK 存在，但 V1 可先用 REST/fetch 封装最少接口；SDK 只在 token/API 覆盖明显省代码时引入。
- 采用 API / SDK：
  - Webhook Robot：REST Webhook。
  - Message API：OpenAPI REST，按应用 access token 调用。
  - Interactive Card：OpenAPI/Stream Mode callback。
  - Identity：OpenAPI user/contact APIs。
  - Resource：OpenAPI document/file/todo/log/conversation/message 相关接口，先做 manual capture。
- 权限：
  - Webhook 需要机器人 webhook URL 与可选加签 secret。
  - 企业应用能力需要 app key/client id、app secret、corp/tenant scope、对应通讯录/消息/文档/待办等权限。
  - destructive action 仍以 Usora Maintainer 授权为准，钉钉身份只作为 ExternalIdentity。
- 限制：
  - 默认不扫描全企业内容。
  - 不把钉钉平台 schema 泄漏进 `packages/integration`。
  - 没有用户凭据时只能实现 mock/contract/webhook 级测试，不能声明真实企业 E2E 完成。
- 文档来源：
  - 钉钉开放平台服务端 API 总览：https://open.dingtalk.com/document/orgapp-server/api-overview
  - 钉钉开放平台自定义机器人/消息与加签文档：https://open.dingtalk.com/
  - 钉钉开放平台互动卡片、事件订阅、Stream Mode、通讯录/用户、文档/待办/日志相关官方文档：https://open.dingtalk.com/document/
  - Open DingTalk SDK / examples：https://github.com/open-dingtalk
- 验证：
  - 官方文档检索并交叉确认能力边界 ✅
- 与原计划偏差：
  - V1 inbound 优先选择 Stream Mode 作为本地优先路径，公网 HTTP callback 作为后续可选 transport。
- 新发现：
  - Stream Mode 可以降低本地部署门槛，符合 Local-first。
- 后续影响：
  - ADR-002 和 ADR-007 需要明确 Webhook/App secrets 不进入 Event/Activity/Candidate/Skill。

---

### A4. [x] ADR

- [x] ADR-001。
- [x] ADR-002。
- [x] ADR-003。
- [x] ADR-004。
- [x] ADR-005。
- [x] ADR-006。
- [x] ADR-007。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:00
- 实际修改：
  - `D:\usora-docs\content\docs\integration.mdx` 的“架构决策”章节：
    - ADR-001 Integration Platform Boundary
    - ADR-002 Local-first Event Delivery
    - ADR-003 Capability-based Provider
    - ADR-004 Provider-neutral Message Model
    - ADR-005 Command Boundary
    - ADR-006 External Identity Mapping
    - ADR-007 Secret Separation
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - ADR-001 锁定 Integration Platform 边界：Foundry 不依赖 DingTalk，DingTalk 不访问 Foundry private core。
  - ADR-002 锁定 Local-first durable delivery。
  - ADR-003 锁定 capability-based provider。
  - ADR-004 锁定 provider-neutral message model。
  - ADR-005 锁定 external command boundary。
  - ADR-006 锁定 external identity mapping。
  - ADR-007 锁定 secret separation 与 redaction。
- 验证：
  - `pnpm exec prettier --check content/docs/integration.mdx` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - Phase B 的 `packages/integration` 必须优先实现 ADR 中的公共 contract，避免 DingTalk-first 泄漏。

#### Phase A 阶段验收记录

- 状态：✅ Completed
- 开始时间：2026-09-03 18:54
- 完成时间：2026-09-03 19:00
- Commit / 工作树状态：
  - Branch：`codex/dingtalk-integration-platform`
  - Base Commit：`7786bb5255cbd252775e3d2a223bc0155eea590e`
  - Current Commit：`7786bb5255cbd252775e3d2a223bc0155eea590e`
  - 文档产物已迁移到 `D:\usora-docs\content\docs\integration.mdx`；计划文件位于 ignored `product-docs/*`，已在磁盘回写但不进入 Git diff。
- 完成任务：4 / 4
- 测试结果：
  - `bun run discover --names` ✅
  - `bun run affected packages/integration/src/index.ts plugins/dingtalk/plugin.json package.json` ✅
  - `pnpm exec prettier --check content/docs/integration.mdx` ✅
- Breaking Change：
  - 无
- Migration：
  - 无
- ADR：
  - ADR-001 至 ADR-007 已创建
- 遗留问题：
  - 无阻塞；真实 DingTalk 企业凭据和权限将在需要真实 E2E 时由用户提供。
- 是否允许进入下一阶段：是

---

# Phase B — Integration Core

## B1. 创建 package

- [x] `packages/integration`
- [x] package metadata
- [x] tsconfig
- [x] exports
- [x] build
- [x] test
- [x] typecheck

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:02
- 实际修改：
  - `packages/integration/package.json`
  - `packages/integration/src/index.ts`
  - `packages/integration/tsconfig.json`
  - `test/integration/integration-package.test.ts`
  - `tsconfig.base.json`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 创建 `@usora/integration` workspace package，导出 `INTEGRATION_PACKAGE` 与 `INTEGRATION_CONTRACT_VERSION`。
  - 增加 package-level `typecheck` script。
  - 在根 `tsconfig.base.json` 增加 `@usora/integration` path alias。
  - 增加最小 Vitest 验证 package export。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 现有仓库 build 脚本只构建插件，package B1 的 build 验收以 TypeScript package typecheck/export 可解析为准。
- 新发现：
  - 无
- 后续影响：
  - B2 起在该 package 内补充 provider-neutral public contracts。

## B2. Event

- [x] `UsoraEvent`
- [x] ID
- [x] schemaVersion
- [x] producer
- [x] subject
- [x] actor
- [x] metadata

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:04
- 实际修改：
  - `packages/integration/src/events.ts`
  - `packages/integration/src/identity.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 provider-neutral `UsoraEvent<TData>`，包含 `id`、`schemaVersion`、`type`、`occurredAt`、`producer`、`actor`、`subject`、`data`、`metadata`。
  - 新增 `createUsoraEvent`，使用 Node `crypto.randomUUID()` 生成默认 event id，默认 schema version 为 1。
  - 新增最小 `UsoraActor` / `ExternalIdentity` 类型，供事件 actor 字段引用；B4 会继续补 resolver/authorization contract。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - `exactOptionalPropertyTypes` 要求 optional 字段不能显式写入 `undefined`，事件 helper 已使用条件展开。
- 后续影响：
  - B3 需要把 Foundry 现有 `schema_version` / `timestamp` / PascalCase 事件适配为该事件 envelope。

## B3. Event Catalog

- [x] 现有 Event inventory
- [x] normalized names
- [x] legacy adapter
- [x] validator
- [x] compatibility tests

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:05
- 实际修改：
  - `packages/integration/src/events.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增第一版 `USORA_EVENT_TYPES` dotted catalog。
  - 新增 `LEGACY_FOUNDRY_EVENT_TYPE_MAP`，覆盖当前 Foundry `writeEvent(...)` inventory。
  - 新增 `normalizeEventType`、`fromLegacyFoundryEvent` 和 `validateUsoraEvent`。
  - legacy adapter 可从旧 `{ schema_version, type, timestamp, data, file }` 事件生成公共 `UsoraEvent`。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 没有文件名时旧事件无法天然提供稳定 id；adapter 优先使用 `id` 或 `file`，否则生成新 id。Delivery runtime 读取真实文件时应传入 file 以获得稳定 dedup。
- 后续影响：
  - C1 迁移时应让 Foundry 新写 dotted 类型，但 legacy read 保持兼容。

## B4. Identity

- [x] `UsoraActor`
- [x] `ExternalIdentity`
- [x] resolver contract
- [x] authorization extension

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:07
- 实际修改：
  - `packages/integration/src/identity.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IdentityResolutionInput` 与 `IdentityResolver` contract。
  - 新增 `AuthorizationContext`、`AuthorizationDecision` 与 `Authorizer` contract。
  - 新增 `hasExternalIdentity` 和 `createMaintainerAuthorizer`，用于保持外部身份与 Usora Maintainer 授权分离。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - DingTalk identity resolver 只需实现该 contract，不应把任意 DingTalk 用户映射为 Maintainer。

## B5. Resource

- [x] `IntegrationResource`
- [x] resource conventions
- [x] provenance

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:08
- 实际修改：
  - `packages/integration/src/resources.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IntegrationResource`、`IntegrationResourceType` 和常见 resource type catalog。
  - 新增 `ResourceProvenance` 与 `createResourceProvenance`。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - DingTalk Document/Conversation/Log/Todo manual capture 可统一引用该 resource/provenance。

## B6. Message

- [x] Message
- [x] Section
- [x] Facts
- [x] Action
- [x] Resource Reference
- [x] Validator

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:09
- 实际修改：
  - `packages/integration/src/messages.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IntegrationMessage`、`IntegrationMessageSection`、`IntegrationMessageFact`、`IntegrationAction`。
  - Message 支持 `resources?: IntegrationResource[]`，保持 provider-neutral resource reference。
  - 新增 `validateIntegrationMessage`，仅校验必要内容和 action id/label。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - DingTalk renderer 只消费该中立消息，不应把 card template 字段提升到 core。

## B7. Command

- [x] envelope
- [x] registry
- [x] dispatcher
- [x] result
- [x] error
- [x] authorization

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:10
- 实际修改：
  - `packages/integration/src/commands.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增初始 command name catalog。
  - 新增 `IntegrationCommand` envelope、`IntegrationCommandResult`、handler 和 registry 类型。
  - 新增 `createCommandRegistry` 与 `dispatchIntegrationCommand`，支持 unknown command 和 provider-neutral authorization。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - DingTalk bot/callback 只需归一化为 `IntegrationCommand`，不能直接调用 Foundry private core。

## B8. Provider

- [x] capabilities
- [x] provider contract
- [x] runtime validation

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:12
- 实际修改：
  - `packages/integration/src/providers.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IntegrationCapabilities` 与 capability names：messaging、interaction、command、source、identity、resource。
  - 新增 `IntegrationProvider` contract 和各 capability contract。
  - 新增 `assertProviderContract`，校验 provider id 以及 declared capability 必须有对应实现。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bunx prettier --check packages/integration test/integration/integration-package.test.ts tsconfig.base.json` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - Phase D 的 DingTalk provider 与 Phase K 的第二 provider 都必须通过同一个 provider contract。

### Phase B 阶段验收记录

- 状态：✅ Completed
- 开始时间：2026-09-03 19:01
- 完成时间：2026-09-03 19:12
- Commit / 工作树状态：
  - Branch：`codex/dingtalk-integration-platform`
  - Base Commit：`7786bb5255cbd252775e3d2a223bc0155eea590e`
  - Current Commit：`7786bb5255cbd252775e3d2a223bc0155eea590e`
  - Git 工作树：`tsconfig.base.json` 修改；新增 `packages/integration/`、`test/integration/integration-package.test.ts`；ADR 文档迁移到 `D:\usora-docs`；计划文件位于 ignored `product-docs/*`，已在磁盘回写。
- 完成任务：8 / 8
- 测试结果：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bunx prettier --check packages/integration test/integration/integration-package.test.ts tsconfig.base.json` ✅
  - `bun run typecheck` ✅
- Breaking Change：
  - 无
- Migration：
  - 无
- ADR：
  - 遵循 ADR-001 至 ADR-007
- 遗留问题：
  - Event write upgrade、subscription、delivery runtime 进入 Phase C。
- 是否允许进入下一阶段：是

---

# Phase C — Event Migration & Delivery Runtime

## C1. Event 写入升级

- [x] Event ID。
- [x] 新 Schema。
- [x] Legacy Read。
- [x] New Write。
- [x] Migration tests。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:20
- 实际修改：
  - `plugins/foundry/package.json`
  - `plugins/foundry/src/core/storage.ts`
  - `plugins/foundry/src/core/events.ts`
  - `plugins/foundry/src/core/context-budget.ts`
  - `plugins/foundry/dist/mcp.js`
  - `plugins/foundry/dist/session-hook.js`
  - `scripts/foundry-token-benchmark.ts`
  - `test/integration/foundry-baseline.test.ts`
  - `test/integration/foundry-context-budget-telemetry.test.ts`
  - `test/integration/foundry-governance.test.ts`
  - `test/integration/foundry-migration.test.ts`
  - `test/integration/foundry-runtime-feedback.test.ts`
  - `test/integration/foundry-skill-evolution.test.ts`
  - `vitest.config.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - `writeEvent(type, data)` 现在在共享写入点生成公共 `UsoraEvent` envelope：`id`、`schemaVersion`、`type`、`occurredAt`、`producer`、`data`。
  - 旧 PascalCase event type 在写入点经 `normalizeEventType` 转换为 dotted type；metadata 保留 `legacyType`。
  - `event_list` 统一读取新旧事件文件：新文件原样返回，旧 `{ schema_version, type, timestamp, data }` 文件通过 `fromLegacyFoundryEvent` 适配。
  - `telemetry_metrics` 和 benchmark 改为消费 dotted event type。
  - Vitest 增加 `@usora/integration` alias，匹配 TypeScript path alias。
- 验证：
  - `bun run typecheck` ✅
  - `bun run build:foundry` ✅
  - `bunx vitest run test/integration/integration-package.test.ts test/integration/foundry-baseline.test.ts test/integration/foundry-migration.test.ts` ✅
  - `bunx vitest run test/integration/foundry-context-budget-telemetry.test.ts test/integration/foundry-governance.test.ts test/integration/foundry-runtime-feedback.test.ts test/integration/foundry-skill-evolution.test.ts` ✅
  - `bunx vitest run test/integration/foundry-baseline.test.ts test/integration/foundry-migration.test.ts test/integration/foundry-context-budget-telemetry.test.ts test/integration/integration-package.test.ts` ✅
  - `bunx prettier --check plugins/foundry/package.json plugins/foundry/src/core/storage.ts plugins/foundry/src/core/events.ts plugins/foundry/src/core/context-budget.ts scripts/foundry-token-benchmark.ts test/integration/foundry-baseline.test.ts test/integration/foundry-migration.test.ts test/integration/foundry-context-budget-telemetry.test.ts test/integration/foundry-governance.test.ts test/integration/foundry-runtime-feedback.test.ts test/integration/foundry-skill-evolution.test.ts vitest.config.ts` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - Vitest 不自动使用 `tsconfig.base.json` path aliases；已在 `vitest.config.ts` 显式补 `@usora/integration`。
- 后续影响：
  - C2 subscription matcher 可直接消费 dotted `UsoraEvent.type`。
  - C3-C9 delivery runtime 的 dedup key 可以稳定使用 `event.id`。

## C2. Subscription

- [x] schema。
- [x] matcher。
- [x] provider target。
- [x] message builder。
- [x] config。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:22
- 实际修改：
  - `packages/integration/src/subscriptions.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IntegrationSubscription` 与 `IntegrationSubscriptionConfig`。
  - 新增 `matchSubscriptions`，按 `event.type` 匹配 enabled subscription。
  - 新增 `MessageBuilder` / `MessageBuilderRegistry` 与 `buildSubscriptionMessage`。
  - subscription 明确包含 `provider` target 与 message builder id。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bunx prettier --check packages/integration/src/subscriptions.ts packages/integration/src/index.ts test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - C9 runtime 可串联 Event -> Subscription -> Message -> Provider，不需要 provider-specific `if event.type`。

## C3. Delivery Record

- [x] pending。
- [x] delivering。
- [x] delivered。
- [x] failed。
- [x] dead-letter。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:24
- 实际修改：
  - `packages/integration/src/delivery.ts`
  - `packages/integration/src/index.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `DeliveryRecord` 和状态：pending、delivering、delivered、failed、dead-letter。
  - 新增 `deliveryDedupKey(provider, subscription, event)`，使用 provider + subscription + event.id。
  - 新增 `createDeliveryRecord` 与 `updateDeliveryRecord`，delivering 会增加 attempts。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bunx prettier --check packages/integration/src/delivery.ts packages/integration/src/index.ts test/integration/integration-package.test.ts` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - C4/C5/C6/C7/C9 可复用同一个 delivery id 和状态模型。

## C4. Checkpoint

- [x] ordering。
- [x] crash recovery。
- [x] failed event safety。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:26
- 实际修改：
  - `packages/integration/src/delivery.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `IntegrationCheckpoint`。
  - 新增 `advanceCheckpoint`：只有 delivered delivery 才推进 checkpoint，并按 `occurredAt` 防止倒退。
  - 新增 `readCheckpoint` / `writeCheckpoint`，使用 temp + rename 原子写本地 JSON 文件。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
  - `bunx prettier --check packages/integration/src/delivery.ts test/integration/integration-package.test.ts` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - C9 runtime 在 provider 成功送达后调用 `advanceCheckpoint`，失败事件不会推进 checkpoint。

## C5. Idempotency

- [x] dedup key。
- [x] duplicate event。
- [x] duplicate delivery。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:27
- 实际修改：
  - `packages/integration/src/delivery.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `BLOCKING_DELIVERY_STATUSES` 和 `shouldStartDelivery`。
  - 同一 dedup key 下，`delivering`、`delivered`、`dead-letter` 状态阻止重复启动投递。
  - `pending` 和 `failed` 允许继续处理或重试。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
  - `bunx prettier --check packages/integration/src/delivery.ts test/integration/integration-package.test.ts` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 无
- 后续影响：
  - C9 runtime 应在启动 provider side effect 前调用 `shouldStartDelivery`。

## C6. Retry

- [x] retryable errors。
- [x] bounded exponential backoff。
- [x] max attempts。
- [x] config。

#### 执行记录

- 状态：已完成
- 完成时间：2026-09-03 19:29
- 实际修改：
  - `packages/integration/src/delivery.ts`
  - `test/integration/integration-package.test.ts`
  - `product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`
- 实现摘要：
  - 新增 `RetryConfig` 和 `DEFAULT_RETRY_CONFIG`。
  - 新增 `isRetryableDeliveryError`、`retryDelayMs`、`scheduleRetry`。
  - Retry 使用 bounded exponential backoff；超过 max attempts 或 non-retryable error 进入 dead-letter。
- 验证：
  - `bun run --cwd packages/integration typecheck` ✅
  - `bunx vitest run test/integration/integration-package.test.ts` ✅
  - `bun run typecheck` ✅
  - `bunx prettier --check packages/integration/src/delivery.ts test/integration/integration-package.test.ts` ✅
- 与原计划偏差：
  - 无
- 新发现：
  - 初版测试暴露 attempts 计数已代表当前尝试次数，backoff 不应再 +1；已修复。
- 后续影响：
  - C9 runtime 可在 provider error 后调用 `scheduleRetry`，无需各 provider 自己实现重试策略。

## C7. Dead Letter

- [x] persistence。
- [x] diagnostics。
- [x] replay。

完成记录：

- 实现：
  - 在 `@usora/integration` delivery 模块中新增 dead-letter 文件读写：
    - `writeDeadLetter(file, record)`。
    - `readDeadLetter(file)`。
  - 新增诊断摘要：
    - `deadLetterDiagnostic(record)`。
  - 新增人工重放入口：
    - `replayDeadLetter(record, now)`。
- 设计决策：
  - 复用 `DeliveryRecord` 和既有原子 JSON 写入模式，不新增独立 dead-letter 存储抽象。
  - 重放时将状态重置为 `pending`、`attempts` 重置为 `0`，并移除 `error` / `nextAttemptAt`，让人工重放成为一次干净的新投递。
- 验证：
  - `bunx vitest run test/integration/integration-package.test.ts`。
- 后续影响：
  - C9 runtime 可在重试耗尽后写入 dead-letter，并在运维/命令入口中展示 `deadLetterDiagnostic`。

## C8. Provider Registry

- [x] registration。
- [x] duplicate provider。
- [x] capability validation。
- [x] disabled provider。

完成记录：

- 实现：
  - 在 `@usora/integration` providers 模块中新增 `createProviderRegistry`。
  - 支持 `register` / `get` / `require` / `list`。
  - provider 注册时复用 `assertProviderContract` 校验能力声明。
  - duplicate provider id 注册直接失败。
  - `enabled: false` provider 保留可查询，但不进入 runtime 可用列表。
- 验证：
  - `bunx vitest run test/integration/integration-package.test.ts`。
  - `bun run --cwd packages/integration typecheck`。
  - `bun run typecheck`。
  - `bunx prettier --check packages/integration/src/providers.ts packages/integration/src/delivery.ts test/integration/integration-package.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。
- 后续影响：
  - C9 runtime 可从 registry 中按 capability 选择启用 provider，避免把 disabled provider 纳入投递。

## C9. Runtime

- [x] event read。
- [x] subscription。
- [x] message build。
- [x] provider delivery。
- [x] record。
- [x] checkpoint。
- [x] diagnostics。

验收：

```text
Fake Provider 可以稳定消费真实 Usora Event。
重启不丢。
重复读取不重复产生最终副作用。
失败可 Retry / Dead Letter / Replay。
```

### Phase C 阶段验收记录

> Codex 回写。

完成记录：

- 实现：
  - 新增 `@usora/integration` runtime：
    - `readUsoraEventFile(file)`。
    - `readUsoraEventFiles(files)`。
    - `runIntegrationRuntime(input)`。
  - runtime 支持：
    - 读取新 `UsoraEvent` 文件。
    - 读取 legacy Foundry event 文件并适配为 dotted event。
    - subscription match。
    - message builder。
    - provider messaging delivery。
    - delivery record 本地持久化。
    - checkpoint advance/write。
    - retry/dead-letter diagnostics。
  - delivery 模块补充通用 record persistence：
    - `readDeliveryRecord(file)`。
    - `writeDeliveryRecord(file, record)`。
- 验收：
  - Fake Provider 可稳定消费真实 `UsoraEvent` 文件。
  - 第二次 runtime 读取同一事件时命中 delivered record，不重复发送 provider message。
  - checkpoint 写入本地 JSON，重启后可恢复幂等状态。
  - legacy Foundry event 可被读取并进入同一 runtime。
  - 失败 provider 在 retry 耗尽后进入 dead-letter，并输出 diagnostics。
- 验证：
  - `bunx vitest run test/integration/integration-package.test.ts`，16 tests passed。
  - `bun run --cwd packages/integration typecheck`。
  - `bun run typecheck`。
  - `bunx prettier --check packages/integration/src/runtime.ts packages/integration/src/index.ts packages/integration/src/providers.ts packages/integration/src/delivery.ts test/integration/integration-package.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

Phase C 结论：完成。集成核心现已具备 provider-neutral event、subscription、message、delivery、retry、dead-letter、checkpoint、registry 与最小 runtime，可进入 Phase D DingTalk Plugin Foundation。

---

# Phase D — DingTalk Plugin Foundation

## D1. Plugin

- [x] 创建 `plugins/dingtalk`。
- [x] manifest。
- [x] package。
- [x] build entry。
- [x] tests。
- [x] marketplace。
- [x] release。

完成记录：

- 实现：
  - 新增 `plugins/dingtalk` 插件骨架。
  - 新增 plugin manifest：
    - `plugins/dingtalk/plugin.json`。
    - `.codex-plugin/plugin.json`。
    - `.codebuddy-plugin/plugin.json`。
  - 新增 MCP 配置：
    - `plugins/dingtalk/.mcp.json`。
    - `plugins/dingtalk/.codebuddy-plugin/mcp.json`。
  - 新增 build entry：
    - `src/cli/mcp.ts`，提供最小 JSON-RPC `tools/list` 响应。
    - `src/hooks/session-hook.ts`，提供可打包 session hook stub。
  - 新增插件所需发布目录：
    - `assets/logo.txt`。
    - `skills/dingtalk/SKILL.md`。
    - `hooks/codex-hooks.json`。
    - `hooks/codebuddy-hooks.json`。
  - 同步 marketplace 元数据与 artifacts marketplace。
- 设计决策：
  - D1 只建立可发现、可构建、可打包、可启动的插件壳。
  - 不在 D1 提前实现真实 DingTalk transport；D2/D4 负责 provider 与 webhook。
- 验证：
  - `bun tooling/discover-plugins.ts --names`，返回 `["dingtalk","foundry"]`。
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun tooling/package-plugin.ts dingtalk --check`。
  - `bunx vitest run test/integration/plugin-platform.test.ts`，9 tests passed。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk package.json marketplace.json .agents/plugins/marketplace.json .codebuddy-plugin/marketplace.json product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。
- 后续影响：
  - D2 可在插件内部新增 DingTalk provider，并通过已存在的 plugin build/package 路径输出到 dist。

## D2. Provider

- [x] ID。
- [x] capability。
- [x] registry。
- [x] startup validation。

完成记录：

- 实现：
  - 新增 DingTalk provider factory：
    - `DINGTALK_PROVIDER_ID`。
    - `createDingTalkProvider(messaging)`。
  - 新增 provider registry helper：
    - `createDingTalkProviderRegistry(provider)`。
  - 新增 startup validation：
    - `assertDingTalkStartup(provider)`。
- 设计决策：
  - D2 只定义 provider 身份、能力声明、registry 接入和启动校验。
  - 真实 DingTalk webhook/app transport 留给 D4/D5，通过 `MessagingCapability.sendMessage` 注入。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，2 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/provider.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## D3. Config

- [x] enabled。
- [x] transport。
- [x] capabilities。
- [x] subscriptions。
- [x] env secrets。
- [x] redaction。

完成记录：

- 实现：
  - 新增 DingTalk config 模块：
    - `resolveDingTalkConfig(input, env)`。
    - `redactDingTalkConfig(config)`。
    - `DEFAULT_DINGTALK_ENV`。
  - 支持：
    - `enabled`。
    - `transport`：`webhook` / `app`。
    - provider capabilities。
    - subscriptions。
    - env secret names。
    - resolved secrets。
    - redacted config 输出。
- 设计决策：
  - 默认 `enabled: false`，本地无钉钉密钥时仍可构建/测试。
  - secret value 只从 env 解析，不写入静态 manifest。
  - webhook/app 的必需 env 仅在 enabled 时校验。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，3 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/config.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## D4. Webhook Transport

- [x] send。
- [x] signing。
- [x] timeout。
- [x] normalized error。
- [x] tests。

完成记录：

- 实现：
  - 新增 DingTalk webhook transport：
    - `createDingTalkWebhookTransport(options)`。
    - `renderDingTalkWebhookMessage(message)`。
    - `dingTalkWebhookUrl(url, timestamp, secret)`。
    - `signDingTalkWebhook(timestamp, secret)`。
  - 支持：
    - neutral `IntegrationMessage` 转 DingTalk markdown payload。
    - webhook POST。
    - `timestamp + "\n" + secret` HMAC-SHA256 Base64 URL encode 签名。
    - timeout abort。
    - HTTP/API/timeout/error 归一化为 `IntegrationCommandResult`。
- 设计决策：
  - D4 只实现 webhook transport，不提前做 actionCard/card renderer；后续 D8 处理卡片渲染。
  - 测试使用 fake fetch，不访问真实 DingTalk 网络，也不需要真实 secret。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，5 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/webhook.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## D5. App Transport

- [x] token。
- [x] cache。
- [x] expiry。
- [x] client。
- [x] errors。
- [x] tests。

完成记录：

- 实现：
  - 新增 DingTalk App API client：
    - `createDingTalkAppClient(options)`。
    - `getAccessToken(force?)`。
    - `request(pathname, init?)`。
  - 支持：
    - access token 获取。
    - token cache。
    - 过期前 60 秒刷新。
    - `x-acs-dingtalk-access-token` 请求头。
    - HTTP/API/token response 错误归一化。
- 设计决策：
  - D5 只实现 App API token/client 基础，不提前做 Phase E 的消息渲染或具体业务发送 API。
  - 使用 fake fetch 覆盖 token/cache/error 行为，不访问真实 DingTalk 网络。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，7 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/app.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

### Phase D 阶段验收记录

> Codex 回写。

完成记录：

- DingTalk plugin foundation 已具备：
  - 可发现、可构建、可打包、可启动的插件骨架。
  - provider ID/capability/registry/startup validation。
  - enabled/transport/capabilities/subscriptions/env secrets/redaction 配置。
  - webhook transport。
  - app transport token/client 基础。
- 仍延后：
  - 具体 outbound renderer 与业务消息 builder 在 Phase E。
  - callback/identity/interaction 在 Phase F。
  - 真实端到端钉钉环境验证在 Phase H。

Phase D 结论：完成。

---

# Phase E — DingTalk Outbound

## E1. Renderer

- [x] text。
- [x] markdown。
- [x] card。
- [x] fallback。

完成记录：

- 实现：
  - 新增 DingTalk outbound renderer：
    - `renderDingTalkText(message)`。
    - `renderDingTalkMarkdown(message)`。
    - `renderDingTalkCard(message)`。
    - `renderDingTalkWebhookMessage(message)`。
  - webhook transport 改为复用 renderer。
- 设计决策：
  - actionCard 只渲染带 `metadata.url` 且是 http/https 的 action。
  - 没有可用 action URL 时 fallback 到 markdown，不生成虚假链接。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，8 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/renderer.ts plugins/dingtalk/src/webhook.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## E2. Candidate

- [x] CandidateCreated builder。
- [x] evidence。
- [x] confidence。
- [x] source。
- [x] actions。

完成记录：

- 实现：
  - 新增 `createCandidateCreatedMessage(event)`。
  - 输出 provider-neutral `IntegrationMessage`，由 E1 renderer 负责 DingTalk payload。
  - 包含：
    - candidate title/summary。
    - confidence。
    - source。
    - evidence facts。
    - approve/reject actions。
    - foundry candidate resource reference。
- 设计决策：
  - action 不生成 URL；当前 renderer 会 fallback markdown，后续 Phase F interaction 再接真实回调 URL。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，9 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/builders.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## E3. Skill Published

- [x] skill。
- [x] version。
- [x] summary。
- [x] link。

完成记录：

- 实现：
  - 新增 `createSkillPublishedMessage(event)`。
  - 包含：
    - skill name。
    - revision/version。
    - description summary。
    - published timestamp。
    - optional URL action/resource。
- 设计决策：
  - 有 `url` 时 renderer 输出 actionCard。
  - 无 `url` 时仍能用 markdown/text 呈现，不阻塞发送。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，10 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/builders.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## E4. Governance

- [x] finding。
- [x] reason。
- [x] suggestion。
- [x] actions。

完成记录：

- 实现：
  - 新增 `createGovernanceMessage(event)`。
  - 支持 governance finding/resolved 数据：
    - finding/action。
    - skill。
    - reason。
    - suggestion。
    - target/state。
    - keep/evolve actions。
- 设计决策：
  - actions 保持 provider-neutral command metadata，不提前生成 Phase F callback URL。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，11 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/builders.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## E5. Foundry Digest

- [x] metrics。
- [x] summary。
- [x] card。

完成记录：

- 实现：
  - 新增 `createFoundryDigestMessage(event)`。
  - 支持：
    - activity/candidate/skill/governance 计数。
    - 额外 metrics。
    - digest summary。
    - renderer markdown card 输出。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，12 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/builders.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## E6. E2E

```text
Event
→ Subscription
→ IntegrationMessage
→ DingTalk Renderer
→ Transport
→ DeliveryRecord
```

完成记录：

- 实现：
  - 新增 DingTalk outbound E2E wiring test。
  - 使用真实 `UsoraEvent` 文件、subscription、`createCandidateCreatedMessage`、DingTalk webhook transport fake fetch、integration runtime 和 persisted delivery record。
- 验收：
  - Event → Subscription → IntegrationMessage → DingTalk Renderer → Transport → DeliveryRecord 链路通过。
  - delivery record 最终状态为 `delivered`。
  - fake webhook 收到 DingTalk markdown payload。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，13 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/builders.ts plugins/dingtalk/src/renderer.ts plugins/dingtalk/src/webhook.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

### Phase E 阶段验收记录

> Codex 回写。

完成记录：

- DingTalk outbound 已具备：
  - text/markdown/actionCard renderer 与 fallback。
  - CandidateCreated builder。
  - SkillPublished builder。
  - Governance builder。
  - Foundry Digest builder。
  - Event 到 DingTalk transport 到 DeliveryRecord 的 E2E 测试链路。
- 仍延后：
  - Phase F 负责 callback、identity、interaction 与真实 action URL。
  - Phase H 负责真实 DingTalk 环境验收。

Phase E 结论：完成。

---

# Phase F — Identity & Interaction

## F1. Callback

- [x] receiver。
- [x] authenticity verification。
- [x] schema validation。
- [x] malformed rejection。

完成记录：

- 实现：
  - 新增 `parseDingTalkCallback(input)`。
  - 支持：
    - callback JSON body 解析。
    - callback/action/user/corp 字段归一化。
    - 可选 secret 签名校验。
    - malformed body 拒绝。
    - 缺必需字段拒绝。
- 设计决策：
  - F1 只实现可测试 receiver 函数，不引入 HTTP server。
  - callback signature 使用与当前 webhook secret 一致的 HMAC helper；真实线上兼容性留给 Phase H 环境验收。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，14 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/callback.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## F2. Duplicate / Replay

- [x] callback ID。
- [x] replay protection。
- [x] duplicate action。

完成记录：

- 实现：
  - 新增 callback receipt：
    - `DingTalkCallbackReceipt`。
    - `dingTalkCallbackReceiptFile(root, callbackId)`。
    - `readDingTalkCallbackReceipt(file)`。
    - `claimDingTalkCallback(root, callback, now)`。
  - 使用 callback id 作为幂等 key。
  - 使用文件 `wx` 独占写入实现重启后 duplicate/replay protection。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，15 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/callback.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## F3. Identity

- [x] DingTalk User。
- [x] Tenant/Corp。
- [x] Actor mapping。
- [x] unmapped user。

完成记录：

- 实现：
  - 新增 DingTalk identity 模块：
    - `dingTalkExternalIdentity(input)`。
    - `dingTalkIdentityFromCallback(callback)`。
    - `createDingTalkIdentityResolver(mapping)`。
  - 支持：
    - DingTalk user id。
    - corp/tenant id。
    - external identity 到内部 actor id 映射。
    - unmapped user 返回 `null`。
- 设计决策：
  - 复用 `@usora/integration` 的 `ExternalIdentity` / `IdentityResolver` / `UsoraActor`。
  - 不在 DingTalk 插件里新增独立用户模型。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，16 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/identity.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## F4. Authorization

- [x] read。
- [x] candidate。
- [x] governance。
- [x] Maintainer。

完成记录：

- 实现：
  - 新增 `createDingTalkAuthorizer(maintainerId)`。
  - 权限集合：
    - read：`hub.status` / `candidate.view` / `skill.get` / `digest.get`。
    - candidate：`candidate.approve` / `candidate.reject`。
    - governance：`governance.keep` / `governance.evolve` / `governance.deprecate` / `governance.retire`。
    - Maintainer-only：`governance.deprecate` / `governance.retire`。
- 设计决策：
  - 保持 `@usora/integration` `Authorizer` 接口。
  - 未知 DingTalk permission 默认拒绝。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，17 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/authorization.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## F5. Actions

- [x] candidate.view
- [x] candidate.approve
- [x] candidate.reject
- [x] governance.keep
- [x] governance.evolve
- [x] governance.deprecate
- [x] governance.retire
- [x] foundry.run

完成记录：

- 实现：
  - 新增 `DINGTALK_ACTIONS`。
  - 新增 `createDingTalkActionCommand(callback, actor, issuedAt)`。
  - action 到 command 映射：
    - `candidate.view` → `candidate.get`。
    - `candidate.approve` → `candidate.approve`。
    - `candidate.reject` → `candidate.reject`。
    - `governance.keep/evolve/deprecate/retire` → `governance.resolve` + action args。
    - `foundry.run` → `foundry.run`。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，18 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/actions.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## F6. Dispatch

```text
Action
→ Command
→ Authorization
→ Domain
→ Event
→ DingTalk Feedback
```

完成记录：

- 实现：
  - 新增 `dispatchDingTalkCallback(input)`。
  - 串联：
    - `claimDingTalkCallback`。
    - DingTalk identity resolver。
    - DingTalk action authorization。
    - `createDingTalkActionCommand`。
    - `dispatchIntegrationCommand`。
- 验收：
  - 授权用户 callback 可 dispatch 到 command registry。
  - duplicate callback 不重复执行 command。
  - 未授权 destructive governance action 被拒绝。
  - unmapped DingTalk user 被拒绝。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，19 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/dispatch.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

验收：

```text
授权 Maintainer 可以从钉钉完成治理。
未授权用户不能执行 destructive action。
重复点击不会重复执行。
```

### Phase F 阶段验收记录

> Codex 回写。

完成记录：

- DingTalk identity & interaction 已具备：
  - callback receiver、签名校验、schema validation、malformed rejection。
  - callback receipt 幂等与 replay protection。
  - DingTalk user/corp 到 `UsoraActor` 的 identity resolver。
  - read/candidate/governance/Maintainer authorization。
  - action id 到 integration command 的映射。
  - callback dispatch 到 command registry 的完整测试链路。
- 仍延后：
  - 真实 HTTP callback receiver 与钉钉线上验收留给 Phase H。
  - Bot command parsing 在 Phase G。

Phase F 结论：完成。

---

# Phase G — DingTalk Bot Commands

## G1. Inbound Message

- [x] envelope。
- [x] actor。
- [x] conversation。
- [x] text。

完成记录：

- 实现：
  - 新增 `parseDingTalkInboundMessage(payload)`。
  - 归一化：
    - message id。
    - DingTalk actor external identity。
    - conversation id/title/corp。
    - text content。
    - raw payload。
- 设计决策：
  - G1 只做 inbound envelope，不做命令解析；G2 处理 parser。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，20 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/inbound.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## G2. Parser

- [x] status。
- [x] candidates。
- [x] candidate。
- [x] skill。
- [x] governance。
- [x] foundry run。
- [x] digest。

完成记录：

- 实现：
  - 新增 `parseDingTalkBotCommand(text)`。
  - 支持：
    - `/status` → `hub.status`。
    - `/candidates` → `candidate.list`。
    - `/candidate <id>` → `candidate.get`。
    - `/skill <name>` → `skill.get`。
    - `/governance` → `governance.scan`。
    - `/foundry run` → `foundry.run`。
    - `/digest` → `digest.get`。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，21 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/parser.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## G3. Responses

- [x] status。
- [x] list。
- [x] detail。
- [x] permission denied。
- [x] error。

完成记录：

- 实现：
  - 新增 `createDingTalkBotResponse(command, result)`。
  - 支持：
    - status response。
    - list response。
    - detail response。
    - permission denied response。
    - generic error response。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，22 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/responses.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

验收：

```text
钉钉成为安全的 Usora Remote Console。
```

### Phase G 阶段验收记录

> Codex 回写。

完成记录：

- DingTalk bot command 已具备：
  - inbound message envelope 归一化。
  - text command parser。
  - status/candidates/candidate/skill/governance/foundry run/digest 命令映射。
  - status/list/detail/permission denied/error response builder。
- 验收：
  - 钉钉可作为安全 Usora Remote Console 的核心解析与响应层。
  - 真实网络入口仍留给 Phase H/后续环境集成。

Phase G 结论：完成。

---

# Phase H — DingTalk Resources

## H1. Mapping

- [x] Document。
- [x] Log。
- [x] Todo。
- [x] Conversation。
- [x] Message。
- [x] 可选 Calendar。
- [x] 可选 AI Table。

完成记录：

- 实现：
  - 新增 DingTalk resource mapper：
    - `DINGTALK_RESOURCE_TYPES`。
    - `mapDingTalkResource(input)`。
    - `createDingTalkResourceProvenance(resource, capturedBy, capturedAt)`。
  - 映射：
    - Document → `IntegrationResource.type=document`。
    - Log → `log`。
    - Todo → `todo`。
    - Conversation → `conversation`。
    - Message → `message`。
    - Calendar → `calendar`。
    - AI Table → `document` + `metadata.dingtalkType=ai-table`。
- 设计决策：
  - 复用 `@usora/integration` `IntegrationResource` / `ResourceProvenance`。
  - 可选 AI Table 暂按 document 资源处理，保留原始 DingTalk 类型在 metadata，避免扩展核心资源枚举。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，23 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/resources.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## H2. Discovery

- [x] list/search。
- [x] scope。
- [x] permission。

完成记录：

- 实现：
  - 新增 `discoverDingTalkResources(input)`。
  - 支持：
    - resource list。
    - text search。
    - type filter。
    - corp/conversation scope。
    - `resource.read` permission gate。
- 设计决策：
  - H2 只实现 discovery 核心过滤与权限门禁；真实 DingTalk API list/search 留给后续配置接入。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，24 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/resources.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## H3. Read

- [x] content。
- [x] metadata。
- [x] provenance。
- [x] deleted/inaccessible。

完成记录：

- 实现：
  - 新增 `readDingTalkResource(resource, capturedBy, capturedAt)`。
  - 支持：
    - content。
    - metadata。
    - provenance。
    - deleted/inaccessible 返回 `null`。
- 设计决策：
  - H3 只实现 read normalization，不访问真实 DingTalk API。
  - 读取结果保留 `ResourceProvenance`，供 Phase I manual capture 复用。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，25 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/resources.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

### Phase H 阶段验收记录

> Codex 回写。

完成记录：

- DingTalk resources 已具备：
  - document/log/todo/conversation/message/calendar/AI table 到 `IntegrationResource` 的映射。
  - list/search discovery。
  - scope 过滤。
  - permission gate。
  - content/metadata/provenance read。
  - deleted/inaccessible handling。
- 仍延后：
  - 真实 DingTalk API resource discovery/read 接入留给 Phase I/H 后续真实环境联调。

Phase H 结论：完成。

---

# Phase I — DingTalk Practice Source

## I1. Source Capability

- [x] provider implementation。
- [x] normalization。
- [x] Foundry input integration。

完成记录：

- 实现：
  - 新增 DingTalk practice source：
    - `normalizeDingTalkResourceActivity(resource, capturedBy, capturedAt)`。
    - `createDingTalkSourceCapability(resources)`。
  - 支持：
    - DingTalk resource read result → Foundry `activity_capture` 输入形状。
    - source capability `capture(resource)`。
    - unavailable resource 返回 `DINGTALK_RESOURCE_UNAVAILABLE`。
- 设计决策：
  - I1 不直接 import Foundry core；输出 Foundry activity capture args，由 I2/manual capture 或 MCP handler 负责提交。
  - 复用 H3 `readDingTalkResource` 和 provenance。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，26 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/source.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## I2. Manual Capture

- [x] document。
- [x] conversation。
- [x] log。
- [x] provenance。
- [x] Activity。

完成记录：

- 实现：
  - 新增 `manualCaptureDingTalkResource(resource, capturedBy, capturedAt)`。
  - 支持手动捕获：
    - `document`。
    - `conversation`。
    - `log`。
  - 复用 I1 normalization，输出 Foundry `activity_capture` 输入形状。
  - provenance 写入 `metadata.provenance`，resource 写入 `metadata.resource`。
- 设计决策：
  - 手动捕获只允许 Practice Source 需要的三类资源；`todo` 等非内容资源返回 `DINGTALK_CAPTURE_UNSUPPORTED`。
  - deleted / inaccessible 资源沿用 H3 read gate，返回 `DINGTALK_RESOURCE_UNAVAILABLE`。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，27 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。

## I3. Controlled Automatic Capture

- [x] allowlist。
- [x] scope。
- [x] retention。
- [x] dedup。
- [x] privacy。

完成记录：

- 实现：
  - 新增 `automaticCaptureDingTalkResources(resources, policy)`。
  - policy 支持：
    - `allowlist`。
    - `scope.corpId` / `scope.conversationId`。
    - `retentionDays` + `now`。
    - `seenResourceIds` 以及同批次 dedup。
    - `capturedBy` provenance。
  - privacy gate 跳过：
    - `metadata.private === true`。
    - `metadata.sensitive === true`。
    - `metadata.visibility === "private"`。
- 设计决策：
  - 自动捕获只做策略过滤和 activity input 归一化，不直接写 Foundry，也不创建后台 scheduler。
  - 无可捕获资源返回 `ok: true, data: []`，便于调用方安全轮询。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，28 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/source.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## I4. E2E

```text
DingTalk
→ PracticeSource
→ Activity
→ Pattern
→ Candidate
```

完成记录：

- 实现：
  - 新增端到端测试：
    - DingTalk resource。
    - `automaticCaptureDingTalkResources`。
    - Foundry `activity_capture`。
    - Foundry `pattern_index`。
    - Foundry `candidate_create`。
  - 验证 Candidate 保留：
    - Pattern fingerprint。
    - Activity evidence refs。
    - contributing source hosts。
- 设计决策：
  - I4 使用真实 Foundry MCP dist 走现有工具边界，不在 DingTalk 插件内复制 Pattern/Candidate 逻辑。
  - Candidate 创建保持显式动作，自动候选判定留给 Foundry 既有 resolver/intelligence 流程。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，29 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/source.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

### Phase I 阶段验收记录

> Codex 回写。

- 范围：
  - I1 Source Capability 完成。
  - I2 Manual Capture 完成。
  - I3 Controlled Automatic Capture 完成。
  - I4 E2E 完成。
- 验收：
  - DingTalk resource 可归一化为 Foundry `activity_capture` 输入。
  - 手动捕获支持 document / conversation / log。
  - 自动捕获支持 allowlist / scope / retention / dedup / privacy。
  - DingTalk source activity 可进入 Foundry Activity、Pattern、Candidate 链路。
- 最终验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，29 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check plugins/dingtalk/src/source.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

---

# Phase J — Developer Experience

## J1. Testing SDK

- [x] `createIntegrationHarness`
- [x] `assertProviderContract`
- [x] mock event
- [x] mock identity
- [x] mock action
- [x] mock resource

完成记录：

- 实现：
  - 新增 `packages/integration/src/testing.ts` 并从 package index export。
  - Testing SDK 提供：
    - `createIntegrationHarness({ stateDir })`。
    - `mockIntegrationEvent`。
    - `mockIntegrationIdentity`。
    - `mockIntegrationAction`。
    - `mockIntegrationResource`。
  - `assertProviderContract` 继续复用既有 provider contract export。
- 设计决策：
  - Harness 复用真实 `runIntegrationRuntime`、provider registry、subscription、message builder，不另写 fake runtime。
  - `stateDir` 由测试显式传入，避免 SDK 偷偷管理临时目录生命周期。
- 验证：
  - `bun run --cwd packages/integration typecheck`。
  - `bunx vitest run test/integration/integration-package.test.ts`，17 tests passed。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts test/integration/integration-package.test.ts`，46 tests passed。
  - `bun run typecheck`。
  - `bunx prettier --check packages/integration/src/testing.ts packages/integration/src/index.ts test/integration/integration-package.test.ts test/integration/dingtalk-plugin.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## J2. Doctor / Diagnostics

- [x] provider status。
- [x] config。
- [x] auth。
- [x] last success。
- [x] last failure。
- [x] checkpoint。
- [x] retry。
- [x] dead-letter。

完成记录：

- 实现：
  - 新增 `doctorDingTalkIntegration(input)`。
  - 诊断输出覆盖：
    - provider contract / enabled / capabilities。
    - redacted config。
    - auth decision。
    - last delivered。
    - last failed / dead-letter。
    - checkpoint。
    - retry config。
    - dead-letter diagnostics。
- 设计决策：
  - Doctor 不扫描磁盘；调用方显式传入 delivery/checkpoint/dead-letter 记录。
  - 复用 `assertProviderContract`、`redactDingTalkConfig`、`deadLetterDiagnostic`。
- 验证：
  - `bun run --cwd plugins/dingtalk typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts`，30 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts test/integration/integration-package.test.ts`，47 tests passed。
  - `bunx prettier --check plugins/dingtalk/src/doctor.ts plugins/dingtalk/src/index.ts test/integration/dingtalk-plugin.test.ts packages/integration/src/testing.ts packages/integration/src/index.ts test/integration/integration-package.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## J3. Plugin Generator

只有 DingTalk 架构稳定后才执行。

评估：

```text
bun run plugin:create feishu --type integration
```

是否值得支持。

- [x] 提取稳定模板。
- [x] integration plugin kind。
- [x] generator tests。

完成记录：

- 实现：
  - `tooling/create-plugin.ts` 支持：
    - `bun run plugin:create <name>`。
    - `bun run plugin:create <name> --type integration`。
  - 抽出可测试函数 `createPlugin({ root, name, type })`。
  - integration plugin kind 生成：
    - `plugin.json` keywords：`integration` + plugin name。
    - `src/provider.ts`。
    - `src/index.ts`。
    - `package.json` dependency：`@usora/integration: workspace:*`。
- 评估：
  - `bun run plugin:create feishu --type integration` 值得支持，已在临时目录实测通过。
  - 当前模板只生成 provider skeleton，不生成 Feishu/DingTalk 业务逻辑。
- 验证：
  - `bunx vitest run test/integration/plugin-platform.test.ts`，10 tests passed。
  - `bun run typecheck`。
  - `bun D:\Usora\tooling\create-plugin.ts feishu --type integration`，临时目录实测通过。
  - `bunx prettier --check tooling/create-plugin.ts test/integration/plugin-platform.test.ts product-docs/usora-integration-platform-dingtalk-implementation-plan-zh-CN.md`。

## J4. Docs

- [x] Integration Architecture。
- [x] DingTalk Setup。
- [x] Webhook Mode。
- [x] App Mode。
- [x] Permission。
- [x] Environment Variables。
- [x] Troubleshooting。
- [x] Privacy。
- [x] Provider Authoring Guide。

完成记录：

- 文档：
  - `D:\usora-docs\content\docs\integration.mdx`。
  - `D:\usora-docs\content\docs\dingtalk.mdx`。
- 覆盖：
  - Integration Architecture。
  - DingTalk Setup。
  - Webhook Mode。
  - App Mode。
  - Permission。
  - Environment Variables。
  - Troubleshooting。
  - Privacy。
  - Provider Authoring Guide。
- 验证：
  - `bun run typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts test/integration/integration-package.test.ts test/integration/plugin-platform.test.ts`，57 tests passed。
  - `pnpm exec prettier --check content/docs/integration.mdx content/docs/dingtalk.mdx content/docs/meta.json`。

### Phase J 阶段验收记录

> Codex 回写。

- 范围：
  - J1 Testing SDK 完成。
  - J2 Doctor / Diagnostics 完成。
  - J3 Plugin Generator 完成。
  - J4 Docs 完成。
- 验收：
  - `@usora/integration` 提供测试 harness 和 mock factories。
  - DingTalk doctor 覆盖 provider、config、auth、delivery、checkpoint、retry、dead-letter。
  - `plugin:create --type integration` 可生成第二 provider 起点。
  - 文档覆盖架构、DingTalk 配置、排障、隐私与 provider authoring。
- 最终验证：
  - `bun run typecheck`。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts test/integration/integration-package.test.ts test/integration/plugin-platform.test.ts`，57 tests passed。
  - `bunx prettier --check` 针对本阶段变更文件通过。

---

# Phase K — 可扩展性证明

**必须执行。**

不要直接开发完整 Feishu。

创建：

```text
MockIntegrationProvider
```

或：

```text
ConsoleProvider
```

证明：

```text
candidate.created
      │
      ├── DingTalk
      └── Test Provider
```

要求：

- [x] 第二 Provider 注册成功。
- [x] 使用同一个 Event。
- [x] 使用同一个 IntegrationMessage。
- [x] Contract Tests 通过。
- [x] Foundry 无修改。
- [x] 不因为第二 Provider 修改 DingTalk。
- [x] 不因为第二 Provider 被迫重构公共协议。

最终回答：

> 如果明天开始做 Feishu，需要修改哪些 Core 文件？

理想答案：

```text
0
```

除非飞书引入了真正新的跨平台 Capability。

### Phase K 阶段验收记录

> Codex 回写。

- 实现：
  - `@usora/integration` Testing SDK 新增 `createMockIntegrationProvider(id)`。
  - 新增 runtime fan-out 测试：
    - 同一个 `candidate.created` event。
    - 同一个 `candidate` message builder。
    - 同时投递到 `dingtalk` 和 `console` 两个 provider。
  - 两个 provider 收到相同 `IntegrationMessage`。
- 验收：
  - 第二 Provider 注册成功。
  - Contract validation 通过。
  - Foundry core 未因第二 provider 改动。
  - DingTalk plugin 未因第二 provider 改动。
  - 公共协议未因第二 provider 重构。
- 最终回答：
  - 如果明天开始做 Feishu，需要修改 Core 文件：`0`。
- 验证：
  - `bun run --cwd packages/integration typecheck`。
  - `bunx vitest run test/integration/integration-package.test.ts`，18 tests passed。
  - `bunx vitest run test/integration/dingtalk-plugin.test.ts test/integration/integration-package.test.ts test/integration/plugin-platform.test.ts`，58 tests passed。
  - `bun tooling/build-plugin.ts dingtalk`。
  - `bun run typecheck`。
  - `bunx prettier --check` 针对本阶段变更文件通过。

---

# Phase L — Full Verification & Release Readiness

## L1. Unit Tests

- [x] Integration。
- [x] DingTalk。
- [x] Foundry migration。

## L2. Integration Tests

- [x] outbound。
- [x] inbound。
- [x] callback。
- [x] identity。
- [x] authorization。
- [x] retry。
- [x] dead-letter。
- [x] replay。
- [x] source。

## L3. Crash Tests

- [x] send 后 checkpoint 前 crash。
- [x] duplicate event。
- [x] duplicate callback。
- [x] corrupted state。
- [x] missing config。

## L4. Migration Tests

- [x] legacy Hub fixture。
- [x] legacy Event fixture。
- [x] new reader。
- [x] new writer。

## L5. Repository Checks

必须实际执行仓库当前权威检查。

至少：

```bash
bun run format:check
bun run lint
bun run typecheck
bun run build
bun run package:check
bun run runtime:check
bun run marketplace:check
bun run test
bun run validate
bun run check
```

如果仓库脚本已经变化，以当前 `package.json` 为准。

**`bun run check` 未通过，不允许声明完成。**

### Phase L 阶段验收记录

> Codex 回写。

- 验收：
  - L1 Unit Tests 完成：Integration、DingTalk、Foundry migration。
  - L2 Integration Tests 完成：outbound、inbound、callback、identity、authorization、retry、dead-letter、replay、source。
  - L3 Crash Tests 完成：send 后 checkpoint 前 crash、duplicate event、duplicate callback、corrupted state、missing config。
  - L4 Migration Tests 完成：legacy Hub fixture、legacy Event fixture、new reader、new writer。
  - L5 Repository Checks 完成。
- 修复：
  - runtime 在重启后遇到已 delivered 但缺 checkpoint 的 delivery record 时，会补写 checkpoint 且不重复发送。
  - runtime 遇到 corrupted delivery state 时按 pending work 重新处理，避免崩溃。
  - `clean-runtime-test` 支持 DingTalk 这类 no-op session hook；只有 Foundry hook 必须写 Activity。
  - `validate-plugin` 支持多插件 marketplace，不再假设 marketplace metadata version 等于 Foundry version。
- 权威检查：
  - `bun run check` 完整通过。
  - 内含：
    - `bun run format:check`。
    - `bun run lint`。
    - `bun run typecheck`。
    - `bun run build`。
    - `bun run package:check`。
    - `bun run runtime:check`。
    - `bun run marketplace:check`。
    - `bun run test`，16 test files / 112 tests passed。
    - `bun run validate`。

---

# 24. 强制 E2E 场景

## Scenario 1

```text
Foundry
→ candidate.created
→ DingTalk Card
→ DeliveryRecord
```

## Scenario 2

```text
Delivery
→ crash
→ restart
→ no loss
→ no duplicate final side effect
```

## Scenario 3

```text
DingTalk Approve
→ callback verify
→ identity
→ authorization
→ candidate.approve
→ candidate.approved
→ feedback
```

## Scenario 4

```text
Non-Maintainer
→ RETIRE
→ denied
→ domain unchanged
```

## Scenario 5

```text
DingTalk outage
→ retry
→ dead-letter
→ replay
→ success
```

## Scenario 6

```text
DingTalk Document
→ PracticeSource
→ Activity
→ Foundry
```

## Scenario 7

```text
candidate.created
→ DingTalk Provider
→ Reference Provider
```

Foundry 不改。

完成记录：

- Scenario 1：`dingtalk-plugin.test.ts` 覆盖 Foundry `candidate.created` → DingTalk renderer/transport → DeliveryRecord。
- Scenario 2：`integration-package.test.ts` 覆盖 delivered record 已写、checkpoint 缺失时重启补 checkpoint 且不重复 side effect。
- Scenario 3：`dingtalk-plugin.test.ts` 覆盖 DingTalk approve callback 签名校验、identity、authorization、`candidate.approve`、`candidate.approved` event 和 feedback message。
- Scenario 4：`dingtalk-plugin.test.ts` 覆盖 Non-Maintainer 执行 RETIRE 被拒绝，domain state 不变。
- Scenario 5：`integration-package.test.ts` 覆盖 outage → retry/dead-letter → replay to pending。
- Scenario 6：`dingtalk-plugin.test.ts` 覆盖 DingTalk Document → PracticeSource → Activity → Foundry Pattern/Candidate。
- Scenario 7：`integration-package.test.ts` 覆盖 `candidate.created` 同时投递 DingTalk Provider 和 Reference Provider，Foundry 不改。
- 验证：
  - `bun run check` 完整通过，16 test files / 113 tests passed。

---

# 25. Codex 子 Agent / 模型选择规则

不要机械地所有任务都使用最高成本模型。

## 高推理任务

优先由主 Agent 或高推理模型完成：

```text
ADR
Public Contract
Event Migration
Delivery Semantics
Concurrency
Idempotency
Identity
Authorization
Security
Cross-plugin Boundary
Breaking Change
```

## 常规实现任务

可考虑普通实现模型 / 子 Agent：

```text
Renderer
Fixtures
Config parser
Docs
Simple API wrapper
Repetitive tests
Message builders
```

## 可并行条件

只有当：

```text
公共 Contract 已稳定
任务没有修改同一核心文件
Acceptance Criteria 清晰
```

才允许并行。

禁止在 Provider Contract 仍变化时让多个子 Agent 同时基于不同理解开发。

---

# 26. Codex 修改本计划时的规则

Codex 有权修改本计划。

但必须遵循：

### 可以直接调整

```text
文件路径
类名
函数名
任务执行顺序
内部实现方式
测试组织方式
```

### 必须 ADR + 回写原因

```text
Integration 边界变化
Local-first 被改变
Event Contract 大改
Identity 模型大改
Authorization 模型变化
Provider Capability 模型变化
引入服务端基础设施
Breaking Change
取消 Required Phase
```

### 禁止

为了更快完成而偷偷删除：

```text
Migration
Security
Idempotency
Extensibility Proof
Tests
Plan Writeback
```

---

# 27. Definition of Done

不是“能收到钉钉消息”就算完成。

必须：

- [x] `packages/integration` provider-neutral。
- [x] `plugins/dingtalk` 独立存在。
- [x] Foundry 不依赖 DingTalk。
- [x] DingTalk 不依赖 Foundry private implementation。
- [x] Event Contract versioned。
- [x] Legacy Event readable。
- [x] Subscription。
- [x] Durable Delivery。
- [x] Retry。
- [x] Idempotency。
- [x] Checkpoint。
- [x] Dead Letter。
- [x] Replay。
- [x] Candidate Notification。
- [x] Skill Published Notification。
- [x] Governance Notification。
- [x] Foundry Digest。
- [x] Callback Verification。
- [x] Identity Mapping。
- [x] Maintainer Authorization。
- [x] Candidate Approve / Reject。
- [x] Governance Action。
- [x] Bot Commands。
- [x] Resource Contract。
- [x] 至少一种真实 DingTalk Practice Source。
- [x] Testing Harness。
- [x] 第二 Provider Extensibility Proof。
- [x] Secrets Redaction。
- [x] Migration Tests。
- [x] Documentation。
- [x] Changelog。
- [x] 所有 Phase 已回写执行记录。
- [x] `bun run check` 通过。

---

# 28. 最终 Codex 报告

最终报告不是替代计划回写。

**先保证本计划所有状态已经正确回写，再生成最终报告。**

报告必须包含：

## Architecture

```text
最终目录
ADR
关键边界
与原计划偏差
```

## Implementation

```text
完成 Phase
新增文件
修改文件
Breaking Change
Migration
```

## DingTalk

```text
支持能力
配置
权限
Secrets
限制
```

## Extensibility

明确回答：

```text
现在实现 Feishu Provider 需要：

新增哪些文件？
实现哪些 Interface？
运行哪些 Contract Tests？
需要修改 Foundry 吗？
需要修改 packages/integration 吗？
```

## Verification

实际结果：

```text
format
lint
typecheck
build
package
runtime
marketplace
test
validate
bun run check
```

## Remaining

严格区分：

```text
Required but unfinished
Optional future evolution
```

不得把未完成 Required 工作包装成 Future Work。

完成记录：

## Architecture

- 最终目录：
  - `packages/integration`：provider-neutral contracts、runtime、testing SDK。
  - `plugins/dingtalk`：DingTalk provider、renderer、transport、callbacks、bot commands、resources、Practice Source、doctor。
  - `D:\usora-docs\content\docs\integration.mdx`：integration boundary、local-first delivery、capabilities、message model、command boundary、identity mapping、secret separation。
  - `D:\usora-docs\content\docs\dingtalk.mdx`：中文 DingTalk setup 与使用文档。
- 关键边界：
  - Foundry 只产出/读取 provider-neutral events，不依赖 DingTalk。
  - `@usora/integration` 不包含 DingTalk private schema。
  - DingTalk 插件不依赖 Foundry private implementation；只通过 Event、Message、Command、Resource、Activity input 形状交互。
  - Delivery 按 provider/subscription/event id 幂等，checkpoint/retry/dead-letter 独立持久化。
- 与原计划偏差：
  - I4 使用 Foundry MCP 既有 `activity_capture` / `pattern_index` / `candidate_create` 边界验证链路，没有在 DingTalk 插件里复制 Pattern/Candidate 逻辑。
  - J3 只生成 integration provider skeleton，不生成完整 Feishu 业务逻辑。

## Implementation

- 完成 Phase：
  - A 到 L、24 强制 E2E、27 DoD 均完成。
- 新增文件：
  - `D:\usora-docs\content\docs\integration.mdx`。
  - `D:\usora-docs\content\docs\dingtalk.mdx`。
  - `packages/integration/*`。
  - `plugins/dingtalk/*`。
  - `test/integration/dingtalk-plugin.test.ts`。
  - `test/integration/integration-package.test.ts`。
- 修改文件：
  - Foundry event/storage/context-budget 与相关测试。
  - marketplace metadata / plugin metadata / dist artifacts。
  - `tooling/create-plugin.ts`、`tooling/clean-runtime-test.ts`、`scripts/validate-plugin.ts`。
  - root `tsconfig.base.json`、`vitest.config.ts`。
  - `CHANGELOG.md`。
- Breaking Change：
  - 未引入新的 runtime breaking change；Foundry legacy event 读取保持兼容。
- Migration：
  - legacy Foundry events 可映射到 dotted UsoraEvent。
  - Foundry migration tests 通过。

## DingTalk

- 支持能力：
  - outbound candidate/skill/governance/digest notification。
  - webhook transport 和 app API client。
  - callback verify、receipt dedup、identity mapping、Maintainer authorization。
  - candidate approve/reject、governance action、bot commands。
  - resource discovery/read、manual capture、controlled automatic capture、Practice Source E2E。
  - doctor diagnostics。
- 配置：
  - `resolveDingTalkConfig` 读取 transport、capabilities、subscriptions 和 env names。
- 权限：
  - 普通读和 candidate action 允许授权用户执行。
  - destructive governance action 仅 Maintainer。
- Secrets：
  - `DINGTALK_WEBHOOK_URL`、`DINGTALK_WEBHOOK_SECRET`、`DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`。
  - doctor/config 输出通过 `redactDingTalkConfig` 脱敏。
- 限制：
  - 当前没有真实 DingTalk OAuth/HTTP server。
  - 自动捕获是纯策略函数，不包含后台 scheduler。

## Extensibility

现在实现 Feishu Provider 需要：

- 新增文件：
  - `plugins/feishu/plugin.json`。
  - `plugins/feishu/src/provider.ts`。
  - `plugins/feishu/src/renderer.ts`。
  - `plugins/feishu/src/webhook.ts` 或 app client。
  - `plugins/feishu/src/callback.ts` / identity / authorization / resources，按实际能力增减。
  - `test/integration/feishu-plugin.test.ts`。
- 实现 Interface：
  - `IntegrationProvider`。
  - `MessagingCapability`。
  - 按需实现 `InteractionCapability`、`SourceCapability`、`ResourceCapability`、`IdentityResolver`。
- 运行 Contract Tests：
  - provider contract。
  - runtime fan-out。
  - delivery retry/dead-letter/checkpoint。
  - provider-specific renderer/transport/callback/source tests。
- 需要修改 Foundry 吗？
  - 不需要。
- 需要修改 `packages/integration` 吗？
  - 不需要，除非 Feishu 引入真正新的跨平台 capability。

## Verification

- `format`：`bun run format:check` 通过。
- `lint`：`bun run lint` 通过。
- `typecheck`：`bun run typecheck` 通过。
- `build`：`bun run build` 通过，built dingtalk / foundry。
- `package`：`bun run package:check` 通过。
- `runtime`：`bun run runtime:check` 通过。
- `marketplace`：`bun run marketplace:check` 通过。
- `test`：`bun run test` 通过，16 test files / 113 tests passed。
- `validate`：`bun run validate` 通过。
- `bun run check`：完整通过。

## Remaining

- Required but unfinished：
  - 真实企业 E2E 尚未执行；需要应用凭据、文档授权、群权限与已发布卡片模板。
- Optional future evolution：
  - 接入真实 DingTalk OAuth / callback HTTP server。
  - 为自动捕获增加 scheduler。
  - 基于 integration skeleton 开始 Feishu provider。

---

# 29. 当前实施基线

> Codex 每个 Phase 完成后更新。

```text
Plan Version: 1.0

Repository:
LuoMingxiang/usora

Branch:
codex/dingtalk-integration-platform

Base Commit:
7786bb5255cbd252775e3d2a223bc0155eea590e

Current Commit:
7786bb5255cbd252775e3d2a223bc0155eea590e

Current Phase:
Complete

Current Task:
Complete

Last Successful Check:
`bun run check`

Open Blockers:
None

Last Updated:
2026-09-05 12:51
```

---

# 30. 决策日志

> Codex 在执行过程中持续追加，禁止覆盖历史决策。

格式：

```markdown
## DEC-001

- 日期：
- Phase：
- 问题：
- 决策：
- 原因：
- 备选方案：
- 影响：
- ADR：
```

---

# 31. Breaking Change 日志

> Codex 持续追加。

格式：

```markdown
## BREAK-001

- 日期：
- 原行为：
- 新行为：
- 原因：
- Schema Impact：
- Migration：
- Tests：
- Changelog：
```

---

# 32. 阻塞日志

> 只有真正阻塞执行的问题才进入这里。

格式：

```markdown
## BLOCK-001

- 日期：
- Phase / Task：
- 阻塞原因：
- 是否需要用户：
- 已尝试：
- 推荐动作：
- 状态：
```

解除后：

```text
RESOLVED
```

并保留记录。

---

# 33. 后续平台扩展原则

未来：

```text
plugins/feishu
plugins/wecom
plugins/slack
plugins/discord
```

都必须遵循：

```text
Provider Contract
Capability Contract
Message Contract
Command Contract
Identity Contract
Resource Contract
Testing Contract
```

Integration Core 不能演变成：

```text
if dingtalk
else if feishu
else if slack
```

Provider-specific 差异留在 Provider 内部。

只有真正跨平台的新能力才允许升级公共 Contract。

---

# 34. 产品结果

完成后 Usora 将从：

```text
AI Session
    ↓
Practice
    ↓
Skill
```

扩展成：

```text
             Anywhere you practice
                      │
                      ▼
              ┌───────────────┐
              │     Usora     │
              │               │
              │ Practice      │
              │ Foundry       │
              │ Skill         │
              │ Governance    │
              └───────┬───────┘
                      │
                      ▼
               Anywhere you work
```

第一站：

```text
DingTalk
```

未来：

```text
        Codex / CodeBuddy / Claude / Kimi
                        │
                        ▼
                      Usora
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       DingTalk       Feishu        WeCom
          │
          └──── Slack / Discord / ...
```

最终原则：

> **AI 不绑定，协作平台也不绑定。能力属于用户自己。**

---

# 35. 给 Codex 的启动指令

用户把本文件交给 Codex 后，可以只发送：

```text
按照这份实施计划全权执行。

你负责仓库审计、架构决策、子任务拆分、模型/子 Agent 选择、编码、迁移、测试、文档和最终验收。

开始编码前先读取完整计划并检查当前仓库实际状态。

执行过程中必须严格遵守计划中的“强制回写规则”：
每完成一个可验收任务立即更新本计划对应 TODO、执行记录和验证结果；
每完成一个 Phase 更新阶段验收记录和“当前实施基线”；
如果发生架构偏差、Breaking Change 或阻塞，也必须写回本计划。

如果会话中断，下一次必须以本计划和 Git 当前状态恢复，不依赖之前聊天上下文。

除非遇到必须由我提供凭据、授权或做产品方向决策的事项，否则无需等待我逐步确认，继续执行直到所有 Required Phase 完成并且 bun run check 通过。
```

---

# 36. Codex 第一次执行必须做的事情

按顺序：

```text
1. 完整读取本计划
2. git status
3. 获取 branch / HEAD commit
4. 检查仓库 package.json
5. 检查 plugins/foundry
6. 检查 tooling
7. 扫描 Event / Storage / Governance / Candidate
8. 更新“当前实施基线”
9. 将 Phase A 标记为 🟡
10. 将 A1 标记为 [~]
11. 拆分 Phase A 子任务
12. 评估子 Agent / 模型
13. 开始仓库审计
14. 完成 A1 后立即回写本计划
15. 再进入 A2
```

**不要直接从创建 `plugins/dingtalk` 开始。**

先锁定 Integration Boundary。

---

# 37. 计划完成判定

只有同时满足：

```text
代码完成
+
Migration 完成
+
测试完成
+
安全验证完成
+
Extensibility Proof 完成
+
文档完成
+
本计划所有执行状态已回写
+
bun run check PASS
```

才允许：

```text
总体状态：COMPLETED
```

否则保持：

```text
IN_PROGRESS
```

或：

```text
BLOCKED
```

## 2026-09-05 审查后最小修复记录（优先于前文历史完成声明）

- 用户要求：设计并修复审查中的全部 8 项问题，自我 review 后提交。
- 最小方案与 ADR：`plugins/dingtalk/skills/dingtalk/configuration.md` 的 ADR-008。
- 已修复：MCP 长连接协议与实际工具入口；官方 Stream 入站；Foundry 公共 MCP 命令；app 互动卡片；指定文档 API 捕获；投递崩溃恢复、互斥和退避；失败回调重试；Bot 权限名称一致。
- 安全：不暴露 HTTP 回调；本地签名 envelope 必须绑定正文并校验五分钟时效；Stream 按租户和显式用户映射授权，卡片操作目标只从本地持久化记录取得。
- 可靠性：采用 proper-lockfile 心跳租约；Foundry 操作请求 ID 与领域记录一起持久化，事件使用稳定 ID，重试补全崩溃窗口内未写出的事件。
- 语义修正：Webhook 只能保证至少一次投递，不能声称跨远端/本地事务的 exactly-once；app 卡片使用稳定 outTrackId。实际企业验收仍未执行，不能以 fake HTTP/Stream fixture 代替。
- 自审修正：替换自制 PID 锁；补领域写入后事件落盘前崩溃的恢复；Stream 启动失败不标为 ready；识别真实 senderCorpId 字段。
- 最终验证：2026-09-06 `bun run check` 完整通过，含 format、lint、typecheck、build、package、runtime、marketplace、118 tests / 17 files、validate。`git diff --check` 通过。
- 自审补充：显式配置 Foundry 子进程数据环境，避免误用 DingTalk 插件目录；卡片目标原子落盘；事件请求键按领域对象隔离；验证旧批准请求不能覆盖后来的拒绝，非 Maintainer 不能执行真实退役操作。
- 本计划原先被仓库 product-docs/* 忽略；随本次修复明确纳入版本管理，供后续恢复和验收引用。

- 修复代码验收：通过。真实企业验收：未执行，保持 IN_PROGRESS；不把所需凭据、模板和权限配置虚报为测试通过。
