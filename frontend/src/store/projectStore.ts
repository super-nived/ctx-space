/**
 * Central project state: virtual file system, edit history, build status, and
 * the live preview error. The agent's frontend tools (writeFile/deleteFile)
 * mutate this store; the UI renders from it.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  DeviceMode,
  OutputTab,
  PreviewError,
  ProjectEdit,
  ProjectFile,
  ProjectStatus,
} from '@/types/project';

interface ProjectState {
  projectName: string;
  status: ProjectStatus;
  files: Record<string, ProjectFile>;
  edits: ProjectEdit[];
  activeFilePath: string | null;
  outputTab: OutputTab;
  device: DeviceMode;
  previewError: PreviewError | null;

  // --- actions ---
  setProjectName: (name: string) => void;
  setStatus: (status: ProjectStatus) => void;
  writeFile: (path: string, contents: string, opts?: { isAutoFix?: boolean }) => void;
  deleteFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setOutputTab: (tab: OutputTab) => void;
  setDevice: (device: DeviceMode) => void;
  setPreviewError: (error: PreviewError | null) => void;
  restoreToEdit: (index: number) => void;
  resetProject: () => void;
}

/** Build the file map as it existed immediately after the given edit index. */
function filesAtEdit(edits: ProjectEdit[], index: number): Record<string, ProjectFile> {
  const files: Record<string, ProjectFile> = {};
  for (const edit of edits) {
    if (edit.index > index) break;
    if (edit.after === null) {
      delete files[edit.path];
    } else {
      files[edit.path] = { path: edit.path, contents: edit.after };
    }
  }
  return files;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectName: 'Untitled',
      status: 'idle',
      files: {},
      edits: [],
      activeFilePath: null,
      outputTab: 'preview',
      device: 'desktop',
      previewError: null,

      setProjectName: (projectName) => set({ projectName }),
      setStatus: (status) => set({ status }),

      writeFile: (path, contents, opts) =>
        set((state) => {
          const existing = state.files[path];
          const edit: ProjectEdit = {
            index: state.edits.length + 1,
            summary: existing ? `Edit ${path}` : `Create ${path}`,
            path,
            before: existing?.contents ?? null,
            after: contents,
            isAutoFix: opts?.isAutoFix ?? false,
            createdAt: Date.now(),
          };
          return {
            files: { ...state.files, [path]: { path, contents } },
            edits: [...state.edits, edit],
            activeFilePath: state.activeFilePath ?? path,
          };
        }),

      deleteFile: (path) =>
        set((state) => {
          if (!state.files[path]) return state;
          const { [path]: removed, ...rest } = state.files;
          const edit: ProjectEdit = {
            index: state.edits.length + 1,
            summary: `Delete ${path}`,
            path,
            before: removed.contents,
            after: null,
            isAutoFix: false,
            createdAt: Date.now(),
          };
          return { files: rest, edits: [...state.edits, edit] };
        }),

      setActiveFile: (activeFilePath) => set({ activeFilePath }),
      setOutputTab: (outputTab) => set({ outputTab }),
      setDevice: (device) => set({ device }),
      setPreviewError: (previewError) => set({ previewError }),

      restoreToEdit: (index) => {
        const { edits } = get();
        set({ files: filesAtEdit(edits, index) });
      },

      resetProject: () =>
        set({
          projectName: 'Untitled',
          status: 'idle',
          files: {},
          edits: [],
          activeFilePath: null,
          previewError: null,
        }),
    }),
    {
      name: 'ctx-space-project',
      // Persist only durable project data — not transient UI/preview state.
      partialize: (state) => ({
        projectName: state.projectName,
        files: state.files,
        edits: state.edits,
        status: state.status === 'planning' ? 'idle' : state.status,
      }),
    },
  ),
);

// Dev-only: expose the store for E2E tests (Playwright drives the preview without
// spending LLM tokens). Tree-shaken out of production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __ctxStore?: typeof useProjectStore }).__ctxStore =
    useProjectStore;
}
