# SeeMind Gateway v0.8

The browser never receives upstream Teacher API keys. The web app sends a provider-independent, minimum-necessary Task Package to this gateway. Logical Teacher IDs (`teacher-a`, `teacher-b`, `teacher-c`) map to server-side provider configuration.

## Vision privacy

Capturing an image does not upload it. The browser prepares a bounded JPEG locally. Only after explicit per-call consent can that temporary image be attached to a Teacher Task Package. The gateway validates media again and refuses image payloads for Teachers that do not declare `vision` capability.

## Teacher health

The Gateway keeps runtime health state for each logical Teacher. Repeated upstream failures degrade and then open a circuit; after the configured cooldown, the Teacher becomes half-open and may be retried. A successful call restores `ready`.

Endpoints:

```text
GET  /health
GET  /v1/teachers
GET  /v1/teachers/:id/health
POST /v1/teacher/execute
```

## Local start

1. Put the values from `gateway/.env.example` into your shell/environment. This prototype intentionally does not load `.env` files automatically.
2. Configure at least one `SEEMIND_TEACHER_A_*` entry.
3. Run `npm run gateway`.
4. Run `npm run dev`.
5. Open `http://localhost:5173/?gateway=http://127.0.0.1:8787`.

The first upstream protocol is `openai-compatible`. It is isolated in `gateway/providers`; it is not a SeeMind Core dependency.

## v0.15 Search retrieval hints

`POST /v1/search` 的 `plan` 可安全携带 `retrievalRound`, `retrievalReason`, `preferredSourceTypes`, `stopCondition`, `taskContext`。这些字段用于定向追证与任务相关来源评分，不包含 Provider API Key。
