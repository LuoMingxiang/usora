<p align="center">
  <img src="plugins/usora/assets/usora.png" alt="Usora" width="520">
</p>

<p align="center">
  <strong>Local-first memory for turning AI work into reusable skills.</strong>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> ·
  <a href="plugins/usora/README.md">Plugin guide</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

# Usora

Usora is a local-first Codex plugin that helps an AI assistant learn from real work without sending your project memory to a hosted service. It captures useful session context as Activities, turns repeated patterns into Candidates, and lets a Maintainer evaluate and publish reusable Skills.

```text
Activity -> Candidate -> Skill Draft -> Evaluation -> Publish
```

## Why Usora?

AI assistants often solve the same local workflow problems again and again. Usora gives those lessons a small lifecycle:

- **Capture work as Activities**: store concise task summaries, decisions, approaches, outcomes, and technologies.
- **Discover reusable Candidates**: promote repeated patterns into reviewable improvement ideas.
- **Publish Skills deliberately**: keep the Maintainer in control of what becomes reusable behavior.
- **Stay local-first**: use plain local files under your workspace by default, with no Python, database, or separate CLI required.

## Current MVP

- Initialize and inspect a local Usora Hub.
- Merge Activity records by AI session.
- Create and evaluate Candidates.
- Configure Maintainer and automation policy.
- Create, evaluate, publish, and revise Skills in place.
- Archive processed Activities.

## Quick Start

Install `Usora` from the Codex plugin marketplace, then ask Codex:

```text
Initialize my Usora
Capture this session
Show Usora status
Create and publish a Skill
```

By default, Usora creates its Hub at `<cwd>/.usora`. To move the data later, ask Codex to move Usora data to another path; the plugin migrates existing records and saves the new location in `.usora/config.json`.

For plugin-specific usage, storage layout, and cleanup details, see the [plugin guide](plugins/usora/README.md).

## MVP Boundary

Usora is currently a local, single-user MVP. It does not include a Web UI, cloud sync, team collaboration, a public Skill marketplace, or direct AI-to-AI communication.

## Contributing

Contributions are welcome. Before opening a pull request, please read:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
