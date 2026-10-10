import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Animate each direct child in sequence instead of the wrapper as one block. */
  stagger?: number;
  delay?: number;
  y?: number;
  /** Wrapper element — use "ol"/"ul" when children are <li> (div is invalid there). */
  as?: "div" | "ol" | "ul";
};

// Scroll-triggered fade+rise, used for marketing/content sections below the
// fold. Skips entirely under prefers-reduced-motion — content renders at its
// final state immediately, never invisible-by-default (keeps it crawlable
// and avoids stranding keyboard/reduced-motion users on an empty section).
export function Reveal({ children, className, stagger, delay = 0, y = 16, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets: Element | Element[] = stagger ? Array.from(el.children) : el;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          delay,
          ease: "power1.out",
          stagger: stagger ?? 0,
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [stagger, delay, y]);

  const Tag = as;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={className}>
      {children}
    </Tag>
  );
}
