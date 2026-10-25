// Offline-only visual QA. No Supabase calls, credentials, disk writes or real draws.
// Run: node tests/booster-preview.mjs, then open http://127.0.0.1:8768/cartes/
import http from 'node:http';
import {readFileSync} from 'node:fs';
const root=new URL('../cartes/',import.meta.url);
const until=new Date(Date.now()+86400000).toISOString();
const data={role:'AG',partner_role:'CL',partner_online:false,boosters:[{id:'demo-pack',edition:'edition_01',expires_at:until}],my_cards:[],partner_cards:[],active_cards:[],known_cards:[],trades:[],card_events:[],pending_openings:[],catalogue_total:100,catalogue_slots:[],editions:[{id:'edition_01',total:90,discovered:0},{id:'halloween_2026',total:10,discovered:0}],next_booster_at:until};
const cards=['energy','challenge','challenge'].map((type,i)=>({id:`demo-${i}`,template_id:`demo-${i}`,title:`DÉMONSTRATION ${i+1}`,challenge:'Carte fictive pour tester les animations. Aucun tirage réel.',category:i?'EN COUPLE':'ÉNERGIE',palette:i?'couple':'energy',card_type:type,finish:i===2?'foil':'standard',edition:'edition_01',status:'available',wear_seed:i,booster_id:'demo-pack',expires_at:until}));
const samples=[...cards,...['other','foodies','todo'].map((palette,i)=>({...cards[1],id:`demo-${i+3}`,template_id:`demo-${i+3}`,title:`DÉMONSTRATION ${i+4}`,category:['POUR L’AUTRE','LES FOODIES','TO DO'][i],palette,finish:['full_art','full_art_foil','standard'][i]}))];
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.html':'text/html'};
http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.writeHead(302,{Location:'/cartes/'});return res.end();}
  const file=path==='/cartes/'?'index.html':path.slice('/cartes/'.length);
  if(!path.startsWith('/cartes/')||file.includes('..')||! /^(index\.html|app\.js|booster-gesture\.js|service-worker\.js|[a-z-]+\.css|icon\.svg|manifest\.webmanifest|assets\/[a-z-]+\.(jpg|png)|preview\/(index\.html|legendary-concept\.png|legendary\.js|legendary\.css))$/.test(file)){res.writeHead(404);return res.end();}
  try{
    let content=readFileSync(new URL(file,root));
    if(file==='index.html')content=content.toString().replace('<body>','<body><div class="demo-notice">DÉMONSTRATION ISOLÉE · AUCUNE SAUVEGARDE</div><style>.demo-notice,.booster-dialog:after,.card-dialog:after,.info-dialog:after,.destroy-dialog:after,.stack-dialog:after{position:fixed;top:0;left:0;right:0;text-align:center;background:#47685a;color:#fff;padding:7px;font:9px sans-serif;letter-spacing:.1em;z-index:9999}.booster-dialog:after,.card-dialog:after,.info-dialog:after,.destroy-dialog:after,.stack-dialog:after{content:"DÉMONSTRATION ISOLÉE · AUCUNE SAUVEGARDE"}body{padding-top:25px}</style>');
    if(file==='app.js'){
      const source=content.toString();
      const a=source.indexOf('  const storage = {'),b=source.indexOf('\n\n  const state =',a);
      const c=source.indexOf('  async function exchange('),d=source.indexOf('  function serverNow()',c);
      if([a,b,c,d].some(v=>v<0))throw Error('Preview adapter no longer matches production source');
      const mock=`
  let demoOpened=false, demoFailed=false;
  const demoData=${JSON.stringify(data)}, demoCards=${JSON.stringify(cards)}, demoSamples=${JSON.stringify(samples)};
  if(location.search.includes('scene=')) {
    demoData.my_cards=[...demoSamples,{...demoSamples[0],id:'demo-copy',wear_seed:8,expires_at:new Date(Date.now()+172800000).toISOString()}];
    demoData.partner_cards=demoSamples.slice(0,3).map(c=>({...c,id:'partner-'+c.id,owner_role:'CL'}));
    demoData.my_cards[1].expires_at=new Date(Date.now()+60000).toISOString();
    demoData.active_cards=[{...demoSamples[0],id:'active-demo',owner_role:'AG',active_until:${JSON.stringify(until)}}];
    if(location.search.includes('rest'))demoData.boosters=[];
    if(location.search.includes('trade'))demoData.trades=[{id:'demo-incoming',proposed_by:'CL',status:'pending',expires_at:${JSON.stringify(until)},offered:demoData.partner_cards[1],requested:demoData.my_cards[1]}];
  }
  if(location.search.includes('spells')) {
    const spells=['reducto','presto','adagio','augmento','destructo'].map(code=>({...demoSamples[1],id:'demo-spell-'+code,template_id:'demo-spell-'+code,title:code.toUpperCase(),challenge:'Sortilège fictif pour tester son effet.',category:'SORTILÈGES',palette:code,card_type:'spell',spell_code:code,expires_at:demoSamples[0].expires_at,finish:['augmento','destructo'].includes(code)?'full_art_foil':'standard'}));
    demoData.my_cards.push(...spells);
    demoData.active_cards.push(...[1,2].map(i=>({...demoSamples[1],id:'ritual-'+i,title:'RITUEL FICTIF '+i,owner_role:'CL',active_until:new Date(Date.now()+36000000).toISOString()})));
    demoData.catalogue_total=100;demoData.editions[0].total=90;
  }
  if(location.search.includes('legends')) {
    demoData.my_cards.push(...['couple','other','nude','foodies','todo'].map((palette,i)=>({...demoSamples[0],id:'demo-legend-'+palette,template_id:'demo-legend-'+palette,category:['EN COUPLE','POUR L’AUTRE','MISE À NUE','LES FOODIES','TO DO'][i],palette,title:'LÉGENDAIRE',card_type:'challenge',finish:'legendary',legendary_options:[{id:'choice-'+palette+'-1',title:i===3?'on mange TOUT ce que je veux, toute la journée':i===4?'gros travaux effectué par l’autre':'DÉFI FICTIF A',challenge:'Premier défi fictif.'},...i<3?[{id:'choice-'+palette+'-2',title:'DÉFI FICTIF B',challenge:'Deuxième défi fictif.'}]:[]]})));
  }
  function demoDiscover() {
    const templates=[...new Map([...demoData.known_cards,...demoData.my_cards].map(c=>[c.template_id,c])).values()];
    demoData.known_cards=templates.map(c=>({...c,finish_tier:c.finish,owned_count:demoData.my_cards.filter(x=>x.template_id===c.template_id).length}));
    demoData.editions[0].discovered=templates.length;
    demoData.catalogue_slots=demoData.editions.flatMap(e=>Array.from({length:e.total},(_,i)=>({number:i+1,edition:e.id,template_id:e.id==='edition_01'?(templates[i]?.template_id||null):null})));
  }
  if(location.search.includes('resume')) {
    demoOpened=true;demoData.my_cards=[...demoCards];demoData.boosters=[];
    demoData.pending_openings=[{booster_id:'demo-pack',cards:structuredClone(demoCards),index:1,opened_at:new Date().toISOString(),progress_at:new Date().toISOString()}];
  }
  demoDiscover();
  async function exchange(action='sync',payload={}) {
    if(action==='open_booster') {
      if(location.search.includes('failure=once')&&!demoFailed){demoFailed=true;throw Error('network_error');}
      if(demoOpened){state.data=structuredClone(demoData);return state.data;}demoOpened=true;
      demoData.my_cards.push(...demoCards);demoData.boosters=[];
      demoData.pending_openings.push({booster_id:'demo-pack',cards:structuredClone(demoCards),index:0,opened_at:new Date().toISOString(),progress_at:new Date().toISOString()});demoDiscover();
      if(location.search.includes('failure=lost')&&!demoFailed){demoFailed=true;throw Error('network_error');}
    } else if(action==='opening_progress') {
      const receipt=demoData.pending_openings.find(r=>r.booster_id===payload.booster_id);if(receipt){receipt.index=payload.index;receipt.progress_at=new Date().toISOString();}return {opening_saved:true};
    } else if(action==='finish_opening') {
      demoData.pending_openings=demoData.pending_openings.filter(r=>r.booster_id!==payload.booster_id);return {opening_saved:true};
    } else if(action==='activate_card') {
      const card=demoData.my_cards.find(c=>c.id===payload.card_id);if(!card)throw Error('card_unavailable');
      const choice=card.legendary_options?.find(c=>c.id===payload.choice_template_id);if(card.finish==='legendary'&&!choice)throw Error('invalid_legendary_choice');
      demoData.my_cards=demoData.my_cards.filter(c=>c.id!==card.id);demoData.active_cards.push({...card,...(choice?{title:choice.title,challenge:choice.challenge,selected_template_id:choice.id}:{}),owner_role:'AG',active_until:${JSON.stringify(until)}});demoDiscover();
    } else if(action==='use_spell') {
      const card=demoData.my_cards.find(c=>c.id===payload.spell_card_id);if(!card)throw Error('spell_unavailable');
      let target;
      if(card.spell_code==='destructo') {
        target=demoData.partner_cards.find(c=>c.id===payload.target_card_id&&c.status==='available');if(!target)throw Error('spell_unavailable');
        demoData.partner_cards=demoData.partner_cards.filter(c=>c.id!==target.id);
      } else {
        target=demoData.active_cards.find(c=>c.id===payload.target_card_id&&c.owner_role==='CL');if(!target)throw Error('spell_unavailable');
        if(['reducto','augmento'].includes(card.spell_code)){if(target.effect_modifier)throw Error('effect_already_modified');target.effect_modifier=card.spell_code;}
        else{if(target.time_modifier)throw Error('time_already_modified');target.time_modifier=card.spell_code;target.active_until=new Date(Date.now()+(Date.parse(target.active_until)-Date.now())*(card.spell_code==='presto'?.5:2)).toISOString();}
      }
      demoData.my_cards=demoData.my_cards.filter(c=>c.id!==card.id);
      demoData.card_events.unshift({id:'event-'+Date.now(),event_type:'spell_cast',actor_role:'AG',recipient_role:'CL',title:card.title,finish:card.finish,target_title:target.title,created_at:new Date().toISOString()});demoDiscover();
    } else if(action==='pin_card') {
      const card=demoData.my_cards.find(c=>c.id===payload.card_id);if(!card)throw Error('card_unavailable');card.is_pinned=payload.is_pinned;
    } else if(action==='complete_card') {
      const card=demoData.active_cards.find(c=>c.id===payload.card_id&&c.owner_role==='AG');if(!card)throw Error('card_unavailable');
      demoData.active_cards=demoData.active_cards.filter(c=>c.id!==card.id);
      demoData.card_events.unshift({id:'event-'+Date.now(),card_id:card.id,event_type:action,actor_role:'AG',title:card.title,finish:card.finish,created_at:new Date().toISOString()});
    } else if(action==='give_card'||action==='destroy_card') {
      const card=demoData.my_cards.find(c=>c.id===payload.card_id);if(!card||card.status!=='available')throw Error('card_unavailable');
      demoData.my_cards=demoData.my_cards.filter(c=>c.id!==card.id);
      demoData.card_events.unshift({id:'event-'+Date.now(),card_id:card.id,event_type:action,actor_role:'AG',recipient_role:action==='give_card'?'CL':null,title:card.title,finish:card.finish,created_at:new Date().toISOString()});
      if(action==='give_card')demoData.partner_cards.push({...card,owner_role:'CL'});
      demoDiscover();
    } else if(action==='trade_propose') {
      demoData.trades.push({id:'demo-proposal',proposed_by:'AG',status:'pending',expires_at:${JSON.stringify(until)},offered:demoData.my_cards.find(c=>c.id===payload.offered_card_id),requested:demoData.partner_cards.find(c=>c.id===payload.requested_card_id)});
    } else if(action==='trade_respond'||action==='trade_cancel') {
      const trade=demoData.trades.find(t=>t.id===payload.trade_id);if(trade)trade.status=action==='trade_cancel'?'cancelled':payload.decision==='accept'?'accepted':'rejected';
    } else if(!['sync','login'].includes(action))throw Error('This action is disabled in the offline preview');
    state.data=structuredClone(demoData);return state.data;
  }

`;
      content=source.slice(0,a)+`  const storage={get:key=>key==='les-cartes-last-role'?'AG':'a'.repeat(48),set:()=>{},remove:()=>{}};`+source.slice(b,c)+mock+source.slice(d);
      if(content.includes('fetch('))throw Error('Unsafe network path remains in preview');
    }
    res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))]||'text/plain','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'none'; form-action 'none'; base-uri 'self'"});res.end(content);
  }catch(error){res.writeHead(500);res.end(String(error));}
}).listen(8768,'127.0.0.1',()=>console.log('Offline preview: http://127.0.0.1:8768/cartes/ (no real data/network writes)'));
