import { useState } from 'react';

import { Wordmark } from '@/components/Wordmark';

const EXAMPLE_PROMPTS = [
  'a todo app',
  'a habit tracker',
  'a landing page',
  'a dashboard for my DataSpace records',
];

interface LandingScreenProps {
  /** Called when the user submits their first prompt to create a project. */
  onCreate: (prompt: string) => void;
}

/**
 * Landing / new-project screen — mirrors the Lovable model: a centered,
 * oversized prompt box with example chips below and minimal chrome.
 */
export function LandingScreen({ onCreate }: LandingScreenProps) {
  const [prompt, setPrompt] = useState('');

  const submit = () => {
    const trimmed = prompt.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <div className="bg-canvas flex min-h-full flex-col">
      {/* Minimal top chrome */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Wordmark />
        <button
          type="button"
          className="bg-surface-2 text-ink-soft grid h-8 w-8 place-items-center rounded-full text-sm font-medium"
          aria-label="Account menu"
        >
          N
        </button>
      </header>

      {/* Centered hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24">
        <div className="w-full max-w-2xl">
          <h1 className="text-ink text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to build?
          </h1>
          <p className="text-ink-soft mt-3 text-center text-[15px]">
            Describe an app and Context Space builds it live, powered by your agent.
          </p>

          {/* Oversized prompt box */}
          <div className="border-border-subtle bg-canvas focus-within:border-brand-300 focus-within:ring-brand-50 mt-8 rounded-2xl border p-2 shadow-sm focus-within:ring-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              placeholder="e.g. A kanban board with drag-and-drop columns…"
              className="text-ink placeholder:text-ink-muted block w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-ink-muted text-xs">⌘↵ to create</span>
              <button
                type="button"
                onClick={submit}
                disabled={!prompt.trim()}
                className="bg-brand-600 enabled:hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>

          {/* Example prompt chips */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="border-border-subtle bg-surface text-ink-soft hover:border-brand-300 hover:text-ink rounded-full border px-3.5 py-1.5 text-sm transition"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
