import React, { useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';

interface ManualModalProps {
  open: boolean;
  onClose: () => void;
}

const HANDOVER_DOWNLOAD_TEXT = `# คู่มือการติดตั้ง ส่งมอบ และใช้งานระบบรายงานพึงรับ-พึงจ่าย รพ.สต. (V.3 5367)

## 1. แนวทางแนะนำให้สถานพยาบาลอื่นนำไปใช้งาน
### วิธีที่ 1: ใช้งานทันทีผ่านลิงก์กลาง (Shared App URL — แนะนำ)
1. ส่งลิงก์เว็บแอปพลิเคชันให้เจ้าหน้าที่ รพ.สต. ปลายทาง
2. แนะนำให้ใช้บัญชี Google กลางของสถานพยาบาล (เช่น rphst.xxx@gmail.com) เพื่อความต่อเนื่องของข้อมูล
3. ระบบแยกข้อมูล NoSQL (units/{uid}) อัตโนมัติตาม UID ข้อมูลไม่ปะปนกันระหว่าง รพ.สต.
4. เข้าเมนู "ส่งข้อมูลให้ สสอ. & ตั้งค่า" เพื่อกรอกรหัสหน่วยงาน (HCODE 5 หลัก) และชื่อ รพ.สต.
5. นำเข้าไฟล์ REP รายเคส (ข้อมูลปกติ/ข้อมูลอุทธรณ์) หรือไฟล์สรุป V.3 5367 เพื่อใช้งานทันที

### วิธีที่ 2: ติดตั้งแยกอิสระบนเซิร์ฟเวอร์และ Firebase Project ของตนเอง (Self-Hosted)
1. เตรียม Node.js เวอร์ชัน 22+ และสร้าง Firebase Project ใหม่ (เปิด Google Auth + Cloud Firestore)
2. เพิ่มโดเมนใช้งานจริงใน Firebase Console > Authentication > Settings > Authorized domains
3. นำค่าคอนฟิกใส่ไฟล์ firebase-applet-config.json (หากเป็นฐานข้อมูลหลักให้ใช้ "firestoreDatabaseId": "(default)")
4. Deploy กฎความปลอดภัยจากไฟล์ firestore.rules ด้วยคำสั่ง: firebase deploy --only firestore:rules
5. ติดตั้งและรันระบบ:
   npm install
   npm run build
   NODE_ENV=production PORT=3000 npm start
6. ตรวจสอบ API Health Check ที่ /api/v1/health (ควรตอบกลับ status: "ok")

## 2. การใช้งานประจำเดือนสำหรับเจ้าหน้าที่
- นำเข้าไฟล์ REP รายเคส หรือ V.3 5367 (ระบบแยกส่วนข้อมูลปกติ/ข้อมูลอุทธรณ์ และข้ามแถว "รวม" อัตโนมัติ)
- ตรวจสอบรายงานสรุปรายเดือนและรายละเอียดตามรายงานงวด พร้อมส่งออก Excel, CSV หรือ "PDF ฉบับย่อ" เพื่อพิมพ์ลงนามได้ทันที
- แก้ไข "ยอดพึงจ่าย" และ "หมายเหตุ" รายงวดในตาราง V.3 5367 เพื่อคำนวณคงเหลือสุทธิ
- ส่งข้อมูลสรุปให้ สสอ. และสร้าง API Key (x-api-key) เพื่อเชื่อมต่อ JSON API ภายนอก
`;

export const ManualModal: React.FC<ManualModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<'user' | 'install'>('user');
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!open) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleDownloadGuide = () => {
    const blob = new Blob(['\uFEFF' + HANDOVER_DOWNLOAD_TEXT], {
      type: 'text/markdown;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'คู่มือติดตั้งและส่งมอบ_ระบบพึงรับพึงจ่าย_รพสต.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = async () => {
    if (!currentOrigin) return;
    await navigator.clipboard.writeText(currentOrigin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              คู่มือการใช้งานและการติดตั้งส่งมอบ (V.3 5367)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แนวทางปฏิบัติงานสำหรับบุคลากร รพ.สต. และขั้นตอนติดตั้งสำหรับส่งมอบสถานบริการอื่น
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

        {/* Interactive Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('user')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'user'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              คู่มือผู้ใช้งาน (รพ.สต.)
            </button>
            <button
              type="button"
              onClick={() => setTab('install')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'install'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              คู่มือติดตั้ง &amp; ส่งมอบสถานบริการอื่น
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadGuide}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            ดาวน์โหลดคู่มือ (.md)
          </button>
        </div>

        {tab === 'user' ? (
          <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
            <section>
              <h4 className="font-semibold text-slate-900 mb-1.5">
                1. การนำเข้าไฟล์ Excel / CSV จากไฟล์ตัวอย่าง V.3 5367
              </h4>
              <p className="text-xs text-slate-600">
                ระบบรองรับไฟล์ <span className="font-mono">.xlsx</span>,{' '}
                <span className="font-mono">.xls</span> และ <span className="font-mono">.csv</span>{' '}
                ที่มีโครงสร้างหัวตาราง 2 ชั้นตามไฟล์ตัวอย่าง V.3 5367 โดยตรง (ลำดับ, รายงานงวด, เคสทั้งหมด,
                เรียกเก็บ, กรณีเบิกปกติ 3 ช่อง, กรณีอุทธรณ์ข้อมูล 3 ช่อง, ยาสมุนไพร 9 รายการ, AE, PP, FS, และรวมเงิน/เคส)
                หากไฟล์ต้นฉบับไม่มีคอลัมน์ &quot;ยอดพึงจ่าย&quot; สามารถกดแก้ไขรายงวดในตารางเพื่อเพิ่มภายหลังได้ทันที
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 mb-1.5">
                2. หลักการคำนวณพึงรับ-พึงจ่ายและวิเคราะห์รายเดือน
              </h4>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                <li>
                  <strong>ยอดพึงรับตั้งต้น</strong>: อ้างอิงจากคอลัมน์ &quot;จำนวนเงินที่เรียกเก็บ&quot;
                </li>
                <li>
                  <strong>ยอดได้รับชดเชยจริง (V.3)</strong>: ผลรวมของเบิกปกติ + อุทธรณ์ข้อมูล + ยาสมุนไพร 9 รายการ + AE + PP + FS (OP Anywhere)
                </li>
                <li>
                  <strong>คงเหลือสุทธิ (พึงรับ - พึงจ่าย)</strong>: ยอดได้รับชดเชยจริง หักด้วย ยอดพึงจ่าย/จัดสรรรายงวด
                </li>
                <li>
                  <strong>การจัดกลุ่มรายเดือนอัตโนมัติ</strong>: ระบบแปลงข้อความในคอลัมน์ &quot;รายงานงวด&quot; (เช่น ม.ค. 69, 01/2569) เป็นปี-เดือนมาตรฐานเพื่อสรุปบนแดชบอร์ด
                </li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 mb-1.5">
                3. รายงานสรุปรายเดือน, ส่งออก PDF ฉบับย่อ และเชื่อมต่อ สสอ./API
              </h4>
              <p className="text-xs text-slate-600">
                แท็บ &quot;รายงานสรุปรายเดือน&quot; แสดงทั้งรายละเอียดรายเคสแยก <strong>ข้อมูลปกติ / ข้อมูลอุทธรณ์</strong>{' '}
                ตามรายงานงวดและตารางสรุปรายเดือน พร้อมส่งออก Excel, CSV และ <strong>PDF ฉบับย่อ</strong> เพื่อพิมพ์ลงนามได้ทันที
                นอกจากนี้สามารถส่งรายงานสรุปให้ สสอ. หรือสร้าง <span className="font-mono">x-api-key</span> ในหน้า
                &quot;REST API&quot; เพื่อดึงข้อมูล JSON ได้ตลอดเวลา
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 mb-1.5">
                4. การแก้ไขปัญหาเบื้องต้น
              </h4>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                <li>
                  <strong>นำเข้าไฟล์แล้วไม่พบข้อมูล</strong>: ตรวจสอบว่าแถวหัวตารางมีคำว่า &quot;รายงานงวด&quot; และแถวข้อมูลไม่ว่างเปล่า หรือลองกดดาวน์โหลดไฟล์ตัวอย่าง (.xlsx) เพื่อเทียบลำดับคอลัมน์
                </li>
                <li>
                  <strong>ตัวเลขเดือนไม่ตรงกับงวด</strong>: กดไอคอนรูปดินสอในตารางเพื่อกำหนดเดือนอ้างอิง (YYYY-MM) ของงวดนั้นให้ถูกต้อง
                </li>
                <li>
                  <strong>API ตอบกลับ 403 Invalid Key</strong>: ตรวจสอบว่า Key ยังมีสถานะ Active และข้อมูลหน่วยงานเพิ่งซิงค์เสร็จสมบูรณ์
                </li>
              </ul>
            </section>
          </div>
        ) : (
          <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
            <section className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-slate-900">
                วิธีที่ 1: ส่งมอบให้ รพ.สต. อื่นเข้าใช้งานทันทีผ่านลิงก์กลาง (แนะนำ)
              </h4>
              <p className="text-xs text-slate-600">
                ระบบรองรับการแยกข้อมูลระดับหน่วยงานอัตโนมัติ (Multi-Tenant Isolation) ตามบัญชี Google ที่ล็อกอิน
                สถานบริการปลายทางสามารถเปิดลิงก์ด้านล่าง ตั้งค่ารหัส/ชื่อ รพ.สต. และนำเข้าไฟล์ของตนเองได้โดยข้อมูลไม่ปะปนกัน:
              </p>
              <div className="flex items-center gap-2 pt-1">
                <code className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 truncate text-slate-800">
                  {currentOrigin}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="font-semibold text-slate-900">
                วิธีที่ 2: ติดตั้งแยกอิสระบน Firebase Project และเซิร์ฟเวอร์ของสถานบริการเอง
              </h4>
              <ol className="list-decimal pl-5 text-xs text-slate-600 space-y-2">
                <li>
                  <strong>เตรียมสภาพแวดล้อม</strong>: ติดตั้ง <strong>Node.js v22+</strong> และสร้างโปรเจกต์ใหม่บน{' '}
                  <span className="font-mono">console.firebase.google.com</span>
                </li>
                <li>
                  <strong>เปิดบริการ Firebase</strong>: เปิดใช้ <strong>Authentication (Google)</strong> พร้อมเพิ่มโดเมนใช้งานจริงใน{' '}
                  <span className="font-mono">Authorized domains</span> และเปิดใช้ <strong>Firestore Database</strong>
                </li>
                <li>
                  <strong>ตั้งค่าคอนฟิก</strong>: นำค่า Web App Config ใส่ในไฟล์{' '}
                  <span className="font-mono">firebase-applet-config.json</span> (หากใช้ฐานข้อมูลหลักให้ใส่{' '}
                  <span className="font-mono">&quot;firestoreDatabaseId&quot;: &quot;(default)&quot;</span>)
                </li>
                <li>
                  <strong>ติดตั้งกฎความปลอดภัย</strong>: นำไฟล์ <span className="font-mono">firestore.rules</span> ไป Deploy ด้วย{' '}
                  <span className="font-mono">firebase deploy --only firestore:rules</span> (ไม่ต้องสร้าง Composite Index เพิ่มเติม)
                </li>
                <li>
                  <strong>Build และรันระบบ</strong>:
                  <pre className="mt-1.5 text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto">
                    {`npm install\nnpm run build\nNODE_ENV=production PORT=3000 npm start`}
                  </pre>
                </li>
                <li>
                  <strong>ตรวจเช็กหลังติดตั้ง</strong>: ทดสอบเรียก <span className="font-mono">GET /api/v1/health</span>{' '}
                  และล็อกอินเพื่อตั้งค่า HCODE พร้อมทดสอบนำเข้าไฟล์แม่แบบตัวอย่าง V.3 5367
                </li>
              </ol>
            </section>

            <section className="text-xs text-slate-500 border-t border-slate-200 pt-3">
              เอกสารคู่มือฉบับเต็มในโปรเจกต์อยู่ที่ไฟล์ <span className="font-mono text-slate-700">HANDOVER_AND_INSTALL_GUIDE.md</span>
            </section>
          </div>
        )}

        <div className="flex justify-end pt-5 mt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
