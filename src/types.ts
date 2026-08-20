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

  // Parámetros técnicos
  width: number;
  height: number;
  orientation: VideoOrientation; // derivado automáticamente de width/height al guardar
  steps: number;
  shift?: number;           // opcional: no todos los modelos lo usan
  seed?: number;
  fps?: number;
  durationSeconds?: number;
  loras: Lora[];

  notes?: string;
  createdAt: number;
  createdBy?: string;       // email del usuario autenticado que creó el registro
}