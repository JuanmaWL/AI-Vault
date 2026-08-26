import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoOrientation, VideoRecord, Lora, VideoSource } from '../types';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GPU_LOGOS = {
  nvidia: '/icons/nvidia.ico',
  amd: '/icons/amd.ico'
} as const;

export const SOFTWARE_ICONS = {
  maestro: '/icons/maestro.ico',
  wan2gp: '/icons/Wan2GP.ico',
} as const;

/**
 * Extracts creation timestamp formatted in Spanish from filename, title, or url
 * Pattern: 2026-08-21-20h02m49s or 2026-08-21_20h02m49s or ISO 2026-08-17T15:36:47
 */
export function extractCreationDateFromText(text?: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const decoded = decodeURIComponent(text);

  const formatToStandard = (year: string, month: string, day: string, hour: string, min: string) => {
    const pad = (v: string | number) => v.toString().padStart(2, '0');
    return `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(min)}`;
  };

  // Pattern 1: 2026-08-21-20h02m49s or 2026-08-21_20h02m49s or 2026-08-21 20h02m49s
  const match = decoded.match(/(\d{4})-(\d{2})-(\d{2})[-_\s](\d{2})h(\d{2})m(\d{2})s/i);
  if (match) {
    const [, year, month, day, hour, min] = match;
    return formatToStandard(year, month, day, hour, min);
  }

  // Pattern 2: ISO 2026-08-17T15:36:47 or 2026-08-17 15:36:47
  const isoMatch = decoded.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/i);
  if (isoMatch) {
    const [, year, month, day, hour, min] = isoMatch;
    return formatToStandard(year, month, day, hour, min);
  }

  return null;
}

export function getGpuVendor(gpuName?: string): 'nvidia' | 'amd' | 'other' {
  if (!gpuName || typeof gpuName !== 'string') return 'other';
  const lower = gpuName.toLowerCase();
  if (lower.includes('nvidia') || lower.includes('rtx') || lower.includes('gtx') || lower.includes('geforce') || lower.includes('quadro') || lower.includes('tesla')) {
    return 'nvidia';
  }
  if (lower.includes('amd') || lower.includes('radeon') || lower.includes('rx ') || lower.includes('rdna')) {
    return 'amd';
  }
  return 'other';
}

