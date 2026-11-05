"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot, Check, Copy, ExternalLink, Globe, Linkedin, Instagram, Dribbble, Facebook, Youtube, Twitter,
  Mail, FileText, Save, Send, Ban, Archive, MessageSquareReply, RotateCcw, Sparkles, TriangleAlert, Loader2,
  CalendarClock, ShieldCheck, ShieldAlert, History, Trash2,
} from "lucide-react";
import { del, api, patch, post } from "@/lib/api";
import {
  ALL_STAGES, DEV_CAPABILITY_LABELS, FLAG_LABELS, SCORE_FIELDS, SCORE_LABELS, STAGE_LABELS,
  cleanUrl, detectLinks, relTime, scoreBand, wordCount,
} from "@/lib/crm";
import type { Lead, LeadDetail as LeadDetailT, Settings, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/components/auth-gate";
import { useStageActions } from "@/components/stage-actions";
import { AiBadge, Pill, Rating, ScoreBadge, SiteChip, StageDot } from "@/components/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Draft = Partial<Lead>;

export function useLead(id: number | null) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<LeadDetailT>(`/api/leads/${id}`),
    enabled: id != null,
    refetchInterval: (q) => (["queued", "running"].includes(q.state.data?.ai_status || "") ? 3000 : false),
  });
}

export function LeadDetail({ id, onClose }: { id: number; onClose?: () => void }) {
  const { data: lead, isLoading, error } = useLead(id);
  if (error) return <div className="p-8 text-sm text-destructive">{(error as Error).message}</div>;
  if (isLoading || !lead) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  return <LeadEditor key={`${lead.id}:${lead.updated_at}`} lead={lead} onClose={onClose} />;
}

