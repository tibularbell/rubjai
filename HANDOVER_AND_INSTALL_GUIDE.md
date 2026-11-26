# คู่มือการติดตั้ง ส่งมอบ และใช้งานระบบรายงานพึงรับ-พึงจ่าย รพ.สต. (V.3 5367)

เอกสารฉบับนี้จัดทำขึ้นเพื่อใช้เป็นคู่มือแนะนำและส่งมอบให้สถานบริการสาธารณสุข (รพ.สต.) หรือสำนักงานสาธารณสุขอำเภอ (สสอ.) นำไปใช้งานและติดตั้งระบบอย่างถูกต้อง

---

## 1. ภาพรวมระบบและโครงสร้างเทคโนโลยี
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Recharts + SheetJS (`xlsx`) + `jsPDF` (รองรับ Excel, CSV และ PDF ฉบับย่อภาษาไทย)
- **Backend / API Gateway**: Node.js (v22+) + Express (`server.ts`) รันบนพอร์ต `3000`
- **NoSQL Database & Auth**: Firebase Firestore (ฐานข้อมูล NoSQL แบบเรียลไทม์) และ Firebase Authentication (Google Sign-In)
- **การแยกข้อมูลรายหน่วยงาน (Multi-Tenant Isolation)**: ข้อมูลทุกส่วนเก็บแยกตาม `units/{uid}` (`unitProfile`, `claimRecords`, `repTransactions`, `ssoSubmissions`, `apiKeys`) พร้อมบังคับสิทธิ์ใน `firestore.rules`

---

## 2. แนวทางการแนะนำและส่งมอบให้สถานพยาบาลอื่นใช้งาน (เลือก 1 ใน 2 วิธี)

### วิธีที่ 1: ใช้งานร่วมกันทันทีผ่านลิงก์กลาง (Shared App URL — แนะนำสำหรับ สสอ. / เครือข่าย รพ.สต.)
เหมาะสำหรับส่งต่อให้ รพ.สต. อื่นใช้งานได้ทันทีโดยไม่ต้องตั้งค่าเซิร์ฟเวอร์เอง:
1. ส่ง **Shared App URL** ให้เจ้าหน้าที่การเงิน/เวชสถิติของ รพ.สต. ปลายทาง:
   `https://ais-pre-m5dekncfkno4uhjzeqawxf-892838480730.asia-east1.run.app`
2. แนะนำให้ รพ.สต. ปลายทางใช้ **บัญชี Google กลางของสถานพยาบาล** (เช่น `rphst.xxx@gmail.com`) กดเข้าสู่ระบบ เพื่อความต่อเนื่องเมื่อมีการเปลี่ยนผู้รับผิดชอบงาน
3. ระบบจะสร้างพื้นที่ฐานข้อมูล `units/{uid}` แยกเฉพาะสถานพยาบาลนั้นอัตโนมัติ รพ.สต. อื่นไม่สามารถเข้าถึงหรือมองเห็นข้อมูลกันได้
4. เมื่อเข้าสู่ระบบครั้งแรก ให้ไปที่เมนู **"ส่งข้อมูลให้ สสอ. & ตั้งค่า"** เพื่อกรอก **รหัสหน่วยงาน (HCODE 5 หลัก)**, **ชื่อ รพ.สต.** และ **สสอ. ต้นสังกัด**
5. ไปที่ปุ่ม **"นำเข้า Excel"** เพื่ออัปโหลดไฟล์ Statement REP ของ สปสช. (รองรับส่วน `ข้อมูลปกติ` และ `ข้อมูลอุทธรณ์`) หรือไฟล์สรุป `V.3 5367`

> **ข้อแนะนำด้านความปลอดภัยข้อมูลผู้ป่วย (PDPA)**: หาก รพ.สต. ปลายทางนำเข้าไฟล์ REP ที่มีข้อมูลรายบุคคล (`HN`, `PID`, `ชื่อ-นามสกุล`) ควรใช้งานผ่านบัญชี Google ที่ยืนยันตัวตนของสถานบริการเท่านั้น และไม่ควรใช้บัญชีส่วนตัวร่วมกันหลายคน

