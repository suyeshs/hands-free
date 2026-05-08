import { useEffect, useState } from 'react';
import {
  subscribeUpdater,
  installPendingUpdate,
  dismissUpdate,
  type UpdateState,
} from '../lib/updater';

const initial: UpdateState = {
  status: 'idle',
  update: null,
  version: null,
  currentVersion: null,
  error: null,
  progress: 0,
};

export function UpdateBanner() {
  const [s, setS] = useState<UpdateState>(initial);

  useEffect(() => subscribeUpdater(setS), []);

  if (s.status !== 'downloading' && s.status !== 'ready') return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[9999] w-80 rounded-lg bg-slate-900 p-4 text-white shadow-2xl ring-1 ring-white/10"
    >
      {s.status === 'downloading' && (
        <>
          <p className="text-sm font-medium">Downloading update v{s.version}…</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-700">
            <div
              className="h-full bg-emerald-400 transition-[width] duration-200"
              style={{ width: `${s.progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">{s.progress}%</p>
        </>
      )}

      {s.status === 'ready' && (
        <>
          <p className="text-sm font-medium">Update ready (v{s.version})</p>
          <p className="mt-1 text-xs text-slate-300">
            Install now to restart with the latest version.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => installPendingUpdate()}
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium hover:bg-emerald-600"
            >
              Install &amp; Restart
            </button>
            <button
              onClick={() => dismissUpdate()}
              className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-600"
            >
              Later
            </button>
          </div>
        </>
      )}
    </div>
  );
}
