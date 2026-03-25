// pages/api/health.js
// 동작 확인용 엔드포인트
// https://[vercel-url]/api/health 접속하면 OK 뜨면 정상

export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'b.ring CS Webhook',
    time: new Date().toISOString(),
    env: {
      openai:     !!process.env.OPENAI_API_KEY,
      freshdesk:  !!process.env.FRESHDESK_API_KEY,
      domain:     process.env.FRESHDESK_DOMAIN || 'not set',
    },
  });
}
