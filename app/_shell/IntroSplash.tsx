"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./intro-splash.module.css";

// Plan 23: 3.65s of unskippable canvas work on every load was the wrong
// place for it. Same choreography, scaled 4x smaller (SCALE below), shown
// once per browser (localStorage), and cut short instantly on any input.
const SEEN_KEY = "mirage-intro-seen";
/** Dispatch this to show the intro again regardless of SEEN_KEY (see the
 *  command palette's "Replay intro animation"). */
export const REPLAY_INTRO_EVENT = "mirage:replay-intro";

const SCALE = 0.25;
// Timeline (ms): 0-125 fade-in + drift, 125-550 ease to target,
// 550-700 settle + glow pulse, 700-800 hold, then a quick overlay fade.
const TOTAL_MS = 3200 * SCALE;

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
  const reducedRef = useRef(false);

  useLayoutEffect(() => {
    try {
      reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia — assume motion is fine */
    }
    if (reducedRef.current) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* no localStorage — treat every visit as first */
    }
    if (!seen) setShow(true);
  }, []);

  // Replayable on demand (command palette) regardless of SEEN_KEY/reduced
  // motion — someone asking to see it again is not the "unwanted delay"
  // this plan is fixing.
  useEffect(() => {
    const onReplay = () => setShow(true);
    window.addEventListener(REPLAY_INTRO_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_INTRO_EVENT, onReplay);
  }, []);

  // Lifecycle (timers + skip-on-input) is independent of whether the canvas
  // 2d context is actually available, so "click to skip" still works even
  // where drawing can't happen (a stub `getContext` in tests, an exotic
  // browser) — the escape hatch must never depend on the thing it escapes.
  useEffect(() => {
    if (!show) return;

    function markSeen() {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* no localStorage — will just show again next visit */
      }
    }

    const fadeTimer = setTimeout(() => {
      overlayRef.current?.setAttribute("data-fadeout", "");
    }, TOTAL_MS);
    const doneTimer = setTimeout(() => {
      markSeen();
      setShow(false);
    }, TOTAL_MS + 150);

    // "an immediate exit on any click, key or scroll" — no fade, just gone.
    function skip() {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      markSeen();
      setShow(false);
    }
    const opts = { capture: true };
    window.addEventListener("pointerdown", skip, opts);
    window.addEventListener("keydown", skip, opts);
    window.addEventListener("wheel", skip, opts);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      window.removeEventListener("pointerdown", skip, opts);
      window.removeEventListener("keydown", skip, opts);
      window.removeEventListener("wheel", skip, opts);
    };
  }, [show]);

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
        t >= 2200 * SCALE ? 0.5 + 0.5 * Math.sin((t - 2200 * SCALE) / (180 * SCALE)) : 0;

      for (const p of parts) {
        let alpha: number;
        if (t < 500 * SCALE) {
          p.x = p.sx + p.vx * t + Math.sin(t * 0.002 + p.seed) * 14 * dpr;
          p.y = p.sy + p.vy * t + Math.cos(t * 0.002 + p.seed) * 14 * dpr;
          alpha = 0.5 * (t / (500 * SCALE));
        } else if (t < 2200 * SCALE) {
          const e = easeOutCubic(clamp01((t - 500 * SCALE) / (1700 * SCALE)));
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

    return () => cancelAnimationFrame(raf);
  }, [show]);

  if (!show) return null;
  return (
    <div ref={overlayRef} className={styles.overlay} data-intro>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
