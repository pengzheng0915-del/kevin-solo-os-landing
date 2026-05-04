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
    const { sid, wechat, paid } = body;

    if (!sid) {
      return new Response(JSON.stringify({ error: 'Missing sid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.quiz_db;
    const updates = [];
    const params = [];

    if (wechat !== undefined) {
      updates.push('wechat = ?');
      params.push(wechat);
    }
    if (paid !== undefined) {
      updates.push('paid = ?');
      params.push(paid ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    params.push(sid);
    await db.prepare(
      `UPDATE quiz_results SET ${updates.join(', ')} WHERE session_id = ?`
    ).bind(...params).run();

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
