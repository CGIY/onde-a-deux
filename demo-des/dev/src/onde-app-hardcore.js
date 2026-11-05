/* Dés·ir — the live session has its own clock, revision and transient presses. */
(function(scope){
 'use strict';
 const TERMINAL=new Set(['cancelled','expired']);
 const FINISHED=new Set(['won','lost']);
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
 function validSession(s){
  if(s===null)return true;
  if(!s||!UUID.test(s.id||'')||s.catalogueVersion!=='hardcore-v1'||!['waiting','preparing','scheduled','combat','won','lost','cancelled','expired'].includes(s.status)||!time(s.expiresAt))return false;
  if(!['a','b'].every(a=>typeof s.optedIn?.[a]==='boolean'&&typeof s.acknowledged?.[a]==='boolean'&&(s.presses?.[a]===null||s.presses?.[a]&&UUID.test(s.presses[a].id||'')&&Number.isSafeInteger(s.presses[a].sequence)&&typeof s.presses[a].held==='boolean'&&time(s.presses[a].expiresAt))))return false;
  if(!(s.preparationId===null||UUID.test(s.preparationId||'')))return false;
  if(s.actionRoll!==null){const r=s.actionRoll;if(!r||!UUID.test(r.id||'')||r.kind!==20||!time(r.startAt)||!time(r.revealAt)||Date.parse(r.revealAt)<=Date.parse(r.startAt))return false;if(r.value!==undefined&&(!Number.isInteger(r.value)||r.value<1||r.value>20||r.actionId!=='hardcore-'+String(r.value).padStart(2,'0')))return false;}
  const b=s.boss;if(!b||b.maxHp!==48||b.attackLimit!==4||b.perActorLimit!==2||!Number.isInteger(b.damageTotal)||b.damageTotal<0||b.damageTotal>80||b.hpRemaining!==Math.max(0,48-b.damageTotal)||!['a','b'].every(a=>Number.isInteger(b.attacksUsed?.[a])&&b.attacksUsed[a]>=0&&b.attacksUsed[a]<=2)||![null,'won','lost'].includes(b.outcome))return false;
  if(!Array.isArray(s.attackLedger)||s.attackLedger.length>4)return false;const ids=new Set(),slots=new Set();
  for(const r of s.attackLedger){if(!r||!UUID.test(r.id||'')||ids.has(r.id)||!['a','b'].includes(r.actor)||![1,2].includes(r.slot)||slots.has(r.actor+r.slot)||r.kind!==20||!Number.isInteger(r.value)||r.value<1||r.value>20||!time(r.startAt)||!time(r.impactAt)||Date.parse(r.impactAt)<=Date.parse(r.startAt))return false;ids.add(r.id);slots.add(r.actor+r.slot);}
  return ['a','b'].every(a=>b.attacksUsed[a]===s.attackLedger.filter(r=>r.actor===a).length);
 }
 function createController({remote,onChange=()=>{},clock=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,uuid=()=>scope.crypto.randomUUID(),isVisible=()=>!scope.document?.hidden}={}){
  let session=null,revision=-1,actor=null,offset=0,bestRtt=Infinity,lastServerTime=-Infinity,opened=false,destroyed=false,timer=null,cycling=false,opening=null,error='',held=null,sequence=0;
  const acknowledgements=new Set();
  const state=()=>({session:clone(session),revision,actor,opened,held:!!held,error,serverNow:clock()+offset,lastServerTime});
  const emit=()=>{if(!destroyed)onChange(state());};
  function schedule(){clearTimer(timer);timer=null;if(opened&&!destroyed&&isVisible())timer=setTimer(cycle,500);}
  function accept(raw,sent,received){
   if(!raw||!Number.isSafeInteger(raw.revision)||raw.revision<0||!['a','b'].includes(raw.actor)||!time(raw.serverTime)||!validSession(raw.session))throw Error('La session reçue est incomplète.');
   const server=Date.parse(raw.serverTime),rtt=Math.max(1,received-sent);
   if(raw.revision<revision||raw.revision===revision&&server<lastServerTime)return;
   if(Number.isFinite(server)&&rtt<=bestRtt*1.5){offset=server-(sent+received)/2;bestRtt=Math.min(bestRtt,rtt);}
   if(actor&&actor!==raw.actor)throw Error('Cette session appartient à un autre compte.');
   const oldId=session?.id;session=clone(raw.session);revision=raw.revision;lastServerTime=server;actor=raw.actor;error='';
   if(oldId!==session?.id){held=null;acknowledgements.clear();}
   if(TERMINAL.has(session?.status)||!session?.optedIn?.[actor])held=null;
   emit();maybeAcknowledge();
  }
  async function command(action){
   const sent=clock();try{const raw=await remote.hardcore(action);if(!destroyed)accept(raw,sent,clock());return raw;}
   catch(e){if(!destroyed){if(e?.status===401){held=null;session=null;opened=false;clearTimer(timer);timer=null;}error=e?.message||'La connexion au duo est momentanément interrompue.';emit();}throw e;}
  }
  function maybeAcknowledge(){
   if(!opened||!isVisible()||!held||session?.status!=='preparing'||!session.preparationId)return;
   const key=session.id+':'+session.preparationId+':'+held.id;if(acknowledgements.has(key))return;
   acknowledgements.add(key);const pressId=held.id;
   // This command is sent synchronously while the local button is still held.
   command({type:'ACK',sessionId:session.id,preparationId:session.preparationId,pressId}).catch(()=>acknowledgements.delete(key));
  }
  function pressCommand(value){return {type:'PRESS',sessionId:session.id,pressId:value.id,sequence:++sequence,held:true};}
  async function cycle(){
   timer=null;if(!opened||destroyed||!isVisible()){release();return;}
   if(cycling){schedule();return;}cycling=true;
   try{await command(held&&session?pressCommand(held):null);}catch(_){}
   finally{cycling=false;schedule();}
  }
  async function open(){
   if(destroyed)return;if(opening)return opening;opened=true;emit();
   opening=(async()=>{try{await command(null);if(!session||TERMINAL.has(session.status)||FINISHED.has(session.status))await command({type:'CREATE'});}finally{opening=null;schedule();}})();return opening;
  }
  function release(){
   const previous=held;held=null;emit();if(!previous||!session)return Promise.resolve();
   return command({type:'PRESS',sessionId:session.id,pressId:previous.id,sequence:++sequence,held:false}).catch(()=>{});
  }
  async function close(){opened=false;clearTimer(timer);timer=null;await release();emit();}
  async function optIn(enabled){if(!session)return;release();return command({type:'OPT_IN',sessionId:session.id,enabled:!!enabled});}
  function hold(){
   if(destroyed||!opened||!isVisible()||held||!session||!session.optedIn?.a||!session.optedIn?.b||!['waiting','preparing'].includes(session.status))return false;
   held={id:uuid()};emit();command(pressCommand(held)).catch(()=>release());schedule();return true;
  }
  function attack(slot){if(!session)return Promise.reject(Error('La session est fermée.'));return command({type:'ATTACK',sessionId:session.id,slot});}
  async function cancel(){release();if(session)await command({type:'CANCEL',sessionId:session.id});}
  function visibilityChanged(){if(!isVisible()){clearTimer(timer);timer=null;release();}else if(opened){cycle();}}
  function destroy(){release();destroyed=true;opened=false;clearTimer(timer);timer=null;}
  return {open,close,optIn,hold,release,attack,cancel,visibilityChanged,destroy,get state(){return state();},refresh:cycle};
 }
 function mount({root,remote,players}={}){
  if(!root||!remote?.hardcore||!scope.OndeDice)return {destroy(){}};
  const doc=root.ownerDocument,shell=root.querySelector('.oa-shell'),wordmark=root.querySelector('.oa-wordmark'),header=root.querySelector('.oa-header-actions');
  if(!shell||!wordmark||!header)return {destroy(){}};
  const names={a:players?.a||'Vous',b:players?.b||'Votre partenaire'};
  const cards=Object.freeze(scope.DesirHardcoreCards||{}),entry=doc.createElement('button'),panel=doc.createElement('section');
  entry.type='button';entry.className='oa-hc-entry';entry.textContent='HARDCORE';entry.hidden=true;entry.setAttribute('aria-label','Ouvrir le mode Hardcore');header.prepend(entry);
  panel.className='oa-hc-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','oa-hc-title');
  panel.innerHTML='<div class="oa-hc-top"><span>DÉS·IR <small>à deux.</small></span><button type="button" data-hc="close" class="oa-hc-close" aria-label="Fermer le mode Hardcore">×</button></div><p class="oa-hc-eyebrow">Votre catégorie secrète.</p><h1 id="oa-hc-title">HARDCORE<br><em>À deux. En live.</em></h1><label class="oa-hc-optin"><input type="checkbox" data-hc="optin"> J’active le mode pour cette session.</label><p class="oa-hc-status" role="status" aria-live="polite"></p><div class="oa-hc-deck" hidden><div class="oa-hc-stage"><canvas aria-label="Dé vingt faces Hardcore"></canvas></div><p class="oa-hc-caption"></p><h2 class="oa-hc-card" hidden></h2><section class="oa-hc-boss" hidden aria-label="Détrôner la carte à deux"><div class="oa-hc-boss-head"><span>À deux pour la détrôner.</span><strong><span data-hc="hp">48</span><small> / 48 PV</small></strong></div><div class="oa-hc-track" role="progressbar" aria-label="Points de vie de la carte" aria-valuemin="0" aria-valuemax="48" aria-valuenow="48"><span></span></div><p class="oa-hc-total"></p><div class="oa-hc-hits"><div><p data-hc="name-a"></p><div class="oa-hc-slots"><span data-hc-slot="a1">—</span><span data-hc-slot="a2">—</span></div></div><div><p data-hc="name-b"></p><div class="oa-hc-slots"><span data-hc-slot="b1">—</span><span data-hc-slot="b2">—</span></div></div></div><p class="oa-hc-outcome"></p></section><button type="button" data-hc="launch" class="oa-button oa-hc-launch">Maintenez ensemble · D20 ↗</button><button type="button" data-hc="attack" class="oa-button oa-hc-attack" hidden>Attaquer · D20 ↗</button></div><p class="oa-hc-error" role="alert" hidden></p><div class="oa-hc-bottom"><button type="button" data-hc="stop" class="oa-text-button">Arrêter la session</button><button type="button" data-hc="again" class="oa-text-button" hidden>Nouvelle session</button></div>';
  shell.append(panel);
  const $=s=>panel.querySelector(s),check=$('[data-hc=optin]'),launch=$('[data-hc=launch]'),attack=$('[data-hc=attack]'),stop=$('[data-hc=stop]'),again=$('[data-hc=again]'),deck=$('.oa-hc-deck'),status=$('.oa-hc-status'),caption=$('.oa-hc-caption'),card=$('.oa-hc-card'),boss=$('.oa-hc-boss'),error=$('.oa-hc-error');
  const die=scope.OndeDice.create($('canvas'),{kind:20,color:'#e44757',interactive:false,idleMotion:true});
  let taps=0,lastTap=0,view=null,shown=false,destroyed=false,pointer=null,pendingOpt=false,attackPending=false,paintTimer=null,transitionTimer=null,activeAnimation=null,focusBefore=null;
  const seenAnimations=new Set(),inertBefore=new Map(),motion=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
  const controller=createController({remote,onChange:render,isVisible:()=>!doc.hidden&&doc.hasFocus?.()!==false});
  function setInert(active){for(const child of shell.children){if(child===panel)continue;if(active){if(!inertBefore.has(child))inertBefore.set(child,child.inert);child.inert=true;}else{child.inert=inertBefore.get(child)||false;}}if(!active)inertBefore.clear();}
  function transition(active){
   clearTimeout(transitionTimer);shell.classList.toggle('oa-hc-active',active);
   if(active){panel.hidden=false;void panel.offsetWidth;panel.classList.add('is-active');setInert(true);}else{panel.classList.remove('is-active');setInert(false);transitionTimer=setTimeout(()=>{if(!shown)panel.hidden=true;},motion?.matches?0:250);}
  }
  async function show(){if(!remote.authenticated||root.classList.contains('is-busy')||!root.querySelector('#oa-sheet')?.hidden)return;focusBefore=doc.activeElement;shown=true;transition(true);$('[data-hc=close]').focus({preventScroll:true});try{await controller.open();}catch(_){}paint();}
  function hide(){shown=false;pointer=null;controller.release();controller.close();transition(false);clearTimeout(paintTimer);die.pauseMotion?.();if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});}
  function unlock(){if(!remote.authenticated)return;const now=Date.now();taps=now-lastTap>1800?1:taps+1;lastTap=now;if(taps>=5){taps=0;entry.hidden=false;entry.focus({preventScroll:true});show();}}
  function render(next){
   const previous=view;view=next;if(destroyed)return;
   if(previous?.session?.actionRoll&&!next.session?.actionRoll&&previous.lastServerTime<Date.parse(previous.session.actionRoll.startAt)){
    seenAnimations.delete(previous.session.actionRoll.id);activeAnimation=null;die.setKind(20,1);
   }
   if(shown&&!remote.authenticated){hide();return;}
   const s=next.session,actor=next.actor,other=actor==='a'?'b':'a',both=!!(s?.optedIn?.a&&s?.optedIn?.b),terminal=TERMINAL.has(s?.status);
   check.checked=!!s?.optedIn?.[actor];check.disabled=!s||pendingOpt||terminal;
   status.textContent=!s?'Votre duo se retrouve…':terminal?s.status==='expired'?'Cette session a expiré.':'La session est arrêtée.':!s.optedIn?.[actor]?'Ton accord est attendu.':!s.optedIn?.[other]?'Ton accord est donné. Celui de ton partenaire est attendu.':next.held?'Ton appui est maintenu. Gardez les deux boutons appuyés.':'Vous êtes tous les deux d’accord.';
   deck.hidden=!both||terminal;stop.disabled=!s||terminal;again.hidden=!terminal&&!FINISHED.has(s?.status);error.hidden=!next.error;error.textContent=next.error;
   if(!both||terminal){die.setCharge?.(0);activeAnimation=null;die.setKind(20,1);}
   launch.classList.toggle('is-held',next.held);launch.setAttribute('aria-pressed',String(next.held));
   shell.classList.toggle('oa-hc-ready',both&&!terminal);paint();
  }
  function animateRoll(roll,now,endName){
   if(!roll?.id||!Number.isInteger(roll.value))return;
   const start=Date.parse(roll.startAt),end=Date.parse(roll[endName]);
   if(now<start)return;
   if(seenAnimations.has(roll.id))return;seenAnimations.add(roll.id);
   if(now>=end||doc.hidden||motion?.matches){die.setKind(20,roll.value);return;}
   activeAnimation=roll.id;die.setKind(20,die.value||1);
   die.roll(roll.value,{durationMs:end-start,elapsedMs:now-start,power:.55}).then(()=>{if(activeAnimation===roll.id){activeAnimation=null;paint();}});
  }
  function paint(){
   clearTimeout(paintTimer);paintTimer=null;if(!view||destroyed||!shown)return;
   const {session:s,actor}=view,now=controller.state.serverNow,both=!!(s?.optedIn?.a&&s?.optedIn?.b),terminal=TERMINAL.has(s?.status),roll=s?.actionRoll;
   const reveal=roll&&now>=Date.parse(roll.revealAt)&&Number.isInteger(roll.value),selecting=!!roll&&!reveal;
   const hits=(s?.attackLedger||[]),landed=hits.filter(h=>now>=Date.parse(h.impactAt)),damage=landed.reduce((n,h)=>n+h.value,0),hp=Math.max(0,48-damage),used=hits.filter(h=>h.actor===actor).length;
   // The committed face arrives before its future start so both screens can
   // schedule the same motion. Keep capture until a server reply confirms start.
   const started=!!roll&&view.lastServerTime>=Date.parse(roll.startAt);
   launch.hidden=started||!both||terminal;launch.disabled=!both||terminal||!['waiting','preparing','scheduled'].includes(s?.status);
   launch.textContent=view.held?'Maintenez… à deux.':'Maintenez ensemble · D20 ↗';
   if(s?.status==='preparing')caption.textContent='Gardez vos deux boutons appuyés…';
   else if(selecting)caption.textContent=now<Date.parse(roll.startAt)?'Le départ se prépare. Gardez les appuis.':'Votre dé part ensemble…';
   else if(reveal)caption.textContent='Le D20 a choisi votre carte.';
   else caption.textContent='Un D20 partagé pour choisir votre carte.';
   card.hidden=!reveal;card.textContent=reveal?(cards[roll.actionId]||'Carte '+roll.value):'';boss.hidden=!reveal;
   if(roll)animateRoll(roll,now,'revealAt');
   for(const hit of hits)animateRoll(hit,now,'impactAt');
   $('[data-hc=hp]').textContent=String(hp);const track=$('.oa-hc-track');track.setAttribute('aria-valuenow',String(hp));track.querySelector('span').style.transform='scaleX('+(hp/48)+')';
   $('.oa-hc-total').textContent='Total du duo : '+damage+' · deux jets chacun.';
   for(const who of ['a','b']){
    $('[data-hc=name-'+who+']').textContent=who===actor?'Toi':'Ton partenaire';
    for(const slot of [1,2]){const el=$('[data-hc-slot="'+who+slot+'"]'),hit=landed.find(h=>h.actor===who&&h.slot===slot),flying=hits.some(h=>h.actor===who&&h.slot===slot);el.textContent=hit?String(hit.value):flying?'…':'—';el.classList.toggle('is-filled',!!hit);el.setAttribute('aria-label',(who===actor?'Ton jet ':'Jet du partenaire ')+slot+(hit?' : '+hit.value:flying?' en cours':' non joué'));}
   }
   const finished=landed.length===4;
   $('.oa-hc-outcome').textContent=hp===0?'Carte détrônée. Bien joué, à deux.':finished?'Elle résiste. La suite vous appartient.':'Quatre D20 pour atteindre 48.';
   attack.hidden=!reveal||terminal;attack.disabled=attackPending||used>=2||hits.some(h=>now<Date.parse(h.impactAt));attack.dataset.slot=String(used+1);attack.textContent=used>=2?'Tes deux D20 sont joués.':'Attaquer · D20 '+(used+1)+'/2 ↗';
   if(shown&&!doc.hidden)paintTimer=setTimeout(paint,100);
  }
  function release(){pointer=null;controller.release();die.setCharge?.(0);}
  function down(event){if(event.button!==0||event.isPrimary===false||launch.disabled)return;event.preventDefault();if(controller.hold()){pointer=event.pointerId;try{launch.setPointerCapture(pointer);}catch(_){}die.setCharge?.(.6);}}
  function up(event){if(pointer!==null&&event.pointerId===pointer)release();}
  function keyDown(event){
   if(event.key==='Escape'){event.preventDefault();hide();return;}
   if(event.target===launch&&(event.code==='Space'||event.key===' '||event.key==='Enter')){event.preventDefault();if(!event.repeat)controller.hold();}
   if(event.key==='Tab'&&shown){const focusable=Array.from(panel.querySelectorAll('button,input')).filter(e=>!e.disabled&&!e.hidden&&e.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}
  }
  function keyUp(event){if(event.code==='Space'||event.key===' '||event.key==='Enter')release();}
  function visibility(){if(doc.hidden){release();clearTimeout(paintTimer);die.pauseMotion?.();}controller.visibilityChanged();if(!doc.hidden&&shown)paint();}
  function blur(){release();controller.visibilityChanged();}
  async function changed(){if(pendingOpt)return;pendingOpt=true;check.disabled=true;try{await controller.optIn(check.checked);}catch(_){}finally{pendingOpt=false;render(controller.state);}}
  async function clicked(event){const button=event.target.closest('[data-hc]');if(!button)return;const action=button.dataset.hc;if(action==='close')hide();if(action==='stop'){release();try{await controller.cancel();}catch(_){}}if(action==='again'){seenAnimations.clear();await controller.open().catch(()=>{});}if(action==='attack'&&!attack.disabled){attackPending=true;paint();try{await controller.attack(Number(attack.dataset.slot));}catch(_){}finally{attackPending=false;paint();}}}
  entry.addEventListener('click',show);wordmark.addEventListener('click',unlock);panel.addEventListener('click',clicked);check.addEventListener('change',changed);launch.addEventListener('pointerdown',down);launch.addEventListener('pointerup',up);launch.addEventListener('pointercancel',up);launch.addEventListener('lostpointercapture',up);launch.addEventListener('focusout',release);panel.addEventListener('keydown',keyDown);scope.addEventListener('keyup',keyUp);scope.addEventListener('pointerup',up);scope.addEventListener('blur',blur);doc.addEventListener('visibilitychange',visibility);launch.addEventListener('contextmenu',event=>event.preventDefault());
  return {controller,open:show,close:hide,destroy(){destroyed=true;controller.destroy();clearTimeout(paintTimer);clearTimeout(transitionTimer);die.destroy();setInert(false);entry.remove();panel.remove();wordmark.removeEventListener('click',unlock);scope.removeEventListener('keyup',keyUp);scope.removeEventListener('pointerup',up);scope.removeEventListener('blur',blur);doc.removeEventListener('visibilitychange',visibility);}};
 }
 const api=Object.freeze({createController,mount,validSession});scope.OndeHardcore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
