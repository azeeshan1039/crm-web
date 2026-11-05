"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { api, qs } from "@/lib/api";
import { PIPELINE, STAGE_LABELS, TERMINAL } from "@/lib/crm";
import type { Lead, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page";
import { AiBadge, Pill, ScoreBadge, StageDot, isPartialScore } from "@/components/chips";
import { useOpenLead } from "@/components/lead-sheet";
import { useStageActions } from "@/components/stage-actions";
import { useMeta } from "@/components/app-sidebar";
import { AutopilotButton } from "@/components/autopilot-launcher";
import { Button } from "@/components/ui/button";

export default function PipelinePage() {
  const { requestStage } = useStageActions();
  const { data: meta } = useMeta();
  const [dragging, setDragging] = React.useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onStart = (e: DragStartEvent) => setDragging(e.active.data.current?.lead as Lead);
  const onEnd = async (e: DragEndEvent) => {
    const lead = e.active.data.current?.lead as Lead | undefined;
    const target = e.over?.id as Stage | undefined;
    setDragging(null);
    if (lead && target && target !== lead.stage) await requestStage(lead, target);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col md:h-svh">
      <PageHeader title="Pipeline"
        description="Drag a card to move it. Finalize checks the message for links, Contacted asks you to confirm the send, and Do not contact needs a reason.">
        <AutopilotButton variant="outline" label="Research more" />
      </PageHeader>
      <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 py-5 md:px-8 thin-scroll">
          {PIPELINE.map((s) => <Column key={s} stage={s} count={meta?.counts[s]} />)}
          <div className="flex w-56 shrink-0 flex-col gap-3">
            {TERMINAL.map((s) => <DropTray key={s} stage={s} count={meta?.counts[s]} />)}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <Card lead={dragging} overlay />}</DragOverlay>
      </DndContext>
    </main>
  );
}

function Column({ stage, count }: { stage: Stage; count?: number }) {
  const [limit, setLimit] = React.useState(40);
  const { data } = useQuery({
    queryKey: ["leads", { stage, limit, order: "reviews" }],
    queryFn: () => api<{ leads: Lead[]; total: number }>(`/api/leads${qs({ stage, limit, order: stage === "to_research" ? "reviews" : "updated" })}`),
  });
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef}
      className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 transition-colors", isOver && "bg-carbon-soft ring-2 ring-carbon/40")}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <StageDot stage={stage} />
        <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{(count ?? data?.total ?? 0).toLocaleString()}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 thin-scroll">
        {data?.leads.map((l) => <DraggableCard key={l.id} lead={l} />)}
        {data && data.total > data.leads.length && (
          <Button variant="ghost" size="sm" onClick={() => setLimit(limit + 40)}>
            Show more ({(data.total - data.leads.length).toLocaleString()} left)
          </Button>
        )}
        {data && !data.leads.length && <div className="px-2 py-6 text-center text-xs text-muted-foreground">Drop leads here</div>}
      </div>
    </section>
  );
}

function DropTray({ stage, count }: { stage: Stage; count?: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef}
      className={cn("rounded-lg border border-dashed px-3 py-4 text-sm transition-colors",
        isOver ? (stage === "do_not_contact" ? "border-destructive bg-destructive/10" : "border-carbon bg-carbon-soft") : "bg-card")}>
      <div className="flex items-center gap-2 font-medium"><StageDot stage={stage} />{STAGE_LABELS[stage]}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {(count ?? 0).toLocaleString()} leads. Drop a card here to {stage === "archived" ? "archive it" : "suppress it"}.
      </div>
      <Link href={`/leads?stage=${stage}`} className="mt-2 inline-block text-xs text-carbon hover:underline">View all</Link>
    </div>
  );
}

function DraggableCard({ lead }: { lead: Lead }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-30")}>
      <Card lead={lead} />
    </div>
  );
}

function Card({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const open = useOpenLead();
  const overdue = lead.follow_up_date && lead.follow_up_date <= new Date().toISOString().slice(0, 10);
  return (
    <div role="button" tabIndex={0} onClick={() => open(lead.id)} onKeyDown={(e) => e.key === "Enter" && open(lead.id)}
      className={cn("cursor-grab rounded-md border bg-card px-3 py-2.5 text-left shadow-[0_1px_0_rgba(27,30,43,0.04)] hover:border-carbon/40 active:cursor-grabbing",
        overlay && "rotate-1 shadow-lg")}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{lead.company_name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{lead.review_count}</span>
      </div>
      {(lead.subject && ["drafted", "finalized"].includes(lead.stage)) ? (
        <div className="mt-1 line-clamp-1 font-serif text-[13px] italic text-muted-foreground">{lead.subject}</div>
      ) : lead.geography ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{lead.geography}</div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {lead.assignee_name ? <Pill>{lead.assignee_name}</Pill> : null}
        <ScoreBadge total={lead.score_total} partial={isPartialScore(lead)} />
        <AiBadge status={lead.ai_status} flags={lead.ai_flags} />
        {lead.contact_is_form ? <Pill>form</Pill> : null}
        {lead.follow_up_date && ["contacted", "replied", "call", "proposal"].includes(lead.stage) && (
          <Pill tone={overdue ? "attention" : "muted"}>due {lead.follow_up_date.slice(5)}</Pill>
        )}
      </div>
    </div>
  );
}
