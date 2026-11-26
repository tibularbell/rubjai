import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClaimRecord, computeAggregateTotals, formatMonthKeyThai } from '../types/report';

interface MonthlyTrendLineChartProps {
  records: ClaimRecord[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

interface AnnualTrendPoint {
  monthKey: string;
  monthIndex: number;
  shortLabel: string;
  fullLabel: string;
  claimedAmount: number;
  receivedAmount: number;
  compensationRatePct: number;
  gapAmount: number;
  recordCount: number;
}

const THAI_MONTH_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

function fmtCurrency(val: number): string {
  return val.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtYAxisBaht(val: number): string {
  if (val === 0) return '฿0';
  if (val >= 1_000_000) return `฿${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `฿${(val / 1_000).toFixed(val % 1_000 === 0 ? 0 : 1)}k`;
  return `฿${Math.round(val).toLocaleString('th-TH')}`;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: AnnualTrendPoint }>;
}

const TrendTooltip: React.FC<TrendTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs min-w-[230px]">
      <div className="font-semibold text-slate-900 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between gap-3">
        <span>เดือน {point.fullLabel}</span>
        <span className="font-mono-nums text-slate-500 font-normal">
          {point.recordCount > 0 ? `${point.recordCount} งวด` : 'ยังไม่มีข้อมูล'}
        </span>
      </div>
      <div className="space-y-1.5 font-mono-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-slate-600">
            <span className="w-2 h-2 rounded-full bg-sky-700 inline-block" />
            ยอดพึงรับ (เรียกเก็บ)
          </span>
          <span className="font-semibold text-slate-900">฿{fmtCurrency(point.claimedAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            ได้รับชดเชยจริง
          </span>
          <span className="font-semibold text-emerald-700">
            ฿{fmtCurrency(point.receivedAmount)}
          </span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between gap-4 text-[11px]">
          <span className="font-sans text-slate-500">ส่วนต่าง / อัตราชดเชย</span>
          <span className="text-slate-700">
            ฿{fmtCurrency(point.gapAmount)} ({point.compensationRatePct.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyTrendLineChart: React.FC<MonthlyTrendLineChartProps> = ({
  records,
  selectedMonth,
  onSelectMonth,
}) => {
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of records) {
      const y = r.monthKey?.slice(0, 4);
      if (/^\d{4}$/.test(y)) {
        years.add(y);
      }
    }
    if (years.size === 0) {
      years.add(String(new Date().getFullYear()));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const [selectedYear, setSelectedYear] = useState<string>('');
  const activeYear =
    selectedYear && availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  const beYear = useMemo(() => {
    const num = Number(activeYear);
    return num < 2400 ? num + 543 : num;
  }, [activeYear]);

  const annualSeries: AnnualTrendPoint[] = useMemo(() => {
    const byMonth = new Map<string, ClaimRecord[]>();
    for (const r of records) {
      if (!r.monthKey?.startsWith(`${activeYear}-`)) continue;
      const list = byMonth.get(r.monthKey) ?? [];
      list.push(r);
      byMonth.set(r.monthKey, list);
    }

    return THAI_MONTH_SHORT.map((shortLabel, idx) => {
      const monthStr = String(idx + 1).padStart(2, '0');
      const monthKey = `${activeYear}-${monthStr}`;
      const monthRecords = byMonth.get(monthKey) ?? [];
      const totals = computeAggregateTotals(monthRecords);

      return {
        monthKey,
        monthIndex: idx + 1,
        shortLabel,
        fullLabel: formatMonthKeyThai(monthKey),
        claimedAmount: Number(totals.claimedAmount.toFixed(2)),
        receivedAmount: Number(totals.summaryAmount.toFixed(2)),
        compensationRatePct: totals.compensationRatePct,
        gapAmount: Number(totals.claimGap.toFixed(2)),
        recordCount: totals.recordCount,
      };
    });
  }, [records, activeYear]);

  const yearlyTotals = useMemo(() => {
    const yearRecords = records.filter((r) => r.monthKey?.startsWith(`${activeYear}-`));
    return computeAggregateTotals(yearRecords);
  }, [records, activeYear]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            แนวโน้มยอดเงินพึงรับเทียบได้รับชดเชยจริงรายเดือนตลอดทั้งปี (พ.ศ. {beYear})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            เปรียบเทียบยอดเรียกเก็บ (พึงรับ) กับยอดชดเชยจริงครบทั้ง 12 เดือน (ม.ค. – ธ.ค.) · ชี้ที่จุดบนกราฟเพื่อดูรายละเอียด
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 text-xs font-mono-nums">
            <div>
              <span className="text-slate-500 mr-1.5">พึงรับรวมทั้งปี:</span>
              <span className="font-semibold text-sky-700">
                ฿{fmtCurrency(yearlyTotals.claimedAmount)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">ได้รับจริงรวมทั้งปี:</span>
              <span className="font-semibold text-emerald-700">
                ฿{fmtCurrency(yearlyTotals.summaryAmount)}
              </span>
            </div>
          </div>

          {availableYears.length > 1 ? (
            <select
              value={activeYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="เลือกปี พ.ศ."
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            >
              {availableYears.map((y) => {
                const be = Number(y) < 2400 ? Number(y) + 543 : Number(y);
                return (
                  <option key={y} value={y}>
                    ปี พ.ศ. {be}
                  </option>
                );
              })}
            </select>
          ) : (
            <span className="text-xs font-medium text-slate-600 px-2.5 py-1 bg-slate-100 rounded-md font-mono-nums">
              ปี พ.ศ. {beYear}
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-[300px] min-w-0">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={annualSeries}
            margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (!label) return;
              const matched = annualSeries.find((p) => p.shortLabel === label);
              if (matched && matched.recordCount > 0) {
                onSelectMonth(selectedMonth === matched.monthKey ? 'ALL' : matched.monthKey);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 12, fill: '#475569' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={fmtYAxisBaht}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={66}
            />
            <Tooltip content={(props) => <TrendTooltip {...props} />} />
            <Legend
              verticalAlign="top"
              align="right"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', color: '#475569' }}
            />
            <Line
              type="monotone"
              dataKey="claimedAmount"
              name="ยอดเงินพึงรับ (เรียกเก็บ)"
              stroke="#0369a1"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#0369a1', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#0369a1', stroke: '#ffffff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="receivedAmount"
              name="ยอดเงินที่ได้รับชดเชยจริง"
              stroke="#059669"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#059669', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
