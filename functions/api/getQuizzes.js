export async function onRequestGet(context) {
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
    const db = env.quiz_db;
    const { results } = await db.prepare(`
      SELECT session_id, version, answers, result_type, score, result_scores, nickname, wechat, paid, created_at
      FROM quiz_results
      ORDER BY created_at DESC
    `).all();

    const data = results.map(r => ({
      session_id: r.session_id,
      version: r.version,
      answers: safeJson(r.answers),
      result_type: r.result_type,
      result_score: r.score,
      result_scores: safeJson(r.result_scores),
      nickname: r.nickname,
      wechat: r.wechat || '',
      paid: r.paid || 0,
      created_at: r.created_at
    }));

    return new Response(JSON.stringify({ data }), {
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
