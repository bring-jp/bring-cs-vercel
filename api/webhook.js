const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FD_DOMAIN  = process.env.FRESHDESK_DOMAIN;
const FD_API_KEY = process.env.FRESHDESK_API_KEY;

const CS_PROMPT = `あなたはb.ring日本向けカスタマーサポート専用アシスタントです。

【メール形式（固定）】
書き出し：「お客様\n\nb.ringカスタマーサポートでございます。」
署名：「b.ringカスタマーサポート」
本文トピック区切り：「───────────────」を使用
文体：丁寧だが過度に重くない。不要な謝罪の繰り返し・重複内容・件名生成は禁止。
過去のやり取りがある場合は重複した確認や質問をしないこと。

【アプリ主要パス】
- 再接続：マイページ > リングを接続する
- 初期化：マイページ > スマートリング設定 > デバイス初期化
- 自動測定：マイページ > 自動測定モード（標準／省電力／深層分析）
- センサー補正（Pro）：マイページ > スマートリング設定 > センサー補正
- 接続解除・再接続（Pro）：マイページ > スマートリング設定 > 接続解除 > 再接続
- バックグラウンド更新（iOS）：設定 > アプリ > b.ring > バックグラウンド更新 → オン
- バッテリー最適化（Android）：アプリ情報 > バッテリー > 最適化設定 → 「制限なし」

【製品仕様】
着用方向：bロゴが手のひら側（センサー・発光部が手のひら側）。推奨指：人差し指・中指。
防水：IP68相当。入浴・サウナ・温泉は非推奨。
サイズ感：装着して指の腹を押すと約3mmの隙間が理想。
充電：入力約0.2W（超低電流）。15W以下の一般充電器またはPCのUSBポート推奨。
  USB-PD・65W以上・スマートチャージ充電器は低電流遮断が作動し充電不可になる場合あり。
  USB-Cケーブルは上下逆にして試す（内部配線の向き依存あり）。
充電LED：🔴赤点灯=充電中 / 🟢緑点灯=充電完了 / 🔴赤→🟢緑即消灯=低電流遮断 / 無反応=本体不良の可能性
測定LED：緑=心拍測定時 / 赤=血中酸素測定時のみ（常時点灯ではない）
SpO₂測定範囲：G1旧チップセット(FW v.148)=94〜100% / G1新チップセット=〜85% / Pro=〜80%
G1のSpO₂はBluetooth接続中のみ測定指示を受信（接続切れると記録されない）。
ファームウェア：G1最新=v.148（v.132以下はアップデート推奨）/ Pro最新=v.206（v.2xx系とv.1xx系は非互換）
FW更新が50%で止まる→互換性なしによる正常動作。FW v.0表示→BT接続が不完全。
バッテリー：標準モード・6ヶ月使用時点で約4日持続が正常。1日未満に急減→バッテリー不良→交換。
アプリ：2.1.3以上推奨。2.1.2=センサー補正追加/歩数改善。2.1.3〜2.1.5=BT安定性改善。
素材：センサー部=非金属樹脂 / 電極部=医療グレードSUS / 外装=ステンレス / チタンモデル=チタンコーティング（蒸着）
チタンコーティング不良ロット：2025年7月頃生産分の一部。1〜2ヶ月で著しい剥がれ→不良→交換。
Pro充電：非接触式に近い構造。電極位置がずれると「充電中」表示でも実際は未充電。充電時間約1時間20分。

【iOS注意事項】
- iOS 26/26.1アップデート後のBT不安定→ネットワーク設定のリセット実施
- iOS 26後ヘルスケア連動切れ→ヘルスケア > アカウント > プライバシー > アプリ > b.ring > 全連携OFF > アプリ削除 > 再インストール > 再連携
- 「接続中」のまま固まる→iOSのBTリストからb.ringを削除 > アプリ削除 > 再インストール > 再スキャン

【Android注意事項】
- 開発者モード有効→BT接続・Google Fit連携不可の原因→開発者モードOFF
- Google Fit歩数未反映→プロフィール > 設定 > データとアクセス権限の管理 > データソースと優先度 でb.ring最優先確認。まだ未反映→Google Fitサポートへ問い合わせ案内。

【接続・同期判断】
- bロゴ表示中に固まる→サーバー通信問題→良好な通信環境で再試行
- bロゴ前に固まる→他アプリ（BT・位置情報使用系）との干渉→他アプリ停止
- ストレス・睡眠データがあれば→センサー自体は正常（ストレス=心拍+SpO₂複合計算、睡眠=心拍+SpO₂+動作複合）
- 同期が0%/20%/60%/90%で止まる→改善アプリバージョンをテスト中。アプリ完全終了→再起動で一時改善の場合あり。

【CSポリシー】
- 製品不良・初期不良：返送不要。廃棄または保管案内。必要情報収集後に新品発送。
- バッテリー急劣化（6ヶ月超・6時間まで急減）：保証期間外でも特別交換対応。返送不要。
- サイズ交換（購入15日以内・1回限り）：佐川急便「元払い」で返送。受領後交換品発送。
- 誤配送・誤サイズ：佐川急便「着払い」で返送。即交換品発送。
- 接続不良で交換時：返送メモに「接続不良」記載を依頼（不良判定に有利）。
- 2回連続不良：即再交換。
- 返品・返金：CS直接対応不可。購入元（Amazon・楽天・ヨドバシ等）へ案内。
- ヤマダ電機・ヨドバシへの返金：「CSセンターにて使用環境問題による使用不可判定」を伝えると手続きがスムーズ。
- Makuake注文：CS側で注文情報確認不可→MakuakeマイページよりMakuakeサポートへ問い合わせ案内。
  ただし代理店（株式会社オンキ）からCS直接対応指示がある場合はCS対応可。

【返送先住所（固定）】
〒100-6005 東京都千代田区霞が関3-2-5 霞が関ビル5階 L-07 株式会社APPOSTER JAPAN 050-3562-8810
佐川急便のみ受付。ヤマト運輸等不可。

【交換時の必要情報】
注文番号（購入サイト名と注文番号、またはレシート番号）・お名前・ご住所（郵便番号含む）・お電話番号・モデル/サイズ/カラー

【その他仕様】
- 歩行距離（km）：ヘルスケア連携対象外（仕様）
- ホーム画面SpO₂グラフ：現在未対応（開発チーム認知中）
- カロリーのみ修正→他栄養素は連動しない（全項目修正が必要）
- 1日推奨カロリー：プロフィール（年齢・身長・体重）から自動算出。任意設定は現在未対応。
- +メッセージ：SMS系サービスのためアカウント登録不可。通常メールアドレスを使用。

【禁止事項】
医療機器のような表現・根拠のない改善保証・顧客責任の断定・社内事情の説明・
「（不明な場合は空欄で結構です）」の文言・CS側からの直接返金提案`;

