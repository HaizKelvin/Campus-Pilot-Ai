import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, LogIn, LogOut, Loader2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { AppState } from '../types';

interface AuthProps {
  onAuthenticated: (user: any, userData: AppState) => void;
  onLogout: () => void;
  currentUser: any;
}

export const Auth: React.FC<AuthProps> = ({ onAuthenticated, onLogout, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    university: '',
    country: '',
    isInternational: false
  });

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        setTempUser(user);
        setOnboardingData({
          ...onboardingData,
          name: user.displayName || '',
        });
        setShowOnboarding(true);
      } else {
        onAuthenticated(user, userSnap.data() as AppState);
      }
    } catch (err: any) {
      setError("Authentication failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const submitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    setLoading(true);

    const userData: AppState = {
      profile: {
        name: onboardingData.name,
        university: onboardingData.university,
        year: 1,
        isInternational: onboardingData.isInternational || onboardingData.country.toLowerCase() !== 'usa' // simple heuristic
      },
      academics: { courses: [], assignments: [], gpa: 0 },
      finance: { rent: 0, food: 0, transport: 0, study: 0, income: 0 },
      health: { weight: 0, activityLevel: 'medium', mealsToday: [] },
      wellbeing: { stress: 'Low', focus: 'Good', sleepHours: 8 },
      subscription: {
        status: 'trial',
        startDate: new Date().toISOString()
      }
    };

    try {
      await setDoc(doc(db, 'users', tempUser.uid), {
        ...userData,
        country: onboardingData.country,
        createdAt: serverTimestamp()
      });
      onAuthenticated(tempUser, userData);
    } catch (err) {
      setError("Failed to save profile. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) return null; // We'll move logout to the App header

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] scale-110 animate-slow-zoom"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1622397333309-3056849bc70b?auto=format&fit=crop&q=80&w=2000")' }}
      />
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
      
      <AnimatePresence mode="wait">
        {!showOnboarding ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="glass p-10 max-w-md w-full text-center space-y-8 shadow-[0_0_50px_rgba(30,58,138,0.3)] relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_auto] animate-gradient-shift" />
            
            <div className="space-y-2">
              <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-inner group">
                <Zap className="text-blue-400 group-hover:scale-110 transition-transform" size={40} />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                CAMPUSPILOT
              </h1>
              <p className="text-slate-500 text-[10px] font-mono tracking-widest uppercase">Academic OS Terminal</p>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 py-4 rounded-2xl bg-white text-slate-950 font-bold hover:bg-slate-100 transition-all shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              Continue with Google
            </button>

            <button 
              onClick={() => setError("Biometric verification pending hardware authorization.")}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all border border-white/10"
            >
              <Fingerprint size={20} />
              Biometric Authorization
            </button>

            {error && <p className="text-red-400 text-[10px] font-mono">SYSTEM ERR: {error}</p>}
          </motion.div>
        ) : (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-10 max-w-md w-full space-y-6 shadow-2xl relative"
          >
            <h2 className="text-xl font-bold tracking-tight">Onboarding Sequence</h2>
            <p className="text-slate-500 text-xs">Configure your academic environment identifiers.</p>
            
            <form onSubmit={submitOnboarding} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Full Name</label>
                <input 
                  required
                  value={onboardingData.name}
                  onChange={(e) => setOnboardingData({...onboardingData, name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Institution / University</label>
                <input 
                  required
                  value={onboardingData.university}
                  onChange={(e) => setOnboardingData({...onboardingData, university: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Origin Country</label>
                <input 
                  required
                  value={onboardingData.country}
                  onChange={(e) => setOnboardingData({...onboardingData, country: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox" 
                  checked={onboardingData.isInternational}
                  onChange={(e) => setOnboardingData({...onboardingData, isInternational: e.target.checked})}
                />
                <span className="text-xs text-slate-400">Register as International Scholar</span>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Initialize System
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
