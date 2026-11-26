import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { ClaimRecordInput, RepTransactionInput } from '../types/report';
import {
  downloadSampleTemplateExcel,
  getSampleRepTransactions,
  getSampleV3Rows,
  ParsedExcelResult,
  parseExcelOrCsvFile,
} from '../utils/excelV3';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  existingCount: number;
  onConfirmImport: (
    rows: ClaimRecordInput[],
    mode: 'append' | 'replace',
    transactions?: RepTransactionInput[]
  ) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  open,
  onClose,
  existingCount,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedExcelResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mode, setMode] = useState<'append' | 'replace'>('replace');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);
    try {
      const result = await parseExcelOrCsvFile(file);
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ Excel ได้');
    }
  };

  const handleLoadBuiltInSample = () => {
    setErrorMsg(null);
    setFileName('ตัวอย่างไฟล์นำเข้า_REP_รพสต.xlsx');
    const sampleTxs = getSampleRepTransactions();
    setParsed({
      records: getSampleV3Rows(),
      transactions: sampleTxs,
      warnings: [],
      detectedFormat: 'NHSO_REP_STATEMENT',
      rawTransactionCount: sampleTxs.length,
      detectedHcode: '01747',
    });
  };

  const handleSubmit = async () => {
    if (!parsed || parsed.records.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      await onConfirmImport(parsed.records, mode, parsed.transactions);
      setParsed(null);
      setFileName('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 my-8">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              นำเข้าไฟล์ Excel / CSV (ไฟล์ Statement REP สปสช. และ V.3 5367)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              รองรับไฟล์รายเคส REP (TRAN_ID, HN, เรียกเก็บ, กองทุน IP/HC/AE/PP/FS, ยอดชดเชยทั้งสิ้น) และตารางสรุป V.3 5367
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/70 mb-4"
        >
          <FileSpreadsheet className="w-8 h-8 text-teal-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-800 mb-1">
            ลากไฟล์ .xlsx, .xls หรือ .csv มาวางที่นี่ หรือเลือกไฟล์จากเครื่อง
          </p>
          <p className="text-xs text-slate-500 mb-4">
            ระบบจะข้ามแถว &quot;รวม&quot; ท้ายตารางให้อัตโนมัติ และแปลงงวดเป็นรายเดือนเพื่อสรุปผลบนแดชบอร์ด
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              เลือกไฟล์ Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => downloadSampleTemplateExcel()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
            </button>
              <button
                type="button"
                onClick={handleLoadBuiltInSample}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg"
              >
                จำลองข้อมูลตัวอย่าง REP
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 mb-4 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsed && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    อ่านไฟล์ <strong>{fileName}</strong> สำเร็จ ·{' '}
                    {parsed.rawTransactionCount ? (
                      <>
                        พบ <strong className="font-mono-nums">{parsed.rawTransactionCount}</strong>{' '}
                        ธุรกรรมรายเคส (จัดกลุ่มได้{' '}
                        <strong className="font-mono-nums">{parsed.records.length}</strong> งวด REP)
                      </>
                    ) : (
                      <>
                        พบ <strong className="font-mono-nums">{parsed.records.length}</strong> งวด
                      </>
                    )}
                    {parsed.detectedHcode ? (
                      <> · HCODE <strong className="font-mono-nums">{parsed.detectedHcode}</strong></>
                    ) : null}
                  </span>
                </div>
              </div>

            {parsed.warnings.length > 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {parsed.warnings.join(' · ')}
              </div>
            )}

            {/* Preview Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0">
                  <tr>
                    <th className="px-2.5 py-2 text-center border-b border-slate-200">ลำดับ</th>
                    <th className="px-2.5 py-2 text-left border-b border-slate-200">รายงานงวด</th>
                    <th className="px-2.5 py-2 text-center border-b border-slate-200">เดือนสรุป</th>
                    <th className="px-2.5 py-2 text-right border-b border-slate-200">เคสทั้งหมด</th>
                    <th className="px-2.5 py-2 text-right border-b border-slate-200">เรียกเก็บ</th>
                    <th className="px-2.5 py-2 text-right border-b border-slate-200">ได้รับจริงรวม</th>
                    <th className="px-2.5 py-2 text-right border-b border-slate-200">ยอดพึงจ่าย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.records.slice(0, 20).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2.5 py-1.5 text-center font-mono-nums">{row.seqNo}</td>
                      <td className="px-2.5 py-1.5 font-medium text-slate-900">{row.reportPeriod}</td>
                      <td className="px-2.5 py-1.5 text-center font-mono-nums text-slate-600">
                        {row.monthKey}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono-nums">{row.totalCases}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono-nums">
                        {row.claimedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono-nums text-emerald-700">
                        {row.summaryAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono-nums text-amber-700">
                        {row.payableAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import Mode */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="font-semibold">รูปแบบการบันทึก (ปัจจุบันมี {existingCount} งวด):</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="text-teal-700"
                />
                แทนที่ข้อมูลตารางเดิมทั้งหมด
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                  className="text-teal-700"
                />
                เพิ่มต่อท้ายจากข้อมูลเดิม
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            ปิด
          </button>
          <button
            type="button"
            disabled={!parsed || parsed.records.length === 0 || importing}
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-40"
          >
            {importing
              ? 'กำลังนำเข้าข้อมูลลง Firestore...'
              : `ยืนยันนำเข้า ${parsed?.records.length ?? 0} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
};
