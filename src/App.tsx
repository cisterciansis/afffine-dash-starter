import React from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import OverviewTable from './components/OverviewTable';
import ActivityFeed from './components/ActivityFeed';
import { useTheme } from './hooks/useTheme';
import { useEnvironments } from './contexts/EnvironmentsContext';
import EnvironmentPage from './pages/EnvironmentPage';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { environments, loading: envLoading, error: envError } = useEnvironments();

  const navigate = useNavigate();

  // Keyboard shortcut: press "n" then up to 3 digits to jump to tabs (0 = Overview)
  const captureRef = React.useRef(false);
  const bufferRef = React.useRef<string>('');
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const commit = () => {
      const buf = bufferRef.current;
      captureRef.current = false;
      bufferRef.current = '';
      clearTimer();
      if (!buf) return;
      const idx = parseInt(buf, 10);
      if (Number.isNaN(idx)) return;
      if (idx === 0) {
        navigate('/');
        return;
      }
      const targetIndex = idx - 1;
      if (targetIndex >= 0 && targetIndex < environments.length) {
        const envName = environments[targetIndex];
        navigate(`/environment/${encodeURIComponent(envName)}`);
      }
    };

    const shouldIgnore = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return true;
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      const editable = (target as HTMLElement).isContentEditable;
      return (
        editable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'DIV' && target.getAttribute('role') === 'textbox')
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnore(e)) return;

      if (!captureRef.current) {
        if (e.key.toLowerCase() === 'n') {
          captureRef.current = true;
          bufferRef.current = '';
          clearTimer();
          e.preventDefault();
        }
        return;
      }

      if (/^\d$/.test(e.key)) {
        bufferRef.current += e.key;
        e.preventDefault();

        if (bufferRef.current.length >= 3) {
          commit();
          return;
        }
        clearTimer();
        timeoutRef.current = window.setTimeout(commit, 600);
      } else {
        if (bufferRef.current) {
          commit();
        } else {
          captureRef.current = false;
          bufferRef.current = '';
          clearTimer();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimer();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [environments, navigate]);

  const tabClass = (active: boolean) => {
    const base = 'px-6 py-3 font-mono text-xs uppercase tracking-wider border-r-2 last:border-r-0 transition-colors';
    if (active) {
      return `${base} ${theme === 'dark' ? 'bg-gray-800 text-white border-white' : 'bg-white text-gray-900 border-gray-300'}`;
    }
    return `${base} ${theme === 'dark'
      ? 'bg-black text-gray-300 border-white hover:bg-gray-800 hover:text-white'
      : 'bg-cream-100 text-gray-600 border-gray-300 hover:bg-white hover:text-gray-800'
    }`;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-black text-white' 
        : 'bg-cream-50 text-gray-800'
    }`}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      
      <main className="container mx-auto px-6 py-8">
        {/* Top Navigation Tabs */}
        <div className="mb-6">
          <div className="flex gap-0 border-2 border-b-0 rounded-none overflow-hidden">
            <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
              Overview
              <div className={`text-xs mt-1 font-mono ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                ALL MODELS
              </div>
            </NavLink>

            {/* Dynamic environment tabs */}
            {envLoading && (
              <div className={tabClass(false)}>Loading…</div>
            )}
            {!envLoading && envError && (
              <div className={tabClass(false)}>Error</div>
            )}
            {!envLoading && !envError && environments.map((env) => (
              <NavLink
                key={env}
                to={`/environment/${encodeURIComponent(env)}`}
                className={({ isActive }) => tabClass(isActive)}
              >
                {env}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Routed Content */}
        <Routes>
          <Route
            path="/"
            element={
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 order-1">
                  <OverviewTable theme={theme} />
                </div>
                <div className="lg:col-span-1 order-2">
                  <ActivityFeed theme={theme} />
                </div>
              </div>
            }
          />
          <Route path="/environment/:envName" element={<EnvironmentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
