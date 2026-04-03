import { Layers, FolderPlus, MoreVertical } from "lucide-react";
import { JobsPanel } from "./JobsPanel";
import { ProjectList } from "./ProjectList";

export function Sidebar(props: any) {
    return (
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">

            {/* HEADER */}
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

            {/* SERVER STATUS */}
            <div className="flex items-center gap-2 ml-11 mt-2">
                <div
                    className={`w-2 h-2 rounded-full ${props.serverStatus === "online"
                            ? "bg-emerald-400"
                            : "bg-rose-500 animate-pulse"
                        }`}
                />
                <span className="text-[10px] text-slate-500">
                    {props.serverStatus === "online"
                        ? "Server Online"
                        : "Server Offline"}
                </span>

                {props.serverStatus === "offline" && (
                    <button
                        onClick={props.handleRetryConnection}
                        disabled={props.retrying}
                        className="ml-2 text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                    >
                        {props.retrying ? "..." : "Retry"}
                    </button>
                )}
            </div>

            {/* MAIN SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* JOBS */}
                <JobsPanel {...props} />

                
                <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Projects
                    </h2>

                    <button
                        onClick={() => props.setIsCreating?.(true)}
                        className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>
                </div>

                {/* PROJECT HEADER */}
                {props.isCreating && (
                    <form
                        onSubmit={props.handleCreateProject}
                        className="bg-slate-800/40 backdrop-blur-sm p-3 rounded-xl border border-slate-700/60 mb-3"
                    >
                        <input
                            autoFocus
                            type="text"
                            placeholder="Project Name"
                            value={props.newProjectName}
                            onChange={(e) => props.setNewProjectName(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />

                        <select
                            value={props.newProjectType}
                            onChange={(e) => props.setNewProjectType(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="" disabled>Select Scene Type</option>
                            <option value="Exterior">Exterior</option>
                            <option value="Interior">Interior</option>
                            <option value="Mixed">Mixed</option>
                        </select>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => props.setIsCreating(false)}
                                className="flex-1 text-xs text-slate-400 hover:text-white transition"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={!props.newProjectName || !props.newProjectType}
                                className="flex-1 text-xs bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-md py-1.5 transition disabled:opacity-40"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                )}

                {/* EMPTY STATE */}
                {props.projects.length === 0 && !props.isCreating && (
                    <div className="text-center py-10 px-4 border-2 border-dashed border-slate-800 rounded-xl">
                        <p className="text-slate-500 text-sm">No projects yet.</p>
                        <button
                            onClick={() => props.setIsCreating?.(true)}
                            className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 font-medium"
                        >
                            Create your first project
                        </button>
                    </div>
                )}

                {/* PROJECT LIST */}
                <ProjectList {...props} />

            </div>

            {/* FOOTER */}
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
    );
}