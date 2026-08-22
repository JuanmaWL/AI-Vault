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

export function parseModelAndTags(modelType: string, typeDesc: string = ''): { baseModel: string, newTags: string[] } {
  const combined = `${modelType} ${typeDesc}`.toLowerCase();
  
  let baseModel = modelType;
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

  const tagsSet = new Set<string>();
  
  // Extract specific technical tags based on keywords
  if (combined.includes('pruned')) tagsSet.add('pruned');
  if (combined.includes('distilled')) tagsSet.add('distilled');
  if (combined.includes('ref2va')) tagsSet.add('ref2va');
  if (combined.includes('fl2va')) tagsSet.add('FL2VA');
  if (combined.includes('33b')) tagsSet.add('33B');
  if (combined.includes('20b')) tagsSet.add('20B');
  if (combined.includes('14b')) tagsSet.add('14B');
  if (combined.includes('fp8')) tagsSet.add('fp8');
  if (combined.includes('bf16')) tagsSet.add('bf16');
  if (combined.includes('scail2')) tagsSet.add('SCAIL 2');

  return { baseModel, newTags: Array.from(tagsSet) };
}