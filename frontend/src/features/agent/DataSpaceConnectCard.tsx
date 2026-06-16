import { useState } from 'react';

interface DataSpaceCredentials {
  client_id: string;
  client_secret: string;
  company_code: string;
  plant_code: string;
}

interface DataSpaceConnectCardProps {
  status: string;
  onSubmit: (creds: DataSpaceCredentials) => void;
}

const FIELDS: { key: keyof DataSpaceCredentials; label: string; placeholder: string }[] = [
  { key: 'client_id', label: 'Client ID', placeholder: 'e.g. you@company.com' },
  { key: 'client_secret', label: 'Client secret', placeholder: 'client secret' },
  { key: 'company_code', label: 'Company code', placeholder: 'e.g. UATOCC' },
  { key: 'plant_code', label: 'Plant code', placeholder: 'e.g. OCCUAT' },
];

export function DataSpaceConnectCard({ status, onSubmit }: DataSpaceConnectCardProps) {
  const [creds, setCreds] = useState<DataSpaceCredentials>({
    client_id: '',
    client_secret: '',
    company_code: '',
    plant_code: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const isExecuting = status === 'executing' || status === 'inProgress';
  const canSubmit = FIELDS.every((f) => creds[f.key].trim().length > 0);

  const submit = () => {
    setSubmitted(true);
    onSubmit(creds);
  };

  return (
    <div
      className="my-2 rounded-xl border p-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
        >
          Connect
        </span>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          DataSpace
        </h3>
      </div>

      {isExecuting && !submitted ? (
        <>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Paste your DataSpace connection details. These stay in this chat session only.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label
                  className="mb-1 block text-[11px] font-medium"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {f.label}
                </label>
                <input
                  type={f.key === 'client_secret' ? 'password' : 'text'}
                  value={creds[f.key]}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
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
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Connect
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--emerald)' }} />
          DataSpace connected
        </div>
      )}
    </div>
  );
}
