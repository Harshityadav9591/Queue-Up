import { useLayoutEffect, useRef, useState } from 'react';

// A segmented control whose selected pill slides to the chosen option
export default function Segmented({ options, value, onChange, label, size = 'md', className = '' }) {
  const trackRef = useRef(null);
  const [pill, setPill] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = trackRef.current?.querySelector('[aria-pressed="true"]');
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [value, options.length]);

  const h = size === 'sm' ? 'h-8 text-[13px] px-3.5' : 'h-[34px] text-sm px-4';

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={label}
      className={`relative inline-flex shrink-0 items-center rounded-full bg-surface p-1 ${className}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-0 rounded-full bg-ground dark:bg-raised transition-[transform,width] duration-500 ease-out-soft"
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-300 ${h} ${
              on ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && <span className="num font-normal text-muted">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
