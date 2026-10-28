import type { Stage } from "./types";

export const PIPELINE: Stage[] = [
  "to_research", "drafted", "finalized", "contacted", "replied", "call", "proposal", "won",
];
export const TERMINAL: Stage[] = ["do_not_contact", "archived"];
export const ALL_STAGES: Stage[] = [...PIPELINE, ...TERMINAL];

export const STAGE_LABELS: Record<Stage, string> = {
  to_research: "To research",
  drafted: "Drafted",
  finalized: "Finalized",
  contacted: "Contacted",
  replied: "Replied",
  call: "Call",
  proposal: "Proposal",
  won: "Won",
  do_not_contact: "Do not contact",
  archived: "Archived",
};

// Carried over from the v1 UI so the board reads the same.
export const STAGE_COLORS: Record<Stage, string> = {
  to_research: "#8a93a6",
  drafted: "#c98a00",
  finalized: "#7a5bd8",
  contacted: "#3b5bdb",
  replied: "#1f9d6b",
  call: "#0d9488",
  proposal: "#d4761a",
  won: "#10795a",
  do_not_contact: "#d64545",
  archived: "#9aa3b2",
};

export const SCORE_LABELS: Record<string, { label: string; hint: [string, string, string] }> = {
  sc_agency_fit: { label: "Agency fit", hint: ["Not a relevant agency", "Adjacent service", "Clear design / product / ecommerce agency"] },
  sc_size_maturity: { label: "Size & maturity", hint: ["Large, embedded delivery", "Unknown or mixed", "Boutique, founder reachable"] },
  sc_recent_activity: { label: "Recent activity", hint: ["Inactive or stale", "Unclear", "Recent work or posts"] },
  sc_dev_gap: { label: "Development gap", hint: ["Big engineering team", "Partial or uncertain", "Strong design, little engineering"] },
  sc_work_relevance: { label: "Work relevance", hint: ["No matching work", "General digital", "SaaS, ecommerce, B2B, complex web"] },
  sc_access: { label: "Access", hint: ["No legitimate route", "General form or inbox", "Founder or partner route"] },
  sc_personalization: { label: "Personalization", hint: ["Nothing specific", "One weak detail", "Current, relevant detail"] },
};
export const SCORE_FIELDS = Object.keys(SCORE_LABELS);

export function scoreBand(total: number | null | undefined) {
  if (total == null) return null;
  if (total >= 11) return { label: "Contact priority", tone: "good" as const };
  if (total >= 8) return { label: "Contact after review", tone: "carbon" as const };
  if (total >= 5) return { label: "Hold, low priority", tone: "attention" as const };
  return { label: "Exclude", tone: "bad" as const };
}

export const DEV_CAPABILITY_LABELS: Record<string, string> = {
  none_visible: "None visible",
  partner_led: "Partner-led",
  partial: "Partial",
  full_service: "Full service",
  uncertain: "Uncertain",
};

export const FLAG_LABELS: Record<string, string> = {
  link_removed: "Link removed from draft",
  link_still_present: "Link still in draft",
  email_domain_mismatch: "AI email was off-domain (dropped)",
  no_evidence: "No evidence URLs",
  low_confidence: "Low confidence",
  length: "Draft length outside 90–160 words",
  freelance_missing: "Doesn't say freelance / contract",
  location_missing: "Doesn't mention where you're based",
  guarantee_missing: "Guarantee missing from the offer",
  job_language: "Reads like a job application",
};

// Client port of LINK_PATTERNS in crm/core.py - instant feedback only, the server stays authoritative.
const LINK_PATTERNS: [RegExp, string][] = [
  [/https?:\/\/\S+/gi, "http/https link"],
  [/www\.\S+/gi, "www. link"],
  [/\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|dev|app|ai|xyz|design|studio|agency|us|uk|ca|au|shop|store)\b(?:\/\S*)?/gi, "domain-like string"],
  [/\bmailto:\S+/gi, "mailto link"],
  [/<a\s/gi, "embedded hyperlink"],
  [/\]\(\S+\)/gi, "markdown link"],
];

export function detectLinks(...texts: (string | undefined | null)[]) {
  const found: { match: string; kind: string }[] = [];
  for (const t of texts) {
    if (!t) continue;
    for (const [re, kind] of LINK_PATTERNS) {
      for (const m of t.matchAll(re)) found.push({ match: m[0], kind });
    }
  }
  return found;
}

export const wordCount = (s?: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;

export function money(n?: number | null) {
  return "$" + Number(n || 0).toLocaleString();
}

export function relTime(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function duration(a?: string | null, b?: string | null) {
  if (!a) return "";
  const s = ((b ? new Date(b.replace(" ", "T")) : new Date()).getTime() - new Date(a.replace(" ", "T")).getTime()) / 1000;
  if (!isFinite(s) || s < 0) return "";
  return s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function cleanUrl(u?: string) {
  if (!u) return "";
  try {
    const url = new URL(u);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
