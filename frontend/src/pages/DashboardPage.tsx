import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import { useServerStatus } from '../hooks/useServerStatus';
import { ThemeToggle } from '../components/ThemeToggle';
import { dashboardService, DashboardData } from '../modules/dashboard/dashboard-service';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'hace un momento';
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'hace unos segundos';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'hace 1 día';
    if (days < 7) return `hace ${days} días`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    const months = Math.floor(days / 30);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  } catch {
    return 'recientemente';
  }
}

const AVATAR_COLORS = [
  'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400',
  'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-400',
  'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400',
  'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400',
  'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
  'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { health, connected } = useServerStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getDashboard(signal);
      setDashboardData(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Error al cargar el resumen del dashboard');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const roleName = user.role.name;
  const isAdmin = roleName === 'ADMINISTRADOR';
  const isHost = roleName === 'ANFITRION';

  const openAction = (name: string, route?: string) => {
    if (route) {
      navigate(route);
    } else {
      setInfoModal(`La acción "${name}" está disponible en el entorno de trabajo del proyecto.`);
    }
  };

  const displayName = dashboardData?.user.name || user.name || 'Usuario';
  const stats = dashboardData?.stats ?? { projects: 0, classes: 0, users: 0, pendingInvitations: 0 };
  const recentProjects = dashboardData?.recentProjects ?? [];
  const recentActivity = dashboardData?.recentActivity ?? [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#080D24] font-sans antialiased select-none text-slate-800 dark:text-slate-100 transition-colors">
      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0E1535] p-6 shadow-2xl text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Módulo ARQNOVA CASE</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{infoModal}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR IZQUIERDO FIJO (~260px) */}
      {/* ========================================================================= */}
      <aside className="w-[260px] h-full shrink-0 bg-gradient-to-b from-[#111936] via-[#161D42] to-[#202060] p-5 flex flex-col justify-between text-white shadow-xl relative z-30 border-r border-white/10 overflow-y-auto">
        
        {/* Top: Brand Logo */}
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-white/10">
            {/* 3D Isometric Logo Icon */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 p-[1.5px] shadow-lg shadow-indigo-500/30">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0C122C]">
                <svg className="h-6 w-6 text-indigo-300" viewBox="0 0 32 32" fill="none">
                  <path d="M16 26L6 20.5L16 15L26 20.5L16 26Z" fill="#6366F1" opacity="0.6" />
                  <path d="M16 20L6 14.5L16 9L26 14.5L16 20Z" fill="#818CF8" opacity="0.85" />
                  <path d="M16 14L6 8.5L16 3L26 8.5L16 14Z" fill="#C084FC" />
                </svg>
              </div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-wider text-white">ARQNOVA</span>
              <p className="text-[9px] font-bold tracking-[0.25em] text-indigo-300/80 uppercase">
                PLATAFORMA CASE
              </p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="mt-6 space-y-1.5 font-medium text-sm">
            {/* 1. Dashboard (Active) */}
            <NavLink
              to="/dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive || activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20'
                    : 'text-indigo-200/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Dashboard</span>
            </NavLink>

            {/* 2. Proyectos */}
            <NavLink
              to={isHost || isAdmin ? '/projects' : '/shared-projects'}
              className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span>Proyectos</span>
            </NavLink>

            {/* 3. Usuarios / Gestión de usuarios (Admin) */}
            {isAdmin ? (
              <NavLink
                to="/admin/users"
                className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                <span>Gestión de usuarios</span>
              </NavLink>
            ) : (
              <button
                type="button"
                onClick={() => setInfoModal('La administración de usuarios requiere permisos de ADMINISTRADOR.')}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Usuarios</span>
              </button>
            )}

            {/* 4. Invitaciones */}
            <button
              type="button"
              onClick={() => openAction('Invitaciones')}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>Invitaciones</span>
            </button>

            {/* 5. Generar con IA */}
            <NavLink
              to="/generate-with-ai"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20'
                    : 'text-indigo-200/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5 shrink-0 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-white">Generar con IA</span>
                  <span className="rounded bg-indigo-400/30 px-1.5 py-0.2 text-[8px] font-extrabold text-cyan-300 uppercase">Nuevo</span>
                </div>
                <span className="text-[9px] text-indigo-300/80 font-medium">Desde texto, voz o imagen</span>
              </div>
            </NavLink>

            {/* 6. Generador Frontend */}
            <NavLink
              to="/frontend-generator"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20'
                    : 'text-indigo-200/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5 shrink-0 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-xs text-white">Generador Frontend</span>
                <span className="text-[9px] text-indigo-300/80 font-medium">Generación React</span>
              </div>
            </NavLink>

            {/* 7. Documentación */}
            <button
              type="button"
              onClick={() => openAction('Documentación')}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              <span>Documentación</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: Promo Glass Card + User Branding */}
        <div className="space-y-4 pt-4">
          <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-4 shadow-lg backdrop-blur-md overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-25 pointer-events-none">
              <svg className="h-24 w-24 text-indigo-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="50,10 85,30 50,50 15,30" />
                <polygon points="50,50 85,70 50,90 15,70" />
                <line x1="50" y1="50" x2="50" y2="90" />
                <line x1="85" y1="30" x2="85" y2="70" />
                <line x1="15" y1="30" x2="15" y2="70" />
              </svg>
            </div>

            <p className="text-xs font-bold text-white leading-snug">
              De tus diagramas <br />
              <span className="text-indigo-200">a soluciones reales</span>
            </p>
            <p className="mt-1 text-[10px] font-medium text-indigo-300/80">
              UML · Colaboración · IA
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] font-mono text-indigo-300/60 uppercase">CASE v2.4</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* User Brand / Session Footer */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 font-bold text-white text-sm shadow-md shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-indigo-300/70 truncate">Ingeniería de Software</p>
                </div>
              </div>
            </div>
            {/* Session details */}
            <div className="mt-2 text-[10px] text-indigo-200/70 flex flex-col gap-0.5 px-0.5">
              <span>Email: {user.email}</span>
              <span>Rol: {roleName}</span>
            </div>
            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-2 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-200 transition cursor-pointer"
            >
              <span>Cerrar sesión</span>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL DE CONTENIDO */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC] dark:bg-[#070B1E] transition-colors">
        
        {/* ========================================================================= */}
        {/* BARRA SUPERIOR (HEADER) */}
        {/* ========================================================================= */}
        <header className="h-16 shrink-0 bg-white dark:bg-[#0E1535] border-b border-slate-200/80 dark:border-slate-800 px-6 sm:px-8 flex items-center justify-between z-20 transition-colors">
          {/* Buscador */}
          <div className="relative w-full max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proyectos, clases, diagramas..."
              className="w-full rounded-xl bg-slate-100/80 dark:bg-[#131B3E] py-2 pl-9 pr-16 text-xs sm:text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 border border-transparent dark:border-slate-700/60 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
              <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-2xs">
                Ctrl + K
              </kbd>
            </div>
          </div>

          {/* Acciones de usuario, tema y notificaciones */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Global Theme Toggle */}
            <ThemeToggle />

            {/* Bell Notification */}
            <button
              type="button"
              onClick={() => setInfoModal(stats.pendingInvitations > 0 ? `Tienes ${stats.pendingInvitations} invitación(es) pendiente(s).` : 'No tienes notificaciones pendientes.')}
              className="relative rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#131B3E] hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {stats.pendingInvitations > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0E1535]"></span>
              )}
            </button>

            {/* Profile Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-[#131B3E] transition cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white font-bold text-sm shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{displayName}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-indigo-300/70 mt-0.5 uppercase tracking-wider">
                    {isAdmin ? 'ADMIN' : roleName}
                  </p>
                </div>
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#0E1535] p-3 shadow-2xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-fade-in z-50">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{displayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Email: {user.email}</p>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">Rol: {roleName}</p>
                  </div>
                  <div className="space-y-1">
                    {isAdmin && (
                      <NavLink
                        to="/admin/users"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#131B3E]"
                      >
                        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/></svg>
                        <span>Gestión de usuarios</span>
                      </NavLink>
                    )}
                    <NavLink
                      to={isHost || isAdmin ? '/projects' : '/shared-projects'}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#131B3E]"
                    >
                      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                      <span>Proyectos</span>
                    </NavLink>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer text-left"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* CONTENIDO DEL DASHBOARD */}
        {/* ========================================================================= */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* HEADER ROW: BIENVENIDA + BANNER SUPERIOR DERECHO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Welcome Greeting (6 cols) */}
            <div className="lg:col-span-6 xl:col-span-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Dashboard
                </h1>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">·</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-400">¡Buenos días!</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Bienvenido,{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {displayName}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Aquí tienes un resumen actualizado de tu plataforma ARQNOVA.
              </p>
            </div>

            {/* Banner Superior Derecho (Tarjeta con Cita & Arte Isométrico) */}
            <div className="lg:col-span-6 xl:col-span-6 relative rounded-2xl bg-gradient-to-r from-[#EFF6FF] via-[#EEF2FF] to-[#E0E7FF]/70 dark:from-[#111A3A] dark:via-[#16204A] dark:to-[#1C1844] p-5 sm:p-6 shadow-sm border border-blue-200/60 dark:border-indigo-500/30 overflow-hidden flex items-center justify-between min-h-[110px]">
              <div className="relative z-10 space-y-1.5 max-w-[240px] sm:max-w-[270px]">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug tracking-tight">
                  “La mejor arquitectura nace<br />de una buena idea.”
                </p>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-indigo-300/70 tracking-wide">
                  — ARQNOVA
                </p>
              </div>

              {/* 3D Isometric UML Artwork */}
              <div className="absolute right-0 top-0 bottom-0 w-[240px] sm:w-[280px] pointer-events-none flex items-center justify-end pr-2 overflow-hidden">
                <svg
                  className="w-full h-full max-h-[120px] object-contain opacity-95"
                  viewBox="0 0 280 130"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="mainCardGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>
                    <linearGradient id="sideCardGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E40AF" />
                      <stop offset="100%" stopColor="#172554" />
                    </linearGradient>
                    <linearGradient id="smallCardGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    <linearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  <g stroke="url(#gridGrad)" strokeWidth="1" strokeDasharray="3 3">
                    <line x1="30" y1="110" x2="250" y2="30" />
                    <line x1="50" y1="120" x2="270" y2="40" />
                    <line x1="70" y1="130" x2="290" y2="50" />
                    <line x1="80" y1="20" x2="240" y2="115" />
                    <line x1="120" y1="15" x2="280" y2="110" />
                  </g>

                  <polygon points="70,30 180,10 180,85 70,105" fill="url(#mainCardGrad)" stroke="#93C5FD" strokeWidth="1.2" />
                  <polygon points="180,10 188,14 188,89 180,85" fill="url(#sideCardGrad)" stroke="#60A5FA" strokeWidth="0.8" />
                  <polygon points="70,105 180,85 188,89 78,109" fill="#1E3A8A" />

                  <polygon points="76,36 174,18 174,28 76,46" fill="#60A5FA" opacity="0.5" />
                  <polygon points="80,40 115,33 115,41 80,48" fill="#DBEAFE" opacity="0.8" />
                  <polygon points="80,53 130,44 130,75 80,84" fill="#1E40AF" opacity="0.6" stroke="#93C5FD" strokeWidth="0.7" />
                  <line x1="84" y1="62" x2="126" y2="54" stroke="#BFDBFE" strokeWidth="1.2" />
                  <line x1="84" y1="68" x2="115" y2="62" stroke="#93C5FD" strokeWidth="1" />
                  <line x1="84" y1="74" x2="120" y2="67" stroke="#93C5FD" strokeWidth="1" />

                  <polygon points="136,43 174,36 174,68 136,75" fill="#1E40AF" opacity="0.6" stroke="#93C5FD" strokeWidth="0.7" />
                  <line x1="140" y1="51" x2="170" y2="45" stroke="#BFDBFE" strokeWidth="1.2" />
                  <line x1="140" y1="57" x2="162" y2="53" stroke="#93C5FD" strokeWidth="1" />
                  <line x1="140" y1="63" x2="168" y2="58" stroke="#93C5FD" strokeWidth="1" />

                  <polygon points="200,55 240,45 240,85 200,95" fill="url(#smallCardGrad)" stroke="#BFDBFE" strokeWidth="1" />
                  <polygon points="240,45 246,48 246,88 240,85" fill="#1E40AF" stroke="#93C5FD" strokeWidth="0.7" />
                  <polygon points="200,95 240,85 246,88 206,98" fill="#1E3A8A" />

                  <line x1="206" y1="65" x2="234" y2="58" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
                  <line x1="206" y1="72" x2="228" y2="66" stroke="#DBEAFE" strokeWidth="1" opacity="0.8" />
                  <line x1="206" y1="79" x2="232" y2="73" stroke="#DBEAFE" strokeWidth="1" opacity="0.8" />

                  <circle cx="180" cy="50" r="2.5" fill="#38BDF8" filter="drop-shadow(0 0 3px #38BDF8)" />
                  <circle cx="200" cy="65" r="2" fill="#38BDF8" filter="drop-shadow(0 0 3px #38BDF8)" />
                  <line x1="180" y1="50" x2="200" y2="65" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                </svg>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN GENERAR CON IA (NUEVO DIAGRAMA DESDE CERO) */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-gradient-to-r from-[#111936] via-[#1E1B4B] to-[#311042] p-5 sm:p-6 text-white shadow-lg border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="relative z-10 space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gradient-to-r from-blue-500 to-indigo-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  IA Generativa UML
                </span>
                <span className="text-[11px] font-semibold text-indigo-200">Desde cero</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Generar con IA
              </h3>
              <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed font-medium">
                Crea diagramas UML desde texto, voz o imágenes utilizando inteligencia artificial.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => navigate('/generate-with-ai?mode=text')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition cursor-pointer shadow-sm"
              >
                <svg className="h-4 w-4 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>Texto</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/generate-with-ai?mode=voice')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 px-4 py-2.5 text-xs font-bold text-purple-200 backdrop-blur-sm transition cursor-pointer shadow-sm"
              >
                <svg className="h-4 w-4 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                <span>Voz</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/generate-with-ai?mode=image')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 px-4 py-2.5 text-xs font-bold text-cyan-200 backdrop-blur-sm transition cursor-pointer shadow-sm"
              >
                <svg className="h-4 w-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                </svg>
                <span>Imagen</span>
              </button>
            </div>
          </div>

          {/* Error Banner if Dashboard Fetch Fails */}
          {error && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="px-3 py-1 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TARJETAS KPI (4 TARJETAS CON DATOS REALES) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* KPI 1: Proyectos */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                {isLoading && !dashboardData ? (
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{stats.projects}</p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Proyectos</p>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                  {stats.projects === 1 ? '1 accesible' : `${stats.projects} accesibles`}
                </span>
              </div>
            </div>

            {/* KPI 2: Clases UML */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div className="min-w-0">
                {isLoading && !dashboardData ? (
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{stats.classes}</p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Clases UML</p>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                  En diagramas activos
                </span>
              </div>
            </div>

            {/* KPI 3: Usuarios / Colaboradores */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <div className="min-w-0">
                {isLoading && !dashboardData ? (
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{stats.users}</p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Colaboradores</p>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                  En tus proyectos
                </span>
              </div>
            </div>

            {/* KPI 4: Invitaciones */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <div className="min-w-0">
                {isLoading && !dashboardData ? (
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{stats.pendingInvitations}</p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Invitaciones</p>
                <span className={`text-[10px] font-semibold mt-0.5 block truncate ${stats.pendingInvitations > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {stats.pendingInvitations > 0 ? `${stats.pendingInvitations} pendiente${stats.pendingInvitations === 1 ? '' : 's'}` : 'Al día'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN PROYECTOS RECIENTES + ESTADO DEL SISTEMA (GRID 2 COLUMNAS) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* PROYECTOS RECIENTES (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0E1535] p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Mis proyectos recientes</h3>
                <NavLink
                  to={isHost || isAdmin ? '/projects' : '/shared-projects'}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition flex items-center gap-1"
                >
                  <span>Ver todos</span>
                  <span>→</span>
                </NavLink>
              </div>

              {/* Contenido de Proyectos */}
              {isLoading && !dashboardData ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        </div>
                      </div>
                      <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/30 space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                    No tienes proyectos todavía.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Comienza creando un proyecto o genera tu primer diagrama UML con IA desde cero.
                  </p>
                  {(isHost || isAdmin) && (
                    <NavLink
                      to="/projects"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Crear mi primer proyecto</span>
                    </NavLink>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}/editor`)}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50/80 dark:hover:bg-[#131B3E] border border-slate-100 dark:border-slate-800/80 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {project.name}
                            </h4>
                            {!project.isOwner && (
                              <span className="rounded bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                Compartido
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            Actualizado {formatRelativeTime(project.updatedAt)} {project.isOwner ? '' : `· por ${project.ownerName}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-block rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {project.classesCount} {project.classesCount === 1 ? 'clase' : 'clases'}
                        </span>
                        <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {project.membersCount} {project.membersCount === 1 ? 'participante' : 'participantes'}
                        </span>
                        <div className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 p-1">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ESTADO DEL SISTEMA (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0E1535] p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between" aria-live="polite">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Estado del sistema</h3>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>En línea</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 font-medium text-xs sm:text-sm">
                  {/* Item 1: Backend (NestJS) */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Backend (NestJS)</span>
                        <span className="text-[10px] text-slate-400">Estado: {health}</span>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Operativo</span>
                  </div>

                  {/* Item 2: Base de datos (PostgreSQL) */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Base de datos (PostgreSQL)</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {dashboardData?.systemStatus.database ?? 'Operativo'}
                    </span>
                  </div>

                  {/* Item 3: Realtime (Socket.IO) */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Realtime (Socket.IO)</span>
                        <span className="text-[10px] text-slate-400">Servidor: {connected ? 'conectado' : 'en espera'}</span>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Operativo</span>
                  </div>

                  {/* Item 4: Servicio de IA */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-pink-600 dark:text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Servicio de IA</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Operativo</span>
                  </div>

                  {/* Item 5: Generador de código (Maven) */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Generador de código (Maven)</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Operativo</span>
                  </div>
                </div>
              </div>

              {/* Bottom status tagline */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-400 text-xs">
                <span>Servicios de infraestructura ARQNOVA</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100% disponibles</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ACTIVIDAD RECIENTE + ACCIONES RÁPIDAS (GRID 2 COLUMNAS) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
            
            {/* ACTIVIDAD RECIENTE (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0E1535] p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Actividad reciente</h3>
                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>Actualizar</span>
                </button>
              </div>

              {isLoading && !dashboardData ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-2.5 rounded-xl animate-pulse flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      </div>
                      <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/30 space-y-1.5">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                    No hay actividad reciente.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Las acciones y modificaciones en tus proyectos aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#131B3E] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs ${getAvatarColor(activity.userName)}`}>
                          {activity.userInitials}
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          <strong className="text-slate-900 dark:text-white font-semibold">{activity.userName}</strong>{' '}
                          {activity.description}{' '}
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activity.projectName}</span>
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-3">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACCIONES RÁPIDAS (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white px-1">Acciones rápidas</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Nuevo proyecto */}
                <button
                  type="button"
                  onClick={() => openAction('Nuevo proyecto', isHost || isAdmin ? '/projects' : undefined)}
                  className="p-4 rounded-2xl bg-[#EEF2FF] dark:bg-[#131B3E] border border-[#E0E7FF] dark:border-slate-800 hover:bg-[#E0E7FF]/80 dark:hover:bg-[#182352] transition text-left space-y-2 cursor-pointer shadow-xs group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm group-hover:scale-105 transition">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200">Nuevo proyecto</h4>
                    <p className="text-[10px] sm:text-[11px] text-indigo-600/80 dark:text-indigo-400 font-medium">Crea un diagrama UML</p>
                  </div>
                </button>

                {/* 2. Importar XMI */}
                <button
                  type="button"
                  onClick={() => openAction('Importar XMI')}
                  className="p-4 rounded-2xl bg-[#F0F9FF] dark:bg-[#131B3E] border border-[#E0F2FE] dark:border-slate-800 hover:bg-[#E0F2FE]/80 dark:hover:bg-[#182352] transition text-left space-y-2 cursor-pointer shadow-xs group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm group-hover:scale-105 transition">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200">Importar XMI</h4>
                    <p className="text-[10px] sm:text-[11px] text-sky-600/80 dark:text-sky-400 font-medium">Desde archivo externo</p>
                  </div>
                </button>

                {/* 3. Generar Backend */}
                <button
                  type="button"
                  onClick={() => openAction('Generar Backend')}
                  className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-[#131B3E] border border-[#D1FAE5] dark:border-slate-800 hover:bg-[#D1FAE5]/80 dark:hover:bg-[#182352] transition text-left space-y-2 cursor-pointer shadow-xs group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:scale-105 transition">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">Generar Backend</h4>
                    <p className="text-[10px] sm:text-[11px] text-emerald-600/80 dark:text-emerald-400 font-medium">Spring Boot + Maven</p>
                  </div>
                </button>

                {/* 4. Asistente IA */}
                <button
                  type="button"
                  onClick={() => navigate('/generate-with-ai')}
                  className="p-4 rounded-2xl bg-[#FDF2F8] dark:bg-[#131B3E] border border-[#FCE7F3] dark:border-slate-800 hover:bg-[#FCE7F3]/80 dark:hover:bg-[#182352] transition text-left space-y-2 cursor-pointer shadow-xs group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-600 text-white shadow-sm group-hover:scale-105 transition">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-pink-950 dark:text-pink-200">Asistente IA</h4>
                    <p className="text-[10px] sm:text-[11px] text-pink-600/80 dark:text-pink-400 font-medium">Genera desde cero</p>
                  </div>
                </button>
              </div>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
