export async function withDeadline(promise,ms,code='OPERATION_TIMEOUT',{onTimeout=null,signal=null,abortCode='OPERATION_ABORTED'}={}){
  const timeout=Math.max(1,Number(ms)||1);
  let timer;
  let abortHandler;
  const racers=[
    Promise.resolve(promise),
    new Promise((_,reject)=>{timer=setTimeout(()=>{try{onTimeout?.()}catch{}const e=new Error(code);e.code=code;reject(e)},timeout)})
  ];
  if(signal){
    racers.push(new Promise((_,reject)=>{
      const rejectAbort=()=>{const e=new Error(abortCode);e.code=abortCode;reject(e)};
      if(signal.aborted){rejectAbort();return}
      abortHandler=rejectAbort;
      signal.addEventListener?.('abort',abortHandler,{once:true});
    }));
  }
  try{return await Promise.race(racers)}
  finally{
    clearTimeout(timer);
    if(abortHandler)signal?.removeEventListener?.('abort',abortHandler);
  }
}
