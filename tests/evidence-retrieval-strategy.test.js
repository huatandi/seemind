import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvidenceRetrieval,buildEscalatedSearchPlan,retrievalProfile} from '../core/search/evidence-retrieval-strategy.js';

test('price conflict escalates toward another live retailer rather than generic web',()=>{
  const r=planEvidenceRetrieval({task:{type:'price_search',userIntent:'现在多少钱'},search:{required:true},consensus:{recommendation:'search_more_or_report_disagreement'},attempt:1,maxSearches:3});
  assert.equal(r.action,'search_more');assert.deepEqual(r.preferredSourceTypes,['retailer']);assert.match(r.queryAddon,/independent retailer/);
});

test('legal conflict escalates to government primary text',()=>{
  const r=planEvidenceRetrieval({task:{type:'legal_research',userIntent:'最新移民规定'},search:{required:true},consensus:{recommendation:'search_more_or_report_disagreement'},attempt:1,maxSearches:3});
  assert.equal(r.profile.kind,'legal');assert.deepEqual(r.preferredSourceTypes,['government']);assert.match(r.queryAddon,/government/);
});

test('technical evidence gap prefers official manual or professional database',()=>{
  const p=retrievalProfile({type:'manual_lookup',userIntent:'这个配件兼容吗'});assert.deepEqual(p.preferredSourceTypes,['official','professional_database']);
});

test('search budget exhaustion reports uncertainty instead of looping',()=>{
  const r=planEvidenceRetrieval({task:{type:'price_search'},search:{required:true},consensus:{recommendation:'search_more_or_report_disagreement'},attempt:3,maxSearches:3});
  assert.equal(r.action,'report');assert.equal(r.reason,'search_budget_exhausted');
});

test('resolved conflict stops retrieval but requires caveat',()=>{
  const r=planEvidenceRetrieval({task:{type:'price_search'},search:{required:true},consensus:{recommendation:'use_resolved_preference_with_caveat'},attempt:1,maxSearches:3});
  assert.equal(r.action,'stop');assert.equal(r.caveatRequired,true);
});

test('escalated plan carries source intent and round metadata',()=>{
  const r=planEvidenceRetrieval({task:{type:'price_search'},search:{required:true},consensus:{recommendation:'single_source_caution'},attempt:1,maxSearches:3});
  const p=buildEscalatedSearchPlan({query:'Kia Sportage price',maxResults:5},r,2);assert.equal(p.retrievalRound,2);assert.deepEqual(p.preferredSourceTypes,['retailer','official']);assert.match(p.query,/current price/);
});
