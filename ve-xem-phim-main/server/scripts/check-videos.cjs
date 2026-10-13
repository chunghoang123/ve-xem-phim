const { fetchTMDB } = require('../services/tmdb.service.cjs');

async function check() {
  const tmdbIds = [1339713, 1083381, 1280738, 1315772, 1081003, 1108427, 1212763,
    454639, 372058, 1375646, 1564614, 12429, 1251900, 68883, 1207123,
    1418308, 1481390, 1368337, 969681, 1383731, 1724051];

  for (const id of tmdbIds) {
    try {
      const detail = await fetchTMDB(`/movie/${id}`, { append_to_response: 'videos' });
      const videos = detail.videos?.results || [];
      if (videos.length > 0) {
        console.log(`\n--- TMDB ${id}: ${detail.title} ---`);
        videos.forEach(v => console.log(`  type=${v.type}, site=${v.site}, key=${v.key}, name=${v.name}`));
      } else {
        console.log(`  TMDB ${id}: ${detail.title} -> không có video nào`);
      }
    } catch (err) {
      console.log(`  TMDB ${id}: error - ${err.message}`);
    }
  }
  process.exit(0);
}
check();
