import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import { ProjectForm } from '../modules/projects/ProjectForm';
import {
  projectsService,
  type Project,
  type ProjectInput,
  type ProjectStats,
} from '../modules/projects/projects-service';
import { ApiError } from '../services/http';

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No se pudo completar la operación.';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'hace unos momentos';
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'hace unos minutos';
    if (diffHours === 1) return 'hace 1 hora';
    if (diffHours < 24) return `hace ${diffHours} horas`;
    if (diffDays === 1) return 'hace 1 día';
    if (diffDays < 7) return `hace ${diffDays} días`;
    if (diffDays < 14) return 'hace 1 semana';
    if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
    return 'hace 1 mes';
  } catch {
    return 'Recientemente';
  }
}

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-purple-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-pink-600',
  'bg-amber-600',
  'bg-cyan-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProjectsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<{ project: Project | null } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tagFilter, setTagFilter] = useState('todas');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const actionPending = useRef(false);

  const roleName = user?.role.name ?? '';
  const isAdmin = roleName === 'ADMINISTRADOR';
  const isHost = roleName === 'ANFITRION';

  const loadData = async (signal?: AbortSignal) => {
    try {
      const [list, statsData] = await Promise.all([
        projectsService.list(query, signal),
        projectsService.stats(signal).catch(() => null),
      ]);
      setProjects(list);
      if (statsData) {
        setStats(statsData);
      } else {
        setStats({
          totalProjects: list.length,
          collaborators: 0,
          generatedBackends: 0,
          umlDiagrams: list.reduce((acc, p) => acc + (p.diagrams?.length ?? 1), 0),
        });
      }
    } catch (failure) {
      if (signal?.aborted) return;
      throw failure;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loadData(controller.signal)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const save = async (input: ProjectInput) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (form?.project) {
        await projectsService.update(form.project.id, input);
      } else {
        await projectsService.create(input);
      }
      setForm(null);
      setSuccess(
        form?.project ? 'Proyecto actualizado correctamente.' : 'Proyecto creado correctamente.'
      );
      await loadData();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };

  const remove = async (project: Project) => {
    if (actionPending.current || !window.confirm(`¿Eliminar el proyecto ${project.name}?`)) return;
    actionPending.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await projectsService.remove(project.id);
      setSuccess('Proyecto eliminado correctamente.');
      await loadData();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(search.trim());
  };

  // Filtrado y ordenamiento en cliente
  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        // Filtro de estado
        if (statusFilter === 'activo' && project.deletedAt) return false;
        if (statusFilter === 'archivado' && !project.deletedAt) return false;

        // Filtro de etiquetas
        if (tagFilter !== 'todas') {
          const matchDesc = (project.description ?? '').toLowerCase();
          const matchName = project.name.toLowerCase();
          if (tagFilter === 'uml' && !matchName.includes('uml') && !matchDesc.includes('uml')) {
            // Todos son diagramas UML por defecto en ARQNOVA
          } else if (tagFilter === 'spring_boot' && !matchDesc.includes('spring') && !matchName.includes('spring')) {
            return false;
          } else if (tagFilter === 'nestjs' && !matchDesc.includes('nest') && !matchName.includes('nest')) {
            return false;
          } else if (tagFilter === 'java' && !matchDesc.includes('java') && !matchName.includes('java')) {
            return false;
          } else if (tagFilter === 'postgresql' && !matchDesc.includes('postgres') && !matchName.includes('postgres')) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [projects, statusFilter, tagFilter, sortBy]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProjects.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalProjectsCount = stats?.totalProjects ?? projects.length;
  const totalCollaboratorsCount = stats?.collaborators ?? 0;
  const totalGeneratedBackends = stats?.generatedBackends ?? 0;
  const totalUmlDiagrams = stats?.umlDiagrams ?? (projects.length > 0 ? projects.length : 0);

  const renderSidebarContent = () => (
    <>
      <div>
        <div className="flex items-center gap-3 pb-6 border-b border-white/10">
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

        <nav className="mt-6 space-y-1.5 font-medium text-sm">
          <NavLink
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to={isHost || isAdmin ? '/projects' : '/shared-projects'}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-[12px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20 transition-all duration-200"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <span>Proyectos</span>
          </NavLink>

          {isAdmin ? (
            <NavLink
              to="/admin/users"
              onClick={() => setMobileMenuOpen(false)}
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
              onClick={() => {
                setMobileMenuOpen(false);
                setInfoModal('La administración de usuarios requiere permisos de ADMINISTRADOR.');
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left cursor-pointer"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>Usuarios</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setInfoModal('Módulo de invitaciones disponible desde el Dashboard y Proyectos.');
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left cursor-pointer"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>Invitaciones</span>
          </button>

          <NavLink
            to="/generate-with-ai"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg className="h-5 w-5 shrink-0 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs text-white">Generar con IA</span>
              <span className="text-[9px] text-indigo-300/80 font-medium">Desde texto, voz o imagen</span>
            </div>
          </NavLink>

          <NavLink
            to="/frontend-generator"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
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

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setInfoModal('Documentación CASE: Guía rápida y generación de código Spring Boot.');
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left cursor-pointer"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span>Documentación</span>
          </button>
        </nav>
      </div>

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

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 font-bold text-white text-sm shadow-md shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'ARQNOVA'}</p>
                <p className="text-[10px] text-indigo-300/70 truncate">Ingeniería de Software</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-200 transition cursor-pointer"
          >
            <span>Cerrar sesión</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">ARQNOVA CASE</h3>
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

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[260px] h-full bg-gradient-to-b from-[#111827] via-[#15193B] to-[#1e1b4b] p-5 flex flex-col justify-between text-white shadow-2xl z-50 overflow-y-auto">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex w-[260px] h-full shrink-0 bg-gradient-to-b from-[#111827] via-[#15193B] to-[#1e1b4b] p-5 flex-col justify-between text-white shadow-xl relative z-30 border-r border-white/10 overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL DE CONTENIDO */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC] dark:bg-[#070B1E] transition-colors">
        {/* BARRA SUPERIOR (HEADER 70px) */}
        <header className="h-[70px] shrink-0 bg-white dark:bg-[#0E1535] border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between z-20 transition-colors">
          <div className="flex items-center gap-3 w-full max-w-md">
            {/* Hamburger Button on Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#131B3E] hover:text-slate-800 dark:hover:text-white transition cursor-pointer shrink-0"
              aria-label="Abrir menú"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Buscador */}
            <div className="relative w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setQuery(search.trim());
                  }
                }}
                placeholder="Buscar proyectos, clases, diagramas..."
                className="w-full rounded-xl bg-slate-100/80 dark:bg-[#131B3E] py-2 pl-9 pr-16 text-xs sm:text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 border border-transparent dark:border-slate-700/60 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none hidden sm:flex">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-2xs">
                  Ctrl + K
                </kbd>
              </div>
            </div>
          </div>

          {/* Acciones de usuario y notificaciones */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setInfoModal('No tienes notificaciones pendientes.')}
              className="relative rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#131B3E] hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0E1535]"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-[#131B3E] transition cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white font-bold text-sm shadow-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{user?.name || 'Administrador'}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-indigo-300/70 mt-0.5 uppercase tracking-wider">
                    {isAdmin ? 'ADMIN' : roleName}
                  </p>
                </div>
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#0E1535] p-3 shadow-2xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-fade-in z-50">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{roleName}</p>
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer text-left"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* HEADER ROW: Breadcrumb, Title & Top Action Card */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <nav className="text-xs font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                <span>Proyectos</span>
                <span>&gt;</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Lista</span>
              </nav>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Proyectos UML
                </h1>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                  CASE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                Gestiona todos tus diagramas UML, colabora con tu equipo y genera código.
              </p>
            </div>

            {/* Right Side: Mini Idea Card + Create Project Button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden xl:flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-[#111A3A] dark:to-[#16204A] border border-blue-100/80 dark:border-indigo-500/30 px-4 py-2.5 shadow-2xs">
                <div className="flex -space-x-2">
                  <div className="h-8 w-6 rounded bg-blue-400/80 shadow-xs border border-white dark:border-slate-800 transform -rotate-6"></div>
                  <div className="h-8 w-6 rounded bg-indigo-500 shadow-xs border border-white dark:border-slate-800 transform rotate-3"></div>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white">Ideas</span>
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">→</span>
                  </div>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Diagramas · Código real</p>
                </div>
              </div>

              {/* + Nuevo proyecto Button */}
              <button
                type="button"
                aria-label="Crear proyecto"
                disabled={busy || loading}
                onClick={() => {
                  setForm({ project: null });
                  setError(null);
                  setSuccess(null);
                }}
                className="flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 hover:shadow-indigo-600/40 active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>+ Nuevo proyecto</span>
              </button>
            </div>
          </div>

          {/* TARJETAS DE ESTADÍSTICAS REALES (4 CARDS) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Proyectos totales */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {totalProjectsCount}
                  </p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Proyectos totales</p>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                  {totalProjectsCount === 1 ? '1 accesible' : `${totalProjectsCount} accesibles`}
                </span>
              </div>
            </div>

            {/* Card 2: Colaboradores */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {totalCollaboratorsCount}
                  </p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Colaboradores</p>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                  En tus proyectos
                </span>
              </div>
            </div>

            {/* Card 3: Backends generados */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {totalGeneratedBackends}
                  </p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Backends generados</p>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                  Spring Boot
                </span>
              </div>
            </div>

            {/* Card 4: Diagramas UML */}
            <div className="rounded-2xl bg-white dark:bg-[#0E1535] p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {totalUmlDiagrams}
                  </p>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Diagramas UML</p>
                <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 mt-0.5 block truncate">
                  Modelos activos
                </span>
              </div>
            </div>
          </div>

          {/* NOTIFICACIONES Y ALERTAS */}
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-xs font-medium text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/60 flex items-center gap-2">
              <svg className="h-4 w-4 text-red-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* PROJECT FORM MODAL */}
          {form && (
            <ProjectForm
              key={form.project?.id ?? 'new'}
              project={form.project}
              busy={busy}
              onSave={save}
              onCancel={() => setForm(null)}
            />
          )}

          {/* TABLA / CUADRÍCULA DE PROYECTOS */}
          <div className="rounded-2xl bg-white dark:bg-[#0E1535] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Top Toolbar & Filters */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Search input */}
              <form onSubmit={submitSearch} className="relative w-full md:w-72">
                <label className="sr-only" htmlFor="project-search">Buscar proyectos</label>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  id="project-search"
                  type="text"
                  maxLength={120}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proyectos..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#131B3E] py-2 pl-9 pr-4 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 border border-slate-200 dark:border-slate-700/60 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition"
                />
              </form>

              {/* Right: Select filters, View switches, Export */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="archivado">Archivado</option>
                </select>

                {/* Tags filter */}
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                >
                  <option value="todas">Todas las etiquetas</option>
                  <option value="uml">UML</option>
                  <option value="spring_boot">Spring Boot</option>
                  <option value="nestjs">NestJS</option>
                  <option value="java">Java</option>
                  <option value="postgresql">PostgreSQL</option>
                </select>

                {/* Sort filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                >
                  <option value="recent">Última edición</option>
                  <option value="name">Nombre A-Z</option>
                </select>

                {/* View toggles */}
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#131B3E]">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Export button */}
                <button
                  type="button"
                  onClick={() => setInfoModal('Función de exportación de proyectos en formato XMI / JSON disponible.')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] transition cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Exportar</span>
                </button>
              </div>
            </div>

            {/* Table / Grid or Empty state */}
            {loading ? (
              <div role="status" className="p-12 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
                Cargando proyectos…
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 mx-auto mb-3">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">No hay proyectos para mostrar.</p>
                <p className="text-xs text-slate-400 mt-1">Crea tu primer proyecto para comenzar a modelar tus diagramas CASE.</p>
                <button
                  type="button"
                  onClick={() => setForm({ project: null })}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Crear tu primer proyecto</span>
                </button>
              </div>
            ) : viewMode === 'list' ? (
              /* LIST (TABLE) VIEW */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 pl-5 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredProjects.length && filteredProjects.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-3">Nombre del proyecto</th>
                      <th className="py-3.5 px-3">Descripción</th>
                      <th className="py-3.5 px-3">Etiquetas</th>
                      <th className="py-3.5 px-3">Colaboradores</th>
                      <th className="py-3.5 px-3">Última edición</th>
                      <th className="py-3.5 px-3">Estado</th>
                      <th className="py-3.5 pr-5 pl-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {filteredProjects.map((project) => {
                      const isSelected = selectedIds.includes(project.id);
                      const isOwner = project.ownerId === user?.id;
                      const classesCount = project.diagrams?.[0]?._count?.classes ?? 0;
                      const membersList = project.members ?? [];
                      const allPeople = [
                        { name: project.owner.name, isOwner: true },
                        ...membersList.map((m) => ({ name: m.user.name, isOwner: false })),
                      ];

                      return (
                        <tr
                          key={project.id}
                          role="listitem"
                          className={`hover:bg-slate-50/80 dark:hover:bg-[#131B3E]/80 transition ${
                            isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(project.id)}
                              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>

                          {/* Nombre del proyecto */}
                          <td className="py-3.5 px-3 min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to={`/projects/${project.id}/editor`}
                                    className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate"
                                  >
                                    {project.name}
                                  </Link>
                                  {!isOwner && (
                                    <span className="rounded bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                      Compartido
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                                  {isOwner ? 'Propietario' : `Anfitrión: ${project.owner.name}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Descripción */}
                          <td className="py-3.5 px-3 max-w-xs truncate text-slate-500 dark:text-slate-400">
                            {project.description || 'Sin descripción.'}
                          </td>

                          {/* Etiquetas */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                UML
                              </span>
                              <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                {classesCount} {classesCount === 1 ? 'clase' : 'clases'}
                              </span>
                            </div>
                          </td>

                          {/* Colaboradores */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="flex items-center -space-x-1.5">
                              {allPeople.slice(0, 3).map((person, idx) => (
                                <div
                                  key={idx}
                                  title={`${person.name}${person.isOwner ? ' (Anfitrión)' : ''}`}
                                  className={`flex h-6 w-6 items-center justify-center rounded-full ${getAvatarColor(
                                    person.name
                                  )} text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0E1535] shadow-2xs`}
                                >
                                  {person.name.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {allPeople.length > 3 && (
                                <div
                                  title={`${allPeople.length - 3} más`}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-700 dark:text-slate-200 ring-2 ring-white dark:ring-[#0E1535]"
                                >
                                  +{allPeople.length - 3}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Última edición */}
                          <td className="py-3.5 px-3 whitespace-nowrap text-slate-400 dark:text-slate-400 text-[11px]">
                            {formatRelativeTime(project.updatedAt)}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              <span>Activo</span>
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/projects/${project.id}/editor`}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition"
                              >
                                Abrir editor
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setForm({ project });
                                  setError(null);
                                  setSuccess(null);
                                }}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                              >
                                Editar
                              </button>
                              {isOwner && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void remove(project)}
                                  className="rounded-lg border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* GRID VIEW */
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => {
                  const isOwner = project.ownerId === user?.id;
                  const classesCount = project.diagrams?.[0]?._count?.classes ?? 0;
                  const membersCount = (project.members?.length ?? 0) + 1;

                  return (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-[#131B3E]/50 p-5 hover:bg-slate-50 dark:hover:bg-[#131B3E] transition flex flex-col justify-between space-y-4 group shadow-2xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                            </svg>
                          </div>
                          <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {classesCount} clases
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {project.name}
                            </h3>
                            {!isOwner && (
                              <span className="rounded bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                                Compartido
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {project.description || 'Sin descripción.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(project.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/projects/${project.id}/editor`}
                            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition"
                          >
                            Abrir
                          </Link>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => void remove(project)}
                              className="rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1.5 text-xs transition"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-[#0E1535]">
              <p>
                Mostrando {filteredProjects.length > 0 ? `1 a ${filteredProjects.length}` : '0'} de {filteredProjects.length} proyectos
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#182352] transition cursor-pointer"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs"
                >
                  1
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#182352] transition cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
