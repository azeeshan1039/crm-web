"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlert, Mail, Plus, RefreshCw, Unplug } from "lucide-react";
import { api, post } from "@/lib/api";
import { relTime } from "@/lib/crm";
import type { GoogleStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function useGoogle() {
  return useQuery({ queryKey: ["google"], queryFn: () => api<GoogleStatus>("/api/google/status") });
}

/** Full-page redirect: Google's sign-in can't run inside a fetch. */
export const connectGmail = (hint?: string) => {
  window.location.href = `/api/google/connect${hint ? `?hint=${encodeURIComponent(hint)}` : ""}`;
};

export function GmailAccounts() {
  const qc = useQueryClient();
  const { data } = useGoogle();

  const disconnect = async (email: string) => {
    if (!window.confirm(`Disconnect ${email}? Drafts already in Gmail stay there.`)) return;
    await post("/api/google/disconnect", { email });
    toast.success(`${email} disconnected`);
    qc.invalidateQueries({ queryKey: ["google"] });
  };

  if (!data) return null;
  if (!data.configured) {
    return (
      <div className="flex gap-2 rounded-md border border-attention/30 bg-attention-soft px-3 py-2.5 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-attention" />
        Google isn&apos;t set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to crm\.env, then restart the CRM.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        {!data.accounts.length && (
          <div className="px-4 py-4 text-sm text-muted-foreground">No Gmail account connected yet.</div>
        )}
        {data.accounts.map((a) => (
          <div key={a.email} className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
            <Mail className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.email}</div>
              <div className={a.status === "connected" ? "text-xs text-muted-foreground" : "text-xs text-attention"}>
                {a.status === "connected"
                  ? `Connected ${relTime(a.connected_at)}${a.last_used ? `, last draft ${relTime(a.last_used)}` : ""}`
                  : "Google signed this account out. Reconnect to keep creating drafts."}
              </div>
            </div>
            <Button size="sm" variant={a.status === "connected" ? "ghost" : "default"} onClick={() => connectGmail(a.email)}>
              <RefreshCw />Reconnect
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => disconnect(a.email)}>
              <Unplug />Disconnect
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" onClick={() => connectGmail()}><Plus />Connect a Gmail account</Button>
      <p className="text-xs text-muted-foreground">
        Google will say &quot;Google hasn&apos;t verified this app&quot;. That&apos;s expected for your own private app:
        click Advanced, then Go to Work Pipeline CRM, then Continue. The CRM can only create drafts. It never sends.
        Google signs test apps out every 7 days, so you&apos;ll reconnect about once a week.
      </p>
    </div>
  );
}
