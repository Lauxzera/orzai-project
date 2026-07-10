"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Bot,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Download,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  MessageCircle,
  Settings2,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Moon,
  X,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  blankLead,
  buildBlankLead,
  buildTrend,
  buildAssignableOwners,
  canEditCrm,
  canImportLeads,
  canManageUsers,
  closingStatuses,
  type CrmUser,
  currentDate,
  defaultCrmCustomizations,
  getLeadTrackedOriginLabel,
  findPotentialLeadDuplicates,
  findLeadDuplicate,
  formatDate,
  getDefaultViewForRole,
  getRoleViews,
  groupCount,
  isOverdue,
  seedState,
  toChartData,
  type CrmCustomizations,
  validateLead,
  withinPeriod,
  type CrmState,
  type FunnelStatus,
  type Lead,
  type LeadListColor,
  type Period,
  type Task,
  type View
} from "@/lib/crm";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/features/app-shell/components/app-sidebar";
import { AppTopbar } from "@/features/app-shell/components/app-topbar";
import { FilterSelect, PanelSkeleton } from "@/features/app-shell/components/page-primitives";
import { RightRail, type NotificationItem } from "@/features/app-shell/components/right-rail";
import { LeadList } from "@/features/leads/components/lead-list";
import { LeadListsView } from "@/features/leads/components/lead-lists-view";
import { LeadsWorkspace } from "@/features/leads/components/leads-workspace";
import { TaskList } from "@/features/tasks/components/task-list";
import { getRuntimeCached, invalidateRuntimeCache, primeRuntimeCache } from "@/lib/client/runtime-cache";
import { LandingPage } from "@/features/landing/components/landing-page";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { installPreviewFetch } from "@/lib/preview/preview-fetch";
import { isPreviewMode } from "@/lib/preview/is-preview-mode";
import { PreviewStaticScreen } from "@/lib/preview/preview-static-screen";

installPreviewFetch();

const OrzaiLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 36 A24 24 0 1 1 50.5 14.5" stroke="#2D7FEA" strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M56 36 A20 20 0 1 1 47.5 18" stroke="#2D7FEA" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
    <circle cx="53" cy="13.5" r="5" fill="#00E5A0" />
    <circle cx="53" cy="13.5" r="2.5" fill="#0A0F1E" />
    <circle cx="53" cy="13.5" r="8" stroke="#00E5A0" strokeWidth="1" fill="none" opacity="0.3" />
    <circle cx="26" cy="28" r="2" fill="#2D7FEA" opacity="0.5" />
    <circle cx="36" cy="18" r="1.5" fill="#2D7FEA" opacity="0.35" />
  </svg>
);

const preloadDashboard = () => import("@/components/crm/dashboard");
const preloadAnalyticsView = () => import("@/components/crm/analytics-view");
const preloadLeadDialog = () => import("@/components/crm/lead-dialog");
const preloadLeadSheet = () => import("@/components/crm/lead-sheet");
const preloadAssistantSheet = () => import("@/components/crm/assistant-sheet");
const preloadMessagesView = () => import("@/components/crm/messages-view");
const preloadBroadcastsView = () => import("@/components/crm/broadcasts-view");
const preloadAdminUsersView = () => import("@/components/crm/admin-users-view");
const preloadLeadSettingsView = () => import("@/features/settings/components/lead-settings-view");

const Dashboard = dynamic(() => preloadDashboard().then((module) => module.Dashboard), {
  loading: () => <PanelSkeleton />,
  ssr: false
});
const AnalyticsView = dynamic(() => preloadAnalyticsView().then((module) => module.AnalyticsView), {
  loading: () => <PanelSkeleton />,
  ssr: false
});

const LeadDialog = dynamic(() => preloadLeadDialog().then((module) => module.LeadDialog));
const LeadSheet = dynamic(() => preloadLeadSheet().then((module) => module.LeadSheet));
const AssistantSheet = dynamic(() => preloadAssistantSheet().then((module) => module.AssistantSheet));
const MessagesView = dynamic(() => preloadMessagesView().then((m) => m.MessagesView), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});
const BroadcastsView = dynamic(() => preloadBroadcastsView().then((m) => m.BroadcastsView), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});
const AdminUsersView = dynamic(() => preloadAdminUsersView().then((m) => m.AdminUsersView), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});
const LeadSettingsView = dynamic(
  () => preloadLeadSettingsView().then((module) => module.LeadSettingsView),
  { loading: () => <PanelSkeleton />, ssr: false },
);
const THEME_STORAGE_KEY = "orzai-project-theme";
const NOTIFICATION_READ_STORAGE_KEY = "orzai-project-notifications-read";
const CRM_BOOTSTRAP_CACHE_KEY = "crm-bootstrap";
const CRM_BOOTSTRAP_STALE_MS = 60_000;
const INBOX_MONITOR_CACHE_KEY = "inbox-monitor";
const INBOX_MONITOR_STALE_MS = 25_000;
type ThemeMode = "light" | "dark";
type InboxMonitorResponse = {
  conversations: Array<{
    id: string;
    unreadCount: number;
    lastMessageAt: string;
    lastMessageDirection?: "inbound" | "outbound" | null;
  }>;
};
type MessageToastState = {
  id: number;
  count: number;
};
type LoginResponse = {
  user: CrmUser;
};
const MESSAGE_NOTIFICATION_REFRESH_MS = 25_000;

function buildNotificationReadKey(userName: string, notificationId: string) {
  return `${userName.toLowerCase()}::${notificationId}`;
}

