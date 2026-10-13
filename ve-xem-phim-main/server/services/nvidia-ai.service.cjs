require('dotenv').config();

const NVIDIA_API_URL = process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY || '';
const NVIDIA_TIMEOUT_MS = Math.max(5000, Number(process.env.NVIDIA_TIMEOUT_MS) || 45000);

const ALLOWED_INTENTS = new Set([
  'GREETING', 'HELP', 'LIST_MOVIES', 'RECOMMEND_MOVIES', 'SELECT_MOVIE',
  'SET_LOCATION', 'SELECT_CINEMA', 'SELECT_DATE', 'SELECT_SHOWTIME',
  'SELECT_SEATS', 'CONFIRM_BOOKING', 'CHECK_PAYMENT', 'CHANGE_MOVIE',
  'CHANGE_CINEMA', 'CHANGE_DATE', 'CHANGE_SHOWTIME', 'GENERAL_CHAT', 'UNKNOWN',
]);

function extractJson(content) {
  if (!content || typeof content !== 'string') return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeAnalysis(parsed) {
  if (!parsed || !ALLOWED_INTENTS.has(parsed.intent)) return null;
  const entities = parsed.entities && typeof parsed.entities === 'object' ? parsed.entities : {};
  return {
    intent: parsed.intent,
    entities: {
      movieName: typeof entities.movieName === 'string' ? entities.movieName.slice(0, 120) : null,
      location: typeof entities.location === 'string' ? entities.location.slice(0, 160) : null,
      cinemaName: typeof entities.cinemaName === 'string' ? entities.cinemaName.slice(0, 160) : null,
      date: typeof entities.date === 'string' ? entities.date.slice(0, 20) : null,
      showtime: typeof entities.showtime === 'string' ? entities.showtime.slice(0, 20) : null,
      seatCodes: Array.isArray(entities.seatCodes)
        ? entities.seatCodes.filter(code => typeof code === 'string').slice(0, 12)
        : [],
      genres: Array.isArray(entities.genres)
        ? entities.genres.filter(genre => typeof genre === 'string').map(genre => genre.slice(0, 60)).slice(0, 5)
        : [],
    },
    reply: typeof parsed.reply === 'string' ? parsed.reply.slice(0, 3000) : '',
  };
}

function compactGroundedValue(value, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === 'string') return value.slice(0, 600);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => compactGroundedValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [
      key,
      compactGroundedValue(item, depth + 1),
    ]));
  }
  return null;
}

