import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Profile Customization State
  const [nickname, setNickname] = useState('My Account');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [quote, setQuote] = useState('');
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Analytics State
  const [stats, setStats] = useState({
    queueMovies: 0,
    queueShows: 0,
    watchedMovies: 0,
    completedShows: 0
  });

  useEffect(() => {
    async function getProfileAndStats() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setSession(session);

      // Load Metadata (Name, Avatar, Banner, Quote)
      if (session.user.user_metadata) {
        if (session.user.user_metadata.nickname) setNickname(session.user.user_metadata.nickname);
        if (session.user.user_metadata.avatar_url) setAvatarUrl(session.user.user_metadata.avatar_url);
        if (session.user.user_metadata.banner_url) setBannerUrl(session.user.user_metadata.banner_url);
        if (session.user.user_metadata.quote) setQuote(session.user.user_metadata.quote);
      }

      // Fetch Analytics Counts concurrently for speed
      const [qMovies, qShows, wMovies, cShows] = await Promise.all([
        supabase.from('watchlist').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('media_type', 'movie'),
        supabase.from('watchlist').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('media_type', 'tv'),
        supabase.from('watched_movies').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id),
        supabase.from('completed_items').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('media_type', 'tv')
      ]);

      setStats({
        queueMovies: qMovies.count || 0,
        queueShows: qShows.count || 0,
        watchedMovies: wMovies.count || 0,
        completedShows: cShows.count || 0
      });

      setLoading(false);
    }
    getProfileAndStats();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate('/');
  };

  // --- SAVE TEXT DATA LOGIC ---
  const handleSaveText = async (field, value, setEditing) => {
    if (field === 'nickname' && !value.trim()) return toast.error("Nickname cannot be empty!");
    
    const toastId = toast.loading("Saving...");
    const { error } = await supabase.auth.updateUser({
      data: { [field]: value.trim() }
    });

    if (error) {
      toast.error(error.message, { id: toastId });
    } else {
      toast.success("Profile updated!", { id: toastId });
      setEditing(false);
    }
  };

  // --- UPLOAD IMAGE LOGIC (Handles both Avatar & Banner) ---
  const uploadImage = async (event, type) => {
    try {
      if (type === 'avatar') setUploadingAvatar(true);
      else setUploadingBanner(true);
      
      if (!event.target.files || event.target.files.length === 0) throw new Error('You must select an image to upload.');

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${type}-${Math.random()}.${fileExt}`;
      const toastId = toast.loading(`Uploading ${type}...`);

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const metadataField = type === 'avatar' ? 'avatar_url' : 'banner_url';
      const { error: updateError } = await supabase.auth.updateUser({
        data: { [metadataField]: publicUrl }
      });

      if (updateError) throw updateError;

      if (type === 'avatar') setAvatarUrl(publicUrl);
      else setBannerUrl(publicUrl);
      
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} updated!`, { id: toastId });
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex justify-center items-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] py-24 px-4 sm:px-6 transition-colors duration-500">
      <div className="container mx-auto max-w-5xl">
        
        {/* Main Profile Container */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500">
          
          {/* --- BANNER UPLOAD SECTION --- */}
          <label className="block h-48 md:h-64 w-full relative group cursor-pointer bg-slate-200 dark:bg-slate-800 overflow-hidden">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Profile Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-center">
                <span className="text-slate-500 font-medium tracking-widest uppercase text-sm">Add Banner Image</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-bold bg-black/60 px-4 py-2 rounded-lg backdrop-blur-sm">
                {uploadingBanner ? 'Uploading...' : 'Change Banner'}
              </span>
            </div>
            <input type="file" accept="image/*" onChange={(e) => uploadImage(e, 'banner')} disabled={uploadingBanner} className="hidden" />
          </label>
          
          <div className="px-6 md:px-12 pb-12 relative">
            
            {/* Top Row: Avatar & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end -mt-16 md:-mt-20 mb-8 gap-6 relative z-10">
              
              {/* --- AVATAR UPLOAD --- */}
              {/* FIXED: Added 'relative' so the hover overlay stays trapped in the circle */}
              <label className="relative w-32 h-32 md:w-40 md:h-40 bg-slate-900 dark:bg-[#0b101e] rounded-full border-4 border-white dark:border-[#0b101e] flex items-center justify-center shadow-xl transition-colors duration-500 overflow-hidden cursor-pointer group flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">👤</span>
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-bold">{uploadingAvatar ? '...' : 'Upload'}</span>
                </div>
                <input type="file" accept="image/*" onChange={(e) => uploadImage(e, 'avatar')} disabled={uploadingAvatar} className="hidden" />
              </label>

              <button onClick={handleSignOut} className="px-6 py-2.5 rounded-lg font-bold text-red-500 border-2 border-red-500/30 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm w-full md:w-auto">
                Sign Out
              </button>
            </div>
            
            {/* --- USER INFO (Name & Quote) --- */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-10 transition-colors">
              
              {/* Nickname */}
              {isEditingName ? (
                <div className="flex items-center gap-3 mb-2">
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-3xl font-black focus:outline-none w-full max-w-xs" autoFocus />
                  <button onClick={() => handleSaveText('nickname', nickname, setIsEditingName)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Save</button>
                  <button onClick={() => setIsEditingName(false)} className="text-slate-500 text-sm font-medium">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{nickname}</h1>
                  <button onClick={() => setIsEditingName(true)} className="text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] transition-colors" title="Edit Name">✎</button>
                </div>
              )}
              
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">{session?.user?.email}</p>

              {/* Quote / Bio */}
              {isEditingQuote ? (
                <div className="flex items-center gap-3 mt-4">
                  <input type="text" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="A country man, a humble ronin..." className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-md italic focus:outline-none w-full max-w-md" autoFocus />
                  <button onClick={() => handleSaveText('quote', quote, setIsEditingQuote)} className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-sm">Save</button>
                  <button onClick={() => setIsEditingQuote(false)} className="text-slate-500 text-sm font-medium">Cancel</button>
                </div>
              ) : (
                <div className="flex items-start gap-2 mt-4 text-slate-700 dark:text-slate-300">
                  <span className="text-blue-600 dark:text-[#00f0ff] font-serif text-2xl leading-none">❝</span>
                  <p className="text-md italic font-medium pt-1">
                    {quote || "Add a quote or bio to your profile..."}
                  </p>
                  <button onClick={() => setIsEditingQuote(true)} className="text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] transition-colors ml-2 pt-1" title="Edit Quote">✎</button>
                </div>
              )}
            </div>
            
            {/* --- ANALYTICS SECTION --- */}
            <div className="mt-10">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Stats & Analytics</h2>
              
              {/* Detailed Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
                
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-blue-600 dark:text-[#00f0ff] mb-2">{stats.queueMovies}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Movies in Queue</p>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2">{stats.queueShows}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Shows in Queue</p>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{stats.watchedMovies}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Movies Watched</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{stats.completedShows}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Shows Completed</p>
                </div>
                
              </div>

              {/* Total Runtime Box (UI Prepared for Next Step) */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#0b101e] dark:to-slate-900 border border-slate-700 dark:border-white/10 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-xl">
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">Total Time Wasted (Worth It)</h3>
                  <p className="text-slate-400 text-sm">Calculated from completed movies and shows.</p>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  {/* Hardcoded cool visual format for now until we hook up the DB logic */}
                  <p className="text-3xl font-black text-[#00f0ff]">
                    <span className="text-white text-xl mr-1">⏱</span> 
                    4m 12d 8h
                  </p>
                  <p className="text-slate-500 text-xs mt-1 italic">Backend calculation coming soon...</p>
                </div>
              </div>

            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}