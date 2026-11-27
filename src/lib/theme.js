import { useEffect, useState } from 'react';

const root = () => document.documentElement;

export const getTheme = () => (root().classList.contains('dark') ? 'dark' : 'light');

function apply(next) {
  root().classList.toggle('dark', next === 'dark');
  root().dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0b0c08' : '#ecebe7');
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
}

// Switches the theme. When the browser supports view transitions, the new theme spreads out
// in a circle from `origin` (the switch that was pressed), like house lights going down.
export function setTheme(next, origin) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) {
    apply(next);
    return;
  }

  const x = origin?.x ?? window.innerWidth - 48;
  const y = origin?.y ?? 28;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = document.startViewTransition(() => apply(next));
  transition.ready.then(() => {
    root().animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 640, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

export const toggleTheme = (event) => {
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined;
  setTheme(getTheme() === 'dark' ? 'light' : 'dark', origin);
};

export function useTheme() {
  const [theme, setState] = useState(getTheme);
  useEffect(() => {
    const onChange = (e) => setState(e.detail);
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
  }, []);
  return theme;
}
