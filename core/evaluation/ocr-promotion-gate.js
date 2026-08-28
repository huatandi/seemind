export function createOcrPromotionCandidate({benchmarkComparison,target='ocr-router'}={}){
  if(!benchmarkComparison?.recommendation)throw new Error('OCR_BENCHMARK_COMPARISON_REQUIRED');
  const r=benchmarkComparison.recommendation;
  if(r.status!=='candidate')return {
    schemaVersion:1,type:'ocr_strategy_promotion',target,status:'blocked',
    reason:r.reason??'INSUFFICIENT_DATA',createdAt:new Date().toISOString(),
  };
  return {
    schemaVersion:1,
    type:'ocr_strategy_promotion',
    target,
    strategyId:r.strategyId,
    metrics:r.metrics,
    status:'proposed',
    benchmarkPassed:true,
    regressionPassed:false,
    approved:false,
    createdAt:new Date().toISOString(),
  };
}

export function recordOcrPromotionRegression(candidate,{passed,criticalRegressions=[]}={}){
  requireStatus(candidate,'proposed');
  if(!passed||criticalRegressions.length)return {...candidate,status:'rejected',regressionPassed:false,criticalRegressions:[...criticalRegressions]};
  return {...candidate,status:'regression_passed',regressionPassed:true,criticalRegressions:[]};
}

export function approveOcrPromotion(candidate,{approvedBy=null,approved=false}={}){
  requireStatus(candidate,'regression_passed');
  if(!approved)return {...candidate,status:'regression_passed',approved:false};
  if(!approvedBy)throw new Error('OCR_PROMOTION_APPROVER_REQUIRED');
  return {...candidate,status:'promoted',approved:true,approvedBy:String(approvedBy),promotedAt:new Date().toISOString()};
}

function requireStatus(c,status){if(!c||c.status!==status)throw new Error(`OCR_PROMOTION_STAGE_REQUIRED:${status}`)}
