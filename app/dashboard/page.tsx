"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money, PIPELINE, STAGE_COLORS, STAGE_LABELS } from "@/lib/crm";
import type { Metrics } from "@/lib/types";
import { PageHeader, Section } from "@/components/page";

export default function DashboardPage() {
  const { data: m } = useQuery({ queryKey: ["metrics"], queryFn: () => api<Metrics>("/api/metrics"), refetchInterval: 15_000 });
  if (!m) return <main className="flex-1"><PageHeader title="Dashboard" /><div className="p-8 text-sm text-muted-foreground">Loading…</div></main>;

  const funnel: [string, number][] = [
    ["Contacted", m.funnel.contacted], ["Replied", m.funnel.replied], ["Call", m.funnel.call],
    ["Proposal", m.funnel.proposal], ["Won", m.funnel.won],
  ];
  const maxF = Math.max(1, ...funnel.map(([, v]) => v));
  const stageMax = Math.max(1, ...PIPELINE.map((s) => m.counts[s]));

  return (
    <main className="flex-1">
      <PageHeader title="Dashboard" description="How the pipeline is converting (SOP §21). Revenue counts payments received, not proposal value." />
      <div className="space-y-8 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
          <Tile label="Cash received" value={money(m.cash_received)} />
          <Tile label="Proposals out" value={money(m.pipeline_value)} note="Proposal and won stages" />
          <Tile label="Follow-ups due" value={m.due_today} />
          <Tile label="AI drafts to review" value={m.ai.needs_review + m.counts.drafted} note={`${m.ai.drafted_7d} drafted by AI this week`} />
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <Section title="Outreach funnel" aside="Leads that reached each step">
            <div className="space-y-2 rounded-lg border bg-card p-4">
              {funnel.map(([label, v], i) => (
                <div key={label} className="grid grid-cols-[84px_1fr_48px] items-center gap-3 text-sm" title={`${label}: ${v}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="h-3 rounded-r bg-muted">
                    <div className="h-full rounded-r bg-carbon" style={{ width: `${v ? Math.max(1.5, (v / maxF) * 100) : 0}%`, opacity: 1 - i * 0.12 }} />
                  </div>
                  <span className="text-right font-medium tabular-nums">{v}</span>
                </div>
              ))}
              {m.funnel.contacted === 0 && (
                <p className="pt-2 text-xs text-muted-foreground">No sends confirmed yet. The funnel fills in once you mark leads as contacted.</p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
              <Tile small label="Reply rate" value={`${m.rates.reply_rate}%`} note="of contacted" />
              <Tile small label="Call rate" value={`${m.rates.call_rate}%`} note="of contacted" />
              <Tile small label="Proposal rate" value={`${m.rates.proposal_rate}%`} note="of replies" />
              <Tile small label="Win rate" value={`${m.rates.win_rate}%`} note="of proposals" />
            </div>
          </Section>

          <Section title="Leads by stage" aside="Current position of every active lead">
            <div className="space-y-2 rounded-lg border bg-card p-4">
              {PIPELINE.map((s) => (
                <div key={s} className="grid grid-cols-[96px_1fr_56px] items-center gap-3 text-sm" title={`${STAGE_LABELS[s]}: ${m.counts[s]}`}>
                  <span className="text-muted-foreground">{STAGE_LABELS[s]}</span>
                  <div className="h-3 rounded-r bg-muted">
                    <div className="h-full rounded-r" style={{ background: STAGE_COLORS[s], width: `${m.counts[s] ? Math.max(1, (m.counts[s] / stageMax) * 100) : 0}%` }} />
                  </div>
                  <span className="text-right font-medium tabular-nums">{m.counts[s].toLocaleString()}</span>
                </div>
              ))}
              <div className="flex gap-6 border-t pt-3 text-xs text-muted-foreground">
                <span>Archived <b className="font-medium text-foreground tabular-nums">{m.counts.archived.toLocaleString()}</b></span>
                <span>Do not contact <b className="font-medium text-foreground tabular-nums">{m.counts.do_not_contact}</b></span>
              </div>
            </div>
          </Section>
        </div>

        <Section title="Autopilot this week">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            <Tile small label="Leads researched" value={m.ai.researched_7d} />
            <Tile small label="Moved to Drafted" value={m.ai.drafted_7d} />
            <Tile small label="Flagged for review" value={m.ai.needs_review} />
            <Tile small label="Failed runs" value={m.ai.failed_7d} />
          </div>
        </Section>
      </div>
    </main>
  );
}

function Tile({ label, value, note, small }: { label: string; value: React.ReactNode; note?: string; small?: boolean }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={small ? "mt-0.5 text-xl font-semibold tabular-nums" : "mt-1 text-[28px] font-semibold leading-tight tabular-nums"}>{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
