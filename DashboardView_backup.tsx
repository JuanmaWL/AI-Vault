import React, { useMemo } from 'react';
import { VideoRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface DashboardViewProps {
  videos: VideoRecord[];
}

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

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

    // Resolution distribution
    const resCounts = videos.reduce((acc, v) => {
      const res = `${v.width}x${v.height}`;
      acc[res] = (acc[res] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const resData = Object.entries(resCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top LoRAs
    const loraCounts = videos.reduce((acc, v) => {
      if (v.loras) {
        v.loras.forEach(l => {
          acc[l.name] = (acc[l.name] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);
    const loraData = Object.entries(loraCounts)
      .map(([name, Usos]) => ({ name, Usos }))
      .sort((a, b) => b.Usos - a.Usos)
      .slice(0, 10);

    // Timeline (Videos per day)
    const timelineCounts = videos.reduce((acc, v) => {
      const date = new Date(v.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    // We should sort dates, but for now we just use order of appearance since it's grouped.
    // Actually, sorting by timestamp to get correct order:
    const sortedVideos = [...videos].sort((a, b) => a.createdAt - b.createdAt);
    const timelineOrdered = sortedVideos.reduce((acc, v) => {
      const date = new Date(v.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      if (!acc.find(item => item.name === date)) {
        acc.push({ name: date, Vídeos: 0 });
      }
      const item = acc.find(item => item.name === date)!;
      item.Vídeos += 1;
      return acc;
    }, [] as {name: string, Vídeos: number}[]);

    return { modelData, avgRenderData, resData, loraData, timelineOrdered };
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
        <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg shadow-xl">
          <p className="text-neutral-300 text-sm font-medium mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-sm font-mono" style={{ color: p.color }}>
              {p.name}: {p.value} {p.name === 'Promedio' ? 'segundos' : ''}
            </p>
          ))}
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

        {/* Avg Render Time (Bar) */}
        {stats.avgRenderData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Tiempo Medio de Renderizado</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.avgRenderData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={(val) => `${val}s`} />
                  <YAxis dataKey="name" type="category" stroke="#525252" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Promedio" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Generaciones en el tiempo */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Actividad (Generaciones por Día)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.timelineOrdered}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#525252" fontSize={12} />
                <YAxis stroke="#525252" fontSize={12} allowDecimals={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Vídeos" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, fill: '#14b8a6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top LoRAs */}
        {stats.loraData.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">LoRAs Más Usados</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.loraData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="name" stroke="#525252" fontSize={12} />
                  <YAxis stroke="#525252" fontSize={12} allowDecimals={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Usos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Resolución (Pie) */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Resoluciones</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.resData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {stats.resData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
