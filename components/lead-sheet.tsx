"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { LeadDetail } from "@/components/lead-detail";

const Ctx = React.createContext<(id: number) => void>(() => {});
export const useOpenLead = () => React.useContext(Ctx);

export function LeadSheetProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = React.useState<number | null>(null);
  return (
    <Ctx.Provider value={setId}>
      {children}
      <Sheet open={id != null} onOpenChange={(o) => !o && setId(null)}>
        <SheetContent side="right" className="w-[96vw] gap-0 p-0 sm:max-w-[1240px]">
          <SheetTitle className="sr-only">Lead</SheetTitle>
          <SheetDescription className="sr-only">Lead research, draft and pipeline</SheetDescription>
          {id != null && <LeadDetail id={id} onClose={() => setId(null)} />}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}
