import { Routes, Route, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Database, Settings, BarChart3, Upload, Shield, X, MessageSquare, Clock, LogOut } from "lucide-react";
import { useState } from "react";
import TeacherUpload from "./pages/TeacherUpload";
import AdminDashboard from "./pages/AdminDashboard";
import ClassDetails from "./pages/ClassDetails";
import SeedPage from "./pages/SeedPage";
import ImportStudents from "./pages/ImportStudents";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import MessagesPage from "./pages/MessagesPage";
import MessageTemplatesPage from "./pages/MessageTemplatesPage";
import AdminGuard, { clearAdminSession } from "./components/AdminGuard";
import { SchoolProvider, useSchool } from "./lib/SchoolContext";
import SchoolSetupGuard from "./components/SchoolSetupGuard";
import LateStudentsPage from "./pages/LateStudentsPage";
import SuperAdminPage from "./pages/SuperAdminPage";

const PUBLIC_NAV = [
  { to: "/", icon: <LayoutDashboard className="w-5 h-5" />, label: "المتابعة", admin: false },
  { to: "/upload", icon: <Upload className="w-5 h-5" />, label: "رصد الغياب", admin: false },
  { to: "/reports", icon: <BarChart3 className="w-5 h-5" />, label: "التقارير", admin: false },
  { to: "/lates", icon: <Clock className="w-5 h-5" />, label: "تأخير الطلاب", admin: false },
  { to: "/messages", icon: <MessageSquare className="w-5 h-5" />, label: "الرسائل", admin: false },
];

const ADMIN_NAV = [
  { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "الإعدادات", admin: true },
];

const ALL_NAV = [...PUBLIC_NAV, ...ADMIN_NAV];

function App() {
  return (
    <SchoolProvider>
      <Routes>
        {/* Platform owner console — deliberately outside SchoolSetupGuard, so it
            works without being logged into any particular school. */}
        <Route path="/super" element={<SuperAdminPage />} />
        <Route path="/*" element={<SchoolApp />} />
      </Routes>
    </SchoolProvider>
  );
}

function SchoolApp() {
  return (
      <div className="app-shell min-h-screen bg-qatar-gray-bg text-qatar-ink font-sans" dir="rtl">
        <SchoolSetupGuard>
          <Navbar />
          <main className="workspace max-w-7xl mx-auto py-4 lg:py-6 px-3 sm:px-6 lg:px-8 pb-28 lg:pb-10">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/upload" element={<TeacherUpload />} />
              <Route path="/class/:classId" element={<ClassDetails />} />
              <Route path="/lates" element={<LateStudentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/import-students" element={<AdminGuard><ImportStudents /></AdminGuard>} />
              <Route path="/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />
              <Route path="/message-templates" element={<AdminGuard><MessageTemplatesPage /></AdminGuard>} />
              <Route path="/seed" element={<AdminGuard><SeedPage /></AdminGuard>} />
            </Routes>
          </main>
          <BottomNav />
        </SchoolSetupGuard>
      </div>
  );
}

/**
 * Leaving a school clears the locally stored school context, so getting back in
 * needs the school code *and* password again. Worth a confirmation step.
 */
function ExitSchoolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { school, setSchool } = useSchool();
  if (!open) return null;

  const confirm = () => {
    clearAdminSession();
    setSchool(null);
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center">
            <LogOut className="w-7 h-7 text-qatar-maroon" />
          </div>
          <h3 className="text-lg font-black text-slate-800">الخروج من المدرسة</h3>
          <p className="text-sm font-bold text-slate-500 leading-relaxed">
            ستخرج من <span className="text-qatar-maroon">{school?.name || "المدرسة الحالية"}</span> وتعود
            لشاشة إدخال الكود. ستحتاج كود المدرسة وكلمة المرور للدخول مرة أخرى.
          </p>
          <p className="text-[11px] font-bold text-slate-400">
            بيانات الطلاب والغياب محفوظة على الخادم ولن تُحذف.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={confirm}
            className="flex-1 bg-qatar-maroon text-white font-black py-3 rounded-xl hover:opacity-90 transition-all"
          >
            تأكيد الخروج
          </button>
        </div>
      </div>
    </div>
  );
}

