"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|_-=+";

interface ScrambleTextProps {
  text: string;
  className?: string;
  duration?: number;
  trigger?: boolean;
}

export function ScrambleText({ text, className, duration = 700, trigger = true }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!trigger) return;

    let iteration = 0;
    const totalFrames = Math.ceil(duration / 30);

    frameRef.current = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, i) => {
            if (char === " ") return " ";
            if (i < Math.floor((iteration / totalFrames) * text.length)) return char;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );

      if (iteration >= totalFrames) {
        clearInterval(frameRef.current!);
        setDisplay(text);
      }
      iteration++;
    }, 30);

    return () => {
      if (frameRef.current) clearInterval(frameRef.current);
    };
  }, [text, duration, trigger]);

  return <span className={className}>{display}</span>;
}
