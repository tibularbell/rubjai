import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface StoredRecord {
  id: string;
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

interface StoredUnitSnapshot {
  unitId: string;
  unitCode: string;
  unitName: string;
  districtName: string;
  templateVersion: string;
  ssoEndpointUrl: string;
  activeKeyHashes: string[];
  records: StoredRecord[];
  updatedAtIso: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'api-gateway.json');

const unitStore = new Map<string, StoredUnitSnapshot>();

function loadStoreFromDisk() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, StoredUnitSnapshot>;
      for (const [unitId, snap] of Object.entries(parsed)) {
        unitStore.set(unitId, snap);
      }
    }
  } catch (err) {
    console.warn('Could not load API gateway store:', err);
  }
}

function saveStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, StoredUnitSnapshot> = {};
    for (const [k, v] of unitStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist API gateway store:', err);
  }
}

loadStoreFromDisk();

function getFirebaseProjectId(): string | undefined {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (parsed?.projectId && parsed.projectId !== 'remixed-project-id') {
        return String(parsed.projectId);
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

const firebaseProjectId = getFirebaseProjectId();
const adminApp = firebaseProjectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId })
  : null;

function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function isSafeHttpsUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function computeReceived(r: StoredRecord): number {
  const sum =
    (r.normalReceivedAmount || 0) +
    (r.appealReceivedAmount || 0) +
    (r.herbalAmount || 0) +
    (r.aeAmount || 0) +
    (r.ppAmount || 0) +
    (r.fsAmount || 0);
  return r.summaryAmount > 0 ? r.summaryAmount : sum;
}

function aggregateRecords(records: StoredRecord[]) {
  const totals = {
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
    totalReceivedAmount: 0,
    summaryCases: 0,
    payableAmount: 0,
    netBalance: 0,
    claimGap: 0,
    compensationRatePct: 0,
    totalUncompensatedCases: 0,
  };

  for (const r of records) {
    totals.totalCases += r.totalCases || 0;
    totals.claimedAmount += r.claimedAmount || 0;
    totals.normalReceivedAmount += r.normalReceivedAmount || 0;
    totals.normalCompensatedCases += r.normalCompensatedCases || 0;
    totals.normalUncompensatedCases += r.normalUncompensatedCases || 0;
    totals.appealReceivedAmount += r.appealReceivedAmount || 0;
    totals.appealReceivedCases += r.appealReceivedCases || 0;
    totals.appealUncompensatedCases += r.appealUncompensatedCases || 0;
    totals.herbalAmount += r.herbalAmount || 0;
    totals.herbalCases += r.herbalCases || 0;
    totals.aeAmount += r.aeAmount || 0;
    totals.aeCases += r.aeCases || 0;
    totals.ppAmount += r.ppAmount || 0;
    totals.ppCases += r.ppCases || 0;
    totals.fsAmount += r.fsAmount || 0;
    totals.fsCases += r.fsCases || 0;
    totals.totalReceivedAmount += computeReceived(r);
    totals.summaryCases += r.summaryCases || 0;
    totals.payableAmount += r.payableAmount || 0;
  }

  totals.netBalance = Number((totals.totalReceivedAmount - totals.payableAmount).toFixed(2));
  totals.claimGap = Number(Math.max(0, totals.claimedAmount - totals.totalReceivedAmount).toFixed(2));
  totals.compensationRatePct =
    totals.claimedAmount > 0
      ? Number(Math.min(100, (totals.totalReceivedAmount / totals.claimedAmount) * 100).toFixed(2))
      : 0;
  totals.totalUncompensatedCases =
    totals.normalUncompensatedCases + totals.appealUncompensatedCases;

  return totals;
}

interface AuthedApiRequest extends Request {
  unitSnapshot?: StoredUnitSnapshot;
}

