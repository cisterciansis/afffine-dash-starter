import React from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import OverviewTable from './components/OverviewTable';
import ActivityFeed from './components/ActivityFeed';
import { useTheme } from './hooks/useTheme';
import { useEnvironments } from './contexts/EnvironmentsContext';
import EnvironmentPage from './pages/EnvironmentPage';
const NetworkActivityChart = React.lazy(() => import('./components/NetworkActivityChart'));
const EnvironmentStatsChart = React.lazy(() => import('./components/EnvironmentStatsChart'));
const MinerEfficiencyChart = React.lazy(() => import('./components/MinerEfficiencyChart'));
const GpuMarketShareDonut = React.lazy(() => import('./components/GpuMarketShareDonut'));
const CostPerformanceScatter = React.lazy(() => import('./components/CostPerformanceScatter'));

function App() {
  const { theme, toggleTheme } = useTheme();
  const { environments, loading: envLoading, error: envError } = useEnvironments();

  const navigate = useNavigate();

  // Responsive controls for environment tabs overflow
  const [maxVisible, setMaxVisible] = React.useState<number>(6);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setMaxVisible(2);
      else if (w < 640) setMaxVisible(3);
      else if (w < 768) setMaxVisible(4);
      else if (w < 1024) setMaxVisible(5);
      else if (w < 1280) setMaxVisible(6);
      else setMaxVisible(8);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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
    const base = 'px-6 py-3 font-mono text-xs uppercase tracking-wider border-r-2 last:border-r-0 transition-colors min-w-0 text-left';
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
          <div className="relative flex gap-0 border-2 border-b-0 rounded-none overflow-visible">
            <NavLink
              to="/"
              end
              className={({ isActive }) => tabClass(isActive)}
              title="Press N then 0 to switch to Overview"
            >
              <div className="flex flex-col items-start">
                <span className="truncate">Overview</span>
                <span
                  className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-1 text-[10px] leading-none font-mono`}
                >
                  N + 0
                </span>
              </div>
            </NavLink>

            {/* Dynamic environment tabs */}
            {envLoading && (
              <div className={tabClass(false)}>Loading…</div>
            )}
            {!envLoading && envError && (
              <div className={tabClass(false)}>Error</div>
            )}
            {!envLoading && !envError && (() => {
              const items = environments.map((env, i) => ({ env, i }));
              const visible = items.slice(0, maxVisible);
              const overflow = items.slice(maxVisible);
              return (
                <>
                  {visible.map(({ env, i }) => (
                    <NavLink
                      key={env}
                      to={`/environment/${encodeURIComponent(env)}`}
                      className={({ isActive }) => tabClass(isActive)}
                      title={`Press N then ${i + 1} to switch to ${env}`}
                    >
                      <div className="flex flex-col items-start min-w-0">
                        <span className="truncate max-w-[12rem]">{env}</span>
                        <span
                          className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-1 text-[10px] leading-none font-mono`}
                        >
                          N + {i + 1}
                        </span>
                      </div>
                    </NavLink>
                  ))}

                  {overflow.length > 0 && (
                    <div className="relative" ref={moreRef}>
                      <button
                        type="button"
                        className={tabClass(false)}
                        onClick={() => setMoreOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={moreOpen}
                        title="Show more environments"
                      >
                        <span className="sr-only">More environments</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                          className="mx-1"
                        >
                          <circle cx="12" cy="5" r="2"></circle>
                          <circle cx="12" cy="12" r="2"></circle>
                          <circle cx="12" cy="19" r="2"></circle>
                        </svg>
                      </button>

                      {moreOpen && (
                        <div
                          className={`absolute right-0 top-full z-20 w-72 max-h-80 overflow-auto border-2 ${
                            theme === 'dark'
                              ? 'bg-gray-900 border-white text-gray-100'
                              : 'bg-white border-gray-300 text-gray-800'
                          }`}
                          role="menu"
                        >
                          <div className="py-1">
                            {overflow.map(({ env, i }) => (
                              <NavLink
                                key={env}
                                to={`/environment/${encodeURIComponent(env)}`}
                                className={({ isActive }) =>
                                  `flex items-center justify-between gap-2 px-3 py-2 font-mono text-sm hover:underline ${
                                    isActive
                                      ? theme === 'dark'
                                        ? 'bg-gray-800'
                                        : 'bg-cream-100'
                                      : ''
                                  }`
                                }
                                onClick={() => setMoreOpen(false)}
                                role="menuitem"
                              >
                                <span className="truncate">{env}</span>
                                <span className="text-[10px] opacity-70">N + {i + 1}</span>
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Routed Content */}
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 order-1">
                    <OverviewTable theme={theme} />
                  </div>
                  <div className="lg:col-span-1 order-2">
                    <ActivityFeed theme={theme} />
                  </div>
                </div>

                <React.Suspense
                  fallback={
                    <div className="space-y-6">
                      <div className="h-64 border-2 rounded-none flex items-center justify-center">
                        <span className="text-xs font-mono">Loading charts…</span>
                      </div>
                      <div className="h-64 border-2 rounded-none flex items-center justify-center">
                        <span className="text-xs font-mono">Loading charts…</span>
                      </div>
                      <div className="h-64 border-2 rounded-none flex items-center justify-center">
                        <span className="text-xs font-mono">Loading charts…</span>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-6">
                    <NetworkActivityChart theme={theme} />
                    <EnvironmentStatsChart theme={theme} />
                    <MinerEfficiencyChart theme={theme} />

                    {/* Advanced Insights */}
                    <GpuMarketShareDonut theme={theme} />
                    <CostPerformanceScatter theme={theme} />
                  </div>
                </React.Suspense>
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
