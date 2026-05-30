import './anthropic-native-stream-hotfix.js';
import { readFileSync, writeFileSync } from 'node:fs';

try{
  const file = new URL('./server.js', import.meta.url);
  let s = readFileSync(file, 'utf8');
  let changed = false;

  const oldOne = 'items = [{ providerId: String(pkg.providerId||"").trim(), models: Array.from(new Set(models)) }];';
  const newOne = 'items = [{ ...pkg, providerId: String(pkg.providerId||"").trim(), models: Array.from(new Set(models)) }];';
  if(s.includes(oldOne)){ s = s.replace(oldOne, newOne); changed = true; }

  const oldTwo = 'items = items.map(item=>({\n    providerId: String(item.providerId||"").trim(),\n    models: Array.from(new Set((Array.isArray(item.models)?item.models:[]).map(v=>String(v||"").trim()).filter(Boolean)))\n  })).filter(item=>item.providerId && item.models.length);';
  const newTwo = 'items = items.map(item=>({\n    ...item,\n    providerId: String(item.providerId||"").trim(),\n    models: Array.from(new Set((Array.isArray(item.models)?item.models:[]).map(v=>String(v||"").trim()).filter(Boolean)))\n  })).filter(item=>item.providerId && item.models.length);';
  if(s.includes(oldTwo)){ s = s.replace(oldTwo, newTwo); changed = true; }

  if(changed){ writeFileSync(file, s); console.log('[startup patch] access normalizer preserves item fields'); }
}catch(e){
  console.warn('[startup patch] skipped:', e.message);
}

await import('./server.js');
