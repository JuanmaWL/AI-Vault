export interface UserHardware {
  gpu: string;
  vram: number;
  ram: number;
}

export interface HardwareMilestone {
  sinceDate: string; // Formato YYYY-MM-DD (ej: "2026-09-04")
  gpu: string;
  vram: number;
  ram: number;
  label?: string;   // ej: "Ampliación a 64GB RAM"
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  hardware?: UserHardware;
  initialHardware?: UserHardware; // Configuración previa al primer hito de hardware registrado
  hardwareHistory?: HardwareMilestone[];
  role?: 'admin' | 'viewer';
  huggingfaceDatasetUrl?: string;
}

export interface Lora {
  name: string;
  weight: number;
}

export type VideoOrientation = '16:9' | '9:16' | '1:1' | 'other';
export type VideoSource = 'local' | 'cloud';
export type SoftwareSource = 'wan2gp' | 'maestro' | 'comfyui' | 'other';

export interface VideoRecord {
  id?: string;
  schemaVersion: 2;

  // Origen del vídeo
  videoUrl: string;        // URL directa o reproducible del vídeo

  // Generación
  title?: string;          // título legible autogenerado o personalizado por el usuario
  prompt: string;
  negativePrompt?: string;
  model: string;           // texto libre con autocompletado (histórico de valores usados)
  modelSizeB?: number;     // tamaño del modelo en billones de parámetros (ej. 20, 33)
  modelVariant?: string;   // variante del modelo (ej. "FL2VA", "Ref2VA", "SCAIL 2", "Pruned", "Full")
  modelTypeRaw?: string;   // identificador interno del modelo en el backend (ej: "minimax_h3", "minimax_h3_full", "ltx_video")
  source: VideoSource;     // 'local' | 'cloud'
  localTool?: string;      // herramienta local utilizada (ej. "Wan2GP", "Maestro", "ComfyUI")
  softwareSource?: SoftwareSource; // software detectado/asignado de generación
  tags?: string[];         // etiquetas libres del usuario
  groupName?: string;      // carpeta o grupo de comparación

  // Hardware usado (sello histórico)
  hardware?: UserHardware;

  // Parámetros técnicos
  width: number;
  height: number;
  orientation: VideoOrientation; // derivado automáticamente de width/height al guardar
  steps: number;
  cfg?: number;             // guidance_scale / CFG
  shift?: number;           // opcional: no todos los modelos lo usan (flow_shift)
  seed?: number;
  fps?: number;
  durationSeconds?: number;
  framesCount?: number;     // número total de frames generados (video_length)
  fileSizeBytes?: number;
  videoVae?: string;        // Video VAE (ej: "Wan 2.1 VAE", "TAESD", etc.)
  textEncoder?: string;     // Text Encoder / Cuantización (ej: "gguf_q2_k", "gguf_q4_k_m", "umt5_xxl")
  precision?: string;       // Formato/precisión/cuantización (ej: "GGUF Q4_K_M", "FP8", "BF16")
  loras: Lora[];

  // Metadatos técnicos de render / Optimizaciones (Wan2GP / Maestro)
  turboPreset?: string;      // Preset turbo (ej: "v4-step600-ema")
  turboMode?: boolean;       // Si el modo turbo estaba activado
  skipStepsMultiplier?: number; // Multiplicador de salto de pasos
  skipStepsCacheType?: string;  // Tipo de caché de pasos (ej: "first_block")
  overrideAttention?: string;   // Modo de atención (ej: "sol")
  slidingWindowSize?: number;   // Tamaño de ventana deslizante
  slidingWindowOverlap?: number;// Solapamiento de ventana deslizante

  notes?: string;
  createdAt: number;
  createdBy?: string;       // email del usuario autenticado que creó el registro
  creatorUid?: string;      // UID del usuario autenticado en Firebase
  creatorDisplayName?: string; // Apodo o nombre para mostrar del usuario
  
  // Metadatos adicionales importados
  renderSeconds?: number;
  jobElapsedTimeSeconds?: number; // Tiempo total del job en segundos
  generationTimeBasis?: string;   // Base de cálculo (ej: "active")
  jobId?: string;                 // ID único del job en Maestro/Wan2GP
  settingsVersion?: number;       // Versión de settings (ej: 2.52 en Maestro)
  generatedAt?: number;           // timestamp Unix (ms)
  rawMetadata?: string;           // JSON original sin parsear
}