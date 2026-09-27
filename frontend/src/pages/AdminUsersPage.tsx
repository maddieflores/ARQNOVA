import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../services/http';
import { useAuth } from '../modules/auth/AuthProvider';
import { authService } from '../modules/auth/auth-service';
import { UserForm } from '../modules/users/UserForm';
import { usersService, type ManagedUser, type Role, type UserInput } from '../modules/users/users-service';
export function AdminUsersPage() {
  const { user: currentUser, retry } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<{ user: ManagedUser | null } | null>(null);
  const actionPending = useRef(false);
  const message = (failure: unknown) => failure instanceof ApiError ? failure.message : 'No se pudo completar la operación.';
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    Promise.all([usersService.list(query, controller.signal), usersService.roles(controller.signal)])
      .then(([list, availableRoles]) => { if (!controller.signal.aborted) { setUsers(list); setRoles(availableRoles); } })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  const refresh = async () => { setUsers(await usersService.list(query)); };
  const save = async (input: UserInput, password?: string) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      const updated = form?.user ? await usersService.update(form.user.id, input) : await usersService.create({ ...input, password: password ?? '' });
      setForm(null); setSuccess('Usuario guardado correctamente.');
      if (updated.id === currentUser?.id) { await authService.getUser(); retry(); } else await refresh();
    } catch (failure) { setError(message(failure)); }
    finally { actionPending.current = false; setBusy(false); }
  };
  const status = async (target: ManagedUser) => {
    if (actionPending.current || (target.isActive && !window.confirm(`¿Desactivar a ${target.name}?`))) return;
    actionPending.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      await usersService.status(target.id, !target.isActive);
      setSuccess(target.isActive ? 'Usuario desactivado.' : 'Usuario activado.');
      if (target.id === currentUser?.id) { await authService.getUser(); retry(); } else await refresh();
    } catch (failure) { setError(message(failure)); }
    finally { actionPending.current = false; setBusy(false); }
  };
  const searchUsers = (event: FormEvent) => { event.preventDefault(); setQuery(search.trim()); };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Gestión de usuarios</h1>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/50 p-3.5 text-xs text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl bg-green-50 dark:bg-green-950/50 p-3.5 text-xs text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">{success}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          disabled={busy || loading || roles.length === 0}
          onClick={() => { setForm({ user: null }); setError(null); setSuccess(null); }}
        >
          + Crear usuario
        </button>
        <form className="flex flex-wrap gap-2" onSubmit={searchUsers}>
          <label className="sr-only" htmlFor="search">Buscar usuarios</label>
          <input
            id="search"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Nombre o email"
            maxLength={100}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <button className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] cursor-pointer" disabled={busy}>
            Buscar
          </button>
        </form>
      </div>
      {form && <UserForm key={form.user?.id ?? 'new'} user={form.user} roles={roles} busy={busy} onSave={save} onCancel={() => setForm(null)}/>}
      {loading ? (
        <p role="status" className="mt-5 text-slate-500 dark:text-slate-400">Cargando usuarios…</p>
      ) : users.length === 0 ? (
        <p className="mt-5 text-slate-500 dark:text-slate-400">No hay usuarios para mostrar.</p>
      ) : (
        <ul className="mt-5 grid gap-3.5">
          {users.map(target => (
            <li key={target.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white">{target.name}</h2>
                  <p className="break-all text-xs text-slate-500 dark:text-slate-400 mt-0.5">{target.email}</p>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">{target.role.name} · {target.isActive ? 'Activo' : 'Inactivo'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#131B3E] cursor-pointer"
                    disabled={busy}
                    onClick={() => { setForm({ user: target }); setError(null); setSuccess(null); }}
                  >
                    Editar
                  </button>
                  <button
                    className="rounded-xl border border-rose-200 dark:border-rose-900/60 px-3.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    disabled={busy}
                    onClick={() => { void status(target); }}
                  >
                    {target.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
