export interface UserHardware {
  gpu: string;
  vram: number;
  ram: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  hardware?: UserHardware;
}

export interface Lora {
  name: string;
  weight: number;
}

export type VideoOrientation = '16:9' | '9:16' | '1:1' | 'other';
export type VideoSource = 'local' | 'cloud';

export interface VideoRecord {
  id?: string;
  schemaVersion: 2;

  // Origen del vídeo
  videoUrl: string;        // link original de Google Drive
  driveFileId: string;     // extraído UNA vez al guardar (regex), no en cada render

  // Generación
  prompt: string;
  negativePrompt?: string;
  model: string;           // texto libre con autocompletado (histórico de valores usados)
  source: VideoSource;     // 'local' (Wan2GP) | 'cloud'
  tags?: string[];         // libre: "pruned", "33B", "distilled", "ref2va"...
  groupName?: string;      // carpeta o grupo de comparación

  // Hardware usado (sello histórico)
  hardware?: UserHardware;

  // Parámetros técnicos
  width: number;
  height: number;
  orientation: VideoOrientation; // derivado automáticamente de width/height al guardar
  steps: number;
  shift?: number;           // opcional: no todos los modelos lo usan
  seed?: number;
  fps?: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  videoVae?: string;        // Video VAE (ej: "Wan 2.1 VAE", "TAESD", etc.)
  textEncoder?: string;     // Text Encoder (ej: "Qwen3-VL", "umt5_xxl", etc.)
  precision?: string;       // Formato/precisión/cuantización (ej: "GGUF Q4_K_M", "FP8", "BF16")
  loras: Lora[];

  notes?: string;
  createdAt: number;
  createdBy?: string;       // email del usuario autenticado que creó el registro
  creatorUid?: string;      // UID del usuario autenticado en Firebase
  creatorDisplayName?: string; // Apodo o nombre para mostrar del usuario
  
  // Metadatos adicionales importados
  renderSeconds?: number;
  generatedAt?: number;     // timestamp Unix (ms)
  rawMetadata?: string;     // JSON original sin parsear
}