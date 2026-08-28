import { OcrEngine } from '../../core/ocr/ocr-engine.js';
import {withDeadline} from '../../core/performance/timeout.js';

/**
 * Tesseract adapter. The runtime is intentionally loaded behind the adapter so
 * Core never depends on a specific OCR vendor. For v0.2 the web demo can load
 * Tesseract.js on demand; future native/Paddle engines can replace this class.
 */
export class TesseractOcrEngine extends OcrEngine {
  constructor({ loader, workerInitTimeoutMs=18000, autoLanguage='eng', maxHotWorkers=3, maxQueueDepth=3, burstRetentionBudgetMs=2500, maxConcurrentWorkerInits=2, maxWorkerInitWaiters=4, maxWorkerInitStarvationMs=1200 } = {}) {
    super('tesseract-js',{
      version:'6.0.1',
      providerType:'local',
      languages:['auto'],
      capabilities:{text:true,blocks:true,bboxes:true,orientation:false},
      priority:50,
    });
    this.loader = loader ?? loadTesseract;
    this.workers = new Map();
    this.workerInitTimeoutMs=Math.max(250,Number(workerInitTimeoutMs)||18000);
    // Tesseract's implicit default for an unspecified language is English. Resolve
    // the app-level `auto` hint to that same bootstrap model explicitly so the
    // worker can stay hot instead of paying create/terminate cost on every pass.
    // This remains adapter-local and configurable; higher layers stay locale-neutral.
    this.autoLanguage=toTesseractLanguage(autoLanguage)??'eng';
    // A global product can encounter many languages in one session. Keeping every
    // traineddata worker alive indefinitely turns language coverage into a WASM
    // memory leak. Bound the hot set and evict only idle least-recently-used workers.
    this.maxHotWorkers=Math.max(1,Math.min(8,Number(maxHotWorkers)||3));
    // Bound per-language backlog. A camera burst must not retain an arbitrary
    // number of full-resolution image objects behind one single-threaded worker.
    this.maxQueueDepth=Math.max(1,Math.min(8,Number(maxQueueDepth)||3));
    // Bound how much learned recognition work a burst may retain in memory. This
    // adapts queue depth to the actual device/language speed: a fast desktop may
    // keep a short useful burst, while a slow/thermal mobile device stops retaining
    // full images that would only become stale. It never activates before enough
    // successful local timing evidence exists.
    this.burstRetentionBudgetMs=Math.max(250,Math.min(10000,Number(burstRetentionBudgetMs)||2500));
    // Creating several traineddata/WASM workers at once is much more expensive than
    // running several already-hot workers. Cap cross-language cold starts so a
    // multilingual camera burst cannot spike memory/CPU and freeze the UI.
    this.maxConcurrentWorkerInits=Math.max(1,Math.min(4,Number(maxConcurrentWorkerInits)||2));
    // Bound cross-language cold-start backlog too. Requests waiting for an init
    // slot still retain their source image at the caller boundary; an unbounded
    // language burst could therefore consume memory before the per-language OCR
    // queue protections even get a chance to run.
    this.maxWorkerInitWaiters=Math.max(1,Math.min(16,Number(maxWorkerInitWaiters)||4));
    // EDF protects urgent camera requests, but a sustained stream of short deadlines
    // must not starve an older viable language forever. After this bounded wait, an
    // admissible waiter is promoted ahead of newer EDF traffic.
    this.maxWorkerInitStarvationMs=Math.max(100,Math.min(10000,Number(maxWorkerInitStarvationMs)||1200));
    this._activeWorkerInits=0;
    this._workerInitWaiters=[];
    this._workerInitWaiterSeq=0;
    this._workerLastUsed=new Map();
    this._workerBusy=new Set();
    // Reservation counts cover the tiny hand-off window between obtaining a worker
    // and publishing its queue tail. This is separate from _workerBusy because
    // several same-language callers may reserve the same hot worker concurrently.
    this._workerReservations=new Map();
    this._lifecycleGeneration=0;
    this._isDisposing=false;
    this._runtime=null;
    this._runtimePromise=null;
    this._usageTick=0;
    this._retiringWorkers=new Set();
    this._queueDepths=new Map();
    // Per-language warm recognition estimate. This lets a request with a hard
    // route deadline avoid joining a queue that cannot plausibly finish in time.
    // It is deliberately learned locally instead of hard-coding device/model speed.
    this._recognitionEwmaMs=new Map();
    // Queue rejection is a correctness-sensitive optimization. One unusually slow
    // first sample (GC, thermal ramp, tab resume) must not teach the adapter to
    // reject later images. Keep sample count + jitter and only predict after a
    // small evidence floor.
    this._recognitionSampleCount=new Map();
    this._recognitionJitterEwmaMs=new Map();
    // Track the currently running recognition start per language. Deadline admission
    // can then charge only the learned *remaining* service time of an in-flight OCR
    // instead of pessimistically charging a full extra recognition for work already
    // mostly complete. This reduces false burst rejection without guessing before
    // language-local timing evidence exists.
    this._activeRecognitionStartedAt=new Map();
    // Learn cold-start cost on this device. If worker creation itself is repeatedly
    // expensive, serialize future cross-language cold starts to avoid CPU/WASM
    // contention. Fast devices retain the configured concurrency.
    this._workerInitEwmaMs=null;
    this._workerInitJitterEwmaMs=0;
    this._workerInitSampleCount=0;
    // Traineddata sizes and initialization costs vary dramatically by language.
    // Keep language-local cold-start evidence so a fast Latin model cannot teach
    // the scheduler that a heavier CJK model will also fit the same deadline.
    this._workerInitLanguageEwmaMs=new Map();
    this._workerInitLanguageJitterEwmaMs=new Map();
    this._workerInitLanguageSampleCount=new Map();
  }

  async warmup() {
    await withDeadline(this._loadRuntime(),12000,'OCR_RUNTIME_TIMEOUT');
    return {engineId:this.id,runtimeReady:true,policy:'RUNTIME_ONLY_NO_RECOGNITION'};
  }


  async _loadRuntime({timeoutMs=12000,signal=null}={}) {
    // Cancellation must be checked before constructing the shared loader promise.
    // Otherwise an already-stale camera request can still trigger the expensive
    // Tesseract runtime download/initialization even though its caller has gone.
    if(signal?.aborted){const error=new Error('OCR_ABORTED');error.code='OCR_ABORTED';throw error}
    if(this._runtime)return this._runtime;
    if(!this._runtimePromise){
      const generation=this._lifecycleGeneration;
      // Keep promise ownership generation-safe. A loader from a disposed lifecycle
      // can settle after a new lifecycle has already installed its own runtime
      // promise; the stale catch must not clear that newer single-flight promise.
      let ownedPromise;
      ownedPromise=Promise.resolve().then(()=>this.loader()).then(runtime=>{
        if(generation!==this._lifecycleGeneration){
          const error=new Error('OCR_ENGINE_DISPOSED'); error.code='OCR_ENGINE_DISPOSED'; throw error;
        }
        this._runtime=runtime;
        return runtime;
      }).catch(error=>{
        // Never memoize a transient loader failure or lifecycle rejection, but only
        // clear the promise if this exact lifecycle still owns the cache slot.
        if(this._runtimePromise===ownedPromise)this._runtimePromise=null;
        throw error;
      });
      this._runtimePromise=ownedPromise;
    }
    return withDeadline(this._runtimePromise,Math.max(1,Number(timeoutMs)||12000),'OCR_RUNTIME_TIMEOUT',{signal,abortCode:'OCR_ABORTED'});
  }

