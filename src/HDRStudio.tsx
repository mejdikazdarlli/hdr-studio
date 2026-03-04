import React, { useState, useRef } from 'react';
import { 
  FolderPlus, 
  Trash2, 
  Upload, 
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Layers,
  Zap,
  MoreVertical
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type ProjectType = 'Exterior' | 'Interior';

interface RawImage {
  id: string;
  file?: File;          // only until upload
  storedName?: string;  // server reference
  fileId?: string;
  previewUrl: string;        // what user sees
  name: string;
  uploadProgress: number;    // 0–100
  uploadStatus: "idle" | "uploading" | "uploaded" | "error";
}

interface HDRResult {
  url: string;
  downloadUrl: string;
  timestamp: number;
}

interface Project {
  id: string;
  name: string;
  type: ProjectType;
  images: RawImage[];
  result: HDRResult | null;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  logs: string[];
}

// --- Components ---

export default function HDRStudio() {
  // --- State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType>('Exterior');

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived State ---
  const activeProject = projects.find(p => p.id === activeProjectId);

  // --- Handlers: Project Management ---
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      type: newProjectType,
      images: [],
      result: null,
      status: 'idle',
      progress: 0,
      logs: []
    };

    setProjects([...projects, newProject]);
    setActiveProjectId(newProject.id);
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleDeleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      // Cleanup memory
      project.images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      if (project.result) URL.revokeObjectURL(project.result.url);
    }
    
    const updatedProjects = projects.filter(p => p.id !== id);
    setProjects(updatedProjects);
    if (activeProjectId === id) {
      setActiveProjectId(updatedProjects.length > 0 ? updatedProjects[0].id : null);
    }
  };

  // --- Handlers: Image Management ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && activeProjectId) {
      processFiles(Array.from(e.target.files));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const API_URL = "https://intracardiac-unquestioningly-luciana.ngrok-free.dev";

