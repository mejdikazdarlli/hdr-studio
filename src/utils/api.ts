export const API_URL = "https://morbidity-violin-dish.ngrok-free.dev";

export const fetchJobs = async () => {
  const res = await fetch(`${API_URL}/jobs`, {
    headers: { "ngrok-skip-browser-warning": "true" }
  });

  if (!res.ok) throw new Error("Jobs fetch failed");
  return res.json();
};