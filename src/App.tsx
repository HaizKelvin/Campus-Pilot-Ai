/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Fingerprint, Settings, Upload, User, Zap, Globe, Plus, Trash2, ChevronRight, Menu, X, Loader2, LogOut, DollarSign, Activity, LayoutDashboard, BookOpen, Wallet, HeartPulse, Brain, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { analyzeStudentStatus } from './services/aiService';
import type { AppState } from './types';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Auth } from './components/Auth';
import { Chatbot } from './components/Chatbot';
import { DashboardCharts } from './components/DashboardCharts';
import { FocusMode } from './components/FocusMode';
import { BiometricVisualizer, PulseLine } from './components/BiometricVisualizer';
import { KernelLog } from './components/KernelLog';
import { startRegistration } from '@simplewebauthn/browser';

const INITIAL_STATE: AppState = {
  profile: {
    name: 'Student User',
    university: '',
    year: 1,
    isInternational: true,
  },
  academics: {
    courses: [],
    assignments: [],
    gpa: 3.5,
  },
  finance: {
    income: 2400,
    expenses: [
      { id: '1', name: 'Academic Housing', amount: 850, category: 'Housing' },
      { id: '2', name: 'Meal Plan', amount: 400, category: 'Food' },
    ],
  },
  health: {
    weight: 70,
    activityLevel: 'medium',
    mealsToday: [],
    conditions: [],
  },
  wellbeing: {
    stress: 'Medium',
    focus: 'Good',
    sleepHours: 7,
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSyncingBiometrics, setIsSyncingBiometrics] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'academics' | 'finance' | 'health' | 'wellbeing' | 'focus'>('dashboard');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth & Sync
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (!firebaseUser) {
        // Fallback to local storage if not logged in
        const saved = localStorage.getItem('campuspilot_state');
        if (saved) setState(JSON.parse(saved));
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setState(doc.data() as AppState);
      }
    });
    return () => unsubscribeDoc();
  }, [user]);

  // Push updates to Firestore
  useEffect(() => {
    if (!user) {
      localStorage.setItem('campuspilot_state', JSON.stringify(state));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), state, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, user]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const response = await analyzeStudentStatus(state);
    setAiResponse(response);
    setIsAnalyzing(false);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    firebaseSignOut(auth).then(() => {
      setUser(null);
      setState(INITIAL_STATE);
      setIsProfileOpen?.(false);
    });
  };

  const handleSyncBiometrics = async () => {
    if (!user) return;
    setIsSyncingBiometrics(true);
    setBiometricStatus(null);
    try {
      const optionsRes = await fetch(`/api/webauthn/register-options?userId=${user.uid}&userName=${encodeURIComponent(state.profile.name)}`);
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
        setBiometricStatus("Biometric Link Established.");
      } else {
        throw new Error("Verification failed");
      }
    } catch (e) {
      console.error(e);
      setBiometricStatus("Sync Failed. Ensure hardware support.");
    } finally {
      setIsSyncingBiometrics(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'focus', label: 'Deep Focus', icon: Target },
    { id: 'finance', label: 'Finance', icon: Wallet },
    { id: 'health', label: 'Health', icon: HeartPulse },
    { id: 'wellbeing', label: 'Wellbeing', icon: Brain },
  ];


  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden text-slate-50 relative">
      <div className="mesh-bg" />
      
      {!isAuthReady ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : !user ? (
        <Auth 
          currentUser={user} 
          onAuthenticated={(firebaseUser, userData) => {
            setUser(firebaseUser);
            setState(userData);
          }}
          onLogout={handleLogout}
        />
      ) : (
        <>
      {/* Sidebar (Desktop) */}
          <motion.aside 
            initial={false}
            animate={{ width: isSidebarOpen ? 260 : 80 }}
            className="hidden md:flex bg-slate-900/50 backdrop-blur-3xl border-r border-white/5 flex-col z-[80] shrink-0 m-0 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
            
            <div className="p-6 flex flex-col gap-1 relative z-10">
              <div className="flex items-center justify-between">
                <div className={cn("flex flex-col transition-all duration-500", !isSidebarOpen && "sr-only opacity-0 -translate-x-4")}>
                  <h1 className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-400 to-slate-400">
                    CAMPUSPILOT
                  </h1>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-[8px] text-slate-500 font-mono tracking-[0.2em]">CORE_SYSTEM_ACTIVE</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 relative z-10">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-sm font-semibold group",
                    activeTab === item.id 
                      ? "bg-blue-600/10 text-blue-400 shadow-[inset_0_0_20px_rgba(37,99,235,0.05)] border border-blue-500/20" 
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-100"
                  )}
                >
                  <item.icon size={20} className={cn("transition-transform group-hover:scale-110", activeTab === item.id ? "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-600")} />
                  {isSidebarOpen && <span className="tracking-tight">{item.label}</span>}
                  {activeTab === item.id && isSidebarOpen && (
                    <motion.div layoutId="active-nav" className="ml-auto w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-3">
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-blue-900/20",
                  isAnalyzing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isAnalyzing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Zap size={18} fill="currentColor" />
                )}
                {isSidebarOpen && <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Status'}</span>}
              </button>
              
              <button 
                onClick={() => {
                  if(confirm("Are you sure you want to reset all data?")) {
                    setState(INITIAL_STATE);
                    setAiResponse(null);
                    localStorage.removeItem('campuspilot_state');
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs font-mono transition-all",
                  !isSidebarOpen && "sr-only opacity-0 whitespace-nowrap"
                )}
              >
                <Trash2 size={14} />
                <span>Reset Data</span>
              </button>
            </div>
          </motion.aside>

          {/* Bottom Nav (Mobile) */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] glass border-t border-white/10 px-2 py-1 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                  activeTab === item.id ? "text-blue-400 scale-110" : "text-slate-500"
                )}
              >
                <item.icon size={22} />
                <span className="text-[10px] font-bold uppercase">{item.label.substring(0, 4)}</span>
              </button>
            ))}
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={cn(
                "p-3 rounded-full bg-blue-600 text-white shadow-lg -translate-y-4 border-4 border-slate-950 transition-all active:scale-90",
                isAnalyzing && "animate-pulse"
              )}
            >
              {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} fill="currentColor" />}
            </button>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto relative p-2 md:p-6 flex flex-col gap-4 pb-24 md:pb-6">
            <header className="glass p-4 md:p-6 flex items-center justify-between border-white/5 shadow-xl">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="status-pill bg-blue-500/20 text-blue-400">SYNCED</span>
                  <span className="hidden xs:inline text-[10px] text-slate-500 font-mono italic">
                    LATENCY: 12ms
                  </span>
                </div>
                <h1 className="text-lg md:text-xl font-bold capitalize text-slate-100">{activeTab}</h1>
              </div>
              <div className="flex items-center gap-3 md:gap-6">
                {state.subscription && (
                  <div className={cn(
                    "hidden sm:flex px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border transition-all uppercase items-center gap-2",
                    state.subscription.status === 'trial' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
                  )}>
                    {state.subscription.status} Access
                  </div>
                )}
                
                <div className="relative">
                  <div className="absolute -inset-2 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden p-0.5 hover:border-blue-500/50 transition-all active:scale-95 flex items-center justify-center relative z-10 group"
                  >
                    <img className="rounded-lg w-full h-full object-cover" src={state.profile.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.profile.name}`} alt="avatar" />
                  </button>
                  
                  <AnimatePresence>
                    {isProfileOpen && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setIsProfileOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-56 glass z-[70] p-4 shadow-2xl space-y-4 border border-blue-500/20"
                        >
                          <div className="space-y-4">
                            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/20 overflow-hidden group shadow-2xl">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all" />
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                  <User className="text-blue-400" size={20} />
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-sm font-bold text-slate-100 truncate tracking-tight">{state.profile.name}</p>
                                  <p className="text-[9px] font-mono text-blue-500/80 uppercase tracking-widest truncate">Academic Operator</p>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                                  <span className="uppercase">Institution</span>
                                  <span className="text-slate-300 uppercase tracking-tighter truncate max-w-[120px]">{state.profile.university || 'NOT_SET'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                                  <span className="uppercase">Region</span>
                                  <span className="text-slate-300 uppercase tracking-tighter">{state.profile.country || 'GLOBAL'}</span>
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-white/5">
                                <button 
                                  onClick={() => { setIsEditingProfile(true); setIsProfileOpen(false); }}
                                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border border-blue-500/20"
                                >
                                  Sync Identifiers
                                </button>
                              </div>
                            </div>

                            <button 
                              onClick={handleLogout}
                              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-red-400 transition-colors group"
                            >
                              Terminate Session
                              <LogOut size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </header>


        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="max-w-5xl mx-auto py-2 px-1">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4 md:space-y-6"
                >
                  <header className="glass p-4 bg-gradient-to-r from-blue-600/5 to-purple-600/5 border-blue-500/20">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="status-pill bg-blue-500/20 text-blue-400">NOTIFICATION</span>
                      <span className="hidden sm:inline text-[10px] text-slate-500 font-mono italic">ACTIVE SESSION</span>
                    </div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      🧭 Situation Overview: {aiResponse ? "Report ready for review." : "System idle. Sync telemetry."}
                    </h2>
                  </header>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Academics Card */}
                    <div className="glass p-5 md:p-6 space-y-4 border-blue-500/10 hover:border-blue-500/30 transition-colors group">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-500/10 rounded-lg"><BookOpen className="text-blue-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/20">PRECISION: 98%</div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">GPA PROJECTION</p>
                        <div className="flex items-end gap-2">
                           <h3 className="text-2xl md:text-3xl font-bold text-slate-100">{state.academics.gpa || "0.00"}</h3>
                           <span className="text-[10px] text-green-400 pb-1 font-mono">↑ TREND</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span>CREDIT PROGRESS</span>
                          <span>{Math.min(100, (state.academics.courses.length * 20))}%</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (state.academics.courses.length * 20))}%` }}
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Finance Card */}
                    <div className="glass p-5 md:p-6 space-y-4 border-purple-500/10 hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-purple-500/10 rounded-lg"><DollarSign className="text-purple-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/20">SOLVENCY: HIGH</div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">NET DISPOSABLE (MONTHLY)</p>
                        <h3 className="text-2xl md:text-3xl font-bold text-slate-100">
                          ${state.finance.income - state.finance.expenses.reduce((acc, curr) => acc + curr.amount, 0)}
                        </h3>
                      </div>
                      <div className="flex gap-1 h-8 items-end">
                        {[40, 70, 45, 90, 60, 80].map((h, i) => (
                           <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>

                    {/* Health Card */}
                    <div className="glass p-5 md:p-6 space-y-4 border-red-500/10 hover:border-red-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-red-500/10 rounded-lg"><Activity className="text-red-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-red-500 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/20">BIO-SYNC: ACTIVE</div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">VITALITY QUOTIENT</p>
                        <h3 className="text-2xl md:text-3xl font-bold text-slate-100">84%</h3>
                      </div>
                      <BiometricVisualizer />
                    </div>
                  </div>

                  <DashboardCharts finance={state.finance} academics={state.academics} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass p-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 font-mono">Kernel Event Stream</h3>
                      <KernelLog entries={[
                        { timestamp: '10:42:01', category: 'AUTH_TOKEN', message: 'ENCRYPTED_HANDSHAKE_SUCCESS', type: 'info' },
                        { timestamp: '11:05:32', category: 'FS_SYNC', message: `${state.profile.name.toUpperCase()}_PROFILE_PUSH_COMPLETE`, type: 'success' },
                        { timestamp: '11:15:09', category: 'SYS_HEALTH', message: 'NOMINAL_STABILITY_DETECTED', type: 'info' },
                        { timestamp: '12:03:44', category: 'DB_GATE', message: 'FIREBASE_PROVISION_SYNCED', type: 'success' },
                      ]} />
                    </div>
                    <div className="glass p-6 bg-blue-900/10 border-blue-500/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl pointer-events-none" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 font-mono flex items-center gap-2">
                        <Brain size={12} /> Neural Guidance Unit
                      </h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mb-4 relative z-10">
                        Based on your current telemetry, optimizing for a 50-minute deep focus block is recommended. Your cortisol levels suggest high receptivity to technical tasks.
                      </p>
                      <PulseLine />
                      <button 
                        onClick={() => setActiveTab('focus')}
                        className="mt-4 px-4 py-2 border border-blue-500/30 rounded text-[9px] font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-500 hover:text-white transition-all active:scale-95 relative z-10"
                      >
                         Initialize Focus Protocol
                      </button>
                    </div>
                  </div>

                  {!aiResponse && !isAnalyzing && (
                    <div className="glass p-12 md:p-20 text-center border-dashed border-white/10">
                      <LayoutDashboard className="mx-auto mb-4 text-slate-700" size={48} />
                      <h3 className="text-lg md:text-xl font-semibold mb-2">OS Ready for Initialization</h3>
                      <p className="text-slate-500 mb-6 max-w-sm mx-auto text-xs md:text-sm">
                        Synchronize your academic, financial, and physiological telemetry to generate a strategic dashboard.
                      </p>
                      <button 
                        onClick={handleAnalyze}
                        className="w-full sm:w-auto px-8 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-2xl"
                      >
                        Run System Check
                      </button>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="space-y-4">
                       <div className="h-4 w-1/4 bg-white/5 animate-pulse rounded-full" />
                       <div className="glass h-64 w-full animate-pulse" />
                       <div className="grid grid-cols-2 gap-4">
                          <div className="glass h-32 animate-pulse" />
                          <div className="glass h-32 animate-pulse" />
                       </div>
                    </div>
                  )}

                  {aiResponse && !isAnalyzing && (
                    <div className="glass p-8 markdown-body prose prose-invert max-w-none shadow-2xl">
                      <ReactMarkdown>{aiResponse}</ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'focus' && (
                <motion.div 
                  key="focus"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <FocusMode />
                </motion.div>
              )}


              {activeTab === 'academics' && (
                <motion.div 
                  key="academics"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4 md:space-y-6"
                >
                  <section className="glass p-4 md:p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-400" />
                        🎓 Courses & Telemetry
                      </h3>
                      <span className="status-pill bg-green-500/20 text-green-400 font-mono text-[10px]">GPA: {state.academics.gpa}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 group transition-all hover:border-blue-500/30">
                        <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Current GPA</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={state.academics.gpa}
                          onChange={(e) => setState({
                            ...state,
                            academics: { ...state.academics, gpa: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-slate-100 font-bold text-lg"
                        />
                      </div>
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                         <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Academic Primary</label>
                          <input 
                            type="text"
                            value={state.profile.university}
                            onChange={(e) => setState({
                              ...state,
                              profile: { ...state.profile, university: e.target.value }
                            })}
                            className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-slate-100 text-sm"
                            placeholder="University"
                          />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Module Manifest</label>
                        <button 
                          onClick={() => {
                            const newCourse = { id: Math.random().toString(36).substr(2, 9), name: '', credit: 0, grade: '' };
                            setState({
                              ...state,
                              academics: { ...state.academics, courses: [...state.academics.courses, newCourse] }
                            });
                          }}
                          className="text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-2 rounded-xl flex items-center gap-2 border border-blue-500/20 transition-all uppercase font-bold active:scale-95"
                        >
                          <Plus size={12} /> Add Module
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {state.academics.courses.length === 0 && (
                          <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center bg-white/[0.01]">
                            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No active modules in terminal</p>
                          </div>
                        )}
                        {state.academics.courses.map((course, idx) => (
                          <div key={course.id} className="flex gap-3 items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:border-blue-500/20 transition-all group">
                            <div className="flex-1">
                              <input 
                                placeholder="Module Name"
                                value={course.name}
                                onChange={(e) => {
                                  const newCourses = [...state.academics.courses];
                                  newCourses[idx].name = e.target.value;
                                  setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                                }}
                                className="bg-transparent border-none w-full p-1 outline-none text-sm font-medium focus:text-blue-400 transition-colors"
                              />
                            </div>
                            <div className="w-16">
                               <input 
                                type="number"
                                placeholder="CR"
                                value={course.credit}
                                onChange={(e) => {
                                  const newCourses = [...state.academics.courses];
                                  newCourses[idx].credit = parseInt(e.target.value) || 0;
                                  setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                                }}
                                className="bg-slate-950/50 border border-white/10 rounded-lg px-2 py-1.5 w-full text-xs text-center font-mono focus:border-blue-500/50 outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newCourses = state.academics.courses.filter(c => c.id !== course.id);
                                setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                              }}
                              className="text-slate-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="glass p-6 bg-gradient-to-br from-blue-600/5 to-purple-600/5">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                      <Zap size={16} className="text-yellow-400" />
                      ⚡ Critical Deadlines
                     </h3>
                     <div className="space-y-4">
                        <button 
                          onClick={() => {
                            const newAssignment = { id: Math.random().toString(36).substr(2, 9), title: '', deadline: '', priority: 1 };
                            setState({
                              ...state,
                              academics: { ...state.academics, assignments: [...state.academics.assignments, newAssignment] }
                            });
                          }}
                          className="w-full py-4 border border-dashed border-white/10 rounded-xl hover:bg-white/5 transition-colors text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                           <Plus size={14} /> New Tracking Sequence
                        </button>
                        {state.academics.assignments.map((assignment, idx) => (
                          <div key={assignment.id} className="flex gap-4 items-center bg-slate-950/40 p-4 rounded-xl border border-white/5">
                            <input 
                              placeholder="Assignment Descriptor"
                              value={assignment.title}
                              onChange={(e) => {
                                const newAssigns = [...state.academics.assignments];
                                newAssigns[idx].title = e.target.value;
                                setState({ ...state, academics: { ...state.academics, assignments: newAssigns } });
                              }}
                              className="flex-1 bg-transparent border-none outline-none text-sm font-semibold"
                            />
                            <div className="flex items-center gap-4">
                              <input 
                                 type="date"
                                 value={assignment.deadline}
                                 onChange={(e) => {
                                   const newAssigns = [...state.academics.assignments];
                                   newAssigns[idx].deadline = e.target.value;
                                   setState({ ...state, academics: { ...state.academics, assignments: newAssigns } });
                                 }}
                                 className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs outline-none text-slate-300 font-mono"
                              />
                              <button 
                                onClick={() => {
                                  const newAssigns = state.academics.assignments.filter(a => a.id !== assignment.id);
                                  setState({ ...state, academics: { ...state.academics, assignments: newAssigns } });
                                }}
                                className="text-slate-600 hover:text-red-400"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                     </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'finance' && (
                <motion.div 
                  key="finance"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4 md:space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="glass p-5 md:p-6 border-purple-500/10">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <DollarSign size={16} className="text-purple-400" />
                        Inflow Configuration
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group transition-all hover:border-purple-500/30">
                          <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Monthly Primary Income</label>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-slate-500">$</span>
                            <input 
                              type="number"
                              value={state.finance.income}
                              onChange={(e) => setState({...state, finance: {...state.finance, income: parseInt(e.target.value) || 0}})}
                              className="bg-transparent border-none w-full text-2xl font-bold text-slate-100 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="glass p-5 md:p-6 border-purple-500/10">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Zap size={16} className="text-purple-400" />
                          Outflow Streams
                        </h3>
                        <button 
                          onClick={() => {
                            const newExp = { id: Math.random().toString(36).substr(2, 9), name: '', amount: 0, category: 'Other' };
                            setState({...state, finance: {...state.finance, expenses: [...state.finance.expenses, newExp]}});
                          }}
                          className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-all active:scale-95"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {state.finance.expenses.length === 0 && (
                          <p className="text-center text-[10px] font-mono text-slate-600 py-8 uppercase italic">No active streams</p>
                        )}
                        {state.finance.expenses.map((expense, idx) => (
                          <div key={expense.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 group hover:border-purple-500/30 transition-all">
                            <input 
                              placeholder="Label"
                              value={expense.name}
                              onChange={(e) => {
                                const newExp = [...state.finance.expenses];
                                newExp[idx].name = e.target.value;
                                setState({...state, finance: {...state.finance, expenses: newExp}});
                              }}
                              className="bg-transparent border-none flex-1 text-sm outline-none"
                            />
                            <div className="flex items-center gap-1 bg-slate-950/50 rounded-lg px-2 py-1 outline-none">
                              <span className="text-[10px] text-slate-500 font-mono italic">$</span>
                              <input 
                                type="number"
                                value={expense.amount}
                                onChange={(e) => {
                                  const newExp = [...state.finance.expenses];
                                  newExp[idx].amount = parseInt(e.target.value) || 0;
                                  setState({...state, finance: {...state.finance, expenses: newExp}});
                                }}
                                className="w-12 bg-transparent border-none text-[10px] font-mono outline-none text-right"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newExp = state.finance.expenses.filter(e => e.id !== expense.id);
                                setState({...state, finance: {...state.finance, expenses: newExp}});
                              }}
                              className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="glass p-5 md:p-8 bg-gradient-to-br from-purple-600/[0.03] to-slate-900 border-purple-500/10">
                     <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
                        <div>
                           <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Solvency Forecast</p>
                           <h4 className="text-3xl font-bold text-white mb-2">
                             ${state.finance.income - state.finance.expenses.reduce((acc, curr) => acc + curr.amount, 0)}
                             <span className="text-sm font-normal text-slate-500 ml-2">/ month</span>
                           </h4>
                           <div className="flex gap-2">
                             <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-bold rounded uppercase border border-green-500/20">Operational</span>
                             <span className="px-2 py-0.5 bg-white/5 text-slate-500 text-[8px] font-bold rounded uppercase border border-white/10">Cycle 2026</span>
                           </div>
                        </div>
                        <div className="flex-1 max-w-xs h-12 flex items-end gap-1 px-4">
                           {[20, 45, 30, 60, 40, 75, 55, 90, 65, 80].map((h, i) => (
                             <div 
                               key={i} 
                               className="flex-1 bg-purple-500/20 rounded-t-sm group relative"
                               style={{ height: `${h}%` }}
                             >
                               <div className="absolute inset-0 bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-sm" />
                             </div>
                           ))}
                        </div>
                     </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'health' && (
                <motion.div 
                  key="health"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4 md:space-y-6"
                >
                   <div className="glass p-5 md:p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                              <HeartPulse className="text-red-500" size={20} />
                           </div>
                           <div>
                              <h3 className="text-base font-bold text-slate-100 tracking-tight">🍎 Biometric Status</h3>
                              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Physiological Data Stream</p>
                           </div>
                        </div>
                        <span className="status-pill bg-blue-500/20 text-blue-400 px-3 text-[10px] md:text-xs">Tracking Online</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                         <div className="space-y-6 md:space-y-8">
                            <div>
                               <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Metabolic Activity Index</label>
                               <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                                  {['low', 'medium', 'high'].map(level => (
                                    <button
                                      key={level}
                                      onClick={() => setState({...state, health: {...state.health, activityLevel: level as any}})}
                                      className={cn(
                                        "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                        state.health.activityLevel === level 
                                          ? "bg-white text-slate-950 shadow-lg" 
                                          : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                      )}
                                    >
                                      {level}
                                    </button>
                                  ))}
                               </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                               <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Current Mass (KG)</label>
                               <input 
                                  type="number"
                                  value={state.health.weight}
                                  onChange={(e) => setState({...state, health: {...state.health, weight: parseInt(e.target.value) || 0}})}
                                  className="w-full bg-slate-950/50 border border-white/10 p-4 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-xl"
                               />
                            </div>

                            <section className="space-y-4">
                               <div className="flex justify-between items-center">
                                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Inherent Conditions</label>
                                  <button 
                                    onClick={() => {
                                      const newC = { id: Math.random().toString(36).substr(2, 9), name: '', severity: 'Mild' };
                                      setState({...state, health: {...state.health, conditions: [...state.health.conditions, newC]}});
                                    }}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                  >
                                    <Plus size={16} />
                                  </button>
                               </div>
                               <div className="space-y-2">
                                  {state.health.conditions.map((condition, idx) => (
                                    <div key={condition.id} className="flex gap-2 items-center bg-white/5 p-2 rounded-xl">
                                      <input 
                                        placeholder="condition name"
                                        value={condition.name}
                                        onChange={(e) => {
                                          const newC = [...state.health.conditions];
                                          newC[idx].name = e.target.value;
                                          setState({...state, health: {...state.health, conditions: newC}});
                                        }}
                                        className="bg-transparent border-none flex-1 text-xs outline-none px-2"
                                      />
                                      <button 
                                        onClick={() => {
                                          const newC = state.health.conditions.filter(c => c.id !== condition.id);
                                          setState({...state, health: {...state.health, conditions: newC}});
                                        }}
                                        className="text-slate-600 hover:text-red-400 p-2"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                               </div>
                            </section>
                         </div>
                         
                         <div className="space-y-4">
                            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Nutritional Intake Sequence</label>
                            <div className="space-y-3">
                               {state.health.mealsToday.length === 0 && (
                                 <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center bg-white/[0.01]">
                                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Waiting for intake data</p>
                                 </div>
                               )}
                               {state.health.mealsToday.map((meal, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-blue-500/20 transition-all">
                                     <span className="text-xs font-semibold text-slate-200">{meal}</span>
                                     <button 
                                        onClick={() => {
                                          const newMeals = [...state.health.mealsToday];
                                          newMeals.splice(idx, 1);
                                          setState({...state, health: {...state.health, mealsToday: newMeals}});
                                        }}
                                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                     >
                                        <X size={16} />
                                     </button>
                                  </div>
                               ))}
                               <div className="flex gap-2 pt-2">
                                  <input 
                                     id="meal-input"
                                     placeholder="LOG MEAL SEQUENCE..."
                                     onKeyDown={(e) => {
                                       if(e.key === 'Enter') {
                                         const val = (e.target as HTMLInputElement).value;
                                         if(val) {
                                           setState({...state, health: {...state.health, mealsToday: [...state.health.mealsToday, val]}});
                                           (e.target as HTMLInputElement).value = '';
                                         }
                                       }
                                     }}
                                     className="flex-1 bg-slate-950/50 border border-white/10 p-3 text-xs rounded-xl outline-none focus:ring-1 focus:ring-blue-500 uppercase font-mono tracking-widest"
                                  />
                                  <button 
                                    onClick={() => {
                                      const input = document.getElementById('meal-input') as HTMLInputElement;
                                      if(input.value) {
                                         setState({...state, health: {...state.health, mealsToday: [...state.health.mealsToday, input.value]}});
                                         input.value = '';
                                      }
                                    }}
                                    className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all rounded-xl border border-blue-500/20 active:scale-95"
                                  >
                                    <Plus size={20} />
                                  </button>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'wellbeing' && (
                <motion.div 
                  key="wellbeing"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8"
                >
                   <div className="glass p-5 md:p-8">
                      <h3 className="text-[10px] font-mono uppercase text-slate-500 tracking-widest mb-8 flex items-center gap-2">
                        <Brain size={14} className="text-purple-400" />
                        Psychological Telemetry
                      </h3>
                      <div className="space-y-8 md:space-y-10">
                         <div>
                            <label className="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Focus State Evaluation</label>
                            <div className="grid grid-cols-3 gap-3">
                               {['Good', 'Distracted', 'Overloaded'].map(s => (
                                 <button 
                                   key={s}
                                   onClick={() => setState({...state, wellbeing: {...state.wellbeing, focus: s as any}})}
                                   className={cn(
                                     "py-3 rounded-xl border text-[10px] font-bold uppercase transition-all tracking-wider active:scale-95",
                                     state.wellbeing.focus === s 
                                       ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-950" 
                                       : "border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                   )}
                                 >
                                   {s}
                                 </button>
                               ))}
                            </div>
                         </div>
                         
                         <div>
                            <label className="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Cortisol Level (STRESS)</label>
                            <div className="grid grid-cols-3 gap-3">
                               {['Low', 'Medium', 'High'].map(s => (
                                 <button 
                                   key={s}
                                   onClick={() => setState({...state, wellbeing: {...state.wellbeing, stress: s as any}})}
                                   className={cn(
                                     "py-3 rounded-xl border text-[10px] font-bold uppercase transition-all tracking-wider active:scale-95",
                                     state.wellbeing.stress === s 
                                       ? (s === 'High' ? "bg-red-500 border-red-500 text-white" : s === 'Medium' ? "bg-amber-500 border-amber-500 text-white" : "bg-green-500 border-green-500 text-white")
                                       : "border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                   )}
                                 >
                                   {s}
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div className="glass p-5 md:p-8 bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-dashed flex flex-col justify-center items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Zap size={32} className="text-blue-400" />
                      </div>
                      <h4 className="text-base font-bold text-slate-100 tracking-tight mb-2">RECOVERY DEPTH</h4>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Circadian Duration Log</p>
                      <div className="flex items-center gap-6 md:gap-10">
                         <button onClick={() => setState({...state, wellbeing: {...state.wellbeing, sleepHours: Math.max(0, state.wellbeing.sleepHours - 1)}})} className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/5 text-xl font-bold transition-all active:scale-90">-</button>
                         <div className="flex flex-col">
                            <span className="text-5xl md:text-7xl font-mono font-bold tracking-tighter text-blue-400">{state.wellbeing.sleepHours}</span>
                            <span className="text-[8px] md:text-[10px] font-mono text-slate-600 uppercase font-bold tracking-[0.3em]">HOURS</span>
                         </div>
                         <button onClick={() => setState({...state, wellbeing: {...state.wellbeing, sleepHours: state.wellbeing.sleepHours + 1}})} className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/5 text-xl font-bold transition-all active:scale-90">+</button>
                      </div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      {/* Profile Editing Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingProfile(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 100 }}
              className="relative w-full max-w-md glass p-6 md:p-8 shadow-2xl space-y-6 rounded-t-3xl sm:rounded-3xl border-t border-blue-500/20 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Modify Identifiers</h2>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 pb-4">
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-blue-500/50 transition-all">
                      <img 
                        src={state.profile.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.profile.name}`} 
                        className="w-full h-full object-cover"
                        alt="Profile preview"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Photo Identification</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => document.getElementById('profile-upload')?.click()}
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:border-blue-500/50 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Upload size={14} /> Upload Image
                      </button>
                      <input 
                        id="profile-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setState({...state, profile: {...state.profile, profileImageUrl: reader.result as string}});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                    <input 
                      value={state.profile.name}
                      onChange={(e) => setState({...state, profile: {...state.profile, name: e.target.value}})}
                      className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Academic Institution</label>
                    <input 
                      value={state.profile.university}
                      onChange={(e) => setState({...state, profile: {...state.profile, university: e.target.value}})}
                      className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                      placeholder="e.g. Stanford University"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Country</label>
                    <input 
                      value={state.profile.country || ''}
                      onChange={(e) => setState({...state, profile: {...state.profile, country: e.target.value}})}
                      className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                      placeholder="e.g. Canada"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Image URL</label>
                    <input 
                      value={state.profile.profileImageUrl || ''}
                      onChange={(e) => setState({...state, profile: {...state.profile, profileImageUrl: e.target.value}})}
                      className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                   <button 
                     onClick={handleSyncBiometrics}
                     disabled={isSyncingBiometrics}
                     className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest group"
                   >
                     {isSyncingBiometrics ? <Loader2 className="animate-spin" size={14} /> : <Fingerprint size={14} className="group-hover:scale-110 transition-transform" />}
                     Establish Biometric Link
                   </button>
                   {biometricStatus && <p className="text-[9px] font-mono text-blue-500 text-center uppercase tracking-tighter">{biometricStatus}</p>}
                </div>
              </div>

              <button 
                onClick={() => setIsEditingProfile(false)}
                className="w-full py-4 bg-white text-slate-950 font-bold rounded-2xl hover:bg-slate-200 transition-colors shadow-2xl active:scale-[0.98] transform"
              >
                Commit Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {user && <Chatbot />}
      </>
      )}
    </div>
  );
}

