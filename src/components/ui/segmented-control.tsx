'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FerroPillLayer, useFerroPill } from '@/components/ui/ferro-pill';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Ferrofluid indicator (like the header nav): stretches and snaps when switching */
  liquid?: boolean;
  'aria-label'?: string;
}

/**
 * Pill segmented control with a springy sliding indicator — the house
 * pattern for time ranges, chart modes and other small exclusive choices.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  liquid = false,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const ferro = useFerroPill<HTMLDivElement>();
  const ownRef = useRef<HTMLDivElement>(null);
  const listRef = liquid ? ferro.containerRef : ownRef;
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[value];
      const parent = listRef.current;
      if (!el || !parent) return;
      if (liquid) ferro.moveTo(el);
      else setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
    // ferro.moveTo is stable; liquid doesn't change at runtime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      // Liquid: the blob reaches toward the hovered option, then settles back
      onMouseLeave={liquid ? () => ferro.moveTo(itemRefs.current[value]) : undefined}
      className={cn('relative inline-flex max-w-full overflow-x-auto rounded-full bg-secondary p-1', className)}
    >
      {liquid ? (
        <FerroPillLayer blobRef={ferro.blobRef} dropRef={ferro.dropRef} className="bg-card" blobClassName="inset-y-1" />
      ) : (
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-1 rounded-full bg-card shadow-sm',
          pill.ready && 'transition-[left,width] duration-[350ms] ease-[cubic-bezier(0.3,1.3,0.5,1)]'
        )}
        style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }}
      />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            ref={(el) => { itemRefs.current[option.value] = el; }}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            onMouseEnter={liquid ? (e) => ferro.moveTo(e.currentTarget) : undefined}
            onFocus={liquid ? (e) => ferro.moveTo(e.currentTarget) : undefined}
            onBlur={liquid ? () => ferro.moveTo(itemRefs.current[value]) : undefined}
            className={cn(
              'relative z-10 shrink-0 rounded-full font-bold transition-colors duration-200',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-[13px]',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
