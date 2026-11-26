import * as XLSX from 'xlsx';
import {
  ClaimRecord,
  ClaimRecordInput,
  ClaimSection,
  computeAggregateTotals,
  computeRecordReceived,
  formatMonthKeyThai,
  RepTransactionInput,
  SCHEMA_LIMITS,
} from '../types/report';

function toSafeNum(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.min(SCHEMA_LIMITS.MAX_NUM_VALUE, val));
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,\s฿บาท]/g, '').trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(SCHEMA_LIMITS.MAX_NUM_VALUE, parsed));
    }
  }
  return 0;
}

const THAI_MONTH_MAP: Record<string, string> = {
  'ม.ค.': '01',
  'มกราคม': '01',
  'ก.พ.': '02',
  'กุมภาพันธ์': '02',
  'มี.ค.': '03',
  'มีนาคม': '03',
  'เม.ย.': '04',
  'เมษายน': '04',
  'พ.ค.': '05',
  'พฤษภาคม': '05',
  'มิ.ย.': '06',
  'มิถุนายน': '06',
  'ก.ค.': '07',
  'กรกฎาคม': '07',
  'ส.ค.': '08',
  'สิงหาคม': '08',
  'ก.ย.': '09',
  'กันยายน': '09',
  'ต.ค.': '10',
  'ตุลาคม': '10',
  'พ.ย.': '11',
  'พฤศจิกายน': '11',
  'ธ.ค.': '12',
  'ธันวาคม': '12',
};

