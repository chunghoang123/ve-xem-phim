const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklySeries } = require('../server/services/admin-stats.service.cjs');

test('tạo đủ chuỗi tuần và điền doanh thu bằng 0 cho tuần không có đơn', () => {
  const rows = [
    { week_start: '2026-06-29', revenue: '250000', booking_count: '2' },
    { week_start: '2026-07-13', revenue: '400000', booking_count: '3' },
  ];

  const result = buildWeeklySeries(rows, 3, new Date(2026, 6, 16));

  assert.deepEqual(result, [
    { start_date: '2026-06-29', end_date: '2026-07-05', label: '29/06', revenue: 250000, booking_count: 2 },
    { start_date: '2026-07-06', end_date: '2026-07-12', label: '06/07', revenue: 0, booking_count: 0 },
    { start_date: '2026-07-13', end_date: '2026-07-19', label: '13/07', revenue: 400000, booking_count: 3 },
  ]);
});