---

### วิธีที่ 2: ติดตั้งแยกอิสระบน Firebase Project และเซิร์ฟเวอร์ของสถานบริการเอง (Self-Hosted)
เหมาะสำหรับ สสอ., อบจ. หรือโรงพยาบาลแม่ข่ายที่ต้องการครอบครองฐานข้อมูลและโดเมนเป็นของตนเอง 100%

#### ขั้นตอนที่ 1: เตรียมเครื่องแม่ข่ายและสร้างโปรเจกต์ Firebase
1. ติดตั้ง **Node.js เวอร์ชัน 22 ขึ้นไป** (`node -v`) และ `npm` บนเซิร์ฟเวอร์ (Linux/Windows Server หรือ Cloud Run)
2. เข้า [Firebase Console](https://console.firebase.google.com/) และกด **Create project**
3. เปิดใช้งาน **Authentication**:
   - ไปที่ **Build > Authentication > Get started**
   - เปิด **Sign-in method > Google > Enable**
   - ไปที่ **Authentication > Settings > Authorized domains** และเพิ่มโดเมนจริงที่จะเปิดใช้งาน (เช่น `report.rphst.go.th`)
4. เปิดใช้งาน **Cloud Firestore (NoSQL)**:
   - ไปที่ **Build > Firestore Database > Create database** เลือกภูมิภาค `asia-southeast1` (สิงคโปร์) หรือ `asia-east1`
5. ลงทะเบียน Web App ใน **Project Settings > Your apps > Web (`</>`)** เพื่อรับค่าคอนฟิก

#### ขั้นตอนที่ 2: ตั้งค่าคอนฟิกและ Security Rules
1. นำค่าจาก Firebase Web App มาแก้ไขในไฟล์ `firebase-applet-config.json` ที่รากโปรเจกต์:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "appId": "YOUR_APP_ID",
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "firestoreDatabaseId": "(default)",
     "storageBucket": "YOUR_PROJECT_ID.firebasestorage.app",
     "messagingSenderId": "YOUR_SENDER_ID"
   }
   ```
   *(หมายเหตุ: โปรเจกต์ใหม่ที่สร้างฐานข้อมูลหลักให้ใส่ `"firestoreDatabaseId": "(default)"`)*
2. Deploy กฎความปลอดภัยจากไฟล์ `firestore.rules`:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use YOUR_PROJECT_ID
   firebase deploy --only firestore:rules
   ```
   *(ระบบจัดเรียงข้อมูลในหน่วยความจำหลัง Query จึงไม่ต้องสร้าง Composite Index เพิ่มเติม)*

#### ขั้นตอนที่ 3: Build และเปิดให้บริการระบบ
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. สร้างไฟล์ Production Build (dist/)
npm run build

# 3. รัน Production Server (พอร์ต 3000)
NODE_ENV=production PORT=3000 npm start
```
*(แนะนำให้รันผ่าน `pm2` หรือ Docker/Cloud Run และทำ Reverse Proxy ด้วย Nginx/Caddy เพื่อให้ใช้งานผ่าน `https://` ซึ่งเป็นข้อกำหนดของ Google Sign-In)*

#### ขั้นตอนที่ 4: ตรวจสอบความพร้อมหลังติดตั้ง (Checklist)
1. เรียก `GET http://localhost:3000/api/v1/health` ต้องได้ JSON `"status": "ok"`
2. ล็อกอินด้วย Google บนหน้าเว็บ ตั้งค่ารหัส HCODE ในเมนู **"ส่งข้อมูลให้ สสอ. & ตั้งค่า"**
3. ทดสอบกด **"จำลองข้อมูลตัวอย่าง REP"** เพื่อเช็กว่าแสดงข้อมูลได้ครบทั้ง 4 หน้าหลัก:
   - **แดชบอร์ดรายเดือน**: การ์ดสรุปปีงบประมาณ + กราฟเส้นแนวโน้มรายเดือน + ยอดแยก 4 กองทุน
   - **รายงานสรุปรายเดือน**: รายละเอียดตามรายงานงวด (`ข้อมูลปกติ` / `ข้อมูลอุทธรณ์`), สรุปตามเดือน และปุ่มส่งออก **Excel / CSV / PDF ฉบับย่อ**
   - **ตารางข้อมูล V.3 5367**: ค้นหางวด, แก้ไขยอดพึงจ่าย/หมายเหตุ, ส่งออก Excel/CSV V.3 5367
   - **REST API**: สร้าง `x-api-key` และทดสอบดึง JSON

