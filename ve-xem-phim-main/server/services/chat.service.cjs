const ConversationModel = require('../models/conversation.model.cjs');
const MovieModel = require('../models/movie.model.cjs');
const CinemaModel = require('../models/cinema.model.cjs');
const ShowtimeModel = require('../models/showtime.model.cjs');
const SeatModel = require('../models/seat.model.cjs');
const SeatHoldModel = require('../models/seatHold.model.cjs');
const ConcessionModel = require('../models/concession.model.cjs');
const PromotionModel = require('../models/promotion.model.cjs');
const BookingService = require('./booking.service.cjs');
const PaymentService = require('./payment.service.cjs');
const NvidiaAIService = require('./nvidia-ai.service.cjs');

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

function seatCode(seat) {
  const row = seat.row_label || seat.row || '';
  const number = seat.seat_number ?? seat.number;
  return `${row}${String(number).padStart(2, '0')}`;
}

function normalizeSeat(seat) {
  return {
    ...seat,
    row_label: seat.row_label || seat.row,
    seat_number: seat.seat_number ?? seat.number,
    is_vip: seat.is_vip ?? seat.isVip,
    is_booked: seat.is_booked ?? seat.isBooked,
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMovieMatchText(value) {
  return normalizeSearchText(value)
    .replace(/\b(?:va|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localDateValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const GENRE_ALIASES = [
  { genre: 'Khoa học viễn tưởng', aliases: ['khoa học viễn tưởng', 'viễn tưởng', 'sci fi', 'scifi'] },
  { genre: 'Hoạt hình', aliases: ['hoạt hình', 'cartoon', 'anime'] },
  { genre: 'Hài hước', aliases: ['hài hước', 'phim hài', 'hài'] },
  { genre: 'Kinh dị', aliases: ['kinh dị', 'phim ma'] },
  { genre: 'Hành động', aliases: ['hành động'] },
  { genre: 'Phiêu lưu', aliases: ['phiêu lưu'] },
  { genre: 'Gia đình', aliases: ['gia đình'] },
  { genre: 'Lãng mạn', aliases: ['lãng mạn', 'tình cảm'] },
  { genre: 'Giật gân', aliases: ['giật gân'] },
  { genre: 'Bí ẩn', aliases: ['bí ẩn'] },
  { genre: 'Chính kịch', aliases: ['chính kịch'] },
  { genre: 'Tài liệu', aliases: ['tài liệu'] },
  { genre: 'Âm nhạc', aliases: ['âm nhạc'] },
  { genre: 'Kỳ ảo', aliases: ['kỳ ảo'] },
  { genre: 'Lịch sử', aliases: ['lịch sử'] },
  { genre: 'Chiến tranh', aliases: ['chiến tranh'] },
  { genre: 'Hình sự', aliases: ['hình sự', 'tội phạm'] },
  { genre: 'Miền Tây', aliases: ['miền tây', 'western'] },
];

const ChatService = {
  async processMessage({ conversationId, message, userId, latitude, longitude, concessions = [], action = null }) {
    await ConversationModel.ensureTable();

    let conv = await ConversationModel.getOrCreate(conversationId, userId);
    if (conv.user_id && userId && conv.user_id !== userId) {
      throw Object.assign(new Error('Bạn không có quyền sử dụng hội thoại này'), { code: 'FORBIDDEN' });
    }
    if (userId && !conv.user_id) {
      conv = await ConversationModel.bindUser(conv.conversation_id, userId);
    }

    const storedState = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : (conv.state_data || {});
    const state = { ...storedState, currentStep: conv.current_step };
    const normalized = message.trim().toLowerCase();
    const databaseLocation = await this.resolveLocationFromDatabase(message);
    const databaseMovie = await this.resolveMovieFromDatabase(message);
    let aiAnalysis = null;

    if (NvidiaAIService.isConfigured()) {
      try {
        const aiState = { ...state };
        delete aiState.chatHistory;
        aiAnalysis = await NvidiaAIService.analyzeMessage({
          message,
          state: aiState,
          context: await this.buildAIContext(state, {
            movie: databaseMovie,
            location: databaseLocation,
          }),
          history: storedState.chatHistory || [],
        });
      } catch (err) {
        console.warn(`NVIDIA AI fallback: ${err.message}`);
      }
    }

    const detectedRuleIntent = this.detectIntent(normalized, state);
    let ruleIntent = databaseLocation && ['UNKNOWN', 'SELECT_MOVIE'].includes(detectedRuleIntent)
      ? 'SET_LOCATION'
      : detectedRuleIntent;
    const requestedAction = action === 'CONFIRM_BOOKING' ? action : null;
    const aiIntent = aiAnalysis && this.isIntentAllowed(aiAnalysis.intent, state) ? aiAnalysis.intent : null;
    const locationOverridesAI = databaseLocation && ['UNKNOWN', 'SELECT_MOVIE', 'GENERAL_CHAT'].includes(aiIntent);
    const explicitMovieAction = /đặt\s*(?:vé)?|mua\s*vé|book|xem\s+phim|chọn\s+phim/i.test(message);
    if (databaseMovie && !explicitMovieAction && ['UNKNOWN', 'SELECT_MOVIE'].includes(ruleIntent)) {
      ruleIntent = 'MOVIE_INFO_QUERY';
    }
    const groundedRuleIntents = new Set([
      'LIST_MOVIES', 'RECOMMEND_MOVIES', 'SHOWTIME_QUERY', 'SELECT_CINEMA', 'SELECT_DATE',
      'DURATION_QUERY', 'MOVIE_INFO_QUERY',
      'SELECT_SHOWTIME', 'SELECT_SEATS', 'CONFIRM_BOOKING', 'CHECK_PAYMENT',
      'CHANGE_MOVIE', 'CHANGE_CINEMA', 'CHANGE_DATE', 'CHANGE_SHOWTIME',
    ]);
    const preferRuleIntent = groundedRuleIntents.has(ruleIntent)
      || (ruleIntent === 'SELECT_MOVIE' && (databaseMovie || explicitMovieAction));
    const intent = requestedAction
      || (locationOverridesAI ? 'SET_LOCATION' : (preferRuleIntent ? ruleIntent : (aiIntent || ruleIntent)));
    const actionMessage = intent === 'SET_LOCATION' && databaseLocation
      ? databaseLocation
      : (intent === 'SELECT_MOVIE' && databaseMovie
        ? databaseMovie.title
        : this.resolveActionMessage(intent, message, aiAnalysis?.entities));
    let result;

    switch (intent) {
      case 'LIST_MOVIES': result = await this.handleListMovies(conv, state); break;
      case 'RECOMMEND_MOVIES': result = await this.handleRecommendMovies(conv, {
        message,
        genres: aiAnalysis?.entities?.genres || [],
      }); break;
      case 'SELECT_MOVIE': result = await this.handleSelectMovie(conv, state, actionMessage); break;
      case 'SET_LOCATION': result = await this.handleSetLocation(conv, state, actionMessage, latitude, longitude); break;
      case 'SELECT_CINEMA': result = await this.handleSelectCinema(conv, state, actionMessage); break;
      case 'SELECT_DATE': result = await this.handleSelectDate(conv, state, actionMessage); break;
      case 'SELECT_SHOWTIME': result = await this.handleSelectShowtime(conv, state, actionMessage); break;
      case 'SHOWTIME_QUERY': result = await this.handleShowtimeQuery(conv, state, message, databaseMovie); break;
      case 'DURATION_QUERY': result = await this.handleDurationQuery(conv, state, databaseMovie); break;
      case 'MOVIE_INFO_QUERY': result = await this.handleMovieInfoQuery(conv, state, databaseMovie); break;
      case 'SELECT_SEATS': result = await this.handleSelectSeats(conv, state, actionMessage, userId); break;
      case 'CONFIRM_BOOKING': result = await this.handleConfirmBooking(conv, state, userId, concessions); break;
      case 'CHECK_PAYMENT': result = await this.handleCheckPayment(conv, state, userId); break;
      case 'CHANGE_MOVIE': result = await this.handleChangeMovie(conv, state); break;
      case 'CHANGE_CINEMA': result = await this.handleChangeCinema(conv, state); break;
      case 'CHANGE_DATE': result = await this.handleChangeDate(conv, state); break;
      case 'CHANGE_SHOWTIME': result = await this.handleChangeShowtime(conv, state); break;
      case 'HELP': result = aiAnalysis?.reply ? this.aiConversationResponse(conv, aiAnalysis.reply) : this.helpResponse(conv); break;
      case 'GREETING': result = aiAnalysis?.reply ? this.aiConversationResponse(conv, aiAnalysis.reply) : this.greetingResponse(conv); break;
      case 'GENERAL_CHAT': result = this.aiConversationResponse(conv, aiAnalysis?.reply); break;
      default: result = await this.handleUnknown(conv, state, message);
    }

    const aiReplyIntents = new Set([
      'LIST_MOVIES', 'RECOMMEND_MOVIES', 'SELECT_MOVIE', 'SET_LOCATION',
      'SELECT_CINEMA', 'SELECT_DATE', 'SHOWTIME_QUERY', 'DURATION_QUERY',
      'MOVIE_INFO_QUERY',
    ]);
    if (aiAnalysis && aiReplyIntents.has(intent) && result?.message) {
      try {
        const groundedReply = await NvidiaAIService.generateGroundedReply({
          message,
          intent,
          state: {
            currentStep: result.currentStep,
            missingField: result.missingField,
            bookingMovieId: state.movieId || null,
            bookingMovieName: state.movieName || null,
          },
          verifiedMessage: result.message,
          verifiedData: result.data,
          history: storedState.chatHistory || [],
        });
        if (groundedReply && this.isGroundedReplyValid(intent, groundedReply, result)) {
          result.message = groundedReply;
        }
      } catch (err) {
        console.warn(`NVIDIA grounded reply fallback: ${err.message}`);
      }
    }

    const history = [
      ...(storedState.chatHistory || []),
      { role: 'user', content: message },
      { role: 'assistant', content: result.message },
    ].slice(-10);
    await ConversationModel.updateState(conv.conversation_id, { chatHistory: history });

    return {
      ...result,
      ai: {
        used: Boolean(aiAnalysis),
        provider: aiAnalysis ? 'NVIDIA NIM' : 'RULE_FALLBACK',
        model: aiAnalysis ? NvidiaAIService.getModel() : null,
      },
    };
  },

  async buildAIContext(state, focus = {}) {
    const context = {};
    const [movies, cinemas, locations, concessions, promotions] = await Promise.all([
      MovieModel.findAll({ limit: 200, status: 'active', sortBy: 'release_date', sortOrder: 'DESC' }),
      CinemaModel.findAll({ limit: 1000 }),
      CinemaModel.getLocations(),
      ConcessionModel.findActive(),
      PromotionModel.findAll({ limit: 100 }),
    ]);
    context.movieCatalog = (movies.rows || []).map(movie => ({
      id: movie.id,
      title: movie.title,
      genre: movie.genre,
      rating: movie.rating,
    }));

    const cinemaCatalog = cinemas.rows || cinemas || [];
    context.cinemaCatalog = cinemaCatalog.map(cinema => ({
      id: cinema.id,
      name: cinema.name,
      city: cinema.city,
      brand: cinema.brand,
    }));
    context.locations = {
      cities: (locations.cities || []).map(item => item.city),
      provinces: (locations.provinces || []).map(item => item.name),
    };
    context.concessions = (concessions || []).map(item => ({
      id: item.id, name: item.name, description: item.description, price: item.price, stock: item.stock,
    }));
    context.promotions = (promotions.rows || []).map(item => ({
      id: item.id, title: item.title, description: item.description, discount: item.discount,
      code: item.code, validUntil: item.valid_until,
    }));

    const focusedMovieId = state.discussionMovieId || state.movieId;
    const focusedMovie = focus.movie || (focusedMovieId ? await MovieModel.findById(focusedMovieId) : null);
    if (focusedMovie) {
      context.focusedMovie = {
        id: focusedMovie.id,
        title: focusedMovie.title,
        genre: focusedMovie.genre,
        duration: focusedMovie.duration,
        rating: focusedMovie.rating,
        ageRating: focusedMovie.age_rating,
        language: focusedMovie.language,
        releaseDate: focusedMovie.release_date,
        director: focusedMovie.director,
        cast: focusedMovie.cast,
        description: focusedMovie.description,
        ticketPrice: focusedMovie.ticket_price,
      };
    }

    const focusedLocation = focus.location || state.location;
    if (focusedLocation) {
      const normalizedLocation = normalizeSearchText(focusedLocation);
      context.focusedCinemas = cinemaCatalog.filter(cinema =>
        normalizeSearchText(cinema.city).includes(normalizedLocation)
        || normalizeSearchText(cinema.district).includes(normalizedLocation)
        || normalizeSearchText(cinema.address).includes(normalizedLocation)
      ).slice(0, 30).map(cinema => ({
        id: cinema.id,
        name: cinema.name,
        address: cinema.address,
        city: cinema.city,
        district: cinema.district,
        brand: cinema.brand,
      }));
    }

    if (state.movieId && state.cinemaId) {
      const showtimes = await ShowtimeModel.findAll({
        movie_id: state.movieId,
        cinema_id: state.cinemaId,
        date: state.showDate || undefined,
        limit: 30,
      });
      context.showtimes = (showtimes.rows || []).map(showtime => this.sanitizeShowtime(showtime));
    }
    return context;
  },

  isGroundedReplyValid(intent, reply, result) {
    if (!reply || typeof reply !== 'string') return false;
    if (intent === 'DURATION_QUERY' && result.data?.durationMinutes) {
      return reply.includes(String(result.data.durationMinutes));
    }
    if (intent === 'SHOWTIME_QUERY' && result.data?.showtimes?.length) {
      const allowedTimes = new Set(result.data.showtimes.map(item => String(item.time || '').slice(0, 5)));
      const mentionedTimes = reply.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || [];
      return mentionedTimes.every(time => allowedTimes.has(time.padStart(5, '0')));
    }
    return true;
  },

  isIntentAllowed(intent, state) {
    const alwaysAllowed = new Set([
      'GREETING', 'HELP', 'LIST_MOVIES', 'RECOMMEND_MOVIES', 'SELECT_MOVIE',
      'CHANGE_MOVIE', 'GENERAL_CHAT', 'UNKNOWN', 'SHOWTIME_QUERY',
      'DURATION_QUERY', 'MOVIE_INFO_QUERY',
    ]);
    if (alwaysAllowed.has(intent)) return true;
    if (intent === 'SET_LOCATION') return true;
    if (intent === 'SELECT_CINEMA' || intent === 'CHANGE_CINEMA') return Boolean(state.movieId && state.location);
    if (intent === 'SELECT_DATE' || intent === 'CHANGE_DATE') return Boolean(state.movieId && state.cinemaId);
    if (intent === 'SELECT_SHOWTIME' || intent === 'CHANGE_SHOWTIME') return Boolean(state.movieId && state.cinemaId && state.showDate);
    if (intent === 'SELECT_SEATS') return Boolean(state.showtimeId);
    if (intent === 'CONFIRM_BOOKING') return Boolean(state.holdCode);
    if (intent === 'CHECK_PAYMENT') return Boolean(state.paymentCode || state.orderCode);
    return false;
  },

  resolveActionMessage(intent, originalMessage, entities = {}) {
    if (intent === 'SELECT_MOVIE' && entities.movieName) return entities.movieName;
    if (intent === 'SET_LOCATION' && entities.location) return entities.location;
    if (intent === 'SELECT_CINEMA' && entities.cinemaName) return entities.cinemaName;
    if (intent === 'SELECT_DATE') return this.extractDate(originalMessage) || entities.date || originalMessage;
    if (intent === 'SELECT_SHOWTIME' && entities.showtime) return entities.showtime;
    if (intent === 'SELECT_SEATS' && entities.seatCodes?.length) return entities.seatCodes.join(', ');
    return originalMessage;
  },

  aiConversationResponse(conv, reply) {
    return {
      conversationId: conv.conversation_id,
      message: reply || 'Mình đang ở đây để trò chuyện về phim và giúp bạn đặt vé. Bạn muốn tìm hiểu phim nào?',
      currentStep: conv.current_step,
      data: null,
      missingField: null,
      suggestedActions: [
        { type: 'RECOMMEND_MOVIES', label: 'Gợi ý phim ✨', value: '' },
        { type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' },
      ],
    };
  },

  detectIntent(text, state) {
    if (/^(xin chào|chào|hello|hi|hey|hí)(?:\s|[!,.?]|$)/i.test(text)) return 'GREETING';
    if (/giúp|hỗ trợ|có thể/i.test(text) && !/đặt|vé|mua/i.test(text)) return 'HELP';

    if (/đổi phim|phim khác|chọn phim khác/i.test(text)) return 'CHANGE_MOVIE';
    if (/đổi rạp|rạp khác|chọn rạp khác/i.test(text)) return 'CHANGE_CINEMA';
    if (/đổi ngày|ngày khác|chọn ngày khác/i.test(text)) return 'CHANGE_DATE';
    if (/đổi suất|suất khác|chọn suất khác|đổi giờ|giờ khác/i.test(text)) return 'CHANGE_SHOWTIME';

    if (state.currentStep === STEPS.PAYMENT_PENDING && state.paymentCode) {
      if (/kiểm tra|check|đã chuyển|đã thanh toán/i.test(text)) return 'CHECK_PAYMENT';
    }

    if (/gợi ý|giới thiệu|đề xuất|phim nào hay|nên xem phim/i.test(text)) return 'RECOMMEND_MOVIES';
    if (/thời\s*lượng|bao\s*lâu|dài\s*(?:bao nhiêu|mấy)|mấy\s*phút|bao\s*nhiêu\s*phút/i.test(text)) return 'DURATION_QUERY';
    if (/suất\s*chiếu|lịch\s*chiếu|giờ\s*chiếu|mấy\s*giờ|chiếu\s*lúc|showtime|\btime\b/i.test(text)) return 'SHOWTIME_QUERY';
    if (/nội\s*dung|thông\s*tin|kể\s*về|đạo\s*diễn|diễn\s*viên|thế\s+phim|phim\s+này|phim\s+đó/i.test(text)) return 'MOVIE_INFO_QUERY';
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

    if (state.showtimeId && state.currentStep === STEPS.SELECT_SEAT && (state.seatIds || []).length === 0) {
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

  matchMovieFromCatalog(message, movies = []) {
    const normalizedMessage = normalizeMovieMatchText(message);
    return [...movies]
      .filter(movie => movie && movie.title)
      .sort((a, b) => normalizeMovieMatchText(b.title).length - normalizeMovieMatchText(a.title).length)
      .find(movie => {
        const title = normalizeMovieMatchText(movie.title);
        return normalizedMessage === title
          || normalizedMessage.includes(` ${title} `)
          || normalizedMessage.startsWith(`${title} `)
          || normalizedMessage.endsWith(` ${title}`);
      }) || null;
  },

  async resolveMovieFromDatabase(message) {
    try {
      const result = await MovieModel.findAll({ limit: 200, status: 'active', sortBy: 'title', sortOrder: 'ASC' });
      return this.matchMovieFromCatalog(message, result.rows || []);
    } catch (error) {
      console.warn(`Movie lookup fallback: ${error.message}`);
      return null;
    }
  },

  extractLocation(text) {
    const known = ['hà nội', 'hồ chí minh', 'sài gòn', 'đà nẵng', 'hải phòng', 'cần thơ', 'biên hòa', 'nha trang', 'huế', 'vũng tàu', 'đà lạt', 'cầu giấy', 'đống đa', 'thanh xuân', 'hoàn kiếm', 'hai bà trưng', 'nam từ liêm', 'bắc từ liêm', 'hà đông', 'long biên', 'hoàng mai'];
    for (const place of known) {
      if (text.toLowerCase().includes(place)) return place;
    }
    return null;
  },

  matchLocationName(message, locationNames = []) {
    const normalizedMessage = normalizeSearchText(message);
    const aliases = new Map([
      ['hcm', 'Hồ Chí Minh'],
      ['tp hcm', 'Hồ Chí Minh'],
      ['sai gon', 'Hồ Chí Minh'],
    ]);
    if (aliases.has(normalizedMessage)) return aliases.get(normalizedMessage);

    return [...new Set(locationNames.filter(Boolean))]
      .sort((a, b) => normalizeSearchText(b).length - normalizeSearchText(a).length)
      .find(name => {
        const normalizedName = normalizeSearchText(name);
        return normalizedMessage === normalizedName
          || normalizedMessage.includes(` ${normalizedName} `)
          || normalizedMessage.startsWith(`${normalizedName} `)
          || normalizedMessage.endsWith(` ${normalizedName}`);
      }) || null;
  },

  async resolveLocationFromDatabase(message) {
    try {
      const result = await CinemaModel.getLocations();
      const names = [
        ...(result.cities || []).map(item => item.city),
        ...(result.provinces || []).map(item => item.name),
      ];
      return this.matchLocationName(message, names);
    } catch (error) {
      console.warn(`Location lookup fallback: ${error.message}`);
      return this.extractLocation(message);
    }
  },

  extractDate(text) {
    const today = new Date();
    if (/hôm nay|tối nay/i.test(text)) return localDateValue(today);
    if (/ngày mai/i.test(text)) {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      return localDateValue(d);
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
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_MOVIE, []);
    const movies = await MovieModel.findAll({ limit: 20, sort_by: 'popularity', sort_order: 'DESC' });
    const list = movies.rows || [];
    return {
      conversationId: conv.conversation_id,
      message: this.formatMovieList(list),
      currentStep: STEPS.SELECT_MOVIE,
      data: { movies: list.map(m => this.sanitizeMovie(m)) },
      missingField: 'movieId',
      suggestedActions: list.slice(0, 5).map(m => ({
        type: 'SELECT_MOVIE', label: m.title, value: m.id,
      })),
    };
  },

  extractRequestedGenres(message, movies = [], aiGenres = []) {
    const requested = new Set();
    const normalizedMessage = normalizeSearchText(message);
    const availableGenres = new Map();

    movies.forEach(movie => {
      String(movie.genre || '').split(',').forEach(value => {
        const genre = value.trim();
        if (genre) availableGenres.set(normalizeSearchText(genre), genre);
      });
    });

    GENRE_ALIASES.forEach(({ genre, aliases }) => {
      if (aliases.some(alias => normalizedMessage.includes(normalizeSearchText(alias)))) {
        requested.add(availableGenres.get(normalizeSearchText(genre)) || genre);
      }
    });

    aiGenres.forEach(value => {
      const normalized = normalizeSearchText(value);
      const aliasMatch = GENRE_ALIASES.find(({ genre, aliases }) =>
        normalizeSearchText(genre) === normalized
        || aliases.some(alias => normalizeSearchText(alias) === normalized));
      const canonical = availableGenres.get(normalized)
        || (aliasMatch && (availableGenres.get(normalizeSearchText(aliasMatch.genre)) || aliasMatch.genre));
      if (canonical) requested.add(canonical);
    });

    return [...requested];
  },

  filterMoviesByGenres(movies, genres = []) {
    if (!genres.length) return movies;
    const required = genres.map(normalizeSearchText);
    return movies.filter(movie => {
      const movieGenres = String(movie.genre || '')
        .split(',')
        .map(normalizeSearchText)
        .filter(Boolean);
      return required.every(genre => movieGenres.includes(genre));
    });
  },

  async handleRecommendMovies(conv, { message = '', genres: aiGenres = [] } = {}) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_MOVIE, []);
    let list = await MovieModel.findAvailable();
    if (!list.length) {
      const result = await MovieModel.findAll({ limit: 50, status: 'active', sortBy: 'popularity', sortOrder: 'DESC' });
      list = result.rows || [];
    }

    const requestedGenres = this.extractRequestedGenres(message, list, aiGenres);
    list = this.filterMoviesByGenres(list, requestedGenres);
    list = list
      .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
      .slice(0, 5);

    if (!list.length && requestedGenres.length) {
      const genreText = requestedGenres.join(', ');
      return {
        conversationId: conv.conversation_id,
        message: `Hiện CineX chưa có phim **${genreText}** đang chiếu. Mình sẽ không gợi ý phim khác thể loại để tránh làm sai yêu cầu của bạn. Bạn muốn thử thể loại khác không?`,
        currentStep: STEPS.SELECT_MOVIE,
        data: { movies: [], requestedGenres },
        missingField: 'movieId',
        suggestedActions: [
          { type: 'RECOMMEND_MOVIES', label: 'Phim hài 😄', value: 'Gợi ý phim hài' },
          { type: 'LIST_MOVIES', label: 'Tất cả phim 🎬', value: '' },
        ],
      };
    }

    const heading = requestedGenres.length
      ? `✨ **Phim ${requestedGenres.join(', ')} CineX gợi ý cho bạn:**\n\n`
      : '✨ **Một số phim CineX gợi ý cho bạn:**\n\n';
    let text = heading;
    list.forEach((movie, index) => {
      text += `${index + 1}. **${movie.title}**`;
      if (movie.rating) text += ` · 🔞 ${movie.rating}`;
      if (movie.genre) text += ` · ${movie.genre}`;
      text += '\n';
      if (movie.description) text += `   ${movie.description.slice(0, 120)}${movie.description.length > 120 ? '…' : ''}\n`;
    });
    text += '\nChọn một phim bên dưới để xem thông tin và đặt vé nhé.';

    return {
      conversationId: conv.conversation_id,
      message: text,
      currentStep: STEPS.SELECT_MOVIE,
      data: { movies: list.map(movie => this.sanitizeMovie(movie)), requestedGenres },
      missingField: 'movieId',
      suggestedActions: list.map(movie => ({ type: 'SELECT_MOVIE', label: movie.title, value: movie.id })),
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
    const movies = await MovieModel.findAll({ limit: 200, status: 'active', sortBy: 'title', sortOrder: 'ASC' });
    const movieList = movies.rows || [];
    const matched = this.matchMovieFromCatalog(message, movieList)
      || movieList.find(m => normalizeSearchText(m.title) === normalizeSearchText(movieName));

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

    if (state.location) {
      return this.handleSetLocation(conv, {
        ...state,
        movieId: matched.id,
        movieName: matched.title,
      }, state.location, state.latitude, state.longitude);
    }

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
    const location = await this.resolveLocationFromDatabase(message)
      || this.extractLocation(message)
      || message.replace(/^(rạp\s+(?:ở|tại|gần)|ở|tại|gần|tỉnh|thành phố)\s+/i, '').trim()
      || 'Hà Nội';

    const nextStep = state.movieId ? STEPS.SELECT_CINEMA : STEPS.SELECT_MOVIE;

    await ConversationModel.updateStep(conv.conversation_id, nextStep, {
      location, latitude: lat || null, longitude: lng || null,
    });

    let cinemas = await CinemaModel.findAll({ limit: 100, city: location });
    if (!(cinemas.rows || []).length) {
      cinemas = await CinemaModel.findAll({ limit: 100, search: location });
    }
    const cinemaList = (cinemas.rows || cinemas || []);
    const normalizedLocation = normalizeSearchText(location);

    let filtered = cinemaList.filter(c =>
      (c.city && normalizeSearchText(c.city).includes(normalizedLocation)) ||
      (c.province_name && normalizeSearchText(c.province_name).includes(normalizedLocation)) ||
      (c.district && normalizeSearchText(c.district).includes(normalizedLocation)) ||
      (c.address && normalizeSearchText(c.address).includes(normalizedLocation))
    );

    if (filtered.length === 0) {
      return {
        conversationId: conv.conversation_id,
        message: `Hiện CineX chưa có rạp trong dữ liệu tại **${location}**. Mình sẽ không hiển thị rạp ở tỉnh khác để tránh sai địa điểm.`,
        currentStep: nextStep,
        data: { cinemas: [], location },
        missingField: state.movieId ? 'cinemaId' : 'movieId',
        suggestedActions: [{ type: 'LIST_MOVIES', label: 'Xem phim đang chiếu 🎬', value: '' }],
      };
    }

    let text = `📍 Các rạp gần **${location}**:\n\n`;
    filtered.slice(0, 8).forEach((c, i) => {
      text += `${i + 1}. **${c.name}**\n`;
      if (c.address) text += `   📌 ${c.address}\n`;
      if (c.district && c.city) text += `   🏙️ ${c.district}, ${c.city}\n`;
      if (c.brand) text += `   🏢 ${c.brand}\n`;
      text += '\n';
    });
    text += state.movieId
      ? 'Bạn muốn chọn rạp nào? (Ghi tên rạp hoặc số thứ tự) 🎯'
      : 'Bạn chưa chọn phim. Hãy chọn phim đang chiếu, CineX sẽ ghi nhớ khu vực này để tiếp tục đặt vé. 🎬';

    return {
      conversationId: conv.conversation_id,
      message: text,
      currentStep: nextStep,
      data: { cinemas: filtered.slice(0, 8).map(c => this.sanitizeCinema(c)), location },
      missingField: state.movieId ? 'cinemaId' : 'movieId',
      suggestedActions: state.movieId
        ? filtered.slice(0, 5).map(c => ({ type: 'SELECT_CINEMA', label: c.name, value: c.id }))
        : [
          { type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' },
          { type: 'RECOMMEND_MOVIES', label: 'Gợi ý phim ✨', value: '' },
        ],
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
      const query = normalizeSearchText(message);
      const queryTokens = query.split(' ').filter(token => token && !['rap', 'cinema', 'cinemas'].includes(token));
      matched = cinemaList.find(cinema => {
        const candidate = normalizeSearchText(cinema.name);
        return candidate.includes(query) || (queryTokens.length > 0 && queryTokens.every(token => candidate.includes(token)));
      });
    }
    if (!matched) {
      const nearby = cinemaList.filter(c =>
        (c.city && normalizeSearchText(c.city).includes(normalizeSearchText(state.location))) ||
        (c.district && normalizeSearchText(c.district).includes(normalizeSearchText(state.location)))
      ).slice(0, 5);
      return {
        conversationId: conv.conversation_id,
        message: `Mình chưa tìm thấy rạp "${message}" trong hệ thống.${nearby.length ? `\n\nCác rạp gần khu vực bạn chọn:\n${nearby.map((c, index) => `${index + 1}. ${c.name}`).join('\n')}` : ''}`,
        currentStep: conv.current_step,
        data: { cinemas: nearby.map(c => this.sanitizeCinema(c)) },
        missingField: 'cinemaId',
        suggestedActions: nearby.map(c => ({ type: 'SELECT_CINEMA', label: c.name, value: c.id })),
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
        { type: 'SELECT_DATE', label: 'Hôm nay', value: localDateValue() },
        { type: 'SELECT_DATE', label: 'Ngày mai', value: localDateValue(new Date(Date.now() + 86400000)) },
      ],
    };
  },

  async handleSelectDate(conv, state, message) {
    const date = this.extractDate(message) || localDateValue();
    await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SHOWTIME, { showDate: date });
    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, date);
  },

  async handleSelectShowtime(conv, state, message) {
    const date = state.showDate || localDateValue();
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

  async handleShowtimeQuery(conv, state, message, databaseMovie = null) {
    if (!state.movieId) {
      if (databaseMovie) {
        return this.handleSelectMovie(conv, state, databaseMovie.title);
      }
      const movies = await MovieModel.findAvailable();
      const list = movies.slice(0, 8);
      return {
        conversationId: conv.conversation_id,
        message: `Mình chỉ tra lịch chiếu của phim có trong CineX. Bạn muốn xem lịch của phim nào?\n\n${this.formatMovieList(list)}`,
        currentStep: STEPS.SELECT_MOVIE,
        data: { movies: list.map(movie => this.sanitizeMovie(movie)) },
        missingField: 'movieId',
        suggestedActions: list.slice(0, 5).map(movie => ({ type: 'SELECT_MOVIE', label: movie.title, value: movie.id })),
      };
    }

    if (!state.location) {
      await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_LOCATION, {});
      return {
        conversationId: conv.conversation_id,
        message: `Để tra giờ chiếu chính xác của **${state.movieName || 'phim đã chọn'}**, bạn muốn xem ở tỉnh/thành phố nào? 📍`,
        currentStep: STEPS.SELECT_LOCATION,
        data: null,
        missingField: 'location',
        suggestedActions: [],
      };
    }

    if (!state.cinemaId) {
      return this.handleSetLocation(conv, state, state.location, state.latitude, state.longitude);
    }

    const requestedDate = this.extractDate(message);
    if (requestedDate) {
      await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_SHOWTIME, { showDate: requestedDate });
      return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, requestedDate);
    }

    if (!state.showDate) {
      await ConversationModel.updateStep(conv.conversation_id, STEPS.SELECT_DATE, {});
      return {
        conversationId: conv.conversation_id,
        message: `Bạn muốn xem lịch chiếu **${state.movieName || 'phim đã chọn'}** vào ngày nào? Ví dụ: “hôm nay” hoặc “ngày mai”. 📅`,
        currentStep: STEPS.SELECT_DATE,
        data: null,
        missingField: 'showDate',
        suggestedActions: [
          { type: 'SELECT_DATE', label: 'Hôm nay', value: localDateValue() },
          { type: 'SELECT_DATE', label: 'Ngày mai', value: localDateValue(new Date(Date.now() + 86400000)) },
        ],
      };
    }

    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, state.showDate);
  },

  async handleDurationQuery(conv, state, databaseMovie = null) {
    const rememberedMovieId = state.discussionMovieId || state.movieId;
    const movie = databaseMovie || (rememberedMovieId ? await MovieModel.findById(rememberedMovieId) : null);
    if (!movie) {
      return {
        conversationId: conv.conversation_id,
        message: 'Mình chưa xác định được phim nào trong danh mục CineX để tra thời lượng. Bạn hãy ghi rõ tên phim nhé.',
        currentStep: conv.current_step,
        data: null,
        missingField: 'movieId',
        suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }],
      };
    }

    if (!movie.duration || Number(movie.duration) <= 0) {
      return {
        conversationId: conv.conversation_id,
        message: `CineX chưa có thông tin thời lượng chính xác của **${movie.title}**.`,
        currentStep: conv.current_step,
        data: { movie: this.sanitizeMovie(movie) },
        missingField: null,
        suggestedActions: [],
      };
    }

    const totalMinutes = Number(movie.duration);
    await ConversationModel.updateState(conv.conversation_id, {
      discussionMovieId: movie.id,
      discussionMovieName: movie.title,
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const readable = hours > 0
      ? `${hours} giờ${minutes ? ` ${minutes} phút` : ''}`
      : `${minutes} phút`;
    return {
      conversationId: conv.conversation_id,
      message: `⏱ **${movie.title}** có thời lượng **${totalMinutes} phút** (${readable}).`,
      currentStep: conv.current_step,
      data: { movie: this.sanitizeMovie(movie), durationMinutes: totalMinutes },
      missingField: null,
      suggestedActions: [
        { type: 'SELECT_MOVIE', label: `Đặt vé ${movie.title}`, value: movie.id },
        { type: 'SHOWTIME_QUERY', label: 'Xem lịch chiếu 📅', value: '' },
      ],
    };
  },

  async handleMovieInfoQuery(conv, state, databaseMovie = null) {
    const rememberedMovieId = state.discussionMovieId || state.movieId;
    const movie = databaseMovie || (rememberedMovieId ? await MovieModel.findById(rememberedMovieId) : null);
    if (!movie) {
      return {
        conversationId: conv.conversation_id,
        message: 'Mình chưa xác định được bạn đang hỏi phim nào. Bạn hãy ghi rõ tên phim trong danh mục CineX nhé.',
        currentStep: conv.current_step,
        data: null,
        missingField: 'movieId',
        suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }],
      };
    }

    await ConversationModel.updateState(conv.conversation_id, {
      discussionMovieId: movie.id,
      discussionMovieName: movie.title,
    });

    let text = `🎬 **${movie.title}**\n\n`;
    if (movie.description) text += `${movie.description}\n\n`;
    if (movie.genre) text += `🏷️ Thể loại: ${movie.genre}\n`;
    if (movie.duration) text += `⏱ Thời lượng: ${movie.duration} phút\n`;
    if (movie.rating) text += `🔞 Phân loại: ${movie.rating}\n`;
    if (movie.director) text += `🎥 Đạo diễn: ${movie.director}\n`;
    if (movie.cast) text += `🌟 Diễn viên: ${movie.cast}\n`;
    if (movie.release_date) text += `📅 Khởi chiếu: ${new Date(movie.release_date).toLocaleDateString('vi-VN')}\n`;
    if (movie.ticket_price) text += `💰 Giá vé từ: ${Number(movie.ticket_price).toLocaleString('vi-VN')}đ\n`;
    const isDifferentFromBooking = state.movieId && Number(state.movieId) !== Number(movie.id);
    if (isDifferentFromBooking) {
      text += `\nℹ️ Vé đang đặt vẫn là **${state.movieName}**. Nếu muốn đổi sang **${movie.title}**, hãy chọn “Đặt vé ${movie.title}”.`;
    }

    return {
      conversationId: conv.conversation_id,
      message: text.trim(),
      currentStep: conv.current_step,
      data: {
        movie: this.sanitizeMovie(movie),
        discussionMovieId: movie.id,
        bookingMovie: state.movieId ? { id: state.movieId, title: state.movieName } : null,
        isDifferentFromBooking: Boolean(isDifferentFromBooking),
      },
      missingField: null,
      suggestedActions: [
        { type: 'SELECT_MOVIE', label: `Đặt vé ${movie.title}`, value: movie.id },
        { type: 'DURATION_QUERY', label: 'Hỏi thời lượng ⏱', value: '' },
        { type: 'SHOWTIME_QUERY', label: 'Xem lịch chiếu 📅', value: '' },
      ],
    };
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
    const seats = (Array.isArray(seatResult) ? seatResult : (seatResult?.seats || [])).map(normalizeSeat);
    const rows = {};
    let availCount = 0;
    seats.forEach(s => {
      if (!rows[s.row_label]) rows[s.row_label] = [];
      rows[s.row_label].push(s);
      if (!s.is_booked) availCount++;
    });

    let text = `🎬 **${showtime.movie_title}** | 🕐 ${showtime.time}\n`;
    text += `💰 ${(showtime.ticket_price || 0).toLocaleString('vi-VN')}đ\n\n`;
    text += `✅ Còn **${availCount}** ghế trống. Chọn ghế trực tiếp trên sơ đồ bên dưới nhé.`;

    return {
      conversationId,
      message: text,
      currentStep: STEPS.SELECT_SEAT,
      data: {
        seats: seats.map(s => ({
          id: s.id, code: seatCode(s),
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

    const seatCodes = message.toUpperCase().split(/[,;\s]+/)
      .filter(s => /^[A-Z]+\d{1,2}$/.test(s))
      .map(code => {
        const match = code.match(/^([A-Z]+)(\d{1,2})$/);
        return `${match[1]}${String(Number(match[2])).padStart(2, '0')}`;
      });
    if (seatCodes.length === 0) {
      return { conversationId: conv.conversation_id, message: 'Vui lòng ghi mã ghế, ví dụ: "E05, E06" 🎯', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatCodes', suggestedActions: [] };
    }

    const seatResult = await SeatModel.getLayout(state.showtimeId);
    const allSeats = (Array.isArray(seatResult) ? seatResult : (seatResult?.seats || [])).map(normalizeSeat);
    const selectedSeats = allSeats.filter(s => seatCodes.includes(seatCode(s)));
    const bookedSeats = selectedSeats.filter(s => s.is_booked);
    const availSeats = selectedSeats.filter(s => !s.is_booked);

    if (bookedSeats.length > 0) {
      return { conversationId: conv.conversation_id, message: `Ghế ${bookedSeats.map(seatCode).join(', ')} đã có người đặt. Vui lòng chọn ghế khác! 😔`, currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }
    if (availSeats.length === 0) {
      return { conversationId: conv.conversation_id, message: 'Ghế không tồn tại. Vui lòng chọn lại! 😔', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }

    const showtime = await ShowtimeModel.findById(state.showtimeId);
    const tPrice = showtime ? (showtime.ticket_price || showtime.price || 75000) : 75000;
    const vPrice = showtime ? (showtime.vip_price || tPrice) : tPrice;

    const seatDetails = availSeats.map(s => ({
      id: s.id, code: seatCode(s),
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
        seatIds: availSeats.map(s => s.id), seatCodes: availSeats.map(seatCode),
        holdCode: hold.hold_code, subtotal, serviceFee, total, seatDetails,
      });

      const concessionProducts = await ConcessionModel.findActive();

      let billText = '**THÔNG TIN ĐẶT VÉ**\n\n';
      billText += `🎬 Phim: ${state.movieName || ''}\n`;
      billText += `📍 Rạp: ${state.cinemaName || ''}\n`;
      billText += `📅 Ngày: ${state.showDate ? new Date(state.showDate).toLocaleDateString('vi-VN') : ''}\n`;
      billText += `🕐 Suất: ${showtime?.time || ''}\n`;
      billText += `🎟️ Ghế: ${seatDetails.map(s => s.code).join(', ')}\n\n`;
      billText += '**Chi tiết:**\n';
      seatDetails.forEach(s => { billText += `   • ${s.code} (${s.type}): ${s.price.toLocaleString('vi-VN')}đ\n`; });
      billText += `   • Phí dịch vụ: ${serviceFee.toLocaleString('vi-VN')}đ\n\n`;
      billText += `**💰 Tạm tính: ${total.toLocaleString('vi-VN')}đ**\n\n`;
      billText += 'Bạn có thể chọn thêm bỏng, nước rồi thanh toán ngay bên dưới.';

      return {
        conversationId: conv.conversation_id,
        message: billText,
        currentStep: STEPS.REVIEW_BILL,
        data: { movie: state.movieName, cinema: state.cinemaName, showtime: this.sanitizeShowtime(showtime), seats: seatDetails, subtotal, serviceFee, total, holdCode: hold.hold_code, concessionProducts },
        missingField: null,
        suggestedActions: [],
      };
    } catch (err) {
      return { conversationId: conv.conversation_id, message: `❌ Lỗi: ${err.message}. Vui lòng thử lại!`, currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }
  },

  async handleConfirmBooking(conv, state, userId, concessions = []) {
    if (!userId) {
      return { conversationId: conv.conversation_id, message: '🔒 Bạn cần **đăng nhập** để đặt vé.', currentStep: STEPS.LOGIN_REQUIRED, data: null, missingField: null, suggestedActions: [] };
    }
    if (!state.holdCode) {
      return { conversationId: conv.conversation_id, message: '❌ Không tìm thấy thông tin giữ ghế. Vui lòng chọn ghế lại!', currentStep: STEPS.SELECT_SEAT, data: null, missingField: 'seatIds', suggestedActions: [] };
    }

    try {
      const bookingResult = await BookingService.createBookingFromHold({
        userId,
        seatHoldCode: state.holdCode,
        concessions,
      });
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
          concessions: bookingResult.concessions || [],
          concessionTotal: bookingResult.concessionTotal || 0,
          seatCodes: state.seatCodes || bookingResult.seatCodes,
          qrCode: pay.qr_code,
          checkoutUrl: pay.checkout_url,
          paymentCode: pay.payment_code,
          orderCode: pay.order_code,
          paymentStatus: 'PENDING',
          expiresAt: pay.expires_at,
          accountName: pay.account_name,
          accountNumber: pay.account_number,
          bankBin: pay.bank_bin,
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
        await ConversationModel.markCompleted(conv.conversation_id);
        let text = `🎉 **ĐẶT VÉ THÀNH CÔNG!** 🎉\n\n`;
        text += `✅ Thanh toán đã được xác nhận.\n`;
        text += `📄 Mã đơn: **${state.bookingCode || ''}**\n`;
        if (checkResult.ticket_code) text += `🎟️ Mã vé: **${checkResult.ticket_code}**\n\n`;
        text += `Bạn có thể xem vé trong mục Profile.\nCảm ơn bạn đã sử dụng CineX! 🍿🎬`;
        return {
          conversationId: conv.conversation_id,
          message: text,
          currentStep: STEPS.COMPLETED,
          data: {
            bookingCode: state.bookingCode,
            ticketCode: checkResult.ticket_code,
            tickets: checkResult.tickets || [],
            paymentStatus: 'PAID',
            bookingStatus: 'CONFIRMED',
          },
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
    return { conversationId: conv.conversation_id, message: 'Bạn muốn xem vào ngày nào? ("hôm nay", "ngày mai") 📅', currentStep: STEPS.SELECT_DATE, data: null, missingField: 'showDate', suggestedActions: [{ type: 'SELECT_DATE', label: 'Hôm nay', value: localDateValue() }, { type: 'SELECT_DATE', label: 'Ngày mai', value: localDateValue(new Date(Date.now() + 86400000)) }] };
  },

  async handleChangeShowtime(conv, state) {
    await ConversationModel.resetToStep(conv.conversation_id, STEPS.SELECT_SHOWTIME, ['userId', 'movieId', 'movieName', 'cinemaId', 'cinemaName', 'location', 'showDate']);
    return this.handleSelectTimeList(conv.conversation_id, state.movieId, state.cinemaId, state.showDate || localDateValue());
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

    if (state.currentStep === STEPS.SELECT_SEAT && state.showtimeId && (state.seatIds || []).length === 0) {
      const codes = message.toUpperCase().split(/[,;\s]+/).filter(s => /^[A-H]\d{1,2}$/.test(s));
      if (codes.length > 0) {
        return await this.handleSelectSeats(conv, state, message, conv.user_id);
      }
    }

    return { conversationId: conv.conversation_id, message: 'Mình chưa hiểu ý bạn. Bạn có thể nói rõ hơn không? 😊\n\nGợi ý:\n• "Xem phim đang chiếu" 🎬\n• "Đặt vé xem [tên phim]" 🎫\n• "Rạp gần [địa chỉ]" 📍', currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }, { type: 'HELP', label: 'Hỗ trợ', value: '' }] };
  },

  greetingResponse(conv) {
    return { conversationId: conv.conversation_id, message: `Xin chào! 👋 Mình là **Trần Dương AI**, trợ lý đặt vé thông minh của CineX.\n\nMình có thể:\n• 🎬 Xem phim đang chiếu\n• 📅 Tra suất chiếu\n• 📍 Tìm rạp gần bạn\n• 🎫 Đặt vé nhanh chóng\n• 💳 Thanh toán qua PayOS\n\nBạn muốn xem phim gì hôm nay? 🎬`, currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }, { type: 'HELP', label: 'Hỗ trợ', value: '' }] };
  },

  helpResponse(conv) {
    return { conversationId: conv.conversation_id, message: `Mình có thể giúp bạn:\n\n🎬 **Xem phim**: "Có phim gì đang chiếu?"\n🎫 **Đặt vé**: Nói "Đặt vé xem [tên phim]" và mình sẽ hướng dẫn!\n📍 **Tìm rạp**: "Rạp gần [địa chỉ]"\n📅 **Suất chiếu**: "Suất chiếu hôm nay"\n\n**Quy trình:**\n1️⃣ Chọn phim\n2️⃣ Chọn khu vực\n3️⃣ Chọn rạp\n4️⃣ Chọn ngày\n5️⃣ Chọn suất chiếu\n6️⃣ Chọn ghế\n7️⃣ Xác nhận và thanh toán PayOS 💳\n\nBạn muốn bắt đầu? 😊`, currentStep: conv.current_step, data: null, missingField: null, suggestedActions: [{ type: 'LIST_MOVIES', label: 'Phim đang chiếu 🎬', value: '' }] };
  },

  sanitizeMovie(m) { return { id: m.id, title: m.title, genre: m.genre, duration: m.duration, rating: m.rating, age_rating: m.age_rating, language: m.language, release_date: m.release_date, description: m.description, ticket_price: m.ticket_price, poster: m.poster, trailer_url: m.trailer_url }; },
  sanitizeCinema(c) { return { id: c.id, name: c.name, address: c.address, district: c.district, city: c.city, brand: c.brand, lat: c.lat, lng: c.lng, rating: c.rating }; },
  sanitizeShowtime(s) { return { id: s.id, movie_id: s.movie_id, cinema_id: s.cinema_id, date: s.date, time: s.time, ticket_price: s.ticket_price || s.price, screen_name: s.screen_name, format: s.format, language: s.language }; },
};

module.exports = ChatService;
