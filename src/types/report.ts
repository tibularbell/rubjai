import { Timestamp } from 'firebase/firestore';

export const SCHEMA_LIMITS = {
  UNIT_CODE_MAX: 20,
  UNIT_CODE_REGEX: /^[a-zA-Z0-9_-]+$/,
  UNIT_NAME_MAX: 200,
  DISTRICT_NAME_MAX: 150,
  TEMPLATE_VERSION_MAX: 32,
  SSO_URL_MAX: 300,
  REPORT_PERIOD_MAX: 120,
  MONTH_KEY_REGEX: /^\d{4}-\d{2}$/,
  NOTE_MAX: 500,
  KEY_LABEL_MAX: 80,
  MAX_NUM_VALUE: 1_000_000_000,
} as const;

export interface UnitProfile {
  id: string;
  unitCode: string;
  unitName: string;
  districtName: string;
  templateVersion: string;
  ssoEndpointUrl: string;
  ownerUid: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ClaimRecordInput {
  seqNo: number;
  reportPeriod: string;
  monthKey: string;
  totalCases: number;
  claimedAmount: number;
  normalReceivedAmount: number;
  normalCompensatedCases: number;
  normalUncompensatedCases: number;
  appealReceivedAmount: number;
  appealReceivedCases: number;
  appealUncompensatedCases: number;
  herbalAmount: number;
  herbalCases: number;
  aeAmount: number;
  aeCases: number;
  ppAmount: number;
  ppCases: number;
  fsAmount: number;
  fsCases: number;
  summaryAmount: number;
  summaryCases: number;
  payableAmount: number;
  note: string;
}

export interface ClaimRecord extends ClaimRecordInput {
  id: string;
  ownerUid: string;
  unitId: string;
  importBatchId: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type ClaimSection = 'normal' | 'appeal';

export interface RepTransactionInput {
  reportPeriod: string;
  repCode: string;
  monthKey: string;
  claimSection: ClaimSection;
  seq: number;
  tranId: string;
  hn: string;
  an: string;
  pid: string;
  fullName: string;
  visitDate: string;
  dischargeDate: string;
  mainInscl: string;
  projCode: string;
  htypeHcode: string;
  provHcode: string;
  hcode: string;
  claimed: number;
  op: number;
  ipPaid: number;
  hcTotal: number;
  aeTotal: number;
  pp: number;
  fs: number;
  otherPaid: number;
  totalComp: number;
}

export interface RepTransaction extends RepTransactionInput {
  id: string;
  ownerUid: string;
  unitId: string;
  importBatchId: string;
  createdAt?: Timestamp | string;
}

export type SubmissionStatus = 'submitted' | 'acknowledged';

export interface SsoSubmission {
  id: string;
  ownerUid: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  monthKey: string;
  recordCount: number;
  totalCases: number;
  totalClaimedAmount: number;
  totalReceivedAmount: number;
  totalPayableAmount: number;
  netBalance: number;
  status: SubmissionStatus;
  targetEndpoint: string;
  submittedByEmail: string;
  createdAt?: Timestamp | string;
}

export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiKeyRecord {
  id: string;
  ownerUid: string;
  unitId: string;
  label: string;
  keyPrefix: string;
  keyHash: string;
  status: ApiKeyStatus;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface AggregateTotals {
  recordCount: number;
  totalCases: number;
  claimedAmount: number;
  normalReceivedAmount: number;
  normalCompensatedCases: number;
  normalUncompensatedCases: number;
  appealReceivedAmount: number;
  appealReceivedCases: number;
  appealUncompensatedCases: number;
  herbalAmount: number;
  herbalCases: number;
  aeAmount: number;
  aeCases: number;
  ppAmount: number;
  ppCases: number;
  fsAmount: number;
  fsCases: number;
  summaryAmount: number;
  summaryCases: number;
  payableAmount: number;
  netBalance: number;
  claimGap: number;
  compensationRatePct: number;
  totalUncompensatedCases: number;
}

export interface MonthlySummary extends AggregateTotals {
  monthKey: string;
  monthLabelTh: string;
}

export interface FundSummaryItem {
  key: 'herbal' | 'ae' | 'pp' | 'fs';
  label: string;
  shortLabel: string;
  amount: number;
  cases: number;
  sharePct: number;
}

const THAI_MONTHS = [
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

export function formatMonthKeyThai(monthKey: string): string {
  if (!SCHEMA_LIMITS.MONTH_KEY_REGEX.test(monthKey)) {
    return monthKey;
  }
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const beYear = year < 2400 ? year + 543 : year;
  const shortBe = String(beYear).slice(-2);
  const mName = THAI_MONTHS[monthIdx] ?? mStr;
  return `${mName} ${shortBe}`;
}

export function computeRecordReceived(r: Pick<
  ClaimRecordInput,
  'normalReceivedAmount' | 'appealReceivedAmount' | 'herbalAmount' | 'aeAmount' | 'ppAmount' | 'fsAmount' | 'summaryAmount'
>): number {
  const componentSum =
    r.normalReceivedAmount +
    r.appealReceivedAmount +
    r.herbalAmount +
    r.aeAmount +
    r.ppAmount +
    r.fsAmount;
  return r.summaryAmount > 0 ? r.summaryAmount : componentSum;
}

export function computeAggregateTotals(records: ClaimRecord[]): AggregateTotals {
  const base: AggregateTotals = {
    recordCount: records.length,
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
    netBalance: 0,
    claimGap: 0,
    compensationRatePct: 0,
    totalUncompensatedCases: 0,
  };

  for (const r of records) {
    base.totalCases += r.totalCases || 0;
    base.claimedAmount += r.claimedAmount || 0;
    base.normalReceivedAmount += r.normalReceivedAmount || 0;
    base.normalCompensatedCases += r.normalCompensatedCases || 0;
    base.normalUncompensatedCases += r.normalUncompensatedCases || 0;
    base.appealReceivedAmount += r.appealReceivedAmount || 0;
    base.appealReceivedCases += r.appealReceivedCases || 0;
    base.appealUncompensatedCases += r.appealUncompensatedCases || 0;
    base.herbalAmount += r.herbalAmount || 0;
    base.herbalCases += r.herbalCases || 0;
    base.aeAmount += r.aeAmount || 0;
    base.aeCases += r.aeCases || 0;
    base.ppAmount += r.ppAmount || 0;
    base.ppCases += r.ppCases || 0;
    base.fsAmount += r.fsAmount || 0;
    base.fsCases += r.fsCases || 0;
    base.summaryAmount += computeRecordReceived(r);
    base.summaryCases += r.summaryCases || 0;
    base.payableAmount += r.payableAmount || 0;
  }

  base.netBalance = base.summaryAmount - base.payableAmount;
  base.claimGap = Math.max(0, base.claimedAmount - base.summaryAmount);
  base.compensationRatePct =
    base.claimedAmount > 0 ? Math.min(100, (base.summaryAmount / base.claimedAmount) * 100) : 0;
  base.totalUncompensatedCases =
    base.normalUncompensatedCases + base.appealUncompensatedCases;

  return base;
}

export function computeMonthlySummaries(records: ClaimRecord[]): MonthlySummary[] {
  const byMonth = new Map<string, ClaimRecord[]>();
  for (const rec of records) {
    const list = byMonth.get(rec.monthKey) ?? [];
    list.push(rec);
    byMonth.set(rec.monthKey, list);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, items]) => ({
      monthKey,
      monthLabelTh: formatMonthKeyThai(monthKey),
      ...computeAggregateTotals(items),
    }));
}

export interface FiscalYearSummary {
  fiscalYearBE: number;
  rangeLabelTh: string;
  activeMonths: number;
  recordCount: number;
  totalReceivable: number;
  totalReceived: number;
  totalPayable: number;
  netBalance: number;
  compensationRatePct: number;
  avgMonthlyReceivable: number;
  avgMonthlyReceived: number;
  avgMonthlyPayable: number;
  avgMonthlyNetBalance: number;
}

export function getThaiFiscalYearBE(monthKey: string): number | null {
  if (!SCHEMA_LIMITS.MONTH_KEY_REGEX.test(monthKey)) return null;
  const rawYear = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(rawYear) || !Number.isFinite(month)) return null;
  const ceYear = rawYear < 2400 ? rawYear : rawYear - 543;
  const fyCE = month >= 10 ? ceYear + 1 : ceYear;
  return fyCE + 543;
}

export function getCurrentThaiFiscalYearBE(refDate: Date = new Date()): number {
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1;
  const fyCE = m >= 10 ? y + 1 : y;
  return fyCE + 543;
}

export function computeFiscalYearSummary(
  records: ClaimRecord[],
  fiscalYearBE: number
): FiscalYearSummary {
  const fyRecords = records.filter((r) => getThaiFiscalYearBE(r.monthKey) === fiscalYearBE);
  const totals = computeAggregateTotals(fyRecords);
  const activeMonths = new Set(fyRecords.map((r) => r.monthKey)).size;
  const divisor = activeMonths > 0 ? activeMonths : 1;

  const startShort = String(fiscalYearBE - 1).slice(-2);
  const endShort = String(fiscalYearBE).slice(-2);

  return {
    fiscalYearBE,
    rangeLabelTh: `ต.ค. ${startShort} – ก.ย. ${endShort}`,
    activeMonths,
    recordCount: totals.recordCount,
    totalReceivable: totals.claimedAmount,
    totalReceived: totals.summaryAmount,
    totalPayable: totals.payableAmount,
    netBalance: totals.netBalance,
    compensationRatePct: totals.compensationRatePct,
    avgMonthlyReceivable: activeMonths > 0 ? totals.claimedAmount / divisor : 0,
    avgMonthlyReceived: activeMonths > 0 ? totals.summaryAmount / divisor : 0,
    avgMonthlyPayable: activeMonths > 0 ? totals.payableAmount / divisor : 0,
    avgMonthlyNetBalance: activeMonths > 0 ? totals.netBalance / divisor : 0,
  };
}

export function computeFundBreakdown(totals: AggregateTotals): FundSummaryItem[] {
  const fundTotal =
    totals.herbalAmount + totals.aeAmount + totals.ppAmount + totals.fsAmount;

  const pct = (val: number) => (fundTotal > 0 ? (val / fundTotal) * 100 : 0);

  return [
    {
      key: 'herbal',
      label: 'ยาสมุนไพร 9 รายการ',
      shortLabel: 'ยาสมุนไพร 9',
      amount: totals.herbalAmount,
      cases: totals.herbalCases,
      sharePct: pct(totals.herbalAmount),
    },
    {
      key: 'ae',
      label: 'อุบัติเหตุและฉุกเฉิน (AE)',
      shortLabel: 'AE',
      amount: totals.aeAmount,
      cases: totals.aeCases,
      sharePct: pct(totals.aeAmount),
    },
    {
      key: 'pp',
      label: 'ส่งเสริมสุขภาพและป้องกัน (PP)',
      shortLabel: 'PP',
      amount: totals.ppAmount,
      cases: totals.ppCases,
      sharePct: pct(totals.ppAmount),
    },
    {
      key: 'fs',
      label: 'บริการปฐมภูมิทุกที่ FS (OP Anywhere)',
      shortLabel: 'FS (OP Anywhere)',
      amount: totals.fsAmount,
      cases: totals.fsCases,
      sharePct: pct(totals.fsAmount),
    },
  ];
}
