const pool = require('../config/database.cjs');
const YouTubeService = require('../services/youtube.service.cjs');

async function main() {
  if (!YouTubeService.isConfigured()) {
    throw new Error('YOUTUBE_API_KEY chưa được cấu hình trong .env');
  }

  const limit = process.argv.includes('--all') ? 50 : (Number(process.env.YOUTUBE_TRAILER_SYNC_LIMIT) || 50);
  const result = await YouTubeService.updateMissingTrailers(limit);
  const [[remaining]] = await pool.query(
    "SELECT COUNT(*) AS total FROM movies WHERE trailer_url IS NULL OR trailer_url = ''"
  );
  console.log(`Hoàn tất: kiểm tra ${result.checked}, cập nhật ${result.updated}, không tìm thấy ${result.notFound}, còn thiếu ${remaining.total}`);
}

main()
  .catch(error => {
    console.error('Lỗi cập nhật trailer YouTube:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
