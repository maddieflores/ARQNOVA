import { Link, useSearchParams } from 'react-router-dom'
import { AiNewDiagramGenerator } from '../modules/ai/AiNewDiagramGenerator'

export function AiNewDiagramPage() {
  const [searchParams] = useSearchParams()
  const modeParam = searchParams.get('mode')
  const initialMode = modeParam === 'voice' ? 'voice' : modeParam === 'image' ? 'image' : 'text'

  return (
    <section className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070B1E] font-sans select-none flex flex-col transition-colors">
      {/* HEADER TIPO HERRAMIENTA CASE */}
      <header className="z-20 flex min-h-[85px] h-[88px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] px-6 py-4 shadow-xs transition-colors">
        {/* Izquierda: Volver al Dashboard + Separador + Logo ARQNOVA + Título */}
        <div className="flex items-center gap-3.5">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50 dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A2552] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            title="Volver al Dashboard"
          >
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver al Dashboard</span>
          </Link>

          <div className="h-8 w-px bg-slate-200/80 dark:bg-slate-700 hidden sm:block" />

          {/* Brand & Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  Generar con IA · Nuevo Diagrama UML
                </h1>
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 tracking-wider uppercase">
                  Generación desde cero
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 hidden sm:block">
                Crea modelos UML completos a partir de descripciones de texto, dictado por voz o imágenes.
              </p>
            </div>
          </div>
        </div>

        {/* Derecha: Suite Badge */}
        <div className="hidden md:flex items-center gap-2.5">
          <span className="rounded-full bg-slate-100/90 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
            ARQNOVA CASE Suite
          </span>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <AiNewDiagramGenerator initialMode={initialMode} key={initialMode} />
      </main>
    </section>
  )
}
