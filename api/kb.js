// 지식 베이스·반신 예시집(Google Doc) 읽기/쓰기 — 주간 학습 루프(22번)와 유지보수용
// 인증: x-webhook-secret (webhook 과 동일)
//   GET  /api/kb?doc=knowledge|examples          → { content }
//   POST /api/kb  { doc, content, note }         → 문서 전체 교체 (Google Docs 버전 기록에 남음)
//   POST /api/kb  { slack: "본문(markdown)" }     → CS Slack 채널(SLACK_CS_WEBHOOK_URL)에 게시
const webhook = require('./webhook');
const K = webhook.kbInternals;

const REQUIRED = {
  knowledge: ['【CSポリシー】', '【返送先住所（固定）】', '【製品仕様】', '【変更履歴】'],
  examples:  ['◆ 分類', '【お客様】', '【返信例】'],
};

async function driveToken(scope) {
  const sa = K.loadServiceAccount();
  if (!sa) throw new Error('service account not configured');
  return K.googleAccessToken(sa, scope);
}
async function readDoc(id) {
  const t = await driveToken('https://www.googleapis.com/auth/drive.readonly');
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`drive read ${r.status}`);
  return (await r.text()).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []; let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => fin(''), 5000);
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => fin(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => fin(''));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = req.headers['x-webhook-secret'];
  if (!process.env.FRESHDESK_WEBHOOK_SECRET || secret !== process.env.FRESHDESK_WEBHOOK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const ids = { knowledge: K.KNOWLEDGE_DOC_ID, examples: K.EXAMPLES_DOC_ID };
  try {
    if (req.method === 'GET') {
      const doc = (req.query && req.query.doc) || 'knowledge';
      if (!ids[doc]) return res.status(400).json({ error: 'doc must be knowledge|examples' });
      const content = await readDoc(ids[doc]);
      return res.status(200).json({ doc, doc_id: ids[doc], chars: content.length, content });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    let body; try { body = JSON.parse(await readBody(req)); } catch (_) { return res.status(400).json({ error: 'invalid json' }); }

    if (typeof body.slack === 'string' && body.slack.trim()) {
      await K.notifySlack(body.slack.slice(0, 11500));
      return res.status(200).json({ success: true, posted: 'slack' });
    }

    const doc = body.doc; const content = String(body.content || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!ids[doc]) return res.status(400).json({ error: 'doc must be knowledge|examples' });
    const missing = REQUIRED[doc].filter(m => !content.includes(m));
    if (missing.length) return res.status(422).json({ error: 'required sections missing', missing });
    const current = await readDoc(ids[doc]);
    // 실수로 내용이 크게 줄어드는 교체를 막는다
    if (content.length < current.length * 0.7 && body.allow_shrink !== true)
      return res.status(422).json({ error: 'content shrank more than 30%', current_chars: current.length, new_chars: content.length });
    if (content === current) return res.status(200).json({ success: true, unchanged: true });
    const t = await driveToken('https://www.googleapis.com/auth/drive');
    const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${ids[doc]}?uploadType=media&supportsAllDrives=true`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'text/plain; charset=utf-8' }, body: content,
    });
    if (!r.ok) return res.status(502).json({ error: `drive write ${r.status}`, detail: (await r.text()).slice(0, 300) });
    K.resetCaches();
    console.log(`[kb] ${doc} updated ${current.length}→${content.length} chars. note=${String(body.note || '').slice(0, 200)}`);
    return res.status(200).json({ success: true, doc, previous_chars: current.length, new_chars: content.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 300) });
  }
};