export function inferMonthKeyFromPeriod(periodText: string, fallbackIndex = 0): string {
  const trimmed = periodText.trim();

  // Direct YYYY-MM (e.g. 2026-03-17 10:23:00 -> 2026-03)
  const isoMatch = trimmed.match(/(20\d{2})[-/](0[1-9]|1[0-2])/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // NHSO REP code prefix e.g. 690700001 -> YY=69 (2569 -> 2026), MM=07 -> 2026-07
  const repMatch = trimmed.match(/(?:REP\s*)?(6\d|7\d)(0[1-9]|1[0-2])\d{3,}/i);
  if (repMatch) {
    const adYear = 2500 + Number(repMatch[1]) - 543;
    return `${adYear}-${repMatch[2]}`;
  }

  // Thai month name + 2 or 4 digit BE year (e.g., "ม.ค. 69" or "มกราคม 2569")
  for (const [mLabel, mNum] of Object.entries(THAI_MONTH_MAP)) {
    if (trimmed.includes(mLabel)) {
      const yearMatch = trimmed.match(/(25\d{2}|20\d{2}|\b\d{2}\b)/g);
      if (yearMatch && yearMatch.length > 0) {
        const lastY = Number(yearMatch[yearMatch.length - 1]);
        let adYear = lastY;
        if (lastY >= 2500) {
          adYear = lastY - 543;
        } else if (lastY >= 50 && lastY < 100) {
          adYear = 2500 + lastY - 543;
        } else if (lastY < 50) {
          adYear = 2000 + lastY;
        }
        return `${adYear}-${mNum}`;
      }
      const nowYear = new Date().getFullYear();
      return `${nowYear}-${mNum}`;
    }
  }

  // MM/2569 or MM/2026
  const slashMatch = trimmed.match(/\b(0?[1-9]|1[0-2])[/\-](25\d{2}|20\d{2})\b/);
  if (slashMatch) {
    const mNum = slashMatch[1].padStart(2, '0');
    const rawY = Number(slashMatch[2]);
    const adYear = rawY >= 2500 ? rawY - 543 : rawY;
    return `${adYear}-${mNum}`;
  }

  const now = new Date();
  const monthNum = String(((fallbackIndex % 12) + 1)).padStart(2, '0');
  return `${now.getFullYear()}-${monthNum}`;
}

export interface ParsedExcelResult {
  records: ClaimRecordInput[];
  transactions?: RepTransactionInput[];
  warnings: string[];
  detectedFormat: 'NHSO_REP_STATEMENT' | 'V3_TWO_ROW' | 'FLAT_HEADER' | 'POSITIONAL_V3';
  rawTransactionCount?: number;
  detectedHcode?: string;
}

interface RepTransactionSample {
  rep: string;
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
  htypeHcodePaid: string;
  provHcodePaid: string;
  hcodePaid: string;
  claimed: number;
  op: number;
  ipPaid: number;
  hc: number;
  hcDrug: number;
  ae: number;
  aeDrug: number;
  inst: number;
  dmisPaid: number;
  dmisDrug: number;
  palliative: number;
  dmishd: number;
  pp: number;
  fs: number;
  totalComp: number;
  claimSection?: ClaimSection;
}

const SAMPLE_REP_TRANSACTIONS: RepTransactionSample[] = [
  {
    rep: '690700001',
    seq: 1,
    tranId: '795106568',
    hn: '0002022',
    an: '',
    pid: '3190700007800',
    fullName: 'นาง เฉลียว พุ่มทับทิม',
    visitDate: '2026-03-17 10:23:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 185.75,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 0,
  },
  {
    rep: '690700001',
    seq: 2,
    tranId: '795106572',
    hn: '0004035',
    an: '',
    pid: '3570700454080',
    fullName: 'นาย ปิ๊ด ก้างกาง',
    visitDate: '2026-03-10 12:07:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 110,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 60,
    fs: 0,
    totalComp: 60,
  },
  {
    rep: '690700003',
    seq: 3,
    tranId: '796737289',
    hn: '0002143',
    an: '',
    pid: '3190700611171',
    fullName: 'นาง สนอง เสื้อตุ่ย',
    visitDate: '2026-06-29 11:29:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 124,
    op: 0,
    ipPaid: 0,
    hc: 84,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 84,
  },
  {
    rep: '690700003',
    seq: 4,
    tranId: '796649452',
    hn: '0004048',
    an: '',
    pid: '3140300052093',
    fullName: 'น.ส. ชุติมา แก้วประสาท',
    visitDate: '2026-05-18 14:18:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 73,
    op: 0,
    ipPaid: 0,
    hc: 84,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 84,
  },
  {
    rep: '690700003',
    seq: 5,
    tranId: '796676119',
    hn: '0003324',
    an: '',
    pid: '3160200310651',
    fullName: 'นาง สนั่น ศรีดวง',
    visitDate: '2026-06-05 11:55:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 99,
    op: 0,
    ipPaid: 0,
    hc: 40,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 40,
  },
  {
    rep: '690700004',
    seq: 6,
    tranId: '795084442',
    hn: '0003438',
    an: '',
    pid: '1118700087618',
    fullName: 'น.ส. วันธิชา เสื้อตุ่ย',
    visitDate: '2026-04-27 14:04:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 162,
    op: 90,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 60,
    totalComp: 150,
  },
  {
    rep: '690700004',
    seq: 7,
    tranId: '796736169',
    hn: '0001905',
    an: '',
    pid: '3302100156731',
    fullName: 'นาง นกเล็ก นามวงษ์',
    visitDate: '2026-03-09 11:07:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 216.25,
    op: 0,
    ipPaid: 0,
    hc: 37,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 37,
  },
  {
    rep: '690700001',
    seq: 8,
    tranId: '796673952',
    hn: '0001669',
    an: '',
    pid: '3190700061669',
    fullName: 'น.ส. มะณี เพ็งยม',
    visitDate: '2026-05-05 10:28:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 125.25,
    op: 0,
    ipPaid: 0,
    hc: 124,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 124,
  },
  {
    rep: '690800001',
    seq: 9,
    tranId: '796649455',
    hn: '0002888',
    an: '',
    pid: '3190700061855',
    fullName: 'นาง มาลัย แสงประไพ',
    visitDate: '2026-08-01 10:04:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 390,
    op: 180,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 90,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 60,
    fs: 0,
    totalComp: 330,
  },
  {
    rep: '690800001',
    seq: 10,
    tranId: '795010411',
    hn: '0001897',
    an: '',
    pid: '3720100488607',
    fullName: 'นาง นิภา บุญเปลี่ยน',
    visitDate: '2026-08-19 09:25:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 185.75,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 120,
    fs: 0,
    totalComp: 120,
  },
  {
    rep: '690900002',
    seq: 11,
    tranId: '795084449',
    hn: '0003197',
    an: '',
    pid: '3190700062622',
    fullName: 'นาย ชุม พลเพียน',
    visitDate: '2026-09-12 09:50:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 310,
    op: 150,
    ipPaid: 0,
    hc: 40,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 80,
    totalComp: 270,
  },
  {
    rep: '690800001',
    seq: 1,
    tranId: '808660392',
    hn: '0003591',
    an: '',
    pid: '3190600252489',
    fullName: 'นาง สุมาลี พรเณร',
    visitDate: '2026-08-05 13:54:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 185,
    op: 120,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 120,
    claimSection: 'normal',
  },
  {
    rep: '690800001',
    seq: 2,
    tranId: '808643074',
    hn: '0003521',
    an: '',
    pid: '3190700009896',
    fullName: 'นาง สมควร พรเณร',
    visitDate: '2026-04-24 09:28:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 140,
    op: 0,
    ipPaid: 0,
    hc: 84,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 84,
    claimSection: 'normal',
  },
  {
    rep: '690800001',
    seq: 3,
    tranId: '808690185',
    hn: '0003682',
    an: '',
    pid: '1199600487551',
    fullName: 'น.ส. เกศแก้ว พรเณร',
    visitDate: '2026-08-05 14:01:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 110,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 60,
    fs: 0,
    totalComp: 60,
    claimSection: 'normal',
  },
  {
    rep: '690800001',
    seq: 4,
    tranId: '808643075',
    hn: '0000015',
    an: '',
    pid: '2430900018871',
    fullName: 'นาย สุถี ชัยสิงห์',
    visitDate: '2026-08-21 11:36:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 95,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 0,
    claimSection: 'normal',
  },
  {
    rep: '690800001',
    seq: 1,
    tranId: '808712340',
    hn: '0002143',
    an: '',
    pid: '3190700611171',
    fullName: 'นาง สนอง เสื้อตุ่ย',
    visitDate: '2026-08-12 10:15:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: 'APPEAL',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 240,
    op: 180,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 180,
    claimSection: 'appeal',
  },
  {
    rep: '690900002',
    seq: 12,
    tranId: '796673950',
    hn: '0000007',
    an: '',
    pid: '3190700066113',
    fullName: 'นาย วิโรจน์ ใจสุข',
    visitDate: '2026-09-15 13:54:00',
    dischargeDate: '',
    mainInscl: 'UCS',
    projCode: '',
    htypeHcode: '0010',
    provHcode: '1900',
    hcode: '01747',
    htypeHcodePaid: '0010',
    provHcodePaid: '1900',
    hcodePaid: '10812',
    claimed: 69,
    op: 0,
    ipPaid: 0,
    hc: 0,
    hcDrug: 0,
    ae: 0,
    aeDrug: 0,
    inst: 0,
    dmisPaid: 0,
    dmisDrug: 0,
    palliative: 0,
    dmishd: 0,
    pp: 0,
    fs: 0,
    totalComp: 0,
  },
];

interface ParsedRepTxRow {
  rep: string;
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
  claimSection: ClaimSection;
}

function groupRepTransactionsToV3(txs: ParsedRepTxRow[]): {
  records: ClaimRecordInput[];
  transactions: RepTransactionInput[];
} {
  const byRep = new Map<string, ParsedRepTxRow[]>();
  for (const tx of txs) {
    const key = tx.rep || 'UNGROUPED';
    const list = byRep.get(key) ?? [];
    list.push(tx);
    byRep.set(key, list);
  }

  const results: ClaimRecordInput[] = [];
  const normalizedTxs: RepTransactionInput[] = [];
  let seqIdx = 1;

  for (const [repCode, items] of byRep.entries()) {
    let totalCases = 0;
    let claimedAmount = 0;
    let normalReceivedAmount = 0;
    let normalCompensatedCases = 0;
    let normalUncompensatedCases = 0;
    let appealReceivedAmount = 0;
    let appealReceivedCases = 0;
    let appealUncompensatedCases = 0;
    let herbalAmount = 0;
    let herbalCases = 0;
    let aeAmount = 0;
    let aeCases = 0;
    let ppAmount = 0;
    let ppCases = 0;
    let fsAmount = 0;
    let fsCases = 0;
    let summaryAmount = 0;

    let firstVisitDate = '';

    for (const item of items) {
      if (!firstVisitDate && item.visitDate) {
        firstVisitDate = item.visitDate;
      }
      totalCases += 1;
      claimedAmount += item.claimed;

      const specialSum = item.hcTotal + item.aeTotal + item.pp + item.fs;
      const computedRowComp =
        item.totalComp > 0 ? item.totalComp : item.op + item.ipPaid + item.otherPaid + specialSum;
      const baseReceived = Math.max(0, computedRowComp - specialSum);

      const isAppeal =
        item.claimSection === 'appeal' || /appeal|อุทธรณ์/i.test(item.projCode);
      if (isAppeal) {
        if (computedRowComp > 0) {
          appealReceivedCases += 1;
          appealReceivedAmount += baseReceived;
        } else {
          appealUncompensatedCases += 1;
        }
      } else {
        if (computedRowComp > 0) {
          normalCompensatedCases += 1;
          normalReceivedAmount += baseReceived;
        } else {
          normalUncompensatedCases += 1;
        }
      }

      if (item.hcTotal > 0) {
        herbalAmount += item.hcTotal;
        herbalCases += 1;
      }
      if (item.aeTotal > 0) {
        aeAmount += item.aeTotal;
        aeCases += 1;
      }
      if (item.pp > 0) {
        ppAmount += item.pp;
        ppCases += 1;
      }
      if (item.fs > 0) {
        fsAmount += item.fs;
        fsCases += 1;
      }

      summaryAmount += computedRowComp;
    }

    const summaryCases = normalCompensatedCases + appealReceivedCases;
    const monthKey = inferMonthKeyFromPeriod(repCode, seqIdx - 1);
    const fallbackMonth =
      firstVisitDate && /\d{4}-\d{2}/.test(firstVisitDate)
        ? firstVisitDate.slice(0, 7)
        : monthKey;
    const finalMonthKey = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : fallbackMonth;
    const reportPeriod = `REP ${repCode}`.slice(0, SCHEMA_LIMITS.REPORT_PERIOD_MAX);

    for (const item of items) {
      const isAppeal =
        item.claimSection === 'appeal' || /appeal|อุทธรณ์/i.test(item.projCode);
      normalizedTxs.push({
        reportPeriod,
        repCode,
        monthKey: finalMonthKey,
        claimSection: isAppeal ? 'appeal' : 'normal',
        seq: item.seq,
        tranId: item.tranId,
        hn: item.hn,
        an: item.an,
        pid: item.pid,
        fullName: item.fullName,
        visitDate: item.visitDate,
        dischargeDate: item.dischargeDate,
        mainInscl: item.mainInscl,
        projCode: item.projCode,
        htypeHcode: item.htypeHcode,
        provHcode: item.provHcode,
        hcode: item.hcode,
        claimed: Number(item.claimed.toFixed(2)),
        op: Number(item.op.toFixed(2)),
        ipPaid: Number(item.ipPaid.toFixed(2)),
        hcTotal: Number(item.hcTotal.toFixed(2)),
        aeTotal: Number(item.aeTotal.toFixed(2)),
        pp: Number(item.pp.toFixed(2)),
        fs: Number(item.fs.toFixed(2)),
        otherPaid: Number(item.otherPaid.toFixed(2)),
        totalComp: Number(item.totalComp.toFixed(2)),
      });
    }

    results.push({
      seqNo: seqIdx,
      reportPeriod,
      monthKey: finalMonthKey,
      totalCases,
      claimedAmount: Number(claimedAmount.toFixed(2)),
      normalReceivedAmount: Number(normalReceivedAmount.toFixed(2)),
      normalCompensatedCases,
      normalUncompensatedCases,
      appealReceivedAmount: Number(appealReceivedAmount.toFixed(2)),
      appealReceivedCases,
      appealUncompensatedCases,
      herbalAmount: Number(herbalAmount.toFixed(2)),
      herbalCases,
      aeAmount: Number(aeAmount.toFixed(2)),
      aeCases,
      ppAmount: Number(ppAmount.toFixed(2)),
      ppCases,
      fsAmount: Number(fsAmount.toFixed(2)),
      fsCases,
      summaryAmount: Number(summaryAmount.toFixed(2)),
      summaryCases,
      payableAmount: 0,
      note: `นำเข้าจากไฟล์ REP (${totalCases} ธุรกรรม)`,
    });
    seqIdx += 1;
  }

  return { records: results, transactions: normalizedTxs };
}

function findColumnIndex(
  headerRows: string[][],
  matcher: (colStack: string) => boolean
): number {
  const maxCols = Math.max(...headerRows.map((r) => r.length), 0);
  for (let c = 0; c < maxCols; c++) {
    const stack = headerRows
      .map((r) => String(r[c] ?? '').trim())
      .filter(Boolean)
      .join(' ');
    if (matcher(stack)) {
      return c;
    }
  }
  return -1;
}

export async function parseExcelOrCsvFile(file: File): Promise<ParsedExcelResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error('ไฟล์ไม่มีข้อมูลแถวใด ๆ');
  }

  // Detect NHSO REP Statement format (image_267bd48a.png) first
  let repHeaderIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? '').trim()).join(' ');
    if (
      rowStr.includes('REP') &&
      (rowStr.includes('TRAN_ID') || rowStr.includes('ชื่อ-นามสกุล') || rowStr.includes('เรียกเก็บ'))
    ) {
      repHeaderIdx = i;
      break;
    }
  }

  if (repHeaderIdx >= 0) {
    const parseRepHeaderCols = (startIdx: number) => {
      const r0 = (rows[startIdx] || []).map((c) => String(c ?? '').trim());
      const r1 = (rows[startIdx + 1] || []).map((c) => String(c ?? '').trim());
      const r2 = (rows[startIdx + 2] || []).map((c) => String(c ?? '').trim());

      const r1LooksLikeHeader = r1.some((c) =>
        /(HCODE|AdjRW|DRUG|ยอดชดเชย|HTYPE_HCODE|\(2\))/i.test(c)
      );
      const r2LooksLikeHeader = r2.some((c) =>
        /(DRUG|ยอดชดเชยที่คำนวณได้|ยอดชดเชยที่จ่ายจริง|\(2\)|\(3\))/i.test(c)
      );

      const headerDepth = r2LooksLikeHeader ? 3 : r1LooksLikeHeader ? 2 : 1;
      const headerRows = [r0, ...(headerDepth >= 2 ? [r1] : []), ...(headerDepth >= 3 ? [r2] : [])];

      const colHc = findColumnIndex(headerRows, (s) => /\bHC\b/i.test(s) && !s.includes('HCODE') && !s.includes('DRUG'));
      const colAe = findColumnIndex(headerRows, (s) => /\bAE\b/i.test(s) && !s.includes('DRUG'));

      return {
        headerDepth,
        colRep: findColumnIndex(headerRows, (s) => /^REP\b/i.test(s)),
        colSeq: findColumnIndex(headerRows, (s) => s.includes('ลำดับที่')),
        colTranId: findColumnIndex(headerRows, (s) => /TRAN_ID/i.test(s)),
        colHn: findColumnIndex(headerRows, (s) => /\bHN\b/i.test(s)),
        colAn: findColumnIndex(headerRows, (s) => /\bAN\b/i.test(s)),
        colPid: findColumnIndex(headerRows, (s) => /\bPID\b/i.test(s)),
        colName: findColumnIndex(headerRows, (s) => s.includes('ชื่อ-นามสกุล')),
        colVisit: findColumnIndex(headerRows, (s) => s.includes('วันเข้ารักษา')),
        colDischarge: findColumnIndex(headerRows, (s) => s.includes('วันจำหน่าย')),
        colMainInscl: findColumnIndex(headerRows, (s) => /MAININSCL/i.test(s)),
        colProj: findColumnIndex(headerRows, (s) => /PROJCODE/i.test(s)),
        colHtypeHcode: findColumnIndex(headerRows, (s) => /\bHTYPE_HCODE\b/i.test(s) && !s.includes('PAID')),
        colProvHcode: findColumnIndex(headerRows, (s) => /\bPROV_HCODE\b/i.test(s) && !s.includes('PAID')),
        colHcode: findColumnIndex(headerRows, (s) => /\bHCODE\b/i.test(s) && !s.includes('HTYPE') && !s.includes('PROV') && !s.includes('PAID')),
        colClaimed: findColumnIndex(headerRows, (s) => s.includes('เรียกเก็บ')),
        colOp: findColumnIndex(headerRows, (s) => /\bOP\b/i.test(s)),
        colIpPaid: findColumnIndex(headerRows, (s) => s.includes('ยอดชดเชยที่จ่ายจริง') && !s.includes('DMIS')),
        colHc,
        colHcDrug: colHc >= 0 && String(headerRows[headerRows.length - 1][colHc + 1] ?? '').trim().toUpperCase() === 'DRUG' ? colHc + 1 : -1,
        colAe,
        colAeDrug: colAe >= 0 && String(headerRows[headerRows.length - 1][colAe + 1] ?? '').trim().toUpperCase() === 'DRUG' ? colAe + 1 : -1,
        colInst: findColumnIndex(headerRows, (s) => /\bINST\b/i.test(s)),
        colDmisPaid: findColumnIndex(headerRows, (s) => s.includes('DMIS_DRUG')),
        colPalliative: findColumnIndex(headerRows, (s) => /Palliative/i.test(s)),
        colDmishd: findColumnIndex(headerRows, (s) => /DMISHD/i.test(s)),
        colPp: findColumnIndex(headerRows, (s) => /\bPP\b/i.test(s)),
        colFs: findColumnIndex(headerRows, (s) => /\bFS\b/i.test(s)),
        colTotalComp: findColumnIndex(headerRows, (s) => s.includes('ยอดชดเชยทั้งสิ้น')),
      };
    };

    let currentSection: ClaimSection = 'normal';
    for (let i = 0; i < repHeaderIdx; i++) {
      const preText = (rows[i] || []).map((c) => String(c ?? '').trim()).join(' ');
      if (preText.includes('ข้อมูลอุทธรณ์')) {
        currentSection = 'appeal';
      } else if (preText.includes('ข้อมูลปกติ')) {
        currentSection = 'normal';
      }
    }

    let cols = parseRepHeaderCols(repHeaderIdx);
    const txs: ParsedRepTxRow[] = [];
    let detectedHcode = '';

    for (let r = repHeaderIdx + cols.headerDepth; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const joined = row.map((c) => String(c ?? '').trim()).join(' ').trim();
      if (!joined) continue;

      // Detect section switches ("ข้อมูลปกติ" / "ข้อมูลอุทธรณ์")
      if (joined.startsWith('ข้อมูลอุทธรณ์')) {
        currentSection = 'appeal';
        continue;
      }
      if (joined.startsWith('ข้อมูลปกติ')) {
        currentSection = 'normal';
        continue;
      }

      // Detect repeated REP header rows inside the sheet (e.g., under ข้อมูลอุทธรณ์)
      if (
        joined.includes('REP') &&
        (joined.includes('TRAN_ID') || joined.includes('ชื่อ-นามสกุล') || joined.includes('ลำดับที่'))
      ) {
        cols = parseRepHeaderCols(r);
        r += cols.headerDepth - 1;
        continue;
      }

      const repVal = cols.colRep >= 0 ? String(row[cols.colRep] ?? '').trim() : String(row[0] ?? '').trim();
      const tranVal =
        cols.colTranId >= 0 ? String(row[cols.colTranId] ?? '').trim() : String(row[2] ?? '').trim();

      // Skip grand total footer row (where REP and TRAN_ID are blank)
      if (!repVal && !tranVal) continue;
      if (repVal === 'รวม' || repVal.startsWith('รวม')) continue;

      if (!detectedHcode && cols.colHcode >= 0) {
        const hcCode = String(row[cols.colHcode] ?? '').trim();
        if (hcCode) detectedHcode = hcCode;
      }

      const claimed = cols.colClaimed >= 0 ? toSafeNum(row[cols.colClaimed]) : toSafeNum(row[17]);
      const op = cols.colOp >= 0 ? toSafeNum(row[cols.colOp]) : 0;
      const ipPaid = cols.colIpPaid >= 0 ? toSafeNum(row[cols.colIpPaid]) : 0;
      const hcTotal =
        (cols.colHc >= 0 ? toSafeNum(row[cols.colHc]) : 0) +
        (cols.colHcDrug >= 0 ? toSafeNum(row[cols.colHcDrug]) : 0);
      const aeTotal =
        (cols.colAe >= 0 ? toSafeNum(row[cols.colAe]) : 0) +
        (cols.colAeDrug >= 0 ? toSafeNum(row[cols.colAeDrug]) : 0);
      const pp = cols.colPp >= 0 ? toSafeNum(row[cols.colPp]) : 0;
      const fs = cols.colFs >= 0 ? toSafeNum(row[cols.colFs]) : 0;
      const otherPaid =
        (cols.colInst >= 0 ? toSafeNum(row[cols.colInst]) : 0) +
        (cols.colDmisPaid >= 0 ? toSafeNum(row[cols.colDmisPaid]) : 0) +
        (cols.colPalliative >= 0 ? toSafeNum(row[cols.colPalliative]) : 0) +
        (cols.colDmishd >= 0 ? toSafeNum(row[cols.colDmishd]) : 0);
      const totalComp = cols.colTotalComp >= 0 ? toSafeNum(row[cols.colTotalComp]) : 0;

      txs.push({
        rep: repVal || 'REP',
        seq: cols.colSeq >= 0 ? toSafeNum(row[cols.colSeq]) || txs.length + 1 : txs.length + 1,
        tranId: tranVal,
        hn: cols.colHn >= 0 ? String(row[cols.colHn] ?? '').trim() : '',
        an: cols.colAn >= 0 ? String(row[cols.colAn] ?? '').trim() : '',
        pid: cols.colPid >= 0 ? String(row[cols.colPid] ?? '').trim() : '',
        fullName: cols.colName >= 0 ? String(row[cols.colName] ?? '').trim() : '',
        visitDate: cols.colVisit >= 0 ? String(row[cols.colVisit] ?? '').trim() : '',
        dischargeDate: cols.colDischarge >= 0 ? String(row[cols.colDischarge] ?? '').trim() : '',
        mainInscl: cols.colMainInscl >= 0 ? String(row[cols.colMainInscl] ?? '').trim() : '',
        projCode: cols.colProj >= 0 ? String(row[cols.colProj] ?? '').trim() : '',
        htypeHcode: cols.colHtypeHcode >= 0 ? String(row[cols.colHtypeHcode] ?? '').trim() : '',
        provHcode: cols.colProvHcode >= 0 ? String(row[cols.colProvHcode] ?? '').trim() : '',
        hcode: cols.colHcode >= 0 ? String(row[cols.colHcode] ?? '').trim() : '',
        claimed,
        op,
        ipPaid,
        hcTotal,
        aeTotal,
        pp,
        fs,
        otherPaid,
        totalComp,
        claimSection: currentSection,
      });
    }

    const { records, transactions } = groupRepTransactionsToV3(txs);
    const warnings: string[] = [];
    if (records.length === 0) {
      warnings.push('ไม่พบแถวรายการธุรกรรมในไฟล์ REP ที่นำเข้าได้');
    }

    return {
      records,
      transactions,
      warnings,
      detectedFormat: 'NHSO_REP_STATEMENT',
      rawTransactionCount: txs.length,
      detectedHcode: detectedHcode || undefined,
    };
  }

  // Fallback: V.3 5367 Summary Format (2-row or flat)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowStr = (rows[i] || []).map((c) => String(c ?? '').trim()).join(' ');
    if (rowStr.includes('รายงานงวด') || (rowStr.includes('ลำดับ') && rowStr.includes('จำนวน'))) {
      headerRowIdx = i;
      break;
    }
  }

  let dataStartIdx = 0;
  let detectedFormat: ParsedExcelResult['detectedFormat'] = 'POSITIONAL_V3';
  let payableColIdx = -1;
  let monthKeyColIdx = -1;
  let noteColIdx = -1;

  if (headerRowIdx >= 0) {
    const headerRow = (rows[headerRowIdx] || []).map((c) => String(c ?? '').trim());
    const nextRow = (rows[headerRowIdx + 1] || []).map((c) => String(c ?? '').trim());
    const nextRowJoined = nextRow.join(' ');

    if (
      nextRowJoined.includes('จำนวนเงินที่ได้รับ') ||
      nextRowJoined.includes('จำนวนเคสที่ได้รับชดเชย') ||
      nextRowJoined.includes('เคส')
    ) {
      detectedFormat = 'V3_TWO_ROW';
      dataStartIdx = headerRowIdx + 2;
      const combinedHeaders = headerRow.map((h, idx) => `${h} ${nextRow[idx] || ''}`.trim());
      payableColIdx = combinedHeaders.findIndex((h) => h.includes('พึงจ่าย'));
      monthKeyColIdx = combinedHeaders.findIndex(
        (h) => h.includes('เดือนอ้างอิง') || h.includes('เดือน') || h.includes('monthKey')
      );
      noteColIdx = combinedHeaders.findIndex((h) => h.includes('หมายเหตุ'));
    } else {
      detectedFormat = 'FLAT_HEADER';
      dataStartIdx = headerRowIdx + 1;
      payableColIdx = headerRow.findIndex((h) => h.includes('พึงจ่าย'));
      monthKeyColIdx = headerRow.findIndex(
        (h) => h.includes('เดือนอ้างอิง') || h.includes('เดือน') || h.includes('monthKey')
      );
      noteColIdx = headerRow.findIndex((h) => h.includes('หมายเหตุ'));
    }
  }

  const warnings: string[] = [];
  const records: ClaimRecordInput[] = [];

  for (let r = dataStartIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();

    if (
      col0 === 'รวม' ||
      col0.startsWith('จำนวนเงินทั้งสิ้น') ||
      col0.startsWith('ตั้งค่าหน่วยงาน') ||
      col1 === 'รวม'
    ) {
      continue;
    }

    const hasAnyValue = row.some((cell, idx) => idx > 0 && String(cell ?? '').trim() !== '');
    if (!col1 && !hasAnyValue) continue;

    const seqNo = toSafeNum(row[0]) || records.length + 1;
    const reportPeriod = (col1 || `งวดที่ ${seqNo}`).slice(0, SCHEMA_LIMITS.REPORT_PERIOD_MAX);
    const totalCases = toSafeNum(row[2]);
    const claimedAmount = toSafeNum(row[3]);

    const normalReceivedAmount = toSafeNum(row[4]);
    const normalCompensatedCases = toSafeNum(row[5]);
    const normalUncompensatedCases = toSafeNum(row[6]);

    const appealReceivedAmount = toSafeNum(row[7]);
    const appealReceivedCases = toSafeNum(row[8]);
    const appealUncompensatedCases = toSafeNum(row[9]);

    const herbalAmount = toSafeNum(row[10]);
    const herbalCases = toSafeNum(row[11]);

    const aeAmount = toSafeNum(row[12]);
    const aeCases = toSafeNum(row[13]);

    const ppAmount = toSafeNum(row[14]);
    const ppCases = toSafeNum(row[15]);

    const fsAmount = toSafeNum(row[16]);
    const fsCases = toSafeNum(row[17]);

    const rawSummaryAmount = toSafeNum(row[18]);
    const rawSummaryCases = toSafeNum(row[19]);

    const computedSumAmount =
      normalReceivedAmount +
      appealReceivedAmount +
      herbalAmount +
      aeAmount +
      ppAmount +
      fsAmount;
    const computedSumCases =
      normalCompensatedCases +
      appealReceivedCases +
      herbalCases +
      aeCases +
      ppCases +
      fsCases;

    const summaryAmount = rawSummaryAmount > 0 ? rawSummaryAmount : computedSumAmount;
    const summaryCases = rawSummaryCases > 0 ? rawSummaryCases : computedSumCases;

    let payableAmount = 0;
    let monthKey = inferMonthKeyFromPeriod(reportPeriod, records.length);
    let note = '';

    const resolvedPayableIdx = payableColIdx >= 0 ? payableColIdx : row.length > 20 ? 20 : -1;
    if (resolvedPayableIdx >= 0) {
      payableAmount = toSafeNum(row[resolvedPayableIdx]);
    }

    if (monthKeyColIdx >= 0 && row[monthKeyColIdx]) {
      const candidate = String(row[monthKeyColIdx]).trim();
      if (SCHEMA_LIMITS.MONTH_KEY_REGEX.test(candidate)) {
        monthKey = candidate;
      }
    } else if (monthKeyColIdx < 0 && row[21]) {
      const candidate = String(row[21]).trim();
      if (SCHEMA_LIMITS.MONTH_KEY_REGEX.test(candidate)) {
        monthKey = candidate;
      }
    }

    if (noteColIdx >= 0 && row[noteColIdx]) {
      note = String(row[noteColIdx]).trim().slice(0, SCHEMA_LIMITS.NOTE_MAX);
    } else if (noteColIdx < 0) {
      if (row[22]) {
        note = String(row[22]).trim().slice(0, SCHEMA_LIMITS.NOTE_MAX);
      } else if (row[21] && !SCHEMA_LIMITS.MONTH_KEY_REGEX.test(String(row[21]).trim())) {
        note = String(row[21]).trim().slice(0, SCHEMA_LIMITS.NOTE_MAX);
      }
    }

    records.push({
      seqNo,
      reportPeriod,
      monthKey,
      totalCases,
      claimedAmount,
      normalReceivedAmount,
      normalCompensatedCases,
      normalUncompensatedCases,
      appealReceivedAmount,
      appealReceivedCases,
      appealUncompensatedCases,
      herbalAmount,
      herbalCases,
      aeAmount,
      aeCases,
      ppAmount,
      ppCases,
      fsAmount,
      fsCases,
      summaryAmount,
      summaryCases,
      payableAmount,
      note,
    });
  }

  if (records.length === 0) {
    warnings.push('ไม่พบแถวข้อมูลรายงานที่นำเข้าได้ กรุณาตรวจสอบหัวตารางตามไฟล์ตัวอย่าง REP หรือ V.3 5367');
  }

  return { records, warnings, detectedFormat };
}

