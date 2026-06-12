import { useState } from 'react';

interface PlanCardProps {
  appName: string;
  features: string[];
  files: string[];
  status: string;
  onApprove: () => void;
  onRequestChanges: (note: string) => void;
}

export function PlanCard({ appName, features, files, status, onApprove, onRequestChanges }: PlanCardProps) {
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const isExecuting = status === 'executing' || status === 'inProgress';

  return (
    <div
      className="my-2 rounded-xl border p-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
        >
          Plan
        </span>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {appName || 'New app'}
        </h3>
      </div>

      {/* Features */}
      {features.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {features.map((f, i) => (
            <li key={i} className="flex gap-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              <span className="mt-0.5" style={{ color: 'var(--indigo)' }}>·</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="mt-3">
          <div
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-muted)' }}
          >
            Files
          </div>
          <div className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <code
                key={file}
                className="rounded px-1.5 py-0.5 font-mono text-[11px]"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', borderColor: 'var(--border)' }}
              >
                {file}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {isExecuting && (
        <div className="mt-4">
          {changing ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="What should change about the plan?"
                className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink)',
                  caretColor: '#6366f1',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRequestChanges(note.trim() || 'Please revise the plan.')}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-500"
                >
                  Send changes
                </button>
                <button
                  type="button"
                  onClick={() => setChanging(false)}
                  className="rounded-lg px-3 py-1.5 text-[13px] transition hover:bg-white/5"
                  style={{ color: 'var(--ink-soft)' }}
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
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-500 active:scale-95"
              >
                Approve & build
              </button>
              <button
                type="button"
                onClick={() => setChanging(true)}
                className="rounded-lg border px-4 py-1.5 text-[13px] transition hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
              >
                Request changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Approved state */}
      {!isExecuting && (
        <div className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--emerald)' }} />
          Plan approved
        </div>
      )}
    </div>
  );
}
