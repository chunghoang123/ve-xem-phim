import { useState } from "react";
import { useAuth } from "../components/Navbar";
import { api } from "../lib/api";
import { User, Mail, Phone, Lock, AlertCircle, CheckCircle, Save } from "lucide-react";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setMessage(""); setError("");
    if (!name.trim()) { setError("Vui lòng nhập họ tên"); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: name.trim(), phone: phone.trim() });
      setMessage("Cập nhật thông tin thành công");
      refreshUser();
    } catch (err) { setError(err.data?.message || "Lỗi cập nhật"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPwdMsg(""); setPwdErr("");
    if (!currentPassword || !newPassword) { setPwdErr("Vui lòng nhập đầy đủ"); return; }
    if (newPassword.length < 6) { setPwdErr("Mật khẩu mới phải có ít nhất 6 ký tự"); return; }
    if (newPassword !== confirmPassword) { setPwdErr("Mật khẩu xác nhận không khớp"); return; }
    setChangingPwd(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setPwdMsg("Đổi mật khẩu thành công");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) { setPwdErr(err.data?.message || "Lỗi đổi mật khẩu"); }
    finally { setChangingPwd(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Vui lòng đăng nhập để xem trang này</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Trang cá nhân</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile info */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-purple-400" />Thông tin cá nhân</h2>
            {message && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" />{message}</div>}
            {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={user.email} disabled
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm cursor-not-allowed" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Số điện thoại"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-purple-400" />Đổi mật khẩu</h2>
            {pwdMsg && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" />{pwdMsg}</div>}
            {pwdErr && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{pwdErr}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Mật khẩu hiện tại"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Xác nhận mật khẩu mới"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
              <button type="submit" disabled={changingPwd}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                <Lock className="w-4 h-4" />{changingPwd ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
