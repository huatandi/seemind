const PROFILES={
 MX:{defaultLocale:'es-MX',currency:'MXN',measurementSystem:'metric',officialSourceHints:['government','tax_authority','immigration_authority']},
 US:{defaultLocale:'en-US',currency:'USD',measurementSystem:'us_customary',officialSourceHints:['government','federal_agency']},
 CN:{defaultLocale:'zh-CN',currency:'CNY',measurementSystem:'metric',officialSourceHints:['government']},
 JP:{defaultLocale:'ja-JP',currency:'JPY',measurementSystem:'metric',officialSourceHints:['government','manufacturer']},
 GB:{defaultLocale:'en-GB',currency:'GBP',measurementSystem:'metric',officialSourceHints:['government']},
 CA:{defaultLocale:'en-CA',currency:'CAD',measurementSystem:'metric',officialSourceHints:['government']},
};
export function getLocaleProfile(region){
 const key=String(region??'').toUpperCase();
 return PROFILES[key]?{region:key,...PROFILES[key]}:{region:key||null,defaultLocale:null,currency:null,measurementSystem:null,officialSourceHints:[]};
}
export function registerLocaleProfile(registry,region,profile){registry[String(region).toUpperCase()]={...profile}}
export function createLocaleProfileRegistry(seed=PROFILES){return Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,{...v}]))}
