import { useCallback, useEffect, useRef, useState } from 'react';

export interface PageBreak {
  pageNumber: number;
  heightFromTop: number;
}

// US Letter dimensions in pixels (assuming 96 DPI)
const LETTER_WIDTH_INCHES = 8.5;
const LETTER_HEIGHT_INCHES = 11;
const MARGIN_INCHES = 1;
const DPI = 96;

const LETTER_WIDTH_PX = LETTER_WIDTH_INCHES * DPI;
const LETTER_HEIGHT_PX = LETTER_HEIGHT_INCHES * DPI;
const MARGIN_PX = MARGIN_INCHES * DPI;

// Content area (subtracting margins)
const CONTENT_WIDTH_PX = LETTER_WIDTH_PX - 2 * MARGIN_PX;
const CONTENT_HEIGHT_PX = LETTER_HEIGHT_PX - 2 * MARGIN_PX;

export const usePagination = (contentRef: React.RefObject<HTMLDivElement | null>) => {
  const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePageBreaks = useCallback(() => {
    if (!contentRef.current) return;

    const contentHeight = contentRef.current.scrollHeight;
    const breaks: PageBreak[] = [];
    
    // Calculate page breaks based on actual content height
    // Each page has CONTENT_HEIGHT_PX available height
    let pageNum = 1;
    let nextPageTop = CONTENT_HEIGHT_PX;

    while (nextPageTop < contentHeight) {
      breaks.push({
        pageNumber: pageNum,
        heightFromTop: nextPageTop,
      });
      pageNum++;
      nextPageTop = pageNum * CONTENT_HEIGHT_PX;
    }

    // Always have at least one page
    const calculatedPages = Math.max(1, Math.ceil(contentHeight / CONTENT_HEIGHT_PX));
    
    setPageBreaks(breaks);
    setTotalPages(calculatedPages);
  }, [contentRef]);

  const recalculate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      calculatePageBreaks();
    }, 150);
  }, [calculatePageBreaks]);

  useEffect(() => {
    calculatePageBreaks();

    // Set up ResizeObserver to recalculate on content size change
    if (contentRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        recalculate();
      });
      resizeObserverRef.current.observe(contentRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [contentRef, recalculate]);

  return {
    pageBreaks,
    totalPages,
    LETTER_WIDTH_PX,
    LETTER_HEIGHT_PX,
    MARGIN_PX,
    CONTENT_WIDTH_PX,
    CONTENT_HEIGHT_PX,
    recalculate,
  };
};
