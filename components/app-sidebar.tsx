"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bot, Columns3, Gauge, Inbox, Loader2, LogOut, Mail, Moon, Settings, Sun, Table2, WifiOff,
} from "lucide-react";
import { useAuthUser } from "@/components/auth-gate";
import { api, post } from "@/lib/api";
import type { Meta, Run } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Today", icon: Inbox },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/leads", label: "Leads", icon: Table2 },
  { href: "/autopilot", label: "Autopilot", icon: Bot },
  { href: "/gmail", label: "Send queue", icon: Mail },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api<Meta>("/api/meta"), refetchInterval: 15_000 });
}

export function useAutopilotStatus() {
  return useQuery({
    queryKey: ["ap-status"],
    queryFn: () => api<{ active: Run[]; done: number; total: number }>("/api/autopilot/status"),
    refetchInterval: (q) => (q.state.data?.active.length ? 2000 : 10_000),
  });
}

export function AppSidebar() {
  const path = usePathname();
  const { data: meta, isError } = useMeta();
  const { data: ap } = useAutopilotStatus();
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useMutation({
    mutationFn: () => post("/api/auth/logout"),
    onSuccess: async () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });
  // The theme is only known in the browser; render the toggle after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const c = meta?.counts;
  const badge: Record<string, number | undefined> = c && {
    "/": (c.replied + c.call + c.proposal) || undefined,
    "/gmail": c.finalized || undefined,
    "/pipeline": c.drafted || undefined,
  } || {};

  const running = ap?.active.length ? ap : null;

  return (
    <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground max-md:hidden">
      <div className="px-4 pb-5 pt-5">
        <div className="text-[15px] font-semibold tracking-tight">Work Pipeline</div>
        <div className="text-xs text-muted-foreground">Agency outreach desk</div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
              <Icon className={cn("size-4", active ? "text-carbon" : "opacity-70")} />
              <span className="flex-1">{label}</span>
              {badge[href] ? <span className="text-xs tabular-nums text-muted-foreground">{badge[href]}</span> : null}
            </Link>
          );
        })}
      </nav>

      {running && (
        <Link href={`/autopilot?run=${running.active[0].id}`}
          className="mx-2 mt-5 rounded-md border border-carbon/30 bg-carbon-soft px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-carbon">
            <Loader2 className="size-3.5 animate-spin" />
            Autopilot running
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-carbon/15">
            <div className="h-full bg-carbon transition-all" style={{ width: `${(running.done / Math.max(1, running.total)) * 100}%` }} />
          </div>
          <div className="mt-1 tabular-nums text-muted-foreground">{running.done} of {running.total} leads</div>
        </Link>
      )}

      <div className="mt-auto space-y-3 px-4 pb-4 text-xs text-muted-foreground">
        {user && (
          <div className="rounded-md border bg-background/70 p-2.5">
            <div className="truncate font-medium text-foreground">{user.name}</div>
            <div className="truncate">{user.email}</div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="mt-2 inline-flex items-center gap-1.5 hover:text-foreground disabled:opacity-60"
            >
              <LogOut className="size-3.5" />
              Log out
            </button>
          </div>
        )}
        {isError ? (
          <div className="flex items-start gap-1.5 text-destructive">
            <WifiOff className="mt-px size-3.5 shrink-0" />
            <span>API offline. Start it with <code className="font-mono">python crm\app.py</code></span>
          </div>
        ) : c ? (
          <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
            <dt>To research</dt><dd className="text-right">{c.to_research.toLocaleString()}</dd>
            <dt>Drafted</dt><dd className="text-right">{c.drafted}</dd>
            <dt>Contacted</dt><dd className="text-right">{c.contacted}</dd>
            <dt>Won</dt><dd className="text-right">{c.won}</dd>
          </dl>
        ) : null}
        {mounted && (
          <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="inline-flex items-center gap-1.5 hover:text-foreground">
            {resolvedTheme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: () => post("/api/auth/logout"),
    onSuccess: async () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });
  return (
    <nav className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b bg-sidebar px-2 py-1.5 md:hidden">
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("shrink-0 rounded px-2.5 py-1 text-sm", active ? "bg-sidebar-accent font-medium" : "text-muted-foreground")}>
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="shrink-0 rounded px-2.5 py-1 text-sm text-muted-foreground"
      >
        Log out
      </button>
    </nav>
  );
}
