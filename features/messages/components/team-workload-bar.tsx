"use client";

import * as React from "react";
import { Clock, Users, ChevronDown, Check } from "lucide-react";
import { UNASSIGNED_OWNER } from "@/lib/crm";
import type { Conversation } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { getAvatarPalette, getInitials } from "@/features/messages/lib/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type WorkloadChip = {
  key: string;
  label: string;
  total: number;
  unread: number;
  isQueue: boolean;
  isMine: boolean;
};

type Props = {
  convs: Conversation[];
  ownerOptions: readonly string[];
  ownerFilter: string;
  canInspectAll: boolean;
  currentUserName?: string;
  slaExpiredCounts?: Record<string, number>;
  onOwnerFilterChange: (value: string) => void;
};

export function TeamWorkloadBar({ convs, ownerOptions, ownerFilter, canInspectAll, currentUserName, slaExpiredCounts, onOwnerFilterChange }: Props) {
  const chips = React.useMemo<WorkloadChip[]>(() => {
    const counts = new Map<string, { total: number; unread: number }>();

    for (const conv of convs) {
      const owner = conv.ownerName || UNASSIGNED_OWNER;
      const entry = counts.get(owner) ?? { total: 0, unread: 0 };
      entry.total += 1;
      if (conv.unreadCount > 0) entry.unread += 1;
      counts.set(owner, entry);
    }

    const queueEntry = counts.get(UNASSIGNED_OWNER) ?? { total: 0, unread: 0 };
    const queueChip: WorkloadChip = {
      key: UNASSIGNED_OWNER,
      label: "Fila sem responsável",
      total: queueEntry.total,
      unread: queueEntry.unread,
      isQueue: true,
      isMine: false,
    };

    if (canInspectAll) {
      const agentChips: WorkloadChip[] = ownerOptions
        .filter((owner) => owner !== UNASSIGNED_OWNER)
        .map((owner) => {
          const entry = counts.get(owner) ?? { total: 0, unread: 0 };
          return {
            key: owner,
            label: owner,
            total: entry.total,
            unread: entry.unread,
            isQueue: false,
            isMine: owner === currentUserName,
          };
        });

      return [queueChip, ...agentChips];
    }

    if (currentUserName) {
      const mineEntry = counts.get(currentUserName) ?? { total: 0, unread: 0 };
      const mineChip: WorkloadChip = {
        key: currentUserName,
        label: "Minhas conversas",
        total: mineEntry.total,
        unread: mineEntry.unread,
        isQueue: false,
        isMine: true,
      };
      return [mineChip, queueChip];
    }

    return [queueChip];
  }, [convs, ownerOptions, canInspectAll, currentUserName]);

  const activeChip = chips.find(c => c.key === ownerFilter);

  return (
    <div className="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-12 justify-between rounded-[20px] border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-white shadow-inner"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 border border-white/10">
                <Users className="h-3.5 w-3.5 text-white/50" />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Visão por Atendente</span>
                <span className="text-[13px] font-medium tracking-wide">
                  {activeChip ? activeChip.label : "Todos os Atendimentos"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-light text-white/70">
                {activeChip ? activeChip.total : convs.length}
              </span>
              <ChevronDown className="h-4 w-4 text-white/30" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          className="w-[calc(100vw-2rem)] sm:w-[320px] rounded-[24px] border-white/10 bg-[#0c0c0c]/95 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-[24px]"
        >
          <DropdownMenuItem 
            onClick={() => onOwnerFilterChange("all")}
            className="flex items-center justify-between rounded-[16px] px-3 py-2.5 cursor-pointer focus:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                <Users className="h-4 w-4 text-white/50" />
              </span>
              <span className="text-[13px] font-medium text-white">Todos os Atendimentos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-light text-white/50">{convs.length}</span>
              {ownerFilter === "all" ? <Check className="h-4 w-4 text-primary" /> : <div className="w-4" />}
            </div>
          </DropdownMenuItem>

          <div className="my-2 h-[1px] w-full bg-white/5" />

          <div className="max-h-[300px] overflow-y-auto crm-scrollbar space-y-1 pr-1">
            {chips.map(chip => {
              const isActive = ownerFilter === chip.key;
              const palette = chip.isQueue ? null : getAvatarPalette(chip.label);
              
              return (
                <DropdownMenuItem 
                  key={chip.key}
                  onClick={() => onOwnerFilterChange(chip.key)}
                  className={cn(
                    "flex items-center justify-between rounded-[16px] px-3 py-2.5 cursor-pointer transition-colors",
                    isActive ? "bg-primary/10 focus:bg-primary/20" : "focus:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {palette ? (
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", palette.bg, palette.text)}>
                        {getInitials(chip.label)}
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        <Users className="h-4 w-4" />
                      </span>
                    )}
                    <div className="flex flex-col">
                      <span className={cn("text-[13px] font-medium truncate max-w-[150px]", isActive ? "text-primary" : "text-white")}>
                        {chip.label}
                      </span>
                      {!chip.isQueue && (slaExpiredCounts?.[chip.key] ?? 0) > 0 ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-rose-400 mt-0.5">
                          <Clock className="h-2.5 w-2.5" /> SLA Atrasado
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {chip.unread > 0 ? <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(219,13,113,0.8)]" /> : null}
                      <span className={cn("text-[12px] font-light", isActive ? "text-primary/70" : "text-white/50")}>{chip.total}</span>
                    </div>
                    {isActive ? <Check className="h-4 w-4 text-primary" /> : <div className="w-4" />}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
