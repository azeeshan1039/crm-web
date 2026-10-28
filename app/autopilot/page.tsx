"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Check, CircleAlert, CircleDashed, Loader2, Square, TriangleAlert } from "lucide-react";
import { api, post } from "@/lib/api";
import type { Run, RunDetail, RunItem } from "@/lib/types";
import { duration, relTime } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page";
import { LauncherForm } from "@/components/autopilot-launcher";
import { Terminal } from "@/components/terminal";
import { useOpenLead } from "@/components/lead-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function AutopilotPage() {
  return (
    <React.Suspense>
      <Autopilot />
    </React.Suspense>
  );
}

function Autopilot() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: runs } = useQuery({
    queryKey: ["runs"],
    queryFn: () => api<{ runs: Run[] }>("/api/autopilot/runs"),
    refetchInterval: 3000,
  });
  const selected = Number(params.get("run")) || runs?.runs[0]?.id || null;
  const select = (id: number) => router.replace(`/autopilot?run=${id}`, { scroll: false });

  return (
    <main className="flex min-h-0 flex-1 flex-col xl:h-svh">
      <PageHeader title="Autopilot"
        description="Let Claude or Codex research leads and write first drafts while you do something else. Every page it opens shows up in the terminal." />
      <div className="grid min-h-0 flex-1 gap-6 px-6 py-6 md:px-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:overflow-y-auto xl:pr-1 thin-scroll">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Start a run</h2>
            <LauncherForm onStarted={select} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent runs</h2>
            <div className="overflow-hidden rounded-lg border bg-card">
              {!runs?.runs.length && <div className="px-3 py-5 text-sm text-muted-foreground">No runs yet.</div>}
              {runs?.runs.map((r) => (
                <button key={r.id} type="button" onClick={() => select(r.id)}
                  className={cn("flex w-full items-center gap-3 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/60",
                    r.id === selected && "bg-carbon-soft hover:bg-carbon-soft")}>
                  <RunStatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Run #{r.id} <span className="font-normal text-muted-foreground">{r.engine === "claude" ? "Claude" : "Codex"}{r.model ? `, ${r.model}` : ""}</span></div>
                    <div className="text-xs text-muted-foreground">{r.done + r.failed} of {r.total} leads{r.failed ? `, ${r.failed} failed` : ""}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{relTime(r.created_at)}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        {selected ? <RunView id={selected} /> : (
          <div className="grid place-items-center rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Start a run on the left. Its live output will appear here.
          </div>
        )}
      </div>
    </main>
  );
}

function RunView({ id }: { id: number }) {
  const qc = useQueryClient();
  const openLead = useOpenLead();
  const [item, setItem] = React.useState<number | null>(null);
  React.useEffect(() => setItem(null), [id]);
  const { data: run } = useQuery({
    queryKey: ["run", id],
    queryFn: () => api<RunDetail>(`/api/autopilot/runs/${id}`),
    refetchInterval: (q) => (["queued", "running"].includes(q.state.data?.status || "running") ? 1500 : false),
  });
  const live = !!run && ["queued", "running"].includes(run.status);

  const cancel = async () => {
    await post(`/api/autopilot/runs/${id}/cancel`);
    toast("Cancelling. The leads in progress will stop shortly.");
    qc.invalidateQueries();
  };

  if (!run) return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading run…</div>;
  const finished = run.done + run.failed;
  const drafted = run.items.filter((i) => i.outcome?.startsWith("Drafted")).length;

  return (
    <section className="flex min-h-[640px] min-w-0 flex-col gap-4 xl:min-h-0">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <h2 className="text-lg font-semibold">Run #{run.id}</h2>
          <p className="text-xs text-muted-foreground">
            {run.engine === "claude" ? "Claude Code CLI" : "Codex CLI"}{run.model ? `, model ${run.model}` : ""}{run.effort ? `, ${run.effort} effort` : ""}, {run.concurrency} at a time, started {relTime(run.created_at)}
          </p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{finished} of {run.total} done{drafted ? `, ${drafted} drafted` : ""}{run.failed ? `, ${run.failed} failed` : ""}</span>
            <span className="capitalize">{run.status}</span>
          </div>
          <Progress value={(finished / Math.max(1, run.total)) * 100} />
        </div>
        {live && <Button variant="outline" onClick={cancel}><Square />Stop run</Button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 thin-scroll">
        <ItemChip active={item == null} onClick={() => setItem(null)} label="All leads" status={live ? "running" : "done"} />
        {run.items.map((it) => (
          <ItemChip key={it.id} active={item === it.id} onClick={() => setItem(it.id)} label={it.company_name} status={it.status}
            meta={duration(it.started_at, it.finished_at)} />
        ))}
      </div>

      <Terminal runId={run.id} live={live} itemFilter={item} className="min-h-[360px] flex-1" />

      <div className="overflow-hidden rounded-lg border bg-card">
        {run.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
            <ItemIcon status={it.status} />
            <span className="w-48 shrink-0 truncate font-medium">{it.company_name}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.error || it.outcome || it.status}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{duration(it.started_at, it.finished_at)}</span>
            <Button size="sm" variant="ghost" onClick={() => openLead(it.lead_id)}>
              {it.outcome?.startsWith("Drafted") ? "Review draft" : "Open lead"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ItemChip({ active, onClick, label, status, meta }: {
  active: boolean; onClick: () => void; label: string; status: RunItem["status"] | "running" | "done"; meta?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-carbon bg-carbon-soft text-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
      <ItemIcon status={status} />
      <span className="max-w-40 truncate">{label}</span>
      {meta && <span className="tabular-nums opacity-70">{meta}</span>}
    </button>
  );
}

function ItemIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="size-3.5 shrink-0 animate-spin text-carbon" />;
  if (status === "done") return <Check className="size-3.5 shrink-0 text-good" />;
  if (status === "needs_review") return <TriangleAlert className="size-3.5 shrink-0 text-attention" />;
  if (status === "failed") return <CircleAlert className="size-3.5 shrink-0 text-destructive" />;
  if (status === "cancelled") return <Ban className="size-3.5 shrink-0 text-muted-foreground" />;
  return <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />;
}

function RunStatusIcon({ status }: { status: Run["status"] }) {
  return <ItemIcon status={status === "queued" ? "queued" : status === "running" ? "running" : status === "done" ? "done" : status === "cancelled" ? "cancelled" : "failed"} />;
}
