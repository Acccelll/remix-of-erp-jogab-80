import { Suspense, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, KeyRound, ChevronDown, Eye, X } from "lucide-react";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useUI } from "@/contexts/ui/useUI";
import NotificationBell from "./layout/NotificationBell";
import { EmpresaSelector } from "./empresa/EmpresaSelector";
import CommandPalette from "./layout/CommandPalette";
import Breadcrumbs from "./layout/Breadcrumbs";
import ErrorBoundary from "./common/ErrorBoundary";
import ThemeToggle from "./layout/ThemeToggle";
import { Button } from "./ui/button";
import ChangePasswordDialog from "./common/ChangePasswordDialog";
import { SyncStatusBanner } from "./layout/SyncStatusBanner";
import { InstallPrompt } from "./layout/InstallPrompt";
import { PlanifikStatusBanner } from "./layout/PlanifikStatusBanner";
import { useSolicitacaoStatusWatcher } from "@/hooks/financeiro/useSolicitacaoStatusWatcher";
import { useAplicarInativacoesServidor } from "@/hooks/rh/useAplicarInativacoesServidor";


import { NAV_REGISTRY } from "@/config/navigation";
import { swallow } from "@/lib/core/errors";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

const STORAGE_KEY = STORAGE_KEYS.navOpenGroups;
const RECENT_KEY = STORAGE_KEYS.navRecent;

