import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  FileText,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  Send,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { ApiConsoleView } from './components/ApiConsoleView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ImportModal } from './components/ImportModal';
import { ManualModal } from './components/ManualModal';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { MonthlyReportDetailView } from './components/MonthlyReportDetailView';
import { ReportGridView } from './components/ReportGridView';
import { SsoSubmissionView } from './components/SsoSubmissionView';
import { signInWithGoogle, signOutUser } from './firebase';
import { useRphstData } from './hooks/useRphstData';
import { getSampleRepTransactions, getSampleV3Rows } from './utils/excelV3';

type ActiveTab = 'dashboard' | 'monthlyReport' | 'grid' | 'sso' | 'api';

function MainApp() {
  const {
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
    updateClaimRow,
    deleteClaimRecord,
    clearAllClaimRecords,
    createSsoSubmission,
    acknowledgeSsoSubmission,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
  } = useRphstData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้'
      );
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">กำลังเชื่อมต่อระบบฐานข้อมูล NoSQL...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="text-xs font-semibold text-teal-700 tracking-wide mb-2">
            RPHST RECEIVABLE · PAYABLE ANALYTICS
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3 text-balance">
            ระบบรายงานพึงรับ-พึงจ่าย รพ.สต. (V.3 5367)
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            วิเคราะห์ข้อมูลการเรียกเก็บ ชดเชยจริง ยอดพึงจ่าย และสรุปรายเดือนแบบเรียลไทม์บนฐานข้อมูล
            NoSQL (Firestore) พร้อมนำเข้าไฟล์ Excel ตัวอย่าง ส่งข้อมูลให้ สสอ. และเชื่อมต่อผ่าน REST API
          </p>

          <div className="border-t border-b border-slate-100 py-4 mb-6 space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>แม่แบบมาตรฐานที่รองรับ</span>
              <span className="font-mono-nums font-medium text-slate-900">Excel / CSV V.3 5367</span>
            </div>
            <div className="flex items-center justify-between">
              <span>ฐานข้อมูลและการซิงค์</span>
              <span className="font-medium text-slate-900">Firebase Firestore (Real-Time NoSQL)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>อินเทอร์เฟซเชื่อมต่อภายนอก</span>
              <span className="font-mono-nums font-medium text-slate-900">REST API + x-api-key</span>
            </div>
          </div>

          {authError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            เข้าสู่ระบบด้วยบัญชี Google เพื่อเริ่มต้นใช้งาน
          </button>
        </div>
      </div>
    );
  }

  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ดรายเดือน',
      shortLabel: 'แดชบอร์ด',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'monthlyReport',
      label: 'รายงานสรุปรายเดือน',
      shortLabel: 'รายงานรายเดือน',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'grid',
      label: 'ตารางข้อมูล V.3 5367',
      shortLabel: 'ตาราง V.3',
      icon: <Table2 className="w-4 h-4" />,
    },
    {
      id: 'sso',
      label: 'ส่งข้อมูลให้ สสอ. & ตั้งค่า',
      shortLabel: 'ส่ง สสอ.',
      icon: <Send className="w-4 h-4" />,
    },
    {
      id: 'api',
      label: 'เชื่อมต่อ REST API',
      shortLabel: 'REST API',
      icon: <KeyRound className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="text-base font-bold text-slate-900 tracking-tight">
            รพ.สต. PayTrack
          </div>
          <div className="text-xs text-slate-500 mt-1 truncate" title={unitProfile?.unitName}>
            {unitProfile?.unitCode || '05447'} · {unitProfile?.unitName || 'หน่วยบริการ'}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2.5">
          <div className="text-xs pb-1">
            <div className="font-medium text-slate-900 truncate">
              {user.displayName || 'เจ้าหน้าที่ รพ.สต.'}
            </div>
            <div className="text-slate-500 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            คู่มือ &amp; การติดตั้งส่งมอบ
          </button>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 lg:hidden flex">
          <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900">รพ.สต. PayTrack</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg ${
                    activeTab === item.id
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setManualOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg"
              >
                <BookOpen className="w-3.5 h-3.5" />
                คู่มือ &amp; การติดตั้งส่งมอบ
              </button>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Strict 3-Zone Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30">
          {/* Zone 1: Single-line title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-semibold text-slate-900 whitespace-nowrap shrink-0">
              ระบบรายงานพึงรับ-พึงจ่าย รพ.สต.
            </span>
          </div>

          {/* Zone 2: single-line nav links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                  activeTab === item.id
                    ? 'text-teal-700 border-b-2 border-teal-700'
                    : 'hover:text-slate-900'
                }`}
              >
                {item.shortLabel}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              นำเข้า Excel
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <MonthlyDashboard
              records={claimRecords}
              loading={loadingData}
              onOpenImport={() => setImportOpen(true)}
              onLoadSampleData={async () => {
                await importClaimRecords(
                  getSampleV3Rows(),
                  'replace',
                  getSampleRepTransactions()
                );
                showToast('นำเข้าข้อมูลตัวอย่าง REP รายงวด (ปกติ/อุทธรณ์) เรียบร้อยแล้ว');
              }}
              onNavigateGrid={() => setActiveTab('grid')}
              onNavigateMonthlyReport={() => setActiveTab('monthlyReport')}
            />
          )}

          {activeTab === 'monthlyReport' && (
            <MonthlyReportDetailView
              unitProfile={unitProfile}
              records={claimRecords}
              repTransactions={repTransactions}
              onOpenImport={() => setImportOpen(true)}
              onNotify={showToast}
            />
          )}

          {activeTab === 'grid' && (
            <ReportGridView
              unitProfile={unitProfile}
              records={claimRecords}
              onOpenImport={() => setImportOpen(true)}
              onOpenManual={() => setManualOpen(true)}
              onGoSso={() => setActiveTab('sso')}
              onUpdateRow={async (id, row) => {
                await updateClaimRow(id, row);
                showToast('อัปเดตข้อมูลรายการงวดเรียบร้อยแล้ว');
              }}
              onAddRow={async (row) => {
                await importClaimRecords([row], 'append');
                showToast('เพิ่มรายการงวดใหม่ลงฐานข้อมูลเรียบร้อยแล้ว');
              }}
              onDeleteRow={async (id) => {
                await deleteClaimRecord(id);
                showToast('ลบรายการเรียบร้อยแล้ว');
              }}
              onClearAll={async () => {
                await clearAllClaimRecords();
                showToast('ล้างข้อมูลตารางทั้งหมดเรียบร้อยแล้ว');
              }}
              onNotify={showToast}
            />
          )}

          {activeTab === 'sso' && (
            <SsoSubmissionView
              unitProfile={unitProfile}
              records={claimRecords}
              submissions={ssoSubmissions}
              onSaveSettings={saveUnitSettings}
              onSubmitToSso={createSsoSubmission}
              onAcknowledge={acknowledgeSsoSubmission}
            />
          )}

          {activeTab === 'api' && (
            <ApiConsoleView
              apiKeys={apiKeys}
              apiSyncStatus={apiSyncStatus}
              syncErrorMsg={syncErrorMsg}
              onSyncNow={syncApiGateway}
              onCreateKey={createApiKey}
              onRevokeKey={revokeApiKey}
              onDeleteKey={deleteApiKey}
            />
          )}
        </main>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingCount={claimRecords.length}
        onConfirmImport={async (rows, mode, transactions) => {
          await importClaimRecords(rows, mode, transactions);
          showToast(`นำเข้าข้อมูลสำเร็จ ${rows.length} งวด`);
          setActiveTab('monthlyReport');
        }}
      />

      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} />

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
