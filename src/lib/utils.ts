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

export interface ExtractedTechnicalDetails {
  baseModel: string;
  videoVae?: string;
  textEncoder?: string;
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

  // 2. Video VAE Detection
  let videoVae: string | undefined = undefined;
  if (parsedJson?.video_vae) videoVae = String(parsedJson.video_vae);
  else if (parsedJson?.vae) videoVae = String(parsedJson.vae);
  else if (parsedJson?.vae_name) videoVae = String(parsedJson.vae_name);
  else if (parsedJson?.vae_model) videoVae = String(parsedJson.vae_model);
  else if (parsedJson?.vae_path) videoVae = String(parsedJson.vae_path);

  if (!videoVae) {
    if (combined.includes('taesd')) {
      videoVae = 'TAESD (Fast VAE)';
    } else if (combined.includes('wan2.1_vae') || combined.includes('wan_2.1_vae') || combined.includes('wan 2.1 vae')) {
      videoVae = 'Wan 2.1 VAE';
    } else if (combined.includes('wan2.2_vae') || combined.includes('wan_2.2_vae')) {
      videoVae = 'Wan 2.2 VAE';
    } else if (combined.includes('sdxl_vae') || combined.includes('sdxl vae')) {
      videoVae = 'SDXL VAE';
    }
  } else {
    // Clean up path if present (e.g. "path/to/Wan2.1_VAE.pth" -> "Wan 2.1 VAE")
    const fileName = videoVae.split(/[/\\]/).pop() || videoVae;
    const cleanName = fileName.replace(/\.[^/.]+$/, "");
    if (/wan.*2\.?1.*vae/i.test(cleanName)) {
      videoVae = 'Wan 2.1 VAE';
    } else if (/taesd/i.test(cleanName)) {
      videoVae = 'TAESD';
    } else {
      videoVae = cleanName;
    }
  }

  // 3. Text Encoder Detection (e.g. Qwen3-VL, Qwen2.5-VL, umt5_xxl, T5)
  let textEncoder: string | undefined = undefined;
  if (parsedJson?.text_encoder) textEncoder = String(parsedJson.text_encoder);
  else if (parsedJson?.text_encoder_name) textEncoder = String(parsedJson.text_encoder_name);
  else if (parsedJson?.text_encoder_path) textEncoder = String(parsedJson.text_encoder_path);
  else if (parsedJson?.t5_path || parsedJson?.t5_model) textEncoder = String(parsedJson.t5_path || parsedJson.t5_model);
  else if (parsedJson?.llm) textEncoder = String(parsedJson.llm);

  if (!textEncoder) {
    if (combined.includes('qwen3-vl') || combined.includes('qwen3_vl') || combined.includes('qwen3vl')) {
      textEncoder = 'Qwen3-VL';
    } else if (combined.includes('qwen2.5-vl') || combined.includes('qwen2.5_vl') || combined.includes('qwen2_5_vl')) {
      textEncoder = 'Qwen2.5-VL';
    } else if (combined.includes('qwen2-vl') || combined.includes('qwen2_vl')) {
      textEncoder = 'Qwen2-VL';
    } else if (combined.includes('umt5_xxl') || combined.includes('umt5-xxl') || combined.includes('umt5xxl')) {
      textEncoder = 'umt5_xxl';
    } else if (combined.includes('t5-v1_1-xxl') || combined.includes('t5_xxl') || combined.includes('t5xxl')) {
      textEncoder = 'google/t5-v1_1-xxl';
    } else if (combined.includes('clip-l') || combined.includes('clip_l')) {
      textEncoder = 'CLIP-L';
    }
  } else {
    const fileName = textEncoder.split(/[/\\]/).pop() || textEncoder;
    const cleanName = fileName.replace(/\.[^/.]+$/, "");
    if (/qwen3.*vl/i.test(cleanName)) textEncoder = 'Qwen3-VL';
    else if (/qwen2\.?5.*vl/i.test(cleanName)) textEncoder = 'Qwen2.5-VL';
    else if (/umt5.*xxl/i.test(cleanName)) textEncoder = 'umt5_xxl';
    else textEncoder = cleanName;
  }

