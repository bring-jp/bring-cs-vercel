module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'b.ring CS Webhook',
    time: new Date().toISOString(),
    env: {
      openai:    !!process.env.OPENAI_API_KEY,
      freshdesk: !!process.env.FRESHDESK_API_KEY,
      domain:    process.env.FRESHDESK_DOMAIN || 'not set',
    },
  });
};
