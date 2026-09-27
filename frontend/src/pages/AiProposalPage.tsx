import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AiProposalForm } from '../modules/ai/AiProposalForm'
import { aiService } from '../modules/ai/ai-service'
import type { AiImageInput, AiUmlProposal } from '../modules/ai/types'
import { umlService } from '../modules/uml/uml-service'
import type { Diagram } from '../modules/uml/types'
import { ApiError } from '../services/http'

export function AiProposalPage() {
  const { id = '' } = useParams()
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [proposal, setProposal] = useState<AiUmlProposal | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void umlService
      .get(id)
      .then(setDiagram)
      .catch(() => undefined)
  }, [id])

  const generate = async (prompt?: string, image?: AiImageInput) => {
    setLoading(true)
    setError(null)
    setApplied(false)
    try {
      const result = await aiService.generateUmlProposal(id, prompt, diagram, image)
      setProposal(result.proposal)
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'No se pudo generar la propuesta.')
    } finally {
      setLoading(false)
    }
  }


  const apply = async () => {
    if (!proposal) return
    setApplying(true)
    setError(null)
    try {
      const result = await aiService.applyUmlProposal(id, proposal)
      setDiagram(result.diagram)
      setApplied(true)
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'No se pudo aplicar la propuesta.')
    } finally {
      setApplying(false)
    }
  }

  const cancel = () => {
    setProposal(null)
    setApplied(false)
    setError(null)
  }

  return (
    <section className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#080D24] font-sans select-none flex flex-col transition-colors">
      {/* HEADER TIPO HERRAMIENTA CASE (85-90PX) */}
      <header className="z-20 flex min-h-[85px] h-[88px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] px-6 py-4 shadow-xs transition-colors">
        {/* Izquierda: Volver al Editor UML + Separador + Logo ARQNOVA + Título + Badge IA */}
        <div className="flex items-center gap-3.5">
          <Link
            to={`/projects/${id}/editor`}
            className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            title="Volver al Editor UML"
          >
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver al Editor UML</span>
          </Link>

          <div className="h-8 w-px bg-slate-200/80 dark:bg-slate-700 hidden sm:block" />

          {/* ARQNOVA Brand & Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1
                  aria-label="Propuesta UML mediante IA"
                  className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none"
                >
                  Asistente IA · Edición del modelo UML
                </h1>
                <span className="rounded-md bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-800 tracking-wider uppercase">
                  IA
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 hidden sm:block">
                Modifica y extiende tu diagrama UML en lenguaje natural mediante IA.
              </p>
            </div>
          </div>
        </div>

        {/* Derecha: Badge de Entorno CASE */}
        <div className="hidden md:flex items-center gap-2.5">
          <span className="rounded-full bg-slate-100/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            ARQNOVA CASE Suite
          </span>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* Banner de Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-300 shadow-xs"
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

        {/* Banner de Éxito / Aplicado */}
        {applied && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-900 dark:text-emerald-300 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Cambios aplicados y persistidos correctamente en PostgreSQL.</span>
            </div>
            <Link
              to={`/projects/${id}/editor`}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 dark:hover:bg-emerald-500 transition"
            >
              <span>Ver en editor UML</span>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        )}

        {/* Contenedor del Formulario y Propuesta */}
        <AiProposalForm
          loading={loading}
          applying={applying}
          applied={applied}
          proposal={proposal}
          onGenerate={generate}
          onApply={apply}
          onCancel={cancel}
        />
      </main>
    </section>
  )
}
