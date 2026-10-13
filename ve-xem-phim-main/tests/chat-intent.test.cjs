const test = require('node:test');
const assert = require('node:assert/strict');
const ChatService = require('../server/services/chat.service.cjs');

test('nhận diện giới thiệu và danh sách phim, không nhầm chữ phim với lời chào', () => {
  assert.equal(ChatService.detectIntent('giới thiệu phim hay', { currentStep: 'SELECT_MOVIE' }), 'RECOMMEND_MOVIES');
  assert.equal(ChatService.detectIntent('phim đang chiếu', { currentStep: 'SELECT_MOVIE' }), 'LIST_MOVIES');
  assert.equal(ChatService.detectIntent('hi bạn', { currentStep: 'SELECT_MOVIE' }), 'GREETING');
});

test('nhận diện các bước đặt vé dựa trên bước hội thoại hiện tại', () => {
  assert.equal(ChatService.detectIntent('1', {
    currentStep: 'SELECT_CINEMA', movieId: 1, location: 'Hà Nội',
  }), 'SELECT_CINEMA');
  assert.equal(ChatService.detectIntent('hôm nay', {
    currentStep: 'SELECT_DATE', movieId: 1, cinemaId: 1,
  }), 'SELECT_DATE');
  assert.equal(ChatService.detectIntent('19:30', {
    currentStep: 'SELECT_SHOWTIME', movieId: 1, cinemaId: 1, showDate: '2026-07-13',
  }), 'SELECT_SHOWTIME');
  assert.equal(ChatService.detectIntent('A01, A02', {
    currentStep: 'SELECT_SEAT', movieId: 1, cinemaId: 1, showtimeId: 1, seatIds: [],
  }), 'SELECT_SEATS');
  assert.equal(ChatService.detectIntent('xác nhận', {
    currentStep: 'REVIEW_BILL', movieId: 1, holdCode: 'HOLD-TEST',
  }), 'CONFIRM_BOOKING');
});

test('ưu tiên ngày người dùng nhập rõ ràng thay vì ngày AI suy đoán', () => {
  assert.equal(
    ChatService.resolveActionMessage('SELECT_DATE', '15/7/2026', { date: '2026-07-13' }),
    '2026-07-15'
  );
});

test('lọc bắt buộc đúng thể loại khi người dùng yêu cầu phim hoạt hình', () => {
  const movies = [
    { title: 'Ám Ảnh', genre: 'Kinh dị, Giật gân' },
    { title: 'Bạch Xà 3', genre: 'Hoạt hình, Lãng mạn, Kỳ ảo' },
    { title: 'Câu Chuyện Đồ Chơi 5', genre: 'Hoạt hình, Gia đình, Hài hước' },
  ];
  const genres = ChatService.extractRequestedGenres(
    'hãy gợi ý cho mình một số phim hoạt hình',
    movies
  );
  assert.deepEqual(genres, ['Hoạt hình']);
  assert.deepEqual(
    ChatService.filterMoviesByGenres(movies, genres).map(movie => movie.title),
    ['Bạch Xà 3', 'Câu Chuyện Đồ Chơi 5']
  );
});

test('nhận diện động tỉnh thành có dấu hoặc không dấu từ dữ liệu', () => {
  const locations = ['Hà Nội', 'Thanh Hóa', 'Nghệ An', 'Cà Mau', 'Thành phố Hồ Chí Minh'];
  assert.equal(ChatService.matchLocationName('Thanh Hoá', locations), 'Thanh Hóa');
  assert.equal(ChatService.matchLocationName('rạp ở nghe an', locations), 'Nghệ An');
  assert.equal(ChatService.matchLocationName('tìm rạp tại Cà Mau', locations), 'Cà Mau');
  assert.equal(ChatService.matchLocationName('hcm', locations), 'Hồ Chí Minh');
});

test('cho phép nhập địa điểm trước khi chọn phim', () => {
  assert.equal(ChatService.isIntentAllowed('SET_LOCATION', { currentStep: 'SELECT_MOVIE' }), true);
});

test('ưu tiên luồng tra lịch chiếu thay vì để AI trò chuyện lan man', () => {
  assert.equal(ChatService.detectIntent('phim này chiếu lúc mấy giờ', {
    currentStep: 'SELECT_LOCATION', movieId: 12, movieName: 'Câu Chuyện Đồ Chơi 5',
  }), 'SHOWTIME_QUERY');
  assert.equal(ChatService.detectIntent('lịch chiếu phim Câu Chuyện Đồ Chơi 5', {
    currentStep: 'SELECT_MOVIE',
  }), 'SHOWTIME_QUERY');
});

test('chỉ khớp tên phim thực sự xuất hiện trong câu người dùng', () => {
  const movies = [
    { id: 1, title: 'Câu Chuyện Đồ Chơi 5' },
    { id: 2, title: 'Ám Ảnh' },
  ];
  assert.equal(
    ChatService.matchMovieFromCatalog('đặt vé phim Câu Chuyện Đồ Chơi 5', movies).id,
    1
  );
  assert.equal(ChatService.matchMovieFromCatalog('đặt vé phim Avengers', movies), null);
});

test('coi ký tự & và từ và là cùng một cách viết trong tên phim', () => {
  const movies = [{ id: 10, title: 'Minions & Quái Vật' }];
  assert.equal(
    ChatService.matchMovieFromCatalog('thế phim Minions và Quái Vật', movies).id,
    10
  );
});

test('đưa câu hỏi thời lượng vào luồng dữ liệu thay vì câu trả lời tự do của AI', () => {
  assert.equal(ChatService.detectIntent('phim ám ảnh thời lượng bao nhiêu', {
    currentStep: 'SELECT_MOVIE',
  }), 'DURATION_QUERY');
  assert.equal(ChatService.detectIntent('Câu Chuyện Đồ Chơi 5 dài bao lâu', {
    currentStep: 'SELECT_MOVIE',
  }), 'DURATION_QUERY');
  assert.equal(ChatService.detectIntent('phim này mấy phút', {
    currentStep: 'SELECT_LOCATION', movieId: 34,
  }), 'DURATION_QUERY');
});

test('nhận diện câu hỏi nối tiếp về phim và vẫn ưu tiên câu hỏi thời lượng', () => {
  assert.equal(ChatService.detectIntent('thế phim Minions và Quái Vật', {
    currentStep: 'SELECT_LOCATION', movieId: 7,
  }), 'MOVIE_INFO_QUERY');
  assert.equal(ChatService.detectIntent('thế phim này dài bao lâu', {
    currentStep: 'SELECT_LOCATION', movieId: 7, discussionMovieId: 10,
  }), 'DURATION_QUERY');
});
