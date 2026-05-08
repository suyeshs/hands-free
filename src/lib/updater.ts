import { check, type Update } from '@tauri-apps/plugin-updater';

export type UpdaterStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'error' | 'dismissed';

export interface UpdateState {
  status: UpdaterStatus;
  update: Update | null;
  version: string | null;
  currentVersion: string | null;
  error: string | null;
  progress: number; // 0-100
}

const initialState: UpdateState = {
  status: 'idle',
  update: null,
  version: null,
  currentVersion: null,
  error: null,
  progress: 0,
};

let state: UpdateState = { ...initialState };
let listeners: Array<(s: UpdateState) => void> = [];

function emit() {
  listeners.forEach((l) => l(state));
}

function setState(partial: Partial<UpdateState>) {
  state = { ...state, ...partial };
  emit();
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdater(listener: (s: UpdateState) => void): () => void {
  listeners.push(listener);
  listener(state);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function checkForUpdate(): Promise<void> {
  if (!isTauri()) return;
  if (state.status === 'checking' || state.status === 'downloading') return;

  setState({ status: 'checking', error: null });

  try {
    const update = await check();
    if (!update) {
      setState({ status: 'idle' });
      return;
    }

    setState({
      status: 'downloading',
      update,
      version: update.version,
      currentVersion: update.currentVersion,
      progress: 0,
    });

    let downloaded = 0;
    let total = 0;

    await update.download((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        if (total > 0) {
          setState({ progress: Math.round((downloaded / total) * 100) });
        }
      }
    });

    setState({ status: 'ready', progress: 100 });
  } catch (error) {
    console.warn('[Updater] check/download failed:', error);
    setState({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function installPendingUpdate(): Promise<void> {
  if (!state.update || state.status !== 'ready') return;
  try {
    await state.update.install();
    // The app process exits here on Windows/macOS — installer takes over.
  } catch (error) {
    console.error('[Updater] Install failed:', error);
    setState({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function dismissUpdate(): void {
  setState({ status: 'dismissed' });
}