function Navbar() {

  const { pathname } = useLocation();
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname.startsWith(to);
  const isAdminAuthed = sessionStorage.getItem("qatar_admin_auth") === "true";
  const { school } = useSchool();
  const [showExitSchool, setShowExitSchool] = useState(false);

  const handleLogout = () => {
    clearAdminSession();
    window.location.href = "/";
  };

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20" dir="rtl">
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: "var(--gradient-primary)" }} />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md"
              style={{ background: "var(--gradient-primary)" }}>Q</div>
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-sm text-slate-800">{school?.name || "نظام الحضور والغياب"}</span>
              <span className="hidden sm:block text-[9px] text-slate-400 font-bold uppercase tracking-wider">{school?.code || "QATAR"}</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {/* Public tabs */}
            {PUBLIC_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${active
                      ? "bg-qatar-maroon text-white shadow-sm"
                      : "text-slate-500 hover:bg-rose-50 hover:text-qatar-maroon"
                    }`}
                >
                  {icon}{label}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* Admin tabs */}
            {ADMIN_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${active
                      ? "bg-qatar-maroon text-white shadow-sm"
                      : "text-slate-400 hover:bg-rose-50 hover:text-qatar-maroon"
                    }`}
                >
                  {icon}
                  <span className="text-xs">{label}</span>
                  <Shield className={`w-2.5 h-2.5 opacity-50 ${active ? "text-white" : "text-slate-300"}`} />
                </Link>
              );
            })}
          </div>

          {/* Right side: user info */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdminAuthed && (
              <button onClick={handleLogout} title="إنهاء جلسة المسؤول والبقاء داخل المدرسة"
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-qatar-maroon border border-slate-200 hover:border-qatar-maroon/40 px-3 py-1.5 rounded-xl transition-all">
                <Shield className="w-3.5 h-3.5" />خروج المسؤول
              </button>
            )}
            <button onClick={() => setShowExitSchool(true)} title="الخروج من المدرسة وتغييرها"
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-qatar-maroon border border-slate-200 hover:border-qatar-maroon/40 px-3 py-1.5 rounded-xl transition-all">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج من المدرسة</span>
            </button>
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[10px] font-bold text-slate-400">{isAdminAuthed ? "مسؤول النظام" : "معلم"}</span>
              <span className="text-sm font-extrabold text-slate-700">{isAdminAuthed ? "Admin" : "Teacher"}</span>
            </div>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs ${isAdminAuthed ? "bg-qatar-maroon text-white border-qatar-maroon" : "bg-qatar-maroon/10 border-qatar-maroon/20 text-qatar-maroon"
              }`}>
              {isAdminAuthed ? "AD" : "T"}
            </div>
          </div>
        </div>
      </div>
      <ExitSchoolModal open={showExitSchool} onClose={() => setShowExitSchool(false)} />
    </nav>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname.startsWith(to);
  const isAdminAuthed = sessionStorage.getItem("qatar_admin_auth") === "true";
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [showExitSchool, setShowExitSchool] = useState(false);

  const handleLogout = () => {
    clearAdminSession();
    setShowAdminDrawer(false);
    window.location.href = "/";
  };

  const isAdminRouteActive = ADMIN_NAV.some(n => isActive(n.to));

  return (
    <>
      {showAdminDrawer && (
        <div className="lg:hidden fixed inset-0 z-40" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdminDrawer(false)} />
          <div className="absolute bottom-16 right-0 left-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-black text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-qatar-maroon" />صفحات المسؤول
              </span>
              <button onClick={() => setShowAdminDrawer(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {ADMIN_NAV.map(({ to, icon, label }) => (
                <Link key={to} to={to} onClick={() => setShowAdminDrawer(false)}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${isActive(to) ? "bg-qatar-maroon text-white" : "bg-slate-50 text-slate-700 hover:bg-rose-50 hover:text-qatar-maroon"
                    }`}
                >
                  {icon}{label}
                </Link>
              ))}
              {isAdminAuthed && (
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors mt-1">
                  <Shield className="w-5 h-5" />تسجيل الخروج من Admin
                </button>
              )}
              <button onClick={() => { setShowAdminDrawer(false); setShowExitSchool(true); }}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors mt-1">
                <LogOut className="w-5 h-5" />الخروج من المدرسة / تغييرها
              </button>
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 right-0 left-0 z-30 bg-white border-t-2 border-qatar-maroon shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" dir="rtl">
        <div className="flex items-stretch h-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {PUBLIC_NAV.map(({ to, icon, label }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors ${active ? "text-qatar-maroon" : "text-slate-400"
                  }`}
              >
                <span className={`transition-all ${active ? "scale-110" : ""}`}>{icon}</span>
                {label}
              </Link>
            );
          })}
          <button onClick={() => setShowAdminDrawer(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors relative ${isAdminRouteActive || showAdminDrawer ? "text-qatar-maroon" : "text-slate-400"
              }`}
          >
            <Shield className={`w-5 h-5 transition-all ${isAdminRouteActive || showAdminDrawer ? "scale-110" : ""}`} />
            {isAdminAuthed ? "إدارة" : "Admin"}
            {isAdminAuthed && (
              <span className="absolute top-2 left-1/2 translate-x-3 w-2 h-2 bg-qatar-maroon rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </nav>

      <ExitSchoolModal open={showExitSchool} onClose={() => setShowExitSchool(false)} />
    </>
  );
}

export default App;