function sampleToParsedTx(): ParsedRepTxRow[] {
  return SAMPLE_REP_TRANSACTIONS.map((t) => ({
    rep: t.rep,
    seq: t.seq,
    tranId: t.tranId,
    hn: t.hn,
    an: t.an,
    pid: t.pid,
    fullName: t.fullName,
    visitDate: t.visitDate,
    dischargeDate: t.dischargeDate,
    mainInscl: t.mainInscl,
    projCode: t.projCode,
    htypeHcode: t.htypeHcode,
    provHcode: t.provHcode,
    hcode: t.hcode,
    claimed: t.claimed,
    op: t.op,
    ipPaid: t.ipPaid,
    hcTotal: t.hc + t.hcDrug,
    aeTotal: t.ae + t.aeDrug,
    pp: t.pp,
    fs: t.fs,
    otherPaid: t.inst + t.dmisPaid + t.dmisDrug + t.palliative + t.dmishd,
    totalComp: t.totalComp,
    claimSection:
      t.claimSection || (/appeal|อุทธรณ์/i.test(t.projCode) ? 'appeal' : 'normal'),
  }));
}

export function getSampleV3Rows(): ClaimRecordInput[] {
  return groupRepTransactionsToV3(sampleToParsedTx()).records;
}

export function getSampleRepTransactions(): RepTransactionInput[] {
  return groupRepTransactionsToV3(sampleToParsedTx()).transactions;
}

