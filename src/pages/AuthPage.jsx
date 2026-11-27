import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSampleAccount } from '../lib/supabase';
import { REEL, tmdbImage } from '../lib/reel';
import Icon from '../components/ui/Icon';

// Three columns of real posters drifting past each other, beside the form
const WALL = [
  [...REEL.movie.slice(0, 4), ...REEL.tv.slice(0, 2)],
  [...REEL.tv.slice(2, 6), ...REEL.movie.slice(4, 6)],
  [...REEL.movie.slice(6, 8), ...REEL.tv.slice(6, 8), ...REEL.movie.slice(0, 2)],
];

function PosterWall() {
  return (
    <div className="relative hidden h-full overflow-hidden rounded-[28px] bg-surface lg:block" aria-hidden="true">
      <div className="absolute inset-0 grid grid-cols-3 gap-3 p-3">
        {WALL.map((column, c) => (
          <div key={c} className="relative overflow-hidden">
            {/* The column is doubled so the loop has no seam */}
            <div className="flex flex-col gap-3" style={{ animation: `wall-${c % 2 ? 'down' : 'up'} ${46 + c * 8}s linear infinite` }}>
              {[...column, ...column].map((item, i) => (
                <img key={`${item.id}-${i}`} src={tmdbImage(item.poster, 'w342')} alt="" className="aspect-[2/3] w-full rounded-[10px] object-cover" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignupSubmitted, setIsSignupSubmitted] = useState(false);

  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // We add the 'options' object to explicitly set the redirect URL
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`
          }
        });

        if (error) throw error;

        // The sample account needs no confirmation email
        if (isSampleAccount) navigate('/discover');
        else setIsSignupSubmitted(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Client-side redirect to /discover without a hard browser reload
        navigate('/discover');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap grid gap-10 pb-10 pt-6 sm:pt-10 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <div className="flex flex-col justify-center lg:py-10">
        <div className="w-full max-w-[420px]" key={isSignUp ? 'up' : 'in'} style={{ animation: 'fade-up .6s var(--ease-out) both' }}>
          {isSignupSubmitted && isSignUp ? (
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--data-soft)]">
                <Icon name="check" strokeWidth={2.25} className="h-7 w-7" />
              </span>
              <h1 className="mt-6 text-[32px] font-extrabold leading-tight tracking-[-0.035em]">Check your email</h1>
              <p className="mt-3 text-[17px] leading-relaxed text-muted">
                We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Open it to finish creating your account, then sign in here.
              </p>
              <button onClick={() => setIsSignupSubmitted(false)} className="link mt-8 text-[15px]">
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[40px]">
                {isSignUp ? 'Start your queue' : 'Welcome back'}
              </h1>
              <p className="mt-3 text-[17px] leading-relaxed text-muted">
                {isSignUp
                  ? 'Free, for movies, TV and anime. Your lists stay private until you choose otherwise.'
                  : 'Sign in to pick up your queue where you left it.'}
              </p>

              <form onSubmit={handleAuth} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="auth-email" className="label">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="auth-password" className="label">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field"
                    required
                  />
                </div>

                {message && <p role="alert" className="text-[15px] font-semibold text-negative">{message}</p>}

                <button type="submit" className="btn btn-primary btn-lg mt-2 w-full" disabled={loading}>
                  {loading ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
                  {!loading && <Icon name="arrowRight" />}
                </button>
              </form>

              <p className="mt-6 text-[15px] text-muted">
                {isSignUp ? 'Already have an account?' : 'New to Queue Up?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setIsSignupSubmitted(false);
                    setMessage('');
                  }}
                  className="link"
                >
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
              </p>

              {isSampleAccount && (
                <p className="mt-8 rounded-[16px] bg-surface px-4 py-3 text-sm leading-relaxed">
                  <span className="font-semibold">Sample mode.</span> This build has no Supabase keys, so any email and password opens a
                  sample account kept in this browser. Add your keys to <code className="font-mono">.env</code> to use your real accounts.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <PosterWall />
    </div>
  );
}
