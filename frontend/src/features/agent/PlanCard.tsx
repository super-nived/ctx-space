import { useState } from 'react';

interface PlanCardProps {
  appName: string;
  features: string[];
  files: string[];
  status: string;
  onApprove: () => void;
  onRequestChanges: (note: string) => void;
}

/**
 * Plan-approval card (the human-in-the-loop pause before code generation).
 * Shows app name, features, and the file list; the user approves or requests
 * changes. Once answered, it collapses to a static summary.
 */
export function PlanCard({
  appName,
  features,
  files,
  status,
  onApprove,
  onRequestChanges,
}: PlanCardProps) {
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const isExecuting = status === 'executing' || status === 'inProgress';

  return (
    <div className="border-border-subtle bg-canvas my-2 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="bg-brand-50 text-brand-700 rounded-md px-2 py-0.5 text-[11px] font-medium">
          Plan
        </span>
        <h3 className="text-ink text-sm font-semibold">{appName || 'New app'}</h3>
      </div>

      {features.length > 0 && (
        <ul className="mt-3 space-y-1">
          {features.map((f, i) => (
            <li key={i} className="text-ink-soft flex gap-2 text-[13px]">
              <span className="text-brand-500">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-3">
          <div className="text-ink-muted mb-1 text-[11px] font-medium tracking-wide uppercase">
            Files
          </div>
          <div className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <code
                key={file}
                className="bg-surface-2 text-ink-soft rounded px-1.5 py-0.5 text-[12px]"
              >
                {file}
              </code>
            ))}
          </div>
        </div>
      )}

      {isExecuting && (
        <div className="mt-4">
          {changing ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="What should change about the plan?"
                className="border-border-subtle bg-surface focus:border-brand-300 w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRequestChanges(note.trim() || 'Please revise the plan.')}
                  className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white"
                >
                  Send changes
                </button>
                <button
                  type="button"
                  onClick={() => setChanging(false)}
                  className="text-ink-soft hover:bg-surface-2 rounded-lg px-3 py-1.5 text-[13px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onApprove}
                className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-1.5 text-[13px] font-medium text-white"
              >
                Approve & build
              </button>
              <button
                type="button"
                onClick={() => setChanging(true)}
                className="border-border-subtle text-ink-soft hover:bg-surface-2 rounded-lg border px-4 py-1.5 text-[13px]"
              >
                Request changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
