import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * VirtualizedGrid renders a windowed responsive grid for high performance
 * when dealing with large lists of cards. Only visible rows (+ overscan buffer)
 * are rendered in the DOM.
 */
export default function VirtualizedGrid({ 
  items, 
  renderItem, 
  itemKey, 
  gap = 24, // 24px matches Tailwind gap-6
  overscan = 2 // number of extra rows above/below viewport to keep rendered
}) {
  const containerRef = useRef(null);
  const rowRef = useRef(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [measuredRowHeight, setMeasuredRowHeight] = useState(0);

  // 1. Monitor window scroll, viewport resize, and container width
  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY || document.documentElement.scrollTop);
    };

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    handleResize();
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // 2. Dynamically measure actual rendered row height once a row is mounted
  useEffect(() => {
    if (rowRef.current) {
      const height = rowRef.current.offsetHeight;
      if (height > 0 && Math.abs(height - measuredRowHeight) > 2) {
        setMeasuredRowHeight(height);
      }
    }
  });

  // 3. Compute responsive column count based on container width
  const columnsCount = useMemo(() => {
    if (containerWidth >= 1024) return 5; // lg
    if (containerWidth >= 768) return 4;  // md
    if (containerWidth >= 640) return 2;  // sm
    return 1;
  }, [containerWidth]);

  // 4. Calculate total effective row height (row height + gap)
  const effectiveRowHeight = useMemo(() => {
    if (measuredRowHeight > 0) return measuredRowHeight + gap;
    if (containerWidth === 0) return 420; // safe fallback
    const cardWidth = (containerWidth - (columnsCount - 1) * gap) / columnsCount;
    const posterHeight = cardWidth * 1.5; // 2:3 aspect ratio
    const cardContentHeight = 90;
    return posterHeight + cardContentHeight + gap;
  }, [measuredRowHeight, containerWidth, columnsCount, gap]);

  // 5. Slice items array into row chunks
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < items.length; i += columnsCount) {
      result.push(items.slice(i, i + columnsCount));
    }
    return result;
  }, [items, columnsCount]);

  // 6. Calculate visible row indices
  const containerOffsetTop = containerRef.current ? containerRef.current.offsetTop : 0;
  const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);

  const startRow = Math.max(0, Math.floor((relativeScrollTop - overscan * effectiveRowHeight) / effectiveRowHeight));
  const endRow = Math.min(
    rows.length - 1,
    Math.ceil((relativeScrollTop + viewportHeight + overscan * effectiveRowHeight) / effectiveRowHeight)
  );

  const visibleRows = rows.slice(startRow, endRow + 1);

  const topPadding = startRow * effectiveRowHeight;
  const bottomPadding = Math.max(0, (rows.length - (endRow + 1)) * effectiveRowHeight);

  return (
    <div ref={containerRef} className="w-full">
      {/* Top spacer for unrendered virtualized rows above */}
      {topPadding > 0 && <div style={{ height: `${topPadding}px` }} aria-hidden="true" />}

      {/* Currently visible rows */}
      <div className="flex flex-col gap-6">
        {visibleRows.map((row, rowIndexOffset) => {
          const actualRowIndex = startRow + rowIndexOffset;
          const isFirstRendered = rowIndexOffset === 0;

          return (
            <div
              key={`row-${actualRowIndex}`}
              ref={isFirstRendered ? rowRef : null}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full"
            >
              {row.map((item, colIndex) => {
                const globalIndex = actualRowIndex * columnsCount + colIndex;
                return (
                  <div key={itemKey ? itemKey(item, globalIndex) : globalIndex} className="h-full">
                    {renderItem(item, globalIndex)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom spacer for unrendered virtualized rows below */}
      {bottomPadding > 0 && <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />}
    </div>
  );
}
