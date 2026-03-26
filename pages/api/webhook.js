// pages/api/webhook.js
// Freshdesk Webhook 수신 → GPT 초안 생성 → 프라이빗 노트 삽입

import OpenAI from 'openai';
import { classifyEmail, CS_SYSTEM_PROMPT } from '../../lib/cs';
import { getConversations, addPrivateNote, addTag, updateTicketFields } from '../../lib/freshdesk';

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

  const payload   = req.body;
  const ticketId  = String(payload.ticket_id || payload.id || '');
  const subject   = payload.subject || '';
  const fromName  = payload.requester_name || '';
  const bodyText  = payload.description_text || '';

  if (!ticketId || !bodyText) {
    return res.status(400).json({ error: 'ticket_id and description_text required' });
  }

  console.log(`[webhook] ticket#${ticketId} "${subject}"`);

  try {
    // 1. 과거 대화 히스토리 조회
    const conversations = await getConversations(ticketId);

    // 2. 문의 유형 분류
    const type = classifyEmail(subject, bodyText);

    // 3. 본문에서 유저 정보 파싱
    const fields = parseUserInfo(bodyText);

    // 4. GPT 프롬프트 구성 (히스토리 포함)
    const hasHistory = conversations.length > 0;
    const userContent = hasHistory
      ? `以下はお客様とのメールのやり取り履歴です。流れを踏まえた上で、最新のお客様メッセージに返信してください。\n\n━━━ 過去のやり取り ━━━\n${
          conversations.map(c => {
            const label = c.role === 'support' ? '【CS返信】' : '【お客様】';
            return `${label} (${c.date})\n${c.body}`;
          }).join('\n\n')
        }\n\n━━━ 最新のお客様メッセージ（返信してください）━━━\n差出人：${fromName}\n件名：${subject}\n\n${bodyText}`
      : `以下のCS問い合わせに返信メールを作成してください。\n\n差出人：${fromName}\n件名：${subject}\n\n本文：\n${bodyText}`;

    // 5. GPT-4o-mini로 초안 생성
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

    // 6. 태그 추가
    await addTag(ticketId, type);

    // 7. 커스텀 필드 자동 입력
    if (Object.keys(fields).length > 0) {
      await updateTicketFields(ticketId, fields);
    }

    // 8. 프라이빗 노트 삽입 (초안만 깔끔하게)
    const note = `🤖 AI返信初案（GPT-4o-mini）｜分類: ${type}${hasHistory ? `｜過去${conversations.length}件の履歴参照` : ''}\n\n${draft}`;
    await addPrivateNote(ticketId, note);

    res.status(200).json({ success: true, ticketId, type });

  } catch (err) {
    console.error('[webhook] error:', err.message);
    // Freshdesk 재시도 방지를 위해 200 반환
    res.status(200).json({ success: false, error: err.message });
  }
}

// ── 본문에서 유저 정보 파싱 ──────────────────────────────────
function parseUserInfo(body) {
  const fields = {};

  // OS버전 → cf_os
  const osMatch = body.match(/デバイスOS[：:]\s*(.+)/);
  if (osMatch) fields.cf_os = osMatch[1].trim();

  // OS종류 → cf_os771346 (iOS / Android)
  if (osMatch) {
    const os = osMatch[1].toLowerCase();
    if (os.includes('ios') || os.includes('iphone') || os.includes('ipad')) {
      fields.cf_os771346 = 'iOS';
    } else if (os.includes('android')) {
      fields.cf_os771346 = 'Android';
    }
  }

  // 스마트폰 기종 → cf_rand515280
  const deviceMatch = body.match(/デバイスOS[：:]\s*(?:iOS|Android)\s+(.+?)(?:\s+sdk\d+)?(?:\n|$)/i);
  if (deviceMatch) fields.cf_rand515280 = deviceMatch[1].trim();

  // 앱버전 → cf_rand296759
  const appMatch = body.match(/アプリのバージョン[：:]\s*(.+)/);
  if (appMatch) fields.cf_rand296759 = appMatch[1].trim();

  // 펌웨어 → cf_rand655376
  const fwMatch = body.match(/ファームウェアのバージョン[：:]\s*(.+)/);
  if (fwMatch) fields.cf_rand655376 = fwMatch[1].trim();

  // 증상 자동 분류 → cf_rand931886
  const symptom = detectSymptom(body);
  if (symptom) fields.cf_rand931886 = symptom;

  return fields;
}

