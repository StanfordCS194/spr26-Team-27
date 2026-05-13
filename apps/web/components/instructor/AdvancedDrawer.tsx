"use client";

import { TryRagPanel } from "@/components/instructor/TryRagPanel";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdRefresh, MdUploadFile } from "react-icons/md";

export function AdvancedDrawer({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loadingSample, setLoadingSample] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // The SessionBar that renders us uses `backdrop-blur`, which per spec
  // establishes a containing block for fixed-positioned descendants — so
  // our `position: fixed` would resolve against the SessionBar instead of
  // the viewport. Portal into document.body to escape that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const loadSample = useCallback(() => {
    void (async () => {
      setLoadingSample(true);
      setMsg(null);
      try {
        const res = await fetch("/api/sessions/load-sample", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json()) as {
          inserted?: number;
          embedded?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `load-sample ${res.status}`);
        setMsg(
          `Loaded ${json.inserted ?? 0} lines · embedded ${json.embedded ?? 0}`,
        );
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "load-sample failed");
      } finally {
        setLoadingSample(false);
        window.setTimeout(() => setMsg(null), 5000);
      }
    })();
  }, [sessionId]);

  const reset = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reset session? This clears all transcript lines for this lecture.",
      )
    ) {
      return;
    }
    void (async () => {
      setResetting(true);
      setMsg(null);
      try {
        const res = await fetch("/api/sessions/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json()) as {
          deleted?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `reset ${res.status}`);
        setMsg(`Reset · ${json.deleted ?? 0} cleared`);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "reset failed");
      } finally {
        setResetting(false);
        window.setTimeout(() => setMsg(null), 5000);
      }
    })();
  }, [sessionId]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Advanced settings"
        className={`bg-primary-bg border-divider fixed top-0 right-0 z-40 flex h-full w-96 flex-col border-l shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="border-divider flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-primary text-sm font-semibold">
              Advanced settings
            </h2>
            <p className="text-secondary text-xs">
              Developer tools for this lecture session.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-secondary hover:text-primary hover:bg-stone-100 rounded-md p-1 transition"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="border-divider border-b p-5">
          <p className="text-secondary mb-3 text-[11px] font-semibold tracking-widest uppercase">
            Demo data
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={loadSample}
              disabled={loadingSample}
              className="border-divider bg-primary-contr text-primary hover:bg-stone-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            >
              <MdUploadFile className="h-4 w-4" />
              {loadingSample ? "Loading sample…" : "Load sample transcript"}
            </button>
            <button
              onClick={reset}
              disabled={resetting}
              className="border-divider bg-primary-contr text-primary hover:bg-stone-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            >
              <MdRefresh className="h-4 w-4" />
              {resetting ? "Resetting…" : "Reset this lecture"}
            </button>
            {msg && (
              <p className="text-secondary pt-1 text-xs">{msg}</p>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-5">
          <p className="text-secondary mb-3 text-[11px] font-semibold tracking-widest uppercase">
            RAG preview
          </p>
          <div className="flex min-h-0 flex-1">
            <TryRagPanel sessionId={sessionId} />
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
