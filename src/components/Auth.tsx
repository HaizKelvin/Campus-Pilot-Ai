import React, { useState, useEffect } from 'react';
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
import { Fingerprint, LogIn, UserPlus, Loader2, Zap, Shield, Globe, Terminal } from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isLandingPage, setIsLandingPage] = useState(true);
  const [tempUser, setTempUser] = useState<any>(null);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    university: '',
    country: '',
    isInternational: false,
    profileImageUrl: ''
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
        setAuthMode('signup');
        setTempUser(user);
        setOnboardingData(prev => ({
          ...prev,
          name: user.displayName || '',
        }));
        setShowOnboarding(true);
      } else {
        onAuthenticated(user, userSnap.data() as AppState);
      }
    } catch (err: any) {
      console.error(err);
      setError("Google authentication failed. Ensure popups are allowed.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem('last_user_id');
      if (!userId) {
        throw new Error("No linked session found. Sign in once with Google to enable biometrics.");
      }

      const optionsRes = await fetch(`/api/webauthn/login-options?userId=${userId}`);
      if (!optionsRes.ok) throw new Error("Could not fetch biometric options.");
      const options = await optionsRes.json();

      const asseResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, body: asseResp }),
      });

      const verification = await verifyRes.json();
      if (verification.verified) {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          // This is a simulation: in real apps you'd sign in with a custom token
          setError("Biometric verified! Performing secure sync...");
          handleGoogleLogin();
        }
      } else {
        throw new Error("Verification failed.");
      }
    } catch (err: any) {
      setError(err.message || "Biometric authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const enableBiometrics = async (user: any) => {
    try {
      const optionsRes = await fetch(`/api/webauthn/register-options?userId=${user.uid}&userName=${encodeURIComponent(user.displayName || 'Researcher')}`);
      const options = await optionsRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      
      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, body: attResp }),
      });
      
      const res = await verifyRes.json();
      if (res.verified) {
        localStorage.setItem('last_user_id', user.uid);
        localStorage.setItem('biometric_enabled', 'true');
      }
    } catch (e) {
      console.error("Failed to enable biometrics", e);
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
        isInternational: onboardingData.isInternational,
        country: onboardingData.country,
        profileImageUrl: onboardingData.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${onboardingData.name}`
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
        createdAt: serverTimestamp()
      });
      
      await enableBiometrics(tempUser);
      onAuthenticated(tempUser, userData);
    } catch (err) {
      setError("Failed to save profile. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden text-slate-200">
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[40s] scale-110 animate-slow-zoom"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1622397333309-3056849bc70b?auto=format&fit=crop&q=80&w=2000")' }}
      />
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[3px]" />
      <div className="mesh-bg opacity-30" />

      <AnimatePresence mode="wait">
        {isLandingPage ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            className="relative z-10 text-center max-w-4xl px-10 space-y-12"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="w-24 h-24 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-blue-500/20 shadow-2xl backdrop-blur-xl">
                <Zap className="text-blue-400" size={48} />
              </div>
              <h1 className="text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 leading-none">
                Master Your<br />Academic Trajectory.
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                CampusPilot AI is the professional operating system for modern scholars. 
                Synchronize academics, finances, and wellbeing in one unified command center.
              </p>
            </motion.div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <button 
                onClick={() => { setAuthMode('signup'); setIsLandingPage(false); }}
                className="w-full sm:w-auto px-10 py-5 bg-white text-slate-950 font-bold rounded-2xl hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-3"
              >
                <UserPlus size={20} />
                Register for Trial
              </button>
              <button 
                onClick={() => { setAuthMode('login'); setIsLandingPage(false); }}
                className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
              >
                <LogIn size={20} />
                Access Terminal
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-3 gap-8 pt-12"
            >
              {[
                { icon: Shield, text: "Biometric Verified" },
                { icon: Globe, text: "Global Coverage" },
                { icon: Terminal, text: "Gemini Enhanced" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 opacity-50">
                  <item.icon size={20} className="text-blue-400" />
                  <span className="text-[10px] font-mono tracking-widest uppercase">{item.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        ) : !showOnboarding ? (
          <motion.div 
            key="auth-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="glass p-10 max-w-md w-full text-center space-y-8 shadow-[0_0_50px_rgba(30,58,138,0.3)] relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_auto] animate-gradient-shift" />
            
            <button 
               onClick={() => setIsLandingPage(true)}
               className="absolute top-4 left-4 text-slate-500 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest"
            >
              ← Back
            </button>

            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tighter">
                {authMode === 'login' ? 'System Login' : 'Register Account'}
              </h2>
              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={() => setAuthMode('login')}
                  className={cn("text-[10px] font-mono uppercase tracking-widest transition-colors", authMode === 'login' ? "text-blue-400" : "text-slate-600")}
                >
                  Login
                </button>
                <div className="w-[1px] h-3 bg-slate-800" />
                <button 
                  onClick={() => setAuthMode('signup')}
                  className={cn("text-[10px] font-mono uppercase tracking-widest transition-colors", authMode === 'signup' ? "text-blue-400" : "text-slate-600")}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 py-4 rounded-2xl bg-white text-slate-950 font-bold hover:bg-slate-100 transition-all shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-[#0f172a] px-3 text-slate-600">Secure Biometric Path</span>
              </div>
            </div>

            <button 
              onClick={handleBiometricAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all border border-white/10 group overflow-hidden"
            >
              <div className="relative flex items-center gap-3">
                <Fingerprint size={20} className="group-hover:text-blue-400 transition-colors" />
                Biometric Terminal Access
              </div>
            </button>

            {error && <p className="text-red-400 text-[10px] font-mono px-4 leading-tight">{error}</p>}
            
            <p className="text-[10px] text-slate-600 font-mono italic">
              "14-day initialization period starts upon first system entry."
            </p>
          </motion.div>
        ) : (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-10 max-w-md w-full space-y-6 shadow-2xl relative"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Onboarding Sequence</h2>
              <p className="text-slate-500 text-xs">Establish your academic identifiers for the system.</p>
            </div>
            
            <form onSubmit={submitOnboarding} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Full Research Name</label>
                <input 
                  required
                  placeholder="e.g. Kelvin Haiz"
                  value={onboardingData.name}
                  onChange={(e) => setOnboardingData({...onboardingData, name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Academic Institution</label>
                <input 
                  required
                  placeholder="e.g. Harvard University"
                  value={onboardingData.university}
                  onChange={(e) => setOnboardingData({...onboardingData, university: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Region / Country</label>
                <input 
                  required
                  placeholder="e.g. USA"
                  value={onboardingData.country}
                  onChange={(e) => setOnboardingData({...onboardingData, country: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Profile Image URL (Optional)</label>
                <input 
                  placeholder="https://example.com/avatar.jpg"
                  value={onboardingData.profileImageUrl}
                  onChange={(e) => setOnboardingData({...onboardingData, profileImageUrl: e.target.value})}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-3 py-2 bg-white/5 p-3 rounded-xl border border-white/10">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-white/10 bg-slate-950 text-blue-500"
                  checked={onboardingData.isInternational}
                  onChange={(e) => setOnboardingData({...onboardingData, isInternational: e.target.checked})}
                />
                <span className="text-xs text-slate-400 font-medium">Register as International Scholar</span>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Initialize OS Terminal
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
