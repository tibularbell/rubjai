import React, { useState } from 'react';
import { Check, Copy, KeyRound, Play, RefreshCw, ShieldOff, Trash2 } from 'lucide-react';
import { ApiKeyRecord } from '../types/report';

interface ApiConsoleViewProps {
  apiKeys: ApiKeyRecord[];
  apiSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncErrorMsg: string | null;
  onSyncNow: () => Promise<void>;
  onCreateKey: (label: string) => Promise<string>;
  onRevokeKey: (keyId: string) => Promise<void>;
  onDeleteKey: (keyId: string) => Promise<void>;
}

const ENDPOINTS = [
  {
    id: 'monthly',
    method: 'GET',
    path: '/api/v1/reports/monthly',
    desc: 'สรุปผลรายเดือนแบบเรียลไทม์ (พึงรับ, ได้รับจริง, พึงจ่าย, คงเหลือสุทธิ, เคสไม่ชดเชย)',
  },
  {
    id: 'reports',
    method: 'GET',
    path: '/api/v1/reports',
    desc: 'ดึงข้อมูลตาราง V.3 5367 ทั้งหมดพร้อมยอดรวมสุทธิ (รองรับ ?month=YYYY-MM)',
  },
  {
    id: 'funds',
    method: 'GET',
    path: '/api/v1/funds/summary',
    desc: 'สรุปรายรับแยก 4 กองทุน (ยาสมุนไพร 9 รายการ, AE, PP, FS OP Anywhere)',
  },
  {
    id: 'health',
    method: 'GET',
    path: '/api/v1/health',
    desc: 'ตรวจสอบสถานะความพร้อมของ API Gateway',
  },
] as const;

export const ApiConsoleView: React.FC<ApiConsoleViewProps> = ({
  apiKeys,
  apiSyncStatus,
  syncErrorMsg,
  onSyncNow,
  onCreateKey,
  onRevokeKey,
  onDeleteKey,
}) => {
  const [label, setLabel] = useState('ระบบเชื่อมโยง สสอ. / BI Dashboard');
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [testApiKey, setTestApiKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(ENDPOINTS[0].path);
  const [monthParam, setMonthParam] = useState('');
  const [testing, setTesting] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<string>('');

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const raw = await onCreateKey(label);
      setNewRawKey(raw);
      setTestApiKey(raw);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRunTest = async () => {
    setTesting(true);
    setResponseStatus(null);
    try {
      const url =
        monthParam.trim() && selectedEndpoint !== '/api/v1/health'
          ? `${selectedEndpoint}?month=${encodeURIComponent(monthParam.trim())}`
          : selectedEndpoint;

      const res = await fetch(url, {
        headers: testApiKey.trim()
          ? { 'x-api-key': testApiKey.trim() }
          : undefined,
      });
      setResponseStatus(res.status);
      const data = await res.json();
      setResponseJson(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponseJson(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Request failed' },
          null,
          2
        )
      );
    } finally {
      setTesting(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const curlSnippet = `curl -s "${baseUrl}${selectedEndpoint}${
    monthParam.trim() && selectedEndpoint !== '/api/v1/health'
      ? `?month=${monthParam.trim()}`
      : ''
  }" \\\n  -H "x-api-key: ${testApiKey.trim() || 'YOUR_API_KEY'}"`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* API Key Management */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">จัดการ API Key (REST API)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รหัส Key ถูกเข้ารหัส SHA-256 ก่อนบันทึกในฐานข้อมูล Firestore
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSyncNow()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${apiSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              ซิงค์ API
            </button>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span>สถานะซิงค์กับ API Gateway</span>
            <span
              className={`font-medium ${
                apiSyncStatus === 'synced'
                  ? 'text-emerald-700'
                  : apiSyncStatus === 'error'
                  ? 'text-red-600'
                  : 'text-slate-600'
              }`}
            >
              {apiSyncStatus === 'synced'
                ? 'พร้อมให้บริการ JSON'
                : apiSyncStatus === 'syncing'
                ? 'กำลังอัปเดต...'
                : apiSyncStatus === 'error'
                ? `ขัดข้อง (${syncErrorMsg})`
                : 'รอการซิงค์'}
            </span>
          </div>

          <form onSubmit={handleGenerateKey} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ชื่อเรียกการใช้งาน API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  required
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  สร้าง Key
                </button>
              </div>
            </div>
          </form>

          {newRawKey && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-amber-900">
                กรุณาคัดลอก API Key นี้เก็บไว้ (แสดงให้เห็นเพียงครั้งเดียว)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border border-amber-200 rounded px-2.5 py-1.5 break-all text-slate-900">
                  {newRawKey}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(newRawKey)}
                  className="p-2 bg-white border border-amber-300 rounded-lg text-slate-700 hover:bg-amber-100 shrink-0"
                  title="คัดลอก API Key"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Keys List */}
          <div className="divide-y divide-slate-100 border-t border-slate-200">
            {apiKeys.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                ยังไม่มี API Key — สร้าง Key แรกเพื่อเริ่มทดสอบดึงข้อมูล JSON
              </p>
            ) : (
              apiKeys.map((k) => (
                <div key={k.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{k.label}</div>
                    <div className="text-xs text-slate-500 font-mono-nums flex items-center gap-2 mt-0.5">
                      <span>{k.keyPrefix}...</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          k.status === 'active'
                            ? 'text-emerald-700 font-sans font-medium'
                            : 'text-red-600 font-sans font-medium'
                        }
                      >
                        {k.status === 'active' ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {k.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onRevokeKey(k.id)}
                        className="p-1.5 text-amber-700 hover:bg-amber-50 rounded"
                        title="เพิกถอน Key"
                      >
                        <ShieldOff className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteKey(k.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="ลบ Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Interactive REST API Explorer */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              ทดสอบเชื่อมต่อ REST API (JSON Endpoints)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ส่งคำขอจริงไปยัง Express API Gateway พร้อม Header <span className="font-mono">x-api-key</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => setSelectedEndpoint(ep.path)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedEndpoint === ep.path
                    ? 'border-teal-600 bg-teal-50/60'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-mono font-semibold text-teal-800">
                  {ep.method} {ep.path}
                </div>
                <div className="text-[11px] text-slate-600 mt-1 leading-snug">{ep.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Header: x-api-key
              </label>
              <input
                type="text"
                value={testApiKey}
                onChange={(e) => setTestApiKey(e.target.value)}
                placeholder="วาง rphst_live_... ที่นี่"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ตัวกรอง ?month=
              </label>
              <input
                type="text"
                value={monthParam}
                onChange={(e) => setMonthParam(e.target.value)}
                placeholder="2026-01"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="button"
                disabled={testing}
                onClick={handleRunTest}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                เรียกดู
              </button>
            </div>
          </div>

          {/* curl command */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">ตัวอย่างคำสั่ง cURL</div>
            <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">
              {curlSnippet}
            </pre>
          </div>

          {/* JSON Response */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">ผลลัพธ์ JSON Response</span>
              {responseStatus !== null && (
                <span
                  className={`font-mono-nums font-semibold ${
                    responseStatus >= 200 && responseStatus < 300
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}
                >
                  HTTP {responseStatus}
                </span>
              )}
            </div>
            <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-72 overflow-auto text-slate-800">
              {responseJson || '// กดปุ่ม "เรียกดู" เพื่อทดสอบการดึงข้อมูลสรุป JSON'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
