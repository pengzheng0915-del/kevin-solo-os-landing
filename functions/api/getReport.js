export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');

  if (!sid) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const db = env.quiz_db;
    const { results } = await db.prepare(`
      SELECT session_id, version, answers, result_type, score, result_scores, nickname, paid, wechat, created_at
      FROM quiz_results
      WHERE session_id = ?
    `).bind(sid).all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const r = results[0];
    const parsed = safeJson(r.answers);
    return new Response(JSON.stringify({
      session_id: r.session_id,
      version: r.version,
      answers: parsed,
      deep: parsed.deep || null,
      result_type: r.result_type,
      result_score: r.score,
      result_scores: safeJson(r.result_scores),
      nickname: r.nickname,
      paid: r.paid || 0,
      wechat: r.wechat || '',
      created_at: r.created_at
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return str || {}; }
}
