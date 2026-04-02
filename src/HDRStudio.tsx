import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderPlus,
  Trash2,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Layers,
  MoreVertical
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Project, ProjectType, RawImage } from "@/types";
import { API_URL } from "./utils/api";
import { useProjects } from "./hooks/useProjects";
import { useHDR } from "./hooks/useHDR";

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


// --- Components ---

export default function HDRStudio() {

  const {
    projects,
    setProjects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    createProject,
    deleteProject
  } = useProjects();
  const { generateHDR } = useHDR(setProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  type ServerJob = {
  status: "processing" | "completed" | "error";
  progress: number;
  project_id?: string;
  result?: string;
};

  const [serverJobs, setServerJobs] = useState<Record<string, ServerJob>>({});
  const [jobStartTimes, setJobStartTimes] = useState<Record<string, number>>({});

  // Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType | ''>('');

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingJobId, setExistingJobId] = useState("");


  const [serverStatus, setServerStatus] = useState<"online" | "offline">("offline");
  const [retrying, setRetrying] = useState(false);

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    setImageLoaded(false);
  }, [activeProjectId]); // 🔥 only when switching project


  useEffect(() => {
    let interval: any;

    const fetchJobs = async () => {
      try {
        const res = await fetch(`${API_URL}/jobs`, {
          headers: { "ngrok-skip-browser-warning": "true" }
        });

        if (!res.ok) throw new Error();

        const data = await res.json();

        setServerJobs(data);
        setServerStatus("online");
        setLastUpdated(Date.now());

        setJobStartTimes(prev => {
          const updated = { ...prev };

          Object.entries(data).forEach(([id, job]: any) => {
            if (!updated[id] && job.status === "processing") {
              updated[id] = Date.now();
            }
          });

          return updated;
        });

      } catch (e) {
  console.error("Jobs fetch failed", e);
  setServerStatus("offline");
  setServerJobs({});
}
    };

    // first call
    fetchJobs();

    // adaptive polling
    interval = setInterval(() => {
      fetchJobs();
    }, serverStatus === "online" ? 2000 : 4000); // slower when offline

    return () => clearInterval(interval);

  }, [serverStatus]);

  const handleRetryConnection = async () => {
    setRetrying(true);

    try {
      const res = await fetch(`${API_URL}/jobs`, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      setServerJobs(data);
      setServerStatus("online");

    } catch (e) {
  console.error("Retry failed", e);
  setServerStatus("offline");
}

    setRetrying(false);
  };

    const loadJobPreviews = async (serverProjectId: string, projectId: string) => {
    try {
      const res = await fetch(`${API_URL}/preview/${serverProjectId}/`, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      if (!res.ok) return;

      const files = await res.json();

      setProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? {
              ...p,
              images: files.map((name: string) => ({
                id: crypto.randomUUID(),
                previewUrl: `${API_URL}/preview/${serverProjectId}/${name}?t=${Date.now()}`,
                name,
                uploadProgress: 100,
                uploadStatus: "uploaded"
              }))
            }
            : p
        )
      );

    } catch (e) {
      console.error("preview load failed");
    }
  };

const openJob = useCallback( (jobId: string) => {
  if (!jobId) return;

  // ✅ use already-fetched jobs (no extra API call)
  const job = serverJobs[jobId];
  if (!job) return;
  const alreadyExists = projects.some(p => p.jobId === jobId);
if (alreadyExists) {
  const existing = projects.find(p => p.jobId === jobId);
  if (existing) setActiveProjectId(existing.id);
  return;
}

  let serverProjectId = job.project_id;

  // 🔥 fallback extraction
  if (!serverProjectId && (job as any).result) {
    const match = (job as any).result.match(/TEMP[\\/](.*?)[\\/]/);
    if (match) {
      serverProjectId = match[1];
    }
  }

  if (!serverProjectId) {
    console.error("Cannot resolve project_id for job:", jobId);
    return;
  }

  const newProjectId = crypto.randomUUID();

  const newProject: Project = {
    id: newProjectId,
    name: `Job ${jobId.slice(0, 6)}`,
    type: "Exterior",
    images: [],
    result: null,
    status: job.status,
    progress: job.progress,
    logs: [],
    jobId,
    serverProjectId
  };

  // ✅ create project
  setProjects(prev => [...prev, newProject]);
  setActiveProjectId(newProjectId);

  // ✅ load previews
  loadJobPreviews(serverProjectId, newProjectId);

  // ✅ attach HDR pipeline (resume job)
  generateHDR(newProject, jobId);

}, [serverJobs, setProjects, setActiveProjectId, generateHDR, loadJobPreviews]);

