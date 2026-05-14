import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
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
import { Fingerprint, LogIn, UserPlus, Loader2, Zap, Shield, Globe, Terminal, RefreshCw, Eye, EyeOff, Upload, ChevronRight } from 'lucide-react';
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
      finance: { income: 0, expenses: [] },
      health: { weight: 0, activityLevel: 'medium', mealsToday: [], conditions: [] },
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
      handleFirestoreError(err, OperationType.WRITE, `users/${tempUser.uid}`);
      setError("Failed to save profile. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden text-slate-200 selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[60s] scale-110 animate-slow-zoom opacity-50"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=2000")' }}
        />
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]" />
        
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950" />
        
        {/* Interactive Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[0%] w-[30%] h-[30%] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">
        {isLandingPage ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
            className="relative z-10 text-center max-w-5xl px-6 w-full h-full flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md"
              >
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-blue-400">VERSION_1.2.0_STABLE</span>
              </motion.div>

              <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-[0.9]">
                ACADEMIC<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400">COMMAND.</span>
              </h1>
              
              <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed mb-12 font-medium">
                CampusPilot AI is a high-performance student operating system. 
                Synchronize your curriculum, liquidity, and physiological telemetry in one professional interface.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                <button 
                  onClick={() => { setAuthMode('signup'); setIsLandingPage(false); }}
                  className="group relative w-full sm:min-w-[200px] px-8 py-4 bg-white text-slate-950 font-black rounded-xl hover:bg-slate-100 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-3"
                >
                  INITIALIZE ACCOUNT
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => { setAuthMode('login'); setIsLandingPage(false); }}
                  className="w-full sm:min-w-[200px] px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-3 backdrop-blur-md active:scale-95"
                >
                  RESUME SESSION
                </button>
              </div>

              <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 w-full pt-12 border-t border-white/5">
                {[
                  { title: "PRECISION ANALYTICS", desc: "GPA forecasting and credit tracking." },
                  { title: "LIQUIDITY CONTROL", desc: "Real-time expense stream monitoring." },
                  { title: "NEURAL WELLBEING", desc: "Physiological focus state optimization." }
                ].map((item, i) => (
                  <div key={i} className="text-left space-y-2">
                    <h3 className="text-[10px] font-black tracking-[0.2em] text-blue-500 font-mono italic">[{i + 1}] {item.title}</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium uppercase">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : !showOnboarding ? (
          <motion.div 
            key="auth-modal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-10 max-w-md w-full relative z-[110] shadow-2xl border border-white/10 backdrop-blur-3xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            
            <button 
               onClick={() => setIsLandingPage(true)}
               className="mb-8 text-slate-500 hover:text-white transition-colors text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 group"
            >
              <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-white transition-colors">
                <ChevronRight size={10} className="rotate-180" />
              </div>
              Back to Hub
            </button>


            <div className="space-y-4 pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform">
                  <Zap className="text-blue-400" size={32} />
                </div>
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-white">
                {authMode === 'login' ? 'Welcome Back' : 'Join the Fleet'}
              </h2>
              <p className="text-slate-500 text-xs font-medium">
                {authMode === 'login' 
                  ? 'Access your unified academic command center.' 
                  : 'Initialize your professional student OS terminal.'}
              </p>
              
              <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5 mt-6">
                <button 
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                    authMode === 'login' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Sign In
                </button>
                <button 
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                    authMode === 'signup' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Create Account
                </button>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 md:space-y-5">
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">Terminal Email</label>
                <input 
                  required
                  type="email"
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 p-3 md:p-4 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
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
                    className="w-full bg-slate-950/50 border border-white/10 p-3 md:p-4 pr-12 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-10 max-w-md w-full space-y-8 shadow-2xl relative z-[110] border border-white/10"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            
            <div className="space-y-1">
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">IDENTITY_SYNC</h2>
              <p className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Establish research identifiers for academic terminal.</p>
            </div>
            
            <form onSubmit={submitOnboarding} className="space-y-6">

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Academic Identity</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 group relative">
                    <img 
                      src={onboardingData.profileImageUrl || `https://api.dicebear.com/7.x/${onboardingData.avatarStyle}/svg?seed=${onboardingData.name || 'default'}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      type="button"
                      onClick={() => document.getElementById('onboarding-upload')?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <Upload size={16} />
                    </button>
                    <input 
                      id="onboarding-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setOnboardingData({...onboardingData, profileImageUrl: reader.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
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
