import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { projectsService, type Project } from '../modules/projects/projects-service'
import { umlService } from '../modules/uml/uml-service'
import type { Diagram } from '../modules/uml/types'
import { ApiError } from '../services/http'

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.allSettled([
      projectsService.get(id, controller.signal),
      umlService.get(id, controller.signal),
    ])
      .then(([projRes, diagRes]) => {
        if (controller.signal.aborted) return
        if (projRes.status === 'fulfilled') {
          setProject(projRes.value)
        } else {
          setError(
            projRes.reason instanceof ApiError ? projRes.reason.message : 'No se pudo consultar el proyecto.'
          )
        }
        if (diagRes.status === 'fulfilled') {
          setDiagram(diagRes.value)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#080D24]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p role="status" className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Cargando proyecto…
          </p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#080D24] p-6">
        <section className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Proyecto no disponible</h1>
          <p role="alert" className="mt-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-medium text-rose-800 dark:text-rose-300">
            {error ?? 'No se pudo consultar el proyecto.'}
          </p>
          <Link
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
            to="/projects"
          >
            Volver a proyectos
          </Link>
        </section>
      </div>
    )
  }

  const classesCount = diagram?.classes.length ?? 0
  const relationsCount = diagram?.relations.length ?? 0

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#080D24] font-sans select-none flex flex-col transition-colors">
      {/* 1. HEADER PROPIO DEL PROYECTO (85-90PX) */}
      <header className="z-20 flex min-h-[85px] h-[88px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] px-6 py-4 shadow-xs transition-colors">
        {/* Izquierda: Volver a proyectos + Separador + Logo ARQNOVA + Nombre + Badge */}
        <div className="flex items-center gap-3.5">
          <Link
            to="/projects"
            className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            title="Volver a proyectos"
          >
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver a proyectos</span>
          </Link>

          <div className="h-8 w-px bg-slate-200/80 dark:bg-slate-700 hidden sm:block" />

          {/* ARQNOVA Brand Identity & Project Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  {project.name}
                </h1>
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 tracking-wider uppercase">
                  PROYECTO UML
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 hidden sm:block">
                Administra el modelo UML, participantes y generación automática del sistema.
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: Badge de Entorno CASE */}
        <div className="hidden md:flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Estado: Activo
          </span>
        </div>
      </header>

      {/* CUERPO PRINCIPAL TIPO DASHBOARD */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* SECCIÓN 1: INFORMACIÓN GENERAL DEL PROYECTO */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
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
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Información del proyecto</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Detalles de autoría y metadata del repositorio</p>
              </div>
            </div>
          </div>

          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Descripción */}
            <div className="sm:col-span-2 lg:col-span-4 rounded-xl bg-slate-50/70 dark:bg-[#131B3E] border border-slate-100 dark:border-slate-800 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Descripción</span>
              </dt>
              <dd className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium leading-relaxed">
                {project.description || 'Sin descripción.'}
              </dd>
            </div>

            {/* Propietario */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#131B3E] p-4 shadow-2xs sm:col-span-2">
              <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Propietario</span>
              </dt>
              <dd className="text-sm font-bold text-slate-900 dark:text-white">
                {project.owner.name} ({project.owner.email})
              </dd>
            </div>

            {/* Fecha Creación */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#131B3E] p-4 shadow-2xs">
              <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Creado</span>
              </dt>
              <dd className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatDate(project.createdAt)}</dd>
            </div>

            {/* Última Actualización */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#131B3E] p-4 shadow-2xs">
              <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Actualizado</span>
              </dt>
              <dd className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatDate(project.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        {/* SECCIÓN 2: ACCIONES PRINCIPALES */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Acciones rápidas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Herramientas de modelado, asistencia y equipo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Botón Principal: Abrir Editor UML */}
            <Link
              to={`/projects/${project.id}/editor`}
              className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 py-3 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span>Abrir editor UML</span>
            </Link>

            {/* Botón Secundario 1: Describir Modelo con IA */}
            <Link
              to={`/projects/${project.id}/ai-proposal`}
              className="flex items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/80 dark:bg-violet-950/40 px-4 py-3 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 transition"
            >
              <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>Describir modelo UML</span>
            </Link>

            {/* Botón Secundario 2: Generar Frontend IA */}
            <Link
              to={`/projects/${project.id}/frontend-generator`}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 px-4 py-3 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Generar Frontend IA</span>
            </Link>

            {/* Botón Secundario 3: Gestionar Participantes */}
            <Link
              to={`/projects/${project.id}/participants`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            >
              <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Gestionar participantes</span>
            </Link>
          </div>
        </section>

        {/* SECCIÓN 3: RESUMEN DEL PROYECTO (ESTADÍSTICAS DEL MODELO) */}
        <section className="grid gap-4 sm:grid-cols-3">
          {/* Card 1: Clases UML */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                CLASES UML
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {classesCount} {classesCount === 1 ? 'clase' : 'clases'}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Entidades en el diagrama</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
          </div>

          {/* Card 2: Relaciones */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                RELACIONES
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {relationsCount} {relationsCount === 1 ? 'relación' : 'relaciones'}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Asociaciones y herencias</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
          </div>

          {/* Card 3: Estado */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                ESTADO
              </span>
              <div className="flex items-center gap-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Activo</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Sincronización en tiempo real</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: ACTIVIDAD RECIENTE Y ESTADO DEL SISTEMA */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 14" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Últimos cambios</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Diagnóstico de estado y persistencia del modelo</p>
            </div>
          </div>

          <ul className="space-y-2.5">
            <li className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#131B3E] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                ✓
              </span>
              <span>Modelo actualizado y persistido en base de datos.</span>
            </li>
            <li className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#131B3E] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold text-[10px]">
                ✓
              </span>
              <span>Conexión WebSocket activa para colaboración en vivo y control de bloqueos.</span>
            </li>
            <li className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#131B3E] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 font-bold text-[10px]">
                ✓
              </span>
              <span>Generación de backend Spring Boot y exportación XMI listos para descargar.</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