function LeadEditor({ lead, onClose }: { lead: LeadDetailT; onClose?: () => void }) {
  const qc = useQueryClient();
  const user = useAuthUser();
  const { requestStage, logFollowup } = useStageActions();
  const [draft, setDraft] = React.useState<Draft>({});
  const [saving, setSaving] = React.useState(false);
  const canMutate = lead.owner_user_id == null || lead.owner_user_id === user?.id;
  const v = <K extends keyof Lead>(k: K): Lead[K] => (k in draft ? (draft[k] as Lead[K]) : lead[k]);
  const set = (k: keyof Lead, val: unknown) => {
    if (!canMutate) return;
    setDraft((d) => ({ ...d, [k]: val }));
  };
  const dirty = Object.keys(draft).length > 0;

  const links = detectLinks(v("subject"), v("message_draft"));
  const total = SCORE_FIELDS.reduce<number | null>((a, f) => {
    const x = v(f as keyof Lead) as number | null | undefined;
    return x == null ? a : (a ?? 0) + x;
  }, null);

  const save = React.useCallback(async (silent = false) => {
    if (!canMutate) {
      if (!silent) toast.error("Only the lead owner can edit this lead.");
      return false;
    }
    if (!dirty) return true;
    setSaving(true);
    try {
      await patch(`/api/leads/${lead.id}`, draft);
      if (!silent) toast.success("Saved");
      qc.invalidateQueries();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [canMutate, dirty, draft, lead.id, qc]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const move = async (target: Stage) => {
    if (!canMutate) {
      toast.error("Only the lead owner can edit this lead.");
      return;
    }
    if (!(await save(true))) return;
    await requestStage(lead, target);
  };

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
  const rerun = async (engine: "claude" | "codex") => {
    if (dirty && !(await save(true))) return;
    try {
      const r = await post<{ run_id: number }>("/api/autopilot/runs", { engine, lead_ids: [lead.id], concurrency: 1 });
      toast.success(`Autopilot started on ${lead.company_name}`, {
        action: { label: "Watch", onClick: () => (window.location.href = `/autopilot?run=${r.run_id}`) },
      });
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const suggestion = async (accept: boolean) => {
    if (!canMutate) {
      toast.error("Only the lead owner can edit this lead.");
      return;
    }
    try {
      await post(`/api/leads/${lead.id}/ai_suggestion`, { accept });
      toast.success(accept ? "Suggestion accepted" : "Suggestion dismissed");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteLead = async () => {
    if (!canMutate) return;
    if (!window.confirm(`Delete ${lead.company_name}? This removes the lead and its activity history.`)) return;
    setSaving(true);
    try {
      await del(`/api/leads/${lead.id}`);
      toast.success("Lead deleted");
      qc.invalidateQueries();
      onClose?.();
      if (!onClose) window.location.href = "/leads";
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const aiBusy = lead.ai_status === "queued" || lead.ai_status === "running";
  const latestRun = lead.ai_runs?.[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="border-b px-6 pb-4 pt-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StageDot stage={lead.stage} />
              <span className="font-medium text-foreground/80">{STAGE_LABELS[lead.stage]}</span>
              {lead.geography && <span>{lead.geography}</span>}
              {lead.employees && <span>{lead.employees} people</span>}
              {lead.founded && <span>since {lead.founded}</span>}
            </div>
            <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight">{lead.company_name}</h2>
            <AssigneeField
              userId={v("assignee_user_id")}
              name={lead.assignee_name}
              email={lead.assignee_email}
              disabled={!canMutate}
              onChange={(id) => set("assignee_user_id", id)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-carbon hover:underline">
                  <Globe className="size-3.5" />{lead.normalized_domain || cleanUrl(lead.website)}
                </a>
              )}
              {lead.profile_url && (
                <a href={lead.profile_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />Clutch
                </a>
              )}
              <Socials lead={lead} />
              <span className="tabular-nums text-muted-foreground">{lead.review_count} reviews</span>
              <Rating value={lead.rating} />
              <SiteChip status={lead.website_status} />
              <ScoreBadge total={total} />
              <AiBadge status={lead.ai_status} flags={lead.ai_flags} />
            </div>
          </div>
          {!onClose && null}
        </div>

        {lead.ai_suggestion && (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-attention/30 bg-attention-soft px-3 py-2.5 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-attention" />
            <div className="flex-1">
              <span className="font-medium">AI suggests {lead.ai_suggestion}:</span>{" "}
              <span className="text-foreground/80">{lead.ai_suggestion_reason || "see research notes"}</span>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {lead.ai_suggestion === "exclude" ? "Accepting archives the lead with this reason." : "Accepting keeps it in To research with the verification task."}
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={!canMutate} onClick={() => suggestion(false)}>Dismiss</Button>
            <Button size="sm" disabled={!canMutate} onClick={() => suggestion(true)}>Accept</Button>
          </div>
        )}
        {!!lead.ai_flags?.length && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <TriangleAlert className="size-3.5 text-attention" />
            <span className="text-muted-foreground">Check before finalizing:</span>
            {lead.ai_flags.map((f) => <Pill key={f} tone="attention">{FLAG_LABELS[f] || f}</Pill>)}
          </div>
        )}
        {aiBusy && (
          <div className="mt-3 flex items-center gap-2 text-xs text-carbon">
            <Loader2 className="size-3.5 animate-spin" />
            Autopilot is {lead.ai_status === "queued" ? "about to research" : "researching"} this lead.
            {latestRun && <Link className="underline" href={`/autopilot?run=${latestRun.run_id}`}>Watch the terminal</Link>}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto thin-scroll xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:overflow-hidden">
        <section className="min-h-0 border-b xl:overflow-y-auto xl:border-b-0 xl:border-r thin-scroll">
          <Tabs defaultValue="research" className="gap-0">
            <TabsList className="mx-6 mt-4">
              <TabsTrigger value="research">Research</TabsTrigger>
              <TabsTrigger value="score">Scorecard</TabsTrigger>
              <TabsTrigger value="deal">Pipeline</TabsTrigger>
              <TabsTrigger value="clutch">Clutch data</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Development capability">
                  <NativeSelect value={v("dev_capability") || ""} onChange={(x) => set("dev_capability", x)}
                    options={Object.entries(DEV_CAPABILITY_LABELS)} />
                </Field>
                <Field label="Evidence confidence">
                  <NativeSelect value={v("confidence") || ""} onChange={(x) => set("confidence", x)}
                    options={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
                </Field>
                <Field label="Contact email" hint="Only an address published on the official site.">
                  <Input value={v("contact_email") || ""} onChange={(e) => set("contact_email", e.target.value)} placeholder="Blank if none published" />
                </Field>
                <Field label="Decision maker" hint="Verified name and role, otherwise blank.">
                  <Input value={v("decision_maker") || ""} onChange={(e) => set("decision_maker", e.target.value)} />
                </Field>
              </div>
              <Field label="Contact route">
                <Input value={v("contact_route") || ""} onChange={(e) => set("contact_route", e.target.value)} placeholder="Email on contact page, partnership form…" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--carbon)]" checked={!!v("contact_is_form")}
                  onChange={(e) => set("contact_is_form", e.target.checked ? 1 : 0)} />
                Contact form only (leave To blank in Gmail)
              </label>
              <Area label="Agency profile" value={v("agency_profile")} onChange={(x) => set("agency_profile", x)} rows={2} />
              <Area label="Relevant work" hint="One project and an honest observation." value={v("relevant_work")} onChange={(x) => set("relevant_work", x)} rows={3} />
              <Area label="Opportunity hypothesis" hint="A hypothesis, never a claimed need." value={v("opportunity_hypothesis")} onChange={(x) => set("opportunity_hypothesis", x)} rows={2} />
              <Area label="Pitch angle" value={v("pitch_angle")} onChange={(x) => set("pitch_angle", x)} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <Area label="Technology signals" value={v("tech_signals")} onChange={(x) => set("tech_signals", x)} rows={2} />
                <Area label="Restrictions" value={v("restrictions")} onChange={(x) => set("restrictions", x)} rows={2} />
              </div>
              <Evidence value={v("evidence_notes") || ""} onChange={(x) => set("evidence_notes", x)} />
            </TabsContent>

            <TabsContent value="score" className="px-6 py-5">
              <div className="divide-y rounded-lg border bg-card">
                {SCORE_FIELDS.map((f) => {
                  const cur = v(f as keyof Lead) as number | null | undefined;
                  return (
                    <div key={f} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{SCORE_LABELS[f].label}</div>
                        <div className="text-xs text-muted-foreground">{cur != null ? SCORE_LABELS[f].hint[cur] : "Not scored"}</div>
                      </div>
                      <div className="flex overflow-hidden rounded-md border">
                        {[0, 1, 2].map((n) => (
                          <button key={n} type="button"
                            onClick={() => set(f as keyof Lead, cur === n ? null : n)}
                            title={SCORE_LABELS[f].hint[n]}
                            className={cn("w-9 py-1.5 text-sm tabular-nums transition-colors",
                              n > 0 && "border-l",
                              cur === n ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-semibold tabular-nums">{total ?? "–"}</span>
                <span className="text-sm text-muted-foreground">of 14</span>
                {scoreBand(total) && <Pill tone={scoreBand(total)!.tone}>{scoreBand(total)!.label}</Pill>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">The score supports judgement. Any suppression or exclusion overrides it.</p>
            </TabsContent>

            <TabsContent value="deal" className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Next action">
                  <Input value={v("next_action") || ""} onChange={(e) => set("next_action", e.target.value)} />
                </Field>
                <Field label="Follow-up date">
                  <Input type="date" value={v("follow_up_date") || ""} onChange={(e) => set("follow_up_date", e.target.value)} />
                </Field>
                <Field label="Campaign / batch">
                  <Input value={v("campaign") || ""} onChange={(e) => set("campaign", e.target.value)} placeholder="2026-10 Clutch US design" />
                </Field>
                <Field label="Gmail account">
                  <Input value={v("gmail_account") || ""} onChange={(e) => set("gmail_account", e.target.value)} />
                </Field>
                <Field label="Proposed value (USD)" hint="An actual submitted proposal, not an estimate.">
                  <Input type="number" value={v("proposed_value") ?? ""} onChange={(e) => set("proposed_value", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Payment received (USD)">
                  <Input type="number" value={v("payment_received") ?? ""} onChange={(e) => set("payment_received", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
              </div>
              <Area label="Reply notes" value={v("reply_notes")} onChange={(x) => set("reply_notes", x)} rows={4} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm">
                <Fact k="Last contacted" v={lead.last_contacted} />
                <Fact k="Channel" v={lead.channel} />
                <Fact k="Follow-ups sent" v={String(lead.followup_count || 0)} />
                <Fact k="Gmail draft" v={lead.gmail_draft_id ? `recorded in ${lead.gmail_account}` : ""} />
                {lead.suppression_reason && <Fact k="Suppression reason" v={lead.suppression_reason} />}
              </dl>
            </TabsContent>

            <TabsContent value="clutch" className="space-y-4 px-6 py-5 text-sm">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-card p-4">
                <Fact k="Location" v={lead.geography} />
                <Fact k="Team size" v={lead.employees} />
                <Fact k="Founded" v={lead.founded} />
                <Fact k="Latest review" v={lead.latest_review} />
                <Fact k="Hourly rate" v={lead.hourly_rate} />
                <Fact k="Min project" v={lead.min_project_size} />
                <Fact k="Phone" v={lead.phone} />
                <Fact k="Site check" v={[lead.website_status, lead.website_issue].filter(Boolean).join(", ")} />
              </dl>
              {lead.services && <Block title="Services">{lead.services}</Block>}
              {lead.clutch_summary && <Block title="Clutch summary">{lead.clutch_summary}</Block>}
            </TabsContent>

            <TabsContent value="activity" className="px-6 py-5">
              {!!lead.ai_runs?.length && (
                <div className="mb-5 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Autopilot runs</div>
                  {lead.ai_runs.map((r) => (
                    <Link key={r.item_id} href={`/autopilot?run=${r.run_id}`}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:border-carbon/40">
                      <Bot className="size-4 text-carbon" />
                      <span className="font-medium">Run #{r.run_id}</span>
                      <span className="text-muted-foreground">{r.engine}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.outcome || r.error || r.status}</span>
                      <span className="text-xs text-muted-foreground">{relTime(r.finished_at || r.started_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
              <ol className="relative space-y-3 border-l pl-4">
                {lead.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className={cn("absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background",
                      e.type === "ai" ? "bg-carbon" : e.type === "stage_change" ? "bg-good" : "bg-muted-foreground/50")} />
                    <div className="text-foreground/90">{e.detail}</div>
                    <div className="text-xs text-muted-foreground">{e.type.replace("_", " ")}, {e.ts}</div>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>
        </section>

        {/* The letter */}
        <section className="min-h-0 bg-muted/40 px-6 py-5 xl:overflow-y-auto thin-scroll">
          <LetterEditor
            company={lead.company_name}
            to={v("contact_is_form") ? "" : v("contact_email") || ""}
            subject={v("subject") || ""}
            body={v("message_draft") || ""}
            onSubject={(x) => set("subject", x)}
            onBody={(x) => set("message_draft", x)}
            links={links}
            locked={!canMutate || !["to_research", "drafted", "finalized"].includes(lead.stage)}
          />
        </section>
      </div>

      {/* Action bar */}
      <footer className="flex flex-wrap items-center gap-2 border-t bg-card px-6 py-3">
        <Button onClick={() => save()} disabled={!canMutate || !dirty || saving} variant={dirty ? "default" : "outline"}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {dirty ? "Save changes" : "Saved"}
        </Button>
        {!canMutate && <span className="text-sm text-muted-foreground">Only the lead owner can edit or delete this lead.</span>}
        {canMutate && lead.owner_user_id == null && <span className="text-sm text-muted-foreground">Anyone signed in can edit or delete this lead.</span>}
        {["to_research", "drafted"].includes(lead.stage) && (
          <Button variant="outline" disabled={!canMutate || links.length > 0 || !v("subject") || !v("message_draft")}
            title={links.length ? "Remove every link from the message first" : undefined}
            onClick={() => move("finalized")}>
            <ShieldCheck />Finalize
          </Button>
        )}
        {lead.stage === "finalized" && (
          <Button disabled={!canMutate} onClick={() => move("contacted")}><Send />I sent it</Button>
        )}
        {["contacted", "replied", "call", "proposal"].includes(lead.stage) && (
          <>
            <Button variant="outline" disabled={!canMutate} onClick={() => logFollowup(lead)}><CalendarClock />Log follow-up</Button>
            <Button variant="outline" disabled={!canMutate} onClick={() => move("replied")}><MessageSquareReply />Log reply</Button>
          </>
        )}
        {["to_research", "drafted"].includes(lead.stage) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!canMutate || aiBusy}><Bot />{lead.ai_status && lead.ai_status !== "none" ? "Re-run AI" : "Research with AI"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Run Autopilot with</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => rerun("claude")}>Claude Code CLI{settings?.default_engine === "claude" && " (default)"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => rerun("codex")}>Codex CLI{settings?.default_engine === "codex" && " (default)"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" disabled={!canMutate}><RotateCcw />Move to…</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ALL_STAGES.filter((s) => s !== lead.stage).map((s, i) => (
                <React.Fragment key={s}>
                  {s === "do_not_contact" && i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => move(s)}>
                    <StageDot stage={s} />{STAGE_LABELS[s]}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {lead.stage !== "archived" && lead.stage !== "do_not_contact" && (
            <Button variant="ghost" disabled={!canMutate} onClick={() => move("archived")}><Archive />Archive</Button>
          )}
          {lead.stage !== "do_not_contact" && (
            <Button variant="ghost" disabled={!canMutate} className="text-destructive hover:text-destructive" onClick={() => move("do_not_contact")}>
              <Ban />Do not contact
            </Button>
          )}
          <Button variant="ghost" disabled={!canMutate || saving} className="text-destructive hover:text-destructive" onClick={deleteLead}>
            <Trash2 />Delete
          </Button>
          {onClose && <Link href={`/leads/${lead.id}`} className="text-xs text-muted-foreground hover:text-foreground">Open full page</Link>}
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------------- */

function LetterEditor({ company, to, subject, body, onSubject, onBody, links, locked }: {
  company: string; to: string; subject: string; body: string;
  onSubject: (s: string) => void; onBody: (s: string) => void;
  links: { match: string; kind: string }[]; locked: boolean;
}) {
  const words = wordCount(body);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [body]);

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  const greet = body.split("\n")[0] || "";
  const greetingOk = !body || /^Hi .+,$/.test(greet.trim());

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">First-touch message</h3>
        <span className={cn("text-xs tabular-nums", words && (words < 90 || words > 160) ? "text-attention" : "text-muted-foreground")}>
          {words} words{words ? " (aim for 90–160)" : ""}
        </span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={!to} onClick={() => copy(to, "Recipient")}><Mail />To</Button>
          <Button size="sm" variant="ghost" disabled={!subject} onClick={() => copy(subject, "Subject")}><Copy />Subject</Button>
          <Button size="sm" variant="ghost" disabled={!body} onClick={() => copy(body, "Body")}><FileText />Body</Button>
        </div>
      </div>

      <div className="letter rounded-sm px-8 pb-8 pt-6">
        <div className="mb-4 space-y-1 border-b border-[rgba(35,37,47,0.12)] pb-3 font-sans text-[13px]">
          <div className="flex gap-2"><span className="w-14 text-[rgba(35,37,47,0.55)]">To</span>
            <span className={cn(!to && "italic text-[rgba(35,37,47,0.5)]")}>{to || "contact form, no address"}</span></div>
          <div className="flex items-center gap-2"><span className="w-14 text-[rgba(35,37,47,0.55)]">Subject</span>
            <input value={subject} readOnly={locked} onChange={(e) => onSubject(e.target.value)}
              placeholder={`Development support for ${company}`}
              className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-[rgba(35,37,47,0.4)]" /></div>
        </div>
        <textarea ref={ref} value={body} readOnly={locked} onChange={(e) => onBody(e.target.value)} spellCheck
          placeholder={`Hi ${company} team,\n\nNo draft yet. Run Autopilot, or write it here.`}
          className="block min-h-[22rem] w-full resize-none bg-transparent text-[16.5px] leading-7 outline-none placeholder:text-[rgba(35,37,47,0.4)]" />
      </div>

      <div className={cn("mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm",
        links.length ? "bg-destructive/10 text-destructive" : "bg-good-soft text-good")}>
        {links.length ? <ShieldAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
        {links.length ? (
          <div>
            <div className="font-medium">Remove these before finalizing. Links sent your test emails to spam.</div>
            <ul className="mt-1 space-y-0.5">
              {links.map((l, i) => <li key={i}><code className="font-mono text-xs">{l.match}</code> <span className="opacity-70">{l.kind}</span></li>)}
            </ul>
          </div>
        ) : (
          <span>{locked ? "No links in the message that was sent." : "No links found. This message is safe to finalize."}</span>
        )}
      </div>
      {!greetingOk && (
        <p className="mt-2 text-xs text-attention">The greeting should read &quot;Hi [First name],&quot; for a verified person, otherwise &quot;Hi {company} team,&quot;.</p>
      )}
      {locked && <p className="mt-2 text-xs text-muted-foreground">This message has been sent, so it&apos;s kept as the record of what went out.</p>}
    </div>
  );
}

function Evidence({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  const lines = value.split("\n").filter(Boolean);
  const parsed = lines.map((l) => {
    const m = l.match(/^- \[(HIGH|MEDIUM|LOW)\] (.*?) — (https?:\/\/\S+)\s*$/);
    return m ? { conf: m[1].toLowerCase(), claim: m[2], url: m[3] } : { text: l };
  });
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Evidence (facts, sources, confidence)</span>
        <button type="button" onClick={() => setEditing(!editing)} className="ml-auto text-xs text-carbon hover:underline">
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing || !value ? (
        <Textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs"
          placeholder="- [HIGH] Claim — https://source (accessed date)" />
      ) : (
        <ul className="space-y-1.5 rounded-lg border bg-card p-3">
          {parsed.map((p, i) =>
            "claim" in p ? (
              <li key={i} className="flex gap-2 text-sm">
                <Pill tone={p.conf === "high" ? "good" : p.conf === "medium" ? "carbon" : "attention"} className="mt-0.5 shrink-0">{p.conf}</Pill>
                <span className="min-w-0">
                  {p.claim}{" "}
                  <a href={p.url} target="_blank" rel="noopener" className="break-all text-xs text-carbon hover:underline">{cleanUrl(p.url)}</a>
                </span>
              </li>
            ) : (
              <li key={i} className={cn("text-sm", p.text?.startsWith("AI research") ? "text-xs text-muted-foreground" : "text-foreground/80")}>{p.text}</li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function Socials({ lead }: { lead: Lead }) {
  const items: [string | undefined, React.ElementType, string][] = [
    [lead.social_linkedin, Linkedin, "LinkedIn"], [lead.social_instagram, Instagram, "Instagram"],
    [lead.social_dribbble, Dribbble, "Dribbble"], [lead.social_behance, History, "Behance"],
    [lead.social_facebook, Facebook, "Facebook"], [lead.social_twitter, Twitter, "X"], [lead.social_youtube, Youtube, "YouTube"],
  ];
  const present = items.filter(([u]) => u);
  if (!present.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {present.map(([u, Icon, label]) => (
        <a key={label} href={u} target="_blank" rel="noopener" title={label} className="text-muted-foreground hover:text-foreground">
          {label === "Behance" ? <span className="text-[11px] font-bold">Bē</span> : <Icon className="size-3.5" />}
        </a>
      ))}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

function Area({ label, hint, value, onChange, rows = 3 }: {
  label: string; hint?: string; value?: string; onChange: (s: string) => void; rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} className="min-h-0 text-sm" />
    </Field>
  );
}

export function NativeSelect({ value, onChange, options, className }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30", className)}>
      <option value="">Not set</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function AssigneeField({ userId, name, email, disabled, onChange }: {
  userId?: number | null; name?: string | null; email?: string | null; disabled: boolean; onChange: (id: number) => void;
}) {
  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: { id: number; name: string; email: string }[] }>("/api/users"),
    enabled: !disabled,
  });
  const label = name ? `${name}${email ? ` (${email})` : ""}` : "Unassigned";
  if (disabled) {
    return <div className="mt-2 text-sm text-muted-foreground">Assignee: <span className="text-foreground">{label}</span></div>;
  }
  return (
    <label className="mt-2 flex max-w-md items-center gap-2 text-sm">
      <span className="text-muted-foreground">Assignee</span>
      <select value={userId == null ? "" : String(userId)} onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
        {!userId && <option value="">Choose who manages this lead</option>}
        {userId && !(data?.users || []).some((user) => user.id === userId) && (
          <option value={userId}>{label}</option>
        )}
        {(data?.users || []).map((user) => (
          <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
        ))}
      </select>
    </label>
  );
}

function Fact({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="truncate">{v || <span className="text-muted-foreground/60">None</span>}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <p className="whitespace-pre-line rounded-lg border bg-card p-3 leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}
