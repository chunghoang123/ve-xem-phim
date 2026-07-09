import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, Bot, User, Sparkles, Film } from "lucide-react";
import { movies, cinemas } from "../data/mockData";
import { cn } from "../lib/utils";

const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY;

if (!NVIDIA_API_KEY) {
  console.warn("VITE_NVIDIA_API_KEY not found in .env. Chatbot will use fallback mode.");
}

const API_URL = "/api/ai/chat";
const MODEL = "meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `Bạn là CineX AI, trợ lý đặt vé xem phim thông minh của hệ thống rạp CineX.

THÔNG TIN PHIM HIỆN TẠI:
${movies.map((m) => `- [ID:${m.id}] ${m.title} - ${m.genre} - ${m.duration}ph - ${m.rating} - ${m.ticketPrice.toLocaleString("vi-VN")}đ / VIP: ${m.vipPrice.toLocaleString("vi-VN")}đ
  Diễn viên: ${m.cast}
  Mô tả: ${m.description}`).join("\n")}

LỊCH CHIẾU THEO PHIM:
${movies.map((m) => `${m.title}:\n${m.showtimes.map((s) => `  - ${s.date}: ${s.times.join(", ")}`).join("\n")}`).join("\n")}

HỆ THỐNG RẠP:
${cinemas.map((c) => `- ${c.name}: ${c.address}`).join("\n")}

KHUYẾN MÃI HIỆN TẠI:
- TUE50: Giảm 50% vé thứ 3 hàng tuần
- COMBO2: Combo 2 vé + bắp nước miễn phí
- VIP30: Thành viên VIP giảm 30%
- BUY3GET1: Mua 3 tặng 1

QUY TẮC:
1. Trả lời bằng tiếng Việt, thân thiện, dùng emoji 🎬🎫📅🎉📍👋
2. Khi nói về phim cụ thể, LUÔN kèm tên phim đầy đủ để người dùng biết chính xác
3. Cung cấp suất chiếu theo ngày đầy đủ
4. Luôn hỏi lại để giúp người dùng đặt vé
5. Giữ câu trả lời ngắn gọn, dễ đọc, xuống dòng hợp lý`;

function extractMovieId(text) {
  for (const movie of movies) {
    if (text.toLowerCase().includes(movie.title.toLowerCase())) {
      return movie.id;
    }
  }
  return null;
}

function getDefaultQuickReplies(text) {
  if (/phim|chiếu|suất/i.test(text)) {
    return ["Đặt vé ngay", "Khuyến mãi", "Rạp CineX"];
  }
  if (/đặt|vé|book|mua/i.test(text)) {
    return ["Phim đang chiếu", "Lịch chiếu hôm nay", "Khuyến mãi"];
  }
  if (/khuyến mãi|giảm giá|ưu đãi/i.test(text)) {
    return ["Đặt vé ngay", "Phim đang chiếu"];
  }
  if (/rạp|cinema|địa chỉ|ở đâu/i.test(text)) {
    return ["Phim đang chiếu", "Đặt vé nhanh"];
  }
  return ["Phim đang chiếu", "Đặt vé nhanh", "Khuyến mãi", "Lịch chiếu hôm nay"];
}

async function callNvidiaAI(conversation) {
  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversation.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
  ];

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  const movieId = extractMovieId(text);
  const quickReplies = getDefaultQuickReplies(text);

  return { text, movieId, quickReplies };
}

function getBotReply(message) {
  const list = movies.slice(0, 5).map((m, i) => `${i + 1}. ${m.title} - ${m.genre}`).join("\n");
  return {
    text: `Đây là các phim đang chiếu tại CineX:\n\n${list}\n\nBạn muốn đặt vé phim nào?`,
    quickReplies: movies.slice(0, 3).map((m) => m.title),
  };
}

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      text: "Xin chào! 👋 Mình là CineX AI, trợ lý đặt vé thông minh. Bạn muốn xem phim gì hôm nay?",
      quickReplies: ["Phim đang chiếu", "Đặt vé nhanh", "Khuyến mãi"],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;

    const newUserMsg = { id: Date.now(), role: "user", text: userMsg };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setIsTyping(true);

    if (!NVIDIA_API_KEY) {
      setTimeout(() => {
        const reply = getBotReply(userMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "bot",
            text: reply.text,
            quickReplies: reply.quickReplies,
          },
        ]);
        setIsTyping(false);
      }, 600 + Math.random() * 800);
      return;
    }

    try {
      const convHistory = [...messages, newUserMsg];
      const reply = await callNvidiaAI(convHistory);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: reply.text,
          quickReplies: reply.quickReplies,
          movieId: reply.movieId,
          action: reply.movieId
            ? () => navigate(`/movies/${reply.movieId}`)
            : null,
        },
      ]);
    } catch (err) {
      console.error("NVIDIA API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: "Xin lỗi, mình đang gặp sự cố kết nối. Vui lòng thử lại sau! 😔",
          quickReplies: ["Phim đang chiếu", "Đặt vé nhanh", "Khuyến mãi"],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatText = (text) => {
    return text.split("\n").map((line, i) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
        .replace(/🎬|🎫|📅|🎉|📍|👋/g, '<span class="text-base">$&</span>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
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
                  {NVIDIA_API_KEY ? "NVIDIA AI · Đang hoạt động" : "Đang hoạt động"}
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
                    "max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  <div>{formatText(msg.text)}</div>
                  {msg.action && (
                    <button
                      onClick={msg.action}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/30 transition-colors"
                    >
                      <Film className="w-3 h-3 inline mr-1" />
                      Xem phim →
                    </button>
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
              const lastBot = [...messages].reverse().find((m) => m.role === "bot" && m.quickReplies);
              if (!lastBot || lastBot.id !== messages[messages.length - 1]?.id) return null;
              return (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 animate-enter">
                  {lastBot.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => handleSend(reply)}
                      className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] sm:text-xs font-medium hover:bg-purple-500/20 transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
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
                placeholder="Nhập tin nhắn..."
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