---

## 3. คู่มือปฏิบัติงานสำหรับเจ้าหน้าที่ รพ.สต.

1. **นำเข้าไฟล์ Statement REP หรือ V.3 5367**
   - กดปุ่ม **"นำเข้า Excel"** มุมขวาบน รองรับ `.xlsx`, `.xls`, `.csv`
   - ระบบอ่านไฟล์ REP รายเคส (แยก `ข้อมูลปกติ` และ `ข้อมูลอุทธรณ์`) และจัดกลุ่มเป็นงวด `V.3 5367` ให้อัตโนมัติ พร้อมข้ามแถว `"รวม"` ท้ายตาราง
2. **ตรวจทานและส่งออกรายงานรายเดือน / รายงวด**
   - แท็บ **"รายงานสรุปรายเดือน"**: เลือกดูตาม `รายงานงวด` เพื่อตรวจรายชื่อผู้ป่วยส่วน `ข้อมูลปกติ` และ `ข้อมูลอุทธรณ์`, ส่งออก Excel งวด, Excel รายเดือน, CSV หรือกด **"ส่งออก PDF ฉบับย่อ"** เพื่อพิมพ์เอกสาร A4 แนวนอนพร้อมช่องลงนามเสนอผู้บริหารได้ทันที
3. **บันทึกยอดพึงจ่ายในตาราง V.3 5367**
   - แท็บ **"ตารางข้อมูล V.3 5367"**: ค้นหาตามงวด/เดือน กดแก้ไขรายงวดเพื่อระบุ **ยอดพึงจ่าย** และ **หมายเหตุ** ระบบจะคำนวณ **คงเหลือสุทธิ** อัตโนมัติ
4. **ส่งรายงานให้ สสอ. และเชื่อมต่อ REST API**
   - แท็บ **"ส่งข้อมูลให้ สสอ. & ตั้งค่า"**: กดส่งรายงานสรุปรายเดือนให้ สสอ. (บันทึกประวัติใน Firestore และส่ง Webhook HTTPS หากระบุ URL ไว้)
   - แท็บ **"เชื่อมต่อ REST API"**: สร้าง Key (`x-api-key`) เพื่อดึงข้อมูลผ่าน `/api/v1/reports`, `/api/v1/reports/monthly`, `/api/v1/funds/summary`

---

## 4. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

| อาการที่พบ | สาเหตุ | แนวทางแก้ไข |
| :--- | :--- | :--- |
| ล็อกอิน Google ไม่ผ่าน (`auth/unauthorized-domain`) | โดเมนใหม่ยังไม่ได้รับอนุญาตใน Firebase | เพิ่มโดเมนที่ใช้งานจริงใน Firebase Console > Authentication > Settings > Authorized domains |
| ขึ้น `Missing or insufficient permissions` | ยังไม่ได้ Deploy `firestore.rules` หรืออีเมลยังไม่ยืนยัน | รัน `firebase deploy --only firestore:rules` และใช้บัญชี Google ที่ยืนยันอีเมลแล้ว |
| นำเข้าไฟล์แล้วไม่พบข้อมูล | หัวตารางไม่ตรงแม่แบบ REP หรือ V.3 5367 | กด **"ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)"** ในหน้าต่างนำเข้าเพื่อเทียบโครงสร้างคอลัมน์ |
| API ตอบกลับ `403 INVALID_OR_REVOKED_API_KEY` | Key ถูกเพิกถอนหรือ Server รีสตาร์ทยังไม่ซิงค์ | เข้าสู่ระบบหน้าเว็บหรือกด **"ซิงค์ API"** ในหน้า REST API |
