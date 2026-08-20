import React from 'react';
import { Search, Bell, Settings, Shield } from 'lucide-react';
import type { UserProfile, View } from '../types';
import { ADMIN_EMAIL } from '../types';

interface TopNavProps {
  title: string;
  user: UserProfile | null;
  setView?: (v: View) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ title, user, setView }) => {
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <header className="min-h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-40">
      <div className="min-w-0">
        <p className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400">
          LegalAssist AI
        </p>
        <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900 font-display truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4 pr-12 md:pr-0">
        <div className="relative w-64 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search matters..."
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {/* Admin Button — only visible for admin */}
          {isAdmin && setView && (
            <button
              onClick={() => setView('admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-sm mr-1"
              title="Admin Panel"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}

          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full border-2 border-white" />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 md:ml-2">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Profile'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
              {user?.displayName?.[0] || '?'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
