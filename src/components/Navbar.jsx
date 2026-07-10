import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Film, User, ChevronDown, LogOut, Shield, Mail, Lock, AlertCircle, Smartphone, KeyRound, Phone, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { auth, googleProvider, facebookProvider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";

const navLinks = [
  { to: "/", label: "Trang chủ" },
  { to: "/movies", label: "Phim" },
  { to: "/showtimes", label: "Lịch chiếu" },
  { to: "/promotions", label: "Khuyến mãi" },
];

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);

  const icons = { success: CheckCircle, error: AlertCircle, info: AlertCircle };
  const Icon = icons[type] || CheckCircle;
  const colors = {
    success: "border-green-500/30 bg-green-500/10 text-green-400",
    error: "border-red-500/30 bg-red-500/10 text-red-400",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  };

  return (
    <div className={`fixed top-20 right-4 sm:right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md animate-slide-down ${colors[type] || colors.success}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  );
}

function LoadingOverlay({ message = "Đang xử lý..." }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 animate-scale">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function LogoutConfirm({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onCancel}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
            <LogOut className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-lg font-bold">Đăng xuất</h3>
          <p className="text-sm text-muted-foreground mt-1">Bạn có chắc chắn muốn đăng xuất không?</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">Đăng xuất</button>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => { setMobileOpen(false); setShowDropdown(false); }, [location.pathname]);
  useEffect(() => {
    if (mobileOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLoginSuccess = () => {
    setShowAuth(false);
    setToast({ message: `Đăng nhập thành công! Chào mừng bạn đến với CineX`, type: "success" });
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    setShowDropdown(false);
    setAuthLoading(true);
    setTimeout(() => {
      logout();
      setAuthLoading(false);
      setToast({ message: "Đã đăng xuất khỏi tài khoản", type: "info" });
    }, 600);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">CineX</span>
            </Link>

            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to}
                  className={cn("px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    location.pathname === link.to
                      ? "bg-purple-500/20 text-purple-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80")}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <div className="relative">
                  <button onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted hover:bg-border transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <span className="hidden sm:block text-sm font-medium max-w-[80px] truncate">{user.name}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {showDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                      <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-scale">
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-semibold truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {user.role === 'admin' ? 'Quản trị viên' : user.role === 'staff' ? 'Nhân viên' : 'Thành viên CineX'}
                          </p>
                        </div>
                        {user.role !== 'admin' && (
                          <Link to="/profile" onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted transition-colors">
                            <User className="w-4 h-4" />Trang cá nhân
                          </Link>
                        )}
                        {user.role === 'admin' && (
                          <Link to="/admin" onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted transition-colors">
                            <Shield className="w-4 h-4" />Quản trị
                          </Link>
                        )}
                        <button onClick={() => { setShowDropdown(false); setShowLogoutConfirm(true); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted transition-colors text-red-400">
                          <LogOut className="w-4 h-4" />Đăng xuất
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">
                  <User className="w-4 h-4" /><span className="hidden sm:inline">Đăng nhập</span>
                </button>
              )}

              <button onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2.5 rounded-xl hover:bg-muted transition-colors">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-14 left-0 right-0 bg-card border-b border-border shadow-2xl animate-slide">
            <div className="px-4 py-4 space-y-1.5">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  className={cn("block px-4 py-3.5 rounded-xl text-sm font-semibold transition-colors",
                    location.pathname === link.to ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  {link.label}
                </Link>
              ))}
              {user && user.role === 'admin' && (
                <>
                  <div className="border-t border-border my-2" />
                  <Link to="/admin" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-purple-400 hover:bg-muted transition-colors">
                    <Shield className="w-4 h-4" />Quản trị
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuth && !user && <AuthModal onClose={() => setShowAuth(false)} onLoginSuccess={handleLoginSuccess} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {authLoading && <LoadingOverlay message="Đang đăng xuất..." />}

      {showLogoutConfirm && <LogoutConfirm onConfirm={handleLogoutConfirm} onCancel={() => setShowLogoutConfirm(false)} />}
    </>
  );
}

function AuthModal({ onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [registerData, setRegisterData] = useState({ phone: '', name: '' });

  const handleRegisterSuccess = (data) => {
    setRegisterData(data);
    setMode("verify");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale" onClick={(e) => e.stopPropagation()}>
        {mode === "login" && <LoginForm onLoginSuccess={onLoginSuccess} onSwitch={() => setMode("register")} />}
        {mode === "register" && <RegisterForm onClose={onClose} onSwitch={() => setMode("login")} onOtpSent={handleRegisterSuccess} />}
        {mode === "verify" && <VerifyOtpForm onClose={onClose} phone={registerData.phone} onSwitch={() => setMode("register")} />}
      </div>
    </div>
  );
}

function LoginForm({ onLoginSuccess, onSwitch }) {
  const [loginMethod, setLoginMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginWithPhone } = useAuth();

  const firebaseSocialLogin = async (provider) => {
    setError(""); setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const providerName = provider === googleProvider ? 'google' : 'facebook';
      const res = await api.post('/auth/firebase-login', { idToken, provider: providerName });
      setToken(res.data.token);
      window.location.reload();
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      setError(err.data?.message || "Đăng nhập thất bại");
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (loginMethod === "email") {
      if (!email.trim() || !password.trim()) { setError("Vui lòng nhập email và mật khẩu"); return; }
      setLoading(true);
      try { await login(email.trim(), password); onLoginSuccess(); }
      catch (err) { setError(err.data?.message || "Đăng nhập thất bại"); }
      finally { setLoading(false); }
    } else {
      if (!phone.trim() || !password.trim()) { setError("Vui lòng nhập số điện thoại và mật khẩu"); return; }
      setLoading(true);
      try { await loginWithPhone(phone.trim(), password); onLoginSuccess(); }
      catch (err) { setError(err.data?.message || "Đăng nhập thất bại"); }
      finally { setLoading(false); }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-1">Đăng nhập</h2>
      <p className="text-muted-foreground text-sm mb-6">Đăng nhập để đặt vé và quản lý</p>

      {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      <div className="space-y-4">
        <div className="flex border border-border rounded-xl overflow-hidden">
          <button type="button" onClick={() => setLoginMethod("email")}
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", loginMethod === "email" ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground")}>
            <Mail className="w-4 h-4 inline mr-1.5" />Email
          </button>
          <button type="button" onClick={() => setLoginMethod("phone")}
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", loginMethod === "phone" ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground")}>
            <Phone className="w-4 h-4 inline mr-1.5" />SĐT
          </button>
        </div>

        {loginMethod === "email" ? (
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" autoFocus />
          </div>
        ) : (
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Số điện thoại"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" autoFocus />
          </div>
        )}

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" />
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full mt-5 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">Hoặc đăng nhập với</span></div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => firebaseSocialLogin(googleProvider)} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-gray-800 text-sm font-semibold hover:bg-gray-100 transition-all shadow-lg border border-gray-200 disabled:opacity-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google
        </button>
        <button type="button" onClick={() => firebaseSocialLogin(facebookProvider)} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] text-white text-sm font-semibold hover:bg-[#166fe5] transition-all shadow-lg shadow-[#1877F2]/20 disabled:opacity-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Chưa có tài khoản? <button type="button" onClick={onSwitch} className="text-purple-400 hover:underline font-medium">Đăng ký</button>
      </p>
    </form>
  );
}

function VerifyOtpForm({ onClose, phone, onSwitch }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (otp.length !== 6) { setError("Mã OTP gồm 6 chữ số"); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-sms-otp', { phone, otp });
      setToken(res.data.token);
      window.location.reload();
    } catch (err) { setError(err.data?.message || "Mã OTP không hợp lệ"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-1">Xác thực số điện thoại</h2>
      <p className="text-muted-foreground text-sm mb-6">Nhập mã 6 chữ số được gửi đến <strong className="text-foreground">{phone}</strong></p>
      {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      <div className="relative">
        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000" maxLength={6}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm text-center text-2xl font-bold tracking-widest" autoFocus />
      </div>
      <div className="flex gap-3 mt-5">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
        <button type="submit" disabled={loading || otp.length !== 6}
          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
          {loading ? "Đang xác thực..." : "Xác thực"}
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">
        Không nhận được mã? <button type="button" onClick={onSwitch} className="text-purple-400 hover:underline font-medium">Gửi lại</button>
      </p>
    </form>
  );
}

function RegisterForm({ onClose, onSwitch, onOtpSent }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (!name.trim() || !phone.trim() || !password.trim()) { setError("Vui lòng nhập đầy đủ thông tin"); return; }
    if (!/^0\d{9}$/.test(phone.trim())) { setError("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"); return; }
    if (password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); return; }
    setLoading(true);
    try {
      await api.post('/auth/send-sms-otp', { phone: phone.trim(), name: name.trim(), password });
      onOtpSent({ phone: phone.trim(), name: name.trim() });
    } catch (err) { setError(err.data?.message || "Lỗi gửi OTP"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-1">Đăng ký</h2>
      <p className="text-muted-foreground text-sm mb-6">Tạo tài khoản CineX để đặt vé</p>
      {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      <div className="space-y-4">
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Họ và tên"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" autoFocus />
        </div>
        <div className="relative">
          <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Số điện thoại"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" />
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu (ít nhất 6 ký tự)"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
          {loading ? "Đang gửi..." : "Gửi mã xác thực"}
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">
        Đã có tài khoản? <button type="button" onClick={onSwitch} className="text-purple-400 hover:underline font-medium">Đăng nhập</button>
      </p>
    </form>
  );
}