  _estimatedWorkerInitMs(language=null,{allowGlobalFallback=true}={}){
    if(language){
      const samples=this._workerInitLanguageSampleCount.get(language)??0;
      const mean=this._workerInitLanguageEwmaMs.get(language);
      if(samples>=3&&mean!=null)return mean+(this._workerInitLanguageJitterEwmaMs.get(language)??0);
      // A global average is useful for CPU-contention control, but it is not
      // evidence that a never-seen language model can meet a hard deadline.
      // Traineddata size/init cost varies sharply by language, so deadline
      // rejection must remain conservative until this language has evidence.
      if(!allowGlobalFallback)return null;
    }
    if(this._workerInitSampleCount<3||this._workerInitEwmaMs==null)return null;
    return this._workerInitEwmaMs+(this._workerInitJitterEwmaMs??0);
  }

  _estimatedRecognitionMs(language=null){
    if(!language)return null;
    const samples=this._recognitionSampleCount.get(language)??0;
    const mean=this._recognitionEwmaMs.get(language);
    if(samples<3||mean==null)return null;
    return mean+(this._recognitionJitterEwmaMs.get(language)??0);
  }

  _effectiveWorkerInitConcurrency(language=null){
    const estimate=this._estimatedWorkerInitMs(language);
    if(estimate==null)return this.maxConcurrentWorkerInits;
    // Learn the safe cold-start policy from this runtime instead of hard-coding a
    // device class. Include jitter because a burst scheduler must plan for tail
    // latency, not only the mean. Scale the threshold with the configured init
    // budget so stricter deployments become conservative earlier.
    const contentionThreshold=Math.min(2500,Math.max(750,this.workerInitTimeoutMs*0.35));
    return estimate>contentionThreshold?1:this.maxConcurrentWorkerInits;
  }

  _recordWorkerInitTiming(durationMs,language=null){
    const sample=Number(durationMs);
    if(!Number.isFinite(sample)||sample<=0)return;
    const previous=this._workerInitEwmaMs;
    const previousJitter=this._workerInitJitterEwmaMs??0;
    this._workerInitEwmaMs=previous==null?sample:(previous*0.7+sample*0.3);
    const deviation=previous==null?0:Math.abs(sample-previous);
    this._workerInitJitterEwmaMs=previous==null?0:(previousJitter*0.7+deviation*0.3);
    this._workerInitSampleCount++;
    if(language){
      const languagePrevious=this._workerInitLanguageEwmaMs.get(language);
      const languageJitter=this._workerInitLanguageJitterEwmaMs.get(language)??0;
      const languageDeviation=languagePrevious==null?0:Math.abs(sample-languagePrevious);
      this._workerInitLanguageEwmaMs.set(language,languagePrevious==null?sample:(languagePrevious*0.7+sample*0.3));
      this._workerInitLanguageJitterEwmaMs.set(language,languagePrevious==null?0:(languageJitter*0.7+languageDeviation*0.3));
      this._workerInitLanguageSampleCount.set(language,(this._workerInitLanguageSampleCount.get(language)??0)+1);
    }
  }

