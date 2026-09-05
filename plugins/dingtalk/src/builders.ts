import type { IntegrationMessage, UsoraEvent } from "@usora/integration";

type CandidateData = {
  id?: string;
  title?: string;
  summary?: string;
  confidence?: number | string | null;
  source?: string;
  evidence?: Array<string | { activity_id?: string; reason?: string }>;
};

type SkillData = {
  name?: string;
  description?: string;
  revision?: number;
  version?: string;
  url?: string;
  published_at?: string;
};

type GovernanceData = {
  type?: string;
  skill?: string;
  reason?: string;
  suggestion?: string;
  action?: string;
  target_skill?: string | null;
  state?: string;
};

type DigestData = {
  summary?: string;
  metrics?: Record<string, string | number | boolean | null | undefined>;
  activity_count?: number;
  candidate_count?: number;
  skill_count?: number;
  governance_findings?: number;
};

function candidateTitle(candidate: CandidateData): string {
  return candidate.title ? `New Skill Candidate: ${candidate.title}` : "New Skill Candidate";
}

function evidenceFacts(candidate: CandidateData) {
  return (candidate.evidence || []).map((item, index) => {
    if (typeof item === "string") return { label: `Evidence ${index + 1}`, value: item };
    return { label: item.activity_id || `Evidence ${index + 1}`, value: item.reason || "Captured evidence" };
  });
}

export function createCandidateCreatedMessage(event: UsoraEvent<CandidateData>): IntegrationMessage {
  const candidate = event.data || {};
  const facts = [
    ...(candidate.confidence === undefined || candidate.confidence === null
      ? []
      : [{ label: "Confidence", value: String(candidate.confidence) }]),
    ...(candidate.source ? [{ label: "Source", value: candidate.source }] : []),
    ...evidenceFacts(candidate),
  ];
  return {
    title: candidateTitle(candidate),
    summary: candidate.summary || "A new reusable skill candidate was captured.",
    sections: facts.length ? [{ title: "Candidate Evidence", facts }] : [],
    actions: [
      {
        id: "candidate.approve",
        label: "Approve",
        command: "candidate.approve",
        metadata: { candidateId: candidate.id },
      },
      { id: "candidate.reject", label: "Reject", command: "candidate.reject", metadata: { candidateId: candidate.id } },
    ],
    resources: candidate.id
      ? [
          {
            provider: "foundry",
            type: "card",
            externalId: candidate.id,
            ...(candidate.title ? { title: candidate.title } : {}),
          },
        ]
      : [],
    metadata: { eventId: event.id },
  };
}

export function createSkillPublishedMessage(event: UsoraEvent<SkillData>): IntegrationMessage {
  const skill = event.data || {};
  const name = skill.name || "skill";
  const facts = [
    { label: "Skill", value: name },
    { label: "Version", value: skill.version || `revision ${skill.revision ?? 0}` },
    ...(skill.published_at ? [{ label: "Published", value: skill.published_at }] : []),
  ];
  return {
    title: `Skill Published: ${name}`,
    summary: skill.description || "A Usora Skill was published.",
    sections: [{ title: "Skill", facts }],
    actions: skill.url
      ? [{ id: "skill.open", label: "Open Skill", command: "skill.get", metadata: { url: skill.url, skill: name } }]
      : [],
    resources: [{ provider: "foundry", type: "document", externalId: name, ...(skill.url ? { url: skill.url } : {}) }],
    metadata: { eventId: event.id },
  };
}

export function createGovernanceMessage(event: UsoraEvent<GovernanceData>): IntegrationMessage {
  const governance = event.data || {};
  const skill = governance.skill || "unknown skill";
  const facts = [
    { label: "Finding", value: governance.type || governance.action || "governance" },
    { label: "Skill", value: skill },
    ...(governance.reason ? [{ label: "Reason", value: governance.reason }] : []),
    ...(governance.suggestion ? [{ label: "Suggestion", value: governance.suggestion }] : []),
    ...(governance.target_skill ? [{ label: "Target", value: governance.target_skill }] : []),
    ...(governance.state ? [{ label: "State", value: governance.state }] : []),
  ];
  return {
    title: `Governance: ${skill}`,
    summary: governance.reason || governance.suggestion || "A Usora governance item needs review.",
    sections: [{ title: "Governance", facts }],
    actions: [
      { id: "governance.keep", label: "Keep", command: "governance.resolve", metadata: { skill, action: "KEEP" } },
      {
        id: "governance.evolve",
        label: "Evolve",
        command: "governance.resolve",
        metadata: { skill, action: "EVOLVE" },
      },
    ],
    resources: [{ provider: "foundry", type: "card", externalId: skill }],
    metadata: { eventId: event.id },
  };
}

export function createFoundryDigestMessage(event: UsoraEvent<DigestData>): IntegrationMessage {
  const digest = event.data || {};
  const metrics = {
    ...(digest.activity_count === undefined ? {} : { Activities: digest.activity_count }),
    ...(digest.candidate_count === undefined ? {} : { Candidates: digest.candidate_count }),
    ...(digest.skill_count === undefined ? {} : { Skills: digest.skill_count }),
    ...(digest.governance_findings === undefined ? {} : { "Governance Findings": digest.governance_findings }),
    ...digest.metrics,
  };
  return {
    title: "Usora Foundry Digest",
    summary: digest.summary || "Latest Foundry activity digest.",
    sections: [
      {
        title: "Metrics",
        facts: Object.entries(metrics).map(([label, value]) => ({ label, value: String(value ?? "") })),
      },
    ],
    metadata: { eventId: event.id },
  };
}
