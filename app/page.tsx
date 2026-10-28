"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Queue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page";
import { LeadList } from "@/components/lead-row";
import { Pill } from "@/components/chips";
import { LauncherForm } from "@/components/autopilot-launcher";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const BATCH = 25;

export default function TodayPage() {
  const [offset, setOffset] = React.useState(0);
  const { data: q, isLoading } = useQuery({
    queryKey: ["queue", offset],
    queryFn: () => api<Queue>(`/api/queue?batch=${BATCH}&offset=${offset}`),
    refetchInterval: 10_000,
  });

  const finalized = q?.ready.filter((l) => l.stage === "finalized") || [];
  const drafted = q?.ready.filter((l) => l.stage === "drafted") || [];
  // Computed in the browser: this page is prerendered, so a render-time date would be the build date.
  const [date, setDate] = React.useState("");
  React.useEffect(() => setDate(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + ". "), []);

  // SOP 20.3 priority order: replies, then follow-ups, then finalized, then drafts, then research.
  const steps = [
    { n: q?.active.length ?? 0, label: "Reply to conversations", href: "#conversations" },
    { n: q?.due.length ?? 0, label: "Send due follow-ups", href: "#followups" },
    { n: finalized.length, label: "Send finalized messages", href: "#send" },
    { n: drafted.length + (q?.suggested.length ?? 0), label: "Review AI drafts", href: "#review" },
    { n: q?.research_total ?? 0, label: "Research new leads", href: "#research" },
  ];
  const firstOpen = steps.findIndex((s) => s.n > 0);

  return (
    <main className="flex-1">
      <PageHeader title="Today" description={`${date}Work top to bottom: conversations first, new research last.`} />

      <ol className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label} className="bg-background">
            <a href={s.href} className={cn("block h-full px-6 py-4 transition-colors hover:bg-muted/50 md:px-8",
              i === firstOpen && "bg-carbon-soft/60")}>
              <div className={cn("text-2xl font-semibold tabular-nums", s.n === 0 && "text-muted-foreground/50")}>
                {isLoading ? "–" : s.n.toLocaleString()}
              </div>
              <div className="mt-0.5 text-sm text-foreground/80">
                <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>{s.label}
              </div>
            </a>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <Panel id="conversations" title="Conversations" aside="Replied, call or proposal" loading={isLoading}>
            <LeadList leads={q?.active || []} empty="No live conversations yet."
              sub={(l) => [l.stage_label, l.next_action || "Set a next action"].join(", ")} />
          </Panel>

          <Panel id="followups" title="Follow-ups due" aside="Same thread, short, no links" loading={isLoading}>
            <LeadList leads={q?.due || []} empty="Nothing due today."
              sub={(l) => `${l.next_action || "Follow-up"} due ${l.follow_up_date}`}
              right={(l) => l.follow_up_date && l.follow_up_date < (new Date().toISOString().slice(0, 10)) ? <Pill tone="attention">overdue</Pill> : null} />
          </Panel>

          <Panel id="send" title="Ready to send" aside={<Link href="/gmail" className="text-carbon hover:underline">Open the send queue</Link>} loading={isLoading}>
            <LeadList leads={finalized} empty="Nothing finalized. Review the drafts below and finalize the good ones."
              sub={(l) => l.subject || "No subject"} />
          </Panel>

          <Panel id="review" title="Review drafts" loading={isLoading}
            aside={<>AI-flagged drafts first. <Link href="/leads?stage=drafted" className="text-carbon hover:underline">Finalize several at once</Link></>}>
            <LeadList leads={drafted} empty="No drafts yet. Run Autopilot on the next batch."
              sub={(l) => l.subject || l.next_action || "Draft"} />
            {!!q?.suggested.length && (
              <>
                <div className="border-t bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  The AI researched these but suggests holding or excluding them
                </div>
                <LeadList leads={q.suggested} empty=""
                  sub={(l) => l.ai_suggestion_reason || ""}
                  right={(l) => <Pill tone={l.ai_suggestion === "exclude" ? "bad" : "attention"}>{l.ai_suggestion}</Pill>} />
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-8">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold">Research the next batch with AI</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Picks the highest-review leads still waiting. You can watch what it does live in Autopilot.
            </p>
            <LauncherForm defaultCount={10} />
          </section>

          <Panel id="research" title="Research next" loading={isLoading}
            aside={q ? `${offset + 1}–${Math.min(offset + BATCH, q.research_total)} of ${q.research_total.toLocaleString()} waiting` : undefined}>
            <LeadList leads={q?.research || []} empty="No leads left to research."
              sub={(l) => [l.geography, l.employees && `${l.employees} people`, l.rating && `rated ${l.rating}`].filter(Boolean).join(", ")} />
            <div className="flex items-center gap-2 border-t px-3 py-2">
              <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - BATCH))}>
                <ChevronLeft />Previous
              </Button>
              <Button size="sm" variant="ghost" disabled={!q || offset + BATCH >= q.research_total} onClick={() => setOffset(offset + BATCH)}>
                Next<ChevronRight />
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Panel({ id, title, aside, loading, children }: {
  id: string; title: string; aside?: React.ReactNode; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        {loading ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div> : children}
      </div>
    </section>
  );
}
