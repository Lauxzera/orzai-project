"use client";

import type { LucideIcon } from "lucide-react";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type View } from "@/lib/crm";
import { cn } from "@/lib/utils";

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
        "fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[calc(100vw-1rem)] flex-col transition-transform duration-200 lg:static lg:z-auto lg:w-[240px] xl:w-[260px] border-r border-border bg-card",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
      )}
    >
      <div className="flex h-full w-full flex-col overflow-hidden p-3">
        <div className="flex items-center justify-between mb-4 px-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Base CRM</p>
              <p className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wider">CRM Comercial</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 crm-scrollbar">
          {sections.map((section) => (
            <section key={section.title}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                {section.title}
              </p>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activeView === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id as View)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                      <span className="truncate">{item.label}</span>
                      
                      {item.id === "messages" && messagesUnreadCount > 0 && (
                        <span className={cn(
                          "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
        
        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5 border border-border/50">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-xs text-muted-foreground">Sistema Operacional</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

