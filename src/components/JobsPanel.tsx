
type ServerJob = {
  status: "processing" | "completed" | "error";
  progress: number;
  project_id?: string;
  result?: string;
};
type JobsPanelProps = {
  serverJobs: Record<string, ServerJob>;
  serverStatus: "online" | "offline";
  lastUpdated: number | null;
  jobStartTimes: Record<string, number>;
  existingJobId: string;
  setExistingJobId: (v: string) => void;
  openJob: (id: string) => void;
  openCompletedJob: (id: string) => void;
  formatDuration: (start: number) => string;
};

export function JobsPanel({
  serverJobs,
  serverStatus,
  lastUpdated,
  jobStartTimes,
  existingJobId,
  setExistingJobId,
  openJob,
  openCompletedJob,
  formatDuration
}: JobsPanelProps) {
  return (
    <div className="mb-6 px-2">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Jobs Queue
      </h2>

      {lastUpdated && (
        <div className="text-[10px] text-slate-500 mb-2">
          Updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago
        </div>
      )}

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
          className="px-2 py-1 bg-indigo-600 text-xs rounded"
        >
          Load
        </button>
      </div>

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
          (Object.entries(serverJobs) as [string, ServerJob][])
            .sort((a, b) => b[1].progress - a[1].progress)
            .map(([jobId, job]) => (
              <div
                key={jobId}
                onClick={() =>
                  job.status === "completed"
                    ? openCompletedJob(jobId)
                    : openJob(jobId)
                }
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-mono">{jobId.slice(0, 10)}</span>
                  <span>{job.status}</span>
                </div>

                <div className="h-1 bg-slate-700 rounded mt-1">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}