// ── 증상 자동 분류 ────────────────────────────────────────────
function detectSymptom(body) {
  if (/充電できない|充電不可|充電.*でき|LEDが点灯しない|充電.*つかない/.test(body))  return '충전 불가';
  if (/充電.*異常|充電.*おかしい|充電.*止まる|充電.*すぐ切れ/.test(body))            return '충전 이상';
  if (/ファームウェア.*更新|アップデート.*できない/.test(body))                        return '펌웨어 업데이트';
  if (/接続.*切れ|Bluetooth.*切れ|突然.*切断|接続が.*途切れ/.test(body))             return '연결 끊김';
  if (/接続.*できない|繋がらない|認識しない|リング.*接続/.test(body))                  return '연결 불가';
  if (/心拍.*ない|心拍数.*計測.*されない|心拍.*表示されない/.test(body))              return '심박수 없음';
  if (/心拍.*おかしい|心拍.*異常|心拍.*不正確/.test(body))                            return '심박수 이상';
  if (/睡眠.*データ.*ない|睡眠.*記録.*されない|睡眠.*表示されない/.test(body))        return '수면데이터 없음';
  if (/睡眠.*おかしい|睡眠.*正確.*ない|睡眠.*異常|睡眠.*短く/.test(body))            return '수면 이상';
  if (/同期.*できない|同期.*されない/.test(body))                                      return '동기화 불가';
  if (/同期.*おかしい|同期.*遅い|同期.*不安定/.test(body))                            return '동기화 불량';
  if (/歩数.*ない|歩数.*カウント.*されない|歩数.*表示されない/.test(body))             return '걸음수 없음';
  if (/歩数.*おかしい|歩数.*異常|歩数.*不正確/.test(body))                            return '걸음수 이상';
  if (/バッテリー.*減り.*早|電池.*減り.*早|すぐ.*充電.*なくなる/.test(body))          return '배터리 드레인';
  if (/血中酸素.*ない|SpO2.*ない|血中酸素.*計測されない/.test(body))                  return '혈중산소 없음';
  if (/血中酸素.*おかしい|SpO2.*異常|血中酸素.*不正確/.test(body))                    return '혈중산소 이상';
  if (/体温.*ない|体温.*計測されない/.test(body))                                      return '체온 없음';
  if (/体温.*おかしい|体温.*異常/.test(body))                                          return '체온 이상';
  if (/データ.*空白|データ.*ない|記録.*されない/.test(body))                           return '데이터 공백';
  if (/落とした|割れ|傷|物理.*破損|壊れ/.test(body))                                  return '물리적 파손';
  if (/ログイン.*できない|サインイン.*できない/.test(body))                            return '로그인 불가';
  if (/ログアウト.*繰り返す|ログアウト.*頻発|勝手に.*ログアウト/.test(body))          return '로그아웃 빈발';
  if (/リアルタイム.*測定.*できない|リアルタイム.*計測.*されない/.test(body))          return '실시간측정 불가';
  if (/AIレポート.*ない|AIレポート.*生成されない/.test(body))                          return 'AI레포트 없음';
  if (/AIレポート.*おかしい|AIレポート.*異常/.test(body))                              return 'AI레포트 이상';
  if (/食事.*記録.*ない|食事.*AI.*ない/.test(body))                                    return 'AI식단 없음';
  if (/運動.*モード|ワークアウト/.test(body))                                           return '운동모드';
  return null;
}