/**
 * Generates an Excel (.xlsx) sample import file matching the exact NHSO REP Statement
 * column structure in the user's attached screenshot (image_267bd48a.png).
 */
export function downloadSampleTemplateExcel() {
  const row0 = [
    'REP',
    'ลำดับที่',
    'TRAN_ID',
    'HN',
    'AN',
    'PID',
    'ชื่อ-นามสกุล',
    'วันเข้ารักษา',
    'วันจำหน่าย',
    'MAININSCL',
    'PROJCODE',
    'หน่วยบริการ',
    '',
    '',
    '',
    '',
    '',
    'เรียกเก็บ',
    'กองทุน IP',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'ยอดชดเชยทั้งสิ้น',
  ];

  const row1 = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'HTYPE_HCODE',
    'PROV_HCODE',
    'HCODE',
    'HTYPE_HCODE_PAID',
    'PROV_HCODE_PAID',
    'HCODE_PAID',
    '',
    'พรบ.',
    'AdjRW',
    'ล่าช้า(PS)',
    'CCUF',
    'AdjRW2',
    'อัตราจ่าย',
    'เงินเดือน',
    'ชดเชยหัก พรบ.และ',
    'OP',
    'IP',
    '',
    'HC',
    '',
    'AE',
    '',
    'INST',
    'DMIS',
    '',
    '',
    'Palliative care',
    'DMISHD',
    'PP',
    'FS',
    '',
  ];

  const row2 = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '(2)',
    '(3)',
    '(4)',
    '(5)',
    '(6) = (3x4x5)',
    '(7)',
    '(8)',
    '(9)',
    '',
    'ยอดชดเชยที่คำนวณได้',
    'ยอดชดเชยที่จ่ายจริง',
    'HC',
    'DRUG',
    'AE',
    'DRUG',
    '',
    'ยอดชดเชยที่คำนวณได้',
    'ยอดชดเชยที่จ่ายจริง',
    'DMIS_DRUG',
    '',
    '',
    '',
    '',
    '',
  ];

  const dataRows = SAMPLE_REP_TRANSACTIONS.map((t) => [
    t.rep,
    t.seq,
    t.tranId,
    t.hn,
    t.an,
    t.pid,
    t.fullName,
    t.visitDate,
    t.dischargeDate,
    t.mainInscl,
    t.projCode,
    t.htypeHcode,
    t.provHcode,
    t.hcode,
    t.htypeHcodePaid,
    t.provHcodePaid,
    t.hcodePaid,
    t.claimed,
    0,
    0,
    0,
    '100%',
    1,
    0,
    0,
    0,
    t.op,
    0,
    t.ipPaid,
    t.hc,
    t.hcDrug,
    t.ae,
    t.aeDrug,
    t.inst,
    0,
    t.dmisPaid,
    t.dmisDrug,
    t.palliative,
    t.dmishd,
    t.pp,
    t.fs,
    t.totalComp,
  ]);

  const totalClaimed = SAMPLE_REP_TRANSACTIONS.reduce((s, t) => s + t.claimed, 0);
  const totalComp = SAMPLE_REP_TRANSACTIONS.reduce((s, t) => s + t.totalComp, 0);
  const totalRow = new Array(42).fill('');
  totalRow[17] = Number(totalClaimed.toFixed(2));
  totalRow[41] = Number(totalComp.toFixed(2));

  const ws = XLSX.utils.aoa_to_sheet([row0, row1, row2, ...dataRows, totalRow]);

  ws['!merges'] = [
    // First 11 columns span rows 0..2
    ...Array.from({ length: 11 }, (_, c) => ({ s: { r: 0, c }, e: { r: 2, c } })),
    // หน่วยบริการ (cols 11..16)
    { s: { r: 0, c: 11 }, e: { r: 0, c: 16 } },
    ...Array.from({ length: 6 }, (_, idx) => ({
      s: { r: 1, c: 11 + idx },
      e: { r: 2, c: 11 + idx },
    })),
    // เรียกเก็บ (col 17) spans rows 0..2
    { s: { r: 0, c: 17 }, e: { r: 2, c: 17 } },
    // กองทุน IP (cols 18..40)
    { s: { r: 0, c: 18 }, e: { r: 0, c: 40 } },
    // OP (col 26), INST (col 33), Palliative (col 37), DMISHD (col 38), PP (col 39), FS (col 40) span rows 1..2
    { s: { r: 1, c: 26 }, e: { r: 2, c: 26 } },
    { s: { r: 1, c: 27 }, e: { r: 1, c: 28 } }, // IP
    { s: { r: 1, c: 29 }, e: { r: 1, c: 30 } }, // HC
    { s: { r: 1, c: 31 }, e: { r: 1, c: 32 } }, // AE
    { s: { r: 1, c: 33 }, e: { r: 2, c: 33 } }, // INST
    { s: { r: 1, c: 34 }, e: { r: 1, c: 36 } }, // DMIS
    { s: { r: 1, c: 37 }, e: { r: 2, c: 37 } }, // Palliative
    { s: { r: 1, c: 38 }, e: { r: 2, c: 38 } }, // DMISHD
    { s: { r: 1, c: 39 }, e: { r: 2, c: 39 } }, // PP
    { s: { r: 1, c: 40 }, e: { r: 2, c: 40 } }, // FS
    // ยอดชดเชยทั้งสิ้น (col 41) spans rows 0..2
    { s: { r: 0, c: 41 }, e: { r: 2, c: 41 } },
  ];

  ws['!cols'] = [
    { wch: 12 }, // REP
    { wch: 8 }, // ลำดับที่
    { wch: 12 }, // TRAN_ID
    { wch: 10 }, // HN
    { wch: 8 }, // AN
    { wch: 16 }, // PID
    { wch: 24 }, // ชื่อ-นามสกุล
    { wch: 20 }, // วันเข้ารักษา
    { wch: 14 }, // วันจำหน่าย
    { wch: 10 }, // MAININSCL
    { wch: 10 }, // PROJCODE
    { wch: 12 }, // HTYPE_HCODE
    { wch: 12 }, // PROV_HCODE
    { wch: 10 }, // HCODE
    { wch: 16 }, // HTYPE_HCODE_PAID
    { wch: 16 }, // PROV_HCODE_PAID
    { wch: 12 }, // HCODE_PAID
    { wch: 12 }, // เรียกเก็บ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'REP_Detail');
  triggerXlsxDownload(wb, 'ตัวอย่างไฟล์นำเข้า_REP_รพสต.xlsx');
}

