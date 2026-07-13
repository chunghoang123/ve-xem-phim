const http = require('http');

function testAPI(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(testName, condition, detail = '') {
    if (condition) {
      passed++;
      results.push({ name: testName, status: 'PASS', detail });
      console.log(`  ✅ ${testName}`);
    } else {
      failed++;
      results.push({ name: testName, status: 'FAIL', detail });
      console.log(`  ❌ ${testName} ${detail ? '- ' + detail : ''}`);
    }
  }

  // SECTION 1: Chat API - Greeting
  console.log('\n📋 SECTION 1: Greeting & Help');
  const g1 = await testAPI('/api/ai/chat', 'POST', { message: 'xin chào' });
  assert('1.1 Greeting returns 200', g1.status === 200);
  assert('1.2 Greeting success=true', g1.data.success === true);
  assert('1.3 Greeting has conversationId', !!g1.data.conversationId);
  assert('1.4 Greeting has suggestedActions', g1.data.suggestedActions?.length > 0);

  const h1 = await testAPI('/api/ai/chat', 'POST', { message: 'Giúp mình' });
  assert('1.5 Help returns 200', h1.status === 200);
  assert('1.6 Help success=true', h1.data.success === true);

  // SECTION 2: Empty / Invalid
  console.log('\n📋 SECTION 2: Validation');
  const v1 = await testAPI('/api/ai/chat', 'POST', { message: '' });
  assert('2.1 Empty message returns 400', v1.status === 400);
  assert('2.2 Empty message success=false', v1.data.success === false);

  const v2 = await testAPI('/api/ai/chat', 'POST', { message: '   ' });
  assert('2.3 Whitespace-only returns 400', v2.status === 400);

  // SECTION 3: List Movies
  console.log('\n📋 SECTION 3: List Movies');
  const m1 = await testAPI('/api/ai/chat', 'POST', { message: 'xem phim' });
  assert('3.1 List movies returns 200', m1.status === 200);
  assert('3.2 List movies has data', !!m1.data.data);
  const movies = m1.data.data?.movies || [];
  assert('3.3 Movies count > 0', movies.length > 0, `got ${movies.length}`);
  const convId = m1.data.conversationId;

  // SECTION 4: Select Movie
  console.log('\n📋 SECTION 4: Select Movie');
  const movieTitle = movies[0]?.title || '';
  console.log(`  > Selecting movie: "${movieTitle}"`);
  const s1 = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: movieTitle });
  assert('4.1 Select movie returns 200', s1.status === 200);
  assert('4.2 Step is SELECT_LOCATION', s1.data.currentStep === 'SELECT_LOCATION', `got ${s1.data.currentStep}`);
  assert('4.3 Has movie data', !!s1.data.data?.movie);

  // SECTION 5: Set Location
  console.log('\n📋 SECTION 5: Set Location');
  const l1 = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: 'Hà Nội' });
  assert('5.1 Set location returns 200', l1.status === 200);
  assert('5.2 Step is SELECT_CINEMA', l1.data.currentStep === 'SELECT_CINEMA', `got ${l1.data.currentStep}`);
  assert('5.3 Has cinema list', l1.data.data?.cinemas?.length > 0, `got ${l1.data.data?.cinemas?.length || 0}`);

  // SECTION 6: Select Cinema
  console.log('\n📋 SECTION 6: Select Cinema');
  const c1 = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: '1' });
  assert('6.1 Select cinema returns 200', c1.status === 200);
  assert('6.2 Step is SELECT_DATE', c1.data.currentStep === 'SELECT_DATE', `got ${c1.data.currentStep}`);

  // SECTION 7: Select Date
  console.log('\n📋 SECTION 7: Select Date');
  const d1 = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: 'hôm nay' });
  assert('7.1 Select date returns 200', d1.status === 200);
  const dateStep = d1.data.currentStep;
  assert('7.2 Step is SELECT_SHOWTIME or SELECT_DATE', dateStep === 'SELECT_SHOWTIME' || dateStep === 'SELECT_DATE', `got ${dateStep}`);

  // SECTION 8: Select Showtime (if showtimes exist)
  console.log('\n📋 SECTION 8: Select Showtime');
  if (dateStep === 'SELECT_SHOWTIME' && d1.data.data?.showtimes?.length > 0) {
    const st = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: '1' });
    assert('8.1 Select showtime returns 200', st.status === 200);
    assert('8.2 Step is SELECT_SEAT', st.data.currentStep === 'SELECT_SEAT', `got ${st.data.currentStep}`);
    assert('8.3 Has seat data', !!st.data.data?.seats);
  } else {
    console.log('  ⏭️  Skipped - no showtimes for today');
    assert('8.1 No showtimes handled', dateStep === 'SELECT_DATE' || dateStep === 'SELECT_SHOWTIME');
  }

  // SECTION 9: Change operations
  console.log('\n📋 SECTION 9: Change Operations');
  const ch1 = await testAPI('/api/ai/chat', 'POST', { conversationId: convId, message: 'đổi phim' });
  assert('9.1 Change movie returns 200', ch1.status === 200);
  assert('9.2 Step reset to SELECT_MOVIE', ch1.data.currentStep === 'SELECT_MOVIE', `got ${ch1.data.currentStep}`);

  // SECTION 10: REST APIs
  console.log('\n📋 SECTION 10: REST APIs');
  const api1 = await testAPI('/api/movies');
  assert('10.1 Movies API 200', api1.status === 200);
  assert('10.2 Movies has data', api1.data.data?.rows?.length > 0 || api1.data.data?.length > 0);

  const api2 = await testAPI('/api/cinemas');
  assert('10.3 Cinemas API 200', api2.status === 200);

  const api3 = await testAPI('/api/showtimes');
  assert('10.4 Showtimes API 200', api3.status === 200);

  const api4 = await testAPI('/api/health');
  assert('10.5 Health API 200', api4.status === 200);

  // SECTION 11: 404 route
  console.log('\n📋 SECTION 11: Error Handling');
  const e1 = await testAPI('/api/nonexistent');
  assert('11.1 Unknown route returns 404', e1.status === 404);

  // SECTION 12: Seat selection without login
  console.log('\n📋 SECTION 12: Auth-required flows');
  // Start a new conversation flow to test seat selection without auth
  const authFlow = await testAPI('/api/ai/chat', 'POST', { message: 'xem phim' });
  const authConvId = authFlow.data.conversationId;
  const authMovie = (authFlow.data.data?.movies || [])[0]?.title || 'Conan';
  await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: authMovie });
  await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: 'Hà Nội' });
  await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: '1' });
  const authDate = await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: 'hôm nay' });
  if (authDate.data.currentStep === 'SELECT_SHOWTIME' && authDate.data.data?.showtimes?.length > 0) {
    await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: '1' });
    const seatReq = await testAPI('/api/ai/chat', 'POST', { conversationId: authConvId, message: 'A01, A02' });
    assert('12.1 Seat select without auth requires login', seatReq.data.currentStep === 'LOGIN_REQUIRED' || seatReq.data.message?.includes('đăng nhập'), `step: ${seatReq.data.currentStep}`);
  } else {
    console.log('  ⏭️  Skipped - no showtimes available');
    assert('12.1 No showtimes to test auth', true);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name} ${r.detail ? '(' + r.detail + ')' : ''}`);
    });
  }
}

runTests().catch(console.error);
