"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function SecurePDFViewer({ url, watermark }) {
  const viewerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const overlayRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlights, setHighlights] = useState([]);

  // ---------------- PDF RENDER ----------------
  useEffect(() => {
    let cancelled = false;

    const renderPdf = async () => {
      setLoading(true);
      const pdf = await pdfjsLib.getDocument(url).promise;
      if (cancelled) return;

      const container = canvasContainerRef.current;
      container.innerHTML = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 24px";

        container.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      setLoading(false);
    };

    renderPdf();
    return () => (cancelled = true);
  }, [url]);

  // ---------------- FULLSCREEN ----------------
  const enterFullscreen = () => viewerRef.current?.requestFullscreen();
  const exitFullscreen = () => document.exitFullscreen();

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---------------- HIGHLIGHT DRAWING ----------------
  let startX = 0;
  let startY = 0;
  let drawing = false;

  const onMouseDown = (e) => {
    drawing = true;
    const rect = overlayRef.current.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  };

  const onMouseUp = (e) => {
    if (!drawing) return;
    drawing = false;

    const rect = overlayRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    setHighlights((prev) => [
      ...prev,
      {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        w: Math.abs(endX - startX),
        h: Math.abs(endY - startY),
      },
    ]);
  };

  return (
    <div
      ref={viewerRef}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-black"
    >
      {/* Toolbar */}
      <div className="z-20 bg-black px-3 py-2 text-right">
        {!isFullscreen ? (
          <button onClick={enterFullscreen} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
            Full Screen
          </button>
        ) : (
          <button onClick={exitFullscreen} className="rounded bg-red-600 px-3 py-1 text-sm text-white">
            Exit Full Screen
          </button>
        )}
      </div>

      {/* PDF AREA */}
      <div className="relative flex-1 overflow-y-auto bg-black">
        {loading && <div className="flex h-full items-center justify-center text-white">Loading PDF…</div>}

        <div ref={canvasContainerRef} className="relative z-10 select-none" />

        {/* Highlight overlay */}
        <div
          ref={overlayRef}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          className="absolute inset-0 z-30 cursor-crosshair"
        >
          {highlights.map((h, i) => (
            <div
              key={i}
              style={{
                left: h.x,
                top: h.y,
                width: h.w,
                height: h.h,
                position: "absolute",
                background: "rgba(255,255,0,0.5)",
              }}
            />
          ))}
        </div>

        {/* Watermark */}
        {!loading && (
          <div className="pointer-events-none fixed inset-0 z-0 flex flex-wrap items-center justify-center gap-32 opacity-10">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="rotate-[-30deg] text-4xl font-bold text-white">
                {watermark}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
