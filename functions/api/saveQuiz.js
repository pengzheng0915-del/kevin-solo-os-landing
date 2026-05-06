export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { version, answers, result_type, result_score, result_scores, nickname } = body;

    if (!answers || !result_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const db = env.quiz_db;
    await db.prepare(`
      INSERT INTO quiz_results (session_id, version, answers, result_type, score, result_scores, nickname, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      version || 'unknown',
      JSON.stringify(answers),
      result_type,
      result_score || 0,
      JSON.stringify(result_scores || {}),
      nickname || '',
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      created_at: now
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

function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