const openCompletedJob = useCallback( (jobId: string) => {
  if (!jobId) return;
const alreadyExists = projects.some(p => p.jobId === jobId);
if (alreadyExists) {
  const existing = projects.find(p => p.jobId === jobId);
  if (existing) setActiveProjectId(existing.id);
  return;
}
  const job = serverJobs[jobId];
  if (!job) return;

  let serverProjectId = job.project_id;

  // 🔥 fallback extraction
  if (!serverProjectId && (job as any).result) {
    const match = (job as any).result.match(/TEMP[\\/](.*?)[\\/]/);
    if (match) {
      serverProjectId = match[1];
    }
  }

  if (!serverProjectId) {
    console.error("Cannot resolve project_id for completed job:", jobId);
    return;
  }

  const newProjectId = crypto.randomUUID();

  const previewUrl = `${API_URL}/result_preview/${jobId}`;
  const blendUrl = `${API_URL}/blend_preview/${jobId}`;

  const newProject: Project = {
    id: newProjectId,
    name: `Job ${jobId.slice(0, 6)}`,
    type: "Exterior",
    images: [],
    status: "completed",
    progress: 100,
    logs: [],
    jobId,
    serverProjectId,

    // ✅ instant preview (fast UX)
    result: {
      url: previewUrl,
      downloadUrl: `${API_URL}/result/${jobId}`,
      blendUrl,
      timestamp: Date.now()
    }
  };

  // ✅ add project
  setProjects(prev => [...prev, newProject]);
  setActiveProjectId(newProjectId);

  // ✅ load images
  loadJobPreviews(serverProjectId, newProjectId);

  // ✅ attach HDR system (keeps consistency)
  generateHDR(newProject, jobId);

  // ✅ silently upgrade preview → full image
  preloadResult(jobId);

}, [serverJobs, setProjects, setActiveProjectId, generateHDR, loadJobPreviews]);

  // --- Handlers: Project Management ---
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectType) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      type: newProjectType as ProjectType,
      images: [],
      result: null,
      status: 'idle',
      progress: 0,
      logs: []
    };

    createProject(newProject);
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleDeleteProject = (id: string) => {
  const project = projects.find(p => p.id === id);

  if (project) {
    project.images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    if (project.result && project.jobId) {
      URL.revokeObjectURL(project.result.url);
    }
  }

  deleteProject(id);

  setActiveProjectId(prev => {
    if (prev !== id) return prev;

    const remaining = projects.filter(p => p.id !== id);
    return remaining.length > 0 ? remaining[0].id : null;
  });
};

  // --- Handlers: Image Management ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && activeProjectId) {
      processFiles(Array.from(e.target.files));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // const API_URL = "https://intracardiac-unquestioningly-luciana.ngrok-free.dev";



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


  // --- Render Helpers ---
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'processing': return 'text-amber-400';
      case 'completed': return 'text-emerald-400';
      case 'error': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };




  useEffect(() => {
    const saved = localStorage.getItem("hdr_projects");
    if (!saved) return;

    const parsed = JSON.parse(saved);

    // 🔥 ONLY restore projects WITHOUT jobId
    setProjects(parsed.filter((p: any) => !p.jobId));
  }, []);

  useEffect(() => {
    const clean = projects.filter(p => !p.jobId || serverJobs[p.jobId]);
    localStorage.setItem("hdr_projects", JSON.stringify(clean));
  }, [projects, serverJobs]);;

  useEffect(() => {
    if (serverStatus !== "online") return;

    // 🔥 HARD SYNC: remove ghost projects
    setProjects(prev => {
      const cleaned = prev.filter(p => {
        if (!p.jobId) return true; // keep manual projects
        return serverJobs[p.jobId]; // keep only server jobs
      });

      return cleaned;
    });

  }, [serverJobs, serverStatus]);

  const formatDuration = (start: number) => {
    const s = Math.floor((Date.now() - start) / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;

    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };
  const [imageLoaded, setImageLoaded] = useState(false);


  const preloadResult = async (jobId: string) => {
    try {


      // STEP 1 → preview already shown

      // STEP 2 → load full PNG
      const res = await fetch(`${API_URL}/result/${jobId}`, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const fullUrl = URL.createObjectURL(blob);

      // replace preview with full
      setProjects(prev =>
        prev.map(p =>
          p.jobId === jobId && p.result
            ? { ...p, result: { ...p.result, url: fullUrl } }
            : p
        )
      );

    } catch (e) {
      console.error("preview load failed", e);
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
              Ai HDR Studio
            </h1>
          </div>
          <p className="text-xs text-slate-500 ml-11">AI-Powered Imaging</p>
        </div>

        <div className="flex items-center gap-2 ml-11 mt-1">
          <div
            className={`w-2 h-2 rounded-full ${serverStatus === "online"
              ? "bg-emerald-400"
              : "bg-rose-500 animate-pulse"
              }`}
          />
          <span className="text-[10px] text-slate-500">
            {serverStatus === "online" ? "Server Online" : "Server Offline"}
          </span>

          {serverStatus === "offline" && (
            <button
              onClick={handleRetryConnection}
              disabled={retrying}
              className="ml-2 text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
            >
              {retrying ? "..." : "Retry"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Jobs Panel */}
          <div className="mb-6 px-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Jobs Queue
            </h2>

            {lastUpdated && (
              <div className="text-[10px] text-slate-500 mb-2">
                Updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago
              </div>
            )}

            {/* Manual Load */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Paste job ID..."
                value={existingJobId}
                onChange={(e) => setExistingJobId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
              <button
                onClick={() => {
                  if (!existingJobId.trim()) return;
                  openJob(existingJobId);
                }}
                disabled={!existingJobId}
                className="px-2 py-1 bg-indigo-600 text-xs rounded"
              >
                Load
              </button>
            </div>

            {/* Job List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">

              {serverStatus === "offline" ? (

                <div className="text-xs text-slate-500 text-center py-4">
                  Server unreachable
                </div>

              ) : Object.keys(serverJobs).length === 0 ? (

                <div className="text-xs text-slate-500 text-center py-4">
                  No jobs yet
                </div>

              ) : (

                Object.entries(serverJobs)
                  .sort((a, b) => b[1].progress - a[1].progress)
                  .map(([jobId, job]) => (
                    <div
                      key={jobId}
                      onClick={() => {
                        if (job.status === "completed") {
                          openCompletedJob(jobId);
                        } else {
                          openJob(jobId);
                        }
                      }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition flex flex-col gap-1"
                    >
                      <div className="flex justify-between text-xs items-center">
                        <span className="truncate font-mono">
                          {jobId.slice(0, 10)}
                        </span>

                        <div className="flex items-center gap-2">
                          {job.status === "processing" && jobStartTimes[jobId] && (
                            <span className="text-[10px] text-slate-500">
                              {formatDuration(jobStartTimes[jobId])}
                            </span>
                          )}

                          <span className={
                            job.status === "completed"
                              ? "text-emerald-400"
                              : job.status === "processing"
                                ? "text-amber-400"
                                : "text-rose-400"
                          }>
                            {job.status}
                          </span>
                        </div>
                      </div>

                      <div className="h-1 bg-slate-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  ))

              )}

            </div>
          </div>
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
                <option value="" disabled>
                  Select Scene Type
                </option>
                <option value="Exterior">Exterior</option>
                <option value="Interior">Interior</option>
                <option value="Mixed">Mixed</option>
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
                  disabled={!newProjectName.trim() || !newProjectType}
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {activeProject.type}
                  </span>
                </h2>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Ready
              </div>
            </header>

            {/* 🔥 MAIN SPLIT LAYOUT */}
            <div className="flex-1 flex overflow-hidden px-6 py-4 gap-6">

              {/* ================= LEFT SIDE ================= */}
              <div className="w-[45%] overflow-y-auto pr-4 space-y-6">

                {/* Upload */}
                <section>
                  <div className="flex justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Source Images
                    </h3>
                    <span className="text-xs text-slate-500">
                      {activeProject.images.length} files
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
                      "border-2 border-dashed rounded-xl p-8 cursor-pointer text-center",
                      dragActive
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-slate-700 hover:border-slate-600"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <p className="text-sm text-slate-400">
                      Click or drag images here
                    </p>
                  </div>

                  {/* PREVIEW GRID */}
                  {activeProject.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {activeProject.images.map(img => (
                        <div
                          key={img.id}
                          className="relative aspect-square rounded-lg overflow-hidden bg-slate-800"
                        >
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className="w-full h-full object-cover transition-opacity duration-300"
                            loading="lazy"
                          />

                          {img.uploadStatus === "uploading" && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-xs text-white">
                              Uploading {img.uploadProgress}%
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(img.id);
                            }}
                            className="absolute top-1 right-1 bg-black/50 p-1 rounded"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Generate Button */}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => generateHDR(activeProject)}
                    disabled={activeProject.images.length < 1 || activeProject.status === "processing"}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
                  >
                    {activeProject.status === "processing"
                      ? "Processing..."
                      : activeProject.status === "finalizing"
                        ? "Preparing..."
                        : "Generate HDR"}
                  </button>
                </div>

                {/* Processing */}
                {(activeProject.status === "processing" || activeProject.status === "finalizing") && (
                  <div className="bg-slate-900 p-4 rounded-lg">
                    <div className="text-xs mb-2">{activeProject.progress}%</div>
                    <div className="h-2 bg-slate-800 rounded">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${activeProject.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ================= RIGHT SIDE (RESULT) ================= */}
              <div className="w-[55%] min-w-[520px] overflow-hidden flex flex-col">

                {/* ✅ WAITING STATE */}
                {(activeProject.status === "processing" || activeProject.status === "finalizing") && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4" />
                    <p className="text-sm">
                      {activeProject.status === "processing"
                        ? "Processing HDR..."
                        : "Preparing result..."}
                    </p>
                  </div>
                )}

                {/* ✅ RESULT */}
                {activeProject.status === "completed" && activeProject.result && (
                  <div className="space-y-4">
                    <h3 className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Output Result
                    </h3>

                    <div className="grid grid-cols-2 gap-4">

                      {/* 🔵 FINAL RESULT */}
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                        <div className="aspect-[4/3] flex items-center justify-center">
                          <img
                            src={activeProject.result.url}
                            alt="Final"
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                          />
                        </div>

                        <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                          Final
                        </div>
                      </div>

                      {/* 🔴 BLEND PREVIEW */}
                      {activeProject.result.blendUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                          <div className="aspect-[4/3] flex items-center justify-center">
                            <img
                              src={activeProject.result.blendUrl}
                              alt="Blend"
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          </div>

                          <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                            Blend
                          </div>
                        </div>
                      )}

                    </div>

                    <a
                      href={activeProject.result.downloadUrl}
                      download
                      className="block text-center text-sm text-indigo-400 hover:text-white"
                    >
                      Download High-Res
                    </a>
                  </div>
                )}

              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}