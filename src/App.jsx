import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import LandingPage from './pages/LandingPage';
import DiscoverPage from './pages/DiscoverPage';
import AuthPage from './pages/AuthPage';
import SearchPage from './pages/SearchPage';
import MovieDetailsPage from './pages/MovieDetailsPage';
import QueuePage from './pages/QueuePage';
import ProfilePage from './pages/ProfilePage';
import ShowDetailsPage from './pages/ShowDetailsPage';

export default function App() {
  return (
    <>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#fff',
            border: '1px solid #374151',
          },
        }}
      />
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/movie/:id" element={<MovieDetailsPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/tv/:id" element={<ShowDetailsPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </>
  );
}