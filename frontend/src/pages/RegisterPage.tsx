import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import { authService } from '../modules/auth/auth-service';
import { ApiError } from '../services/http';

export function RegisterPage() {
  const { status } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitting = useRef(false);

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;

    // Validaciones frontend
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authService.register({
        name: trimmedName,
        email: trimmedEmail,
        password,
        passwordConfirmation,
      });
      setSuccess(response.message || 'Cuenta creada correctamente. Ahora puedes iniciar sesión.');
      setPassword('');
      setPasswordConfirmation('');
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'No se pudo crear la cuenta. Intenta nuevamente.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#0B1130] lg:bg-[#F6F8FC] dark:lg:bg-[#070B1E] overflow-x-hidden font-sans select-none">
      
      {/* LEFT COLUMN: ARQNOVA CASE SHOWCASE & HERO PANEL */}
      <div className="relative hidden lg:flex flex-1 lg:w-[55%] bg-gradient-to-br from-[#080D26] via-[#0D153A] to-[#181145] p-8 lg:p-14 flex-col justify-between overflow-hidden text-white border-r border-white/10">
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"></div>
        <div className="pointer-events-none absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl"></div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

        {/* Top Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[1.5px] shadow-lg shadow-indigo-500/30">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0A102E]">
                <svg className="h-7 w-7 text-indigo-300" viewBox="0 0 32 32" fill="none">
                  <path d="M16 26L6 20.5L16 15L26 20.5L16 26Z" fill="url(#logo-grad-reg-1)" opacity="0.6" />
                  <path d="M16 20L6 14.5L16 9L26 14.5L16 20Z" fill="url(#logo-grad-reg-2)" opacity="0.85" />
                  <path d="M16 14L6 8.5L16 3L26 8.5L16 14Z" fill="url(#logo-grad-reg-3)" />
                  <defs>
                    <linearGradient id="logo-grad-reg-1" x1="6" y1="20.5" x2="26" y2="20.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366F1" />
                      <stop offset="1" stopColor="#A855F7" />
                    </linearGradient>
                    <linearGradient id="logo-grad-reg-2" x1="6" y1="14.5" x2="26" y2="14.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#818CF8" />
                      <stop offset="1" stopColor="#C084FC" />
                    </linearGradient>
                    <linearGradient id="logo-grad-reg-3" x1="6" y1="8.5" x2="26" y2="8.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#A5B4FC" />
                      <stop offset="1" stopColor="#E879F9" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-wider text-white">ARQNOVA</span>
              <p className="text-[10px] font-bold tracking-[0.28em] text-indigo-300/80 uppercase">
                MODELA • COLABORA • GENERA
              </p>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="relative z-10 my-8 lg:my-10 space-y-8">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.18]">
              Únete a la nueva era <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                del modelado de software
              </span>
            </h2>
            <p className="text-sm sm:text-base text-indigo-200/80 leading-relaxed font-normal">
              Crea tu cuenta de anfitrión para diseñar diagramas UML, colaborar en tiempo real y transformar tus modelos en código ejecutable con Inteligencia Artificial.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5 border border-white/10 backdrop-blur-md">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 9h6"/></svg>
              </div>
              <span className="text-xs font-semibold text-indigo-100">Creación de proyectos ilimitados</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5 border border-white/10 backdrop-blur-md">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <span className="text-xs font-semibold text-purple-100">Generación de diagramas con IA</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] tracking-wider text-indigo-300/60 uppercase">
          <div>
            <span className="font-bold text-indigo-200">ARQNOVA</span>
            <span className="mx-2">•</span>
            <span>PLATAFORMA CASE</span>
          </div>
          <div>2025</div>
        </div>
      </div>

      {/* RIGHT COLUMN: REGISTRATION CARD PANEL */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative z-20">
        <div className="flex justify-end text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          <span>¿Ya tienes una cuenta?&nbsp;</span>
          <Link
            to="/login"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 transition cursor-pointer"
          >
            Inicia sesión
          </Link>
        </div>

        {/* Auth Card Container */}
        <div className="my-auto py-4 w-full max-w-[440px] mx-auto">
          <div className="rounded-3xl bg-white dark:bg-[#0E1535] p-7 sm:p-10 shadow-2xl shadow-indigo-950/10 dark:shadow-black/40 border border-slate-100/80 dark:border-slate-800/80 transition-colors">
            {/* Card Brand Header */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-400 p-[2px] shadow-lg shadow-indigo-500/25">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white dark:bg-[#0A102E]">
                  <svg className="h-8 w-8 text-indigo-600 dark:text-indigo-400" viewBox="0 0 32 32" fill="none">
                    <path d="M16 26L6 20.5L16 15L26 20.5L16 26Z" fill="#6366F1" opacity="0.4" />
                    <path d="M16 20L6 14.5L16 9L26 14.5L16 20Z" fill="#818CF8" opacity="0.8" />
                    <path d="M16 14L6 8.5L16 3L26 8.5L16 14Z" fill="#4F46E5" />
                  </svg>
                </div>
              </div>

              <span className="mt-3 text-xl font-extrabold tracking-wide text-slate-900 dark:text-white">ARQNOVA</span>
              <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400 dark:text-indigo-300/60 uppercase">
                PLATAFORMA CASE INTELIGENTE
              </p>

              <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Crear cuenta
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Regístrate para comenzar a modelar tus proyectos
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-3 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3.5 text-xs text-red-800 dark:text-red-300"
              >
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Success Alert */}
            {success ? (
              <div className="mt-6 text-center space-y-4">
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-5 text-emerald-800 dark:text-emerald-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold">¡Registro completado!</h3>
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300/90">{success}</p>
                  </div>
                </div>

                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 cursor-pointer"
                >
                  <span>Ir a Iniciar Sesión</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            ) : (
              /* Registration Form */
              <form className="mt-5 space-y-3.5" onSubmit={submit} noValidate={false}>
                {/* Name */}
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="reg-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={100}
                      disabled={busy}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Maddie Flores"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <input
                      id="reg-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={254}
                      disabled={busy}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@arqnova.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1">
                    Contraseña <span className="text-[10px] font-normal text-slate-400 lowercase">(mínimo 10 caracteres)</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={10}
                      disabled={busy}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="reg-confirm-password"
                      name="passwordConfirmation"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={10}
                      disabled={busy}
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        <span>Creando cuenta…</span>
                      </>
                    ) : (
                      <>
                        <span>Crear cuenta</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Bottom link to login */}
            <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              <span>¿Ya tienes una cuenta?&nbsp;</span>
              <Link
                to="/login"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 transition"
              >
                Inicia sesión
              </Link>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-end gap-2 text-xs text-slate-400 font-medium">
          <span className="italic">"La mejor arquitectura nace de una buena idea."</span>
          <span className="h-0.5 w-6 rounded-full bg-indigo-500"></span>
        </div>
      </div>
    </div>
  );
}
