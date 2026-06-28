"use client";

import type { LucideIcon } from "lucide-react";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type View } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  currentRole: "ADMIN" | "MANAGER" | "SALES" | "VIEWER";
  items: NavigationItem[];
  activeView: View;
  messagesUnreadCount?: number;
  sidebarOpen: boolean;
  onClose: () => void;
  onSelectView: (view: View) => void;
};

export function AppSidebar({ items, activeView, messagesUnreadCount = 0, sidebarOpen, onClose, onSelectView }: Props) {
  const sections = [
    {
      title: "Atendimento",
      items: items.filter((item) => ["messages", "broadcasts", "leads", "tasks"].includes(item.id)),
    },
    {
      title: "Carteira",
      items: items.filter((item) => ["lead-lists"].includes(item.id)),
    },
    {
      title: "Gestão",
      items: items.filter((item) => ["dashboard", "analytics", "lead-settings", "admin-users"].includes(item.id)),
    },
  ].filter((section) => section.items.length);

  function handleSelect(view: View) {
    onSelectView(view);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose();
    }
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[calc(100vw-1rem)] flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:z-auto lg:w-[280px] lg:self-stretch xl:w-[320px] lg:p-4",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
      )}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[32px] p-6 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary shadow-[0_0_20px_-5px_rgba(219,13,113,0.3)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-white tracking-wide">Base CRM</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">CRM Comercial</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-white/50 hover:text-white"
            onClick={onClose}
            aria-label="Fechar menu lateral"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          {sections.map((section) => (
            <section key={section.title} className="mt-8 first:mt-0">
              <p className="mb-4 px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-white/30">
                {section.title}
              </p>
              <nav className="grid gap-1.5 relative">
                {section.items.map((item) => {
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id as View)}
                      className={cn(
                        "group relative flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] transition-colors duration-300 z-10",
                        isActive ? "text-primary font-medium" : "text-white/60 font-light hover:text-white"
                      )}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-0 z-[-1] rounded-xl bg-white/[0.04] border border-white/5 shadow-[0_0_20px_-5px_rgba(255,255,255,0.05)] transition-all duration-300"
                        />
                      )}
                      
                      <item.icon className={cn("h-[16px] w-[16px] transition-transform duration-300", isActive ? "" : "group-hover:scale-110")} />
                      <span className="truncate tracking-wide">{item.label}</span>
                      
                      {item.id === "messages" && messagesUnreadCount > 0 ? (
                        <span className={cn(
                          "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-all",
                          isActive ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(219,13,113,0.5)]" : "bg-white/10 text-white"
                        )}>
                          {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
        
        {/* Footer Area inside sidebar */}
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-[11px] font-light tracking-wider text-white/50">Sistema Operacional</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
