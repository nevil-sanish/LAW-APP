import React from 'react';
import { motion } from 'motion/react';
import { Gavel, BrainCircuit, ShieldCheck, Library } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      onLogin();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full min-h-[100dvh] bg-surface">
      {/* Left Panel — Login */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-5 py-8 sm:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute top-5 left-5 sm:top-10 sm:left-10 flex items-center gap-2">
          <Gavel className="w-7 h-7 sm:w-8 sm:h-8 text-black" />
          <span className="font-display font-bold text-lg sm:text-xl">LegalAssist AI</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px] space-y-7 pt-16 sm:pt-12"
        >
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-black lg:text-5xl">
              Welcome
            </h1>
            <p className="text-base sm:text-lg text-on-surface-variant font-sans">
              Sign in to access your AI-powered legal workspace.
            </p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-outline-variant hover:bg-surface-container transition-all py-3.5 sm:py-4 px-4 rounded-xl shadow-sm font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg"
              >
                {error}
              </motion.p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs font-bold text-outline uppercase tracking-widest">Secure & Encrypted</span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2 sm:pt-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-on-secondary-container" />
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant">Bank-grade Security</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-blue-700" />
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant">AI-Powered</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Library className="w-5 h-5 text-amber-700" />
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant">Indian Law</span>
            </div>
          </div>

          <p className="text-center text-xs text-outline pt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>

      {/* Right Panel — Hero */}
      <div className="hidden lg:block lg:w-1/2 relative bg-slate-900 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200"
          alt="Law Office"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black/40" />

        <div className="relative h-full flex items-center justify-center p-12">
          <div className="grid grid-cols-2 gap-4 max-w-[560px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="col-span-2 glass-panel p-8 rounded-2xl space-y-4 shadow-2xl"
            >
              <BrainCircuit className="w-10 h-10 text-black mb-2" />
              <h2 className="text-3xl font-display font-bold text-black">
                Precision AI Assistance
              </h2>
              <p className="text-lg text-on-surface-variant">
                Accelerate your legal research with enterprise-grade AI tailored for Indian law.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 rounded-2xl space-y-3"
            >
              <ShieldCheck className="w-7 h-7 text-black" />
              <h3 className="text-lg font-bold text-black">Bank-grade Security</h3>
              <p className="text-sm text-on-surface-variant">
                Your case files remain encrypted and strictly confidential.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="glass-panel p-6 rounded-2xl space-y-3"
            >
              <Library className="w-7 h-7 text-black" />
              <h3 className="text-lg font-bold text-black">Indian Law Library</h3>
              <p className="text-sm text-on-surface-variant">
                Instant access to IPC, BNS, CPC, Constitution & more.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
