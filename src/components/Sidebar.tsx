import React from 'react';
import {
  Gavel,
  MessageSquare,
  Upload,
  BookOpen,
  HelpCircle,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  Shield,
  LifeBuoy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { View, UserProfile } from '../types';
import { ADMIN_EMAIL } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (v: View) => void;
  user: UserProfile | null;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, onSignOut }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const navItems = [
    { id: 'chat' as View, label: 'Chat', icon: MessageSquare },
    { id: 'upload' as View, label: 'Upload Law', icon: Upload },
    { id: 'repository' as View, label: 'Study Law', icon: BookOpen },
    ...(isAdmin
      ? [{ id: 'admin' as View, label: 'Admin Panel', icon: Shield }]
      : []),
  ];

  const handleNav = (view: View) => {
    setView(view);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Gavel className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black leading-tight">LegalAssist AI</span>
          <span className="text-xs text-slate-400">Indian Law Expert</span>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-2 mb-6">
        <button
          onClick={() => handleNav('chat')}
          className="w-full bg-white text-slate-900 font-semibold text-sm py-3 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentView === item.id
                ? item.id === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 shadow-inner scale-[0.98]'
                  : 'bg-slate-800 text-white shadow-inner scale-[0.98]'
                : item.id === 'admin'
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
            {item.id === 'admin' && (
              <span className="ml-auto text-[9px] font-black bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Admin
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col gap-1">
        <button className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg text-sm transition-all">
          <HelpCircle className="w-5 h-5" />
          Support
        </button>

        {user && (
          <div className="flex items-center gap-3 px-4 py-3 text-slate-300">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm truncate">
                {user.displayName || user.email || 'User'}
              </span>
              {isAdmin && (
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
                  Administrator
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg text-sm transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-[280px] bg-slate-950 text-white flex-col p-4 z-50 border-r border-slate-800">
        {sidebarContent}
      </nav>

      {/* Mobile Utility Drawer Trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 right-3 z-50 md:hidden p-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm"
        aria-label="Open account menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-[280px] bg-slate-950 text-white flex flex-col p-4 z-[60] border-r border-slate-800"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition-colors ${
                  active
                    ? item.id === 'admin'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-950 text-white'
                    : item.id === 'admin'
                    ? 'text-amber-600'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
          >
            <LifeBuoy className="h-5 w-5" />
            <span>Account</span>
          </button>
        </div>
      </nav>
    </>
  );
};
