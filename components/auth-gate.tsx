"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthUser = {
  id: number;
  name: string;
  email: string;
};

type AuthState = {
  authenticated: boolean;
  user: AuthUser | null;
  has_users: boolean;
};

type AuthPayload = {
  user: AuthUser;
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<AuthState>("/api/auth/me"),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Checking login...
      </div>
    );
  }

  if (isError) {
    return (
      <AuthShell>
        <p className="text-sm text-destructive">
          The CRM API is not responding. Start the backend and refresh this page.
        </p>
      </AuthShell>
    );
  }

  if (!data?.authenticated) {
    return <AuthForm hasUsers={Boolean(data?.has_users)} />;
  }

  return <>{children}</>;
}

export function useAuthUser() {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<AuthState>("/api/auth/me"),
    staleTime: 60_000,
  });
  return data?.user || null;
}

function AuthForm({ hasUsers }: { hasUsers: boolean }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<"login" | "register">(hasUsers ? "login" : "register");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const json = mode === "login" ? { email, password } : { name, email, password };
      return post<AuthPayload>(path, json);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      toast.success(mode === "login" ? "Signed in" : "Account created");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Authentication failed");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use your CRM account to continue."
              : "Set up a local CRM account with your name, email, and password."}
          </p>
        </div>

        {mode === "register" && (
          <div className="space-y-2">
            <Label htmlFor="auth-name">Name</Label>
            <Input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {mode === "login" ? "Log in" : "Create account"}
        </Button>

        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Create one" : "Already have an account? Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-sm font-semibold tracking-tight">Work Pipeline</div>
          <div className="text-xs text-muted-foreground">Agency outreach CRM</div>
        </div>
        {children}
      </section>
    </main>
  );
}