const NvidiaAIService = {
  isConfigured() {
    return Boolean(NVIDIA_API_KEY);
  },

  getModel() {
    return NVIDIA_MODEL;
  },

  async generateGroundedReply({ message, intent, state, verifiedMessage, verifiedData, history = [] }) {
    if (!this.isConfigured()) return null;

    const systemPrompt = `Bạn là Trần Dương AI, trợ lý của CineX. Hãy trả lời tự nhiên, thân thiện và ngắn gọn bằng tiếng Việt.
Bạn chỉ được sử dụng sự thật trong VERIFIED_MESSAGE và VERIFIED_DATA do hệ thống CineX cung cấp.
Không thêm tên phim, rạp, thời lượng, giá, ngày, giờ chiếu, khuyến mãi hay số lượng ngoài dữ liệu đã xác minh.
Nếu dữ liệu nói không tìm thấy hoặc còn thiếu thông tin, phải nói đúng điều đó và hỏi đúng trường còn thiếu.
Không được chuyển sang giới thiệu phim khác trừ khi VERIFIED_DATA có danh sách phim đó.
Phân biệt phim đang thảo luận với phim đang đặt vé. Không tuyên bố đã đổi phim đặt vé nếu VERIFIED_DATA.isDifferentFromBooking là true; phải nói rõ người dùng cần chọn thao tác đổi/đặt phim mới.
Giữ nguyên các con số, tên riêng, mã và đường dẫn. Có thể dùng Markdown đơn giản.
Chỉ trả về nội dung trả lời cho người dùng, không JSON, không giải thích quy trình nội bộ.`;
    const recentHistory = history.slice(-6).map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').slice(0, 800),
    }));
    const payload = {
      model: NVIDIA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        {
          role: 'user',
          content: `USER_MESSAGE:\n${String(message || '').slice(0, 1200)}\n\nINTENT:\n${intent}\n\nSTATE:\n${JSON.stringify(state || {})}\n\nVERIFIED_MESSAGE:\n${String(verifiedMessage || '').slice(0, 5000)}\n\nVERIFIED_DATA:\n${JSON.stringify(compactGroundedValue(verifiedData))}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
      stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NVIDIA_TIMEOUT_MS);
    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`NVIDIA NIM trả về HTTP ${response.status}`);
      const data = await response.json();
      return typeof data.choices?.[0]?.message?.content === 'string'
        ? data.choices[0].message.content.trim().slice(0, 5000)
        : null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async analyzeMessage({ message, state, context = {}, history = [] }) {
    if (!this.isConfigured()) return null;

    const systemPrompt = `Bạn là Trần Dương AI, trợ lý điện ảnh và đặt vé của CineX bằng tiếng Việt.
Nhiệm vụ của bạn là hiểu câu nói tự nhiên, chọn đúng intent và trò chuyện thân thiện.
Mọi dữ liệu phim, rạp, suất chiếu, ghế, giá và thanh toán phải dựa trên CONTEXT; không được bịa.
Chỉ được nhắc tên phim có trong CONTEXT.movieCatalog hoặc CONTEXT.focusedMovie. Nếu phim không có trong CONTEXT, nói rõ CineX chưa có phim đó.
Không được tự tạo giờ chiếu. Chỉ trả lời giờ chiếu khi CONTEXT.showtimes có dữ liệu; nếu thiếu phim, rạp hoặc ngày thì yêu cầu người dùng cung cấp thông tin còn thiếu.
Không được tự đoán thời lượng phim. Chỉ sử dụng trường duration trong CONTEXT.focusedMovie.
Các thao tác đặt vé sẽ do hệ thống thực hiện sau khi bạn chọn intent. Không tuyên bố đã giữ ghế, tạo đơn hay thanh toán nếu hệ thống chưa xác nhận.

Intent hợp lệ:
GREETING, HELP, LIST_MOVIES, RECOMMEND_MOVIES, SELECT_MOVIE, SET_LOCATION,
SELECT_CINEMA, SELECT_DATE, SELECT_SHOWTIME, SELECT_SEATS, CONFIRM_BOOKING,
CHECK_PAYMENT, CHANGE_MOVIE, CHANGE_CINEMA, CHANGE_DATE, CHANGE_SHOWTIME,
GENERAL_CHAT, UNKNOWN.

Quy tắc:
- Dựa vào currentStep để hiểu câu ngắn như "1", "hôm nay", "Beta Tây Sơn", "A01 A02", "xác nhận".
- Nếu người dùng hỏi kiến thức, nội dung hoặc muốn trò chuyện về phim, dùng GENERAL_CHAT và viết câu trả lời tự nhiên trong reply.
- Nếu hỏi giới thiệu/gợi ý phim có thể đặt, dùng RECOMMEND_MOVIES.
- Với RECOMMEND_MOVIES, đưa các thể loại người dùng nói rõ vào entities.genres. Không tự suy đoán thêm thể loại.
- Nếu muốn xem danh sách phim, dùng LIST_MOVIES.
- Nếu người dùng hỏi lịch/giờ/suất chiếu nhưng CONTEXT chưa có showtimes, không suy đoán giờ và không chuyển sang nói về phim khác.
- Chuẩn hóa ngày thành YYYY-MM-DD khi đủ thông tin. Ngày hiện tại là ${new Date().toISOString().slice(0, 10)}.
- Với intent thao tác, reply có thể để trống.
- Chỉ trả về đúng một JSON object, không markdown, theo mẫu:
{"intent":"GENERAL_CHAT","entities":{"movieName":null,"location":null,"cinemaName":null,"date":null,"showtime":null,"seatCodes":[],"genres":[]},"reply":"..."}`;

    const recentHistory = history.slice(-8).map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').slice(0, 1200),
    }));

    const payload = {
      model: NVIDIA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        {
          role: 'user',
          content: `STATE:\n${JSON.stringify(state)}\n\nCONTEXT:\n${JSON.stringify(context)}\n\nUSER_MESSAGE:\n${message}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
      stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NVIDIA_TIMEOUT_MS);
    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(`NVIDIA NIM trả về HTTP ${response.status}`), {
          code: 'NVIDIA_API_ERROR',
          status: response.status,
          detail: errorBody.slice(0, 300),
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const analysis = sanitizeAnalysis(extractJson(content));
      if (!analysis) throw Object.assign(new Error('NVIDIA NIM trả về dữ liệu không hợp lệ'), { code: 'NVIDIA_INVALID_RESPONSE' });
      return analysis;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  _extractJson: extractJson,
  _sanitizeAnalysis: sanitizeAnalysis,
  _compactGroundedValue: compactGroundedValue,
};

module.exports = NvidiaAIService;
