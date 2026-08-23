import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoOrientation, VideoRecord, Lora, VideoSource } from '../types';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

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
  baseModel?: string;
  modelSizeB?: number;
  modelVariant?: string;
  videoVae: string;
  textEncoder: string;
  precision?: string;
  tags: string[];
}

/**
 * Cleans noise prefixes and extracts a clean, concise title (~50 chars) from prompt.
 */
export function generateTitleFromPrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return '';

  let cleaned = prompt.trim();

  // Clean noise prefixes
  const noisePatterns: RegExp[] = [
    /^integrated_multimodal_description\s*:\s*/i,
    /^integrated\s+multimodal\s+description\s*:\s*/i,
    /^\[\s*shot\s*\d+\s*\]\s*:?\s*/i,
    /^shot\s*\d+\s*:\s*/i,
    /^prompt\s*:\s*/i,
    /^(cinematic\s+shot|cinematic\s+video|cinematic|masterpiece|photorealistic|ultra\s+realistic|hyper\s+realistic)\s*[,:\-\s]\s*/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of noisePatterns) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '').trim();
        changed = true;
      }
    }
  }

  // Remove residual leading punctuation
  cleaned = cleaned.replace(/^[,:\-–—"'\s]+/, '').trim();

  if (!cleaned) return '';

  const LIMIT = 50;
  if (cleaned.length <= LIMIT) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Cut at last space before limit
  const sub = cleaned.substring(0, LIMIT);
  const lastSpace = sub.lastIndexOf(' ');
  const truncated = (lastSpace > 15 ? sub.substring(0, lastSpace) : sub).trim();
  const cleanEnd = truncated.replace(/[,;:\-\s]+$/, '');
  const result = cleanEnd + '…';

  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Extracts model size in billions of parameters (e.g. 20, 33)
 * Priority:
 * 1. Look in "type" field for pattern /(\d+)\s*B\b/i
 * 2. Look in "model_filename" field for pattern /(\d+)\s*B\b/i
 * 3. Otherwise undefined
 */
export function extractModelSizeB(typeField?: string, modelFilename?: string): number | undefined {
  const sizeRegex = /(\d+)\s*B\b/i;
  if (typeField && typeof typeField === 'string') {
    const match = typeField.match(sizeRegex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  if (modelFilename && typeof modelFilename === 'string') {
    const match = modelFilename.match(sizeRegex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  return undefined;
}

export function extractTechnicalDetails(
  parsedJson?: any,
  rawComment: string = '',
  modelType: string = '',
  typeDesc: string = ''
): ExtractedTechnicalDetails {
  // 1. Technical string restricted ONLY to technical model metadata fields.
  // Never search narrative prompt, general comments, or full serialized JSON to prevent accidental false positives.
  const technicalModelStr = [
    modelType,
    typeDesc,
    parsedJson?.model_type,
    parsedJson?.type,
    parsedJson?.model_filename,
    parsedJson?.filename
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();
  
  // 1. Base Model Detection
  // Currently recognized model: Minimax H3.
  // (Se pueden añadir más ramas de modelos reconocidos aquí en el futuro según se utilicen nuevos modelos)
  let baseModel: string | undefined = undefined;
  if (technicalModelStr.includes('minimax') || technicalModelStr.includes('h3')) {
    baseModel = 'Minimax H3';
  }

  // Model size in Billions (modelSizeB) strictly from type/model_filename fields
  const typeField = parsedJson?.type || typeDesc;
  const modelFilename = parsedJson?.model_filename || parsedJson?.filename;
  const modelSizeB = extractModelSizeB(typeField, modelFilename);

  // Model Variant (FL2VA, Ref2VA, SCAIL 2...) restricted to technical model and variant fields
  let modelVariant: string | undefined = undefined;
  const variantStr = [
    technicalModelStr,
    parsedJson?.model_variant,
    parsedJson?.variant
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (variantStr.includes('fl2va')) {
    modelVariant = 'FL2VA';
  } else if (variantStr.includes('ref2va')) {
    modelVariant = 'Ref2VA';
  } else if (variantStr.includes('scail2') || variantStr.includes('scail 2')) {
    modelVariant = 'SCAIL 2';
  }

  // 2. Text Encoder Detection (restricted strictly to text encoder technical fields)
  let textEncoder: string = 'Not Found';
  const rawTextEnc = [
    parsedJson?.text_encoder,
    parsedJson?.text_encoder_name,
    parsedJson?.text_encoder_path,
    parsedJson?.t5_path,
    parsedJson?.llm,
    parsedJson?.encoder
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (rawTextEnc.length > 0) {
    if (rawTextEnc.includes('q4_k_m') || rawTextEnc.includes('q4-k-m') || rawTextEnc.includes('q4km')) {
      textEncoder = 'Qwen3-VL GGUF Q4_K_M';
    } else if (rawTextEnc.includes('q2_k') || rawTextEnc.includes('q2-k') || rawTextEnc.includes('q2k')) {
      textEncoder = 'Qwen3-VL GGUF Q2_K';
    } else if (rawTextEnc.includes('quanto') || rawTextEnc.includes('int8')) {
      textEncoder = 'Qwen3-VL Quanto INT8';
    } else if (rawTextEnc.includes('nvfp4') || rawTextEnc.includes('awq')) {
      textEncoder = 'Qwen3-VL NVFP4 AWQ';
    } else if (rawTextEnc.includes('bf16')) {
      textEncoder = 'Qwen3-VL BF16';
    } else if (rawTextEnc.includes('default')) {
      textEncoder = 'Default';
    } else if (rawTextEnc.includes('qwen3-vl') || rawTextEnc.includes('qwen3_vl') || rawTextEnc.includes('qwen3')) {
      textEncoder = 'Qwen3-VL GGUF Q4_K_M';
    }
  }

  // 3. Video VAE Detection (restricted strictly to VAE technical fields)
  let videoVae: string = 'Not Found';
  const rawVae = [
    parsedJson?.video_vae,
    parsedJson?.vae,
    parsedJson?.vae_name,
    parsedJson?.vae_model,
    parsedJson?.vae_path
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (rawVae.length > 0) {
    if (rawVae.includes('fp8')) {
      videoVae = 'FP8 Mixed Precision';
    } else if (rawVae.includes('original') || rawVae.includes('default') || rawVae.includes('wan2.1_vae') || rawVae.includes('wan 2.1 vae')) {
      videoVae = 'Original VAE';
    }
  }

  // Tags are reserved for custom user tags; structured details live in their dedicated fields
  const tags: string[] = [];

  return {
    baseModel,
    modelSizeB,
    modelVariant,
    videoVae,
    textEncoder,
    precision: textEncoder !== 'Not Found' ? textEncoder : undefined,
    tags
  };
}

export interface ParsedWanGpMetadata {
  prompt?: string;
  seed?: string;
  steps?: number;
  shift?: string;
  baseModel?: string;
  modelSizeB?: number;
  modelVariant?: string;
  videoVae: string;
  textEncoder: string;
  precision?: string;
  tags: string[];
  width?: number;
  height?: number;
  renderSeconds?: number;
  durationSeconds?: string;
  generatedAt?: number;
  loras: Lora[];
  rawComment?: string;
}

/**
 * Unified parser for WanGP metadata embedded in video Comment/Track fields.
 * Shared between AddVideoModal and BatchImportModal to prevent desync.
 */
export function parseWanGpMetadata(commentRaw?: string, fallbackDurationSec?: number, fallbackFps = 24): ParsedWanGpMetadata | null {
  if (!commentRaw || typeof commentRaw !== 'string') return null;

  try {
    const parsed = JSON.parse(commentRaw);
    const techDetails = extractTechnicalDetails(parsed, commentRaw, parsed.model_type || parsed.type || '');
    
    let width: number | undefined = undefined;
    let height: number | undefined = undefined;
    if (parsed.resolution) {
      const [w, h] = String(parsed.resolution).split('x');
      if (w && h) {
        width = Number(w);
        height = Number(h);
      }
    }

    let durationSeconds: string | undefined = undefined;
    if (parsed.video_length !== undefined) {
      const computedDuration = Number(parsed.video_length) / fallbackFps;
      durationSeconds = computedDuration.toFixed(1);
    } else if (fallbackDurationSec !== undefined && fallbackDurationSec > 0) {
      durationSeconds = fallbackDurationSec.toFixed(1);
    }

    const loras: Lora[] = [];
    if (parsed.activated_loras && parsed.loras_multipliers) {
      const weights = String(parsed.loras_multipliers).split('|');
      parsed.activated_loras.forEach((loraPath: string, idx: number) => {
        const nameParts = loraPath.split(/[\/\\]/);
        let baseName = nameParts[nameParts.length - 1];
        baseName = baseName.replace(/\.[^/.]+$/, "");
        const weightStr = weights[idx];
        if (weightStr !== undefined && weightStr !== '') {
          loras.push({ name: baseName, weight: parseFloat(weightStr) });
        }
      });
    }

    return {
      prompt: parsed.prompt ? String(parsed.prompt) : undefined,
      seed: parsed.seed !== undefined ? String(parsed.seed) : undefined,
      steps: parsed.num_inference_steps !== undefined ? Number(parsed.num_inference_steps) : undefined,
      shift: parsed.flow_shift !== undefined ? String(parsed.flow_shift) : undefined,
      baseModel: techDetails.baseModel,
      modelSizeB: techDetails.modelSizeB,
      modelVariant: techDetails.modelVariant,
      videoVae: techDetails.videoVae,
      textEncoder: techDetails.textEncoder,
      precision: techDetails.precision,
      tags: techDetails.tags,
      width,
      height,
      renderSeconds: parsed.generation_time !== undefined ? Number(parsed.generation_time) : undefined,
      durationSeconds,
      generatedAt: parsed.creation_timestamp !== undefined ? Number(parsed.creation_timestamp) * 1000 : undefined,
      loras,
      rawComment: commentRaw,
    };
  } catch {
    // Non-JSON comment fallback
    const techDetails = extractTechnicalDetails(undefined, commentRaw);
    return {
      baseModel: techDetails.baseModel,
      modelSizeB: techDetails.modelSizeB,
      modelVariant: techDetails.modelVariant,
      videoVae: techDetails.videoVae,
      textEncoder: techDetails.textEncoder,
      precision: techDetails.precision,
      tags: techDetails.tags,
      loras: [],
      rawComment: commentRaw,
    };
  }
}

export function parseModelAndTags(modelType: string, typeDesc: string = ''): { baseModel?: string, newTags: string[] } {
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

export interface ParsedVideoUrlInfo {
  isHuggingFace: boolean;
  username?: string;
  repoName?: string;
  repoType?: string; // 'datasets' | 'models' | 'spaces'
  branch?: string; // 'main'
  category?: string; // decoded folder name (e.g. 'Ezio & Thanos')
  fileName?: string;
  suggestedGroupName?: string;
}

export function parseVideoUrlInfo(url: string): ParsedVideoUrlInfo {
  if (!url || typeof url !== 'string') {
    return { isHuggingFace: false };
  }
  const cleanUrl = url.trim();

  // Check if Hugging Face URL
  // Matches: huggingface.co/(datasets|models|spaces)?/([username])/([repo])/(resolve|raw|blob)/([branch])/([rest...])
  const hfRegex = /huggingface\.co\/(?:(datasets|models|spaces)\/)?([^/]+)\/([^/]+)\/(?:resolve|raw|blob)\/([^/]+)\/(.+)$/i;
  const match = cleanUrl.match(hfRegex);

  if (match) {
    const repoType = match[1] || 'models';
    const rawUsername = match[2];
    const rawRepoName = match[3];
    const branch = match[4];
    const pathAfterBranch = match[5]; // e.g. "Ezio%20%26%20Thanos/2026-08-22...mp4"

    let username = rawUsername;
    let repoName = rawRepoName;
    try {
      username = decodeURIComponent(rawUsername);
      repoName = decodeURIComponent(rawRepoName);
    } catch {
      // fallback
    }

    // Split pathAfterBranch by '/'
    const pathSegments = pathAfterBranch.split('/').map(seg => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    });

    const fileName = pathSegments[pathSegments.length - 1];
    // Any intermediate segments before fileName represent the folder structure / category
    const folderSegments = pathSegments.slice(0, -1);
    const category = folderSegments.length > 0 ? folderSegments.join(' / ') : '';

    const suggestedGroupName = category || repoName;

    return {
      isHuggingFace: true,
      username,
      repoName,
      repoType,
      branch,
      category,
      fileName,
      suggestedGroupName,
    };
  }

  // Generic URL parsing (extract folder if any, or filename)
  try {
    const parsed = new URL(cleanUrl);
    const segments = parsed.pathname.split('/').filter(Boolean).map(s => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
    if (segments.length >= 2) {
      const fileName = segments[segments.length - 1];
      const folder = segments[segments.length - 2];
      // If folder is not standard web keywords (like 'resolve', 'main', 'raw', 'd', 'uc', 'view', 'api')
      const ignoredFolders = new Set(['resolve', 'main', 'raw', 'blob', 'd', 'uc', 'view', 'api', 'v1', 'v2', 'download', 'export', 'videos', 'uploads']);
      const category = !ignoredFolders.has(folder.toLowerCase()) ? folder : '';
      return {
        isHuggingFace: false,
        category,
        fileName,
        suggestedGroupName: category,
      };
    }
  } catch {
    // Ignore invalid url format
  }

  return { isHuggingFace: false };
}

/**
 * Normalizes a Hugging Face dataset identifier.
 * Accepts "https://huggingface.co/datasets/user/repo", "https://huggingface.co/user/repo", "user/repo", etc.
 * Returns normalized "user/repo" or null if invalid.
 */
export function normalizeHuggingFaceDatasetRepoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  let clean = input.trim();
  if (!clean) return null;

  // Remove trailing slashes, tree/main, blob/main, etc.
  clean = clean.replace(/\/+$/, '');
  
  // Check full URL: huggingface.co/datasets/owner/repo or huggingface.co/owner/repo
  const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?huggingface\.co\/(?:datasets\/)?([^/\s]+\/[^/\s]+?)(?:\/(?:tree|blob|resolve)\/.*|\.git|\/)?$/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Simple "owner/repo" format
  const simpleMatch = clean.match(/^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$/);
  if (simpleMatch) {
    return `${simpleMatch[1]}/${simpleMatch[2]}`;
  }

  return null;
}

let mediainfoSharedPromise: Promise<any> | null = null;
export const loadSharedMediaInfo = () => {
  if (!mediainfoSharedPromise) {
    mediainfoSharedPromise = import('mediainfo.js');
  }
  return mediainfoSharedPromise;
};

export interface ProcessVideoUrlOptions {
  url: string;
  source?: VideoSource;
  customCategory?: string;
  userEmail?: string;
  userDisplayName?: string;
  userUid?: string;
  onAddCategory?: (category: string) => void;
}

export async function processVideoMetadataFromUrl(options: ProcessVideoUrlOptions): Promise<VideoRecord> {
  const { url, source = 'local', customCategory, userEmail, userDisplayName, userUid, onAddCategory } = options;
  const urlInfo = parseVideoUrlInfo(url);

  const finalGroupName: string | undefined = customCategory !== undefined 
    ? (customCategory.trim() || undefined)
    : (urlInfo.suggestedGroupName?.trim() || undefined);

  if (finalGroupName && onAddCategory) {
    onAddCategory(finalGroupName);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText || 'Error de red'})`);
  }
  const blob = await response.blob();

  const getSize = () => blob.size;
  const readChunk = (chunkSize: number, offset: number) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.error) {
          reject(e.target.error);
        } else if (e.target?.result) {
          resolve(new Uint8Array(e.target.result as ArrayBuffer));
        } else {
          reject(new Error("Empty chunk"));
        }
      };
      reader.readAsArrayBuffer(blob.slice(offset, offset + chunkSize));
    });

  const mediainfoModule = await loadSharedMediaInfo();
  const mi = await mediainfoModule.default({
    format: 'object',
    locateFile: () => wasmUrl
  });

  const result = await mi.analyzeData(getSize, readChunk);
  const generalTrack = result.media?.track?.find((t: any) => t['@type'] === 'General') as any;
  const videoTrack = result.media?.track?.find((t: any) => t['@type'] === 'Video') as any;
  const commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;

  let width = 1920;
  let height = 1080;
  let prompt = "Importado desde URL";
  let model = "Desconocido";
  let modelSizeB: number | undefined = undefined;
  let modelVariant: string | undefined = undefined;
  let title: string | undefined = undefined;
  let durationSeconds = 5;
  let steps = 30;
  let shift = "5.0";
  let seed = "";
  let tagsInput = "";
  let videoVae: string = 'Not Found';
  let textEncoder: string = 'Not Found';
  let loras: Lora[] = [];
  let renderSeconds: number | undefined = undefined;
  let generatedAt: number | undefined = undefined;
  let fileSizeBytes: number | undefined = blob.size;

  if (videoTrack?.Width) width = Number(videoTrack.Width);
  if (videoTrack?.Height) height = Number(videoTrack.Height);
  if (generalTrack?.Duration) durationSeconds = parseFloat(generalTrack.Duration);

  if (commentRaw) {
    const metadata = parseWanGpMetadata(commentRaw, generalTrack?.Duration ? parseFloat(generalTrack.Duration) : undefined, 24);
    if (metadata) {
      if (metadata.prompt) {
        prompt = metadata.prompt;
        const autoTitle = generateTitleFromPrompt(metadata.prompt);
        if (autoTitle) title = autoTitle;
      }
      if (metadata.seed !== undefined) seed = metadata.seed;
      if (metadata.steps !== undefined) steps = metadata.steps;
      if (metadata.shift !== undefined) shift = metadata.shift;
      if (metadata.baseModel) model = metadata.baseModel;
      if (metadata.modelSizeB !== undefined) modelSizeB = metadata.modelSizeB;
      if (metadata.modelVariant) modelVariant = metadata.modelVariant;
      videoVae = metadata.videoVae;
      textEncoder = metadata.textEncoder;
      if (metadata.tags && metadata.tags.length > 0) tagsInput = metadata.tags.join(', ');
      if (metadata.renderSeconds !== undefined) renderSeconds = metadata.renderSeconds;
      if (metadata.generatedAt !== undefined) generatedAt = metadata.generatedAt;
      if (metadata.loras && metadata.loras.length > 0) loras = metadata.loras;
    }
  }

  const orientation = calculateOrientation(width, height);
  const driveFileId = extractDriveFileId(url) || '';

  const resolvedDisplayName = userDisplayName || userEmail || urlInfo.username || undefined;
  const resolvedCreatedBy = userEmail || userDisplayName || (urlInfo.username ? `@${urlInfo.username}` : undefined);

  const record: VideoRecord = {
    schemaVersion: 2,
    videoUrl: url,
    groupName: finalGroupName,
    driveFileId,
    title,
    prompt,
    model,
    modelSizeB,
    modelVariant,
    source,
    localTool: source === 'local' ? 'Wan2GP' : undefined,
    tags: tagsInput ? tagsInput.split(',').map(s => s.trim()).filter(Boolean) : [],
    width,
    height,
    orientation,
    steps,
    shift: shift ? parseFloat(shift) : undefined,
    seed: seed ? parseInt(seed) : undefined,
    fps: 24,
    durationSeconds,
    videoVae,
    textEncoder,
    loras,
    createdAt: Date.now(),
    createdBy: resolvedCreatedBy,
    creatorUid: userUid,
    creatorDisplayName: resolvedDisplayName,
    renderSeconds,
    fileSizeBytes,
    generatedAt,
    rawMetadata: commentRaw
  };

  return record;
}
