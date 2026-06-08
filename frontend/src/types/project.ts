/** Core domain types shared across Context Space features. */

/** A single file in the generated project's virtual file system. */
export interface ProjectFile {
  path: string;
  contents: string;
}

/** One recorded change to the project (drives the Edit #N cards + History). */
export interface ProjectEdit {
  /** 1-based sequence number shown as "Edit #N". */
  index: number;
  /** One-line human summary of the change. */
  summary: string;
  path: string;
  /** File contents before this edit (null if newly created). */
  before: string | null;
  /** File contents after this edit (null if deleted). */
  after: string | null;
  /** True when the edit was applied by the self-healing loop, not the user. */
  isAutoFix: boolean;
  createdAt: number;
}

/** A captured error from the live preview, fed back into the agent. */
export interface PreviewError {
  /** Stable signature for dedupe: message + file + line. */
  signature: string;
  message: string;
  file?: string;
  line?: number;
  source: 'build' | 'compile' | 'runtime';
}

/** High-level lifecycle of a project (see build-plan.md §4b state machine). */
export type ProjectStatus =
  | 'idle'
  | 'planning'
  | 'building'
  | 'ready'
  | 'self_healing'
  | 'error';

/** Output panel tabs. */
export type OutputTab = 'preview' | 'code';

/** Preview device width. */
export type DeviceMode = 'desktop' | 'mobile';
