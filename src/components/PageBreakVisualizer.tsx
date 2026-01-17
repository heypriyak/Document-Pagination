'use client';

import React from 'react';
import { PageBreak } from '@/hooks/usePagination';

interface PageBreakVisualizerProps {
  pageBreaks: PageBreak[];
  contentRef: React.RefObject<HTMLDivElement | null>;
  marginPx: number;
  contentHeightPx: number;
  contentWidthPx: number;
  totalPages: number;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  children: React.ReactNode;
}

export default function PageBreakVisualizer({
  pageBreaks,
  contentRef,
  marginPx,
  contentHeightPx,
  contentWidthPx,
  totalPages,
  headerText,
  footerText,
  showPageNumbers = true,
  children,
}: PageBreakVisualizerProps) {
  const PAGE_GAP_PX = 28;

  // total visual height for the wrapper (pages + gaps)
  const wrapperHeight = Math.max(
    contentHeightPx * totalPages + PAGE_GAP_PX * Math.max(0, totalPages - 1),
    contentHeightPx
  );

  return (
    <div className="relative" style={{ minHeight: wrapperHeight }}>
      {/* Render page 'paper' backgrounds */}
      {Array.from({ length: Math.max(1, totalPages) }).map((_, i) => {
        const top = i * (contentHeightPx + PAGE_GAP_PX);
        return (
          <div
            key={`page-bg-${i}`}
            className="absolute left-0 right-0 mx-auto bg-white shadow-2xl rounded-lg"
            style={{
              width: contentWidthPx,
              height: contentHeightPx,
              top: top,
              marginLeft: 'auto',
              marginRight: 'auto',
              zIndex: 0,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* header (top) */}
            {headerText && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#374151',
                  pointerEvents: 'none',
                  zIndex: 100,
                  fontWeight: 600,
                }}
              >
                {headerText}
              </div>
            )}

            {/* page footer (bottom-center) */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 12,
                color: '#6B7280',
                pointerEvents: 'none',
                zIndex: 100,
                fontWeight: 600,
              }}
            >
              {footerText 
                ? footerText.replace('{page}', String(i + 1)) 
                : (showPageNumbers ? `Page ${i + 1}` : '')}
            </div>
          </div>
        );
      })}

      {/* gap strips between pages for stronger separation */}
      {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, i) => {
        const gapTop = (i + 1) * (contentHeightPx + PAGE_GAP_PX) - PAGE_GAP_PX;
        return (
          <div
            key={`page-gap-${i}`}
            className="absolute left-0 right-0 mx-auto"
            style={{
              width: contentWidthPx,
              height: PAGE_GAP_PX,
              top: gapTop,
              marginLeft: 'auto',
              marginRight: 'auto',
              background: '#f3f4f6',
              zIndex: 0,
            }}
          />
        );
      })}

      {/* Place children above page backgrounds so content is readable */}
      <div style={{ position: 'relative', zIndex: 10 }}>{children}</div>

      {/* Page Break Lines (overlaid) */}
      {pageBreaks.map((pageBreak) => (
        <div
          key={pageBreak.pageNumber}
          className="absolute left-0 right-0"
          style={{
            top: `${pageBreak.heightFromTop + marginPx}px`,
            width: '100%',
            pointerEvents: 'none',
            zIndex: 20,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: contentWidthPx }}>
            <div className="border-t-2 border-dashed border-gray-400" />
          </div>
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 transform" style={{ zIndex: 25 }}>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
              Page {pageBreak.pageNumber}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