function authenticateApiKey(req: AuthedApiRequest, res: Response, next: NextFunction) {
  const headerKey =
    (req.headers['x-api-key'] as string | undefined) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined);

  if (!headerKey || headerKey.length < 16) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'กรุณาระบุ API Key ที่ถูกต้องใน Header: x-api-key',
    });
    return;
  }

  const incomingHash = sha256Hex(headerKey);
  let matched: StoredUnitSnapshot | undefined;

  for (const snap of unitStore.values()) {
    if (snap.activeKeyHashes.includes(incomingHash)) {
      matched = snap;
      break;
    }
  }

  if (!matched) {
    res.status(403).json({
      error: 'INVALID_OR_REVOKED_API_KEY',
      message: 'API Key ไม่ถูกต้อง ถูกเพิกถอน หรือยังไม่ได้ซิงค์ข้อมูลหน่วยงาน',
    });
    return;
  }

  req.unitSnapshot = matched;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'rphst-receivable-payable-api',
      templateVersion: 'V.3 5367',
      timestamp: new Date().toISOString(),
    });
  });

  // Sync Firestore snapshot from verified Firebase Auth user to REST API gateway cache
  app.post('/api/v1/internal/sync', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'MISSING_ID_TOKEN' });
        return;
      }

      if (!adminApp) {
        res.status(503).json({ error: 'FIREBASE_PROJECT_NOT_CONFIGURED' });
        return;
      }

      const idToken = authHeader.slice(7).trim();
      const decoded = await getAuth(adminApp).verifyIdToken(idToken);
      const { unitProfile, records, activeKeyHashes } = req.body ?? {};

      if (!unitProfile || unitProfile.ownerUid !== decoded.uid || unitProfile.id !== decoded.uid) {
        res.status(403).json({ error: 'UNIT_OWNERSHIP_MISMATCH' });
        return;
      }

      const safeRecords: StoredRecord[] = Array.isArray(records)
        ? records.slice(0, 2000).map((r: StoredRecord) => ({
            id: String(r.id || ''),
            seqNo: Number(r.seqNo) || 0,
            reportPeriod: String(r.reportPeriod || '').slice(0, 120),
            monthKey: String(r.monthKey || '').slice(0, 7),
            totalCases: Math.max(0, Number(r.totalCases) || 0),
            claimedAmount: Math.max(0, Number(r.claimedAmount) || 0),
            normalReceivedAmount: Math.max(0, Number(r.normalReceivedAmount) || 0),
            normalCompensatedCases: Math.max(0, Number(r.normalCompensatedCases) || 0),
            normalUncompensatedCases: Math.max(0, Number(r.normalUncompensatedCases) || 0),
            appealReceivedAmount: Math.max(0, Number(r.appealReceivedAmount) || 0),
            appealReceivedCases: Math.max(0, Number(r.appealReceivedCases) || 0),
            appealUncompensatedCases: Math.max(0, Number(r.appealUncompensatedCases) || 0),
            herbalAmount: Math.max(0, Number(r.herbalAmount) || 0),
            herbalCases: Math.max(0, Number(r.herbalCases) || 0),
            aeAmount: Math.max(0, Number(r.aeAmount) || 0),
            aeCases: Math.max(0, Number(r.aeCases) || 0),
            ppAmount: Math.max(0, Number(r.ppAmount) || 0),
            ppCases: Math.max(0, Number(r.ppCases) || 0),
            fsAmount: Math.max(0, Number(r.fsAmount) || 0),
            fsCases: Math.max(0, Number(r.fsCases) || 0),
            summaryAmount: Math.max(0, Number(r.summaryAmount) || 0),
            summaryCases: Math.max(0, Number(r.summaryCases) || 0),
            payableAmount: Math.max(0, Number(r.payableAmount) || 0),
            note: String(r.note || '').slice(0, 500),
          }))
        : [];

      const safeHashes: string[] = Array.isArray(activeKeyHashes)
        ? activeKeyHashes.filter((h) => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))
        : [];

      const snapshot: StoredUnitSnapshot = {
        unitId: decoded.uid,
        unitCode: String(unitProfile.unitCode || '').slice(0, 20),
        unitName: String(unitProfile.unitName || '').slice(0, 200),
        districtName: String(unitProfile.districtName || '').slice(0, 150),
        templateVersion: String(unitProfile.templateVersion || 'V.3 5367').slice(0, 32),
        ssoEndpointUrl: String(unitProfile.ssoEndpointUrl || '').slice(0, 300),
        activeKeyHashes: safeHashes,
        records: safeRecords,
        updatedAtIso: new Date().toISOString(),
      };

      unitStore.set(decoded.uid, snapshot);
      saveStoreToDisk();

      res.json({
        synced: true,
        recordCount: safeRecords.length,
        activeKeyCount: safeHashes.length,
        updatedAt: snapshot.updatedAtIso,
      });
    } catch (err) {
      console.error('Sync API error:', err);
      res.status(401).json({ error: 'SYNC_AUTH_FAILED' });
    }
  });

  // External REST API: Full unit & claim records JSON
  app.get('/api/v1/reports', authenticateApiKey, (req: AuthedApiRequest, res) => {
    const snap = req.unitSnapshot!;
    const monthFilter = typeof req.query.month === 'string' ? req.query.month.trim() : '';

    const filtered = monthFilter
      ? snap.records.filter((r) => r.monthKey === monthFilter)
      : snap.records;

    res.json({
      unit: {
        unitCode: snap.unitCode,
        unitName: snap.unitName,
        districtName: snap.districtName,
        templateVersion: snap.templateVersion,
      },
      filter: { month: monthFilter || 'ALL' },
      totals: aggregateRecords(filtered),
      records: filtered,
      syncedAt: snap.updatedAtIso,
    });
  });

  // External REST API: Monthly aggregated receivable-payable summary
  app.get('/api/v1/reports/monthly', authenticateApiKey, (req: AuthedApiRequest, res) => {
    const snap = req.unitSnapshot!;
    const monthFilter = typeof req.query.month === 'string' ? req.query.month.trim() : '';

    const byMonth = new Map<string, StoredRecord[]>();
    for (const r of snap.records) {
      if (monthFilter && r.monthKey !== monthFilter) continue;
      const list = byMonth.get(r.monthKey) ?? [];
      list.push(r);
      byMonth.set(r.monthKey, list);
    }

    const months = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, items]) => ({
        monthKey,
        ...aggregateRecords(items),
      }));

    res.json({
      unit: {
        unitCode: snap.unitCode,
        unitName: snap.unitName,
        districtName: snap.districtName,
      },
      monthCount: months.length,
      months,
      syncedAt: snap.updatedAtIso,
    });
  });

  // External REST API: 4-Fund Breakdown (Herbal 9, AE, PP, FS)
  app.get('/api/v1/funds/summary', authenticateApiKey, (req: AuthedApiRequest, res) => {
    const snap = req.unitSnapshot!;
    const monthFilter = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    const filtered = monthFilter
      ? snap.records.filter((r) => r.monthKey === monthFilter)
      : snap.records;

    const totals = aggregateRecords(filtered);
    const totalFundAmount =
      totals.herbalAmount + totals.aeAmount + totals.ppAmount + totals.fsAmount;

    const share = (amount: number) =>
      totalFundAmount > 0 ? Number(((amount / totalFundAmount) * 100).toFixed(2)) : 0;

    res.json({
      unit: {
        unitCode: snap.unitCode,
        unitName: snap.unitName,
      },
      filter: { month: monthFilter || 'ALL' },
      totalFundAmount,
      funds: [
        {
          code: 'HERBAL_9',
          name: 'ยาสมุนไพร 9 รายการ',
          amount: totals.herbalAmount,
          cases: totals.herbalCases,
          sharePct: share(totals.herbalAmount),
        },
        {
          code: 'AE',
          name: 'AE',
          amount: totals.aeAmount,
          cases: totals.aeCases,
          sharePct: share(totals.aeAmount),
        },
        {
          code: 'PP',
          name: 'PP',
          amount: totals.ppAmount,
          cases: totals.ppCases,
          sharePct: share(totals.ppAmount),
        },
        {
          code: 'FS_OP_ANYWHERE',
          name: 'FS (OP Anywhere)',
          amount: totals.fsAmount,
          cases: totals.fsCases,
          sharePct: share(totals.fsAmount),
        },
      ],
      syncedAt: snap.updatedAtIso,
    });
  });

  // Forward or validate SSO submission dispatch
  app.post('/api/v1/sso/dispatch', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ') || !adminApp) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      const idToken = authHeader.slice(7).trim();
      await getAuth(adminApp).verifyIdToken(idToken);

      const { targetEndpoint, payload } = req.body ?? {};
      if (!targetEndpoint || typeof targetEndpoint !== 'string' || !targetEndpoint.trim()) {
        res.json({
          forwarded: false,
          mode: 'FIRESTORE_LEDGER_ONLY',
          message: 'บันทึกการส่งข้อมูลให้ สสอ. ในระบบเรียบร้อย (ยังไม่ได้ตั้งค่า URL ปลายทางภายนอก)',
        });
        return;
      }

      const cleanUrl = targetEndpoint.trim();
      if (!isSafeHttpsUrl(cleanUrl)) {
        res.status(400).json({
          forwarded: false,
          error: 'INVALID_SSO_ENDPOINT',
          message: 'URL ปลายทางของ สสอ. ต้องเป็น HTTPS สาธารณะที่ปลอดภัยเท่านั้น',
        });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const upstream = await fetch(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? {}),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        res.json({
          forwarded: upstream.ok,
          status: upstream.status,
          mode: 'HTTPS_WEBHOOK',
          message: upstream.ok
            ? `ส่งข้อมูลไปยังปลายทาง สสอ. สำเร็จ (HTTP ${upstream.status})`
            : `ปลายทาง สสอ. ตอบกลับรหัส HTTP ${upstream.status}`,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        res.json({
          forwarded: false,
          mode: 'HTTPS_WEBHOOK_FALLBACK',
          message: `ไม่สามารถเชื่อมต่อปลายทาง สสอ. ได้ (${fetchErr instanceof Error ? fetchErr.message : 'Network error'}) แต่บันทึกประวัติการส่งในฐานข้อมูลแล้ว`,
        });
      }
    } catch {
      res.status(401).json({ error: 'UNAUTHORIZED' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`RPHST Report Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