// ─────────────────────────────────────────────
// Freshdesk helpers
// ─────────────────────────────────────────────
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
  const html = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const noteHtml = `
<div style="margin-bottom:16px;background:#EFF6FF;padding:12px;border-radius:8px;border:1px solid #BFDBFE;">
  <p style="margin:0 0 8px;font-size:13px;color:#1E40AF;font-weight:bold;">📋 AI 자동 생성 회신 초안</p>
  <p style="margin:0;font-size:12px;color:#3B82F6;">아래 텍스트를 선택 후 복사(Cmd+C / Ctrl+C)해서 답장 창에 붙여넣으세요.</p>
</div>
<div 
  onclick="
    var range=document.createRange();
    range.selectNodeContents(this);
    var sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  "
  style="background:#F8FAFC;border:2px dashed #93C5FD;border-radius:8px;padding:16px;cursor:text;font-size:13px;line-height:1.8;white-space:pre-wrap;font-family:sans-serif;">
${html}
</div>
<p style="font-size:11px;color:#94A3B8;margin-top:8px;">💡 위 박스 클릭 시 전체 선택됩니다. Cmd+C(Mac) 또는 Ctrl+C(Windows)로 복사하세요.</p>`;

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

// ─────────────────────────────────────────────
// 분류 / 우선순위 / 필드 파싱
// ─────────────────────────────────────────────
function classify(s, b) {
  const t = s + ' ' + b;
  if (/また故障|再度.*交換|交換品.*壊/.test(t))                             return '재불량';
  if (/追跡番号|佐川.*不在/.test(t))                                        return '배송조회';
  if (/返金|返品希望/.test(t))                                              return '반품환불';
  if (/サイズ.*交換|サイズ.*間違|サイズ変更/.test(t))                        return '사이즈교환';
  if (/接続.*できない|Bluetooth|認識しない/.test(t))                         return '연결오류';
  if (/測定.*できない|心拍.*ない|睡眠.*正確|歩数.*おかしい/.test(t))          return '측정오류';
  if (/充電できない|LED.*点灯しない|不具合|故障|交換希望|初期不良|火花/.test(t)) return '초기불량';
  return '기타';
}

