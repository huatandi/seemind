export function createStudentObservation(input={}){
  return {
    schemaVersion:1,
    id:input.id??crypto.randomUUID(),
    inputId:input.inputId??crypto.randomUUID(),
    modality:input.modality??'image',
    detectedType:input.detectedType??'unknown',
    extractedText:input.extractedText??'',
    entities:input.entities??[],
    taskCandidates:input.taskCandidates??[],
    observations:input.observations??[],
    confidence:{identity:0,fact:0,evidence:0,recommendation:0,action:0,overall:0,...(input.confidence??{})},
    limitations:input.limitations??[],
    localResolutionPossible:Boolean(input.localResolutionPossible),
    localResolutionReason:input.localResolutionReason??null,
    createdAt:input.createdAt??new Date().toISOString(),
  };
}
