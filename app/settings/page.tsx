"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Save } from "lucide-react";
import { api, post } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { PageHeader } from "@/components/page";
import { useEngines } from "@/components/autopilot-launcher";
import { GmailAccounts } from "@/components/gmail-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
  if (!data) return <main className="flex-1"><PageHeader title="Settings" /></main>;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient();
  const [s, setS] = React.useState(initial);
  const { data: eng, refetch, isFetching } = useEngines();

  const save = async () => {
    try {
      // gmail_accounts is managed by Connect / Disconnect, so it isn't sent from here.
      const { gmail_accounts: _ignored, ...rest } = s;
      void _ignored;
      await post("/api/settings", rest);
      toast.success("Settings saved");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Coming back from Google's sign-in: show the outcome once, then tidy the URL.
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ok = q.get("gmail_connected"), err = q.get("gmail_error");
    if (ok) toast.success(`${ok} connected. Drafts can now be created in this account.`);
    if (err) toast.error(`Gmail connection failed: ${err}`);
    if (ok || err) {
      window.history.replaceState(null, "", "/settings");
      qc.invalidateQueries({ queryKey: ["google"] });
    }
  }, [qc]);

  const recheck = async () => {
    await api("/api/autopilot/engines?refresh=1");
    refetch();
  };

  return (
    <main className="flex-1">
      <PageHeader title="Settings">
        <Button onClick={save}><Save />Save settings</Button>
      </PageHeader>
      <div className="max-w-3xl space-y-10 px-6 py-6 md:px-8">
        <Group title="Gmail" desc="Connect the accounts you send from. The CRM creates drafts in the account you pick for each batch. You review and send them in Gmail.">
          <GmailAccounts />
        </Group>

        <Group title="AI engines" desc="Autopilot runs these CLIs on this machine with your existing logins. No API keys are needed.">
          <div className="grid gap-2 sm:grid-cols-2">
            {eng?.engines.map((e) => (
              <div key={e.id} className="rounded-md border bg-card px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <span className={`size-2 rounded-full ${e.available ? "bg-good" : "bg-destructive"}`} />{e.label}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground" title={e.path}>{e.available ? e.version : "Not found on PATH"}</div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={recheck} disabled={isFetching}><RefreshCw className={isFetching ? "animate-spin" : ""} />Check again</Button>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default engine">
              <select value={s.default_engine} onChange={(e) => setS({ ...s, default_engine: e.target.value as Settings["default_engine"] })}
                className="h-9 rounded-md border border-input bg-card px-2.5 text-sm dark:bg-input/30">
                <option value="claude">Claude Code CLI</option>
                <option value="codex">Codex CLI</option>
              </select>
            </Field>
            <Field label="Default model" hint="Blank uses the CLI's own default.">
              <Input value={s.default_model} onChange={(e) => setS({ ...s, default_model: e.target.value })} placeholder="e.g. sonnet" />
            </Field>
            <Field label="Leads at the same time" hint="2 is a good balance. Higher uses your plan's limits faster.">
              <Input type="number" min={1} max={4} value={s.concurrency} onChange={(e) => setS({ ...s, concurrency: Number(e.target.value) })} />
            </Field>
            <Field label="Time limit per lead (minutes)">
              <Input type="number" min={2} max={30} value={s.timeout_min} onChange={(e) => setS({ ...s, timeout_min: Number(e.target.value) })} />
            </Field>
          </div>
        </Group>

        <Group title="Your voice" desc="What the AI uses when it writes drafts. Change the proof examples here and every new draft picks them up.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sign-off name" hint="Required. Every draft ends with this name.">
              <Input placeholder="e.g. Alex Example" value={s.sender_name} onChange={(e) => setS({ ...s, sender_name: e.target.value })} />
            </Field>
            <Field label="Where you're based" hint="Mentioned once, in the closing paragraph, with the freelance terms.">
              <Input placeholder="e.g. Portugal" value={s.sender_location} onChange={(e) => setS({ ...s, sender_location: e.target.value })} />
            </Field>
          </div>
          <Field label="First-email offer" hint="Every draft also says you work freelance, on a contract basis, with no long-term commitment.">
            <select value={s.offer_style} onChange={(e) => setS({ ...s, offer_style: e.target.value as Settings["offer_style"] })}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-sm dark:bg-input/30">
              <option value="paid_guarantee">Small fixed-price task, and they don&apos;t pay if they&apos;re not happy</option>
              <option value="paid">Small fixed-price task</option>
            </select>
          </Field>
          <Field label="Positioning and proof library" hint="Replace every [placeholder] with your own projects - Autopilot won't run until you do. One example per angle; the AI uses at most one or two per email.">
            <Textarea rows={12} value={s.proof_library} onChange={(e) => setS({ ...s, proof_library: e.target.value })} className="font-mono text-xs leading-relaxed" />
          </Field>
        </Group>

      </div>
    </main>
  );
}

function Group({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
