export class TeacherProvider {
  constructor(id, profile = {}) {
    if (!id) throw new Error('Teacher provider requires id');
    this.id = id;
    this.profile = normalizeTeacherProfile({ id, ...profile });
    this.priority = Number(profile.priority ?? 0);
  }
  getCapabilities() { return this.profile.capabilities.map(x => x.capability); }
  getProfile() { return this.profile; }
  async healthCheck() { return { status: 'unconfigured' }; }
  async estimate(_request) {
    return {
      costClass: this.profile.costClass,
      latencyClass: this.profile.latencyClass,
      estimatedCost: null,
      estimatedLatencyMs: null,
    };
  }
  async execute() { throw new Error('Teacher provider not configured'); }
}

export function normalizeTeacherProfile(input = {}) {
  return {
    id: String(input.id ?? ''),
    provider: String(input.provider ?? input.id ?? 'unknown'),
    model: String(input.model ?? 'unknown'),
    capabilities: normalizeCapabilities(input.capabilities ?? []),
    supportedModalities: unique(input.supportedModalities ?? ['text']),
    supportedLanguages: unique(input.supportedLanguages ?? ['auto']),
    supportsWebSearch: Boolean(input.supportsWebSearch),
    supportsCitations: Boolean(input.supportsCitations),
    supportsImages: Boolean(input.supportsImages),
    supportsDocuments: Boolean(input.supportsDocuments),
    supportsStructuredOutput: input.supportsStructuredOutput !== false,
    supportsToolCalling: Boolean(input.supportsToolCalling),
    privacyModes: unique(input.privacyModes ?? ['cloud']),
    latencyClass: enumValue(input.latencyClass, ['fast','medium','slow'], 'medium'),
    costClass: enumValue(input.costClass, ['free','low','medium','high'], 'medium'),
    reliabilityScore: clamp01(input.reliabilityScore ?? 0.5),
    freshnessScore: clamp01(input.freshnessScore ?? 0.5),
    evidenceScore: clamp01(input.evidenceScore ?? 0.5),
    historicalSuccess: clamp01(input.historicalSuccess ?? 0.5),
    priority: Number(input.priority ?? 0),
    version: String(input.version ?? '1'),
  };
}

function normalizeCapabilities(items) {
  return items.map(item => typeof item === 'string'
    ? { capability: item, score: 1, confidence: 1 }
    : { capability: String(item.capability), score: clamp01(item.score ?? 1), confidence: clamp01(item.confidence ?? 1) }
  ).filter(x => x.capability);
}
function unique(items){ return [...new Set(items.map(String))]; }
function clamp01(v){ const n=Number(v); return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0; }
function enumValue(v, allowed, fallback){ return allowed.includes(v)?v:fallback; }
