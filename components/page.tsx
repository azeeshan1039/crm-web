import { cn } from "@/lib/utils";

export function PageHeader({ title, description, children, className }: {
  title: string; description?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end gap-4 border-b px-6 pb-4 pt-6 md:px-8", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, aside, children, className }: {
  title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground", className)}>{children}</div>;
}
