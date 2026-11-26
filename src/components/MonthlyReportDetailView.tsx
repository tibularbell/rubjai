import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  ClaimRecord,
  computeAggregateTotals,
  computeMonthlySummaries,
  computeRecordReceived,
  formatMonthKeyThai,
  RepTransaction,
  UnitProfile,
} from '../types/report';
import {
  downloadMonthlyDetailCsv,
  downloadMonthlyDetailExcel,
  downloadPeriodDetailExcel,
} from '../utils/excelV3';
import { exportMonthlySummaryPdf } from '../utils/pdfSummary';

interface MonthlyReportDetailViewProps {
  unitProfile: UnitProfile | null;
  records: ClaimRecord[];
  repTransactions: RepTransaction[];
  onOpenImport: () => void;
  onNotify?: (msg: string) => void;
}

type ReportViewMode = 'period' | 'monthly';

function fmtMoney(n: number): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('th-TH');
}

function normalizePeriodKey(val: string): string {
  return val.replace(/^REP\s+/i, '').trim();
}

interface RepSectionTableProps {
  title: string;
  accentClass: string;
  rows: RepTransaction[];
  emptyText: string;
}

const RepSectionTable: React.FC<RepSectionTableProps> = ({
  title,
  accentClass,
  rows,
  emptyText,
}) => {
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.claimed += r.claimed || 0;
        acc.op += r.op || 0;
        acc.ipPaid += r.ipPaid || 0;
        acc.hcTotal += r.hcTotal || 0;
        acc.aeTotal += r.aeTotal || 0;
        acc.pp += r.pp || 0;
        acc.fs += r.fs || 0;
        acc.totalComp += r.totalComp || 0;
        return acc;
      },
      {
        claimed: 0,
        op: 0,
        ipPaid: 0,
        hcTotal: 0,
        aeTotal: 0,
        pp: 0,
        fs: 0,
        totalComp: 0,
      }
    );
  }, [rows]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div
        className={`px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 ${accentClass}`}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className="text-xs text-slate-500 font-mono-nums">
            {fmtInt(rows.length)} รายการ
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono-nums">
          <span className="text-slate-600">
            เรียกเก็บ:{' '}
            <strong className="text-slate-900">฿{fmtMoney(totals.claimed)}</strong>
          </span>
          <span className="text-slate-600">
            ยอดชดเชยทั้งสิ้น:{' '}
            <strong className="text-emerald-700">฿{fmtMoney(totals.totalComp)}</strong>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto grid-scroll">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-200/80 text-slate-800 border-b border-slate-300">
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                REP
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-center font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                ลำดับที่
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                TRAN_ID
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                HN
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                AN
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                PID
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2.5 text-left font-semibold border-r border-slate-300 min-w-[165px] whitespace-nowrap"
              >
                ชื่อ-นามสกุล
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 min-w-[140px] whitespace-nowrap"
              >
                วันเข้ารักษา
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                วันจำหน่าย
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-center font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                MAININSCL
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-left font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                PROJCODE
              </th>
              <th
                colSpan={3}
                className="px-2.5 py-1.5 text-center font-semibold border-r border-b border-slate-300 whitespace-nowrap"
              >
                หน่วยบริการ
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                เรียกเก็บ
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                OP
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                IP
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                HC
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                AE
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                PP
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2.5 text-right font-semibold border-r border-slate-300 whitespace-nowrap"
              >
                FS
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2.5 text-right font-semibold bg-emerald-50/80 text-emerald-900 whitespace-nowrap"
              >
                ยอดชดเชยทั้งสิ้น
              </th>
            </tr>
            <tr className="bg-slate-200/60 text-slate-700 border-b border-slate-300">
              <th className="px-2 py-1.5 text-center font-medium border-r border-slate-300 whitespace-nowrap">
                HTYPE_HCODE
              </th>
              <th className="px-2 py-1.5 text-center font-medium border-r border-slate-300 whitespace-nowrap">
                PROV_HCODE
              </th>
              <th className="px-2 py-1.5 text-center font-medium border-r border-slate-300 whitespace-nowrap">
                HCODE
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={22} className="px-4 py-6 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2.5 py-2 font-mono-nums text-slate-800 border-r border-slate-100 whitespace-nowrap">
                    {tx.repCode}
                  </td>
                  <td className="px-2 py-2 text-center font-mono-nums text-slate-700 border-r border-slate-100">
                    {tx.seq}
                  </td>
                  <td className="px-2.5 py-2 font-mono-nums text-slate-800 border-r border-slate-100 whitespace-nowrap">
                    {tx.tranId || '-'}
                  </td>
                  <td className="px-2.5 py-2 font-mono-nums text-slate-700 border-r border-slate-100 whitespace-nowrap">
                    {tx.hn || '-'}
                  </td>
                  <td className="px-2 py-2 font-mono-nums text-slate-500 border-r border-slate-100 whitespace-nowrap">
                    {tx.an || ''}
                  </td>
                  <td className="px-2.5 py-2 font-mono-nums text-slate-700 border-r border-slate-100 whitespace-nowrap">
                    {tx.pid || '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-900 font-medium border-r border-slate-100 whitespace-nowrap">
                    {tx.fullName || '-'}
                  </td>
                  <td className="px-2.5 py-2 font-mono-nums text-slate-600 border-r border-slate-100 whitespace-nowrap">
                    {tx.visitDate || '-'}
                  </td>
                  <td className="px-2.5 py-2 font-mono-nums text-slate-500 border-r border-slate-100 whitespace-nowrap">
                    {tx.dischargeDate || ''}
                  </td>
                  <td className="px-2 py-2 text-center font-mono-nums text-slate-700 border-r border-slate-100 whitespace-nowrap">
                    {tx.mainInscl || '-'}
                  </td>
                  <td className="px-2 py-2 font-mono-nums text-slate-600 border-r border-slate-100 whitespace-nowrap">
                    {tx.projCode || ''}
                  </td>
                  <td className="px-2 py-2 text-center font-mono-nums text-slate-600 border-r border-slate-100 whitespace-nowrap">
                    {tx.htypeHcode || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono-nums text-slate-600 border-r border-slate-100 whitespace-nowrap">
                    {tx.provHcode || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono-nums text-slate-700 border-r border-slate-100 whitespace-nowrap">
                    {tx.hcode || '-'}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono-nums text-slate-900 border-r border-slate-100">
                    {fmtMoney(tx.claimed)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.op)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.ipPaid)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.hcTotal)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.aeTotal)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.pp)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                    {fmtMoney(tx.fs)}
                  </td>
                  <td
                    className={`px-2.5 py-2 text-right font-mono-nums font-semibold ${
                      tx.totalComp > 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {fmtMoney(tx.totalComp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 font-mono-nums">
                <td colSpan={14} className="px-3 py-2.5 text-left font-sans border-r border-slate-200">
                  รวม{title} ({fmtInt(rows.length)} รายการ)
                </td>
                <td className="px-2.5 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.claimed)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.op)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.ipPaid)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.hcTotal)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.aeTotal)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.pp)}
                </td>
                <td className="px-2 py-2.5 text-right border-r border-slate-200">
                  {fmtMoney(totals.fs)}
                </td>
                <td className="px-2.5 py-2.5 text-right text-emerald-800">
                  {fmtMoney(totals.totalComp)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export const MonthlyReportDetailView: React.FC<MonthlyReportDetailViewProps> = ({
  unitProfile,
  records,
  repTransactions,
  onOpenImport,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<ReportViewMode>('period');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [txSearch, setTxSearch] = useState<string>('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  const allMonthlySummaries = useMemo(() => computeMonthlySummaries(records), [records]);

  const filteredRecords = useMemo(() => {
    const list =
      selectedMonth === 'ALL' ? records : records.filter((r) => r.monthKey === selectedMonth);
    return [...list].sort((a, b) => (a.seqNo || 0) - (b.seqNo || 0));
  }, [records, selectedMonth]);

  // Keep selectedPeriod synchronized with filteredRecords
  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedPeriod('');
      return;
    }
    if (
      selectedPeriod !== 'ALL' &&
      !filteredRecords.some((r) => r.reportPeriod === selectedPeriod)
    ) {
      setSelectedPeriod(filteredRecords[0].reportPeriod);
    }
  }, [filteredRecords, selectedPeriod]);

  const activePeriodRecord = useMemo(() => {
    if (selectedPeriod === 'ALL') return null;
    return (
      filteredRecords.find((r) => r.reportPeriod === selectedPeriod) ??
      filteredRecords[0] ??
      null
    );
  }, [filteredRecords, selectedPeriod]);

  const filteredRepTransactions = useMemo(() => {
    const allowedPeriods = new Set(filteredRecords.map((r) => normalizePeriodKey(r.reportPeriod)));
    const monthFiltered = repTransactions.filter((tx) => {
      if (selectedMonth !== 'ALL' && tx.monthKey !== selectedMonth) {
        return false;
      }
      if (allowedPeriods.size > 0) {
        const txKey = normalizePeriodKey(tx.reportPeriod || tx.repCode);
        if (!allowedPeriods.has(txKey) && selectedMonth !== 'ALL') {
          return false;
        }
      }
      return true;
    });

    const periodScoped =
      selectedPeriod && selectedPeriod !== 'ALL'
        ? monthFiltered.filter(
            (tx) =>
              tx.reportPeriod === selectedPeriod ||
              normalizePeriodKey(tx.reportPeriod || tx.repCode) ===
                normalizePeriodKey(selectedPeriod)
          )
        : monthFiltered;

    const q = txSearch.trim().toLowerCase();
    if (!q) return periodScoped;

    return periodScoped.filter((tx) => {
      const hay = `${tx.repCode} ${tx.tranId} ${tx.hn} ${tx.pid} ${tx.fullName} ${tx.visitDate} ${tx.projCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [repTransactions, filteredRecords, selectedMonth, selectedPeriod, txSearch]);

  const normalTransactions = useMemo(
    () => filteredRepTransactions.filter((t) => t.claimSection === 'normal'),
    [filteredRepTransactions]
  );

  const appealTransactions = useMemo(
    () => filteredRepTransactions.filter((t) => t.claimSection === 'appeal'),
    [filteredRepTransactions]
  );

  const visibleMonthlySummaries = useMemo(
    () => computeMonthlySummaries(filteredRecords),
    [filteredRecords]
  );

  const grandTotal = useMemo(
    () => computeAggregateTotals(filteredRecords),
    [filteredRecords]
  );

  const recordsByMonth = useMemo(() => {
    const map = new Map<string, ClaimRecord[]>();
    for (const r of filteredRecords) {
      const list = map.get(r.monthKey) ?? [];
      list.push(r);
      map.set(r.monthKey, list);
    }
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        [...list].sort((a, b) => (a.seqNo || 0) - (b.seqNo || 0))
      );
    }
    return map;
  }, [filteredRecords]);

  const txCountByPeriod = useMemo(() => {
    const map = new Map<string, { normal: number; appeal: number }>();
    for (const tx of repTransactions) {
      const key = normalizePeriodKey(tx.reportPeriod || tx.repCode);
      const curr = map.get(key) ?? { normal: 0, appeal: 0 };
      if (tx.claimSection === 'appeal') curr.appeal += 1;
      else curr.normal += 1;
      map.set(key, curr);
    }
    return map;
  }, [repTransactions]);

  const toggleMonthExpand = (monthKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const m of visibleMonthlySummaries) {
      next[m.monthKey] = true;
    }
    setExpandedMonths(next);
  };

  const collapseAll = () => {
    setExpandedMonths({});
  };

  const handleOpenPeriodDetail = (reportPeriod: string) => {
    setSelectedPeriod(reportPeriod);
    setViewMode('period');
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    try {
      const scopedTxs = repTransactions.filter(
        (tx) => selectedMonth === 'ALL' || tx.monthKey === selectedMonth
      );
      const filename = downloadMonthlyDetailExcel(
        filteredRecords,
        unitProfile?.unitCode || '',
        unitProfile?.unitName || '',
        undefined,
        scopedTxs
      );
      onNotify?.(
        `ส่งออกรายงานสรุปรายเดือนละเอียด Excel (${visibleMonthlySummaries.length} เดือน) เรียบร้อย: ${filename}`
      );
    } catch {
      onNotify?.('ไม่สามารถสร้างไฟล์ Excel รายงานสรุปรายเดือนได้');
    }
  };

  const handleExportPeriodExcel = () => {
    if (!activePeriodRecord) return;
    try {
      const periodTxs = repTransactions.filter(
        (tx) =>
          tx.reportPeriod === activePeriodRecord.reportPeriod ||
          normalizePeriodKey(tx.reportPeriod || tx.repCode) ===
            normalizePeriodKey(activePeriodRecord.reportPeriod)
      );
      const filename = downloadPeriodDetailExcel(
        activePeriodRecord.reportPeriod,
        periodTxs,
        unitProfile?.unitCode || '',
        unitProfile?.unitName || ''
      );
      onNotify?.(
        `ส่งออกรายละเอียดงวด ${activePeriodRecord.reportPeriod} (ข้อมูลปกติ/ข้อมูลอุทธรณ์) เรียบร้อย: ${filename}`
      );
    } catch {
      onNotify?.('ไม่สามารถสร้างไฟล์ Excel รายละเอียดงวดได้');
    }
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    try {
      const filename = downloadMonthlyDetailCsv(
        filteredRecords,
        unitProfile?.unitCode || '',
        unitProfile?.unitName || ''
      );
      onNotify?.(
        `ส่งออกรายงานสรุปรายเดือนละเอียด CSV (${visibleMonthlySummaries.length} เดือน) เรียบร้อย: ${filename}`
      );
    } catch {
      onNotify?.('ไม่สามารถสร้างไฟล์ CSV รายงานสรุปรายเดือนได้');
    }
  };

  const handleExportPdf = async () => {
    if (filteredRecords.length === 0 || exportingPdf) return;
    setExportingPdf(true);
    try {
      const filename = await exportMonthlySummaryPdf({
        records: filteredRecords,
        unitCode: unitProfile?.unitCode || '',
        unitName: unitProfile?.unitName || '',
        selectedMonth,
        selectedPeriod,
      });
      onNotify?.(
        `ส่งออกรายงานสรุปผลรายเดือนฉบับย่อ PDF (${visibleMonthlySummaries.length} เดือน) เรียบร้อย: ${filename}`
      );
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ PDF รายงานสรุปผลรายเดือนได้'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          ยังไม่มีข้อมูลสำหรับออกรายงานสรุปรายเดือน
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          กรุณานำเข้าไฟล์ Excel / CSV จากแม่แบบ REP หรือ V.3 5367 ก่อนเพื่อดูรายละเอียดตามรายงานงวด (ข้อมูลปกติ / ข้อมูลอุทธรณ์) และสรุปรายเดือน
        </p>
        <button
          type="button"
          onClick={onOpenImport}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4" />
          นำเข้าไฟล์ Excel / CSV
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              รายงานยอดสรุปรายเดือนและรายละเอียดตามรายงานงวด
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              หน่วยงาน{' '}
              <span className="font-mono-nums font-medium text-slate-700">
                {unitProfile?.unitCode || '-'}
              </span>{' '}
              {unitProfile?.unitName || '-'} · แสดงรายละเอียดข้อมูลปกติ / ข้อมูลอุทธรณ์ แยกรายงวดและสรุป V.3 5367
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="เลือกเดือนที่ต้องการออกรายงาน"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              <option value="ALL">ทุกเดือน ({allMonthlySummaries.length} เดือน)</option>
              {allMonthlySummaries.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.monthLabelTh} ({m.recordCount} งวด)
                </option>
              ))}
            </select>

            {viewMode === 'period' && activePeriodRecord && (
              <button
                type="button"
                onClick={handleExportPeriodExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                ส่งออก Excel งวดนี้ (ปกติ/อุทธรณ์)
              </button>
            )}

            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              ส่งออก Excel รายเดือน (.xlsx)
            </button>

            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              <FileDown className="w-3.5 h-3.5" />
              ส่งออก CSV รายเดือน
            </button>

            <button
              type="button"
              disabled={filteredRecords.length === 0 || exportingPdf}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 print:hidden"
            >
              <FileText className="w-3.5 h-3.5" />
              {exportingPdf ? 'กำลังสร้าง PDF...' : 'ส่งออก PDF ฉบับย่อ'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 print:hidden"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์รายงาน
            </button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('period')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'period'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายละเอียดตามรายงานงวด (ข้อมูลปกติ / ข้อมูลอุทธรณ์)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'monthly'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ตารางสรุปรายเดือน (V.3 5367)
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono-nums">
            {filteredRecords.length} งวด · {repTransactions.length} รายการธุรกรรมรายเคส
          </div>
        </div>
      </div>

      {/* Mode 1: By Report Period (ข้อมูลปกติ & ข้อมูลอุทธรณ์) */}
      {viewMode === 'period' && (
        <div className="space-y-5">
          {/* Period Selector & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <label
                  htmlFor="period-select"
                  className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  เลือกรายงานงวด:
                </label>
                <select
                  id="period-select"
                  value={selectedPeriod || activePeriodRecord?.reportPeriod || ''}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono-nums"
                >
                  {filteredRecords.map((r) => {
                    const counts = txCountByPeriod.get(normalizePeriodKey(r.reportPeriod));
                    const countLabel = counts
                      ? `ปกติ ${counts.normal} / อุทธรณ์ ${counts.appeal}`
                      : `${r.totalCases} เคส`;
                    return (
                      <option key={r.id} value={r.reportPeriod}>
                        #{r.seqNo} {r.reportPeriod} ({formatMonthKeyThai(r.monthKey)}) · {countLabel}
                      </option>
                    );
                  })}
                  <option value="ALL">
                    แสดงรวมทุกงวดในขอบเขต ({filteredRecords.length} งวด)
                  </option>
                </select>
              </div>

              <div className="relative min-w-[260px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setTxSearch('');
                  }}
                  placeholder="ค้นหาชื่อ-สกุล, HN, PID, TRAN_ID..."
                  aria-label="ค้นหารายการผู้ป่วยในรายงานงวด"
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
                {txSearch && (
                  <button
                    type="button"
                    onClick={() => setTxSearch('')}
                    aria-label="ล้างคำค้นหา"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Period Tabs */}
            <div className="flex flex-wrap gap-2 pt-1">
              {filteredRecords.map((r) => {
                const isSelected =
                  selectedPeriod === r.reportPeriod ||
                  (!selectedPeriod && activePeriodRecord?.reportPeriod === r.reportPeriod);
                const counts = txCountByPeriod.get(normalizePeriodKey(r.reportPeriod));
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedPeriod(r.reportPeriod)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors text-left ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono-nums">{r.reportPeriod}</span>
                    <span
                      className={`ml-2 text-[11px] font-mono-nums ${
                        isSelected ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      {counts
                        ? `(ปกติ ${counts.normal} · อุทธรณ์ ${counts.appeal})`
                        : `(${r.totalCases} เคส)`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Period Summary Strip */}
          {activePeriodRecord ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">รายงานงวด</div>
                <div className="text-base font-semibold text-slate-900 font-mono-nums">
                  {activePeriodRecord.reportPeriod}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  เดือน {formatMonthKeyThai(activePeriodRecord.monthKey)} ·{' '}
                  {fmtInt(activePeriodRecord.totalCases)} เคส
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">ยอดเรียกเก็บ (พึงรับ)</div>
                <div className="text-lg font-semibold text-sky-700 font-mono-nums">
                  ฿{fmtMoney(activePeriodRecord.claimedAmount)}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono-nums">
                  ลำดับงวด #{activePeriodRecord.seqNo}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">กรณีเบิกปกติ (V.3)</div>
                <div className="text-lg font-semibold text-slate-900 font-mono-nums">
                  ฿{fmtMoney(activePeriodRecord.normalReceivedAmount)}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono-nums">
                  ชดเชย {fmtInt(activePeriodRecord.normalCompensatedCases)} · ไม่ชดเชย{' '}
                  {fmtInt(activePeriodRecord.normalUncompensatedCases)} เคส
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">กรณีอุทธรณ์ข้อมูล (V.3)</div>
                <div className="text-lg font-semibold text-sky-700 font-mono-nums">
                  ฿{fmtMoney(activePeriodRecord.appealReceivedAmount)}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono-nums">
                  ได้รับ {fmtInt(activePeriodRecord.appealReceivedCases)} · ไม่ชดเชย{' '}
                  {fmtInt(activePeriodRecord.appealUncompensatedCases)} เคส
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">รวมได้รับจริง V.3 / คงเหลือ</div>
                <div className="text-lg font-semibold text-emerald-700 font-mono-nums">
                  ฿{fmtMoney(computeRecordReceived(activePeriodRecord))}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono-nums">
                  พึงจ่าย ฿{fmtMoney(activePeriodRecord.payableAmount)} · สุทธิ ฿
                  {fmtMoney(
                    computeRecordReceived(activePeriodRecord) -
                      (activePeriodRecord.payableAmount || 0)
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">ขอบเขตข้อมูลทั้งหมด</div>
                <div className="text-lg font-semibold text-slate-900 font-mono-nums">
                  {filteredRecords.length} งวด ({fmtInt(grandTotal.totalCases)} เคส)
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">ยอดเรียกเก็บพึงรับ</div>
                <div className="text-lg font-semibold text-sky-700 font-mono-nums">
                  ฿{fmtMoney(grandTotal.claimedAmount)}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">ยอดได้รับจริง V.3</div>
                <div className="text-lg font-semibold text-emerald-700 font-mono-nums">
                  ฿{fmtMoney(grandTotal.summaryAmount)}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">คงเหลือสุทธิ</div>
                <div className="text-lg font-semibold text-teal-700 font-mono-nums">
                  ฿{fmtMoney(grandTotal.netBalance)}
                </div>
              </div>
            </div>
          )}

          {/* Fallback banner when no transaction-level rows exist yet for the selected period */}
          {filteredRepTransactions.length === 0 && !txSearch ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-amber-900 space-y-1 max-w-2xl">
                <div className="font-semibold text-sm">
                  ยังไม่มีรายละเอียดรายเคส (TRAN_ID / HN / PID) สำหรับงวดนี้ในฐานข้อมูล
                </div>
                <p>
                  ข้อมูลสรุปยอดงวด (ปกติ/อุทธรณ์ และกองทุน V.3) แสดงด้านบนเรียบร้อยแล้ว หากต้องการแสดงตารางรายละเอียดผู้ป่วยแยกส่วน{' '}
                  <strong>ข้อมูลปกติ</strong> และ <strong>ข้อมูลอุทธรณ์</strong> ตามแบบฟอร์ม สปสช. กรุณานำเข้าไฟล์ REP รายเคสใหม่
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                นำเข้าไฟล์ REP รายเคส
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Section 1: ข้อมูลปกติ */}
              <RepSectionTable
                title="ข้อมูลปกติ"
                accentClass="border-l-4 border-l-teal-700"
                rows={normalTransactions}
                emptyText={
                  txSearch
                    ? 'ไม่พบรายการในส่วนข้อมูลปกติที่ตรงกับคำค้นหา'
                    : 'ไม่มีรายการในส่วนข้อมูลปกติสำหรับงวดที่เลือก'
                }
              />

              {/* Section 2: ข้อมูลอุทธรณ์ */}
              <RepSectionTable
                title="ข้อมูลอุทธรณ์"
                accentClass="border-l-4 border-l-sky-700"
                rows={appealTransactions}
                emptyText={
                  txSearch
                    ? 'ไม่พบรายการในส่วนข้อมูลอุทธรณ์ที่ตรงกับคำค้นหา'
                    : 'ไม่มีรายการในส่วนข้อมูลอุทธรณ์สำหรับงวดที่เลือก'
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Monthly Summary Table (V.3 5367) */}
      {viewMode === 'monthly' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 mb-1.5">ขอบเขตข้อมูลรายงาน</div>
              <div className="text-xl font-semibold text-slate-900 font-mono-nums">
                {visibleMonthlySummaries.length} เดือน ({grandTotal.recordCount} งวด)
              </div>
              <div className="text-xs text-slate-500 mt-1.5 font-mono-nums">
                เคสรวม {fmtInt(grandTotal.totalCases)} เคส
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 mb-1.5">ยอดเรียกเก็บพึงรับรวม</div>
              <div className="text-xl font-semibold text-sky-700 font-mono-nums">
                ฿{fmtMoney(grandTotal.claimedAmount)}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 font-mono-nums">
                ส่วนต่าง ฿{fmtMoney(grandTotal.claimGap)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 mb-1.5">ยอดได้รับชดเชยจริง V.3</div>
              <div className="text-xl font-semibold text-emerald-700 font-mono-nums">
                ฿{fmtMoney(grandTotal.summaryAmount)}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 font-mono-nums">
                อัตราชดเชย {grandTotal.compensationRatePct.toFixed(1)}% · ไม่ชดเชย{' '}
                {fmtInt(grandTotal.totalUncompensatedCases)} เคส
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 mb-1.5">ยอดพึงจ่าย / คงเหลือสุทธิ</div>
              <div
                className={`text-xl font-semibold font-mono-nums ${
                  grandTotal.netBalance >= 0 ? 'text-teal-700' : 'text-red-600'
                }`}
              >
                {grandTotal.netBalance >= 0 ? '฿' : '-฿'}
                {fmtMoney(Math.abs(grandTotal.netBalance))}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 font-mono-nums">
                พึงจ่ายรวม ฿{fmtMoney(grandTotal.payableAmount)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="text-xs text-slate-600">
                คลิกที่แถวเดือนเพื่อเปิดดูรายละเอียดงวดย่อย และกด &quot;ดูปกติ/อุทธรณ์&quot; เพื่อดูรายชื่อรายเคสของงวดนั้น
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors"
                >
                  กางรายละเอียดทุกเดือน
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors"
                >
                  ย่อทั้งหมด
                </button>
              </div>
            </div>

            <div className="overflow-x-auto grid-scroll">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                    <th className="px-3 py-3 text-left font-semibold border-r border-slate-200 min-w-[130px] sticky left-0 bg-slate-100 z-10">
                      เดือน (พ.ศ.)
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[64px]">
                      งวด
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[76px]">
                      เคสทั้งหมด
                    </th>
                    <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 min-w-[116px]">
                      เรียกเก็บ (พึงรับ)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 bg-teal-50/60 min-w-[108px]">
                      เบิกปกติ (บาท)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 bg-sky-50/60 min-w-[108px]">
                      อุทธรณ์ (บาท)
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 text-red-700 min-w-[84px]">
                      ไม่ชดเชย (เคส)
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[96px]">
                      สมุนไพร 9
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[86px]">
                      AE
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[86px]">
                      PP
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[96px]">
                      FS (OP)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 bg-emerald-50/70 text-emerald-900 min-w-[118px]">
                      ได้รับจริง V.3
                    </th>
                    <th className="px-2.5 py-3 text-right font-semibold border-r border-slate-200 min-w-[74px]">
                      % ชดเชย
                    </th>
                    <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 bg-amber-50/70 text-amber-900 min-w-[106px]">
                      พึงจ่าย (บาท)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold bg-teal-50/80 text-teal-900 min-w-[116px]">
                      คงเหลือสุทธิ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleMonthlySummaries.map((m) => {
                    const isExpanded = Boolean(expandedMonths[m.monthKey]);
                    const monthPeriods = recordsByMonth.get(m.monthKey) ?? [];

                    return (
                      <React.Fragment key={m.monthKey}>
                        <tr
                          onClick={() => toggleMonthExpand(m.monthKey)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-3 font-semibold text-slate-900 border-r border-slate-100 sticky left-0 bg-white z-10 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{m.monthLabelTh}</span>
                              <span className="text-[11px] font-normal text-slate-400 font-mono-nums">
                                ({m.monthKey})
                              </span>
                            </span>
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtInt(m.recordCount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtInt(m.totalCases)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono-nums font-medium text-slate-900 border-r border-slate-100">
                            {fmtMoney(m.claimedAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtMoney(m.normalReceivedAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono-nums text-sky-700 border-r border-slate-100">
                            {fmtMoney(m.appealReceivedAmount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums text-red-600 font-medium border-r border-slate-100">
                            {fmtInt(m.totalUncompensatedCases)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtMoney(m.herbalAmount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtMoney(m.aeAmount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtMoney(m.ppAmount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums border-r border-slate-100">
                            {fmtMoney(m.fsAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono-nums font-semibold text-emerald-700 border-r border-slate-100">
                            {fmtMoney(m.summaryAmount)}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono-nums text-slate-700 border-r border-slate-100">
                            {m.compensationRatePct.toFixed(1)}%
                          </td>
                          <td className="px-3 py-3 text-right font-mono-nums text-amber-700 font-medium border-r border-slate-100">
                            {fmtMoney(m.payableAmount)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono-nums font-semibold ${
                              m.netBalance >= 0 ? 'text-teal-700' : 'text-red-600'
                            }`}
                          >
                            {fmtMoney(m.netBalance)}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={15} className="bg-slate-50/90 px-4 py-3 border-b border-slate-200">
                              <div className="text-[11px] font-semibold text-slate-700 mb-2">
                                รายละเอียดงวดย่อยในเดือน {formatMonthKeyThai(m.monthKey)} ({monthPeriods.length} งวด)
                              </div>
                              <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                                      <th className="px-2.5 py-2 text-center font-medium border-r border-slate-200">
                                        ลำดับ
                                      </th>
                                      <th className="px-2.5 py-2 text-left font-medium border-r border-slate-200">
                                        รายงานงวด
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        เคสทั้งหมด
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        เรียกเก็บ
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        ปกติ
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        อุทธรณ์
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        ไม่ชดเชย
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        สมุนไพร 9
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        AE
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        PP
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        FS
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        รวมรับจริง
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        พึงจ่าย
                                      </th>
                                      <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200">
                                        คงเหลือสุทธิ
                                      </th>
                                      <th className="px-2.5 py-2 text-center font-medium print:hidden">
                                        รายละเอียดรายเคส
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {monthPeriods.map((p) => {
                                      const received = computeRecordReceived(p);
                                      const net = received - (p.payableAmount || 0);
                                      const uncomp =
                                        (p.normalUncompensatedCases || 0) +
                                        (p.appealUncompensatedCases || 0);
                                      return (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                          <td className="px-2.5 py-2 text-center font-mono-nums border-r border-slate-100">
                                            {p.seqNo}
                                          </td>
                                          <td className="px-2.5 py-2 font-medium text-slate-900 border-r border-slate-100 whitespace-nowrap">
                                            {p.reportPeriod}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtInt(p.totalCases)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.claimedAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.normalReceivedAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums text-sky-700 border-r border-slate-100">
                                            {fmtMoney(p.appealReceivedAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums text-red-600 border-r border-slate-100">
                                            {fmtInt(uncomp)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.herbalAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.aeAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.ppAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums border-r border-slate-100">
                                            {fmtMoney(p.fsAmount)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums font-semibold text-emerald-700 border-r border-slate-100">
                                            {fmtMoney(received)}
                                          </td>
                                          <td className="px-2.5 py-2 text-right font-mono-nums text-amber-700 border-r border-slate-100">
                                            {fmtMoney(p.payableAmount)}
                                          </td>
                                          <td
                                            className={`px-2.5 py-2 text-right font-mono-nums font-semibold border-r border-slate-100 ${
                                              net >= 0 ? 'text-teal-700' : 'text-red-600'
                                            }`}
                                          >
                                            {fmtMoney(net)}
                                          </td>
                                          <td className="px-2.5 py-2 text-center print:hidden">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenPeriodDetail(p.reportPeriod);
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded whitespace-nowrap"
                                            >
                                              <Eye className="w-3 h-3" />
                                              ดูปกติ/อุทธรณ์
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 font-mono-nums">
                    <td className="px-3 py-3 text-left font-sans border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                      รวมทั้งสิ้น ({visibleMonthlySummaries.length} เดือน)
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtInt(grandTotal.recordCount)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtInt(grandTotal.totalCases)}
                    </td>
                    <td className="px-3 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.claimedAmount)}
                    </td>
                    <td className="px-3 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.normalReceivedAmount)}
                    </td>
                    <td className="px-3 py-3 text-right text-sky-800 border-r border-slate-200">
                      {fmtMoney(grandTotal.appealReceivedAmount)}
                    </td>
                    <td className="px-2.5 py-3 text-right text-red-700 border-r border-slate-200">
                      {fmtInt(grandTotal.totalUncompensatedCases)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.herbalAmount)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.aeAmount)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.ppAmount)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {fmtMoney(grandTotal.fsAmount)}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-800 border-r border-slate-200">
                      {fmtMoney(grandTotal.summaryAmount)}
                    </td>
                    <td className="px-2.5 py-3 text-right border-r border-slate-200">
                      {grandTotal.compensationRatePct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-amber-800 border-r border-slate-200">
                      {fmtMoney(grandTotal.payableAmount)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right ${
                        grandTotal.netBalance >= 0 ? 'text-teal-800' : 'text-red-700'
                      }`}
                    >
                      {fmtMoney(grandTotal.netBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
