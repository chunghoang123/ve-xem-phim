import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, CreditCard, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { getTokenValue } from "../lib/api";

const API_BASE = "/api";

function authHeaders() {
  const token = getTokenValue();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (messages.length === 0) {
        const greeting = {
          id: Date.now(),
          role: "bot",
          text: `Xin chào! 👋 Mình là **CineX AI**, trợ lý đặt vé thông minh.

Mình có thể:
• 🎬 Xem phim đang chiếu
• 📅 Tra suất chiếu
• 📍 Tìm rạp gần bạn
• 🎫 Đặt vé nhanh chóng
• 💳 Thanh toán qua PayOS

Bạn muốn xem phim gì hôm nay?`,
          quickReplies: ["Phim đang chiếu 🎬", "Hỗ trợ"],
        };
        setMessages([greeting]);
      }
    }
  }, [isOpen, messages.length]);

  const sendToAI = useCallback(async (text) => {
    setIsTyping(true);
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Lỗi");

      if (!conversationId) setConversationId(data.conversationId);

      const botMsg = {
        id: Date.now() + 1,
        role: "bot",
        text: data.message,
        quickReplies: (data.suggestedActions || []).map((a) => a.label),
        suggestedActions: data.suggestedActions || [],
        data: data.data,
        currentStep: data.currentStep,
      };
      setMessages((prev) => [...prev, botMsg]);
      setPaymentData(
        data.currentStep === "PAYMENT_PENDING" && data.data ? data.data : null
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: `❌ Lỗi: ${err.message}. Vui lòng thử lại!`,
          quickReplies: ["Phim đang chiếu 🎬", "Hỗ trợ"],
          suggestedActions: [],
        },
      ]);
    }
    setIsTyping(false);
  }, [conversationId]);

  const handleSend = useCallback(
    async (text) => {
      const userMsg = text || input.trim();
      if (!userMsg) return;

      const userMessage = { id: Date.now(), role: "user", text: userMsg };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      if (userMsg === "Hỗ trợ") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "bot",
            text: `Mình có thể giúp bạn:\n\n🎬 **Xem phim**: "Có phim gì đang chiếu?"\n🎫 **Đặt vé**: "Đặt vé xem [tên phim]"\n📍 **Tìm rạp**: "Rạp gần [địa chỉ]"\n📅 **Suất chiếu**: "Suất chiếu hôm nay"\n\n**Quy trình đặt vé:**\n1️⃣ Chọn phim\n2️⃣ Chọn khu vực\n3️⃣ Chọn rạp\n4️⃣ Chọn ngày\n5️⃣ Chọn suất chiếu\n6️⃣ Chọn ghế\n7️⃣ Thanh toán PayOS 💳`,
            quickReplies: ["Phim đang chiếu 🎬", "Đặt vé nhanh"],
            suggestedActions: [{ type: "LIST_MOVIES", label: "Phim đang chiếu 🎬", value: "" }],
          },
        ]);
        return;
      }

      if (userMsg === "Đặt vé nhanh" || userMsg === "Đặt vé ngay") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "bot",
            text: "Bạn muốn xem phim nào? Vui lòng cho mình tên phim nhé! 🎬",
            quickReplies: ["Phim đang chiếu 🎬"],
            suggestedActions: [],
          },
        ]);
        return;
      }

      if (userMsg.startsWith("Phim đang chiếu") || userMsg === "Phim đang chiếu 🎬") {
        setConversationId(null);
        await sendToAI("Có phim gì đang chiếu?");
        return;
      }

      if (userMsg.startsWith("Kiểm tra") || userMsg === "Kiểm tra thanh toán 🔄") {
        const lastPayment = paymentData;
        if (lastPayment?.paymentCode) {
          await sendToAI("Kiểm tra thanh toán");
          return;
        }
      }

      if (paymentData?.checkoutUrl && userMsg.startsWith("Thanh toán")) {
        window.open(paymentData.checkoutUrl, "_blank");
        return;
      }

      await sendToAI(userMsg);
    },
    [input, sendToAI, paymentData]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply) => {
    if (paymentData?.checkoutUrl && reply === "Mở PayOS 💳") {
      window.open(paymentData.checkoutUrl, "_blank");
      return;
    }
    if (paymentData && reply === "Kiểm tra thanh toán 🔄") {
      sendToAI("Kiểm tra thanh toán");
      return;
    }
    handleSend(reply);
  };

  const formatText = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
        .replace(/~~(.*?)~~/g, '<span class="line-through text-muted-foreground">$1</span>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  const renderPaymentData = (data) => {
    if (!data) return null;
    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs text-muted-foreground space-y-1">
          {data.amount && (
            <p>💰 Số tiền: <strong className="text-foreground">{(data.amount || data.totalAmount || 0).toLocaleString("vi-VN")}đ</strong></p>
          )}
          {data.booking_code && <p>📄 Mã đơn: {data.booking_code}</p>}
          {data.seatCodes?.length > 0 && <p>🎟️ Ghế: {data.seatCodes.join(", ")}</p>}
          {data.checkoutUrl && (
            <a
              href={data.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full text-center px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5 inline mr-1" />
              Mở PayOS thanh toán 💳
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center group",
          isOpen
            ? "bg-card border border-border rotate-0"
            : "bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[400px] max-h-[calc(100vh-140px)] sm:max-h-[600px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm sm:text-base">CineX AI</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-[10px] sm:text-xs">
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 sm:gap-2.5 animate-enter",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "bot" && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  <div>{formatText(msg.text)}</div>
                  {msg.role === "bot" && msg.currentStep === "PAYMENT_PENDING" && msg.data && renderPaymentData(msg.data)}

                  {msg.role === "bot" && msg.currentStep === "COMPLETED" && msg.data?.ticketCode && (
                    <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-emerald-400 font-bold text-xs">🎉 ĐẶT VÉ THÀNH CÔNG!</p>
                      <p className="text-xs text-muted-foreground mt-1">Mã vé: <strong className="text-foreground">{msg.data.ticketCode}</strong></p>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2.5 animate-enter">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {!isTyping && messages.length > 0 && (() => {
              const lastBot = [...messages].reverse().find(
                (m) => m.role === "bot" && m.quickReplies?.length > 0
              );
              if (!lastBot || lastBot.id !== messages[messages.length - 1]?.id) return null;
              const steps = lastBot.currentStep;
              const isPayment = steps === "PAYMENT_PENDING" && paymentData;
              const isCompleted = steps === "COMPLETED";

              return (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 animate-enter">
                  {isPayment && paymentData?.checkoutUrl && (
                    <button
                      onClick={() => window.open(paymentData.checkoutUrl, "_blank")}
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold hover:from-emerald-600 hover:to-green-600 transition-all flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Mở PayOS 💳
                    </button>
                  )}
                  {isPayment && (
                    <button
                      onClick={() => sendToAI("Kiểm tra thanh toán")}
                      className="px-3 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Kiểm tra 🔄
                    </button>
                  )}
                  {!isCompleted && lastBot.quickReplies.map((reply, idx) => {
                    if (reply.includes("✅") || reply.includes("📅") || reply.includes("📍")) return null;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] sm:text-xs font-medium hover:bg-purple-500/20 transition-colors max-w-full truncate"
                      >
                        {reply}
                      </button>
                    );
                  })}
                  {isCompleted && (
                    <button
                      onClick={() => { setMessages([]); setConversationId(null); setPaymentData(null); setIsOpen(false); }}
                      className="px-3 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all"
                    >
                      Đặt vé mới 🎬
                    </button>
                  )}
                </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 sm:p-4 border-t border-border shrink-0">
            <div className="flex gap-2 sm:gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={paymentData ? "Kiểm tra thanh toán..." : "Nhập tin nhắn..."}
                className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-muted border border-border text-foreground text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all min-w-0"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={cn(
                  "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  input.trim()
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
