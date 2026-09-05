import { VideoRecord } from '../types';

export const MOCK_DATA: VideoRecord[] = [
  {
    id: 'mock1',
    schemaVersion: 2,
    isMock: true,
    videoUrl: 'https://huggingface.co/datasets/example/videos/resolve/main/cyberpunk_street.mp4',
    prompt: 'A high quality cinematic shot of a stunning futuristic cyberpunk street, neon lights reflection, masterpiece, detailed.',
    model: 'Wan2.1 FL2VA (Wan2GP)',
    source: 'local',
    tags: ['Wan2GP', '33B', 'FL2VA'],
    width: 1920,
    height: 1080,
    orientation: '16:9',
    steps: 30,
    shift: 5.0,
    seed: 4891024,
    fps: 24,
    durationSeconds: 5,
    loras: [
      { name: 'NeonGlow', weight: 0.7 }
    ],
    createdAt: Date.now()
  }
];
