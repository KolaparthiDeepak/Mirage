"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./intro-splash.module.css";

const SEEN_KEY = "mirage-intro-seen";
// Timeline (ms): 0-500 fade-in + drift, 500-2200 ease to target,
// 2200-2800 settle + glow pulse, 2800-3200 hold, then 400ms overlay fade.
const TOTAL_MS = 3200;

// Fallbacks are the Obsidian token values (app/tokens.css); the real theme
// colour is read from the CSS custom property at runtime.
function readVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function IntroSplash() {
  const [show, setShow] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage disabled — treat as unseen */
    }
    if (seen) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage disabled — intro still plays once this mount */
    }
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia — assume motion is fine */
    }
    if (reduced) return;
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));

    const accent = readVar("--accent", "#A78BFA");
    const accent2 = readVar("--info", "#6EA8FE");
    const bg = readVar("--bg", "#0B0C0F");

    // Sample target pixels from a rendered "◆ Mirage" wordmark.
    const targets: Array<[number, number]> = [];
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext("2d");
    if (octx) {
      const fontPx = Math.max(48, Math.min(120, vw * 0.14)) * dpr;
      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.font = `800 ${fontPx}px Inter, system-ui, sans-serif`;
      octx.fillText("◆ Mirage", canvas.width / 2, canvas.height / 2);
      const data = octx.getImageData(0, 0, canvas.width, canvas.height).data;
      const step = 3 * Math.max(1, Math.round(dpr));
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          if ((data[(y * canvas.width + x) * 4 + 3] ?? 0) > 128) {
            targets.push([x, y]);
          }
        }
      }
    }
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = targets[i]!;
      targets[i] = targets[j]!;
      targets[j] = a;
    }
    if (targets.length > 2400) targets.length = 2400;

    type P = {
      sx: number;
      sy: number;
      vx: number;
      vy: number;
      tx: number;
      ty: number;
      x: number;
      y: number;
      seed: number;
      c2: boolean;
    };
    const parts: P[] = targets.map(([tx, ty]) => ({
      sx: Math.random() * canvas.width,
      sy: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6 * dpr,
      vy: (Math.random() - 0.5) * 0.6 * dpr,
      tx,
      ty,
      x: 0,
      y: 0,
      seed: Math.random() * Math.PI * 2,
      c2: Math.random() < 0.04,
    }));

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const dot = 2 * dpr;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;

      // Low-alpha fill for a soft trail.
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      const glow =
        t >= 2200 ? 0.5 + 0.5 * Math.sin((t - 2200) / 180) : 0;

      for (const p of parts) {
        let alpha: number;
        if (t < 500) {
          p.x = p.sx + p.vx * t + Math.sin(t * 0.002 + p.seed) * 14 * dpr;
          p.y = p.sy + p.vy * t + Math.cos(t * 0.002 + p.seed) * 14 * dpr;
          alpha = 0.5 * (t / 500);
        } else if (t < 2200) {
          const e = easeOutCubic(clamp01((t - 500) / 1700));
          const turb = (1 - e) * Math.sin(t * 0.03 + p.seed) * 10 * dpr;
          p.x = p.sx + (p.tx - p.sx) * e + turb;
          p.y = p.sy + (p.ty - p.sy) * e + turb;
          alpha = 0.5 + 0.5 * e;
        } else {
          p.x = p.tx;
          p.y = p.ty;
          alpha = 1;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.c2 ? accent2 : accent;
        ctx.fillRect(p.x, p.y, dot, dot);
      }
      ctx.globalAlpha = 1;

      if (glow > 0.02) {
        ctx.globalAlpha = 0.06 * glow;
        ctx.fillStyle = accent;
        for (const p of parts) {
          ctx.fillRect(p.x - dot, p.y - dot, dot * 3, dot * 3);
        }
        ctx.globalAlpha = 1;
      }

      if (t < TOTAL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const fadeTimer = setTimeout(() => {
      overlayRef.current?.setAttribute("data-fadeout", "");
    }, TOTAL_MS);
    const doneTimer = setTimeout(() => setShow(false), TOTAL_MS + 450);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div ref={overlayRef} className={styles.overlay} data-intro>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
