import {createAuditEvent,MemoryAuditEventStore,DurableAuditLog,sanitizeAuditData} from './durable-event-log.js';
export function createTeacherAuditEvent(type,data={}){
  const e=createAuditEvent(type,data);const safe=sanitizeAuditData(data);for(const k of Object.keys(safe)){if(/api.?key|secret|token|password|credential|authorization/i.test(k))delete safe[k]}return {schemaVersion:e.schemaVersion,id:e.id,type:e.type,at:e.at,...safe};
}
export class InMemoryTeacherAudit extends DurableAuditLog{
  constructor(){const store=new MemoryAuditEventStore();super({store});this.events=[]}
  record(type,data={}){const e=createTeacherAuditEvent(type,data);this.events.push(e);return e}
  list(){return [...this.events]}
}
