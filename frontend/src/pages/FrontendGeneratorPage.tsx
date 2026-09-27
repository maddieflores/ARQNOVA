import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthProvider'
import { frontendGeneratorService } from '../modules/frontend-generator/frontend-generator-service'
import { projectsService, type Project } from '../modules/projects/projects-service'
import { ApiError } from '../services/http'

const WEB_FRAMEWORKS = [
  { id: 'React + Vite', name: 'React + Vite', icon: '⚛️', desc: 'React 18+, Vite, Hooks & TypeScript' },
  { id: 'Angular', name: 'Angular', icon: '🅰️', desc: 'Angular 17+, Standalone & Signals' },
  { id: 'Vue', name: 'Vue', icon: '🟢', desc: 'Vue 3, Composition API & Pinia' },
]

const WEB_STYLINGS = [
  { id: 'Tailwind CSS', name: 'Tailwind CSS', icon: '🎨', desc: 'Clases utilitarias modernas y responsivas' },
  { id: 'Material UI', name: 'Material UI', icon: '💠', desc: 'Componentes listos para producción y temas' },
]

const MOBILE_FRAMEWORKS = [
  { id: 'Flutter + Dart', name: 'Flutter + Dart', icon: '💙', desc: 'Framework nativo multiplataforma de Google' },
  { id: 'React Native', name: 'React Native', icon: '⚛️', desc: 'Aplicaciones nativas con React & TypeScript' },
]

const MOBILE_ARCHITECTURES = [
  { id: 'Clean Architecture', name: 'Clean Architecture', icon: '🏛️', desc: 'Capas Domain, Data y Presentation' },
  { id: 'MVVM', name: 'MVVM', icon: '📐', desc: 'Model - View - ViewModel desacoplado' },
]

const MOBILE_STATE_MANAGEMENT = [
  { id: 'Provider', name: 'Provider', icon: '📦', desc: 'Gestión reactiva con ChangeNotifier' },
  { id: 'Riverpod', name: 'Riverpod', icon: '🌊', desc: 'StateNotifier declarativo y robusto' },
  { id: 'Bloc', name: 'Bloc', icon: '🧱', desc: 'Arquitectura orientada a eventos y estados' },
]

