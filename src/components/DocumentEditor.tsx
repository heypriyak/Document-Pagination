"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useRef, useEffect, useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import PageBreakVisualizer from './PageBreakVisualizer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DocumentEditor() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const STORAGE_KEY_CONTENT = 'doc-paginated-content';
  const STORAGE_KEY_HEADER = 'doc-paginated-header';
  const STORAGE_KEY_FOOTER = 'doc-paginated-footer';
  const STORAGE_KEY_PAGE_NUMBERS = 'doc-paginated-show-page-numbers';
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const { pageBreaks, totalPages, MARGIN_PX, CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX, recalculate } =
    usePagination(contentRef);

  const defaultContent = `
      <h1>Legal Document Editor</h1>
      <p>Start typing your legal document here. The editor will automatically show page breaks as you write.</p>
      <p>This editor uses US Letter size (8.5" x 11") with 1-inch margins on all sides, just like standard legal documents for USCIS submissions.</p>
      <h2>Key Features</h2>
      <ul>
        <li><strong>Real-time Pagination:</strong> See exactly how content flows across pages as you type</li>
        <li><strong>Text Formatting:</strong> Bold, italic, headings, and more</li>
        <li><strong>Lists:</strong> Bullet points and numbered lists with proper formatting</li>
        <li><strong>Tables:</strong> Create tables for structured legal data</li>
        <li><strong>PDF Export:</strong> Export your document matching the print preview</li>
        <li><strong>Headers & Footers:</strong> Add custom headers and footers with page numbers</li>
      </ul>
      <h2>Getting Started</h2>
      <p>Start by typing content or use the "Insert Test Content" button to fill the editor with sample text. Watch the pagination update in real-time!</p>
    `;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        hardBreak: false,
      }),
      HardBreak.configure({
        keepMarks: true,
      }),
      Table.configure({
        resizable: true,
        cellMinWidth: 50,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: defaultContent,
    onUpdate: ({ editor }) => {
      recalculate && recalculate();

      // debounced save to localStorage to avoid thrashing
      const html = editor.getHTML();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY_CONTENT, html);
        } catch (err) {
          // ignore storage errors (e.g., disabled storage)
          console.warn('Unable to save content', err);
        }
      }, 150);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none text-black',
        style: 'color: #000000;',
      },
    },
  });

  useEffect(() => {
    setIsEditorReady(true);
  }, []);

  useEffect(() => {
    if (!editor) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTENT);
      const savedHeader = localStorage.getItem(STORAGE_KEY_HEADER);
      const savedFooter = localStorage.getItem(STORAGE_KEY_FOOTER);
      const savedShow = localStorage.getItem(STORAGE_KEY_PAGE_NUMBERS);

      if (saved) {
        editor.commands.setContent(saved, {});
      }
      if (savedHeader !== null) setHeaderText(savedHeader);
      if (savedFooter !== null) setFooterText(savedFooter);
      if (savedShow !== null) setShowPageNumbers(savedShow === 'true');
    } catch (err) {
      console.warn('Unable to restore saved content', err);
    }
  }, [editor]);

  function insertTestContent() {
    if (!editor) return;
    const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    const repeated = Array.from({ length: 100 }).map(() => `<p>${para}</p>`).join('');
    editor.chain().focus().setContent(repeated).run();
    // ensure pagination recalculation after DOM updates
    setTimeout(() => recalculate && recalculate(), 50);
  }

  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HEADER, headerText);
      localStorage.setItem(STORAGE_KEY_FOOTER, footerText);
      localStorage.setItem(STORAGE_KEY_PAGE_NUMBERS, String(showPageNumbers));
    } catch (err) {
      console.warn('Unable to save header/footer', err);
    }
  }, [headerText, footerText, showPageNumbers]);

  async function exportToPDF() {
    if (!contentRef.current) return;
    const element = contentRef.current;

    // temporarily ensure white background
    const previousBg = element.style.background;
    element.style.background = '#ffffff';

    // render at 2x for better quality
    const scale = 2;
    const canvas = await html2canvas(element, { scale, useCORS: true, backgroundColor: '#ffffff' });

    const pageWidthPx = CONTENT_WIDTH_PX * scale; // width of one page in canvas px
    const pageHeightPx = CONTENT_HEIGHT_PX * scale; // height of one page in canvas px

    const totalHeight = canvas.height;
    const totalPagesPdf = Math.ceil(totalHeight / pageHeightPx);

    const pdf = new jsPDF({ unit: 'px', format: [CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX] });

    for (let i = 0; i < totalPagesPdf; i++) {
      const sx = 0;
      const sy = i * pageHeightPx;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = pageWidthPx;
      pageCanvas.height = Math.min(pageHeightPx, totalHeight - sy);
      const ctx = pageCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, sx, sy, pageCanvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);

      const imgData = pageCanvas.toDataURL('image/png');

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX);
    }

    // restore background
    element.style.background = previousBg;

    pdf.save('document.pdf');
  }

  return (
    <div className="flex h-screen w-full gap-8 bg-gray-100 p-8">
      {/* Main Editor Area */}
      <div className="flex flex-1 flex-col">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Document Pagination Editor</h1>
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-600">Total Pages: {totalPages}</p>
              <button
                onClick={insertTestContent}
                className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                title="Insert Test Content"
                aria-label="Insert Test Content"
                style={{ color: '#000000 !important', fontWeight: 'bold' }}
              >
                Insert Test Content
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => editor && editor.chain().focus().toggleBold().run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('bold') ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Bold (Ctrl+B)"
              aria-label="Toggle Bold"
              style={{ color: editor?.isActive('bold') ? '#ffffff !important' : '#000000 !important', fontWeight: 'bold' }}
            >
              B
            </button>

            <button
              onClick={() => editor && editor.chain().focus().toggleItalic().run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('italic') ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Italic (Ctrl+I)"
              aria-label="Toggle Italic"
              style={{ color: editor?.isActive('italic') ? '#ffffff !important' : '#000000 !important', fontStyle: 'italic' }}
            >
              I
            </button>

            <button
              onClick={() => editor && editor.chain().focus().toggleHeading({ level: 1 }).run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Heading 1"
              aria-label="Toggle Heading 1"
              style={{ color: editor?.isActive('heading', { level: 1 }) ? '#ffffff !important' : '#000000 !important', fontWeight: 'bold' }}
            >
              H1
            </button>

            <button
              onClick={() => editor && editor.chain().focus().toggleHeading({ level: 2 }).run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Heading 2"
              aria-label="Toggle Heading 2"
              style={{ color: editor?.isActive('heading', { level: 2 }) ? '#ffffff !important' : '#000000 !important', fontWeight: 'bold' }}
            >
              H2
            </button>

            <button
              onClick={() => editor && editor.chain().focus().toggleBulletList().run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('bulletList') ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Bullet List"
              aria-label="Toggle Bullet List"
              style={{ color: editor?.isActive('bulletList') ? '#ffffff !important' : '#000000 !important' }}
            >
              • List
            </button>

            <button
              onClick={() => editor && editor.chain().focus().toggleOrderedList().run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none ${editor?.isActive('orderedList') ? 'bg-gray-800 border-gray-800 hover:bg-gray-800' : ''}`}
              title="Numbered List"
              aria-label="Toggle Numbered List"
              style={{ color: editor?.isActive('orderedList') ? '#ffffff !important' : '#000000 !important' }}
            >
              1. List
            </button>

            <button
              onClick={() => editor && editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              disabled={!editor}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              title="Insert Table"
              aria-label="Insert Table"
              style={{ color: '#000000 !important' }}
            >
              Table
            </button>

            {editor?.isActive('table') && (
              <>
                <button
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  disabled={!editor}
                  className="px-2 py-1 min-h-[44px] text-xs rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  title="Add Row"
                  aria-label="Add Row After"
                  style={{ color: '#000000 !important' }}
                >
                  + Row
                </button>
                <button
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  disabled={!editor}
                  className="px-2 py-1 min-h-[44px] text-xs rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  title="Add Column"
                  aria-label="Add Column After"
                  style={{ color: '#000000 !important' }}
                >
                  + Col
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  disabled={!editor}
                  className="px-2 py-1 min-h-[44px] text-xs rounded border bg-white border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  title="Delete Row"
                  aria-label="Delete Current Row"
                  style={{ color: '#dc2626 !important' }}
                >
                  − Row
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  disabled={!editor}
                  className="px-2 py-1 min-h-[44px] text-xs rounded border bg-white border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  title="Delete Column"
                  aria-label="Delete Current Column"
                  style={{ color: '#dc2626 !important' }}
                >
                  − Col
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  disabled={!editor}
                  className="px-2 py-1 min-h-[44px] text-xs rounded border bg-white border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  title="Delete Table"
                  aria-label="Delete Entire Table"
                  style={{ color: '#dc2626 !important' }}
                >
                  Delete Table
                </button>
              </>
            )}

            <div className="ml-4 border-l pl-4">
              <button
                onClick={() => window.print()}
                className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                title="Print / Save as PDF"
                aria-label="Print Document"
                style={{ color: '#000000 !important', fontWeight: 'bold' }}
              >
                Print
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => exportToPDF()}
              className={`px-3 py-1 min-w-[44px] min-h-[44px] text-center rounded border bg-white border-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              title="Export to PDF"
              aria-label="Export Document to PDF"
              style={{ color: '#000000 !important', fontWeight: 'bold' }}
            >
              Export PDF
            </button>

            <div className="flex items-center gap-2">
              <label htmlFor="header-input" className="text-sm text-gray-600">Header:</label>
              <input
                id="header-input"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Header text"
                className="border rounded px-2 py-1 min-h-[44px] text-sm bg-white text-gray-900 border-gray-500 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Document Header Text"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="footer-input" className="text-sm text-gray-600">Footer:</label>
              <input
                id="footer-input"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Footer text (use {page} for page numbers)"
                className="border rounded px-2 py-1 min-h-[44px] text-sm bg-white text-gray-900 border-gray-500 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Document Footer Text"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 ml-4 cursor-pointer">
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
                className="w-5 h-5 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Show Page Numbers"
              />
              Show Page Numbers
            </label>
          </div>
        </div>

        {/* Editor Container */}
        <div
          className="flex-1 overflow-y-auto rounded-lg bg-white shadow-lg"
          style={{
            backgroundColor: '#f5f5f5',
          }}
        >
          <PageBreakVisualizer
            pageBreaks={pageBreaks}
            contentRef={contentRef}
            marginPx={MARGIN_PX}
            contentHeightPx={CONTENT_HEIGHT_PX}
            contentWidthPx={CONTENT_WIDTH_PX}
            totalPages={totalPages}
            headerText={headerText}
            footerText={footerText}
            showPageNumbers={showPageNumbers}
          >
            <div
              ref={contentRef}
              className="mx-auto bg-white relative"
              style={{
                width: `${CONTENT_WIDTH_PX}px`,
                margin: `0 auto`,
                padding: `${MARGIN_PX}px`,
                // make the editor area at least one page high and force readable text
                minHeight: `${CONTENT_HEIGHT_PX}px`,
                color: '#000000',
                WebkitTextFillColor: '#000000',
                caretColor: '#000000',
                zIndex: 1,
                position: 'relative',
              }}
            >
              {isEditorReady && editor && (
                <div className="prose text-black" style={{ color: '#000000' }}>
                  <EditorContent editor={editor} />
                </div>
              )}
            </div>
          </PageBreakVisualizer>
        </div>
      </div>

      {/* Sidebar with Info */}
      <div className="w-64 flex-shrink-0 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Document Info</h2>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-gray-600">Total Pages</p>
            <p className="text-2xl font-bold text-blue-600">{totalPages}</p>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 font-semibold text-gray-900">Page Dimensions</p>
            <ul className="space-y-1 text-gray-600">
              <li>Size: US Letter (8.5" × 11")</li>
              <li>Margins: 1" all sides</li>
              <li>Content: {Math.round(CONTENT_WIDTH_PX / 96 * 100) / 100}" × {Math.round(CONTENT_HEIGHT_PX / 96 * 100) / 100}"</li>
            </ul>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 font-semibold text-gray-900">Formatting Options</p>
            <div className="space-y-2 text-xs">
              <div className="rounded bg-gray-100 p-2 opacity-80" title="Formatting supported via keyboard shortcuts (e.g. Ctrl+B)">
                <p className="font-mono">Ctrl+B</p>
                <p className="text-gray-600">Bold</p>
              </div>
              <div className="rounded bg-gray-100 p-2 opacity-80" title="Formatting supported via keyboard shortcuts (e.g. Ctrl+I)">
                <p className="font-mono">Ctrl+I</p>
                <p className="text-gray-600">Italic</p>
              </div>
              <div className="rounded bg-gray-100 p-2 opacity-80" title="Formatting supported via keyboard shortcuts (e.g. Ctrl+Alt+1-6)">
                <p className="font-mono">Ctrl+Alt+1-6</p>
                <p className="text-gray-600">Headings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
