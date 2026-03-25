// pages/index.js
export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#F1F5F9' }}>
        <div style={{ width: 64, height: 64, background: '#2563EB', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, margin: '0 auto 20px' }}>b</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>b.ring CS Webhook</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Freshdesk → GPT-4o-mini → Freshdesk Note</p>
        <div style={{ background: '#1E293B', borderRadius: 12, padding: '16px 24px', display: 'inline-block' }}>
          <div style={{ fontSize: 13, color: '#10B981' }}>● 稼働中</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Webhook: <code style={{ color: '#93C5FD' }}>/api/webhook</code>
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Health: <code style={{ color: '#93C5FD' }}>/api/health</code>
          </div>
        </div>
      </div>
    </div>
  );
}
