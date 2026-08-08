# 🎬 Queue Up

Queue Up is a premium, full-stack entertainment tracking application designed to help users organize their movie and TV show consumption. Built with a focus on seamless UX, it features a glassmorphism design, instant dark/light mode switching, and a robust backend for tracking viewing history.

## ✨ Key Features

* **Universal Search & Discovery:** Leverages the TMDB API to fetch dynamic, paginated data for both movies and TV shows using unified endpoints.
* **Smart Queue & Vault System:** Users can add titles to their active queue. Once marked as watched, items are automatically migrated to a dedicated "Completed Vault," keeping the active dashboard clean.
* **Advanced TV Show Tracking:** 
  * Granular tracking with an accordion-style UI to browse seasons and episodes.
  * Modal-based episode details (runtime, air date, guest stars, overview).
  * **Bulk Actions:** "Mark Season as Watched" functionality that runs background upsert queries to instantly log entire seasons to the database without UI lag.
* **Custom User Profiles:** Built-in Supabase Storage allowing users to upload custom avatars and banners, alongside editable nicknames and personal bios.
* **Premium UI/UX:** Fully responsive design utilizing Tailwind CSS, featuring glassmorphism overlays, dynamic gradients, and flawless theme toggling.

## 🛠️ Tech Stack

* **Frontend:** React, React Router, Tailwind CSS
* **Backend as a Service (BaaS):** Supabase (Authentication, PostgreSQL Database, Storage Buckets)
* **Data Provider:** TMDB (The Movie Database) API
* **Deployment & Build:** Vite

## 🚀 Getting Started

To run this project locally, follow these steps:

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/yourusername/queue-up.git
cd queue-up
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a `.env` file in the root directory and add your API keys (see `.env.example` for reference):
\`\`\`text
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### 4. Run the development server
\`\`\`bash
npm run dev
\`\`\`

## 🗄️ Database Schema Snapshot

This app utilizes several interconnected Supabase tables governed by strict Row Level Security (RLS) policies:
* `watchlist`: Tracks active movies/shows.
* `completed_items`: Vault for finished media.
* `watched_movies`: Tracks standalone completed movies.
* `watched_seasons` & `watched_episodes`: Granular tracking for TV shows to prevent duplicate entries and enable bulk upserts.

## 👨‍💻 Author

**Harshit Yadav**
* B.Tech Computer Science & Internet of Things, Netaji Subhas University of Technology (East Campus)
* Focused on building high-performance applications with React, Python, and scalable backend architectures.
