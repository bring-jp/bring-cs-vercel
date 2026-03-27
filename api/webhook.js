const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FD_DOMAIN  = process.env.FRESHDESK_DOMAIN;
const FD_API_KEY = process.env.FRESHDESK_API_KEY;

const CS_PROMPT = `あなたはb.ring日本向けカスタマーサポート専用アシスタントです。
【固定ルール】
- 必ず日本語でメール返信形式で作成する
- 書き出しは必ず：「お客様\n\nb.ringカスタマーサポートでございます。」
- 末尾署名は必ず：「b.ringカスタマーサポート」
- 丁寧だが過度に重くない文体。不要な謝罪の繰り返し禁止。
- 過去のやりとりがある場合は重複した質問や確認をしないこと
【製品・アプリ知識】
- 再接続：マイページ > リングを接続する
- 初期化：マイページ > スマートリング設定 > デバイス初期化
- 自動測定：マイページ > 自動測定モード（心拍数/血中酸素/ストレス）
- 着用方向：bロゴが手のひら側
- Android接続問題：設定 > アプリ > b.ring > バッテリー → 「最適化しない」
【CSポリシー】
- 初期不良・動作不良：返送不要、廃棄または保管を案内、必要情報収集後に新品発送
- サイズ交換：例外対応。着払い（佐川急便）で返送。返送先：〒100-6005 東京都千代田区霞が関3-2-5 霞が関ビル5階 L-07 株式会社APPOSTER JAPAN
- 返品・返金：メーカーとして直接対応不可。ご購入先への案内。不具合明確な場合は交換誘導。
- 2回連続不良：即再交換
- 充電時に火花：即交換対応
【交換時の必要情報】注文番号・氏名・住所・電話番号・モデル/サイズ/カラー
【禁止】医療機器表現・根拠のない保証・返品返金の直接対応約束`;

function fdFetch(path, opts = {}) {
  const auth = Buffer.from(`${FD_API_KEY}:X`).toString('base64');
  return fetch(`https://${FD_DOMAIN}/api/v2${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}`, ...(opts.headers || {}) },
  });
}

