"use client";

// A portfolio index built as a wheel you turn.
//
// At rest the work sits in a ring around a title, each card tangent to the
// circle. The first notch of scroll blows the ring open into a vertical drum:
// the card at the front lies flat and full size, the ones above and below
// rotate away into hard perspective and run off the top and bottom of the
// frame. Keep turning and the drum carries the next piece round to the front.
//
// The whole thing is one number - `turn` - read by a single rAF pass that writes
// transforms straight to the DOM. 0 is the ring, 1 is the drum with item 0 at
// the front, and every whole number after that is one more item turned past.
import * as React from "react";

import { cn } from "@/lib/utils";

export interface WorksWheelItem {
  /** Project name. Shown beside the front card and in the index. */
  title: string;
  /** Cover art. Any src an <img> takes. */
  image: string;
  /** Where the card links to. Omit for a wheel that only browses. */
  href?: string;
}

export interface WorksWheelProps extends Omit<
  React.ComponentPropsWithoutRef<"section">,
  "children"
> {
  items: WorksWheelItem[];
  /** Sits in the middle of the ring. @default undefined */
  label?: string;
  /** Label on the card's hover affordance. Omit to drop it. @default undefined */
  action?: string;
}

/* Geometry. The card is measured against the stage; everything else is measured
   against the card, so a narrow stage - where the card is capped by width, not
   height - scales the whole wheel down with it instead of leaving a small card
   swinging on a huge drum. The three that matter are tuned together: STEP
   against DRUM sets how hard the neighbours rotate away, and DRUM against LENS
   decides whether they land inside the frame or run off it. */
const CARD_H = 0.38; // front card height, of the stage
const CARD_MAX_W = 0.34; // ... but never wider than this much of the stage
const CARD_RATIO = 1.45; // card width / height
const STEP = 40; // degrees between cards on the drum
const DRUM = 2.22; // drum radius, in card heights - and everything below likewise
const LENS = 2.7; // perspective distance
const RING_R = 1.14; // ring radius
/* The drum alone hangs the work on a plumb line. It isn't one: the strip curves
   away round an arc whose centre sits off to the LEFT, so the piece at the front
   is at the arc's near point - dead centre - and its neighbours have already
   swung back left as well as up and down. BOW is that arc's radius; nothing else
   makes the difference between a stack of cards and a wheel seen side on. */
const BOW = 1.82;
const TITLE = 0.124; // ring label and front-card title
const INDEX = 0.04; // the index down the right-hand side
/** Items either side of the front still worth drawing. Past this a card is
    edge-on, and further round it would stack up on the vanishing point. */
const CULL = 1.6;

