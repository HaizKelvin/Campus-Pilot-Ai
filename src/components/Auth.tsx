import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, LogIn, UserPlus, Loader2, Zap, Shield, Globe, Terminal, RefreshCw, Sparkles, Eye, EyeOff } from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { cn } from '../lib/utils';
import { AppState } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const AVATAR_STLYES = ['avataaars', 'bottts', 'pixel-art', 'notionists'];

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLandingPage, setIsLandingPage] = useState(true);
  const [tempUser, setTempUser] = useState<any>(null);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    university: '',
    country: '',
    isInternational: false,
    profileImageUrl: '',
    avatarStyle: 'avataaars'
  });

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 25;
    if (/[A-Z]/.test(pass)) strength += 25;
    if (/[0-9]/.test(pass)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
    return strength;
  };

  const generateRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(7);
    const style = onboardingData.avatarStyle;
    setOnboardingData(prev => ({
      ...prev,
      profileImageUrl: `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
    }));
  };

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
      setError("Google authentication failed. If you see no popup, please ensure popups are allowed or try opening the app in a new tab using the button in the top right.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let user;
      if (authMode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setAuthMode('signup');
        setTempUser(user);
        setOnboardingData(prev => ({
          ...prev,
          name: user.displayName || email.split('@')[0],
        }));
        setShowOnboarding(true);
      } else {
        onAuthenticated(user, userSnap.data() as AppState);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password identifiers.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Identifier already registered in terminal.");
      } else {
        setError(err.message || "Authentication sequence failed.");
      }
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

            <div className="space-y-2 pb-2">
              <div className="flex justify-center mb-2">
                <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-blue-400">Node: {firebaseConfig.projectId.split('-').slice(-1)[0]}</span>
                </div>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tighter">
                {authMode === 'login' ? 'System Login' : 'Register Account'}
              </h2>
              <div className="flex items-center justify-center gap-4">
                <button 
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={cn("text-[10px] font-mono uppercase tracking-widest transition-colors", authMode === 'login' ? "text-blue-400" : "text-slate-600")}
                >
                  Login
                </button>
                <div className="w-[1px] h-3 bg-slate-800" />
                <button 
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={cn("text-[10px] font-mono uppercase tracking-widest transition-colors", authMode === 'signup' ? "text-blue-400" : "text-slate-600")}
                >
                  Sign Up
                </button>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 md:space-y-6">
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">Terminal Email</label>
                <input 
                  required
                  type="email"
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 p-4 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 text-sm md:text-base transition-all"
                />
              </div>
              <div className="space-y-1 text-left relative">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">Secure Passkey</label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/10 p-4 pr-12 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 text-sm md:text-base transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                {authMode === 'signup' && password.length > 0 && (
                  <div className="mt-2 space-y-1 px-1">
                    <div className="flex justify-between items-center text-[8px] font-mono uppercase text-slate-500 tracking-tighter">
                      <span>SECURE STRENGTH</span>
                      <span>{getPasswordStrength(password)}%</span>
                    </div>
                    <div className="h-1 bg-slate-900 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "h-full flex-1 transition-all duration-500",
                            getPasswordStrength(password) >= i * 25 
                              ? (getPasswordStrength(password) <= 50 ? "bg-amber-500" : "bg-blue-500")
                              : "bg-slate-800"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 md:py-5 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
                {authMode === 'login' ? 'Authorize Entry' : 'Create Academic Profile'}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/11" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-[#0f172a] px-3 text-slate-600">Cross-Sync Identity</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50 text-xs"
              >
                <Globe size={18} className="text-blue-400" />
                Google
              </button>

              <button 
                type="button"
                onClick={handleBiometricAuth}
                disabled={loading}
                className="flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 group disabled:opacity-50 text-xs"
              >
                <Fingerprint size={18} className="group-hover:text-blue-400 transition-colors" />
                Biometrics
              </button>
            </div>

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
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Academic Identity</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                    <img 
                      src={onboardingData.profileImageUrl || `https://api.dicebear.com/7.x/${onboardingData.avatarStyle}/svg?seed=${onboardingData.name || 'default'}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                      {AVATAR_STLYES.map(style => (
                        <button 
                          key={style}
                          type="button"
                          onClick={() => setOnboardingData({...onboardingData, avatarStyle: style})}
                          className={cn(
                            "px-2 py-1 rounded-md text-[8px] font-mono uppercase bg-white/5 border border-white/10 hover:border-blue-500/50 transition-colors whitespace-nowrap",
                            onboardingData.avatarStyle === style && "border-blue-500 text-blue-400 bg-blue-500/5"
                          )}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                    <button 
                      type="button"
                      onClick={generateRandomAvatar}
                      className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-white transition-colors"
                    >
                      <RefreshCw size={10} />
                      Regenerate Random Identity
                    </button>
                  </div>
                </div>
              </div>

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
