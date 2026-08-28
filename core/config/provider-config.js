/** Runtime-only provider configuration. Secrets must never be serialized into task packages or logs. */
export class ProviderConfigStore {
  constructor(entries = []) { this.entries = new Map(); entries.forEach(x => this.set(x.id, x)); }
  set(id, config = {}) {
    if (!id) throw new Error('provider id required');
    this.entries.set(id, {
      id,
      enabled: config.enabled !== false,
      endpoint: config.endpoint ?? null,
      secretRef: config.secretRef ?? null,
      region: config.region ?? null,
      tags: Array.isArray(config.tags) ? [...config.tags] : [],
    });
    return this;
  }
  get(id){ return this.entries.get(id) ?? null; }
  isEnabled(id){ return this.get(id)?.enabled === true; }
  publicSnapshot(){
    return [...this.entries.values()].map(({secretRef,...safe}) => ({...safe,hasSecret:Boolean(secretRef)}));
  }
}
