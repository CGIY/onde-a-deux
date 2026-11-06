(function(){
 'use strict';
 const root=document.getElementById('onde-app-v1');
 if(!root || !window.OndeGame || !window.OndeDice)return;
 const G=window.OndeGame, main=root.querySelector('#oa-main'), sheet=root.querySelector('#oa-sheet');
 const cardNotes=Object.freeze(Object.assign({},window.DesirCardNotes||{}));
 const roleplayCards=Object.freeze(Object.assign({},window.DesirRoleplay?.mode==='roleplay'?window.DesirRoleplay.cards||{}:{}));
 const storageKey='onde-couple-prototype-v1';
 const remote=window.OndeRemote&&window.OndeRemote.create(window.DesirConfig||{});
 const remoteMode=!!(window.DesirConfig&&window.DesirConfig.endpoint);
 const hardcore=remoteMode&&window.OndeHardcore?.mount({root,remote});
 const persona=root.querySelector('.oa-persona'),navigation=root.querySelector('.oa-nav');
 let remoteReady=false,authBusy=remoteMode,operationBusy=false,loginError='',loginUsername='',remoteSnapshot=null,deferredSnapshot=null,remoteSignature='',serverOffset=0;
 const welcomeKey='desir-welcome-v1';
 let welcomeDismissed=false;try{welcomeDismissed=localStorage.getItem(welcomeKey)==='1';}catch(_){}
 let localPrefs={sound:false};try{const saved=JSON.parse(localStorage.getItem('desir-preferences-v1')||'{}');if(typeof saved.sound==='boolean')localPrefs.sound=saved.sound;}catch(_){}

 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let localRoom=null,ownState=null,incomingStates=[],selectedIncomingRoundId=null;
 let state=G.createState(), tab='play', busy=false, rerolling=false, toastTimer, lastFocus=null, animationSerial=0;
 let cardReveal=null,revealWait=null,activeRollFace=null,presentationEpoch=0,presentationHidden=false;
 let charge=null,suppressedClick=null,controlsBusyState=null;
 let persisted=false, canPersist=true, recovery=false, lastError='';
 let renderKey='';
 const contentTransitions=new Set();
 const gaugeFrames=new Map();
 const pendingChecks=new Set();
 let taskExpiryTimer;
 let visibleCardId=null, openedInvitation=null, viewPlayer='a', sharedSnapshot=null;
 let sheetContext=null;
 const viewport=window.visualViewport;let viewportListening=false;
 const installed=window.matchMedia('(display-mode: standalone)').matches||window.navigator?.standalone===true;
 root.classList.toggle('oa-installed',installed);
 function updateViewportHeight(){
  if(!viewport||viewport.height<=0||Math.abs((viewport.scale||1)-1)>=.02)return;
  root.style.setProperty('--oa-viewport-height',Math.round(viewport.height)+'px');
  const layoutHeight=document.documentElement?.clientHeight||window.innerHeight||0;
  const editing=!!document.activeElement?.matches?.('input,textarea,[contenteditable="true"]');
  root.classList.toggle('oa-keyboard',installed&&editing&&layoutHeight-viewport.height>150);
 }
 function startViewport(){if(!viewport||viewportListening)return;viewportListening=true;viewport.addEventListener('resize',updateViewportHeight);window.addEventListener('resize',updateViewportHeight);updateViewportHeight();}
 function stopViewport(){if(!viewportListening)return;viewportListening=false;viewport.removeEventListener('resize',updateViewportHeight);window.removeEventListener('resize',updateViewportHeight);}
 if(viewport)startViewport();
 document.addEventListener('focusin',updateViewportHeight);
 document.addEventListener('focusout',updateViewportHeight);
 window.addEventListener('pageshow',()=>{presentationHidden=false;startViewport();});
 window.addEventListener('pagehide',()=>{presentationHidden=true;stopViewport();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();});
 if(!remoteMode){
  localRoom=G.createRoom();
  try{
   const raw=localStorage.getItem(storageKey);
   if(raw){let parsed=null,saved=null;try{parsed=JSON.parse(raw);saved=G.normalizeRoom(parsed,{at:new Date().toISOString()});}catch(_){}if(saved){localRoom=saved;if(['a','b'].includes(parsed.activePlayer))viewPlayer=parsed.activePlayer;}else{localStorage.setItem(storageKey+'-recovery',raw);recovery=true;}}
   localStorage.setItem(storageKey,JSON.stringify(localRoom));persisted=true;
  }catch(_){canPersist=false;persisted=false;}
  try{const savedView=sessionStorage.getItem(storageKey+'-profile');if(['a','b'].includes(savedView))viewPlayer=savedView;}catch(_){}
  syncLocalView();
  try{sharedSnapshot=localStorage.getItem(storageKey);}catch(_){}
 }
 const canvas=document.createElement('canvas');
 canvas.id='oa-dice';canvas.className='cursor-interaction';canvas.setAttribute('role','img');
 const die=window.OndeDice.create(canvas,{kind:G.rules.categorySides,value:3,duration:1650,maxPixelRatio:2,reducedMotion:!!systemReduce,idleMotion:true,onRelease:power=>{if(tab==='play'&&!busy)return roll(false,power);}});
 const h=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=id=>(state.players.find(p=>p.id===id)||{}).name||'Partenaire';
 const now=()=>new Date().toISOString();
 const card=()=>G.getCard(state.round.cardId);
 const category=()=>G.getCategory(state.round.categoryId,state.round.catalogueVersion??1);
 const shownRolls=()=>state.phase==='draft_challenge'||(state.round.status==='defended'&&!state.round.rolls.length)?state.round.draftRolls:state.round.rolls;
 const sum=()=>shownRolls().reduce((a,b)=>a+b,0);
 const canDraw=()=>state.phase==='category'
  ? !remoteMode || (typeof remoteSnapshot?.drawAvailable==='boolean'?remoteSnapshot.drawAvailable:state.activePlayer===state.round.from)
  : state.activePlayer===state.round.from;
 const canSeeCurrentRound=()=>G.canSeeRound(state)&&(state.phase!=='category'||canDraw());
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const chargeNow=()=>window.performance?.now?window.performance.now():Date.now();
 const chargeLimit=1200;
 function rollButton(target){const button=target.closest?.('[data-action]');return button&&root.contains(button)&&['roll','reroll'].includes(button.dataset.action)?button:null;}
 function canCharge(button){
  if(!button||button.disabled||!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return false;
  if(button.dataset.action==='reroll')return G.canRerollCard(state);
  return state.phase==='category'&&canDraw()&&(!remoteMode||remoteSnapshot?.quota?.remaining!==0)||['card','variant'].includes(state.phase)&&canDraw()||state.phase==='draft_challenge'&&G.canRollDraftDefense(state)||state.phase==='challenge'&&G.canRespond(state);
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
 function selectDisplayState(){
  const selected=incomingStates.find(value=>value.round.id===selectedIncomingRoundId);
  if(!selected)selectedIncomingRoundId=null;
  const displayed=selected||ownState;
  state=remoteMode?{...displayed,prefs:{...displayed.prefs,...localPrefs}}:displayed;
 }
 function syncLocalView(){
  ownState=G.roomView(localRoom,viewPlayer);
  const partner=localRoom.lanes[G.otherPlayer(viewPlayer)];
  const incoming=G.roomView(localRoom,viewPlayer,partner.round.id);
  incomingStates=incoming.phase!=='category'&&G.canSeeRound(incoming,viewPlayer)?[incoming]:[];
  selectDisplayState();
 }
 function isParallel(){return !remoteMode||remoteSnapshot?.gameVersion===3;}
 function focusedReply(value,roundId){return value.state.round.id===roundId?value.state:value.incoming?.find(incoming=>incoming.round.id===roundId)||null;}
 function save(){if(remoteMode||!canPersist)return;try{const raw=JSON.stringify(localRoom);localStorage.setItem(storageKey,raw);sharedSnapshot=raw;persisted=true;}catch(_){persisted=false;}}
 function receiveShared(raw){
  if(remoteMode||!raw||raw===sharedSnapshot)return false;
  let incoming;try{incoming=G.normalizeRoom(JSON.parse(raw),{at:now()});}catch(_){return false;}
  if(!incoming)return false;
  sharedSnapshot=raw;localRoom=incoming;syncLocalView();return true;
 }
 function pullShared(){if(remoteMode||!canPersist)return false;try{return receiveShared(localStorage.getItem(storageKey));}catch(_){return false;}}
 function changeView(player){if(remoteMode||!['a','b'].includes(player))return;pullShared();viewPlayer=player;selectedIncomingRoundId=null;syncLocalView();openedInvitation=null;try{sessionStorage.setItem(storageKey+'-profile',player);}catch(_){}render();}
 function awaitingPlayer(player){
  const views=remoteMode?[ownState,...incomingStates].filter(Boolean):Object.values(localRoom.lanes).map(lane=>G.roomView(localRoom,player,lane.round.id));
  return views.some(value=>['pending','sender_confirmation','challenge','challenge_failed'].includes(value.phase)&&value.round.awaiting===player);
 }
 function invitationKey(){return state.round.id+'-'+state.round.awaiting;}

 function announce(text){root.querySelector('#oa-announcement').textContent=text;}
 function serverNow(){return Date.now()+serverOffset;}
 function samePerspective(a,b){return a&&b&&a.roomId===b.roomId&&a.actor===b.actor;}
 function currentPerspective(value){const identity=remote?.connection;return !identity||samePerspective(value,identity);}
 function applyRemote(value,renderNow=true){
  if(remoteMode&&!remote?.authenticated||!value||!value.state||!['a','b'].includes(value.actor)||!currentPerspective(value))return false;
  if(samePerspective(value,remoteSnapshot)&&value.revision<remoteSnapshot.revision)return false;
  const normalized=G.normalizeState(value.state);if(!normalized||normalized.activePlayer!==value.actor)return false;
  if(remoteSnapshot&&!samePerspective(value,remoteSnapshot)){openedInvitation=null;selectedIncomingRoundId=null;visibleCardId=null;gaugeFrames.clear();}
  if(value.serverTime&&Number.isFinite(Date.parse(value.serverTime)))serverOffset=Date.parse(value.serverTime)-Date.now();
  const signature=JSON.stringify({state:value.state,revision:value.revision,actor:value.actor,quota:value.quota,paired:value.paired,drawAvailable:value.drawAvailable,gameVersion:value.gameVersion,incoming:value.incoming});
  const changed=signature!==remoteSignature;remoteSignature=signature;remoteSnapshot=value;
  viewPlayer=value.actor;ownState={...normalized,prefs:{...normalized.prefs,...localPrefs}};incomingStates=(value.incoming||[]).map(incoming=>({...incoming,prefs:{...incoming.prefs,...localPrefs}}));selectDisplayState();remoteReady=true;authBusy=false;loginError='';
  if(renderNow&&changed)render();return changed;
 }
 function receiveRemote(value){
  if(remoteMode&&!remote?.authenticated||!value||!currentPerspective(value))return false;
  if(charge||busy||operationBusy||pendingChecks.size){if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;if(cardReveal&&!revealMatches(focusedReply(deferredSnapshot,cardReveal.roundId),cardReveal))finishRevealWait();return false;}
  return applyRemote(value);
 }
 function flushRemote(value,renderNow=false){
  if(remoteMode&&!remote?.authenticated){deferredSnapshot=null;return false;}
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
  const roundId=state.round.id;pullShared();const next=G.reduceRoom(localRoom,{at:now(),roundId,...action,actor:viewPlayer});const changed=next!==localRoom;localRoom=next;syncLocalView();if(changed)save();if(doRender)render();return changed;
 }

 function toast(text){clearTimeout(toastTimer);const el=root.querySelector('#oa-toast');el.textContent=text;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},3600);}
 function btn(label,action,style='',extra=''){if(action==='new'&&isParallel()&&state.round.from!==viewPlayer){label='Mon tirage';action='own-draw';}return '<button type="button" class="oa-button cursor-interaction '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function textBtn(label,action,extra=''){return '<button type="button" class="oa-text-button cursor-interaction" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function eyebrow(text){return '<p class="oa-eyebrow">'+h(text)+'</p>';}
 function heading(title,sub,eyebrowText){return (eyebrowText?eyebrow(eyebrowText):'')+'<h1 class="oa-title">'+title+'</h1>'+(sub?'<p class="oa-subtitle">'+sub+'</p>':'');}
 function challengeSides(round=state.round){return G.cardSides(round);}
 function cardHeading(categoryId,catalogueVersion){return heading(h(G.getCategory(categoryId,catalogueVersion).label),null,null);}
 function steps(active,sides=G.rules.cardSides,hasVariant=true){
  const path=[[G.categorySides(hasVariant?2:1),'Catégorie'],[sides,'Carte']];
  if(hasVariant)path.push([G.rules.variantSides,'Variante']);
  return '<div class="oa-steps" aria-label="Parcours du jeu">'+path.map(([kind,label],i)=>'<span class="oa-step '+(active===i+1?'is-active':active>i+1?'is-done':'')+'" '+(active===i+1?'aria-current="step"':'')+'><b>D'+kind+'</b>'+label+'</span>').join('<span class="oa-step-sep" aria-hidden="true">›</span>')+'</div>';
 }
 function stage(type,label,value,role='defense'){return '<section class="oa-dice-section" aria-label="Lancer le dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+'</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'" data-roll-role="'+role+'"></div></section>';}
 function categoriesGrid(){return '<div class="oa-category-grid">'+G.categories.map(c=>'<div class="oa-category" style="--category:'+c.color+'"><div class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></div><span class="oa-category-label">'+h(c.label)+'</span></div>').join('')+'</div>';}
 function handGrid(options={}){const discarded=options.discarded||null,selected=options.selected||null,hand=options.hand||state.round.hand,version=options.catalogueVersion??state.round.catalogueVersion??1;const count=hand.length,words=count===6?'Six':'Quatre';return '<div class="oa-card-grid'+(count===6?' is-six':'')+(discarded?' is-reroll':'')+(selected?' is-revealing':'')+'" data-catalogue-version="'+version+'" aria-label="'+(selected?words+' emplacements, carte '+selected.slot+' choisie':discarded?words+' emplacements, une carte écartée':words+' cartes face cachée')+'">'+hand.map((id,i)=>{
  const width=[68,82,74,60,78,64][i],old=discarded&&discarded.slot===i+1&&discarded.cardId===id?G.getCard(discarded.cardId):null;
  const chosen=selected&&selected.slot===i+1&&selected.cardId===id?G.getCard(selected.cardId):null;
  if(chosen){const cat=G.getCategory(chosen.categoryId,version);return '<div class="oa-mini-card oa-card-back oa-card-revealed" data-reveal-selected aria-label="Carte '+(i+1)+' choisie" style="--category:'+h(cat.color)+'"><span class="oa-mini-number">'+(i+1)+'</span><div class="oa-reveal-content"><div class="oa-reveal-art" aria-hidden="true"><i></i><i></i><i></i></div><span class="oa-reveal-category">'+h(cat.label)+'</span><h3>'+h(chosen.title)+'</h3></div></div>';}
  if(old)return '<div class="oa-mini-card oa-card-back oa-card-discarded" aria-label="Carte '+(i+1)+' écartée : '+h(old.title)+'"><span class="oa-mini-number">'+(i+1)+'</span><span class="oa-discarded-state">Écartée</span><h3 class="oa-discarded-title" title="'+h(old.title)+'">'+h(old.title)+'</h3></div>';
  return '<div class="oa-mini-card oa-card-back" aria-label="Carte '+(i+1)+' face cachée"><span class="oa-mini-number">'+(i+1)+'</span><div class="oa-card-ghost" aria-hidden="true" inert style="--ghost-title:'+width+'%"><div class="oa-ghost-art"><i></i><i></i><i></i></div><span class="oa-ghost-title"></span><span class="oa-ghost-line"></span></div></div>';
 }).join('')+'</div>';}

 function healthGauge(owner){
  const r=state.round,rolls=owner==='from'?r.draftRolls:r.rolls,total=rolls.reduce((a,b)=>a+b,0),left=Math.max(0,r.hp-total),ratio=left/r.hp;
  const needed=r.hp-total,chance=rolls.length===0?G.probability(r.hp):rolls.length===1?Math.max(0,Math.min(20,21-needed))/20:0;
  const odds=left===0?'Carte écartée':rolls.length===2?'Deux jets terminés':(chance*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' % de chance '+(rolls.length?'au dernier jet':'sur deux jets');
  return '<section class="oa-hp" data-gauge="'+r.id+'-'+owner+'" data-ratio="'+ratio+'" aria-label="Résistance de la carte"><div class="oa-hp-top"><p>Résistance de la carte</p><strong>'+left+' <span>/ '+r.hp+' PV</span></strong></div><div class="oa-hp-track" role="progressbar" aria-label="Points de vie restants" aria-valuemin="0" aria-valuemax="'+r.hp+'" aria-valuenow="'+left+'">'+Array.from({length:12},(_,i)=>'<i aria-hidden="true"><span style="transform:scaleX('+Math.max(0,Math.min(1,ratio*12-i))+')"></span></i>').join('')+'</div><div class="oa-roll-history">'+[0,1].map(i=>'<span class="oa-roll-token">Jet '+(i+1)+' <b>'+(rolls[i]||'—')+'</b></span>').join('')+'</div><p class="oa-hp-odds">'+odds+'</p></section>';
 }
 function defenseSubtitle(c){const detail=proposalDetail(state.round);return h(c.title)+(detail?' · '+h(detail):'');}
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function proposalDetail(round){return G.getVariant(round)||(round.adapted?round.proposal:null);}
 function roleplayNote(c){
  const r=state.round,entry=r.catalogueVersion===2&&Number.isInteger(r.variantRoll)?roleplayCards[c.id+':v'+r.variantRoll]:null;
  if(!entry||typeof entry.metric!=='string'||typeof entry.text!=='string')return '';
  return '<aside class="oa-roleplay" aria-label="Une phrase pour le jeu"><p class="oa-roleplay-value">'+h(entry.metric)+'</p><p class="oa-roleplay-copy">'+h(entry.text)+'</p></aside>';
 }
 function playingCard(c,compact=false){
  const r=state.round,cat=G.getCategory(c.categoryId,r.catalogueVersion??1),detail=proposalDetail(r),note=r.catalogueVersion===2?null:cardNotes[c.id];
  return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(cat.label)+(r.adapted?' · VARIANTE':'')+'</span></div>'+(!compact?'<div class="oa-card-illustration" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2>'+(detail?'<p class="oa-card-description">'+h(detail)+'</p>':'')+(note?'<p class="oa-card-note">'+h(note)+'</p>':'')+roleplayNote(c)+'</article>';
 }

 function renderWelcome(){
  return '<section class="oa-welcome" aria-labelledby="oa-welcome-title"><img class="oa-welcome-icon" src="./icons/desir-192.png" width="76" height="76" alt=""><div class="oa-welcome-copy"><h1 id="oa-welcome-title">Les dés choisissent une idée à deux.</h1><p>Propose-la ou tente de l’écarter au D20.</p><p>Deux coches dans les 24 h, un point pour vous.</p></div><div class="oa-actions">'+btn('C’est parti <span class="oa-arrow" aria-hidden="true">↗</span>','welcome-start')+'</div></section>';
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
 function categoryAction(){
  if(remoteMode&&remoteSnapshot?.quota?.remaining===0){const at=remoteSnapshot.quota.nextAt;let time='';try{time=new Date(at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});}catch(_){}return '<div class="oa-next-draw" role="status">Prochain tirage'+(time?' à <strong>'+h(time)+'</strong>':' à la prochaine plage')+'</div>';}
  return btn('Lancer le D'+G.rules.categorySides+' <span class="oa-arrow" aria-hidden="true">↗</span>','roll');
 }
 function switchButton(id,label){return btn(label||'Voir côté '+h(name(id)),'profile','oa-secondary','data-player="'+id+'"');}
 function responseActions(){const r=state.round;const defend=state.phase==='pending'&&r.status==='pending'&&!r.challengeUsed&&Number.isFinite(r.hp)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge','oa-secondary'):'';return '<div class="oa-actions">'+btn(r.status==='scheduled_proposal'?'Confirmer ce moment':r.status==='counterproposal'?'Accepter la variante':'J’accepte','accept')+defend+'</div>';}

 function privateHome(incoming=false){
  const r=state.round;
  return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+(incoming?'<button type="button" class="oa-invitation cursor-interaction" data-action="open-invitation" data-round="'+h(r.id)+'"><span class="oa-invitation-dot" aria-hidden="true"></span><span><b>'+(state.phase==='sender_confirmation'?'Une réponse t’attend':'Une invitation t’attend')+'</b><small>'+h(name(r.awaiting===r.from?r.to:r.from))+'</small></span><span class="oa-invitation-arrow" aria-hidden="true">↗</span></button>':'<div class="oa-quiet-home"><span aria-hidden="true">〰</span><p>Aucune invitation.</p></div>')+((state.tasks||[]).length?'<div class="oa-actions">'+btn('À faire · '+state.tasks.length,'tab','oa-secondary','data-tab="tasks"')+'</div>':'');
 }
 function incomingBanner(){
  const incoming=incomingStates.find(value=>G.canRespond(value));
  if(!incoming)return '';
  return '<button type="button" class="oa-invitation oa-incoming cursor-interaction" data-action="open-invitation" data-round="'+h(incoming.round.id)+'"><span class="oa-invitation-dot" aria-hidden="true"></span><b>Invitation de '+h(name(incoming.round.from))+'</b><span class="oa-invitation-arrow" aria-hidden="true">↗</span></button>';
 }
 function renderPlay(){return (isParallel()?(selectedIncomingRoundId?textBtn('Mon tirage','own-draw'):incomingBanner()):'')+renderPlayContent();}
 function renderPlayContent(){const r=state.round,c=card();
  if(!canSeeCurrentRound())return privateHome();
  if(cardReveal){const reveal=cardReveal,sides=reveal.hand.length;return (reveal.reroll?heading('Le D'+sides+'<br><em>rejoue.</em>',null,null):cardHeading(reveal.categoryId,reveal.hasVariant?2:1)+steps(2,sides,reveal.hasVariant))+stage(sides,reveal.reroll?'02 / UNE AUTRE CARTE':'02 / LA CARTE',reveal.face,'card')+'<p class="oa-roll-status'+(reveal.reroll?'':' is-first-reveal')+'" data-reveal-mode="'+(reveal.reroll?'reroll':'card')+'" aria-hidden="true">Carte choisie.</p>'+handGrid({hand:reveal.hand,catalogueVersion:reveal.hasVariant?2:1,discarded:reveal.discarded,selected:{slot:reveal.face,cardId:reveal.cardId}});}
  if(['pending','sender_confirmation'].includes(state.phase)&&G.canRespond(state)&&openedInvitation!==invitationKey())return privateHome(true);
  if(state.phase==='category')return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+steps(1)+stage(G.rules.categorySides,'01 / LE THÈME',3,'category')+categoryAction()+'<div class="oa-section-head"><h2>Quatre façons de se retrouver</h2><span>'+G.categories.length*G.rules.cardSides+' cartes</span></div>'+categoriesGrid();
  if(state.phase==='card'){
   const sides=challengeSides();
   return cardHeading(r.categoryId,r.catalogueVersion??1)+steps(2,sides,r.catalogueVersion===2)+stage(sides,'02 / LA CARTE',1,'card')+btn('Lancer le D'+sides+' <span class="oa-arrow" aria-hidden="true">↗</span>','roll')+handGrid();
  }
  if(state.phase==='variant')return heading(h(c.title),null,null)+steps(3)+stage(G.rules.variantSides,'03 / LA VARIANTE',3,'variant')+btn('Tirer la variante <span class="oa-arrow" aria-hidden="true">↗</span>','roll');
  if(state.phase==='draft'&&rerolling)return heading('Le D'+challengeSides()+'<br><em>rejoue.</em>',null,null)+stage(challengeSides(),'02 / UNE AUTRE CARTE',r.cardRoll,'card')+'<p class="oa-roll-status" data-roll-status role="status" aria-busy="true">Tirage…</p>'+handGrid({discarded:{cardId:r.cardId,slot:r.cardRoll}});
  if(state.phase==='draft')return heading(canDraw()?'Ta prochaine<br><em>invitation.</em>':'Une carte<br><em>à proposer.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+(canDraw()?'<div class="oa-actions">'+btn('Proposer à '+h(name(r.to))+' <span class="oa-arrow">↗</span>','send')+(G.canChallengeDraft(state)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge-draft','oa-secondary'):'')+(G.canRerollCard(state)?textBtn('Relancer le D'+challengeSides()+' · sans mon D20','reroll'):'')+'</div>':'<div class="oa-actions">'+switchButton(r.from)+'</div>');
  if(state.phase==='draft_challenge'&&!canDraw())return heading('Un défi<br><em>en cours.</em>',h(name(r.from))+' tente d’écarter la carte.',null)+switchButton(r.from);
  if(state.phase==='draft_challenge')return heading('Tenter de<br><em>l’écarter.</em>',defenseSubtitle(c),null)+healthGauge('from')+stage(20,'ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.draftRolls.length+1)+' sur 2','roll');
  if(state.phase==='pending'){
   const responds=G.canRespond(state),isCounter=r.status==='counterproposal',isLater=r.status==='scheduled_proposal';
   const automatic=r.autoProposed&&r.status==='pending';
   let title=responds?(isCounter?'Une autre<br><em>façon de jouer.</em>':isLater?'Un moment<br><em>à confirmer.</em>':'Une invitation<br><em>pour toi.</em>'):'L’invitation<br><em>est posée.</em>';
   let sub=responds?(isCounter?'Une variante a été proposée. À toi de choisir.':isLater?'Le créneau proposé : '+h(r.schedule):automatic?'Le D20 a proposé cette carte. À toi de choisir.':h(name(r.from))+' te propose…'):'Invitation envoyée · '+h(name(r.awaiting))+' doit répondre.';
   return heading(title,sub,null)+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(automatic&&!responds?healthGauge('from'):'')+(r.schedule?statusStrip('Proposition : <strong>'+h(r.schedule)+'</strong>'):'')+(responds?responseActions():'');
  }
  if(state.phase==='sender_confirmation'){
   const responds=G.canRespond(state);
   return heading(responds?'À toi de<br><em>confirmer.</em>':'Une dernière<br><em>confirmation.</em>',responds?h(name(r.to))+' a accepté. Confirme à ton tour pour l’ajouter à votre liste.':'Tu as accepté · '+h(name(r.from))+' doit confirmer.','PROPOSITION ENVOYÉE')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(responds?'<div class="oa-actions">'+btn('Confirmer à mon tour','accept')+'</div>':'');
  }
  if(state.phase==='challenge'&&!G.canRespond(state))return heading('Un défi<br><em>en cours.</em>',h(name(r.to))+' tente d’écarter la carte.',null)+statusStrip('Réponse en attente.');
  if(state.phase==='challenge')return heading('Tenter de<br><em>l’écarter.</em>',defenseSubtitle(c),null)+healthGauge('to')+stage(20,'ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.rolls.length+1)+' sur 2','roll');
  if(state.phase==='challenge_failed')return heading('La proposition<br><em>reste ouverte.</em>',h(c.title),null)+healthGauge('to')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(G.canRespond(state)?responseActions():'<div class="oa-actions">'+switchButton(r.to)+'</div>');
  if(state.phase==='accepted')return heading('C’est dans<br><em>votre liste.</em>',null,null)+'<div class="oa-summary-card"><div><h2>'+h(c.title)+'</h2><p>'+h(proposalDetail(r)||category().label)+'</p></div></div><div class="oa-actions">'+btn('Voir les choses à faire','tab','','data-tab="tasks"')+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new','oa-secondary')+'</div>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed',expired=r.status==='expired';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Carte écartée.':expired?'Temps écoulé.':'Une autre<br><em>fois, peut-être.</em>',completed?'+1 point pour votre duo.':null,null)+(defended?healthGauge(r.rolls.length?'to':'from'):'')+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(category().label)+(r.adapted?' · Variante':'')+'</p></div>'+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
  }
  return '';
 }

 function timeLeft(task){const minutes=Math.max(0,Math.ceil((Date.parse(task.expiresAt)-serverNow())/60000));return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0');}
 function taskStatus(task){
  const mine=task.checks[viewPlayer],partner=G.otherPlayer(viewPlayer),theirs=task.checks[partner];
  if(mine&&theirs)return 'Un moment partagé · +1 point pour vous.';
  if(mine)return 'Ta coche est posée · '+name(partner)+' doit encore cocher.';
  if(theirs)return name(partner)+' a coché · à toi de jouer.';
  return 'Une fois vécu, chacun coche sa case.';
 }
 function taskCheck(task,player){const checked=task.checks[player],own=player===state.activePlayer,enabled=own&&!pendingChecks.has(task.id);return '<label class="oa-task-check '+(!own?'is-other':'')+'"><input type="checkbox" data-task-check="'+h(task.id)+'" data-player="'+player+'" aria-label="'+h(name(player)+' · '+G.getCard(task.cardId).title)+'" '+(checked?'checked ':'')+(!enabled?'disabled':'')+'><span class="oa-check-box" aria-hidden="true"><span class="oa-check-water"><svg viewBox="0 0 96 48" preserveAspectRatio="none"><path d="M0 8Q12 0 24 8T48 8T72 8T96 8V48H0Z"/><path d="M0 12Q12 20 24 12T48 12T72 12T96 12V48H0Z"/></svg></span><svg class="oa-check-mark" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span><span>'+h(name(player))+'</span></label>';}
 function renderTasks(){
  const tasks=state.tasks||[];
  return heading('Les choses<br><em>à faire.</em>',null,null)+(tasks.length?'<div class="oa-task-list">'+tasks.map(task=>{const c=G.getCard(task.cardId),cat=G.getCategory(task.categoryId,task.variantRoll!==undefined?2:1),detail=G.getVariant(task)||task.proposal;return '<article class="oa-task" data-task="'+h(task.id)+'" style="--category:'+cat.color+'"><div class="oa-task-top"><span>'+h(cat.label)+'</span><time datetime="'+h(task.expiresAt)+'" aria-label="Temps restant : '+timeLeft(task)+'">'+timeLeft(task)+'</time></div><h2>'+h(c.title)+'</h2>'+(detail?'<p class="oa-task-proposal">'+h(detail)+'</p>':'')+'<p class="oa-task-status">'+h(taskStatus(task))+'</p><div class="oa-task-checks">'+taskCheck(task,'a')+taskCheck(task,'b')+'</div></article>';}).join('')+'</div>':'<div class="oa-task-empty"><span aria-hidden="true">〰</span><p>Rien en attente.</p></div>')+'<div class="oa-actions">'+(state.phase==='accepted'?btn('Un nouveau tour <span class="oa-arrow">↗</span>','new'):textBtn('Revenir au jeu','tab','data-tab="play"'))+'</div>';
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
  return '<section class="oa-shared-score" aria-label="Score commun"><h1 class="oa-eyebrow">VOTRE SCORE À DEUX</h1><div class="oa-score-number"><strong>'+total.toLocaleString('fr-FR')+'</strong><span>point'+(total>1?'s':'')+'</span></div><p class="oa-score-caption">'+(total?'Des moments vécus, à votre rythme.':'Votre première carte partagée ouvre le score.')+'</p><div class="oa-score-rule"><span aria-hidden="true">✓</span> 1 carte partagée = 1 point</div></section>'+sharedGrade(total)+'<div class="oa-section-head"><h2>Vos cartes partagées</h2></div><div class="oa-score-grid">'+G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+G.categoryScore(stats,c.id).toLocaleString('fr-FR')+'</strong></div>').join('')+'</div>';
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
 function visibleViewKey(){
  if(!welcomeDismissed)return 'welcome';if(remoteMode&&!remoteReady)return 'login';
  if(cardReveal)return cardReveal.viewKey;
  if(tab!=='play')return tab+'|'+viewPlayer;
  if(!canSeeCurrentRound())return 'play|private-home|'+viewPlayer;
  const inbox=['pending','sender_confirmation'].includes(state.phase)&&G.canRespond(state)&&openedInvitation!==invitationKey();
  return ['play',inbox?'inbox':rerolling?'reroll':state.phase,state.round.id,state.round.cardId,state.round.rolls.length,state.round.draftRolls.length,viewPlayer].join('|');
 }
 function centerStage(){
  const holder=main.querySelector('[data-stage]');if(!holder)return;
  if(/^(auto|scroll)$/.test(window.getComputedStyle?.(main).overflowY||'')){
   const box=holder.getBoundingClientRect(),area=main.getBoundingClientRect();
   main.scrollTo({top:Math.max(0,main.scrollTop+box.top-area.top-(main.clientHeight-box.height)/2),behavior:systemReduce?'instant':'smooth'});
  }else holder.scrollIntoView({block:'center',behavior:systemReduce?'instant':'smooth'});
 }
 function finishRevealWait(){if(!revealWait)return;const wait=revealWait;revealWait=null;clearTimeout(wait.timer);wait.resolve();}
 function waitForReveal(duration=2800){return new Promise(resolve=>{const wait={resolve,timer:null};revealWait=wait;wait.timer=setTimeout(()=>{if(revealWait===wait){revealWait=null;resolve();}},duration);});}
 function presentationValid(context){return context.epoch===presentationEpoch&&context.actor===viewPlayer&&(!remoteMode||remote?.authenticated&&samePerspective(context,remote.connection));}
 function revealMatches(game,reveal){return game&&game.phase===(reveal.hasVariant?'variant':'draft')&&game.round.id===reveal.roundId&&game.round.from===reveal.actor&&game.round.cardId===reveal.cardId&&game.round.cardRoll===reveal.face;}
 function showSelectedTile(){
  const tile=main.querySelector('[data-reveal-selected]');if(!tile)return;
  if(/^(auto|scroll)$/.test(window.getComputedStyle?.(main)?.overflowY||'')){
   const box=tile.getBoundingClientRect(),area=main.getBoundingClientRect();
   if(box.bottom>area.bottom-8)main.scrollTop+=box.bottom-area.bottom+8;else if(box.top<area.top+8)main.scrollTop=Math.max(0,main.scrollTop+box.top-area.top-8);
  }else tile.scrollIntoView({block:'nearest',behavior:'instant'});
 }
 function cancelContentTransitions(){for(const animation of contentTransitions)animation.cancel();contentTransitions.clear();}
 function playContentTransition(element,keyframes,duration,finish){
  if(!element?.animate)return;
  const animation=element.animate(keyframes,{duration,easing:'cubic-bezier(.22,1,.36,1)'});contentTransitions.add(animation);
  animation.onfinish=()=>{contentTransitions.delete(animation);finish?.(true);};
  animation.oncancel=()=>{contentTransitions.delete(animation);finish?.(false);};
 }
 function animateDiceHandoff(previousStage){
  if(!previousStage||systemReduce||document.hidden||presentationHidden||!canvas.animate)return false;
  const holder=main.querySelector('[data-stage]'),grid=main.querySelector('.oa-card-grid');
  if(!holder||!['card','variant'].includes(holder.dataset.rollRole))return false;
  const target=holder.getBoundingClientRect();if(!target.height||!previousStage.height)return false;
  const dx=previousStage.left+previousStage.width/2-target.left-target.width/2;
  const dy=previousStage.top+previousStage.height/2-target.top-target.height/2;
  const scale=Math.max(.8,Math.min(1.5,previousStage.height/target.height));
  // Layout is final before the first frame. Only the die moves; all card slots stay in place.
  grid?.querySelectorAll('.oa-mini-card').forEach(tile=>{tile.style.animation='none';});
  const overflow=holder.style.overflow||'';holder.style.overflow='hidden';
  playContentTransition(canvas,[{transformOrigin:'50% 50%',transform:'translate('+dx+'px,'+dy+'px) scale('+scale+')',opacity:.72},{transformOrigin:'50% 50%',transform:'none',opacity:1}],360,completed=>{holder.style.overflow=overflow;if(completed&&canvas.parentElement===holder&&!busy&&!operationBusy&&!systemReduce&&!document.hidden&&!presentationHidden)die.breathe?.();});
  playContentTransition(grid,[{opacity:.2},{opacity:1}],260);
  playContentTransition(main.querySelector('h1'),[{opacity:.35},{opacity:1}],220);
  return true;
 }
 function render(transition=null){
  cancelContentTransitions();
  clearCharge(true,false);
  if(!remoteMode){const fresh=G.reduceRoom(localRoom,{type:'EXPIRE_TASKS',at:now(),actor:viewPlayer});if(fresh!==localRoom){localRoom=fresh;syncLocalView();save();}}
  trackGrade();
  // Connection updates may restore the game behind this screen, never replace it.
  if(!welcomeDismissed&&renderKey==='welcome'){renderPersona();scheduleExpiry();return;}
  const focused=document.activeElement;
  const focusData=focused&&main.contains(focused)?{...focused.dataset}:null;
  const scrollTop=main.scrollTop,scrollLeft=main.scrollLeft;
  const previousKey=renderKey;
  const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);
  renderPersona();
  const key=visibleViewKey();
  const animate=key!==renderKey;renderKey=key;
  root.classList.toggle('oa-entering',animate&&!systemReduce&&!document.hidden&&!presentationHidden);
  root.style.setProperty('--oa-accent',(welcomeDismissed&&canSeeCurrentRound()?category():null)?.color||G.categories[1].color);
  main.innerHTML=!welcomeDismissed?renderWelcome():remoteMode&&!remoteReady?renderLogin():tab==='play'?renderPlay():tab==='tasks'?renderTasks():renderUs();
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!awaitingPlayer(el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const invitationDot=root.querySelector('.oa-incoming-dot');if(invitationDot)invitationDot.hidden=!awaitingPlayer(viewPlayer);
  const count=root.querySelector('.oa-task-count');if(count){count.textContent=String((state.tasks||[]).length);count.hidden=!(state.tasks||[]).length;}
  const holder=main.querySelector('[data-stage]');
  if(holder){holder.prepend(canvas);die.setKind(Number(holder.dataset.kind),Number(holder.dataset.value));die.setColor?.(holder.dataset.rollRole==='category'?null:category()?.color);die.setReducedMotion(systemReduce);if(animate&&!transition&&!document.hidden&&!presentationHidden)die.breathe?.();}
  else die.pauseMotion?.();
  root.classList.toggle('is-busy',busy||operationBusy);
  animateGauge();
  if(animate&&!systemReduce&&!document.hidden&&!presentationHidden&&main.animate&&!transition){
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-subtitle,:scope > .oa-steps,:scope > .oa-card-stage,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score');
   blocks.forEach((el,i)=>{const pinned=window.getComputedStyle?.(el)?.position==='sticky';el.animate(pinned?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,delay:Math.min(i*28,100),easing:'cubic-bezier(.18,.8,.2,1)',fill:'backwards'});});
   main.querySelectorAll('.oa-category').forEach((el,i)=>el.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:440,delay:90+i*30,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
   playContentTransition(main.querySelector('.oa-card-grid'),[{opacity:.2},{opacity:1}],240);
   const revealed=main.querySelector('.oa-card-stage .oa-playing-card');
   if(revealed&&visibleCardId!==state.round.cardId)revealed.animate([{transform:'perspective(850px) translateY(24px) rotateX(10deg) rotateZ(-3deg) scale(.94)'},{transform:'perspective(850px) translateY(-3px) rotateX(-1deg) rotateZ(.6deg) scale(1.006)',offset:.7},{transform:'perspective(850px) translateY(0) rotateX(0) rotateZ(0) scale(1)'}],{duration:480,easing:'cubic-bezier(.18,.76,.2,1)'});
  }
  animateGrade();
  if(!cardReveal)visibleCardId=state.round.cardId;
  scheduleExpiry();
  if(focusData&&previousKey===renderKey){
   const keys=['action','pref','taskCheck','player','card','tab'];let same;
   if(keys.some(k=>focusData[k]))same=Array.from(main.querySelectorAll('button,input')).find(el=>keys.every(k=>(el.dataset[k]||'')===(focusData[k]||'')));
   if(same)same.focus({preventScroll:true});else{const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
  }
  else if(previousKey&&previousKey!==renderKey){const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
  main.scrollTop=previousKey===key?scrollTop:0;main.scrollLeft=previousKey===key?scrollLeft:0;
  if(transition)animateDiceHandoff(transition);
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
  if(active){controlsBusyState=controlsBusyState||new Map();root.querySelectorAll('button,input').forEach(el=>{if(el.dataset.action==='close'&&!sheet.hidden)return;if(!controlsBusyState.has(el))controlsBusyState.set(el,el.disabled);el.disabled=true;});}
  else if(controlsBusyState){for(const [el,disabled] of controlsBusyState)if(el.isConnected)el.disabled=disabled;controlsBusyState=null;}
 }
 async function roll(reroll=false,power=0){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  const expectedPhase=state.phase,expectedRound=state.round.id;if(!remoteMode){pullShared();if(state.phase!==expectedPhase||state.round.id!==expectedRound){render();return;}}
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  const context={actor,roundId,roomId:remote?.connection?.roomId,epoch:presentationEpoch,categoryId:state.round.categoryId,hasVariant:state.round.catalogueVersion===2,hand:[...state.round.hand],discarded:reroll?{cardId:state.round.cardId,slot:state.round.cardRoll}:null};
  let sides,action,faceValue,next,resultLabel,settled=false;
  if(remoteMode&&phase==='category'&&remoteSnapshot?.quota?.remaining===0)return;
  if(reroll){if(!G.canRerollCard(state))return;sides=challengeSides();action={type:'REROLL_CARD'};}
  else if(phase==='category'&&canDraw()){sides=G.rules.categorySides;action={type:'ROLL_CATEGORY',catalogueVersion:2};}
  else if(phase==='card'&&canDraw()){sides=challengeSides();action={type:'ROLL_CARD'};}
  else if(phase==='variant'&&canDraw()){sides=G.rules.variantSides;action={type:'ROLL_VARIANT'};}
  else if(phase==='draft_challenge'&&G.canRollDraftDefense(state)){sides=20;action={type:'ROLL_DRAFT_DEFENSE'};}
  else if(phase==='challenge'&&G.canRespond(state)){sides=20;action={type:'ROLL_DEFENSE'};}
  else return;
  cancelContentTransitions();
  const serial=++animationSerial;busy=true;rerolling=reroll;if(rerolling)render();setControlsBusy(true);
  context.viewKey=renderKey;
  if(rerolling)centerStage();
  const button=main.querySelector('[data-action="roll"]')||main.querySelector('[data-roll-status]');if(button){button.textContent='Tirage…';button.setAttribute('aria-busy','true');}
  try{
   if(remoteMode){
    const value=await remote.action({...action,roundId});
    if(!value.roll||value.roll.kind!==sides){
     const restored=action.type==='ROLL_CATEGORY'&&value.roll?.kind===G.categorySides(1)?G.normalizeState(value.state):null;
     const oldCategory=G.legacyCategories.find(category=>category.number===value.roll?.value);
     if(!restored||restored.phase!=='card'||restored.round.id!==roundId||restored.round.from!==actor||
        restored.activePlayer!==actor||restored.round.catalogueVersion!==undefined||
        !oldCategory||restored.round.categoryId!==oldCategory.id||restored.round.categoryRoll!==value.roll.value)throw Error('Unconfirmed roll');
     // A stored v1 receipt resumes its hand without animating a D6 on the D4 stage.
     if(presentationValid(context)&&currentPerspective(value)&&(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision))deferredSnapshot=value;
     return;
    }
    faceValue=value.roll.value;next=focusedReply(value,roundId);if(!next)throw Error('Unconfirmed round');
    if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;
   }else{
    const faces=reroll?Array.from({length:sides},(_,i)=>i+1).filter(value=>value!==state.round.cardRoll):null;
    faceValue=action.type==='ROLL_CATEGORY'?G.rollCategory(action.catalogueVersion,G.randomInt):
      faces?faces[G.randomInt(faces.length)-1]:G.randomInt(sides);
    action.value=faceValue;
    if(action.type==='ROLL_CATEGORY')action.hand=G.drawHand(state,faceValue,action.catalogueVersion);
    if(action.type==='ROLL_DRAFT_DEFENSE')action.token=roundId+'-draft-'+(state.round.draftRolls.length+1);
    if(action.type==='ROLL_DEFENSE')action.token=roundId+'-'+(state.round.rolls.length+1);
    const nextRoom=G.reduceRoom(localRoom,{...action,actor,roundId,at:now()});if(nextRoom===localRoom)return;
    localRoom=nextRoom;syncLocalView();next=state;save();
   }
   resultLabel=action.type==='ROLL_CATEGORY'?'Catégorie '+(G.getCategory(next.round.categoryId,next.round.catalogueVersion??1)?.label||G.categories.find(c=>c.number===faceValue)?.label||'tirée') : ['ROLL_CARD','REROLL_CARD'].includes(action.type)?(G.getCard(next.round.cardId)?.title||'Carte tirée.'):action.type==='ROLL_VARIANT'?(G.getVariant(next.round)||'Variante choisie.'):'Lancer terminé.';
   const visualPower=Number.isFinite(power)?Math.max(0,Math.min(1,power)):0;
   if(button)button.textContent='Le dé roule…';
   if(!document.hidden&&!presentationHidden){activeRollFace={kind:sides,value:faceValue};softSound();await die.roll(faceValue,{duration:systemReduce?0:1650,power:visualPower});activeRollFace=null;}else die.setKind(sides,faceValue);
   settled=true;
   if(serial===animationSerial&&presentationValid(context)){
    if(['ROLL_CARD','REROLL_CARD'].includes(action.type)){
     const preview={...context,reroll,face:faceValue,cardId:context.hand[faceValue-1]},latest=remoteMode?(deferredSnapshot?focusedReply(deferredSnapshot,roundId):next):state;
     if(!document.hidden&&!presentationHidden&&G.getCard(preview.cardId)&&revealMatches(latest,preview)){
      cardReveal=preview;render();setControlsBusy(true);showSelectedTile();
      announce('D'+sides+' : '+faceValue+'. '+G.getCard(preview.cardId).title);await waitForReveal();
     }
    }else if(!document.hidden&&!presentationHidden){
     announce('D'+sides+' : '+faceValue+'. '+resultLabel);
     if(action.type==='ROLL_CATEGORY'){
      die.setColor?.(G.getCategory(next.round.categoryId,next.round.catalogueVersion??1)?.color);
      if(button){button.textContent='D'+sides+' · '+G.getCategory(next.round.categoryId,next.round.catalogueVersion??1).label;button.setAttribute('aria-busy','false');}
      await waitForReveal(1800);
     }
    }
    if(reroll&&!document.hidden&&!presentationHidden&&presentationValid(context))toast('Nouvelle carte · sans ton D20.');
   }
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{if(serial===animationSerial){const targetPhase=action.type==='ROLL_CATEGORY'?'card':action.type==='ROLL_CARD'&&context.hasVariant?'variant':null;const fromStage=settled&&targetPhase&&presentationValid(context)&&!document.hidden&&!presentationHidden?main.querySelector('[data-stage]')?.getBoundingClientRect():null;activeRollFace=null;cardReveal=null;finishRevealWait();busy=false;rerolling=false;setControlsBusy(false);if(remoteMode&&!remote?.authenticated){deferredSnapshot=null;const wasReady=remoteReady;remoteReady=false;if(wasReady)render();}else{if(remoteMode)flushRemote(null,false);render(fromStage&&state.phase===targetPhase&&state.round.id===roundId&&state.round.from===actor?fromStage:null);}}}
 }
 function openSheet(title,body,extraClass=''){lastFocus=document.activeElement;if(sheet.hidden)sheetContext={bodyOverflow:document.body.style.overflow,mainOverflow:main.style.overflow,top:main.scrollTop,left:main.scrollLeft,key:renderKey};sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div>'+body+'</section>';sheet.hidden=false;sheet.scrollTop=0;document.body.style.overflow='hidden';main.style.overflow='hidden';const shell=root.querySelector('.oa-shell');Array.from(shell.children).forEach(el=>{if(el!==sheet&&el.id!=='oa-announcement')el.inert=true;});const dialog=sheet.querySelector('.oa-sheet');if(dialog)dialog.scrollTop=0;sheet.querySelector('button')?.focus({preventScroll:true});}
 function closeSheet(){if(sheet.hidden)return;sheet.hidden=true;document.body.style.overflow=sheetContext?.bodyOverflow||'';main.style.overflow=sheetContext?.mainOverflow||'';sheet.innerHTML='';Array.from(root.querySelector('.oa-shell').children).forEach(el=>el.inert=false);if(lastFocus&&lastFocus.isConnected&&!lastFocus.hidden&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});else{main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}if(sheetContext?.key===renderKey){main.scrollTop=sheetContext.top;main.scrollLeft=sheetContext.left;}lastFocus=null;sheetContext=null;}

 function rules(){openSheet('Les règles.','<div class="oa-rule"><b>D4</b><div><h3>La catégorie.</h3><p>Le D4 choisit l’une des quatre catégories.</p></div></div><div class="oa-rule"><b>D6</b><div><h3>La carte et sa variante.</h3><p>Un lancer révèle la carte, le suivant précise sa variante.</p></div></div><div class="oa-rule"><b>D20</b><div><h3>Écarter la carte.</h3><p>Deux jets par personne. Leur somme retire les PV. À zéro, la carte est écartée. Après deux jets insuffisants de la personne qui tire, elle est proposée à l’autre.</p></div></div><div class="oa-rule"><b>+1</b><div><h3>Les deux cases, un point.</h3><p>Les actions validées restent vingt-quatre heures dans À faire. Elles quittent la liste après vos deux coches, ou à l’expiration.</p></div></div><div class="oa-actions">'+btn('Fermer','close')+'</div>');}

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
  if(action==='tab'){tab=['us','tasks'].includes(el.dataset.tab)?el.dataset.tab:'play';render();main.scrollTop=0;main.scrollLeft=0;return;}
  if(action==='profile'){if(remoteMode)return;tab=tab==='tasks'?'tasks':'play';changeView(el.dataset.player);announce('Profil : '+name(viewPlayer));return;}
  if(action==='own-draw'){tab='play';selectedIncomingRoundId=null;openedInvitation=null;if(remoteMode)selectDisplayState();else syncLocalView();render();return;}
  if(action==='open-invitation'){if(isParallel()&&incomingStates.some(incoming=>incoming.round.id===el.dataset.round)){selectedIncomingRoundId=el.dataset.round;selectDisplayState();}if(remoteMode){try{flushRemote(await remote.refresh(),false);}catch(error){remoteError(error);}}else pullShared();if(el.dataset.round===state.round.id&&G.canRespond(state))openedInvitation=invitationKey();render();return;}
  if(action==='send'){if(await dispatch({type:'SEND'}))toast('Proposée à '+name(state.round.to));return;}
  if(action==='challenge-draft'){await dispatch({type:'CHALLENGE_DRAFT'});return;}
  if(action==='challenge'){await dispatch({type:'CHALLENGE'});return;}
  if(action==='accept'){const changed=await dispatch({type:'ACCEPT'},false);if(state.phase==='accepted')tab='tasks';render();if(changed)announce(state.phase==='accepted'?'Proposition ajoutée aux choses à faire.':'Confirmation attendue.');return;}
  if(action==='new'){gaugeFrames.clear();tab='play';await dispatch({type:'NEW_ROUND'});return;}
  if(action==='enable-notifications'){operationBusy=true;el.disabled=true;try{await remote.enableNotifications();}catch(error){remoteError(error);}finally{operationBusy=false;flushRemote(null,false);render();}return;}
  if(action==='rules'){rules();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reset-confirm'){if(remoteMode)return;openSheet('Repartir de zéro ?','<p>La partie, le score commun, les favoris et les préférences de cette démonstration seront effacés.</p><div class="oa-actions">'+btn('Effacer la démo','reset','oa-clay')+textBtn('Conserver ma partie','close')+'</div>');return;}
  if(action==='reset'){if(remoteMode)return;closeSheet();tab='play';gaugeFrames.clear();await dispatch({type:'RESET'});syncLocalView();toast('La démonstration repart de zéro.');return;}
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
 function updateReducedMotion(event){systemReduce=event.matches;die.setReducedMotion(systemReduce);root.classList.remove('oa-entering');cancelContentTransitions();(root.getAnimations?.({subtree:true})||[]).forEach(a=>a.cancel());}
 if(motionQuery?.addEventListener)motionQuery.addEventListener('change',updateReducedMotion);
 else motionQuery?.addListener?.(updateReducedMotion);
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
   if(completed&&!systemReduce&&article.animate)article.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],{duration:180,delay:1020,fill:'forwards',easing:'ease-out'});
   setTimeout(()=>{pendingChecks.delete(id);if(remoteMode)flushRemote(null,false);render();if(completed){announce('Action partagée. Un point ajouté au duo.');toast('+1 point pour votre duo.');celebrate();}},systemReduce?0:1200);
   return;
  }
  if(el.dataset.pref){await dispatch({type:'SET_PREFS',patch:{[el.dataset.pref]:el.checked}});die.setReducedMotion(!!systemReduce);if(el.dataset.pref==='sound'&&el.checked)softSound();}
 });
 setInterval(async()=>{if(!document.hidden&&!busy&&!operationBusy&&!pendingChecks.size){if(remoteMode){if(remoteReady&&tab==='tasks')render();}else{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed||tab==='tasks')render();}}},30000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearCharge();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();}if(!document.hidden&&!remoteMode){pullShared();if(!busy&&!operationBusy&&!pendingChecks.size)render();}});
 window.addEventListener('storage',event=>{if(!remoteMode&&event.key===storageKey&&receiveShared(event.newValue)&&!busy&&!operationBusy&&!pendingChecks.size)render();});
 sheet.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
 root.addEventListener('keydown',event=>{
  const button=rollButton(event.target);
  if(button&&(event.code==='Space'||event.key===' ')){event.preventDefault();if(!event.repeat)startCharge(button,'keyboard',event);return;}
  if(event.key==='Escape'&&charge){event.preventDefault();clearCharge();return;}
  if(event.key==='Enter'){clearCharge(false);suppressedClick=null;}
  if(sheet.hidden)return;if(event.key==='Escape'){closeSheet();return;}if(event.key==='Tab'){const focusable=Array.from(sheet.querySelectorAll('button,a,input,select,textarea,summary')).filter(x=>!x.disabled);if(!focusable.length){event.preventDefault();return;}const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 });
 render();
 if(remoteMode){
  if(!remote?.enabled){authBusy=false;loginError='La connexion à votre espace n’est pas encore disponible.';render();}
  else{
   remote.subscribeToChanges(event=>{
    if(remote.connection&&!remote.authenticated){
     // A reconnect owns its pending screen. Background status must not reset it.
     if(authBusy)return;
     const wasReady=remoteReady;if(wasReady)presentationEpoch++;remoteReady=false;deferredSnapshot=null;cardReveal=null;finishRevealWait();announce('');updateLoginError(event.status.message);if(wasReady)render();return;
    }
    if(event.snapshot)receiveRemote(event.snapshot);
    else if(!authBusy&&!remoteReady&&event.status.message)updateLoginError(event.status.message);
    if(remoteReady&&tab==='us'&&!busy&&!operationBusy&&!pendingChecks.size&&notificationSignature!==JSON.stringify(remote.notificationStatus))render();
   });
   remote.start();
   remote.restore().then(value=>{if(value)flushRemote(value,false);else remoteReady=false;authBusy=false;render();}).catch(error=>{remoteReady=false;authBusy=false;loginError=error&&error.isDesirRemoteError?error.message:'La connexion est momentanément indisponible.';render();});
  }
 }
 const swApi=window.navigator&&window.navigator.serviceWorker;
 if(remoteMode&&swApi){
  const hadController=!!swApi.controller;
  const showShellUpdate=()=>{
   if(root.querySelector('.oa-update'))return;
   const bar=document.createElement('div');bar.className='oa-update';bar.setAttribute('role','status');
   bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#20241f;color:#edcfc4;font:600 12px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 -8px 20px rgba(0,0,0,.4)';
   const label=document.createElement('span');label.textContent='Une mise à jour de Dés·ir est prête.';
   const reload=document.createElement('button');reload.type='button';reload.textContent='Recharger';
   reload.style.cssText='border:0;border-radius:9px;padding:8px 14px;font:inherit;color:#fff0e6;background:linear-gradient(145deg,#cf7475,#ad4b5b);cursor:pointer';
   reload.addEventListener('click',()=>location.reload());
   bar.append(label,reload);root.append(bar);announce('Une mise à jour de Dés·ir est prête. Recharge pour l’utiliser.');
  };
  swApi.addEventListener('controllerchange',()=>{if(hadController&&swApi.controller)showShellUpdate();});
  swApi.ready.then(registration=>{
   if(!registration)return;
   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;if(!worker)return;
    worker.addEventListener('statechange',()=>{if(hadController&&(worker.state==='installed'||worker.state==='activating'))showShellUpdate();});
   });
   return registration.update().catch(()=>{});
  }).catch(()=>{});
 }
 root.dataset.ready='true';
})();
