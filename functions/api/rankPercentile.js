export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const score = parseFloat(url.searchParams.get('score')) || 0;

  try {
    const db = env.quiz_db;
    const { results } = await db.prepare(`
      SELECT score, result_type FROM quiz_results WHERE score > 0
    `).all();

    const all = results.map(r => ({ score: r.score, type: r.result_type }));

    // Calculate percentile
    const scores = all.map(r => r.score).sort((a, b) => a - b);
    let lower = 0;
    for (const s of scores) {
      if (s < score) lower++;
    }
    const pct = scores.length > 0 ? Math.round((lower / scores.length) * 100) : 50;

    // Type distribution
    const typeCount = {};
    for (const r of all) {
      typeCount[r.type] = (typeCount[r.type] || 0) + 1;
    }

    return new Response(JSON.stringify({
      total: all.length,
      percentile: pct,
      type_distribution: typeCount
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
