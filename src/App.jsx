import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LandingPage from './pages/LandingPage';
import DiscoverPage from './pages/DiscoverPage';
import AuthPage from './pages/AuthPage';
import SearchPage from './pages/SearchPage';
import MovieDetailsPage from './pages/MovieDetailsPage';
import QueuePage from './pages/QueuePage';
import ProfilePage from './pages/ProfilePage';
import ShowDetailsPage from './pages/ShowDetailsPage';
import PublicProfilePage from './pages/PublicProfilePage';
import { isSampleCatalogue } from './lib/tmdb';
import { MOVIES, SHOWS } from './lib/demo/catalogue';

function Shell() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const showFooter = !isLanding && location.pathname !== '/auth';

  return (
    <div className="flex min-h-screen flex-col">
      {!isLanding && <Navbar />}
      {/* Keyed on the path, so every page arrives with the same short rise instead of snapping in */}
      <main key={location.pathname} className={`flex-grow ${isLanding ? '' : 'route-enter'}`}>
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/movie/:id" element={<MovieDetailsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/tv/:id" element={<ShowDetailsPage />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
      {isSampleCatalogue && !isLanding && (
        <p className="wrap -mt-6 pb-8 text-[13px] text-muted">
          Sample catalogue: this build has no TMDB key, so it shows {MOVIES.length + SHOWS.length} sample titles. Add your keys to .env to load the full catalogue.
        </p>
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 2800,
          style: {
            background: 'var(--ink)',
            color: 'var(--ground)',
            borderRadius: '999px',
            padding: '10px 18px',
            fontSize: '15px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-float)',
          },
          success: { iconTheme: { primary: 'var(--data)', secondary: 'var(--ink)' } },
          error: { iconTheme: { primary: 'var(--negative)', secondary: 'var(--ground)' } },
        }}
      />
      <Router>
        <Shell />
      </Router>
    </>
  );
}
