import { useState, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { C } from "./theme";

export function Tip({ text, children }: { text?: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  const onEnter = useCallback(() => {
    setShow(true);
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect(),
      s: CSSProperties = {};
    if (r.top > 200) s.bottom = "calc(100% + 8px)";
    else s.top = "calc(100% + 8px)";
    if (r.left < 140) {
      s.left = 0;
      s.transform = "none";
    } else if (window.innerWidth - r.right < 140) {
      s.right = 0;
      s.transform = "none";
    } else {
      s.left = "50%";
      s.transform = "translateX(-50%)";
    }
    setPos(s);
  }, []);
  if (!text) return <>{children}</>;
  return (
    <span
      ref={ref}
      style={{
        position: "relative",
        cursor: "help",
        borderBottom: `1px dotted ${C.textMuted}44`,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            width: 260,
            padding: "10px 12px",
            background: "#1e293b",
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            color: C.textDim,
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            ...pos,
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
