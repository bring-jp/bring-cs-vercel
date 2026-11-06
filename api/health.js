const webhook = require('./webhook.js');

module.exports = async (req, res) => {
  let knowledge = { source: 'unknown', chars: 0, error: '' };
  try {
    const kb = await webhook.getKnowledge();
    knowledge = { source: kb.source, chars: (kb.text || webhook.CS_KNOWLEDGE_BUILTIN || '').length, fetched_at: kb.at ? new Date(kb.at).toISOString() : null, error: kb.error || '' };
  } catch (e) { knowledge.error = e.message; }
  let examples = { source: 'unknown', chars: 0, error: '' };
  try {
    const ex = await webhook.getExamples();
    examples = { source: ex.source, chars: (ex.text || '').length, count: ((ex.text || '').match(/◆ 分類/g) || []).length, fetched_at: ex.at ? new Date(ex.at).toISOString() : null, error: ex.error || '' };
  } catch (e) { examples.error = e.message; }
  const ids = webhook.docIds();

  res.setHeader('Access-Control-Allow-Origin', '*');   // 대시보드(아티팩트)에서 상태 조회용. 비밀값 없음
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'b.ring CS Webhook',
    time: new Date().toISOString(),
    env: {
      ai_engine:       process.env.ANTHROPIC_API_KEY ? 'claude' : (process.env.OPENAI_API_KEY ? 'openai' : 'none'),
      anthropic:       !!process.env.ANTHROPIC_API_KEY,
      anthropic_model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      openai_backup:   !!process.env.OPENAI_API_KEY,
      freshdesk:       !!process.env.FRESHDESK_API_KEY,
      domain:          process.env.FRESHDESK_DOMAIN || 'not set',
      webhook_secret:  !!process.env.FRESHDESK_WEBHOOK_SECRET,
      slack_cs:        !!process.env.SLACK_CS_WEBHOOK_URL,
    },
    knowledge: {
      doc_id:                ids.knowledge,
      service_account_email: webhook.serviceAccountEmail() || 'not set',
      ...knowledge,
    },
    examples: { doc_id: ids.examples, ...examples },
  });
};
