import React from 'react';
import { B, fontHead } from '../theme';

export function PrintStyles() {
  return (
    <style>{`
      @media print {
        /* Hide all navigation and UI chrome */
        .no-print,
        .chat-panel,
        header,
        nav,
        [data-no-print] { display: none !important; }

        /* Make print background white */
        body { background: #fff !important; color: #000 !important; }

        /* Print header */
        .print-header {
          display: block !important;
          padding: 16px 0;
          margin-bottom: 16px;
          border-bottom: 3px solid #000;
        }

        /* Charts in grayscale */
        .recharts-surface { filter: grayscale(100%); }

        /* Page breaks */
        .chart-card { page-break-inside: avoid; }

        /* Remove shadows in print */
        * { box-shadow: none !important; }
      }

      @media screen {
        .print-header { display: none; }
      }
    `}</style>
  );
}

export default function PDFExport({ monthLabel }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      className="no-print"
      style={{
        background: 'none',
        border: `1px solid ${B.cardBorder}`,
        color: B.textSecondary,
        padding: '6px 14px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: fontHead,
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
      title={`Export ${monthLabel} report to PDF`}
    >
      Export PDF
    </button>
  );
}