/** How much of a wheel-notch or a dragged pixel counts as one item. */
const WHEEL_UNITS = 900;
const DRAG_UNITS = 420;
/** Quiet time after the last wheel event before the wheel settles on an item. */
const SETTLE = 140;
/** Fraction of the remaining distance closed each frame. 1 = no smoothing. */
const EASE = 0.12;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Stage = { w: number; h: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** How far left the arc has carried something that has turned `drumDeg` off the
    front. Zero at the front, so the piece being read stays centred. */
const bowAt = (drumDeg: number, bow: number) =>
  -bow * (1 - Math.cos(rad(drumDeg)));

/** Both states in one chain: the ring terms fall away as `m` reaches the drum,
    and the drum terms are still zero while the ring is up. The bow is applied
    first, in the wheel's own plane, so it slides the card sideways rather than
    turning with it - and perspective still shrinks it with distance. */
function place(
  ringDeg: number,
  drumDeg: number,
  ringR: number,
  drumR: number,
  bow: number,
  m: number,
) {
  return (
    `translateX(${m * bowAt(drumDeg, bow)}px)` +
    ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`
  );
}

export function WorksWheel({
  items,
  label = "Works '26",
  action = "View",
  className,
  ...props
}: WorksWheelProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);

  // The wheel's position, and where it is heading. Only `active` is state -
  // everything else is written to the DOM, so turning the wheel is not a render.
  const turn = React.useRef(1);
  const target = React.useRef(1);
  const [active, setActive] = React.useState(0);
  const [stage, setStage] = React.useState<Stage>({ w: 0, h: 0 });

  const count = items.length;
  const last = Math.max(count - 1, 0);

  // Read after mount, not during render: the server has no matchMedia, and
  // branching on it inline is a hydration mismatch. Reduced motion drops the
  // easing, so the wheel lands where it is put instead of gliding there.
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1100);
      const h = el.clientHeight || 580;
      setStage({ w, h });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = React.useMemo(() => {
    const w = stage.w || 1100;
    const h = stage.h || 580;
    const cardW = Math.min(h * CARD_H * CARD_RATIO, w * CARD_MAX_W);
    const cardH = cardW / CARD_RATIO;
    const drumR = cardH * DRUM;
    const ringR = cardH * RING_R;
    // Shrink the ring's cards until the circle reads as a closed loop rather
    // than beads on a wire, however many pieces the wheel is given.
    const ringScale = count
      ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 1)
      : 1;
    return {
      cardW,
      cardH,
      ringR,
      ringScale,
      drumR,
      bow: cardH * BOW,
      depth: cardH * LENS,
      title: cardH * TITLE,
      index: cardH * INDEX,
    };
  }, [stage, count]);

  // One pass per frame: ease toward the target, then write every transform.
  React.useEffect(() => {
    if (!stage.h) return;
    let frame = 0;
    const { ringR, ringScale, drumR, bow } = metrics;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const gap = target.current - turn.current;
      if (Math.abs(gap) < 0.0005) turn.current = target.current;
      else turn.current += gap * (reduced ? 1 : EASE);

      const t = turn.current;
      const m = clamp(t, 0, 1);
      const pos = Math.max(0, t - 1);

      // The drum is pulled back so its front face lands on the picture plane.
      // That set-back has to arrive with the drum, or the ring would sit at the
      // far side of the perspective and render at half its size.
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateZ(${-m * drumR}px)`;
      }

      for (let i = 0; i < count; i++) {
        const d = i - pos;
        const drumDeg = d * STEP;
        const card = cardRefs.current[i];
        if (card) {
          card.style.transform = place(
            d * (360 / count),
            drumDeg,
            ringR,
            drumR,
            bow,
            m,
          );
          // Culled by distance, not by angle: at a full turn the far side comes
          // back round to face us, and everything past the neighbours lands on
          // the vanishing point in a heap.
          card.style.opacity = m > 0.5 && Math.abs(d) > CULL ? "0" : "1";
          card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
        }
        const face = card?.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${lerp(ringScale, 1, m)})`;
      }

      if (labelRef.current) labelRef.current.style.opacity = String(1 - m);
      if (titleRef.current) titleRef.current.style.opacity = String(m);
      const near = clamp(Math.round(pos), 0, last);
      setActive((prev) => (prev === near ? prev : near));
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [metrics, stage.h, count, last, reduced]);

  const to = React.useCallback(
    (next: number) => {
      target.current = clamp(next, 1, count);
    },
    [count],
  );

  // Responsive, non-trapping wheel scroll handler
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    let accumulatedDelta = 0;
    let resetTimer: number | null = null;
    let lastWheelTime = 0;

    const onWheel = (event: WheelEvent) => {
      const now = performance.now();
      const dy = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      
      const current = target.current;
      const isAtStart = current <= 1.05;
      const isAtEnd = current >= count - 0.05;

      // Allow natural page scroll when at beginning or end
      if (isAtStart && dy < 0) {
        return;
      }
      if (isAtEnd && dy > 0) {
        return;
      }

      // Intercept and rotate the wheel
      event.preventDefault();

      accumulatedDelta += dy;

      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accumulatedDelta = 0;
      }, 200);

      // Sensitive threshold for immediate single-notch response
      const THRESHOLD = 35;
      if (Math.abs(accumulatedDelta) >= THRESHOLD && now - lastWheelTime > 110) {
        const direction = Math.sign(accumulatedDelta);
        const next = clamp(Math.round(current) + direction, 1, count);
        to(next);
        accumulatedDelta = 0;
        lastWheelTime = now;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (resetTimer) window.clearTimeout(resetTimer);
    };
  }, [to, count]);

  const drag = React.useRef<number | null>(null);

  return (
    <section
      aria-label={label}
      className={cn(
        "relative h-full min-h-[24rem] w-full overflow-hidden select-none bg-transparent text-foreground border-0",
        className,
      )}
      {...props}
    >
      <div
        ref={stageRef}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`works-wheel-${active}`}
        className="focus-visible:outline-foreground absolute inset-0 cursor-grab touch-pan-x outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 active:cursor-grabbing"
        style={{ perspective: `${metrics.depth}px` }}
        onPointerDown={(event) => {
          drag.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current === null) return;
          const delta = (drag.current - event.clientY) / DRAG_UNITS;
          to(target.current + delta);
          drag.current = event.clientY;
        }}
        onPointerUp={() => {
          drag.current = null;
          to(Math.round(target.current));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            to(Math.min(count, Math.round(target.current) + 1));
            event.preventDefault();
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            to(Math.max(1, Math.round(target.current) - 1));
            event.preventDefault();
          }
        }}
      >
        <div
          ref={wheelRef}
          className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
        >
          {items.map((item, i) => {
            const Tag = (item.href ? "a" : "div") as "a";
            return (
              <React.Fragment key={item.title}>
                <Tag
                  id={`works-wheel-${i}`}
                  role="option"
                  aria-selected={i === active}
                  href={item.href}
                  ref={(node: HTMLElement | null) => {
                    cardRefs.current[i] = node;
                  }}
                  className="group absolute [backface-visibility:hidden]"
                  style={{
                    width: metrics.cardW,
                    height: metrics.cardH,
                    marginLeft: -metrics.cardW / 2,
                    marginTop: -metrics.cardH / 2,
                  }}
                >
                  <span className="bg-muted shadow-foreground/12 relative block size-full overflow-hidden rounded-xl shadow-[0_20px_45px_-15px_rgba(31,44,26,0.25)] border-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      draggable={false}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {action && item.href ? (
                      <span className="bg-[#1F2C1A]/85 text-[#FDFBF7] pointer-events-none absolute right-3 bottom-3 flex translate-y-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium opacity-0 backdrop-blur-sm transition group-hover:translate-y-0 group-hover:opacity-100 shadow-md">
                        <svg
                          viewBox="0 0 12 12"
                          className="size-3 text-[#D4AF37]"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 9 9 3M4 3h5v5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {action}
                      </span>
                    ) : null}
                  </span>
                </Tag>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Ring label fallback */}
      <div
        ref={labelRef}
        className="pointer-events-none absolute inset-0 grid place-items-center tracking-tight opacity-0"
        style={{ fontSize: metrics.title }}
      >
        {label}
      </div>

      {/* Left-side: Active gift details with festive luxury typography */}
      <div
        ref={titleRef}
        className="absolute top-1/2 left-[4%] sm:left-[6%] lg:left-[8%] -translate-y-1/2 max-w-[240px] sm:max-w-xs md:max-w-sm z-20 pointer-events-auto"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-[#C5A059]/20 text-[#7D5C1E] border border-[#C5A059]/40">
            Gift {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-[#7A1C28] uppercase">
            Signature Edition
          </span>
        </div>

        <h3
          className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-[#1F2C1A] tracking-tight leading-tight mb-3 drop-shadow-sm"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {items[active]?.title}
        </h3>

        {items[active]?.href && (
          <a
            href={items[active]?.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#7A1C28] hover:text-[#50131B] transition-all group/link"
          >
            <span>Explore Collection</span>
            <span className="transition-transform group-hover/link:translate-x-1">&rarr;</span>
          </a>
        )}

        {/* Navigation arrow buttons for clicking */}
        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => to(Math.max(1, target.current - 1))}
            disabled={active <= 0}
            aria-label="Previous Gift"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/95 hover:bg-white text-[#1F2C1A] border border-[#1F2C1A]/10 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => to(Math.min(count, target.current + 1))}
            disabled={active >= count - 1}
            aria-label="Next Gift"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/95 hover:bg-white text-[#1F2C1A] border border-[#1F2C1A]/10 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <span className="text-xs text-[#1F2C1A]/70 ml-2 select-none font-medium">
            Scroll or drag drum
          </span>
        </div>
      </div>

      {/* Bottom Center Indicator Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-sm border border-[#1F2C1A]/10 shadow-sm">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => to(i + 1)}
            aria-label={`Go to gift ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
              i === active
                ? "w-6 bg-[#7A1C28]"
                : "w-1.5 bg-[#1F2C1A]/25 hover:bg-[#1F2C1A]/50",
            )}
          />
        ))}
      </div>
    </section>
  );
}

export default WorksWheel;