function triggerXlsxDownload(wb: XLSX.WorkBook, filename: string) {
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyNumericFormats(
  ws: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  moneyCols: number[],
  intCols: number[]
) {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of moneyCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr] && typeof ws[addr].v === 'number') {
        ws[addr].z = '#,##0.00';
      }
    }
    for (const c of intCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr] && typeof ws[addr].v === 'number') {
        ws[addr].z = '#,##0';
      }
    }
  }
}

function buildV3Sheet(rows: ClaimRecordInput[], unitCode: string, unitName: string): XLSX.WorkSheet {
  const titleBar = [
    'รายงานพึงรับ-พึงจ่าย รพ.สต.',
    '',
    'V.3 5367',
    '',
    'รหัสหน่วยงาน',
    unitCode || '-',
    'ชื่อหน่วยงาน',
    unitName || '-',
  ];

  const headerTop = [
    'ลำดับ',
    'รายงานงวด',
    'จำนวนเคสทั้งหมด',
    'จำนวนเงินที่เรียกเก็บ',
    'กรณีเบิกปกติ',
    '',
    '',
    'กรณีอุทธรณ์ข้อมูล',
    '',
    '',
    'ยาสมุนไพร 9 รายการ',
    '',
    'AE',
    '',
    'PP',
    '',
    'FS (OP Anywhere)',
    '',
    'จำนวนเงิน',
    'เคส',
    'ยอดพึงจ่าย (บาท)',
    'คงเหลือสุทธิ (บาท)',
    'เดือนอ้างอิง',
    'หมายเหตุ',
  ];

  const headerSub = [
    '',
    '',
    '',
    '',
    'จำนวนเงินที่ได้รับ',
    'จำนวนเคสที่ได้รับชดเชย',
    'จำนวนเคสที่ไม่ได้รับชดเชย',
    'จำนวนเงินที่ได้รับ',
    'จำนวนเคสที่ได้รับ',
    'จำนวนเคสที่ไม่ได้รับชดเชย',
    'จำนวนเงิน',
    'เคส',
    'จำนวนเงิน',
    'เคส',
    'จำนวนเงิน',
    'เคส',
    'จำนวนเงิน',
    'เคส',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const body = rows.map((r) => {
    const received = computeRecordReceived(r);
    const net = Number((received - (r.payableAmount || 0)).toFixed(2));
    return [
      r.seqNo,
      r.reportPeriod,
      r.totalCases,
      r.claimedAmount,
      r.normalReceivedAmount,
      r.normalCompensatedCases,
      r.normalUncompensatedCases,
      r.appealReceivedAmount,
      r.appealReceivedCases,
      r.appealUncompensatedCases,
      r.herbalAmount,
      r.herbalCases,
      r.aeAmount,
      r.aeCases,
      r.ppAmount,
      r.ppCases,
      r.fsAmount,
      r.fsCases,
      received,
      r.summaryCases,
      r.payableAmount,
      net,
      r.monthKey,
      r.note,
    ];
  });

  const fakeRecords: ClaimRecord[] = rows.map((r, i) => ({
    ...r,
    id: `row_${i}`,
    ownerUid: '',
    unitId: '',
    importBatchId: '',
  }));
  const totals = computeAggregateTotals(fakeRecords);

  const footerRow = [
    'รวม',
    `${rows.length} งวด`,
    totals.totalCases,
    totals.claimedAmount,
    totals.normalReceivedAmount,
    totals.normalCompensatedCases,
    totals.normalUncompensatedCases,
    totals.appealReceivedAmount,
    totals.appealReceivedCases,
    totals.appealUncompensatedCases,
    totals.herbalAmount,
    totals.herbalCases,
    totals.aeAmount,
    totals.aeCases,
    totals.ppAmount,
    totals.ppCases,
    totals.fsAmount,
    totals.fsCases,
    totals.summaryAmount,
    totals.summaryCases,
    totals.payableAmount,
    totals.netBalance,
    '',
    'สรุปรวมตามมาตรฐาน V.3 5367',
  ];

  const unitFooter = [
    'จำนวนเงินทั้งสิ้น',
    totals.summaryAmount,
    '',
    'จำนวนเคส',
    totals.summaryCases,
    '',
    'รหัสหน่วยงาน',
    unitCode || '-',
    'ชื่อหน่วยงาน',
    unitName || '-',
  ];

  const aoa = [titleBar, headerTop, headerSub, ...body, footerRow, [], unitFooter];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Header merges (headerTop is row 1, headerSub is row 2)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 1, c: 9 } },
    { s: { r: 1, c: 10 }, e: { r: 1, c: 11 } },
    { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } },
    { s: { r: 1, c: 14 }, e: { r: 1, c: 15 } },
    { s: { r: 1, c: 16 }, e: { r: 1, c: 17 } },
    { s: { r: 1, c: 18 }, e: { r: 2, c: 18 } },
    { s: { r: 1, c: 19 }, e: { r: 2, c: 19 } },
    { s: { r: 1, c: 20 }, e: { r: 2, c: 20 } },
    { s: { r: 1, c: 21 }, e: { r: 2, c: 21 } },
    { s: { r: 1, c: 22 }, e: { r: 2, c: 22 } },
    { s: { r: 1, c: 23 }, e: { r: 2, c: 23 } },
  ];

  const dataStartRow = 3;
  const footerRowIdx = 3 + body.length;
  applyNumericFormats(
    ws,
    dataStartRow,
    footerRowIdx,
    [3, 4, 7, 10, 12, 14, 16, 18, 20, 21],
    [0, 2, 5, 6, 8, 9, 11, 13, 15, 17, 19]
  );

  const unitFooterRowIdx = footerRowIdx + 2;
  const sumMoneyCell = XLSX.utils.encode_cell({ r: unitFooterRowIdx, c: 1 });
  if (ws[sumMoneyCell]) ws[sumMoneyCell].z = '#,##0.00';
  const sumCasesCell = XLSX.utils.encode_cell({ r: unitFooterRowIdx, c: 4 });
  if (ws[sumCasesCell]) ws[sumCasesCell].z = '#,##0';

  ws['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
  ];

  return ws;
}

