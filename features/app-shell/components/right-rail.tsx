"use client";

import { Bell, CheckCheck, Clock3, X, Zap, AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/crm";
import { motion, AnimatePresence } from "framer-motion";

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  kind: "overdue-followup" | "pending-task" | "new-lead";
  leadId?: string | null;
  taskOwner?: string | null;
  createdAt: string;
  read: boolean;
};

type ActivityItem = {
  id: string;
  title: string;
  meta: string;
};

type ContactItem = Pick<Lead, "id" | "nome">;

type Props = {
  notifications: NotificationItem[];
  activities: ActivityItem[];
  contacts: ContactItem[];
  onOpenLead: (leadId: string) => void;
  onMarkRead: (notificationId: string) => void;
  onClose: () => void;
};

const getNotificationStyle = (kind: NotificationItem["kind"]) => {
  switch (kind) {
    case "overdue-followup":
      return {
        icon: AlertTriangle,
        colorClass: "text-red-500",
        bgClass: "bg-red-500/10",
        borderClass: "border-red-500/20",
        glowClass: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      };
    case "pending-task":
      return {
        icon: Clock3,
        colorClass: "text-amber-500",
        bgClass: "bg-amber-500/10",
        borderClass: "border-amber-500/20",
        glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      };
    case "new-lead":
      return {
        icon: UserPlus,
        colorClass: "text-emerald-500",
        bgClass: "bg-emerald-500/10",
        borderClass: "border-emerald-500/20",
        glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
      };
    default:
      return {
        icon: Bell,
        colorClass: "text-primary",
        bgClass: "bg-primary/10",
        borderClass: "border-primary/20",
        glowClass: "shadow-[0_0_20px_rgba(219,13,113,0.2)]",
      };
  }
};

export function RightRail({ notifications, activities, contacts, onOpenLead, onMarkRead, onClose }: Props) {
  return (
    <aside className="fixed right-4 top-4 bottom-4 z-50 hidden w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.015] shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-[40px] xl:block">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary shadow-[0_0_15px_-5px_rgba(219,13,113,0.3)]">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-medium tracking-wide text-white">Central de Alertas</h2>
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">Tempo Real</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/40 hover:bg-white/5 hover:text-white"
            onClick={onClose}
            aria-label="Fechar painel comercial"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Body */}
        <div className="crm-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Notificações</h2>
              {notifications.some((item) => !item.read) ? (
                <span className="rounded-full bg-primary shadow-[0_0_15px_rgba(219,13,113,0.4)] px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase text-white">
                  {notifications.filter((item) => !item.read).length} Novas
                </span>
              ) : null}
            </div>
            
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {notifications.length ? (
                  notifications.map((notification) => {
                    const style = getNotificationStyle(notification.kind);
                    const isRead = notification.read;
                    const Icon = style.icon;

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className={`group relative overflow-hidden rounded-[16px] border transition-all duration-300 ${
                          isRead 
                            ? "border-white/5 bg-white/[0.01] opacity-50 hover:opacity-100" 
                            : `${style.borderClass} ${style.bgClass} ${style.glowClass}`
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                              isRead ? "bg-white/5 text-white/30" : `bg-black/20 ${style.colorClass}`
                            }`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className={`text-[13px] font-medium tracking-wide ${isRead ? "text-white/70" : "text-white"}`}>
                                    {notification.title}
                                  </p>
                                  <p className="mt-1 text-[12px] font-light text-white/50 leading-relaxed">
                                    {notification.description}
                                  </p>
                                </div>
                                {!isRead ? (
                                  <span className={`mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${style.colorClass} bg-current`} />
                                ) : null}
                              </div>
                              
                              <div className="mt-4 flex flex-wrap gap-2">
                                {notification.leadId ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`h-7 rounded-full border-white/10 bg-white/[0.02] px-3 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10 hover:text-white`}
                                    onClick={() => onOpenLead(notification.leadId!)}
                                  >
                                    Visualizar Lead
                                  </Button>
                                ) : null}
                                {!isRead ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 rounded-full px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/5 hover:text-white"
                                    onClick={() => onMarkRead(notification.id)}
                                  >
                                    <CheckCheck className="mr-1.5 h-3 w-3" />
                                    Ok
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/[0.02] border border-white/5 text-white/20">
                      <CheckCheck className="h-5 w-5" />
                    </div>
                    <p className="text-[13px] font-light text-white/40">Nenhuma notificação nova.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}
