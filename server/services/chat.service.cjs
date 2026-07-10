const ConversationModel = require('../models/conversation.model.cjs');
const MovieModel = require('../models/movie.model.cjs');
const CinemaModel = require('../models/cinema.model.cjs');
const ShowtimeModel = require('../models/showtime.model.cjs');
const SeatModel = require('../models/seat.model.cjs');
const SeatHoldModel = require('../models/seatHold.model.cjs');
const BookingService = require('./booking.service.cjs');
const PaymentService = require('./payment.service.cjs');

const STEPS = {
  SELECT_MOVIE: 'SELECT_MOVIE',
  SELECT_LOCATION: 'SELECT_LOCATION',
  SELECT_CINEMA: 'SELECT_CINEMA',
  SELECT_DATE: 'SELECT_DATE',
  SELECT_SHOWTIME: 'SELECT_SHOWTIME',
  SELECT_SEAT: 'SELECT_SEAT',
  REVIEW_BILL: 'REVIEW_BILL',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  COMPLETED: 'COMPLETED',
};

const ChatService = {
  async processMessage({ conversationId, message, userId, latitude, longitude }) {
    await ConversationModel.ensureTable();

    const conv = await ConversationModel.getOrCreate(conversationId, userId);
    if (userId && conv.user_id !== userId) {
      await ConversationModel.updateState(conv.conversation_id, { userId });
    }

    const state = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : (conv.state_data || {});
    const normalized = message.trim().toLowerCase();
    const intent = this.detectIntent(normalized, state);

    switch (intent) {
      case 'LIST_MOVIES': return await this.handleListMovies(conv, state);
      case 'SELECT_MOVIE': return await this.handleSelectMovie(conv, state, message);
      case 'SET_LOCATION': return await this.handleSetLocation(conv, state, message, latitude, longitude);
      case 'SELECT_CINEMA': return await this.handleSelectCinema(conv, state, message);
      case 'SELECT_DATE': return await this.handleSelectDate(conv, state, message);
      case 'SELECT_SHOWTIME': return await this.handleSelectShowtime(conv, state, message);
      case 'SELECT_SEATS': return await this.handleSelectSeats(conv, state, message, userId);
      case 'CONFIRM_BOOKING': return await this.handleConfirmBooking(conv, state, userId);
      case 'CHECK_PAYMENT': return await this.handleCheckPayment(conv, state, userId);
      case 'CHANGE_MOVIE': return await this.handleChangeMovie(conv, state);
      case 'CHANGE_CINEMA': return await this.handleChangeCinema(conv, state);
      case 'CHANGE_DATE': return await this.handleChangeDate(conv, state);
      case 'CHANGE_SHOWTIME': return await this.handleChangeShowtime(conv, state);
      case 'HELP': return this.helpResponse(conv);
      case 'GREETING': return this.greetingResponse(conv);
      default: return await this.handleUnknown(conv, state, message);
    }
  },

  detectIntent(text, state) {
    if (/xin chào|chào|hello|hi|hey|hí/i.test(text)) return 'GREETING';
    if (/giúp|hỗ trợ|có thể/i.test(text) && !/đặt|vé|mua/i.test(text)) return 'HELP';

    if (/đổi phim|phim khác|chọn phim khác/i.test(text)) return 'CHANGE_MOVIE';
    if (/đổi rạp|rạp khác|chọn rạp khác/i.test(text)) return 'CHANGE_CINEMA';
    if (/đổi ngày|ngày khác|chọn ngày khác/i.test(text)) return 'CHANGE_DATE';
    if (/đổi suất|suất khác|chọn suất khác|đổi giờ|giờ khác/i.test(text)) return 'CHANGE_SHOWTIME';

    if (state.currentStep === STEPS.PAYMENT_PENDING && state.paymentCode) {
      if (/kiểm tra|check|đã chuyển|đã thanh toán/i.test(text)) return 'CHECK_PAYMENT';
    }

    if (/có phim|phim đang chiếu|phim hay|chiếu gì|danh sách phim|xem phim/i.test(text)) return 'LIST_MOVIES';

    if (state.currentStep === STEPS.SELECT_MOVIE || (!state.movieId && !state.movieName)) {
      if (this.extractMovieName(text)) return 'SELECT_MOVIE';
    }

    if (/đặt vé|đặt|mua vé|book|tôi muốn|cho tôi/i.test(text) && !state.movieId) return 'LIST_MOVIES';

    if (!state.location && !state.latitude) {
      if (/\bở\b|\btại\b|\bđịa chỉ\b|\bquận\b|\bhuyện\b|\btỉnh\b|\bthành phố\b|\bphường\b|\bxa\b/i.test(text)) return 'SET_LOCATION';
      const places = ['cầu giấy', 'đống đa', 'hai bà trưng', 'thanh xuân', 'hoàn kiếm', 'hà nội', 'hcm', 'sài gòn', 'hồ chí minh', 'đà nẵng', 'hải phòng', 'cần thơ', 'biên hòa', 'nha trang', 'huế', 'vũng tàu', 'đà lạt'];
      if (places.some(p => text.includes(p))) return 'SET_LOCATION';
    }

    if (state.movieId && state.currentStep === STEPS.SELECT_CINEMA && !state.cinemaId) {
      if (text.match(/(\d+)/) || ['cgv', 'lotte', 'bhd', 'beta', 'galaxy', 'cinestar'].some(k => text.includes(k))) return 'SELECT_CINEMA';
    }

    if (state.movieId && state.cinemaId && state.currentStep === STEPS.SELECT_DATE && !state.showDate) {
      if (text.includes('hôm nay') || text.includes('ngày mai') || /\d/.test(text)) return 'SELECT_DATE';
    }

    if (state.movieId && state.cinemaId && state.showDate && state.currentStep === STEPS.SELECT_SHOWTIME && !state.showtimeId) {
      if (text.match(/(\d{1,2})[h:.]?(\d{2})?/) || text.match(/(\d+)/)) return 'SELECT_SHOWTIME';
    }

    if (state.showtimeId && state.currentStep === STEPS.SELECT_SEAT && state.seatIds.length === 0) {
      if (/(\d+\s*ghế|\d+\s*vé)/i.test(text) || text.includes(',') || /[A-H]\d{1,2}/i.test(text)) return 'SELECT_SEATS';
    }

    if (state.holdCode && state.currentStep === STEPS.REVIEW_BILL) {
      if (/xác nhận|đồng ý|ok|oka|yes|đặt|thanh toán|tiến hành/i.test(text)) return 'CONFIRM_BOOKING';
    }

    return 'UNKNOWN';
  },

  extractMovieName(text) {
    const movieMatch = text.match(/(?:phim\s+|xem\s+|đặt\s+)?["“]?([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\s]{2,30})["”]?/i);
    return movieMatch ? movieMatch[1].trim() : null;
  },

  extractLocation(text) {
    const known = ['hà nội', 'hồ chí minh', 'sài gòn', 'đà nẵng', 'hải phòng', 'cần thơ', 'biên hòa', 'nha trang', 'huế', 'vũng tàu', 'đà lạt', 'cầu giấy', 'đống đa', 'thanh xuân', 'hoàn kiếm', 'hai bà trưng', 'nam từ liêm', 'bắc từ liêm', 'hà đông', 'long biên', 'hoàng mai'];
    for (const place of known) {
      if (text.toLowerCase().includes(place)) return place;
    }
    return null;
  },

  extractDate(text) {
    const today = new Date();
    if (/hôm nay|tối nay/i.test(text)) return today.toISOString().split('T')[0];
    if (/ngày mai/i.test(text)) {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    const match1 = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match1) return `${match1[1]}-${match1[2]}-${match1[3]}`;
    const match2 = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (match2 && match2[3]) {
      return `${match2[3]}-${match2[2].padStart(2, '0')}-${match2[1].padStart(2, '0')}`;
    }
    return null;
  },

  async handleListMovies(conv, _state) {
    const movies = await MovieModel.findAll({ limit: 20, sort_by: 'popularity', sort_order: 'DESC' });
    const list = movies.rows || [];
    return {
      conversationId: conv.conversation_id,
      message: this.formatMovieList(list),
      currentStep: conv.current_step,
      data: { movies: list.map(m => this.sanitizeMovie(m)) },
      missingField: 'movieId',
      suggestedActions: list.slice(0, 5).map(m => ({
        type: 'SELECT_MOVIE', label: m.title, value: m.id,
      })),
    };
  },

  formatMovieList(movies) {
    if (!movies.length) return 'Hiện tại chưa có phim nào đang chiếu. Bạn quay lại sau nhé! 😊';
    let text = '🎬 **Phim đang chiếu tại CineX:**\n\n';
    movies.slice(0, 8).forEach((m, i) => {
      text += `${i + 1}. **${m.title}**`;
      if (m.genre) text += ` | ${m.genre}`;
      text += ` | ⏱ ${m.duration}ph`;
      if (m.ticket_price) text += ` | 💰 ${Number(m.ticket_price).toLocaleString('vi-VN')}đ`;
      text += '\n';
    });
    text += '\nBạn muốn xem phim nào? Vui lòng ghi tên phim! 🎫';
    return text;
  },

  async handleSelectMovie(conv, state, message) {
    const movieName = this.extractMovieName(message) || message.replace(/^(tôi muốn xem|tôi chọn|phim|cho tôi|đặt|mua vé|xem)\s+/i, '').trim();
    const movies = await MovieModel.findAll({ limit: 50 });
    const movieList = movies.rows || [];
    const matched = movieList.find(m => m.title.toLowerCase().includes(movieName.toLowerCase()))
      || movieList.find(m => movieName.toLowerCase().includes(m.title.toLowerCase().split(' ').slice(0, 2).join(' ').toLowerCase()));

    if (!matched) {
      return {
        conversationId: conv.conversation_id,
        message: `Mình không tìm thấy phim "${movieName}" 😔\n\n${this.formatMovieList(movieList)}`,
        currentStep: conv.current_step,
        data: { movies: movieList.map(m => this.sanitizeMovie(m)) },
        missingField: 'movieId',
        suggestedActions: movieList.slice(0, 5).map(m => ({ type: 'SELECT_MOVIE', label: m.title, value: m.id })),
      };
    }

    await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_LOCATION, {
      movieId: matched.id, movieName: matched.title,
    });

    const price = matched.ticket_price ? `${Number(matched.ticket_price).toLocaleString('vi-VN')}đ` : 'Liên hệ';
    let detail = `🎬 **${matched.title}**\n\n`;
    if (matched.genre) detail += `🏷️ Thể loại: ${matched.genre}\n`;
    detail += `⏱ Thời lượng: ${matched.duration} phút\n`;
    if (matched.rating) detail += `⭐ Điểm: ${matched.rating}\n`;
    if (matched.age_rating) detail += `🔞 Độ tuổi: ${matched.age_rating}\n`;
    if (matched.language) detail += `🌐 Ngôn ngữ: ${matched.language}\n`;
    if (matched.release_date) detail += `📅 Khởi chiếu: ${new Date(matched.release_date).toLocaleDateString('vi-VN')}\n`;
    if (matched.description) detail += `\n📖 ${matched.description.slice(0, 200)}...\n`;
    detail += `\n💲 Giá vé: ${price}\n\n`;
    detail += `Bạn muốn xem ở khu vực nào? (Ví dụ: "Cầu Giấy, Hà Nội" hoặc "Quận 1, HCM") 📍`;

    return {
      conversationId: conv.conversation_id,
      message: detail,
      currentStep: STEPS.SELECT_LOCATION,
      data: { movie: this.sanitizeMovie(matched) },
      missingField: 'location',
      suggestedActions: [
        { type: 'SET_LOCATION', label: 'Hà Nội', value: 'Hà Nội' },
        { type: 'SET_LOCATION', label: 'TP. Hồ Chí Minh', value: 'Hồ Chí Minh' },
        { type: 'SET_LOCATION', label: 'Đà Nẵng', value: 'Đà Nẵng' },
      ],
    };
  },

  async handleSetLocation(conv, state, message, lat, lng) {
    const location = this.extractLocation(message) || message.replace(/^(ở|tại|gần)\s+/i, '').trim() || 'Hà Nội';

    await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_CINEMA, {
      location, latitude: lat || null, longitude: lng || null,
    });

    const cinemas = await CinemaModel.findAll({ limit: 50 });
    const cinemaList = (cinemas.rows || cinemas || []);
    const locLower = location.toLowerCase();

    let filtered = cinemaList.filter(c =>
      (c.city && c.city.toLowerCase().includes(locLower)) ||
      (c.district && c.district.toLowerCase().includes(locLower)) ||
      (c.address && c.address.toLowerCase().includes(locLower))
    );
    if (filtered.length === 0) filtered = cinemaList.slice(0, 10);

    let text = `📍 Các rạp gần **${location}**:\n\n`;
    filtered.slice(0, 8).forEach((c, i) => {
      text += `${i + 1}. **${c.name}**\n`;
      if (c.address) text += `   📌 ${c.address}\n`;
      if (c.district && c.city) text += `   🏙️ ${c.district}, ${c.city}\n`;
      if (c.brand) text += `   🏢 ${c.brand}\n`;
      text += '\n';
    });
    text += 'Bạn muốn chọn rạp nào? (Ghi tên rạp hoặc số thứ tự) 🎯';

    return {
      conversationId: conv.conversation_id,
      message: text,
      currentStep: STEPS.SELECT_CINEMA,
      data: { cinemas: filtered.slice(0, 8).map(c => this.sanitizeCinema(c)) },
      missingField: 'cinemaId',
      suggestedActions: filtered.slice(0, 5).map(c => ({
        type: 'SELECT_CINEMA', label: c.name, value: c.id,
      })),
    };
  },

  async handleSelectCinema(conv, state, message) {
    const cinemas = await CinemaModel.findAll({ limit: 50 });
    const cinemaList = (cinemas.rows || cinemas || []);

    let matched = null;
    const numMatch = message.match(/(\d+)/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      const filtered = cinemaList.filter(c =>
        (c.city && c.city.toLowerCase().includes((state.location || '').toLowerCase())) ||
        (c.district && c.district.toLowerCase().includes((state.location || '').toLowerCase()))
      );
      if (idx >= 0 && idx < filtered.length) matched = filtered[idx];
    }
    if (!matched) {
      matched = cinemaList.find(c =>
        c.name.toLowerCase().includes(message.toLowerCase()) ||
        message.toLowerCase().includes(c.name.toLowerCase().split(' ').slice(0, 2).join(' '))
      );
    }
    if (!matched) matched = cinemaList[0];
    if (!matched) {
      return {
        conversationId: conv.conversation_id,
        message: 'Mình không tìm thấy rạp phù hợp. Bạn vui lòng thử lại! 😔',
        currentStep: conv.current_step,
        data: null, missingField: 'cinemaId', suggestedActions: [],
      };
    }

    await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_DATE, {
      cinemaId: matched.id, cinemaName: matched.name,
    });

    const showtimes = await ShowtimeModel.findAll({ movie_id: state.movieId, cinema_id: matched.id, limit: 50 });
    const dates = [...new Set((showtimes.rows || []).map(s => s.date).filter(Boolean))].sort();

    let text = `✅ Bạn đã chọn **${matched.name}**\n\n`;
    if (dates.length > 0) {
      text += '📅 Các ngày có suất chiếu:\n';
      dates.slice(0, 7).forEach(d => {
        text += `   • ${new Date(d).toLocaleDateString('vi-VN')}\n`;
      });
    }
    text += '\nBạn muốn xem vào ngày nào? (Ví dụ: "hôm nay", "ngày mai") 📅';

    return {
      conversationId: conv.conversation_id,
      message: text,
      currentStep: STEPS.SELECT_DATE,
      data: { cinema: this.sanitizeCinema(matched), dates },
      missingField: 'showDate',
      suggestedActions: [
        { type: 'SELECT_DATE', label: 'Hôm nay', value: new Date().toISOString().split('T')[0] },
        { type: 'SELECT_DATE', label: 'Ngày mai', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
      ],
    };
  },

  async handleSelectDate(conv, state, message) {
    const date = this.extractDate(message) || new Date().toISOString().split('T')[0];
    await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SHOWTIME, { showDate: date });
    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, date);
  },

  async handleSelectShowtime(conv, state, message) {
    const date = state.showDate || new Date().toISOString().split('T')[0];
    const time = message.match(/(\d{1,2})[h:.]?(\d{2})?/);
    if (time) {
      const showtimes = await ShowtimeModel.findAll({ movie_id: state.movieId, cinema_id: state.cinemaId, date, limit: 50 });
      const list = (showtimes.rows || []).filter(s => s.time && s.time.startsWith(time[1].padStart(2, '0')));
      if (list.length > 0) {
        const selected = list[0];
        await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SEAT, { showtimeId: selected.id, showtimeInfo: selected });
        return await this.handleSelectShowtimeById(conv.conversation_id, selected.id);
      }
    }
    const numMatch = message.match(/(\d+)/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      const showtimes = await ShowtimeModel.findAll({ movie_id: state.movieId, cinema_id: state.cinemaId, date, limit: 50 });
      const now = new Date();
      const list = (showtimes.rows || []).filter(s => new Date(`${s.date}T${s.time}`) > now);
      if (idx >= 0 && idx < list.length) {
        await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SEAT, { showtimeId: list[idx].id, showtimeInfo: list[idx] });
        return await this.handleSelectShowtimeById(conv.conversation_id, list[idx].id);
      }
    }
    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, date);
  },

  async handleSelectTimeList(conversationId, movieId, cinemaId, date) {
    const showtimes = await ShowtimeModel.findAll({ movie_id: movieId, cinema_id: cinemaId, date, limit: 50 });
    const now = new Date();
    const list = (showtimes.rows || []).filter(s => new Date(`${s.date || date}T${s.time}`) > now);

    if (list.length === 0) {
      const all = await ShowtimeModel.findAll({ movie_id: movieId, cinema_id: cinemaId, limit: 50 });
      const dates = [...new Set((all.rows || []).map(s => s.date).filter(Boolean))].sort();
      const nextDate = dates.find(d => d > date) || dates[0];
      if (nextDate) {
        return {
          conversationId,
          message: `Ngày ${new Date(date).toLocaleDateString('vi-VN')} không còn suất chiếu. Bạn muốn chọn ngày khác? 📅\n\nGợi ý: ${new Date(nextDate).toLocaleDateString('vi-VN')}`,
          currentStep: STEPS.SELECT_DATE,
          data: { dates }, missingField: 'showDate',
          suggestedActions: dates.slice(0, 5).map(d => ({ type: 'SELECT_DATE', label: new Date(d).toLocaleDateString('vi-VN'), value: d })),
        };
      }
      return { conversationId, message: 'Xin lỗi, không còn suất chiếu nào cho ngày này 😔', currentStep: STEPS.SELECT_DATE, data: null, missingField: 'showDate', suggestedActions: [] };
    }

    let text = `📅 **${new Date(date).toLocaleDateString('vi-VN')}** - Suất chiếu:\n\n`;
    list.slice(0, 8).forEach((s, i) => {
      text += `${i + 1}. 🕐 **${s.time}**`;
      if (s.cinema_name) text += ` - ${s.cinema_name}`;
      text += ` | 💰 ${(s.ticket_price || s.price || 0).toLocaleString('vi-VN')}đ`;
      if (s.screen_name) text += ` | 🏠 ${s.screen_name}`;
      if (s.format) text += ` | ${s.format}`;
      text += '\n';
    });
    text += '\nBạn muốn chọn suất nào? (Ghi giờ hoặc số thứ tự) 🎯';

    return {
      conversationId,
      message: text,
      currentStep: STEPS.SELECT_SHOWTIME,
      data: { showtimes: list.slice(0, 8).map(s => this.sanitizeShowtime(s)) },
      missingField: 'showtimeId',
      suggestedActions: list.slice(0, 5).map(s => ({ type: 'SELECT_SHOWTIME', label: `${s.time}`, value: s.id })),
    };
  },

  async handleSelectShowtimeById(conversationId, showtimeId) {
    const showtime = await ShowtimeModel.findById(showtimeId);
    if (!showtime) return null;

    const seatResult = await SeatModel.getLayout(showtimeId);
    const seats = seatResult || [];
    const rows = {};
    let availCount = 0;
    seats.forEach(s => {
      if (!rows[s.row_label]) rows[s.row_label] = [];
      rows[s.row_label].push(s);
      if (!s.is_booked) availCount++;
    });

    let text = `🎬 **${showtime.movie_title}** | 🕐 ${showtime.time}\n`;
    text += `💰 ${(showtime.ticket_price || 0).toLocaleString('vi-VN')}đ\n\n`;
    text += '**Sơ đồ ghế:** (_trống_, ~~đã đặt~~)\n```\n';
    Object.keys(rows).sort().forEach(row => {
      text += `${row}: `;
      rows[row].sort((a, b) => a.seat_number - b.seat_number).forEach(s => {
        text += s.is_booked ? `~~${s.row_label}${String(s.seat_number).padStart(2, '0')}~~ ` : `${s.row_label}${String(s.seat_number).padStart(2, '0')} `;
      });
      text += '\n';
    });
    text += '```\n';
    text += `✅ Còn **${availCount}** ghế trống.\n`;
    text += '\nBạn muốn chọn ghế nào? Ghi mã ghế, VD: "E05, E06" 🎯';

    return {
      conversationId,
      message: text,
      currentStep: STEPS.SELECT_SEAT,
      data: {
        seats: seats.map(s => ({
          id: s.id, code: `${s.row_label}${s.seat_number}`,
          type: s.is_vip ? 'VIP' : 'Thường', isBooked: !!s.is_booked,
        })),
        availableCount: availCount, total: seats.length,
      },
      missingField: 'seatIds',
      suggestedActions: [],
    };
  },

  async handleSelectSeats(conv, state, message, userId) {
    if (!state.showtimeId) {
      return { conversationId: conv.conversation_id, message: 'Bạn chưa chọn suất chiếu. Vui lòng chọn suất chiếu trước! 😊', currentStep: conv.current_step, data: null, missingField: 'showtimeId', suggestedActions: [] };
    }
    if (!userId) {
      return { conversationId: conv.conversation_id, message: '🔒 Bạn cần **đăng nhập** để tiếp tục đặt vé. Sau khi đăng nhập, hệ thống sẽ giữ lại các lựa chọn hiện tại của bạn.', currentStep: STEPS.LOGIN_REQUIRED, data: null, missingField: null, suggestedActions: [] };
    }

    const seatCodes = message.toUpperCase().split(/[,;\s]+/).filter(s => /^[A-H]\d{1,2}$/.test(s));
    if (seatCodes.length === 0) {
      return { conversationId: conv.conversation_id, message: 'Vui lòng ghi mã ghế, ví dụ: "E05, E06" 🎯', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatCodes', suggestedActions: [] };
    }

    const allSeats = (await SeatModel.getLayout(state.showtimeId)) || [];
    const selectedSeats = allSeats.filter(s => seatCodes.includes(`${s.row_label}${s.seat_number}`));
    const bookedSeats = selectedSeats.filter(s => s.is_booked);
    const availSeats = selectedSeats.filter(s => !s.is_booked);

    if (bookedSeats.length > 0) {
      return { conversationId: conv.conversation_id, message: `Ghế ${bookedSeats.map(s => `${s.row_label}${s.seat_number}`).join(', ')} đã có người đặt. Vui lòng chọn ghế khác! 😔`, currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }
    if (availSeats.length === 0) {
      return { conversationId: conv.conversation_id, message: 'Ghế không tồn tại. Vui lòng chọn lại! 😔', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }

    const showtime = await ShowtimeModel.findById(state.showtimeId);
    const tPrice = showtime ? (showtime.ticket_price || showtime.price || 75000) : 75000;
    const vPrice = showtime ? (showtime.vip_price || tPrice) : tPrice;

    const seatDetails = availSeats.map(s => ({
      id: s.id, code: `${s.row_label}${s.seat_number}`,
      type: s.is_vip ? 'VIP' : 'Thường',
      price: s.is_vip ? Number(vPrice) : Number(tPrice),
    }));
    const subtotal = seatDetails.reduce((sum, s) => sum + s.price, 0);
    const serviceFee = Math.round(subtotal * 0.02);
    const total = subtotal + serviceFee;

    try {
      const hold = await SeatHoldModel.create({
        userId, showtimeId: state.showtimeId,
        seatIds: availSeats.map(s => s.id),
        seatPrices: seatDetails.map(s => s.price),
      });

      await ConversationModel.updateStep(conv.conversation_id, STEPS.REVIEW_BILL, {
        seatIds: availSeats.map(s => s.id), seatCodes: availSeats.map(s => `${s.row_label}${s.seat_number}`),
        holdCode: hold.hold_code, subtotal, serviceFee, total, seatDetails,
      });

      let billText = '**THÔNG TIN ĐẶT VÉ**\n\n';
      billText += `🎬 Phim: ${state.movieName || ''}\n`;
      billText += `📍 Rạp: ${state.cinemaName || ''}\n`;
      billText += `📅 Ngày: ${state.showDate ? new Date(state.showDate).toLocaleDateString('vi-VN') : ''}\n`;
      billText += `🕐 Suất: ${showtime?.time || ''}\n`;
      billText += `🎟️ Ghế: ${seatDetails.map(s => s.code).join(', ')}\n\n`;
      billText += '**Chi tiết:**\n';
      seatDetails.forEach(s => { billText += `   • ${s.code} (${s.type}): ${s.price.toLocaleString('vi-VN')}đ\n`; });
      billText += `   • Phí dịch vụ: ${serviceFee.toLocaleString('vi-VN')}đ\n\n`;
      billText += `**💰 Tổng: ${total.toLocaleString('vi-VN')}đ**\n\n`;
      billText += 'Bạn muốn đặt vé và thanh toán? ("Xác nhận" ✅)';

      return {
        conversationId: conv.conversation_id,
        message: billText,
        currentStep: STEPS.REVIEW_BILL,
        data: { movie: state.movieName, cinema: state.cinemaName, showtime: this.sanitizeShowtime(showtime), seats: seatDetails, subtotal, serviceFee, total, holdCode: hold.hold_code },
        missingField: null,
        suggestedActions: [{ type: 'CONFIRM_BOOKING', label: 'Xác nhận ✅', value: '' }],
      };
    } catch (err) {
      return { conversationId: conv.conversation_id, message: `❌ Lỗi: ${err.message}. Vui lòng thử lại!`, currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }
  },

  async handleConfirmBooking(conv, state, userId) {
    if (!userId) {
      return { conversationId: conv.conversation_id, message: '🔒 Bạn cần **đăng nhập** để đặt vé.', currentStep: STEPS.LOGIN_REQUIRED, data: null, missingField: null, suggestedActions: [] };
    }
    if (!state.holdCode) {
      return { conversationId: conv.conversation_id, message: '❌ Không tìm thấy thông tin giữ ghế. Vui lòng chọn ghế lại!', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }

    try {
      const bookingResult = await BookingService.createBookingFromHold({ userId, seatHoldCode: state.holdCode });
      if (!bookingResult.success) {
        return { conversationId: conv.conversation_id, message: `❌ ${bookingResult.message}`, currentStep: STEPS.REVIEW_BILL, data: null, missingField: null, suggestedActions: [] };
      }

      await ConversationModel.updateState(conv.conversation_id, { bookingCode: bookingResult.booking.code });

      const paymentResult = await PaymentService.createPayOSPayment({ userId, bookingCode: bookingResult.booking.code });
      if (!paymentResult.success) {
        return { conversationId: conv.conversation_id, message: `Đã tạo đơn **${bookingResult.booking.code}** nhưng lỗi thanh toán: ${paymentResult.message}`, currentStep: STEPS.REVIEW_BILL, data: null, missingField: null, suggestedActions: [] };
      }

      const pay = paymentResult.payment;
      await ConversationModel.updateStep(conv.conversation_id, STEPS.PAYMENT_PENDING, {
        bookingCode: bookingResult.booking.code, paymentCode: pay.payment_code, orderCode: pay.order_code,
      });

      let text = `✅ **Đã tạo đơn đặt vé thành công!**\n\n`;
      text += `📄 Mã đơn: **${bookingResult.booking.code}**\n`;
      text += `💰 **${(pay.amount || 0).toLocaleString('vi-VN')}đ**\n`;
      text += `⏳ Hạn thanh toán: 15 phút\n\n`;
      text += `💳 **Quét mã QR để thanh toán qua PayOS:**\n\n`;
      text += `Số tiền: **${(pay.amount || 0).toLocaleString('vi-VN')}đ**\n`;
      text += `Nội dung: Thanh toán vé ${bookingResult.booking.code}\n\n`;
      text += `⏳ Trạng thái: Chờ thanh toán...`;

      return {
        conversationId: conv.conversation_id,
        message: text,
        currentStep: STEPS.PAYMENT_PENDING,
        data: {
          booking_code: bookingResult.booking.code,
          amount: pay.amount || bookingResult.totalAmount,
          subtotal: bookingResult.subtotal,
          serviceFee: bookingResult.serviceFee,
          totalAmount: bookingResult.totalAmount,
          seatCodes: bookingResult.seatCodes,
          qrCode: pay.qr_code,
          checkoutUrl: pay.checkout_url,
          paymentCode: pay.payment_code,
          orderCode: pay.order_code,
          paymentStatus: 'PENDING',
        },
        missingField: null,
        suggestedActions: [{ type: 'CHECK_PAYMENT', label: 'Kiểm tra thanh toán 🔄', value: pay.payment_code }],
      };
    } catch (err) {
      return { conversationId: conv.conversation_id, message: `❌ Lỗi: ${err.message}. Vui lòng thử lại!`, currentStep: STEPS.REVIEW_BILL, data: null, missingField: null, suggestedActions: [] };
    }
  },

  async handleCheckPayment(conv, state, userId) {
    if (!state.paymentCode && !state.orderCode) {
      return { conversationId: conv.conversation_id, message: 'Không có thông tin thanh toán để kiểm tra.', currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [] };
    }

    try {
      const checkResult = await PaymentService.getPaymentStatus(state.paymentCode || state.orderCode, {
        isOrderCode: !state.paymentCode,
        userId,
      });
      if (!checkResult.success) {
        return { conversationId: conv.conversation_id, message: `❌ ${checkResult.message}`, currentStep: STEPS.PAYMENT_PENDING, data: checkResult, missingField: null, suggestedActions: [{ type: 'CHECK_PAYMENT', label: 'Kiểm tra lại 🔄', value: '' }] };
      }
      if (checkResult.payment_status === 'PAID' && checkResult.booking_status === 'CONFIRMED') {
        await ConversationModel.updateStep(conv.conversation_id, STEPS.COMPLETED, {});
        let text = `🎉 **ĐẶT VÉ THÀNH CÔNG!** 🎉\n\n`;
        text += `✅ Thanh toán đã được xác nhận.\n`;
        text += `📄 Mã đơn: **${state.bookingCode || ''}**\n`;
        if (checkResult.ticket_code) text += `🎟️ Mã vé: **${checkResult.ticket_code}**\n\n`;
        text += `Bạn có thể xem vé trong mục Profile.\nCảm ơn bạn đã sử dụng CineX! 🍿🎬`;
        return {
          conversationId: conv.conversation_id,
          message: text,
          currentStep: STEPS.COMPLETED,
          data: { bookingCode: state.bookingCode, ticketCode: checkResult.ticket_code, paymentStatus: 'PAID', bookingStatus: 'CONFIRMED' },
          missingField: null,
          suggestedActions: [{ type: 'LIST_MOVIES', label: 'Đặt vé mới 🎬', value: '' }],
        };
      }
      return { conversationId: conv.conversation_id, message: `⏳ ${checkResult.message || 'Đang chờ thanh toán...'}`, currentStep: STEPS.PAYMENT_PENDING, data: { paymentStatus: checkResult.payment_status, bookingStatus: checkResult.booking_status }, missingField: null, suggestedActions: [{ type: 'CHECK_PAYMENT', label: 'Kiểm tra lại 🔄', value: state.paymentCode }] };
    } catch {
      return { conversationId: conv.conversation_id, message: '❌ Lỗi kiểm tra thanh toán. Vui lòng thử lại!', currentStep: STEPS.PAYMENT_PENDING, data: null, missingField: null, suggestedActions: [{ type: 'CHECK_PAYMENT', label: 'Kiểm tra lại 🔄', value: '' }] };
    }
  },

  async handleChangeMovie(conv, _state) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_MOVIE, ['userId']);
    const movies = await MovieModel.findAll({ limit: 20, sort_by: 'popularity', sort_order: 'DESC' });
    return {
      conversationId: conv.conversation_id,
      message: 'Đã chuyển sang chọn phim mới. 🎬\n\n' + this.formatMovieList(movies.rows || []),
      currentStep: STEPS.SELECT_MOVIE, data: { movies: (movies.rows || []).map(m => this.sanitizeMovie(m)) },
      missingField: 'movieId',
      suggestedActions: (movies.rows || []).slice(0, 5).map(m => ({ type: 'SELECT_MOVIE', label: m.title, value: m.id })),
    };
  },

  async handleChangeCinema(conv, _state) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_CINEMA, ['userId', 'movieId', 'movieName', 'location']);
    const cinemas = await CinemaModel.findAll({ limit: 50 });
    const list = (cinemas.rows || cinemas || []).slice(0, 8);
    let text = 'Đã chuyển sang chọn rạp mới. 🎯\n\n📍 Các rạp:\n\n';
    list.forEach((c, i) => { text += `${i + 1}. **${c.name}**\n   📌 ${c.address || ''}\n\n`; });
    text += 'Bạn muốn chọn rạp nào?';
    return { conversationId: conv.conversation_id, message: text, currentStep: STEPS.SELECT_CINEMA, data: { cinemas: list.map(c => this.sanitizeCinema(c)) }, missingField: 'cinemaId', suggestedActions: list.slice(0, 5).map(c => ({ type: 'SELECT_CINEMA', label: c.name, value: c.id })) };
  },

  async handleChangeDate(conv, _state) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_DATE, ['userId', 'movieId', 'movieName', 'cinemaId', 'cinemaName', 'location']);
    return { conversationId: conv.conversation_id, message: 'Bạn muốn xem vào ngày nào? ("hôm nay", "ngày mai") 📅', currentStep: STEPS.SELECT_DATE, data: null, missingField: 'showDate', suggestedActions: [{ type: 'SELECT_DATE', label: 'Hôm nay', value: new Date().toISOString().split('T')[0] }, { type: 'SELECT_DATE', label: 'Ngày mai', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] }] };
  },

  async handleChangeShowtime(conv, state) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_SHOWTIME, ['userId', 'movieId', 'movieName', 'cinemaId', 'cinemaName', 'location', 'showDate']);
    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, state.showDate || new Date().toISOString().split('T')[0]);
  },

  async handleUnknown(conv, state, message) {
    if (state.currentStep === STEPS.SELECT_SHOWTIME && !state.showtimeId) {
      const time = message.match(/(\d{1,2})[h:.]?(\d{2})?/);
      if (time) {
        const showtimes = await ShowtimeModel.findAll({ movie_id: state.movieId, cinema_id: state.cinemaId, date: state.showDate, limit: 50 });
        const list = (showtimes.rows || []).filter(s => s.time && s.time.startsWith(time[1].padStart(2, '0')));
        if (list.length > 0) {
          await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SEAT, { showtimeId: list[0].id, showtimeInfo: list[0] });
          return await this.handleSelectShowtimeById(conv.conversation_id, list[0].id);
        }
      }
      const numMatch = message.match(/(\d+)/);
      if (numMatch) {
        const idx = parseInt(numMatch[1]) - 1;
        const showtimes = await ShowtimeModel.findAll({ movie_id: state.movieId, cinema_id: state.cinemaId, date: state.showDate, limit: 50 });
        const list = (showtimes.rows || []).filter(s => new Date(`${s.date || state.showDate}T${s.time}`) > new Date());
        if (idx >= 0 && idx < list.length) {
          await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SEAT, { showtimeId: list[idx].id, showtimeInfo: list[idx] });
          return await this.handleSelectShowtimeById(conv.conversation_id, list[idx].id);
        }
      }
      return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, state.showDate);
    }

    if (state.currentStep === STEPS.SELECT_SEAT && state.showtimeId && state.seatIds.length === 0) {
      const codes = message.toUpperCase().split(/[,;\s]+/).filter(s => /^[A-H]\d{1,2}$/.test(s));
      if (codes.length > 0) {
        return await this.handleSelectSeats(conv, state, message, conv.user_id);
      }
    }

    return { conversationId: conv.conversation_id, message: 'Mình chưa hiểu ý bạn. Bạn có thể nói rõ hơn không? 😊\n\nGợi ý:\n• "Xem phim đang chiếu" 🎬\n• "Đặt vé xem [tên phim]" 🎫\n• "Rạp gần [địa chỉ]" 📍', currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }, { type: 'HELP', label: 'Hỗ trợ', value: '' }] };
  },

  greetingResponse(conv) {
    return { conversationId: conv.conversation_id, message: `Xin chào! 👋 Mình là **CineX AI**, trợ lý đặt vé thông minh.\n\nMình có thể:\n• 🎬 Xem phim đang chiếu\n• 📅 Tra suất chiếu\n• 📍 Tìm rạp gần bạn\n• 🎫 Đặt vé nhanh chóng\n• 💳 Thanh toán qua PayOS\n\nBạn muốn xem phim gì hôm nay? 🎬`, currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }, { type: 'HELP', label: 'Hỗ trợ', value: '' }] };
  },

  helpResponse(conv) {
    return { conversationId: conv.conversation_id, message: `Mình có thể giúp bạn:\n\n🎬 **Xem phim**: "Có phim gì đang chiếu?"\n🎫 **Đặt vé**: Nói "Đặt vé xem [tên phim]" và mình sẽ hướng dẫn!\n📍 **Tìm rạp**: "Rạp gần [địa chỉ]"\n📅 **Suất chiếu**: "Suất chiếu hôm nay"\n\n**Quy trình:**\n1️⃣ Chọn phim\n2️⃣ Chọn khu vực\n3️⃣ Chọn rạp\n4️⃣ Chọn ngày\n5️⃣ Chọn suất chiếu\n6️⃣ Chọn ghế\n7️⃣ Xác nhận và thanh toán PayOS 💳\n\nBạn muốn bắt đầu? 😊`, currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }] };
  },

  sanitizeMovie(m) { return { id: m.id, title: m.title, genre: m.genre, duration: m.duration, rating: m.rating, age_rating: m.age_rating, language: m.language, release_date: m.release_date, description: m.description, ticket_price: m.ticket_price, poster: m.poster, trailer_url: m.trailer_url }; },
  sanitizeCinema(c) { return { id: c.id, name: c.name, address: c.address, district: c.district, city: c.city, brand: c.brand, lat: c.lat, lng: c.lng, rating: c.rating }; },
  sanitizeShowtime(s) { return { id: s.id, movie_id: s.movie_id, cinema_id: s.cinema_id, date: s.date, time: s.time, ticket_price: s.ticket_price || s.price, screen_name: s.screen_name, format: s.format, language: s.language }; },
};

module.exports = ChatService;
