import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { FinancialData, AcademicData } from '../types';

interface DashboardChartsProps {
  finance: FinancialData;
  academics: AcademicData;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ finance, academics }) => {
  // Process financial data
  const totalExpenses = finance.expenses.reduce((sum, e) => sum + e.amount, 0);
  const financeData = [
    { name: 'Income', value: finance.income, fill: 'var(--color-blue-500)' },
    { name: 'Expenses', value: totalExpenses, fill: 'var(--color-purple-500)' },
    { name: 'Surplus', value: Math.max(0, finance.income - totalExpenses), fill: 'var(--color-green-500)' }
  ];

  // Mock data for GPA trend (normally we'd have historical data)
  const gpaData = [
    { name: 'Term 1', gpa: 3.2 },
    { name: 'Term 2', gpa: 3.4 },
    { name: 'Term 3', gpa: 3.3 },
    { name: 'Term 4', gpa: 3.6 },
    { name: 'Current', gpa: academics.gpa || 3.5 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-2xl backdrop-blur-xl">
          <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">{label}</p>
          <p className="text-sm font-bold text-white">
            {typeof payload[0].value === 'number' && payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Finance Bar Chart */}
      <div className="glass p-6 min-h-[300px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            Solvency Stream Analysis
          </h3>
          <span className="text-[10px] text-blue-400 font-mono italic">ACTIVE_TELEMETRY</span>
        </div>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                {financeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GPA Trend Area Chart */}
      <div className="glass p-6 min-h-[300px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            Academic Trajectory Tracking
          </h3>
          <span className="text-[10px] text-purple-400 font-mono italic">UNIT: GPA</span>
        </div>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={gpaData}>
              <defs>
                <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-blue-500)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-blue-500)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                domain={[0, 4.0]} 
                hide 
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="gpa" 
                stroke="var(--color-blue-500)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorGpa)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
