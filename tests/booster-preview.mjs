// Offline-only visual QA. No Supabase calls, credentials, disk writes or real draws.
// Run: node tests/booster-preview.mjs, then open http://127.0.0.1:8768/cartes/
import http from 'node:http';
import {readFileSync} from 'node:fs';
const root=new URL('../cartes/',import.meta.url);
const until=new Date(Date.now()+86400000).toISOString();
const data={role:'AG',partner_role:'CL',partner_online:false,boosters:[{id:'demo-pack',edition:'edition_01',expires_at:until}],my_cards:[],partner_cards:[],active_cards:[],known_cards:[],trades:[],catalogue_total:90,catalogue_slots:[],editions:[],next_booster_at:until};
const cards=['energy','challenge','challenge'].map((type,i)=>({id:`demo-${i}`,template_id:`demo-${i}`,title:`DÉMONSTRATION ${i+1}`,challenge:'Carte fictive pour tester les animations. Aucun tirage réel.',category:i?'EN COUPLE':'ÉNERGIE',palette:i?'couple':'energy',card_type:type,finish:i===2?'foil':'standard',edition:'edition_01',status:'available',wear_seed:i,booster_id:'demo-pack',expires_at:until}));
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.html':'text/html'};
http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.writeHead(302,{Location:'/cartes/'});return res.end();}
  const file=path==='/cartes/'?'index.html':path.slice('/cartes/'.length);
  if(!path.startsWith('/cartes/')||file.includes('..')||! /^(index\.html|app\.js|booster-gesture\.js|service-worker\.js|[a-z-]+\.css|icon\.svg|manifest\.webmanifest|assets\/[a-z-]+\.jpg)$/.test(file)){res.writeHead(404);return res.end();}
  try{
    let content=readFileSync(new URL(file,root));
    if(file==='index.html')content=content.toString().replace('<body>','<body><div class="demo-notice">DÉMONSTRATION ISOLÉE · AUCUNE SAUVEGARDE</div><style>.demo-notice,.booster-dialog:after{position:fixed;top:0;left:0;right:0;text-align:center;background:#47685a;color:#fff;padding:7px;font:9px sans-serif;letter-spacing:.1em;z-index:9999}.booster-dialog:after{content:"DÉMONSTRATION ISOLÉE · AUCUNE SAUVEGARDE"}body{padding-top:25px}</style>');
    if(file==='app.js'){
      const source=content.toString();
      const a=source.indexOf('  const storage = {'),b=source.indexOf('\n\n  const state =',a);
      const c=source.indexOf('  async function exchange('),d=source.indexOf('  function serverNow()',c);
      if([a,b,c,d].some(v=>v<0))throw Error('Preview adapter no longer matches production source');
      const mock=`  let demoOpened=false, demoFailed=false;\n  async function exchange(action='sync') {\n if(action==='open_booster') { if(location.search.includes('failure=once')&&!demoFailed){demoFailed=true;throw Error('network_error');} if(demoOpened)throw Error('booster_unavailable');demoOpened=true; }\n const data=${JSON.stringify(data)}; if(demoOpened){data.my_cards=${JSON.stringify(cards)};data.boosters=[];} state.data=data;return data;\n }\n\n`;
      content=source.slice(0,a)+`  const storage={get:key=>key==='les-cartes-last-role'?'AG':'a'.repeat(48),set:()=>{},remove:()=>{}};`+source.slice(b,c)+mock+source.slice(d);
      if(content.includes('fetch('))throw Error('Unsafe network path remains in preview');
    }
    res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))]||'text/plain','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'none'; form-action 'none'; base-uri 'self'"});res.end(content);
  }catch(error){res.writeHead(500);res.end(String(error));}
}).listen(8768,'127.0.0.1',()=>console.log('Offline preview: http://127.0.0.1:8768/cartes/ (no real data/network writes)'));
