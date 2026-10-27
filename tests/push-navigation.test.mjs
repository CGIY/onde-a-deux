import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../cartes/service-worker.js',import.meta.url),'utf8');
async function scenario(path,hasApp){
  const handlers=new Map(),actions=[];let completion;
  const app={url:'https://example.test/cartes/',navigate:async url=>actions.push(['navigate',url]),focus:async()=>actions.push(['focus'])};
  const other={url:'https://example.test/donjon/',focus:async()=>actions.push(['wrong-tab'])};
  const self={registration:{scope:'https://example.test/cartes/'},addEventListener:(name,fn)=>handlers.set(name,fn),clients:{matchAll:async()=>hasApp?[other,app]:[other],openWindow:async url=>actions.push(['open',url])}};
  runInNewContext(source,{self,URL});handlers.get('notificationclick')({notification:{data:{path},close:()=>{}},waitUntil:p=>completion=p});await completion;return actions;
}
assert.deepEqual(await scenario('https://evil.test/',true),[['navigate','https://example.test/cartes/'],['focus']]);
assert.deepEqual(await scenario('/donjon/',false),[['open','https://example.test/cartes/']]);
assert.deepEqual(await scenario('/cartes/?view=trade',false),[['open','https://example.test/cartes/?view=trade']]);
console.log('OK: notification clicks target the card app, preserve same-scope destinations, and reject external or unrelated paths.');
