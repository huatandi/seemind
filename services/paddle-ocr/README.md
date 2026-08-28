# SeeMind Local PaddleOCR Service

This is the real local OCR runtime boundary used by SeeMind v0.27.

It binds to `127.0.0.1:8866` by default and exposes:

- `GET /health`
- `POST /v1/ocr`

The HTTP server itself uses Python standard library. `paddleocr` and `paddlepaddle`
are imported lazily. If they are not installed or cannot initialize, `/health`
returns `503 unavailable` and SeeMind automatically falls back to Tesseract.

## Start

```bash
python -m pip install -r requirements.txt
python server.py
```

Gateway configuration:

```text
SEEMIND_PADDLE_OCR_ENABLED=true
SEEMIND_PADDLE_OCR_ENDPOINT=http://127.0.0.1:8866
SEEMIND_PADDLE_OCR_TIMEOUT_MS=12000
```

Do not expose this service directly to the public internet. SeeMind Gateway is
the boundary consumed by the browser.
