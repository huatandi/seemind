/**
 * Candidate families only. No entry here means the binary/runtime is installed.
 * Adapters must explicitly register at runtime after support checks.
 */
export const PERCEPTION_ENGINE_CANDIDATES=Object.freeze([
 {family:'fastvlm',modality:'vision',roles:['general_vision','visual_qa'],status:'candidate',notes:'low-latency VLM candidate'},
 {family:'smolvlm',modality:'vision',roles:['general_vision','visual_qa'],status:'candidate',notes:'small local VLM candidate'},
 {family:'mobileclip_or_embedding',modality:'vision',roles:['visual_embedding','similarity'],status:'candidate',notes:'fast semantic image embedding candidate'},
 {family:'detr',modality:'vision',roles:['object_identity','regions'],status:'integrated_optional',notes:'auxiliary object detector'},
 {family:'moonshine',modality:'voice',roles:['streaming_asr'],status:'candidate',notes:'streaming on-device ASR candidate'},
 {family:'sherpa_onnx',modality:'voice',roles:['vad','streaming_asr','language_id'],status:'candidate',notes:'voice infrastructure candidate'},
 {family:'whisper_cpp',modality:'voice',roles:['asr_fallback'],status:'candidate',notes:'reliable local ASR fallback candidate'},
 {family:'webspeech',modality:'voice',roles:['asr_adapter'],status:'integrated_runtime',notes:'browser adapter; availability/processing locality depends on browser'},
]);