const Layout = () => {
  const { currentPlayer, logout, previewPlayer, isPreviewing, stopPreview } = useAuth();
  const { can, isGM } = usePermissions();
  const { sidebarOpen, setSidebarOpen } = useUI();
  useSolicitacaoStatusWatcher();
  // Aplica no servidor, uma vez por carga do app, as inativações programadas
  // já vencidas (independe de abrir a tela de RH). Ver hook + rota no api.php.
  useAplicarInativacoesServidor(!!currentPlayer);
  const navigate = useNavigate();
  const location = useLocation();
  const [changePassOpen, setChangePassOpen] = useState(false);

  // Filtra por item (gate fino) e mantém o grupo se sobrar pelo menos um item visível.
  // Gerenciamento é exclusivo de GM (as rotas /gm têm guard `gm` — sem isso o link vira porta fechada).
  const visibleGroups = useMemo(
    () =>
      NAV_REGISTRY.filter((g) => g.id !== "gerenciamento" || isGM)
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (i) => i.alwaysVisible === true || can(i.to, "V"),
          ),
        }))
        .filter((g) => g.items.length > 0),
    [can, isGM],
  );

  // Rotas do menu que são prefixo de outra rota do menu precisam de `end`,
  // senão o NavLink marca pai e filho ao mesmo tempo (ex.: /crm e /crm/vendas).
  const exactMatchRoutes = useMemo(() => {
    const all = visibleGroups.flatMap((g) => g.items.map((i) => i.to));
    return new Set(
      all.filter((to) => to === "/" || all.some((other) => other !== to && other.startsWith(to + "/"))),
    );
  }, [visibleGroups]);

  const activeGroupId = useMemo(() => {
    const path = location.pathname;
    const match = visibleGroups.find((g) =>
      g.items.some((i) =>
        i.to === "/" ? path === "/" : path === i.to || path.startsWith(i.to + "/"),
      ),
    );
    return match?.id ?? null;
  }, [location.pathname, visibleGroups]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) { swallow("Layout.openGroups.load", err, "localStorage indisponível"); }
    return {};
  });

  // Auto-open the group that contains the active route (without closing others the user opened).
  useEffect(() => {
    if (activeGroupId && !openGroups[activeGroupId]) {
      setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch (err) { swallow("Layout.openGroups.persist", err, "localStorage indisponível"); }
  }, [openGroups]);

  // Fase 3: rastreia rotas recentes para o Command Palette.
  useEffect(() => {
    const path = location.pathname + location.search;
    if (!path || path === "/login") return;
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      const next = [path, ...list.filter((p) => p !== path)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (err) { swallow("Layout.recentRoutes", err, "localStorage indisponível"); }
  }, [location.pathname, location.search]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !(prev[id] ?? id === activeGroupId) }));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Fase 3: `mini` é o rail de ícones em desktop quando o usuário recolhe.
  // Em mobile (<lg) seguimos com drawer off-canvas baseado em `sidebarOpen`.
  const mini = !sidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        role="navigation"
        aria-label="Navegação principal"
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${mini ? "lg:w-14" : "lg:w-60"} fixed lg:relative z-40 w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 h-full transition-all duration-200`}
      >
        <div className={`border-b border-sidebar-border ${mini ? "lg:p-3" : ""} p-5`}>
          <h1 className="font-display text-lg font-bold text-sidebar-primary">
            <span className={mini ? "lg:hidden" : ""}>Planifik</span>
            <span className={mini ? "hidden lg:inline" : "hidden"}>P</span>
          </h1>
          <p
            className={`text-xs text-sidebar-foreground/60 mt-0.5 truncate ${mini ? "lg:hidden" : ""}`}
          >
            {currentPlayer?.login}
          </p>
        </div>
        <nav
          className={`sidebar-scroll flex-1 overflow-y-auto space-y-1 ${mini ? "lg:p-1.5" : ""} p-3`}
        >
          {visibleGroups.map((group, idx) => {
            const isOpen = openGroups[group.id] ?? group.id === activeGroupId;
            const isActive = group.id === activeGroupId;
            return (
              <div
                key={group.id}
                className={`pt-3 first:pt-0 ${idx > 0 ? "border-t border-sidebar-border mt-3" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 mb-1 group/header ${mini ? "lg:hidden" : ""}`}
                  aria-expanded={isOpen}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={`flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                      isActive
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/40 group-hover/header:text-sidebar-foreground/70"
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-sidebar-primary"
                      />
                    )}
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 text-sidebar-foreground/40 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    isOpen || mini ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  } ${mini ? "lg:grid-rows-[1fr]" : ""}`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={exactMatchRoutes.has(item.to)}
                          title={mini ? item.label : undefined}
                          onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `sidebar-nav-item ${mini ? "lg:justify-center lg:px-2" : ""} ${
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            }`
                          }
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className={mini ? "lg:sr-only" : ""}>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className={`border-t border-sidebar-border space-y-1 ${mini ? "lg:p-1.5" : ""} p-3`}>
          <button
            onClick={() => setChangePassOpen(true)}
            title={mini ? "Alterar Senha" : undefined}
            className={`sidebar-nav-item w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ${mini ? "lg:justify-center lg:px-2" : ""}`}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span className={mini ? "lg:sr-only" : ""}>Alterar Senha</span>
          </button>
          <button
            onClick={handleLogout}
            title={mini ? "Sair" : undefined}
            className={`sidebar-nav-item w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ${mini ? "lg:justify-center lg:px-2" : ""}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={mini ? "lg:sr-only" : ""}>Sair</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        {isPreviewing && (
          <div className="flex items-start sm:items-center justify-between gap-3 px-3 sm:px-5 py-2 bg-amber-500/15 border-b border-amber-500/40 text-amber-900 dark:text-amber-100 shrink-0">
            <div className="flex items-start gap-2 min-w-0">
              <Eye className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="min-w-0 text-sm">
                <div className="font-medium">
                  Visualizando como <strong>{previewPlayer?.login}</strong> — permissões de menu e
                  páginas deste usuário.
                </div>
                <div className="text-xs opacity-80">
                  Prévia apenas de permissões (menu, páginas e botões). O acesso a dados por{" "}
                  <strong>obra</strong> e por <strong>setor</strong> é validado no login real do
                  usuário e pode diferir do que aparece aqui.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-500/50 bg-background/60 hover:bg-background"
              onClick={() => {
                stopPreview();
                navigate("/gm?tab=usuarios");
              }}
            >
              <X className="h-4 w-4 mr-1" /> Sair da visualização
            </Button>
          </div>
        )}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 sm:px-5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2"
            aria-label={sidebarOpen ? "Recolher navegação" : "Expandir navegação"}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <SyncStatusBanner />
            <PlanifikStatusBanner />
            <EmpresaSelector />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
            <Breadcrumbs />
          </div>
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="space-y-3 animate-pulse">
                  <div className="h-7 w-48 bg-muted rounded" />
                  <div className="h-32 w-full bg-muted/60 rounded" />
                  <div className="h-32 w-full bg-muted/40 rounded" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <ChangePasswordDialog open={changePassOpen} onOpenChange={setChangePassOpen} />
      <CommandPalette />
    </div>
  );
};

export default Layout;
