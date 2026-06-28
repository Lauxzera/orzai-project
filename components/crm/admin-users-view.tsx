"use client";

import * as React from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw, ShieldCheck, Trash2, UserCog, UserPlus, Zap, ArrowRight, Key, Users, Activity, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { closingStatuses, isOverdue, userRoles, type CrmState, type CrmUser, type UserRole } from "@/lib/crm";
import type { FollowUpReport } from "@/features/follow-up/lib/follow-up-types";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  currentUser: CrmUser;
  crmState: CrmState;
  onCurrentUserUpdated: (user: CrmUser) => void;
  onOwnerOptionsUpdated: (owners: string[]) => void;
};

type AdminUser = CrmUser & { createdAt?: string; updatedAt?: string; };
type AuditChangeType = "create" | "delete" | "name" | "username" | "role" | "status" | "password";

type AdminAuditEntry = {
  id: string; actorId: string | null; actorName: string;
  action: "USER_CREATED" | "USER_UPDATED" | "USER_DELETED";
  targetUserId: string; targetUserName: string; details: string;
  changeTypes?: AuditChangeType[]; createdAt: string;
};

type RoundRobinAgentStatus = { id: string; name: string; isNext: boolean; activeLeadCount: number; };
type RoundRobinStatus = { enabled: boolean; agents: RoundRobinAgentStatus[]; unassignedLeadCount: number; };

type PortfolioSegment = {
  user: AdminUser; assignedLeads: CrmState["leads"]; activeLeads: CrmState["leads"];
  overdueLeads: CrmState["leads"]; negotiationLeads: CrmState["leads"]; pendingTasks: CrmState["tasks"];
};

type CreateDraft = { name: string; username: string; password: string; role: UserRole; active: boolean; isAgent: boolean; };

const blankDraft: CreateDraft = { name: "", username: "", password: "", role: "SALES", active: true, isAgent: true };

const ADMIN_CATEGORIES = [
  { id: "contas", label: "Contas & Acessos", icon: Users },
  { id: "desempenho", label: "Desempenho", icon: Activity },
  { id: "roleta", label: "Distribuição", icon: Zap },
  { id: "auditoria", label: "Auditoria", icon: History },
] as const;

