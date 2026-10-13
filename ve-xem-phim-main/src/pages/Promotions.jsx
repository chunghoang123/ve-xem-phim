import { useState, useEffect } from "react";
import { Gift, Percent, Star, Tag, Clock, Copy, Check } from "lucide-react";
import { api } from "../lib/api";

const iconMap = { Gift, Percent, Star, Tag };

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api.get("/promotions?limit=20").then(res => setPromos(res.data || [])).catch(() => {});
  }, []);

  const copyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 w-full">
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="mb-7 sm:mb-9">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1.5 sm:mb-2">Khuyến mãi</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Các ưu đãi hấp dẫn dành riêng cho bạn</p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:gap-6">
          {promos.length === 0 ? (
            <div className="text-center py-16">
              <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Hiện chưa có khuyến mãi nào</p>
            </div>
          ) : promos.map((promo) => {
            const Icon = iconMap[promo.icon] || Gift;
            const colorMap = {
              purple: "from-purple-500 to-pink-500",
              pink: "from-pink-500 to-rose-500",
              amber: "from-amber-500 to-orange-500",
              emerald: "from-emerald-500 to-green-500",
              blue: "from-blue-500 to-cyan-500",
            };
            const gradient = colorMap[promo.color] || colorMap.purple;

            return (
              <div key={promo.id} className="bg-card border border-border rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-lg hover:border-purple-500/30 transition-all flex flex-col sm:flex-row gap-4 sm:gap-5">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base sm:text-lg mb-1.5">{promo.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{promo.description}</p>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-muted-foreground">
                    {promo.valid_until && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        HSD: {new Date(promo.valid_until).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                    {promo.discount && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">{promo.discount}</span>
                    )}
                  </div>
                </div>
                {promo.code && (
                  <div className="flex items-center sm:items-start">
                    <button onClick={() => copyCode(promo.code)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-semibold transition-all shrink-0">
                      {copied === promo.code ? (
                        <><Check className="w-4 h-4" /> Đã sao chép</>
                      ) : (
                        <><Copy className="w-4 h-4" /> {promo.code}</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
