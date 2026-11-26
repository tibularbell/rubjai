import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import {
  ClaimRecord,
  computeAggregateTotals,
  computeFiscalYearSummary,
  computeFundBreakdown,
  computeMonthlySummaries,
  formatMonthKeyThai,
  getCurrentThaiFiscalYearBE,
  getThaiFiscalYearBE,
} from '../types/report';
import { MonthlyTrendLineChart } from './MonthlyTrendLineChart';

interface MonthlyDashboardProps {
  records: ClaimRecord[];
  loading: boolean;
  onOpenImport: () => void;
  onLoadSampleData: () => Promise<void>;
  onNavigateGrid: () => void;
  onNavigateMonthlyReport?: () => void;
}

function fmtCurrency(val: number): string {
  return val.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(val: number): string {
  return Math.round(val).toLocaleString('th-TH');
}

export const MonthlyDashboard: React.FC<MonthlyDashboardProps> = ({
  records,
  loading,
  onOpenImport,
  onLoadSampleData,
  onNavigateGrid,
  onNavigateMonthlyReport,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const monthlyList = useMemo(() => computeMonthlySummaries(records), [records]);

  const currentCalendarFy = useMemo(() => getCurrentThaiFiscalYearBE(), []);

  const availableFiscalYears = useMemo(() => {
    const fySet = new Set<number>([currentCalendarFy]);
    for (const r of records) {
      const fy = getThaiFiscalYearBE(r.monthKey);
      if (fy) fySet.add(fy);
    }
    return Array.from(fySet).sort((a, b) => b - a);
  }, [records, currentCalendarFy]);

  const activeFiscalYear = useMemo(() => {
    if (selectedFiscalYear && availableFiscalYears.includes(selectedFiscalYear)) {
      return selectedFiscalYear;
    }
    const hasCurrentFyData = records.some(
      (r) => getThaiFiscalYearBE(r.monthKey) === currentCalendarFy
    );
    if (hasCurrentFyData) return currentCalendarFy;
    const latestDataFy = availableFiscalYears.find((fy) =>
      records.some((r) => getThaiFiscalYearBE(r.monthKey) === fy)
    );
    return latestDataFy ?? currentCalendarFy;
  }, [selectedFiscalYear, availableFiscalYears, records, currentCalendarFy]);

  const fiscalYearSummary = useMemo(
    () => computeFiscalYearSummary(records, activeFiscalYear),
    [records, activeFiscalYear]
  );

  const filteredRecords = useMemo(() => {
    if (selectedMonth === 'ALL') return records;
    return records.filter((r) => r.monthKey === selectedMonth);
  }, [records, selectedMonth]);

  const totals = useMemo(() => computeAggregateTotals(filteredRecords), [filteredRecords]);
  const funds = useMemo(() => computeFundBreakdown(totals), [totals]);

  const totalFundSum = funds.reduce((s, f) => s + f.amount, 0);
  const totalFundCases = funds.reduce((s, f) => s + f.cases, 0);

  const maxChartVal = useMemo(() => {
    if (monthlyList.length === 0) return 100000;
    let m = 0;
    for (const item of monthlyList) {
      m = Math.max(m, item.claimedAmount, item.summaryAmount, item.payableAmount);
    }
    return m > 0 ? m * 1.15 : 100000;
  }, [monthlyList]);

  const activeHoverSummary = useMemo(() => {
    if (!hoveredMonth) return null;
    return monthlyList.find((m) => m.monthKey === hoveredMonth) ?? null;
  }, [hoveredMonth, monthlyList]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-3.5 w-28 bg-slate-200 rounded mb-4" />
              <div className="h-7 w-36 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          ยังไม่มีข้อมูลรายงานพึงรับ-พึงจ่ายในฐานข้อมูล
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          เริ่มต้นด้วยการนำเข้าไฟล์ Excel (.xlsx / .xls) หรือ CSV ตามแม่แบบ V.3 5367
          หรือทดลองโหลดชุดข้อมูลตัวอย่าง 4 งวดเพื่อดูการวิเคราะห์รายเดือนแบบเรียลไทม์
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            นำเข้าไฟล์ Excel / CSV
          </button>
          <button
            type="button"
            disabled={loadingSample}
            onClick={async () => {
              setLoadingSample(true);
              try {
                await onLoadSampleData();
              } finally {
                setLoadingSample(false);
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {loadingSample ? 'กำลังบันทึกข้อมูลตัวอย่าง...' : 'ทดลองโหลดข้อมูลตัวอย่าง V.3 5367'}
          </button>
        </div>
      </div>
    );
  }

  const totalCompensatedCases = totals.normalCompensatedCases + totals.appealReceivedCases;
  const totalEvaluatedCases = totalCompensatedCases + totals.totalUncompensatedCases;
  const caseSuccessPct =
    totalEvaluatedCases > 0 ? (totalCompensatedCases / totalEvaluatedCases) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Fiscal Year Summary Cards (Total Receivable/Payable & Monthly Averages) */}
      <section aria-label="สรุปสถิติปีงบประมาณ" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              สรุปสถิติปีงบประมาณ {fiscalYearSummary.fiscalYearBE}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              รอบปีงบประมาณ {fiscalYearSummary.rangeLabelTh} · ข้อมูล{' '}
              <span className="font-mono-nums font-medium text-slate-700">
                {fiscalYearSummary.activeMonths}
              </span>{' '}
              เดือน (
              <span className="font-mono-nums font-medium text-slate-700">
                {fiscalYearSummary.recordCount}
              </span>{' '}
              งวด)
              {activeFiscalYear === currentCalendarFy
                ? ' · ปีงบประมาณปัจจุบัน'
                : ' · ปีงบประมาณล่าสุดที่มีข้อมูล'}
            </p>
          </div>

          {availableFiscalYears.length > 1 && (
            <select
              value={activeFiscalYear}
              onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
              aria-label="เลือกปีงบประมาณ"
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              {availableFiscalYears.map((fy) => (
                <option key={fy} value={fy}>
                  ปีงบประมาณ {fy}
                  {fy === currentCalendarFy ? ' (ปัจจุบัน)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500 mb-2">
              ยอดพึงรับรวมทั้งปีงบประมาณ (Total Receivable)
            </div>
            <div className="text-2xl font-semibold text-sky-700 font-mono-nums">
              ฿{fmtCurrency(fiscalYearSummary.totalReceivable)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2 font-mono-nums">
              <span className="font-sans">ได้รับจริงรวม</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-emerald-700">
                ฿{fmtCurrency(fiscalYearSummary.totalReceived)} (
                {fiscalYearSummary.compensationRatePct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500 mb-2">
              ยอดพึงจ่ายรวมทั้งปีงบประมาณ (Total Payable)
            </div>
            <div className="text-2xl font-semibold text-amber-700 font-mono-nums">
              ฿{fmtCurrency(fiscalYearSummary.totalPayable)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2 font-mono-nums">
              <span className="font-sans">คงเหลือสุทธิ</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  fiscalYearSummary.netBalance >= 0 ? 'text-teal-700' : 'text-red-600'
                }`}
              >
                {fiscalYearSummary.netBalance >= 0 ? '฿' : '-฿'}
                {fmtCurrency(Math.abs(fiscalYearSummary.netBalance))}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500 mb-2">
              ยอดพึงรับเฉลี่ยรายเดือน (ปีงบฯ {fiscalYearSummary.fiscalYearBE})
            </div>
            <div className="text-2xl font-semibold text-slate-900 font-mono-nums">
              ฿{fmtCurrency(fiscalYearSummary.avgMonthlyReceivable)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2 font-mono-nums">
              <span className="font-sans">เฉลี่ยรับจริง/เดือน</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-emerald-700">
                ฿{fmtCurrency(fiscalYearSummary.avgMonthlyReceived)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500 mb-2">
              ยอดพึงจ่ายเฉลี่ยรายเดือน (ปีงบฯ {fiscalYearSummary.fiscalYearBE})
            </div>
            <div className="text-2xl font-semibold text-slate-900 font-mono-nums">
              ฿{fmtCurrency(fiscalYearSummary.avgMonthlyPayable)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2 font-mono-nums">
              <span className="font-sans">เฉลี่ยสุทธิ/เดือน</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  fiscalYearSummary.avgMonthlyNetBalance >= 0 ? 'text-teal-700' : 'text-red-600'
                }`}
              >
                {fiscalYearSummary.avgMonthlyNetBalance >= 0 ? '฿' : '-฿'}
                {fmtCurrency(Math.abs(fiscalYearSummary.avgMonthlyNetBalance))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Month Segmented Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            สรุปผลพึงรับ-พึงจ่ายและวิเคราะห์รายเดือน
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            ข้อมูลซิงค์แบบเรียลไทม์จาก Firestore · แสดงผล{' '}
            <span className="font-mono-nums font-medium text-slate-700">{totals.recordCount}</span> งวด
            {' · '}
            {selectedMonth === 'ALL' ? 'ทุกเดือนรวมกัน' : `เดือน ${formatMonthKeyThai(selectedMonth)}`}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedMonth('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedMonth === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทุกงวดทั้งหมด
          </button>
          {monthlyList.map((m) => (
            <button
              key={m.monthKey}
              type="button"
              onClick={() => setSelectedMonth(m.monthKey)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedMonth === m.monthKey
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.monthLabelTh}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">
            ยอดเรียกเก็บ (พึงรับตั้งต้น)
          </div>
          <div className="text-2xl font-semibold text-slate-900 font-mono-nums">
            ฿{fmtCurrency(totals.claimedAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
            <span>เคสทั้งหมด</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums font-medium text-slate-700">
              {fmtInt(totals.totalCases)} เคส
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">
            ยอดได้รับชดเชยจริงรวม (V.3)
          </div>
          <div className="text-2xl font-semibold text-emerald-700 font-mono-nums">
            ฿{fmtCurrency(totals.summaryAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
            <span>อัตราชดเชยเทียบเรียกเก็บ</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums font-medium text-emerald-700">
              {totals.compensationRatePct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">
            คงเหลือสุทธิ (พึงรับจริง - พึงจ่าย)
          </div>
          <div
            className={`text-2xl font-semibold font-mono-nums ${
              totals.netBalance >= 0 ? 'text-teal-700' : 'text-red-600'
            }`}
          >
            {totals.netBalance >= 0 ? '฿' : '-฿'}
            {fmtCurrency(Math.abs(totals.netBalance))}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
            <span>ยอดพึงจ่ายรวม</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums font-medium text-slate-700">
              ฿{fmtCurrency(totals.payableAmount)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">
            เคสที่ไม่ได้รับชดเชย (ปกติ + อุทธรณ์)
          </div>
          <div className="text-2xl font-semibold text-red-600 font-mono-nums">
            {fmtInt(totals.totalUncompensatedCases)} เคส
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
            <span>ปกติ {fmtInt(totals.normalUncompensatedCases)}</span>
            <span aria-hidden="true">/</span>
            <span>อุทธรณ์ {fmtInt(totals.appealUncompensatedCases)}</span>
          </div>
        </div>
      </div>

      {/* 12-Month Full Year Recharts Line Chart: Receivable (Claimed) vs Actual Received */}
      <MonthlyTrendLineChart
        records={records}
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => setSelectedMonth(m)}
      />

      {/* Main Analytics Split: Monthly Chart (7 cols) + Uncompensated Cases Analysis (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                เปรียบเทียบยอดเรียกเก็บ ได้รับจริง และพึงจ่ายรายเดือน
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ชี้เมาส์บนแท่งกราฟรายเดือนเพื่อดูรายละเอียดตัวเลข
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
                เรียกเก็บ (พึงรับ)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" />
                ได้รับจริง
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                พึงจ่าย
              </span>
            </div>
          </div>

          <div className="relative flex-1 min-h-[240px] flex flex-col justify-end">
            <div className="grid gap-3 items-end h-56 pt-4 border-b border-slate-200"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, monthlyList.length)}, minmax(0, 1fr))`,
              }}
            >
              {monthlyList.map((m) => {
                const hClaimed = Math.max(4, (m.claimedAmount / maxChartVal) * 100);
                const hReceived = Math.max(4, (m.summaryAmount / maxChartVal) * 100);
                const hPayable = Math.max(2, (m.payableAmount / maxChartVal) * 100);
                const isSelected = selectedMonth === m.monthKey;
                const isHovered = hoveredMonth === m.monthKey;

                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onMouseEnter={() => setHoveredMonth(m.monthKey)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() =>
                      setSelectedMonth((prev) => (prev === m.monthKey ? 'ALL' : m.monthKey))
                    }
                    className={`group h-full flex flex-col justify-end items-center px-1 rounded-t-lg transition-colors focus:outline-none ${
                      isSelected || isHovered ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="w-full max-w-[76px] h-44 flex items-end justify-center gap-1.5 pb-1">
                      <div
                        className="w-1/3 bg-slate-400 rounded-t transition-all duration-150"
                        style={{ height: `${hClaimed}%` }}
                        title={`เรียกเก็บ: ฿${fmtCurrency(m.claimedAmount)}`}
                      />
                      <div
                        className="w-1/3 bg-teal-600 rounded-t transition-all duration-150"
                        style={{ height: `${hReceived}%` }}
                        title={`ได้รับจริง: ฿${fmtCurrency(m.summaryAmount)}`}
                      />
                      <div
                        className="w-1/3 bg-amber-500 rounded-t transition-all duration-150"
                        style={{ height: `${hPayable}%` }}
                        title={`พึงจ่าย: ฿${fmtCurrency(m.payableAmount)}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="grid gap-3 pt-2 text-center"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, monthlyList.length)}, minmax(0, 1fr))`,
              }}
            >
              {monthlyList.map((m) => (
                <div
                  key={m.monthKey}
                  className={`text-xs font-medium truncate ${
                    selectedMonth === m.monthKey ? 'text-teal-700 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {m.monthLabelTh}
                </div>
              ))}
            </div>
          </div>

          {/* Hover Detail Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 min-h-[28px]">
            {activeHoverSummary ? (
              <>
                <span className="font-semibold text-slate-900">
                  เดือน {activeHoverSummary.monthLabelTh} ({activeHoverSummary.recordCount} งวด)
                </span>
                <div className="flex flex-wrap items-center gap-4 font-mono-nums">
                  <span>เรียกเก็บ ฿{fmtCurrency(activeHoverSummary.claimedAmount)}</span>
                  <span className="text-emerald-700">
                    ได้รับจริง ฿{fmtCurrency(activeHoverSummary.summaryAmount)}
                  </span>
                  <span className="text-amber-700">
                    พึงจ่าย ฿{fmtCurrency(activeHoverSummary.payableAmount)}
                  </span>
                  <span className="text-teal-700 font-semibold">
                    สุทธิ ฿{fmtCurrency(activeHoverSummary.netBalance)}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-slate-500">
                คลิกที่เดือนในกราฟเพื่อกรองข้อมูลเฉพาะเดือนนั้น หรือดูตารางละเอียดได้จากเมนูด้านบน
              </span>
            )}
          </div>
        </div>

        {/* Uncompensated Cases & Appeal Efficiency */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                วิเคราะห์การชดเชยและเคสที่ไม่ได้รับชดเชย
              </h3>
              <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
                {onNavigateMonthlyReport && (
                  <button
                    type="button"
                    onClick={onNavigateMonthlyReport}
                    className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    รายงานสรุปรายเดือน
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNavigateGrid}
                  className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
                >
                  ดูตารางละเอียด
                </button>
              </div>
            </div>

            {/* Case Success Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600">สัดส่วนเคสได้รับชดเชยสำเร็จ</span>
                <span className="font-mono-nums font-semibold text-slate-900">
                  {caseSuccessPct.toFixed(1)}% ({fmtInt(totalCompensatedCases)} / {fmtInt(totalEvaluatedCases)} เคส)
                </span>
              </div>
              <div className="h-2.5 w-full bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, caseSuccessPct)}%` }}
                />
              </div>
            </div>

            {/* Breakdown table */}
            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">กรณีเบิกปกติ</div>
                  <div className="text-xs text-slate-500">
                    ชดเชย {fmtInt(totals.normalCompensatedCases)} เคส · ไม่ได้รับชดเชย{' '}
                    <span className="text-red-600 font-medium">
                      {fmtInt(totals.normalUncompensatedCases)} เคส
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    ฿{fmtCurrency(totals.normalReceivedAmount)}
                  </div>
                  <div className="text-xs text-slate-500">ยอดได้รับปกติ</div>
                </div>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">กรณีอุทธรณ์ข้อมูล</div>
                  <div className="text-xs text-slate-500">
                    ได้รับเพิ่ม {fmtInt(totals.appealReceivedCases)} เคส · ไม่ได้รับชดเชย{' '}
                    <span className="text-red-600 font-medium">
                      {fmtInt(totals.appealUncompensatedCases)} เคส
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono-nums">
                  <div className="text-sm font-semibold text-teal-700">
                    ฿{fmtCurrency(totals.appealReceivedAmount)}
                  </div>
                  <div className="text-xs text-slate-500">ยอดอุทธรณ์สำเร็จ</div>
                </div>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    ส่วนต่างเรียกเก็บเทียบได้รับจริง
                  </div>
                  <div className="text-xs text-slate-500">
                    ยอดที่เรียกเก็บสูงกว่ายอดชดเชยรวม
                  </div>
                </div>
                <div className="text-right font-mono-nums">
                  <div className="text-sm font-semibold text-amber-700">
                    ฿{fmtCurrency(totals.claimGap)}
                  </div>
                  <div className="text-xs text-slate-500">รอติดตาม/ส่วนต่าง</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500">
            <span>ยอดพึงจ่ายที่บันทึกไว้</span>
            <span className="font-mono-nums font-medium text-slate-900">
              ฿{fmtCurrency(totals.payableAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Fund Breakdown Section: Herbal 9, AE, PP, FS (OP Anywhere) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              แยกวิเคราะห์รายรับตามกองทุนเฉพาะ (4 กองทุน)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ยาสมุนไพร 9 รายการ · อุบัติเหตุและฉุกเฉิน (AE) · ส่งเสริมป้องกัน (PP) · FS (OP Anywhere)
            </p>
          </div>
          <div className="text-right font-mono-nums">
            <span className="text-xs text-slate-500 mr-2">รวม 4 กองทุน</span>
            <span className="text-base font-semibold text-slate-900">
              ฿{fmtCurrency(totalFundSum)}
            </span>
            <span className="text-xs text-slate-500 ml-2">({fmtInt(totalFundCases)} เคส)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 border border-slate-200 rounded-lg">
          {funds.map((fund) => (
            <div key={fund.key} className="p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">{fund.label}</div>
                <div className="text-xl font-semibold text-slate-900 font-mono-nums">
                  ฿{fmtCurrency(fund.amount)}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 font-mono-nums">
                  <span>{fmtInt(fund.cases)} เคส</span>
                  <span>{fund.sharePct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, fund.sharePct)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