function ticketType(type) {
  return {'초기불량':'기기장애','사이즈교환':'요청','반품환불':'반품','재불량':'기기장애','연결오류':'기능장애','측정오류':'기능장애','배송조회':'질문','기타':'질문'}[type] || '질문';
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

// ─────────────────────────────────────────────
// 교환정보 감지 & 파싱
// ─────────────────────────────────────────────

// 도도부현 목록
const PREFECTURES = ['北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬',
  '埼玉','千葉','東京','神奈川','新潟','富山','石川','福井','山梨','長野',
  '岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫','奈良','和歌山',
  '鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡',
  '佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'];

function detectExchangeInfo(body) {
  const hasAddress = PREFECTURES.some(p => body.includes(p));
  const hasOrderNo = /(?:注文番号|オーダーNo|Order\s*No|注文No)[^\n：:]*[：:]\s*[\w\-]+/i.test(body)
    || /\d{3}-\d{7}-\d{7}/.test(body)       // Amazon 형식
    || /\d{9,}/i.test(body);                 // 기타 숫자 주문번호
  return hasAddress && hasOrderNo;
}

function parseExchangeInfo(body, requesterName, ticketId) {
  // 이름
  const namePat = body.match(/(?:お名前|氏名|名前)[：:\s]*([^\n　]{2,20})/);
  const name = namePat ? namePat[1].trim() : requesterName;

  // 주문번호 (Amazon / 숫자 형식 / 라벨 뒤)
  const orderPat = body.match(/(?:注文番号|オーダーNo|Order\s*No|注文No)[^\n：:]*[：:]\s*([\w\-]+)/i)
    || body.match(/(\d{3}-\d{7}-\d{7})/);
  const orderNo = orderPat ? orderPat[1].trim() : '';

  // 구입처 (Amazon / 楽天 / Makuake / ヨドバシ 등)
  const storePat = body.match(/(?:Amazon|楽天|Rakuten|Makuake|ヨドバシ|ヤマダ|PayPay)/i);
  const store = storePat ? storePat[0] : '';

  // 주소 (도도부현 포함 줄 추출)
  const addrPat = PREFECTURES.map(p => {
    const idx = body.indexOf(p);
    if (idx === -1) return null;
    const line = body.slice(Math.max(0, idx - 10), idx + 60).split(/\n/)[0];
    return line.trim();
  }).filter(Boolean);
  const address = addrPat[0] || '';

  // 전화번호
  const telPat = body.match(/(?:電話番号|TEL|Tel|tel)[：:\s]*([\d\-\(\)０-９]{8,})/);
  const tel = telPat ? telPat[1].trim() : '';

  // 제품 (모델·사이즈·색상)
  const prodPat = body.match(/(?:モデル|製品|商品|リングサイズ|サイズ)[：:\s]*([^\n]{3,40})/);
  const product = prodPat ? prodPat[1].trim() : '';

  // 접수일
  const today = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g,'/');

  return {
    ticketId,
    name,
    store,
    receivedDate: today,
    product,
    customerName: name,
    orderNo,
    address,
    tel,
  };
}

// ─────────────────────────────────────────────
// Google Sheets 기록
// ─────────────────────────────────────────────
async function getGoogleAccessToken() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // JWT 생성 (RS256) — Node.js 내장 crypto 사용
  const crypto = require('crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign   = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${body}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${body}.${sig}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function appendToSheet(info) {
  const sheetId   = process.env.GOOGLE_SHEET_ID;
  const sheetName = '반품확인 시트';
  if (!sheetId) { console.warn('[sheets] GOOGLE_SHEET_ID not set'); return; }

  try {
    const token = await getGoogleAccessToken();

    // 시트의 현재 마지막 행 번호 확인 (번호 자동증가용)
    const rangeCheck = encodeURIComponent(`${sheetName}!A:A`);
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeCheck}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const checkData = await checkRes.json();
    const existingRows = (checkData.values || []).length;
    const nextNum = Math.max(existingRows, 1); // 헤더 제외한 데이터 행 수 = 다음 번호

    // 시트 컬럼 순서: 번호/구입자명/판매처/접수일/제품/고객이름/주문번호/진행상황/담당자/사유/비고/계좌정보/반품도착일/환불일/환불금액
    const row = [
      nextNum,            // A: 번호
      info.name,          // B: 구입자명
      info.store,         // C: 판매처
      info.receivedDate,  // D: 접수일
      info.product,       // E: 제품
      info.customerName,  // F: 고객 이름
      info.orderNo,       // G: 주문번호
      '',                 // H: 진행상황 (수동)
      '',                 // I: 담당자 (수동)
      `교환 #${info.ticketId}`, // J: 사유
      info.address ? `주소: ${info.address}` + (info.tel ? ` / TEL: ${info.tel}` : '') : '', // K: 비고
      '',                 // L: 계좌정보 (수동)
      '',                 // M: 반품 도착일 (수동)
      '',                 // N: 환불일 (수동)
      '',                 // O: 환불 금액 (수동)
    ];

    const appendRange = encodeURIComponent(`${sheetName}!A:O`);
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`Sheets append failed: ${appendRes.status} ${errText}`);
    }
    console.log(`[sheets] ticket#${info.ticketId} 교환정보 기록 완료`);
  } catch (e) {
    console.error('[sheets] error:', e.message);
    // Sheets 오류가 나도 webhook 전체는 계속 진행
  }
}

// ─────────────────────────────────────────────
// 메인 핸들러
// ─────────────────────────────────────────────
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

    // ── 교환정보 감지 → Google Sheets 기록 ──
    if (detectExchangeInfo(description_text)) {
      console.log(`[webhook] ticket#${ticketId} 교환정보 감지됨 → Sheets 기록 시작`);
      const info = parseExchangeInfo(description_text, requester_name, ticketId);
      await appendToSheet(info);
    }

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
