import { jsPDF } from 'jspdf';
import {
  ClaimRecord,
  computeAggregateTotals,
  computeMonthlySummaries,
  formatMonthKeyThai,
  MonthlySummary,
} from '../types/report';

function fmtMoney(n: number): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('th-TH');
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export interface MonthlySummaryPdfOptions {
  records: ClaimRecord[];
  unitCode: string;
  unitName: string;
  selectedMonth: string;
  selectedPeriod?: string;
}

export async function exportMonthlySummaryPdf({
  records,
  unitCode,
  unitName,
  selectedMonth,
  selectedPeriod,
}: MonthlySummaryPdfOptions): Promise<string> {
  if (records.length === 0) {
    throw new Error('ไม่มีข้อมูลสำหรับสร้างรายงาน PDF');
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }

  const monthlySummaries = computeMonthlySummaries(records);
  const grandTotal = computeAggregateTotals(records);

  const pageW = 1400;
  const pageH = 990;
  const scale = 2;
  const marginX = 40;
  const contentW = pageW - marginX * 2; // 1320px

  const colWidths = [150, 48, 62, 105, 100, 90, 68, 85, 75, 75, 85, 110, 68, 95, 104];
  const colHeaders = [
    'เดือน (พ.ศ.)',
    'งวด',
    'เคส',
    'เรียกเก็บ (พึงรับ)',
    'เบิกปกติ (บาท)',
    'อุทธรณ์ (บาท)',
    'ไม่ชดเชย',
    'สมุนไพร 9',
    'AE',
    'PP',
    'FS (OP)',
    'ได้รับจริง V.3',
    '% ชดเชย',
    'พึงจ่าย',
    'คงเหลือสุทธิ',
  ];

  const rowH = 34;
  const headerH = 40;
  const firstPageTableStartY = 232;
  const nextPageTableStartY = 122;
  const footerReserveH = 120;

  const firstPageMaxRows = Math.max(
    1,
    Math.floor((pageH - footerReserveH - firstPageTableStartY - headerH - rowH) / rowH)
  );
  const nextPageMaxRows = Math.max(
    1,
    Math.floor((pageH - footerReserveH - nextPageTableStartY - headerH - rowH) / rowH)
  );

  // Split monthlySummaries into page chunks
  const rowPages: MonthlySummary[][] = [];
  let cursor = 0;
  rowPages.push(monthlySummaries.slice(0, firstPageMaxRows));
  cursor += firstPageMaxRows;
  while (cursor < monthlySummaries.length) {
    rowPages.push(monthlySummaries.slice(cursor, cursor + nextPageMaxRows));
    cursor += nextPageMaxRows;
  }

  const totalPages = rowPages.length;
  const now = new Date();
  const thaiPrintDate = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const scopeText =
    selectedMonth === 'ALL'
      ? `ทุกเดือน (${monthlySummaries.length} เดือน / ${grandTotal.recordCount} งวด)`
      : `เดือน ${formatMonthKeyThai(selectedMonth)} (${grandTotal.recordCount} งวด)`;
  const periodSuffix =
    selectedPeriod && selectedPeriod !== 'ALL' ? ` · งวดที่ดูอยู่: ${selectedPeriod}` : '';

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const fontSans = '"Noto Sans Thai", "Plus Jakarta Sans", sans-serif';
  const fontMono = '"JetBrains Mono", "Noto Sans Thai", monospace';

  rowPages.forEach((rowsOnPage, pageIdx) => {
    const canvas = document.createElement('canvas');
    canvas.width = pageW * scale;
    canvas.height = pageH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ไม่สามารถเตรียมพื้นที่วาดรายงาน PDF ได้');
    }

    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);

    // Top clinical teal bar
    ctx.fillStyle = '#0F766E';
    ctx.fillRect(0, 0, pageW, 8);

    // Document Header
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 22px ${fontSans}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      'รายงานสรุปผลยอดพึงรับ-พึงจ่ายรายเดือน (ฉบับย่อ) · มาตรฐาน V.3 5367',
      marginX,
      26
    );

    ctx.fillStyle = '#475569';
    ctx.font = `500 13px ${fontSans}`;
    ctx.fillText(
      `หน่วยบริการ: ${unitCode || '-'} ${unitName || '-'}   |   ขอบเขตข้อมูล: ${scopeText}${periodSuffix}`,
      marginX,
      58
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = `500 12px ${fontSans}`;
    ctx.fillText(
      `พิมพ์เมื่อ: ${thaiPrintDate}   |   หน้า ${pageIdx + 1} / ${totalPages}`,
      pageW - marginX,
      30
    );

    // Divider under header
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, 88);
    ctx.lineTo(pageW - marginX, 88);
    ctx.stroke();

    // KPI Summary Cards on Page 1
    if (pageIdx === 0) {
      const gap = 16;
      const cardW = (contentW - gap * 3) / 4;
      const cardY = 106;
      const cardH = 104;

      const cards = [
        {
          label: 'ขอบเขตข้อมูลรายงาน',
          value: `${monthlySummaries.length} เดือน (${grandTotal.recordCount} งวด)`,
          sub: `เคสรวม ${fmtInt(grandTotal.totalCases)} เคส`,
          valueColor: '#0F172A',
        },
        {
          label: 'ยอดเรียกเก็บพึงรับรวม',
          value: `฿${fmtMoney(grandTotal.claimedAmount)}`,
          sub: `ส่วนต่างเรียกเก็บ ฿${fmtMoney(grandTotal.claimGap)}`,
          valueColor: '#0369A1',
        },
        {
          label: 'ยอดได้รับชดเชยจริง V.3',
          value: `฿${fmtMoney(grandTotal.summaryAmount)}`,
          sub: `อัตราชดเชย ${grandTotal.compensationRatePct.toFixed(1)}% · ไม่ชดเชย ${fmtInt(grandTotal.totalUncompensatedCases)} เคส`,
          valueColor: '#047857',
        },
        {
          label: 'ยอดพึงจ่าย / คงเหลือสุทธิ',
          value: `${grandTotal.netBalance >= 0 ? '฿' : '-฿'}${fmtMoney(Math.abs(grandTotal.netBalance))}`,
          sub: `ยอดพึงจ่ายรวม ฿${fmtMoney(grandTotal.payableAmount)}`,
          valueColor: grandTotal.netBalance >= 0 ? '#0F766E' : '#DC2626',
        },
      ];

      cards.forEach((c, idx) => {
        const cx = marginX + idx * (cardW + gap);
        drawRoundedRect(ctx, cx, cardY, cardW, cardH, 8, '#F8FAFC', '#CBD5E1', 1);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.font = `600 12px ${fontSans}`;
        ctx.fillText(c.label, cx + 16, cardY + 16);

        ctx.fillStyle = c.valueColor;
        ctx.font = `700 21px ${fontMono}`;
        ctx.fillText(c.value, cx + 16, cardY + 42);

        ctx.fillStyle = '#475569';
        ctx.font = `400 12px ${fontSans}`;
        ctx.fillText(c.sub, cx + 16, cardY + 76);
      });
    }

    // Table Header
    const tableY = pageIdx === 0 ? firstPageTableStartY : nextPageTableStartY;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(marginX, tableY, contentW, headerH);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, tableY, contentW, headerH);

    let colX = marginX;
    colWidths.forEach((w, idx) => {
      ctx.fillStyle = '#1E293B';
      ctx.font = `600 11.5px ${fontSans}`;
      ctx.textBaseline = 'middle';
      if (idx === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(colHeaders[idx], colX + 8, tableY + headerH / 2);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(colHeaders[idx], colX + w - 7, tableY + headerH / 2);
      }
      if (idx < colWidths.length - 1) {
        ctx.strokeStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.moveTo(colX + w, tableY);
        ctx.lineTo(colX + w, tableY + headerH);
        ctx.stroke();
      }
      colX += w;
    });

    // Table Rows
    let curY = tableY + headerH;
    rowsOnPage.forEach((m, rIdx) => {
      if (rIdx % 2 === 1) {
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(marginX, curY, contentW, rowH);
      }

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(marginX, curY, contentW, rowH);

      const values = [
        `${m.monthLabelTh} (${m.monthKey})`,
        fmtInt(m.recordCount),
        fmtInt(m.totalCases),
        fmtMoney(m.claimedAmount),
        fmtMoney(m.normalReceivedAmount),
        fmtMoney(m.appealReceivedAmount),
        fmtInt(m.totalUncompensatedCases),
        fmtMoney(m.herbalAmount),
        fmtMoney(m.aeAmount),
        fmtMoney(m.ppAmount),
        fmtMoney(m.fsAmount),
        fmtMoney(m.summaryAmount),
        `${m.compensationRatePct.toFixed(1)}%`,
        fmtMoney(m.payableAmount),
        fmtMoney(m.netBalance),
      ];

      let cx = marginX;
      values.forEach((val, idx) => {
        ctx.textBaseline = 'middle';
        if (idx === 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#0F172A';
          ctx.font = `600 11.5px ${fontSans}`;
          ctx.fillText(val, cx + 8, curY + rowH / 2);
        } else {
          ctx.textAlign = 'right';
          if (idx === 5) ctx.fillStyle = '#0369A1';
          else if (idx === 6) ctx.fillStyle = '#DC2626';
          else if (idx === 11) ctx.fillStyle = '#047857';
          else if (idx === 13) ctx.fillStyle = '#B45309';
          else if (idx === 14) ctx.fillStyle = m.netBalance >= 0 ? '#0F766E' : '#DC2626';
          else ctx.fillStyle = '#334155';

          ctx.font = `${idx === 11 || idx === 14 ? '600' : '400'} 11.5px ${fontMono}`;
          ctx.fillText(val, cx + colWidths[idx] - 7, curY + rowH / 2);
        }
        if (idx < colWidths.length - 1) {
          ctx.strokeStyle = '#F1F5F9';
          ctx.beginPath();
          ctx.moveTo(cx + colWidths[idx], curY);
          ctx.lineTo(cx + colWidths[idx], curY + rowH);
          ctx.stroke();
        }
        cx += colWidths[idx];
      });

      curY += rowH;
    });

    // Grand Total Row & Sign-Off Block on last page
    if (pageIdx === totalPages - 1) {
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(marginX, curY, contentW, rowH + 2);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(marginX, curY, contentW, rowH + 2);

      const footerValues = [
        `รวมทั้งสิ้น (${monthlySummaries.length} เดือน)`,
        fmtInt(grandTotal.recordCount),
        fmtInt(grandTotal.totalCases),
        fmtMoney(grandTotal.claimedAmount),
        fmtMoney(grandTotal.normalReceivedAmount),
        fmtMoney(grandTotal.appealReceivedAmount),
        fmtInt(grandTotal.totalUncompensatedCases),
        fmtMoney(grandTotal.herbalAmount),
        fmtMoney(grandTotal.aeAmount),
        fmtMoney(grandTotal.ppAmount),
        fmtMoney(grandTotal.fsAmount),
        fmtMoney(grandTotal.summaryAmount),
        `${grandTotal.compensationRatePct.toFixed(1)}%`,
        fmtMoney(grandTotal.payableAmount),
        fmtMoney(grandTotal.netBalance),
      ];

      let fx = marginX;
      footerValues.forEach((val, idx) => {
        ctx.textBaseline = 'middle';
        if (idx === 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#0F172A';
          ctx.font = `700 12px ${fontSans}`;
          ctx.fillText(val, fx + 8, curY + (rowH + 2) / 2);
        } else {
          ctx.textAlign = 'right';
          if (idx === 5) ctx.fillStyle = '#075985';
          else if (idx === 6) ctx.fillStyle = '#B91C1C';
          else if (idx === 11) ctx.fillStyle = '#065F46';
          else if (idx === 13) ctx.fillStyle = '#92400E';
          else if (idx === 14) ctx.fillStyle = grandTotal.netBalance >= 0 ? '#115E59' : '#B91C1C';
          else ctx.fillStyle = '#0F172A';

          ctx.font = `700 11.5px ${fontMono}`;
          ctx.fillText(val, fx + colWidths[idx] - 7, curY + (rowH + 2) / 2);
        }
        fx += colWidths[idx];
      });

      // Sign-off block near bottom
      const signY = Math.max(curY + rowH + 34, pageH - 84);
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#475569';
      ctx.font = `500 12px ${fontSans}`;

      ctx.textAlign = 'left';
      ctx.fillText(
        'หมายเหตุ: รายงานฉบับย่อนี้สร้างจากระบบรายงานพึงรับ-พึงจ่าย รพ.สต. (มาตรฐาน V.3 5367)',
        marginX,
        signY
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(
        'ลงชื่อ ...................................................... ผู้จัดทำรายงาน        ลงชื่อ ...................................................... ผู้อนุมัติ / ผู้อำนวยการ รพ.สต.',
        pageW - marginX,
        signY + 28
      );
    }

    const imgData = canvas.toDataURL('image/png');
    if (pageIdx > 0) {
      pdf.addPage('a4', 'landscape');
    }
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  });

  const dateTag = now.toISOString().slice(0, 10);
  const safeCode = (unitCode || 'RPHST').replace(/[^a-zA-Z0-9_-]/g, '');
  const monthTag = selectedMonth === 'ALL' ? 'ALL' : selectedMonth;
  const filename = `รายงานสรุปผลรายเดือนฉบับย่อ_${safeCode}_${monthTag}_${dateTag}.pdf`;
  pdf.save(filename);
  return filename;
}
