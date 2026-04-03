import { Layers, Image as ImageIcon, X, CheckCircle2 } from "lucide-react";
import { cn } from "../utils/cn";

export function Workspace({
  activeProject,
  generateHDR,
  handleFileSelect,
  handleDrop,
  handleDrag,
  handleRemoveImage,
  fileInputRef,
  dragActive
}: any) {
  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

      {!activeProject ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
            <Layers className="w-10 h-10 text-slate-700" />
          </div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            No Project Selected
          </h2>
          <p className="text-sm">
            Create a new project or select one from the sidebar to begin.
          </p>
        </div>
      ) : (
        <>
          {/* HEADER */}
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

          {/* MAIN LAYOUT */}
          <div className="flex-1 flex overflow-hidden px-6 py-4 gap-6">

            {/* LEFT SIDE */}
            <div className="w-[45%] overflow-y-auto pr-4 space-y-6">

              {/* UPLOAD SECTION */}
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

                {/* DROPZONE */}
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

                {/* IMAGE GRID */}
                {activeProject.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {activeProject.images.map((img: any) => (
                      <div
                        key={img.id}
                        className="relative aspect-square rounded-lg overflow-hidden bg-slate-800"
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />

                        {img.uploadStatus === "uploading" && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white">
                            {img.uploadProgress}%
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

              {/* GENERATE BUTTON */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => generateHDR(activeProject)}
                  disabled={
                    activeProject.images.length < 2 ||
                    activeProject.images.some((img: any) => img.uploadStatus !== "uploaded") ||
                    activeProject.status === "processing"
                    }
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  {activeProject.status === "processing"
                    ? "Processing..."
                    : activeProject.status === "finalizing"
                    ? "Preparing..."
                    : "Generate HDR"}
                </button>
              </div>

              {/* PROGRESS */}
              {(activeProject.status === "processing" ||
                activeProject.status === "finalizing") && !activeProject.result && (
                <div className="bg-slate-900 p-4 rounded-lg">
                  <div className="text-xs mb-2">
                    {activeProject.progress}%
                  </div>
                  <div className="h-2 bg-slate-800 rounded">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${activeProject.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDE (RESULT) */}
            <div className="w-[55%] min-w-[520px] overflow-hidden flex flex-col relative">

              {/* PROCESSING STATE */}
              {(activeProject.status === "processing" ||
                activeProject.status === "finalizing") && !activeProject.result && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm">
                    {activeProject.status === "processing"
                      ? "Processing HDR..."
                      : "Preparing result..."}
                  </p>
                </div>
              )}

              {/* RESULT */}
              {activeProject.status === "completed" && activeProject.result && (
                  <div className="space-y-4">
                    <h3 className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Output Result
                    </h3>

                    <div className="grid grid-cols-2 gap-4">

                      {/* FINAL */}
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                        <div className="aspect-[4/3] flex items-center justify-center">
                          <img
                            src={activeProject.result.url}
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                          Final
                        </div>
                      </div>

                      {/* BLEND */}
                      {activeProject.result.blendUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                          <div className="aspect-[4/3] flex items-center justify-center">
                            <img
                              src={activeProject.result.blendUrl}
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
                    {/* <a
                      href={activeProject.result.downloadUrl}
                      download
                      className="block text-center text-sm text-indigo-400 hover:text-white"
                    >
                      Download High-Res
                    </a> */}
                  </div>
                )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}