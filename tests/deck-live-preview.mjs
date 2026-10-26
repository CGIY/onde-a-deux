/* Production UI + SQL rules inside a disposable local WASM database.
 * No Supabase connection or real credentials. The dependency lives outside the repo.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase();
await db.exec("insert into public.tcg_player_devices(role,device_token_hash) values ('AG',encode(extensions.digest(convert_to(repeat('a',48),'UTF8'),'sha256'),'hex')),('CL',encode(extensions.digest(convert_to(repeat('b',48),'UTF8'),'sha256'),'hex'));");
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.html':'text/html','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"connect-src 'self'; form-action 'none'; base-uri 'self'");
  res.setHeader('Cache-Control','no-store');
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/rest/v1/rpc/tcg_exchange'&&req.method==='POST') {
      let raw='';for await(const part of req){raw+=part;if(raw.length>15000)throw Error('invalid_request');}
      const p=JSON.parse(raw);
      const r=await db.query('select public.tcg_exchange($1,$2,$3,$4,$5::jsonb) data',[p.p_role,p.p_token,p.p_access_code,p.p_action,p.p_payload||{}]);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(r.rows[0].data));return;
    }
    const file=path==='/cartes/'?'index.html':path.slice('/cartes/'.length);
    if(req.method!=='GET'||!path.startsWith('/cartes/')||! /^(index\.html|[a-z-]+\.(js|css)|icon\.svg|manifest\.webmanifest|assets\/[a-z-]+\.(webp|png|jpg))$/.test(file)){res.writeHead(404);res.end();return;}
    let body=await readFile(new URL('../cartes/'+file,import.meta.url));
    if(file==='app.js') {
      body=body.toString().replace(/const SUPABASE_URL = "[^"]+";/,'const SUPABASE_URL = location.origin;');
      const a=body.indexOf('  const storage = {'),b=body.indexOf('\n\n  const state =',a);
      if(a<0||b<0)throw Error('Preview source changed');
      body=body.slice(0,a)+`  const storage={get:key=>key==='les-cartes-last-role'?'AG':key.startsWith('les-cartes-token:')?(key.endsWith('AG')?'a':'b').repeat(48):null,set:()=>{},remove:()=>{}};`+body.slice(b);
    }
    if(file==='index.html')body=body.toString().replace('<body>','<body><div style="position:fixed;inset:0 0 auto;z-index:99999;background:#47685a;color:white;text-align:center;font:9px sans-serif;padding:6px">TEST LOCAL · AUCUN GAIN RÉEL</div>');
    res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))]||'application/octet-stream'});res.end(body);
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
server.listen(8769,'127.0.0.1',()=>console.log('Isolated SQL/UI preview: http://127.0.0.1:8769/cartes/ (local PostgreSQL only)'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
