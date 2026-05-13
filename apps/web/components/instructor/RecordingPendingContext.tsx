"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface PendingChunk {
  id: string;
  sequence: number;
  startedAt: number;
}

interface RecordingPendingState {
  pending: PendingChunk[];
  add: (entry: PendingChunk) => void;
  remove: (id: string) => void;
}

const RecordingPendingCtx = createContext<RecordingPendingState | null>(null);

export function RecordingPendingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingChunk[]>([]);
  const add = useCallback(
    (entry: PendingChunk) => setPending((p) => [...p, entry]),
    [],
  );
  const remove = useCallback(
    (id: string) => setPending((p) => p.filter((e) => e.id !== id)),
    [],
  );
  return (
    <RecordingPendingCtx.Provider value={{ pending, add, remove }}>
      {children}
    </RecordingPendingCtx.Provider>
  );
}

export function useRecordingPending(): RecordingPendingState {
  const ctx = useContext(RecordingPendingCtx);
  if (!ctx)
    throw new Error(
      "useRecordingPending must be used inside RecordingPendingProvider",
    );
  return ctx;
}
