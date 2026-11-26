import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ApiKeyRecord,
  ClaimRecord,
  ClaimRecordInput,
  computeAggregateTotals,
  RepTransaction,
  RepTransactionInput,
  SCHEMA_LIMITS,
  SsoSubmission,
  UnitProfile,
} from '../types/report';

function clampNum(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SCHEMA_LIMITS.MAX_NUM_VALUE, Number(n.toFixed(2))));
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'item';
}

async function sha256HexBrowser(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useRphstData() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [unitProfile, setUnitProfile] = useState<UnitProfile | null>(null);
  const [claimRecords, setClaimRecords] = useState<ClaimRecord[]>([]);
  const [repTransactions, setRepTransactions] = useState<RepTransaction[]>([]);
  const [ssoSubmissions, setSsoSubmissions] = useState<SsoSubmission[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiSyncStatus, setApiSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  const creatingUnitRef = useRef(false);

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setUnitProfile(null);
        setClaimRecords([]);
        setRepTransactions([]);
        setSsoSubmissions([]);
        setApiKeys([]);
        setLoadingData(false);
      }
    });
    return () => unsub();
  }, []);

  // 2. Firestore real-time subscriptions (only when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;

    setLoadingData(true);
    const uid = user.uid;
    const unitDocPath = `units/${uid}`;
    const unitRef = doc(db, 'units', uid);

    const unsubUnit = onSnapshot(
      unitRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUnitProfile({
            id: snap.id,
            unitCode: String(data.unitCode || ''),
            unitName: String(data.unitName || ''),
            districtName: String(data.districtName || ''),
            templateVersion: String(data.templateVersion || 'V.3 5367'),
            ssoEndpointUrl: String(data.ssoEndpointUrl || ''),
            ownerUid: String(data.ownerUid || uid),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
          setLoadingData(false);
        } else if (!creatingUnitRef.current) {
          creatingUnitRef.current = true;
          try {
            await setDoc(unitRef, {
              unitCode: '05447',
              unitName: 'รพ.สต. ไผ่หลิ่ว บ้านรี่ หมู่ที่ 03',
              districtName: 'สสอ. เมือง',
              templateVersion: 'V.3 5367',
              ssoEndpointUrl: '',
              ownerUid: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, unitDocPath);
          } finally {
            creatingUnitRef.current = false;
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, unitDocPath);
      }
    );

    const claimsPath = `units/${uid}/claimRecords`;
    const claimsQuery = query(
      collection(db, claimsPath),
      where('ownerUid', '==', uid)
    );
    const unsubClaims = onSnapshot(
      claimsQuery,
      (snap) => {
        const rows: ClaimRecord[] = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: d.id,
              ownerUid: String(v.ownerUid),
              unitId: String(v.unitId),
              seqNo: Number(v.seqNo) || 0,
              reportPeriod: String(v.reportPeriod || ''),
              monthKey: String(v.monthKey || ''),
              totalCases: Number(v.totalCases) || 0,
              claimedAmount: Number(v.claimedAmount) || 0,
              normalReceivedAmount: Number(v.normalReceivedAmount) || 0,
              normalCompensatedCases: Number(v.normalCompensatedCases) || 0,
              normalUncompensatedCases: Number(v.normalUncompensatedCases) || 0,
              appealReceivedAmount: Number(v.appealReceivedAmount) || 0,
              appealReceivedCases: Number(v.appealReceivedCases) || 0,
              appealUncompensatedCases: Number(v.appealUncompensatedCases) || 0,
              herbalAmount: Number(v.herbalAmount) || 0,
              herbalCases: Number(v.herbalCases) || 0,
              aeAmount: Number(v.aeAmount) || 0,
              aeCases: Number(v.aeCases) || 0,
              ppAmount: Number(v.ppAmount) || 0,
              ppCases: Number(v.ppCases) || 0,
              fsAmount: Number(v.fsAmount) || 0,
              fsCases: Number(v.fsCases) || 0,
              summaryAmount: Number(v.summaryAmount) || 0,
              summaryCases: Number(v.summaryCases) || 0,
              payableAmount: Number(v.payableAmount) || 0,
              note: String(v.note || ''),
              importBatchId: String(v.importBatchId || ''),
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
            };
          })
          .sort((a, b) => a.seqNo - b.seqNo);
        setClaimRecords(rows);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, claimsPath);
      }
    );

    const getCreatedMs = (ts: unknown): number => {
      if (ts && typeof ts === 'object' && 'toMillis' in ts) {
        return (ts as { toMillis: () => number }).toMillis();
      }
      return 0;
    };

    const ssoPath = `units/${uid}/ssoSubmissions`;
    const ssoQuery = query(
      collection(db, ssoPath),
      where('ownerUid', '==', uid)
    );
    const unsubSso = onSnapshot(
      ssoQuery,
      (snap) => {
        const list: SsoSubmission[] = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: d.id,
              ownerUid: String(v.ownerUid),
              unitId: String(v.unitId),
              unitCode: String(v.unitCode || ''),
              unitName: String(v.unitName || ''),
              monthKey: String(v.monthKey || ''),
              recordCount: Number(v.recordCount) || 0,
              totalCases: Number(v.totalCases) || 0,
              totalClaimedAmount: Number(v.totalClaimedAmount) || 0,
              totalReceivedAmount: Number(v.totalReceivedAmount) || 0,
              totalPayableAmount: Number(v.totalPayableAmount) || 0,
              netBalance: Number(v.netBalance) || 0,
              status: (v.status === 'acknowledged' ? 'acknowledged' : 'submitted') as
                | 'submitted'
                | 'acknowledged',
              targetEndpoint: String(v.targetEndpoint || ''),
              submittedByEmail: String(v.submittedByEmail || ''),
              createdAt: v.createdAt,
            };
          })
          .sort((a, b) => getCreatedMs(b.createdAt) - getCreatedMs(a.createdAt));
        setSsoSubmissions(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, ssoPath);
      }
    );

    const keysPath = `units/${uid}/apiKeys`;
    const keysQuery = query(
      collection(db, keysPath),
      where('ownerUid', '==', uid)
    );
    const unsubKeys = onSnapshot(
      keysQuery,
      (snap) => {
        const list: ApiKeyRecord[] = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: d.id,
              ownerUid: String(v.ownerUid),
              unitId: String(v.unitId),
              label: String(v.label || ''),
              keyPrefix: String(v.keyPrefix || ''),
              keyHash: String(v.keyHash || ''),
              status: (v.status === 'revoked' ? 'revoked' : 'active') as 'active' | 'revoked',
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
            };
          })
          .sort((a, b) => getCreatedMs(b.createdAt) - getCreatedMs(a.createdAt));
        setApiKeys(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, keysPath);
      }
    );

    const repTxPath = `units/${uid}/repTransactions`;
    const repTxQuery = query(
      collection(db, repTxPath),
      where('ownerUid', '==', uid)
    );
    const unsubRepTx = onSnapshot(
      repTxQuery,
      (snap) => {
        const list: RepTransaction[] = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: d.id,
              ownerUid: String(v.ownerUid),
              unitId: String(v.unitId),
              reportPeriod: String(v.reportPeriod || ''),
              repCode: String(v.repCode || ''),
              monthKey: String(v.monthKey || ''),
              claimSection: (v.claimSection === 'appeal' ? 'appeal' : 'normal') as
                | 'normal'
                | 'appeal',
              seq: Number(v.seq) || 0,
              tranId: String(v.tranId || ''),
              hn: String(v.hn || ''),
              an: String(v.an || ''),
              pid: String(v.pid || ''),
              fullName: String(v.fullName || ''),
              visitDate: String(v.visitDate || ''),
              dischargeDate: String(v.dischargeDate || ''),
              mainInscl: String(v.mainInscl || ''),
              projCode: String(v.projCode || ''),
              htypeHcode: String(v.htypeHcode || ''),
              provHcode: String(v.provHcode || ''),
              hcode: String(v.hcode || ''),
              claimed: Number(v.claimed) || 0,
              op: Number(v.op) || 0,
              ipPaid: Number(v.ipPaid) || 0,
              hcTotal: Number(v.hcTotal) || 0,
              aeTotal: Number(v.aeTotal) || 0,
              pp: Number(v.pp) || 0,
              fs: Number(v.fs) || 0,
              otherPaid: Number(v.otherPaid) || 0,
              totalComp: Number(v.totalComp) || 0,
              importBatchId: String(v.importBatchId || ''),
              createdAt: v.createdAt,
            };
          })
          .sort((a, b) => {
            const mCmp = a.monthKey.localeCompare(b.monthKey);
            if (mCmp !== 0) return mCmp;
            const rCmp = a.repCode.localeCompare(b.repCode);
            if (rCmp !== 0) return rCmp;
            if (a.claimSection !== b.claimSection) {
              return a.claimSection === 'normal' ? -1 : 1;
            }
            return a.seq - b.seq;
          });
        setRepTransactions(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, repTxPath);
      }
    );

    return () => {
      unsubUnit();
      unsubClaims();
      unsubRepTx();
      unsubSso();
      unsubKeys();
    };
  }, [authReady, user]);

  // 3. Sync snapshot to Express REST API Gateway automatically
  const syncApiGateway = useCallback(async () => {
    if (!user || !unitProfile) return;
    setApiSyncStatus('syncing');
    setSyncErrorMsg(null);
    try {
      const idToken = await user.getIdToken();
      const activeKeyHashes = apiKeys
        .filter((k) => k.status === 'active')
        .map((k) => k.keyHash);

      const res = await fetch('/api/v1/internal/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          unitProfile: {
            id: unitProfile.id,
            unitCode: unitProfile.unitCode,
            unitName: unitProfile.unitName,
            districtName: unitProfile.districtName,
            templateVersion: unitProfile.templateVersion,
            ssoEndpointUrl: unitProfile.ssoEndpointUrl,
            ownerUid: unitProfile.ownerUid,
          },
          records: claimRecords.map((r) => ({
            id: r.id,
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
            summaryAmount: r.summaryAmount,
            summaryCases: r.summaryCases,
            payableAmount: r.payableAmount,
            note: r.note,
          })),
          activeKeyHashes,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setApiSyncStatus('synced');
    } catch (err) {
      setApiSyncStatus('error');
      setSyncErrorMsg(err instanceof Error ? err.message : 'Sync failed');
    }
  }, [user, unitProfile, claimRecords, apiKeys]);

  useEffect(() => {
    if (!user || !unitProfile) return;
    const timer = setTimeout(() => {
      syncApiGateway();
    }, 350);
    return () => clearTimeout(timer);
  }, [user, unitProfile, claimRecords, apiKeys, syncApiGateway]);

  // 4. CRUD Actions
  const saveUnitSettings = useCallback(
    async (updates: {
      unitCode: string;
      unitName: string;
      districtName: string;
      templateVersion: string;
      ssoEndpointUrl: string;
    }) => {
      if (!user) return;
      const uid = user.uid;
      const unitPath = `units/${uid}`;
      const cleanCode = sanitizeId(updates.unitCode).slice(0, SCHEMA_LIMITS.UNIT_CODE_MAX);
      const cleanName = updates.unitName.trim().slice(0, SCHEMA_LIMITS.UNIT_NAME_MAX);
      if (!cleanCode || !cleanName) {
        throw new Error('กรุณาระบุรหัสหน่วยงานและชื่อหน่วยงานให้ถูกต้อง');
      }

      try {
        await updateDoc(doc(db, 'units', uid), {
          unitCode: cleanCode,
          unitName: cleanName,
          districtName: updates.districtName.trim().slice(0, SCHEMA_LIMITS.DISTRICT_NAME_MAX),
          templateVersion:
            updates.templateVersion.trim().slice(0, SCHEMA_LIMITS.TEMPLATE_VERSION_MAX) || 'V.3 5367',
          ssoEndpointUrl: updates.ssoEndpointUrl.trim().slice(0, SCHEMA_LIMITS.SSO_URL_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, unitPath);
      }
    },
    [user]
  );

  const importClaimRecords = useCallback(
    async (
      rows: ClaimRecordInput[],
      mode: 'append' | 'replace',
      transactions?: RepTransactionInput[]
    ) => {
      if (!user) return;
      const uid = user.uid;
      const claimsPath = `units/${uid}/claimRecords`;
      const repTxPath = `units/${uid}/repTransactions`;
      const batchId = `batch_${Date.now()}`;

      try {
        if (mode === 'replace') {
          if (claimRecords.length > 0) {
            for (let i = 0; i < claimRecords.length; i += 400) {
              const batch = writeBatch(db);
              for (const existing of claimRecords.slice(i, i + 400)) {
                batch.delete(doc(db, claimsPath, existing.id));
              }
              await batch.commit();
            }
          }
          if (repTransactions.length > 0) {
            for (let i = 0; i < repTransactions.length; i += 400) {
              const batch = writeBatch(db);
              for (const existingTx of repTransactions.slice(i, i + 400)) {
                batch.delete(doc(db, repTxPath, existingTx.id));
              }
              await batch.commit();
            }
          }
        }

        const startSeq =
          mode === 'replace'
            ? 0
            : claimRecords.reduce((max, r) => Math.max(max, r.seqNo || 0), 0);

        for (let i = 0; i < rows.length; i += 400) {
          const chunk = rows.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((r, idx) => {
            const recId = `rec_${Date.now()}_${i + idx}`;
            const monthKey = SCHEMA_LIMITS.MONTH_KEY_REGEX.test(r.monthKey)
              ? r.monthKey
              : '2026-01';
            const reportPeriod =
              r.reportPeriod.trim().slice(0, SCHEMA_LIMITS.REPORT_PERIOD_MAX) ||
              `งวด ${startSeq + i + idx + 1}`;
            batch.set(doc(db, claimsPath, recId), {
              ownerUid: uid,
              unitId: uid,
              seqNo: mode === 'replace' ? clampNum(r.seqNo || i + idx + 1) : startSeq + i + idx + 1,
              reportPeriod,
              monthKey,
              totalCases: clampNum(r.totalCases),
              claimedAmount: clampNum(r.claimedAmount),
              normalReceivedAmount: clampNum(r.normalReceivedAmount),
              normalCompensatedCases: clampNum(r.normalCompensatedCases),
              normalUncompensatedCases: clampNum(r.normalUncompensatedCases),
              appealReceivedAmount: clampNum(r.appealReceivedAmount),
              appealReceivedCases: clampNum(r.appealReceivedCases),
              appealUncompensatedCases: clampNum(r.appealUncompensatedCases),
              herbalAmount: clampNum(r.herbalAmount),
              herbalCases: clampNum(r.herbalCases),
              aeAmount: clampNum(r.aeAmount),
              aeCases: clampNum(r.aeCases),
              ppAmount: clampNum(r.ppAmount),
              ppCases: clampNum(r.ppCases),
              fsAmount: clampNum(r.fsAmount),
              fsCases: clampNum(r.fsCases),
              summaryAmount: clampNum(r.summaryAmount),
              summaryCases: clampNum(r.summaryCases),
              payableAmount: clampNum(r.payableAmount),
              note: (r.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
              importBatchId: batchId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }

        if (transactions && transactions.length > 0) {
          for (let i = 0; i < transactions.length; i += 400) {
            const chunk = transactions.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach((tx, idx) => {
              const txId = `tx_${Date.now()}_${i + idx}`;
              const monthKey = SCHEMA_LIMITS.MONTH_KEY_REGEX.test(tx.monthKey)
                ? tx.monthKey
                : '2026-01';
              batch.set(doc(db, repTxPath, txId), {
                ownerUid: uid,
                unitId: uid,
                reportPeriod: tx.reportPeriod.trim().slice(0, SCHEMA_LIMITS.REPORT_PERIOD_MAX) || 'REP',
                repCode: tx.repCode.trim().slice(0, 60) || 'REP',
                monthKey,
                claimSection: tx.claimSection === 'appeal' ? 'appeal' : 'normal',
                seq: clampNum(tx.seq || i + idx + 1),
                tranId: String(tx.tranId || '').trim().slice(0, 40),
                hn: String(tx.hn || '').trim().slice(0, 32),
                an: String(tx.an || '').trim().slice(0, 32),
                pid: String(tx.pid || '').trim().slice(0, 32),
                fullName: String(tx.fullName || '').trim().slice(0, 150),
                visitDate: String(tx.visitDate || '').trim().slice(0, 40),
                dischargeDate: String(tx.dischargeDate || '').trim().slice(0, 40),
                mainInscl: String(tx.mainInscl || '').trim().slice(0, 20),
                projCode: String(tx.projCode || '').trim().slice(0, 40),
                htypeHcode: String(tx.htypeHcode || '').trim().slice(0, 20),
                provHcode: String(tx.provHcode || '').trim().slice(0, 20),
                hcode: String(tx.hcode || '').trim().slice(0, 20),
                claimed: clampNum(tx.claimed),
                op: clampNum(tx.op),
                ipPaid: clampNum(tx.ipPaid),
                hcTotal: clampNum(tx.hcTotal),
                aeTotal: clampNum(tx.aeTotal),
                pp: clampNum(tx.pp),
                fs: clampNum(tx.fs),
                otherPaid: clampNum(tx.otherPaid),
                totalComp: clampNum(tx.totalComp),
                importBatchId: batchId,
                createdAt: serverTimestamp(),
              });
            });
            await batch.commit();
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, claimsPath);
      }
    },
    [user, claimRecords, repTransactions]
  );

  const updateClaimPayableAndNote = useCallback(
    async (recordId: string, payableAmount: number, note: string) => {
      if (!user) return;
      const uid = user.uid;
      const docPath = `units/${uid}/claimRecords/${recordId}`;
      try {
        await updateDoc(doc(db, `units/${uid}/claimRecords`, recordId), {
          payableAmount: clampNum(payableAmount),
          note: note.trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const updateClaimRow = useCallback(
    async (recordId: string, updated: ClaimRecordInput) => {
      if (!user) return;
      const uid = user.uid;
      const docPath = `units/${uid}/claimRecords/${recordId}`;
      const monthKey = SCHEMA_LIMITS.MONTH_KEY_REGEX.test(updated.monthKey)
        ? updated.monthKey
        : '2026-01';
      try {
        await updateDoc(doc(db, `units/${uid}/claimRecords`, recordId), {
          seqNo: clampNum(updated.seqNo),
          reportPeriod: updated.reportPeriod.trim().slice(0, SCHEMA_LIMITS.REPORT_PERIOD_MAX) || '-',
          monthKey,
          totalCases: clampNum(updated.totalCases),
          claimedAmount: clampNum(updated.claimedAmount),
          normalReceivedAmount: clampNum(updated.normalReceivedAmount),
          normalCompensatedCases: clampNum(updated.normalCompensatedCases),
          normalUncompensatedCases: clampNum(updated.normalUncompensatedCases),
          appealReceivedAmount: clampNum(updated.appealReceivedAmount),
          appealReceivedCases: clampNum(updated.appealReceivedCases),
          appealUncompensatedCases: clampNum(updated.appealUncompensatedCases),
          herbalAmount: clampNum(updated.herbalAmount),
          herbalCases: clampNum(updated.herbalCases),
          aeAmount: clampNum(updated.aeAmount),
          aeCases: clampNum(updated.aeCases),
          ppAmount: clampNum(updated.ppAmount),
          ppCases: clampNum(updated.ppCases),
          fsAmount: clampNum(updated.fsAmount),
          fsCases: clampNum(updated.fsCases),
          summaryAmount: clampNum(updated.summaryAmount),
          summaryCases: clampNum(updated.summaryCases),
          payableAmount: clampNum(updated.payableAmount),
          note: (updated.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const deleteClaimRecord = useCallback(
    async (recordId: string) => {
      if (!user) return;
      const uid = user.uid;
      const docPath = `units/${uid}/claimRecords/${recordId}`;
      try {
        await deleteDoc(doc(db, `units/${uid}/claimRecords`, recordId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const clearAllClaimRecords = useCallback(async () => {
    if (!user || (claimRecords.length === 0 && repTransactions.length === 0)) return;
    const uid = user.uid;
    const claimsPath = `units/${uid}/claimRecords`;
    const repTxPath = `units/${uid}/repTransactions`;
    try {
      for (let i = 0; i < claimRecords.length; i += 400) {
        const batch = writeBatch(db);
        for (const r of claimRecords.slice(i, i + 400)) {
          batch.delete(doc(db, claimsPath, r.id));
        }
        await batch.commit();
      }
      for (let i = 0; i < repTransactions.length; i += 400) {
        const batch = writeBatch(db);
        for (const tx of repTransactions.slice(i, i + 400)) {
          batch.delete(doc(db, repTxPath, tx.id));
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, claimsPath);
    }
  }, [user, claimRecords, repTransactions]);

  const createSsoSubmission = useCallback(
    async (monthKey: string) => {
      if (!user || !unitProfile) return { forwarded: false, message: '' };
      const uid = user.uid;
      const scopedRecords =
        monthKey === 'ALL'
          ? claimRecords
          : claimRecords.filter((r) => r.monthKey === monthKey);

      const totals = computeAggregateTotals(scopedRecords);
      const subId = `sso_${Date.now()}`;
      const subPath = `units/${uid}/ssoSubmissions/${subId}`;

      try {
        await setDoc(doc(db, `units/${uid}/ssoSubmissions`, subId), {
          ownerUid: uid,
          unitId: uid,
          unitCode: unitProfile.unitCode,
          unitName: unitProfile.unitName,
          monthKey,
          recordCount: clampNum(totals.recordCount),
          totalCases: clampNum(totals.totalCases),
          totalClaimedAmount: clampNum(totals.claimedAmount),
          totalReceivedAmount: clampNum(totals.summaryAmount),
          totalPayableAmount: clampNum(totals.payableAmount),
          netBalance: Number(totals.netBalance.toFixed(2)),
          status: 'submitted',
          targetEndpoint: unitProfile.ssoEndpointUrl || '',
          submittedByEmail: (user.email || '').slice(0, 200),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, subPath);
      }

      // Optionally dispatch via Express endpoint if configured
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/v1/sso/dispatch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            targetEndpoint: unitProfile.ssoEndpointUrl,
            payload: {
              submissionId: subId,
              unitCode: unitProfile.unitCode,
              unitName: unitProfile.unitName,
              districtName: unitProfile.districtName,
              monthKey,
              totals,
              submittedAt: new Date().toISOString(),
            },
          }),
        });
        const data = await res.json();
        return {
          forwarded: Boolean(data.forwarded),
          message: String(data.message || 'บันทึกการส่งข้อมูลให้ สสอ. เรียบร้อย'),
        };
      } catch {
        return {
          forwarded: false,
          message: 'บันทึกข้อมูลการส่งให้ สสอ. ลงฐานข้อมูล NoSQL เรียบร้อยแล้ว',
        };
      }
    },
    [user, unitProfile, claimRecords]
  );

  const acknowledgeSsoSubmission = useCallback(
    async (submissionId: string) => {
      if (!user) return;
      const uid = user.uid;
      const subPath = `units/${uid}/ssoSubmissions/${submissionId}`;
      try {
        await updateDoc(doc(db, `units/${uid}/ssoSubmissions`, submissionId), {
          status: 'acknowledged',
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, subPath);
      }
    },
    [user]
  );

  const createApiKey = useCallback(
    async (label: string): Promise<string> => {
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนสร้าง API Key');
      const uid = user.uid;
      const cleanLabel = label.trim().slice(0, SCHEMA_LIMITS.KEY_LABEL_MAX) || 'API Key';

      const randomBytes = new Uint8Array(24);
      crypto.getRandomValues(randomBytes);
      const tokenHex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const rawKey = `rphst_live_${tokenHex}`;
      const keyPrefix = rawKey.slice(0, 18);
      const keyHash = await sha256HexBrowser(rawKey);
      const keyId = `key_${Date.now()}`;
      const keyPath = `units/${uid}/apiKeys/${keyId}`;

      try {
        await setDoc(doc(db, `units/${uid}/apiKeys`, keyId), {
          ownerUid: uid,
          unitId: uid,
          label: cleanLabel,
          keyPrefix,
          keyHash,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, keyPath);
      }

      return rawKey;
    },
    [user]
  );

  const revokeApiKey = useCallback(
    async (keyId: string) => {
      if (!user) return;
      const uid = user.uid;
      const keyPath = `units/${uid}/apiKeys/${keyId}`;
      try {
        await updateDoc(doc(db, `units/${uid}/apiKeys`, keyId), {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, keyPath);
      }
    },
    [user]
  );

  const deleteApiKey = useCallback(
    async (keyId: string) => {
      if (!user) return;
      const uid = user.uid;
      const keyPath = `units/${uid}/apiKeys/${keyId}`;
      try {
        await deleteDoc(doc(db, `units/${uid}/apiKeys`, keyId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, keyPath);
      }
    },
    [user]
  );

  return {
    user,
    authReady,
    loadingData,
    unitProfile,
    claimRecords,
    repTransactions,
    ssoSubmissions,
    apiKeys,
    apiSyncStatus,
    syncErrorMsg,
    syncApiGateway,
    saveUnitSettings,
    importClaimRecords,
    updateClaimPayableAndNote,
    updateClaimRow,
    deleteClaimRecord,
    clearAllClaimRecords,
    createSsoSubmission,
    acknowledgeSsoSubmission,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
  };
}