export default function OrzaiCrmPage() {
  const [state, setState] = React.useState<CrmState>(() => seedState());
  const [hydrated, setHydrated] = React.useState(false);
  const [theme, setTheme] = React.useState<ThemeMode>("dark");
  const [authenticated, setAuthenticated] = React.useState(false);
  const [currentUserName, setCurrentUserName] = React.useState("");
  const [currentUser, setCurrentUser] = React.useState<CrmUser | null>(null);
  const [assignableOwners, setAssignableOwners] = React.useState<string[]>(() => buildAssignableOwners([]));
  const [customizations, setCustomizations] = React.useState<CrmCustomizations>(defaultCrmCustomizations);
  const [loginMode, setLoginMode] = React.useState<"landing" | "login" | "register">("landing");
  const [loginDraft, setLoginDraft] = React.useState({ username: "", password: "" });
  const [loginError, setLoginError] = React.useState("");
  const [registerDraft, setRegisterDraft] = React.useState({ name: "", username: "", password: "", confirmPassword: "" });
  const [registerError, setRegisterError] = React.useState("");
  const [registerSuccess, setRegisterSuccess] = React.useState("");
  const [serverError, setServerError] = React.useState("");
  const [view, setView] = React.useState<View>("dashboard");
  const [period, setPeriod] = React.useState<Period>("month");
  const [courseFilter, setCourseFilter] = React.useState("all");
  const [originFilter, setOriginFilter] = React.useState("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [leadDialogOpen, setLeadDialogOpen] = React.useState(false);
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [rightRailOpen, setRightRailOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const [editingLeadId, setEditingLeadId] = React.useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [readNotifications, setReadNotifications] = React.useState<Record<string, boolean>>({});
  const [formLead, setFormLead] = React.useState<Omit<Lead, "id" | "history">>(blankLead);
  const [formError, setFormError] = React.useState("");
  const [leadDeleteLoading, setLeadDeleteLoading] = React.useState(false);
  const [leadDeleteError, setLeadDeleteError] = React.useState("");
  const [customizationsSaving, setCustomizationsSaving] = React.useState(false);
  const [customizationsError, setCustomizationsError] = React.useState("");
  const [customizationsSuccess, setCustomizationsSuccess] = React.useState("");
  const [taskDraft, setTaskDraft] = React.useState({ title: "", owner: "Equipe Comercial", dueDate: currentDate(1) });
  const [historyDraft, setHistoryDraft] = React.useState("");
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [fileImportLoading, setFileImportLoading] = React.useState(false);
  const [fileImportSummary, setFileImportSummary] = React.useState("");
  const [leadListImportLoading, setLeadListImportLoading] = React.useState(false);
  const [leadListImportSummary, setLeadListImportSummary] = React.useState("");
  const [messagesUnreadCount, setMessagesUnreadCount] = React.useState(0);
  const [messageToast, setMessageToast] = React.useState<MessageToastState | null>(null);
  const [pageVisible, setPageVisible] = React.useState(true);
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const previousInboxSnapshotRef = React.useRef<Map<string, { unreadCount: number; lastMessageAt: string }>>(new Map());
  const toastTimeoutRef = React.useRef<number | null>(null);

  const resetSessionState = React.useCallback(() => {
    setAuthenticated(false);
    setCurrentUserName("");
    setCurrentUser(null);
    setAssignableOwners(buildAssignableOwners([]));
    setCustomizations(defaultCrmCustomizations);
    setRightRailOpen(false);
  }, []);

  const applyBootstrapData = React.useCallback(
    (data: {
      user: CrmUser;
      state: CrmState;
      assignableOwners?: string[];
      customizations?: CrmCustomizations;
    }) => {
      setState(data.state);
      setCurrentUserName(data.user.name);
      setCurrentUser({ ...data.user, active: data.user.active ?? true });
      setCustomizations(data.customizations ?? defaultCrmCustomizations);
      setAssignableOwners(
        Array.isArray(data.assignableOwners) && data.assignableOwners.length > 0
          ? data.assignableOwners
          : buildAssignableOwners(data.state.leads.map((lead) => lead.responsavel)),
      );
      setAuthenticated(true);
      setView((current) => (getRoleViews(data.user.role).includes(current) ? current : getDefaultViewForRole(data.user.role)));
      setRightRailOpen(false);
      setServerError("");
    },
    [],
  );

  const bootstrap = React.useCallback(async (force = false) => {
    try {
      const data = await getRuntimeCached(
        CRM_BOOTSTRAP_CACHE_KEY,
        () =>
          fetchJson<{
            user: CrmUser;
            state: CrmState;
            assignableOwners?: string[];
            customizations?: CrmCustomizations;
          }>("/api/crm/state"),
        { staleMs: CRM_BOOTSTRAP_STALE_MS, force },
      );
      applyBootstrapData(data);
    } catch (error) {
      resetSessionState();
      if (error instanceof HttpError && error.status === 401) {
        setServerError("");
      } else {
        setServerError(error instanceof Error ? error.message : "Não foi possível carregar o CRM.");
      }
    } finally {
      setHydrated(true);
    }
  }, [applyBootstrapData, resetSessionState]);

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
    // default é sempre claro — sistema do usuário não sobrepõe a preferência do produto
    void bootstrap();
  }, [bootstrap]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (hydrated) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [hydrated, theme]);

  React.useEffect(() => {
    if (!authenticated) return;

    const warmViews = () => {
      void preloadLeadDialog();
      void preloadLeadSheet();
      void preloadAssistantSheet();
      void preloadDashboard();
      void preloadAnalyticsView();
      void preloadMessagesView();
      void preloadLeadSettingsView();
      if (currentUser?.role === "ADMIN") {
        void preloadAdminUsersView();
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleWindow = window as Window & {
        requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback: (handle: number) => void;
      };
      const idleId = idleWindow.requestIdleCallback(() => warmViews(), { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => warmViews(), 400);
    return () => globalThis.clearTimeout(timeoutId);
  }, [authenticated, currentUser?.role]);

  React.useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated || !authenticated || !currentUserName) {
      setReadNotifications({});
      return;
    }

    try {
      const raw = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
      const parsed = raw ?(JSON.parse(raw) as Record<string, boolean>) : {};
      setReadNotifications(parsed);
    } catch {
      setReadNotifications({});
    }
  }, [authenticated, currentUserName, hydrated]);

  React.useEffect(() => {
    if (!rightRailOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRightRailOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [rightRailOpen]);

  React.useEffect(() => {
    if (!sidebarOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  React.useEffect(() => {
    if (!exportMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [exportMenuOpen]);

  const darkMode = theme === "dark";
  const currentRole = currentUser?.role ?? "VIEWER";
  const allowCrmEdits = canEditCrm(currentRole);
  const allowUserManagement = canManageUsers(currentRole);
  const allowLeadSettings = currentRole === "ADMIN" || currentRole === "MANAGER";
  const allowLeadImport = canImportLeads(currentRole);
  const allowedViews = React.useMemo(() => getRoleViews(currentRole), [currentRole]);
  const defaultView = getDefaultViewForRole(currentRole);
  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "leads", label: "Leads", icon: UsersRound },
    { id: "lead-lists", label: "Listas de leads", icon: FileSpreadsheet },
    { id: "tasks", label: "Tarefas", icon: ListChecks },
    { id: "messages", label: "Atendimento", icon: MessageCircle },
    { id: "broadcasts", label: "Disparos oficiais", icon: Send },
    ...(allowLeadSettings ? [{ id: "lead-settings", label: "Personalização", icon: Settings2 }] : []),
    ...(allowUserManagement ? [{ id: "admin-users", label: "Usuários", icon: ShieldCheck }] : []),
  ].filter((item) => allowedViews.includes(item.id as View));

  React.useEffect(() => {
    if (!allowedViews.includes(view)) {
      setView(defaultView);
    }
  }, [allowedViews, defaultView, view]);

  React.useEffect(() => {
    if (isPreviewMode() || !authenticated || !allowedViews.includes("messages")) {
      setMessagesUnreadCount(0);
      return;
    }

    if (!pageVisible) {
      return;
    }

    let cancelled = false;

    async function loadInboxStatus() {
      try {
        const data = await getRuntimeCached(
          INBOX_MONITOR_CACHE_KEY,
          () => fetchJson<InboxMonitorResponse>("/api/messages/conversations?compact=1"),
          { staleMs: INBOX_MONITOR_STALE_MS },
        );
        if (cancelled) return;

        const conversations = Array.isArray(data.conversations) ? data.conversations : [];
        const nextUnreadCount = conversations.reduce((sum, conversation) => sum + Math.max(0, conversation.unreadCount || 0), 0);
        setMessagesUnreadCount(nextUnreadCount);

        const nextSnapshot = new Map<string, { unreadCount: number; lastMessageAt: string }>();
        let newInboundCount = 0;

        for (const conversation of conversations) {
          nextSnapshot.set(conversation.id, {
            unreadCount: conversation.unreadCount ?? 0,
            lastMessageAt: conversation.lastMessageAt ?? "",
          });

          if (view === "messages") continue;
          if (conversation.lastMessageDirection !== "inbound") continue;

          const previous = previousInboxSnapshotRef.current.get(conversation.id);
          const currentUnread = Math.max(0, conversation.unreadCount ?? 0);
          const previousUnread = Math.max(0, previous?.unreadCount ?? 0);
          const previousLastMessageAt = previous?.lastMessageAt ?? "";
          const lastMessageChanged = previousLastMessageAt !== (conversation.lastMessageAt ?? "");

          if (!previous) {
            newInboundCount += currentUnread > 0 ? currentUnread : 0;
            continue;
          }

          if (currentUnread > previousUnread && lastMessageChanged) {
            newInboundCount += currentUnread - previousUnread;
          }
        }

        previousInboxSnapshotRef.current = nextSnapshot;

        if (view !== "messages" && newInboundCount > 0) {
          const nextToast = {
            id: Date.now(),
            count: newInboundCount,
          };
          setMessageToast(nextToast);
          if (toastTimeoutRef.current !== null) {
            window.clearTimeout(toastTimeoutRef.current);
          }
          toastTimeoutRef.current = window.setTimeout(() => {
            setMessageToast((current) => (current?.id === nextToast.id ? null : current));
          }, 1800);
        }
      } catch {
        if (cancelled) return;
      }
    }

    void loadInboxStatus();
    const intervalId = window.setInterval(() => {
      void loadInboxStatus();
    }, MESSAGE_NOTIFICATION_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [allowedViews, authenticated, pageVisible, view]);

  React.useEffect(() => {
    if (ownerFilter !== "all" && !assignableOwners.includes(ownerFilter)) {
      setOwnerFilter("all");
    }
    if (!assignableOwners.includes(taskDraft.owner)) {
      setTaskDraft((current) => ({ ...current, owner: assignableOwners[0] ?? "Equipe Comercial" }));
    }
    if (formLead.responsavel && !assignableOwners.includes(formLead.responsavel)) {
      setFormLead((current) => ({ ...current, responsavel: assignableOwners[0] ?? "Equipe Comercial" }));
    }
  }, [assignableOwners, formLead.responsavel, ownerFilter, taskDraft.owner]);

  React.useEffect(() => {
    if (courseFilter !== "all" && !customizations.courses.includes(courseFilter)) {
      setCourseFilter("all");
    }
    if (originFilter !== "all" && !customizations.origins.includes(originFilter)) {
      setOriginFilter("all");
    }
    if (formLead.curso_de_interesse && !customizations.courses.includes(formLead.curso_de_interesse)) {
      setFormLead((current) => ({ ...current, curso_de_interesse: customizations.courses[0] ?? current.curso_de_interesse }));
    }
    if (formLead.origem && !customizations.origins.includes(formLead.origem)) {
      setFormLead((current) => ({ ...current, origem: customizations.origins[0] ?? current.origem }));
    }
    if (formLead.captado_via && !customizations.leadCaptureMethods.includes(formLead.captado_via)) {
      setFormLead((current) => ({
        ...current,
        captado_via: customizations.leadCaptureMethods[0] ?? current.captado_via,
      }));
    }
  }, [courseFilter, customizations, formLead.captado_via, formLead.curso_de_interesse, formLead.origem, originFilter]);

  async function runServerCommand(command: unknown) {
    const data = await fetchJson<{ state: CrmState }>("/api/crm/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command)
    });
    if (currentUser) {
      primeRuntimeCache(CRM_BOOTSTRAP_CACHE_KEY, {
        user: currentUser,
        state: data.state,
        assignableOwners,
        customizations,
      });
    }
    setState(data.state);
    setServerError("");
    return data.state;
  }

  async function runCommand(command: unknown) {
    return runServerCommand(command);
  }

  const filteredLeads = React.useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return state.leads.filter((lead) => {
      const matchesCourse = courseFilter === "all" || lead.curso_de_interesse === courseFilter;
      const matchesOrigin = originFilter === "all" || lead.origem === originFilter;
      const matchesOwner = ownerFilter === "all" || lead.responsavel === ownerFilter;
      const matchesSearch =
        !term ||
        [lead.nome, lead.telefone, lead.email, lead.cidade, lead.profissao].some((value) =>
          value.toLowerCase().includes(term)
        );
      return matchesCourse && matchesOrigin && matchesOwner && matchesSearch;
    });
  }, [courseFilter, deferredSearch, originFilter, ownerFilter, state.leads]);

  const filteredLeadIds = React.useMemo(() => new Set(filteredLeads.map((lead) => lead.id)), [filteredLeads]);

  const tasksForFilteredLeads = React.useMemo(
    () => state.tasks.filter((task) => filteredLeadIds.has(task.leadId)),
    [filteredLeadIds, state.tasks]
  );

  const selectedLead = React.useMemo(
    () => (selectedLeadId ?state.leads.find((lead) => lead.id === selectedLeadId) || null : null),
    [selectedLeadId, state.leads]
  );

  const selectedLeadTasks = React.useMemo(
    () => (selectedLead ?state.tasks.filter((task) => task.leadId === selectedLead.id) : []),
    [selectedLead, state.tasks]
  );
  const leadDialogDuplicateHints = React.useMemo(
    () => findPotentialLeadDuplicates(state.leads, formLead, editingLeadId),
    [editingLeadId, formLead, state.leads]
  );

  const pendingTasks = React.useMemo(() => state.tasks.filter((task) => !task.done), [state.tasks]);
  const overdueLeads = React.useMemo(
    () => state.leads.filter((lead) => isOverdue(lead.proximo_contato) && !closingStatuses.includes(lead.status_funil)),
    [state.leads]
  );
  const notifications = React.useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    for (const lead of overdueLeads.slice(0, 6)) {
      const id = `overdue-followup::${lead.id}::${lead.proximo_contato}`;
      items.push({
        id,
        title: "Follow-up atrasado",
        description: `${lead.nome} está sem retorno desde ${lead.proximo_contato || "data não informada"}.`,
        kind: "overdue-followup",
        leadId: lead.id,
        createdAt: `${lead.proximo_contato || currentDate(0)}T12:00:00`,
        read: Boolean(readNotifications[buildNotificationReadKey(currentUserName, id)]),
      });
    }

    for (const task of pendingTasks.filter((item) => item.dueDate <= currentDate(1)).slice(0, 6)) {
      const lead = state.leads.find((item) => item.id === task.leadId);
      const id = `pending-task::${task.id}::${task.dueDate}`;
      items.push({
        id,
        title: "Tarefa pendente",
        description: `${task.title} · ${lead?.nome ?? "Lead não localizado"}`,
        kind: "pending-task",
        leadId: lead?.id ?? null,
        taskOwner: task.owner,
        createdAt: `${task.dueDate}T12:00:00`,
        read: Boolean(readNotifications[buildNotificationReadKey(currentUserName, id)]),
      });
    }

    for (const lead of state.leads.filter((item) => item.data_entrada === currentDate(0)).slice(0, 4)) {
      const id = `new-lead::${lead.id}::${lead.data_entrada}`;
      items.push({
        id,
        title: "Lead novo hoje",
        description: `${lead.nome} entrou via ${getLeadTrackedOriginLabel(lead)}.`,
        kind: "new-lead",
        leadId: lead.id,
        createdAt: `${lead.data_entrada}T12:00:00`,
        read: Boolean(readNotifications[buildNotificationReadKey(currentUserName, id)]),
      });
    }

    return items.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [currentUserName, overdueLeads, pendingTasks, readNotifications, state.leads]);
  const unreadNotifications = React.useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );
  const rightRailActivities = React.useMemo(
    () =>
      pendingTasks.slice(0, 5).map((task) => ({
        id: task.id,
        title: task.title,
        meta: `${formatDate(task.dueDate)} · ${task.owner}`,
      })),
    [pendingTasks]
  );
  const rightRailContacts = React.useMemo(
    () => filteredLeads.slice(0, 5).map((lead) => ({ id: lead.id, nome: lead.nome })),
    [filteredLeads]
  );

  function openNewLead() {
    setEditingLeadId(null);
    setFormLead(buildBlankLead(customizations, assignableOwners));
    setFormError("");
    setLeadDeleteError("");
    setLeadDialogOpen(true);
  }

  function openEditLead(lead: Lead) {
    setEditingLeadId(lead.id);
    const { id: _id, history: _history, ...editable } = lead;
    setFormLead(editable);
    setFormError("");
    setLeadDeleteError("");
    setLeadDialogOpen(true);
  }

  async function upsertLeadData(leadId: string | null, lead: Omit<Lead, "id" | "history">) {
    const validation = validateLead(lead);
    if (validation) {
      throw new Error(validation);
    }

    const duplicate = findLeadDuplicate(state.leads, lead, leadId);
    if (duplicate) {
      throw new Error(`Já existe um lead com este ${duplicate.field} (${duplicate.lead.nome}).`);
    }

    await runCommand({ type: "upsertLead", leadId, lead });
  }

  async function saveLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await upsertLeadData(editingLeadId, formLead);
      setLeadDialogOpen(false);
      setEditingLeadId(null);
      setFormError("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o lead.");
    }
  }

  async function deleteLead(leadId: string) {
    setLeadDeleteLoading(true);
    setLeadDeleteError("");
    try {
      const nextState = await runCommand({ type: "deleteLead", leadId });
      setSelectedLeadId((current) => (current === leadId ? null : current));
      setSelectedConversationId(null);
      setState(nextState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir o lead.";
      setLeadDeleteError(message);
      throw new Error(message);
    } finally {
      setLeadDeleteLoading(false);
    }
  }

  async function changeLeadStatus(leadId: string, status: FunnelStatus) {
    try {
      await runCommand({ type: "changeLeadStatus", leadId, status });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível mover o lead.");
    }
  }

  async function addTask(lead: Lead) {
    if (!taskDraft.title.trim()) return;

    try {
      await runCommand({
        type: "addTask",
        leadId: lead.id,
        title: taskDraft.title,
        owner: taskDraft.owner,
        dueDate: taskDraft.dueDate
      });
      setTaskDraft({ title: "", owner: lead.responsavel, dueDate: currentDate(1) });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    }
  }

  async function addTaskFromMessages(leadId: string, payload: { title: string; owner: string; dueDate: string }) {
    try {
      await runCommand({
        type: "addTask",
        leadId,
        title: payload.title,
        owner: payload.owner,
        dueDate: payload.dueDate,
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    }
  }

  async function addHistory(lead: Lead) {
    if (!historyDraft.trim()) return;

    try {
      await runCommand({ type: "addHistory", leadId: lead.id, note: historyDraft });
      setHistoryDraft("");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível registrar o atendimento.");
    }
  }

  async function toggleTask(taskId: string) {
    try {
      await runCommand({ type: "toggleTask", taskId });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    }
  }

  function handleOpenMessages(leadId?: string | null, conversationId?: string | null) {
    setView("messages");
    setSelectedLeadId(leadId ?? null);
    setSelectedConversationId(conversationId ?? null);
  }

  function markNotificationRead(notificationId: string) {
    if (!currentUserName) return;
    const key = buildNotificationReadKey(currentUserName, notificationId);
    setReadNotifications((current) => {
      const next = { ...current, [key]: true };
      if (hydrated) {
        window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }

  function clearFilters() {
    setCourseFilter("all");
    setOriginFilter("all");
    setOwnerFilter("all");
    setSearch("");
  }

  async function importLeadsFromFile(file: File) {
    setFileImportLoading(true);
    setFileImportSummary("");
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await fetchJson<{
        state: CrmState;
        summary: { imported: number; skipped: number; errors: string[]; rowsRead: number };
      }>("/api/integrations/import", { method: "POST", body });
      setState(data.state);
      const suffix = data.summary.errors.length ?` ${data.summary.errors.length} linha(s) com atenção.` : "";
      setFileImportSummary(
        `Arquivo lido: ${data.summary.rowsRead} linha(s). ${data.summary.imported} lead(s) importado(s), ${data.summary.skipped} pulado(s).${suffix}`
      );
    } catch (error) {
      setServerError(error instanceof Error ?error.message : "Não foi possível importar o arquivo.");
    } finally {
      setFileImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createLeadList(data: {
    name: string;
    description: string;
    color: LeadListColor;
    leadIds: string[];
  }) {
    const nextState = await runCommand({
      type: "createLeadList",
      name: data.name,
      description: data.description,
      color: data.color,
      leadIds: data.leadIds,
    });
    setState(nextState);
  }

  async function updateLeadList(
    listId: string,
    data: {
      name: string;
      description: string;
      color: LeadListColor;
      leadIds: string[];
    }
  ) {
    const nextState = await runCommand({
      type: "updateLeadList",
      listId,
      name: data.name,
      description: data.description,
      color: data.color,
      leadIds: data.leadIds,
    });
    setState(nextState);
  }

  async function deleteLeadList(listId: string) {
    const nextState = await runCommand({ type: "deleteLeadList", listId });
    setState(nextState);
  }

  async function saveLeadCustomizations(nextCustomizations: CrmCustomizations) {
    setCustomizationsSaving(true);
    setCustomizationsError("");
    setCustomizationsSuccess("");
    try {
      const persistViaRoute = async () => {
        const data = await fetchJson<{ customizations: CrmCustomizations; assignableOwners: string[] }>("/api/crm/customizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextCustomizations),
        });
        setCustomizations(data.customizations);
        setAssignableOwners(
          Array.isArray(data.assignableOwners) && data.assignableOwners.length > 0
            ? data.assignableOwners
            : buildAssignableOwners(data.customizations.owners)
        );
      };

      await persistViaRoute();
      setCustomizationsSuccess("Personalizações salvas com sucesso.");
    } catch (error) {
      setCustomizationsError(error instanceof Error ? error.message : "Não foi possível salvar as personalizações.");
    } finally {
      setCustomizationsSaving(false);
    }
  }

  async function addLeadToList(listId: string, leadId: string) {
    const targetList = state.leadLists.find((list) => list.id === listId);
    if (!targetList) {
      throw new Error("Lista não encontrada.");
    }

    const nextLeadIds = [...new Set([...targetList.leadIds, leadId])];
    await updateLeadList(listId, {
      name: targetList.name,
      description: targetList.description,
      color: targetList.color,
      leadIds: nextLeadIds,
    });
  }

  async function importLeadListMembers(
    file: File,
    options: { listId?: string | null; listName: string; description: string; color: LeadListColor }
  ) {
    setLeadListImportLoading(true);
    setLeadListImportSummary("");
    try {
      const body = new FormData();
      body.append("file", file);
      if (options.listId) body.append("listId", options.listId);
      if (options.listName) body.append("listName", options.listName);
      body.append("description", options.description);
      body.append("color", options.color);

      const data = await fetchJson<{
        state: CrmState;
        summary: {
          listName: string;
          matched: number;
          unmatched: number;
          rowsRead: number;
          duplicates: number;
        };
      }>("/api/lead-lists/import", { method: "POST", body });

      setState(data.state);
      setLeadListImportSummary(
        `Lista "${data.summary.listName}": ${data.summary.matched} lead(s) vinculados, ${data.summary.unmatched} não localizado(s) e ${data.summary.duplicates} duplicado(s) em ${data.summary.rowsRead} linha(s).`
      );
      return data.summary;
    } finally {
      setLeadListImportLoading(false);
    }
  }

  function getExportRows() {
    return filteredLeads.map((lead) => [
      lead.nome,
      lead.telefone,
      lead.whatsapp,
      lead.email,
      lead.curso_de_interesse,
      lead.origem,
      lead.origem_detalhe,
      lead.captado_via,
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
      lead.utm_term,
      lead.utm_content,
      lead.tracking_referrer,
      lead.tracking_landing_page,
      lead.tracking_id,
      lead.status_funil,
      lead.status_matricula,
      lead.responsavel,
      lead.data_entrada,
      lead.proximo_contato,
      lead.cidade,
      lead.profissao,
      lead.objecao_principal
    ]);
  }

  function exportFilteredLeadsCsv() {
    const headers = [
      "nome",
      "telefone",
      "whatsapp",
      "email",
      "curso",
      "origem",
      "origem_detalhe",
      "captado_via",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "tracking_referrer",
      "tracking_landing_page",
      "tracking_id",
      "status_funil",
      "status_matricula",
      "responsavel",
      "data_entrada",
      "proximo_contato",
      "cidade",
      "profissao",
      "objecao_principal"
    ];
    const rows = getExportRows();
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-belart-${currentDate(0)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  }

  async function exportFilteredLeadsPdf() {
    const headers = [
      "Nome",
      "Telefone",
      "WhatsApp",
      "E-mail",
      "Curso",
      "Origem",
      "Detalhe da origem",
      "Captado via",
      "UTM source",
      "UTM medium",
      "UTM campaign",
      "UTM term",
      "UTM content",
      "Referrer",
      "Landing page",
      "Tracking ID",
      "Status do funil",
      "Status da matrícula",
      "Responsável",
      "Entrada",
      "Próximo contato",
      "Cidade",
      "Profissão",
      "Objeção"
    ];

    const rows = getExportRows().map((row) => row.map((value) => value || "-"));
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Orzai - Exportação de Leads", 40, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 56);
    doc.text(`Total de leads: ${filteredLeads.length}`, 40, 72);

    autoTable(doc, {
      startY: 88,
      head: [headers],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 5,
        overflow: "linebreak",
        valign: "middle"
      },
      headStyles: {
        fillColor: [31, 48, 67],
        textColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [248, 244, 238]
      },
      margin: {
        left: 28,
        right: 28
      }
    });

    doc.save(`leads-belart-${currentDate(0)}.pdf`);
    setExportMenuOpen(false);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    try {
      const response = await fetchJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginDraft)
      });

      setLoginDraft({ username: "", password: "" });
      setRightRailOpen(false);
      await bootstrap(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterError("");
    if (registerDraft.password !== registerDraft.confirmPassword) {
      setRegisterError("As senhas não coincidem.");
      return;
    }
    try {
      const response = await fetchJson<LoginResponse>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerDraft.name,
          username: registerDraft.username,
          password: registerDraft.password,
        }),
      });

      setRegisterDraft({ name: "", username: "", password: "", confirmPassword: "" });
      setRegisterSuccess("Conta criada com sucesso.");
      await bootstrap(true);
    } catch (error) {
      setRegisterError(error instanceof Error ?error.message : "Não foi possível criar a conta.");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      invalidateRuntimeCache(CRM_BOOTSTRAP_CACHE_KEY);
      resetSessionState();
      setLoginDraft({ username: "", password: "" });
      setLoginError("");
      setAssistantOpen(false);
      setSelectedLeadId(null);
      setLeadDialogOpen(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="belart-home grid min-h-screen place-items-center p-4 text-foreground">
        <section className="soft-panel w-full max-w-[430px] rounded-lg border p-6 text-center shadow-xl">
          <p className="text-sm font-medium text-muted-foreground">Carregando Orzai...</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    if (loginMode === "landing") {
      return <LandingPage onEnterCrm={() => setLoginMode("login")} />;
    }

    return (
      <main className="belart-home grid min-h-screen place-items-center p-4 text-foreground relative overflow-hidden bg-[#080808]">
        {/* Fundo limpo e otimizado (sem bolhas de blur gigantes) */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" />
        <div className="absolute top-4 left-4 z-10">
          <Button variant="ghost" onClick={() => setLoginMode("landing")}>
            &larr; Voltar
          </Button>
        </div>
        <section className="w-full max-w-[430px] rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <OrzaiLogo className="h-10 w-10 text-primary" />
            <div>
              <p className="text-sm font-bold text-white/90">Orzai</p>
              <h1 className="text-xl font-semibold tracking-normal">
                {loginMode === "login" ? "Acesso ao CRM" : "Criar conta"}
              </h1>
            </div>
          </div>

          {loginMode === "login" ? (
            <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-login-user">Usuário</label>
                <Input
                  id="crm-login-user"
                  autoComplete="username"
                  value={loginDraft.username}
                  onChange={(event) => {
                    setLoginDraft((current) => ({ ...current, username: event.target.value }));
                    setLoginError("");
                  }}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-login-password">Senha</label>
                <Input
                  id="crm-login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginDraft.password}
                  onChange={(event) => {
                    setLoginDraft((current) => ({ ...current, password: event.target.value }));
                    setLoginError("");
                  }}
                />
              </div>

              {registerSuccess ?<p className="rounded-md bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{registerSuccess}</p> : null}
              {loginError ?<p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{loginError}</p> : null}
              {serverError ?<p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{serverError}</p> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                  aria-pressed={darkMode}
                  aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
                >
                  {darkMode ?<Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {darkMode ? "Claro" : "Escuro"}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLoginMode("register");
                      setLoginError("");
                      setRegisterError("");
                      setRegisterSuccess("");
                    }}
                  >
                    Cadastre-se
                  </Button>
                  <Button type="submit">Entrar</Button>
                </div>
              </div>
            </form>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={handleRegister}>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-reg-name">Nome completo</label>
                <Input
                  id="crm-reg-name"
                  autoComplete="name"
                  value={registerDraft.name}
                  onChange={(event) => {
                    setRegisterDraft((c) => ({ ...c, name: event.target.value }));
                    setRegisterError("");
                  }}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-reg-user">Usuário</label>
                <Input
                  id="crm-reg-user"
                  autoComplete="username"
                  value={registerDraft.username}
                  onChange={(event) => {
                    setRegisterDraft((c) => ({ ...c, username: event.target.value }));
                    setRegisterError("");
                  }}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-reg-pass">Senha</label>
                <Input
                  id="crm-reg-pass"
                  type="password"
                  autoComplete="new-password"
                  value={registerDraft.password}
                  onChange={(event) => {
                    setRegisterDraft((c) => ({ ...c, password: event.target.value }));
                    setRegisterError("");
                  }}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="crm-reg-confirm">Confirmar senha</label>
                <Input
                  id="crm-reg-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={registerDraft.confirmPassword}
                  onChange={(event) => {
                    setRegisterDraft((c) => ({ ...c, confirmPassword: event.target.value }));
                    setRegisterError("");
                  }}
                />
              </div>

              {registerError ?<p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{registerError}</p> : null}

              <p className="text-xs text-muted-foreground">
                Conta criada com perfil <strong>Vendas</strong>. Um administrador pode alterar o nível de acesso posteriormente.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLoginMode("login");
                    setRegisterError("");
                  }}
                >
                  Voltar ao login
                </Button>
                <Button type="submit">Criar conta</Button>
              </div>
            </form>
          )}
        </section>
      </main>
    );
  }
  return (
    <main className="belart-home min-h-screen text-foreground dark relative overflow-hidden bg-[#080808]">
      {!sidebarOpen ? null : (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "mx-auto grid min-h-screen max-w-[1920px]",
          sidebarOpen && "lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]"
        )}
      >
        <AppSidebar
          currentRole={currentRole}
          items={navigationItems}
          activeView={view}
          messagesUnreadCount={messagesUnreadCount}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectView={(nextView) => {
            setView(nextView);
            if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
          }}
        />

        <section
          className={cn(
            "min-w-0 border-r",
            view === "messages" && "flex h-screen max-h-screen flex-col overflow-hidden overflow-x-hidden",
          )}
        >
          <AppTopbar
            currentRole={currentRole}
            currentUserName={currentUserName}
            search={search}
            sidebarOpen={sidebarOpen}
            rightRailOpen={rightRailOpen}
            unreadNotifications={unreadNotifications}
            onSearchChange={setSearch}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            onLogout={handleLogout}
            onToggleRightRail={() => setRightRailOpen((open) => !open)}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden relative z-10 w-full animate-in fade-in duration-300">
              {view === "messages" && isPreviewMode() ? (
            <PreviewStaticScreen
              title="Atendimento via WhatsApp"
              description="Aqui o time conversa com os leads direto pelo WhatsApp, com histórico completo e ações rápidas de CRM. Na versão real, cada conversa fica ligada ao lead correspondente."
              items={[
                { title: "Mariana Alves", detail: "\"Quer confirmar agenda de sábado\" · Aguardando Retorno" },
                { title: "Letícia Fernandes", detail: "\"Parcelamento\" · Em negociação" },
                { title: "Camila Rocha", detail: "Novo contato via WhatsApp · Aguardando primeiro atendimento" },
              ]}
            />
          ) : view === "messages" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <MessagesView
                leads={state.leads}
                leadLists={state.leadLists}
                onStatusChange={changeLeadStatus}
                onUpsertLead={upsertLeadData}
                onCreateTask={addTaskFromMessages}
                focusLeadId={selectedLeadId}
                focusConversationId={selectedConversationId}
                ownerOptions={assignableOwners}
                courseOptions={customizations.courses}
                courseSegments={customizations.courseSegments}
                originOptions={customizations.origins}
                captureMethodOptions={customizations.leadCaptureMethods}
                canEdit={allowCrmEdits}
                userRole={currentRole}
                currentUserName={currentUserName}
              />
            </div>
          ) : null}

          <div className={cn("space-y-4 p-4 lg:p-5 xl:space-y-5 xl:p-7 2xl:p-9", view === "messages" && "hidden")}>
          {serverError ?<div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{serverError}</div> : null}
          {fileImportSummary ?<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{fileImportSummary}</div> : null}
          {leadListImportSummary ?<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{leadListImportSummary}</div> : null}

          <header>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
                  CRM de leads e matrículas
                </h1>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {allowLeadImport && view !== "lead-settings" ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importLeadsFromFile(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileImportLoading}
                    title="Importar leads de arquivo CSV ou PDF"
                  >
                    {fileImportLoading ?<LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Importar arquivo
                  </Button>
                </>
                ) : null}
                {allowCrmEdits && view !== "lead-settings" ? (
                <Button onClick={openNewLead}>
                  <Plus className="h-4 w-4" />
                  Novo lead
                </Button>
                ) : null}
              </div>
            </div>
          </header>

          {view !== "analytics" && view !== "admin-users" && view !== "lead-settings" ? (
            <Card className="soft-panel">
              <CardContent className="grid gap-3 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9 text-sm" placeholder="Buscar por nome, telefone, cidade..." />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button type="button" variant="outline" size="icon" onClick={clearFilters} aria-label="Limpar filtros">
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="relative" ref={exportMenuRef}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExportMenuOpen((open) => !open)}
                        aria-haspopup="menu"
                        aria-expanded={exportMenuOpen}
                      >
                        <Download className="h-4 w-4" />
                        Exportar
                      </Button>

                      {exportMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-44 rounded-xl border bg-background p-1.5 shadow-xl">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                            onClick={exportFilteredLeadsCsv}
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                            Exportar em CSV
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                            onClick={() => void exportFilteredLeadsPdf()}
                          >
                            <FileDown className="h-4 w-4 text-muted-foreground" />
                            Exportar em PDF
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <FilterSelect value={courseFilter} onValueChange={setCourseFilter} options={customizations.courses} placeholder="Todos os cursos" />
                  <FilterSelect value={originFilter} onValueChange={setOriginFilter} options={customizations.origins} placeholder="Todas as origens" />
                  <FilterSelect value={ownerFilter} onValueChange={setOwnerFilter} options={assignableOwners} placeholder="Todos os responsáveis" />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {view === "dashboard" ? (
            <div className="perf-section">
              <DashboardContainer
                period={period}
                setPeriod={setPeriod}
                leads={state.leads}
                tasks={state.tasks}
                overdueLeads={overdueLeads.length}
                pendingTasks={pendingTasks}
              />
            </div>
          ) : null}

          {view === "analytics" && isPreviewMode() ? (
            <div className="perf-section">
              <PreviewStaticScreen
                title="Analytics de conversas"
                description="Métricas de atendimento por canal, tempo de resposta e objeções mais frequentes, calculadas a partir do histórico de conversas. Na versão real, os números refletem seus atendimentos de verdade."
                items={[
                  { title: "Tempo médio de resposta", detail: "4 min 30s nas últimas 24h" },
                  { title: "Objeção mais comum", detail: "\"Preciso avaliar deslocamento\"" },
                  { title: "Taxa de conversão", detail: "23% dos leads em conversa viram matrícula" },
                ]}
              />
            </div>
          ) : view === "analytics" ? (
            <div className="perf-section">
              <AnalyticsView
                leads={state.leads}
                tasks={state.tasks}
                onOpenConversation={handleOpenMessages}
                onOpenLead={setSelectedLeadId}
              />
            </div>
          ) : null}

          {view === "leads" ? (
            <div className="perf-section">
                <LeadsWorkspace
                  leads={filteredLeads}
                  leadLists={state.leadLists}
                  currentRole={currentRole}
                  onOpenLead={setSelectedLeadId}
                  onEditLead={openEditLead}
                  onOpenMessages={handleOpenMessages}
                  onMoveLead={changeLeadStatus}
                  onAddToLeadList={addLeadToList}
                  onCreateLeadList={createLeadList}
                  canEdit={allowCrmEdits}
                />
            </div>
          ) : null}

          {view === "broadcasts" && isPreviewMode() ? (
            <div className="perf-section">
              <PreviewStaticScreen
                title="Central de disparos oficiais"
                description="Envio de campanhas em massa pela WhatsApp Business Platform, com fila controlada e intervalo de segurança entre mensagens. Na versão real, você monta a mensagem, escolhe o público e acompanha o progresso do envio."
                items={[
                  { title: "Turma de Sobrancelhas - Reativação", detail: "Pausada · 12 pendentes, 38 enviados" },
                  { title: "Follow-up pós-evento", detail: "Concluída · 20 enviados, 0 falhas" },
                  { title: "Boas-vindas turma nova", detail: "Em andamento · 5 pendentes" },
                ]}
              />
            </div>
          ) : view === "broadcasts" ? (
            <div className="perf-section">
              <BroadcastsView
                leads={state.leads}
                leadLists={state.leadLists}
                courseOptions={customizations.courses}
                canEdit={allowCrmEdits}
              />
            </div>
          ) : null}

          {view === "lead-lists" ? (
            <div className="perf-section">
              <LeadListsView
                state={state}
                availableLeads={filteredLeads}
                canEdit={allowCrmEdits}
                importing={leadListImportLoading}
                importSummary={leadListImportSummary}
                onCreateList={createLeadList}
                onUpdateList={updateLeadList}
                onDeleteList={deleteLeadList}
                onImportList={importLeadListMembers}
                onOpenLead={setSelectedLeadId}
                onOpenMessages={handleOpenMessages}
              />
            </div>
          ) : null}

          {view === "lead-settings" && allowLeadSettings ? (
            <div className="perf-section">
              <LeadSettingsView
                customizations={customizations}
                ownerOptions={assignableOwners}
                saving={customizationsSaving}
                error={customizationsError}
                success={customizationsSuccess}
                onSave={saveLeadCustomizations}
              />
            </div>
          ) : null}

          {view === "tasks" ? (
              <div className="perf-section">
                <TaskList leads={state.leads} tasks={tasksForFilteredLeads} onOpen={setSelectedLeadId} onToggle={toggleTask} canEdit={allowCrmEdits} />
              </div>
            ) : null}

          {view === "admin-users" && allowUserManagement && isPreviewMode() ? (
              <div className="perf-section">
                <PreviewStaticScreen
                  title="Usuários e permissões"
                  description="Gestão de quem acessa o CRM, com papéis (admin, gestor, vendas, visualização) e trilha de auditoria de alterações. Na versão real, você cria, edita e bloqueia usuários da equipe por aqui."
                  items={[
                    { title: "Ana Paula", detail: "Vendas · ativa" },
                    { title: "Bruna Martins", detail: "Vendas · ativa" },
                    { title: "Anderson", detail: "Administrador · ativo" },
                  ]}
                />
              </div>
            ) : view === "admin-users" && allowUserManagement ? (
              <div className="perf-section">
                <AdminUsersView
                  currentUser={currentUser ?? { id: "", name: currentUserName, username: "", role: currentRole, active: true }}
                  crmState={state}
                  onCurrentUserUpdated={(user) => {
                    setCurrentUser(user);
                    setCurrentUserName(user.name);
                  }}
                  onOwnerOptionsUpdated={setAssignableOwners}
                />
              </div>
            ) : null}
          </div>
          </div>
        </section>
      </div>

      {rightRailOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar painel de notificações"
            className="fixed inset-0 z-40 hidden bg-black/30 xl:block"
            onClick={() => setRightRailOpen(false)}
          />
            <RightRail
              notifications={notifications}
              activities={rightRailActivities}
              contacts={rightRailContacts}
              onOpenLead={(leadId) => {
                setSelectedLeadId(leadId);
                setRightRailOpen(false);
              }}
              onMarkRead={markNotificationRead}
              onClose={() => setRightRailOpen(false)}
            />
          </>
        ) : null}


      {(leadDialogOpen || editingLeadId !== null) ? (
        <LeadDialog
          open={leadDialogOpen}
          onOpenChange={setLeadDialogOpen}
          lead={formLead}
          setLead={setFormLead}
          ownerOptions={assignableOwners}
          courseOptions={customizations.courses}
          courseSegments={customizations.courseSegments}
          originOptions={customizations.origins}
          captureMethodOptions={customizations.leadCaptureMethods}
          onSubmit={saveLead}
          error={formError}
          editing={Boolean(editingLeadId)}
          duplicateHints={leadDialogDuplicateHints}
        />
      ) : null}

      {messageToast && view !== "messages" ? (
        <div className="pointer-events-none fixed bottom-5 left-5 z-50 animate-[fade-notification_1.8s_ease-out_forwards]">
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Você tem {messageToast.count} nova{messageToast.count > 1 ? "s" : ""} mensagem{messageToast.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      ) : null}

      {selectedLead ? (
        <LeadSheet
          lead={selectedLead}
          allLeads={state.leads}
          tasks={selectedLeadTasks}
          open={Boolean(selectedLead)}
          onOpenChange={(open) => !open && setSelectedLeadId(null)}
          onEdit={openEditLead}
          onAddTask={addTask}
          taskDraft={taskDraft}
          setTaskDraft={setTaskDraft}
          ownerOptions={assignableOwners}
          historyDraft={historyDraft}
          setHistoryDraft={setHistoryDraft}
          onAddHistory={addHistory}
          onToggleTask={toggleTask}
          onOpenMessages={handleOpenMessages}
          onOpenLead={setSelectedLeadId}
          leadLists={state.leadLists}
          onAddToLeadList={addLeadToList}
          onCreateLeadList={createLeadList}
          onDeleteLead={deleteLead}
          deleteLoading={leadDeleteLoading}
          deleteError={leadDeleteError}
          canEdit={allowCrmEdits}
        />
      ) : null}


    </main>
  );
}

function csvCell(value: string) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ?JSON.parse(text) : {};

  if (!response.ok) {
    throw new HttpError((data && data.error) || "Não foi possível completar a solicitação.", response.status);
  }

  return data as T;
}

function DashboardContainer({
  period,
  setPeriod,
  leads,
  tasks,
  overdueLeads,
  pendingTasks,
}: {
  period: Period;
  setPeriod: (period: Period) => void;
  leads: Lead[];
  tasks: Task[];
  overdueLeads: number;
  pendingTasks: Task[];
}) {
  const periodLeads = React.useMemo(
    () => leads.filter((lead) => withinPeriod(lead.data_entrada, period)),
    [leads, period]
  );
  const confirmedEnrollments = React.useMemo(
    () => periodLeads.filter((lead) => ["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)),
    [periodLeads]
  );
  const conversion = periodLeads.length ? Math.round((confirmedEnrollments.length / periodLeads.length) * 100) : 0;
  const trendData = React.useMemo(() => buildTrend(periodLeads, tasks, period), [period, periodLeads, tasks]);
  const courseData = React.useMemo(() => toChartData(groupCount(periodLeads, "curso_de_interesse")), [periodLeads]);
  const originData = React.useMemo(
    () =>
      toChartData(
        periodLeads.reduce<Record<string, number>>((acc, lead) => {
          const key = getLeadTrackedOriginLabel(lead);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ),
    [periodLeads]
  );
  const periodTasks = React.useMemo(
    () => tasks.filter((task) => withinPeriod(task.dueDate, period)),
    [period, tasks]
  );
  const taskOwnerData = React.useMemo(
    () => toChartData(groupCount(periodTasks.filter((task) => !task.done), "owner")),
    [periodTasks]
  );

  return (
    <Dashboard
      period={period}
      setPeriod={setPeriod}
      periodLeads={periodLeads}
      newLeads={periodLeads.filter((lead) => lead.status_funil === "Novo Lead").length}
      waiting={periodLeads.filter((lead) => lead.status_funil === "Aguardando Retorno").length}
      overdue={overdueLeads}
      confirmed={confirmedEnrollments.length}
      conversion={conversion}
      trendData={trendData}
      courseData={courseData}
      originData={originData}
      taskOwnerData={taskOwnerData}
      pendingTasks={pendingTasks.length}
      pendingTaskItems={pendingTasks}
      allLeads={leads}
    />
  );
}
