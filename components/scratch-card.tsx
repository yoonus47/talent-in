"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors --gradient-brand (app/globals.css) — canvas fillStyle needs a
// real CanvasGradient object, it can't consume a CSS gradient string
// directly, so the stops are duplicated here. Same reasoning as that
// variable's own comment: this app's one "special moment" gradient, and a
// scratch reveal is exactly that kind of moment.
const GRADIENT_STOPS: [number, string][] = [
  [0, "#881337"],
  [0.35, "#e11d48"],
  [0.7, "#7c3aed"],
  [1, "#070a8f"],
];

// Erase this fraction of the surface and the rest auto-clears — asking
// for every last pixel is tedious, not satisfying, and corners are
// genuinely hard to reach with a fingertip.
const AUTO_COMPLETE_THRESHOLD = 0.45;
const BRUSH_RADIUS = 22;
// getImageData over the whole canvas on every pointermove would be real
// per-frame jank — only sample every Nth move, and only every 4th pixel
// within that sample (alpha-channel stride) — plenty accurate for "about
// how much is left", which is all this needs to be.
const SAMPLE_EVERY_N_MOVES = 4;
const PIXEL_STRIDE = 4 * 4;

// A fixed radial burst, not randomized — a designed pattern reads as more
// deliberate than jitter, and there's nothing here that needs per-reveal
// variation. [emoji, angle in degrees, distance in px, delay in ms].
const SPARKLES: [string, number, number, number][] = [
  ["✨", -100, 46, 0],
  ["🎉", -40, 54, 40],
  ["✨", 20, 42, 20],
  ["⭐", 80, 50, 60],
  ["✨", 140, 44, 30],
  ["💫", -160, 48, 50],
];
const SPARKLE_BURST_MS = 900;

/**
 * A generic scratch-to-reveal surface: draws a gradient "foil" over
 * `children` (already in the DOM underneath, normal layout — the canvas
 * is just an absolutely-positioned overlay matching its measured size) and
 * erases it via pointer drag, exactly like a physical scratch card.
 * Crossing AUTO_COMPLETE_THRESHOLD fades the remaining foil away and
 * calls `onReveal()` — this component owns none of the "what happens
 * after" logic (persistence, celebration animation), just the mechanic.
 */
export function ScratchCard({
  revealed,
  onReveal,
  label = "Scratch to reveal",
  children,
}: {
  revealed: boolean;
  onReveal: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const moveCountRef = useRef(0);
  const doneRef = useRef(false);
  const [sparkling, setSparkling] = useState(false);

  useEffect(() => {
    if (revealed) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    doneRef.current = false;

    function paintSurface() {
      const { width, height } = sizeRef.current;
      const gradient = ctx!.createLinearGradient(0, 0, width, height);
      for (const [offset, color] of GRADIENT_STOPS) gradient.addColorStop(offset, color);
      ctx!.globalCompositeOperation = "source-over";
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, width, height);

      ctx!.fillStyle = "rgba(255,255,255,0.92)";
      ctx!.font = "600 13px system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(`✨ ${label} ✨`, width / 2, height / 2);
    }

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSurface();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    function pointFromEvent(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function erase(x: number, y: number) {
      ctx!.globalCompositeOperation = "destination-out";
      const last = lastPointRef.current;
      if (last) {
        ctx!.lineWidth = BRUSH_RADIUS * 2;
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(last.x, last.y);
        ctx!.lineTo(x, y);
        ctx!.stroke();
      }
      ctx!.beginPath();
      ctx!.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
      ctx!.fill();
      lastPointRef.current = { x, y };
    }

    function scratchedFraction() {
      const { width, height } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      const data = ctx!.getImageData(0, 0, width * dpr, height * dpr).data;
      let cleared = 0;
      let sampled = 0;
      for (let i = 3; i < data.length; i += PIXEL_STRIDE) {
        sampled++;
        if (data[i] === 0) cleared++;
      }
      return sampled ? cleared / sampled : 0;
    }

    function complete() {
      if (doneRef.current) return;
      doneRef.current = true;
      canvas!.style.transition = "opacity 400ms ease-out";
      canvas!.style.opacity = "0";
      setSparkling(true);
      setTimeout(() => setSparkling(false), SPARKLE_BURST_MS);
      onReveal();
    }

    let dragging = false;

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      lastPointRef.current = null;
      canvas!.setPointerCapture(e.pointerId);
      const { x, y } = pointFromEvent(e);
      erase(x, y);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging || doneRef.current) return;
      const { x, y } = pointFromEvent(e);
      erase(x, y);
      moveCountRef.current++;
      if (moveCountRef.current % SAMPLE_EVERY_N_MOVES === 0 && scratchedFraction() >= AUTO_COMPLETE_THRESHOLD) {
        complete();
      }
    }

    function onPointerUp() {
      dragging = false;
      lastPointRef.current = null;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [revealed, onReveal, label]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {!revealed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none rounded-[inherit]"
          style={{ cursor: "pointer" }}
        />
      )}
      {sparkling && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          {SPARKLES.map(([emoji, angle, distance, delay], i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 animate-scratch-sparkle text-lg"
              style={
                {
                  "--sparkle-x": `${Math.cos((angle * Math.PI) / 180) * distance}px`,
                  "--sparkle-y": `${Math.sin((angle * Math.PI) / 180) * distance}px`,
                  animationDelay: `${delay}ms`,
                } as React.CSSProperties
              }
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