export function getPlayableVideoUrl(video: VideoRecord): string {
  return video?.videoUrl || '';
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
  modelTypeRaw?: string;
  softwareSource?: 'wan2gp' | 'maestro' | 'comfyui' | 'other';
  localTool?: string;
  videoVae: string;
  textEncoder: string;
  precision?: string;
  tags: string[];
  turboPreset?: string;
  turboMode?: boolean;
  skipStepsMultiplier?: number;
  skipStepsCacheType?: string;
  overrideAttention?: string;
  slidingWindowSize?: number;
  slidingWindowOverlap?: number;
  cfg?: number;
  jobId?: string;
  jobElapsedTimeSeconds?: number;
  generationTimeBasis?: string;
  settingsVersion?: number;
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
 * 1. Inspect all inputs for known variants/architectures (fl2va, ref2va, 33b, 20b, pruned, full)
 * 2. Look for pattern /(\d+)\s*B\b/i
 * 3. Fallback to undefined
 */
export function extractModelSizeB(...inputs: (string | number | undefined | null)[]): number | undefined {
  const sizeRegex = /(\d+)\s*B\b/i;
  for (const input of inputs) {
    if (input === undefined || input === null) continue;
    if (typeof input === 'number' && !isNaN(input) && input > 0) return input;
    if (typeof input !== 'string') continue;

    const lower = input.toLowerCase();
    if (lower.includes('33b') || lower.includes('33_b') || lower.includes('fl2va') || lower.includes('ref2va') || lower === 'minimax_h3_full') {
      return 33;
    }
    if (lower.includes('20b') || lower.includes('20_b') || lower.includes('pruned') || lower === 'minimax_h3') {
      return 20;
    }

    const match = input.match(sizeRegex);
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
  // Support nested "params" format (standard in Maestro and some Wan2GP outputs)
  const actualParams = (parsedJson && typeof parsedJson === 'object' && parsedJson.params && typeof parsedJson.params === 'object')
    ? parsedJson.params
    : parsedJson;

  const rawModelType = actualParams?.model_type || parsedJson?.model_type || modelType || '';
  const typeField = actualParams?.type || parsedJson?.type || typeDesc || '';
  const modelFilename = actualParams?.model_filename || parsedJson?.model_filename || actualParams?.filename || parsedJson?.filename || '';

  const technicalModelStr = [
    rawModelType,
    typeField,
    modelFilename,
    rawComment
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();
  
  // 1. Software Source Detection (ComfyUI > Maestro > Wan2GP > fallback Wan2GP)
  let softwareSource: 'wan2gp' | 'maestro' | 'comfyui' | 'other' = 'wan2gp';
  let localTool: string = 'Wan2GP';

  // ComfyUI signature:
  // - Object-based prompt structure, explicit workflow graph, or ComfyUI in raw comment
  const isComfy = Boolean(
    (parsedJson?.prompt && typeof parsedJson.prompt === 'object' && !Array.isArray(parsedJson.prompt)) ||
    parsedJson?.workflow ||
    (typeof rawComment === 'string' && rawComment.includes('ComfyUI'))
  );

  // Maestro signature:
  // Exclusivo de la capa de orquestación de Maestro (contabilidad de tiempos)
  const isMaestro = !isComfy && Boolean(
    actualParams?.generation_time_basis !== undefined ||
    parsedJson?.generation_time_basis !== undefined
  );

  // Wan2GP signature:
  // Exige AMBOS tokens "wangp" y "deepbeepmeep" próximos entre sí (<= 30 caracteres)
  // Ej: "WanGP v12.60 by DeepBeepMeep - MiniMax H3 FL2VA 33B"
  const wanGpRegex = /wangp.{0,30}deepbeepmeep|deepbeepmeep.{0,30}wangp/i;
  const isWanGp = !isComfy && !isMaestro && Boolean(
    (typeof typeField === 'string' && wanGpRegex.test(typeField)) ||
    (typeof rawComment === 'string' && wanGpRegex.test(rawComment))
  );

  if (isComfy) {
    softwareSource = 'comfyui';
    localTool = 'ComfyUI';
  } else if (isMaestro) {
    softwareSource = 'maestro';
    localTool = 'Maestro';
  } else if (isWanGp) {
    softwareSource = 'wan2gp';
    localTool = 'Wan2GP';
  } else {
    // Fallback por defecto a Wan2GP
    softwareSource = 'wan2gp';
    localTool = 'Wan2GP';
  }

  // 2. Base Model Detection
  let baseModel: string | undefined = undefined;
  if (technicalModelStr.includes('minimax') || technicalModelStr.includes('h3')) {
    baseModel = 'Minimax H3';
  } else if (technicalModelStr.includes('wan') || technicalModelStr.includes('2.1')) {
    baseModel = 'Wan 2.1';
  } else if (technicalModelStr.includes('ltx')) {
    baseModel = technicalModelStr.includes('2.5') ? 'LTX 2.5' : 'LTX 2.3';
  } else if (technicalModelStr.includes('hunyuan')) {
    baseModel = 'HunyuanVideo';
  }

  // Model size in Billions (modelSizeB)
  const modelSizeB = extractModelSizeB(
    actualParams?.model_size_b,
    parsedJson?.model_size_b,
    rawModelType,
    typeField,
    modelFilename,
    rawComment,
    actualParams?.model_variant,
    parsedJson?.model_variant
  );

  // Model Variant (Full, Pruned, FL2VA, Ref2VA, SCAIL 2...)
  let modelVariant: string | undefined = undefined;
  const variantStr = [
    technicalModelStr,
    actualParams?.model_variant,
    parsedJson?.model_variant,
    actualParams?.variant,
    parsedJson?.variant
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (variantStr.includes('fl2va')) {
    modelVariant = 'FL2VA';
  } else if (variantStr.includes('ref2va')) {
    modelVariant = 'Ref2VA';
  } else if (rawModelType.toLowerCase() === 'minimax_h3_full' || variantStr.includes('full') || modelSizeB === 33) {
    modelVariant = 'Full (33B)';
  } else if (rawModelType.toLowerCase() === 'minimax_h3' || variantStr.includes('pruned') || modelSizeB === 20) {
    modelVariant = 'Pruned (20B)';
  } else if (variantStr.includes('scail2') || variantStr.includes('scail 2')) {
    modelVariant = 'SCAIL 2';
  }

  // 3. Text Encoder Detection
  let textEncoder: string = 'Not Found';
  let configStr = actualParams?.config || parsedJson?.config || '';
  if (!configStr && rawComment) {
    const configMatch = rawComment.match(/"config"\s*:\s*"([^"]+)"/i) || rawComment.match(/config[:=]\s*([a-zA-Z0-9_, -]+)/i);
    if (configMatch && configMatch[1]) {
      configStr = configMatch[1];
    }
  }

  const rawTextEnc = [
    configStr,
    actualParams?.minimax_h3_text_encoder,
    parsedJson?.minimax_h3_text_encoder,
    actualParams?.text_encoder,
    parsedJson?.text_encoder,
    actualParams?.text_encoder_name,
    actualParams?.text_encoder_path,
    actualParams?.t5_path,
    actualParams?.llm,
    actualParams?.encoder
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (rawTextEnc.length > 0) {
    if (rawTextEnc.includes('q4_k_m') || rawTextEnc.includes('q4-k-m') || rawTextEnc.includes('q4km') || rawTextEnc.includes('gguf_q4_k_m') || rawTextEnc.includes('gguf_q4')) {
      textEncoder = 'Qwen3-VL GGUF Q4_K_M';
    } else if (rawTextEnc.includes('q2_k') || rawTextEnc.includes('q2-k') || rawTextEnc.includes('q2k') || rawTextEnc.includes('gguf_q2_k') || rawTextEnc.includes('gguf_q2')) {
      textEncoder = 'Qwen3-VL GGUF Q2_K';
    } else if (rawTextEnc.includes('quanto') || rawTextEnc.includes('int8')) {
      textEncoder = 'Qwen3-VL Quanto INT8';
    } else if (rawTextEnc.includes('nvfp4') || rawTextEnc.includes('awq')) {
      textEncoder = 'Qwen3-VL NVFP4 AWQ';
    } else if (rawTextEnc.includes('bf16')) {
      textEncoder = 'Qwen3-VL BF16';
    } else if (rawTextEnc.includes('default')) {
      textEncoder = 'Default';
    } else if (rawTextEnc.includes('qwen3-vl') || rawTextEnc.includes('qwen3_vl') || rawTextEnc.includes('qwen3') || rawTextEnc.includes('qwen')) {
      textEncoder = 'Qwen3-VL GGUF Q4_K_M';
    }
  }

  // 4. Video VAE Detection - Default is ALWAYS 'Original VAE'
  let videoVae: string = 'Original VAE';
  const rawVae = [
    configStr,
    actualParams?.video_vae,
    parsedJson?.video_vae,
    actualParams?.vae,
    parsedJson?.vae,
    actualParams?.vae_name,
    actualParams?.vae_model,
    actualParams?.vae_path
  ].filter(val => typeof val === 'string' && val.trim().length > 0).join(' ').toLowerCase();

  if (rawVae.length > 0) {
    if (rawVae.includes('fp8') || rawVae.includes('fp8mix') || rawVae.includes('fp8_mix')) {
      videoVae = 'FP8 Mixed Precision';
    } else if (rawVae.includes('original') || rawVae.includes('default') || rawVae.includes('wan2.1_vae') || rawVae.includes('wan 2.1 vae')) {
      videoVae = 'Original VAE';
    }
  }

  // 5. Specific Maestro & Execution Parameters
  const turboPreset = actualParams?.minimax_h3_turbo_preset || parsedJson?.minimax_h3_turbo_preset;
  const turboMode = actualParams?.minimax_h3_turbo_mode ?? parsedJson?.minimax_h3_turbo_mode;
  const skipStepsMultiplier = actualParams?.skip_steps_multiplier ?? parsedJson?.skip_steps_multiplier;
  const skipStepsCacheType = actualParams?.skip_steps_cache_type || parsedJson?.skip_steps_cache_type;
  const overrideAttention = actualParams?.override_attention || parsedJson?.override_attention;
  const slidingWindowSize = actualParams?.sliding_window_size ?? parsedJson?.sliding_window_size;
  const slidingWindowOverlap = actualParams?.sliding_window_overlap ?? parsedJson?.sliding_window_overlap;
  const cfg = actualParams?.guidance_scale ?? parsedJson?.guidance_scale;
  const jobId = parsedJson?.job_id;
  const jobElapsedTimeSeconds = parsedJson?.job_elapsed_time !== undefined ? Number(parsedJson.job_elapsed_time) : undefined;
  const generationTimeBasis = parsedJson?.generation_time_basis;
  const settingsVersion = actualParams?.settings_version ?? parsedJson?.settings_version;

  const tags: string[] = [];

  return {
    baseModel,
    modelSizeB,
    modelVariant,
    modelTypeRaw: rawModelType || undefined,
    softwareSource,
    localTool,
    videoVae,
    textEncoder,
    precision: textEncoder !== 'Not Found' ? textEncoder : undefined,
    tags,
    turboPreset: turboPreset ? String(turboPreset) : undefined,
    turboMode: typeof turboMode === 'boolean' ? turboMode : undefined,
    skipStepsMultiplier: skipStepsMultiplier !== undefined ? Number(skipStepsMultiplier) : undefined,
    skipStepsCacheType: skipStepsCacheType ? String(skipStepsCacheType) : undefined,
    overrideAttention: overrideAttention ? String(overrideAttention) : undefined,
    slidingWindowSize: slidingWindowSize !== undefined ? Number(slidingWindowSize) : undefined,
    slidingWindowOverlap: slidingWindowOverlap !== undefined ? Number(slidingWindowOverlap) : undefined,
    cfg: cfg !== undefined ? Number(cfg) : undefined,
    jobId: jobId ? String(jobId) : undefined,
    jobElapsedTimeSeconds,
    generationTimeBasis: generationTimeBasis ? String(generationTimeBasis) : undefined,
    settingsVersion: settingsVersion !== undefined ? Number(settingsVersion) : undefined,
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
  modelTypeRaw?: string;
  softwareSource?: 'wan2gp' | 'maestro' | 'comfyui' | 'other';
  localTool?: string;
  videoVae: string;
  textEncoder: string;
  precision?: string;
  tags: string[];
  width?: number;
  height?: number;
  renderSeconds?: number;
  durationSeconds?: string;
  fps?: number;
  generatedAt?: number;
  loras: Lora[];
  rawComment?: string;
  turboPreset?: string;
  turboMode?: boolean;
  skipStepsMultiplier?: number;
  skipStepsCacheType?: string;
  overrideAttention?: string;
  slidingWindowSize?: number;
  slidingWindowOverlap?: number;
  cfg?: number;
  jobId?: string;
  jobElapsedTimeSeconds?: number;
  generationTimeBasis?: string;
  settingsVersion?: number;
}

/**
 * Unified parser for WanGP and Maestro metadata embedded in video Comment/Track fields or JSON sidecars.
 * Shared between AddVideoModal and BatchImportModal to prevent desync.
 */
export function parseWanGpMetadata(commentRaw?: string, fallbackDurationSec?: number, fallbackFps = 24): ParsedWanGpMetadata | null {
  if (!commentRaw || typeof commentRaw !== 'string') return null;

  try {
    const parsed = JSON.parse(commentRaw);
    const techDetails = extractTechnicalDetails(parsed, commentRaw, parsed.model_type || parsed.type || '');
    
    // Support root level or nested params (Maestro / Wan2GP)
    const actualParams = (parsed && typeof parsed === 'object' && parsed.params && typeof parsed.params === 'object')
      ? parsed.params
      : parsed;

    let width: number | undefined = undefined;
    let height: number | undefined = undefined;
    const resString = actualParams.resolution || parsed.resolution || actualParams.aspect_ratio || parsed.aspect_ratio;
    if (resString && typeof resString === 'string' && resString.includes('x')) {
      const [w, h] = resString.split('x');
      if (w && h) {
        width = Number(w);
        height = Number(h);
      }
    } else if (actualParams.width && actualParams.height) {
      width = Number(actualParams.width);
      height = Number(actualParams.height);
    } else if (parsed.width && parsed.height) {
      width = Number(parsed.width);
      height = Number(parsed.height);
    }

    const parsedFps = Number(actualParams.fps || parsed.fps || fallbackFps);

    let durationSeconds: string | undefined = undefined;
    const videoLength = actualParams.video_length ?? parsed.video_length ?? actualParams.frame_count ?? parsed.frame_count;
    if (videoLength !== undefined) {
      const computedDuration = Number(videoLength) / parsedFps;
      durationSeconds = computedDuration.toFixed(1);
    } else if (fallbackDurationSec !== undefined && fallbackDurationSec > 0) {
      durationSeconds = fallbackDurationSec.toFixed(1);
    }

    const loras: Lora[] = [];
    const activatedLoras = actualParams.activated_loras || parsed.activated_loras || actualParams.loras || parsed.loras;
    const lorasMultipliers = actualParams.loras_multipliers || parsed.loras_multipliers;

    if (Array.isArray(activatedLoras) && lorasMultipliers) {
      const weights = String(lorasMultipliers).split('|');
      activatedLoras.forEach((loraPath: string, idx: number) => {
        const nameParts = String(loraPath).split(/[\/\\]/);
        let baseName = nameParts[nameParts.length - 1];
        baseName = baseName.replace(/\.[^/.]+$/, "");
        const weightStr = weights[idx];
        if (weightStr !== undefined && weightStr !== '') {
          loras.push({ name: baseName, weight: parseFloat(weightStr) });
        }
      });
    } else if (Array.isArray(activatedLoras)) {
      activatedLoras.forEach((loraItem: any) => {
        if (typeof loraItem === 'string') {
          const nameParts = loraItem.split(/[\/\\]/);
          let baseName = nameParts[nameParts.length - 1].replace(/\.[^/.]+$/, "");
          loras.push({ name: baseName, weight: 1 });
        } else if (loraItem && typeof loraItem === 'object' && loraItem.name) {
          loras.push({ name: loraItem.name, weight: loraItem.weight ?? 1 });
        }
      });
    }

    const prompt = actualParams.prompt || parsed.prompt || undefined;
    const seed = actualParams.seed !== undefined ? String(actualParams.seed) : (parsed.seed !== undefined ? String(parsed.seed) : undefined);
    const steps = actualParams.num_inference_steps !== undefined 
      ? Number(actualParams.num_inference_steps) 
      : (parsed.num_inference_steps !== undefined ? Number(parsed.num_inference_steps) : (actualParams.steps !== undefined ? Number(actualParams.steps) : undefined));
    const shift = actualParams.flow_shift !== undefined 
      ? String(actualParams.flow_shift) 
      : (parsed.flow_shift !== undefined ? String(parsed.flow_shift) : (actualParams.shift !== undefined ? String(actualParams.shift) : undefined));

    const renderSeconds = parsed.generation_time !== undefined 
      ? Number(parsed.generation_time) 
      : (actualParams.generation_time !== undefined ? Number(actualParams.generation_time) : (parsed.job_elapsed_time !== undefined ? Number(parsed.job_elapsed_time) : undefined));

    let generatedAt: number | undefined = undefined;
    if (parsed.created_at !== undefined) {
      const num = Number(parsed.created_at);
      if (!isNaN(num) && num > 0) {
        generatedAt = num > 1e11 ? Math.round(num) : Math.round(num * 1000);
      }
    } else if (actualParams.created_at !== undefined) {
      const num = Number(actualParams.created_at);
      if (!isNaN(num) && num > 0) {
        generatedAt = num > 1e11 ? Math.round(num) : Math.round(num * 1000);
      }
    } else if (parsed.creation_timestamp !== undefined) {
      generatedAt = Math.round(Number(parsed.creation_timestamp) * 1000);
    } else if (actualParams.creation_timestamp !== undefined) {
      generatedAt = Math.round(Number(actualParams.creation_timestamp) * 1000);
    } else if (parsed.creation_date) {
      generatedAt = new Date(parsed.creation_date).getTime();
    } else if (actualParams.creation_date) {
      generatedAt = new Date(actualParams.creation_date).getTime();
    }

    return {
      prompt: prompt ? String(prompt) : undefined,
      seed,
      steps,
      shift,
      baseModel: techDetails.baseModel,
      modelSizeB: techDetails.modelSizeB,
      modelVariant: techDetails.modelVariant,
      modelTypeRaw: techDetails.modelTypeRaw,
      softwareSource: techDetails.softwareSource,
      localTool: techDetails.localTool,
      videoVae: techDetails.videoVae,
      textEncoder: techDetails.textEncoder,
      precision: techDetails.precision,
      tags: techDetails.tags,
      width,
      height,
      renderSeconds,
      durationSeconds,
      fps: parsedFps,
      generatedAt,
      loras,
      rawComment: commentRaw,
      turboPreset: techDetails.turboPreset,
      turboMode: techDetails.turboMode,
      skipStepsMultiplier: techDetails.skipStepsMultiplier,
      skipStepsCacheType: techDetails.skipStepsCacheType,
      overrideAttention: techDetails.overrideAttention,
      slidingWindowSize: techDetails.slidingWindowSize,
      slidingWindowOverlap: techDetails.slidingWindowOverlap,
      cfg: techDetails.cfg,
      jobId: techDetails.jobId,
      jobElapsedTimeSeconds: techDetails.jobElapsedTimeSeconds,
      generationTimeBasis: techDetails.generationTimeBasis,
      settingsVersion: techDetails.settingsVersion,
    };
  } catch {
    // Non-JSON comment fallback
    const techDetails = extractTechnicalDetails(undefined, commentRaw);
    return {
      baseModel: techDetails.baseModel,
      modelSizeB: techDetails.modelSizeB,
      modelVariant: techDetails.modelVariant,
      modelTypeRaw: techDetails.modelTypeRaw,
      softwareSource: techDetails.softwareSource,
      localTool: techDetails.localTool,
      videoVae: techDetails.videoVae,
      textEncoder: techDetails.textEncoder,
      precision: techDetails.precision,
      tags: techDetails.tags,
      loras: [],
      rawComment: commentRaw,
      turboPreset: techDetails.turboPreset,
      turboMode: techDetails.turboMode,
      skipStepsMultiplier: techDetails.skipStepsMultiplier,
      skipStepsCacheType: techDetails.skipStepsCacheType,
      overrideAttention: techDetails.overrideAttention,
      slidingWindowSize: techDetails.slidingWindowSize,
      slidingWindowOverlap: techDetails.slidingWindowOverlap,
      cfg: techDetails.cfg,
      jobId: techDetails.jobId,
      jobElapsedTimeSeconds: techDetails.jobElapsedTimeSeconds,
      generationTimeBasis: techDetails.generationTimeBasis,
      settingsVersion: techDetails.settingsVersion,
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

  // 1.1 Herramienta / Software (Wan2GP / Maestro)
  const toolA = a.localTool || (a.softwareSource === 'maestro' ? 'Maestro' : 'Wan2GP');
  const toolB = b.localTool || (b.softwareSource === 'maestro' ? 'Maestro' : 'Wan2GP');
  diffs.push({
    id: 'software',
    category: 'model',
    label: 'Software / Pipeline',
    valueA: toolA,
    valueB: toolB,
    displayA: toolA,
    displayB: toolB,
    isDifferent: toolA.toLowerCase() !== toolB.toLowerCase(),
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

  // Parse filename heuristics as initial fallback
  const rawFileName = urlInfo.fileName ? urlInfo.fileName.replace(/\.[^/.]+$/, "") : "";
  let fallbackSeed: string | undefined = undefined;
  const seedMatch = rawFileName.match(/seed[_\-]?(\d+)/i);
  if (seedMatch && seedMatch[1]) {
    fallbackSeed = seedMatch[1];
  }

  let fallbackGeneratedAt: number | undefined = undefined;
  const dateMatch = rawFileName.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})h(\d{2})m(\d{2})s/i);
  if (dateMatch) {
    const [, yr, mo, da, hr, mi, se] = dateMatch;
    const parsedDate = new Date(`${yr}-${mo}-${da}T${hr}:${mi}:${se}`);
    if (!isNaN(parsedDate.getTime())) {
      fallbackGeneratedAt = parsedDate.getTime();
    }
  }

  let prompt = rawFileName ? rawFileName.replace(/seed\d+/i, '').replace(/\d{4}_\d{2}_\d{2}_\d{2}h\d{2}m\d{2}s/i, '').replace(/[_\-]+/g, ' ').trim() : "Importado desde URL";
  if (!prompt) prompt = "Importado desde URL";
  let title: string | undefined = generateTitleFromPrompt(prompt) || undefined;

  let width = 1920;
  let height = 1080;
  let model = "Wan 2.1";
  let modelSizeB: number | undefined = undefined;
  let modelVariant: string | undefined = undefined;
  let durationSeconds = 5;
  let steps = 30;
  let shift = "5.0";
  let seed = fallbackSeed || "";
  let tagsInput = "";
  let videoVae: string = 'Original VAE';
  let textEncoder: string = 'Not Found';
  let loras: Lora[] = [];
  let renderSeconds: number | undefined = undefined;
  let generatedAt: number | undefined = fallbackGeneratedAt;
  let fileSizeBytes: number | undefined = undefined;
  let commentRaw: string | undefined = undefined;

  let softwareSource: 'wan2gp' | 'maestro' | 'comfyui' | 'other' | undefined = source === 'local' ? 'wan2gp' : undefined;
  let localTool: string | undefined = source === 'local' ? 'Wan2GP' : undefined;
  let modelTypeRaw: string | undefined = undefined;
  let turboPreset: string | undefined = undefined;
  let turboMode: boolean | undefined = undefined;
  let skipStepsMultiplier: number | undefined = undefined;
  let skipStepsCacheType: string | undefined = undefined;
  let overrideAttention: string | undefined = undefined;
  let slidingWindowSize: number | undefined = undefined;
  let slidingWindowOverlap: number | undefined = undefined;
  let cfg: number | undefined = undefined;
  let jobId: string | undefined = undefined;
  let jobElapsedTimeSeconds: number | undefined = undefined;
  let generationTimeBasis: string | undefined = undefined;
  let settingsVersion: number | undefined = undefined;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      fileSizeBytes = blob.size;

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
      commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;

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
          if (metadata.modelTypeRaw) modelTypeRaw = metadata.modelTypeRaw;
          if (metadata.softwareSource) softwareSource = metadata.softwareSource;
          if (metadata.localTool) localTool = metadata.localTool;
          videoVae = metadata.videoVae || 'Original VAE';
          textEncoder = metadata.textEncoder;
          if (metadata.tags && metadata.tags.length > 0) tagsInput = metadata.tags.join(', ');
          if (metadata.renderSeconds !== undefined) renderSeconds = metadata.renderSeconds;
          if (metadata.generatedAt !== undefined) generatedAt = metadata.generatedAt;
          if (metadata.loras && metadata.loras.length > 0) loras = metadata.loras;
          turboPreset = metadata.turboPreset;
          turboMode = metadata.turboMode;
          skipStepsMultiplier = metadata.skipStepsMultiplier;
          skipStepsCacheType = metadata.skipStepsCacheType;
          overrideAttention = metadata.overrideAttention;
          slidingWindowSize = metadata.slidingWindowSize;
          slidingWindowOverlap = metadata.slidingWindowOverlap;
          cfg = metadata.cfg;
          jobId = metadata.jobId;
          jobElapsedTimeSeconds = metadata.jobElapsedTimeSeconds;
          generationTimeBasis = metadata.generationTimeBasis;
          settingsVersion = metadata.settingsVersion;
        }
      }
    }
  } catch (err) {
    console.warn("Extracción binaria remota falló (usando fallback por URL):", err);
  }

  // Notificar categoría descubierta una vez confirmado el registro
  if (finalGroupName && onAddCategory) {
    onAddCategory(finalGroupName);
  }

  const orientation = calculateOrientation(width, height);
  const resolvedDisplayName = userDisplayName || userEmail || urlInfo.username || undefined;
  const resolvedCreatedBy = userEmail || userDisplayName || (urlInfo.username ? `@${urlInfo.username}` : undefined);

  const record: VideoRecord = {
    schemaVersion: 2,
    videoUrl: url,
    groupName: finalGroupName,
    title,
    prompt,
    model,
    modelSizeB,
    modelVariant,
    modelTypeRaw,
    softwareSource,
    source,
    localTool: localTool || (source === 'local' ? (softwareSource === 'maestro' ? 'Maestro' : 'Wan2GP') : undefined),
    tags: tagsInput ? tagsInput.split(',').map(s => s.trim()).filter(Boolean) : [],
    width,
    height,
    orientation,
    steps: steps !== undefined && !isNaN(Number(steps)) ? Number(steps) : 30,
    shift: shift && !isNaN(parseFloat(shift)) ? parseFloat(shift) : undefined,
    seed: seed && !isNaN(parseInt(seed, 10)) ? parseInt(seed, 10) : undefined,
    fps: 24,
    durationSeconds: durationSeconds && !isNaN(Number(durationSeconds)) ? Number(durationSeconds) : 5,
    videoVae: videoVae && videoVae !== 'Not Found' ? videoVae : 'Original VAE',
    textEncoder,
    loras,
    createdAt: Date.now(),
    createdBy: resolvedCreatedBy,
    creatorUid: userUid,
    creatorDisplayName: resolvedDisplayName,
    renderSeconds: renderSeconds !== undefined && !isNaN(renderSeconds) ? renderSeconds : undefined,
    fileSizeBytes: fileSizeBytes !== undefined && !isNaN(fileSizeBytes) ? fileSizeBytes : undefined,
    generatedAt: generatedAt !== undefined && !isNaN(generatedAt) ? generatedAt : undefined,
    rawMetadata: commentRaw,
    turboPreset,
    turboMode,
    skipStepsMultiplier: skipStepsMultiplier !== undefined && !isNaN(skipStepsMultiplier) ? skipStepsMultiplier : undefined,
    skipStepsCacheType,
    overrideAttention,
    slidingWindowSize: slidingWindowSize !== undefined && !isNaN(slidingWindowSize) ? slidingWindowSize : undefined,
    slidingWindowOverlap: slidingWindowOverlap !== undefined && !isNaN(slidingWindowOverlap) ? slidingWindowOverlap : undefined,
    cfg: cfg !== undefined && !isNaN(cfg) ? cfg : undefined,
    jobId,
    jobElapsedTimeSeconds: jobElapsedTimeSeconds !== undefined && !isNaN(jobElapsedTimeSeconds) ? jobElapsedTimeSeconds : undefined,
    generationTimeBasis,
    settingsVersion: settingsVersion !== undefined && !isNaN(settingsVersion) ? settingsVersion : undefined,
  };

  return record;
}

/**
 * Deep sanitization for Firestore payloads.
 * Strips out undefined, NaN, Infinity, and invalid nested structures.
 */
export function cleanForFirestore(obj: any): any {
  if (obj === undefined) return undefined;
  if (typeof obj === 'number') {
    if (isNaN(obj) || !isFinite(obj)) return undefined;
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanForFirestore(item))
      .filter(item => item !== undefined);
  }
  if (obj !== null && typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = cleanForFirestore(v);
      if (cleaned !== undefined) {
        res[k] = cleaned;
      }
    }
    return res;
  }
  return obj;
}
