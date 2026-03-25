// pages/api/webhook.js
// Freshdesk가 새 티켓/업데이트 시 이 URL로 POST 요청을 보냄
// URL: https://[vercel-url]/api/webhook

import OpenAI from 'openai';
import { classifyEmail, CS_SYSTEM_PROMPT } from '../../lib/cs';
import { getConversations, addPrivateNote, addTag } from '../../lib/freshdesk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Webhook 시크릿 검증
  const secret = req.headers['x-webhook-secret'];
  if (process.env.FRESHDESK_WEBHOOK_SECRET &&
      secret !== process.env.FRESHDESK_WEBHOOK_SECRET) {
    console.warn('[webhook] invalid secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;
  const ticketId    = String(payload.ticket_id || payload.id || '');
  const subject     = payload.subject     || '';
  const fromName    = payload.requester_name  || '';
  const fromEmail   = payload.requester_email || '';
  const bodyText    = payload.description_text || '';

  if (!ticketId || !bodyText) {
    return res.status(400).json({ error: 'ticket_id and description_text required' });
  }

  console.log(`[webhook] ticket#${ticketId} "${subject}"`);

  try {
    // 1. 과거 대화 히스토리 조회
    const conversations = await getConversations(ticketId);

    // 2. 문의 유형 분류
    const type = classifyEmail(subject, bodyText);

    // 3. GPT 프롬프트 구성
    const hasHistory = conversations.length > 0;
    const userContent = hasHistory
      ? `以下はお客様とのメールのやり取り履歴です。流れを踏まえた上で、最新のお客様メッセージに返信してください。

━━━ 過去のやり取り ━━━
${conversations.map(c => {
  const label = c.role === 'support' ? '【CS返信】' : '【お客様】';
  return `${label} (${c.date})\n${c.body}`;
}).join('\n\n')}

━━━ 最新のお客様メッセージ（返信してください）━━━
差出人：${fromName}
件名：${subject}

${bodyText}`
      : `以下のCS問い合わせに返信メールを作成してください。

差出人：${fromName}
件名：${subject}

本文：
${bodyText}`;

    // 4. GPT-4o-mini로 초안 생성
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: CS_SYSTEM_PROMPT },
        { role: 'user',   content: userContent },
      ],
    });

    const draft = completion.choices[0]?.message?.content || '';
    const usage = completion.usage;

    console.log(`[webhook] ticket#${ticketId} type=${type} tokens=${usage?.total_tokens}`);

    // 5. 분류 태그 추가
    await addTag(ticketId, type);

    // 6. Freshdesk 프라이빗 노트로 삽입
    const note = [
      `🤖 AI自動生成の返信初案（GPT-4o-mini）`,
      `分類: ${type}　|　${hasHistory ? `過去${conversations.length}件の履歴参照` : '初回問い合わせ'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      draft,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ AIが生成した初案です。内容を確認してから送信してください。`,
    ].join('\n');

    await addPrivateNote(ticketId, note);

    // Freshdeskに200を返す (失敗時も200で返してリトライを防ぐ)
    res.status(200).json({ success: true, ticketId, type });

  } catch (err) {
    console.error('[webhook] error:', err.message);
    // Freshdeskのリトライを防ぐため200で返す
    res.status(200).json({ success: false, error: err.message });
  }
}
