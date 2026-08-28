export class NodeHandlerRegistry{
  constructor(){this.handlers=new Map()}
  register(type,handler){if(!type||typeof handler!=='function')throw new Error('INVALID_NODE_HANDLER');this.handlers.set(type,handler);return this}
  registerMany(entries={}){for(const [type,handler] of Object.entries(entries))this.register(type,handler);return this}
  has(type){return this.handlers.has(type)}
  get(type){return this.handlers.get(type)??this.handlers.get('*')??null}
  toObject(){return Object.fromEntries(this.handlers)}
}