  async _acquireWorkerInitSlot({deadlineAt=null,maxWaitMs=null,signal=null,language=null}={}){
    if(signal?.aborted){const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';throw e}
    const remaining=remainingDeadlineMs(deadlineAt);
    if((remaining!=null&&remaining<=0)||(maxWaitMs!=null&&Number(maxWaitMs)<=0)){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
    const estimatedInitMs=this._estimatedWorkerInitMs(language,{allowGlobalFallback:false});
    const estimatedRecognitionMs=this._estimatedRecognitionMs(language);
    // A cold worker is useful only if the route can plausibly survive both worker
    // creation and the recognition that follows. Once this exact language has
    // enough successful local evidence, reject a mathematically hopeless cold
    // start before allocating another WASM worker. Unknown languages remain fully
    // admissible so performance prediction can never suppress first-use accuracy.
    if(remaining!=null&&estimatedInitMs!=null&&estimatedRecognitionMs!=null&&remaining<estimatedInitMs+estimatedRecognitionMs){
      const e=new Error('OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE');e.code='OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE';throw e;
    }
    // Even with a free semaphore slot, do not start a learned-hopeless cold init.
    // This avoids burning CPU/WASM and retaining the image for a worker that the
    // route deadline will necessarily discard moments later.
    if(remaining!=null&&estimatedInitMs!=null&&remaining<estimatedInitMs){
      const e=new Error('OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE');e.code='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE';throw e;
    }
    if(this._activeWorkerInits<this._effectiveWorkerInitConcurrency(language)){this._activeWorkerInits++;return 0}
    if(this._workerInitWaiters.length>=this.maxWorkerInitWaiters){
      const e=new Error('OCR_WORKER_INIT_QUEUE_OVERLOADED');e.code='OCR_WORKER_INIT_QUEUE_OVERLOADED';throw e;
    }
    const waitStartedAt=monotonicNow();
    // When all init slots are occupied, each full wave of waiters costs roughly one
    // learned cold-start service time. If the route deadline cannot survive the
    // waves already ahead, reject before retaining the source image through a
    // hopeless cold-start queue. Never apply this before three successful samples.
    if(remaining!=null&&estimatedInitMs!=null){
      const concurrency=Math.max(1,this._effectiveWorkerInitConcurrency(language));
      // A queued request must survive both the currently active init wave and its
      // own eventual init wave. The previous estimate counted only the wait wave,
      // so a request with ~1.5x one init duration could be admitted even though it
      // needed ~2x and was guaranteed to expire after obtaining the semaphore.
      const occupied=Math.min(concurrency,this._activeWorkerInits);
      // Do not count every existing waiter as guaranteed work ahead of this request.
      // Dispatch is EDF + aging and waiters can have different per-language
      // concurrency limits, so queue length is not a mathematically valid FIFO
      // completion estimate. Treating it as one caused viable urgent languages to
      // be rejected merely because less-urgent waiters happened to be present.
      // Only the currently active init wave is unavoidable; dispatch-time viability
      // is rechecked again when a real slot becomes available.
      const waitWaves=occupied>0?1:0;
      const completionWaves=waitWaves+1;
      // First-use value arrives only after the queued cold-start waves *and* the
      // recognition that follows. When both estimates are evidence-backed for this
      // exact language, include recognition in admission rather than approving a
      // worker that is guaranteed to finish too late to produce useful text.
      const queuedColdStartMs=estimatedInitMs*completionWaves;
      const estimatedFirstResultMs=estimatedRecognitionMs==null?queuedColdStartMs:queuedColdStartMs+estimatedRecognitionMs;
      if(remaining<estimatedFirstResultMs){
        const code=estimatedRecognitionMs==null?'OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE':'OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE';
        const e=new Error(code);e.code=code;throw e;
      }
    }
    const boundedWait=minimumPositive(remaining,maxWaitMs);
    let waiter;
    const gate=new Promise((resolve,reject)=>{
      waiter={resolve,reject,signal,language,deadlineAt,sequence:++this._workerInitWaiterSeq,enqueuedAt:monotonicNow(),onAbort:null};
      this._workerInitWaiters.push(waiter);
    });
    if(signal){
      waiter.onAbort=()=>{
        const index=this._workerInitWaiters.indexOf(waiter);
        if(index>=0)this._workerInitWaiters.splice(index,1);
        const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';waiter.reject(e);
      };
      signal.addEventListener?.('abort',waiter.onAbort,{once:true});
    }
    try{
      if(boundedWait==null)await gate;
      else await withDeadline(gate,Math.max(1,boundedWait),'OCR_WORKER_INIT_TIMEOUT',{
        signal,abortCode:'OCR_ABORTED',onTimeout:()=>{const i=this._workerInitWaiters.indexOf(waiter);if(i>=0)this._workerInitWaiters.splice(i,1)},
      });
      return elapsedMs(waitStartedAt);
    }finally{
      if(waiter.onAbort)signal?.removeEventListener?.('abort',waiter.onAbort);
    }
  }

  _releaseWorkerInitSlot(generation=this._lifecycleGeneration){
    // A cold start from an older lifecycle may settle after dispose() and after a
    // new lifecycle has already acquired init slots. Never let that stale finally
    // decrement the new generation's semaphore count or dispatch its waiters.
    if(generation!==this._lifecycleGeneration)return;
    // Release first, then refill only up to the *current* adaptive limit. If slow
    // init evidence shrinks concurrency from 2→1 while two cold starts are active,
    // blindly transferring the released slot to a waiter would keep two starts in
    // flight forever and defeat the adaptive scheduler exactly under contention.
    this._activeWorkerInits=Math.max(0,this._activeWorkerInits-1);
    // Waiters may have different learned safe concurrency (for example a heavy
    // CJK model can be serialized while a proven-fast Latin model may safely use
    // the second slot). Pick the earliest waiter that is currently admissible
    // instead of letting a conservative head waiter block every language behind it.
    while(this._workerInitWaiters.length){
      for(let i=this._workerInitWaiters.length-1;i>=0;i--){
        const waiter=this._workerInitWaiters[i];
        if(!waiter.signal?.aborted)continue;
        // Do not silently splice an aborted waiter. Real AbortSignal dispatches an
        // event, but signal-like adapters used by native shells/tests may expose
        // only the `aborted` state. Silently removing those waiters leaves their
        // gate promise pending forever and leaks the retained request lifecycle.
        this._workerInitWaiters.splice(i,1);
        const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';
        waiter.reject(e);
      }
      // Drop waiters whose route deadline expired while another language was
      // initializing. Also re-check learned completion viability at dispatch time:
      // a waiter can be viable when queued, then become mathematically hopeless
      // after a slower-than-usual active init. Giving it the newly released slot
      // would burn CPU/WASM and delay a request that can still finish on time.
      for(let i=this._workerInitWaiters.length-1;i>=0;i--){
        const waiter=this._workerInitWaiters[i];
        if(waiter.deadlineAt==null)continue;
        const remaining=remainingDeadlineMs(waiter.deadlineAt);
        if(remaining<=0){
          this._workerInitWaiters.splice(i,1);
          const e=new Error('OCR_WORKER_INIT_TIMEOUT');e.code='OCR_WORKER_INIT_TIMEOUT';
          waiter.reject(e);
          continue;
        }
        const estimatedInitMs=this._estimatedWorkerInitMs(waiter.language,{allowGlobalFallback:false});
        const estimatedRecognitionMs=this._estimatedRecognitionMs(waiter.language);
        const estimatedFirstResultMs=estimatedInitMs==null?null:estimatedInitMs+(estimatedRecognitionMs??0);
        if(estimatedFirstResultMs!=null&&remaining<estimatedFirstResultMs){
          this._workerInitWaiters.splice(i,1);
          const code=estimatedRecognitionMs==null?'OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE':'OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE';
          const e=new Error(code);e.code=code;
          waiter.reject(e);
        }
      }
      // Snapshot scheduler time once. Calling the clock inside Array.sort's
      // comparator makes the ordering time-dependent/non-transitive near the aging
      // threshold: the same waiter can flip from non-aged to aged halfway through
      // one sort. A single scheduling epoch keeps EDF + aging deterministic.
      const schedulingNow=monotonicNow();
      const admissible=this._workerInitWaiters
        .map((waiter,index)=>({waiter,index}))
        .filter(({waiter})=>this._activeWorkerInits<Math.max(1,this._effectiveWorkerInitConcurrency(waiter.language)));
      // Aging must prevent starvation without sacrificing a request that is already
      // close to its latest safe cold-start time. When we have language-local timing
      // evidence, protect those critical-deadline waiters before applying aging.
      // This keeps the fairness policy from turning into a correctness regression.
      const critical=admissible.filter(({waiter})=>{
        if(waiter.deadlineAt==null)return false;
        const initEstimate=this._estimatedWorkerInitMs(waiter.language,{allowGlobalFallback:false});
        if(initEstimate==null)return false;
        const recognitionEstimate=this._estimatedRecognitionMs(waiter.language);
        const firstResultEstimate=initEstimate+(recognitionEstimate??0);
        const remaining=remainingDeadlineMs(waiter.deadlineAt);
        return remaining!=null&&remaining<=firstResultEstimate+this.maxWorkerInitStarvationMs;
      });
      const schedulingPool=critical.length?critical:admissible;
      schedulingPool.sort((a,b)=>{
        const deadlineA=Number.isFinite(Number(a.waiter.deadlineAt))?Number(a.waiter.deadlineAt):Infinity;
        const deadlineB=Number.isFinite(Number(b.waiter.deadlineAt))?Number(b.waiter.deadlineAt):Infinity;
        if(critical.length)return (deadlineA-deadlineB)||(a.waiter.sequence-b.waiter.sequence);
        // Earliest-deadline-first reduces camera-burst tail latency, but bounded
        // aging prevents a continuous stream of urgent requests from starving an
        // older viable language forever. Once aged, FIFO sequence wins among aged
        // waiters; otherwise EDF remains authoritative.
        const agedA=schedulingNow-a.waiter.enqueuedAt>=this.maxWorkerInitStarvationMs;
        const agedB=schedulingNow-b.waiter.enqueuedAt>=this.maxWorkerInitStarvationMs;
        if(agedA!==agedB)return agedA?-1:1;
        if(agedA&&agedB)return a.waiter.sequence-b.waiter.sequence;
        return (deadlineA-deadlineB)||(a.waiter.sequence-b.waiter.sequence);
      });
      const selected=schedulingPool[0];
      if(!selected)break;
      const [waiter]=this._workerInitWaiters.splice(selected.index,1);
      this._activeWorkerInits++;
      waiter.resolve();
    }
  }

  _reserveWorker(language){this._workerReservations.set(language,(this._workerReservations.get(language)??0)+1)}
  _releaseWorkerReservation(language){const next=Math.max(0,(this._workerReservations.get(language)??1)-1);if(next)this._workerReservations.set(language,next);else this._workerReservations.delete(language)}

  _touchWorker(language){
    // Logical monotonic recency avoids Date.now() ties during bursty OCR requests.
    this._workerLastUsed.set(language,++this._usageTick);
  }

  async dispose() {
    // A replacement recognition must never start while the previous lifecycle is
    // still draining workers. Otherwise dispose() can reset the init semaphore to
    // zero and a new lifecycle can create fresh WASM workers while stale workers
    // are still initializing/terminating, temporarily defeating the concurrency and
    // memory caps. Reject work during this narrow teardown window; reuse is allowed
    // again as soon as disposal completes.
    if(this._isDisposing)return;
    this._isDisposing=true;
    this._lifecycleGeneration++;
    // Hot workers are intentionally retained across recognitions, but the adapter
    // still needs an explicit lifecycle boundary for route/provider replacement,
    // page teardown and tests. Clear ownership first so a concurrent later call
    // cannot pick a worker that is already being terminated. Worker promises may
    // still be initializing; resolving them before terminate also covers that race.
    const workerPromises=[...this.workers.values()];
    this.workers.clear();
    this._queues?.clear();
    this._progress?.clear();
    this._workerLastUsed?.clear();
    this._workerBusy?.clear();
    this._workerReservations?.clear();
    this._queueDepths?.clear();
    this._recognitionEwmaMs?.clear();
    this._recognitionSampleCount?.clear();
    this._recognitionJitterEwmaMs?.clear();
    this._activeRecognitionStartedAt?.clear();
    this._workerInitEwmaMs=null;
    this._workerInitJitterEwmaMs=0;
    this._workerInitSampleCount=0;
    this._workerInitLanguageEwmaMs?.clear();
    this._workerInitLanguageJitterEwmaMs?.clear();
    this._workerInitLanguageSampleCount?.clear();
    const disposedError=new Error('OCR_ENGINE_DISPOSED');disposedError.code='OCR_ENGINE_DISPOSED';
    for(const waiter of this._workerInitWaiters??[]){try{waiter.reject(disposedError)}catch{}}
    this._workerInitWaiters=[];
    this._workerInitWaiterSeq=0;
    this._activeWorkerInits=0;
    const retiring=[...(this._retiringWorkers??[])];
    this._retiringWorkers?.clear();
    this._runtime=null;
    this._runtimePromise=null;
    try{
      await Promise.allSettled([...workerPromises.map(workerPromise=>terminateWorkerPromiseSafely(workerPromise)),...retiring]);
    }finally{
      this._isDisposing=false;
    }
  }

  async _retireWorker(language,deadlineAt=null) {
    const workerPromise=this.workers.get(language);
    if(!workerPromise)return false;
    this.workers.delete(language);
    this._workerLastUsed.delete(language);
    this._progress?.delete(language);
    const retirement=Promise.resolve(workerPromise)
      .then(worker=>terminateWorkerSafely(worker,boundedStageTimeout(1500,remainingDeadlineMs(deadlineAt))))
      .catch(()=>{});
    this._retiringWorkers.add(retirement);
    retirement.finally(()=>this._retiringWorkers.delete(retirement)).catch(()=>{});
    return true;
  }

  async _trimIdleWorkers(deadlineAt=null) {
    // A temporary overflow is allowed while any cached worker is busy or still
    // initializing. Waiting until the burst fully settles avoids cache churn where
    // an idle language is retired only because another language is momentarily
    // initializing. The last completing task will re-enter this trim.
    if(this._workerBusy?.size)return;
    while(this.workers.size>this.maxHotWorkers){
      const candidates=[...this.workers.keys()]
        .filter(language=>!this._workerBusy?.has(language)&&!(this._workerReservations?.get(language)>0)&&!this._queues?.has(language)&&!(this._queueDepths?.get(language)>0))
        .sort((a,b)=>(this._workerLastUsed.get(a)??0)-(this._workerLastUsed.get(b)??0));
      const victim=candidates[0];
      if(!victim)break;
      await this._retireWorker(victim,deadlineAt);
    }
  }

  async _evictIdleWorkerIfNeeded(incomingLanguage,deadlineAt=null) {
    if(this.workers.has(incomingLanguage)||this.workers.size<this.maxHotWorkers)return;
    const candidates=[...this.workers.keys()]
      .filter(language=>!this._workerBusy?.has(language)&&!(this._workerReservations?.get(language)>0)&&!this._queues?.has(language)&&!(this._queueDepths?.get(language)>0))
      .sort((a,b)=>(this._workerLastUsed.get(a)??0)-(this._workerLastUsed.get(b)??0));
    const victim=candidates[0];
    if(!victim)return; // All workers are busy: correctness beats the memory cap temporarily.
    // Do not put worker termination on the incoming request's critical path. A
    // slow WASM terminate used to add up to 1.5s before the new language worker
    // could even start. Ownership is removed synchronously; retirement continues
    // in the background and dispose() still drains it at the lifecycle boundary.
    await this._retireWorker(victim,deadlineAt);
  }

  async recognize(image, { language = 'auto', onProgress, timeoutMs=null, deadlineAt=null, signal=null } = {}) {
    const startedAt=monotonicNow();
    const timing={runtimeWaitMs:0,workerInitThrottleWaitMs:0,workerInitWaitMs:0,queueWaitMs:0,recognitionMs:0};
    const lifecycleGeneration=this._lifecycleGeneration;
    if(this._isDisposing){const e=new Error('OCR_ENGINE_DISPOSING');e.code='OCR_ENGINE_DISPOSING';throw e}
    if(signal?.aborted){const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';throw e}
    if(timeoutMs!=null&&Number.isFinite(Number(timeoutMs))&&Number(timeoutMs)<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
    const languageHint=String(language??'auto').trim().toLowerCase();
    const requestedLanguage=toTesseractLanguage(languageHint);
    const isAuto=!languageHint||languageHint==='auto';
    // Reject unsupported explicit languages before loading the ~large OCR runtime.
    // Forwarding an arbitrary BCP-47 tag to Tesseract can trigger a doomed
    // traineddata fetch and make a simple routing mismatch look like a hang.
    if(!isAuto&&!requestedLanguage){
      const error=new Error('OCR_LANGUAGE_UNSUPPORTED'); error.code='OCR_LANGUAGE_UNSUPPORTED'; throw error;
    }
    const trainedLanguage=requestedLanguage??(isAuto?this.autoLanguage:null);
    const remainingBeforeRuntime=remainingDeadlineMs(deadlineAt);
    if(remainingBeforeRuntime!=null&&remainingBeforeRuntime<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
    // The hottest path must not reload/await the OCR runtime at all. Once a
    // language worker exists it is self-sufficient; waiting on the loader here was
    // measurable first-result latency and could even make a healthy hot worker fail
    // because an unrelated runtime loader retry timed out.
    let workerPromise=trainedLanguage?this.workers.get(trainedLanguage):null;
    const workerCacheHit=Boolean(workerPromise);
    const hotWorkerCountBefore=this.workers.size;
    let workerCreated=false;
    let workerInitShared=false;
    let workerReady=false;
    let recognitionAttempted=false;
    let queueDepth=0;
    let adaptiveQueueDepth=this.maxQueueDepth;
    let Tesseract=null;
    if(!workerPromise){
      onProgress?.({status:'ocr-runtime-loading'});
      const runtimeTimeout=boundedStageTimeout(12000,remainingBeforeRuntime);
      const runtimeStartedAt=monotonicNow();
      Tesseract=await this._loadRuntime({timeoutMs:runtimeTimeout,signal});
      timing.runtimeWaitMs=elapsedMs(runtimeStartedAt);
      if(lifecycleGeneration!==this._lifecycleGeneration){const e=new Error('OCR_ENGINE_DISPOSED');e.code='OCR_ENGINE_DISPOSED';throw e}
      // Another same-language request may have published its worker while both
      // callers were awaiting the shared cold runtime. Re-check ownership here to
      // prevent duplicate WASM workers and duplicate traineddata initialization.
      if(trainedLanguage){
        workerPromise=this.workers.get(trainedLanguage)??null;
        if(workerPromise)workerInitShared=true;
      }
    }
    let result;
    // Tesseract.recognize() creates and tears down a worker for every call.
    // Keep a language-scoped worker hot so repeated photos avoid that startup tax.
    if (workerPromise || (Tesseract?.createWorker && trainedLanguage)) {
      if(!workerPromise){
        // Publish the initialization promise before the first await. This is the
        // per-language single-flight lock: two cold requests arriving in the same
        // microtask turn must never create two large WASM workers.
        this._workerBusy.add(trainedLanguage);
        onProgress?.({status:'ocr-worker-loading',language:trainedLanguage});
        workerCreated=true;
        const workerInitStartedAt=monotonicNow();
        // `workerInitTimeoutMs` is a total cold-start budget, not a fresh budget
        // for every sub-stage. Under a multilingual burst a request can spend most
        // of that budget waiting for the global init semaphore; giving it another
        // full timeout afterwards used to turn an 18s guard into 36s+ latency.
        const initBudgetDeadline=Date.now()+boundedStageTimeout(this.workerInitTimeoutMs,remainingDeadlineMs(deadlineAt));
        const effectiveInitDeadline=deadlineAt==null?initBudgetDeadline:Math.min(Number(deadlineAt),initBudgetDeadline);
        workerPromise=(async()=>{
          let slotAcquired=false;
          try{
            timing.workerInitThrottleWaitMs=await this._acquireWorkerInitSlot({
              // The language-scoped initialization is shared infrastructure, not
              // request-owned work. If the first caller aborts while this init is still
              // waiting for a global cold-start slot, cancelling the semaphore waiter
              // would reject the shared single-flight promise for every live follower.
              // Request-local cancellation is enforced while each caller awaits the
              // shared promise below; keep the shared init itself independent here.
              deadlineAt:effectiveInitDeadline,maxWaitMs:this.workerInitTimeoutMs,signal:null,language:trainedLanguage,
            });
            slotAcquired=true;
            if(lifecycleGeneration!==this._lifecycleGeneration){const e=new Error('OCR_ENGINE_DISPOSED');e.code='OCR_ENGINE_DISPOSED';throw e}
            await this._evictIdleWorkerIfNeeded(trainedLanguage,effectiveInitDeadline);
            const remainingAfterEviction=remainingDeadlineMs(effectiveInitDeadline);
            if(remainingAfterEviction!=null&&remainingAfterEviction<=0){const e=new Error('OCR_WORKER_INIT_TIMEOUT');e.code='OCR_WORKER_INIT_TIMEOUT';throw e}
            const actualInitStartedAt=monotonicNow();
            const createdWorker=await createWorkerWithCleanup(
              Tesseract.createWorker(trainedLanguage,undefined,{logger:m=>this._progress?.get(trainedLanguage)?.(m)}),
              boundedStageTimeout(this.workerInitTimeoutMs,remainingAfterEviction),
              null, // shared single-flight init must not be owned by the first request's AbortSignal
            );
            // Only successful worker creation teaches the adaptive scheduler;
            // timeout/abort/loader failures must not poison device performance data.
            this._recordWorkerInitTiming(elapsedMs(actualInitStartedAt),trainedLanguage);
            return createdWorker;
          }finally{if(slotAcquired)this._releaseWorkerInitSlot(lifecycleGeneration)}
        })();
        this.workers.set(trainedLanguage,workerPromise);
        workerPromise.finally(()=>{timing.workerInitWaitMs=elapsedMs(workerInitStartedAt)}).catch(()=>{});
      }
      let workerReserved=false;
      try{
        this._reserveWorker(trainedLanguage);workerReserved=true;
        const workerWaitStartedAt=monotonicNow();
        // A caller that is merely sharing another request's cold initialization
        // must keep its own cancellation/deadline semantics. Awaiting the shared
        // promise directly made a stale second photo wait until the first caller's
        // potentially multi-second WASM init finished. Bound only this caller's
        // wait; do not cancel or retire the shared initialization it does not own.
        const sharedWaitRemaining=!workerCreated?remainingDeadlineMs(deadlineAt):null;
        const worker=!workerCreated
          ? (sharedWaitRemaining==null
              ? await awaitAbortable(workerPromise,signal,'OCR_ABORTED')
              : await withDeadline(workerPromise,Math.max(1,sharedWaitRemaining),'OCR_BUDGET_EXHAUSTED',{signal,abortCode:'OCR_ABORTED'}))
          : await (remainingDeadlineMs(deadlineAt)==null
              ? awaitAbortable(workerPromise,signal,'OCR_ABORTED')
              : withDeadline(workerPromise,Math.max(1,remainingDeadlineMs(deadlineAt)),'OCR_WORKER_INIT_TIMEOUT',{signal,abortCode:'OCR_ABORTED'}));
        workerReady=true;
        if(!workerCreated&&workerInitShared)timing.workerInitWaitMs=elapsedMs(workerWaitStartedAt);
        if(lifecycleGeneration!==this._lifecycleGeneration){
          this._workerBusy.delete(trainedLanguage);
          const error=new Error('OCR_ENGINE_DISPOSED'); error.code='OCR_ENGINE_DISPOSED'; throw error;
        }
        this._workerBusy.delete(trainedLanguage);
        this._touchWorker(trainedLanguage);
        this._progress??=new Map(); this._queues??=new Map();
        const previous=this._queues.get(trainedLanguage)??Promise.resolve();
        queueDepth=this._queueDepths.get(trainedLanguage)??0;
        const remainingForQueue=remainingDeadlineMs(deadlineAt);
        // Require repeated successful observations before a learned estimate is
        // allowed to reject work. Include learned jitter so burst admission is not
        // based on an unrealistically optimistic mean.
        const estimatedRecognitionMs=this._estimatedRecognitionMs(trainedLanguage);
        // Once we have real timing evidence for this device/language, do not retain
        // another full image behind queued work when its route deadline is already
        // impossible. Keep a small 15% scheduling margin; with no evidence we admit
        // normally so first-use accuracy is never sacrificed by a guessed constant.
        // Adapt the hard backlog cap to learned service time. The cap counts the
        // currently running/queued slot consistently with _queueDepths. With no
        // trustworthy samples we retain the configured cap and preserve first-use
        // correctness. The minimum remains one so a slow device can still process
        // one image instead of being disabled by its own performance history.
        adaptiveQueueDepth=estimatedRecognitionMs==null
          ? this.maxQueueDepth
          : Math.max(1,Math.min(this.maxQueueDepth,Math.floor(this.burstRetentionBudgetMs/Math.max(1,estimatedRecognitionMs))));
        if(queueDepth>=adaptiveQueueDepth){
          const error=new Error('OCR_QUEUE_OVERLOADED'); error.code='OCR_QUEUE_OVERLOADED';
          error.queueDepth=queueDepth; error.adaptiveQueueDepth=adaptiveQueueDepth;
          throw error;
        }
        let estimatedQueueServiceMs=null;
        if(estimatedRecognitionMs!=null){
          const activeStartedAt=this._activeRecognitionStartedAt.get(trainedLanguage);
          const activeElapsedMs=activeStartedAt==null?null:elapsedMs(activeStartedAt);
          // _queueDepths includes the currently running task. If it is already in
          // flight, estimate only its remaining learned service, then add any fully
          // queued predecessors plus this request. Fall back to the conservative
          // full-service estimate when no active-start evidence is available.
          if(queueDepth>0&&activeElapsedMs!=null){
            const activeRemainingMs=Math.max(0,estimatedRecognitionMs-activeElapsedMs);
            const queuedAhead=Math.max(0,queueDepth-1);
            estimatedQueueServiceMs=(activeRemainingMs+(queuedAhead+1)*estimatedRecognitionMs)*1.15;
          }else estimatedQueueServiceMs=estimatedRecognitionMs*(queueDepth+1)*1.15;
        }
        if(remainingForQueue!=null&&estimatedRecognitionMs!=null){
          // Even with no queue, starting a recognition that cannot plausibly finish
          // before the route deadline only burns CPU and keeps a full image alive.
          // This guard activates only after repeated successful language-local
          // samples, preserving first-use correctness.
          const minimumServiceMs=queueDepth>0?estimatedQueueServiceMs:estimatedRecognitionMs;
          if(remainingForQueue<minimumServiceMs){
            const code=queueDepth>0?'OCR_QUEUE_DEADLINE_IMPOSSIBLE':'OCR_RECOGNITION_DEADLINE_IMPOSSIBLE';
            const error=new Error(code);error.code=code;throw error;
          }
        }
        this._queueDepths.set(trainedLanguage,queueDepth+1);
        const queuedAt=monotonicNow();
        // Do not let a queued promise retain a large Canvas/ImageBitmap after its
        // request is already cancelled or its route deadline has expired. Keep the
        // only queue-owned reference in a mutable holder and clear it eagerly.
        const imageHolder={value:image};
        let queueExpiryTimer=null;
        let depthReleased=false;
        const releaseQueueDepth=()=>{
          if(depthReleased)return;
          depthReleased=true;
          const remainingDepth=Math.max(0,(this._queueDepths.get(trainedLanguage)??1)-1);
          if(remainingDepth)this._queueDepths.set(trainedLanguage,remainingDepth);else this._queueDepths.delete(trainedLanguage);
        };
        const releaseQueuedImage=()=>{imageHolder.value=null};
        const onQueuedAbort=()=>{releaseQueuedImage();releaseQueueDepth()};
        signal?.addEventListener?.('abort',onQueuedAbort,{once:true});
        if(deadlineAt!=null){
          const untilExpiry=remainingDeadlineMs(deadlineAt);
          if(untilExpiry!=null&&untilExpiry>0)queueExpiryTimer=setTimeout(()=>{releaseQueuedImage();releaseQueueDepth()},untilExpiry);
          else {releaseQueuedImage();releaseQueueDepth()}
        }
        // The route-level deadline must also govern time spent waiting behind a hot
        // worker. Otherwise an outer timeout can return to the UI while this request
        // remains queued and unexpectedly starts OCR later as stale background work.
        const taskCore=previous.catch(()=>{}).then(async()=>{
          // A provider/page lifecycle can be disposed while this request is waiting
          // behind another recognition. Clearing the public queue map alone does not
          // cancel the already-linked promise chain, so re-check the generation at
          // the actual execution boundary before touching the WASM worker.
          if(lifecycleGeneration!==this._lifecycleGeneration){const e=new Error('OCR_ENGINE_DISPOSED');e.code='OCR_ENGINE_DISPOSED';throw e}
          if(signal?.aborted){const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';throw e}
          const remaining=remainingDeadlineMs(deadlineAt);
          if(remaining!=null&&remaining<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
          const queuedImage=imageHolder.value;
          if(queuedImage==null){
            const code=signal?.aborted?'OCR_ABORTED':'OCR_BUDGET_EXHAUSTED';
            const e=new Error(code);e.code=code;throw e;
          }
          // Once recognition starts the worker promise owns the argument; the queue
          // itself no longer needs to keep a second reference to the full image.
          releaseQueuedImage();
          if(queueExpiryTimer){clearTimeout(queueExpiryTimer);queueExpiryTimer=null}
          signal?.removeEventListener?.('abort',onQueuedAbort);
          timing.queueWaitMs=elapsedMs(queuedAt);
          this._progress.set(trainedLanguage,onProgress);
          onProgress?.({status:'ocr-recognizing',language:trainedLanguage});
          const effectiveTimeout=boundedRecognitionTimeout(timeoutMs,remaining,15000);
          const recognitionStartedAt=monotonicNow();
          this._activeRecognitionStartedAt.set(trainedLanguage,recognitionStartedAt);
          recognitionAttempted=true;
          let recognitionSucceeded=false;
          try{
            const value=await withDeadline(worker.recognize(queuedImage),effectiveTimeout,'OCR_RECOGNITION_TIMEOUT',{signal,abortCode:'OCR_ABORTED'});
            recognitionSucceeded=true;
            return value;
          } finally {
            if(this._activeRecognitionStartedAt.get(trainedLanguage)===recognitionStartedAt)this._activeRecognitionStartedAt.delete(trainedLanguage);
            timing.recognitionMs=elapsedMs(recognitionStartedAt);
            // Queue admission must learn only from completed recognitions. A timeout,
            // abort or worker failure measures the failure boundary rather than the
            // device's real service time; feeding it into EWMA can reject healthy
            // later requests for the rest of the session.
            if(recognitionSucceeded&&timing.recognitionMs>0&&Number.isFinite(timing.recognitionMs)){
              const previousEstimate=this._recognitionEwmaMs.get(trainedLanguage);
              const previousJitter=this._recognitionJitterEwmaMs.get(trainedLanguage)??0;
              // Favor recent device conditions while smoothing one-off GC/WASM spikes.
              const nextEstimate=previousEstimate==null?timing.recognitionMs:(previousEstimate*0.7+timing.recognitionMs*0.3);
              const deviation=previousEstimate==null?0:Math.abs(timing.recognitionMs-previousEstimate);
              const nextJitter=previousEstimate==null?0:(previousJitter*0.7+deviation*0.3);
              this._recognitionEwmaMs.set(trainedLanguage,nextEstimate);
              this._recognitionJitterEwmaMs.set(trainedLanguage,nextJitter);
              this._recognitionSampleCount.set(trainedLanguage,(this._recognitionSampleCount.get(trainedLanguage)??0)+1);
            }
          }
        });
        // Queue ownership must outlive the caller when a queued request is cancelled
        // or expires. Otherwise returning early would delete the serialization tail
        // and a later image could overlap the still-running predecessor on the same
        // single-threaded Tesseract worker. Finalize queue bookkeeping only when the
        // internal task actually settles; the caller is allowed to stop waiting sooner.
        let task;
        task=taskCore.finally(()=>{
          releaseQueuedImage();
          if(queueExpiryTimer){clearTimeout(queueExpiryTimer);queueExpiryTimer=null}
          signal?.removeEventListener?.('abort',onQueuedAbort);
          if(this._queues.get(trainedLanguage)===task)this._queues.delete(trainedLanguage);
          releaseQueueDepth();
          // Only the task that currently owns the worker logger may clear it. A
          // queued successor installs its callback only when it actually starts.
          if(this._progress.get(trainedLanguage)===onProgress)this._progress.delete(trainedLanguage);
          this._trimIdleWorkers(deadlineAt).catch(()=>{});
        });
        // Keep rejected internal tails observed even when the public caller has
        // already returned on abort/deadline. `_queues` still sees the original
        // settlement state for ordering; this handler only prevents an unhandled
        // rejection in browsers/Node after early caller settlement.
        task.catch(()=>{});
        this._queues.set(trainedLanguage,task);
        this._releaseWorkerReservation(trainedLanguage);workerReserved=false;
        const callerRemaining=remainingDeadlineMs(deadlineAt);
        // `timeoutMs` is a recognition-stage budget, not a queue-wait budget. Only
        // the route deadline may expire while waiting in line; otherwise a healthy
        // active recognition could be surfaced as OCR_BUDGET_EXHAUSTED instead of
        // its precise OCR_RECOGNITION_TIMEOUT. Abort remains immediate in both cases.
        result=callerRemaining==null
          ? await awaitAbortable(task,signal,'OCR_ABORTED')
          : await withDeadline(task,Math.max(1,callerRemaining),'OCR_BUDGET_EXHAUSTED',{
              signal,abortCode:'OCR_ABORTED',onTimeout:releaseQueuedImage,
            });
      }catch(error){
        if(workerReserved){this._releaseWorkerReservation(trainedLanguage);workerReserved=false}
        // A timed-out Tesseract recognition can keep running inside the worker.
        // Reusing that worker would allow the next image to overlap with stale
        // native/WASM work and can corrupt ordering or make the UI look frozen.
        // Evict and terminate it before a later request is allowed to create a
        // fresh language-scoped worker. Termination is best-effort because the
        // original timeout/error must remain the observable failure.
        const stillOwned=this.workers.get(trainedLanguage)===workerPromise;
        // Admission/backlog/deadline failures that happen before worker.recognize
        // starts are request-local. Killing a healthy hot worker here makes a burst
        // amplify into a cold-start storm. Initialization failures and failures
        // after recognition begins still invalidate the worker conservatively.
        // Request-local admission/cancellation failures before recognize() starts do
        // not imply worker corruption, even when this very request just finished a
        // successful cold worker creation. Killing that newly healthy worker turns a
        // tight-deadline request into a cold-start storm for the next viable image.
        // Worker ownership is invalidated only by initialization failures or errors
        // after recognize() has actually begun.
        const requestLocalCode=['OCR_QUEUE_OVERLOADED','OCR_QUEUE_DEADLINE_IMPOSSIBLE','OCR_RECOGNITION_DEADLINE_IMPOSSIBLE','OCR_BUDGET_EXHAUSTED','OCR_ABORTED'].includes(error?.code);
        // Shared-init waiters do not own the initialization. Their local abort or
        // route expiry must not delete/terminate a worker another live request is
        // still creating. A caller that already reached workerReady gets the same
        // protection for pre-recognition admission failures.
        const hasOtherInitWaiter=(this._workerReservations.get(trainedLanguage)??0)>0;
        const requestLocalBeforeRecognition=!recognitionAttempted&&requestLocalCode&&(workerReady||!workerCreated||hasOtherInitWaiter);
        if(!requestLocalBeforeRecognition){
          if(stillOwned)this.workers.delete(trainedLanguage);
          this._workerLastUsed.delete(trainedLanguage);
          if(stillOwned)Promise.resolve(workerPromise).then(worker=>terminateWorkerSafely(worker)).catch(()=>{});
        }
        this._workerBusy.delete(trainedLanguage);
        throw error;
      }
    } else {
      if (!Tesseract?.recognize) throw new Error('Tesseract runtime unavailable');
      // Never forward the application routing hint `auto` as a traineddata id.
      const runtimeLanguage=trainedLanguage??language;
      const remaining=remainingDeadlineMs(deadlineAt);
      if(remaining!=null&&remaining<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
      onProgress?.({status:'ocr-recognizing',language:runtimeLanguage});
      const recognitionStartedAt=monotonicNow();
      result = await withDeadline(
        Tesseract.recognize(image, runtimeLanguage, {logger:m=>onProgress?.(m)}),
        boundedRecognitionTimeout(timeoutMs,remaining,18000),'OCR_RECOGNITION_TIMEOUT',{signal,abortCode:'OCR_ABORTED'}
      );
      timing.recognitionMs=elapsedMs(recognitionStartedAt);
    }
    const text = result?.data?.text ?? '';
    const confidence = Number(result?.data?.confidence ?? 0) / 100;
    return this.normalize({
      engineId:this.id,
      engineVersion:this.version,
      providerType:'local',
      text,
      confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence)):0,
      blocks:result?.data?.blocks??[],
      languages:String(trainedLanguage??language).split('+'),
      diagnostics:{
        mode:trainedLanguage&&workerPromise?'tesseract-js-hot-worker':'tesseract-js',
        languageHint,trainedLanguage:trainedLanguage??null,workerCacheHit,workerCreated,workerInitShared,
        hotWorkerCountBefore,hotWorkerCountAfter:this.workers.size,
        retiringWorkerCount:this._retiringWorkers.size,workerReservationCount:[...this._workerReservations.values()].reduce((a,b)=>a+b,0),maxConcurrentWorkerInits:this.maxConcurrentWorkerInits,effectiveWorkerInitConcurrency:this._effectiveWorkerInitConcurrency(trainedLanguage),workerInitTimingMs:this._workerInitEwmaMs,workerInitTimingJitterMs:this._workerInitJitterEwmaMs,estimatedWorkerInitMs:this._estimatedWorkerInitMs(trainedLanguage),workerInitTimingSamples:this._workerInitSampleCount,languageWorkerInitTimingMs:this._workerInitLanguageEwmaMs.get(trainedLanguage)??null,languageWorkerInitTimingJitterMs:this._workerInitLanguageJitterEwmaMs.get(trainedLanguage)??null,languageWorkerInitTimingSamples:this._workerInitLanguageSampleCount.get(trainedLanguage)??0,maxWorkerInitWaiters:this.maxWorkerInitWaiters,activeWorkerInits:this._activeWorkerInits,workerInitWaiterCount:this._workerInitWaiters.length,maxQueueDepth:this.maxQueueDepth,adaptiveQueueDepth,burstRetentionBudgetMs:this.burstRetentionBudgetMs,queueDepth:typeof queueDepth==='number'?queueDepth:0,
        timing:{...timing,totalMs:elapsedMs(startedAt)},
        estimatedWarmRecognitionMs:this._recognitionEwmaMs.get(trainedLanguage)??null,
        recognitionTimingSamples:this._recognitionSampleCount.get(trainedLanguage)??0,
        recognitionTimingJitterMs:this._recognitionJitterEwmaMs.get(trainedLanguage)??null,
      },
    });
  }
}


async function terminateWorkerPromiseSafely(workerPromise,waitTimeoutMs=1500){
  const source=Promise.resolve(workerPromise);
  // If initialization finishes after dispose has already returned, ownership is
  // still gone; terminate that late worker instead of leaking it in WASM memory.
  let timedOut=false;
  source.then(worker=>{if(timedOut)terminateWorkerSafely(worker).catch(()=>{})},()=>{});
  try{
    const worker=await withDeadline(source,waitTimeoutMs,'OCR_WORKER_DISPOSE_WAIT_TIMEOUT',{onTimeout:()=>{timedOut=true}});
    await terminateWorkerSafely(worker,waitTimeoutMs);
  }catch{timedOut=true}
}

function awaitAbortable(promise,signal,abortCode='OPERATION_ABORTED'){
  if(!signal)return Promise.resolve(promise);
  if(signal.aborted){const e=new Error(abortCode);e.code=abortCode;return Promise.reject(e)}
  return new Promise((resolve,reject)=>{
    const onAbort=()=>{cleanup();const e=new Error(abortCode);e.code=abortCode;reject(e)};
    const cleanup=()=>signal.removeEventListener?.('abort',onAbort);
    signal.addEventListener?.('abort',onAbort,{once:true});
    Promise.resolve(promise).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)});
  });
}

function monotonicNow(){
  return globalThis.performance?.now?.()??Date.now();
}

function elapsedMs(start){
  return Math.max(0,monotonicNow()-start);
}

async function terminateWorkerSafely(worker,timeoutMs=1500){
  if(!worker?.terminate)return;
  try{await withDeadline(Promise.resolve().then(()=>worker.terminate()),timeoutMs,'OCR_WORKER_TERMINATE_TIMEOUT')}catch{}
}

function remainingDeadlineMs(deadlineAt){
  if(deadlineAt==null)return null;
  const deadline=Number(deadlineAt);
  return Number.isFinite(deadline)?deadline-Date.now():null;
}

function minimumPositive(...values){
  const finite=values.map(Number).filter(x=>Number.isFinite(x)&&x>0);
  return finite.length?Math.min(...finite):null;
}

function boundedStageTimeout(fallback,remaining){
  const values=[Number(remaining),Number(fallback)].filter(x=>Number.isFinite(x)&&x>0);
  return Math.max(1,Math.min(...values));
}

function boundedRecognitionTimeout(requested,remaining,fallback){
  const values=[Number(requested),Number(remaining),Number(fallback)].filter(x=>Number.isFinite(x)&&x>0);
  return Math.max(1,Math.min(...values));
}

async function createWorkerWithCleanup(workerPromise,timeoutMs,signal=null){
  let timedOut=false;
  const source=Promise.resolve(workerPromise);
  source.then(worker=>{
    if(timedOut)terminateWorkerSafely(worker).catch(()=>{});
  },()=>{});
  try{
    return await withDeadline(source,timeoutMs,'OCR_WORKER_INIT_TIMEOUT',{onTimeout:()=>{timedOut=true},signal,abortCode:'OCR_ABORTED'});
  }catch(error){
    if(error?.code==='OCR_WORKER_INIT_TIMEOUT'||error?.code==='OCR_ABORTED')timedOut=true;
    throw error;
  }
}

let runtimePromise;
async function loadTesseract() {
  if (globalThis.Tesseract?.createWorker || globalThis.Tesseract?.recognize) return globalThis.Tesseract;
  runtimePromise ??= import('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/+esm').catch(error=>{
    // A transient CDN/network failure must not poison the adapter for the rest of
    // the page lifetime. Clear the memoized rejection so a later user retry can
    // genuinely attempt to load the runtime again.
    runtimePromise=null;
    throw error;
  });
  return runtimePromise;
}

export function toTesseractLanguage(language='auto'){
  const value=String(language??'auto').toLowerCase();
  if(!value||value==='auto')return null;
  const parts=value.split(/[+,]/).map(x=>x.trim()).filter(Boolean);
  const mapped=[];
  for(const part of parts){
    const normalizedPart=part.replace(/_/g,'-');
    const subtags=normalizedPart.split('-').filter(Boolean);
    const base=subtags[0];
    // BCP-47 commonly carries both script and region (for example zh-Hant-TW,
    // sr-Latn-RS). Exact-only override lookup silently fell back to the base
    // language in those cases, selecting the wrong traineddata. Resolve the
    // stable language+script / language+region keys before the base fallback;
    // extensions/private-use subtags therefore cannot erase script evidence.
    const qualifiers=subtags.slice(1);
    const extensionAt=qualifiers.findIndex(tag=>tag.length===1);
    const coreQualifiers=extensionAt>=0?qualifiers.slice(0,extensionAt):qualifiers;
    const script=coreQualifiers.find(tag=>tag.length===4&&/^[a-z]+$/.test(tag));
    const region=coreQualifiers.find(tag=>/^[a-z]{2}$/.test(tag)||/^\d{3}$/.test(tag));
    const lang=TESSERACT_LOCALE_OVERRIDES[normalizedPart]
      ??(script?TESSERACT_LOCALE_OVERRIDES[`${base}-${script}`]:null)
      ??(region?TESSERACT_LOCALE_OVERRIDES[`${base}-${region}`]:null)
      ??TESSERACT_LANGUAGE_MAP[base]??null;
    if(lang&&!mapped.includes(lang))mapped.push(lang);
  }
  return mapped.length?mapped.join('+'):null;
}

// Keep locale-to-traineddata knowledge inside the replaceable Tesseract adapter.
// Higher layers continue to speak BCP-47/ISO language hints and remain provider-neutral.
const TESSERACT_LOCALE_OVERRIDES=Object.freeze({
  // Chinese traineddata is script-specific. A base-only mapping silently turns
  // Traditional Chinese locales into Simplified Chinese and hurts recognition.
  // Keep this provider-specific detail here rather than leaking it into Core.
  'zh-tw':'chi_tra','zh-hk':'chi_tra','zh-mo':'chi_tra','zh-hant':'chi_tra',
  'zh-cn':'chi_sim','zh-sg':'chi_sim','zh-hans':'chi_sim',
  // Script-sensitive languages need an explicit traineddata variant.
  'sr-latn':'srp_latn','sr-cyrl':'srp',
  'az-cyrl':'aze_cyrl','az-latn':'aze',
  'uz-cyrl':'uzb_cyrl','uz-latn':'uzb',
});

const TESSERACT_LANGUAGE_MAP=Object.freeze({
  en:'eng',es:'spa',zh:'chi_sim',pt:'por',fr:'fra',de:'deu',it:'ita',
  ja:'jpn',ko:'kor',ru:'rus',ar:'ara',hi:'hin',nl:'nld',pl:'pol',tr:'tur',
  vi:'vie',th:'tha',id:'ind',ms:'msa',uk:'ukr',cs:'ces',ro:'ron',sv:'swe',
  da:'dan',no:'nor',fi:'fin',el:'ell',he:'heb',hu:'hun',ca:'cat',tl:'tgl',
  bg:'bul',sk:'slk',sl:'slv',hr:'hrv',sr:'srp',fa:'fas',ur:'urd',bn:'ben',
  ta:'tam',te:'tel',mr:'mar',gu:'guj',kn:'kan',ml:'mal',ne:'nep',si:'sin',
  sw:'swa',af:'afr',et:'est',lv:'lav',lt:'lit',is:'isl',ga:'gle',eu:'eus',gl:'glg',
  // Additional global coverage. Keep ISO/BCP-47 knowledge provider-local.
  mk:'mkd',be:'bel',ka:'kat',hy:'hye',az:'aze',kk:'kaz',uz:'uzb',ky:'kir',tg:'tgk',mn:'mon',
  km:'khm',lo:'lao',my:'mya',am:'amh',or:'ori',pa:'pan',as:'asm',ps:'pus',ku:'kur',cy:'cym',
  mt:'mlt',sq:'sqi',bs:'bos',lb:'ltz',eo:'epo',yi:'yid',iw:'heb',in:'ind',ji:'yid',
});
