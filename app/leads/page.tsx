"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { Loader2, Plus, Search, ShieldCheck, X } from "lucide-react";
import { api, post, qs } from "@/lib/api";
import { ALL_STAGES, FLAG_LABELS, STAGE_LABELS } from "@/lib/crm";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page";
import { AiBadge, Rating, ScoreBadge, SiteChip, StageBadge, isPartialScore } from "@/components/chips";
import { useOpenLead } from "@/components/lead-sheet";
import { AutopilotButton } from "@/components/autopilot-launcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const PAGE = 200;
const COLS = "36px 52px minmax(220px,2fr) 130px 110px 64px 96px minmax(140px,1fr) 90px 54px minmax(160px,1.2fr) 92px";

export default function LeadsPage() {
  return (
    <React.Suspense>
      <Leads />
    </React.Suspense>
  );
}

function Leads() {
  const params = useSearchParams();
  const openLead = useOpenLead();
  const [f, setF] = React.useState({
    q: "", stage: params.get("stage") || "", status: "", ai_status: "", min_reviews: "", order: "reviews",
  });
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setF((x) => ({ ...x, q })), 250);
    return () => clearTimeout(t);
  }, [q]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const query = useInfiniteQuery({
    queryKey: ["leads-table", f],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ leads: Lead[]; total: number; offset: number }>(`/api/leads${qs({ ...f, limit: PAGE, offset: pageParam })}`),
    getNextPageParam: (last) => (last.offset + last.leads.length < last.total ? last.offset + PAGE : undefined),
  });
  const rows = React.useMemo(() => query.data?.pages.flatMap((p) => p.leads) || [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  const parent = React.useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 52, overscan: 12 });
  const items = virt.getVirtualItems();
  React.useEffect(() => {
    const last = items[items.length - 1];
    if (last && last.index >= rows.length - 30 && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [items, rows.length, query]);

  const toggle = (id: number) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allLoadedSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const selectable = rows.filter((r) => r.stage === "to_research" || r.stage === "drafted");

  const sel = (name: keyof typeof f, options: [string, string][], label: string) => (
    <select value={f[name]} onChange={(e) => setF({ ...f, [name]: e.target.value })} aria-label={label}
      className="h-9 rounded-md border border-input bg-card px-2.5 text-sm dark:bg-input/30">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col md:h-svh">
      <PageHeader title="Leads" description={`${total.toLocaleString()} matching. Click a row to open it, or tick rows to send them to Autopilot or finalize them.`} />

      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3 md:px-8">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, website, location or service" className="bg-card pl-8" />
        </div>
        <NewLeadDialog onCreated={(id) => openLead(id)} />
        {sel("stage", [["", "All stages"], ...ALL_STAGES.map((s) => [s, STAGE_LABELS[s]] as [string, string])], "Stage")}
        {sel("status", [["", "Any site status"], ["alive", "Site alive"], ["stale", "Site stale"], ["blocked", "Site blocked"], ["dead", "Site dead"], ["unknown", "Site unchecked"]], "Website status")}
        {sel("ai_status", [["", "Any AI status"], ["none", "Not researched"], ["done", "AI done"], ["needs_review", "AI needs review"], ["failed", "AI failed"], ["running", "Researching"]], "AI status")}
        {sel("min_reviews", [["", "Any reviews"], ["1", "1+ reviews"], ["5", "5+ reviews"], ["10", "10+ reviews"], ["25", "25+ reviews"]], "Minimum reviews")}
        {sel("order", [["reviews", "Most reviews"], ["score", "Best score"], ["rating", "Best rating"], ["updated", "Recently updated"], ["name", "Name A–Z"], ["followup", "Follow-up date"]], "Sort")}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b bg-carbon-soft px-6 py-2 text-sm md:px-8">
          <span className="font-medium">{selected.size} selected</span>
          <AutopilotButton leadIds={[...selected]} label={`Research ${selected.size} with AI`} />
          <BulkFinalize leads={rows.filter((r) => selected.has(r.id))} onDone={(ids) => setSelected((s) => {
            const n = new Set(s);
            ids.forEach((id) => n.delete(id));
            return n;
          })} />
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X />Clear</Button>
          <span className="text-xs text-muted-foreground">Only To research and Drafted leads go through Autopilot. Finalize picks the Drafted ones.</span>
        </div>
      )}

      <div ref={parent} className="min-h-0 flex-1 overflow-auto thin-scroll">
        <div className="min-w-[1240px]">
          <div className="sticky top-0 z-10 grid border-b bg-background/95 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur md:px-6"
            style={{ gridTemplateColumns: COLS }}>
            <input type="checkbox" aria-label="Select loaded rows" className="size-4 accent-[var(--carbon)]"
              checked={allLoadedSelected} onChange={() => setSelected(allLoadedSelected ? new Set() : new Set(selectable.map((r) => r.id)))} />
            <span className="text-right pr-3">Reviews</span>
            <span>Company</span><span>Stage</span><span>AI</span><span>Score</span><span>Site</span>
            <span>Location</span><span>Team</span><span>Rating</span><span>Next action</span><span>Follow-up</span>
          </div>
          <div style={{ height: virt.getTotalSize(), position: "relative" }}>
            {items.map((vi) => {
              const l = rows[vi.index];
              return <Row key={l.id} lead={l} top={vi.start} checked={selected.has(l.id)} onCheck={() => toggle(l.id)} />;
            })}
          </div>
          {query.isLoading && <div className="px-6 py-10 text-sm text-muted-foreground">Loading leads…</div>}
          {!query.isLoading && !rows.length && <div className="px-6 py-10 text-sm text-muted-foreground">No leads match these filters.</div>}
        </div>
      </div>
    </main>
  );
}

