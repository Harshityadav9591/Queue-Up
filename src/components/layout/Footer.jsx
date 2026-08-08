import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-100 dark:bg-[#0b101e] border-t border-slate-200 dark:border-white/10 py-8 transition-colors duration-500">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm transition-colors">
            &copy; 2026 Queue Up. All rights reserved.
          </p>
          
          <div className="flex gap-6">
            <Link to="/privacy" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] text-sm font-medium transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] text-sm font-medium transition-colors">
              Terms of Service
            </Link>
            <Link to="/contact" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] text-sm font-medium transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}