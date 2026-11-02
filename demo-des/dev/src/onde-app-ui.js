(function(){
 'use strict';
 const root=document.getElementById('onde-app-v1');
 if(!root || !window.OndeGame || !window.OndeDice)return;
 const G=window.OndeGame, main=root.querySelector('#oa-main'), sheet=root.querySelector('#oa-sheet');
 const storageKey='onde-couple-prototype-v1';
 const remote=window.OndeRemote&&window.OndeRemote.create(window.DesirConfig||{});
 const remoteMode=!!(window.DesirConfig&&window.DesirConfig.endpoint);
 const persona=root.querySelector('.oa-persona'),navigation=root.querySelector('.oa-nav');
 let remoteReady=false,authBusy=remoteMode,operationBusy=false,loginError='',loginUsername='',remoteSnapshot=null,deferredSnapshot=null,remoteSignature='',serverOffset=0;
 const welcomeKey='desir-welcome-v1';
 let welcomeDismissed=false;try{welcomeDismissed=localStorage.getItem(welcomeKey)==='1';}catch(_){}
 let localPrefs={sound:false};try{const saved=JSON.parse(localStorage.getItem('desir-preferences-v1')||'{}');if(typeof saved.sound==='boolean')localPrefs.sound=saved.sound;}catch(_){}

 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let state=G.createState(), tab='play', busy=false, rerolling=false, toastTimer, lastFocus=null, animationSerial=0;
 let charge=null,suppressedClick=null,controlsBusyState=null;
 let persisted=false, canPersist=true, recovery=false, lastError='';
 let renderKey='';
 const gaugeFrames=new Map();
 const pendingChecks=new Set();
 let taskExpiryTimer;
 let visibleCardId=null, openedInvitation=null, viewPlayer='a', sharedSnapshot=null;
 if(!remoteMode){
 try{
  const raw=localStorage.getItem(storageKey);
  if(raw){let saved=null;try{saved=G.normalizeState(JSON.parse(raw),{at:new Date().toISOString()});}catch(_){}if(saved)state=saved;else{localStorage.setItem(storageKey+'-recovery',raw);recovery=true;}}
  localStorage.setItem(storageKey,JSON.stringify(state));persisted=true;
 }catch(_){canPersist=false;persisted=false;}
 viewPlayer=state.activePlayer;
 try{const savedView=sessionStorage.getItem(storageKey+'-profile');if(['a','b'].includes(savedView))viewPlayer=savedView;}catch(_){}
 state={...state,activePlayer:viewPlayer};
 try{sharedSnapshot=localStorage.getItem(storageKey);}catch(_){}
 }
 const canvas=document.createElement('canvas');
 canvas.id='oa-dice';canvas.className='cursor-interaction';canvas.setAttribute('role','img');
 const die=window.OndeDice.create(canvas,{kind:6,value:3,duration:1650,maxPixelRatio:2,reducedMotion:!!systemReduce,onRelease:power=>{if(tab==='play'&&!busy)return roll(false,power);}});
 const h=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=id=>(state.players.find(p=>p.id===id)||{}).name||'Partenaire';
 const now=()=>new Date().toISOString();
 const percent=hp=>(G.probability(hp)*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
 const card=()=>G.getCard(state.round.cardId);
 const category=()=>G.getCategory(state.round.categoryId);
 const shownRolls=()=>state.phase==='draft_challenge'||(state.round.status==='defended'&&!state.round.rolls.length)?state.round.draftRolls:state.round.rolls;
 const sum=()=>shownRolls().reduce((a,b)=>a+b,0);
 const canDraw=()=>state.activePlayer===state.round.from;
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const chargeNow=()=>window.performance?.now?window.performance.now():Date.now();
 const chargeLimit=1200;
 function rollButton(target){const button=target.closest?.('[data-action]');return button&&root.contains(button)&&['roll','reroll'].includes(button.dataset.action)?button:null;}
 function canCharge(button){
  if(!button||button.disabled||!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return false;
  if(button.dataset.action==='reroll')return G.canRerollCard(state);
  return state.phase==='category'&&canDraw()&&(!remoteMode||remoteSnapshot?.quota?.remaining!==0)||state.phase==='card'&&canDraw()||state.phase==='draft_challenge'&&G.canRollDraftDefense(state)||state.phase==='challenge'&&G.canRespond(state);
 }
 function drawCharge(){
  if(!charge)return;const power=Math.max(0,Math.min(1,(chargeNow()-charge.started)/chargeLimit));
  charge.button.style.setProperty('--oa-charge',String(power));die.setCharge?.(power);charge.power=power;
  if(power<1)charge.frame=window.requestAnimationFrame?window.requestAnimationFrame(drawCharge):setTimeout(drawCharge,16);else charge.frame=null;
 }
 function clearCharge(suppress=true,refresh=true){
  const active=charge;if(!active)return null;charge=null;
  if(active.frame!==null){if(window.cancelAnimationFrame)window.cancelAnimationFrame(active.frame);else clearTimeout(active.frame);}
  active.button.classList.remove('is-charging');active.button.style.setProperty('--oa-charge','0');die.setCharge?.(0);
  if(suppress)suppressedClick={button:active.button,source:active.source,pointerId:active.pointerId,until:Infinity};
  try{if(active.pointerId!==undefined)active.button.releasePointerCapture?.(active.pointerId);}catch(_){}
  if(refresh&&remoteMode&&deferredSnapshot&&!busy&&!operationBusy&&!pendingChecks.size){flushRemote(null,false);render();}
  return active;
 }
 function startCharge(button,source,event){
  if(!canCharge(button)||charge)return false;
  suppressedClick=null;charge={button,source,started:chargeNow(),power:0,frame:null,pointerId:source==='pointer'?event.pointerId:undefined,x:event.clientX,y:event.clientY,phase:state.phase,roundId:state.round.id,cardId:state.round.cardId,actor:viewPlayer};
  button.classList.add('is-charging');drawCharge();
  try{if(source==='pointer')button.setPointerCapture?.(event.pointerId);}catch(_){}
  return true;
 }
 async function releaseCharge(event){
  const active=charge;if(!active)return;
  if(active.source==='pointer'&&event.pointerId!==active.pointerId)return;
  const power=Math.max(0,Math.min(1,(chargeNow()-active.started)/chargeLimit));let inside=active.button.isConnected&&canCharge(active.button);
  if(active.source==='pointer'){const rect=active.button.getBoundingClientRect();inside=inside&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;}
  else inside=inside&&document.activeElement===active.button;
  clearCharge(true,false);suppressedClick.until=chargeNow()+600;
  if(remoteMode)flushRemote(null,false);
  inside=inside&&active.phase===state.phase&&active.roundId===state.round.id&&active.cardId===state.round.cardId&&active.actor===viewPlayer&&canCharge(active.button);
  if(inside)await roll(active.button.dataset.action==='reroll',power);else render();
 }
 function ignoreChargedClick(button,event){
  if(!suppressedClick||suppressedClick.button!==button||chargeNow()>suppressedClick.until)return false;
  if(suppressedClick.source==='pointer'&&event.detail===0||suppressedClick.source==='keyboard'&&event.detail!==0)return false;
  suppressedClick=null;return true;
 }
 function save(){if(remoteMode||!canPersist)return;try{const raw=JSON.stringify(state);localStorage.setItem(storageKey,raw);sharedSnapshot=raw;persisted=true;}catch(_){persisted=false;}}
 function receiveShared(raw){
  if(remoteMode||!raw||raw===sharedSnapshot)return false;
  let incoming;try{incoming=G.normalizeState(JSON.parse(raw),{at:now()});}catch(_){return false;}
  if(!incoming)return false;
  sharedSnapshot=raw;state={...incoming,activePlayer:viewPlayer};return true;
 }
 function pullShared(){if(remoteMode||!canPersist)return false;try{return receiveShared(localStorage.getItem(storageKey));}catch(_){return false;}}
 function changeView(player){if(remoteMode||!['a','b'].includes(player))return;pullShared();viewPlayer=player;state={...state,activePlayer:player};openedInvitation=null;try{sessionStorage.setItem(storageKey+'-profile',player);}catch(_){}render();}
 function awaitingPlayer(player){return ['pending','sender_confirmation','challenge','challenge_failed'].includes(state.phase)&&state.round.awaiting===player;}
 function invitationKey(){return state.round.id+'-'+state.round.awaiting;}

 function announce(text){root.querySelector('#oa-announcement').textContent=text;}
 function serverNow(){return Date.now()+serverOffset;}
 function samePerspective(a,b){return a&&b&&a.roomId===b.roomId&&a.actor===b.actor;}
 function currentPerspective(value){const identity=remote?.connection;return !identity||samePerspective(value,identity);}
 function applyRemote(value,renderNow=true){
  if(!value||!value.state||!['a','b'].includes(value.actor)||!currentPerspective(value))return false;
  if(samePerspective(value,remoteSnapshot)&&value.revision<remoteSnapshot.revision)return false;
  const normalized=G.normalizeState(value.state);if(!normalized||normalized.activePlayer!==value.actor)return false;
  if(remoteSnapshot&&!samePerspective(value,remoteSnapshot)){openedInvitation=null;visibleCardId=null;gaugeFrames.clear();}
  if(value.serverTime&&Number.isFinite(Date.parse(value.serverTime)))serverOffset=Date.parse(value.serverTime)-Date.now();
  const signature=JSON.stringify({state:value.state,revision:value.revision,actor:value.actor,quota:value.quota,paired:value.paired});
  const changed=signature!==remoteSignature;remoteSignature=signature;remoteSnapshot=value;
  state={...normalized,prefs:{...normalized.prefs,...localPrefs}};viewPlayer=value.actor;remoteReady=true;authBusy=false;loginError='';
  if(renderNow&&changed)render();return changed;
 }
 function receiveRemote(value){
  if(!value||!currentPerspective(value))return false;
  if(charge||busy||operationBusy||pendingChecks.size){if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;return false;}
  return applyRemote(value);
 }
 function flushRemote(value,renderNow=false){
  let chosen=currentPerspective(value)?value:null;
  if(deferredSnapshot&&currentPerspective(deferredSnapshot)&&(!chosen||deferredSnapshot.revision>=chosen.revision))chosen=deferredSnapshot;
  deferredSnapshot=null;return chosen?applyRemote(chosen,renderNow):false;
 }
 function updateLoginError(message){
  loginError=message||'';const element=main.querySelector('[data-login-error]');if(element){element.textContent=loginError;element.hidden=!loginError;}
 }
 function remoteError(error){
  if(error&&error.snapshot)flushRemote(error.snapshot,false);
  const message=error&&error.isDesirRemoteError?error.message:'La connexion au duo est momentanément indisponible.';
  if(remote&&remote.connection&&!remote.authenticated){remoteReady=false;loginError=message;}
  toast(message);return false;
 }
 async function dispatch(action,doRender=true){
  if(remoteMode){
   if(action.type==='SET_PREFS'){
    if(typeof action.patch?.sound==='boolean'){localPrefs.sound=action.patch.sound;state={...state,prefs:{...state.prefs,...localPrefs}};try{localStorage.setItem('desir-preferences-v1',JSON.stringify(localPrefs));}catch(_){}if(doRender)render();return true;}return false;
   }
   if(!remoteReady||!remote?.enabled)return false;
   if(action.type==='RESET'||action.type==='SWITCH_PLAYER')return false;
   operationBusy=true;setControlsBusy(true);
   const waiting={SEND:['send','Envoi…'],ACCEPT:['accept','Validation…'],NEW_ROUND:['new','Un instant…']}[action.type];
   const trigger=waiting&&main.querySelector('[data-action="'+waiting[0]+'"]');if(trigger){trigger.textContent=waiting[1];trigger.setAttribute('aria-busy','true');}
   try{const value=action.type==='EXPIRE_TASKS'?await remote.refresh():await remote.action({...action,roundId:action.roundId||state.round.id});return flushRemote(value,false);}
   catch(error){return remoteError(error);}
   finally{operationBusy=false;setControlsBusy(false);trigger?.removeAttribute('aria-busy');if(doRender)render();}
  }
  const roundId=state.round.id;pullShared();const next=G.reduce(state,{at:now(),roundId,...action});const changed=next!==state;state=next;if(changed)save();if(doRender)render();return changed;
 }

 function toast(text){clearTimeout(toastTimer);const el=root.querySelector('#oa-toast');el.textContent=text;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},3600);}
 function btn(label,action,style='',extra=''){return '<button type="button" class="oa-button cursor-interaction '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function textBtn(label,action,extra=''){return '<button type="button" class="oa-text-button cursor-interaction" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function eyebrow(text){return '<p class="oa-eyebrow">'+h(text)+'</p>';}
 function heading(title,sub,eyebrowText){return (eyebrowText?eyebrow(eyebrowText):'')+'<h1 class="oa-title">'+title+'</h1>'+(sub?'<p class="oa-subtitle">'+sub+'</p>':'');}
 function steps(active){return '<div class="oa-steps" aria-label="Parcours du jeu"><span class="oa-step '+(active===1?'is-active':active>1?'is-done':'')+'"><b>D6</b>Catégorie</span><span class="oa-step-sep" aria-hidden="true">›</span><span class="oa-step '+(active===2?'is-active':'')+'"><b>D4</b>Carte</span></div>'; }
 function stage(type,label,value){return '<section class="oa-dice-section" aria-label="Lancer le dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+'</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'"></div></section>';}
 function categoriesGrid(){return '<div class="oa-category-grid">'+G.categories.map(c=>'<div class="oa-category" style="--category:'+c.color+'"><div class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></div><span class="oa-category-label">'+h(c.label)+'</span></div>').join('')+'</div>';}
 function handGrid(){return '<div class="oa-card-grid" aria-label="Quatre cartes face cachée">'+state.round.hand.map((id,i)=>{const width=[68,82,74,60][i];return '<div class="oa-mini-card oa-card-back" aria-label="Carte '+(i+1)+' face cachée"><span class="oa-mini-number">'+(i+1)+'</span><div class="oa-card-ghost" aria-hidden="true" inert style="--ghost-title:'+width+'%"><div class="oa-ghost-art"><i></i><i></i><i></i></div><span class="oa-ghost-title"></span><span class="oa-ghost-line"></span></div></div>';}).join('')+'</div>';}
 function healthGauge(owner){
  const r=state.round,rolls=owner==='from'?r.draftRolls:r.rolls,total=rolls.reduce((a,b)=>a+b,0),left=Math.max(0,r.hp-total),ratio=left/r.hp;
  const needed=r.hp-total,chance=rolls.length===0?G.probability(r.hp):rolls.length===1?Math.max(0,Math.min(20,21-needed))/20:0;
  const odds=left===0?'Carte écartée':rolls.length===2?'Deux jets terminés':(chance*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' % de chance '+(rolls.length?'au dernier jet':'sur deux jets');
  return '<section class="oa-hp" data-gauge="'+r.id+'-'+owner+'" data-ratio="'+ratio+'" aria-label="Résistance de la carte"><div class="oa-hp-top"><p>Résistance de la carte</p><strong>'+left+' <span>/ '+r.hp+' PV</span></strong></div><div class="oa-hp-track" role="progressbar" aria-label="Points de vie restants" aria-valuemin="0" aria-valuemax="'+r.hp+'" aria-valuenow="'+left+'">'+Array.from({length:12},(_,i)=>'<i aria-hidden="true"><span style="transform:scaleX('+Math.max(0,Math.min(1,ratio*12-i))+')"></span></i>').join('')+'</div><div class="oa-roll-history">'+[0,1].map(i=>'<span class="oa-roll-token">Jet '+(i+1)+' <b>'+(rolls[i]||'—')+'</b></span>').join('')+'</div><p class="oa-hp-odds">'+odds+'</p></section>';
 }
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function cardFact(c){
  const fact=window.OndeEvidence&&window.OndeEvidence.forCard(c);
  if(!fact||!fact.metric)return '';
  return '<section class="oa-card-fact"><strong>'+h(fact.metric)+'</strong><div><b>'+h(fact.headline)+'</b><p>'+h(fact.detail)+'</p><details class="oa-source"><summary>Source & contexte ↗</summary><p>'+h([fact.scope,fact.year].filter(Boolean).join(' · '))+'</p><p>'+h(fact.limitations)+'</p><a href="'+h(fact.url)+'" target="_blank" rel="noopener noreferrer">'+h(fact.sourceTitle)+' ↗</a></details></div></section>';
 }
 function playingCard(c,compact=false){const cat=G.getCategory(c.categoryId),r=state.round;const own=c.id===r.cardId;const adapted=own&&r.adapted;return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(cat.label)+(adapted?' · VARIANTE':'')+'</span>'+'</div>'+(!compact?'<div class="oa-card-illustration" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2>'+(adapted?'<p class="oa-card-description">'+h(r.proposal)+'</p>':'')+cardFact(c)+'</article>';}

 function renderWelcome(){
  return '<section class="oa-welcome" aria-labelledby="oa-welcome-title"><img class="oa-welcome-icon" src="./icons/desir-192.png" width="76" height="76" alt=""><div class="oa-welcome-copy"><h1 id="oa-welcome-title">Les dés choisissent une idée à deux.</h1><p>Propose-la ou tente de l’écarter au D20.</p><p>Deux coches dans les 6 h, un point pour vous.</p></div><div class="oa-actions">'+btn('C’est parti <span class="oa-arrow" aria-hidden="true">↗</span>','welcome-start')+'</div></section>';
 }
 function renderLogin(){
  if(authBusy)return heading('Votre<br><em>espace.</em>',null,null)+'<div class="oa-login-wait" role="status">Connexion…</div>';
  return heading('Votre<br><em>espace.</em>',null,null)+'<form class="oa-login" data-login-form><label class="oa-field">Identifiant<input id="oa-username" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="80" value="'+h(loginUsername)+'"></label><label class="oa-field">Mot de passe<input id="oa-password" name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p class="oa-form-error" data-login-error role="alert" '+(!loginError?'hidden':'')+'>'+h(loginError)+'</p><div class="oa-actions"><button type="submit" class="oa-button cursor-interaction" '+(!remote?.enabled?'disabled':'')+'>Se connecter <span class="oa-arrow">↗</span></button></div></form>';
 }
 function renderPersona(){
  const hidden=!welcomeDismissed||remoteMode&&!remoteReady;
  persona.hidden=hidden;navigation.hidden=hidden;const help=root.querySelector('[data-action="rules"]');if(help)help.hidden=hidden;
  if(!remoteMode)return;
  if(hidden){persona.innerHTML='';return;}
  persona.innerHTML='<div class="oa-identities" role="group" aria-label="Votre duo">'+['a','b'].map(id=>'<span class="oa-person-name '+(id===viewPlayer?'is-me':'')+'" '+(id===viewPlayer?'aria-current="true"':'')+'>'+h(name(id))+(awaitingPlayer(id)?'<i class="oa-unread" aria-label="Invitation en attente"></i>':'')+'</span>').join('')+'</div>';
 }
 function d6Action(){
  if(remoteMode&&remoteSnapshot?.quota?.remaining===0){const at=remoteSnapshot.quota.nextAt;let time='';try{time=new Date(at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});}catch(_){}return '<div class="oa-next-draw" role="status">Prochain tirage'+(time?' à <strong>'+h(time)+'</strong>':' à la prochaine plage')+'</div>';}
  return btn('Lancer le D6 <span class="oa-arrow">↗</span>','roll');
 }
 function switchButton(id,label){return btn(label||'Voir côté '+h(name(id)),'profile','oa-secondary','data-player="'+id+'"');}
 function responseActions(){const r=state.round;const defend=state.phase==='pending'&&r.status==='pending'&&!r.challengeUsed&&Number.isFinite(r.hp)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge','oa-secondary'):'';return '<div class="oa-actions">'+btn(r.status==='scheduled_proposal'?'Confirmer ce moment':r.status==='counterproposal'?'Accepter la variante':'J’accepte','accept')+defend+'</div>';}

 function privateHome(incoming=false){
  const r=state.round;
  return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+(incoming?'<button type="button" class="oa-invitation cursor-interaction" data-action="open-invitation" data-round="'+h(r.id)+'"><span class="oa-invitation-dot" aria-hidden="true"></span><span><b>'+(state.phase==='sender_confirmation'?'Une réponse t’attend':'Une invitation t’attend')+'</b><small>'+h(name(r.awaiting===r.from?r.to:r.from))+'</small></span><span class="oa-invitation-arrow" aria-hidden="true">↗</span></button>':'<div class="oa-quiet-home"><span aria-hidden="true">〰</span><p>Aucune invitation.</p></div>')+((state.tasks||[]).length?'<div class="oa-actions">'+btn('À faire · '+state.tasks.length,'tab','oa-secondary','data-tab="tasks"')+'</div>':'');
 }
 function renderPlay(){const r=state.round,c=card();
  if(!G.canSeeRound(state))return privateHome();
  if(['pending','sender_confirmation'].includes(state.phase)&&G.canRespond(state)&&openedInvitation!==invitationKey())return privateHome(true);
  if(state.phase==='category')return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+steps(1)+stage(6,'01 / LE THÈME',3)+d6Action()+'<div class="oa-section-head"><h2>Six façons de se retrouver</h2><span>'+G.cards.length+' cartes</span></div>'+categoriesGrid();
  if(state.phase==='card'){
   return heading(h(category().label)+'.<br><em>Laquelle pour vous ?</em>',null,null)+steps(2)+stage(4,'02 / LA CARTE',1)+btn('Lancer le D4 <span class="oa-arrow">↗</span>','roll')+handGrid();
  }
  if(state.phase==='draft'&&rerolling)return heading('Le D4<br><em>rejoue.</em>',null,null)+stage(4,'02 / UNE AUTRE CARTE',r.cardRoll)+btn('Tirage…','roll');
  if(state.phase==='draft')return heading(canDraw()?'Ta prochaine<br><em>invitation.</em>':'Une carte<br><em>à proposer.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+(canDraw()?'<div class="oa-actions">'+btn('Proposer à '+h(name(r.to))+' <span class="oa-arrow">↗</span>','send')+(G.canChallengeDraft(state)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge-draft','oa-secondary'):'')+(G.canRerollCard(state)?textBtn('Relancer le D4 · sans mon D20','reroll'):'')+'</div>':'<div class="oa-actions">'+switchButton(r.from)+'</div>');
  if(state.phase==='draft_challenge'&&!canDraw())return heading('Un défi<br><em>en cours.</em>',h(name(r.from))+' tente d’écarter la carte.',null)+switchButton(r.from);
  if(state.phase==='draft_challenge')return heading('Tenter de<br><em>l’écarter.</em>',h(c.title),null)+healthGauge('from')+stage(20,'03 / ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.draftRolls.length+1)+' sur 2','roll');
  if(state.phase==='pending'){
   const responds=G.canRespond(state),isCounter=r.status==='counterproposal',isLater=r.status==='scheduled_proposal';
   const automatic=r.autoProposed&&r.status==='pending';
   let title=responds?(isCounter?'Une autre<br><em>façon de jouer.</em>':isLater?'Un moment<br><em>à confirmer.</em>':'Une invitation<br><em>pour toi.</em>'):'L’invitation<br><em>est posée.</em>';
   let sub=responds?(isCounter?'Une variante a été proposée. À toi de choisir.':isLater?'Le créneau proposé : '+h(r.schedule):automatic?'Proposée par le D20.':h(name(r.from))+' te propose…'):'Réponse attendue : '+h(name(r.awaiting))+'.';
   return heading(title,sub,null)+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(automatic&&!responds?healthGauge('from'):'')+(r.schedule?statusStrip('Proposition : <strong>'+h(r.schedule)+'</strong>'):'')+(responds?responseActions():'');
  }
  if(state.phase==='sender_confirmation'){
   const responds=G.canRespond(state);
   return heading(responds?'L’envie<br><em>se rencontre ?</em>':'Une dernière<br><em>confirmation.</em>',responds?h(name(r.to))+' a accepté.':h(name(r.from))+' doit confirmer.','PROPOSITION ENVOYÉE')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(responds?'<div class="oa-actions">'+btn('Confirmer','accept')+'</div>':'');
  }
  if(state.phase==='challenge'&&!G.canRespond(state))return heading('Un défi<br><em>en cours.</em>',h(name(r.to))+' tente d’écarter la carte.',null)+statusStrip('Réponse en attente.');
  if(state.phase==='challenge')return heading('Tenter de<br><em>l’écarter.</em>',h(c.title),null)+healthGauge('to')+stage(20,'03 / ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.rolls.length+1)+' sur 2','roll');
  if(state.phase==='challenge_failed')return heading('La proposition<br><em>reste ouverte.</em>',h(c.title),null)+healthGauge('to')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(G.canRespond(state)?responseActions():'<div class="oa-actions">'+switchButton(r.to)+'</div>');
  if(state.phase==='accepted')return heading('C’est dans<br><em>votre liste.</em>',null,null)+'<div class="oa-summary-card"><div><h2>'+h(c.title)+'</h2><p>'+h(category().label)+'</p></div></div><div class="oa-actions">'+btn('Voir les choses à faire','tab','','data-tab="tasks"')+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new','oa-secondary')+'</div>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed',expired=r.status==='expired';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Carte écartée.':expired?'Temps écoulé.':'Une autre<br><em>fois, peut-être.</em>',completed?'+1 point pour votre duo.':null,null)+(defended?healthGauge(r.rolls.length?'to':'from'):'')+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(G.getCategory(c.categoryId).label)+(r.adapted?' · Variante':'')+'</p></div>'+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
  }
  return '';
 }

 function timeLeft(task){const minutes=Math.max(0,Math.ceil((Date.parse(task.expiresAt)-serverNow())/60000));return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0');}
 function taskCheck(task,player){const checked=task.checks[player],own=player===state.activePlayer,enabled=own&&!pendingChecks.has(task.id);return '<label class="oa-task-check '+(!own?'is-other':'')+'"><input type="checkbox" data-task-check="'+h(task.id)+'" data-player="'+player+'" aria-label="'+h(name(player)+' · '+G.getCard(task.cardId).title)+'" '+(checked?'checked ':'')+(!enabled?'disabled':'')+'><span class="oa-check-box" aria-hidden="true"><span class="oa-check-water"><svg viewBox="0 0 96 48" preserveAspectRatio="none"><path d="M0 8Q12 0 24 8T48 8T72 8T96 8V48H0Z"/><path d="M0 12Q12 20 24 12T48 12T72 12T96 12V48H0Z"/></svg></span><svg class="oa-check-mark" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span><span>'+h(name(player))+'</span></label>';}
 function renderTasks(){
  const tasks=state.tasks||[];
  return heading('Les choses<br><em>à faire.</em>',null,null)+(tasks.length?'<div class="oa-task-list">'+tasks.map(task=>{const c=G.getCard(task.cardId),cat=G.getCategory(task.categoryId);return '<article class="oa-task" data-task="'+h(task.id)+'" style="--category:'+cat.color+'"><div class="oa-task-top"><span>'+h(cat.label)+'</span><time datetime="'+h(task.expiresAt)+'" aria-label="Temps restant : '+timeLeft(task)+'">'+timeLeft(task)+'</time></div><h2>'+h(c.title)+'</h2>'+(task.proposal?'<p class="oa-task-proposal">'+h(task.proposal)+'</p>':'')+'<div class="oa-task-checks">'+taskCheck(task,'a')+taskCheck(task,'b')+'</div></article>';}).join('')+'</div>':'<div class="oa-task-empty"><span aria-hidden="true">〰</span><p>Rien en attente.</p></div>')+'<div class="oa-actions">'+(state.phase==='accepted'?btn('Un nouveau tour <span class="oa-arrow">↗</span>','new'):textBtn('Revenir au jeu','tab','data-tab="play"'))+'</div>';
 }
 function setting(key,label,desc){return '<label class="oa-setting"><span>'+label+'<small>'+desc+'</small></span><input type="checkbox" class="cursor-interaction" data-pref="'+key+'" '+(state.prefs[key]?'checked':'')+' aria-label="'+h(label)+'"></label>';}
 const gradeLevels=[
  [5,'Couple complice'],[8,'Duo accordé'],[10,'Couple stable'],[12,'Couple soudé'],
  [15,'Super couple'],[20,'Duo inséparable'],[25,'Couple remarquable'],[30,'Couple légendaire'],
  [35,'Duo d’exception'],[40,'Couple iconique'],[45,'Duo mythique'],[50,'Couple éternel']
 ];
 let gradeScope=null,lastGrade=null,pendingGrade=null,notificationSignature='';
 function gradeAt(total){return gradeLevels.filter(grade=>grade[0]<=total).at(-1)||null;}
 function trackGrade(){
  const scope=remoteMode?(remoteReady?remoteSnapshot.roomId+':'+viewPlayer:null):'demo:'+viewPlayer;
  const points=gradeAt(state.stats.totalCompleted)?.[0]||0;
  if(scope!==gradeScope||lastGrade===null){gradeScope=scope;lastGrade=points;pendingGrade=null;return;}
  if(points>lastGrade)pendingGrade=points;else if(points<lastGrade)pendingGrade=null;
  lastGrade=points;
 }
 function sharedGrade(total){
  const grade=gradeAt(total),next=gradeLevels.find(level=>level[0]>total);
  if(!grade)return '<section class="oa-grade-area oa-grade-first" aria-label="Votre premier grade"><p>Premier grade à 5 points</p><div class="oa-badge-progress" role="progressbar" aria-label="Premier grade" aria-valuemin="0" aria-valuemax="5" aria-valuenow="'+total+'"><i style="transform:scaleX('+total/5+')"></i></div></section>';
  const [points,title]=grade,range=next?next[0]-points:50,progress=next?Math.min(range,total-points):50;
  const remaining=next?next[0]-total:0,caption=next?remaining+' point'+(remaining>1?'s':'')+' avant le prochain grade':'Grade maximal atteint.';
  const icon=points>=30?'<path d="M3.5 7 8 10.5l4-7 4 7 4.5-3.5L18 17.5H6ZM7.5 20.5h9"/>':points>=15?'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>':points>=10?'<path d="M5 19V11a7 7 0 0 1 14 0v8M9 19v-7a3 3 0 0 1 6 0v7M3.5 19h17"/>':'<circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/>';
  return '<section class="oa-grade-area" aria-label="Votre grade commun"><article class="oa-badge oa-grade-card is-earned" data-grade="'+points+'" aria-labelledby="oa-grade-title"><div class="oa-badge-top"><span class="oa-badge-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+icon+'</svg></span><div class="oa-grade-copy"><p class="oa-badge-status">Votre grade</p><h2 id="oa-grade-title">'+title+'</h2></div></div><div class="oa-badge-progress" role="progressbar" aria-label="'+(next?'Prochain grade':'Grade maximal')+'" aria-valuemin="0" aria-valuemax="'+range+'" aria-valuenow="'+progress+'" aria-valuetext="'+caption+'"><i style="transform:scaleX('+progress/range+')"></i></div><p class="oa-badge-progress-text">'+caption+'</p></article></section>';
 }
 function animateGrade(){
  if(tab!=='us'||!welcomeDismissed||remoteMode&&!remoteReady||pendingGrade===null)return;
  const points=pendingGrade;pendingGrade=null;const el=main.querySelector('[data-grade]');
  if(!el||Number(el.dataset.grade)!==points)return;
  if(!systemReduce&&el.animate)el.animate([{opacity:0,transform:'translateY(9px) rotate(-.8deg) scale(.975)'},{opacity:1,transform:'translateY(-1px) rotate(.2deg) scale(1.004)',offset:.72},{opacity:1,transform:'translateY(0) rotate(0) scale(1)'}],{duration:440,easing:'cubic-bezier(.18,.8,.2,1)'});
  announce('Nouveau grade : '+gradeAt(state.stats.totalCompleted)[1]+'.');
 }
 function sharedScore(){
  const stats=state.stats,total=stats.totalCompleted;
  return '<section class="oa-shared-score" aria-label="Score commun"><h1 class="oa-eyebrow">VOTRE SCORE À DEUX</h1><div class="oa-score-number"><strong>'+total.toLocaleString('fr-FR')+'</strong><span>point'+(total>1?'s':'')+'</span></div><p class="oa-score-caption">'+(total?'Des moments vécus, à votre rythme.':'Votre première carte partagée ouvre le score.')+'</p><div class="oa-score-rule"><span aria-hidden="true">✓</span> 1 carte partagée = 1 point</div></section>'+sharedGrade(total)+'<div class="oa-section-head"><h2>Vos cartes partagées</h2></div><div class="oa-score-grid">'+G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+stats.byCategory[c.id].toLocaleString('fr-FR')+'</strong></div>').join('')+'</div>';
 }
 function notificationSetting(){
  const n=remote.notificationStatus;
  return '<section class="oa-notification-setting"><div class="oa-section-head"><h2>Les notifications</h2></div>'+(n.subscribed?'<p class="oa-note">Activées sur cet appareil.</p>':n.supported&&n.permission!=='denied'?btn('Activer les notifications','enable-notifications','oa-secondary'):'')+(n.message?'<p class="oa-note">'+h(n.message)+'</p>':'')+'</section>';
 }
 function renderUs(){if(remoteMode)notificationSignature=JSON.stringify(remote.notificationStatus);return sharedScore()+'<div class="oa-section-head"><h2>Le confort du jeu</h2></div>'+setting('sound','Son des dés','Un contact feutré à chaque lancer.')+(remoteMode?notificationSetting():'<p class="oa-note">Démo locale · '+(persisted?'partie conservée sur cet appareil.':'partie non sauvegardée.')+(recovery?' Ancienne sauvegarde conservée pour récupération.':'')+'</p><div class="oa-actions">'+textBtn('Effacer la partie de démonstration','reset-confirm')+'</div>');}


 function scheduleExpiry(){
  clearTimeout(taskExpiryTimer);if(!state.tasks.length||remoteMode&&!remoteReady)return;
  const until=Math.min(...state.tasks.map(task=>Date.parse(task.expiresAt)))-serverNow();
  const delay=remoteMode&&until<=0?10000:Math.max(0,until);
  taskExpiryTimer=setTimeout(async()=>{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed&&!busy&&!operationBusy&&!pendingChecks.size)render();else scheduleExpiry();},delay);
 }
 function render(){
  clearCharge(true,false);
  if(!remoteMode){const fresh=G.reduce(state,{type:'EXPIRE_TASKS',at:now()});if(fresh!==state){state=fresh;save();}}
  trackGrade();
  // Connection updates may restore the game behind this screen, never replace it.
  if(!welcomeDismissed&&renderKey==='welcome'){renderPersona();scheduleExpiry();return;}
  const focused=document.activeElement,focusData=focused&&main.contains(focused)?{...focused.dataset}:null;
  const previousKey=renderKey;
  const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);
  renderPersona();
  const key=!welcomeDismissed?'welcome':[remoteMode&&!remoteReady?'login':tab,state.phase,state.round.id,state.round.cardId,state.round.rolls.length,state.round.draftRolls.length,state.activePlayer].join('|');
  const animate=key!==renderKey;renderKey=key;
  root.style.setProperty('--oa-accent',(welcomeDismissed&&G.canSeeRound(state)?category():null)?.color||G.categories[1].color);
  main.innerHTML=!welcomeDismissed?renderWelcome():remoteMode&&!remoteReady?renderLogin():tab==='play'?renderPlay():tab==='tasks'?renderTasks():renderUs();
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!awaitingPlayer(el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const invitationDot=root.querySelector('.oa-incoming-dot');if(invitationDot)invitationDot.hidden=!awaitingPlayer(viewPlayer);
  const count=root.querySelector('.oa-task-count');if(count){count.textContent=String((state.tasks||[]).length);count.hidden=!(state.tasks||[]).length;}
  const holder=main.querySelector('[data-stage]');
  if(holder){holder.prepend(canvas);die.setKind(Number(holder.dataset.kind),Number(holder.dataset.value));die.setReducedMotion(systemReduce);}
  root.classList.toggle('is-busy',busy||operationBusy);
  animateGauge();
  if(animate&&!systemReduce&&main.animate){
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-subtitle,:scope > .oa-steps,:scope > .oa-card-stage,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score');
   blocks.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,delay:Math.min(i*28,100),easing:'cubic-bezier(.18,.8,.2,1)',fill:'backwards'}));
   main.querySelectorAll('.oa-category,.oa-mini-card').forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px) rotate(-2deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:440,delay:90+i*30,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
   const revealed=main.querySelector('.oa-card-stage .oa-playing-card');
   if(revealed&&visibleCardId!==state.round.cardId)revealed.animate([{transform:'perspective(850px) translateY(24px) rotateX(10deg) rotateZ(-3deg) scale(.94)'},{transform:'perspective(850px) translateY(-3px) rotateX(-1deg) rotateZ(.6deg) scale(1.006)',offset:.7},{transform:'perspective(850px) translateY(0) rotateX(0) rotateZ(0) scale(1)'}],{duration:480,easing:'cubic-bezier(.18,.76,.2,1)'});
  }
  animateGrade();
  visibleCardId=state.round.cardId;
  scheduleExpiry();
  if(focusData&&previousKey===renderKey){const controls=Array.from(main.querySelectorAll('button,input')); const same=controls.find(el=>['action','pref','taskCheck','player','card','tab'].every(k=>(el.dataset[k]||'')===(focusData[k]||'')));if(same)same.focus({preventScroll:true});else{const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}}
  else if(previousKey&&previousKey!==renderKey){const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
 }
 function animateGauge(){
  const gauge=main.querySelector('[data-gauge]');if(!gauge)return;
  const key=gauge.dataset.gauge,ratio=Number(gauge.dataset.ratio),previous=gaugeFrames.has(key)?gaugeFrames.get(key):ratio;
  gaugeFrames.set(key,ratio);
  if(systemReduce||!gauge.animate||previous===ratio)return;
  gauge.querySelectorAll('.oa-hp-track i span').forEach((fill,i)=>fill.animate([{transform:'scaleX('+Math.max(0,Math.min(1,previous*12-i))+')'},{transform:'scaleX('+Math.max(0,Math.min(1,ratio*12-i))+')'}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'}));
  gauge.querySelector('.oa-hp-top strong').animate([{transform:'translateY(-3px)',opacity:.55},{transform:'translateY(0)',opacity:1}],{duration:280,easing:'ease-out'});
 }
 function celebrate(){
  if(systemReduce||!main.animate)return;
  const badge=main.querySelector('.oa-summary-glyph');
  if(badge)badge.animate([{transform:'scale(.7) rotate(-12deg)'},{transform:'scale(1.15) rotate(7deg)',offset:.55},{transform:'scale(1) rotate(0)'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
  const layer=document.createElement('div');layer.className='oa-celebration';layer.setAttribute('aria-hidden','true');root.querySelector('.oa-shell').append(layer);
  for(let i=0;i<12;i++){const dot=document.createElement('i');dot.style.background=G.categories[i%G.categories.length].color;layer.append(dot);const angle=(i/12)*Math.PI*2;dot.animate([{transform:'translate(0,0) scale(.2)',opacity:0},{opacity:1,offset:.12},{transform:'translate('+Math.cos(angle)*(65+i*4)+'px,'+(Math.sin(angle)*75-30)+'px) rotate('+(i*51)+'deg) scale(.85)',opacity:0}],{duration:900+i*20,easing:'cubic-bezier(.1,.6,.2,1)',fill:'forwards'});}
  setTimeout(()=>layer.remove(),1300);
 }
 let audioContext;
 function softSound(){if(!state.prefs.sound)return;try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();[0,.44,.83].forEach((delay,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(155-i*18,t);osc.frequency.exponentialRampToValueAtTime(48,t+.1);gain.gain.setValueAtTime(.055/(i+1),t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.14);});}catch(_){}}
 function setControlsBusy(value){
  const active=value||busy||operationBusy;root.classList.toggle('is-busy',active);
  if(active){controlsBusyState=controlsBusyState||new Map();root.querySelectorAll('button,input').forEach(el=>{if(!controlsBusyState.has(el))controlsBusyState.set(el,el.disabled);el.disabled=true;});}
  else if(controlsBusyState){for(const [el,disabled] of controlsBusyState)if(el.isConnected)el.disabled=disabled;controlsBusyState=null;}
 }
 async function roll(reroll=false,power=0){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  const expectedPhase=state.phase,expectedRound=state.round.id;if(!remoteMode){pullShared();if(state.phase!==expectedPhase||state.round.id!==expectedRound){render();return;}}
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  let sides,action,faceValue,next,resultLabel;
  if(remoteMode&&phase==='category'&&remoteSnapshot?.quota?.remaining===0)return;
  if(reroll){if(!G.canRerollCard(state))return;sides=4;action={type:'REROLL_CARD'};}
  else if(phase==='category'&&canDraw()){sides=6;action={type:'ROLL_CATEGORY'};}
  else if(phase==='card'&&canDraw()){sides=4;action={type:'ROLL_CARD'};}
  else if(phase==='draft_challenge'&&G.canRollDraftDefense(state)){sides=20;action={type:'ROLL_DRAFT_DEFENSE'};}
  else if(phase==='challenge'&&G.canRespond(state)){sides=20;action={type:'ROLL_DEFENSE'};}
  else return;
  const serial=++animationSerial;busy=true;rerolling=reroll;if(rerolling)render();setControlsBusy(true);
  if(rerolling)main.querySelector('[data-stage]')?.scrollIntoView({block:'center',behavior:systemReduce?'instant':'smooth'});
  const button=main.querySelector('[data-action="roll"]');if(button){button.textContent='Tirage…';button.setAttribute('aria-busy','true');}
  try{
   if(remoteMode){
    const value=await remote.action({...action,roundId});
    if(!value.roll||value.roll.kind!==sides)throw Error('Unconfirmed roll');
    faceValue=value.roll.value;next=value.state;
    if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;
   }else{
    const faces=reroll?[1,2,3,4].filter(value=>value!==state.round.cardRoll):null;
    faceValue=faces?faces[G.randomInt(3)-1]:G.randomInt(sides);action.value=faceValue;
    if(sides===6)action.hand=G.drawHand(state,faceValue);
    if(action.type==='ROLL_DRAFT_DEFENSE')action.token=roundId+'-draft-'+(state.round.draftRolls.length+1);
    if(action.type==='ROLL_DEFENSE')action.token=roundId+'-'+(state.round.rolls.length+1);
    next=G.reduce(state,{...action,actor,roundId,at:now()});if(next===state)return;
    state=next;save();
   }
   resultLabel=sides===6?'Catégorie '+(G.getCategory(next.round.categoryId)?.label||G.categories.find(c=>c.number===faceValue)?.label||'tirée') : sides===4?(G.getCard(next.round.cardId)?.title||'Carte tirée.'):'Lancer terminé.';
   const visualPower=Number.isFinite(power)?Math.max(0,Math.min(1,power)):0;
   if(button)button.textContent='Le dé roule…';
   softSound();await die.roll(faceValue,{duration:systemReduce?0:1650,power:visualPower});
   if(serial===animationSerial){announce('D'+sides+' : '+faceValue+'. '+resultLabel);if(reroll)toast('Nouvelle carte · sans ton D20.');}
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{if(serial===animationSerial){busy=false;rerolling=false;setControlsBusy(false);if(remoteMode)flushRemote(null,false);render();}}
 }
 function openSheet(title,body,extraClass=''){lastFocus=document.activeElement;sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div>'+body+'</section>';sheet.hidden=false;document.body.style.overflow='hidden';const shell=root.querySelector('.oa-shell');Array.from(shell.children).forEach(el=>{if(el!==sheet&&el.id!=='oa-announcement')el.inert=true;});const top=sheet.querySelector('button');top&&top.focus();}
 function closeSheet(){sheet.hidden=true;document.body.style.overflow='';sheet.innerHTML='';Array.from(root.querySelector('.oa-shell').children).forEach(el=>el.inert=false);if(lastFocus&&lastFocus.isConnected)lastFocus.focus();lastFocus=null;}

 function rules(){openSheet('Les règles.','<div class="oa-rule"><b>D6</b><div><h3>La catégorie.</h3><p>Le dé choisit une des six catégories.</p></div></div><div class="oa-rule"><b>D4</b><div><h3>La carte.</h3><p>Le dé révèle une des quatre cartes cachées. Une relance possible, en échange de ton D20.</p></div></div><div class="oa-rule"><b>D20</b><div><h3>Écarter la carte.</h3><p>Deux jets par personne. Leur somme retire les PV. À zéro, la carte est écartée. Après deux jets insuffisants de la personne qui tire, elle est proposée à l’autre.</p></div></div><div class="oa-rule"><b>+1</b><div><h3>Les deux cases, un point.</h3><p>Les actions validées restent six heures dans À faire. Elles quittent la liste après vos deux coches, ou à l’expiration.</p></div></div><div class="oa-actions">'+btn('Fermer','close')+'</div>');}

 root.addEventListener('input',event=>{if(event.target.id==='oa-username')loginUsername=event.target.value;});
 root.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-login-form]'))return;event.preventDefault();if(!welcomeDismissed||authBusy||!remote?.enabled)return;
  const username=root.querySelector('#oa-username'),field=root.querySelector('#oa-password');loginUsername=username.value.trim();const password=field.value;field.value='';authBusy=true;loginError='';render();
  try{const value=await remote.login(loginUsername,password);flushRemote(value,false);tab='play';}
  catch(error){loginError=error&&error.isDesirRemoteError?error.message:'La connexion est momentanément indisponible.';}
  finally{authBusy=false;render();}
 });
 root.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||!root.contains(el))return;event.preventDefault();const action=el.dataset.action;
  if(ignoreChargedClick(el,event))return;
  if(charge)clearCharge();
  if(action==='welcome-start'){
   if(welcomeDismissed)return;welcomeDismissed=true;try{localStorage.setItem(welcomeKey,'1');}catch(_){}render();return;
  }
  if(!welcomeDismissed)return;
  if((busy||operationBusy)&&action!=='close')return;
  if(remoteMode&&!remoteReady&&!['close'].includes(action))return;
  if(action==='roll'){await roll();return;}
  if(action==='reroll'){await roll(true);return;}
  if(action==='tab'){tab=['us','tasks'].includes(el.dataset.tab)?el.dataset.tab:'play';render();root.scrollIntoView({block:'start',behavior:systemReduce?'instant':'smooth'});return;}
  if(action==='profile'){if(remoteMode)return;tab=tab==='tasks'?'tasks':'play';changeView(el.dataset.player);announce('Profil : '+name(viewPlayer));return;}
  if(action==='open-invitation'){if(remoteMode){try{flushRemote(await remote.refresh(),false);}catch(error){remoteError(error);}}else pullShared();if(el.dataset.round===state.round.id&&G.canRespond(state))openedInvitation=invitationKey();render();return;}
  if(action==='send'){if(await dispatch({type:'SEND'}))toast('Proposée à '+name(state.round.to));return;}
  if(action==='challenge-draft'){await dispatch({type:'CHALLENGE_DRAFT'});return;}
  if(action==='challenge'){await dispatch({type:'CHALLENGE'});return;}
  if(action==='accept'){const changed=await dispatch({type:'ACCEPT'},false);if(state.phase==='accepted')tab='tasks';render();if(changed)announce(state.phase==='accepted'?'Proposition ajoutée aux choses à faire.':'Confirmation attendue.');return;}
  if(action==='new'){gaugeFrames.clear();tab='play';await dispatch({type:'NEW_ROUND'});return;}
  if(action==='enable-notifications'){operationBusy=true;el.disabled=true;try{await remote.enableNotifications();}catch(error){remoteError(error);}finally{operationBusy=false;flushRemote(null,false);render();}return;}
  if(action==='rules'){rules();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reset-confirm'){if(remoteMode)return;openSheet('Repartir de zéro ?','<p>La partie, le score commun, les favoris et les préférences de cette démonstration seront effacés.</p><div class="oa-actions">'+btn('Effacer la démo','reset','oa-clay')+textBtn('Conserver ma partie','close')+'</div>');return;}
  if(action==='reset'){if(remoteMode)return;closeSheet();tab='play';gaugeFrames.clear();await dispatch({type:'RESET'});state={...state,activePlayer:viewPlayer};toast('La démonstration repart de zéro.');return;}
 });
 root.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;startCharge(rollButton(event.target),'pointer',event);});
 root.addEventListener('pointermove',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId&&Math.hypot(event.clientX-charge.x,event.clientY-charge.y)>10)clearCharge();});
 root.addEventListener('pointerup',async event=>{if(charge?.source==='pointer')await releaseCharge(event);else if(suppressedClick?.source==='pointer'&&event.pointerId===suppressedClick.pointerId)suppressedClick.until=chargeNow()+600;});
 root.addEventListener('pointercancel',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId)clearCharge();});
 root.addEventListener('lostpointercapture',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId)clearCharge();});
 root.addEventListener('focusout',event=>{if(charge?.source==='keyboard'&&event.target===charge.button)clearCharge();});
 root.addEventListener('contextmenu',event=>{if(rollButton(event.target))event.preventDefault();});
 root.addEventListener('keyup',async event=>{if((event.code==='Space'||event.key===' ')&&rollButton(event.target)){event.preventDefault();if(charge?.source==='keyboard')await releaseCharge(event);}});
 window.addEventListener('blur',()=>clearCharge());
 window.addEventListener('scroll',()=>clearCharge(),{capture:true,passive:true});
 window.addEventListener('keyup',event=>{if(event.code==='Space'||event.key===' '){if(charge?.source==='keyboard')clearCharge();if(suppressedClick?.source==='keyboard')suppressedClick.until=chargeNow()+600;}});
 if(motionQuery&&motionQuery.addEventListener)motionQuery.addEventListener('change',event=>{systemReduce=event.matches;die.setReducedMotion(systemReduce);root.getAnimations({subtree:true}).forEach(a=>a.cancel());});
 root.addEventListener('change',async event=>{
  if(!welcomeDismissed||busy)return;
  const el=event.target;
  if(el.dataset.taskCheck){
   const id=el.dataset.taskCheck;if(pendingChecks.has(id)||operationBusy){render();return;}
   const before=state.stats.totalCompleted,desired=el.checked,task=state.tasks.find(item=>item.id===id);if(!task){render();return;}
   el.checked=task.checks[viewPlayer];pendingChecks.add(id);el.disabled=true;
   const changed=await dispatch({type:'TOGGLE_TASK_CHECK',taskId:id,checked:desired},false);
   if(!changed){pendingChecks.delete(id);flushRemote(null,false);render();return;}
   const completed=state.stats.totalCompleted>before;
   if(!completed&&!state.tasks.some(item=>item.id===id)){pendingChecks.delete(id);flushRemote(null,false);render();return;}
   el.checked=desired;const label=el.closest('label');label.classList.add('is-waving');const article=el.closest('.oa-task');
   if(completed&&!systemReduce&&article.animate)article.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],{duration:180,delay:440,fill:'forwards',easing:'ease-out'});
   setTimeout(()=>{pendingChecks.delete(id);if(remoteMode)flushRemote(null,false);render();if(completed){announce('Action partagée. Un point ajouté au duo.');toast('+1 point pour votre duo.');celebrate();}},systemReduce?0:640);
   return;
  }
  if(el.dataset.pref){await dispatch({type:'SET_PREFS',patch:{[el.dataset.pref]:el.checked}});die.setReducedMotion(!!systemReduce);if(el.dataset.pref==='sound'&&el.checked)softSound();}
 });
 setInterval(async()=>{if(!document.hidden&&!busy&&!operationBusy&&!pendingChecks.size){if(remoteMode){if(remoteReady&&tab==='tasks')render();}else{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed||tab==='tasks')render();}}},30000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearCharge();if(!document.hidden&&!remoteMode){pullShared();if(!busy&&!operationBusy&&!pendingChecks.size)render();}});
 window.addEventListener('storage',event=>{if(!remoteMode&&event.key===storageKey&&receiveShared(event.newValue)&&!busy&&!operationBusy&&!pendingChecks.size)render();});
 sheet.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
 root.addEventListener('keydown',event=>{
  const button=rollButton(event.target);
  if(button&&(event.code==='Space'||event.key===' ')){event.preventDefault();if(!event.repeat)startCharge(button,'keyboard',event);return;}
  if(event.key==='Escape'&&charge){event.preventDefault();clearCharge();return;}
  if(event.key==='Enter'){clearCharge(false);suppressedClick=null;}
  if(sheet.hidden)return;if(event.key==='Escape'){closeSheet();return;}if(event.key==='Tab'){const focusable=Array.from(sheet.querySelectorAll('button,a,input,select,textarea,summary')).filter(x=>!x.disabled);const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 });
 render();
 if(remoteMode){
  if(!remote?.enabled){authBusy=false;loginError='La connexion à votre espace n’est pas encore disponible.';render();}
  else{
   remote.subscribeToChanges(event=>{
    if(remote.connection&&!remote.authenticated){
     // A reconnect owns its pending screen. Background status must not reset it.
     if(authBusy)return;
     const wasReady=remoteReady;remoteReady=false;updateLoginError(event.status.message);if(wasReady)render();return;
    }
    if(event.snapshot)receiveRemote(event.snapshot);
    else if(!authBusy&&!remoteReady&&event.status.message)updateLoginError(event.status.message);
    if(remoteReady&&tab==='us'&&!busy&&!operationBusy&&!pendingChecks.size&&notificationSignature!==JSON.stringify(remote.notificationStatus))render();
   });
   remote.start();
   remote.restore().then(value=>{if(value)flushRemote(value,false);else remoteReady=false;authBusy=false;render();}).catch(error=>{remoteReady=false;authBusy=false;loginError=error&&error.isDesirRemoteError?error.message:'La connexion est momentanément indisponible.';render();});
  }
 }
 root.dataset.ready='true';
})();
