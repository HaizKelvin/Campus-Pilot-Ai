import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Clock, Zap, Shield, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

export const FocusMode: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [initialTime, setInitialTime] = useState(25 * 60);
  const [sessionCount, setSessionCount] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setSessionCount(s => s + 1);
      if (timerRef.current) clearInterval(timerRef.current);
      // Play a visual "ping" here
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(initialTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((initialTime - timeLeft) / initialTime) * 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="glass p-8 md:p-12 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-950 to-blue-900/20 border-blue-500/10">
        {/* Background Grids and Technical Details */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        
        <div className="absolute top-4 left-4 p-2 border border-white/5 bg-black/40 rounded flex items-center gap-2">
          <Brain size={12} className="text-blue-500" />
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500">Neural Focus Module v4.1</span>
        </div>

        <div className="absolute top-4 right-4 p-2 border border-white/5 bg-black/40 rounded flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-red-500 animate-pulse" : "bg-slate-700")} />
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500">
            {isActive ? 'TRANSMITTING' : 'IDLE'}
          </span>
        </div>

        {/* The Big Dial */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            {/* Background Circle */}
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-white/5 fill-none"
              strokeWidth="4"
              strokeDasharray="4 8"
            />
            {/* Progress Circle */}
            <motion.circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-blue-500 fill-none"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ strokeDasharray: "0 1000" }}
              animate={{ strokeDasharray: `${progress * 2.8} 1000` }}
              transition={{ ease: "linear" }}
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center">
            <motion.span 
              key={timeLeft}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl md:text-8xl font-mono font-bold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            >
              {formatTime(timeLeft)}
            </motion.span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.4em] mt-2">Time Remaining</span>
          </div>
          
          {/* Decorative Markers */}
          {[...Array(12)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-1 h-3 bg-white/10"
              style={{ 
                transform: `rotate(${i * 30}deg) translateY(-140px)`,
                backgroundColor: i * 30 < (progress * 3.6) ? 'var(--color-blue-500)' : undefined
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8 mt-12 z-10">
          <button 
            onClick={resetTimer}
            className="p-4 rounded-full border border-white/10 text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-90"
          >
            <RotateCcw size={20} />
          </button>
          
          <button 
            onClick={toggleTimer}
            className={cn(
              "p-8 rounded-3xl transition-all shadow-2xl active:scale-95 group",
              isActive 
                ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                : "bg-blue-600 border border-blue-400/30 text-white hover:bg-blue-500 shadow-blue-500/20"
            )}
          >
            {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="translate-x-0.5" />}
          </button>

          <div className="flex flex-col items-center">
             <div className="text-xl font-bold font-mono text-blue-400">{sessionCount}</div>
             <div className="text-[8px] font-mono text-slate-600 uppercase tracking-widest leading-none">Cycles</div>
          </div>
        </div>
      </div>

      {/* Configuration Presets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pomodoro', mins: 25, icon: Zap },
          { label: 'Long Break', mins: 15, icon: Shield },
          { label: 'Short Break', mins: 5, icon: Clock },
          { label: 'Deep Work', mins: 50, icon: Brain },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              const seconds = preset.mins * 60;
              setInitialTime(seconds);
              setTimeLeft(seconds);
              setIsActive(false);
            }}
            className={cn(
              "p-4 rounded-2xl glass flex flex-col items-center gap-2 transition-all hover:border-blue-500/40 group",
              initialTime === preset.mins * 60 ? "border-blue-500/50 bg-blue-500/5" : ""
            )}
          >
            <preset.icon size={16} className={initialTime === preset.mins * 60 ? "text-blue-400" : "text-slate-500 group-hover:text-blue-300"} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{preset.label}</span>
            <span className="text-[8px] font-mono text-slate-500">{preset.mins}m session</span>
          </button>
        ))}
      </div>
    </div>
  );
};
