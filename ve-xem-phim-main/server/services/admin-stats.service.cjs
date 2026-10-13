const pool = require('../config/database.cjs');

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function buildWeeklySeries(rows, weekCount, now = new Date()) {
  const currentMonday = startOfWeek(now);
  const byStartDate = new Map(rows.map(row => [row.week_start, row]));

  return Array.from({ length: weekCount }, (_, index) => {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - (weekCount - index - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startDate = toDateKey(start);
    const row = byStartDate.get(startDate);

    return {
      start_date: startDate,
      end_date: toDateKey(end),
      label: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
      revenue: Number(row?.revenue || 0),
      booking_count: Number(row?.booking_count || 0),
    };
  });
}

async function getWeeklyRevenue(weekCount = 7) {
  const currentMonday = startOfWeek(new Date());
  const firstMonday = new Date(currentMonday);
  firstMonday.setDate(firstMonday.getDate() - (weekCount - 1) * 7);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(
              DATE_SUB(DATE(COALESCE(paid_at, confirmed_at, created_at)),
                       INTERVAL WEEKDAY(COALESCE(paid_at, confirmed_at, created_at)) DAY),
              '%Y-%m-%d'
            ) AS week_start,
            SUM(total) AS revenue,
            COUNT(*) AS booking_count
       FROM bookings
      WHERE UPPER(status) IN ('PAID', 'CONFIRMED')
        AND COALESCE(paid_at, confirmed_at, created_at) >= ?
        AND COALESCE(paid_at, confirmed_at, created_at) < ?
      GROUP BY week_start
      ORDER BY week_start`,
    [toDateKey(firstMonday), toDateKey(nextMonday)]
  );

  const weeks = buildWeeklySeries(rows, weekCount);
  const current = weeks.at(-1)?.revenue || 0;
  const previous = weeks.at(-2)?.revenue || 0;
  const changePercent = previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;

  return {
    weeks,
    summary: {
      total_revenue: weeks.reduce((sum, week) => sum + week.revenue, 0),
      total_bookings: weeks.reduce((sum, week) => sum + week.booking_count, 0),
      current_week_revenue: current,
      change_percent: changePercent,
    },
  };
}

module.exports = { getWeeklyRevenue, buildWeeklySeries };
