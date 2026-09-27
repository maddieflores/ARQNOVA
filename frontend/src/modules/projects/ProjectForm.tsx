import { useRef, useState, type FormEvent } from 'react';
import type { Project, ProjectInput } from './projects-service';

interface Props { project: Project | null; busy: boolean; onSave(input: ProjectInput): Promise<void>; onCancel(): void; }

export function ProjectForm({ project, busy, onSave, onCancel }: Props) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const submitting = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !name.trim()) return;
    submitting.current = true;
    try {
      await onSave({ name: name.trim(), description: description.trim() });
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <section className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0E1535] p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {project ? 'Editar proyecto' : 'Crear proyecto'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {project ? 'Actualiza la información del modelo UML' : 'Inicia un nuevo espacio de diseño CASE'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#131B3E] transition cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1.5"
            >
              Nombre
            </label>
            <input
              id="project-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              placeholder="Ej. Sistema de Facturación Electrónica"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#131B3E] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1.5"
            >
              Descripción
            </label>
            <textarea
              id="project-description"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
              placeholder="Describe el objetivo y alcance de la arquitectura UML..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#131B3E] p-3.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#131B3E] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Guardando…' : 'Guardar proyecto'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
