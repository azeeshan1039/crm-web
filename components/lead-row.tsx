"use client";

import { useOpenLead } from "@/components/lead-sheet";
import { AiBadge, Reviews, ScoreBadge, SiteChip, StageDot, isPartialScore } from "@/components/chips";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadRow({ lead, sub, right, className }: {
  lead: Lead; sub?: React.ReactNode; right?: React.ReactNode; className?: string;
}) {
  const open = useOpenLead();
  return (
    <button type="button" onClick={() => open(lead.id)}
      className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", className)}>
      <Reviews n={lead.review_count} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StageDot stage={lead.stage} />
          <span className="truncate text-sm font-medium">{lead.company_name}</span>
        </div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {right}
        <AiBadge status={lead.ai_status} flags={lead.ai_flags} />
        <ScoreBadge total={lead.score_total} partial={isPartialScore(lead)} />
        <SiteChip status={lead.website_status} />
      </div>
    </button>
  );
}

export function LeadList({ leads, sub, empty, right }: {
  leads: Lead[]; sub?: (l: Lead) => React.ReactNode; empty: React.ReactNode; right?: (l: Lead) => React.ReactNode;
}) {
  if (!leads.length) return <div className="px-3 py-5 text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="divide-y">
      {leads.map((l) => <LeadRow key={l.id} lead={l} sub={sub?.(l)} right={right?.(l)} />)}
    </div>
  );
}
