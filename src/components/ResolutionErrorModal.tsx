import React from "react";

type Props = {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ResolutionErrorModal: React.FC<Props> = ({
  open,
  message,
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-[420px]">
        
        <h2 className="text-lg font-semibold mb-2 text-white">
          Resolution mismatch
        </h2>

        <p className="text-sm text-slate-400 mb-4 whitespace-pre-line">
          {message}
        </p>

        <p className="text-xs text-slate-500 mb-6">
          Your images don’t have the same resolution.  
          Do you want to automatically resize them?
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-md py-2"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md py-2"
          >
            Resize & Continue
          </button>
        </div>
      </div>
    </div>
  );
};