const test = require('node:test');
const assert = require('node:assert/strict');
const NvidiaAIService = require('../server/services/nvidia-ai.service.cjs');

test('đọc JSON từ phản hồi NVIDIA có hoặc không có markdown fence', () => {
  assert.deepEqual(
    NvidiaAIService._extractJson('```json\n{"intent":"GREETING"}\n```'),
    { intent: 'GREETING' }
  );
  assert.deepEqual(
    NvidiaAIService._extractJson('Kết quả: {"intent":"HELP"}'),
    { intent: 'HELP' }
  );
});

test('chỉ chấp nhận intent đã khai báo và giới hạn dữ liệu AI', () => {
  assert.equal(NvidiaAIService._sanitizeAnalysis({ intent: 'DELETE_DATABASE' }), null);
  const result = NvidiaAIService._sanitizeAnalysis({
    intent: 'SELECT_CINEMA',
    entities: { cinemaName: 'Beta Tây Sơn', seatCodes: ['A01', 2, 'A02'], genres: ['Hoạt hình', 2] },
    reply: 'Đã hiểu',
  });
  assert.equal(result.intent, 'SELECT_CINEMA');
  assert.equal(result.entities.cinemaName, 'Beta Tây Sơn');
  assert.deepEqual(result.entities.seatCodes, ['A01', 'A02']);
  assert.deepEqual(result.entities.genres, ['Hoạt hình']);
});

test('rút gọn dữ liệu đã xác minh trước khi gửi AI nhưng giữ nguyên sự thật chính', () => {
  const compact = NvidiaAIService._compactGroundedValue({
    movie: { title: 'Câu Chuyện Đồ Chơi 5', duration: 102 },
    showtimes: Array.from({ length: 30 }, (_, index) => ({ time: `${index}:00` })),
  });
  assert.equal(compact.movie.title, 'Câu Chuyện Đồ Chơi 5');
  assert.equal(compact.movie.duration, 102);
  assert.equal(compact.showtimes.length, 20);
});
