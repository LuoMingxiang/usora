# [1.1.0](https://github.com/LuoMingxiang/usora/compare/v1.0.0...v1.1.0) (2026-08-22)

### Features

- **foundry:** add candidate resolution gate ([b804678](https://github.com/LuoMingxiang/usora/commit/b804678a29ecce6fa607770e7cc29398e03e6b1d))
- **foundry:** add compact skill retrieval and generation ([5389e8f](https://github.com/LuoMingxiang/usora/commit/5389e8f1fafa7fd6fc10b0e99e3b4a3e9f1e4420))
- **foundry:** add context telemetry metrics ([2db46f1](https://github.com/LuoMingxiang/usora/commit/2db46f103776311acc3faa6e56d3756f9c9ed453))
- **foundry:** add explicit hub migration ([b5bcd96](https://github.com/LuoMingxiang/usora/commit/b5bcd9646523f98ebc763bc65d8a17b41637848c))
- **foundry:** add skill evolution deltas ([e7f10c6](https://github.com/LuoMingxiang/usora/commit/e7f10c654e09a871f6533d72aea25d98c676a408))
- **foundry:** add skill governance controls ([f61c943](https://github.com/LuoMingxiang/usora/commit/f61c943389df0bd908daaa7454f24b4d808ae742))
- **foundry:** add token runtime phases 0-4 ([7054195](https://github.com/LuoMingxiang/usora/commit/705419507a0af3273c79d0c5078dac233784b391))
- **foundry:** capture skill runtime usage ([454c143](https://github.com/LuoMingxiang/usora/commit/454c1432afebc8aed4a0f47ec1cfe371851ad03e))
- **foundry:** define session protocol adapters ([d79767c](https://github.com/LuoMingxiang/usora/commit/d79767ce0d5c49c134a163f53bac5e3caf7eefa8))

# 2.0.0 (2026-08-22)

### ⚠ BREAKING CHANGES

- Hub schema v2 requires explicit `hub_migrate` for existing v1 data before write tools create new records.
- Legacy `activity_list`, `candidate_list`, and `skill_list` are deprecated in favor of compact query/get APIs.

### Features

- add Activity digests, Pattern index, Candidate resolution, Skill metadata retrieval/generation, context telemetry, and v1→v2 Hub migration.

# 1.0.0 (2026-08-19)

### Bug Fixes

- add codex mcp root config ([9c1f3b3](https://github.com/LuoMingxiang/usora/commit/9c1f3b3768705bf62a9805e40825c58b13736e8c))
- add uninstall instructions for Usora plugin in README ([2e98f91](https://github.com/LuoMingxiang/usora/commit/2e98f916959d22a7c631e29bd903fdb1d14d7dea))
- align plugin branding and distribution config ([b93a60f](https://github.com/LuoMingxiang/usora/commit/b93a60fbc5e88e7f068dac77b6190abcab319891))
- clear candidates in full cleanup ([6db2e5f](https://github.com/LuoMingxiang/usora/commit/6db2e5f999f9150705c822a3512b83a90863cdee))
- complete codebuddy plugin metadata ([70ec2e9](https://github.com/LuoMingxiang/usora/commit/70ec2e9090851ef7157f63c4635e8a93d2ddaf13))
- correct MCP server cwd for plugin launch ([283f365](https://github.com/LuoMingxiang/usora/commit/283f365538be9537d820d094b111f33e31e0940e))
- declare codebuddy mcp config ([17e6472](https://github.com/LuoMingxiang/usora/commit/17e6472e6d5ea23a178944b36aeb7bf9954f2041))
- generate robust process session ids ([4f09492](https://github.com/LuoMingxiang/usora/commit/4f09492079a525b4c8d644572219d10ddacec124))
- inline Usora MCP registration ([b3252b5](https://github.com/LuoMingxiang/usora/commit/b3252b5127061d29543daab27a1a9987586b5a56))
- launch Usora MCP from plugin root ([b036661](https://github.com/LuoMingxiang/usora/commit/b0366618af2ba9a7f57dd8d3c7429e6f1480dddc))
- make full cleanup clear all hub data ([b5181d0](https://github.com/LuoMingxiang/usora/commit/b5181d0ac51339a73bf20c43c9aace9a94c8ae90))
- make Usora MCP path portable ([031bfa6](https://github.com/LuoMingxiang/usora/commit/031bfa6a6958408131adc610f4f073959de68cdc))
- mark Usora plugin source as GitHub ([ce6543c](https://github.com/LuoMingxiang/usora/commit/ce6543ca2c739ca7644693296df16cbcb0cd3a98))
- negotiate MCP protocol version ([2a9f307](https://github.com/LuoMingxiang/usora/commit/2a9f30745c0b041de19d718eb9af698f59b0cd88))
- point GitHub marketplace to plugin subdirectory ([22f679a](https://github.com/LuoMingxiang/usora/commit/22f679aed124474f8a231dc4def5c3ff5a170609))
- resolve codebuddy mcp script path ([47de6ee](https://github.com/LuoMingxiang/usora/commit/47de6ee3939341837b0ae73bc10d644cc773572c))
- return standard MCP tool responses ([cde7437](https://github.com/LuoMingxiang/usora/commit/cde7437d9a0706851066ce0f7578e9f57a964391))
- route session hooks through activity pipeline ([b377229](https://github.com/LuoMingxiang/usora/commit/b377229185ff309755a957bd15cf3b8aa6463c20))
- update default Hub directory to support workspace-specific storage ([fc7d8d0](https://github.com/LuoMingxiang/usora/commit/fc7d8d049aeb11b9f202af3762f49061affca42c))
- update display name to "Usora" in marketplace configuration ([ba395e8](https://github.com/LuoMingxiang/usora/commit/ba395e870a3e80e146076f077abc099180a07550))
- update displayName to match application name ([d67448c](https://github.com/LuoMingxiang/usora/commit/d67448c3d4edeed4f5b3c21c42f599b5f2fe8f18))
- use companion MCP configuration ([6a32056](https://github.com/LuoMingxiang/usora/commit/6a320568e349c762f2f548ff841ee527b29d8368))

### Features

- add hub_config, skill_create, and skill_evaluate tools to MCP and update documentation ([5760701](https://github.com/LuoMingxiang/usora/commit/57607015bd2ab2d7ad183b4aaf419364cf034e6e))
- add safe activity cleanup tool ([087e00a](https://github.com/LuoMingxiang/usora/commit/087e00a784cadfd65d226c1626389c131f4a3a1f))
- aggregate activities by session ([8e23253](https://github.com/LuoMingxiang/usora/commit/8e232539c0ce2a55494eba5a938888a1e3dbc096))
- align plugin layout for codebuddy ([3f36351](https://github.com/LuoMingxiang/usora/commit/3f36351d35cf0f26f0d34c162bd3371388e5f7fc))
- default data dir with move-on-relocate semantics ([67d31ac](https://github.com/LuoMingxiang/usora/commit/67d31ac84d3feebcbc87ce894ff42cd56cbeedf0))
- enable always-on Usora session capture ([f5dc20f](https://github.com/LuoMingxiang/usora/commit/f5dc20fcf575332cbfa6ef6e1cdb02ae7ba1de43))
- **hooks:** add session-end hook + session-hook.mjs MVP for automatic activity recording ([a51abda](https://github.com/LuoMingxiang/usora/commit/a51abdac47e387246eb0dbb8d695071f35aa3feb))
- hub_init returns pending questions instead of silently initializing ([6d28720](https://github.com/LuoMingxiang/usora/commit/6d28720dcefec0621fed0afc9b989416b6c98fef))
- make Usora session memory always-on ([5464580](https://github.com/LuoMingxiang/usora/commit/546458096b16157e464890b23b9f092914aa0c05))
- refine Usora plugin branding ([6f8f85a](https://github.com/LuoMingxiang/usora/commit/6f8f85a7ac0ccfc54371f618a524b6b7bf276aad))
- require a chosen directory before initialization; drop USORA_HOME ([93bdd0b](https://github.com/LuoMingxiang/usora/commit/93bdd0baf58c67a46a22fe4b6794520baab33d36))
- support custom data directory on init and uninstall cleanup ([44aa2a8](https://github.com/LuoMingxiang/usora/commit/44aa2a87d7b5f6a693d8157d14f020bfbea533f7))
- 增加贡献指南、行为准则和安全政策文档 ([7317a45](https://github.com/LuoMingxiang/usora/commit/7317a4581e7345ceb6e9b98974aad7acf7f275df))
- 更新 README 文档，添加中文版本并修改插件说明；替换 logo 文件格式 ([cb92501](https://github.com/LuoMingxiang/usora/commit/cb92501693d208b62f80646b33f7b5bdc62def99))
