export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const password = url.searchParams.get('pwd');

  if (password !== 'kevin2024') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { sid } = body;

    if (!sid) {
      return new Response(JSON.stringify({ error: 'Missing sid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.quiz_db;
    const { meta } = await db.prepare(
      `DELETE FROM quiz_results WHERE session_id = ?`
    ).bind(sid).run();

    if (meta.changes === 0) {
      return new Response(JSON.stringify({ success: false, message: '记录不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