export function FrontendGeneratorPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(id || searchParams.get('projectId') || '')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Target platform: Web vs Mobile
  const [platform, setPlatform] = useState<'WEB' | 'MOBILE'>('WEB')

  // Web options
  const [webFramework, setWebFramework] = useState<'React + Vite' | 'Angular' | 'Vue'>('React + Vite')
  const [webStyling, setWebStyling] = useState<'Tailwind CSS' | 'Material UI'>('Tailwind CSS')

  // Mobile options
  const [mobileFramework, setMobileFramework] = useState<'Flutter + Dart' | 'React Native'>('Flutter + Dart')
  const [mobileArchitecture, setMobileArchitecture] = useState<'Clean Architecture' | 'MVVM'>('Clean Architecture')
  const [mobileState, setMobileState] = useState<'Provider' | 'Riverpod' | 'Bloc'>('Bloc')

  const [loadingProjects, setLoadingProjects] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Load user's projects for project switcher
  useEffect(() => {
    const controller = new AbortController()
    setLoadingProjects(true)
    projectsService
      .list('', controller.signal)
      .then(data => {
        setProjects(data)
        const initialId = id || searchParams.get('projectId') || (data.length > 0 ? data[0].id : '')
        if (initialId) {
          setSelectedProjectId(initialId)
          const found = data.find(p => p.id === initialId)
          if (found) setSelectedProject(found)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProjects(false)
      })

    return () => controller.abort()
  }, [id, searchParams])

  // Update selected project details when ID changes
  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const found = projects.find(p => p.id === selectedProjectId)
      setSelectedProject(found || null)
    }
  }, [selectedProjectId, projects])

  const handleGenerate = async (forceFlutterPrep = false) => {
    if (!selectedProjectId) {
      setError('Por favor selecciona un proyecto para generar el Meta-Prompt.')
      return
    }

    setGenerating(true)
    setError(null)
    setCopied(false)

    try {
      const payload =
        platform === 'MOBILE'
          ? {
              projectId: selectedProjectId,
              platform: 'MOBILE',
              framework: mobileFramework,
              architecture: mobileArchitecture,
              stateManagement: mobileState,
              includeFlutterPrep: forceFlutterPrep || mobileFramework === 'Flutter + Dart',
            }
          : {
              projectId: selectedProjectId,
              platform: 'WEB',
              framework: webFramework,
              style: webStyling,
              frontendFramework: webFramework,
              stylingFramework: webStyling,
            }

      const response = await frontendGeneratorService.generatePrompt(payload)
      setGeneratedPrompt(response.prompt)
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No se pudo generar el Meta-Prompt. Asegúrate de que el proyecto tenga clases UML modeladas.',
      )
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedPrompt) return
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const roleName = user?.role.name
  const isAdmin = roleName === 'ADMINISTRADOR'
  const isHost = roleName === 'ANFITRION'

  const currentSummaryTag =
    platform === 'MOBILE'
      ? `${mobileFramework} · ${mobileArchitecture} · ${mobileState}`
      : `${webFramework} + ${webStyling}`

  const isFlutterActive = platform === 'MOBILE' && mobileFramework === 'Flutter + Dart'

  const renderSidebarContent = () => (
    <>
      <div>
        {/* Brand Logo */}
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

        {/* Navigation Menu */}
        <nav className="mt-6 space-y-1.5 font-medium text-sm">
          <NavLink
            to="/dashboard"
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
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <span>Proyectos</span>
          </NavLink>

          {isAdmin && (
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
              <span>Usuarios</span>
            </NavLink>
          )}

          {/* Active Navigation: Generación IA -> Generador Aplicaciones */}
          <div className="pt-2">
            <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300/60">
              Generación IA
            </div>
            <div className="mt-1 flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-xs font-bold">Generador Aplicaciones</span>
                <span className="text-[9px] text-indigo-200/80 font-normal">Web & Mobile IA</span>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* User Session Footer */}
      <div className="pt-4 border-t border-white/10">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-indigo-200/60 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2.5 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <span>Cerrar sesión</span>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#080D24] font-sans antialiased select-none text-slate-800 dark:text-slate-100 transition-colors">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[260px] h-full bg-gradient-to-b from-[#111827] via-[#15193B] to-[#172554] p-5 flex flex-col justify-between text-white shadow-2xl z-50 overflow-y-auto">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex w-[260px] h-full shrink-0 bg-gradient-to-b from-[#111827] via-[#15193B] to-[#172554] p-5 flex-col justify-between text-white shadow-xl relative z-30 border-r border-white/10 overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC] dark:bg-[#080D24]">
        {/* HEADER SUPERIOR (88PX) */}
        <header className="min-h-[85px] h-[88px] shrink-0 bg-white dark:bg-[#0E1535] border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-20 shadow-xs transition-colors">
          <div className="flex items-center gap-3.5">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#131B3E] transition cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedProjectId) {
                  navigate(`/projects/${selectedProjectId}`)
                } else {
                  navigate('/projects')
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs cursor-pointer"
              title="Volver"
            >
              <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>{selectedProject ? 'Volver al proyecto' : 'Volver a proyectos'}</span>
            </button>

            <div className="h-7 w-px bg-slate-200/80 dark:bg-slate-700 hidden sm:block" />

            {/* Title & Badge */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  Generador de Meta-Prompt de Aplicaciones IA
                </h1>
                <span className="rounded-md bg-gradient-to-r from-violet-500/10 to-indigo-500/10 dark:from-violet-950/60 dark:to-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 tracking-wider uppercase">
                  WEB & MOBILE IA
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                Genera especificaciones inteligentes para crear aplicaciones Web y Mobile conectadas al backend generado.
              </p>
            </div>
          </div>

          {/* Right badge */}
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Meta-Prompt Engine v2.1
            </span>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Error notification */}
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-300 shadow-xs animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-rose-400 dark:text-rose-300 hover:text-rose-600 dark:hover:text-rose-100 cursor-pointer">
                ✕
              </button>
            </div>
          )}

          {/* CARD SUPERIOR: CONFIGURACIÓN DE GENERACIÓN */}
          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-2xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Configuración del Meta-Prompt</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona el tipo de plataforma y la arquitectura deseada</p>
                </div>
              </div>

              {selectedProject && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Proyecto vinculado
                </span>
              )}
            </div>

            {/* SELECCIÓN PRINCIPAL: PROYECTO + TIPO DE APLICACIÓN (WEB / MOBILE) */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* 1. Proyecto Seleccionado */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  1. Proyecto Seleccionado
                </label>
                {loadingProjects ? (
                  <div className="h-11 rounded-xl bg-slate-100 dark:bg-[#131B3E] animate-pulse" />
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] p-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-white shadow-2xs focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition cursor-pointer"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="dark:bg-[#131B3E] dark:text-white">
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedProject && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedProject.description || 'Proyecto UML listo para análisis'}
                  </p>
                )}
              </div>

              {/* 2. Tipo de Aplicación (Plataforma Destino: Web vs Mobile) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  2. Tipo de Aplicación (Plataforma)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlatform('WEB')}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer ${
                      platform === 'WEB'
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                    }`}
                  >
                    <span className="text-lg">🌐</span>
                    <span>Aplicación Web</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlatform('MOBILE')}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border font-bold text-xs sm:text-sm transition cursor-pointer ${
                      platform === 'MOBILE'
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                    }`}
                  >
                    <span className="text-lg">📱</span>
                    <span>Aplicación Mobile</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {platform === 'WEB'
                    ? 'Genera especificación frontend para navegadores (React, Angular o Vue).'
                    : 'Genera especificación móvil nativa para smartphones (Flutter o React Native).'}
                </p>
              </div>
            </div>

            {/* SELECCIÓN ESPECÍFICA SEGÚN PLATAFORMA */}
            {platform === 'WEB' ? (
              /* PANEL WEB: Framework + Estilos */
              <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                {/* Framework Web */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                    3. Framework Web
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {WEB_FRAMEWORKS.map(item => {
                      const isSelected = webFramework === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setWebFramework(item.id as any)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-xs ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                          }`}
                        >
                          <span className="text-base mb-0.5">{item.icon}</span>
                          <span className="truncate text-center">{item.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Estilos Web */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                    4. Sistema de Estilos
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEB_STYLINGS.map(item => {
                      const isSelected = webStyling === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setWebStyling(item.id as any)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'border-purple-600 dark:border-purple-500 bg-purple-50/80 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 shadow-xs ring-2 ring-purple-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                          }`}
                        >
                          <span className="text-base mb-0.5">{item.icon}</span>
                          <span className="truncate text-center">{item.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* PANEL MOBILE: Framework Mobile + Arquitectura + Gestión de Estado + Tarjeta Informativa Flutter */
              <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                <div className="grid gap-6 md:grid-cols-3">
                  {/* 3. Framework Mobile */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                      3. Framework Mobile
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {MOBILE_FRAMEWORKS.map(item => {
                        const isSelected = mobileFramework === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setMobileFramework(item.id as any)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-xs ring-2 ring-indigo-500/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                            }`}
                          >
                            <span className="text-base mb-0.5">{item.icon}</span>
                            <span className="truncate text-center">{item.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 4. Arquitectura Mobile */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                      4. Arquitectura
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {MOBILE_ARCHITECTURES.map(item => {
                        const isSelected = mobileArchitecture === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setMobileArchitecture(item.id as any)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 shadow-xs ring-2 ring-indigo-500/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                            }`}
                          >
                            <span className="text-base mb-0.5">{item.icon}</span>
                            <span className="truncate text-center">{item.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 5. Gestión de Estado */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                      5. Gestión de Estado
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {MOBILE_STATE_MANAGEMENT.map(item => {
                        const isSelected = mobileState === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setMobileState(item.id as any)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'border-purple-600 dark:border-purple-500 bg-purple-50/80 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 shadow-xs ring-2 ring-purple-500/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                            }`}
                          >
                            <span className="text-base mb-0.5">{item.icon}</span>
                            <span className="truncate text-center">{item.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Tarjeta Informativa Flutter */}
                {isFlutterActive && (
                  <div className="rounded-xl border border-indigo-150 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-blue-50/60 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 p-4 flex items-center gap-3.5 shadow-2xs">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-2xs">
                      <span className="text-lg">💙</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                        Preparación Automática Flutter APK Release
                      </h4>
                      <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                        El sistema generará instrucciones necesarias para convertir el backend generado en una aplicación móvil Flutter instalable.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              {/* Botón especial: Preparar Proyecto Flutter */}
              {isFlutterActive && (
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={generating || !selectedProjectId}
                  className="flex items-center gap-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/60 dark:to-indigo-950/60 px-5 py-3 text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200 shadow-2xs hover:border-purple-400 dark:hover:border-purple-700 hover:bg-purple-100/70 dark:hover:bg-purple-900/50 disabled:opacity-50 transition cursor-pointer"
                >
                  <span>📱 Preparar Proyecto Flutter</span>
                </button>
              )}

              {/* Botón estándar: Generar Prompt */}
              <button
                type="button"
                onClick={() => handleGenerate(false)}
                disabled={generating || !selectedProjectId}
                className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
              >
                {generating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Analizando modelo UML y backend…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>Generar Prompt</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* CARD INFERIOR: PROMPT GENERADO */}
          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Prompt generado</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {generatedPrompt
                      ? `${generatedPrompt.length.toLocaleString()} caracteres · Listo para copiar y usar en tu LLM preferido`
                      : 'El prompt generado aparecerá en esta área'}
                  </p>
                </div>
              </div>

              {/* Botones de Acción */}
              {generatedPrompt && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-2xs cursor-pointer ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/25'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copiar Prompt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerate(false)}
                    disabled={generating}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10" />
                      <polyline points="23 20 23 14 17 14" />
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                    </svg>
                    <span>Regenerar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Textarea / Visor de Prompt */}
            {generatedPrompt ? (
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    readOnly
                    rows={18}
                    value={generatedPrompt}
                    aria-label="Contenido del Meta-Prompt generado"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0B1120] p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed text-indigo-100 shadow-inner focus:outline-none select-all"
                  />
                  <div className="absolute top-3 right-3">
                    <span className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-mono text-indigo-200/90 backdrop-blur-xs">
                      {currentSummaryTag}
                    </span>
                  </div>
                </div>

                {/* Guía rápida de uso con LLMs */}
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/60 dark:bg-indigo-950/30 p-4">
                  <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1.5 flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Modelos recomendados para usar este Meta-Prompt:</span>
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="rounded-lg bg-white dark:bg-[#131B3E] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-indigo-150 dark:border-slate-700 shadow-2xs">
                      🤖 ChatGPT (GPT-4o / o1)
                    </span>
                    <span className="rounded-lg bg-white dark:bg-[#131B3E] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-indigo-150 dark:border-slate-700 shadow-2xs">
                      ⚡ Claude 3.5 Sonnet
                    </span>
                    <span className="rounded-lg bg-white dark:bg-[#131B3E] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-indigo-150 dark:border-slate-700 shadow-2xs">
                      ✨ Gemini 1.5 Pro / Flash
                    </span>
                    <span className="rounded-lg bg-white dark:bg-[#131B3E] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-indigo-150 dark:border-slate-700 shadow-2xs">
                      🚀 Antigravity / Cursor
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-[#131B3E]/30">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ningún prompt generado aún</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                  Configura el proyecto y selecciona si deseas crear una aplicación{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Web</span> o{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Mobile</span>, luego presiona{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">"Generar Prompt"</span> o{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">"📱 Preparar Proyecto Flutter"</span>.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
