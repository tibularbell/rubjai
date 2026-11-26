import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ClaimRecord,
  ClaimRecordInput,
  computeAggregateTotals,
  computeMonthlySummaries,
  computeRecordReceived,
  UnitProfile,
} from '../types/report';
import {
  downloadCsvReport,
  downloadExcelReport,
  downloadSampleTemplateExcel,
} from '../utils/excelV3';

interface ReportGridViewProps {
  unitProfile: UnitProfile | null;
  records: ClaimRecord[];
  onOpenImport: () => void;
  onOpenManual: () => void;
  onGoSso: () => void;
  onUpdateRow: (recordId: string, updated: ClaimRecordInput) => Promise<void>;
  onAddRow: (row: ClaimRecordInput) => Promise<void>;
  onDeleteRow: (recordId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onNotify?: (msg: string) => void;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('th-TH');
}

const EMPTY_ROW: ClaimRecordInput = {
  seqNo: 1,
  reportPeriod: 'งวด 01/2569',
  monthKey: '2026-01',
  totalCases: 0,
  claimedAmount: 0,
  normalReceivedAmount: 0,
  normalCompensatedCases: 0,
  normalUncompensatedCases: 0,
  appealReceivedAmount: 0,
  appealReceivedCases: 0,
  appealUncompensatedCases: 0,
  herbalAmount: 0,
  herbalCases: 0,
  aeAmount: 0,
  aeCases: 0,
  ppAmount: 0,
  ppCases: 0,
  fsAmount: 0,
  fsCases: 0,
  summaryAmount: 0,
  summaryCases: 0,
  payableAmount: 0,
  note: '',
};

export const ReportGridView: React.FC<ReportGridViewProps> = ({
  unitProfile,
  records,
  onOpenImport,
  onOpenManual,
  onGoSso,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onClearAll,
  onNotify,
}) => {
  const [searchText, setSearchText] = useState('');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [draftRow, setDraftRow] = useState<ClaimRecordInput>(EMPTY_ROW);
  const [savingRow, setSavingRow] = useState(false);

  const months = useMemo(() => computeMonthlySummaries(records), [records]);
  const monthLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of months) {
      map.set(m.monthKey, m.monthLabelTh.toLowerCase());
    }
    return map;
  }, [months]);

  const filteredRecords = useMemo(() => {
    const tokens = searchText
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return records.filter((r) => {
      if (monthFilter !== 'ALL' && r.monthKey !== monthFilter) return false;
      if (tokens.length === 0) return true;

      const monthLabel = monthLabelMap.get(r.monthKey) || '';
      const haystack = [
        r.reportPeriod,
        String(r.seqNo),
        `#${r.seqNo}`,
        r.monthKey,
        monthLabel,
        r.note,
      ]
        .join(' ')
        .toLowerCase();

      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [records, searchText, monthFilter, monthLabelMap]);

  const totals = useMemo(() => computeAggregateTotals(filteredRecords), [filteredRecords]);

  const startEdit = (r: ClaimRecord) => {
    setIsAddingNew(false);
    setEditingId(r.id);
    setDraftRow({
      seqNo: r.seqNo,
      reportPeriod: r.reportPeriod,
      monthKey: r.monthKey,
      totalCases: r.totalCases,
      claimedAmount: r.claimedAmount,
      normalReceivedAmount: r.normalReceivedAmount,
      normalCompensatedCases: r.normalCompensatedCases,
      normalUncompensatedCases: r.normalUncompensatedCases,
      appealReceivedAmount: r.appealReceivedAmount,
      appealReceivedCases: r.appealReceivedCases,
      appealUncompensatedCases: r.appealUncompensatedCases,
      herbalAmount: r.herbalAmount,
      herbalCases: r.herbalCases,
      aeAmount: r.aeAmount,
      aeCases: r.aeCases,
      ppAmount: r.ppAmount,
      ppCases: r.ppCases,
      fsAmount: r.fsAmount,
      fsCases: r.fsCases,
      summaryAmount: computeRecordReceived(r),
      summaryCases: r.summaryCases,
      payableAmount: r.payableAmount,
      note: r.note,
    });
  };

  const startAddNew = () => {
    setEditingId(null);
    setIsAddingNew(true);
    const nextSeq = records.reduce((m, r) => Math.max(m, r.seqNo || 0), 0) + 1;
    setDraftRow({
      ...EMPTY_ROW,
      seqNo: nextSeq,
      reportPeriod: `งวด ${String(nextSeq).padStart(2, '0')}/2569`,
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRow(true);
    try {
      const autoSummaryAmount =
        draftRow.summaryAmount > 0
          ? draftRow.summaryAmount
          : draftRow.normalReceivedAmount +
            draftRow.appealReceivedAmount +
            draftRow.herbalAmount +
            draftRow.aeAmount +
            draftRow.ppAmount +
            draftRow.fsAmount;
      const autoSummaryCases =
        draftRow.summaryCases > 0
          ? draftRow.summaryCases
          : draftRow.normalCompensatedCases +
            draftRow.appealReceivedCases +
            draftRow.herbalCases +
            draftRow.aeCases +
            draftRow.ppCases +
            draftRow.fsCases;

      const payload: ClaimRecordInput = {
        ...draftRow,
        summaryAmount: autoSummaryAmount,
        summaryCases: autoSummaryCases,
      };

      if (isAddingNew) {
        await onAddRow(payload);
      } else if (editingId) {
        await onUpdateRow(editingId, payload);
      }
      setEditingId(null);
      setIsAddingNew(false);
    } finally {
      setSavingRow(false);
    }
  };

  const updateNumField = (key: keyof ClaimRecordInput, val: string) => {
    const n = Number(val);
    setDraftRow((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) && n >= 0 ? n : 0,
    }));
  };

  const handleExportExcelV3 = () => {
    if (filteredRecords.length === 0) return;
    try {
      const filename = downloadExcelReport(
        filteredRecords,
        unitProfile?.unitCode || '',
        unitProfile?.unitName || ''
      );
      onNotify?.(
        `ส่งออกไฟล์ Excel มาตรฐาน V.3 5367 (${filteredRecords.length} งวด) เรียบร้อย: ${filename}`
      );
    } catch {
      onNotify?.('ไม่สามารถสร้างไฟล์ Excel V.3 5367 ได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    try {
      const filename = downloadCsvReport(
        filteredRecords,
        unitProfile?.unitCode || '',
        unitProfile?.unitName || ''
      );
      onNotify?.(
        `ส่งออกไฟล์ CSV มาตรฐาน V.3 5367 (${filteredRecords.length} งวด) เรียบร้อย: ${filename}`
      );
    } catch {
      onNotify?.('ไม่สามารถสร้างไฟล์ CSV ได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="space-y-4">
      {/* Workspace Command Bar (inspired by V.3 5367 controls) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Excel / CSV
          </button>

          <button
            type="button"
            onClick={startAddNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มรายการงวด
          </button>

          <button
            type="button"
            onClick={() => downloadSampleTemplateExcel()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            โหลดแม่แบบตัวอย่าง (.xlsx)
          </button>

          <button
            type="button"
            disabled={filteredRecords.length === 0}
            onClick={handleExportExcelV3}
            title={`ส่งออกตารางเป็นไฟล์ Excel มาตรฐาน V.3 5367 (${filteredRecords.length} งวด)`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            ส่งออก Excel (V.3 5367)
          </button>

          <button
            type="button"
            disabled={filteredRecords.length === 0}
            onClick={handleExportCsv}
            aria-label="Export to CSV"
            title={`ส่งออกข้อมูลที่กรองไว้เป็นไฟล์ CSV มาตรฐาน V.3 5367 (${filteredRecords.length} งวด)`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <FileDown className="w-3.5 h-3.5" />
            ส่งออก CSV (V.3 5367)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            type="button"
            onClick={onOpenManual}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            คู่มือการใช้งานและการแก้ไขปัญหา
          </button>

          <button
            type="button"
            onClick={onGoSso}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            ส่งข้อมูลให้ สสอ.
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[240px] max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchText) {
                  setSearchText('');
                }
              }}
              aria-label="ค้นหาข้อมูลตามชื่อรายการหรือรหัสงวด"
              placeholder="ค้นหาตามชื่อรายการ รหัสงวด (เช่น REP, 690700001) ลำดับ หรือหมายเหตุ..."
              className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-colors"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                aria-label="ล้างคำค้นหา"
                title="ล้างคำค้นหา (Esc)"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="กรองตามเดือน"
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
          >
            <option value="ALL">ทุกเดือน ({records.length} งวด)</option>
            {months.map((m) => (
              <option key={m.monthKey} value={m.monthKey}>
                {m.monthLabelTh} ({m.recordCount} งวด)
              </option>
            ))}
          </select>

          {(searchText || monthFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                setMonthFilter('ALL');
              }}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono-nums whitespace-nowrap shrink-0">
          แม่แบบมาตรฐาน <span className="font-semibold text-slate-800">V.3 5367</span> · พบ{' '}
          <span className="font-semibold text-teal-700">{filteredRecords.length}</span> จาก{' '}
          {records.length} รายการ
        </div>
      </div>

      {/* High-Density Hierarchical Table Matching V.3 5367 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto grid-scroll">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                <th rowSpan={2} className="px-3 py-2.5 text-center font-semibold border-r border-slate-200 sticky left-0 bg-slate-100 z-20 min-w-[56px]">
                  ลำดับ
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border-r border-slate-200 sticky left-[56px] bg-slate-100 z-20 min-w-[170px]">
                  รายงานงวด
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 min-w-[96px]">
                  จำนวนเคสทั้งหมด
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 min-w-[116px]">
                  จำนวนเงินที่เรียกเก็บ
                </th>
                <th colSpan={3} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200 bg-teal-50/70 text-teal-900">
                  กรณีเบิกปกติ
                </th>
                <th colSpan={3} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200 bg-sky-50/70 text-sky-900">
                  กรณีอุทธรณ์ข้อมูล
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200 bg-emerald-50/60 text-emerald-900">
                  ยาสมุนไพร 9 รายการ
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200">
                  AE
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200">
                  PP
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200">
                  FS (OP Anywhere)
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center font-semibold border-r border-b border-slate-200 bg-slate-200/60">
                  รวมรับ (V.3)
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 bg-amber-50/70 text-amber-900 min-w-[112px]">
                  ยอดพึงจ่าย (บาท)
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 bg-teal-50/80 text-teal-900 min-w-[118px]">
                  คงเหลือสุทธิ
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border-r border-slate-200 min-w-[160px]">
                  หมายเหตุ
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-center font-semibold min-w-[84px]">
                  จัดการ
                </th>
              </tr>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px]">
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[104px]">จำนวนเงินที่ได้รับ</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[92px]">เคสได้รับชดเชย</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 text-red-700 min-w-[96px]">เคสไม่ได้รับชดเชย</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[104px]">จำนวนเงินที่ได้รับ</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[84px]">เคสที่ได้รับ</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 text-red-700 min-w-[96px]">เคสไม่ได้รับชดเชย</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[90px]">จำนวนเงิน</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[60px]">เคส</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[90px]">จำนวนเงิน</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[60px]">เคส</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[90px]">จำนวนเงิน</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[60px]">เคส</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[90px]">จำนวนเงิน</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[60px]">เคส</th>

                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[104px]">จำนวนเงิน</th>
                <th className="px-2.5 py-2 text-right font-medium border-r border-slate-200 min-w-[68px]">เคส</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={24} className="px-4 py-12 text-center text-slate-500">
                    {searchText || monthFilter !== 'ALL' ? (
                      <div className="space-y-2">
                        <div>ไม่พบข้อมูลที่ตรงกับคำค้นหา &quot;{searchText || monthFilter}&quot;</div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchText('');
                            setMonthFilter('ALL');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          ล้างคำค้นหาและแสดงทั้งหมด
                        </button>
                      </div>
                    ) : (
                      'ไม่พบรายการข้อมูลที่ตรงกับเงื่อนไข — กดปุ่ม "Import Excel / CSV" หรือ "เพิ่มรายการงวด" เพื่อบันทึกข้อมูล'
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const recSum = computeRecordReceived(r);
                  const net = recSum - (r.payableAmount || 0);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="px-3 py-2.5 text-center font-mono-nums text-slate-600 border-r border-slate-100 sticky left-0 bg-white z-10">
                        {r.seqNo}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 border-r border-slate-100 sticky left-[56px] bg-white z-10 whitespace-nowrap">
                        {r.reportPeriod}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtInt(r.totalCases)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-nums font-medium text-slate-900 border-r border-slate-100">
                        {fmtMoney(r.claimedAmount)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtMoney(r.normalReceivedAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtInt(r.normalCompensatedCases)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-red-600 font-medium border-r border-slate-100">
                        {fmtInt(r.normalUncompensatedCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-teal-700 border-r border-slate-100">
                        {fmtMoney(r.appealReceivedAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtInt(r.appealReceivedCases)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-red-600 font-medium border-r border-slate-100">
                        {fmtInt(r.appealUncompensatedCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtMoney(r.herbalAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-slate-600 border-r border-slate-100">
                        {fmtInt(r.herbalCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtMoney(r.aeAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-slate-600 border-r border-slate-100">
                        {fmtInt(r.aeCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtMoney(r.ppAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-slate-600 border-r border-slate-100">
                        {fmtInt(r.ppCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums border-r border-slate-100">
                        {fmtMoney(r.fsAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-slate-600 border-r border-slate-100">
                        {fmtInt(r.fsCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums font-semibold text-emerald-700 border-r border-slate-100">
                        {fmtMoney(recSum)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono-nums font-medium border-r border-slate-100">
                        {fmtInt(r.summaryCases)}
                      </td>

                      <td className="px-2.5 py-2.5 text-right font-mono-nums text-amber-700 font-medium border-r border-slate-100">
                        {fmtMoney(r.payableAmount)}
                      </td>
                      <td
                        className={`px-2.5 py-2.5 text-right font-mono-nums font-semibold border-r border-slate-100 ${
                          net >= 0 ? 'text-teal-700' : 'text-red-600'
                        }`}
                      >
                        {fmtMoney(net)}
                      </td>

                      <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 max-w-[200px] truncate" title={r.note}>
                        {r.note || '-'}
                      </td>

                      <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-slate-500 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors"
                          title="แก้ไขรายการและยอดพึงจ่าย"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(r.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors ml-1"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Summary Footer Row ("รวม") */}
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 font-mono-nums">
                <td className="px-3 py-3 text-center border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                  รวม
                </td>
                <td className="px-3 py-3 text-left border-r border-slate-200 sticky left-[56px] bg-slate-100 z-10 font-sans">
                  {totals.recordCount} งวด
                </td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{fmtInt(totals.totalCases)}</td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{fmtMoney(totals.claimedAmount)}</td>

                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtMoney(totals.normalReceivedAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.normalCompensatedCases)}</td>
                <td className="px-2.5 py-3 text-right text-red-700 border-r border-slate-200">{fmtInt(totals.normalUncompensatedCases)}</td>

                <td className="px-2.5 py-3 text-right text-teal-800 border-r border-slate-200">{fmtMoney(totals.appealReceivedAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.appealReceivedCases)}</td>
                <td className="px-2.5 py-3 text-right text-red-700 border-r border-slate-200">{fmtInt(totals.appealUncompensatedCases)}</td>

                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtMoney(totals.herbalAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.herbalCases)}</td>

                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtMoney(totals.aeAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.aeCases)}</td>

                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtMoney(totals.ppAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.ppCases)}</td>

                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtMoney(totals.fsAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.fsCases)}</td>

                <td className="px-2.5 py-3 text-right text-emerald-800 border-r border-slate-200">{fmtMoney(totals.summaryAmount)}</td>
                <td className="px-2.5 py-3 text-right border-r border-slate-200">{fmtInt(totals.summaryCases)}</td>

                <td className="px-2.5 py-3 text-right text-amber-800 border-r border-slate-200">{fmtMoney(totals.payableAmount)}</td>
                <td
                  className={`px-2.5 py-3 text-right border-r border-slate-200 ${
                    totals.netBalance >= 0 ? 'text-teal-800' : 'text-red-700'
                  }`}
                >
                  {fmtMoney(totals.netBalance)}
                </td>
                <td colSpan={2} className="px-3 py-3 text-left font-sans text-slate-600 font-normal">
                  สรุปรวมตามตาราง V.3 5367
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Unit & Grand Total Strip matching original template */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 mr-2">จำนวนเงินทั้งสิ้น (ได้รับจริง):</span>
              <span className="font-mono-nums font-semibold text-slate-900">
                ฿{fmtMoney(totals.summaryAmount)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 mr-2">จำนวนเคส:</span>
              <span className="font-mono-nums font-semibold text-slate-900">
                {fmtInt(totals.summaryCases)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 mr-2">ยอดพึงจ่ายรวม:</span>
              <span className="font-mono-nums font-semibold text-amber-700">
                ฿{fmtMoney(totals.payableAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>
              รหัสหน่วยงาน:{' '}
              <strong className="font-mono-nums text-slate-900">
                {unitProfile?.unitCode || '-'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              ชื่อหน่วยงาน:{' '}
              <strong className="text-slate-900">{unitProfile?.unitName || '-'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Confirm Clear Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              ยืนยันการล้างข้อมูลตารางทั้งหมด (Clear)
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              การดำเนินการนี้จะลบข้อมูลรายงานงวดทั้งหมด ({records.length} รายการ) ออกจากฐานข้อมูล NoSQL
              ของหน่วยงานนี้ (ประวัติการส่งให้ สสอ. จะยังคงอยู่)
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  try {
                    await onClearAll();
                    setConfirmClearOpen(false);
                  } finally {
                    setClearing(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {clearing ? 'กำลังลบ...' : 'ยืนยันลบทั้งหมด'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Row Modal */}
      {(editingId !== null || isAddingNew) && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {isAddingNew ? 'เพิ่มรายการรายงานงวดใหม่ (V.3 5367)' : `แก้ไขข้อมูล: ${draftRow.reportPeriod}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setIsAddingNew(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ลำดับ</label>
                  <input
                    type="number"
                    min={1}
                    value={draftRow.seqNo}
                    onChange={(e) => updateNumField('seqNo', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-nums"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">รายงานงวด</label>
                  <input
                    type="text"
                    value={draftRow.reportPeriod}
                    onChange={(e) =>
                      setDraftRow((prev) => ({ ...prev, reportPeriod: e.target.value }))
                    }
                    maxLength={120}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    เดือนสรุปผล (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={draftRow.monthKey}
                    onChange={(e) =>
                      setDraftRow((prev) => ({ ...prev, monthKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    จำนวนเคสทั้งหมด
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={draftRow.totalCases}
                    onChange={(e) => updateNumField('totalCases', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    จำนวนเงินที่เรียกเก็บ (พึงรับ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draftRow.claimedAmount}
                    onChange={(e) => updateNumField('claimedAmount', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-800 mb-1">
                    ยอดพึงจ่าย / จัดสรร (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draftRow.payableAmount}
                    onChange={(e) => updateNumField('payableAmount', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg font-mono-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุ</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={draftRow.note}
                    onChange={(e) => setDraftRow((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="ระบุหมายเหตุ..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="text-xs font-semibold text-teal-800">กรณีเบิกปกติ</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">เงินที่ได้รับ</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftRow.normalReceivedAmount}
                        onChange={(e) => updateNumField('normalReceivedAmount', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">เคสชดเชย</label>
                      <input
                        type="number"
                        min={0}
                        value={draftRow.normalCompensatedCases}
                        onChange={(e) => updateNumField('normalCompensatedCases', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-red-700 mb-1">เคสไม่ชดเชย</label>
                      <input
                        type="number"
                        min={0}
                        value={draftRow.normalUncompensatedCases}
                        onChange={(e) => updateNumField('normalUncompensatedCases', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="text-xs font-semibold text-sky-800">กรณีอุทธรณ์ข้อมูล</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">เงินที่ได้รับ</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftRow.appealReceivedAmount}
                        onChange={(e) => updateNumField('appealReceivedAmount', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">เคสที่ได้รับ</label>
                      <input
                        type="number"
                        min={0}
                        value={draftRow.appealReceivedCases}
                        onChange={(e) => updateNumField('appealReceivedCases', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-red-700 mb-1">เคสไม่ชดเชย</label>
                      <input
                        type="number"
                        min={0}
                        value={draftRow.appealUncompensatedCases}
                        onChange={(e) => updateNumField('appealUncompensatedCases', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-800">ยาสมุนไพร 9 รายการ</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="เงิน"
                      value={draftRow.herbalAmount}
                      onChange={(e) => updateNumField('herbalAmount', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="เคส"
                      value={draftRow.herbalCases}
                      onChange={(e) => updateNumField('herbalCases', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-800">AE</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="เงิน"
                      value={draftRow.aeAmount}
                      onChange={(e) => updateNumField('aeAmount', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="เคส"
                      value={draftRow.aeCases}
                      onChange={(e) => updateNumField('aeCases', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-800">PP</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="เงิน"
                      value={draftRow.ppAmount}
                      onChange={(e) => updateNumField('ppAmount', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="เคส"
                      value={draftRow.ppCases}
                      onChange={(e) => updateNumField('ppCases', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-800">FS (OP Anywhere)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="เงิน"
                      value={draftRow.fsAmount}
                      onChange={(e) => updateNumField('fsAmount', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="เคส"
                      value={draftRow.fsCases}
                      onChange={(e) => updateNumField('fsCases', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setIsAddingNew(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingRow}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                >
                  {savingRow ? 'กำลังบันทึก...' : 'บันทึกลงฐานข้อมูล NoSQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
