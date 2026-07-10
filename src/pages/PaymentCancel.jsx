import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { XCircle, Loader2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get("orderCode");
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!orderCode) {
      setState("error");
      setMessage("Thiếu mã giao dịch từ PayOS.");
      return;
    }

    api.post(`/v1/payments/order/${encodeURIComponent(orderCode)}/cancel`, {})
      .then(() => setState("cancelled"))
      .catch(async (err) => {
        if (err.status === 409) {
          try {
            const res = await api.get(`/v1/payments/order/${encodeURIComponent(orderCode)}/status`);
            if (res.data.payment_status === "PAID") {
              setState("paid");
              setMessage("Giao dịch đã được thanh toán nên không thể hủy.");
              return;
            }
          } catch {
            // Show the original cancellation error below.
          }
        }
        setState("error");
        setMessage(err.data?.message || "Không thể cập nhật trạng thái hủy.");
      });
  }, [orderCode]);

  if (state === "loading") {
    return <div className="min-h-screen pt-24 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 w-full">
      <div className="max-w-sm w-full text-center animate-scale">
        {state === "cancelled" ? <XCircle className="w-20 h-20 text-red-400 mx-auto mb-5" /> : <AlertCircle className="w-20 h-20 text-amber-400 mx-auto mb-5" />}
        <h1 className="text-3xl font-bold mb-2">{state === "cancelled" ? "Thanh toán đã hủy" : "Cần kiểm tra giao dịch"}</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {state === "cancelled" ? "Đơn chờ thanh toán đã được hủy và ghế đã được giải phóng." : message}
        </p>
        <div className="flex gap-3">
          <Link to="/movies" className="flex-1 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium text-center">Đặt lại vé</Link>
          <Link to={state === "paid" ? "/profile" : "/"} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold text-center">{state === "paid" ? "Xem vé" : "Về trang chủ"}</Link>
        </div>
      </div>
    </div>
  );
}