function buildMonthlySummaryRows(rows: ClaimRecordInput[]) {
  const byMonth = new Map<string, ClaimRecordInput[]>();
  for (const r of rows) {
    const list = byMonth.get(r.monthKey) ?? [];
    list.push(r);
    byMonth.set(r.monthKey, list);
  }

  const sortedMonths = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  const monthlyRows = sortedMonths.map(([monthKey, items]) => {
    const fake: ClaimRecord[] = items.map((r, i) => ({
      ...r,
      id: `m_${i}`,
      ownerUid: '',
      unitId: '',
      importBatchId: '',
    }));
    const t = computeAggregateTotals(fake);
    return {
      monthKey,
      monthLabelTh: formatMonthKeyThai(monthKey),
      ...t,
    };
  });

  const allFake: ClaimRecord[] = rows.map((r, i) => ({
    ...r,
    id: `all_${i}`,
    ownerUid: '',
    unitId: '',
    importBatchId: '',
  }));
  const grandTotal = computeAggregateTotals(allFake);

  return { monthlyRows, grandTotal };
}

function buildMonthlySummarySheet(
  rows: ClaimRecordInput[],
  unitCode: string,
  unitName: string
): XLSX.WorkSheet {
  const headers = [
    'เดือน (พ.ศ.)',
    'รหัสเดือน',
    'จำนวนงวด',
    'เคสทั้งหมด',
    'ยอดเรียกเก็บ (พึงรับ)',
    'ปกติ_ได้รับจริง',
    'ปกติ_เคสชดเชย',
    'ปกติ_เคสไม่ชดเชย',
    'อุทธรณ์_ได้รับจริง',
    'อุทธรณ์_เคสได้รับ',
    'อุทธรณ์_เคสไม่ชดเชย',
    'ยาสมุนไพร 9 รายการ (บาท)',
    'ยาสมุนไพร (เคส)',
    'AE (บาท)',
    'AE (เคส)',
    'PP (บาท)',
    'PP (เคส)',
    'FS OP Anywhere (บาท)',
    'FS (เคส)',
    'รวมได้รับจริง V.3 (บาท)',
    'รวมเคสชดเชย V.3',
    'อัตราชดเชย (%)',
    'ส่วนต่างเรียกเก็บ (บาท)',
    'ยอดพึงจ่าย (บาท)',
    'คงเหลือสุทธิ (บาท)',
  ];

  const { monthlyRows, grandTotal } = buildMonthlySummaryRows(rows);

  const body = monthlyRows.map((t) => [
    t.monthLabelTh,
    t.monthKey,
    t.recordCount,
    t.totalCases,
    Number(t.claimedAmount.toFixed(2)),
    Number(t.normalReceivedAmount.toFixed(2)),
    t.normalCompensatedCases,
    t.normalUncompensatedCases,
    Number(t.appealReceivedAmount.toFixed(2)),
    t.appealReceivedCases,
    t.appealUncompensatedCases,
    Number(t.herbalAmount.toFixed(2)),
    t.herbalCases,
    Number(t.aeAmount.toFixed(2)),
    t.aeCases,
    Number(t.ppAmount.toFixed(2)),
    t.ppCases,
    Number(t.fsAmount.toFixed(2)),
    t.fsCases,
    Number(t.summaryAmount.toFixed(2)),
    t.summaryCases,
    Number(t.compensationRatePct.toFixed(2)),
    Number(t.claimGap.toFixed(2)),
    Number(t.payableAmount.toFixed(2)),
    Number(t.netBalance.toFixed(2)),
  ]);

  const footerRow = [
    'รวมทั้งสิ้น',
    `${monthlyRows.length} เดือน`,
    grandTotal.recordCount,
    grandTotal.totalCases,
    Number(grandTotal.claimedAmount.toFixed(2)),
    Number(grandTotal.normalReceivedAmount.toFixed(2)),
    grandTotal.normalCompensatedCases,
    grandTotal.normalUncompensatedCases,
    Number(grandTotal.appealReceivedAmount.toFixed(2)),
    grandTotal.appealReceivedCases,
    grandTotal.appealUncompensatedCases,
    Number(grandTotal.herbalAmount.toFixed(2)),
    grandTotal.herbalCases,
    Number(grandTotal.aeAmount.toFixed(2)),
    grandTotal.aeCases,
    Number(grandTotal.ppAmount.toFixed(2)),
    grandTotal.ppCases,
    Number(grandTotal.fsAmount.toFixed(2)),
    grandTotal.fsCases,
    Number(grandTotal.summaryAmount.toFixed(2)),
    grandTotal.summaryCases,
    Number(grandTotal.compensationRatePct.toFixed(2)),
    Number(grandTotal.claimGap.toFixed(2)),
    Number(grandTotal.payableAmount.toFixed(2)),
    Number(grandTotal.netBalance.toFixed(2)),
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    [
      'รายงานสรุปยอดพึงรับ-พึงจ่ายรายเดือนละเอียด (V.3 5367)',
      '',
      '',
      'รหัสหน่วยงาน',
      unitCode || '-',
      'ชื่อหน่วยงาน',
      unitName || '-',
    ],
    headers,
    ...body,
    footerRow,
  ]);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 11 } },
  ];

  applyNumericFormats(
    ws,
    2,
    2 + body.length,
    [4, 5, 8, 11, 13, 15, 17, 19, 21, 22, 23, 24],
    [2, 3, 6, 7, 9, 10, 12, 14, 16, 18, 20]
  );

  ws['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
  ];
  return ws;
}

