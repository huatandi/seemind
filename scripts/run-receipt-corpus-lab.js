import {normalizeGroundTruth} from '../core/evaluation/receipt-corpus/ground-truth-schema.js';
import {buildReceiptCorpusManifest,verifyReceiptCorpusManifest} from '../core/evaluation/receipt-corpus/corpus-manifest.js';
import {corpusManifestToBenchmarkDataset} from '../core/evaluation/receipt-corpus/benchmark-adapter.js';
import {redactReceiptText} from '../core/evaluation/receipt-corpus/pii-redaction.js';

const sample=normalizeGroundTruth({
 caseId:'lab-001',imageRef:'images/lab-001.redacted.jpg',receiptType:'supermarket',difficulty:'medium',
 fields:{merchant:'EL FLORIDO',date:'2026-08-20',subtotal:64751,tax:887,total:65638,cash:70000,change:4362},
 annotation:{status:'reviewed',annotatorId:'lab-a',reviewedBy:'lab-r',reviewedAt:'2026-08-25T00:00:00Z'},
 provenance:{source:'synthetic-lab',consentConfirmed:true,redacted:true}
});
const manifest=buildReceiptCorpusManifest({datasetId:'lab-only',version:'0.30.0',cases:[sample]});
const dataset=corpusManifestToBenchmarkDataset(manifest);
const redaction=redactReceiptText('RFC ABC010101AA1 correo a@b.com TOTAL 656.38');
console.log(JSON.stringify({
 suite:'Receipt Corpus / Ground Truth Lab',
 note:'Synthetic metadata only. No real receipt image accuracy is claimed.',
 manifestValid:verifyReceiptCorpusManifest(manifest).valid,
 benchmarkCases:dataset.summary().caseCount,
 sensitiveFindings:redaction.count,
 redactedText:redaction.text,
 score:verifyReceiptCorpusManifest(manifest).valid&&dataset.summary().caseCount===1&&redaction.count===2?100:0
},null,2));
