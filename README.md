<p align="center">
  <img src="plugins/usora/assets/usora.png" alt="Usora" width="520">
</p>

<p align="center">
  <strong>Turn practice into capability.</strong>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> ·
  <a href="plugins/usora/README.md">Plugin guide</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

# Usora

Usora is a local-first Codex plugin and personal capability layer for the AI era. The name combines *usus* (practice, usage, experience) with *aura* (an invisible field of influence): the capability field created by accumulated practice. It captures useful session context as Activities, turns repeated patterns into Candidates, and lets a Maintainer evaluate and publish reusable Skills without sending your project memory to a hosted service.

<p align="center">
  <img src="plugins/usora/assets/origin.png" alt="Usora name origin: usus plus aura" width="720">
</p>

```text
Activity -> Candidate -> Skill Draft -> Evaluation -> Publish
```

<p align="center">
  <img src="plugins/usora/assets/work.png" alt="How Usora turns AI work into reusable skills" width="720">
</p>

## Why Usora?

AI assistants often solve the same local workflow problems again and again, but the working method disappears after the task. Usora treats experience as personal data and gives those lessons a small lifecycle:

- **Capture work as Activities**: store concise task summaries, decisions, approaches, outcomes, and technologies.
- **Discover reusable Candidates**: promote repeated patterns into reviewable improvement ideas.
- **Publish Skills deliberately**: keep the Maintainer in control of what becomes reusable behavior.
- **Evolve personal capability**: let your past practice become future AI assistance.
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
Show Usora status
```

In the first minute, success means you can see the local Hub path, record counts, and a next useful action. After real work, ask Codex to capture the session; repeated patterns can later become Candidates and published Skills.

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
