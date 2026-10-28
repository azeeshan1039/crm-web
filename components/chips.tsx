import { Bot, CircleAlert, Loader2, Star, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_COLORS, STAGE_LABELS, scoreBand } from "@/lib/crm";
import type { AiStatus, Stage } from "@/lib/types";

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: STAGE_COLORS[stage] }} />;
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80", className)}>
      <StageDot stage={stage} />
      {STAGE_LABELS[stage]}
    </span>
  );
}

const toneClass = {
  good: "bg-good-soft text-good",
  carbon: "bg-carbon-soft text-carbon",
  attention: "bg-attention-soft text-attention",
  bad: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function Pill({ tone = "muted", className, children, title }: {
  tone?: keyof typeof toneClass; className?: string; children: React.ReactNode; title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-medium leading-none", toneClass[tone], className)}>
      {children}
    </span>
  );
}

/** Seeded leads carry a partial score (size + activity from Clutch only) until researched. */
export const isPartialScore = (l: { stage: Stage; ai_status?: AiStatus; subject?: string }) =>
  l.stage === "to_research" && (!l.ai_status || l.ai_status === "none") && !l.subject;

export function ScoreBadge({ total, partial }: { total?: number | null; partial?: boolean }) {
  if (total == null) return null;
  if (partial) return <Pill tone="muted" title="Partial score from Clutch data. Research fills in the rest.">{total} so far</Pill>;
  const band = scoreBand(total)!;
  return <Pill tone={band.tone} title={band.label}>{total}/14</Pill>;
}

export function SiteChip({ status }: { status?: string }) {
  if (!status) return null;
  const tone = status === "alive" ? "good" : status === "dead" ? "bad" : status === "stale" || status === "blocked" ? "attention" : "muted";
  return <Pill tone={tone as keyof typeof toneClass}>site {status}</Pill>;
}

export function Reviews({ n, className }: { n?: number; className?: string }) {
  return (
    <span className={cn("inline-flex w-10 shrink-0 flex-col items-end leading-none tabular-nums", className)} title={`${n || 0} Clutch reviews`}>
      <span className="text-sm font-semibold">{n || 0}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground">reviews</span>
    </span>
  );
}

export function Rating({ value }: { value?: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-muted-foreground">
      <Star className="size-3 fill-current" />
      {value}
    </span>
  );
}

export function AiBadge({ status, flags }: { status?: AiStatus; flags?: string[] }) {
  if (!status || status === "none") return null;
  if (status === "queued") return <Pill tone="muted"><Bot className="size-3" />queued</Pill>;
  if (status === "running") return <Pill tone="carbon"><Loader2 className="size-3 animate-spin" />researching</Pill>;
  if (status === "failed") return <Pill tone="bad"><CircleAlert className="size-3" />AI failed</Pill>;
  if (status === "needs_review")
    return <Pill tone="attention" title={(flags || []).join(", ")}><TriangleAlert className="size-3" />review</Pill>;
  return <Pill tone="good"><Bot className="size-3" />AI</Pill>;
}
