export interface Lora {
  name: string;
  weight: number;
}

export interface VideoRecord {
  id?: string;
  videoUrl: string;
  prompt: string;
  model: string;
  resolution: string;
  steps: number;
  shift: number;
  loras: Lora[];
  createdAt?: number;
}
