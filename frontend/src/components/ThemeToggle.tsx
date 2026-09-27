import React from 'react';
import { useTheme } from '../modules/theme/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A2552] hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      <div className="flex items-center justify-center h-4 w-4 text-indigo-600 dark:text-amber-400 transition-transform duration-300">
        {isDark ? (
          /* Sun Icon for Switching to Light */
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          /* Moon Icon for Switching to Dark */
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </div>
      <span className="text-[11px] font-medium tracking-tight">
        {isDark ? 'Modo oscuro' : 'Modo claro'}
      </span>
      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-xs" title="Tema activo"></span>
    </button>
  );
}
