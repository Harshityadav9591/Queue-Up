import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toggleTheme, useTheme } from '../../lib/theme';
import SearchDropdown from './SearchDropdown';
import Wordmark from '../ui/Mark';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

const navClass = ({ isActive }) =>
  `relative px-1 py-2 text-[15px] font-semibold transition-colors duration-300 ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

export function ThemeButton({ className = '' }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`icon-btn ${className}`}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'House lights up' : 'House lights down'}
    >
      <span className="relative h-5 w-5">
        <Icon name="sun" className={`absolute inset-0 h-5 w-5 transition-[rotate,scale,opacity] duration-500 ease-out-soft ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`} />
        <Icon name="moon" className={`absolute inset-0 h-5 w-5 transition-[rotate,scale,opacity] duration-500 ease-out-soft ${dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
      </span>
    </button>
  );
}

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const location = useLocation();

  // Close the mobile menu automatically when the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
  }, [location.pathname]);

  // Lock the page behind the open phone menu
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // A hairline appears under the bar only once content scrolls beneath it
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const email = session?.user?.email || '';

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-ground transition-shadow duration-300 ${scrolled ? 'shadow-[0_1px_0_var(--line)]' : ''}`}
      >
        <div className="wrap flex h-16 items-center gap-4 md:gap-8">
          <Wordmark to={session ? '/discover' : '/'} />

          <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
            <NavLink to="/discover" className={navClass}>Discover</NavLink>
            <NavLink to="/queue" className={navClass}>Queue</NavLink>
          </nav>

          {/* Desktop search (live dropdown) */}
          <div className="ml-auto hidden w-full max-w-[380px] md:block">
            <SearchDropdown />
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <ThemeButton className="hidden md:inline-grid" />

            {session ? (
              <NavLink
                to="/profile"
                aria-label="Your profile"
                className={({ isActive }) =>
                  `ml-1 hidden items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[15px] font-semibold transition-colors md:inline-flex ${isActive ? 'bg-surface' : 'hover:bg-surface'}`
                }
              >
                <Avatar url={avatarUrl} name={email} size="h-8 w-8 text-sm" />
                Profile
              </NavLink>
            ) : (
              <Link to="/auth" className="btn btn-primary btn-sm ml-2 hidden md:inline-flex">
                Sign in
              </Link>
            )}

            <button
              type="button"
              className="icon-btn md:hidden"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsMobileSearchOpen(true);
              }}
              aria-label="Open search"
              aria-expanded={isMobileSearchOpen}
              aria-controls="mobile-search-panel"
            >
              <Icon name="search" />
            </button>

            <button
              type="button"
              className="icon-btn md:hidden"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setIsMobileMenuOpen(true);
              }}
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {isMobileSearchOpen && (
        <div id="mobile-search-panel" className="fixed inset-x-0 top-16 z-50 border-b border-line bg-ground p-3 shadow-[0_12px_30px_-18px_var(--ink)] md:hidden">
          <div className="wrap flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <SearchDropdown autoFocus onNavigate={() => setIsMobileSearchOpen(false)} />
            </div>
            <button type="button" className="icon-btn -mt-1" onClick={() => setIsMobileSearchOpen(false)} aria-label="Close search">
              <Icon name="x" />
            </button>
          </div>
        </div>
      )}

      {/* Phone menu: a full-screen sheet with search, the places and the account */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ground md:hidden" role="dialog" aria-modal="true" aria-label="Menu" style={{ animation: 'fade-in .25s var(--ease-out) both' }}>
          <div className="wrap flex h-16 flex-none items-center justify-between">
            <Wordmark to={session ? '/discover' : '/'} />
            <button type="button" className="icon-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <Icon name="x" />
            </button>
          </div>

          <div className="wrap flex flex-1 flex-col overflow-y-auto pb-8 pt-2">
            <SearchDropdown onNavigate={() => setIsMobileMenuOpen(false)} />

            <nav aria-label="Main" className="mt-8 flex flex-col">
              {[
                ['/discover', 'Discover'],
                ['/queue', 'Your queue'],
                session ? ['/profile', 'Profile'] : ['/auth', 'Sign in'],
              ].map(([to, label], i) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `py-2 text-[40px] font-extrabold leading-[1.15] tracking-[-0.04em] ${isActive ? 'text-ink' : 'text-muted'}`}
                  style={{ animation: `fade-up .5s var(--ease-out) ${80 + i * 60}ms both` }}
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto flex items-center justify-between rounded-[18px] bg-surface p-2 pl-4">
              <span className="text-[15px] font-semibold">House lights</span>
              <ThemeButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
