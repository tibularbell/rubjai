import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save, Send } from 'lucide-react';
import {
  ClaimRecord,
  computeAggregateTotals,
  computeMonthlySummaries,
  formatMonthKeyThai,
  SCHEMA_LIMITS,
  SsoSubmission,
  UnitProfile,
} from '../types/report';

interface SsoSubmissionViewProps {
  unitProfile: UnitProfile | null;
  records: ClaimRecord[];
  submissions: SsoSubmission[];
  onSaveSettings: (updates: {
    unitCode: string;
    unitName: string;
    districtName: string;
    templateVersion: string;
    ssoEndpointUrl: string;
  }) => Promise<void>;
  onSubmitToSso: (monthKey: string) => Promise<{ forwarded: boolean; message: string }>;
  onAcknowledge: (submissionId: string) => Promise<void>;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateTime(val: unknown): string {
  if (!val) return '-';
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    const d = (val as { toDate: () => Date }).toDate();
    return d.toLocaleString('th-TH');
  }
  return String(val);
}

export const SsoSubmissionView: React.FC<SsoSubmissionViewProps> = ({
  unitProfile,
  records,
  submissions,
  onSaveSettings,
  onSubmitToSso,
  onAcknowledge,
}) => {
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [templateVersion, setTemplateVersion] = useState('V.3 5367');
  const [ssoEndpointUrl, setSsoEndpointUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [settingsErrMsg, setSettingsErrMsg] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [submitResultMsg, setSubmitResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (unitProfile) {
      setUnitCode(unitProfile.unitCode);
      setUnitName(unitProfile.unitName);
      setDistrictName(unitProfile.districtName);
      setTemplateVersion(unitProfile.templateVersion || 'V.3 5367');
      setSsoEndpointUrl(unitProfile.ssoEndpointUrl || '');
    }
  }, [unitProfile]);

  const months = useMemo(() => computeMonthlySummaries(records), [records]);

  const scopedRecords = useMemo(() => {
    if (selectedMonth === 'ALL') return records;
    return records.filter((r) => r.monthKey === selectedMonth);
  }, [records, selectedMonth]);

  const totals = useMemo(() => computeAggregateTotals(scopedRecords), [scopedRecords]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSavedMsg(null);
    setSettingsErrMsg(null);
    setSavingSettings(true);
    try {
      await onSaveSettings({
        unitCode,
        unitName,
        districtName,
        templateVersion,
        ssoEndpointUrl,
      });
      setSettingsSavedMsg('บันทึกการตั้งค่าหน่วยงานลงฐานข้อมูล NoSQL เรียบร้อยแล้ว');
    } catch (err) {
      setSettingsErrMsg(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDispatch = async () => {
    if (scopedRecords.length === 0) return;
    setSubmitting(true);
    setSubmitResultMsg(null);
    try {
      const res = await onSubmitToSso(selectedMonth);
      setSubmitResultMsg(res.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Unit Settings ("ตั้งค่าหน่วยงาน") */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">ตั้งค่าหน่วยงาน รพ.สต.</h2>
          <p className="text-xs text-slate-500 mb-5">
            ข้อมูลรหัสและชื่อหน่วยบริการที่แสดงท้ายรายงาน V.3 5367 และแนบไปในการส่งให้ สสอ.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  รหัสหน่วยงาน (HCODE)
                </label>
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  maxLength={SCHEMA_LIMITS.UNIT_CODE_MAX}
                  placeholder="05447"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-nums"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เวอร์ชันแม่แบบ
                </label>
                <input
                  type="text"
                  value={templateVersion}
                  onChange={(e) => setTemplateVersion(e.target.value)}
                  maxLength={SCHEMA_LIMITS.TEMPLATE_VERSION_MAX}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-nums"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ชื่อหน่วยงาน รพ.สต.
              </label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                maxLength={SCHEMA_LIMITS.UNIT_NAME_MAX}
                placeholder="รพ.สต. ไผ่หลิ่ว บ้านรี่ หมู่ที่ 03"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                สังกัดสำนักงานสาธารณสุขอำเภอ (สสอ.)
              </label>
              <input
                type="text"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                maxLength={SCHEMA_LIMITS.DISTRICT_NAME_MAX}
                placeholder="เช่น สสอ. เมือง"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                URL ปลายทาง Webhook / API ของ สสอ. (ไม่บังคับ)
              </label>
              <input
                type="url"
                value={ssoEndpointUrl}
                onChange={(e) => setSsoEndpointUrl(e.target.value)}
                maxLength={SCHEMA_LIMITS.SSO_URL_MAX}
                placeholder="https://sso-district.example.go.th/api/reports"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                หากระบุ ระบบจะส่ง JSON Payload ไปยัง URL นี้แบบอัตโนมัติเมื่อกดส่งข้อมูลให้ สสอ.
              </p>
            </div>

            {settingsSavedMsg && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settingsSavedMsg}</span>
              </div>
            )}
            {settingsErrMsg && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {settingsErrMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าหน่วยงาน'}
            </button>
          </form>
        </div>

        {/* Right: Send Report to SSO ("ส่งข้อมูลให้สสอ.") */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">ส่งข้อมูลรายงานให้ สสอ.</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกงวดเดือนที่ต้องการสรุปยอดพึงรับ-พึงจ่ายและบันทึกประวัติการนำส่ง
              </p>
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">ทุกงวดทั้งหมด ({records.length} งวด)</option>
              {months.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  เดือน {m.monthLabelTh} ({m.recordCount} งวด)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-[11px] text-slate-500">จำนวนงวด / เคส</div>
              <div className="text-sm font-semibold text-slate-900 font-mono-nums mt-1">
                {totals.recordCount} งวด · {totals.totalCases.toLocaleString('th-TH')} เคส
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">ยอดเรียกเก็บ (พึงรับ)</div>
              <div className="text-sm font-semibold text-slate-900 font-mono-nums mt-1">
                ฿{fmtMoney(totals.claimedAmount)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">ยอดได้รับจริงรวม</div>
              <div className="text-sm font-semibold text-emerald-700 font-mono-nums mt-1">
                ฿{fmtMoney(totals.summaryAmount)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">ยอดพึงจ่าย / สุทธิ</div>
              <div className="text-sm font-semibold text-teal-700 font-mono-nums mt-1">
                ฿{fmtMoney(totals.netBalance)}
              </div>
            </div>
          </div>

          {submitResultMsg && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{submitResultMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-500">
              ปลายทาง: <span className="font-medium text-slate-800">{districtName || 'สสอ.'}</span>
              {ssoEndpointUrl ? ` · ${ssoEndpointUrl}` : ' · บันทึกลงฐานข้อมูล NoSQL'}
            </div>

            <button
              type="button"
              disabled={scopedRecords.length === 0 || submitting}
              onClick={handleDispatch}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันส่งข้อมูลให้ สสอ.'}
            </button>
          </div>
        </div>
      </div>

      {/* Submission History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">ประวัติการส่งรายงานให้ สสอ.</h3>
          <span className="text-xs text-slate-500 font-mono-nums">{submissions.length} รายการ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">วัน-เวลาที่ส่ง</th>
                <th className="px-4 py-3 text-left font-semibold">งวดเดือน</th>
                <th className="px-4 py-3 text-right font-semibold">งวด / เคส</th>
                <th className="px-4 py-3 text-right font-semibold">ยอดเรียกเก็บ</th>
                <th className="px-4 py-3 text-right font-semibold">ได้รับจริง</th>
                <th className="px-4 py-3 text-right font-semibold">พึงจ่าย</th>
                <th className="px-4 py-3 text-right font-semibold">สุทธิ</th>
                <th className="px-4 py-3 text-left font-semibold">สถานะ</th>
                <th className="px-4 py-3 text-center font-semibold">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    ยังไม่มีประวัติการส่งข้อมูลให้ สสอ.
                  </td>
                </tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 font-mono-nums whitespace-nowrap">
                      {fmtDateTime(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.monthKey === 'ALL' ? 'ทุกงวดทั้งหมด' : formatMonthKeyThai(s.monthKey)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-nums">
                      {s.recordCount} / {s.totalCases.toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-nums">
                      ฿{fmtMoney(s.totalClaimedAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-nums text-emerald-700 font-medium">
                      ฿{fmtMoney(s.totalReceivedAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-nums text-amber-700">
                      ฿{fmtMoney(s.totalPayableAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-nums font-semibold text-teal-700">
                      ฿{fmtMoney(s.netBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          s.status === 'acknowledged' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {s.status === 'acknowledged' ? 'สสอ. รับทราบแล้ว' : 'ส่งข้อมูลแล้ว'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === 'submitted' ? (
                        <button
                          type="button"
                          onClick={() => onAcknowledge(s.id)}
                          className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                        >
                          บันทึกว่ารับทราบแล้ว
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