export function downloadExcelReport(
  rows: ClaimRecordInput[],
  unitCode: string,
  unitName: string,
  filename?: string
): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const safeCode = (unitCode || 'RPHST').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetFilename =
    filename || `รายงานพึงรับ_พึงจ่าย_${safeCode}_V3_5367_${dateTag}.xlsx`;

  const wb = XLSX.utils.book_new();
  const wsV3 = buildV3Sheet(rows, unitCode, unitName);
  const wsMonthly = buildMonthlySummarySheet(rows, unitCode, unitName);
  XLSX.utils.book_append_sheet(wb, wsV3, 'V3_5367');
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'สรุปรายเดือน');
  triggerXlsxDownload(wb, targetFilename);
  return targetFilename;
}

function buildRepSectionSheet(
  reportPeriod: string,
  txs: RepTransactionInput[],
  unitCode: string,
  unitName: string
): XLSX.WorkSheet {
  const normalRows = txs.filter((t) => t.claimSection === 'normal');
  const appealRows = txs.filter((t) => t.claimSection === 'appeal');

  const headerTop = [
    'REP',
    'ลำดับที่',
    'TRAN_ID',
    'HN',
    'AN',
    'PID',
    'ชื่อ-นามสกุล',
    'วันเข้ารักษา',
    'วันจำหน่าย',
    'MAININSCL',
    'PROJCODE',
    'หน่วยบริการ',
    '',
    '',
    'เรียกเก็บ',
    'OP',
    'IP',
    'HC',
    'AE',
    'PP',
    'FS',
    'ยอดชดเชยทั้งสิ้น',
  ];

  const headerSub = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'HTYPE_HCODE',
    'PROV_HCODE',
    'HCODE',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const mapTxRow = (t: RepTransactionInput) => [
    t.repCode,
    t.seq,
    t.tranId,
    t.hn,
    t.an,
    t.pid,
    t.fullName,
    t.visitDate,
    t.dischargeDate,
    t.mainInscl,
    t.projCode,
    t.htypeHcode,
    t.provHcode,
    t.hcode,
    Number((t.claimed || 0).toFixed(2)),
    Number((t.op || 0).toFixed(2)),
    Number((t.ipPaid || 0).toFixed(2)),
    Number((t.hcTotal || 0).toFixed(2)),
    Number((t.aeTotal || 0).toFixed(2)),
    Number((t.pp || 0).toFixed(2)),
    Number((t.fs || 0).toFixed(2)),
    Number((t.totalComp || 0).toFixed(2)),
  ];

  const sumBlock = (label: string, items: RepTransactionInput[]) => {
    const claimed = items.reduce((s, x) => s + (x.claimed || 0), 0);
    const op = items.reduce((s, x) => s + (x.op || 0), 0);
    const ip = items.reduce((s, x) => s + (x.ipPaid || 0), 0);
    const hc = items.reduce((s, x) => s + (x.hcTotal || 0), 0);
    const ae = items.reduce((s, x) => s + (x.aeTotal || 0), 0);
    const pp = items.reduce((s, x) => s + (x.pp || 0), 0);
    const fs = items.reduce((s, x) => s + (x.fs || 0), 0);
    const comp = items.reduce((s, x) => s + (x.totalComp || 0), 0);
    return [
      label,
      items.length,
      '',
      '',
      '',
      '',
      `${items.length} รายการ`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Number(claimed.toFixed(2)),
      Number(op.toFixed(2)),
      Number(ip.toFixed(2)),
      Number(hc.toFixed(2)),
      Number(ae.toFixed(2)),
      Number(pp.toFixed(2)),
      Number(fs.toFixed(2)),
      Number(comp.toFixed(2)),
    ];
  };

  const aoa: (string | number)[][] = [];
  const merges: XLSX.Range[] = [];

  aoa.push([
    `รายละเอียดรายงานงวด: ${reportPeriod}`,
    '',
    '',
    'รหัสหน่วยงาน',
    unitCode || '-',
    'ชื่อหน่วยงาน',
    unitName || '-',
  ]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });

  const addSection = (sectionLabel: string, items: RepTransactionInput[]) => {
    aoa.push([sectionLabel]);
    const hTopRow = aoa.length;
    aoa.push(headerTop);
    aoa.push(headerSub);

    for (let c = 0; c <= 10; c++) {
      merges.push({ s: { r: hTopRow, c }, e: { r: hTopRow + 1, c } });
    }
    merges.push({ s: { r: hTopRow, c: 11 }, e: { r: hTopRow, c: 13 } });
    for (let c = 14; c <= 21; c++) {
      merges.push({ s: { r: hTopRow, c }, e: { r: hTopRow + 1, c } });
    }

    if (items.length === 0) {
      aoa.push(['-', '', '', '', '', '', `ไม่มีรายการ${sectionLabel}`, '', '', '', '', '', '', '', 0, 0, 0, 0, 0, 0, 0, 0]);
    } else {
      for (const item of items) {
        aoa.push(mapTxRow(item));
      }
    }
    aoa.push(sumBlock(`รวม${sectionLabel}`, items));
    aoa.push([]);
  };

  addSection('ข้อมูลปกติ', normalRows);
  addSection('ข้อมูลอุทธรณ์', appealRows);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 24 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
  ];
  return ws;
}

