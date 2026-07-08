"use client";

import { useState } from "react";
import { Bell, LogOut, PanelLeft, Search, User, Camera, BadgeCheck, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { getRoleLabel } from "@/lib/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    <div className="flex min-h-[64px] w-full flex-col gap-4 border-b border-border bg-background px-4 py-3 xl:flex-row xl:items-center xl:justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex items-center gap-2">
          <span className="block truncate text-sm font-medium tracking-wide text-foreground">Painel de Controle</span>
          <span className="hidden text-muted-foreground md:inline">/</span>
          <span className="hidden text-[10px] font-bold tracking-widest uppercase text-primary md:inline">{getRoleLabel(currentRole)}</span>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
        {/* Search */}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto lg:w-64 xl:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-9 pl-9 rounded-full border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
            placeholder="Buscar contatos, leads..."
          />
        </div>
        
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={onToggleRightRail}
          aria-pressed={rightRailOpen}
          aria-label={rightRailOpen ? "Minimizar notificacoes" : "Mostrar notificacoes"}
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          ) : null}
        </Button>

        {/* Profile Avatar Dialog */}
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogTrigger asChild>
            <button className="group flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 transition-colors hover:bg-accent hover:text-accent-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-xs font-medium leading-none text-foreground">{currentUserName}</span>
                <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mt-0.5">{getRoleLabel(currentRole)}</span>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[400px] rounded-[16px] border border-border bg-card p-0 overflow-hidden shadow-2xl">
            <div className="relative h-20 bg-primary/5">
              <div className="absolute -bottom-8 left-6">
                <div className="group relative h-16 w-16 cursor-pointer overflow-hidden rounded-full border-4 border-card bg-background">
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 pt-12 pb-6">
              <DialogHeader className="mb-5">
                <DialogTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                  Preferências de Conta
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Atualize sua foto, nome de exibição e informações de contato.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nome de Exibição</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="pl-9 h-10 bg-background border-border text-sm text-foreground focus-visible:ring-primary/50"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value)}
                      className="pl-9 h-10 bg-background border-border text-sm text-foreground focus-visible:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cargo Atribuído</label>
                  <div className="flex h-10 items-center rounded-md border border-border bg-background px-3">
                    <span className="text-xs text-muted-foreground">{getRoleLabel(currentRole)} (Definido pelo Admin)</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={onLogout} className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9 px-3">
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sair
                </Button>
                
                <Button 
                  onClick={handleSaveProfile}
                  className="rounded-full bg-primary px-5 h-9 text-xs font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {saved ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Salvo
                    </div>
                  ) : (
                    <div>Salvar</div>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
