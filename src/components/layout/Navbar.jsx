import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import SearchDropdown from './SearchDropdown';

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const location = useLocation();

  // Keep state in sync with DOM on mount
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // Close the mobile menu automatically when the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load the profile picture for the Profile button, and update it live when it changes on the profile page
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAvatarUrl(data?.avatar_url || null);
      });

    const onProfileUpdated = (e) => setAvatarUrl(e.detail?.avatar_url || null);
    window.addEventListener('profile-updated', onProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('profile-updated', onProfileUpdated);
    };
  }, [userId]);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <nav className="fixed w-full z-50 bg-white/90 dark:bg-[#0b101e]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-500">
      <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">

        {/* Top bar for mobile layout (Logo + Hamburger) */}
        <div className="flex justify-between items-center w-full md:w-auto">
          <Link to={session ? "/discover" : "/"} aria-label="Queue Up home" className="group flex items-center gap-3 z-50 relative">
            <img
              src="/icon-192.png"
              alt=""
              className="w-10 h-10 rounded-xl ring-1 ring-black/10 dark:ring-white/10 shadow-md shadow-blue-500/20 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors">
              Queue <span className="text-blue-600 dark:text-[#00f0ff]">Up</span>
            </span>
          </Link>

          <button
            className="md:hidden z-50 relative p-2 focus:outline-none text-slate-900 dark:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className={`block h-0.5 w-full bg-current transition-all duration-300 ease-out ${isMobileMenuOpen ? 'rotate-45 translate-y-2.5' : ''}`}></span>
              <span className={`block h-0.5 w-full bg-current transition-all duration-300 ease-out ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block h-0.5 w-full bg-current transition-all duration-300 ease-out ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </div>
          </button>
        </div>

        {/* Desktop Search (live dropdown) */}
        <div className="hidden md:block flex-grow max-w-xl w-full mx-4">
          <SearchDropdown
            inputClassName="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 rounded-full px-5 py-2.5 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] transition-colors"
          />
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/discover" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium transition-colors">
            Discover
          </Link>
          <Link to="/queue" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium transition-colors">
            My Queue
          </Link>

          {session ? (
            <Link to="/profile">
              <button className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-1.5 rounded-lg shadow-sm border border-slate-300 dark:border-white/10 transition-all font-bold flex items-center gap-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-sm">👤</span>
                )}
                Profile
              </button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 dark:hover:bg-[#00c0cc] px-6 py-2 shadow-md transition-all font-bold">
                Sign In
              </Button>
            </Link>
          )}

          {/* THEME SWITCH */}
          <button
            onClick={toggleTheme}
            className="text-2xl hover:scale-110 transition-transform"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div className={`md:hidden fixed inset-0 w-full h-screen bg-white/95 dark:bg-[#0b101e]/95 backdrop-blur-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
            <button onClick={toggleTheme} className="text-4xl mb-4">{isDarkMode ? '☀️' : '🌙'}</button>
            <div className="w-full max-w-sm">
              <SearchDropdown
                placeholder="Search movies, shows..."
                onNavigate={() => setIsMobileMenuOpen(false)}
                inputClassName="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-full px-5 py-3 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] transition-colors"
              />
            </div>
            <Link to="/discover" className="text-2xl text-slate-800 dark:text-white font-medium transition-colors">Discover</Link>
            <Link to="/queue" className="text-2xl text-slate-800 dark:text-white font-medium transition-colors">My Queue</Link>
            {session ? (
              <Link to="/profile" className="mt-4">
                <Button className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-3 text-lg border border-slate-300 dark:border-white/10">Profile</Button>
              </Link>
            ) : (
              <Link to="/auth" className="mt-4">
                <Button className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] px-8 py-3 text-lg font-bold">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
