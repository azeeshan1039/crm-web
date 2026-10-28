"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CircleAlert, Copy, ExternalLink, FileText, Loader2, Mail, MailPlus, Send, ShieldAlert } from "lucide-react";
import { ApiError, api, post } from "@/lib/api";
import type { DraftBatchResult, GmailItem } from "@/lib/types";
import { PageHeader, Empty } from "@/components/page";
import { Pill } from "@/components/chips";
import { useOpenLead } from "@/components/lead-sheet";
import { useStageActions } from "@/components/stage-actions";
import { connectGmail, useGoogle } from "@/components/gmail-accounts";
import { Button } from "@/components/ui/button";

const gmailDraftsUrl = (account: string) => `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#drafts`;

export default function SendQueuePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["gmail"], queryFn: () => api<{ batch: GmailItem[] }>("/api/gmail/batch") });
  const { data: google } = useGoogle();
  const batch = data?.batch || [];
  const addressed = batch.filter((b) => b.to).length;
  const connected = (google?.accounts || []).filter((a) => a.status === "connected");
  const signedOut = (google?.accounts || []).filter((a) => a.status !== "connected");

  // SOP 3: the sending account is chosen explicitly per batch - never preselected from last time.
  const [account, setAccount] = React.useState("");
  const [busy, setBusy] = React.useState<number | "all" | null>(null);
  const [result, setResult] = React.useState<DraftBatchResult | null>(null);
  const pending = batch.filter((b) => !b.gmail_draft_id && !b.has_links);

  const createDrafts = async (leadIds?: number[]) => {
    if (!account) return toast.error("Pick the Gmail account for this batch first.");
    setBusy(leadIds?.length === 1 ? leadIds[0] : "all");
    try {
      const r = await post<DraftBatchResult>("/api/gmail/drafts", { account, lead_ids: leadIds });
      setResult(r);
      if (r.created.length) {
        toast.success(`${r.created.length} draft${r.created.length === 1 ? "" : "s"} saved in ${account}`, {
          description: "Nothing was sent. Review and send them from Gmail.",
          action: { label: "Open Gmail", onClick: () => window.open(gmailDraftsUrl(account), "_blank") },
        });
      } else if (!r.failed.length) {
        toast("No new drafts to create", { description: r.skipped[0]?.reason });
      }
      if (r.failed.length) toast.error(r.failed[0].reason);
      qc.invalidateQueries();
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message, err.data?.reconnect
        ? { action: { label: "Reconnect", onClick: () => connectGmail(account) } } : undefined);
      qc.invalidateQueries({ queryKey: ["google"] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="flex-1">
      <PageHeader title="Send queue"
        description="Finalized messages, ready to go. Save them as Gmail drafts, then send each one yourself from Gmail. Sending by hand with no links is what kept your tests out of spam." />

      <div className="border-b bg-card px-6 py-4 md:px-8">
        {google && !google.configured ? (
          <p className="text-sm text-muted-foreground">Gmail isn&apos;t set up. See Settings.</p>
        ) : connected.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Connect a Gmail account to save these as drafts automatically.</span>
            <Button size="sm" onClick={() => connectGmail()}><Mail />Connect Gmail</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Save drafts in</span>
              <select value={account} onChange={(e) => setAccount(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 text-sm dark:bg-input/30">
                <option value="">Choose the account for this batch</option>
                {connected.map((a) => <option key={a.email} value={a.email}>{a.email}</option>)}
              </select>
            </label>
            <Button onClick={() => createDrafts()} disabled={!account || !pending.length || busy !== null}>
              {busy === "all" ? <Loader2 className="animate-spin" /> : <MailPlus />}
              Save {pending.length} as Gmail draft{pending.length === 1 ? "" : "s"}
            </Button>
            {account && (
              <a href={gmailDraftsUrl(account)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-carbon hover:underline">
                Open Gmail drafts<ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
        {signedOut.map((a) => (
          <div key={a.email} className="mt-3 flex items-center gap-2 text-sm text-attention">
            <CircleAlert className="size-4" />{a.email} was signed out by Google.
            <button type="button" onClick={() => connectGmail(a.email)} className="font-medium underline">Reconnect</button>
          </div>
        ))}
      </div>

      <div className="grid gap-6 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {result && <BatchReport r={result} onClose={() => setResult(null)} />}
          {isLoading && <Empty>Loading the finalized batch…</Empty>}
          {!isLoading && !batch.length && (
            <Empty>Nothing is finalized yet. Open a drafted lead, review the letter and click Finalize. It will show up here.</Empty>
          )}
          {batch.map((m) => (
            <MessageCard key={m.id} m={m} account={account} busy={busy === m.id}
              onDraft={() => createDrafts([m.id])} />
          ))}
        </div>

        <aside className="space-y-4 text-sm">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">This batch</h2>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
              <dt className="text-muted-foreground">Finalized</dt><dd>{batch.length}</dd>
              <dt className="text-muted-foreground">With an email address</dt><dd>{addressed}</dd>
              <dt className="text-muted-foreground">Contact form only</dt><dd>{batch.length - addressed}</dd>
              <dt className="text-muted-foreground">Saved as Gmail drafts</dt><dd>{batch.filter((b) => b.gmail_draft_id).length}</dd>
            </dl>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Before you hit Send</h2>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>Open the draft in the account you picked for this batch.</li>
              <li>Check the To address and greeting match the agency.</li>
              <li>Make sure no Gmail signature with links got added.</li>
              <li>Keep it to 10–20 sends a day per account, spaced out.</li>
              <li>Form-only drafts have no To. Paste the body into their contact form instead.</li>
              <li>After sending, come back and click <b className="font-medium text-foreground">I sent it</b>.</li>
            </ul>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Manage connected accounts in <Link href="/settings" className="text-carbon hover:underline">Settings</Link>.
          </p>
        </aside>
      </div>
    </main>
  );
}

function BatchReport({ r, onClose }: { r: DraftBatchResult; onClose: () => void }) {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="font-semibold">Drafts saved in {r.account}</h2>
          <p className="mt-0.5 text-muted-foreground">
            {r.created.length} created ({r.addressed} addressed, {r.form_only} with a blank To for contact forms),{" "}
            {r.skipped.length} skipped{r.failed.length ? `, ${r.failed.length} failed` : ""}. Nothing was sent.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Dismiss</Button>
      </div>
      {!!(r.skipped.length || r.failed.length) && (
        <ul className="mt-3 space-y-1 border-t pt-3">
          {[...r.failed.map((x) => ({ ...x, bad: true })), ...r.skipped.map((x) => ({ ...x, bad: false }))].map((x) => (
            <li key={`${x.id}-${x.reason}`} className="flex gap-2">
              <span className="font-medium">{x.company}</span>
              <span className={x.bad ? "text-destructive" : "text-muted-foreground"}>{x.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MessageCard({ m, account, busy, onDraft }: { m: GmailItem; account: string; busy: boolean; onDraft: () => void }) {
  const open = useOpenLead();
  const { requestStage } = useStageActions();
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    toast.success(`${what} copied`);
    setTimeout(() => setCopied(null), 1500);
  };
  const Ico = ({ w, icon: I }: { w: string; icon: React.ElementType }) => (copied === w ? <Check /> : <I />);

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <button type="button" onClick={() => open(m.id)} className="text-sm font-semibold hover:underline">{m.company_name}</button>
        <span className="text-xs text-muted-foreground">{m.review_count} reviews</span>
        {m.has_links ? <Pill tone="bad"><ShieldAlert className="size-3" />contains a link</Pill> : <Pill tone="good"><Check className="size-3" />link-free</Pill>}
        {m.gmail_draft_id && (
          <a href={gmailDraftsUrl(m.gmail_account || "")} target="_blank" rel="noopener">
            <Pill tone="carbon"><Mail className="size-3" />draft in {m.gmail_account}</Pill>
          </a>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" disabled={!m.to} onClick={() => copy(m.to, "To")}><Ico w="To" icon={Mail} />To</Button>
          <Button size="sm" variant="ghost" onClick={() => copy(m.subject, "Subject")}><Ico w="Subject" icon={Copy} />Subject</Button>
          <Button size="sm" variant="ghost" onClick={() => copy(m.message_draft, "Body")}><Ico w="Body" icon={FileText} />Body</Button>
          {!m.gmail_draft_id && (
            <Button size="sm" variant="outline" disabled={!account || m.has_links || busy} onClick={onDraft}
              title={!account ? "Pick the Gmail account above first" : undefined}>
              {busy ? <Loader2 className="animate-spin" /> : <MailPlus />}Save draft
            </Button>
          )}
          <Button size="sm" disabled={m.has_links}
            onClick={() => requestStage({ id: m.id, company_name: m.company_name, stage: "finalized", gmail_account: m.gmail_account }, "contacted")}>
            <Send />I sent it
          </Button>
        </div>
      </header>
      <div className="bg-muted/40 p-5">
        <div className="letter mx-auto max-w-[640px] rounded-sm px-8 py-6">
          <div className="mb-3 space-y-0.5 border-b border-[rgba(35,37,47,0.12)] pb-3 font-sans text-[13px]">
            <div><span className="inline-block w-16 text-[rgba(35,37,47,0.55)]">To</span>{m.to || <em className="text-[rgba(35,37,47,0.55)]">contact form: {m.contact_route || m.website}</em>}</div>
            <div><span className="inline-block w-16 text-[rgba(35,37,47,0.55)]">Subject</span><span className="font-medium">{m.subject}</span></div>
          </div>
          <p className="whitespace-pre-wrap text-[16px] leading-7">{m.message_draft}</p>
        </div>
      </div>
    </article>
  );
}