  // 4. Precision / Quantization Detection (e.g. GGUF Q4_K_M, FP8 Mixed Precision, BF16, etc.)
  let precision: string | undefined = undefined;
  if (parsedJson?.precision) precision = String(parsedJson.precision);
  else if (parsedJson?.quantization) precision = String(parsedJson.quantization);
  else if (parsedJson?.mixed_precision) precision = String(parsedJson.mixed_precision);
  else if (parsedJson?.dtype) precision = String(parsedJson.dtype);

  if (!precision) {
    if (combined.includes('q4_k_m') || combined.includes('q4-k-m') || combined.includes('q4km')) {
      precision = combined.includes('gguf') ? 'GGUF Q4_K_M' : 'Q4_K_M';
    } else if (combined.includes('q4_k_s') || combined.includes('q4-k-s')) {
      precision = combined.includes('gguf') ? 'GGUF Q4_K_S' : 'Q4_K_S';
    } else if (combined.includes('q5_k_m') || combined.includes('q5-k-m')) {
      precision = combined.includes('gguf') ? 'GGUF Q5_K_M' : 'Q5_K_M';
    } else if (combined.includes('q5_k_s') || combined.includes('q5-k-s')) {
      precision = combined.includes('gguf') ? 'GGUF Q5_K_S' : 'Q5_K_S';
    } else if (combined.includes('q8_0') || combined.includes('q8-0')) {
      precision = combined.includes('gguf') ? 'GGUF Q8_0' : 'Q8_0';
    } else if (combined.includes('q4_0') || combined.includes('q4-0')) {
      precision = combined.includes('gguf') ? 'GGUF Q4_0' : 'Q4_0';
    } else if (combined.includes('fp8 mixed') || combined.includes('fp8_mixed') || combined.includes('mixed precision')) {
      precision = 'FP8 Mixed Precision';
    } else if (combined.includes('fp8_e4m3fn') || combined.includes('fp8-e4m3fn') || combined.includes('e4m3fn')) {
      precision = 'FP8 (e4m3fn)';
    } else if (combined.includes('fp8_e5m2') || combined.includes('e5m2')) {
      precision = 'FP8 (e5m2)';
    } else if (combined.includes('fp8')) {
      precision = 'FP8';
    } else if (combined.includes('bf16')) {
      precision = 'BF16';
    } else if (combined.includes('fp16')) {
      precision = 'FP16';
    }
  }

  // 5. Automatic Tag Enrichment
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
  if (precision) {
    if (precision.includes('GGUF') || combined.includes('gguf')) tagsSet.add('GGUF');
    if (precision.includes('Q4_K_M')) tagsSet.add('Q4_K_M');
    if (precision.includes('Q5_K_M')) tagsSet.add('Q5_K_M');
    if (precision.includes('Q8_0')) tagsSet.add('Q8_0');
    if (precision.includes('FP8') || combined.includes('fp8')) tagsSet.add('FP8');
    if (precision.includes('BF16') || combined.includes('bf16')) tagsSet.add('BF16');
  }

  // Text Encoder tags
  if (textEncoder) {
    if (textEncoder.toLowerCase().includes('qwen3')) tagsSet.add('Qwen3-VL');
    else if (textEncoder.toLowerCase().includes('qwen2.5')) tagsSet.add('Qwen2.5-VL');
    else if (textEncoder.toLowerCase().includes('umt5')) tagsSet.add('umt5_xxl');
  }

  // Video VAE tags
  if (videoVae) {
    if (videoVae.toLowerCase().includes('taesd')) tagsSet.add('TAESD');
    else if (videoVae.toLowerCase().includes('wan')) tagsSet.add('Wan VAE');
  }

  return {
    baseModel,
    videoVae,
    textEncoder,
    precision,
    tags: Array.from(tagsSet)
  };
}

export function parseModelAndTags(modelType: string, typeDesc: string = ''): { baseModel: string, newTags: string[] } {
  const details = extractTechnicalDetails(undefined, '', modelType, typeDesc);
  return { baseModel: details.baseModel, newTags: details.tags };
}