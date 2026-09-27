import { useRef, useState, type FormEvent } from 'react';
import type { ManagedUser, Role, UserInput } from './users-service';
interface Props { user: ManagedUser | null; roles: Role[]; busy: boolean; onSave(input: UserInput, password?: string): Promise<void>; onCancel(): void; }
export function UserForm({ user, roles, busy, onSave, onCancel }: Props) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [roleId, setRoleId] = useState(user?.roleId ?? roles.find(role => role.name === 'COLABORADOR')?.id ?? '');
  const [active, setActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState('');
  const submitting = useRef(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true;
    try { await onSave({ name: name.trim(), email: email.trim().toLowerCase(), roleId, isActive: active }, user ? undefined : password); }
    finally { submitting.current = false; }
  };
  const inputStyle = 'mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#131B3E] p-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5 shadow-sm text-slate-900 dark:text-slate-100">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user ? 'Editar usuario' : 'Crear usuario'}</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div>
          <label htmlFor="user-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Nombre</label>
          <input id="user-name" className={inputStyle} required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy}/>
        </div>
        <div>
          <label htmlFor="user-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Email</label>
          <input id="user-email" className={inputStyle} type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/>
        </div>
        {!user && (
          <div>
            <label htmlFor="user-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Contraseña</label>
            <input id="user-password" aria-describedby="password-help" className={inputStyle} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/>
            <p id="password-help" className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mínimo 10 caracteres; máximo 72 bytes UTF-8.</p>
          </div>
        )}
        <div>
          <label htmlFor="user-role" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Rol</label>
          <select id="user-role" className={inputStyle} required value={roleId} onChange={event => setRoleId(event.target.value)} disabled={busy}>
            <option value="">Selecciona un rol</option>
            {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
          <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} disabled={busy} className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"/>
          Usuario activo
        </label>
        <div className="flex gap-3 sm:col-span-2 pt-2">
          <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer" disabled={busy} type="submit">
            {busy ? 'Guardando…' : 'Guardar usuario'}
          </button>
          <button className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#131B3E] cursor-pointer" type="button" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
