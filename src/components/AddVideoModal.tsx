import { useState, FormEvent } from 'react';
import { VideoRecord, Lora } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface AddVideoModalProps {
  onClose: () => void;
  onSave: (video: VideoRecord) => Promise<void>;
}

export function AddVideoModal({ onClose, onSave }: AddVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('Kling 1.5');
  const [resolution, setResolution] = useState('1920x1080');
  const [steps, setSteps] = useState(30);
  const [shift, setShift] = useState(1);
  const [loras, setLoras] = useState<Lora[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddLora = () => {
    setLoras([...loras, { name: '', weight: 1.0 }]);
  };

  const handleRemoveLora = (index: number) => {
    setLoras(loras.filter((_, i) => i !== index));
  };

  const handleLoraChange = (index: number, field: keyof Lora, value: string | number) => {
    const updated = [...loras];
    updated[index] = { ...updated[index], [field]: value };
    setLoras(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Filtrar loras vacíos
    const cleanLoras = loras.filter(l => l.name.trim() !== '');
    
    const record: VideoRecord = {
      videoUrl,
      prompt,
      model,
      resolution,
      steps,
      shift,
      loras: cleanLoras,
      createdAt: Date.now()
    };

    await onSave(record);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-neutral-100">Nuevo Registro de Vídeo</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar">
          <form id="add-video-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Enlace de Google Drive</label>
              <input 
                type="url" 
                required
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Prompt</label>
              <textarea 
                required
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Descripción detallada de la generación..."
                rows={4}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Modelo AI</label>
                <input 
                  type="text" 
                  required
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="Ej: Kling 1.5, Luma, Runway Gen3"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Resolución</label>
                <input 
                  type="text" 
                  required
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  placeholder="Ej: 1920x1080"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Steps</label>
                <input 
                  type="number" 
                  required
                  min={1}
                  value={steps}
                  onChange={e => setSteps(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Shift / Guidance</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  value={shift}
                  onChange={e => setShift(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-300">LoRAs Aplicados</label>
                <button 
                  type="button" 
                  onClick={handleAddLora}
                  className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir LoRA
                </button>
              </div>
              
              {loras.length === 0 ? (
                <div className="text-sm text-neutral-600 italic">No hay LoRAs configurados.</div>
              ) : (
                <div className="space-y-3">
                  {loras.map((lora, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={lora.name}
                        onChange={e => handleLoraChange(idx, 'name', e.target.value)}
                        placeholder="Nombre del LoRA"
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
                      />
                      <input 
                        type="number" 
                        step="0.05"
                        value={lora.weight}
                        onChange={e => handleLoraChange(idx, 'weight', Number(e.target.value))}
                        placeholder="Peso"
                        className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
                      />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLora(idx)}
                        className="text-neutral-500 hover:text-red-400 p-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-neutral-800 bg-neutral-900 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="add-video-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
