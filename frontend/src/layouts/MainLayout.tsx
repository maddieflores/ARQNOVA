import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';

export function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isEditor = /\/projects\/[^/]+\/editor$/.test(location.pathname);
  const isAiProposal = /\/projects\/[^/]+\/ai-proposal$/.test(location.pathname);
  const isProjectDetailPage = /^\/projects\/[^/]+$/.test(location.pathname);
  const isParticipantsPage = /\/projects\/[^/]+\/participants$/.test(location.pathname);
  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';
  const isDashboardPage = location.pathname === '/dashboard';
  const isProjectsPage = location.pathname === '/projects';
  const isFrontendGenerator = /\/frontend-generator/.test(location.pathname);
  const isAiNewDiagramPage = location.pathname === '/generate-with-ai' || location.pathname === '/ai/generate';

  if (
    isLoginPage ||
    isRegisterPage ||
    isDashboardPage ||
    isProjectsPage ||
    isEditor ||
    isAiProposal ||
    isProjectDetailPage ||
    isParticipantsPage ||
    isFrontendGenerator ||
    isAiNewDiagramPage
  ) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D24] text-slate-900 dark:text-slate-100 transition-colors">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-5">
        <nav className="mx-auto flex max-w-4xl flex-wrap gap-6 text-sm font-medium">
          <NavLink to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">ARQNOVA</NavLink>
          <NavLink to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400">Login</NavLink>
          <NavLink to="/dashboard" className="hover:text-indigo-600 dark:hover:text-indigo-400">Dashboard</NavLink>
          {user?.role.name === 'ADMINISTRADOR' && <NavLink to="/admin/users" className="hover:text-indigo-600 dark:hover:text-indigo-400">Gestión de usuarios</NavLink>}
          {user?.role.name === 'ANFITRION' && <NavLink to="/projects" className="hover:text-indigo-600 dark:hover:text-indigo-400">Proyectos</NavLink>}
          {user?.role.name === 'COLABORADOR' && <NavLink to="/shared-projects" className="hover:text-indigo-600 dark:hover:text-indigo-400">Proyectos compartidos</NavLink>}
        </nav>
      </header>
      <main className={isEditor ? '' : 'mx-auto max-w-4xl p-6'}>
        <Outlet />
      </main>
    </div>
  );
}
