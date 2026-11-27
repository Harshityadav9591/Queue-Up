import { Link } from 'react-router-dom';

// TMDB asks every app that uses its data to credit it like this
export const TMDB_NOTICE = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

// The quiet close under every app screen
export default function Footer() {
  return (
    <footer className="wrap mt-24 pb-10">
      <div className="flex flex-col gap-3 border-t border-line pt-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          &copy; {new Date().getFullYear()} Queue Up. Titles, posters and ratings from{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">TMDB</a>.
          {' '}{TMDB_NOTICE}
        </p>
        <nav aria-label="Footer" className="flex flex-none gap-5 font-semibold text-ink">
          <Link to="/discover" className="underline-offset-4 hover:underline">Discover</Link>
          <Link to="/queue" className="underline-offset-4 hover:underline">Queue</Link>
          <Link to="/profile" className="underline-offset-4 hover:underline">Profile</Link>
        </nav>
      </div>
    </footer>
  );
}
