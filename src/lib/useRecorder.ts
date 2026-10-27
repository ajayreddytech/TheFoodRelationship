"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedAudio { mimeType: "audio/wav"; data: string }

const MAX_SECONDS = 60;
const TARGET_RATE = 16000;

/** Decode any browser-recorded blob to 16 kHz mono PCM WAV (accepted by Gemini on every browser). */
async function blobToWavBase64(blob: Blob): Promise<string> {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
    const off = new OfflineAudioContext(1, frames, TARGET_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, TARGET_RATE, true); v.setUint32(28, TARGET_RATE * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } finally {
    ctx.close();
  }
}

/**
 * Tap-to-record microphone (like ChatGPT / Gemini). Audio is sent to Gemini for transcription,
 * which works in every browser, unlike the Web Speech API.
 */
export function useRecorder(onAudio: (a: RecordedAudio) => void) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const cb = useRef(onAudio);
  cb.current = onAudio;

  useEffect(() => {
    setSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    return () => cleanup.current();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser. Please type instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotFoundError" ? "No microphone found. Please type instead." : "Microphone permission denied. Allow mic access in your browser or type instead.");
      return;
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Live input level for the UI.
    let raf = 0;
    let actx: AudioContext | null = null;
    try {
      actx = new AudioContext();
      const an = actx.createAnalyser();
      an.fftSize = 256;
      actx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
        setLevel(Math.min(1, peak / 64));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* level meter is optional */ }

    const started = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS && r.state === "recording") r.stop();
    }, 250);

    const stopAll = () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      actx?.close().catch(() => {});
      setLevel(0);
    };
    cleanup.current = () => { if (r.state === "recording") { r.onstop = null; r.stop(); } stopAll(); };

    r.onstop = async () => {
      stopAll();
      setRecording(false);
      if (Date.now() - started < 600 || !chunks.length) { setError("That was too short. Tap the mic and speak for a moment."); return; }
      setProcessing(true);
      try {
        const data = await blobToWavBase64(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
        cb.current({ mimeType: "audio/wav", data });
      } catch {
        setError("Couldn't read the recording. Please try again or type instead.");
      } finally {
        setProcessing(false);
      }
    };
    rec.current = r;
    setSeconds(0);
    r.start(250);
    setRecording(true);
  }, []);

  const stop = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);
  const toggle = useCallback(() => (rec.current?.state === "recording" ? stop() : start()), [start, stop]);
  return { supported, recording, processing, seconds, level, error, start, stop, toggle, clearError: () => setError(null) };
}
