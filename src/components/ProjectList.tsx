import { Trash2, CheckCircle2 } from "lucide-react";

export function ProjectList({
  projects,
  activeProjectId,
  setActiveProjectId,
  handleDeleteProject,
  getStatusColor
}: any) {
  return (
    <>
      {projects.map((project : { id: string; name: string; images: any[]; status: string }) => (
        <div
          key={project.id}
          onClick={() => setActiveProjectId(project.id)}
          className={`group p-3 flex justify-between rounded-xl cursor-pointer ${
            activeProjectId === project.id
              ? "bg-slate-800 border border-indigo-500"
              : "hover:bg-slate-800"
          }`}
        >
          <div className="flex justify-between">
            <div>
              <h3 className="text-sm">{project.name}</h3>
              <span className="text-xs text-slate-500">
                {project.images.length} images
              </span>
            </div>

            {project.status === "completed" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteProject(project.id);
            }}
            className="opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
          </button>
        </div>
      ))}
    </>
  );
}