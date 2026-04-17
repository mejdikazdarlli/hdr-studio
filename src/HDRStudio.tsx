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
import { Sidebar } from "./components/Sidebar";
import { Workspace } from "./components/Workspace";
import { ResolutionErrorModal } from "./components/ResolutionErrorModal";


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
  const [loaded, setLoaded] = useState(false);
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

  const [resolutionError, setResolutionError] = useState<{
    message: string;
    project: Project | null;
  } | null>(null);

  useEffect(() => {
    setImageLoaded(false);
  }, [activeProjectId]); // 🔥 only when switching project

  // Helper to load images with ngrok header and convert to blob URL
  const loadImageWithHeaders = async (url: string): Promise<string> => {
    const response = await fetch(url, {
      headers: { "ngrok-skip-browser-warning": "true" }
    });

    if (!response.ok) throw new Error("Failed to load image");

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

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

  const handleGenerateHDR = async () => {
    if (!activeProject) return;

    await generateHDR(
      activeProject,
      undefined,
      false,
      (err) => {
        if (err?.type === "RESOLUTION_MISMATCH") {
          setResolutionError({
            message: err.message,
            project: activeProject
          });
        }
      }
    );
  };

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

      // Load all images with headers
      const imagePromises = files.map(async (name: string) => {
        const url = `${API_URL}/preview/${serverProjectId}/${name}`;
        try {
          const blobUrl = await loadImageWithHeaders(url);
          return {
            id: crypto.randomUUID(),
            previewUrl: blobUrl,
            name,
            uploadProgress: 100,
            uploadStatus: "uploaded"
          };
        } catch {
          // Fallback to direct URL
          return {
            id: crypto.randomUUID(),
            previewUrl: `${url}?t=${Date.now()}`,
            name,
            uploadProgress: 100,
            uploadStatus: "uploaded"
          };
        }
      });

      const images = await Promise.all(imagePromises);

      setProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? { ...p, images }
            : p
        )
      );

    } catch (e) {
      console.error("preview load failed", e);
    }
  };

  const openJob = useCallback((jobId: string) => {
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

  const openCompletedJob = useCallback((jobId: string) => {
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
        url: `${API_URL}/result_preview/${jobId}`,
        blendUrl: `${API_URL}/blend_preview/${jobId}`,

        finalAI: `${API_URL}/final_ai/${jobId}`,
        blendAI: `${API_URL}/blend_ai/${jobId}`,

        downloadUrl: `${API_URL}/result/${jobId}`,
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectType) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      type: newProjectType as ProjectType,
      images: [],
      result: null,
      status: "idle",
      progress: 0,
      logs: []
    };

    createProject(newProject);
    setNewProjectName("");
    setIsCreating(false);
  };

  const handleDeleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      project.images.forEach(img => {
        // Revoke ALL preview URLs (blob or direct)
        try {
          URL.revokeObjectURL(img.previewUrl);
        } catch { }
      });
      if (project.result && project.result.url) {
        try {
          URL.revokeObjectURL(project.result.url);
        } catch { }
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
        uploadStatus: "uploading"
      };

      // add to UI first
      setProjects(prev =>
        prev.map(p =>
          p.id === activeProjectId
            ? { ...p, images: [...p.images, newImage] }
            : p
        )
      );

      // 🔥 WAIT for upload before next file
      await uploadSingleImageAsync(file, imageId, activeProjectId);
    }
  };
  const uploadSingleImageAsync = (
    file: File,
    imageId: string,
    projectId: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
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
        if (xhr.status !== 200) {
          reject();
          return;
        }

        const res = JSON.parse(xhr.responseText);
        const serverPreviewUrl = `${API_URL}${res.preview_url}`;

        // Load image with headers and convert to blob URL
        loadImageWithHeaders(serverPreviewUrl)
          .then(blobUrl => {
            setProjects(prev =>
              prev.map(p =>
                p.id === projectId
                  ? {
                    ...p,
                    images: p.images.map(img =>
                      img.id === imageId
                        ? {
                          ...img,
                          previewUrl: blobUrl, // ✅ Use blob URL
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
            resolve();
          })
          .catch(() => {
            // Fallback to direct URL
            setProjects(prev =>
              prev.map(p =>
                p.id === projectId
                  ? {
                    ...p,
                    images: p.images.map(img =>
                      img.id === imageId
                        ? {
                          ...img,
                          previewUrl: serverPreviewUrl,
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
            resolve();
          });
      };;

      xhr.onerror = reject;

      xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
      xhr.send(formData);
    });
  };


  const handleRemoveImage = (imageId: string) => {
    if (!activeProjectId) return;

    setProjects(prev =>
      prev.map(p => {
        if (p.id !== activeProjectId) return p;

        const imageToRemove = p.images.find(img => img.id === imageId);

        // Clean up ALL object URLs (blob: or regular)
        if (imageToRemove?.previewUrl) {
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

    if (saved) {
      const parsed = JSON.parse(saved);
      setProjects(parsed.filter((p: any) => !p.jobId));
    }

    setLoaded(true); // 🔥 IMPORTANT
  }, []);

  useEffect(() => {
    if (serverStatus !== "online") return;

    const clean = projects.filter(p => !p.jobId || serverJobs[p.jobId]);
    localStorage.setItem("hdr_projects", JSON.stringify(clean));
  }, [projects, serverJobs, serverStatus]);


  useEffect(() => {
    if (serverStatus !== "online") return;

    setProjects(prev => {
      const cleaned = prev.filter(p => {
        if (!p.jobId) return true;
        return serverJobs[p.jobId];
      });

      // ✅ avoid useless re-renders
      if (cleaned.length === prev.length) return prev;

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

  useEffect(() => {
    if (projects.length === 0) {
      setActiveProjectId(null);
      return;
    }

    // 🔥 ALWAYS ensure a valid selection
    setActiveProjectId(prev => {
      if (prev && projects.some(p => p.id === prev)) {
        return prev;
      }
      return projects[0].id;
    });
  }, [projects]);

  const handleResizeConfirm = async () => {
    if (!resolutionError?.project) return;

    await generateHDR(
      resolutionError.project,
      resolutionError.project.jobId, // reuse existing job to preserve server state,
      true, // 🔥 force resize
      () => { }
    );

    setResolutionError(null);
  };

  const handleResizeCancel = () => {
    setResolutionError(null);
  };

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
    <div className="flex h-screen bg-slate-950 text-white">
      <Sidebar
        serverJobs={serverJobs}
        serverStatus={serverStatus}
        retrying={retrying}
        handleRetryConnection={handleRetryConnection}
        lastUpdated={lastUpdated}
        jobStartTimes={jobStartTimes}
        existingJobId={existingJobId}
        setExistingJobId={setExistingJobId}
        openJob={openJob}
        openCompletedJob={openCompletedJob}
        projects={projects}
        activeProjectId={activeProjectId}
        setActiveProjectId={setActiveProjectId}
        handleDeleteProject={handleDeleteProject}
        getStatusColor={getStatusColor}
        formatDuration={formatDuration}
        setIsCreating={setIsCreating}

        // 🔥 ADD THESE
        isCreating={isCreating}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectType={newProjectType}
        setNewProjectType={setNewProjectType}
        handleCreateProject={handleCreateProject}
      />
      <Workspace
        activeProject={activeProject}
        generateHDR={handleGenerateHDR}
        handleFileSelect={handleFileSelect}
        handleDrop={handleDrop}
        handleDrag={handleDrag}
        handleRemoveImage={handleRemoveImage}
        fileInputRef={fileInputRef}
        dragActive={dragActive}
      />
      <ResolutionErrorModal
        open={!!resolutionError}
        message={resolutionError?.message || ""}
        onConfirm={handleResizeConfirm}
        onCancel={handleResizeCancel}
      />
    </div>
  );

}