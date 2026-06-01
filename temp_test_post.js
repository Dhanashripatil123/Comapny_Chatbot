(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello from test', threadId: 'test123' }),
    });

    console.log('Status', res.status);
    const body = await res.text();
    try {
      console.log(JSON.parse(body));
    } catch (e) {
      console.log(body);
    }
  } catch (err) {
    console.error('Request failed', err);
  }
})();
