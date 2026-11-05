# bring-cs-vercel

b.ring 일본 CS 자동화. Freshdesk에 티켓이 생기거나 고객 답장이 오면 Freshdesk 자동화 규칙이 `/api/webhook`을 호출하고, 이 함수가 AI로 분류·우선순위·회신 초안을 만들어 티켓에 반영한다.

고객에게 발송은 하지 않는다. 회신 초안은 티켓의 비공개 내부 메모로만 남긴다.

## 동작

1. 티켓의 이전 대화(고객 메일 + 실제 발송된 CS 답변)를 읽는다. AI 메모와 내부 메모는 모델에 보여주지 않는다.
2. 마지막 고객 메시지 이후에 이미 AI 초안이 있으면 아무것도 하지 않는다(같은 갱신으로 자동화가 여러 번 호출되는 경우 대비).
3. Claude가 분류, 우선순위, 증상, 고객 언어, 담당자용 요약, 부족한 교환 정보, 주의점, 회신 초안을 한 번에 판단한다.
   - 우선순위는 키워드 판정과 AI 판정 중 높은 쪽을 쓴다. 안전 관련 건이 낮아지지 않게 하기 위함.
   - 고객이 일본어 외 언어로 쓰면 초안도 그 언어로 쓴다.
   - 영업·광고·스팸은 태그만 붙이고 초안을 만들지 않는다.
4. 티켓에 태그, 우선순위, 유형, 사용자 정의 필드(OS, 앱, FW, 증상)를 넣고 초안을 내부 메모로 남긴다.
5. 우선순위 4(발화·발연·부상·소비자센터·법적 조치 언급)는 #브링cs Slack으로 즉시 알린다. 처리 오류도 같은 채널로 알린다.

Claude 호출이 실패하면(키 문제, 장애) `OPENAI_API_KEY`가 있을 때 OpenAI(gpt-4o-mini)로 한 번 더 시도한다. 메모 헤더의 engine 값으로 어느 쪽이 썼는지 알 수 있다.

## 지식 베이스 (Google Doc)

AI가 참조하는 제품 사양·앱 경로·CS 정책은 코드가 아니라 Google Doc **「b.ring_CS_知識ベース（AI回答案用）」** 에 있다.

- 함수는 `GOOGLE_SERVICE_ACCOUNT_JSON`의 서비스 계정으로 `CS_KNOWLEDGE_DOC_ID` 문서를 읽는다(문서를 그 서비스 계정 이메일에 뷰어로 공유해 둘 것. 이메일은 `/api/health`의 `knowledge.service_account_email`).
- 10분 캐시. 문서를 고치면 재배포 없이 최대 10분 내 반영.
- 읽기 실패 시 직전에 읽은 내용 → 그것도 없으면 코드 내장본(`CS_KNOWLEDGE_BUILTIN`) 순으로 쓴다. 내장본은 비상용이므로 가끔 문서와 맞춰 둔다.
- `/api/health`의 `knowledge.source`가 `drive`면 정상, `builtin`이면 문서를 못 읽고 있는 것.
- 매주 금요일 Claude 스케줄 작업(22번)이 지난주 AI 초안과 담당자 실제 회신을 비교해 문서 수정안을 Slack으로 보낸다. 반영은 사람이 문서를 편집해서 한다.

## Vercel 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| FRESHDESK_DOMAIN | 필수 | 예: `xxx.freshdesk.com` |
| FRESHDESK_API_KEY | 필수 | Freshdesk 프로필 → View API Key. 자동화 전용 에이전트 권장 |
| FRESHDESK_WEBHOOK_SECRET | 권장 | 임의의 긴 문자열. Freshdesk 자동화 규칙의 webhook 헤더 `X-Webhook-Secret`에 같은 값을 넣는다. 없으면 누구나 이 URL을 호출할 수 있다 |
| ANTHROPIC_API_KEY | 권장 | console.anthropic.com → API Keys |
| ANTHROPIC_MODEL | 선택 | 기본 `claude-sonnet-5-5` |
| SLACK_CS_WEBHOOK_URL | 권장 | #브링cs Incoming Webhook 주소 |
| SLACK_MENTION | 선택 | 긴급 알림 멘션. 기본 `<@U047X89UBJ7>` |
| OPENAI_API_KEY | 선택 | Claude 호출 실패 시 백업 |
| CS_KNOWLEDGE_DOC_ID | 권장 | 지식 베이스 Google Doc ID. 없으면 코드 내장본 사용 |
| GOOGLE_SERVICE_ACCOUNT_JSON | 권장 | 서비스 계정 JSON 전체. 지식 베이스 읽기용 |

설정 후 Redeploy. `/api/health`에서 `ai_engine`이 `claude`로 보이면 정상.

## Freshdesk 자동화 규칙

- 트리거: 티켓 생성 시, 그리고 고객 답장으로 티켓이 갱신될 때
- 동작: Trigger webhook → POST `https://<배포주소>/api/webhook`
- 헤더: `Content-Type: application/json`, `X-Webhook-Secret: <FRESHDESK_WEBHOOK_SECRET>`
- 본문(JSON):

```json
{"ticket_id":"{{ticket.id}}","subject":"{{ticket.subject}}","requester_name":"{{ticket.requester.name}}","description_text":"{{ticket.description_text}}"}
```

고객 답장 갱신 트리거에서는 `description_text` 대신 최신 답장 본문 placeholder(`{{ticket.latest_public_comment}}` 등 계정에서 제공되는 것)를 쓴다.

## 로컬 테스트

```bash
node -e "require('./api/webhook.js'); require('./api/health.js'); console.log('ok')"
```

외부 API를 호출하는 통합 테스트는 하지 않는다. 실제 티켓으로 확인할 때는 테스트용 요청자 메일로 티켓을 하나 만들고 내부 메모를 확인한다.