type NewLeadForm = {
  company_name: string;
  website: string;
  geography: string;
  source_type: string;
  source_url: string;
  campaign: string;
  review_count: string;
};

const EMPTY_LEAD: NewLeadForm = {
  company_name: "",
  website: "",
  geography: "",
  source_type: "manual",
  source_url: "",
  campaign: "",
  review_count: "",
};

function NewLeadDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewLeadForm>(EMPTY_LEAD);
  const [busy, setBusy] = React.useState(false);
  const set = (key: keyof NewLeadForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ id: number }>("/api/leads", {
        ...form,
        review_count: form.review_count ? Number(form.review_count) : 0,
      });
      toast.success("Lead added");
      setOpen(false);
      setForm(EMPTY_LEAD);
      qc.invalidateQueries();
      onCreated(r.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus />New lead
      </Button>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add lead</DialogTitle>
            <DialogDescription>Create a manually owned lead and send it to To research.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-company">Company name</Label>
              <Input id="lead-company" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-website">Website</Label>
              <Input id="lead-website" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-location">Location</Label>
              <Input id="lead-location" value={form.geography} onChange={(e) => set("geography", e.target.value)} placeholder="City, Country" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-source">Source type</Label>
              <Input id="lead-source" value={form.source_type} onChange={(e) => set("source_type", e.target.value)} placeholder="manual" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-reviews">Reviews</Label>
              <Input id="lead-reviews" type="number" min="0" value={form.review_count} onChange={(e) => set("review_count", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-source-url">Source URL</Label>
              <Input id="lead-source-url" value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="Profile or directory URL" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-campaign">Campaign / batch</Label>
              <Input id="lead-campaign" value={form.campaign} onChange={(e) => set("campaign", e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !form.company_name.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ lead: l, top, checked, onCheck }: { lead: Lead; top: number; checked: boolean; onCheck: () => void }) {
  const open = useOpenLead();
  return (
    <div onClick={() => open(l.id)}
      className={cn("absolute inset-x-0 grid h-[52px] cursor-pointer items-center border-b px-4 text-sm hover:bg-muted/50 md:px-6", checked && "bg-carbon-soft/50")}
      style={{ transform: `translateY(${top}px)`, gridTemplateColumns: COLS }}>
      <input type="checkbox" aria-label={`Select ${l.company_name}`} className="size-4 accent-[var(--carbon)]" checked={checked}
        onClick={(e) => e.stopPropagation()} onChange={onCheck} />
      <span className="pr-3 text-right font-semibold tabular-nums">{l.review_count}</span>
      <div className="min-w-0 pr-3">
        <div className="truncate font-medium">{l.company_name}</div>
        <div className="truncate text-xs text-muted-foreground">{l.subject || l.normalized_domain || "No website"}</div>
      </div>
      <StageBadge stage={l.stage} />
      <span><AiBadge status={l.ai_status} flags={l.ai_flags} /></span>
      <span><ScoreBadge total={l.score_total} partial={isPartialScore(l)} /></span>
      <span><SiteChip status={l.website_status} /></span>
      <span className="truncate pr-3 text-muted-foreground">{l.geography}</span>
      <span className="truncate text-muted-foreground">{l.employees}</span>
      <Rating value={l.rating} />
      <span className="truncate pr-3 text-muted-foreground">{l.next_action}</span>
      <span className="tabular-nums text-muted-foreground">{l.follow_up_date}</span>
    </div>
  );
}

type BulkResult = { finalized: { id: number; company: string }[]; skipped: { id: number; company: string; reason: string }[] };

/** Finalize several Drafted leads at once. The server runs the same link check as one-by-one. */
function BulkFinalize({ leads, onDone }: { leads: Lead[]; onDone: (ids: number[]) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [includeFlagged, setIncludeFlagged] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<BulkResult | null>(null);
  const drafted = leads.filter((l) => l.stage === "drafted");
  const flagged = drafted.filter((l) => l.ai_status === "needs_review");
  const n = includeFlagged ? drafted.length : drafted.length - flagged.length;
  if (!drafted.length) return null;

  const run = async () => {
    setBusy(true);
    try {
      const r = await post<BulkResult>("/api/leads/bulk_finalize", { ids: drafted.map((l) => l.id), include_flagged: includeFlagged });
      setResult(r);
      if (r.finalized.length) toast.success(`${r.finalized.length} finalized`, { description: "They're in the Send queue now." });
      onDone(r.finalized.map((x) => x.id));
      qc.invalidateQueries();
      if (!r.skipped.length) setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setResult(null); setIncludeFlagged(false); setOpen(true); }}>
        <ShieldCheck />Finalize {drafted.length} drafted
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{result ? "Finalize report" : `Finalize ${n} draft${n === 1 ? "" : "s"}?`}</DialogTitle>
            <DialogDescription>
              {result
                ? `${result.finalized.length} finalized and moved to the Send queue, ${result.skipped.length} skipped.`
                : "This approves them for Gmail. Anything with a link in the subject or body is refused, same as one by one."}
            </DialogDescription>
          </DialogHeader>

          {!result && !!flagged.length && (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
              <p>{flagged.length} of these {flagged.length === 1 ? "was" : "were"} flagged by the AI. They&apos;re skipped unless you include them:</p>
              <ul className="max-h-40 space-y-1 overflow-auto text-muted-foreground thin-scroll">
                {flagged.map((l) => (
                  <li key={l.id}><span className="font-medium text-foreground">{l.company_name}</span>{" "}
                    {(l.ai_flags || []).map((f) => FLAG_LABELS[f] || f).join(", ") || "needs review"}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 pt-1">
                <input type="checkbox" className="size-4 accent-[var(--carbon)]" checked={includeFlagged}
                  onChange={(e) => setIncludeFlagged(e.target.checked)} />
                Include the flagged ones too (I&apos;ve checked them)
              </label>
            </div>
          )}

          {result && !!result.skipped.length && (
            <ul className="max-h-60 space-y-1 overflow-auto text-sm thin-scroll">
              {result.skipped.map((x) => (
                <li key={x.id}><span className="font-medium">{x.company}</span> <span className="text-muted-foreground">{x.reason}</span></li>
              ))}
            </ul>
          )}

          <DialogFooter>
            {result ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={run} disabled={busy || !n}>
                  {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}Finalize {n}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
