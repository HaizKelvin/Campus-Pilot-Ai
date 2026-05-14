import React from 'react';
import { motion } from 'motion/react';

interface LogEntry {
  timestamp: string;
  category: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

const COLORS = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

export const KernelLog: React.FC<{ entries: LogEntry[] }> = ({ entries }) => {
  return (
    <div className="space-y-1 font-mono text-[9px] leading-tight">
      {entries.map((entry, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex gap-2"
        >
          <span className="text-slate-600">[{entry.timestamp}]</span>
          <span className="text-white/40 uppercase">{entry.category}:</span>
          <span className={COLORS[entry.type]}>{entry.message}</span>
        </motion.div>
      ))}
    </div>
  );
};
