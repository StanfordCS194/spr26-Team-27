"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MdCheckCircle,
  MdErrorOutline,
  MdHourglassEmpty,
  MdUploadFile,
} from "react-icons/md";

type MaterialStatus = "pending" | "parsing" | "ready" | "failed";
type Kind = "slide_deck" | "note" | "reading";

interface Material {
  id: string;
  title: string;
  kind: Kind;
  status: MaterialStatus;
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  uploadedAt: string;
}

const KIND_LABEL: Record<Kind, string> = {
  slide_deck: "Slides",
  note: "Note",
  reading: "Reading",
};

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.html";

export function MaterialsPanel({
  courseSlug,
  sessionId,
}: {
  courseSlug: string;
  sessionId?: string;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [kind, setKind] = useState<Kind>("reading");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams({ courseSlug });
    if (sessionId) qs.set("sessionId", sessionId);
    const res = await fetch(`/api/materials?${qs.toString()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { materials: Material[] };
    setMaterials(data.materials ?? []);
  }, [courseSlug, sessionId]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Poll while anything is still parsing so the row flips to ready/failed
  // without a manual reload.
  useEffect(() => {
    const pending = materials.some(
      (m) => m.status === "parsing" || m.status === "pending",
    );
    if (!pending) return;
    const t = setTimeout(() => void refresh(), 3000);
    return () => clearTimeout(t);
  }, [materials, refresh]);

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("courseSlug", courseSlug);
      if (sessionId) fd.append("sessionId", sessionId);
      fd.append("kind", kind);
      if (title.trim()) fd.append("title", title.trim());
      fd.append("file", file);
      const res = await fetch("/api/materials", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
      void refresh();
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader
        title="Course materials"
        right={<span>Parsed &amp; embedded for RAG</span>}
      />
      <CardBody className="gap-5 p-5">
        {/* Uploader */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-xl border border-dashed p-5 transition ${
            dragging
              ? "border-primary-accent bg-primary-tint"
              : "border-divider"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-secondary hover:text-primary flex w-full flex-col items-center gap-2 text-center text-sm"
          >
            <MdUploadFile className="text-primary-accent h-7 w-7" />
            {file ? (
              <span className="text-primary font-medium">{file.name}</span>
            ) : (
              <span>
                Drop a file or{" "}
                <span className="text-primary-accent-dark">browse</span>
                <br />
                <span className="text-xs">PDF, DOCX, PPTX, TXT, MD, HTML</span>
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file ? file.name : "Title (optional)"}
              className="focus:outline-primary-accent border-divider bg-primary-bg/40 text-primary flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="border-divider bg-primary-bg/40 text-primary rounded-lg border px-3 py-2 text-sm"
            >
              <option value="reading">Reading</option>
              <option value="slide_deck">Slides</option>
              <option value="note">Note</option>
            </select>
            <button
              type="button"
              onClick={() => void upload()}
              disabled={!file || uploading}
              className="bg-primary-accent hover:bg-primary-accent-dark rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
          {error && (
            <p className="pt-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* List */}
        {materials.length === 0 ? (
          <p className="text-secondary py-4 text-center text-sm">
            No materials yet. Upload slides or readings to ground answers in
            them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {materials.map((m) => (
              <MaterialRow key={m.id} material={m} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function MaterialRow({ material: m }: { material: Material }) {
  return (
    <li className="border-divider flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-primary truncate text-sm font-medium">{m.title}</p>
        <p className="text-secondary text-xs">
          {KIND_LABEL[m.kind]}
          {m.status === "ready" && (
            <>
              {" · "}
              {m.chunkCount} chunk{m.chunkCount === 1 ? "" : "s"}
              {m.pageCount ? ` · ${m.pageCount} pages` : ""}
            </>
          )}
        </p>
      </div>
      <StatusBadge status={m.status} error={m.error} />
    </li>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: MaterialStatus;
  error: string | null;
}) {
  if (status === "ready") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-700">
        <MdCheckCircle className="h-4 w-4" /> Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600"
        title={error ?? undefined}
      >
        <MdErrorOutline className="h-4 w-4" /> Failed
      </span>
    );
  }
  return (
    <span className="text-secondary inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <MdHourglassEmpty className="h-4 w-4 animate-pulse" />
      {status === "parsing" ? "Parsing…" : "Pending"}
    </span>
  );
}
