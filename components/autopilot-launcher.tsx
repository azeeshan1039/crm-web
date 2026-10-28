"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Loader2, Play } from "lucide-react";
import { api, post } from "@/lib/api";
import type { Engine, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function useEngines() {
  return useQuery({
    queryKey: ["engines"],
    queryFn: () => api<{ engines: Engine[]; default: string }>("/api/autopilot/engines"),
    staleTime: 300_000,
  });
}

const EFFORTS = {
  claude: ["", "low", "medium", "high", "xhigh", "max"],
  codex: ["", "minimal", "low", "medium", "high"],
};

export function LauncherForm({ leadIds, defaultCount = 10, onStarted, compact }: {
  leadIds?: number[]; defaultCount?: number; onStarted?: (runId: number) => void; compact?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: eng } = useEngines();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
  const [engine, setEngine] = React.useState<"claude" | "codex" | null>(null);
  const [count, setCount] = React.useState(defaultCount);
  const [model, setModel] = React.useState<string | null>(null);
  const [effort, setEffort] = React.useState("");
  const [concurrency, setConcurrency] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  const chosen = engine ?? (settings?.default_engine || "claude");
  const conc = concurrency ?? settings?.concurrency ?? 2;
  const mdl = model ?? settings?.default_model ?? "";

  const start = async () => {
    setBusy(true);
    try {
      const body = { engine: chosen, model: mdl, effort, concurrency: conc, ...(leadIds?.length ? { lead_ids: leadIds } : { count }) };
      const r = await post<{ run_id: number; queued: number; skipped: number }>("/api/autopilot/runs", body);
      toast.success(`Autopilot started on ${r.queued} lead${r.queued === 1 ? "" : "s"}`, {
        description: r.skipped ? `${r.skipped} skipped (already queued, or past Drafted)` : undefined,
      });
      qc.invalidateQueries();
      if (onStarted) onStarted(r.run_id);
      else router.push(`/autopilot?run=${r.run_id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("grid gap-4", compact && "gap-3")}>
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Engine</span>
        <div className="grid grid-cols-2 gap-2">
          {(eng?.engines || [{ id: "claude", label: "Claude Code CLI", available: true, version: "", path: "" }, { id: "codex", label: "Codex CLI", available: true, version: "", path: "" }] as Engine[]).map((e) => (
            <button key={e.id} type="button" disabled={!e.available} onClick={() => setEngine(e.id)}
              className={cn("rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-40",
                chosen === e.id ? "border-carbon bg-carbon-soft" : "hover:bg-muted")}>
              <div className="text-sm font-medium">{e.label}</div>
              <div className="truncate text-[11px] text-muted-foreground">{e.available ? e.version || "installed" : "not installed"}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {leadIds?.length ? (
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Leads</span>
            <div className="flex h-9 items-center text-sm">{leadIds.length} selected</div>
          </div>
        ) : (
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Leads (top by reviews)</span>
            <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">At the same time</span>
          <select value={conc} onChange={(e) => setConcurrency(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Model (optional)</span>
          <Input value={mdl} onChange={(e) => setModel(e.target.value)} placeholder={chosen === "claude" ? "e.g. sonnet, opus" : "e.g. gpt-5-codex"} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Effort</span>
          <select value={effort} onChange={(e) => setEffort(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
            {EFFORTS[chosen].map((x) => <option key={x} value={x}>{x || "Default"}</option>)}
          </select>
        </label>
      </div>

      <Button onClick={start} disabled={busy} size="lg">
        {busy ? <Loader2 className="animate-spin" /> : <Play />}
        {leadIds?.length ? `Research ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}` : `Research the next ${count}`}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The AI reads each agency&apos;s public site, fills in the research and scorecard, and writes a link-free draft.
        Leads stop at Drafted. Finalizing and sending stay with you.
      </p>
    </div>
  );
}

export function AutopilotButton({ leadIds, label, variant = "default" }: {
  leadIds?: number[]; label?: string; variant?: "default" | "outline";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant}><Bot />{label || "Run Autopilot"}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px]">
        <LauncherForm leadIds={leadIds} compact onStarted={undefined} />
      </PopoverContent>
    </Popover>
  );
}
