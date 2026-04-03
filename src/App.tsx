import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
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
  PlayCircle,
  Key,
  Sparkles,
  Copy,
  ClipboardCheck,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  Clock,
  LayoutDashboard,
  Search,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from './firebase';

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
  isGenerativeAI: boolean;
  policyAudit?: {
    passed: boolean;
    issues: string[];
  };
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  isApproved: boolean;
  createdAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

const useAuth = () => useContext(AuthContext);

// --- Helpers ---

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

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

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] text-black">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center"
    >
      <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
      <p className="text-sm font-medium tracking-widest uppercase opacity-50">Initializing...</p>
    </motion.div>
  </div>
);

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setHasError(true);
        setErrorInfo(event.error.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    const info = errorInfo ? JSON.parse(errorInfo) : null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">System Error</h2>
          <p className="text-gray-600 mb-4">An error occurred while interacting with the database.</p>
          {info && (
            <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono overflow-auto max-h-48">
              <pre>{JSON.stringify(info, null, 2)}</pre>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Login = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-sm w-full bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-200 text-center"
      >
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Secure Access</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          Please sign in with your Google account to request access to the portal.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-bold hover:border-black hover:bg-gray-50 transition-all active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );
};

const PendingApproval = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-200 text-center"
      >
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Approval</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          Your account has been created successfully. An administrator needs to approve your access before you can enter the portal.
        </p>
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 mb-8">
          <p className="text-xs font-medium text-amber-800">
            Contact <strong>aahdan298@gmail.com</strong> for faster approval.
          </p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign Out
        </button>
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsubscribe;
  }, []);

  const toggleApproval = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isApproved: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h2>
          <p className="text-gray-500 text-sm">Approve or revoke access for registered users.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl w-full md:w-64 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={u.uid}
              className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <img src={u.photoURL} className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-50" alt="" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{u.displayName}</h3>
                    {u.role === 'admin' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-black text-[10px] font-bold uppercase tracking-wider rounded-full border border-gray-200">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-medium">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                  u.isApproved 
                    ? "bg-green-50 text-green-600 border-green-100" 
                    : "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                  {u.isApproved ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {u.isApproved ? 'Approved' : 'Pending'}
                </div>
                
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleApproval(u.uid, u.isApproved)}
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                      u.isApproved 
                        ? "bg-red-50 text-red-500 hover:bg-red-100" 
                        : "bg-black text-white hover:bg-gray-800"
                    )}
                  >
                    {u.isApproved ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Feature Components (Original) ---

function BatchImageGen({ customApiKey }: { customApiKey?: string }) {
  const [promptsText, setPromptsText] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');
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
    const concurrencyLimit = 2;

    const processImage = async (currentImage: GeneratedImage) => {
      setImages(prev => prev.map(img => 
        img.id === currentImage.id ? { ...img, status: 'processing' } : img
      ));

      try {
        let imageUrl = '';
        const isImagen = selectedModel.startsWith('imagen-');

        if (isImagen) {
          const response = await ai.models.generateImages({
            model: selectedModel,
            prompt: currentImage.prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio as any,
            },
          });
          if (response.generatedImages?.[0]?.image?.imageBytes) {
            imageUrl = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
          }
        } else {
          const response = await ai.models.generateContent({
            model: selectedModel,
            contents: {
              parts: [{ text: currentImage.prompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: aspectRatio,
                ...(selectedModel === 'gemini-3.1-flash-image-preview' && { imageSize: "1K" })
              },
            },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
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
        let friendlyMessage = error.message;
        
        if (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('rate limit')) {
          friendlyMessage = "Kuota API habis atau terlalu banyak permintaan. Silakan tunggu 1-2 menit atau coba model lain (seperti Gemini 2.5 Flash).";
        } else if (error.message.toLowerCase().includes('not found') || error.message.includes('404')) {
          friendlyMessage = "Model ini belum tersedia untuk akun/wilayah Anda. Silakan gunakan Gemini 2.5 Flash Image atau Gemini 3.1 Flash Image.";
        } else if (error.message.toLowerCase().includes('safety')) {
          friendlyMessage = "Permintaan ditolak oleh filter keamanan konten AI.";
        }

        setImages(prev => prev.map(img => 
          img.id === currentImage.id ? { ...img, status: 'error', error: friendlyMessage } : img
        ));
      }
    };

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
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="w-full p-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Standard)</option>
                <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (High Quality)</option>
              </select>
            </div>

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
  const [brief, setBrief] = useState('');
  const [count, setCount] = useState<number | string>(5);
  const [selectedModel, setSelectedModel] = useState<'gemini-3-flash-preview' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-3-flash-preview');
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
        ${brief ? `ADDITIONAL BRIEF/INSTRUCTIONS: "${brief}". You MUST strictly follow these instructions in every generated prompt.` : ""}
        
        CRITICAL RULES:
        1. SUBJECT CONSISTENCY: You MUST maintain the EXACT SAME SUBJECT as seen in the reference image or described in the concept.
        2. STYLE CONSISTENCY: Maintain a consistent artistic style across all prompts.
        3. VARIATIONS: Create diversity by varying ONLY the following aspects: ${variationsText || "general composition"}.
        4. FORMAT: Return ONLY a JSON array of strings, no other text.`
      });

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts: parts },
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="w-full p-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
              >
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Reasoning & Complex)</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Balanced & Fast)</option>
                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite (Lite & Efficient)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Konsep Prompt</label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Contoh: Kucing astronot di planet mars..."
                className="w-full h-24 p-4 text-sm border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brief / Instruksi Tambahan (Opsional)</label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Contoh: Tambahkan gaya neon..."
                className="w-full h-24 p-4 text-sm border border-gray-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
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
                <img src={preview} alt="Reference" className="w-full h-full object-cover" />
              ) : (
                <div className="space-y-2">
                  <Plus size={20} className="mx-auto text-gray-400" />
                  <p className="text-xs text-gray-400">Klik atau seret gambar referensi</p>
                </div>
              )}
            </div>
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
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Generated Variations ({results.length})</h3>
            <button onClick={copyAll} className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
              {copiedAll ? "Copied!" : "Copy All"}
            </button>
          </div>
          <div className="space-y-3">
            {results.map((res, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-700 leading-relaxed italic">"{res}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function AdobeStockHub({ customApiKey }: { customApiKey?: string }) {
  const [items, setItems] = useState<MetadataItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3-flash-preview' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-3-flash-preview');
  const [globalGenerativeAI, setGlobalGenerativeAI] = useState(true);
  const [vectorMode, setVectorMode] = useState(false);

  const processAdobeMetadata = useCallback(async (newItems: MetadataItem[], files: File[]) => {
    setIsProcessing(true);
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    const processItem = async (item: MetadataItem, file: File) => {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing' } : it));
      
      let attempts = 0;
      const maxRetries = 2;
      
      while (attempts <= maxRetries) {
        try {
          const base64 = await fileToBase64(file);
          const adobeCategories = `1: Animals, 2: Buildings, 3: Business, 4: Drinks, 5: Environment, 6: States of Mind, 7: Food, 8: Graphic Resources, 9: Hobbies, 10: Industry, 11: Landscapes, 12: Lifestyle, 13: People, 14: Plants, 15: Culture, 16: Science, 17: Social Issues, 18: Sports, 19: Technology, 20: Transport, 21: Travel`;

          const response = await ai.models.generateContent({
            model: selectedModel,
            contents: {
              parts: [
                { inlineData: { data: base64.split(',')[1], mimeType: file.type } },
                { text: `You are an Adobe Stock Metadata Expert. Analyze this image and provide:
                1. Title: Descriptive, no keywords, max 70 chars.
                2. Keywords: Exactly 49 keywords. CRITICAL: The first 10 must be the most relevant for search ranking.
                3. Category: Choose the best ID from: ${adobeCategories}.
                
                Return JSON: {
                  "title": "...",
                  "keywords": "...",
                  "category": "..."
                }` }
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
            title: data.title, 
            keywords: data.keywords,
            category: data.category
          } : it));
          return; // Success
        } catch (error) {
          attempts++;
          if (attempts > maxRetries) {
            setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error' } : it));
          } else {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    };

    // Parallel processing with concurrency limit
    const concurrencyLimit = 3;
    const queue = [...newItems.map((item, index) => ({ item, file: files[index] }))];
    
    const processQueue = async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
          await processItem(task.item, task.file);
        }
      }
    };

    const workers = Array(Math.min(concurrencyLimit, newItems.length)).fill(null).map(() => processQueue());
    await Promise.all(workers);
    setIsProcessing(false);
  }, [customApiKey, selectedModel]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const newItems: MetadataItem[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      title: '',
      keywords: '',
      category: '',
      status: 'pending',
      previewUrl: URL.createObjectURL(file),
      isGenerativeAI: globalGenerativeAI
    }));
    setItems(prev => [...prev, ...newItems]);
    processAdobeMetadata(newItems, acceptedFiles);
  }, [globalGenerativeAI, processAdobeMetadata]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] }
  } as any);

  const downloadAdobeCSV = () => {
    const data = items.filter(it => it.status === 'completed').map(it => {
      let finalFilename = it.filename;
      if (vectorMode) {
        const lastDotIndex = it.filename.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex !== -1 ? it.filename.substring(0, lastDotIndex) : it.filename;
        finalFilename = `${nameWithoutExt}_vector.ai`;
      }

      return {
        'Filename': finalFilename,
        'Title': it.title,
        'Keywords': it.keywords,
        'Category': it.category,
        'Releases': '',
        'Generative AI': it.isGenerativeAI ? 'Yes' : 'No'
      };
    });
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `adobe-stock-upload-${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 w-full space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck size={18} /> Adobe Stock Settings
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Optimization Model</label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all"
              >
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (High Accuracy)</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Lite (Speed)</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
              <span className="text-sm font-medium">Generative AI Label</span>
              <button 
                onClick={() => setGlobalGenerativeAI(!globalGenerativeAI)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  globalGenerativeAI ? "bg-black" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  globalGenerativeAI ? "left-7" : "left-1"
                )} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Vector Mode (.ai)</span>
                <span className="text-[10px] text-gray-400">PNG → _vector.ai</span>
              </div>
              <button 
                onClick={() => setVectorMode(!vectorMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  vectorMode ? "bg-blue-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  vectorMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        <div {...getRootProps()} className={cn(
          "flex-[2] bg-white border-2 border-dashed rounded-[2.5rem] p-12 text-center transition-all cursor-pointer group",
          isDragActive ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"
        )}>
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <FileSpreadsheet size={32} className="text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Adobe Stock Hub</h3>
              <p className="text-sm text-gray-400">Drop images here to generate Adobe-optimized metadata.</p>
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Batch Processing Queue ({items.length})</h3>
            <button 
              onClick={downloadAdobeCSV}
              disabled={!items.some(it => it.status === 'completed')}
              className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-2xl text-sm font-bold disabled:bg-gray-200 transition-all hover:shadow-lg active:scale-95"
            >
              <Download size={16} /> Export Adobe CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {items.map(item => (
              <motion.div 
                layout
                key={item.id} 
                className="bg-white p-4 rounded-3xl border border-gray-200 flex flex-col md:flex-row gap-6 items-start md:items-center"
              >
                <div className="relative">
                  <img src={item.previewUrl} className="w-24 h-24 rounded-2xl object-cover border border-gray-100" alt="" />
                  {item.status === 'processing' && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                      <Loader2 className="animate-spin text-black" size={24} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate">{item.filename}</p>
                  </div>
                  <p className="text-xs text-gray-500 font-medium line-clamp-1">
                    {item.title || (item.status === 'processing' ? 'Analyzing image...' : 'Pending...')}
                  </p>
                  {item.keywords && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.keywords.split(',').slice(0, 5).map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] rounded-md border border-gray-100">
                          {kw.trim()}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-300">+{item.keywords.split(',').length - 5} more</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Settings({ apiKey, setApiKey }: { apiKey: string, setApiKey: (val: string) => void }) {
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
      <h2 className="text-xl font-bold mb-4">API Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Enter your custom Gemini API key to bypass default limits.</p>
      <div className="space-y-4">
        <input 
          type="password" 
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter Gemini API Key"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
        />
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          <ExternalLink size={12} /> Get your API key here
        </a>
        
        <div className="pt-4 mt-2 border-t border-gray-100">
          <a 
            href="https://drive.google.com/file/d/1gwFxZemZM1VFJHxjI91ggblqGeDyjLMh/view?usp=drive_link" 
            target="_blank" 
            rel="noreferrer" 
            className="group flex items-center gap-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-300 transition-all"
          >
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200 group-hover:scale-110 transition-transform">
              <PlayCircle size={28} fill="currentColor" fillOpacity={0.2} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-red-800">Tutorial Cara Mendapatkan API Key</span>
              <span className="text-[11px] text-red-600 font-medium">Klik untuk melihat panduan video (Google Drive)</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'batch' | 'promptGen' | 'adobeHub' | 'settings' | 'admin'>('batch');
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');

  useEffect(() => {
    if (customApiKey) {
      localStorage.setItem('gemini_api_key', customApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }, [customApiKey]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
            setLoading(false);
          } else {
            const isAdmin = firebaseUser.email === 'aahdan298@gmail.com';
            const newProfile = {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: isAdmin ? 'admin' : 'user',
              isApproved: isAdmin,
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(userDocRef, newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
            }
          }
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (profile && !profile.isApproved) return <PendingApproval />;

  const isAdmin = profile?.role === 'admin';

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
        <div className="min-h-screen bg-[#F5F5F5] text-black font-sans selection:bg-black selection:text-white">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-semibold tracking-tight leading-none">Microstock AI</h1>
                    <span className="text-[9px] font-bold text-gray-400 mt-1 tracking-[0.2em]">Ahdan | CreativeTech</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <button 
                      onClick={() => setActiveTab('admin')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                        activeTab === 'admin' ? "bg-black text-white" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      <Users size={14} />
                      Admin
                    </button>
                  )}
                  <button 
                    onClick={() => signOut(auth)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
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
                    active={activeTab === 'adobeHub'} 
                    onClick={() => setActiveTab('adobeHub')} 
                    icon={FileSpreadsheet} 
                    label="Adobe Stock Hub" 
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
            <AnimatePresence mode="wait">
              {activeTab === 'admin' ? (
                <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AdminDashboard />
                </motion.div>
              ) : (
                <div className="space-y-8">
                  <div className={cn(activeTab !== 'batch' && "hidden")}>
                    <BatchImageGen customApiKey={customApiKey} />
                  </div>
                  <div className={cn(activeTab !== 'promptGen' && "hidden")}>
                    <PromptBuilder customApiKey={customApiKey} />
                  </div>
                  <div className={cn(activeTab !== 'adobeHub' && "hidden")}>
                    <AdobeStockHub customApiKey={customApiKey} />
                  </div>
                  <div className={cn(activeTab !== 'settings' && "hidden")}>
                    <Settings apiKey={customApiKey} setApiKey={setCustomApiKey} />
                  </div>
                </div>
              )}
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200 mt-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm">
              <p>© 2026 Microstock AI Tools. Secure Access Enabled.</p>
              <div className="flex gap-6">
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hover:text-black transition-colors flex items-center gap-1">
                  Billing Info <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
