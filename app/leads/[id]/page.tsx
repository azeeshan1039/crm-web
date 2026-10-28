"use client";

import { use } from "react";
import { LeadDetail } from "@/components/lead-detail";

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="flex min-h-0 flex-1 flex-col md:h-svh">
      <LeadDetail id={Number(id)} />
    </main>
  );
}
