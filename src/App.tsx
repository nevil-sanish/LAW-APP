import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ChatView } from './components/ChatView';
import { UploadView } from './components/UploadView';
import { RepositoryView } from './components/RepositoryView';
import { AdminView } from './components/AdminView';
import type { View, UserProfile } from './types';
import { ADMIN_EMAIL } from './types';

export default function App() {
  const [view, setView] = React.useState<View>('chat');
  const [user] = React.useState<UserProfile>({
    uid: 'local-admin-user',
    displayName: 'Local Admin',
    email: ADMIN_EMAIL,
    photoURL: null,
  });

  const isAdmin = user.email === ADMIN_EMAIL;

  const getTitle = () => {
    switch (view) {
      case 'chat':
        return 'Legal Assistant Chat';
      case 'upload':
        return 'Upload Law';
      case 'repository':
        return 'Study Law';
      case 'admin':
        return 'Admin Panel';
      default:
        return 'Legal Assistant';
    }
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar
        currentView={view}
        setView={setView}
        user={user}
      />

      <main className="flex-1 md:ml-[280px] h-[100dvh] flex flex-col overflow-hidden relative">
        <TopNav title={getTitle()} user={user} setView={setView} />

        <div className="flex-1 overflow-hidden pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {view === 'chat' && <ChatView user={user} />}
              {view === 'upload' && <UploadView user={user} />}
              {view === 'repository' && <RepositoryView />}
              {view === 'admin' && isAdmin && <AdminView user={user} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
