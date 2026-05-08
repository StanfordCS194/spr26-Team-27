import { useCallback, useRef, useState } from "react";

export function useAudioCapture(wsUrl: string | null) {
  const [capturing, setCapturing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const start = useCallback(async () => {
    if (!wsUrl) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
    });

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.start(5000);
    setCapturing(true);
  }, [wsUrl]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setCapturing(false);
  }, []);

  return { capturing, start, stop };
}
