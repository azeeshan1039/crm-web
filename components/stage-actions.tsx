"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, post, patch } from "@/lib/api";
import { STAGE_LABELS } from "@/lib/crm";
import type { Lead, Stage } from "@/lib/types";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LeadRef = Pick<Lead, "id" | "company_name" | "stage"> & Partial<Pick<Lead, "gmail_account" | "channel">>;
type Pending = { lead: LeadRef; target: Stage; resolve: (ok: boolean) => void };

interface Ctx {
  /** Move a lead, opening the right guard-rail dialog first when the SOP needs one. */
  requestStage: (lead: LeadRef, target: Stage) => Promise<boolean>;
  logFollowup: (lead: LeadRef) => Promise<void>;
}

const StageCtx = React.createContext<Ctx | null>(null);
export const useStageActions = () => {
  const c = React.useContext(StageCtx);
  if (!c) throw new Error("StageActionsProvider missing");
  return c;
};

const SUPPRESSION_REASONS = ["Opt-out", "Bounce", "Region restriction", "Rejection", "Broken route", "Owner decision"];

export function StageActionsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ date: "", channel: "", reason: "", note: "" });

  const refresh = React.useCallback(() => qc.invalidateQueries(), [qc]);

  const send = React.useCallback(
    async (lead: LeadRef, target: Stage, extra: Record<string, unknown> = {}) => {
      try {
        await post(`/api/leads/${lead.id}/stage`, { stage: target, ...extra });
        toast.success(`${lead.company_name} moved to ${STAGE_LABELS[target]}`);
        refresh();
        return true;
      } catch (e) {
        const err = e as ApiError;
        const links = (err.data?.links as { match: string }[] | undefined) || [];
        toast.error(err.message, {
          description: links.length ? `Remove: ${links.map((l) => l.match).join(", ")}` : undefined,
        });
        return false;
      }
    },
    [refresh],
  );

  const requestStage = React.useCallback(
    (lead: LeadRef, target: Stage) => {
      if (lead.stage === target) return Promise.resolve(true);
      if (["contacted", "do_not_contact", "replied", "archived"].includes(target)) {
        return new Promise<boolean>((resolve) => {
          setForm({
            date: new Date().toISOString().slice(0, 10),
            channel: lead.gmail_account || lead.channel || "Gmail",
            reason: "",
            note: "",
          });
          setPending({ lead, target, resolve });
        });
      }
      return send(lead, target, { note: target === "finalized" ? "Finalized for Gmail." : "" });
    },
    [send],
  );

  const logFollowup = React.useCallback(
    async (lead: LeadRef) => {
      try {
        const r = await post<{ next_action: string; follow_up_date: string }>(`/api/leads/${lead.id}/followup`);
        toast.success("Follow-up logged", {
          description: r.follow_up_date ? `Next: ${r.next_action} on ${r.follow_up_date}` : r.next_action,
        });
        refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [refresh],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const confirm = async () => {
    if (!pending) return;
    const { lead, target } = pending;
    setBusy(true);
    let ok = false;
    if (target === "contacted") {
      ok = await send(lead, target, { confirm_sent: true, date: form.date, channel: form.channel, note: form.note });
    } else if (target === "do_not_contact") {
      ok = await send(lead, target, { suppression_reason: form.reason, note: form.note });
    } else if (target === "archived") {
      ok = await send(lead, target, { suppression_reason: form.reason || undefined, note: form.reason });
    } else if (target === "replied") {
      try {
        if (form.note) await patch(`/api/leads/${lead.id}`, { reply_notes: form.note });
        ok = await send(lead, target, { note: form.note });
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setBusy(false);
    if (ok) close(true);
  };

  const t = pending?.target;
  const canConfirm =
    t === "contacted" ? !!form.date : t === "do_not_contact" ? form.reason.trim().length > 0 : true;

  return (
    <StageCtx.Provider value={{ requestStage, logFollowup }}>
      {children}
      <Dialog open={!!pending} onOpenChange={(o) => !o && close(false)}>
        <DialogContent className="sm:max-w-md">
          {t === "contacted" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm you sent it</DialogTitle>
                <DialogDescription>
                  Only confirm once the message to {pending?.lead.company_name} shows in Gmail Sent, or the contact form
                  showed its success message. The first follow-up is scheduled 5 business days after the send date.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sent-date">Send date</Label>
                  <Input id="sent-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sent-channel">Sent from</Label>
                  <Input id="sent-channel" value={form.channel} placeholder="you@gmail.com or contact form"
                    onChange={(e) => setForm({ ...form, channel: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sent-note">Edits made while sending (optional)</Label>
                  <Input id="sent-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
            </>
          )}
          {t === "do_not_contact" && (
            <>
              <DialogHeader>
                <DialogTitle>Never contact {pending?.lead.company_name}?</DialogTitle>
                <DialogDescription>
                  This suppresses the agency permanently. The record stays in the CRM so it can&apos;t be sourced again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-1.5">
                {SUPPRESSION_REASONS.map((r) => (
                  <Button key={r} type="button" size="sm" variant={form.reason === r ? "default" : "outline"}
                    onClick={() => setForm({ ...form, reason: r })}>{r}</Button>
                ))}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dnc-reason">Reason</Label>
                <Input id="dnc-reason" value={form.reason} placeholder="Required"
                  onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </>
          )}
          {t === "archived" && (
            <>
              <DialogHeader>
                <DialogTitle>Archive {pending?.lead.company_name}</DialogTitle>
                <DialogDescription>
                  Archived leads aren&apos;t suppressed. They stay searchable and can be requalified later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor="arch-reason">Why (optional)</Label>
                <Input id="arch-reason" value={form.reason} placeholder="Poor fit, no response, timing…"
                  onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </>
          )}
          {t === "replied" && (
            <>
              <DialogHeader>
                <DialogTitle>Log a reply from {pending?.lead.company_name}</DialogTitle>
                <DialogDescription>
                  Summarize what they said in their own words. Moving to Replied doesn&apos;t cancel the follow-up date, so
                  set the next action on the lead afterwards.
                </DialogDescription>
              </DialogHeader>
              <Textarea rows={5} value={form.note} placeholder="They're interested in help with a Shopify cart feature next month…"
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={!canConfirm || busy}
              variant={t === "do_not_contact" ? "destructive" : "default"}>
              {t === "contacted" && "Mark as contacted"}
              {t === "do_not_contact" && "Suppress lead"}
              {t === "archived" && "Archive lead"}
              {t === "replied" && "Log reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StageCtx.Provider>
  );
}
