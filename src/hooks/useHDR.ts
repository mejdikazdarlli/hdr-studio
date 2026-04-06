import { useRef, useEffect } from "react";
import { API_URL } from "../utils/api";
import { Project } from "../types";
import { Dispatch, SetStateAction } from "react";

export function useHDR(setProjects: Dispatch<SetStateAction<Project[]>>) {
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const resultCacheRef = useRef<Record<string, string>>({});
  const blendCacheRef = useRef<Record<string, string>>({});

  // 🔥 cleanup on unmount
  useEffect(() => {
    return () => {
      // 🔥 cleanup ALL active polls
      Object.values(pollRef.current).forEach(clearInterval);
      pollRef.current = {};
    };
  }, []);

  const generateHDR = async (
    project: Project | null,
    existingJobId?: string,
    forceResize = false,
    onError?: (err: any) => void
  ) => {
    if (!project || !project.type) return;

    const projectId = project.id;
    const oldProject = project;

    if (oldProject?.result?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(oldProject.result.url);
    }
    // 🔥 reset state
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
            ...p,
            status: "processing",
            progress: 0,
            result: null,
            jobId: undefined // 🔥 important: detach old job immediately
          }
          : p
      )
    );

    try {
      let job_id: string | undefined = existingJobId;

      // 🔒 validate existing job
      if (existingJobId && typeof existingJobId !== "string") {
        console.error("Invalid existingJobId:", existingJobId);
        return;
      }

      // 🆕 create job if needed
      if (!job_id) {
        const res = await fetch(`${API_URL}/process/${projectId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify({
            scene_type: project.type,
            force_resize: forceResize
          })
        });

        if (!res.ok) {
          const error = await res.json();

          if (error.detail?.includes("resolution")) {
            throw {
              type: "RESOLUTION_MISMATCH",
              message: error.detail
            };
          }

          throw new Error(error.detail || "Processing failed");
        }

        const data = await res.json();

        if (!data.job_id) {
          console.error("Missing job_id from API");
          throw new Error("Invalid job_id");
        }

        job_id = data.job_id;
      }

      // 🔒 FINAL GUARD
      if (!job_id) {
        console.error("job_id is undefined — aborting");
        return;
      }

      const safeJobId = job_id;

      // attach job
      setProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? { ...p, jobId: safeJobId }
            : p
        )
      );

      // 🔥 stop only THIS project's poll
      if (pollRef.current[projectId]) {
        clearInterval(pollRef.current[projectId]);
        delete pollRef.current[projectId];
      }

      // 🔥 clear cache for this job
      delete resultCacheRef.current[safeJobId];
      delete blendCacheRef.current[safeJobId];

      // 🔁 polling
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/status/${safeJobId}`, {
            headers: { "ngrok-skip-browser-warning": "true" }
          });

          if (!statusRes.ok) {
            console.error("Status fetch failed");
            return;
          }

          const data = await statusRes.json();

          // progress (safe update)
          setProjects(prev =>
            prev.map(p =>
              p.id === projectId && p.jobId === safeJobId
                ? { ...p, progress: data.progress }
                : p
            )
          );

          // ✅ COMPLETED
          if (data.status === "completed") {
            clearInterval(poll);
            delete pollRef.current[projectId];

            // set finalizing
            setProjects(prev =>
              prev.map(p =>
                p.id === projectId && p.jobId === safeJobId
                  ? { ...p, status: "finalizing" }
                  : p
              )
            );

            let url: string;

            // use cache
            if (resultCacheRef.current[safeJobId]) {
              url = resultCacheRef.current[safeJobId];
            } else {
              const resultRes = await fetch(`${API_URL}/result/${safeJobId}`, {
                headers: { "ngrok-skip-browser-warning": "true" }
              });

              if (!resultRes.ok) {
                console.error("Result fetch failed");
                return;
              }

              const blob = await resultRes.blob();
              url = URL.createObjectURL(blob);

              resultCacheRef.current[safeJobId] = url;
            }

            // set completed
            setProjects(prev =>
              prev.map(p => {
                // 🔥 HARD GUARD: ignore stale async updates
                if (p.id !== projectId || p.jobId !== safeJobId) return p;

                return {
                  ...p,
                  status: "completed",
                  result: {
                    // ORIGINALS
                    url: `${API_URL}/result_preview/${safeJobId}`,
                    blendUrl: `${API_URL}/blend_preview/${safeJobId}`,

                    // AI RESULTS
                    finalAI: `${API_URL}/final_ai/${safeJobId}`,
                    blendAI: `${API_URL}/blend_ai/${safeJobId}`,

                    downloadUrl: `${API_URL}/result/${safeJobId}`,
                    timestamp: Date.now()
                  }
                };
              })
            );
          }

          // ❌ ERROR
          if (data.status === "error") {
            clearInterval(poll);
            delete pollRef.current[projectId];

            if (data.error_type === "RESOLUTION_MISMATCH") {
              onError?.({
                type: "RESOLUTION_MISMATCH",
                message: data.message
              });
            }

            setProjects(prev =>
              prev.map(p =>
                p.id === projectId && p.jobId === safeJobId
                  ? { ...p, status: "error" }
                  : p
              )
            );

            return;
          }

        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 800);

      pollRef.current[projectId] = poll;

    } catch (err) {
      console.error("HDR generation failed:", err);

      setProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? { ...p, status: "error" }
            : p
        )
      );

      throw err; // 🔥 THIS is REQUIRED
    }
  };

  return { generateHDR };
}