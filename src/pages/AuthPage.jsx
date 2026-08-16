import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignupSubmitted, setIsSignupSubmitted] = useState(false);

  const navigate = useNavigate(); // Initialize navigate

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
        
        // Trigger the success UI state
        setIsSignupSubmitted(true);
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
    <div className="min-h-screen bg-neutral-2 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full card">
        <h2 className="text-3xl font-bold text-primary-1 mb-6 text-center">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        
        {isSignupSubmitted && isSignUp ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
            <p className="text-emerald-600 font-bold text-lg flex flex-col items-center gap-2">
              <span className="text-4xl mb-2">✅</span> 
              Check your email for the confirmation link!
            </p>
            <p className="text-primary-2 text-sm mt-4">
              You can close this tab or return to sign in once confirmed.
            </p>
            <button 
              onClick={() => setIsSignupSubmitted(false)} 
              className="mt-8 text-sm font-medium text-secondary-1 hover:underline"
            >
              Wait, I need to use a different email
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-2 mb-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-2 border-2 border-neutral-3 rounded-lg px-4 py-3 focus:outline-none focus:border-accent-1 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-2 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-2 border-2 border-neutral-3 rounded-lg px-4 py-3 focus:outline-none focus:border-accent-1 transition-colors"
                  required
                />
              </div>
              
              {message && <p className="text-sm text-secondary-1 font-medium text-center">{message}</p>}
              
              <Button type="submit" className="w-full bg-accent-1! text-primary-1! hover:bg-white! py-3 text-lg mt-4" disabled={loading}>
                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>
            </form>
            
            <p className="text-center mt-6 text-primary-2 font-medium">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button 
                type="button" 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setIsSignupSubmitted(false);
                }}
                className="text-secondary-1 hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
