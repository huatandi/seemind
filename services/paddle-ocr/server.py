#!/usr/bin/env python3
"""SeeMind local PaddleOCR service.

Uses only Python stdlib for HTTP. PaddleOCR/PaddlePaddle are optional runtime
dependencies imported lazily. The service binds to 127.0.0.1 by default.
"""
from __future__ import annotations
import base64, json, os, tempfile, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST=os.getenv("SEEMIND_PADDLE_HOST","127.0.0.1")
PORT=int(os.getenv("SEEMIND_PADDLE_PORT","8866"))
MAX_IMAGE_BYTES=int(os.getenv("SEEMIND_PADDLE_MAX_IMAGE_BYTES","5000000"))
_RUNTIME=None
_RUNTIME_ERROR=None

def get_runtime():
    global _RUNTIME,_RUNTIME_ERROR
    if _RUNTIME is not None:
        return _RUNTIME
    if _RUNTIME_ERROR is not None:
        raise RuntimeError(_RUNTIME_ERROR)
    try:
        from paddleocr import PaddleOCR
        # Keep initialization conservative and language-neutral enough for
        # Mexican receipts. Actual model/runtime choices remain replaceable.
        _RUNTIME=PaddleOCR(use_doc_orientation_classify=True,use_doc_unwarping=True,use_textline_orientation=True)
        return _RUNTIME
    except Exception as exc:
        _RUNTIME_ERROR=f"{type(exc).__name__}: {exc}"
        raise

def runtime_state():
    try:
        rt=get_runtime()
        return {"available":True,"runtime":"paddleocr","runtimeClass":type(rt).__name__}
    except Exception as exc:
        return {"available":False,"runtime":"paddleocr","error":str(exc)[:240]}

def run_ocr(image_bytes:bytes,suffix=".png"):
    rt=get_runtime()
    started=time.time()
    path=None
    try:
        with tempfile.NamedTemporaryFile(delete=False,suffix=suffix) as f:
            f.write(image_bytes);path=f.name
        # PaddleOCR 3.x primarily exposes predict(); older releases expose ocr().
        if hasattr(rt,"predict"):
            raw=rt.predict(path)
            lines=normalize_predict(raw)
        elif hasattr(rt,"ocr"):
            raw=rt.ocr(path,cls=True)
            lines=normalize_legacy(raw)
        else:
            raise RuntimeError("Unsupported PaddleOCR runtime API")
        text="\n".join(x["text"] for x in lines if x["text"])
        confidence=(sum(x["confidence"] for x in lines)/len(lines)) if lines else 0.0
        return {
            "text":text,
            "confidence":confidence,
            "blocks":lines,
            "engineVersion":runtime_version(),
            "languages":["spa","eng"],
            "elapsedMs":round((time.time()-started)*1000),
        }
    finally:
        if path:
            try: os.unlink(path)
            except OSError: pass

def normalize_legacy(raw):
    lines=[]
    pages=raw or []
    for page in pages:
        for item in page or []:
            try:
                box,rec=item[0],item[1]
                text=str(rec[0]);conf=float(rec[1])
                lines.append({"text":text,"confidence":clamp(conf),"bbox":flatten_box(box)})
            except Exception:
                continue
    return lines

def normalize_predict(raw):
    lines=[]
    for page in raw or []:
        data=page
        if hasattr(page,"json"):
            try:
                data=page.json
                if callable(data): data=data()
            except Exception: pass
        if hasattr(page,"to_dict"):
            try: data=page.to_dict()
            except Exception: pass
        if not isinstance(data,dict):
            try: data=dict(data)
            except Exception: continue
        texts=first_list(data,["rec_texts","texts","text"])
        scores=first_list(data,["rec_scores","scores","confidence"])
        boxes=first_list(data,["rec_boxes","dt_polys","boxes"])
        for i,text in enumerate(texts):
            if text is None: continue
            score=scores[i] if i<len(scores) else 0.0
            box=boxes[i] if i<len(boxes) else None
            lines.append({"text":str(text),"confidence":clamp(score),"bbox":flatten_box(box)})
    return lines

def first_list(d,keys):
    for k in keys:
        v=d.get(k)
        if isinstance(v,(list,tuple)): return list(v)
        if hasattr(v,"tolist"):
            try:return v.tolist()
            except Exception:pass
    return []

def flatten_box(box):
    if box is None:return None
    if hasattr(box,"tolist"):
        try:box=box.tolist()
        except Exception:return None
    try:
        if len(box)==4 and all(isinstance(x,(int,float)) for x in box):
            return [float(x) for x in box]
        xs=[float(p[0]) for p in box];ys=[float(p[1]) for p in box]
        return [min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys)]
    except Exception:return None

def clamp(v):
    try:v=float(v)
    except Exception:return 0.0
    if v>1:v/=100.0
    return max(0.0,min(1.0,v))

def runtime_version():
    try:
        import paddleocr
        return str(getattr(paddleocr,"__version__","unknown"))
    except Exception:return "unknown"

class Handler(BaseHTTPRequestHandler):
    server_version="SeeMindPaddleOCR/0.27"
    def log_message(self,fmt,*args):
        print("[%s] %s"%(self.log_date_time_string(),fmt%args))
    def do_GET(self):
        if self.path=="/health":
            state=runtime_state()
            return self.send_json(200 if state["available"] else 503,{"status":"ok" if state["available"] else "unavailable",**state,"version":runtime_version()})
        return self.send_json(404,{"error":"NOT_FOUND"})
    def do_POST(self):
        if self.path!="/v1/ocr":
            return self.send_json(404,{"error":"NOT_FOUND"})
        try:
            length=int(self.headers.get("content-length","0"))
            if length<=0 or length>MAX_IMAGE_BYTES*2:
                return self.send_json(413,{"error":"PAYLOAD_TOO_LARGE"})
            body=json.loads(self.rfile.read(length).decode("utf-8"))
            raw=base64.b64decode(body.get("imageBase64",""),validate=True)
            if not raw:return self.send_json(400,{"error":"OCR_IMAGE_REQUIRED"})
            if len(raw)>MAX_IMAGE_BYTES:return self.send_json(413,{"error":"IMAGE_TOO_LARGE"})
            mime=str(body.get("mimeType","image/png"))
            suffix=".jpg" if "jpeg" in mime else ".png"
            result=run_ocr(raw,suffix)
            return self.send_json(200,result)
        except RuntimeError as exc:
            return self.send_json(503,{"error":"PADDLE_RUNTIME_UNAVAILABLE","message":str(exc)[:200]})
        except Exception as exc:
            return self.send_json(400,{"error":"OCR_REQUEST_FAILED","message":f"{type(exc).__name__}"})
    def send_json(self,status,obj):
        data=json.dumps(obj,ensure_ascii=False).encode("utf-8")
        self.send_response(status);self.send_header("content-type","application/json; charset=utf-8")
        self.send_header("content-length",str(len(data)));self.send_header("cache-control","no-store")
        self.end_headers();self.wfile.write(data)

if __name__=="__main__":
    print(f"SeeMind PaddleOCR service listening on http://{HOST}:{PORT}")
    print("Runtime:",runtime_state())
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