export function downloadPeriodDetailExcel(
  reportPeriod: string,
  txs: RepTransactionInput[],
  unitCode: string,
  unitName: string
): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const safePeriod = reportPeriod.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetFilename = `รายละเอียด_${safePeriod}_${dateTag}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws = buildRepSectionSheet(reportPeriod, txs, unitCode, unitName);
  const sheetName = safePeriod.slice(0, 31) || 'รายละเอียดงวด';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  triggerXlsxDownload(wb, targetFilename);
  return targetFilename;
}

export function downloadMonthlyDetailExcel(
  rows: ClaimRecordInput[],
  unitCode: string,
  unitName: string,
  filename?: string,
  transactions?: RepTransactionInput[]
): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const safeCode = (unitCode || 'RPHST').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetFilename =
    filename || `รายงานสรุปรายเดือนละเอียด_${safeCode}_V3_5367_${dateTag}.xlsx`;

  const sortedRows = [...rows].sort((a, b) => {
    const monthCmp = (a.monthKey || '').localeCompare(b.monthKey || '');
    if (monthCmp !== 0) return monthCmp;
    return (a.seqNo || 0) - (b.seqNo || 0);
  });

  const wb = XLSX.utils.book_new();
  const wsMonthly = buildMonthlySummarySheet(sortedRows, unitCode, unitName);
  const wsDetail = buildV3Sheet(sortedRows, unitCode, unitName);
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'สรุปรายเดือนละเอียด');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายละเอียดรายงวด');

  if (transactions && transactions.length > 0) {
    const byPeriod = new Map<string, RepTransactionInput[]>();
    for (const tx of transactions) {
      const key = tx.reportPeriod || tx.repCode;
      const list = byPeriod.get(key) ?? [];
      list.push(tx);
      byPeriod.set(key, list);
    }
    let idx = 1;
    for (const [period, periodTxs] of byPeriod.entries()) {
      if (idx > 15) break;
      const cleanName = period.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || `งวด_${idx}`;
      const wsPeriod = buildRepSectionSheet(period, periodTxs, unitCode, unitName);
      XLSX.utils.book_append_sheet(wb, wsPeriod, cleanName);
      idx += 1;
    }
  }

  triggerXlsxDownload(wb, targetFilename);
  return targetFilename;
}

export function downloadMonthlyDetailCsv(
  rows: ClaimRecordInput[],
  unitCode = '',
  unitName = '',
  filename?: string
): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const safeCode = (unitCode || 'RPHST').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetFilename =
    filename || `รายงานสรุปรายเดือนละเอียด_${safeCode}_V3_5367_${dateTag}.csv`;

  const headers = [
    'เดือน (พ.ศ.)',
    'รหัสเดือน',
    'จำนวนงวด',
    'เคสทั้งหมด',
    'ยอดเรียกเก็บ (พึงรับ)',
    'ปกติ_ได้รับจริง',
    'ปกติ_เคสชดเชย',
    'ปกติ_เคสไม่ชดเชย',
    'อุทธรณ์_ได้รับจริง',
    'อุทธรณ์_เคสได้รับ',
    'อุทธรณ์_เคสไม่ชดเชย',
    'ยาสมุนไพร 9 รายการ (บาท)',
    'ยาสมุนไพร (เคส)',
    'AE (บาท)',
    'AE (เคส)',
    'PP (บาท)',
    'PP (เคส)',
    'FS OP Anywhere (บาท)',
    'FS (เคส)',
    'รวมได้รับจริง V.3 (บาท)',
    'รวมเคสชดเชย V.3',
    'อัตราชดเชย (%)',
    'ส่วนต่างเรียกเก็บ (บาท)',
    'ยอดพึงจ่าย (บาท)',
    'คงเหลือสุทธิ (บาท)',
    'หมายเหตุหน่วยงาน',
  ];

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const { monthlyRows, grandTotal } = buildMonthlySummaryRows(rows);
  const unitNote = `${unitCode || '-'} ${unitName || ''}`.trim();

  const dataLines = monthlyRows.map((t) =>
    [
      t.monthLabelTh,
      t.monthKey,
      t.recordCount,
      t.totalCases,
      Number(t.claimedAmount.toFixed(2)),
      Number(t.normalReceivedAmount.toFixed(2)),
      t.normalCompensatedCases,
      t.normalUncompensatedCases,
      Number(t.appealReceivedAmount.toFixed(2)),
      t.appealReceivedCases,
      t.appealUncompensatedCases,
      Number(t.herbalAmount.toFixed(2)),
      t.herbalCases,
      Number(t.aeAmount.toFixed(2)),
      t.aeCases,
      Number(t.ppAmount.toFixed(2)),
      t.ppCases,
      Number(t.fsAmount.toFixed(2)),
      t.fsCases,
      Number(t.summaryAmount.toFixed(2)),
      t.summaryCases,
      Number(t.compensationRatePct.toFixed(2)),
      Number(t.claimGap.toFixed(2)),
      Number(t.payableAmount.toFixed(2)),
      Number(t.netBalance.toFixed(2)),
      unitNote,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const footerLine = [
    'รวมทั้งสิ้น',
    `${monthlyRows.length} เดือน`,
    grandTotal.recordCount,
    grandTotal.totalCases,
    Number(grandTotal.claimedAmount.toFixed(2)),
    Number(grandTotal.normalReceivedAmount.toFixed(2)),
    grandTotal.normalCompensatedCases,
    grandTotal.normalUncompensatedCases,
    Number(grandTotal.appealReceivedAmount.toFixed(2)),
    grandTotal.appealReceivedCases,
    grandTotal.appealUncompensatedCases,
    Number(grandTotal.herbalAmount.toFixed(2)),
    grandTotal.herbalCases,
    Number(grandTotal.aeAmount.toFixed(2)),
    grandTotal.aeCases,
    Number(grandTotal.ppAmount.toFixed(2)),
    grandTotal.ppCases,
    Number(grandTotal.fsAmount.toFixed(2)),
    grandTotal.fsCases,
    Number(grandTotal.summaryAmount.toFixed(2)),
    grandTotal.summaryCases,
    Number(grandTotal.compensationRatePct.toFixed(2)),
    Number(grandTotal.claimGap.toFixed(2)),
    Number(grandTotal.payableAmount.toFixed(2)),
    Number(grandTotal.netBalance.toFixed(2)),
    unitNote,
  ]
    .map(escapeCsv)
    .join(',');

  const lines = [headers.map(escapeCsv).join(','), ...dataLines, footerLine];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return targetFilename;
}

export function downloadCsvReport(
  rows: ClaimRecordInput[],
  unitCode = '',
  unitName = '',
  filename?: string
): string {
  const dateTag = new Date().toISOString().slice(0, 10);
  const safeCode = (unitCode || 'RPHST').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetFilename =
    filename || `รายงานพึงรับ_พึงจ่าย_${safeCode}_V3_5367_${dateTag}.csv`;

  const headers = [
    'ลำดับ',
    'รายงานงวด',
    'จำนวนเคสทั้งหมด',
    'จำนวนเงินที่เรียกเก็บ',
    'กรณีเบิกปกติ_จำนวนเงินที่ได้รับ',
    'กรณีเบิกปกติ_จำนวนเคสที่ได้รับชดเชย',
    'กรณีเบิกปกติ_จำนวนเคสที่ไม่ได้รับชดเชย',
    'กรณีอุทธรณ์ข้อมูล_จำนวนเงินที่ได้รับ',
    'กรณีอุทธรณ์ข้อมูล_จำนวนเคสที่ได้รับ',
    'กรณีอุทธรณ์ข้อมูล_จำนวนเคสที่ไม่ได้รับชดเชย',
    'ยาสมุนไพร9รายการ_จำนวนเงิน',
    'ยาสมุนไพร9รายการ_เคส',
    'AE_จำนวนเงิน',
    'AE_เคส',
    'PP_จำนวนเงิน',
    'PP_เคส',
    'FS_OPAnywhere_จำนวนเงิน',
    'FS_OPAnywhere_เคส',
    'รวมรับ_V3_จำนวนเงิน',
    'รวมรับ_V3_เคส',
    'ยอดพึงจ่าย (บาท)',
    'คงเหลือสุทธิ (บาท)',
    'เดือนอ้างอิง',
    'หมายเหตุ',
  ];

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const fakeRecords: ClaimRecord[] = rows.map((r, i) => ({
    ...r,
    id: `csv_${i}`,
    ownerUid: '',
    unitId: '',
    importBatchId: '',
  }));
  const totals = computeAggregateTotals(fakeRecords);

  const dataLines = rows.map((r) => {
    const received = computeRecordReceived(r);
    const net = Number((received - (r.payableAmount || 0)).toFixed(2));
    return [
      r.seqNo,
      r.reportPeriod,
      r.totalCases,
      Number((r.claimedAmount || 0).toFixed(2)),
      Number((r.normalReceivedAmount || 0).toFixed(2)),
      r.normalCompensatedCases,
      r.normalUncompensatedCases,
      Number((r.appealReceivedAmount || 0).toFixed(2)),
      r.appealReceivedCases,
      r.appealUncompensatedCases,
      Number((r.herbalAmount || 0).toFixed(2)),
      r.herbalCases,
      Number((r.aeAmount || 0).toFixed(2)),
      r.aeCases,
      Number((r.ppAmount || 0).toFixed(2)),
      r.ppCases,
      Number((r.fsAmount || 0).toFixed(2)),
      r.fsCases,
      Number(received.toFixed(2)),
      r.summaryCases,
      Number((r.payableAmount || 0).toFixed(2)),
      net,
      r.monthKey,
      r.note,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const footerLine = [
    'รวม',
    `${rows.length} งวด`,
    totals.totalCases,
    Number(totals.claimedAmount.toFixed(2)),
    Number(totals.normalReceivedAmount.toFixed(2)),
    totals.normalCompensatedCases,
    totals.normalUncompensatedCases,
    Number(totals.appealReceivedAmount.toFixed(2)),
    totals.appealReceivedCases,
    totals.appealUncompensatedCases,
    Number(totals.herbalAmount.toFixed(2)),
    totals.herbalCases,
    Number(totals.aeAmount.toFixed(2)),
    totals.aeCases,
    Number(totals.ppAmount.toFixed(2)),
    totals.ppCases,
    Number(totals.fsAmount.toFixed(2)),
    totals.fsCases,
    Number(totals.summaryAmount.toFixed(2)),
    totals.summaryCases,
    Number(totals.payableAmount.toFixed(2)),
    Number(totals.netBalance.toFixed(2)),
    '',
    `หน่วยงาน ${unitCode || '-'} ${unitName || ''}`.trim(),
  ]
    .map(escapeCsv)
    .join(',');

  const lines = [headers.map(escapeCsv).join(','), ...dataLines, footerLine];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return targetFilename;
}
