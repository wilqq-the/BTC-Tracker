'use client';

import React, { useEffect, useState } from 'react';

export interface RingSegment {
  value: number;
  color: string; // any CSS color, e.g. 'hsl(var(--primary))'
  label?: string;
}

interface RingChartProps {
  segments: RingSegment[];
  /** Sum the segments are measured against (defaults to their total) */
  total?: number;
  size?: number;
  thickness?: number;
  trackColor?: string;
  roundedCaps?: boolean;
  /** Index (into `segments`) of the highlighted segment: it pops outward, the rest fade back */
  activeIndex?: number | null;
  /** Hovering a segment reports its index (null when leaving) */
  onActiveChange?: (index: number | null) => void;
  children?: React.ReactNode; // centered content
}

/**
 * Donut / progress ring that sweeps in on mount. One segment = a score
 * ring; several = an allocation donut.
 */
export function RingChart({
  segments,
  total,
  size = 120,
  thickness = 14,
  trackColor = 'hsl(var(--secondary))',
  roundedCaps = false,
  activeIndex = null,
  onActiveChange,
  children,
}: RingChartProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = total ?? segments.reduce((acc, s) => acc + s.value, 0);
  const gap = segments.length > 1 ? 2 : 0;

  let offset = 0;
  const arcs = segments
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = sum > 0 ? (s.value / sum) * circumference : 0;
      const arc = { ...s, length: Math.max(0, length - gap), offset };
      offset += length;
      return arc;
    });
  const hasActive = activeIndex !== null && arcs.some((a) => a.index === activeIndex);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        {arcs.map((arc, i) => {
          const isActive = arc.index === activeIndex;
          return (
          <circle
            key={arc.index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeLinecap={roundedCaps ? 'round' : 'butt'}
            strokeDasharray={`${shown ? arc.length : 0} ${circumference}`}
            strokeDashoffset={-arc.offset}
            onMouseEnter={onActiveChange ? () => onActiveChange(arc.index) : undefined}
            onMouseLeave={onActiveChange ? () => onActiveChange(null) : undefined}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transform: isActive ? 'scale(1.08)' : 'none',
              opacity: hasActive && !isActive ? 0.4 : 1,
              cursor: onActiveChange ? 'pointer' : undefined,
              // The sweep-in waits for its slot; hover pops respond at once
              transition: 'stroke-dasharray 1.1s cubic-bezier(0.2, 0.75, 0.2, 1), transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.2s ease-out',
              transitionDelay: `${shown ? 0 : 400 + i * 120}ms, 0ms, 0ms`,
            }}
          >
            {arc.label && <title>{arc.label}</title>}
          </circle>
          );
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
