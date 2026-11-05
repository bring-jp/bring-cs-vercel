module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'b.ring CS Webhook',
    time: new Date().toISOString(),
    env: {
      ai_engine:      process.env.ANTHROPIC_API_KEY ? 'claude' : (process.env.OPENAI_API_KEY ? 'openai' : 'none'),
      anthropic:      !!process.env.ANTHROPIC_API_KEY,
      anthropic_model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      openai:         !!process.env.OPENAI_API_KEY,
      freshdesk:      !!process.env.FRESHDESK_API_KEY,
      domain:         process.env.FRESHDESK_DOMAIN || 'not set',
      webhook_secret: !!process.env.FRESHDESK_WEBHOOK_SECRET,
      slack_cs:       !!process.env.SLACK_CS_WEBHOOK_URL,
    },
  });
};
