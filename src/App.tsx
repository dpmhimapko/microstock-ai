import React, { useState, useEffect, useCallback } from 'react';
import { 
  Image as ImageIcon, 
  Type as TypeIcon, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  Trash2, 
  Loader2, 
  Languages,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  ExternalLink,
  Key,
  Sparkles,
  Copy,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { cn } from './lib/utils';

// --- Types ---

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

interface GeneratedImage {
  id: string;
  prompt: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  aspectRatio: AspectRatio;
  error?: string;
}

interface MetadataItem {
  id: string;
  filename: string;
  title: string;
  keywords: string;
  category: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  previewUrl: string;
}

// --- Components ---

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap",
      active 
        ? "border-black text-black" 
        : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
    )}
  >
    <Icon size={18} />
    {label}
  </button>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'batch' | 'metadata' | 'promptGen' | 'settings'>('batch');
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');

  useEffect(() => {
    if (customApiKey) {
      localStorage.setItem('gemini_api_key', customApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }, [customApiKey]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                <ImageIcon size={20} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Microstock AI</h1>
            </div>
            {customApiKey && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                <Key size={12} /> Custom API Key Active
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto scrollbar-hide">
            <nav className="flex -mb-px min-w-max">
              <TabButton 
                active={activeTab === 'batch'} 
                onClick={() => setActiveTab('batch')} 
                icon={ImageIcon} 
                label="Batch Image Gen" 
              />
              <TabButton 
                active={activeTab === 'promptGen'} 
                onClick={() => setActiveTab('promptGen')} 
                icon={Sparkles} 
                label="Prompt Builder" 
              />
              <TabButton 
                active={activeTab === 'metadata'} 
                onClick={() => setActiveTab('metadata')} 
                icon={FileSpreadsheet} 
                label="Metadata CSV" 
              />
              <TabButton 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
                icon={Key} 
                label="API Settings" 
              />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={cn(activeTab !== 'batch' && "hidden")}>
          <BatchImageGen customApiKey={customApiKey} />
        </div>
        <div className={cn(activeTab !== 'promptGen' && "hidden")}>
          <PromptBuilder customApiKey={customApiKey} />
        </div>
        <div className={cn(activeTab !== 'metadata' && "hidden")}>
          <MetadataGenerator customApiKey={customApiKey} />
        </div>
        <div className={cn(activeTab !== 'settings' && "hidden")}>
          <Settings apiKey={customApiKey} setApiKey={setCustomApiKey} />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm">
          <p>© 2026 Microstock AI Tools. Built with Gemini Flash (No extra API key needed).</p>
          <div className="flex gap-6">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hover:text-black transition-colors flex items-center gap-1">
              Billing Info <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Feature Components ---

function BatchImageGen({ customApiKey }: { customApiKey?: string }) {
  const [promptsText, setPromptsText] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const downloadAll = async () => {
    const completedImages = images.filter(img => img.status === 'completed' && img.url);
    if (completedImages.length === 0) return;

    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < completedImages.length; i++) {
        const img = completedImages[i];
        const base64Data = img.url.split(',')[1];
        zip.file(`image-${img.id}.png`, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch-images-${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download all error:', error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const generateImages = async () => {
    const prompts = promptsText.split('\n').filter(p => p.trim() !== '');
    if (prompts.length === 0) return;

    setIsGenerating(true);
    const newImages: GeneratedImage[] = prompts.map(p => ({
      id: Math.random().toString(36).substr(2, 9),
      prompt: p,
      url: '',
      status: 'pending',
      aspectRatio: aspectRatio
    }));
    setImages(prev => [...newImages, ...prev]);

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const concurrencyLimit = 2; // Process 2 images at a time

    const processImage = async (currentImage: GeneratedImage) => {
      setImages(prev => prev.map(img => 
        img.id === currentImage.id ? { ...img, status: 'processing' } : img
      ));

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: currentImage.prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
            },
          },
        });

        let imageUrl = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          setImages(prev => prev.map(img => 
            img.id === currentImage.id ? { ...img, status: 'completed', url: imageUrl } : img
          ));
        } else {
          throw new Error('No image generated');
        }
      } catch (error: any) {
        console.error('Generation error:', error);
        setImages(prev => prev.map(img => 
          img.id === currentImage.id ? { ...img, status: 'error', error: error.message } : img
        ));
      }
    };

    // Batch processing
    for (let i = 0; i < newImages.length; i += concurrencyLimit) {
      const batch = newImages.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(processImage));
    }

    setIsGenerating(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompts (one per line)</label>
              <textarea
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                placeholder="A futuristic city in sunset&#10;A cute robot painting a canvas&#10;Cyberpunk street photography"
                className="w-full h-48 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {(['1:1', '3:4', '4:3', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={cn(
                      "px-2 py-2 text-xs font-medium rounded-lg border transition-all",
                      aspectRatio === ratio 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateImages}
              disabled={isGenerating || !promptsText.trim()}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Generate Batch
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Generated Images</h2>
          <div className="flex items-center gap-4">
            {images.some(img => img.status === 'completed') && (
              <button 
                onClick={downloadAll}
                disabled={isDownloadingAll}
                className="text-sm text-black hover:text-gray-600 flex items-center gap-1 transition-colors font-medium disabled:opacity-50"
              >
                {isDownloadingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download All (.zip)
              </button>
            )}
            {images.length > 0 && (
              <button 
                onClick={() => setImages([])}
                className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>
        </div>

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl h-96 flex flex-col items-center justify-center text-gray-400 space-y-2">
            <ImageIcon size={48} strokeWidth={1} />
            <p>Your generated images will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {images.map((img) => (
              <div key={img.id} className="bg-white rounded-2xl overflow-hidden border border-gray-200 group shadow-sm">
                <div className={cn(
                  "bg-gray-50 relative flex items-center justify-center overflow-hidden",
                  img.aspectRatio === "1:1" && "aspect-square",
                  img.aspectRatio === "3:4" && "aspect-[3/4]",
                  img.aspectRatio === "4:3" && "aspect-[4/3]",
                  img.aspectRatio === "9:16" && "aspect-[9/16]",
                  img.aspectRatio === "16:9" && "aspect-video"
                )}>
                  {img.status === 'processing' && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <Loader2 className="animate-spin text-black mb-2" size={32} />
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Generating...</p>
                    </div>
                  )}
                  {img.status === 'error' && (
                    <div className="p-6 text-center text-red-500 space-y-2">
                      <AlertCircle size={32} className="mx-auto" />
                      <p className="text-sm font-medium">Failed to generate</p>
                      <p className="text-xs text-gray-400">{img.error}</p>
                    </div>
                  )}
                  {img.url && (
                    <img 
                      src={img.url} 
                      alt={img.prompt} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {img.url && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a 
                        href={img.url} 
                        download={`gen-${img.id}.png`}
                        className="p-3 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        title="Download"
                      >
                        <Download size={20} />
                      </a>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-2 italic">"{img.prompt}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PromptBuilder({ customApiKey }: { customApiKey?: string }) {
  const [concept, setConcept] = useState('');
  const [count, setCount] = useState<number | string>(5);
  const [isCustom, setIsCustom] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [selectedVariations, setSelectedVariations] = useState<string[]>(['pose', 'background']);

  const variationOptions = [
    { id: 'pose', label: 'Pose & Action' },
    { id: 'background', label: 'Background' },
    { id: 'lighting', label: 'Lighting' },
    { id: 'camera', label: 'Camera Angle' },
    { id: 'mood', label: 'Color & Mood' },
    { id: 'expression', label: 'Expression' },
  ];

  const toggleVariation = (id: string) => {
    setSelectedVariations(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const generatePrompts = async () => {
    if (!concept.trim() && !file) return;
    setIsGenerating(true);
    setResults([]);

    try {
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const finalCount = isCustom ? Number(count) : count;
      const variationsText = selectedVariations.map(v => variationOptions.find(opt => opt.id === v)?.label).join(', ');
      
      const parts: any[] = [];
      
      if (file) {
        const base64 = await fileToBase64(file);
        parts.push({
          inlineData: {
            data: base64.split(',')[1],
            mimeType: file.type
          }
        });
      }

      parts.push({
        text: `Generate ${finalCount} high-quality, detailed AI image generation prompts.
        ${concept ? `Base them on this concept: "${concept}".` : "Base them on the provided image."}
        
        CRITICAL RULES:
        1. SUBJECT CONSISTENCY: You MUST maintain the EXACT SAME SUBJECT as seen in the reference image or described in the concept. If it's a "businessman", every prompt MUST be about a "businessman". Do NOT change the subject to a doctor, artist, or anything else.
        2. STYLE CONSISTENCY: ${file ? `You MUST strictly follow the visual style, medium (e.g., 2D vector, 3D render, photography), artistic technique, and background characteristics of the reference image.` : "Maintain a consistent artistic style across all prompts."}
        3. VARIATIONS: Create diversity by varying ONLY the following aspects: ${variationsText || "general composition"}.
        4. FORMAT: Return ONLY a JSON array of strings, no other text.`
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: parts
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setResults(data);
    } catch (error) {
      console.error('Prompt generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyAll = () => {
    const text = results.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Prompt Builder</h2>
        <p className="text-gray-500">Create multiple variations of prompts from a concept or image reference.</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Konsep Prompt</label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Contoh: Kucing astronot di planet mars..."
                className="w-full h-32 p-4 text-sm border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Jumlah Prompt</label>
              <div className="flex flex-wrap gap-2">
                {[1, 5, 10, 15].map((num) => (
                  <button
                    key={num}
                    onClick={() => { setCount(num); setIsCustom(false); }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                      !isCustom && count === num 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    {num}
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCustom(true)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                      isCustom 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    Custom
                  </button>
                  {isCustom && (
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                      min="1"
                      max="50"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-3">Variasi yang Diinginkan</label>
              <div className="flex flex-wrap gap-2">
                {variationOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleVariation(opt.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      selectedVariations.includes(opt.id)
                        ? "bg-gray-100 text-black border-black"
                        : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Gambar Referensi (Opsional)</label>
            <div 
              {...getRootProps()} 
              className={cn(
                "aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-4 text-center overflow-hidden relative",
                isDragActive ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400",
                preview && "border-none p-0"
              )}
            >
              <input {...getInputProps()} />
              {preview ? (
                <>
                  <img src={preview} alt="Reference" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs font-medium">Ganti Gambar</p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <Plus size={20} />
                  </div>
                  <p className="text-xs text-gray-400">Klik atau seret gambar referensi</p>
                </div>
              )}
            </div>
            {preview && (
              <button 
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(''); }}
                className="text-xs text-red-500 hover:underline w-full text-center"
              >
                Hapus Referensi
              </button>
            )}
          </div>
        </div>

        <button
          onClick={generatePrompts}
          disabled={(!concept.trim() && !file) || isGenerating}
          className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          Generate Prompts
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Generated Variations ({results.length})</h3>
            <button 
              onClick={copyAll}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                copiedAll ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {copiedAll ? <ClipboardCheck size={16} /> : <Copy size={16} />}
              {copiedAll ? "Copied All!" : "Copy All for Batch Gen"}
            </button>
          </div>
          <div className="space-y-3">
            {results.map((res, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative group">
                <p className="text-sm text-gray-700 leading-relaxed pr-10 italic">"{res}"</p>
                <button 
                  onClick={() => navigator.clipboard.writeText(res)}
                  className="absolute top-4 right-4 p-2 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                  title="Copy single prompt"
                >
                  <Copy size={14} className="text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MetadataGenerator({ customApiKey }: { customApiKey?: string }) {
  const [items, setItems] = useState<MetadataItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const newItems: MetadataItem[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      title: '',
      keywords: '',
      category: '',
      status: 'pending',
      previewUrl: URL.createObjectURL(file)
    }));
    setItems(prev => [...prev, ...newItems]);
    
    // Start processing automatically
    processMetadata(newItems, acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] }
  } as any);

  const processMetadata = async (newItems: MetadataItem[], files: File[]) => {
    setIsProcessing(true);
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const concurrencyLimit = 4; // Process 4 images at a time

    const processItem = async (item: MetadataItem, file: File) => {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing' } : it));

      try {
        const base64 = await fileToBase64(file);
        const categoriesList = `
1. Animals
2. Buildings and Architecture
3. Business
4. Drinks
5. The Environment
6. States of Mind
7. Food
8. Graphic Resources
9. Hobbies and Leisure
10. Industry
11. Landscapes
12. Lifestyle
13. People
14. Plants and Flowers
15. Culture and Religion
16. Science
17. Social Issues
18. Sports
19. Technology
20. Transport
21. Travel`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { data: base64.split(',')[1], mimeType: file.type } },
              { text: `Generate microstock metadata for this image. CRITICAL: Identify the exact style and medium (e.g., 2D vector, 3D render, photography, illustration) and include it in the title and keywords. Also, classify the image into one of these categories (return ONLY the number): ${categoriesList}. Return a JSON object with 'title' (a descriptive title under 100 characters), 'keywords' (a comma-separated string of exactly 47 relevant keywords), and 'category' (the category number as a string). Do not include any other text.` }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                keywords: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["title", "keywords", "category"]
            }
          }
        });

        const data = JSON.parse(response.text || '{}');
        setItems(prev => prev.map(it => it.id === item.id ? { 
          ...it, 
          status: 'completed', 
          title: (data.title || '').trim(), 
          keywords: (data.keywords || '').trim(),
          category: (data.category || '').trim()
        } : it));
      } catch (error) {
        console.error('Metadata error:', error);
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error' } : it));
      }
    };

    // Batch processing
    for (let i = 0; i < newItems.length; i += concurrencyLimit) {
      const batchItems = newItems.slice(i, i + concurrencyLimit);
      const batchFiles = files.slice(i, i + concurrencyLimit);
      await Promise.all(batchItems.map((item, idx) => processItem(item, batchFiles[idx])));
    }

    setIsProcessing(false);
  };

  const exportCSV = () => {
    const data = items.map(item => ({
      Filename: item.filename,
      Title: item.title,
      Keywords: item.keywords,
      Category: item.category
    }));
    
    const csv = Papa.unparse(data, {
      quotes: true,
      delimiter: ","
    });
    
    // Add sep=, for Excel compatibility and BOM for UTF-8
    const finalContent = `sep=,\r\n${csv}`;
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + finalContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `metadata_export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Microstock Metadata</h2>
          <p className="text-gray-500 text-sm">Upload images to generate Titles, Keywords, and Categories for microstock submission.</p>
        </div>
        <div className="flex gap-3">
          {items.length > 0 && (
            <button 
              onClick={() => setItems([])}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={exportCSV}
            disabled={items.length === 0 || isProcessing}
            className="px-6 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div 
        {...getRootProps()} 
        className={cn(
          "bg-white border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer",
          isDragActive ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
            <Plus size={32} />
          </div>
          <div>
            <p className="font-medium text-lg">Drop images here to start processing</p>
            <p className="text-sm text-gray-400">Supports batch upload of multiple images</p>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-24">Preview</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Filename</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Keywords (47)</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-24">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{item.filename}</p>
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'processing' ? (
                        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
                      ) : (
                        <p className="text-sm text-gray-600 line-clamp-2">{item.title || '-'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'processing' ? (
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-gray-100 animate-pulse rounded" />
                          <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{item.keywords || '-'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'processing' ? (
                        <div className="h-4 w-12 bg-gray-100 animate-pulse rounded" />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{item.category || '-'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'processing' && <Loader2 className="animate-spin text-gray-400" size={18} />}
                      {item.status === 'completed' && <CheckCircle2 className="text-green-500" size={18} />}
                      {item.status === 'error' && <AlertCircle className="text-red-500" size={18} />}
                      {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-200" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Settings({ apiKey, setApiKey }: { apiKey: string, setApiKey: (val: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
            <Key size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">API Configuration</h2>
            <p className="text-gray-400 text-sm">Set up your Gemini API key for deployment</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Gemini API Key</label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key here..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all pr-12"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Key size={18} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold mb-1">Security Warning</p>
              <p className="opacity-80">Never share your API key with anyone. If you are using this on a public computer, make sure to clear your browser data after use.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              onClick={() => {
                localStorage.removeItem('gemini_api_key');
                setApiKey('');
              }}
              className="text-sm text-red-500 hover:underline font-medium"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Utils ---

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
