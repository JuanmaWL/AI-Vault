import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoOrientation } from '../types';

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