import {createObjectContinuityState,updateObjectContinuity,resolveConversationReference,continuitySnapshot} from './object-continuity.js';

export function createMultimodalSession({id=`mm-${Date.now()}`}={}){
  return {schemaVersion:2,id,turns:[],visualObservations:[],contexts:[],continuity:createObjectContinuityState(),createdAt:new Date().toISOString()};
}
export function addVisualObservation(session,observation){session.visualObservations.push(observation);return session}
export function addMultimodalTurn(session,{speechText='',text='',context=null,visualObservation=null}={}){
  const turnId=`turn-${session.turns.length+1}`,raw=String(speechText||text||'');
  const continuityResolution=resolveConversationReference({text:raw,state:session.continuity,currentContext:context});
  session.turns.push({id:turnId,role:'user',speechText:String(speechText||''),text:String(text||''),continuityResolution,createdAt:new Date().toISOString()});
  if(context)session.contexts.push({...context,conversationReference:continuityResolution.resolved?continuityResolution:null});
  session.continuity=updateObjectContinuity(session.continuity,{context,visualObservation:visualObservation??latestVisual(session),turnId:session.turns.length});
  return session;
}
export function latestVisual(session){return session.visualObservations.at(-1)??null}
export function latestContext(session){return session.contexts.at(-1)??null}
export function resolveSessionReference(session,text,currentContext=null){return resolveConversationReference({text,state:session?.continuity,currentContext})}
export function sessionContinuitySnapshot(session){return continuitySnapshot(session?.continuity)}
