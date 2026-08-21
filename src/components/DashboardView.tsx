import React, { useMemo } from 'react';
import { VideoRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface DashboardViewProps {
  videos: VideoRecord[];
}

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

export function DashboardView({ videos }: DashboardViewProps) {
  const stats = useMemo(() => {
    if (!videos.length) return null;

    // Model usage
    const modelCounts = videos.reduce((acc, v) => {
      acc[v.model] = (acc[v.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const modelData = Object.entries(modelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Avg Render Time by Model
    const renderTimes = videos.reduce((acc, v) => {
      if (v.renderSeconds) {
        if (!acc[v.model]) acc[v.model] = { sum: 0, count: 0 };
        acc[v.model].sum += v.renderSeconds;
        acc[v.model].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    const avgRenderData = Object.entries(renderTimes)
      .map(([name, { sum, count }]) => ({ 
        name, 
        Promedio: Math.round((sum / count) * 10) / 10 
      }))
      .sort((a, b) => b.Promedio - a.Promedio);

    // Avg Render Time by LoRA
    const loraRenderTimes = videos.reduce((acc, v) => {
      if (v.renderSeconds && v.loras && v.loras.length > 0) {
        v.loras.forEach(l => {
          if (!acc[l.name]) acc[l.name] = { sum: 0, count: 0 };
          acc[l.name].sum += v.renderSeconds!;
          acc[l.name].count += 1;
        });
      }
      return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    const avgLoraRenderData = Object.entries(loraRenderTimes)
      .map(([name, { sum, count }]) => ({ 
        name, 
        Promedio: Math.round((sum / count) * 10) / 10 
      }))
      .sort((a, b) => b.Promedio - a.Promedio)
      .slice(0, 10);

    // Avg Render Time by Resolution
    const resRenderTimes = videos.reduce((acc, v) => {
      if (v.renderSeconds) {
        const res = `${v.width}x${v.height}`;
        if (!acc[res]) acc[res] = { sum: 0, count: 0 };
        acc[res].sum += v.renderSeconds;
        acc[res].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    const avgResRenderData = Object.entries(resRenderTimes)
      .map(([name, { sum, count }]) => ({ 
        name, 
        Promedio: Math.round((sum / count) * 10) / 10 
      }))
      .sort((a, b) => b.Promedio - a.Promedio);

    // Avg Steps by Model
    const stepsByModel = videos.reduce((acc, v) => {
      if (v.steps) {
        if (!acc[v.model]) acc[v.model] = { sum: 0, count: 0 };
        acc[v.model].sum += v.steps;
        acc[v.model].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    const avgStepsData = Object.entries(stepsByModel)
      .map(([name, { sum, count }]) => ({ 
        name, 
        Pasos: Math.round((sum / count) * 10) / 10 
      }))
      .sort((a, b) => b.Pasos - a.Pasos);

    // Avg Shift by Model
    const shiftByModel = videos.reduce((acc, v) => {
      if (v.shift) {
        if (!acc[v.model]) acc[v.model] = { sum: 0, count: 0 };
        acc[v.model].sum += v.shift;
        acc[v.model].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    const avgShiftData = Object.entries(shiftByModel)
      .map(([name, { sum, count }]) => ({ 
        name, 
        Shift: Math.round((sum / count) * 10) / 10 
      }))
      .sort((a, b) => b.Shift - a.Shift);

    return { modelData, avgRenderData, avgLoraRenderData, avgResRenderData, avgStepsData, avgShiftData };
  }, [videos]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center">
        <h3 className="text-xl font-semibold text-neutral-300 mb-2">No hay suficientes datos</h3>
        <p className="text-neutral-500">Añade más vídeos para ver las analíticas.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg shadow-xl z-50">
          <p className="text-neutral-300 text-sm font-medium mb-1">{label}</p>
          {payload.map((p: any, i: number) => {
            const isTime = p.name === 'Promedio';
            const displayValue = isTime ? formatTime(p.value) : p.value;
            return (
              <p key={i} className="text-sm font-mono" style={{ color: p.color }}>
                {p.name}: {displayValue}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Model Usage (Pie) */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Modelos más usados</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.modelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {stats.modelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Render Time by Model (Bar) */}
        {stats.avgRenderData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Tiempo Medio por Modelo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgRenderData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={formatTime} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Promedio" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Avg Render Time by Resolution (Bar) */}
        {stats.avgResRenderData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Tiempo Medio por Resolución</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgResRenderData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={formatTime} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Promedio" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Avg Render Time by LoRA (Bar) */}
        {stats.avgLoraRenderData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Tiempo Medio por LoRA (Top 10)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgLoraRenderData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={formatTime} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Promedio" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Avg Steps by Model (Bar) */}
        {stats.avgStepsData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Pasos Promedio por Modelo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgStepsData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Pasos" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Avg Shift by Model (Bar) */}
        {stats.avgShiftData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Shift Promedio por Modelo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgShiftData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Shift" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
