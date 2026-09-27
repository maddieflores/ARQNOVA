import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { participantsService, type SharedProject } from '../modules/participants/participants-service'
import { ApiError } from '../services/http'

const date = (value: string) => new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))

export function SharedProjectsPage() {
  const [memberships, setMemberships] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    participantsService.shared(controller.signal)
      .then(value => { if (!controller.signal.aborted) setMemberships(value) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure.message : 'No se pudieron consultar los proyectos compartidos.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) });
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Proyectos compartidos</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Proyectos en los que participas como colaborador.</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/50 p-3.5 text-xs text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">{error}</p>}

      {loading ? (
        <p role="status" className="mt-5 text-slate-500 dark:text-slate-400">Cargando proyectos…</p>
      ) : memberships.length === 0 ? (
        <p className="mt-5 text-slate-500 dark:text-slate-400">No tienes proyectos compartidos.</p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {memberships.map(({ id, joinedAt, project }) => (
            <li key={id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{project.name}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">{project.description || 'Sin descripción.'}</p>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <p>Anfitrión: <strong className="text-slate-700 dark:text-slate-200">{project.owner.name}</strong></p>
                <p>Miembro desde {date(joinedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link className="inline-block rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition" to={`/projects/${project.id}/editor`}>
                  Abrir editor UML
                </Link>
                <Link className="inline-block rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] hover:bg-slate-100 dark:hover:bg-[#182352] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition" to={`/projects/${project.id}/ai-proposal`}>
                  Describir modelo UML
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
