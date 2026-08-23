import React, { useState, useMemo } from 'react';
import { VideoRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Cpu, Clock, Sliders, Layers, Sparkles, Filter, Info, AlertCircle, 
  Zap, RotateCcw, Box, Monitor, Gauge, ArrowRight, CheckCircle2, TrendingDown, TrendingUp
} from 'lucide-react';

interface DashboardViewProps {
  videos: VideoRecord[];
}

type MetricMode = 'renderSeconds' | 'secPerStep';

const PIE_COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];
const GPU_COLORS = ['#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#f43f5e', '#a855f7'];

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

const formatSecPerStep = (val: number) => {
  return `${val.toFixed(2)} s/step`;
};

export function DashboardView({ videos }: DashboardViewProps) {
  // Phase 1: Local Cross-Filters for Dashboard
  const [selectedGpu, setSelectedGpu] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedResolution, setSelectedResolution] = useState<string>('all');
  const [selectedLoraFilter, setSelectedLoraFilter] = useState<'all' | 'with_lora' | 'without_lora'>('all');

  // Phase 2: Performance Metric Mode (Total Render Time vs Normalized s/step)
  const [metricMode, setMetricMode] = useState<MetricMode>('renderSeconds');

  // Discover all GPUs available across all videos
  const availableGpus = useMemo(() => {
    const gpuCounts: Record<string, number> = {};
    videos.forEach(v => {
      const gpuName = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
      gpuCounts[gpuName] = (gpuCounts[gpuName] || 0) + 1;
    });
    return Object.entries(gpuCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [videos]);

  // Discover all Models available across all videos
  const availableModels = useMemo(() => {
    const modelCounts: Record<string, number> = {};
    videos.forEach(v => {
      const model = v.model || 'Desconocido';
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });
    return Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [videos]);

  // Discover all Resolutions available across all videos
  const availableResolutions = useMemo(() => {
    const resCounts: Record<string, number> = {};
    videos.forEach(v => {
      if (v.width && v.height) {
        const res = `${v.width}x${v.height}`;
        resCounts[res] = (resCounts[res] || 0) + 1;
      }
    });
    return Object.entries(resCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [videos]);

  // Phase 3: Hardware Benchmark Matrix (GPU A vs GPU B Head-to-Head under identical conditions)
  const [benchmarkGpuA, setBenchmarkGpuA] = useState<string>('');
  const [benchmarkGpuB, setBenchmarkGpuB] = useState<string>('');

  // Auto-initialize benchmark GPUs if available
  useMemo(() => {
    if (availableGpus.length >= 2) {
      if (!benchmarkGpuA || !availableGpus.find(g => g.name === benchmarkGpuA)) {
        setBenchmarkGpuA(availableGpus[0].name);
      }
      if (!benchmarkGpuB || !availableGpus.find(g => g.name === benchmarkGpuB)) {
        setBenchmarkGpuB(availableGpus[1].name);
      }
    } else if (availableGpus.length === 1) {
      if (!benchmarkGpuA) setBenchmarkGpuA(availableGpus[0].name);
    }
  }, [availableGpus]);

  // Compute Head-to-Head Comparison Matrix for GPU A vs GPU B
  const benchmarkComparison = useMemo(() => {
    if (!benchmarkGpuA || !benchmarkGpuB || benchmarkGpuA === benchmarkGpuB) return null;

    // Collect all unique conditions (Model + Resolution) across all videos
    type ConditionData = {
      model: string;
      resolution: string;
      gpuA: {
        totalSecPerStep: number;
        totalRenderSec: number;
        count: number;
      };
      gpuB: {
        totalSecPerStep: number;
        totalRenderSec: number;
        count: number;
      };
    };

    const conditionMap: Record<string, ConditionData> = {};

    videos.forEach(v => {
      if (!v.model || !v.width || !v.height || typeof v.renderSeconds !== 'number' || v.renderSeconds <= 0) return;
      const gpu = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
      if (gpu !== benchmarkGpuA && gpu !== benchmarkGpuB) return;

      const res = `${v.width}x${v.height}`;
      const condKey = `${v.model}___${res}`;

      if (!conditionMap[condKey]) {
        conditionMap[condKey] = {
          model: v.model,
          resolution: res,
          gpuA: { totalSecPerStep: 0, totalRenderSec: 0, count: 0 },
          gpuB: { totalSecPerStep: 0, totalRenderSec: 0, count: 0 }
        };
      }

      const steps = typeof v.steps === 'number' && v.steps > 0 ? v.steps : 25; // fallback
      const secPerStep = v.renderSeconds / steps;

      if (gpu === benchmarkGpuA) {
        conditionMap[condKey].gpuA.totalRenderSec += v.renderSeconds;
        conditionMap[condKey].gpuA.totalSecPerStep += secPerStep;
        conditionMap[condKey].gpuA.count += 1;
      } else if (gpu === benchmarkGpuB) {
        conditionMap[condKey].gpuB.totalRenderSec += v.renderSeconds;
        conditionMap[condKey].gpuB.totalSecPerStep += secPerStep;
        conditionMap[condKey].gpuB.count += 1;
      }
    });

    // Match rows where BOTH GPUs have data
    const matchedRows = Object.values(conditionMap)
      .filter(c => c.gpuA.count > 0 && c.gpuB.count > 0)
      .map(c => {
        const avgSecStepA = c.gpuA.totalSecPerStep / c.gpuA.count;
        const avgSecStepB = c.gpuB.totalSecPerStep / c.gpuB.count;
        const avgRenderA = c.gpuA.totalRenderSec / c.gpuA.count;
        const avgRenderB = c.gpuB.totalRenderSec / c.gpuB.count;

        const fasterGpu = avgSecStepA < avgSecStepB ? 'A' : avgSecStepA > avgSecStepB ? 'B' : 'EQUAL';
        const diffPercent = avgSecStepA > 0 && avgSecStepB > 0
          ? fasterGpu === 'A'
            ? Math.round(((avgSecStepB - avgSecStepA) / avgSecStepB) * 100)
            : Math.round(((avgSecStepA - avgSecStepB) / avgSecStepA) * 100)
          : 0;

        return {
          model: c.model,
          resolution: c.resolution,
          gpuA: {
            avgSecPerStep: Math.round(avgSecStepA * 100) / 100,
            avgRenderSec: Math.round(avgRenderA * 10) / 10,
            count: c.gpuA.count,
          },
          gpuB: {
            avgSecPerStep: Math.round(avgSecStepB * 100) / 100,
            avgRenderSec: Math.round(avgRenderB * 10) / 10,
            count: c.gpuB.count,
          },
          fasterGpu,
          diffPercent
        };
      });

    // List exclusive workloads (runs that only exist on GPU A or GPU B, e.g. 33B model on 4080 Super vs 4070Ti)
    const exclusiveA = Object.values(conditionMap)
      .filter(c => c.gpuA.count > 0 && c.gpuB.count === 0)
      .map(c => ({
        model: c.model,
        resolution: c.resolution,
        count: c.gpuA.count,
        avgSecPerStep: Math.round((c.gpuA.totalSecPerStep / c.gpuA.count) * 100) / 100,
        avgRenderSec: Math.round((c.gpuA.totalRenderSec / c.gpuA.count) * 10) / 10,
      }));

    const exclusiveB = Object.values(conditionMap)
      .filter(c => c.gpuA.count === 0 && c.gpuB.count > 0)
      .map(c => ({
        model: c.model,
        resolution: c.resolution,
        count: c.gpuB.count,
        avgSecPerStep: Math.round((c.gpuB.totalSecPerStep / c.gpuB.count) * 100) / 100,
        avgRenderSec: Math.round((c.gpuB.totalRenderSec / c.gpuB.count) * 10) / 10,
      }));

    return {
      matchedRows,
      exclusiveA,
      exclusiveB,
      totalMatchedConditions: matchedRows.length
    };
  }, [videos, benchmarkGpuA, benchmarkGpuB]);

  // Filtered videos for the Dashboard based on Cross-Filters
  const dashboardVideos = useMemo(() => {
    return videos.filter(v => {
      // GPU filter
      if (selectedGpu !== 'all') {
        const gpuName = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
        if (gpuName !== selectedGpu) return false;
      }
      // Model filter
      if (selectedModel !== 'all') {
        const model = v.model || 'Desconocido';
        if (model !== selectedModel) return false;
      }
      // Resolution filter
      if (selectedResolution !== 'all') {
        const res = `${v.width}x${v.height}`;
        if (res !== selectedResolution) return false;
      }
      // LoRA filter
      if (selectedLoraFilter === 'with_lora') {
        if (!v.loras || v.loras.length === 0) return false;
      } else if (selectedLoraFilter === 'without_lora') {
        if (v.loras && v.loras.length > 0) return false;
      }
      return true;
    });
  }, [videos, selectedGpu, selectedModel, selectedResolution, selectedLoraFilter]);

  const hasActiveFilters = selectedGpu !== 'all' || selectedModel !== 'all' || selectedResolution !== 'all' || selectedLoraFilter !== 'all';

  const resetFilters = () => {
    setSelectedGpu('all');
    setSelectedModel('all');
    setSelectedResolution('all');
    setSelectedLoraFilter('all');
  };

  // Helper to extract the value for calculation (render time or sec per step)
  const getVideoMetric = (v: VideoRecord): number | null => {
    if (typeof v.renderSeconds !== 'number' || v.renderSeconds <= 0) return null;
    if (metricMode === 'renderSeconds') {
      return v.renderSeconds;
    }
    // secPerStep mode
    if (typeof v.steps === 'number' && v.steps > 0) {
      return v.renderSeconds / v.steps;
    }
    return null;
  };

  const stats = useMemo(() => {
    if (!dashboardVideos.length) return null;

    // 1. Model usage (Pie)
    const modelCounts = dashboardVideos.reduce((acc, v) => {
      acc[v.model] = (acc[v.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const modelData = Object.entries(modelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 2. Avg Render / Speed by Model & GPU
    // Group by model -> GPU -> stats
    const modelGpuRenderTimes = dashboardVideos.reduce((acc, v) => {
      const metricVal = getVideoMetric(v);
      if (metricVal !== null) {
        const model = v.model || 'Desconocido';
        const gpu = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
        if (!acc[model]) {
          acc[model] = {
            totalSum: 0,
            totalCount: 0,
            gpus: {} as Record<string, { sum: number; count: number }>
          };
        }
        acc[model].totalSum += metricVal;
        acc[model].totalCount += 1;
        if (!acc[model].gpus[gpu]) {
          acc[model].gpus[gpu] = { sum: 0, count: 0 };
        }
        acc[model].gpus[gpu].sum += metricVal;
        acc[model].gpus[gpu].count += 1;
      }
      return acc;
    }, {} as Record<string, { totalSum: number; totalCount: number; gpus: Record<string, { sum: number; count: number }> }>);

    // Get all distinct GPUs present in the render time dataset
    const distinctGpuSet = new Set<string>();
    Object.values(modelGpuRenderTimes).forEach(m => {
      Object.keys(m.gpus).forEach(g => distinctGpuSet.add(g));
    });
    const distinctGpus = Array.from(distinctGpuSet);

    const avgRenderData = Object.entries(modelGpuRenderTimes)
      .map(([model, data]) => {
        const row: any = {
          name: model,
          displayName: `${model} (n=${data.totalCount})`,
          _totalCount: data.totalCount,
          _overallAvg: metricMode === 'secPerStep'
            ? Math.round((data.totalSum / data.totalCount) * 100) / 100
            : Math.round((data.totalSum / data.totalCount) * 10) / 10,
          _counts: {} as Record<string, number>
        };
        Object.entries(data.gpus).forEach(([gpu, { sum, count }]) => {
          row[gpu] = metricMode === 'secPerStep'
            ? Math.round((sum / count) * 100) / 100
            : Math.round((sum / count) * 10) / 10;
          row._counts[gpu] = count;
        });
        return row;
      })
      .sort((a, b) => b._overallAvg - a._overallAvg);

    // 3. Avg Render / Speed by Resolution
    const resRenderTimes = dashboardVideos.reduce((acc, v) => {
      const metricVal = getVideoMetric(v);
      if (metricVal !== null && v.width && v.height) {
        const res = `${v.width}x${v.height}`;
        if (!acc[res]) acc[res] = { sum: 0, count: 0 };
        acc[res].sum += metricVal;
        acc[res].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    const avgResRenderData = Object.entries(resRenderTimes)
      .map(([name, { sum, count }]) => ({ 
        name, 
        displayName: `${name} (n=${count})`,
        Promedio: metricMode === 'secPerStep'
          ? Math.round((sum / count) * 100) / 100
          : Math.round((sum / count) * 10) / 10,
        count
      }))
      .sort((a, b) => b.Promedio - a.Promedio);

    // 4. Avg Render / Speed by LoRA
    const loraRenderTimes = dashboardVideos.reduce((acc, v) => {
      const metricVal = getVideoMetric(v);
      if (metricVal !== null && v.loras && v.loras.length > 0) {
        v.loras.forEach(l => {
          if (!acc[l.name]) acc[l.name] = { sum: 0, count: 0 };
          acc[l.name].sum += metricVal;
          acc[l.name].count += 1;
        });
      }
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    const avgLoraRenderData = Object.entries(loraRenderTimes)
      .map(([name, { sum, count }]) => ({ 
        name, 
        displayName: `${name} (n=${count})`,
        Promedio: metricMode === 'secPerStep'
          ? Math.round((sum / count) * 100) / 100
          : Math.round((sum / count) * 10) / 10,
        count
      }))
      .sort((a, b) => b.Promedio - a.Promedio)
      .slice(0, 10);

    // 5. Steps Habit by Model (Usage configuration)
    const stepsByModel = dashboardVideos.reduce((acc, v) => {
      if (typeof v.steps === 'number' && v.steps > 0) {
        if (!acc[v.model]) acc[v.model] = { sum: 0, count: 0 };
        acc[v.model].sum += v.steps;
        acc[v.model].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    const avgStepsData = Object.entries(stepsByModel)
      .map(([name, { sum, count }]) => ({ 
        name, 
        displayName: `${name} (n=${count})`,
        Pasos: Math.round((sum / count) * 10) / 10,
        count
      }))
      .sort((a, b) => b.Pasos - a.Pasos);

    // 6. Shift Habit by Model (Usage configuration)
    const shiftByModel = dashboardVideos.reduce((acc, v) => {
      if (typeof v.shift === 'number') {
        if (!acc[v.model]) acc[v.model] = { sum: 0, count: 0 };
        acc[v.model].sum += v.shift;
        acc[v.model].count += 1;
      }
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    const avgShiftData = Object.entries(shiftByModel)
      .map(([name, { sum, count }]) => ({ 
        name, 
        displayName: `${name} (n=${count})`,
        Shift: Math.round((sum / count) * 10) / 10,
        count
      }))
      .sort((a, b) => b.Shift - a.Shift);

    return { 
      modelData, 
      avgRenderData, 
      distinctGpus,
      avgLoraRenderData, 
      avgResRenderData, 
      avgStepsData, 
      avgShiftData 
    };
  }, [dashboardVideos, metricMode]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-900 border border-neutral-800 p-3.5 rounded-xl shadow-2xl z-50 max-w-xs backdrop-blur-md">
          <p className="text-neutral-200 text-xs font-semibold mb-2 border-b border-neutral-800/80 pb-1.5">
            {label || payload[0]?.payload?.name}
          </p>
          <div className="flex flex-col gap-2.5">
            {payload.map((p: any, i: number) => {
              const isMetricValue = p.name === 'Promedio' || stats?.distinctGpus.includes(p.dataKey);
              let displayValue = p.value;
              if (isMetricValue) {
                displayValue = metricMode === 'renderSeconds' ? formatTime(p.value) : formatSecPerStep(p.value);
              }
              
              // Determine sample size n
              let count = p.payload._counts?.[p.dataKey];
              if (count === undefined) {
                count = p.payload.count;
              }
              if (count === undefined && p.dataKey === 'value') {
                count = p.value; // Pie chart slice
              }
              
              const isSingleSample = count === 1;

              return (
                <div key={i} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between gap-3 font-mono">
                    <span className="flex items-center gap-1.5" style={{ color: p.color || '#0ea5e9' }}>
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: p.color || '#0ea5e9' }} />
                      <span className="font-sans font-medium text-neutral-300">{p.name}:</span>
                    </span>
                    <span className="font-bold text-neutral-100">{displayValue}</span>
                  </div>

                  {count !== undefined && p.dataKey !== 'value' && (
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pl-3.5">
                      <span>Muestra:</span>
                      <span className="font-mono text-neutral-300">n = {count} vídeo{count === 1 ? '' : 's'}</span>
                    </div>
                  )}

                  {isSingleSample && p.dataKey !== 'value' && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-300 pl-3.5 font-sans bg-amber-950/40 border border-amber-800/50 rounded px-1.5 py-0.5">
                      <span>⚠️ dato único, no es una media fiable</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!videos.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center">
        <h3 className="text-xl font-semibold text-neutral-300 mb-2">No hay suficientes datos</h3>
        <p className="text-neutral-500">Añade más vídeos para ver las analíticas.</p>
      </div>
    );
  }

  const axisFormatter = (val: number) => {
    return metricMode === 'renderSeconds' ? formatTime(val) : `${val}s/it`;
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      
      {/* Dashboard Master Toolbar: Cross-Filters + Metric Mode Selector */}
      <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex flex-col gap-4 shadow-sm">
        
        {/* Header with Title & Metric Mode Toggle */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                Panel de Métricas y Benchmark de Rendimiento
              </h2>
              <p className="text-xs text-neutral-400">
                Aísla combinaciones exactas de hardware, modelo y resolución para comparaciones justas
              </p>
            </div>
          </div>

          {/* Phase 2: Metric Mode Switcher */}
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 p-1 rounded-xl shrink-0 self-stretch sm:self-auto justify-center">
            <span className="text-[11px] font-semibold text-neutral-400 pl-2 pr-1 hidden sm:inline">Métrica:</span>
            <button
              type="button"
              onClick={() => setMetricMode('renderSeconds')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricMode === 'renderSeconds'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Tiempo Total (s)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('secPerStep')}
              title="Normaliza el tiempo dividiendo entre los pasos de sampling (s/step). Permite comparar la velocidad pura de la GPU independientemente del número de pasos."
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricMode === 'secPerStep'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Velocidad Normalizada (s/step)
            </button>
          </div>
        </div>

        {/* Phase 1: Cross-Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* GPU Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dash-gpu" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-teal-400" />
              GPU:
            </label>
            <select
              id="dash-gpu"
              value={selectedGpu}
              onChange={(e) => setSelectedGpu(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Todas las GPUs ({videos.length})</option>
              {availableGpus.map(g => (
                <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
              ))}
            </select>
          </div>

          {/* Model Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dash-model" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <Box className="w-3 h-3 text-teal-400" />
              Modelo / Variante:
            </label>
            <select
              id="dash-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Todos los modelos ({videos.length})</option>
              {availableModels.map(m => (
                <option key={m.name} value={m.name}>{m.name} ({m.count})</option>
              ))}
            </select>
          </div>

          {/* Resolution Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dash-res" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <Monitor className="w-3 h-3 text-teal-400" />
              Resolución:
            </label>
            <select
              id="dash-res"
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Todas las resoluciones ({videos.length})</option>
              {availableResolutions.map(r => (
                <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
              ))}
            </select>
          </div>

          {/* LoRA Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="dash-lora" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-teal-400" />
              Presencia de LoRA:
            </label>
            <div className="flex items-center gap-2">
              <select
                id="dash-lora"
                value={selectedLoraFilter}
                onChange={(e) => setSelectedLoraFilter(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="all">Todos (con o sin LoRA)</option>
                <option value="without_lora">Solo limpios (Sin LoRA)</option>
                <option value="with_lora">Solo con LoRA(s)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Restablecer todos los filtros de análisis"
                  className="shrink-0 p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl border border-neutral-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Filter feedback active badges */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/60 text-xs">
            <span className="text-teal-400 font-medium flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Muestra filtrada activa: <strong>{dashboardVideos.length}</strong> de {videos.length} vídeos analizados
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-neutral-400 hover:text-teal-300 underline text-[11px] cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}

      </div>

      {!stats || dashboardVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/30 border border-neutral-800/60 rounded-2xl text-center">
          <Info className="w-8 h-8 text-neutral-600 mb-3" />
          <h3 className="text-base font-semibold text-neutral-300 mb-1">Sin datos para los filtros seleccionados</h3>
          <p className="text-xs text-neutral-500 mb-4">No se han registrado vídeos con esta combinación exacta de GPU, modelo o resolución.</p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-teal-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            Restablecer filtros cruzados
          </button>
        </div>
      ) : (
        <>
          {/* SECTION 1: RENDERING METRICS & BENCHMARKS */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {metricMode === 'secPerStep' ? (
                  <Zap className="w-4 h-4 text-amber-400" />
                ) : (
                  <Clock className="w-4 h-4 text-teal-400" />
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  {metricMode === 'secPerStep'
                    ? 'Benchmark Normalizado: Velocidad de Cómputo (s/step)'
                    : 'Métricas de Rendimiento y Tiempo Total de Render'}
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500 hidden sm:inline">
                {metricMode === 'secPerStep'
                  ? 'Menor valor = Mayor velocidad de generación por paso'
                  : 'Tiempo medio total de ejecución'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Model Usage (Pie) */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Modelos más usados</h4>
                  <span className="text-xs text-neutral-500 font-mono">{dashboardVideos.length} vídeos</span>
                </div>
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
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Avg Render Time / Speed by Model (Grouped by GPU when multiple GPUs exist) */}
              {stats.avgRenderData.length > 0 ? (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
                      {metricMode === 'secPerStep' ? 'Velocidad por Modelo (s/step)' : 'Tiempo Medio por Modelo'}
                    </h4>
                    {stats.distinctGpus.length > 1 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40">
                        Agrupado por GPU
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-4">
                    {metricMode === 'secPerStep'
                      ? 'Segundos requeridos por cada paso de muestreo (s/step). Las barras con n=1 tienen opacidad reducida.'
                      : 'Tiempos promedio reales de renderizado. Las barras con n=1 tienen opacidad reducida.'}
                  </p>
                  
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgRenderData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={axisFormatter} />
                        <YAxis dataKey="displayName" type="category" stroke="#a3a3a3" fontSize={11} width={150} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        {stats.distinctGpus.length > 1 && (
                          <Legend 
                            wrapperStyle={{ paddingTop: 10, fontSize: 11 }} 
                            formatter={(value) => <span className="text-neutral-300 text-xs">{value}</span>}
                          />
                        )}
                        {stats.distinctGpus.map((gpu, gpuIdx) => {
                          const barColor = GPU_COLORS[gpuIdx % GPU_COLORS.length];
                          return (
                            <Bar 
                              key={gpu} 
                              dataKey={gpu} 
                              name={gpu}
                              fill={barColor} 
                              radius={[0, 4, 4, 0]}
                            >
                              {stats.avgRenderData.map((entry, entryIdx) => {
                                const count = entry._counts?.[gpu] || 0;
                                return (
                                  <Cell 
                                    key={`cell-gpu-${gpuIdx}-${entryIdx}`} 
                                    fill={barColor} 
                                    opacity={count === 1 ? 0.45 : count > 1 ? 1 : 0} 
                                  />
                                );
                              })}
                            </Bar>
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {/* Avg Render Time / Speed by Resolution (Bar) */}
              {stats.avgResRenderData.length > 0 && (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
                  <h4 className="text-sm font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                    {metricMode === 'secPerStep' ? 'Velocidad por Resolución (s/step)' : 'Tiempo Medio por Resolución'}
                  </h4>
                  <p className="text-[11px] text-neutral-500 mb-4">
                    Impacto de la resolución en la carga de cómputo por frame.
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgResRenderData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={axisFormatter} />
                        <YAxis dataKey="displayName" type="category" stroke="#a3a3a3" fontSize={11} width={130} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="Promedio" fill="#14b8a6" radius={[0, 4, 4, 0]}>
                          {stats.avgResRenderData.map((entry, index) => (
                            <Cell 
                              key={`cell-res-${index}`} 
                              fill="#14b8a6" 
                              opacity={entry.count === 1 ? 0.45 : 1} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Avg Render Time / Speed by LoRA (Bar) */}
              {stats.avgLoraRenderData.length > 0 && (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
                  <h4 className="text-sm font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                    {metricMode === 'secPerStep' ? 'Velocidad por LoRA (s/step - Top 10)' : 'Tiempo Medio por LoRA (Top 10)'}
                  </h4>
                  <p className="text-[11px] text-neutral-500 mb-4">
                    Comparativa de coste de renderizado según los LoRAs aplicados.
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgLoraRenderData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#525252" fontSize={12} tickFormatter={axisFormatter} />
                        <YAxis dataKey="displayName" type="category" stroke="#a3a3a3" fontSize={11} width={140} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="Promedio" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                          {stats.avgLoraRenderData.map((entry, index) => (
                            <Cell 
                              key={`cell-lora-${index}`} 
                              fill="#8b5cf6" 
                              opacity={entry.count === 1 ? 0.45 : 1} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* SECTION 3: PHASE 3 - HARDWARE BENCHMARK MATRIX (GPU A vs GPU B HEAD-TO-HEAD) */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Matriz de Benchmark de Hardware (Cara a Cara)
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">
                Comparativa directa entre GPUs bajo <strong>condiciones idénticas</strong> (mismo modelo y resolución)
              </span>
            </div>

            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-6">
              
              {/* GPU Selectors Header */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label htmlFor="benchmark-gpu-a" className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    GPU Primaria (A):
                  </label>
                  <select
                    id="benchmark-gpu-a"
                    value={benchmarkGpuA}
                    onChange={(e) => setBenchmarkGpuA(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 hover:border-sky-500 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-neutral-100 font-medium focus:outline-none transition-colors cursor-pointer"
                  >
                    {availableGpus.map(g => (
                      <option key={`a-${g.name}`} value={g.name} disabled={g.name === benchmarkGpuB}>
                        {g.name} ({g.count} vídeos) {g.name === benchmarkGpuB ? '(Seleccionada en B)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-center shrink-0 px-2">
                  <div className="px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-300">
                    VS
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label htmlFor="benchmark-gpu-b" className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    GPU Comparada (B):
                  </label>
                  <select
                    id="benchmark-gpu-b"
                    value={benchmarkGpuB}
                    onChange={(e) => setBenchmarkGpuB(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 hover:border-purple-500 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-neutral-100 font-medium focus:outline-none transition-colors cursor-pointer"
                  >
                    {availableGpus.map(g => (
                      <option key={`b-${g.name}`} value={g.name} disabled={g.name === benchmarkGpuA}>
                        {g.name} ({g.count} vídeos) {g.name === benchmarkGpuA ? '(Seleccionada en A)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Benchmark Results */}
              {!benchmarkComparison || (benchmarkComparison.matchedRows.length === 0 && benchmarkComparison.exclusiveA.length === 0 && benchmarkComparison.exclusiveB.length === 0) ? (
                <div className="flex flex-col items-center justify-center p-8 bg-neutral-950/40 border border-neutral-800/60 rounded-xl text-center">
                  <Info className="w-6 h-6 text-neutral-500 mb-2" />
                  <p className="text-xs text-neutral-400">
                    Selecciona dos GPUs distintas para analizar la velocidad y compatibilidad cruzada.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  
                  {/* Matched conditions table (Strict Apples-to-Apples) */}
                  {benchmarkComparison.matchedRows.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                          Pruebas Directas Equivalentes ({benchmarkComparison.matchedRows.length} condiciones idénticas):
                        </span>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          Mismo Modelo + Misma Resolución
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-neutral-800">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-neutral-950 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                              <th className="py-3 px-4">Modelo & Resolución</th>
                              <th className="py-3 px-4 text-sky-400">{benchmarkGpuA}</th>
                              <th className="py-3 px-4 text-purple-400">{benchmarkGpuB}</th>
                              <th className="py-3 px-4 text-right">Diferencia de Velocidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800/70 bg-neutral-900/40 font-mono">
                            {benchmarkComparison.matchedRows.map((row, idx) => {
                              const isAFaster = row.fasterGpu === 'A';
                              const isBFaster = row.fasterGpu === 'B';
                              return (
                                <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                                  <td className="py-3 px-4 font-sans font-medium text-neutral-200">
                                    <div className="flex flex-col">
                                      <span>{row.model}</span>
                                      <span className="text-[11px] text-neutral-500 font-mono">{row.resolution}</span>
                                    </div>
                                  </td>
                                  
                                  {/* GPU A data */}
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col">
                                      <span className={`font-bold ${isAFaster ? 'text-sky-300' : 'text-neutral-300'}`}>
                                        {row.gpuA.avgSecPerStep} s/step
                                      </span>
                                      <span className="text-[10px] text-neutral-500 font-sans">
                                        Render medio: {formatTime(row.gpuA.avgRenderSec)} (n={row.gpuA.count})
                                      </span>
                                    </div>
                                  </td>

                                  {/* GPU B data */}
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col">
                                      <span className={`font-bold ${isBFaster ? 'text-purple-300' : 'text-neutral-300'}`}>
                                        {row.gpuB.avgSecPerStep} s/step
                                      </span>
                                      <span className="text-[10px] text-neutral-500 font-sans">
                                        Render medio: {formatTime(row.gpuB.avgRenderSec)} (n={row.gpuB.count})
                                      </span>
                                    </div>
                                  </td>

                                  {/* Difference badge */}
                                  <td className="py-3 px-4 text-right font-sans">
                                    {row.fasterGpu === 'EQUAL' ? (
                                      <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-[11px] font-semibold">
                                        Rendimiento Idéntico
                                      </span>
                                    ) : (
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                        isAFaster
                                          ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                          : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                      }`}>
                                        {isAFaster ? (
                                          <>
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            {benchmarkGpuA} es +{row.diffPercent}% más rápida
                                          </>
                                        ) : (
                                          <>
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            {benchmarkGpuB} es +{row.diffPercent}% más rápida
                                          </>
                                        )}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Sin coincidencias directas idénticas aún:</strong> No hay vídeos generados exactamente con el mismo modelo y resolución en ambas tarjetas gráficas para establecer una comparación 1:1.
                      </div>
                    </div>
                  )}

                  {/* Exclusive Workloads (e.g. Modelos pesados de 33B o altas resoluciones solo probadas en una GPU) */}
                  {(benchmarkComparison.exclusiveA.length > 0 || benchmarkComparison.exclusiveB.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      
                      {/* Exclusive to GPU A */}
                      <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          Cargas exclusivas de {benchmarkGpuA}:
                        </span>
                        <p className="text-[11px] text-neutral-500 mb-1">
                          Modelos/resoluciones ejecutados en {benchmarkGpuA} sin réplica en {benchmarkGpuB} (ej. modelos de mayor tamaño o pruebas aisladas).
                        </p>
                        {benchmarkComparison.exclusiveA.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {benchmarkComparison.exclusiveA.map((item, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
                                <strong>{item.model}</strong> ({item.resolution}) • {item.avgSecPerStep} s/step <span className="text-neutral-500">(n={item.count})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-600 italic">Ninguna carga exclusiva.</span>
                        )}
                      </div>

                      {/* Exclusive to GPU B */}
                      <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          Cargas exclusivas de {benchmarkGpuB}:
                        </span>
                        <p className="text-[11px] text-neutral-500 mb-1">
                          Modelos/resoluciones ejecutados en {benchmarkGpuB} sin réplica en {benchmarkGpuA}.
                        </p>
                        {benchmarkComparison.exclusiveB.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {benchmarkComparison.exclusiveB.map((item, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
                                <strong>{item.model}</strong> ({item.resolution}) • {item.avgSecPerStep} s/step <span className="text-neutral-500">(n={item.count})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-600 italic">Ninguna carga exclusiva.</span>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          </div>

          {/* SECTION 4: USAGE CONFIGURATION & HABITS (Separated from performance metrics) */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Hábitos de Uso y Configuración
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500">
                Parámetros de generación habituales (preferencias de usuario, no rendimiento del sistema)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Usual Steps by Model (Bar) */}
              {stats.avgStepsData.length > 0 && (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
                      Configuración habitual: Pasos por Modelo
                    </h4>
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-4">
                    Promedio de sampling steps asignados por los usuarios en cada modelo.
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgStepsData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#525252" fontSize={12} />
                        <YAxis dataKey="displayName" type="category" stroke="#a3a3a3" fontSize={11} width={140} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="Pasos" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                          {stats.avgStepsData.map((entry, index) => (
                            <Cell 
                              key={`cell-steps-${index}`} 
                              fill="#f59e0b" 
                              opacity={entry.count === 1 ? 0.45 : 1} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Usual Shift by Model (Bar) */}
              {stats.avgShiftData.length > 0 && (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
                      Configuración habitual: Shift por Modelo
                    </h4>
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-4">
                    Valor promedio de shift/schedule configurado para cada modelo.
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.avgShiftData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#525252" fontSize={12} />
                        <YAxis dataKey="displayName" type="category" stroke="#a3a3a3" fontSize={11} width={140} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="Shift" fill="#f43f5e" radius={[0, 4, 4, 0]}>
                          {stats.avgShiftData.map((entry, index) => (
                            <Cell 
                              key={`cell-shift-${index}`} 
                              fill="#f43f5e" 
                              opacity={entry.count === 1 ? 0.45 : 1} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

    </div>
  );
}