export function AdminUsersView({ currentUser, crmState, onCurrentUserUpdated, onOwnerOptionsUpdated }: Props) {
  const [activeCategory, setActiveCategory] = React.useState<"contas" | "desempenho" | "roleta" | "auditoria">("contas");
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [audit, setAudit] = React.useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<CreateDraft>(blankDraft);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingDraft, setEditingDraft] = React.useState<CreateDraft>(blankDraft);
  const [auditSearch, setAuditSearch] = React.useState("");
  const [auditActionFilter, setAuditActionFilter] = React.useState<"all" | AdminAuditEntry["action"]>("all");
  const [auditChangeFilter, setAuditChangeFilter] = React.useState<"all" | AuditChangeType>("all");
  const [followUpLoading, setFollowUpLoading] = React.useState(false);
  const [followUpReport, setFollowUpReport] = React.useState<FollowUpReport | null>(null);
  const [followUpError, setFollowUpError] = React.useState("");
  const [portfolioUserId, setPortfolioUserId] = React.useState<string | "all">("all");
  const [roundRobin, setRoundRobin] = React.useState<RoundRobinStatus | null>(null);
  const [roundRobinLoading, setRoundRobinLoading] = React.useState(false);
  const [roundRobinError, setRoundRobinError] = React.useState("");

  const activeUsersCount = users.filter((u) => u.active).length;
  const adminsCount = users.filter((u) => u.role === "ADMIN").length;

  async function loadUsers() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/users");
      const data = (await response.json()) as { users?: AdminUser[]; audit?: AdminAuditEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os usuários.");
      const nextUsers = data.users ?? [];
      setUsers(nextUsers); setAudit(data.audit ?? []);
      onOwnerOptionsUpdated(buildOwnerOptions(nextUsers));
    } catch (err) { setError(err instanceof Error ? err.message : "Erro crítico."); }
    finally { setLoading(false); }
  }

  async function loadRoundRobinStatus() {
    setRoundRobinLoading(true); setRoundRobinError("");
    try {
      const response = await fetch("/api/admin/round-robin");
      const data = (await response.json()) as RoundRobinStatus & { error?: string };
      if (!response.ok) throw new Error(data.error || "Erro ao carregar a roleta.");
      setRoundRobin(data);
    } catch (err) { setRoundRobinError(err instanceof Error ? err.message : "Erro crítico."); }
    finally { setRoundRobinLoading(false); }
  }

  React.useEffect(() => { void loadUsers(); void loadRoundRobinStatus(); }, []);

  const filteredAudit = React.useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return audit.filter((entry) => {
      const matchesAction = auditActionFilter === "all" || entry.action === auditActionFilter;
      const matchesChange = auditChangeFilter === "all" || entry.changeTypes?.includes(auditChangeFilter);
      const matchesSearch = !term || [entry.actorName, entry.targetUserName, entry.details].join(" ").toLowerCase().includes(term);
      return matchesAction && matchesChange && matchesSearch;
    });
  }, [audit, auditActionFilter, auditChangeFilter, auditSearch]);

  const portfolioUsers = React.useMemo(() => users.filter((u) => u.role === "SALES" || u.role === "VIEWER"), [users]);

  const userSegments = React.useMemo<PortfolioSegment[]>(() => {
    if (!crmState) return [];
    return portfolioUsers.map((user) => {
      const assignedLeads = crmState.leads.filter((l) => l.responsavel === user.name);
      const activeLeads = assignedLeads.filter((l) => !closingStatuses.includes(l.status_funil));
      const overdueLeads = activeLeads.filter((l) => isOverdue(l.proximo_contato));
      const negotiationLeads = activeLeads.filter((l) => ["Negociação / Matrícula", "Aguardando Pagamento"].includes(l.status_funil));
      const pendingTasks = crmState.tasks.filter((t) => t.owner === user.name && !t.done);
      return { user, assignedLeads, activeLeads, overdueLeads, negotiationLeads, pendingTasks };
    });
  }, [crmState, portfolioUsers]);

  const visibleSegments = React.useMemo(() => {
    if (portfolioUserId === "all") return userSegments;
    return userSegments.filter((s) => s.user.id === portfolioUserId);
  }, [portfolioUserId, userSegments]);

  function startEditing(user: AdminUser) {
    setEditingId(user.id);
    setEditingDraft({ name: user.name, username: user.username, password: "", role: user.role, active: user.active, isAgent: user.isAgent ?? false });
    setError(""); setSuccess("");
  }
  function cancelEditing() { setEditingId(null); setEditingDraft(blankDraft); }

  async function createUser() {
    setCreateLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário.");
      setDraft(blankDraft); setSuccess("Usuário criado com sucesso.");
      await loadUsers();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro."); }
    finally { setCreateLoading(false); }
  }

  async function saveEdit(userId: string) {
    setSavingId(userId); setError(""); setSuccess("");
    try {
      const payload = { userId, ...editingDraft, password: editingDraft.password || undefined };
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar.");
      if (data.user?.id === currentUser.id) onCurrentUserUpdated(data.user);
      cancelEditing(); setSuccess("Usuário atualizado com sucesso.");
      await loadUsers();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro."); }
    finally { setSavingId(null); }
  }

  async function runFollowUp() {
    setFollowUpLoading(true); setFollowUpError(""); setFollowUpReport(null);
    try {
      const res = await fetch("/api/jobs/followup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no follow-up.");
      setFollowUpReport(data);
    } catch (err) { setFollowUpError(err instanceof Error ? err.message : "Erro."); }
    finally { setFollowUpLoading(false); }
  }

  async function deleteUser(userId: string, userName: string) {
    if (!window.confirm(`Excluir "${userName}"? Leads e tarefas serão movidos para Equipe Comercial.`)) return;
    setSavingId(userId); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir.");
      if (editingId === userId) cancelEditing();
      setSuccess("Usuário excluído com sucesso.");
      await loadUsers();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro."); }
    finally { setSavingId(null); }
  }

  // UI VIEWS
  const renderContas = () => (
    <motion.div key="contas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
      <Card className="rounded-[32px] overflow-hidden mb-6">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6 flex flex-row items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserPlus className="h-5 w-5" /></div>
          <div>
            <CardTitle className="text-lg font-light tracking-wide text-white">Criar Novo Acesso</CardTitle>
            <CardDescription className="text-white/40">Cadastre um novo membro para o CRM.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <AdminUserFields draft={draft} onChange={setDraft} />
          <div className="pt-4 flex justify-end">
            <Button onClick={() => void createUser()} disabled={createLoading} className="rounded-full bg-primary px-8 h-12 shadow-[0_0_20px_rgba(219,13,113,0.3)] hover:shadow-[0_0_30px_rgba(219,13,113,0.6)] font-bold tracking-wider uppercase text-[12px]">
              {createLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Autorizar Usuário
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center p-12"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>
        ) : users.map(user => {
          const isEditing = editingId === user.id;
          const busy = savingId === user.id;
          const isSelf = currentUser.id === user.id;
          return (
            <Card key={user.id} className="rounded-[24px] transition-all hover:bg-white/[0.03]">
              <div className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[16px] font-medium text-white">{user.name}</p>
                      <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full border ${user.active ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-white/40 bg-white/5'}`}>{user.active ? "Ativo" : "Bloqueado"}</span>
                      <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full border ${user.role === 'ADMIN' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-primary/30 text-primary bg-primary/10'}`}>{roleLabel(user.role)}</span>
                      {user.isAgent && <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full border border-purple-500/30 text-purple-400 bg-purple-500/10">Atendente</span>}
                      {isSelf && <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full border border-white/20 text-white/80 bg-white/10">Você</span>}
                    </div>
                    <p className="text-[13px] font-light text-white/40">@{user.username}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={cancelEditing} className="rounded-full">Cancelar</Button>
                        <Button size="sm" onClick={() => void saveEdit(user.id)} disabled={busy} className="rounded-full bg-primary text-white">
                          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Salvar"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEditing(user)} className="rounded-full border-white/10 hover:bg-white/5 hover:text-white">Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => void deleteUser(user.id, user.name)} disabled={busy} className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} className="mt-6 pt-6 border-t border-white/5">
                    <AdminUserFields draft={editingDraft} onChange={setEditingDraft} isEditing />
                  </motion.div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );

  const renderDesempenho = () => (
    <motion.div key="desempenho" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
      <Card className="rounded-[32px] overflow-hidden mb-6">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Activity className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-lg font-light tracking-wide text-white">Desempenho da Carteira</CardTitle>
              <CardDescription className="text-white/40">Visão macro de conversão e gargalos.</CardDescription>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <Select value={portfolioUserId} onValueChange={(val) => setPortfolioUserId(val as string | "all")}>
              <SelectTrigger className="rounded-full border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Equipe Inteira</SelectItem>
                {portfolioUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {!crmState ? <div className="text-center text-white/30"><LoaderCircle className="h-6 w-6 animate-spin mx-auto"/></div> : 
           visibleSegments.length === 0 ? <p className="text-center text-white/40">Nenhum dado comercial.</p> : (
            <div className="grid gap-6 xl:grid-cols-2">
              {visibleSegments.map(segment => (
                <div key={segment.user.id} className="rounded-[24px] border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                    <p className="text-[16px] font-medium text-white">{segment.user.name}</p>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary/30 text-primary bg-primary/10">{roleLabel(segment.user.role)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <MetricPill label="Total de Leads" value={segment.assignedLeads.length} />
                    <MetricPill label="Leads Ativos" value={segment.activeLeads.length} />
                    <MetricPill label="Negociação" value={segment.negotiationLeads.length} tone={segment.negotiationLeads.length ? "warning" : "default"} />
                    <MetricPill label="Atrasados" value={segment.overdueLeads.length} tone={segment.overdueLeads.length ? "danger" : "default"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="rounded-[32px] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
          <CardTitle className="text-lg font-light tracking-wide text-white">Auditoria de Follow-up IA</CardTitle>
          <CardDescription className="text-white/40">Execute varreduras forçadas na carteira inteira para encontrar negociações paradas.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Button onClick={() => void runFollowUp()} disabled={followUpLoading} className="rounded-full bg-white/5 hover:bg-primary border border-white/10 hover:border-primary">
             {followUpLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />} Analisar Base Inteira
          </Button>
          {followUpReport && (
            <div className="mt-6 space-y-4">
               <div className="flex gap-4">
                 <span className="text-[13px] text-emerald-400">{followUpReport.actionsApplied} correções aplicadas</span>
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderRoleta = () => (
    <motion.div key="roleta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
       <Card className="rounded-[32px] overflow-hidden mb-6">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Zap className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-lg font-light tracking-wide text-white">Roleta de Distribuição (Round Robin)</CardTitle>
              <CardDescription className="text-white/40">Ordem de rotação dos leads automáticos de WhatsApp.</CardDescription>
            </div>
          </div>
          <Button variant="ghost" className="rounded-full hover:bg-white/5 text-white/50" onClick={() => void loadRoundRobinStatus()}>
            <RefreshCcw className={`h-4 w-4 ${roundRobinLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-8">
           {!roundRobin || !roundRobin.enabled ? (
             <p className="text-white/40 font-light">A roleta automática está inativa pois não há atendentes configurados.</p>
           ) : (
             <div className="space-y-8">
                <div className="flex flex-wrap gap-4">
                  {roundRobin.agents.map((agent) => (
                    <div key={agent.id} className={`relative flex items-center gap-3 px-6 py-4 rounded-[20px] border transition-all duration-300 ${agent.isNext ? 'border-primary/50 bg-primary/10 shadow-[0_0_30px_rgba(219,13,113,0.2)]' : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'}`}>
                      {agent.isNext && <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>}
                      <span className={`text-[15px] font-medium ${agent.isNext ? 'text-white' : 'text-white/70'}`}>{agent.name}</span>
                      <span className="w-px h-4 bg-white/10 mx-1"></span>
                      <span className="text-[12px] font-bold tracking-widest text-white/40">{agent.activeLeadCount} ATIVOS</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 inline-flex items-center gap-4">
                  <span className="text-[13px] font-light text-white/50">Leads Aguardando (Fila Geral):</span>
                  <span className="text-[20px] font-light text-white">{roundRobin.unassignedLeadCount}</span>
                </div>
             </div>
           )}
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderAuditoria = () => (
    <motion.div key="auditoria" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
      <Card className="rounded-[32px] overflow-hidden mb-6">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
          <CardTitle className="text-lg font-light tracking-wide text-white">Log de Segurança</CardTitle>
          <CardDescription className="text-white/40">Rastreabilidade completa de ações administrativas.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex gap-4">
            <Input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Procurar evento..." className="rounded-full bg-white/[0.02] border-white/10" />
          </div>
          <div className="space-y-3">
             {filteredAudit.length ? filteredAudit.map(entry => (
               <div key={entry.id} className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                 <div>
                   <div className="flex items-center gap-3 mb-2">
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${entry.action === "USER_CREATED" ? "border-emerald-500/30 text-emerald-400" : entry.action === "USER_DELETED" ? "border-destructive/30 text-destructive" : "border-amber-500/30 text-amber-400"}`}>
                       {entry.action.replace("USER_", "")}
                     </span>
                     <span className="text-[14px] font-medium text-white">{entry.targetUserName}</span>
                   </div>
                   <p className="text-[12px] font-light text-white/50">{entry.details}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[12px] font-medium text-white/60">{entry.actorName}</p>
                   <p className="text-[11px] font-light text-white/30">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
                 </div>
               </div>
             )) : <p className="text-white/30">Sem registros.</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col lg:flex-row gap-8 py-8 h-full">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-light tracking-wide text-white">Equipe & Acessos</h2>
          <p className="mt-2 text-[13px] font-light text-white/40">
            Administração central de membros, papéis e carteiras.
          </p>
        </div>

        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 crm-scrollbar">
          {ADMIN_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`group relative flex items-center gap-3 rounded-full lg:rounded-2xl px-5 py-3.5 text-left transition-all duration-300 whitespace-nowrap lg:whitespace-normal ${
                  isActive ? "text-primary" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 z-0 rounded-full lg:rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)] transition-all duration-300"
                  />
                )}
                <Icon className={`relative z-10 h-4 w-4 ${isActive ? "drop-shadow-[0_0_8px_rgba(219,13,113,0.5)]" : ""}`} />
                <span className={`relative z-10 text-[13px] font-medium tracking-wide ${isActive ? "text-white" : ""}`}>
                  {cat.label}
                </span>
                <ArrowRight className={`relative z-10 ml-auto h-3 w-3 transition-transform duration-300 ${isActive ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0 lg:block hidden"}`} />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden lg:block rounded-3xl border border-white/5 bg-white/[0.01] p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Visão Geral</span>
          </div>
          <div className="space-y-2 text-[12px] font-light text-white/50">
            <div className="flex justify-between"><span>Usuários:</span> <span className="text-white">{users.length}</span></div>
            <div className="flex justify-between"><span>Ativos:</span> <span className="text-emerald-400">{activeUsersCount}</span></div>
            <div className="flex justify-between"><span>Admins:</span> <span className="text-amber-400">{adminsCount}</span></div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-8">
          <AnimatePresence mode="wait">
            <motion.h3 
              key={activeCategory}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-lg font-light tracking-[0.2em] uppercase text-white/50"
            >
              {ADMIN_CATEGORIES.find(c => c.id === activeCategory)?.label}
            </motion.h3>
          </AnimatePresence>
        </div>

        {error ? <p className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-4 text-[13px] text-destructive shadow-[0_0_30px_rgba(239,68,68,0.2)]">{error}</p> : null}
        {success ? <p className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-[13px] text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]">{success}</p> : null}

        <div className="relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeCategory === "contas" && renderContas()}
            {activeCategory === "desempenho" && renderDesempenho()}
            {activeCategory === "roleta" && renderRoleta()}
            {activeCategory === "auditoria" && renderAuditoria()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function buildOwnerOptions(users: AdminUser[]) {
  const activeOwners = users.filter((u) => u.active && u.role !== "VIEWER").map((u) => u.name).filter((n) => n !== "Equipe Comercial").sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...new Set([...activeOwners, "Equipe Comercial"])];
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" | "warning" }) {
  const toneClass = tone === "danger" ? "border-destructive/20 bg-destructive/10 text-destructive" : tone === "warning" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-white/5 bg-white/[0.02] text-white";
  return (
    <div className={`rounded-2xl px-5 py-4 border ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-[28px] font-light">{value}</p>
    </div>
  );
}

function AdminUserFields({ draft, onChange, isEditing = false }: { draft: CreateDraft; onChange: React.Dispatch<React.SetStateAction<CreateDraft>>; isEditing?: boolean }) {
  function patch<K extends keyof CreateDraft>(key: K, value: CreateDraft[K]) { onChange((c) => ({ ...c, [key]: value })); }
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome Completo"><Input value={draft.name} onChange={(e) => patch("name", e.target.value)} className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6 text-[14px]" /></Field>
        <Field label="Nome de Usuário (Login)"><Input value={draft.username} onChange={(e) => patch("username", e.target.value)} className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6 text-[14px]" /></Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nível de Permissão">
          <Select value={draft.role} onValueChange={(val) => patch("role", val as UserRole)}>
            <SelectTrigger className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6"><SelectValue /></SelectTrigger>
            <SelectContent>{userRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Status de Acesso">
          <Select value={draft.active ? "active" : "blocked"} onValueChange={(val) => patch("active", val === "active")}>
            <SelectTrigger className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">Ativo (Permitido)</SelectItem><SelectItem value="blocked">Bloqueado</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Atendente de Fila (Roleta WhatsApp)">
          <Select value={draft.isAgent ? "yes" : "no"} onValueChange={(val) => patch("isAgent", val === "yes")}>
            <SelectTrigger className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="yes">Sim — Entra no rodízio de leads</SelectItem><SelectItem value="no">Não — Invisível para roleta</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label={isEditing ? "Nova Senha (Opcional)" : "Senha de Acesso"}>
          <Input type="password" value={draft.password} onChange={(e) => patch("password", e.target.value)} placeholder={isEditing ? "Apenas preencha para alterar" : ""} className="h-12 rounded-full border-white/10 bg-white/[0.02] px-6 text-[14px]" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label className="text-[12px] font-medium text-white/50 tracking-wide uppercase px-2">{label}</Label>{children}</div>;
}

function roleLabel(r: UserRole) { return r === "ADMIN" ? "Administrador" : r === "MANAGER" ? "Gestor" : r === "SALES" ? "Comercial" : "Visualizador"; }
function changeLabel(c: AuditChangeType) { return c === "create" ? "Criação" : c === "delete" ? "Exclusão" : c === "name" ? "Nome" : c === "username" ? "Usuário" : c === "role" ? "Permissão" : c === "status" ? "Status" : "Senha"; }
