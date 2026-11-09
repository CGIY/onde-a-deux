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
 const persona=root.querySelector('.oa-persona'),navigation=root.querySelector('.oa-nav');
 let remoteReady=false,authBusy=remoteMode,operationBusy=false,loginError='',loginUsername='',remoteSnapshot=null,deferredSnapshot=null,remoteSignature='',serverOffset=0;
 const welcomeKey='desir-welcome-v1';
 let welcomeDismissed=false;try{welcomeDismissed=localStorage.getItem(welcomeKey)==='1';}catch(_){}
 let localPrefs={sound:false};try{const saved=JSON.parse(localStorage.getItem('desir-preferences-v1')||'{}');if(typeof saved.sound==='boolean')localPrefs.sound=saved.sound;}catch(_){}

 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let localRoom=null,ownState=null,incomingStates=[],outgoingCount=0,selectedIncomingRoundId=null;
 let state=G.createState(), tab='play', busy=false, rerolling=false, toastTimer, lastFocus=null, animationSerial=0;
 let cardReveal=null,refusal=null,revealWait=null,activeRollFace=null,presentationEpoch=0,presentationHidden=false;
 let autoNewRoundTimer=null,autoNewRoundId=null;
 let charge=null,suppressedClick=null,controlsBusyState=null;
 let persisted=false, canPersist=true, recovery=false, lastError='';
 let renderKey='',renderedMarkup='',infoReading=null;
 const contentTransitions=new Set();
 const gaugeFrames=new Map();
 const pendingChecks=new Set();
 let taskExpiryTimer;
 let visibleCardId=null, openedInvitation=null, viewPlayer='a', sharedSnapshot=null;
 let sheetContext=null;
 const badgeCatalog=Array.isArray(G.badgeCatalog)?G.badgeCatalog:[];
 const badgeDefinitions=new Map(badgeCatalog.map(badge=>[badge.id,badge]));
 const badgeArtCache=new Map();
 const badgeNotice=root.querySelector('#oa-badge-notice'),badgeAnnouncement=root.querySelector('#oa-badge-announcement');
 const badgeMemory=new Map();
 let badgeView=null,badgeRegistryKey=null,badgeRegistry=null,badgeMissingBaseline=null,badgeActive=null,badgeTimer=null,badgeTimerStarted=0;
 let badgeHover=false,badgeFocus=false,badgeReturnFocus=null,badgeSheetOpen=false,badgeFilter='all',badgeHighlight=null,badgeSheetMarkup='',badgeDetailId=null,badgeGalleryScroll=null,badgeNoticeAnimation=null;
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
 window.addEventListener('pageshow',()=>{presentationHidden=false;startViewport();updateBadgeNotice();});
 window.addEventListener('pagehide',()=>{presentationHidden=true;stopViewport();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();updateBadgeNotice();});
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
 const roundVersion=round=>round.catalogueVersion??(round.variantRoll!==undefined?2:1);
 const isHardcore=round=>round.catalogueVersion===3&&round.intimacyPool==='hardcore';
 const categoryLabel=round=>G.getCategory(round.categoryId,roundVersion(round)).label+(isHardcore(round)?' · Hardcore':'');
 const canDraw=()=>state.phase==='category'
  ? !remoteMode || (typeof remoteSnapshot?.drawAvailable==='boolean'?remoteSnapshot.drawAvailable:state.activePlayer===state.round.from)
  : state.activePlayer===state.round.from;
 const canSeeCurrentRound=()=>G.canSeeRound(state)&&(state.phase!=='category'||canDraw());
 const parisToday=()=>G.parisDateKey(new Date(serverNow()).toISOString());
 const canRerollCategoryNow=()=>state.phase==='card'&&state.activePlayer===state.round.from&&!!state.dailyReroll&&!(state.dailyReroll.dateKey===parisToday()&&state.dailyReroll.used.includes(state.activePlayer));
 const jokerAvailable=()=>state.phase==='category'&&state.activePlayer===state.round.from&&!!state.joker&&state.joker.weekKey===G.isoWeekKey(new Date(serverNow()).toISOString())&&!state.joker.usedBy;
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const chargeNow=()=>window.performance?.now?window.performance.now():Date.now();
 const chargeLimit=1200;
 function rollButton(target){const button=target.closest?.('[data-action]');return button&&root.contains(button)&&['roll','reroll'].includes(button.dataset.action)?button:null;}
 function canCharge(button){
  if(!button||button.disabled||!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return false;
  if(button.dataset.action==='reroll')return G.canRerollCard(state);
  return state.phase==='category'&&canDraw()&&(!remoteMode||remoteSnapshot?.quota?.remaining!==0)||['card','variant'].includes(state.phase)&&canDraw();
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
  if(refresh)updateBadgeNotice();
  return active;
 }
 function startCharge(button,source,event){
  if(!canCharge(button)||charge)return false;
  suppressedClick=null;charge={button,source,started:chargeNow(),power:0,frame:null,pointerId:source==='pointer'?event.pointerId:undefined,x:event.clientX,y:event.clientY,phase:state.phase,roundId:state.round.id,cardId:state.round.cardId,actor:viewPlayer};
  button.classList.add('is-charging');drawCharge();updateBadgeNotice();
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
  const pending=localRoom.pendingRounds.map(item=>G.roomView(localRoom,viewPlayer,item.round.id)).filter(value=>value?.phase==='pending'&&G.canSeeRound(value,viewPlayer));
  incomingStates=pending.filter(value=>value.round.from!==viewPlayer&&G.canRespond(value));
  outgoingCount=pending.filter(value=>value.round.from===viewPlayer).length;
  selectDisplayState();
 }
 function isParallel(){return !remoteMode||remoteSnapshot?.gameVersion===6;}
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
  const views=remoteMode?[ownState,...incomingStates].filter(Boolean):[
   ...Object.values(localRoom.lanes).map(lane=>G.roomView(localRoom,player,lane.round.id)),
   ...localRoom.pendingRounds.map(item=>G.roomView(localRoom,player,item.round.id))
  ];
  return views.some(value=>value?.phase==='pending'&&value.round.awaiting===player)||
   remoteMode&&outgoingCount>0&&player===G.otherPlayer(viewPlayer);
 }
 function invitationKey(){return state.round.id+'-'+state.round.awaiting;}

 function announce(text){root.querySelector('#oa-announcement').textContent=text;}
 function serverNow(){return Date.now()+serverOffset;}
 function samePerspective(a,b){return a&&b&&a.roomId===b.roomId&&a.actor===b.actor;}
 function currentPerspective(value){const identity=remote?.connection;return !identity||samePerspective(value,identity);}
 function applyRemote(value,renderNow=true){
  if(remoteMode&&!remote?.authenticated||!value||!value.state||!['a','b'].includes(value.actor)||!currentPerspective(value))return false;
  if(samePerspective(value,remoteSnapshot)&&value.revision<remoteSnapshot.revision)return false;
  if(value.badges===undefined&&samePerspective(value,remoteSnapshot)&&remoteSnapshot.badges)value={...value,badges:remoteSnapshot.badges};
  const normalized=G.normalizeState(value.state);if(!normalized||normalized.activePlayer!==value.actor)return false;
  if(remoteSnapshot&&!samePerspective(value,remoteSnapshot)){openedInvitation=null;selectedIncomingRoundId=null;visibleCardId=null;gaugeFrames.clear();}
  if(value.serverTime&&Number.isFinite(Date.parse(value.serverTime)))serverOffset=Date.parse(value.serverTime)-Date.now();
  const signature=JSON.stringify({state:value.state,actor:value.actor,quota:value.quota,paired:value.paired,drawAvailable:value.drawAvailable,gameVersion:value.gameVersion,incoming:value.incoming,pendingOutgoing:value.pendingOutgoing,badges:value.badges,activity:value.activity,streak:value.activity?G.activeStreak(value.activity,new Date(serverNow()).toISOString()):null});
  const changed=signature!==remoteSignature;remoteSignature=signature;remoteSnapshot=value;
  viewPlayer=value.actor;ownState={...normalized,prefs:{...normalized.prefs,...localPrefs}};incomingStates=(value.incoming||[]).map(incoming=>({...incoming,prefs:{...incoming.prefs,...localPrefs}}));outgoingCount=Number.isInteger(value.pendingOutgoing)?value.pendingOutgoing:0;selectDisplayState();remoteReady=true;authBusy=false;loginError='';
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
   const waiting={SEND:['send','Envoi…'],NEW_ROUND:['new','Un instant…']}[action.type];
   const trigger=waiting&&main.querySelector('[data-action="'+waiting[0]+'"]');if(trigger){renderedMarkup='';trigger.textContent=waiting[1];trigger.setAttribute('aria-busy','true');}
   try{const value=action.type==='EXPIRE_TASKS'?await remote.refresh():await remote.action({...action,roundId:action.roundId||state.round.id});return flushRemote(value,false);}
   catch(error){return remoteError(error);}
   finally{operationBusy=false;setControlsBusy(false);trigger?.removeAttribute('aria-busy');if(doRender)render();}
  }
  const roundId=state.round.id;pullShared();const next=G.reduceRoom(localRoom,{at:now(),roundId,...action,...(action.type==='SEND'?{directQueue:true}:{}),actor:viewPlayer});const changed=next!==localRoom;localRoom=next;syncLocalView();if(changed)save();if(doRender)render();return changed;
 }

 function toast(text){clearTimeout(toastTimer);const el=root.querySelector('#oa-toast');el.textContent=text;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},3600);}
 function btn(label,action,style='',extra=''){if(action==='new'&&isParallel()&&state.round.from!==viewPlayer){label='Mon tirage';action='own-draw';}return '<button type="button" class="oa-button cursor-interaction '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function textBtn(label,action,extra=''){return '<button type="button" class="oa-text-button cursor-interaction" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function eyebrow(text){return '<p class="oa-eyebrow">'+h(text)+'</p>';}
 function heading(title,sub,eyebrowText){return (eyebrowText?eyebrow(eyebrowText):'')+'<h1 class="oa-title">'+title+'</h1>'+(sub?'<p class="oa-subtitle">'+sub+'</p>':'');}
 function cardHeading(round){return heading(h(G.getCategory(round.categoryId,roundVersion(round)).label),null,isHardcore(round)?'Hardcore':null);}
 function steps(active,sides=G.rules.cardSides,hasVariant=true,catalogueVersion=3){
  const path=[[G.categorySides(catalogueVersion),'Catégorie'],[sides,'Carte']];
  if(hasVariant)path.push([G.rules.variantSides,'Variante']);
  return '<div class="oa-steps" aria-label="Parcours du jeu">'+path.map(([kind,label],i)=>'<span class="oa-step '+(active===i+1?'is-active':active>i+1?'is-done':'')+'" '+(active===i+1?'aria-current="step"':'')+'><b>D'+kind+'</b>'+label+'</span>').join('<span class="oa-step-sep" aria-hidden="true">›</span>')+'</div>';
 }
 function stage(type,label,value,role='defense'){return '<section class="oa-dice-section" aria-label="Lancer le dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+'</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'" data-roll-role="'+role+'"></div></section>';}
 function categoriesGrid(){const joker=jokerAvailable();const tile=c=>'<div class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></div><span class="oa-category-label">'+h(c.label)+'</span>';return '<div class="oa-category-grid">'+G.categories.map(c=>joker?'<button type="button" class="oa-category cursor-interaction" data-action="joker" data-category="'+c.number+'" style="--category:'+c.color+'" aria-label="Joker : choisir le thème '+h(c.label)+'">'+tile(c)+'</button>':'<div class="oa-category" style="--category:'+c.color+'">'+tile(c)+'</div>').join('')+'</div>';}
 function handGrid(options={}){const discarded=options.discarded||null,selected=options.selected||null,hand=options.hand||state.round.hand,version=options.catalogueVersion??state.round.catalogueVersion??1,pool=options.intimacyPool===undefined?state.round.intimacyPool:options.intimacyPool;const count=hand.length,words=count===6?'Six':'Quatre';return '<div class="oa-card-grid'+(count===6?' is-six':'')+(discarded?' is-reroll':'')+(selected?' is-revealing':'')+'" data-catalogue-version="'+version+'" aria-label="'+(selected?words+' emplacements, carte '+selected.slot+' choisie':discarded?words+' emplacements, une carte écartée':words+' cartes face cachée')+'">'+hand.map((id,i)=>{
  const width=[68,82,74,60,78,64][i],old=discarded&&discarded.slot===i+1&&discarded.cardId===id?G.getCard(discarded.cardId):null;
  const chosen=selected&&selected.slot===i+1&&selected.cardId===id?G.getCard(selected.cardId):null;
  if(chosen){const cat=G.getCategory(chosen.categoryId,version);return '<div class="oa-mini-card oa-card-back oa-card-revealed" data-reveal-selected aria-label="Carte '+(i+1)+' choisie" style="--category:'+h(cat.color)+'"><span class="oa-mini-number">'+(i+1)+'</span><div class="oa-reveal-content"><div class="oa-reveal-art" aria-hidden="true"><i></i><i></i><i></i></div><span class="oa-reveal-category">'+h(categoryLabel({categoryId:chosen.categoryId,catalogueVersion:version,intimacyPool:pool}))+'</span><h3>'+h(chosen.title)+'</h3></div></div>';}
  if(old)return '<div class="oa-mini-card oa-card-back oa-card-discarded" aria-label="Carte '+(i+1)+' écartée : '+h(old.title)+'"><span class="oa-mini-number">'+(i+1)+'</span><span class="oa-discarded-state">Écartée</span><h3 class="oa-discarded-title" title="'+h(old.title)+'">'+h(old.title)+'</h3></div>';
  return '<div class="oa-mini-card oa-card-back" aria-label="Carte '+(i+1)+' face cachée"><span class="oa-mini-number">'+(i+1)+'</span><div class="oa-card-ghost" aria-hidden="true" inert style="--ghost-title:'+width+'%"><div class="oa-ghost-art"><i></i><i></i><i></i></div><span class="oa-ghost-title"></span><span class="oa-ghost-line"></span></div></div>';
 }).join('')+'</div>';}
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function proposalDetail(round){return G.getVariant(round)||(round.adapted?round.proposal:null);}
 function roleplayNote(c){
  const r=state.round,entry=G.needsVariant(r)&&Number.isInteger(r.variantRoll)?roleplayCards[c.id+':v'+r.variantRoll]:null;
  if(!entry||typeof entry.metric!=='string'||typeof entry.text!=='string')return '';
  return '<aside class="oa-roleplay" aria-label="Une phrase pour le jeu"><p class="oa-roleplay-value">'+h(entry.metric)+'</p><p class="oa-roleplay-copy">'+h(entry.text)+'</p></aside>';
 }
 function playingCard(c,compact=false){
  const r=state.round,cat=G.getCategory(c.categoryId,r.catalogueVersion??1),detail=proposalDetail(r),note=(r.catalogueVersion??1)===1?cardNotes[c.id]:null;
  return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(categoryLabel(r))+(r.adapted?' · VARIANTE':'')+'</span></div>'+(!compact?'<div class="oa-card-illustration" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2>'+(detail?'<p class="oa-card-description">'+h(detail)+'</p>':'')+(note?'<p class="oa-card-note">'+h(note)+'</p>':'')+roleplayNote(c)+'</article>';
 }

 function badgeMedallion(badge,instance){
  const locked=!badge.award,key=instance+':'+badge.id+':'+(locked?'locked':'earned');
  if(!badgeArtCache.has(key)){
   const svg=window.OndeBadgeArt?.render(badge.id,{locked,instance});
   if(typeof svg==='string')badgeArtCache.set(key,svg);
  }
  return '<span class="oa-medallion" data-badge-medallion="'+h(badge.id)+'" data-badge-instance="'+instance+'" aria-hidden="true">'+(badgeArtCache.get(key)||'')+'</span>';
 }
 function badgeRows(){
  const items=new Map((badgeView?.items||[]).map(item=>[item.id,item]));
  return badgeCatalog.map(definition=>({...definition,...items.get(definition.id)}));
 }
 function recentBadges(){return badgeRows().filter(badge=>badge.award).sort((a,b)=>b.award.sequence-a.award.sequence||a.id.localeCompare(b.id));}
 function badgeScopeLabel(badge){return badge.scope==='shared'?'À deux':'À moi';}
 function badgeDate(award){
  if(!award?.at)return 'Débloqué auparavant';
  return 'Débloqué le <time datetime="'+h(award.at)+'">'+h(new Date(award.at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'}))+'</time>';
 }
 function badgeTile(badge,instance){
  const earned=!!badge.award,value=Math.min(badge.progress?.value||0,badge.target);
  const status=earned?'Débloqué':value?value+' / '+badge.target:'À débloquer';
  const accessible=badge.title+'. '+badgeScopeLabel(badge)+'. '+(earned?'Débloqué.':'À débloquer, '+value+' sur '+badge.target+'.')+' '+badge.description+' Voir le badge.';
  return '<li class="oa-achievement'+(earned?' is-earned':' is-locked')+(badge.id===badgeHighlight?' is-highlighted':'')+'" data-badge-id="'+h(badge.id)+'"><button type="button" class="oa-achievement-tile cursor-interaction" data-action="badge-detail" data-badge="'+h(badge.id)+'" aria-label="'+h(accessible)+'"'+(instance==='recent'?' aria-haspopup="dialog"':'')+'>'+badgeMedallion(badge,instance)+'<span class="oa-medal-title">'+h(badge.title)+'</span><span class="oa-medal-status">'+h(status)+'</span></button></li>';
 }
 function badgesSection(){
  if(!badgeView)return '';
  const earned=recentBadges();
  return '<section class="oa-achievements" aria-labelledby="oa-badges-title"><div class="oa-section-head"><h2 id="oa-badges-title">Badges</h2><span aria-label="'+earned.length+' badges débloqués sur '+badgeCatalog.length+'">'+earned.length+' / '+badgeCatalog.length+'</span></div>'+(earned.length?'<p class="oa-note">Les derniers débloqués</p><ol class="oa-achievement-gallery is-recent">'+earned.slice(0,5).map(badge=>badgeTile(badge,'recent')).join('')+'</ol>':'<p class="oa-note">Votre premier badge vous attend.</p>')+'<div class="oa-achievement-more">'+textBtn('Tout afficher','badges-all','aria-label="Afficher les '+badgeCatalog.length+' badges"')+'</div></section>';
 }
 function badgeDetailMarkup(badge){
  const earned=!!badge.award,value=Math.min(badge.progress?.value||0,badge.target),caption=earned?'Objectif atteint':value+' / '+badge.target;
  return '<div class="oa-achievement-back">'+textBtn('‹ Collection','badge-back','aria-label="Revenir à la collection de badges"')+'</div><article class="oa-achievement-detail'+(earned?' is-earned':' is-locked')+'" data-badge-detail="'+h(badge.id)+'">'+badgeMedallion(badge,'detail')+'<p class="oa-achievement-meta">'+badgeScopeLabel(badge)+' · '+(earned?'Débloqué':'À débloquer')+'</p><h3 data-badge-heading tabindex="-1">'+h(badge.title)+'</h3><div class="oa-achievement-condition"><h4>La condition</h4><p>'+h(badge.description)+'</p></div><div class="oa-achievement-progress" role="progressbar" aria-label="'+h(badge.title)+'" aria-valuemin="0" aria-valuemax="'+badge.target+'" aria-valuenow="'+value+'" aria-valuetext="'+h(caption)+'"><i style="transform:scaleX('+value/badge.target+')"></i></div><p class="oa-achievement-value">'+caption+'</p>'+(earned?'<p class="oa-achievement-date">'+badgeDate(badge.award)+'</p>':'')+'</article>';
 }
 function badgeCollectionMarkup(){
  const all=badgeRows(),detail=badgeDetailId&&all.find(badge=>badge.id===badgeDetailId);
  if(detail)return badgeDetailMarkup(detail);
  const rows=all.filter(badge=>badgeFilter==='all'||badge.scope===badgeFilter).sort((a,b)=>a.award&&b.award?b.award.sequence-a.award.sequence||a.id.localeCompare(b.id):a.award?-1:b.award?1:a.order-b.order);
  const filters=[['all','Tous'],['individual','À moi'],['shared','À deux']],earned=rows.filter(badge=>badge.award).length;
  return '<div class="oa-achievement-filters" role="group" aria-label="Filtrer les badges">'+filters.map(([scope,label])=>'<button type="button" class="cursor-interaction" data-action="badge-filter" data-scope="'+scope+'" aria-pressed="'+(badgeFilter===scope)+'">'+label+'<span>'+all.filter(badge=>scope==='all'||badge.scope===scope).length+'</span></button>').join('')+'</div><p class="oa-achievement-total" role="status">'+earned+' débloqué'+(earned>1?'s':'')+' sur '+rows.length+'</p><ul class="oa-achievement-gallery">'+rows.map(badge=>badgeTile(badge,'collection')).join('')+'</ul>';
 }
 function badgeTileElement(container,id){return id&&badgeDefinitions.has(id)?container?.querySelector('[data-action="badge-detail"][data-badge="'+id+'"]'):null;}
 function updateBadgeCollection(){
  if(!badgeSheetOpen||sheet.hidden||!badgeView)return;
  const content=sheet.querySelector('[data-badge-collection]');if(!content)return;
  const markup=badgeCollectionMarkup();if(markup===badgeSheetMarkup)return;
  const dialog=sheet.querySelector('.oa-sheet'),scrollTop=dialog?.scrollTop||0,focused=document.activeElement;
  const focus=content.contains(focused)?{action:focused.dataset.action,scope:focused.dataset.scope,badge:focused.dataset.badge,heading:focused.hasAttribute?.('data-badge-heading')}:null;
  content.innerHTML=markup;badgeSheetMarkup=markup;
  if(focus?.action==='badge-filter')content.querySelector('[data-scope="'+focus.scope+'"]')?.focus({preventScroll:true});
  else if(focus?.action==='badge-detail')badgeTileElement(content,focus.badge)?.focus({preventScroll:true});
  else if(focus?.action==='badge-back')content.querySelector('[data-action="badge-back"]')?.focus({preventScroll:true});
  else if(focus?.heading)content.querySelector('[data-badge-heading]')?.focus({preventScroll:true});
  if(dialog)dialog.scrollTop=scrollTop;
 }
 function openBadgeCollection(id=null){
  if(!badgeView)return;
  badgeFilter='all';badgeHighlight=badgeDefinitions.has(id)?id:null;badgeDetailId=badgeHighlight;badgeGalleryScroll=null;badgeSheetOpen=true;badgeSheetMarkup=badgeCollectionMarkup();
  openSheet('La collection','<div data-badge-collection>'+badgeSheetMarkup+'</div>','oa-achievement-sheet');
  if(badgeDetailId)sheet.querySelector('[data-badge-heading]')?.focus({preventScroll:true});
 }
 function openBadgeDetail(id){
  if(!badgeView||!badgeDefinitions.has(id))return;
  if(!badgeSheetOpen||sheet.hidden){openBadgeCollection(id);return;}
  const dialog=sheet.querySelector('.oa-sheet');
  if(!badgeDetailId)badgeGalleryScroll=dialog?.scrollTop||0;
  badgeDetailId=id;badgeHighlight=id;updateBadgeCollection();if(dialog)dialog.scrollTop=0;
  sheet.querySelector('[data-badge-heading]')?.focus({preventScroll:true});
 }
 function backToBadgeCollection(){
  if(!badgeSheetOpen||!badgeDetailId)return;
  const id=badgeDetailId;badgeDetailId=null;updateBadgeCollection();
  const dialog=sheet.querySelector('.oa-sheet'),tile=badgeTileElement(sheet,id);
  if(dialog)dialog.scrollTop=badgeGalleryScroll===null&&tile?Math.max(0,dialog.scrollTop+tile.getBoundingClientRect().top-dialog.getBoundingClientRect().top-90):badgeGalleryScroll||0;
  tile?.focus({preventScroll:true});
 }
 function validBadgeRegistry(value){
  return value&&value.version===1&&Number.isSafeInteger(value.epoch)&&value.epoch>0&&['seen','pending'].every(key=>Array.isArray(value[key])&&value[key].length<=120&&value[key].every(id=>typeof id==='string'&&id.length>0&&id.length<=200));
 }
 function readBadgeRegistry(key){
  let stored=null;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(validBadgeRegistry(value))stored=value;}catch(_){}
  const memory=badgeMemory.get(key);if(!stored)return memory||null;if(!memory)return stored;
  if(memory.epoch!==stored.epoch)return memory.epoch>stored.epoch?memory:stored;
  const seen=[...new Set([...stored.seen,...memory.seen])],seenIds=new Set(seen);
  return {version:1,epoch:stored.epoch,seen,pending:[...new Set([...stored.pending,...memory.pending])].filter(id=>!seenIds.has(id))};
 }
 function mergeBadgeRegistry(value){
  if(!badgeRegistry||!validBadgeRegistry(value)||value.epoch!==badgeRegistry.epoch)return;
  badgeRegistry.seen=[...new Set([...badgeRegistry.seen,...value.seen])].slice(0,120);
  const seen=new Set(badgeRegistry.seen);
  badgeRegistry.pending=[...new Set([...badgeRegistry.pending,...value.pending])].filter(id=>!seen.has(id)).slice(0,120);
 }
 function saveBadgeRegistry(){
  if(!badgeRegistryKey||!badgeRegistry)return;
  const previous=readBadgeRegistry(badgeRegistryKey);mergeBadgeRegistry(previous);
  if(previous&&previous.epoch>badgeRegistry.epoch)return;
  const value={version:1,epoch:badgeRegistry.epoch,seen:[...badgeRegistry.seen],pending:[...badgeRegistry.pending]};
  badgeMemory.set(badgeRegistryKey,value);
  const serialized=JSON.stringify(value);try{if(localStorage.getItem(badgeRegistryKey)!==serialized)localStorage.setItem(badgeRegistryKey,serialized);}catch(_){}
 }
 function stopBadgeTimer(){
  if(badgeTimer!==null){clearTimeout(badgeTimer);badgeTimer=null;if(badgeActive)badgeActive.remaining=Math.max(0,badgeActive.remaining-(chargeNow()-badgeTimerStarted));}
 }
 function stopBadgeNoticeAnimation(){const animation=badgeNoticeAnimation;badgeNoticeAnimation=null;animation?.cancel();}
 function animateBadgeNotice(){
  stopBadgeNoticeAnimation();
  if(systemReduce||document.hidden||presentationHidden)return;
  const medal=badgeNotice.querySelector('[data-badge-medallion]');if(!medal?.animate)return;
  const animation=medal.animate([{transform:'rotate(-8deg) scale(.84)'},{transform:'rotate(2deg) scale(1.035)',offset:.7},{transform:'rotate(0deg) scale(1)'}],{duration:520,easing:'cubic-bezier(.18,.8,.2,1)'});
  badgeNoticeAnimation=animation;animation.onfinish=animation.oncancel=()=>{if(badgeNoticeAnimation===animation)badgeNoticeAnimation=null;};
 }
 function clearBadgeContext(){
  stopBadgeTimer();stopBadgeNoticeAnimation();badgeActive=null;badgeHover=false;badgeFocus=false;badgeReturnFocus=null;badgeView=null;badgeRegistry=null;badgeRegistryKey=null;badgeMissingBaseline=null;
  if(badgeNotice){badgeNotice.hidden=true;badgeNotice.innerHTML='';delete badgeNotice.dataset.award;}if(badgeAnnouncement)badgeAnnouncement.textContent='';
  if(badgeSheetOpen)closeSheet();badgeFilter='all';badgeHighlight=null;badgeDetailId=null;badgeGalleryScroll=null;
 }
 function trackBadges(){
  const next=remoteMode?(remoteReady&&remote?.authenticated?remoteSnapshot?.badges:null):G.badgeView?.(localRoom,viewPlayer);
  const scope=remoteMode?(remoteReady&&remote?.authenticated?String(window.DesirConfig.endpoint)+':'+remoteSnapshot.roomId+':'+viewPlayer:null):'demo:'+viewPlayer;
  const key=scope?'desir-badges-seen-v1:'+scope:null;
  if(!next||!G.validateBadgeView?.(next,viewPlayer)){
   if(badgeRegistryKey)clearBadgeContext();
   // An old receipt may precede the first enriched action reply. Its server time
   // separates historical gains from awards earned after the game was opened.
   if(key&&remoteMode&&remoteSnapshot?.badges===undefined&&Number.isFinite(Date.parse(remoteSnapshot.serverTime))&&badgeMissingBaseline?.key!==key)badgeMissingBaseline={key,at:Date.parse(remoteSnapshot.serverTime)};
   return;
  }
  const known=readBadgeRegistry(key);
  if(known&&known.epoch>next.epoch){clearBadgeContext();return;}
  const baselineAfter=badgeMissingBaseline?.key===key?badgeMissingBaseline.at:null;
  const changed=key!==badgeRegistryKey||next.epoch!==badgeView?.epoch;
  if(changed){
   clearBadgeContext();badgeRegistryKey=key;badgeView=next;
   const stored=readBadgeRegistry(key);
   badgeRegistry=stored&&stored.epoch===next.epoch?{version:1,epoch:next.epoch,seen:[...stored.seen],pending:[...stored.pending]}:{version:1,epoch:next.epoch,seen:[],pending:[]};
   // A first visit shows the collection quietly. Existing accounts resume unseen gains.
   if(!stored)badgeRegistry.seen=next.items.filter(item=>item.award&&(baselineAfter===null||item.award.source==='imported'||Date.parse(item.award.at)<baselineAfter)).map(item=>item.award.id);
  }else badgeView=next;
  badgeMissingBaseline=null;
  mergeBadgeRegistry(readBadgeRegistry(key));
  const seen=new Set(badgeRegistry.seen),pending=new Set(badgeRegistry.pending);
  for(const item of next.items){const award=item.award;if(!award)continue;if(award.source==='imported'){seen.add(award.id);pending.delete(award.id);}else if(!seen.has(award.id))pending.add(award.id);}
  badgeRegistry.seen=[...seen];badgeRegistry.pending=[...pending].filter(id=>!seen.has(id));saveBadgeRegistry();
  updateBadgeCollection();
 }
 function badgeCanPresent(){return !!badgeView&&welcomeDismissed&&(!remoteMode||remoteReady&&remote?.authenticated)&&!authBusy&&!charge&&!busy&&!operationBusy&&!pendingChecks.size&&!document.hidden&&!presentationHidden&&sheet.hidden;}
 function updateBadgeNotice(){
  if(!badgeNotice||!badgeRegistry)return;
  const known=readBadgeRegistry(badgeRegistryKey);if(known&&known.epoch>badgeRegistry.epoch){clearBadgeContext();return;}
  if(!badgeCanPresent()){stopBadgeTimer();stopBadgeNoticeAnimation();badgeNotice.hidden=true;return;}
  let entered=false;
  if(!badgeActive){
   mergeBadgeRegistry(readBadgeRegistry(badgeRegistryKey));
   const pending=new Set(badgeRegistry.pending),seen=new Set(badgeRegistry.seen);
   const next=recentBadges().reverse().find(badge=>pending.has(badge.award.id)&&!seen.has(badge.award.id)&&badge.award.source!=='imported');
   if(!next){badgeNotice.hidden=true;return;}
   badgeActive={id:next.id,awardId:next.award.id,remaining:8000};badgeHover=false;badgeFocus=false;
   badgeRegistry.seen.push(next.award.id);badgeRegistry.pending=badgeRegistry.pending.filter(id=>id!==next.award.id);saveBadgeRegistry();
   badgeNotice.innerHTML=badgeMedallion(next,'notice')+'<div class="oa-badge-notice-copy"><p>Badge débloqué · '+badgeScopeLabel(next)+'</p><h2>'+h(next.title)+'</h2><button type="button" class="oa-text-button cursor-interaction" data-action="badge-view" data-badge="'+h(next.id)+'">Voir le badge <span aria-hidden="true">↗</span></button></div><button type="button" class="oa-badge-notice-close cursor-interaction" data-action="badge-dismiss" aria-label="Fermer la notification du badge">×</button>';
   badgeNotice.dataset.award=next.award.id;
   if(badgeAnnouncement)badgeAnnouncement.textContent='Badge débloqué : '+next.title+'. '+badgeScopeLabel(next)+'.';
   entered=true;
  }
  badgeNotice.hidden=false;
  if(entered)animateBadgeNotice();
  if(!badgeTimer&&!badgeHover&&!badgeFocus){badgeTimerStarted=chargeNow();badgeTimer=setTimeout(()=>{badgeTimer=null;dismissBadgeNotice();},Math.max(1,badgeActive.remaining));}
 }
 function dismissBadgeNotice(resume=true){
  const focused=badgeNotice?.contains(document.activeElement);
  stopBadgeTimer();stopBadgeNoticeAnimation();badgeActive=null;badgeHover=false;badgeFocus=false;if(badgeNotice){badgeNotice.hidden=true;badgeNotice.innerHTML='';delete badgeNotice.dataset.award;}if(badgeAnnouncement)badgeAnnouncement.textContent='';
  if(resume){if(focused){const target=badgeReturnFocus?.isConnected&&!badgeReturnFocus.disabled?badgeReturnFocus:main;if(target===main)main.setAttribute('tabindex','-1');target.focus({preventScroll:true});}badgeReturnFocus=null;updateBadgeNotice();}
 }
 badgeNotice?.addEventListener('mouseenter',()=>{badgeHover=true;stopBadgeTimer();});
 badgeNotice?.addEventListener('mouseleave',()=>{badgeHover=false;updateBadgeNotice();});
 badgeNotice?.addEventListener('focusin',event=>{if(!badgeNotice.contains(event.relatedTarget))badgeReturnFocus=event.relatedTarget;badgeFocus=true;stopBadgeTimer();});
 badgeNotice?.addEventListener('focusout',event=>{if(!badgeNotice.contains(event.relatedTarget)){badgeFocus=false;updateBadgeNotice();}});
 function renderWelcome(){
  return '<section class="oa-welcome" aria-labelledby="oa-welcome-title"><img class="oa-welcome-icon" src="./icons/desir-192.png" width="76" height="76" alt=""><div class="oa-welcome-copy"><h1 id="oa-welcome-title">Les dés choisissent une idée à deux.</h1><p>Propose-la, ou relance-la d’un geste.</p><p>Deux coches dans les 24 h, un point pour vous.</p></div><div class="oa-actions">'+btn('C’est parti <span class="oa-arrow" aria-hidden="true">↗</span>','welcome-start')+'</div></section>';
 }
 function renderLogin(){
  if(authBusy)return heading('Votre<br><em>espace.</em>',null,null)+'<div class="oa-login-wait" role="status">Connexion…</div>';
  if(remote?.connection&&remote.authenticated)return heading('Votre<br><em>espace.</em>',null,null)+'<div class="oa-login"><p class="oa-subtitle">Ton accès est conservé sur cet appareil.</p><p class="oa-form-error" data-login-error role="status">'+h(loginError||remote.status.message||'La connexion au duo est momentanément indisponible.')+'</p><div class="oa-actions">'+btn('Réessayer <span class="oa-arrow" aria-hidden="true">↗</span>','reconnect')+'</div></div>';
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

 function privateHome(incoming=false){
  const r=state.round;
  return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+(incoming?'<button type="button" class="oa-invitation cursor-interaction" data-action="open-invitation" data-round="'+h(r.id)+'"><span class="oa-invitation-dot" aria-hidden="true"></span><span><b>'+'Une invitation t’attend'+'</b><small>'+h(name(r.awaiting===r.from?r.to:r.from))+'</small></span><span class="oa-invitation-arrow" aria-hidden="true">↗</span></button>':'<div class="oa-quiet-home"><span aria-hidden="true">〰</span><p>Aucune invitation.</p></div>')+((state.tasks||[]).length?'<div class="oa-actions">'+btn('À faire · '+state.tasks.length,'tab','oa-secondary','data-tab="tasks"')+'</div>':'');
 }
 function renderPlay(){const r=state.round,c=card();
  if(!canSeeCurrentRound())return privateHome();
  if(cardReveal){const reveal=cardReveal,sides=reveal.hand.length;return (reveal.reroll?heading('Le D'+sides+'<br><em>rejoue.</em>',null,null):cardHeading(reveal)+steps(2,sides,reveal.hasVariant,reveal.catalogueVersion))+stage(sides,reveal.reroll?'02 / UNE AUTRE CARTE':'02 / LA CARTE',reveal.face,'card')+'<p class="oa-roll-status'+(reveal.reroll?'':' is-first-reveal')+'" data-reveal-mode="'+(reveal.reroll?'reroll':'card')+'" aria-hidden="true">Carte choisie.</p>'+handGrid({hand:reveal.hand,catalogueVersion:reveal.catalogueVersion,intimacyPool:reveal.intimacyPool,discarded:reveal.discarded,selected:{slot:reveal.face,cardId:reveal.cardId}});}
  if(state.phase==='category')return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+steps(1,G.rules.cardSides,false)+stage(G.rules.categorySides,'01 / LE THÈME',3,'category')+categoryAction()+'<div class="oa-section-head"><h2>Quatre façons de se retrouver</h2><span>'+G.rules.cardSides+' cartes par main</span></div>'+categoriesGrid();
  if(state.phase==='card'){
   const sides=G.cardSides(state);
   return cardHeading(r)+steps(2,sides,G.needsVariant(r),r.catalogueVersion??1)+stage(sides,'02 / LA CARTE',1,'card')+btn('Lancer le D'+sides+' <span class="oa-arrow" aria-hidden="true">↗</span>','roll')+(canRerollCategoryNow()?'<div class="oa-actions">'+textBtn('Relancer le thème · 1×/jour','reroll-category')+'</div>':'')+handGrid();
  }
  if(state.phase==='variant')return heading(h(c.title),null,null)+steps(3,G.cardSides(r),true,r.catalogueVersion??1)+stage(G.rules.variantSides,'03 / LA VARIANTE',3,'variant')+btn('Tirer la variante <span class="oa-arrow" aria-hidden="true">↗</span>','roll');
  if(state.phase==='draft'&&rerolling)return heading('Le D'+G.cardSides(state)+'<br><em>rejoue.</em>',null,null)+stage(G.cardSides(state),'02 / UNE AUTRE CARTE',r.cardRoll,'card')+'<p class="oa-roll-status" data-roll-status role="status" aria-busy="true">Tirage…</p>'+handGrid({discarded:{cardId:r.cardId,slot:r.cardRoll}});
  if(state.phase==='draft')return heading(canDraw()?'Ta prochaine<br><em>idée à deux.</em>':'Une carte<br><em>à proposer.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+(canDraw()?'<div class="oa-actions">'+btn('Proposer à '+h(name(r.to))+' <span class="oa-arrow">↗</span>','send')+(G.canRerollCard(state)?textBtn('Relancer la carte','reroll'):'')+'</div>':'<div class="oa-actions">'+switchButton(r.from)+'</div>');
  if(state.phase==='pending')return heading('Une ancienne<br><em>proposition.</em>','Actualise Dés·ir pour retrouver votre liste.',null);
  if(state.phase==='accepted')return heading('C’est dans<br><em>votre liste.</em>',null,null)+'<div class="oa-summary-card"><div><h2>'+h(c.title)+'</h2><p>'+h(proposalDetail(r)||category().label)+'</p></div></div><div class="oa-actions">'+btn('Voir les choses à faire','tab','','data-tab="tasks"')+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new','oa-secondary')+'</div>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed',expired=r.status==='expired';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Carte écartée.':expired?'Temps écoulé.':'Une autre<br><em>fois, peut-être.</em>',completed?'+1 point pour votre duo.':null,null)+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(category().label)+(r.adapted?' · Variante':'')+'</p></div>'+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
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
 const checkBox='<span class="oa-check-box" aria-hidden="true"><span class="oa-check-water"><svg viewBox="0 0 96 48" preserveAspectRatio="none"><path d="M0 8Q12 0 24 8T48 8T72 8T96 8V48H0Z"/><path d="M0 12Q12 20 24 12T48 12T72 12T96 12V48H0Z"/></svg></span><svg class="oa-check-mark" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span>';
 function taskCheck(task,player){const checked=task.checks[player],own=player===state.activePlayer,enabled=own&&!pendingChecks.has(task.id);return '<label class="oa-task-check '+(!own?'is-other':'')+'"><input type="checkbox" data-task-check="'+h(task.id)+'" data-player="'+player+'" aria-label="'+h(name(player)+' · '+G.getCard(task.cardId).title)+'" '+(checked?'checked ':'')+(!enabled?'disabled':'')+'>'+checkBox+'<span>'+h(name(player))+'</span></label>';}
 function renderTasks(){
  const tasks=state.tasks||[];
  if(refusal)return heading('Un D20<br><em>pour le refus.</em>',h(refusal.title),null)+stage(20,'D20 DU REFUS',refusal.face||1,'refusal')+'<p class="oa-roll-status" data-refusal-status role="status">'+(refusal.face?'Le dé roule…':'Confirmation du refus…')+'</p>';
  return heading('Les choses<br><em>à faire.</em>',null,null)+(tasks.length?'<div class="oa-task-list">'+tasks.map(task=>{const c=G.getCard(task.cardId),cat=G.getCategory(task.categoryId,roundVersion(task)),detail=G.getVariant(task)||task.proposal;return '<article class="oa-task" data-task="'+h(task.id)+'" style="--category:'+cat.color+'"><div class="oa-task-top"><span>'+h(categoryLabel(task))+'</span><time datetime="'+h(task.expiresAt)+'" aria-label="Temps restant : '+timeLeft(task)+'">'+timeLeft(task)+'</time></div><h2>'+h(c.title)+'</h2>'+(detail?'<p class="oa-task-proposal">'+h(detail)+'</p>':'')+'<p class="oa-task-status">'+h(taskStatus(task))+'</p><div class="oa-task-checks">'+taskCheck(task,'a')+taskCheck(task,'b')+'</div>'+(task.to===viewPlayer?'<div class="oa-task-actions">'+textBtn('Refuser · D20','refuse-task','data-task="'+h(task.id)+'"')+'</div>':'')+'</article>';}).join('')+'</div>':'<div class="oa-task-empty"><span aria-hidden="true">〰</span><p>Rien en attente.</p></div>')+'<div class="oa-actions">'+(state.phase==='accepted'?btn('Un nouveau tour <span class="oa-arrow">↗</span>','new'):textBtn('Revenir au jeu','tab','data-tab="play"'))+'</div>';
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
  return '<section class="oa-shared-score" aria-label="Score commun"><h1 class="oa-eyebrow">VOTRE SCORE À DEUX</h1><div class="oa-score-number"><strong>'+total.toLocaleString('fr-FR')+'</strong><span>point'+(total>1?'s':'')+'</span></div><p class="oa-score-caption">'+(total?'Des moments vécus, à votre rythme.':'Votre première carte partagée ouvre le score.')+'</p><div class="oa-score-rule"><span aria-hidden="true">✓</span> 1 carte partagée = 1 point</div></section>'+sharedGrade(total);
 }
 function notificationSetting(){
  const n=remote.notificationStatus;
  return '<section class="oa-notification-setting"><div class="oa-section-head"><h2>Les notifications</h2></div>'+(n.subscribed?'<p class="oa-note">Activées sur cet appareil.</p>':n.supported&&n.permission!=='denied'?btn('Activer les notifications','enable-notifications','oa-secondary'):'')+(n.message?'<p class="oa-note">'+h(n.message)+'</p>':'')+'</section>';
 }
 function renderUs(){return sharedScore()+badgesSection();}

 function infoSettings(){
  if(remoteMode)notificationSignature=JSON.stringify(remote.notificationStatus);
  return '<section class="oa-info-card oa-info-settings" id="oa-info-settings" aria-labelledby="oa-info-settings-title"><p class="oa-info-kicker">Sur cet appareil</p><h2 id="oa-info-settings-title">Réglages</h2>'+setting('sound','Son des dés','Un contact feutré à chaque lancer.')+(remoteMode?notificationSetting():'<p class="oa-note">Démo locale · '+(persisted?'partie conservée sur cet appareil.':'partie non sauvegardée.')+(recovery?' Ancienne sauvegarde conservée pour récupération.':'')+'</p><div class="oa-actions">'+textBtn('Effacer la partie de démonstration','reset-confirm')+'</div>')+'</section>';
 }
 function infoActivity(){
  const activity=remoteMode?remoteSnapshot?.activity:G.activityCalendar(localRoom,viewPlayer);
  const metric=id=>badgeView?.items.find(item=>item.id===id)?.progress.value;
  const streak=activity?G.activeStreak(activity,new Date(serverNow()).toISOString()):metric('ind-active-streak-3');
  const metrics=[
   ['ind-draws-1','Tirages de thème'],
   ['ind-proposals-1','Propositions envoyées']
  ];
  const metricCards=metrics.map(([id,label])=>'<div><strong>'+(metric(id)?.toLocaleString('fr-FR')??'—')+'</strong><span>'+label+'</span></div>').join('');
  const streakLabel=activity||streak===undefined?'Série en cours':'Record';
  const flame='<svg viewBox="0 0 20 22" aria-hidden="true"><path d="M11 1.8c.8 4-3.8 5.8-3 9.1.9-.2 1.7-.9 2.2-2 2.6 1.2 4.2 3.1 4.2 5.6a4.4 4.4 0 0 1-8.8.4c-1.1 1.1-1.1 2.2-.7 3.3a7.6 7.6 0 0 1-2-5.1c0-4.9 6.2-7.1 8.1-11.3Z"/></svg>';
  const own=ownState||state;
  const draws=new Map();
  for(const round of [own.round,...own.tasks,...own.history]){
   const drawn=round.from===viewPlayer&&G.getCard(round.cardId);
   if(drawn&&!draws.has(round.id))draws.set(round.id,{round,drawn});
  }
  const time=round=>Date.parse(round.createdAt||round.sentAt||round.endedAt)||0;
  const recent=[...draws.values()].sort((a,b)=>time(b.round)-time(a.round)).slice(0,3);
  return `<section class="oa-info-card oa-info-activity" id="oa-info-activity" aria-labelledby="oa-info-activity-title">
   <p class="oa-info-kicker">Dés·ir · Mon activité</p>
   <h2 id="oa-info-activity-title">Au fil des tirages.</h2>
   <div class="oa-info-activity-metrics">
    <div class="oa-info-streak"><strong>${flame}<b class="oa-info-streak-count">${streak?.toLocaleString('fr-FR')??'—'}</b>${streak===undefined?'':'<small>jour'+(streak>1?'s':'')+'</small>'}</strong><span>${streakLabel}</span></div>
    ${metricCards}
   </div>
   ${recent.length?'<h3>Mes dernières cartes tirées</h3><ul class="oa-info-recent">'+recent.map(({round,drawn})=>{
    const theme=G.getCategory(round.categoryId,roundVersion(round));
    return '<li style="--category:'+h(theme?.color||'var(--oa-sage)')+'"><span>'+h(drawn.title)+'</span><small>'+h(theme?.label||'')+'</small></li>';
   }).join('')+'</ul>':''}
  </section>`;
 }
 function infoShared(){
  return `<section class="oa-info-card oa-info-shared" aria-labelledby="oa-info-shared-title">
   <h2 id="oa-info-shared-title">Vos cartes partagées.</h2>
   <div class="oa-score-grid">${G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+G.categoryScore(state.stats,c.id).toLocaleString('fr-FR')+'</strong></div>').join('')}</div>
  </section>`;
 }

 function infoTickets(){
  const remaining=remoteSnapshot?.quota?.remaining;
  const dots=Array.from({length:3},(_,index)=>'<i'+(index<remaining?' class="is-available"':'')+'></i>').join('');
  const quotaLabel=remaining==null?(remoteMode?'Quota indisponible':'Démo sans quota'):remaining+' tirage'+(remaining===1?' disponible':'s disponibles');
  return `<section class="oa-info-card oa-info-ticket-card" aria-labelledby="oa-info-tickets">
   <div class="oa-info-ticket-head">
    <h2 id="oa-info-tickets">Tirages du jour</h2>
    <span class="oa-info-ticket-dots" role="img" aria-label="${quotaLabel}" title="${quotaLabel}">${dots}</span>
   </div>
   <p>1 relance de thème gratuite par jour.</p>
  </section>`;
 }

 const infoIdeas=G.categories.flatMap(({id,label,color})=>(window.DesirInfoQuestions?.[id]||[]).map(text=>({label,color,text})));
 let infoDeck=[],infoIdea=null;
 function infoIdeaMarkup(){
  return infoIdea?`<span class="oa-info-idea-theme" style="--category:${h(infoIdea.color)}">${h(infoIdea.label)}</span><p>${h(infoIdea.text)}</p>`:'';
 }
 function renderInfo(){
  const libido=key=>document.getElementById('oa-libido-'+key)?.innerHTML||'';
  return `<article class="oa-info" aria-labelledby="oa-info-title">
   <div class="oa-info-progress" aria-hidden="true"><i></i></div>
   <h1 class="oa-sr" id="oa-info-title">Info</h1>
   <div class="oa-info-cards">
    <section class="oa-info-card oa-info-lab" aria-labelledby="oa-info-idea">
     <div class="oa-info-idea-head">
      <h2 id="oa-info-idea">Une idée <em>à deux.</em></h2>
      ${btn('Piocher <span class="oa-arrow" aria-hidden="true">↗</span>','info-idea','','aria-label="Piocher une question"')}
     </div>
     <div class="oa-info-idea-output" aria-live="polite" aria-atomic="true">${infoIdeaMarkup()}</div>
    </section>
    <div data-info-activity>${infoActivity()}</div>
    <div data-info-tickets>${infoTickets()}</div>
    <div data-info-shared>${infoShared()}</div>
    <section class="oa-info-card oa-info-agreement" aria-labelledby="oa-info-agreement">
     <p class="oa-info-kicker">Le principe du jeu</p>
     <div class="oa-info-agreement-head">
      <h2 id="oa-info-agreement">Il faut <em>deux oui.</em></h2>
      <span class="oa-info-checks" aria-hidden="true">${checkBox}${checkBox}</span>
     </div>
     <p class="oa-info-agreement-lead">Un défi envoyé reste une proposition. Chacun peut dire non.</p>
     <div class="oa-info-agreement-score">
      <p>Deux coches avant l’expiration du défi (<strong>${G.rules.taskLifetimeMs/3600000} h</strong>).</p>
      <strong>+${G.rules.completedCardPoints} point</strong>
     </div>
    </section>
    ${libido('women')}
    ${libido('places')}
    ${libido('benchmarks')}
    ${libido('destinations')}
    ${libido('rough')}
    <div data-info-settings>${infoSettings()}</div>
   </div>
   <details class="oa-info-install">
    <summary>Retrouver Dés·ir sur l’écran d’accueil</summary>
    <p>Sur iPhone, ouvre le jeu dans Safari, touche Partager, puis Sur l’écran d’accueil. Ouvre ensuite l’app pour activer les notifications depuis <strong>Info → Réglages</strong>.</p>
   </details>
  </article>`;
 }
 function mountInfo(){
  const panel=main.querySelector('.oa-info');
  if(!panel)return;
  const progress=panel.querySelector('.oa-info-progress i');
  const updateProgress=()=>{
   const distance=main.scrollHeight-main.clientHeight;
   const ratio=distance>0?Math.max(0,Math.min(1,main.scrollTop/distance)):1;
   progress.style.transform='scaleX('+ratio+')';
  };
  const frames=new Map();
  const observer=window.IntersectionObserver&&new IntersectionObserver(entries=>{
   entries.forEach(({target,isIntersecting})=>{
    if(!isIntersecting||systemReduce)return;
    observer.unobserve(target);
    target.classList.add('is-reading');target.dataset.infoVisited='';
    const counts=Array.from(target.querySelectorAll('[data-info-count]'),node=>{
     const final=node.textContent, value=node.dataset.infoCount||final;
     const digits=value.split('.')[1]?.length||0;
     const format=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
     return {node,final,value:Number(value),format};
    });
    if(!counts.length)return;
    const started=chargeNow(), duration=1350;
    const step=now=>{
     const ratio=Math.max(0,Math.min(1,(now-started)/duration));
     const eased=1-Math.pow(1-ratio,2);
     counts.forEach(({node,final,value,format})=>node.textContent=ratio===1?final:format.format(value*eased));
     if(ratio<1)frames.get(target).id=requestAnimationFrame(step);
     else frames.delete(target);
    };
    counts.forEach(({node,format})=>node.textContent=format.format(0));
    frames.set(target,{id:requestAnimationFrame(step),counts});
   });
  },{root:main,threshold:.18});
  const stopCounts=()=>{
   frames.forEach(({id,counts})=>{
    cancelAnimationFrame(id);
    counts.forEach(({node,final})=>node.textContent=final);
   });
   frames.clear();
  };
  const updateMotion=()=>{
   observer?.disconnect();
   if(systemReduce)stopCounts();
   else panel.querySelectorAll('.oa-info-card:not([data-info-visited])').forEach(card=>observer?.observe(card));
  };
  const widgets=[
   ['[data-info-activity]',infoActivity],
   ['[data-info-shared]',infoShared],
   ['[data-info-tickets]',infoTickets],
   ['[data-info-settings]',infoSettings]
  ].map(([selector,render])=>({node:panel.querySelector(selector),render,markup:render()}));
  const refresh=()=>{
   for(const widget of widgets){
    const markup=widget.render();
    if(markup===widget.markup)continue;
    const focused=widget.node.contains(document.activeElement)?document.activeElement:null;
    const previous=widget.node.firstElementChild;
    observer?.unobserve(previous);
    widget.node.innerHTML=markup;widget.markup=markup;
    const card=widget.node.firstElementChild;
    if(previous.hasAttribute('data-info-visited'))card.dataset.infoVisited='';
    else if(!systemReduce)observer?.observe(card);
    if(focused){
     const control=focused.dataset.pref&&widget.node.querySelector('[data-pref="sound"]');
     const replacement=control||widget.node.querySelector('h2');
     if(!control)replacement.setAttribute('tabindex','-1');
     replacement.focus({preventScroll:true});
    }
   }
  };
  const resize=window.ResizeObserver&&new ResizeObserver(updateProgress);
  resize?.observe(panel);
  resize?.observe(main);
  main.addEventListener('scroll',updateProgress,{passive:true});
  window.addEventListener('resize',updateProgress);
  panel.addEventListener('toggle',updateProgress,true);
  updateProgress();
  updateMotion();
  return {refresh,updateMotion,dispose(){
   observer?.disconnect();resize?.disconnect();stopCounts();
   main.removeEventListener('scroll',updateProgress);
   window.removeEventListener('resize',updateProgress);
   panel.removeEventListener('toggle',updateProgress,true);
  }};
 }
 function showInfoIdea(){
  if(!infoIdeas.length)return;
  if(!infoDeck.length)infoDeck=infoIdeas.slice();
  const previous=infoDeck.indexOf(infoIdea);
  const choice=Math.floor(Math.random()*(infoDeck.length-(previous<0?0:1)));
  const index=previous>=0&&choice>=previous?choice+1:choice;
  [infoIdea]=infoDeck.splice(index,1);
  const output=main.querySelector('.oa-info-idea-output');
  output.innerHTML=infoIdeaMarkup();
  if(!systemReduce)playContentTransition(output,[{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'none'}],320);
 }

 function scheduleExpiry(){
  clearTimeout(taskExpiryTimer);if(!state.tasks.length||remoteMode&&!remoteReady)return;
  const until=Math.min(...state.tasks.map(task=>Date.parse(task.expiresAt)))-serverNow();
  const delay=remoteMode&&until<=0?10000:Math.max(0,until);
  taskExpiryTimer=setTimeout(async()=>{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed&&!busy&&!operationBusy&&!pendingChecks.size)render();else scheduleExpiry();},delay);
 }
 function visibleViewKey(){
  if(!welcomeDismissed)return 'welcome';if(remoteMode&&!remoteReady)return 'login';
  if(cardReveal)return cardReveal.viewKey;
  if(refusal)return 'tasks|refusal|'+refusal.taskId+'|'+viewPlayer;
  if(tab==='info')return 'info';
  if(tab!=='play')return tab+'|'+viewPlayer;
  if(!canSeeCurrentRound())return 'play|private-home|'+viewPlayer;
  const inbox=['pending'].includes(state.phase)&&G.canRespond(state)&&openedInvitation!==invitationKey();
  return ['play',inbox?'inbox':rerolling?'reroll':state.phase,state.round.id,state.round.cardId,state.round.rolls.length,state.round.draftRolls.length,viewPlayer,state.joker?state.joker.weekKey+':'+(state.joker.usedBy||''):'' ].join('|');
 }
 function centerStage(){
  const holder=main.querySelector('[data-stage]');if(!holder)return;
  if(/^(auto|scroll)$/.test(window.getComputedStyle?.(main).overflowY||'')){
   const box=holder.getBoundingClientRect(),area=main.getBoundingClientRect();
   main.scrollTo({top:Math.max(0,main.scrollTop+box.top-area.top-(main.clientHeight-box.height)/2),behavior:systemReduce?'instant':'smooth'});
  }else holder.scrollIntoView({block:'center',behavior:systemReduce?'instant':'smooth'});
 }
 function finishRevealWait(){if(!revealWait)return;const wait=revealWait;revealWait=null;clearTimeout(wait.timer);wait.resolve();}
 function waitForReveal(duration=900){return new Promise(resolve=>{const wait={resolve,timer:null};revealWait=wait;wait.timer=setTimeout(()=>{if(revealWait===wait){revealWait=null;resolve();}},duration);});}
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
  playContentTransition(main.querySelector('h1'),[{opacity:.35},{opacity:1}],220);
  return true;
 }
 function render(transition=null){
  if(!remoteMode){const fresh=G.reduceRoom(localRoom,{type:'EXPIRE_TASKS',at:now(),actor:viewPlayer});if(fresh!==localRoom){localRoom=fresh;syncLocalView();save();}}
  trackGrade();trackBadges();
  // Connection updates may restore the game behind this screen, never replace it.
  if(!welcomeDismissed&&renderKey==='welcome'){renderPersona();scheduleExpiry();updateBadgeNotice();return;}
  const focused=document.activeElement;
  const focusData=focused&&main.contains(focused)?{...focused.dataset}:null;
  const scrollTop=main.scrollTop,scrollLeft=main.scrollLeft;
  const previousKey=renderKey;
  renderPersona();
  const key=visibleViewKey();
  const markup=!welcomeDismissed?renderWelcome():remoteMode&&!remoteReady?renderLogin():tab==='play'?renderPlay():tab==='tasks'?renderTasks():tab==='info'?(infoReading?renderedMarkup:renderInfo()):renderUs();
  const replaceMain=key!==renderKey||markup!==renderedMarkup;
  const animate=key!==renderKey;renderKey=key;
  if(replaceMain){infoReading?.dispose();infoReading=null;cancelContentTransitions();clearCharge(true,false);const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);main.innerHTML=markup;renderedMarkup=markup;}
  root.classList.toggle('oa-entering',animate&&!systemReduce&&!document.hidden&&!presentationHidden);
  root.style.setProperty('--oa-accent',(welcomeDismissed&&canSeeCurrentRound()?category():null)?.color||G.categories[1].color);
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!awaitingPlayer(el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const invitationDot=root.querySelector('.oa-incoming-dot');if(invitationDot)invitationDot.hidden=!awaitingPlayer(viewPlayer);
  const count=root.querySelector('.oa-task-count');if(count){count.textContent=String((state.tasks||[]).length);count.hidden=!(state.tasks||[]).length;}
  if(!replaceMain){infoReading?.refresh();scheduleExpiry();scheduleAutoNewRound();updateBadgeNotice();return;}
  const holder=main.querySelector('[data-stage]');
  if(holder){holder.prepend(canvas);die.setKind(Number(holder.dataset.kind),Number(holder.dataset.value));die.setColor?.(holder.dataset.rollRole==='category'?null:refusal?.color||category()?.color);die.setReducedMotion(systemReduce);if(animate&&!transition&&!document.hidden&&!presentationHidden)die.breathe?.();}
  else die.pauseMotion?.();
  root.classList.toggle('is-busy',busy||operationBusy);
  animateGauge();
  if(animate&&!systemReduce&&!document.hidden&&!presentationHidden&&main.animate&&!transition){
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-subtitle,:scope > .oa-steps,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score');
   blocks.forEach((el,i)=>{const pinned=window.getComputedStyle?.(el)?.position==='sticky';el.animate(pinned?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,delay:Math.min(i*28,100),easing:'cubic-bezier(.18,.8,.2,1)',fill:'backwards'});});
   main.querySelectorAll('.oa-category').forEach((el,i)=>el.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:440,delay:90+i*30,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
  }
  animateGrade();
  if(!cardReveal)visibleCardId=state.round.cardId;
  scheduleExpiry();
  if(focusData&&previousKey===renderKey){
   const keys=['action','pref','taskCheck','player','card','tab','task','badge'];let same;
   if(keys.some(k=>focusData[k]))same=Array.from(main.querySelectorAll('button,input')).find(el=>keys.every(k=>(el.dataset[k]||'')===(focusData[k]||'')));
   if(same)same.focus({preventScroll:true});else{const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
  }
  else if(previousKey&&previousKey!==renderKey){const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
  main.scrollTop=previousKey===key?scrollTop:0;main.scrollLeft=previousKey===key?scrollLeft:0;
  if(tab==='info')infoReading=mountInfo();
  if(transition)animateDiceHandoff(transition);
  scheduleAutoNewRound();
  updateBadgeNotice();
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
  if(active){controlsBusyState=controlsBusyState||new Map();root.querySelectorAll('button,input').forEach(el=>{if(el.dataset.action==='badge-dismiss'||el.dataset.action==='close'&&!sheet.hidden)return;if(!controlsBusyState.has(el))controlsBusyState.set(el,el.disabled);el.disabled=true;});}
  else if(controlsBusyState){for(const [el,disabled] of controlsBusyState)if(el.isConnected)el.disabled=disabled;controlsBusyState=null;}
  updateBadgeNotice();
 }
 function scheduleAutoNewRound(){
  if(autoNewRoundTimer){clearTimeout(autoNewRoundTimer);autoNewRoundTimer=null;}
  if(tab!=='play'||state.phase!=='resolved'||busy||operationBusy||!welcomeDismissed||state.round.from!==viewPlayer)return;
  if(remoteMode&&!remoteReady)return;
  const roundId=state.round.id;
  if(autoNewRoundId===roundId)return;
  autoNewRoundId=roundId;
  autoNewRoundTimer=setTimeout(()=>{autoNewRoundTimer=null;if(state.round.id===roundId&&state.phase==='resolved'&&state.round.from===viewPlayer)void dispatch({type:'NEW_ROUND'});},4000);
 }
 async function rerollCategory(){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  if(!canRerollCategoryNow())return;
  const roundId=state.round.id,action={type:'REROLL_CATEGORY',catalogueVersion:3,roundId};
  if(!remoteMode){
   action.at=now();action.value=G.rollCategory(3,G.randomInt,action.at);
   Object.assign(action,G.drawCategory(state,action.value,3,G.randomInt));
  }
  busy=true;setControlsBusy(true);
  try{const changed=await dispatch(action);if(changed){announce('Catégorie relancée.');toast('Thème relancé · 1× aujourd’hui.');}}
  finally{busy=false;setControlsBusy(false);render();}
 }
 async function roll(reroll=false,power=0){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  const expectedPhase=state.phase,expectedRound=state.round.id;if(!remoteMode){pullShared();if(state.phase!==expectedPhase||state.round.id!==expectedRound){render();return;}}
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  const context={actor,roundId,roomId:remote?.connection?.roomId,epoch:presentationEpoch,categoryId:state.round.categoryId,catalogueVersion:state.round.catalogueVersion??1,intimacyPool:state.round.intimacyPool,hasVariant:G.needsVariant(state.round),hand:[...state.round.hand],discarded:reroll?{cardId:state.round.cardId,slot:state.round.cardRoll}:null};
  let sides,action,faceValue,next,resultLabel,settled=false;
  if(remoteMode&&phase==='category'&&remoteSnapshot?.quota?.remaining===0)return;
  if(reroll){if(!G.canRerollCard(state))return;sides=G.cardSides(state);action={type:'REROLL_CARD'};}
  else if(phase==='category'&&canDraw()){sides=G.rules.categorySides;action={type:'ROLL_CATEGORY',catalogueVersion:3};}
  else if(phase==='card'&&canDraw()){sides=G.cardSides(state);action={type:'ROLL_CARD'};}
  else if(phase==='variant'&&canDraw()){sides=G.rules.variantSides;action={type:'ROLL_VARIANT'};}
  else return;
  cancelContentTransitions();
  const serial=++animationSerial;busy=true;rerolling=reroll;if(rerolling)render();setControlsBusy(true);
  context.viewKey=renderKey;
  if(rerolling)centerStage();
  const button=main.querySelector('[data-action="roll"]')||main.querySelector('[data-roll-status]');if(button){renderedMarkup='';button.textContent='Tirage…';button.setAttribute('aria-busy','true');}
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
    action.at=now();faceValue=action.type==='ROLL_CATEGORY'?G.rollCategory(action.catalogueVersion,G.randomInt,action.at):
      faces?faces[G.randomInt(faces.length)-1]:G.randomInt(sides);
    action.value=faceValue;
    if(action.type==='ROLL_CATEGORY')Object.assign(action,G.drawCategory(state,faceValue,3,G.randomInt));
    const nextRoom=G.reduceRoom(localRoom,{...action,actor,roundId});if(nextRoom===localRoom)return;
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
      await waitForReveal(450);
     }
    }
    if(reroll&&!document.hidden&&!presentationHidden&&presentationValid(context))toast('Nouvelle carte.');
   }
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{if(serial===animationSerial){const targetPhase=action.type==='ROLL_CATEGORY'?'card':action.type==='ROLL_CARD'&&context.hasVariant?'variant':null;const fromStage=settled&&targetPhase&&presentationValid(context)&&!document.hidden&&!presentationHidden?main.querySelector('[data-stage]')?.getBoundingClientRect():null;activeRollFace=null;cardReveal=null;finishRevealWait();busy=false;rerolling=false;setControlsBusy(false);if(remoteMode&&!remote?.authenticated){deferredSnapshot=null;const wasReady=remoteReady;remoteReady=false;if(wasReady)render();}else{if(remoteMode)flushRemote(null,false);render(fromStage&&state.phase===targetPhase&&state.round.id===roundId&&state.round.from===actor?fromStage:null);}}}
 }
 async function refuseTask(taskId){
  const task=state.tasks.find(item=>item.id===taskId);
  if(!task||task.to!==viewPlayer||busy||operationBusy||pendingChecks.size||remoteMode&&!remoteReady)return;
  const context={actor:viewPlayer,roomId:remote?.connection?.roomId,epoch:presentationEpoch},roundId=(ownState||state).round.id;
  const serial=++animationSerial;
  refusal={taskId,title:G.getCard(task.cardId).title,color:G.getCategory(task.categoryId,roundVersion(task))?.color,face:null};
  tab='tasks';busy=true;render();setControlsBusy(true);
  try{
   let face;
   if(remoteMode){
    const value=await remote.action({type:'REFUSE_TASK',roundId,taskId});
    if(!value.roll||value.roll.kind!==20||value.state.tasks.some(item=>item.id===taskId))throw Error('Unconfirmed refusal');
    if(!presentationValid(context))return;
    face=value.roll.value;
    if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;
   }else{
    face=G.randomInt(20);pullShared();const next=G.reduceRoom(localRoom,{type:'REFUSE_TASK',roundId,taskId,value:face,actor:viewPlayer,at:now()});
    if(next===localRoom)return;localRoom=next;save();
   }
   if(!presentationValid(context))return;
   refusal.face=face;const status=main.querySelector('[data-refusal-status]');if(status)status.textContent='Le dé roule…';
   if(!document.hidden&&!presentationHidden){activeRollFace={kind:20,value:face};softSound();await die.roll(face,{duration:systemReduce?0:1650});activeRollFace=null;}else die.setKind(20,face);
   if(presentationValid(context))announce('D20 : '+face+'. Carte refusée, sans pénalité.');
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{if(serial===animationSerial){activeRollFace=null;refusal=null;busy=false;setControlsBusy(false);if(remoteMode){if(remote?.authenticated)flushRemote(null,false);else{remoteReady=false;deferredSnapshot=null;}}else syncLocalView();render();}}
 }
 function openSheet(title,body,extraClass=''){
  if(extraClass!=='oa-achievement-sheet'){badgeSheetOpen=false;badgeSheetMarkup='';badgeDetailId=null;badgeGalleryScroll=null;}
  lastFocus=document.activeElement;
  if(sheet.hidden)sheetContext={bodyOverflow:document.body.style.overflow,mainOverflow:main.style.overflow,top:main.scrollTop,left:main.scrollLeft,key:renderKey};
  sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div>'+body+'</section>';
  sheet.classList.toggle('oa-collection-open',extraClass==='oa-achievement-sheet');sheet.hidden=false;sheet.scrollTop=0;document.body.style.overflow='hidden';main.style.overflow='hidden';
  const shell=root.querySelector('.oa-shell');Array.from(shell.children).forEach(el=>{if(el!==sheet&&el.id!=='oa-announcement')el.inert=true;});
  const dialog=sheet.querySelector('.oa-sheet');if(dialog)dialog.scrollTop=0;updateBadgeNotice();sheet.querySelector('button')?.focus({preventScroll:true});
 }
 function closeSheet(){
  if(sheet.hidden)return;
  badgeSheetOpen=false;badgeSheetMarkup='';badgeDetailId=null;badgeGalleryScroll=null;sheet.hidden=true;sheet.classList.remove('oa-collection-open');document.body.style.overflow=sheetContext?.bodyOverflow||'';main.style.overflow=sheetContext?.mainOverflow||'';sheet.innerHTML='';
  Array.from(root.querySelector('.oa-shell').children).forEach(el=>el.inert=false);
  if(lastFocus&&!lastFocus.isConnected&&lastFocus.dataset.action==='badge-detail')lastFocus=badgeTileElement(main,lastFocus.dataset.badge);
  if(lastFocus&&lastFocus.isConnected&&!lastFocus.hidden&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});else{main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}
  if(sheetContext?.key===renderKey){main.scrollTop=sheetContext.top;main.scrollLeft=sheetContext.left;}lastFocus=null;sheetContext=null;updateBadgeNotice();
 }

 function rules(){openSheet('Les règles.','<div class="oa-rule"><b>D4</b><div><h3>La catégorie.</h3><p>Le D4 choisit l’une des quatre catégories.</p></div></div><div class="oa-rule"><b>D6</b><div><h3>La carte.</h3><p>Le D6 choisit une carte parmi six. Les cartes classiques ont ensuite une variante D6 ; les cartes Hardcore sont prêtes à proposer. En Intimité, le tirage choisit à parts égales une main classique ou Hardcore.</p></div></div><div class="oa-rule"><b>↻</b><div><h3>Une relance.</h3><p>Une fois par tour, la carte tirée peut être relancée avant d’être proposée.</p></div></div><div class="oa-rule"><b>✓</b><div><h3>Proposer ou refuser.</h3><p>Une proposition rejoint directement À faire. Son destinataire peut la refuser avec un D20 : tous les résultats écartent la carte, sans pénalité.</p></div></div><div class="oa-rule"><b>+1</b><div><h3>Les deux cases, un point.</h3><p>Les propositions restent vingt-quatre heures dans À faire. Elles quittent la liste après vos deux coches, ou à l’expiration.</p></div></div><div class="oa-actions">'+btn('Fermer','close')+'</div>');}

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
  if(action==='badge-dismiss'){dismissBadgeNotice();return;}
  if(charge)clearCharge();
  if(action==='welcome-start'){
   if(welcomeDismissed)return;welcomeDismissed=true;try{localStorage.setItem(welcomeKey,'1');}catch(_){}render();return;
  }
  if(!welcomeDismissed)return;
  if((busy||operationBusy)&&action!=='close')return;
  if(action==='reconnect'){
   if(authBusy||!remote?.authenticated)return;authBusy=true;loginError='';render();
   try{flushRemote(await remote.refresh(),false);}catch(error){loginError=error&&error.isDesirRemoteError?error.message:'La connexion est momentanément indisponible.';}
   finally{authBusy=false;render();}return;
  }
  if(remoteMode&&!remoteReady&&!['close'].includes(action))return;
  if(action==='badges-all'){openBadgeCollection();return;}
  if(action==='badge-detail'){openBadgeDetail(el.dataset.badge);return;}
  if(action==='badge-back'){backToBadgeCollection();return;}
  if(action==='badge-filter'){if(badgeSheetOpen&&!badgeDetailId&&['all','individual','shared'].includes(el.dataset.scope)){badgeFilter=el.dataset.scope;badgeHighlight=null;updateBadgeCollection();}return;}
  if(action==='badge-view'){const origin=badgeReturnFocus;dismissBadgeNotice(false);openBadgeCollection(el.dataset.badge);if(origin?.isConnected)lastFocus=origin;badgeReturnFocus=null;return;}
  if(action==='roll'){await roll();return;}
  if(action==='reroll'){await roll(true);return;}
  if(action==='joker'){const category=Number(el.dataset.category);if(!jokerAvailable()||!Number.isInteger(category)||category<1||category>4){render();return;}const act={type:'JOKER_DRAW',category,catalogueVersion:3,roundId:state.round.id};if(!remoteMode){act.at=now();act.value=category;Object.assign(act,G.drawCategory(state,category,3,G.randomInt));}const ok=await dispatch(act);if(ok)toast('Joker : thème '+((G.categories.find(c=>c.number===category)||{}).label||'choisi')+' !');render();return;}
  if(action==='reroll-category'){await rerollCategory();return;}
  if(action==='tab'){tab=['us','tasks','info'].includes(el.dataset.tab)?el.dataset.tab:'play';render();main.scrollTop=0;main.scrollLeft=0;return;}
  if(action==='info-idea'){showInfoIdea();return;}
  if(action==='profile'){if(remoteMode)return;if(tab==='us')tab='play';changeView(el.dataset.player);announce('Profil : '+name(viewPlayer));return;}
  if(action==='own-draw'){tab='play';selectedIncomingRoundId=null;openedInvitation=null;if(remoteMode)selectDisplayState();else syncLocalView();render();return;}
  if(action==='open-invitation'){if(isParallel()&&incomingStates.some(incoming=>incoming.round.id===el.dataset.round)){selectedIncomingRoundId=el.dataset.round;selectDisplayState();}if(remoteMode){try{flushRemote(await remote.refresh(),false);}catch(error){remoteError(error);}}else pullShared();if(el.dataset.round===state.round.id&&G.canRespond(state))openedInvitation=invitationKey();render();return;}
  if(action==='send'){const taskId=state.round.id,changed=await dispatch({type:'SEND'},false);const queued=(ownState?.tasks||state.tasks||[]).some(task=>task.id===taskId);if(queued)tab='tasks';render();if(changed&&queued)announce('Proposition ajoutée à À faire.');return;}
  if(action==='refuse-task'){await refuseTask(el.dataset.task);return;}
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
 function updateReducedMotion(event){systemReduce=event.matches;infoReading?.updateMotion();die.setReducedMotion(systemReduce);root.classList.remove('oa-entering');cancelContentTransitions();if(systemReduce)stopBadgeNoticeAnimation();(root.getAnimations?.({subtree:true})||[]).forEach(a=>a.cancel());}
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
 setInterval(async()=>{if(!document.hidden&&!busy&&!operationBusy&&!pendingChecks.size){if(remoteMode){if(remoteReady&&tab==='tasks')render();}else{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed||tab==='tasks'||tab==='info')render();}}},30000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearCharge();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();}if(!document.hidden&&!remoteMode){pullShared();if(!busy&&!operationBusy&&!pendingChecks.size)render();}updateBadgeNotice();});
 window.addEventListener('storage',event=>{if(!remoteMode&&event.key===storageKey&&receiveShared(event.newValue)&&!busy&&!operationBusy&&!pendingChecks.size)render();if(event.key===badgeRegistryKey){let value;try{value=JSON.parse(event.newValue);}catch(_){}mergeBadgeRegistry(value);updateBadgeNotice();}});
 sheet.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
 root.addEventListener('keydown',event=>{
  const button=rollButton(event.target);
  if(button&&(event.code==='Space'||event.key===' ')){event.preventDefault();if(!event.repeat)startCharge(button,'keyboard',event);return;}
  if(event.key==='Escape'&&charge){event.preventDefault();clearCharge();return;}
  if(event.key==='Enter'){clearCharge(false);suppressedClick=null;}
  if(event.key==='Escape'&&sheet.hidden&&badgeActive&&badgeNotice?.contains(document.activeElement)){event.preventDefault();dismissBadgeNotice();return;}
  if(sheet.hidden)return;if(event.key==='Escape'){closeSheet();return;}if(event.key==='Tab'){const focusable=Array.from(sheet.querySelectorAll('button,a,input,select,textarea,summary')).filter(x=>!x.disabled);if(!focusable.length){event.preventDefault();return;}const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 });
 render();
 if(remoteMode){
  if(!remote?.enabled){authBusy=false;loginError='La connexion à votre espace n’est pas encore disponible.';render();}
  else{
   remote.subscribeToChanges(event=>{
    if(remote.connection&&!remote.authenticated){
     clearBadgeContext();
     // A reconnect owns its pending screen. Background status must not reset it.
     if(authBusy)return;
     const wasReady=remoteReady;if(wasReady)presentationEpoch++;remoteReady=false;deferredSnapshot=null;cardReveal=null;refusal=null;finishRevealWait();announce('');updateLoginError(event.status.message);if(wasReady||main.querySelector('[data-action="reconnect"]'))render();return;
    }
    if(event.snapshot)receiveRemote(event.snapshot);
    else if(!authBusy&&!remoteReady&&event.status.message)updateLoginError(event.status.message);
    if(remoteReady&&tab==='info'&&!busy&&!operationBusy&&!pendingChecks.size&&notificationSignature!==JSON.stringify(remote.notificationStatus))render();
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
