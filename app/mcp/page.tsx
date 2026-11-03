"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";

const MCP_URL = "https://crm-backend-swnk.onrender.com/mcp";

const CURSOR_CONFIG = `{
  "mcpServers": {
    "outreach-crm": {
      "url": "${MCP_URL}"
    }
  }
}`;

const TOOLS = [
  { name: "list_leads", does: "Search leads by company, website, location, services, stage, or campaign." },
  { name: "get_lead", does: "Open one lead, including the draft, contact, score, and recent activity." },
  { name: "create_lead", does: "Add a lead in To research. A matching website or company name is rejected unless you force it." },
  { name: "update_lead", does: "Change profile, contact, draft, score, and campaign fields on a lead this server is allowed to edit." },
  { name: "set_stage", does: "Move a lead. Uses the same stage rules as the Leads page." },
  { name: "delete_lead", does: "Permanently delete a lead this server is allowed to edit, including its activity." },
];

export default function McpGuidePage() {
  return (
    <main className="flex-1">
      <PageHeader
        title="Connect Claude, ChatGPT, or Cursor"
        description="Add the hosted CRM address as an MCP server. You only need this URL. The apps talk to the live database and can list, create, and update leads."
      />

      <div className="max-w-3xl space-y-10 px-6 py-6 md:px-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Server address</h2>
          <p className="text-sm text-muted-foreground">
            Paste this into the client. When it asks how to sign in, choose no authentication and leave headers blank.
            Anyone with this address can use the lead tools. New and edited leads belong to the CRM account the server is set up to act as.
          </p>
          <CopyBlock label="Server address" code={MCP_URL} />
          <p className="text-sm text-muted-foreground">
            The first connection after the host has been idle can take about a minute while it wakes up. If the client times out, wait and try again.
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Claude</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Custom connector on claude.ai, Claude Desktop, or the mobile app. A free account can add one custom connector.
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open <strong>Customize</strong>, then <strong>Connectors</strong>.</li>
            <li>Click <strong>+ Add</strong>, then <strong>Add custom connector</strong>.</li>
            <li>Name it <Code>Outreach CRM</Code>.</li>
            <li>Paste the server address and continue.</li>
            <li>When Claude asks how people connect, choose <strong>No sign in</strong>. Leave request headers empty, then click <strong>Add</strong>.</li>
            <li>In a chat, click <strong>+</strong> at the lower left, open <strong>Connectors</strong>, and turn <strong>Outreach CRM</strong> on.</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            On a Team or Enterprise plan, an Owner adds it first: <strong>Organization settings</strong>, <strong>Connectors</strong>, <strong>Add</strong>, <strong>Custom</strong>, <strong>Web</strong>, with the same address and <strong>No sign in</strong>. Each person then opens <strong>Customize</strong>, <strong>Connectors</strong>, and clicks <strong>Connect</strong>.
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">ChatGPT plugin</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add it on ChatGPT on the web. Business, Enterprise, and Edu workspaces can use the full set of tools, including writes.
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open <strong>Plugins</strong>.</li>
            <li>Click the plus button, then <strong>Add custom MCP server</strong>.</li>
            <li>Name it <Code>Outreach CRM</Code>. A description is optional, for example “List, create, and update outreach leads.”</li>
            <li>Under Connection, paste the server address.</li>
            <li>Set authentication to <strong>No authentication</strong>.</li>
            <li>Read the risk warning, check <strong>I understand and want to continue</strong>, then click <strong>Create as a plugin</strong>.</li>
            <li>Install the plugin. In a chat, type <Code>@</Code> and choose <strong>Outreach CRM</strong>.</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            If Plugins or Add custom MCP server is missing, a workspace admin has to allow custom MCP plugins. Write actions ask you to confirm before they run.
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Cursor</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add the address to your personal Cursor config so it is available in every project.
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Create <Code>mcp.json</Code> if it is missing. On Windows that file is <Code>C:\Users\your-name\.cursor\mcp.json</Code>. On Mac or Linux it is <Code>~/.cursor/mcp.json</Code>.
            </li>
            <li>Paste the config below. If the file already has other servers, add only the <Code>outreach-crm</Code> entry inside <Code>mcpServers</Code>.</li>
            <li>Open <strong>Customize</strong> in the Cursor sidebar, find <strong>outreach-crm</strong>, and switch it on.</li>
            <li>In Agent chat, ask it to list leads in To research. Approve the tool call when Cursor shows it.</li>
          </ol>
          <CopyBlock label="Cursor config" code={CURSOR_CONFIG} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">What you can ask</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>List leads in To research.</li>
            <li>Create a lead for Acme Studio, website https://acme.example.</li>
            <li>Show me lead 12, then update the contact email.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            A new lead shows up in this app under To research.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Tools</h2>
          <div className="overflow-hidden rounded-lg border bg-card">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="grid gap-1 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
                <code className="font-mono text-xs font-medium">{tool.name}</code>
                <span className="text-muted-foreground">{tool.does}</span>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Finalized needs a subject and message body that contain no links.</li>
            <li>Contacted needs <Code>confirm_sent</Code> set to true.</li>
            <li>Do not contact needs a <Code>suppression_reason</Code>.</li>
            <li>Stage keys: to_research, drafted, finalized, contacted, replied, call, proposal, won, do_not_contact, archived.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>;
}

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  return (
    <div className="relative rounded-md border bg-background">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="absolute top-2 right-2"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="overflow-x-auto p-3 pr-24 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  );
}
