import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthProvider'
import { participantsService, type Invitation, type Participant } from '../modules/participants/participants-service'
import { projectsService, type Project } from '../modules/projects/projects-service'
import { ApiError } from '../services/http'

const message = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No se pudo completar la operación.'
const date = (value: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function ProjectParticipantsPage() {
  const { id = '' } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [invitationLink, setInvitationLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pending = useRef(false)

  const load = async (signal?: AbortSignal) => {
    const [currentProject, members, invites] = await Promise.all([
      projectsService.get(id, signal),
      participantsService.list(id, signal),
      participantsService.invitations(id, signal),
    ])
    setProject(currentProject)
    setParticipants(members)
    setInvitations(invites)
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .catch(failure => {
        if (!controller.signal.aborted) setError(message(failure))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    setSuccess(null)
    setInvitationLink('')
    try {
      const created = await participantsService.invite(id, email.trim().toLowerCase())
      setEmail('')
      setInvitationLink(`${window.location.origin}/invitations/${created.token}`)
      setSuccess('Invitación creada correctamente.')
      await load()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'No se pudo completar la operación.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const remove = async (participant: Participant) => {
    if (pending.current || !window.confirm(`¿Retirar a ${participant.user.name}?`)) return
    pending.current = true
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await participantsService.remove(id, participant.userId)
      setSuccess('Participante retirado correctamente.')
      await load()
    } catch (failure) {
      setError(message(failure))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#080D24]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p role="status" className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Cargando participantes…
          </p>
        </div>
      </div>
    )
  }

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
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/projects"
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <span>Proyectos</span>
          </NavLink>

          {user?.role.name === 'ADMINISTRADOR' && (
            <NavLink
              to="/admin/users"
              className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span>Usuarios</span>
            </NavLink>
          )}

          {/* Active: Invitaciones */}
          <div className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/35 ring-1 ring-white/20">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>Invitaciones</span>
          </div>

          {/* Generador Frontend */}
          <NavLink
            to={`/projects/${id}/frontend-generator`}
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-indigo-200/70 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg className="h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>Generador Frontend</span>
          </NavLink>
        </nav>
      </div>

      {/* User Session and Logout Bottom */}
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
          <aside className="relative w-[240px] h-full bg-gradient-to-b from-[#111827] via-[#15193B] to-[#172554] p-5 flex flex-col justify-between text-white shadow-2xl z-50 overflow-y-auto">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex w-[240px] h-full shrink-0 bg-gradient-to-b from-[#111827] via-[#15193B] to-[#172554] p-5 flex-col justify-between text-white shadow-xl relative z-30 border-r border-white/10 overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* ÁREA PRINCIPAL DE CONTENIDO */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC] dark:bg-[#070B1E] transition-colors">
        {/* HEADER SUPERIOR (85-90PX) */}
        <header className="min-h-[85px] h-[88px] shrink-0 bg-white dark:bg-[#0E1535] border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-20 shadow-xs transition-colors">
          <div className="flex items-center gap-3.5">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#131B3E] transition cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Back Button */}
            <Link
              to={`/projects/${id}`}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
              title="Volver al proyecto"
            >
              <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Volver al proyecto</span>
            </Link>

            <div className="h-7 w-px bg-slate-200/80 dark:bg-slate-700 hidden sm:block" />

            {/* Page Title & Context */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  Participantes de {project?.name ?? 'proyecto'}
                </h1>
                <span className="rounded-md bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-800 tracking-wider uppercase">
                  COLABORATIVO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                Gestiona las invitaciones y los usuarios que colaboran en el diseño UML del proyecto.
              </p>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Notifications */}
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
                ✕
              </button>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                ✕
              </button>
            </div>
          )}

          {/* TARJETAS DE MÉTRICAS (3 CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {/* Card 1: Usuarios Activos */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                  USUARIOS ACTIVOS
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {participants.length + (project ? 1 : 0)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Miembros del equipo</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
            </div>

            {/* Card 2: Invitaciones Pendientes */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                  INVITACIONES PENDIENTES
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">{invitations.length}</div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Esperando confirmación</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
            </div>

            {/* Card 3: Modo Colaboración */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                  MODO COLABORACIÓN
                </span>
                <div className="flex items-center gap-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Activo</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Bloqueo de clases en vivo</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          </div>

          {/* SECCIÓN INVITAR COLABORADOR FORM */}
          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-2xs">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Invitar colaborador</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparte el proyecto con usuarios registrados para trabajar en equipo.
                </p>
              </div>
            </div>

            <form className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3" onSubmit={invite}>
              <div className="flex-1">
                <label htmlFor="invite-email" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="usuario@ejemplo.com"
                    className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] py-2.5 pl-9 pr-4 text-xs sm:text-sm text-slate-800 dark:text-white placeholder-slate-400 shadow-2xs focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>

              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition cursor-pointer shrink-0"
                disabled={busy}
                type="submit"
              >
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Enviando…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span>Crear invitación</span>
                  </>
                )}
              </button>
            </form>

            {/* Enlace generado */}
            {invitationLink && (
              <div className="mt-5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 p-4 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Enlace generado</span>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  Compártelo de forma segura con el usuario invitado. No volverá a mostrarse.
                </p>
                <input
                  aria-label="Enlace de invitación"
                  className="mt-2.5 w-full rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-[#131B3E] p-2.5 font-mono text-xs text-slate-800 dark:text-white focus:outline-none shadow-2xs select-all"
                  readOnly
                  value={invitationLink}
                />
              </div>
            )}
          </section>

          {/* SECCIÓN 1: INVITACIONES PENDIENTES */}
          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Invitaciones pendientes</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Gestiona las invitaciones a proyectos colaborativos</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {invitations.length} pendientes
              </span>
            </div>

            {invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">No hay invitaciones pendientes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Cuando invites colaboradores aparecerán aquí para gestionar sus accesos.
                </p>
                <span className="sr-only">No hay invitaciones.</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {invitations.map(invitation => (
                  <li
                    key={invitation.id}
                    className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B3E] p-4 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-sm shadow-2xs">
                        {invitation.invitedUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                          {invitation.invitedUser.email}
                        </p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                          {project?.name ?? 'Proyecto UML'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          Expira {date(invitation.expiresAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Badge de Estado: PENDING */}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {invitation.status} · Pendiente
                      </span>

                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] transition"
                        title="Opciones"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19" cy="12" r="1.5" />
                          <circle cx="5" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SECCIÓN 2: EQUIPO ACTUAL / PARTICIPANTES */}
          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Equipo actual</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Miembros con permisos de modelado y edición UML</p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {participants.length + (project ? 1 : 0)} miembros
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Propietario Card */}
              {project && (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E] p-4 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#4F46E5] to-[#8B5CF6] text-white font-bold text-sm shadow-xs">
                      {project.owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{project.owner.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{project.owner.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 uppercase">
                          Propietario
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Participantes Colaboradores */}
              {participants.map(member => (
                <div
                  key={member.id}
                  role="listitem"
                  className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B3E] p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-sm shadow-xs">
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{member.user.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{member.user.email}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">
                            {member.user.role.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Desde {date(member.joinedAt)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition disabled:opacity-50 cursor-pointer"
                      disabled={busy}
                      onClick={() => void remove(member)}
                    >
                      Retirar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {participants.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-[#131B3E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 mt-4">
                Aún no hay participantes.
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
