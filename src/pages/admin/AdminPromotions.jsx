import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Trash2, X, Gift, GraduationCap, Crown, Ticket } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { api } from "../../lib/api";

const iconMap = { Gift, GraduationCap, Crown, Ticket };

export default function AdminPromotions() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchPromos = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${search}` : '';
      const res = await api.get(`/promotions?limit=50${params}`);
      setPromos(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { const t = setTimeout(fetchPromos, 300); return () => clearTimeout(t); }, [fetchPromos]);

  const handleDelete = async (id) => {
    if (!confirm("Xóa khuyến mãi này?")) return;
    try {
      await api.delete(`/promotions/${id}`);
      fetchPromos();
    } catch (err) {
      alert(err.data?.message || "Lỗi xóa");
    }
  };

  const handleSave = async (data) => {
    try {
      if (editing) {
        await api.put(`/promotions/${editing.id}`, data);
      } else {
        await api.post('/promotions', data);
      }
      setShowForm(false);
      setEditing(null);
      fetchPromos();
    } catch (err) {
      alert(err.data?.message || "Lỗi lưu");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quản lý khuyến mãi</h1>
          <p className="text-muted-foreground text-sm mt-1">{promos.length} khuyến mãi</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Thêm khuyến mãi</span>
        </button>
      </div>

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm khuyến mãi..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="col-span-full text-center py-10 text-muted-foreground">Đang tải...</p> :
         promos.map((p) => {
           const Icon = iconMap[p.icon] || Gift;
           return (
             <div key={p.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-shadow">
               <div className="flex items-start justify-between mb-3">
                 <div className={`w-10 h-10 rounded-xl bg-${p.color}-500/20 flex items-center justify-center`}>
                   <Icon className={`w-5 h-5 text-${p.color}-400`} />
                 </div>
                 <div className="flex gap-1">
                   <button onClick={() => { setEditing(p); setShowForm(true); }}
                     className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-purple-400"><Pencil className="w-3.5 h-3.5" /></button>
                   <button onClick={() => handleDelete(p.id)}
                     className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                 </div>
               </div>
               <h3 className="font-semibold mb-1">{p.title}</h3>
               <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
               <div className="flex items-center justify-between">
                 <span className="text-sm font-bold text-purple-400">{p.discount}</span>
                 {p.valid_until && <span className="text-xs text-muted-foreground">HSD: {formatDate(p.valid_until)}</span>}
               </div>
               {p.code && <span className="inline-block mt-2 px-2 py-0.5 rounded bg-muted text-xs font-mono">{p.code}</span>}
             </div>
           );
         })}
      </div>

      {showForm && (
        <PromoFormModal promo={editing} onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function PromoFormModal({ promo, onSave, onClose }) {
  const [form, setForm] = useState(promo || {
    title: "", description: "", discount: "", code: "", valid_until: "", color: "purple", icon: "Gift"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{promo ? "Sửa khuyến mãi" : "Thêm khuyến mãi"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tiêu đề</label>
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mô tả</label>
            <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Giảm giá</label>
              <input type="text" value={form.discount} onChange={(e) => setForm({...form, discount: e.target.value})} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mã giảm giá</label>
              <input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Hiệu lực đến</label>
              <input type="date" value={form.valid_until} onChange={(e) => setForm({...form, valid_until: e.target.value})}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Màu</label>
              <select value={form.color} onChange={(e) => setForm({...form, color: e.target.value})}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="purple">Tím</option><option value="pink">Hồng</option><option value="amber">Cam</option><option value="emerald">Xanh lá</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">Hủy</button>
            <button type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20">{promo ? "Lưu" : "Thêm"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
