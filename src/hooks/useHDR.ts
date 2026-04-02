import { useRef, useEffect } from "react";
import { API_URL } from "../utils/api";
import { Project } from "../types";
import { Dispatch, SetStateAction } from "react";

export function useHDR(setProjects: Dispatch<SetStateAction<Project[]>>) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultCacheRef = useRef<Record<string, string>>({});
  const blendCacheRef = useRef<Record<string, string>>({});

  // 🔥 cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const generateHDR = async (
    project: Project | null,
    existingJobId?: string
  ) => {
    if (!project || !project.type) return;

    const projectId = project.id;

    // 🔥 reset state
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? { ...p, status: "processing", progress: 0, result: null }
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
          body: JSON.stringify({ scene_type: project.type })
        });

        if (!res.ok) {
          console.error("Process request failed");
          throw new Error();
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

      // 🔥 clear previous polling
      if (pollRef.current) {
        clearInterval(pollRef.current);
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
            pollRef.current = null;

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
              prev.map(p =>
                p.id === projectId && p.jobId === safeJobId
                  ? {
                      ...p,
                      status: "completed",
                      result: {
                        url,
                        downloadUrl: url,
                        blendUrl: `${API_URL}/blend_preview/${safeJobId}`,
                        timestamp: Date.now()
                      }
                    }
                  : p
              )
            );
          }

          // ❌ ERROR
          if (data.status === "error") {
            clearInterval(poll);

            setProjects(prev =>
              prev.map(p =>
                p.id === projectId && p.jobId === safeJobId
                  ? { ...p, status: "error" }
                  : p
              )
            );
          }

        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 800);

      pollRef.current = poll;

    } catch (err) {
      console.error("HDR generation failed:", err);

      setProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? { ...p, status: "error" }
            : p
        )
      );
    }
  };

  return { generateHDR };
}