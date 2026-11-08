import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { hasWebGL } from "@/lib/globe-scene";
import { useFlight } from "@/lib/flight";
import { fill } from "@/lib/format";
import { useI18n } from "@/lib/use-i18n";

export function CssGlobe({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-square w-full overflow-hidden ${className}`}>
      <div className="absolute inset-[10%] rounded-full border border-line bg-elev" />
      <div
        className="spin-slow absolute inset-[10%] rounded-full opacity-80"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0 10%, color-mix(in srgb, var(--c-line) 80%, transparent) 10% 11%), repeating-linear-gradient(0deg, transparent 0 14%, color-mix(in srgb, var(--c-muted) 35%, transparent) 14% 15%)",
        }}
      />
      <div className="orbit">
        <Plane className="orbit-jet size-6 text-accent" aria-hidden />
      </div>
    </div>
  );
}

function CssRoute({ onDone, reduce }: { onDone: () => void; reduce: boolean }) {
  const ref = useRef(onDone);
  ref.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => ref.current(), reduce ? 400 : 3000);
    return () => window.clearTimeout(id);
  }, [reduce]);
  return (
    <div className="relative mx-auto h-64 w-full max-w-lg">
      <svg viewBox="0 0 400 220" className="h-full w-full" aria-hidden>
        <path d="M 36 150 C 120 20, 260 18, 360 120" fill="none" stroke="var(--c-line)" strokeWidth="1.5" />
        <path d="M 36 150 C 120 20, 260 18, 360 120" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeDasharray="6 8" />
        <circle cx="360" cy="120" r="5" fill="var(--c-accent)" />
      </svg>
      {!reduce ? <Plane className="route-jet absolute size-6 text-fg" /> : null}
    </div>
  );
}

export function FlightOverlay() {
  const plan = useFlight((s) => s.plan);
  const clear = useFlight((s) => s.clear);
  const t = useI18n();
  const navigate = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"fly" | "land">("fly");
  const [mode, setMode] = useState<"web" | "flat">("web");
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!plan) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    done.current = false;
    setLeaving(false);
    setPhase("fly");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const web = hasWebGL() && !reduce;
    setMode(web ? "web" : "flat");
    if (!web || !canvas.current) return;
    let stop = () => {};
    let dead = false;
    void import("@/lib/globe-scene").then(({ mountGlobe }) => {
      if (dead || !canvas.current) return;
      const dispose = mountGlobe(canvas.current, {
        mode: "flight",
        from: plan.from,
        to: plan.to,
        onPhase: setPhase,
        onDone: () => finish(),
      });
      if (!dispose) setMode("flat");
      else stop = dispose;
    });
    return () => {
      dead = true;
      stop();
    };
    // finish closes over the current plan id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  function finish() {
    if (done.current || !plan) return;
    done.current = true;
    setLeaving(true);
    const search = plan.search;
    void navigate({
      to: "/search",
      search: {
        to: search.to,
        from: search.from,
        depart: search.depart,
        ret: search.ret,
        pax: search.pax,
        cat: search.cat,
      },
    });
    window.setTimeout(() => clear(), 280);
  }

  if (!plan) return null;
  const city = plan.to.label || plan.search.to;
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#070b14] text-fg transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-label={fill(t.globe.flying, { city })}
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <p className="font-display text-2xl sm:text-4xl">
          {phase === "land" ? fill(t.globe.landing, { city }) : fill(t.globe.flying, { city })}
        </p>
        <button type="button" className="press h-11 rounded-full border border-line px-4 text-sm" onClick={finish}>
          {t.globe.skip}
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvas} className={mode === "web" ? "h-full w-full" : "hidden"} />
        {mode === "flat" ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
            <p className="text-sm tracking-widest text-muted uppercase">{t.globe.fallback}</p>
            <CssRoute onDone={finish} reduce={reduce} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HeroGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const rich = window.matchMedia("(min-width: 768px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!rich || reduce || !hasWebGL()) return;
    setLive(true);
    let stop = () => {};
    let dead = false;
    void import("@/lib/globe-scene").then(({ mountGlobe }) => {
      if (dead || !ref.current) return;
      const dispose = mountGlobe(ref.current, { mode: "idle" });
      if (dispose) stop = dispose;
      else setLive(false);
    });
    return () => {
      dead = true;
      stop();
    };
  }, []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-lg">
      {!live ? <CssGlobe /> : null}
      <canvas ref={ref} className={live ? "absolute inset-0 h-full w-full" : "hidden"} />
    </div>
  );
}
