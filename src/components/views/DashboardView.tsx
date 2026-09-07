import React, { useState, useMemo } from 'react';
import { VideoRecord } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  Cpu, Clock, Sliders, Layers, Sparkles, Filter, Info, AlertCircle, 
  Zap, RotateCcw, Box, Monitor, Gauge, ArrowRight, CheckCircle2, TrendingDown, TrendingUp,
  Folder, Wrench, Film, AppWindow, Compass, X, Activity, Award, Target
} from 'lucide-react';
import { calculateEfficiencyMetrics } from '../../lib/utils';

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
  const [selectedModelSize, setSelectedModelSize] = useState<string>('all');
  const [selectedResolution, setSelectedResolution] = useState<string>('all');
  const [selectedSpeedFilter, setSelectedSpeedFilter] = useState<string>('all');
  const [selectedLoraFilter, setSelectedLoraFilter] = useState<'all' | 'with_lora' | 'without_lora'>('all');
  const [selectedSoftwareSource, setSelectedSoftwareSource] = useState<string>('all');
  const [selectedOrientation, setSelectedOrientation] = useState<string>('all');

  // Phase 2: Performance Metric Mode (Total Render Time vs Normalized s/step)
  const [metricMode, setMetricMode] = useState<MetricMode>('renderSeconds');
  const [scatterGroupBy, setScatterGroupBy] = useState<'gpu' | 'model'>('gpu');
  const [efficiencyMode, setEfficiencyMode] = useState<'basic' | 'detailed'>('basic');

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

  // Discover all Model Sizes available across all videos
  const availableModelSizes = useMemo(() => {
    const sizeCounts: Record<string, number> = {};
    videos.forEach(v => {
      if (typeof v.modelSizeB === 'number') {
        const sizeLabel = `${v.modelSizeB}B`;
        sizeCounts[sizeLabel] = (sizeCounts[sizeLabel] || 0) + 1;
      }
    });
    return Object.entries(sizeCounts)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
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

  // Discover all Software Sources available across all videos
  const availableSoftwareSources = useMemo(() => {
    const sourceCounts: Record<string, number> = {};
    videos.forEach(v => {
      const src = v.softwareSource || 'other';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    return Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [videos]);

  // Discover all Orientations available across all videos
  const availableOrientations = useMemo(() => {
    const orientationCounts: Record<string, number> = {};
    videos.forEach(v => {
      const orient = v.orientation || 'other';
      orientationCounts[orient] = (orientationCounts[orient] || 0) + 1;
    });
    return Object.entries(orientationCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [videos]);

  // Discover all Speed ratings available across all videos
  const availableSpeeds = useMemo(() => {
    const speedCounts: Record<string, number> = {};
    videos.forEach(v => {
      const eff = calculateEfficiencyMetrics(v.renderSeconds, v.steps, v.width, v.height);
      const label = eff ? eff.ratingLabel : 'Sin datos';
      speedCounts[label] = (speedCounts[label] || 0) + 1;
    });
    const order = ['Ultrarrápido', 'Óptimo', 'Equilibrado', 'Lento', 'Muy Lento', 'Sin datos'];
    return order
      .filter(name => (speedCounts[name] || 0) > 0)
      .map(name => ({ name, count: speedCounts[name] }));
  }, [videos]);

  // Helper function to format full model name including parameter size if available
  const getFullModelName = (v: VideoRecord): string => {
    const base = v.model || 'Desconocido';
    if (typeof v.modelSizeB === 'number') {
      return `${base} ${v.modelSizeB}B`;
    }
    return base;
  };

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

    // Collect all unique conditions (Full Model + Resolution) across all videos
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

      const fullModel = getFullModelName(v);
      const res = `${v.width}x${v.height}`;
      const condKey = `${fullModel}___${res}`;

      if (!conditionMap[condKey]) {
        conditionMap[condKey] = {
          model: fullModel,
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
      // Model size filter
      if (selectedModelSize !== 'all') {
        const sizeLabel = typeof v.modelSizeB === 'number' ? `${v.modelSizeB}B` : 'none';
        if (sizeLabel !== selectedModelSize) return false;
      }
      // Resolution filter
      if (selectedResolution !== 'all') {
        const res = `${v.width}x${v.height}`;
        if (res !== selectedResolution) return false;
      }
      // Speed filter
      if (selectedSpeedFilter !== 'all') {
        const eff = calculateEfficiencyMetrics(v.renderSeconds, v.steps, v.width, v.height);
        if (selectedSpeedFilter === 'Sin datos') {
          if (eff !== null) return false;
        } else {
          if (!eff || eff.ratingLabel !== selectedSpeedFilter) return false;
        }
      }
      // Software Source filter
      if (selectedSoftwareSource !== 'all') {
        const src = v.softwareSource || 'other';
        if (src !== selectedSoftwareSource) return false;
      }
      // Orientation filter
      if (selectedOrientation !== 'all') {
        const orient = v.orientation || 'other';
        if (orient !== selectedOrientation) return false;
      }
      // LoRA filter
      if (selectedLoraFilter === 'with_lora') {
        if (!v.loras || v.loras.length === 0) return false;
      } else if (selectedLoraFilter === 'without_lora') {
        if (v.loras && v.loras.length > 0) return false;
      }
      return true;
    });
  }, [videos, selectedGpu, selectedModel, selectedModelSize, selectedResolution, selectedSpeedFilter, selectedSoftwareSource, selectedOrientation, selectedLoraFilter]);

  const hasActiveFilters = selectedGpu !== 'all' || selectedModel !== 'all' || selectedModelSize !== 'all' || selectedResolution !== 'all' || selectedSpeedFilter !== 'all' || selectedSoftwareSource !== 'all' || selectedOrientation !== 'all' || selectedLoraFilter !== 'all';

  // Software pipeline and catalog distribution analysis for current filtered view
  const softwareStats = useMemo(() => {
    let wan2gp = 0;
    let maestro = 0;
    let comfyui = 0;
    let other = 0;
    const modelSet = new Set<string>();
    const folderSet = new Set<string>();

    dashboardVideos.forEach((v) => {
      const src = v.softwareSource || 'other';
      if (src === 'wan2gp') wan2gp++;
      else if (src === 'maestro') maestro++;
      else if (src === 'comfyui') comfyui++;
      else other++;

      if (v.model?.trim()) {
        modelSet.add(v.model.trim().toLowerCase());
      }
      if (v.groupName?.trim()) {
        folderSet.add(v.groupName.trim());
      }
    });

    const total = dashboardVideos.length;

    return {
      total,
      wan2gp,
      maestro,
      comfyui,
      other,
      wan2gpPct: total > 0 ? Math.round((wan2gp / total) * 100) : 0,
      maestroPct: total > 0 ? Math.round((maestro / total) * 100) : 0,
      comfyuiPct: total > 0 ? Math.round((comfyui / total) * 100) : 0,
      otherPct: total > 0 ? Math.round((other / total) * 100) : 0,
      modelsCount: modelSet.size,
      foldersCount: folderSet.size,
    };
  }, [dashboardVideos]);

  const resetFilters = () => {
    setSelectedGpu('all');
    setSelectedModel('all');
    setSelectedModelSize('all');
    setSelectedResolution('all');
    setSelectedSpeedFilter('all');
    setSelectedSoftwareSource('all');
    setSelectedOrientation('all');
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
      const fullModel = getFullModelName(v);
      acc[fullModel] = (acc[fullModel] || 0) + 1;
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
        const fullModel = getFullModelName(v);
        const gpu = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
        if (!acc[fullModel]) {
          acc[fullModel] = {
            totalSum: 0,
            totalCount: 0,
            gpus: {} as Record<string, { sum: number; count: number }>
          };
        }
        acc[fullModel].totalSum += metricVal;
        acc[fullModel].totalCount += 1;
        if (!acc[fullModel].gpus[gpu]) {
          acc[fullModel].gpus[gpu] = { sum: 0, count: 0 };
        }
        acc[fullModel].gpus[gpu].sum += metricVal;
        acc[fullModel].gpus[gpu].count += 1;
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
        const fullModel = getFullModelName(v);
        if (!acc[fullModel]) acc[fullModel] = { sum: 0, count: 0 };
        acc[fullModel].sum += v.steps;
        acc[fullModel].count += 1;
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
        const fullModel = getFullModelName(v);
        if (!acc[fullModel]) acc[fullModel] = { sum: 0, count: 0 };
        acc[fullModel].sum += v.shift;
        acc[fullModel].count += 1;
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

  // Phase 2 (3.2): Scatter Plot Data (Pasos vs Tiempo de Render con agrupaciones por GPU/Modelo)
  const scatterData = useMemo(() => {
    const groups: Record<string, Array<{
      x: number;
      y: number;
      title: string;
      model: string;
      gpu: string;
      resolution: string;
      secPerStep: number;
      secPerStepPerMegapixel?: number;
      efficiencyLabel?: string;
      efficiencyScore?: number;
    }>> = {};

    dashboardVideos.forEach(v => {
      if (typeof v.steps === 'number' && v.steps > 0 && typeof v.renderSeconds === 'number' && v.renderSeconds > 0) {
        const gpuName = v.hardware?.gpu?.trim() || 'Sin GPU especificada';
        const fullModel = getFullModelName(v);
        const groupKey = scatterGroupBy === 'gpu' ? gpuName : fullModel;

        const eff = calculateEfficiencyMetrics(v.renderSeconds, v.steps, v.width, v.height);
        const secPerStep = v.renderSeconds / v.steps;

        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }

        groups[groupKey].push({
          x: v.steps,
          y: Math.round(v.renderSeconds * 10) / 10,
          title: v.title || 'Sin título',
          model: fullModel,
          gpu: gpuName,
          resolution: v.width && v.height ? `${v.width}x${v.height}` : 'N/A',
          secPerStep: Math.round(secPerStep * 100) / 100,
          secPerStepPerMegapixel: eff?.secPerStepPerMegapixel,
          efficiencyLabel: eff?.ratingLabel,
          efficiencyScore: eff?.score,
        });
      }
    });

    const series = Object.entries(groups).map(([name, points], idx) => {
      const avgSecPerStep = points.reduce((sum, p) => sum + p.secPerStep, 0) / points.length;
      return {
        name,
        color: GPU_COLORS[idx % GPU_COLORS.length],
        points,
        avgSecPerStep: Math.round(avgSecPerStep * 100) / 100,
        count: points.length,
      };
    }).sort((a, b) => a.avgSecPerStep - b.avgSecPerStep);

    return series;
  }, [dashboardVideos, scatterGroupBy]);

  // Phase 2 (3.1): Radar / Benchmark de Eficiencia Técnica (s/step relativo a megapíxeles y VRAM)
  const efficiencyBenchmark = useMemo(() => {
    interface ConfigBucket {
      model: string;
      resolution: string;
      gpu: string;
      vram?: number;
      totalSecPerStep: number;
      totalSecPerStepPerMp: number;
      totalMpPerSec: number;
      megapixels: number;
      scores: number[];
      count: number;
      ratings: Record<string, number>;
    }

    const map: Record<string, ConfigBucket> = {};

    dashboardVideos.forEach(v => {
      if (typeof v.renderSeconds !== 'number' || v.renderSeconds <= 0 || !v.steps || !v.width || !v.height) return;
      const eff = calculateEfficiencyMetrics(v.renderSeconds, v.steps, v.width, v.height);
      if (!eff) return;

      const fullModel = getFullModelName(v);
      const res = `${v.width}x${v.height}`;
      const gpu = v.hardware?.gpu?.trim() || 'Sin GPU';
      const key = `${fullModel}__${res}__${gpu}`;

      if (!map[key]) {
        map[key] = {
          model: fullModel,
          resolution: res,
          gpu,
          vram: v.hardware?.vram,
          totalSecPerStep: 0,
          totalSecPerStepPerMp: 0,
          totalMpPerSec: 0,
          megapixels: eff.megapixels,
          scores: [],
          count: 0,
          ratings: {},
        };
      }

      map[key].totalSecPerStep += eff.secPerStep;
      map[key].totalSecPerStepPerMp += eff.secPerStepPerMegapixel;
      map[key].totalMpPerSec += eff.megapixelsPerSecond;
      map[key].scores.push(eff.score);
      map[key].count += 1;
      map[key].ratings[eff.ratingLabel] = (map[key].ratings[eff.ratingLabel] || 0) + 1;
    });

    const list = Object.values(map).map(b => {
      const avgSecPerStep = Math.round((b.totalSecPerStep / b.count) * 100) / 100;
      const avgSecPerStepPerMp = Math.round((b.totalSecPerStepPerMp / b.count) * 100) / 100;
      const avgMpPerSec = Math.round((b.totalMpPerSec / b.count) * 1000) / 1000;
      const avgScore = Math.round(b.scores.reduce((sum, s) => sum + s, 0) / b.scores.length);

      let ratingLabel = 'Equilibrado';
      let ratingColor = 'text-blue-300';
      let ratingBg = 'bg-blue-950/40';
      let ratingBorder = 'border-blue-800/60';

      if (avgSecPerStepPerMp < 15) {
        ratingLabel = 'Ultrarrápido';
        ratingColor = 'text-emerald-300';
        ratingBg = 'bg-emerald-950/40';
        ratingBorder = 'border-emerald-700/60';
      } else if (avgSecPerStepPerMp < 40) {
        ratingLabel = 'Óptimo';
        ratingColor = 'text-teal-300';
        ratingBg = 'bg-teal-950/40';
        ratingBorder = 'border-teal-700/60';
      } else if (avgSecPerStepPerMp < 80) {
        ratingLabel = 'Equilibrado';
        ratingColor = 'text-indigo-300';
        ratingBg = 'bg-indigo-950/40';
        ratingBorder = 'border-indigo-800/60';
      } else if (avgSecPerStepPerMp < 140) {
        ratingLabel = 'Lento';
        ratingColor = 'text-amber-300';
        ratingBg = 'bg-amber-950/40';
        ratingBorder = 'border-amber-800/60';
      } else {
        ratingLabel = 'Muy Lento';
        ratingColor = 'text-rose-300';
        ratingBg = 'bg-rose-950/40';
        ratingBorder = 'border-rose-800/60';
      }

      return {
        ...b,
        avgSecPerStep,
        avgSecPerStepPerMp,
        avgMpPerSec,
        avgScore,
        ratingLabel,
        ratingColor,
        ratingBg,
        ratingBorder,
      };
    }).sort((a, b) => a.avgSecPerStepPerMp - b.avgSecPerStepPerMp);

    // Distribution
    const distribution: Record<string, number> = {
      'Ultrarrápido': 0,
      'Óptimo': 0,
      'Equilibrado': 0,
      'Lento': 0,
      'Muy Lento': 0
    };
    list.forEach(item => {
      distribution[item.ratingLabel] = (distribution[item.ratingLabel] || 0) + item.count;
    });

    return {
      ranking: list,
      distribution,
      totalAnalyzed: list.reduce((sum, item) => sum + item.count, 0)
    };
  }, [dashboardVideos]);

  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="bg-neutral-900 border border-neutral-750 p-3.5 rounded-xl shadow-2xl z-50 max-w-sm backdrop-blur-md">
          <p className="text-neutral-100 text-xs font-bold mb-1 truncate max-w-[240px]">
            {data.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-950 border border-neutral-800 text-teal-300">
              {data.model}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-950 border border-neutral-800 text-sky-300">
              {data.gpu}
            </span>
            {data.resolution && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800">
                {data.resolution}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-neutral-800 pt-2 text-xs font-mono">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="font-sans text-neutral-400">Pasos:</span>
              <span className="font-bold text-neutral-100">{data.x} pasos</span>
            </div>
            <div className="flex items-center justify-between text-neutral-300">
              <span className="font-sans text-neutral-400">Tiempo Render:</span>
              <span className="font-bold text-teal-300">{formatTime(data.y)} ({data.y}s)</span>
            </div>
            <div className="flex items-center justify-between text-neutral-300">
              <span className="font-sans text-neutral-400">Velocidad:</span>
              <span className="font-bold text-amber-300">{data.secPerStep} s/step</span>
            </div>
            {data.secPerStepPerMegapixel !== undefined && (
              <div className="flex items-center justify-between text-neutral-300">
                <span className="font-sans text-neutral-400">Eficiencia Normalizada:</span>
                <span className="font-bold text-sky-300">{data.secPerStepPerMegapixel} s/step/MP</span>
              </div>
            )}
            {data.efficiencyLabel && (
              <div className="flex items-center justify-between text-neutral-300 pt-1 border-t border-neutral-800/80">
                <span className="font-sans text-neutral-400">Calificación:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-neutral-950 border border-neutral-800 text-neutral-200">
                  {data.efficiencyLabel} ({data.efficiencyScore}/100)
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

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
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl flex flex-col shadow-lg overflow-hidden divide-y divide-neutral-800/80">
        
        {/* Top Header: Title & Metric Mode Toggle */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                Panel de Métricas y Benchmark de Rendimiento
              </h2>
              <p className="text-xs text-neutral-400">
                Aísla combinaciones exactas de hardware, modelo, software y resolución para comparaciones justas
              </p>
            </div>
          </div>

          {/* Phase 2: Metric Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800/90 p-1.5 rounded-xl shrink-0 self-stretch sm:self-auto justify-center shadow-inner">
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
            <div className="relative group/norm-metric flex items-center">
              <button
                type="button"
                onClick={() => setMetricMode('secPerStep')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  metricMode === 'secPerStep'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Velocidad Normalizada (s/step)</span>
                <span className="p-0.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 transition-colors">
                  <Info className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Tooltip informativo flotante */}
              <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-neutral-900 border border-neutral-750 text-neutral-200 text-xs rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/norm-metric:opacity-100 group-hover/norm-metric:pointer-events-auto transition-all z-30 flex flex-col gap-1.5 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" />
                  ¿Qué es la Velocidad Normalizada?
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Calcula el tiempo promedio por cada paso de sampling (<code className="text-amber-300 bg-neutral-950 px-1 py-0.5 rounded font-mono">Tiempo Total ÷ Pasos</code>).
                </p>
                <p className="text-[10px] text-neutral-400 leading-normal border-t border-neutral-800 pt-1.5">
                  Permite comparar la velocidad y potencia bruta de la GPU aislando si una generación se hizo a 15, 25 o 50 pasos. Menor valor = Mayor rapidez.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section Container */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 bg-neutral-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              Filtros Cruzados del Análisis
            </span>
          </div>

          {/* Cross-Filters Grid: 8 structured filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            
            {/* 1. GPU Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-gpu" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Cpu className={`w-3 h-3 ${selectedGpu !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                GPU
              </label>
              <select
                id="dash-gpu"
                value={selectedGpu}
                onChange={(e) => setSelectedGpu(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedGpu !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todas las GPUs ({videos.length})</option>
                {availableGpus.map(g => (
                  <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
                ))}
              </select>
            </div>

            {/* 2. Model Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-model" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Box className={`w-3 h-3 ${selectedModel !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                Modelo
              </label>
              <select
                id="dash-model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedModel !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todos los modelos ({videos.length})</option>
                {availableModels.map(m => (
                  <option key={m.name} value={m.name}>{m.name} ({m.count})</option>
                ))}
              </select>
            </div>

            {/* 3. Model Size Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-size" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Layers className={`w-3 h-3 ${selectedModelSize !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                Tamaño Modelo
              </label>
              <select
                id="dash-size"
                value={selectedModelSize}
                onChange={(e) => setSelectedModelSize(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedModelSize !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todos los tamaños ({videos.length})</option>
                {availableModelSizes.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
                ))}
              </select>
            </div>

            {/* 4. Resolution Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-res" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Monitor className={`w-3 h-3 ${selectedResolution !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                Resolución
              </label>
              <select
                id="dash-res"
                value={selectedResolution}
                onChange={(e) => setSelectedResolution(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedResolution !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todas las resoluciones ({videos.length})</option>
                {availableResolutions.map(r => (
                  <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
                ))}
              </select>
            </div>

            {/* 5. Speed Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-speed" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Zap className={`w-3 h-3 ${selectedSpeedFilter !== 'all' ? 'text-amber-400' : 'text-neutral-400'}`} />
                Velocidad
              </label>
              <select
                id="dash-speed"
                value={selectedSpeedFilter}
                onChange={(e) => setSelectedSpeedFilter(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedSpeedFilter !== 'all'
                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todas ({videos.length})</option>
                {availableSpeeds.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
                ))}
              </select>
            </div>

            {/* 6. Software Source Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-software" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <AppWindow className={`w-3 h-3 ${selectedSoftwareSource !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                Software
              </label>
              <select
                id="dash-software"
                value={selectedSoftwareSource}
                onChange={(e) => setSelectedSoftwareSource(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedSoftwareSource !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todo el software ({videos.length})</option>
                {availableSoftwareSources.map(s => {
                  const labelMap: Record<string, string> = {
                    wan2gp: 'Wan2GP',
                    maestro: 'Maestro',
                    comfyui: 'ComfyUI',
                    other: 'Otros / Cloud',
                  };
                  return (
                    <option key={s.name} value={s.name}>
                      {labelMap[s.name] || s.name} ({s.count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 7. Orientation Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-orient" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Compass className={`w-3 h-3 ${selectedOrientation !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                Orientación
              </label>
              <select
                id="dash-orient"
                value={selectedOrientation}
                onChange={(e) => setSelectedOrientation(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedOrientation !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todas ({videos.length})</option>
                {availableOrientations.map(o => {
                  const labelMap: Record<string, string> = {
                    '16:9': '16:9 (Horizontal)',
                    '9:16': '9:16 (Vertical)',
                    '1:1': '1:1 (Cuadrado)',
                    'other': 'Otro formato',
                  };
                  return (
                    <option key={o.name} value={o.name}>
                      {labelMap[o.name] || o.name} ({o.count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 8. LoRA Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dash-lora" className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                <Sparkles className={`w-3 h-3 ${selectedLoraFilter !== 'all' ? 'text-teal-400' : 'text-neutral-400'}`} />
                LoRA
              </label>
              <select
                id="dash-lora"
                value={selectedLoraFilter}
                onChange={(e) => setSelectedLoraFilter(e.target.value as any)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-all cursor-pointer border ${
                  selectedLoraFilter !== 'all'
                    ? 'bg-teal-950/30 border-teal-500/50 text-teal-200 font-medium'
                    : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-200 focus:border-teal-500'
                }`}
              >
                <option value="all">Todos (con/sin LoRA)</option>
                <option value="without_lora">Solo limpios (Sin LoRA)</option>
                <option value="with_lora">Solo con LoRA(s)</option>
              </select>
            </div>

          </div>

          {/* Active Filter Chips & Reset Row */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-neutral-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-neutral-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-teal-400" />
                  Activos:
                </span>
                
                {selectedGpu !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Cpu className="w-3 h-3 text-teal-400" />
                    GPU: {selectedGpu}
                    <button
                      type="button"
                      onClick={() => setSelectedGpu('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedModel !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Box className="w-3 h-3 text-teal-400" />
                    Modelo: {selectedModel}
                    <button
                      type="button"
                      onClick={() => setSelectedModel('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedModelSize !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Layers className="w-3 h-3 text-teal-400" />
                    Tamaño: {selectedModelSize}
                    <button
                      type="button"
                      onClick={() => setSelectedModelSize('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedResolution !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Monitor className="w-3 h-3 text-teal-400" />
                    Res: {selectedResolution}
                    <button
                      type="button"
                      onClick={() => setSelectedResolution('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedSpeedFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-medium">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Velocidad: {selectedSpeedFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedSpeedFilter('all')}
                      className="hover:text-white p-0.5 hover:bg-amber-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedSoftwareSource !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <AppWindow className="w-3 h-3 text-teal-400" />
                    Software: {selectedSoftwareSource === 'wan2gp' ? 'Wan2GP' : selectedSoftwareSource === 'maestro' ? 'Maestro' : selectedSoftwareSource === 'comfyui' ? 'ComfyUI' : 'Otros'}
                    <button
                      type="button"
                      onClick={() => setSelectedSoftwareSource('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedOrientation !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Compass className="w-3 h-3 text-teal-400" />
                    Orientación: {selectedOrientation}
                    <button
                      type="button"
                      onClick={() => setSelectedOrientation('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedLoraFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium">
                    <Sparkles className="w-3 h-3 text-teal-400" />
                    {selectedLoraFilter === 'with_lora' ? 'Solo con LoRA' : 'Sin LoRA'}
                    <button
                      type="button"
                      onClick={() => setSelectedLoraFilter('all')}
                      className="hover:text-white p-0.5 hover:bg-teal-500/20 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 hover:border-neutral-600 text-xs font-semibold transition-all cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3 text-teal-400" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

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
          {/* SECTION 0: CATALOG & PIPELINE DISTRIBUTION */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                    Desglose por Herramienta y Catálogo
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Distribución de pipelines de generación y diversidad de modelos en la muestra actual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-neutral-500" />
                  <strong className="text-neutral-200">{softwareStats.total}</strong> vídeos
                </span>
                <span className="text-neutral-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-neutral-500" />
                  <strong className="text-neutral-200">{softwareStats.modelsCount}</strong> {softwareStats.modelsCount === 1 ? 'modelo' : 'modelos'}
                </span>
                <span className="text-neutral-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-neutral-500" />
                  <strong className="text-neutral-200">{softwareStats.foldersCount}</strong> {softwareStats.foldersCount === 1 ? 'carpeta' : 'carpetas'}
                </span>
              </div>
            </div>

            {/* Pipeline Cards Grid (Only showing tools that actually exist in the current catalog) */}
            <div className={`grid gap-3.5 ${
              [softwareStats.wan2gp > 0, softwareStats.maestro > 0, softwareStats.comfyui > 0, softwareStats.other > 0].filter(Boolean).length === 1
                ? 'grid-cols-1 sm:grid-cols-2'
                : [softwareStats.wan2gp > 0, softwareStats.maestro > 0, softwareStats.comfyui > 0, softwareStats.other > 0].filter(Boolean).length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : [softwareStats.wan2gp > 0, softwareStats.maestro > 0, softwareStats.comfyui > 0, softwareStats.other > 0].filter(Boolean).length === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-2 lg:grid-cols-4'
            }`}>
              {/* Wan2GP */}
              {softwareStats.wan2gp > 0 && (
                <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-teal-500/30 transition-all flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-400">Wan2GP</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {softwareStats.wan2gpPct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-neutral-100">{softwareStats.wan2gp}</span>
                    <span className="text-xs text-neutral-500">{softwareStats.wan2gp === 1 ? 'vídeo' : 'vídeos'}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mt-1">
                    <div 
                      className="bg-teal-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${softwareStats.wan2gpPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Maestro */}
              {softwareStats.maestro > 0 && (
                <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-blue-500/30 transition-all flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400">Maestro</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {softwareStats.maestroPct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-neutral-100">{softwareStats.maestro}</span>
                    <span className="text-xs text-neutral-500">{softwareStats.maestro === 1 ? 'vídeo' : 'vídeos'}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mt-1">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${softwareStats.maestroPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ComfyUI */}
              {softwareStats.comfyui > 0 && (
                <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-purple-500/30 transition-all flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-400">ComfyUI</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {softwareStats.comfyuiPct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-neutral-100">{softwareStats.comfyui}</span>
                    <span className="text-xs text-neutral-500">{softwareStats.comfyui === 1 ? 'vídeo' : 'vídeos'}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mt-1">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${softwareStats.comfyuiPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Otros / Cloud */}
              {softwareStats.other > 0 && (
                <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300">Otros / Cloud</span>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                      {softwareStats.otherPct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-neutral-100">{softwareStats.other}</span>
                    <span className="text-xs text-neutral-500">{softwareStats.other === 1 ? 'vídeo' : 'vídeos'}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden mt-1">
                    <div 
                      className="bg-neutral-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${softwareStats.otherPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

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

              {/* PHASE 2 (3.2): GRÁFICO DE DISPERSIÓN INTERACTIVO (PASOS VS TIEMPO) */}
              {scatterData.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col gap-4 lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-bold text-neutral-200">
                          Dispersión de Rendimiento: Pasos vs Tiempo de Render
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Visualiza la pendiente de aceleración de cada hardware o modelo (menor inclinación = mayor velocidad por paso).
                      </p>
                    </div>

                    {/* Selector de agrupación / color */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                      <span className="text-[11px] text-neutral-400 font-medium px-2">Colorear por:</span>
                      <button
                        onClick={() => setScatterGroupBy('gpu')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          scatterGroupBy === 'gpu'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        GPU
                      </button>
                      <button
                        onClick={() => setScatterGroupBy('model')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          scatterGroupBy === 'model'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        Modelo
                      </button>
                    </div>
                  </div>

                  {/* Scatter Chart Container */}
                  <div className="h-80 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 25, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis 
                          type="number" 
                          dataKey="x" 
                          name="Pasos" 
                          stroke="#737373" 
                          fontSize={12}
                          unit="p"
                          label={{ value: 'Pasos de Muestreo (Steps)', position: 'insideBottom', offset: -12, fill: '#a3a3a3', fontSize: 11 }} 
                        />
                        <YAxis 
                          type="number" 
                          dataKey="y" 
                          name="Tiempo" 
                          stroke="#737373" 
                          fontSize={12}
                          tickFormatter={(v) => formatTime(v)}
                          label={{ value: 'Tiempo Render', angle: -90, position: 'insideLeft', offset: 0, fill: '#a3a3a3', fontSize: 11 }} 
                        />
                        <ZAxis range={[60, 60]} />
                        <RechartsTooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#525252' }} />
                        <Legend 
                          verticalAlign="top" 
                          align="right"
                          wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                        />
                        {scatterData.map((series) => (
                          <Scatter
                            key={`scatter-series-${series.name}`}
                            name={`${series.name} (${series.avgSecPerStep} s/step)`}
                            data={series.points}
                            fill={series.color}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Resumen de pendientes / Velocidades medias por grupo */}
                  <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-neutral-400 font-medium mr-1">Pendiente media (Velocidad):</span>
                    {scatterData.map((series) => (
                      <div
                        key={`slope-pill-${series.name}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-xs"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: series.color }} />
                        <span className="font-semibold text-neutral-200">{series.name}</span>
                        <span className="font-mono text-emerald-400 font-bold">{series.avgSecPerStep} s/step</span>
                        <span className="text-[10px] text-neutral-500 font-mono">(n={series.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PHASE 2 (3.1): RADAR / BENCHMARK DE EFICIENCIA TÉCNICA (s/step relativo a megapíxeles y VRAM) */}
              {efficiencyBenchmark.ranking.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col gap-5 lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-neutral-200">
                          Indicador de Eficiencia Técnica y Velocidad de Generación
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {efficiencyMode === 'basic'
                          ? 'Modo básico: Clasificación cualitativa de velocidad en 5 niveles para comprender el rendimiento de un vistazo.'
                          : 'Modo detallado: Métrica normalizada en s/step/MP (segundos por paso entre Megapíxeles) para comparar resoluciones.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Selector de modo: Básico (Etiquetas) vs Detallado (s/step/MP) */}
                      <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setEfficiencyMode('basic')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            efficiencyMode === 'basic'
                              ? 'bg-neutral-800 text-teal-300 shadow-sm'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Modo Básico (Etiquetas)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEfficiencyMode('detailed')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            efficiencyMode === 'detailed'
                              ? 'bg-neutral-800 text-teal-300 shadow-sm'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Modo Detallado (s/step/MP)
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
                        <Target className="w-3.5 h-3.5 text-teal-400" />
                        <span>{efficiencyBenchmark.totalAnalyzed} ejecuciones</span>
                      </div>
                    </div>
                  </div>

                  {/* Guía didáctica explicativa en Modo Detallado */}
                  {efficiencyMode === 'detailed' && (
                    <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-teal-300">
                        <Info className="w-4 h-4 text-teal-400 shrink-0" />
                        <span>Guía didáctica: ¿Qué es MP y cómo interpretar valores como 80s/step en 0.52 MP?</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-neutral-400 pt-1">
                        <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/60 flex flex-col gap-1">
                          <span className="font-bold text-sky-300 text-[11px] uppercase tracking-wide flex items-center gap-1">
                            1. ¿Qué es MP (Megapíxeles)?
                          </span>
                          <p className="leading-relaxed text-[11px]">
                            Es la resolución en millones de píxeles (<span className="font-mono text-neutral-300">Ancho × Alto ÷ 1.000.000</span>). Por ejemplo, 540×960 = <strong>0.52 MP</strong> y 720×1280 = <strong>0.92 MP</strong>.
                          </p>
                        </div>
                        <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/60 flex flex-col gap-1">
                          <span className="font-bold text-amber-300 text-[11px] uppercase tracking-wide flex items-center gap-1">
                            2. ¿Qué es 80s/step en 0.52 MP?
                          </span>
                          <p className="leading-relaxed text-[11px]">
                            Indica que la GPU tardó <strong>80 segundos</strong> en procesar cada paso de muestreo individual al generar una imagen de 0.52 MP.
                          </p>
                        </div>
                        <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/60 flex flex-col gap-1">
                          <span className="font-bold text-teal-300 text-[11px] uppercase tracking-wide flex items-center gap-1">
                            3. ¿Por qué s/step/MP?
                          </span>
                          <p className="leading-relaxed text-[11px]">
                            Al dividir <span className="font-mono text-neutral-300">80 ÷ 0.52 = 153.8 s/step/MP</span> se normaliza el coste a 1 Megapíxel estándar. Permite comparar resoluciones distintas. <strong>A menor valor, más rápido renderiza.</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Distribución por nivel de eficiencia */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-800/40 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase">Ultrarrápido</span>
                        <span className="text-[10px] font-mono text-emerald-300">&lt;15 s/MP</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-emerald-200">
                        {efficiencyBenchmark.distribution['Ultrarrápido']}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-teal-950/25 border border-teal-800/40 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-400 uppercase">Óptimo</span>
                        <span className="text-[10px] font-mono text-teal-300">15 - 40</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-teal-200">
                        {efficiencyBenchmark.distribution['Óptimo']}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-950/25 border border-indigo-800/40 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-400 uppercase">Equilibrado</span>
                        <span className="text-[10px] font-mono text-indigo-300">40 - 80</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-indigo-200">
                        {efficiencyBenchmark.distribution['Equilibrado']}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-800/40 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 uppercase">Lento</span>
                        <span className="text-[10px] font-mono text-amber-300">80 - 140</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-amber-200">
                        {efficiencyBenchmark.distribution['Lento']}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-800/40 flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-400 uppercase">Muy Lento</span>
                        <span className="text-[10px] font-mono text-rose-300">&gt;140 s/MP</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-rose-200">
                        {efficiencyBenchmark.distribution['Muy Lento']}
                      </span>
                    </div>
                  </div>

                  {/* Tabla / Ranking comparativo de configuraciones */}
                  <div className="overflow-x-auto rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Modelo</th>
                          <th className="py-2.5 px-3">Resolución</th>
                          <th className="py-2.5 px-3">GPU & VRAM</th>
                          {efficiencyMode === 'detailed' ? (
                            <>
                              <th className="py-2.5 px-3 text-right">Velocidad (s/step)</th>
                              <th className="py-2.5 px-3 text-right">Eficiencia (s/step/MP)</th>
                              <th className="py-2.5 px-3 text-right">Throughput (MP/s)</th>
                              <th className="py-2.5 px-3 text-center">Calificación</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2.5 px-3 text-right">Tiempo por Paso</th>
                              <th className="py-2.5 px-3 text-center">Nivel de Velocidad</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {efficiencyBenchmark.ranking.map((cfg, index) => (
                          <tr key={`cfg-${index}`} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="py-2 px-3 text-neutral-500 font-bold">{index + 1}</td>
                            <td className="py-2 px-3 font-sans font-medium text-neutral-200">
                              {cfg.model}
                            </td>
                            <td className="py-2 px-3 text-neutral-300">
                              <span>{cfg.resolution}</span>
                              <span className="text-neutral-500 text-[10px] ml-1">({cfg.megapixels} MP)</span>
                            </td>
                            <td className="py-2 px-3 font-sans text-neutral-300">
                              <span className="text-sky-300 font-medium">{cfg.gpu}</span>
                              {cfg.vram && (
                                <span className="text-neutral-500 text-[10px] ml-1 font-mono">({cfg.vram}G)</span>
                              )}
                            </td>
                            {efficiencyMode === 'detailed' ? (
                              <>
                                <td className="py-2 px-3 text-right text-amber-300 font-bold">
                                  {cfg.avgSecPerStep}s
                                </td>
                                <td className="py-2 px-3 text-right text-teal-300 font-bold">
                                  {cfg.avgSecPerStepPerMp}
                                </td>
                                <td className="py-2 px-3 text-right text-neutral-400">
                                  {cfg.avgMpPerSec}
                                </td>
                                <td className="py-2 px-3 text-center font-sans">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.ratingBg} ${cfg.ratingBorder} ${cfg.ratingColor}`}>
                                    {cfg.ratingLabel} ({cfg.avgScore}/100)
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 px-3 text-right text-neutral-200 font-medium">
                                  {cfg.avgSecPerStep}s / paso
                                </td>
                                <td className="py-2 px-3 text-center font-sans">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.ratingBg} ${cfg.ratingBorder} ${cfg.ratingColor}`}>
                                    {cfg.ratingLabel}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

