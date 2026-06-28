"use client";

import { useState } from "react";
import { Bell, LogOut, PanelLeft, Search, User, Camera, Mail, BadgeCheck, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRoleLabel } from "@/lib/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  currentRole: "ADMIN" | "MANAGER" | "SALES" | "VIEWER";
  currentUserName: string;
  search: string;
  sidebarOpen: boolean;
  rightRailOpen: boolean;
  unreadNotifications: number;
  onSearchChange: (value: string) => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onToggleRightRail: () => void;
};

export function AppTopbar({
  currentRole,
  currentUserName,
  search,
  sidebarOpen,
  rightRailOpen,
  unreadNotifications,
  onSearchChange,
  onToggleSidebar,
  onLogout,
  onToggleRightRail,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [tempName, setTempName] = useState(currentUserName);
  const [tempPhone, setTempPhone] = useState("(11) 99999-9999");
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setProfileOpen(false);
    }, 1500);
  };

  return (
    <div className="flex min-h-[72px] w-full flex-col gap-4 border-b border-white/5 bg-white/[0.015] backdrop-blur-[24px] px-6 py-4 shadow-[0_0_30px_-10px_rgba(0,0,0,0.8)] xl:flex-row xl:items-center xl:justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-white/50 hover:bg-white/5 hover:text-white"
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex items-center gap-3">
          <span className="block truncate text-[16px] font-light tracking-wide text-white">Painel de Controle</span>
          <span className="hidden text-white/20 md:inline">/</span>
          <span className="hidden text-[11px] font-bold tracking-[0.15em] uppercase text-primary md:inline">{getRoleLabel(currentRole)}</span>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 xl:justify-end">
        {/* Search */}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto lg:w-72 xl:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 pl-11 rounded-full border-white/5 bg-white/[0.02] text-[13px] font-light text-white placeholder:text-white/30 focus-visible:ring-primary/30 focus-visible:bg-white/[0.04]"
            placeholder="Buscar contatos, leads..."
          />
        </div>
        
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full bg-white/[0.02] border border-white/5 text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
          onClick={onToggleRightRail}
          aria-pressed={rightRailOpen}
          aria-label={rightRailOpen ? "Minimizar notificacoes" : "Mostrar notificacoes"}
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 ? (
            <span className="absolute right-0 top-0 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary shadow-[0_0_15px_rgba(219,13,113,0.5)] px-1 text-[9px] font-bold text-white ring-2 ring-[#080808]">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          ) : null}
        </Button>

        {/* Profile Avatar Dialog */}
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogTrigger asChild>
            <button className="group flex items-center gap-3 rounded-full border border-white/5 bg-white/[0.02] p-1.5 pr-4 transition-all hover:bg-white/[0.04] hover:border-white/10">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary shadow-[0_0_15px_-5px_rgba(219,13,113,0.3)]">
                <User className="h-3 w-3" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-[12px] font-medium text-white/90">{currentUserName}</span>
                <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-primary/70">{getRoleLabel(currentRole)}</span>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[440px] rounded-[24px] border border-white/10 bg-[#080808]/95 backdrop-blur-3xl shadow-[0_0_60px_-15px_rgba(219,13,113,0.15)] p-0 overflow-hidden">
            <div className="relative h-24 bg-gradient-to-r from-primary/20 to-transparent">
              <div className="absolute -bottom-10 left-6">
                <div className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-full border-4 border-[#080808] bg-secondary shadow-xl">
                  <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 pt-14 pb-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl font-light text-white flex items-center gap-2">
                  Preferências de Conta
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </DialogTitle>
                <DialogDescription className="text-xs font-light text-white/40">
                  Atualize sua foto, nome de exibição e informações de contato.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Nome de Exibição</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <Input 
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="pl-10 h-11 bg-white/[0.02] border-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <Input 
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value)}
                      className="pl-10 h-11 bg-white/[0.02] border-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Cargo Atribuído</label>
                  <div className="flex h-11 items-center rounded-md border border-white/5 bg-white/[0.01] px-4">
                    <span className="text-[12px] text-white/50">{getRoleLabel(currentRole)} (Definido pelo Admin)</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={onLogout} className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9">
                  <LogOut className="h-3 w-3 mr-2" />
                  Encerrar Sessão
                </Button>
                
                <Button 
                  onClick={handleSaveProfile}
                  className="rounded-full bg-primary px-6 h-10 text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_-5px_rgba(219,13,113,0.4)] hover:shadow-[0_0_30px_-5px_rgba(219,13,113,0.6)]"
                >
                  <AnimatePresence mode="wait">
                    {saved ? (
                      <motion.div key="saved" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Salvo
                      </motion.div>
                    ) : (
                      <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Salvar Alterações
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