async function getConversations(id) {
  try {
    const r = await fdFetch(`/tickets/${id}/conversations`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.map(c => ({
      role: c.incoming ? 'customer' : 'support',
      date: new Date(c.created_at).toLocaleString('ja-JP'),
      body: (c.body_text || c.body || '').replace(/<[^>]+>/g, '').trim().slice(0, 600),
    }));
  } catch { return []; }
}

async function addNote(id, body) {
  const escaped = body.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&/g,'&amp;');
  const rows = (body.match(/\n/g)||[]).length + 3;

  const noteHtml = `
<p style="font-size:13px;color:#1E40AF;font-weight:bold;margin:0 0 6px;">📋 AI 자동 생성 회신 초안 — 아래 박스 클릭 후 전체 선택(Cmd+A / Ctrl+A) → 복사</p>
<textarea
  onclick="this.select();"
  readonly
  rows="${rows}"
  style="width:100%;font-size:13px;line-height:1.8;font-family:sans-serif;padding:12px;border:2px solid #93C5FD;border-radius:8px;background:transparent;color:inherit;resize:vertical;box-sizing:border-box;cursor:text;"
>${escaped}</textarea>`;

  const r = await fdFetch(`/tickets/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body: noteHtml, private: true }),
  });
  if (!r.ok) throw new Error(`note failed: ${r.status}`);
}

async function addTag(id, tag) {
  try {
    const r = await fdFetch(`/tickets/${id}`);
    if (!r.ok) return;
    const t = await r.json();
    const tags = [...new Set([...(t.tags||[]), tag])];
    await fdFetch(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ tags }) });
  } catch (e) { console.warn('[tag]', e.message); }
}

async function updateFields(id, payload) {
  try {
    const r = await fdFetch(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (!r.ok) console.warn('[fields]', await r.text());
  } catch (e) { console.warn('[fields]', e.message); }
}

function classify(s, b) {
  const t = s + ' ' + b;
  if (/また故障|再度.*交換|交換品.*壊/.test(t))                             return '再不良';
  if (/追跡番号|佐川.*不在/.test(t))                                        return '追跡番号';
  if (/返金|返品希望/.test(t))                                              return '返品・返金';
  if (/サイズ.*交換|サイズ.*間違|サイズ変更/.test(t))                        return 'サイズ交換';
  if (/接続.*できない|Bluetooth|認識しない/.test(t))                         return '接続エラー';
  if (/測定.*できない|心拍.*ない|睡眠.*正確|歩数.*おかしい/.test(t))          return '測定エラー';
  if (/充電できない|LED.*点灯しない|不具合|故障|交換希望|初期不良|火花/.test(t)) return '初期不良';
  return 'その他';
}

function ticketType(type) {
  return {'初期不良':'기기장애','サイズ交換':'요청','返品・返金':'반품','再不良':'기기장애','接続エラー':'기능장애','測定エラー':'기능장애','追跡番号':'질문','その他':'질문'}[type] || '질문';
}

function priority(s, b) {
  const t = s + ' ' + b;
  if (/火花|発火|煙|怪我|危険|緊急|至急|早急/.test(t))                             return 4;
  if (/全く使えない|また故障|再度.*不具合|交換品.*壊|2回目|返品|返金/.test(t))       return 3;
  if (/充電できない|接続できない|測定.*されない|LED.*点灯しない|不具合|故障/.test(t)) return 2;
  return 1;
}

function parseFields(b) {
  const f = {};
  const os = b.match(/デバイスOS[：:]\s*(.+)/);
  if (os) {
    f.cf_os = os[1].trim();
    const l = os[1].toLowerCase();
    if (l.includes('ios')||l.includes('iphone')) f.cf_os771346 = 'iOS';
    else if (l.includes('android')) f.cf_os771346 = 'Android';
    const dm = os[1].match(/(?:iOS|Android)\s+[\d.]+\s+(.+?)(?:\s+sdk\d+)?$/i);
    if (dm) f.cf_rand515280 = dm[1].trim();
  }
  const app = b.match(/アプリのバージョン[：:]\s*(.+)/);
  if (app) f.cf_rand296759 = app[1].trim();
  const fw = b.match(/ファームウェアのバージョン[：:]\s*(.+)/);
  if (fw) f.cf_rand655376 = fw[1].trim();
  const sym = symptom(b);
  if (sym) f.cf_rand931886 = sym;
  return f;
}

function symptom(b) {
  if (/充電できない|充電不可|LEDが点灯しない/.test(b)) return '충전 불가';
  if (/充電.*異常|充電.*止まる/.test(b))               return '충전 이상';
  if (/ファームウェア.*更新|アップデート.*できない/.test(b)) return '펌웨어 업데이트';
  if (/接続.*切れ|Bluetooth.*切れ|突然.*切断/.test(b)) return '연결 끊김';
  if (/接続.*できない|繋がらない|認識しない/.test(b))  return '연결 불가';
  if (/心拍.*ない|心拍数.*計測.*されない/.test(b))    return '심박수 없음';
  if (/心拍.*おかしい|心拍.*異常/.test(b))             return '심박수 이상';
  if (/睡眠.*データ.*ない|睡眠.*記録.*されない/.test(b)) return '수면데이터 없음';
  if (/睡眠.*おかしい|睡眠.*短く/.test(b))             return '수면 이상';
  if (/同期.*できない|同期.*されない/.test(b))          return '동기화 불가';
  if (/歩数.*ない|歩数.*カウント.*されない/.test(b))    return '걸음수 없음';
  if (/歩数.*おかしい|歩数.*異常/.test(b))             return '걸음수 이상';
  if (/バッテリー.*減り.*早|電池.*減り.*早/.test(b))    return '배터리 드레인';
  if (/血中酸素.*ない|SpO2.*ない/.test(b))             return '혈중산소 없음';
  if (/血中酸素.*おかしい|SpO2.*異常/.test(b))         return '혈중산소 이상';
  if (/体温.*ない/.test(b))                            return '체온 없음';
  if (/体温.*おかしい/.test(b))                        return '체온 이상';
  if (/データ.*空白|記録.*されない/.test(b))           return '데이터 공백';
  if (/落とした|割れ|物理.*破損/.test(b))              return '물리적 파손';
  if (/ログイン.*できない/.test(b))                    return '로그인 불가';
  if (/ログアウト.*繰り返す|勝手に.*ログアウト/.test(b)) return '로그아웃 빈발';
  if (/リアルタイム.*測定.*できない/.test(b))          return '실시간측정 불가';
  if (/AIレポート.*ない/.test(b))                      return 'AI레포트 없음';
  if (/食事.*記録.*ない/.test(b))                      return 'AI식단 없음';
  if (/運動.*モード|ワークアウト/.test(b))             return '운동모드';
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-webhook-secret'];
  if (process.env.FRESHDESK_WEBHOOK_SECRET && secret !== process.env.FRESHDESK_WEBHOOK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  const { ticket_id, id, subject='', requester_name='', description_text='' } = req.body;
  const ticketId = String(ticket_id || id || '');
  if (!ticketId || !description_text)
    return res.status(400).json({ error: 'ticket_id and description_text required' });

  console.log(`[webhook] ticket#${ticketId} "${subject}"`);

  try {
    const convs    = await getConversations(ticketId);
    const hasHist  = convs.length > 0;
    const type     = classify(subject, description_text);
    const fields   = parseFields(description_text);
    const prio     = priority(subject, description_text);
    const ttype    = ticketType(type);

    const userMsg = hasHist
      ? `以下はお客様とのメールのやり取り履歴です。流れを踏まえた上で、最新のお客様メッセージに返信してください。\n\n━━━ 過去のやり取り ━━━\n${convs.map(c=>`${c.role==='support'?'【CS返信】':'【お客様】'} (${c.date})\n${c.body}`).join('\n\n')}\n\n━━━ 最新のお客様メッセージ ━━━\n差出人：${requester_name}\n件名：${subject}\n\n${description_text}`
      : `以下のCS問い合わせに返信メールを作成してください。\n\n差出人：${requester_name}\n件名：${subject}\n\n本文：\n${description_text}`;

    const comp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 1024, temperature: 0.3,
      messages: [{ role: 'system', content: CS_PROMPT }, { role: 'user', content: userMsg }],
    });

    const draft = comp.choices[0]?.message?.content || '';
    console.log(`[webhook] ticket#${ticketId} done type=${type} prio=${prio}`);

    await addTag(ticketId, type);
    await updateFields(ticketId, { custom_fields: fields, priority: prio, type: ttype });
    await addNote(ticketId, draft);

    res.status(200).json({ success: true, ticketId, type, prio });
  } catch (err) {
    console.error('[webhook] error:', err.message);
    res.status(200).json({ success: false, error: err.message });
  }
};
