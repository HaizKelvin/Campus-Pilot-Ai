import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

export const BiometricVisualizer: React.FC = () => {
  const [dataPoints, setDataPoints] = useState<number[]>(Array(20).fill(0).map(() => Math.random() * 100));

  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints(prev => {
        const next = [...prev.slice(1), Math.random() * 100];
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-end gap-[1px] h-12 w-full px-2">
      {dataPoints.map((point, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{ height: `${point}%` }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="flex-1 bg-gradient-to-t from-blue-600/20 to-blue-400/80 rounded-t-[1px]"
        />
      ))}
    </div>
  );
};

export const PulseLine: React.FC = () => {
  return (
    <div className="w-full h-8 flex items-center justify-center overflow-hidden grayscale opacity-30">
      <svg width="100%" height="100%" viewBox="0 0 200 40">
        <motion.path
          d="M 0 20 L 40 20 L 50 10 L 60 30 L 70 20 L 100 20 L 110 5 L 120 35 L 130 20 L 200 20"
          fill="none"
          stroke="var(--color-blue-400)"
          strokeWidth="1"
          strokeDasharray="200"
          initial={{ strokeDashoffset: 200 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
};
