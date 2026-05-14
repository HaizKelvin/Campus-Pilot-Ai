/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Fingerprint, Settings, Upload, User, Zap, Globe, Plus, Trash2, ChevronRight, Menu, X, Loader2, LogOut, DollarSign, Activity, LayoutDashboard, BookOpen, Wallet, HeartPulse, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { analyzeStudentStatus } from './services/aiService';
import type { AppState } from './types';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Auth } from './components/Auth';
import { Chatbot } from './components/Chatbot';
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
    rent: 0,
    food: 0,
    transport: 0,
    study: 0,
    income: 0,
  },
  health: {
    weight: 70,
    activityLevel: 'medium',
    mealsToday: [],
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'academics' | 'finance' | 'health' | 'wellbeing'>('dashboard');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
    const timer = setTimeout(() => {
      setDoc(doc(db, 'users', user.uid), state, { merge: true });
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
      ) : (
        <Auth 
          currentUser={user} 
          onAuthenticated={(firebaseUser, userData) => {
            setUser(firebaseUser);
            setState(userData);
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="glass rounded-none border-y-0 border-l-0 border-r border-white/10 flex flex-col z-50 shrink-0 m-4"
      >
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className={cn("flex flex-col transition-opacity", !isSidebarOpen && "sr-only opacity-0")}>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                CAMPUSPILOT
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">v1.2.0-STABLE</p>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-md transition-colors text-slate-400 hover:text-slate-100"
            >
              {isSidebarOpen ? <Menu size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === item.id 
                  ? "bg-white/5 text-blue-400 border-l-4 border-blue-500 rounded-l-none pl-2" 
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <item.icon size={18} className={cn(activeTab === item.id ? "text-blue-400" : "text-slate-500")} />
              {isSidebarOpen && <span>{item.label}</span>}
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
              !isSidebarOpen && "sr-only opacity-0"
            )}
          >
            <Trash2 size={14} />
            <span>Reset Data</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative p-4 flex flex-col gap-4">
        <header className="glass p-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="status-pill bg-blue-500/20 text-blue-400">SYSTEM READY</span>
              <span className="text-[10px] text-slate-500 font-mono italic">
                LATENCY: 12ms | ACADEMIC CYCLE 2026
              </span>
            </div>
            <h1 className="text-xl font-bold capitalize text-slate-100">{activeTab}</h1>
          </div>
          <div className="flex items-center gap-6">
            {state.subscription && (
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border transition-all uppercase flex items-center gap-2",
                state.subscription.status === 'trial' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
              )}>
                {state.subscription.status} Access: 
                <span className="opacity-70">
                  {Math.max(0, 14 - Math.floor((new Date().getTime() - new Date(state.subscription.startDate).getTime()) / (1000 * 60 * 60 * 24)))} Days Left
                </span>
                {state.subscription.status === 'trial' && (
                  <button 
                    onClick={() => setState({...state, subscription: { ...state.subscription!, status: 'active' }})}
                    className="ml-2 hover:text-white transition-colors underline decoration-dotted"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}
            {state.profile.isInternational && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/20 uppercase">
                <Globe size={14} />
                Intl. Student
              </div>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden p-0.5 hover:border-blue-500/50 transition-all active:scale-95"
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
                      className="absolute right-0 mt-3 w-56 glass z-[70] p-4 shadow-2xl space-y-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold truncate text-slate-100">{state.profile.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">{state.profile.university} {state.profile.country && `• ${state.profile.country}`}</p>
                      </div>
                      <div className="h-[1px] bg-white/10 w-full" />
                      <div className="space-y-2">
                        <button 
                          onClick={() => { setIsEditingProfile(true); setIsProfileOpen(false); }}
                          className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-white transition-colors group"
                        >
                          Modify Identifiers
                          <Settings size={14} className="group-hover:rotate-90 transition-transform" />
                        </button>
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-red-400 transition-colors group"
                        >
                          Sign Out Terminal
                          <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
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
          <div className="max-w-5xl mx-auto py-2">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-6"
                >
                  <header className="glass p-4 bg-gradient-to-r from-blue-600/5 to-purple-600/5 border-blue-500/20">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="status-pill bg-blue-500/20 text-blue-400">STATUS NOTIFICATION</span>
                      <span className="text-[10px] text-slate-500 font-mono italic">ACTIVE SESSION ACTIVE</span>
                    </div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      🧭 Situation Overview: {aiResponse ? "Analytical report generated. Review strategic insights below." : "System idle. Sync telemetry data to begin analysis."}
                    </h2>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Academics Card */}
                    <div className="glass p-6 space-y-4 border-blue-500/10 hover:border-blue-500/30 transition-colors group">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-500/10 rounded-lg"><BookOpen className="text-blue-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/20">ACADEMIC INTEGRITY: 98%</div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">GPA PROJECTION</p>
                        <div className="flex items-end gap-2">
                          <h3 className="text-3xl font-bold text-slate-100">{state.academics.gpa || "0.00"}</h3>
                          <span className="text-[10px] text-green-400 pb-1 font-mono">↑ TREND</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span>CREDIT PROGRESS</span>
                          <span>60%</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '60%' }}
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Finance Card */}
                    <div className="glass p-6 space-y-4 border-purple-500/10 hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-purple-500/10 rounded-lg"><DollarSign className="text-purple-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/20">SOLVENCY: HIGH</div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">NET DISPOSABLE</p>
                        <h3 className="text-3xl font-bold text-slate-100">${state.finance.income}</h3>
                      </div>
                      <div className="flex gap-1 h-8 items-end">
                        {[40, 70, 45, 90, 60, 80].map((h, i) => (
                           <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>

                    {/* Health Card */}
                    <div className="glass p-6 space-y-4 border-red-500/10 hover:border-red-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-red-500/10 rounded-lg"><Activity className="text-red-400" size={18} /></div>
                        <div className="text-[10px] font-mono text-red-500 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/20">BIO-SYNC: ACTIVE</div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">VITALITY QUOTIENT</p>
                        <h3 className="text-3xl font-bold text-slate-100">84%</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="p-1.5 bg-white/5 rounded border border-white/5">SLEEP: {state.wellbeing.sleepHours}h</div>
                        <div className="p-1.5 bg-white/5 rounded border border-white/5 uppercase">STRESS: {state.wellbeing.stress}</div>
                      </div>
                    </div>
                  </div>

                  {!aiResponse && !isAnalyzing && (
                    <div className="glass p-20 text-center border-dashed border-white/10">
                      <LayoutDashboard className="mx-auto mb-4 text-slate-700" size={48} />
                      <h3 className="text-xl font-semibold mb-2">OS Ready for Initialization</h3>
                      <p className="text-slate-500 mb-6 max-w-sm mx-auto text-sm">
                        Synchronize your academic, financial, and physiological telemetry in the respective tabs to generate a strategic dashboard.
                      </p>
                      <button 
                        onClick={handleAnalyze}
                        className="px-8 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-2xl"
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

              {activeTab === 'academics' && (
                <motion.div 
                  key="academics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <section className="glass p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-400" />
                        🎓 Courses & Telemetry
                      </h3>
                      <span className="status-pill bg-green-500/20 text-green-400 font-mono">GPA: {state.academics.gpa}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 group transition-all hover:border-white/10">
                        <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Academic Performance (GPA)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={state.academics.gpa}
                          onChange={(e) => setState({
                            ...state,
                            academics: { ...state.academics, gpa: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-slate-100 font-bold"
                        />
                      </div>
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                         <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Subject Name</label>
                          <input 
                            type="text"
                            value={state.profile.name}
                            onChange={(e) => setState({
                              ...state,
                              profile: { ...state.profile, name: e.target.value }
                            })}
                            className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-slate-100"
                          />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Active Modules</label>
                        <button 
                          onClick={() => {
                            const newCourse = { id: Math.random().toString(36).substr(2, 9), name: '', credit: 0, grade: '' };
                            setState({
                              ...state,
                              academics: { ...state.academics, courses: [...state.academics.courses, newCourse] }
                            });
                          }}
                          className="text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 border border-blue-500/20 transition-all uppercase font-bold"
                        >
                          <Plus size={12} /> Add Module
                        </button>
                      </div>
                      {state.academics.courses.length === 0 && (
                        <div className="p-8 border border-dashed border-white/5 rounded-xl text-center">
                          <p className="text-xs text-slate-500 italic">No module data detected.</p>
                        </div>
                      )}
                      {state.academics.courses.map((course, idx) => (
                        <div key={course.id} className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all">
                          <div className="flex-1">
                            <input 
                              placeholder="Module ID / Name"
                              value={course.name}
                              onChange={(e) => {
                                const newCourses = [...state.academics.courses];
                                newCourses[idx].name = e.target.value;
                                setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                              }}
                              className="bg-transparent border-none w-full p-1 outline-none text-sm font-medium"
                            />
                          </div>
                          <div className="w-20">
                             <input 
                              type="number"
                              placeholder="CR"
                              value={course.credit}
                              onChange={(e) => {
                                const newCourses = [...state.academics.courses];
                                newCourses[idx].credit = parseInt(e.target.value) || 0;
                                setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                              }}
                              className="bg-slate-950/50 border border-white/10 rounded px-2 py-1 w-full text-xs text-center font-mono"
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newCourses = state.academics.courses.filter(c => c.id !== course.id);
                              setState({ ...state, academics: { ...state.academics, courses: newCourses } });
                            }}
                            className="text-slate-600 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">💰 Liquidity Management</h3>
                      <div className="space-y-5">
                        {['Rent', 'Food', 'Transport', 'Study'].map((cat) => (
                          <div key={cat} className="flex items-center justify-between group">
                            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{cat}</span>
                            <div className="flex items-center gap-2">
                               <span className="text-slate-600 font-mono text-xs">$</span>
                               <input 
                                  type="number" 
                                  value={state.finance[cat.toLowerCase() as keyof typeof state.finance] || 0}
                                  onChange={(e) => setState({
                                    ...state,
                                    finance: { ...state.finance, [cat.toLowerCase()]: parseFloat(e.target.value) || 0 }
                                  })}
                                  className="w-28 bg-slate-950/50 border border-white/10 p-2 rounded-lg text-right text-sm outline-none focus:ring-1 focus:ring-green-500 font-mono font-bold"
                               />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="glass p-6 bg-gradient-to-br from-green-500/5 to-blue-500/5 flex flex-col justify-between border-green-500/20">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 font-mono">FINANCIAL SOLVENCY INDEX</h3>
                        <div className={cn(
                          "text-5xl font-bold tracking-tighter transition-colors",
                          (state.finance.income - (state.finance.rent + state.finance.food + state.finance.transport + state.finance.study)) >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          ${state.finance.income - (state.finance.rent + state.finance.food + state.finance.transport + state.finance.study)}
                          <span className="text-[10px] text-slate-500 ml-3 font-mono uppercase tracking-widest">Net Surplus</span>
                        </div>
                      </div>
                      <div className="mt-12 bg-white/5 p-4 rounded-xl border border-white/5">
                         <label className="block text-[10px] font-mono uppercase text-slate-500 mb-2">Total Periodic Revenue</label>
                         <div className="flex items-center gap-2">
                           <span className="text-slate-600 font-mono text-xs">$</span>
                           <input 
                              type="number"
                              value={state.finance.income}
                              onChange={(e) => setState({
                                ...state,
                                finance: { ...state.finance, income: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full bg-slate-950/50 border border-white/10 p-4 rounded-lg outline-none focus:ring-1 focus:ring-green-500 text-slate-100 font-bold font-mono"
                              placeholder="Monthly total"
                           />
                         </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'health' && (
                <motion.div 
                  key="health"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                   <div className="glass p-8">
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
                        <span className="status-pill bg-blue-500/20 text-blue-400 px-3">Tracking Online</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-8">
                            <div>
                               <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Metabolic Activity Index</label>
                               <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
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
                            <div>
                               <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Current Mass (KG)</label>
                               <input 
                                  type="number"
                                  value={state.health.weight}
                                  onChange={(e) => setState({...state, health: {...state.health, weight: parseInt(e.target.value) || 0}})}
                                  className="w-full bg-slate-950/50 border border-white/10 p-4 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                               />
                            </div>
                         </div>
                         
                         <div className="space-y-4">
                            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Nutritional Intake Sequence</label>
                            <div className="space-y-3">
                               {state.health.mealsToday.map((meal, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 group">
                                     <span className="text-xs font-semibold text-slate-200">{meal}</span>
                                     <button 
                                        onClick={() => {
                                          const newMeals = [...state.health.mealsToday];
                                          newMeals.splice(idx, 1);
                                          setState({...state, health: {...state.health, mealsToday: newMeals}});
                                        }}
                                        className="text-slate-600 hover:text-red-400 transition-colors"
                                     >
                                        <X size={16} />
                                     </button>
                                  </div>
                               ))}
                               <div className="flex gap-2 pt-2">
                                  <input 
                                     id="meal-input"
                                     placeholder="LOG MEAL..."
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
                                    className="p-3 glass bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all rounded-xl"
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                   <div className="glass p-8">
                      <h3 className="text-[10px] font-mono uppercase text-slate-500 tracking-widest mb-8 flex items-center gap-2">
                        <Brain size={14} className="text-purple-400" />
                        Psychological Telemetry
                      </h3>
                      <div className="space-y-10">
                         <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Focus State Evaluation</label>
                            <div className="grid grid-cols-3 gap-3">
                               {['Good', 'Distracted', 'Overloaded'].map(s => (
                                 <button 
                                   key={s}
                                   onClick={() => setState({...state, wellbeing: {...state.wellbeing, focus: s as any}})}
                                   className={cn(
                                     "py-3 rounded-xl border text-[10px] font-bold uppercase transition-all tracking-wider",
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
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Cortisol Level (STRESS)</label>
                            <div className="grid grid-cols-3 gap-3">
                               {['Low', 'Medium', 'High'].map(s => (
                                 <button 
                                   key={s}
                                   onClick={() => setState({...state, wellbeing: {...state.wellbeing, stress: s as any}})}
                                   className={cn(
                                     "py-3 rounded-xl border text-[10px] font-bold uppercase transition-all tracking-wider",
                                     state.wellbeing.stress === s 
                                       ? "bg-red-500/80 border-red-500 text-white shadow-lg shadow-red-950" 
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
                   
                   <div className="glass p-8 bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-dashed flex flex-col justify-center items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Zap size={32} className="text-blue-400" />
                      </div>
                      <h4 className="text-base font-bold text-slate-100 tracking-tight mb-2">RECOVERY DEPTH</h4>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Circadian Duration Log</p>
                      <div className="flex items-center gap-10">
                         <button onClick={() => setState({...state, wellbeing: {...state.wellbeing, sleepHours: Math.max(0, state.wellbeing.sleepHours - 1)}})} className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/5 text-xl font-bold transition-all">-</button>
                         <div className="flex flex-col">
                            <span className="text-7xl font-mono font-bold tracking-tighter text-blue-400">{state.wellbeing.sleepHours}</span>
                            <span className="text-[10px] font-mono text-slate-600 uppercase font-bold tracking-[0.3em]">HOURS</span>
                         </div>
                         <button onClick={() => setState({...state, wellbeing: {...state.wellbeing, sleepHours: state.wellbeing.sleepHours + 1}})} className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/5 text-xl font-bold transition-all">+</button>
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
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingProfile(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Modify Base Identifiers</h2>
                <button onClick={() => setIsEditingProfile(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-blue-500/50 transition-all">
                      <img 
                        src={state.profile.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.profile.name}`} 
                        className="w-full h-full object-cover"
                        alt="Profile preview"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl cursor-pointer">
                      <Upload size={20} className="text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Display Name</label>
                  <input 
                    value={state.profile.name}
                    onChange={(e) => setState({...state, profile: {...state.profile, name: e.target.value}})}
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Academic Institution (School)</label>
                  <input 
                    value={state.profile.university}
                    onChange={(e) => setState({...state, profile: {...state.profile, university: e.target.value}})}
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Stanford University"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Country of Residence</label>
                  <input 
                    value={state.profile.country || ''}
                    onChange={(e) => setState({...state, profile: {...state.profile, country: e.target.value}})}
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Canada"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Profile Image URL</label>
                  <input 
                    value={state.profile.profileImageUrl || ''}
                    onChange={(e) => setState({...state, profile: {...state.profile, profileImageUrl: e.target.value}})}
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="https://..."
                  />
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                   <button 
                     onClick={handleSyncBiometrics}
                     disabled={isSyncingBiometrics}
                     className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest group"
                   >
                     {isSyncingBiometrics ? <Loader2 className="animate-spin" size={16} /> : <Fingerprint size={16} className="group-hover:scale-110 transition-transform" />}
                     Establish Biometric Link
                   </button>
                   {biometricStatus && <p className="text-[9px] font-mono text-blue-500 text-center uppercase tracking-tighter">{biometricStatus}</p>}
                </div>
              </div>

              <button 
                onClick={() => setIsEditingProfile(false)}
                className="w-full py-4 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors shadow-xl"
              >
                Commit Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {user && <Chatbot />}
    </div>
  );
}

