export type ProjectType = 'Exterior' | 'Interior' | 'Mixed';

export interface RawImage {
  id: string;
  file?: File;
  storedName?: string;
  fileId?: string;
  previewUrl: string;
  name: string;
  uploadProgress: number;
  uploadStatus: "idle" | "uploading" | "uploaded" | "error";
}

export interface HDRResult {
  url: string;
  downloadUrl: string;
  blendUrl?: string;
  timestamp?: number;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  images: RawImage[];
  result: HDRResult | null;
  status: 'idle' | 'processing' | 'finalizing' | 'completed' | 'error';
  progress: number;
  logs: string[];
  jobId?: string;
  serverProjectId?: string;
}