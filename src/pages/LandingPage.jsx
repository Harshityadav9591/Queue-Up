import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Footer from '../components/layout/Footer';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/discover', { replace: true });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/discover', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    // Main wrapper switches from soft slate in light mode to deep midnight in dark mode
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] text-slate-800 dark:text-slate-300 font-sans relative overflow-hidden transition-colors duration-500">
      
      {/* --- GLOBAL BACKGROUND ORBS (Pastel in light mode, Neon in dark mode) --- */}
      <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-blue-400/20 dark:bg-[#00f0ff]/10 rounded-full blur-[120px] pointer-events-none z-0 transition-colors duration-700"></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0 transition-colors duration-700"></div>
      
      {/* Page Content Wrapper */}
      <div className="relative z-10 pt-24 pb-12">
        
        {/* =========================================
            1. HERO SECTION 
        ========================================= */}
        <div className="container mx-auto px-6 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Text */}
            <div className="text-left">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 dark:text-white leading-[1.1] mb-6 tracking-tight transition-colors">
                NEVER MISS A PREMIERE.<br />
                TRACK ALL YOUR <br />
                ENTERTAINMENT.
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-xl mb-10 leading-relaxed transition-colors">
                The ultimate platform for movie & TV buffs to organize their watching experience.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-5">
                <Link to="/discover">
                  <Button className="w-full sm:w-auto bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] font-extrabold text-lg px-8 py-4 rounded-lg shadow-lg dark:shadow-[0_0_30px_-5px_rgba(0,240,255,0.6)] hover:bg-blue-700 hover:dark:shadow-[0_0_45px_0_rgba(0,240,255,0.8)] hover:-translate-y-1 transition-all duration-300">
                    Start Tracking
                  </Button>
                </Link>
                <Link to="/auth">
                  <button className="w-full sm:w-auto bg-white/50 dark:bg-transparent border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-bold text-lg px-8 py-4 rounded-lg hover:border-slate-400 dark:hover:border-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300">
                    Explore Features
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Glass Dashboard Mockup */}
            <div className="relative hidden lg:block w-full max-w-lg ml-auto">
              {/* Inner glow specifically behind the glass card */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-purple-300/30 dark:bg-purple-500/20 rounded-full blur-[80px] -z-10 transition-colors"></div>
              
              {/* The Glass Card */}
              <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/10 pb-4 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-600 dark:bg-[#00f0ff] flex items-center justify-center text-white dark:text-[#0b101e] font-black text-xs">QU</div>
                    <span className="text-slate-900 dark:text-white font-bold text-lg transition-colors">Dashboard</span>
                  </div>
                  <div className="w-48 h-8 bg-slate-100 dark:bg-black/40 rounded-md border border-slate-200 dark:border-white/5 flex items-center px-3 transition-colors">
                    <span className="text-slate-400 dark:text-slate-500 text-sm">🔍 Search...</span>
                  </div>
                </div>
                
                <p className="text-slate-800 dark:text-white font-semibold mb-4 text-sm transition-colors">Recent Movies</p>
                
                {/* 100% UNBREAKABLE GRID */}
                <div className="flex justify-between gap-3">
                  {[
                    { p: 40, img: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg' }, // Dune
                    { p: 75, img: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' }, // Oppenheimer
                    { p: 20, img: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg' }, // The Dark Knight
                    { p: 90, img: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg' }  // Spider-Man
                  ].map((item, index) => (
                    <div key={index} className="w-1/4 flex flex-col gap-2">
                      <div className="w-full pb-[150%] relative rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/10 shadow-sm">
                         <img 
                           src={item.img} 
                           alt="Movie Poster" 
                           className="absolute top-0 left-0 w-full h-full object-cover" 
                         />
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 dark:bg-[#00f0ff]" style={{ width: `${item.p}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            2. WHY QUEUE UP SECTION 
        ========================================= */}
        <section className="container mx-auto px-6 mb-32 relative">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white text-center mb-16 transition-colors">Why Queue Up?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-8 hover:bg-white/90 dark:hover:bg-slate-800/50 transition-all">
              <div className="w-14 h-14 bg-blue-100 dark:bg-[#00f0ff]/20 rounded-xl flex items-center justify-center mb-6 border border-blue-200 dark:border-[#00f0ff]/30 transition-colors">
                <span className="text-3xl">🤖</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 transition-colors">Personalized Recommendations</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                Queue Up uses AI to curate personalized recommendations based on your watch history, ensuring you always find something you'll love.
              </p>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-8 hover:bg-white/90 dark:hover:bg-slate-800/50 transition-all">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 border border-purple-200 dark:border-purple-500/30 transition-colors">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 transition-colors">Powerful Statistics</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                Track your ratings and viewing habits with detailed statistics. Visualize your binge-watching journey over time.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================
            3. BEAUTIFUL INTERFACE PREVIEW
        ========================================= */}
        <section className="container mx-auto px-6 mb-32 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-12 transition-colors">Beautiful Interface</h2>
          
          <div className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl dark:shadow-[0_0_50px_rgba(0,240,255,0.1)] mb-12 group transition-all">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#0b101e] via-transparent to-transparent z-10 transition-colors"></div>
            <img src="/mockupbig.png" alt="UI Concept Preview" className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
              <Link to="/discover">
                <Button className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] font-extrabold px-10 py-3 rounded-full shadow-lg dark:shadow-[0_0_30px_-5px_rgba(0,240,255,0.6)] hover:scale-105 transition-transform">
                  Try Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================
            4. BY THE NUMBERS
        ========================================= */}
        <section className="container mx-auto px-6 mb-32">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white text-center mb-16 transition-colors">By The Numbers</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-10 text-center transition-all">
              <h3 className="text-5xl font-black text-blue-600 dark:text-[#00f0ff] mb-2 dark:drop-shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-colors">Thousands</h3>
              <p className="text-xl text-slate-900 dark:text-white font-bold mb-4 transition-colors">Of Titles</p>
              <p className="text-slate-600 dark:text-slate-400 transition-colors">Explore a vast library of movies, TV shows, and anime.</p>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-10 text-center transition-all">
              <h3 className="text-5xl font-black text-purple-600 dark:text-purple-400 mb-2 dark:drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-colors">Millions</h3>
              <p className="text-xl text-slate-900 dark:text-white font-bold mb-4 transition-colors">Of Ratings</p>
              <p className="text-slate-600 dark:text-slate-400 transition-colors">Get insights from millions of user ratings to make informed decisions.</p>
            </div>

          </div>
        </section>

        {/* =========================================
            5. WHAT OUR USERS SAY (TESTIMONIALS)
        ========================================= */}
        <section className="container mx-auto px-6 mb-32">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white text-center mb-16 transition-colors">What Our Users Say</h2>
          <div className="grid md:grid-cols-2 gap-8">
            
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-8 relative transition-all">
              <span className="absolute top-6 right-8 text-6xl text-slate-200 dark:text-white/5 font-serif transition-colors">"</span>
              <p className="text-lg text-slate-700 dark:text-slate-300 italic mb-8 relative z-10 transition-colors">
                Queue Up has changed the way I discover new movies and TV shows. Highly recommended!
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden transition-colors">
                  <img src="https://i.pravatar.cc/150?img=47" alt="User" />
                </div>
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold transition-colors">Jane Doe</h4>
                  <p className="text-slate-500 text-sm transition-colors">Tech Enthusiast</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-8 relative transition-all">
              <span className="absolute top-6 right-8 text-6xl text-slate-200 dark:text-white/5 font-serif transition-colors">"</span>
              <p className="text-lg text-slate-700 dark:text-slate-300 italic mb-8 relative z-10 transition-colors">
                The user interface is sleek and intuitive. It's an absolute joy to use every single day.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden transition-colors">
                  <img src="https://i.pravatar.cc/150?img=11" alt="User" />
                </div>
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold transition-colors">John Smith</h4>
                  <p className="text-slate-500 text-sm transition-colors">Busy Professional</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* =========================================
            6. FAQ
        ========================================= */}
        <section className="container mx-auto px-6 mb-24 max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white text-center mb-12 transition-colors">Frequently Asked Questions</h2>
          <div className="space-y-4">
            
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none rounded-xl p-6 transition-all">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2 transition-colors">How do I get started?</h4>
              <p className="text-slate-600 dark:text-slate-400 transition-colors">Sign up for an account and start exploring our curated library of content immediately.</p>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none rounded-xl p-6 transition-all">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2 transition-colors">Is there a premium plan?</h4>
              <p className="text-slate-600 dark:text-slate-400 transition-colors">No, Queue Up is completely free to use. Enjoy all features without any hidden limits.</p>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-none rounded-xl p-6 transition-all">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2 transition-colors">What devices can I use it on?</h4>
              <p className="text-slate-600 dark:text-slate-400 transition-colors">You can use Queue Up on your computer, tablet, and mobile device seamlessly.</p>
            </div>

          </div>
        </section>

      </div>

      {/* =========================================
          7. FOOTER 
      ========================================= */}
      <Footer />

    </div>
  );
}