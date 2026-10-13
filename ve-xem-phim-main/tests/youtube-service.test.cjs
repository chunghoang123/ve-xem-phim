const test = require('node:test');
const assert = require('node:assert/strict');

const YouTubeService = require('../server/services/youtube.service.cjs');

test('tìm trailer bằng YouTube Data API và ưu tiên kết quả trailer', async () => {
  const originalFetch = global.fetch;
  let requestedUrl = '';
  global.fetch = async url => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          items: [
            { id: { videoId: 'behind-scenes' }, snippet: { title: 'Behind the scenes' } },
            { id: { videoId: 'official-trailer' }, snippet: { title: 'Official Trailer' } },
          ],
        };
      },
    };
  };

  try {
    const result = await YouTubeService.searchYouTubeTrailer('Phim thử nghiệm', '2026-01-01');
    const url = new URL(requestedUrl);
    assert.equal(url.hostname, 'www.googleapis.com');
    assert.match(url.searchParams.get('q'), /Phim thử nghiệm 2026 official trailer/);
    assert.equal(result.videoId, 'official-trailer');
    assert.equal(result.url, 'https://youtube.com/watch?v=official-trailer');
  } finally {
    global.fetch = originalFetch;
  }
});
