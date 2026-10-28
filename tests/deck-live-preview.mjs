/* Production UI + SQL rules inside a disposable local WASM database.
 * No Supabase connection or real credentials. The dependency lives outside the repo.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
async function createPreviewDatabase(){
  const instance=await createDeckDatabase();
  await instance.exec(await readFile(new URL('../supabase/migrations/20261027104826_ritual_economy_bank_five_rewards.sql',import.meta.url),'utf8'));
  await instance.exec(await readFile(new URL('../supabase/operations/current_tcg_rules.sql',import.meta.url),'utf8'));
  await instance.exec("create or replace function public.tcg_push_notify(text,text,text,text) returns void language sql as $$ select; $$;");
  const repairs=await readFile(new URL('../supabase/operations/audit_helper_push_repairs.sql',import.meta.url),'utf8');
  await instance.exec(repairs.slice(0,repairs.indexOf('alter table public.tcg_push_sent')));
  await instance.exec(await readFile(new URL('../supabase/operations/rebalance_economy_v26.sql',import.meta.url),'utf8'));
  await instance.exec(await readFile(new URL('../supabase/operations/ritual_performer_v27.sql',import.meta.url),'utf8'));
  await instance.exec("insert into public.tcg_player_devices(role,device_token_hash) values ('AG',encode(extensions.digest(convert_to(repeat('a',48),'UTF8'),'sha256'),'hex')),('CL',encode(extensions.digest(convert_to(repeat('b',48),'UTF8'),'sha256'),'hex'));");
  await instance.exec("update public.tcg_economy_wallets set balance=60,updated_at=now() where role in ('AG','CL');");
  for(const role of ['AG','CL']){
    await instance.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,expires_at)
      select 'energy-bisou',$1,'standard',n,now()+interval '7 days' from generate_series(1,15) n`,[role]);
    for(const [finish,count] of [['standard',5],['full_art',5],['foil',5],['full_art_foil',1],['legendary',1]]){
      await instance.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,expires_at)
        select t.id,$1,$2,n+50,now()+interval '7 days' from generate_series(1,$3::integer) n
        cross join lateral (select id from public.tcg_card_templates where card_type='challenge' and finish_tier=$2
          and active and not demo and (eligible_role is null or eligible_role=$1)
          order by id offset (n-1) limit 1) t`,[role,finish,count]);
    }
    await instance.query(`insert into public.tcg_cards(template_id,owner_role,finish,wear_seed,status,activated_at,active_until,expires_at,economy_eligible)
      select id,$1,'standard',91,'activated',now()-interval '2 hours',now()+interval '22 hours',now()+interval '7 days',true
      from public.tcg_card_templates where category='EN COUPLE' and card_type='challenge' and finish_tier='standard' and active and not demo
      order by id limit 1`,[role]);
  }
  return instance;
}
let db=await createPreviewDatabase();
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.html':'text/html','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"connect-src 'self'; form-action 'none'; base-uri 'self'");
  res.setHeader('Cache-Control','no-store');
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/__reset'&&req.method==='POST'){
      const old=db;db=await createPreviewDatabase();await old.close();
      res.writeHead(200,{'Content-Type':'application/json'});res.end('{"reset":true}');return;
    }
    if(path==='/rest/v1/rpc/tcg_exchange'&&req.method==='POST') {
      let raw='';for await(const part of req){raw+=part;if(raw.length>15000)throw Error('invalid_request');}
      const p=JSON.parse(raw);
      const r=await db.query('select public.tcg_exchange($1,$2,$3,$4,$5::jsonb) data',[p.p_role,p.p_token,p.p_access_code,p.p_action,p.p_payload||{}]);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(r.rows[0].data));return;
    }
    const file=path==='/cartes/'?'index.html':path.slice('/cartes/'.length);
    if(req.method!=='GET'||!path.startsWith('/cartes/')||! /^(index\.html|preview\/art-v3\.html|[a-z-]+\.(js|css)|icon\.svg|manifest\.webmanifest|assets\/(cards-v3\/)?[a-z0-9-]+\.(webp|png|jpg))$/.test(file)){res.writeHead(404);res.end();return;}
    let body=await readFile(new URL('../cartes/'+file,import.meta.url));
    if(file==='app.js') {
      body=body.toString().replace(/const SUPABASE_URL = "[^"]+";/,'const SUPABASE_URL = location.origin;');
      const a=body.indexOf('  const storage = {'),b=body.indexOf('\n\n  const state =',a);
      if(a<0||b<0)throw Error('Preview source changed');
      body=body.slice(0,a)+`  const storage={get:key=>key==='les-cartes-last-role'?(sessionStorage.getItem(key)||new URLSearchParams(location.search).get('role')||'AG'):key.startsWith('les-cartes-token:')?(key.endsWith('AG')?'a':'b').repeat(48):sessionStorage.getItem(key),set:(key,value)=>sessionStorage.setItem(key,value),remove:key=>sessionStorage.removeItem(key)};`+body.slice(b);
    }
    if(file==='index.html')body=body.toString().replace('<body>','<body style="padding-top:34px"><div id="demoBanner" style="position:fixed;inset:0 0 auto;z-index:99999;background:#47685a;color:white;text-align:center;font:11px sans-serif;padding:6px">ESSAI LOCAL · AUCUN GAIN RÉEL <button id="demoReset" type="button" style="margin-left:12px;border:1px solid #fff9;border-radius:8px;padding:3px 8px;background:#fff2;color:#fff">Recommencer</button></div><script>document.addEventListener("click",async event=>{if(event.target.id!=="demoReset")return;event.target.disabled=true;try{await fetch("/__reset",{method:"POST"});for(const role of ["AG","CL"])localStorage.removeItem("les-cartes-economy-tour:v18:"+role);location.reload()}catch{event.target.disabled=false}})</script>');
    res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))]||'application/octet-stream'});res.end(body);
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
const previewPort=Number(process.env.TCG_PREVIEW_PORT||8769);
server.listen(previewPort,'127.0.0.1',()=>console.log(`Isolated SQL/UI preview: http://127.0.0.1:${previewPort}/cartes/ (local PostgreSQL only)`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
