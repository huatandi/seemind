import test from 'node:test';
import assert from 'node:assert/strict';
import {toTesseractLanguage} from '../providers/local/tesseract-ocr.js';

const cases=[
  ['mk-MK','mkd'],['be-BY','bel'],['ka-GE','kat'],['hy-AM','hye'],['az-AZ','aze'],
  ['kk-KZ','kaz'],['uz-UZ','uzb'],['ky-KG','kir'],['tg-TJ','tgk'],['mn-MN','mon'],
  ['km-KH','khm'],['lo-LA','lao'],['my-MM','mya'],['am-ET','amh'],['or-IN','ori'],
  ['pa-IN','pan'],['as-IN','asm'],['ps-AF','pus'],['ku-TR','kur'],['cy-GB','cym'],
  ['mt-MT','mlt'],['sq-AL','sqi'],['bs-BA','bos'],['lb-LU','ltz'],['eo','epo'],
];

for(const [locale,trained] of cases){
  test(`global OCR maps ${locale} to ${trained}`,()=>assert.equal(toTesseractLanguage(locale),trained));
}

test('Serbian Latin script selects Latin traineddata',()=>assert.equal(toTesseractLanguage('sr-Latn'), 'srp_latn'));
test('Serbian Cyrillic remains default Serbian traineddata',()=>assert.equal(toTesseractLanguage('sr-Cyrl'), 'srp'));
test('Azeri Cyrillic selects Cyrillic traineddata',()=>assert.equal(toTesseractLanguage('az-Cyrl'), 'aze_cyrl'));
test('Uzbek Cyrillic selects Cyrillic traineddata',()=>assert.equal(toTesseractLanguage('uz-Cyrl'), 'uzb_cyrl'));
test('legacy Hebrew iw locale remains routable',()=>assert.equal(toTesseractLanguage('iw-IL'), 'heb'));
test('legacy Indonesian in locale remains routable',()=>assert.equal(toTesseractLanguage('in-ID'), 'ind'));
test('legacy Yiddish ji locale remains routable',()=>assert.equal(toTesseractLanguage('ji'), 'yid'));
test('mixed language hint deduplicates traineddata ids',()=>assert.equal(toTesseractLanguage('he+iw-IL+en'), 'heb+eng'));
