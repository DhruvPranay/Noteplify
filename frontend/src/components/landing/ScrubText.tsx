import { Fragment, useRef } from "react";
import { cssVars, useScrollProgress } from "../fx";

/** A paragraph whose words light up one by one as it scrolls through the viewport. */
export function ScrubText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useScrollProgress(ref, (r, vh) => (vh * 0.85 - r.top) / (r.height + vh * 0.3));
  const words = text.split(" ");
  return (
    <p ref={ref} className={`scrub ${className}`} style={cssVars({ "--n": words.length })}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span style={cssVars({ "--i": i })}>{w}</span>{" "}
        </Fragment>
      ))}
    </p>
  );
}
