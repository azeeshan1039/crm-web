export type Stage =
  | "to_research" | "drafted" | "finalized" | "contacted"
  | "replied" | "call" | "proposal" | "won"
  | "do_not_contact" | "archived";

export type AiStatus = "none" | "queued" | "running" | "done" | "needs_review" | "failed";

export interface Lead {
  id: number;
  clutch_id?: string;
  company_name: string;
  website?: string;
  normalized_domain?: string;
  website_status?: string;
  website_issue?: string;
  geography?: string;
  country?: string;
  city?: string;
  employees?: string;
  founded?: string;
  latest_review?: string;
  review_count: number;
  rating?: number | null;
  hourly_rate?: string;
  min_project_size?: string;
  phone?: string;
  services?: string;
  clutch_summary?: string;
  profile_url?: string;
  social_linkedin?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_twitter?: string;
  social_youtube?: string;
  social_behance?: string;
  social_dribbble?: string;
  source_type?: string;
  source_url?: string;
  agency_profile?: string;
  dev_capability?: string;
  tech_signals?: string;
  relevant_work?: string;
  decision_maker?: string;
  contact_route?: string;
  contact_email?: string;
  contact_is_form?: number;
  restrictions?: string;
  evidence_notes?: string;
  opportunity_hypothesis?: string;
  pitch_angle?: string;
  confidence?: string;
  sc_agency_fit?: number | null;
  sc_size_maturity?: number | null;
  sc_recent_activity?: number | null;
  sc_dev_gap?: number | null;
  sc_work_relevance?: number | null;
  sc_access?: number | null;
  sc_personalization?: number | null;
  score_total?: number | null;
  subject?: string;
  message_draft?: string;
  draft_status?: string;
  stage: Stage;
  stage_label: string;
  gmail_account?: string;
  gmail_draft_id?: string;
  channel?: string;
  last_contacted?: string;
  next_action?: string;
  follow_up_date?: string;
  followup_count?: number;
  reply_notes?: string;
  proposed_value?: number | null;
  payment_received?: number | null;
  suppression_reason?: string;
  campaign?: string;
  priority_flag?: number;
  created_by_user_id?: number | null;
  owner_user_id?: number | null;
  updated_by_user_id?: number | null;
  assignee_user_id?: number | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  ai_status?: AiStatus;
  ai_engine?: string;
  ai_last_run?: string;
  ai_suggestion?: "hold" | "exclude" | null;
  ai_suggestion_reason?: string | null;
  ai_flags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LeadEvent {
  id: number;
  lead_id: number;
  ts: string;
  type: string;
  detail: string;
}

export interface LeadAiRun {
  item_id: number;
  run_id: number;
  status: string;
  outcome?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
  engine: string;
}

export interface LeadDetail extends Lead {
  events: LeadEvent[];
  ai_runs: LeadAiRun[];
}

export interface Meta {
  pipeline_stages: Stage[];
  terminal_stages: Stage[];
  stage_labels: Record<Stage, string>;
  dev_capability: string[];
  confidence: string[];
  score_fields: string[];
  counts: Record<Stage, number>;
  ai_counts: Record<AiStatus, number>;
  campaigns: string[];
  gmail_accounts: string[];
  today: string;
}

export interface Metrics {
  counts: Record<Stage, number>;
  funnel: { contacted: number; replied: number; call: number; proposal: number; won: number };
  rates: { reply_rate: number; call_rate: number; proposal_rate: number; win_rate: number };
  cash_received: number;
  pipeline_value: number;
  due_today: number;
  ai: { researched_7d: number; drafted_7d: number; failed_7d: number; needs_review: number };
}

export interface Queue {
  due: Lead[];
  active: Lead[];
  ready: Lead[];
  suggested: Lead[];
  research: Lead[];
  research_total: number;
  offset: number;
  batch: number;
}

export interface Engine {
  id: "claude" | "codex";
  label: string;
  available: boolean;
  version: string;
  path: string;
}

export interface Run {
  id: number;
  engine: "claude" | "codex";
  model?: string;
  effort?: string;
  status: "queued" | "running" | "done" | "cancelled" | "failed";
  concurrency: number;
  total: number;
  done: number;
  failed: number;
  running: number;
  created_at: string;
  finished_at?: string;
}

export interface RunItem {
  id: number;
  lead_id: number;
  status: "queued" | "running" | "done" | "needs_review" | "failed" | "cancelled";
  started_at?: string;
  finished_at?: string;
  outcome?: string;
  error?: string;
  company_name: string;
  website?: string;
  review_count: number;
  stage: Stage;
}

export interface RunDetail extends Run {
  items: RunItem[];
}

export interface LogLine {
  id: number;
  item_id: number | null;
  ts: string;
  kind: "info" | "tool" | "text" | "think" | "stderr" | "error" | "result";
  line: string;
  company_name?: string | null;
}

export interface Settings {
  gmail_accounts: string[];
  default_engine: "claude" | "codex";
  default_model: string;
  default_effort: string;
  concurrency: number;
  timeout_min: number;
  proof_library: string;
  sender_name: string;
  sender_location: string;
  offer_style: "paid" | "paid_guarantee";
}

export interface GoogleAccount {
  email: string;
  status: "connected" | "needs_reconnect";
  connected_at: string;
  last_used?: string | null;
}

export interface GoogleStatus {
  configured: boolean;
  accounts: GoogleAccount[];
  redirect_uri: string;
}

export interface DraftBatchResult {
  account: string;
  created: { id: number; company: string; to: string; form_only: boolean }[];
  skipped: { id: number; company: string; reason: string }[];
  failed: { id: number; company: string; reason: string }[];
  addressed: number;
  form_only: number;
}

export interface GmailItem {
  id: number;
  company_name: string;
  review_count: number;
  subject: string;
  message_draft: string;
  to: string;
  recipient_label: string;
  contact_is_form: number;
  contact_route: string;
  website: string;
  has_links: boolean;
  links: { match: string; kind: string }[];
  gmail_draft_id?: string;
  gmail_account?: string;
}
