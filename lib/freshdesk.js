// lib/freshdesk.js

const FD_DOMAIN  = process.env.FRESHDESK_DOMAIN;
const FD_API_KEY = process.env.FRESHDESK_API_KEY;

function fdFetch(path, options = {}) {
  const url  = `https://${FD_DOMAIN}/api/v2${path}`;
  const auth = Buffer.from(`${FD_API_KEY}:X`).toString('base64');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...(options.headers || {}),
    },
  });
}

export async function getConversations(ticketId) {
  const res = await fdFetch(`/tickets/${ticketId}/conversations`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(conv => ({
    role: conv.incoming ? 'customer' : 'support',
    date: new Date(conv.created_at).toLocaleString('ja-JP'),
    body: stripHtml(conv.body_text || conv.body || '').slice(0, 600),
  }));
}

// HTML 형식으로 저장 → 개행 정상 표시
export async function addPrivateNote(ticketId, body) {
  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const res = await fdFetch(`/tickets/${ticketId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body: htmlBody, private: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freshdesk note failed: ${res.status} ${err}`);
  }
  return res.json();
}

export async function addTag(ticketId, tag) {
  try {
    const r = await fdFetch(`/tickets/${ticketId}`);
    if (!r.ok) return;
    const ticket = await r.json();
    const tags = [...new Set([...(ticket.tags || []), tag])];
    await fdFetch(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  } catch (e) {
    console.warn('[addTag]', e.message);
  }
}

// custom_fields + 표준 필드(priority, type) 동시 업데이트
export async function updateTicketFields(ticketId, payload) {
  try {
    const res = await fdFetch(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn('[updateTicketFields]', await res.text());
    return res.json();
  } catch (e) {
    console.warn('[updateTicketFields]', e.message);
  }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