const processFiles = async (files: File[]) => {
  if (!activeProjectId) return;

  for (const file of files) {
    const imageId = crypto.randomUUID();
    const localPreview = URL.createObjectURL(file);

    const newImage: RawImage = {
      id: imageId,
      file,
      previewUrl: localPreview,
      name: file.name,
      uploadProgress: 0,
      uploadStatus: "uploading" // ALWAYS uploading
    };

    setProjects(prev =>
      prev.map(p =>
        p.id === activeProjectId
          ? { ...p, images: [...p.images, newImage] }
          : p
      )
    );

    // ALWAYS upload (RAW + JPG + PNG)
    uploadSingleImage(file, imageId, activeProjectId);
  }
};
const uploadSingleImage = (
  file: File,
  imageId: string,
  projectId: string
) => {

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/upload/${projectId}`);

  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const percent = Math.round((e.loaded / e.total) * 100);

    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              images: p.images.map(img =>
                img.id === imageId
                  ? { ...img, uploadProgress: percent }
                  : img
              )
            }
          : p
      )
    );
  };

  xhr.onload = () => {
    if (xhr.status !== 200) return;

    const res = JSON.parse(xhr.responseText);

    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              images: p.images.map(img =>
                img.id === imageId
                  ? {
                      ...img,
                      previewUrl: `${API_URL}${res.preview_url}`,
                      storedName: res.stored_name,
                      uploadProgress: 100,
                      uploadStatus: "uploaded"
                    }
                  : img
              )
            }
          : p
      )
    );
  };

  xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
  xhr.send(formData);
};

const handleRemoveImage = (imageId: string) => {
  if (!activeProjectId) return;

  setProjects(prev =>
    prev.map(p => {
      if (p.id !== activeProjectId) return p;

      const imageToRemove = p.images.find(img => img.id === imageId);

      // Clean up blob preview URLs only
      if (imageToRemove && imageToRemove.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      return {
        ...p,
        images: p.images.filter(img => img.id !== imageId)
      };
    })
  );
};

  // --- Drag & Drop Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  // --- AI Processing Simulation ---

const handleGenerateHDR = async () => {
  if (!activeProjectId) return;

  setProjects(prev =>
    prev.map(p =>
      p.id === activeProjectId
        ? { ...p, status: "processing", progress: 0 }
        : p
    )
  );

  const res = await fetch(`${API_URL}/process/${activeProjectId}`, {
  method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true"
      }
    });

  if (!res.ok) {
    const text = await res.text();
    console.error("Process error response:", text);
    return;
  }

  const contentType = res.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    const text = await res.text();
    console.error("Not JSON response:", text);
    return;
  }

  const { job_id } = await res.json();

  const poll = setInterval(async () => {
    const statusRes = await fetch(`${API_URL}/status/${job_id}`, {
      headers: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    if (!statusRes.ok) {
      const text = await statusRes.text();
      console.error("Status error:", text);
      return;
    }

    const data = await statusRes.json();

    setProjects(prev =>
      prev.map(p =>
        p.id === activeProjectId
          ? { ...p, progress: data.progress }
          : p
      )
    );

    if (data.status === "completed") {
      clearInterval(poll);

      const resultRes = await fetch(`${API_URL}/result/${job_id}`, {
        headers: {
          "ngrok-skip-browser-warning": "true"
        }
      });

      if (!resultRes.ok) {
        const text = await resultRes.text();
        console.error("Result error:", text);
        return;
      }

      const blob = await resultRes.blob();
      const url = URL.createObjectURL(blob);

      setProjects(prev =>
        prev.map(p =>
          p.id === activeProjectId
            ? {
                ...p,
                status: "completed",
                result: {
                  url,
                  downloadUrl: url,
                  timestamp: Date.now()
                }
              }
            : p
        )
      );
    }
  }, 800);
};
  // --- Render Helpers ---
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'processing': return 'text-amber-400';
      case 'completed': return 'text-emerald-400';
      case 'error': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 flex overflow-hidden">
      
      {/* --- Sidebar --- */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Studio HDR
            </h1>
          </div>
          <p className="text-xs text-slate-500 ml-11">AI-Powered Imaging</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projects</h2>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
              title="New Project"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {projects.length === 0 && !isCreating && (
            <div className="text-center py-10 px-4 border-2 border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-500 text-sm">No projects yet.</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 font-medium"
              >
                Create your first project
              </button>
            </div>
          )}

          {isCreating && (
            <form onSubmit={handleCreateProject} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-4 animate-in fade-in slide-in-from-top-2">
              <input
                autoFocus
                type="text"
                placeholder="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 mb-2"
              />
              <select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value as ProjectType)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 mb-3"
              >
                <option value="Exterior">Exterior</option>
                <option value="Interior">Interior</option>
              </select>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {projects.map(project => (
            <div 
              key={project.id}
              onClick={() => setActiveProjectId(project.id)}
              className={cn(
                "group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border",
                activeProjectId === project.id 
                  ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                  : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-medium truncate text-sm",
                    activeProjectId === project.id ? "text-white" : "text-slate-300"
                  )}>
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700">
                      {project.type}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {project.images.length} images
                    </span>
                  </div>
                </div>
                {project.status !== 'idle' && (
                  <div className={cn("mt-1", getStatusColor(project.status))}>
                    {project.status === 'processing' && <div className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                    {project.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                )}
              </div>
              
              {/* Delete Button (Hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id);
                }}
                className="absolute right-2 bottom-2 p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-white">
              JD
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">John Doe</p>
              <p className="text-xs text-slate-500">Pro Plan</p>
            </div>
            <button className="text-slate-500 hover:text-white">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* --- Main Workspace --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {!activeProject ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
              <Layers className="w-10 h-10 text-slate-700" />
            </div>
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No Project Selected</h2>
            <p className="text-sm">Create a new project or select one from the sidebar to begin.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-sm z-10">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  {activeProject.name}
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {activeProject.type}
                  </span>
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  System Ready
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Upload Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Source Images
                    </h3>
                    <span className="text-xs text-slate-500">
                      {activeProject.images.length} files selected
                    </span>
                  </div>

                  {/* Dropzone */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative border-2 border-dashed rounded-2xl p-10 transition-all duration-200 cursor-pointer group",
                      dragActive 
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-800/30"
                    )}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      accept=".jpg,.jpeg,.png,.dng,.cr2,.nef,.arw,.raf,.rw2,image/*"
                      className="hidden" 
                      onChange={handleFileSelect}
                    />
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Upload className={cn("w-6 h-6", dragActive ? "text-indigo-400" : "text-slate-500")} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-300">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supports RAW, JPG, PNG (Max 50MB each)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Image Grid */}
                  {activeProject.images.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {activeProject.images.map((img) => (
                        <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          />
                          {img.uploadStatus === "uploading" && (
                            <>
                              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs">
                                <span className="mb-1">Uploading</span>
                                <span>{img.uploadProgress}%</span>
                              </div>

                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-200"
                                  style={{ width: `${img.uploadProgress}%` }}
                                />
                              </div>
                            </>
                          )}

                          {img.uploadStatus === "error" && (
                            <div className="absolute inset-0 bg-rose-600/60 flex items-center justify-center text-white text-xs">
                              Upload Failed
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <p className="text-xs text-white truncate font-medium">{img.name}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(img.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Action Section */}
                <section className="flex flex-col items-center py-8">
                  <button
                    onClick={handleGenerateHDR}
                    disabled={activeProject.images.length < 1 || activeProject.status === 'processing'}
                    className={cn(
                      "relative group overflow-hidden rounded-full px-8 py-4 font-bold text-lg shadow-2xl transition-all duration-300",
                      activeProject.images.length < 1 
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-105 hover:shadow-indigo-500/25"
                    )}
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      {activeProject.status === 'processing' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 fill-current" />
                          Generate HDR
                        </>
                      )}
                    </div>
                    {/* Button Glow Effect */}
                    {activeProject.images.length >= 1 && activeProject.status !== 'processing' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity" />
                    )}
                  </button>
                  {activeProject.images.length < 1 && (
                    <p className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Select at least 1 image to merge
                    </p>
                  )}
                </section>

                {/* Processing Status / Logs */}
                {activeProject.status === 'processing' && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-indigo-400">AI Processing Pipeline</span>
                      <span className="text-sm font-mono text-slate-400">{activeProject.progress}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-500 ease-out"
                        style={{ width: `${activeProject.progress}%` }}
                      />
                    </div>
                    {/* Logs */}
                    <div className="h-32 overflow-y-auto font-mono text-xs text-slate-400 space-y-1 bg-black/20 p-3 rounded-lg border border-slate-800/50">
                      {activeProject.logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                      <div className="animate-pulse">_</div>
                    </div>
                  </div>
                )}

                {/* Results Section */}
                {activeProject.status === 'completed' && activeProject.result && (
                  <section className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Output Result
                      </h3>
                      <a 
                        href={activeProject.result.downloadUrl}
                        download={`${activeProject.name}_HDR.jpg`}
                        className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download High-Res
                      </a>
                    </div>
                    
                    <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
                      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-black/70">
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                      <img 
                        src={activeProject.result.url} 
                        alt="HDR Result"
                        className="w-full h-auto max-h-[600px] object-contain bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs font-medium text-emerald-400">
                            32-bit Float
                          </div>
                          <div className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-300">
                            Tone Mapped
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}