import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoOrientation, VideoRecord } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractDriveFileId(url: string): string {
  if (!url) return '';
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

export function calculateOrientation(width: number, height: number): VideoOrientation {
  if (!width || !height) return '16:9';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  return 'other';
}

export function formatBytes(bytes?: number, decimals = 2): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const TEXT_ENCODER_OPTIONS = [
  'Default',
  'Qwen3-VL BF16',
  'Qwen3-VL Quanto INT8',
  'Qwen3-VL NVFP4 AWQ',
  'Qwen3-VL GGUF Q4_K_M',
  'Qwen3-VL GGUF Q2_K',
  'Not Found',
] as const;

export const VIDEO_VAE_OPTIONS = [
  'FP8 Mixed Precision',
  'Original VAE',
  'Not Found',
] as const;

export interface ExtractedTechnicalDetails {
  baseModel: string;
  videoVae: string;
  textEncoder: string;
  precision?: string;
  tags: string[];
}

export function extractTechnicalDetails(
  parsedJson?: any,
  rawComment: string = '',
  modelType: string = '',
  typeDesc: string = ''
): ExtractedTechnicalDetails {
  const jsonStr = typeof parsedJson === 'object' ? JSON.stringify(parsedJson) : '';
  const combined = `${modelType} ${typeDesc} ${rawComment} ${jsonStr}`.toLowerCase();
  
  // 1. Base Model Detection
  let baseModel = modelType.trim() || 'Wan 2.1';
  if (combined.includes('minimax') || combined.includes('h3')) {
    baseModel = 'Minimax H3';
  } else if (combined.includes('scail2')) {
    baseModel = 'Wan 2.1';
  } else if (combined.includes('wan 2.1') || combined.includes('wan_2.1') || combined.includes('wan2.1')) {
    baseModel = 'Wan 2.1';
  } else if (combined.includes('wan 2.2') || combined.includes('wan_2.2') || combined.includes('wan2.2')) {
    baseModel = 'Wan 2.2';
  } else if (combined.includes('ltx 2.5') || combined.includes('ltx_2.5') || combined.includes('ltx2.5') || combined.includes('ltx2_25')) {
    baseModel = 'LTX 2.5';
  } else if (combined.includes('ltx 2.3') || combined.includes('ltx_2.3') || combined.includes('ltx2.3') || combined.includes('ltx2')) {
    baseModel = 'LTX 2.3';
  } else if (combined.includes('hunyuan')) {
    baseModel = 'HunyuanVideo';
  }

  // 2. Text Encoder Detection (Minimax H3 / Qwen3-VL specific options)
  let textEncoder: string = 'Not Found';
  const rawTextEnc = parsedJson?.text_encoder || parsedJson?.text_encoder_name || parsedJson?.text_encoder_path || parsedJson?.t5_path || parsedJson?.llm;
  const textEncCombined = `${rawTextEnc || ''} ${combined}`.toLowerCase();

  if (textEncCombined.includes('q4_k_m') || textEncCombined.includes('q4-k-m') || textEncCombined.includes('q4km')) {
    textEncoder = 'Qwen3-VL GGUF Q4_K_M';
  } else if (textEncCombined.includes('q2_k') || textEncCombined.includes('q2-k') || textEncCombined.includes('q2k')) {
    textEncoder = 'Qwen3-VL GGUF Q2_K';
  } else if (textEncCombined.includes('quanto int8') || textEncCombined.includes('quanto_int8') || textEncCombined.includes('int8')) {
    textEncoder = 'Qwen3-VL Quanto INT8';
  } else if (textEncCombined.includes('nvfp4') || textEncCombined.includes('awq') || textEncCombined.includes('nvfp4 awq')) {
    textEncoder = 'Qwen3-VL NVFP4 AWQ';
  } else if (textEncCombined.includes('qwen3-vl bf16') || textEncCombined.includes('qwen3_vl_bf16') || (textEncCombined.includes('qwen3') && textEncCombined.includes('bf16'))) {
    textEncoder = 'Qwen3-VL BF16';
  } else if (textEncCombined.includes('default') && (textEncCombined.includes('encoder') || textEncCombined.includes('text'))) {
    textEncoder = 'Default';
  } else if (textEncCombined.includes('qwen3-vl') || textEncCombined.includes('qwen3_vl') || textEncCombined.includes('qwen3')) {
    textEncoder = 'Qwen3-VL GGUF Q4_K_M'; // Default to standard Q4_K_M if Qwen3-VL is present without explicit quantization
  }

  // 3. Video VAE Detection (FP8 Mixed Precision vs Original VAE)
  let videoVae: string = 'Not Found';
  const rawVae = parsedJson?.video_vae || parsedJson?.vae || parsedJson?.vae_name || parsedJson?.vae_model || parsedJson?.vae_path;
  const vaeCombined = `${rawVae || ''} ${combined}`.toLowerCase();

  if (vaeCombined.includes('fp8 mixed') || vaeCombined.includes('fp8_mixed') || vaeCombined.includes('mixed precision') || vaeCombined.includes('fp8')) {
    videoVae = 'FP8 Mixed Precision';
  } else if (vaeCombined.includes('original vae') || vaeCombined.includes('original_vae') || vaeCombined.includes('original') || vaeCombined.includes('wan2.1_vae') || vaeCombined.includes('wan 2.1 vae')) {
    videoVae = 'Original VAE';
  } else if (combined.includes('minimax') || combined.includes('wan')) {
    // If not specified in a Minimax / Wan run, default to Original VAE
    videoVae = 'Original VAE';
  }

  // 4. Automatic Tag Enrichment
  const tagsSet = new Set<string>();
  if (combined.includes('pruned')) tagsSet.add('pruned');
  if (combined.includes('distilled')) tagsSet.add('distilled');
  if (combined.includes('ref2va')) tagsSet.add('ref2va');
  if (combined.includes('fl2va')) tagsSet.add('FL2VA');
  if (combined.includes('33b')) tagsSet.add('33B');
  if (combined.includes('20b')) tagsSet.add('20B');
  if (combined.includes('14b')) tagsSet.add('14B');
  if (combined.includes('scail2')) tagsSet.add('SCAIL 2');

  // Precision / Format tags
  if (textEncoder !== 'Not Found') {
    if (textEncoder.includes('GGUF')) tagsSet.add('GGUF');
    if (textEncoder.includes('Q4_K_M')) tagsSet.add('Q4_K_M');
    if (textEncoder.includes('Q2_K')) tagsSet.add('Q2_K');
    if (textEncoder.includes('INT8')) tagsSet.add('INT8');
    if (textEncoder.includes('NVFP4')) tagsSet.add('NVFP4');
    if (textEncoder.includes('BF16')) tagsSet.add('BF16');
  }

  if (videoVae === 'FP8 Mixed Precision') {
    tagsSet.add('FP8');
  }

  return {
    baseModel,
    videoVae,
    textEncoder,
    tags: Array.from(tagsSet)
  };
}

export function parseModelAndTags(modelType: string, typeDesc: string = ''): { baseModel: string, newTags: string[] } {
  const details = extractTechnicalDetails(undefined, '', modelType, typeDesc);
  return { baseModel: details.baseModel, newTags: details.tags };
}

export interface DiffItem {
  id: string;
  category: 'generation' | 'model' | 'performance' | 'hardware' | 'file';
  label: string;
  valueA: any;
  valueB: any;
  displayA: string;
  displayB: string;
  isDifferent: boolean;
  delta?: string;
}

export function computeParameterDiff(a: VideoRecord, b: VideoRecord): DiffItem[] {
  const diffs: DiffItem[] = [];

  // 1. Modelo Base
  const modelDiff = (a.model || '').trim() !== (b.model || '').trim();
  diffs.push({
    id: 'model',
    category: 'model',
    label: 'Modelo Base',
    valueA: a.model,
    valueB: b.model,
    displayA: a.model || 'No especificado',
    displayB: b.model || 'No especificado',
    isDifferent: modelDiff,
  });

  // 2. Text Encoder
  const encA = a.textEncoder || 'Not Found';
  const encB = b.textEncoder || 'Not Found';
  diffs.push({
    id: 'textEncoder',
    category: 'model',
    label: 'Text Encoder',
    valueA: encA,
    valueB: encB,
    displayA: encA,
    displayB: encB,
    isDifferent: encA !== encB,
  });

  // 3. Video VAE
  const vaeA = a.videoVae || 'Not Found';
  const vaeB = b.videoVae || 'Not Found';
  diffs.push({
    id: 'videoVae',
    category: 'model',
    label: 'Video VAE',
    valueA: vaeA,
    valueB: vaeB,
    displayA: vaeA,
    displayB: vaeB,
    isDifferent: vaeA !== vaeB,
  });

  // 4. Pasos (Steps)
  const stepsA = Number(a.steps) || 0;
  const stepsB = Number(b.steps) || 0;
  const stepsDiff = stepsA !== stepsB;
  let stepsDelta: string | undefined = undefined;
  if (stepsDiff && stepsA > 0 && stepsB > 0) {
    const diff = stepsB - stepsA;
    stepsDelta = diff > 0 ? `+${diff} pasos` : `${diff} pasos`;
  }
  diffs.push({
    id: 'steps',
    category: 'generation',
    label: 'Pasos (Steps)',
    valueA: a.steps,
    valueB: b.steps,
    displayA: a.steps !== undefined ? `${a.steps}` : 'N/D',
    displayB: b.steps !== undefined ? `${b.steps}` : 'N/D',
    isDifferent: stepsDiff,
    delta: stepsDelta,
  });

  // 5. Shift
  const shiftA = a.shift !== undefined ? String(a.shift) : '';
  const shiftB = b.shift !== undefined ? String(b.shift) : '';
  const shiftDiff = shiftA !== shiftB;
  let shiftDelta: string | undefined = undefined;
  if (shiftDiff && !isNaN(Number(shiftA)) && !isNaN(Number(shiftB)) && shiftA && shiftB) {
    const diff = Number(shiftB) - Number(shiftA);
    shiftDelta = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;
  }
  diffs.push({
    id: 'shift',
    category: 'generation',
    label: 'Shift',
    valueA: shiftA,
    valueB: shiftB,
    displayA: shiftA || 'N/D',
    displayB: shiftB || 'N/D',
    isDifferent: shiftDiff,
    delta: shiftDelta,
  });

  // 6. Seed
  const seedA = a.seed !== undefined ? String(a.seed) : '';
  const seedB = b.seed !== undefined ? String(b.seed) : '';
  diffs.push({
    id: 'seed',
    category: 'generation',
    label: 'Semilla (Seed)',
    valueA: seedA,
    valueB: seedB,
    displayA: seedA || 'N/D',
    displayB: seedB || 'N/D',
    isDifferent: seedA !== seedB,
    delta: seedA === seedB && seedA ? 'Misma semilla' : undefined,
  });

  // 7. Resolución & Orientación
  const resA = `${a.width}x${a.height}`;
  const resB = `${b.width}x${b.height}`;
  diffs.push({
    id: 'resolution',
    category: 'generation',
    label: 'Resolución',
    valueA: resA,
    valueB: resB,
    displayA: `${resA} (${a.orientation})`,
    displayB: `${resB} (${b.orientation})`,
    isDifferent: resA !== resB,
  });

  // 8. LoRAs
  const lorasA = (a.loras || []).map(l => `${l.name} (${l.weight ?? 1})`).join(', ') || 'Ninguno';
  const lorasB = (b.loras || []).map(l => `${l.name} (${l.weight ?? 1})`).join(', ') || 'Ninguno';
  diffs.push({
    id: 'loras',
    category: 'model',
    label: 'LoRAs',
    valueA: lorasA,
    valueB: lorasB,
    displayA: lorasA,
    displayB: lorasB,
    isDifferent: lorasA !== lorasB,
  });

  // 9. Tiempo de Render (Render Time)
  const renderA = a.renderSeconds;
  const renderB = b.renderSeconds;
  const renderDiff = renderA !== renderB && (renderA !== undefined || renderB !== undefined);
  let renderDelta: string | undefined = undefined;
  if (renderA !== undefined && renderB !== undefined) {
    const diffSec = renderB - renderA;
    const pct = renderA > 0 ? Math.round((diffSec / renderA) * 100) : 0;
    const diffSign = diffSec > 0 ? '+' : '';
    renderDelta = `${diffSign}${Math.round(diffSec)}s (${diffSign}${pct}%)`;
  }
  diffs.push({
    id: 'renderTime',
    category: 'performance',
    label: 'Tiempo de Render',
    valueA: renderA,
    valueB: renderB,
    displayA: renderA !== undefined ? `${Math.floor(renderA / 60)}m ${Math.round(renderA % 60)}s (${Math.round(renderA)}s)` : 'N/D',
    displayB: renderB !== undefined ? `${Math.floor(renderB / 60)}m ${Math.round(renderB % 60)}s (${Math.round(renderB)}s)` : 'N/D',
    isDifferent: renderDiff,
    delta: renderDelta,
  });

  // 10. Hardware GPU & RAM
  const hwA = a.hardware ? `${a.hardware.gpu} (${a.hardware.vram}GB / ${a.hardware.ram}GB)` : 'N/D';
  const hwB = b.hardware ? `${b.hardware.gpu} (${b.hardware.vram}GB / ${b.hardware.ram}GB)` : 'N/D';
  diffs.push({
    id: 'hardware',
    category: 'hardware',
    label: 'GPU & Memoria',
    valueA: hwA,
    valueB: hwB,
    displayA: hwA,
    displayB: hwB,
    isDifferent: hwA !== hwB,
  });

  // 11. Tamaño de Archivo
  const sizeA = a.fileSizeBytes;
  const sizeB = b.fileSizeBytes;
  const sizeDiff = sizeA !== sizeB && (sizeA !== undefined || sizeB !== undefined);
  let sizeDelta: string | undefined = undefined;
  if (sizeA && sizeB) {
    const diffBytes = sizeB - sizeA;
    const pct = Math.round((diffBytes / sizeA) * 100);
    const diffSign = diffBytes > 0 ? '+' : '';
    sizeDelta = `${diffSign}${formatBytes(Math.abs(diffBytes))} (${diffSign}${pct}%)`;
  }
  diffs.push({
    id: 'fileSize',
    category: 'file',
    label: 'Peso del Archivo',
    valueA: sizeA,
    valueB: sizeB,
    displayA: sizeA ? formatBytes(sizeA) : 'N/D',
    displayB: sizeB ? formatBytes(sizeB) : 'N/D',
    isDifferent: sizeDiff,
    delta: sizeDelta,
  });

  // 12. Creador / Nick
  const creatorA = a.creatorDisplayName || a.createdBy || 'Anónimo';
  const creatorB = b.creatorDisplayName || b.createdBy || 'Anónimo';
  diffs.push({
    id: 'creator',
    category: 'file',
    label: 'Autor / Creador',
    valueA: creatorA,
    valueB: creatorB,
    displayA: creatorA,
    displayB: creatorB,
    isDifferent: creatorA !== creatorB,
  });

  // 13. Etiquetas (Tags)
  const tagsA = (a.tags || []).sort().join(', ') || 'Sin tags';
  const tagsB = (b.tags || []).sort().join(', ') || 'Sin tags';
  diffs.push({
    id: 'tags',
    category: 'model',
    label: 'Etiquetas',
    valueA: tagsA,
    valueB: tagsB,
    displayA: tagsA,
    displayB: tagsB,
    isDifferent: tagsA !== tagsB,
  });

  return diffs;
}

export interface WordDiffChunk {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

export function diffWords(strA: string = '', strB: string = ''): {
  chunksA: WordDiffChunk[];
  chunksB: WordDiffChunk[];
  hasDifferences: boolean;
} {
  const wordsA = strA.trim().split(/\s+/).filter(Boolean);
  const wordsB = strB.trim().split(/\s+/).filter(Boolean);

  if (strA.trim() === strB.trim()) {
    return {
      chunksA: [{ type: 'equal', value: strA }],
      chunksB: [{ type: 'equal', value: strB }],
      hasDifferences: false,
    };
  }

  // Simple LCS for word tokens
  const n = wordsA.length;
  const m = wordsB.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (wordsA[i].toLowerCase() === wordsB[j].toLowerCase()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const chunksA: WordDiffChunk[] = [];
  const chunksB: WordDiffChunk[] = [];

  let i = n;
  let j = m;

  const stackA: WordDiffChunk[] = [];
  const stackB: WordDiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1].toLowerCase() === wordsB[j - 1].toLowerCase()) {
      stackA.unshift({ type: 'equal', value: wordsA[i - 1] });
      stackB.unshift({ type: 'equal', value: wordsB[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stackB.unshift({ type: 'added', value: wordsB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      stackA.unshift({ type: 'removed', value: wordsA[i - 1] });
      i--;
    }
  }

  return {
    chunksA: stackA,
    chunksB: stackB,
    hasDifferences: true,
  };
}