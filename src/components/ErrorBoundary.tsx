import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล';
    let details: string | null = error.message;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.operationType) {
        if (String(parsed.error).includes('Quota exceeded')) {
          message = 'โควตาการใช้งานฐานข้อมูลรายวันเต็มชั่วคราว';
        } else if (String(parsed.error).includes('Missing or insufficient permissions')) {
          message = 'สิทธิ์การเข้าถึงข้อมูลถูกปฏิเสธตามกฎความปลอดภัย Firestore';
        }
        details = `${parsed.operationType.toUpperCase()} · ${parsed.path ?? '-'}`;
      }
    } catch {
      // Plain error message
    }

    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 text-red-700 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-base font-semibold">ไม่สามารถแสดงผลหน้านี้ได้</h1>
            </div>
            <p className="text-sm text-slate-700 mb-2">{this.state.message}</p>
            {this.state.details && (
              <p className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4 break-all">
                {this.state.details}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
