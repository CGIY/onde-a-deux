(function(){
 'use strict';
 const root=document.getElementById('onde-app-v1');
 if(!root || !window.OndeGame || !window.OndeDice)return;
 const G=window.OndeGame, main=root.querySelector('#oa-main'), sheet=root.querySelector('#oa-sheet');
 const cardNotes=Object.freeze(Object.assign({},window.DesirCardNotes||{}));
 const storageKey='onde-couple-prototype-v1';
 const remote=window.OndeRemote&&window.OndeRemote.create(window.DesirConfig||{});
 const remoteMode=!!(window.DesirConfig&&window.DesirConfig.endpoint);
 const persona=root.querySelector('.oa-persona'),navigation=root.querySelector('.oa-nav');
 const remoteMembers=remoteMode?Array.from(persona.querySelectorAll('[data-member]'),member=>({
  member,label:member.querySelector('.oa-person-name'),initials:member.querySelector('.oa-member-initials'),
  portrait:member.querySelector('.oa-member-portrait'),dot:member.querySelector('.oa-unread')
 })):[];
 let portraitScope=null;
 for(const member of remoteMembers){
  const {portrait}=member;
  portrait?.addEventListener?.('load',()=>showMemberPortrait(member));
  portrait?.addEventListener?.('error',()=>{if(portraitScope&&portrait.hasAttribute('src'))discardMemberPortrait(member);});
 }
 if(remoteMembers.length)window.addEventListener('online',resumeMemberPortraits);
 if(remoteMode)persona.querySelectorAll('[data-action="profile"]').forEach(control=>control.remove());
 let remoteReady=false,authBusy=remoteMode,operationBusy=false,loginError='',loginUsername='',remoteSnapshot=null,deferredSnapshot=null,remoteSignature='',serverOffset=0;
 const welcomeKey='desir-welcome-v1';
 let welcomeDismissed=false;try{welcomeDismissed=localStorage.getItem(welcomeKey)==='1';}catch(_){}
 let localPrefs={sound:false};try{const saved=JSON.parse(localStorage.getItem('desir-preferences-v1')||'{}');if(typeof saved.sound==='boolean')localPrefs.sound=saved.sound;}catch(_){}
 const ambientMotionKey='d6-ambient-motion-v1';
 let ambientMotion=true;try{ambientMotion=localStorage.getItem(ambientMotionKey)!=='0';}catch(_){}
 function setAmbientMotion(enabled,persist=true){
  ambientMotion=!!enabled;root.classList.toggle('oa-ambient-paused',!ambientMotion);
  if(persist)try{localStorage.setItem(ambientMotionKey,ambientMotion?'1':'0');}catch(_){}
  if(typeof window.CustomEvent==='function')window.dispatchEvent?.(new window.CustomEvent('d6-ambient-motion-change'));
 }
 setAmbientMotion(ambientMotion,false);

 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let localRoom=null,ownState=null,incomingStates=[],outgoingCount=0,selectedIncomingRoundId=null;
 let state=G.createState(), tab='play', busy=false, rerolling=null, toastTimer, lastFocus=null, animationSerial=0;
 let cardReveal=null,refusal=null,revealWait=null,activeRollFace=null,presentationEpoch=0,presentationHidden=false;
 let autoNewRoundTimer=null,autoNewRoundId=null;
 let missionScheduled=false,missionSending=false,missionError=null;
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
 // Connected profiles replace the header; keep notices in the layout, below them.
 if(remoteMode&&badgeNotice)root.querySelector('.oa-shell')?.insertBefore?.(badgeNotice,main);
 else{const badgeAnchor=persona.querySelector('.oa-switch:has(.oa-player-avatar)');if(badgeAnchor&&badgeNotice)badgeAnchor.append(badgeNotice);}
 const badgeMemory=new Map();
 let badgeView=null,badgeRegistryKey=null,badgeRegistry=null,badgeMissingBaseline=null,badgeActive=null,badgeTimer=null,badgeTimerStarted=0;
 let badgeHover=false,badgeFocus=false,badgeReturnFocus=null,badgeSheetOpen=false,badgeFilter='all',badgeHighlight=null,badgeSheetMarkup='',badgeDetailId=null,badgeGalleryScroll=null,badgeNoticeAnimation=null;
 const viewport=window.visualViewport;let viewportListening=false;
 const installed=window.matchMedia('(display-mode: standalone)').matches||window.navigator?.standalone===true;
 function updateViewportHeight(){
  if(!viewport||viewport.height<=0||Math.abs((viewport.scale||1)-1)>=.02)return;
  if(installed){
   // Standalone WebKit can report a short visual viewport even with the keyboard closed.
   const editing=document.activeElement?.matches?.('input,textarea,[contenteditable="true"]');
   if(!editing||document.documentElement.clientHeight-viewport.height<=150){
    root.style.removeProperty('--oa-viewport-height');
    return;
   }
  }
  const visibleBottom=viewport.height+Math.max(0,viewport.offsetTop||0);
  root.style.setProperty('--oa-viewport-height',Math.floor(visibleBottom)+'px');
 }
 function startViewport(){
  if(!viewport||viewportListening)return;
  viewportListening=true;
  viewport.addEventListener('resize',updateViewportHeight);
  viewport.addEventListener('scroll',updateViewportHeight);
  window.addEventListener('resize',updateViewportHeight);
  updateViewportHeight();
 }
 function stopViewport(){
  if(!viewportListening)return;
  viewportListening=false;
  viewport.removeEventListener('resize',updateViewportHeight);
  viewport.removeEventListener('scroll',updateViewportHeight);
  window.removeEventListener('resize',updateViewportHeight);
 }
 const syncDuoVisibility=()=>root.classList.toggle('oa-duo-suspended',document.hidden||presentationHidden);
 syncDuoVisibility();
 if(viewport)startViewport();
 window.addEventListener('pageshow',()=>{presentationHidden=false;syncDuoVisibility();startViewport();resumeMemberPortraits();updateBadgeNotice();});
 window.addEventListener('pagehide',()=>{presentationHidden=true;syncDuoVisibility();stopViewport();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();updateBadgeNotice();});
 if(!remoteMode){
  localRoom=G.createRoom({at:new Date().toISOString()});
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
 const die=window.OndeDice.create(canvas,{kind:G.rules.categorySides,value:3,duration:1650,maxPixelRatio:2,maxPixels:200000,reducedMotion:!!systemReduce,idleMotion:true,interactive:false});
 const h=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=id=>(state.players.find(p=>p.id===id)||{}).name||'Partenaire';
 const now=()=>new Date().toISOString();
 const card=()=>G.getCard(state.round.cardId,roundVersion(state.round));
 const category=()=>G.getCategory(state.round.categoryId,state.round.catalogueVersion??1);
 const roundVersion=round=>round.catalogueVersion??(round.variantRoll!==undefined?2:1);
 const isHardcore=round=>round.intimacyPool==='hardcore';
 const categoryLabel=round=>G.getCategory(round.categoryId,roundVersion(round)).label+(isHardcore(round)?' · Hardcore':'');
 const canDraw=()=>state.phase==='category'
  ? !remoteMode || (typeof remoteSnapshot?.drawAvailable==='boolean'?remoteSnapshot.drawAvailable:state.activePlayer===state.round.from)
  : state.activePlayer===state.round.from;
 const canSeeCurrentRound=()=>G.canSeeRound(state)&&(state.phase!=='category'||canDraw());
 const serverStamp=()=>new Date(serverNow()).toISOString();
 const hasRollStar=()=>G.cardRerollStars(ownState||state,viewPlayer,serverStamp()).balance>0;
 const canRerollCurrentCard=()=>G.canRerollCard(state,serverStamp());
 const parisToday=()=>G.parisDateKey(new Date(serverNow()).toISOString());
 const canRerollCategoryNow=()=>hasRollStar()&&state.phase==='card'&&state.activePlayer===state.round.from&&!!state.dailyReroll&&!(state.dailyReroll.dateKey===parisToday()&&state.dailyReroll.used.includes(state.activePlayer));
 const jokerAvailable=()=>hasRollStar()&&state.phase==='category'&&state.activePlayer===state.round.from&&!!state.joker&&state.joker.weekKey===G.isoWeekKey(new Date(serverNow()).toISOString())&&!state.joker.usedBy;
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const chargeNow=()=>window.performance?.now?window.performance.now():Date.now();
 const chargeLimit=1200;
 function rollButton(target){const button=target.closest?.('[data-action]');return button&&root.contains(button)&&['roll','reroll'].includes(button.dataset.action)?button:null;}
 function canCharge(button){
  if(!button||button.disabled||!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady||!hasRollStar())return false;
  if(button.dataset.action==='reroll')return canRerollCurrentCard();
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
  suppressedClick=null;charge={button,source,started:chargeNow(),power:0,frame:null,pointerId:source==='pointer'?event.pointerId:undefined,x:event.clientX,y:event.clientY,swipe:source==='pointer'&&button.classList.contains('oa-die-hit'),phase:state.phase,roundId:state.round.id,cardId:state.round.cardId,actor:viewPlayer};
  button.classList.add('is-charging');drawCharge();updateBadgeNotice();
  try{if(source==='pointer')button.setPointerCapture?.(event.pointerId);}catch(_){}
  return true;
 }
 async function releaseCharge(event){
  const active=charge;if(!active)return;
  if(active.source==='pointer'&&event.pointerId!==active.pointerId)return;
  const dx=active.swipe?event.clientX-active.x:0,dy=active.swipe?event.clientY-active.y:0,distance=Math.hypot(dx,dy);
  const direction=distance>=32?{x:dx/distance,y:dy/distance}:null;
  const power=Math.max(0,Math.min(1,Math.max((chargeNow()-active.started)/chargeLimit,direction?distance/180:0)));let inside=active.button.isConnected&&canCharge(active.button);
  if(active.source==='pointer'){const rect=active.button.getBoundingClientRect();inside=inside&&(!!direction||event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);}
  else inside=inside&&document.activeElement===active.button;
  clearCharge(true,false);suppressedClick.until=chargeNow()+600;
  if(remoteMode)flushRemote(null,false);
  inside=inside&&active.phase===state.phase&&active.roundId===state.round.id&&active.cardId===state.round.cardId&&active.actor===viewPlayer&&canCharge(active.button);
  if(inside)await roll(active.button.dataset.action==='reroll',power,direction);else render();
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
 function isParallel(){return !remoteMode||[6,7,8].includes(remoteSnapshot?.gameVersion);}
 function drawVersion(){return !remoteMode||remoteSnapshot?.gameVersion===8?G.currentCatalogueVersion:remoteSnapshot?.gameVersion===7?4:3;}
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
 function showMemberPortrait({portrait,initials}){
  if(!portraitScope||!portrait?.hasAttribute('src')||!portrait.complete||!portrait.naturalWidth)return;
  portrait.hidden=false;initials.hidden=true;
 }
 function discardMemberPortrait({portrait,initials}){
  portrait.hidden=true;portrait.removeAttribute('src');initials.hidden=false;
  scheduleMemberPortraitRetry(portraitScope);
 }
 function clearMemberPortraits(){
  if(portraitScope)clearTimeout(portraitScope.timer);
  portraitScope=null;
  for(const {portrait,initials} of remoteMembers)if(portrait){portrait.hidden=true;portrait.removeAttribute('src');initials.hidden=false;}
 }
 function missingMemberPortrait(){
  return remoteMembers.some(({portrait})=>portrait&&!portrait.hasAttribute('src'));
 }
 function scheduleMemberPortraitRetry(scope){
  if(!scope||scope!==portraitScope||scope.timer!==null||document.hidden||presentationHidden)return;
  scope.timer=setTimeout(()=>{
   scope.timer=null;
   requestMemberPortraits(scope);
  },scope.retryDelay);
  scope.retryDelay=Math.min(scope.retryDelay*3,30000);
 }
 function requestMemberPortraits(scope){
  if(scope!==portraitScope||scope.pending||!remote.authenticated||!currentPerspective(scope)||
     document.hidden||presentationHidden||!missingMemberPortrait())return;
  scope.pending=true;
  remote.loadPortraits().then(photos=>{
   if(portraitScope!==scope||!remote.authenticated||!currentPerspective(scope))return;
   for(const member of remoteMembers){
    const {portrait}=member,source=photos[member.member.dataset.member];
    if(portrait&&source&&!portrait.hasAttribute('src'))portrait.src=source;
    showMemberPortrait(member);
   }
  }).catch(()=>{}).finally(()=>{
   scope.pending=false;
   if(missingMemberPortrait())scheduleMemberPortraitRetry(scope);
  });
 }
 function resumeMemberPortraits(){
  const scope=portraitScope;
  if(!scope||document.hidden||presentationHidden)return;
  for(const member of remoteMembers){
   const {portrait}=member;
   if(portrait?.hasAttribute('src')&&portrait.complete&&!portrait.naturalWidth)discardMemberPortrait(member);
   else showMemberPortrait(member);
  }
  clearTimeout(scope.timer);scope.timer=null;
  requestMemberPortraits(scope);
 }
 function loadMemberPortraits(value){
  if(!remote?.loadPortraits)return;
  if(!samePerspective(value,portraitScope)){
   clearMemberPortraits();
   portraitScope={roomId:value.roomId,actor:value.actor,pending:false,timer:null,retryDelay:1500};
  }
  if(portraitScope.timer===null)requestMemberPortraits(portraitScope);
 }
 function applyRemote(value,renderNow=true){
  if(remoteMode&&!remote?.authenticated||!value||!value.state||!['a','b'].includes(value.actor)||!currentPerspective(value))return false;
  if(samePerspective(value,remoteSnapshot)&&value.revision<remoteSnapshot.revision)return false;
  if(value.badges===undefined&&samePerspective(value,remoteSnapshot)&&remoteSnapshot.badges)value={...value,badges:remoteSnapshot.badges};
  const normalized=G.normalizeState(value.state);if(!normalized||normalized.activePlayer!==value.actor)return false;
  if(remoteSnapshot&&!samePerspective(value,remoteSnapshot)){openedInvitation=null;selectedIncomingRoundId=null;visibleCardId=null;gaugeFrames.clear();}
  if(value.serverTime&&Number.isFinite(Date.parse(value.serverTime)))serverOffset=Date.parse(value.serverTime)-Date.now();
  const now=serverNow(),nextQuotaAt=Date.parse(value.quota?.nextAt);
  const quotaClock=value.quota?.remaining===0&&Number.isFinite(nextQuotaAt)?(nextQuotaAt<=now?'elapsed':G.parisDateKey(now)):null;
  const signature=JSON.stringify({state:value.state,actor:value.actor,quota:value.quota,quotaClock,paired:value.paired,drawAvailable:value.drawAvailable,canExtendTasks:value.canExtendTasks,penaltyTaskIds:value.penaltyTaskIds,gameVersion:value.gameVersion,incoming:value.incoming,pendingOutgoing:value.pendingOutgoing,badges:value.badges,activity:value.activity,streak:value.activity?G.activeStreak(value.activity,new Date(now).toISOString()):null});
  const changed=signature!==remoteSignature;remoteSignature=signature;remoteSnapshot=value;
  viewPlayer=value.actor;ownState={...normalized,prefs:{...normalized.prefs,...localPrefs}};incomingStates=(value.incoming||[]).map(incoming=>({...incoming,prefs:{...incoming.prefs,...localPrefs}}));outgoingCount=Number.isInteger(value.pendingOutgoing)?value.pendingOutgoing:0;selectDisplayState();remoteReady=true;authBusy=false;loginError='';
  loadMemberPortraits(value);
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
  const sheetError=!sheet.hidden&&sheet.querySelector('[data-sheet-error]');
  if(sheetError){sheetError.textContent=message;sheetError.hidden=false;}else toast(message);return false;
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
 function stage(type,label,value,role='defense',rollLabel=''){
  const touch=rollLabel?'<button type="button" class="oa-die-hit cursor-interaction" data-action="roll">'+h(rollLabel)+'</button>':'';
  const callout=role==='variant'||role==='category'&&type===4||role==='card'&&type===8?'<div class="oa-roll-callout" data-roll-callout aria-hidden="true" hidden><svg aria-hidden="true" focusable="false"><path pathLength="1"/><circle r="3.5"/><circle r="1.35"/></svg><span></span></div>':'';
  return '<section class="oa-dice-section" aria-label="Dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+'</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'" data-roll-role="'+role+'">'+touch+'</div>'+callout+'</section>';
 }
 const themeIcons={complicite:'heart',attention:'coins',projets:'tent',intimite:'flame'};
 const cardIcons={
  Paper:'note',Selfie:'camera',Massage:'massage',Soin:'polish',Soirée:'moon','No Phone':'phone-off',Kiss:'kiss',Aide:'help',
  Vinted:'shirt','En Ville':'book-open','Fast Food':'sandwich','Cuisine du monde':'utensils','Douceur maison':'cookie','Préparer un petit truc':'coffee',Monoprix:'shopping-basket','Passage du Désir':'gift',
  Balade:'footprints',Photo:'camera',Atelier:'palette',Escapade:'map',Aménager:'armchair',Désencombrer:'archive',Piste:'compass',Ciel:'telescope',
  Oral:'speech',Quickie:'zap',Lovense:'vibrate',Photoshoot:'aperture',Webcam:'webcam',Nudes:'image-up',BDSM:'link',Anal:'target'
 };
 const dicePigments={complicite:'#2a1c3c',attention:'#3b2a1c',projets:'#163239',intimite:'#411d32'};
 const legacyVariantIcons=['circle','triangle','square','diamond','pentagon','hexagon'];
 function variantFaces(round){
  const variants=(c)=>c?.variantsByPlayer?.[round.from]||c?.variants;
  const labels=variants(G.getCard(round.cardId,roundVersion(round)));
  if(!labels)return [null,null];
  const reference=variants(G.getCard(round.cardId,G.currentCatalogueVersion));
  const row=window.DesirVariantGlyphs?.[round.cardId];
  const icons=Array.isArray(row)?row:row?.[round.from];
  const matching=labels.map(label=>icons?.[reference?.indexOf(label)]);
  return [labels,matching.every(Boolean)&&new Set(matching).size===labels.length?matching:legacyVariantIcons];
 }
 function diceFaces(holder){
  if(holder.dataset.rollRole==='category'&&holder.dataset.kind==='4')return [G.categories.map(c=>c.label),G.categories.map(c=>themeIcons[c.id])];
  if(holder.dataset.rollRole==='variant')return variantFaces(state.round);
  if(holder.dataset.rollRole!=='card'||holder.dataset.kind!=='8')return [null,null];
  const round=cardReveal||rerolling||state.round;
  const labels=round.hand.map(id=>G.getCard(id,round.catalogueVersion).keyword);
  return [labels,labels.map(label=>cardIcons[label])];
 }
 function categoriesGrid(){return '<div class="oa-category-grid">'+G.categories.map(c=>'<button type="button" class="oa-category cursor-interaction" data-action="joker" data-category="'+c.number+'" style="--category:'+c.color+'" aria-label="Joker : choisir le thème '+h(c.label)+'"><span class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></span><span class="oa-category-label">'+h(c.label)+'</span></button>').join('')+'</div>';}
 function handGrid(options={}){const discarded=options.discarded||null,selected=options.selected||null,hand=options.hand||state.round.hand,version=options.catalogueVersion??state.round.catalogueVersion??1,pool=options.intimacyPool===undefined?state.round.intimacyPool:options.intimacyPool;const count=hand.length,words=count===6?'Six':'Quatre';return '<div class="oa-card-grid'+(count===6?' is-six':'')+(discarded?' is-reroll':'')+(selected?' is-revealing':'')+'" data-catalogue-version="'+version+'" aria-label="'+(selected?words+' emplacements, carte '+selected.slot+' choisie':discarded?words+' emplacements, une carte écartée':words+' cartes face cachée')+'">'+hand.map((id,i)=>{
  const slot=i+1,number='<span class="oa-mini-number">'+slot+'</span>';
  const old=discarded&&discarded.slot===slot&&discarded.cardId===id?G.getCard(discarded.cardId):null;
  const chosen=selected&&selected.slot===slot&&selected.cardId===id?G.getCard(selected.cardId):null;
  if(chosen){
   const cat=G.getCategory(chosen.categoryId,version);
   const theme=categoryLabel({categoryId:chosen.categoryId,catalogueVersion:version,intimacyPool:pool});
   return '<div class="oa-mini-card oa-card-back oa-card-revealed" data-reveal-selected aria-label="Carte '+slot+' choisie" style="--category:'+h(cat.color)+'">'+number+'<span class="oa-slot-label" title="'+h(theme)+'">Choisie</span></div>';
  }
  if(old)return '<div class="oa-mini-card oa-card-back oa-card-discarded" aria-label="Carte '+slot+' écartée : '+h(old.title)+'">'+number+'<span class="oa-slot-label" title="'+h(old.title)+'">Écartée</span></div>';
  return '<div class="oa-mini-card oa-card-back" aria-label="Carte '+slot+' face cachée">'+number+'<span class="oa-slot-label">Carte</span></div>';
 }).join('')+'</div>';}
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function proposalDetail(round){return G.getVariant(round)||(round.adapted?round.proposal:null);}
 function rollFormula(round,c){
  const symbol=key=>{
   const path=window.OndeDice.iconPath?.(key);
   return path?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>':'';
  };
  const theme=symbol(themeIcons[c.categoryId]);
  const cardMark=symbol(cardIcons[c.keyword])||(round.cardRoll?'<b>'+round.cardRoll+'</b>':'');
  const variant=round.variantRoll?symbol(variantFaces(round)[1]?.[round.variantRoll-1]):'';
  return '<div class="oa-roll-formula" aria-hidden="true">'+[theme,cardMark,variant].filter(Boolean).join('<i></i>')+'</div>';
 }
 function playingCard(c,compact=false){
  const r=state.round,cat=G.getCategory(c.categoryId,r.catalogueVersion??1),detail=proposalDetail(r),note=(r.catalogueVersion??1)===1?cardNotes[c.id]:null;
  return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(categoryLabel(r))+(r.adapted?' · VARIANTE':'')+'</span></div>'+(!compact?rollFormula(r,c):'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2>'+(detail?'<p class="oa-card-description">'+h(detail)+'</p>':'')+(note?'<p class="oa-card-note">'+h(note)+'</p>':'')+'</article>';
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
  return badgeCatalog.map(definition=>{
   const row={...definition,...items.get(definition.id)};
   const theme=definition.family==='categories'&&G.getCategory(definition.criterion.categoryId);
   if(theme)row.description='Participer à '+definition.target+' défis '+theme.label+' validés à deux.';
   return row;
  });
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
  const featured=earned.length?earned.slice(0,5):badgeRows().filter(badge=>['ind-draws-1','ind-proposals-1','duo-completed-1'].includes(badge.id));
  return `<section class="oa-achievements" aria-labelledby="oa-badges-title">
   <div class="oa-section-head">
    <div><h2 id="oa-badges-title">Badges</h2><span aria-label="${earned.length} badges débloqués sur ${badgeCatalog.length}">${earned.length} / ${badgeCatalog.length}</span></div>
    ${btn('Tout afficher <i aria-hidden="true">↗</i>','badges-all','oa-secondary oa-achievements-open','aria-haspopup="dialog" aria-label="Afficher les '+badgeCatalog.length+' badges"')}
   </div>
   <p class="oa-note">${earned.length?'Les derniers débloqués':'Vos premiers badges à débloquer'}</p>
   <ol class="oa-achievement-gallery is-recent${earned.length?'':' is-preview'}">${featured.map(badge=>badgeTile(badge,'recent')).join('')}</ol>
  </section>`;
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
  frostTransition(sheet.querySelector('.oa-achievement-detail'),260,4);
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
  const animation=medal.animate([
   {opacity:.68,transform:'scale(.82) rotate(-9deg)'},
   {opacity:1,transform:'scale(1.12) rotate(4deg)',filter:'brightness(1.65) drop-shadow(0 0 4px #a8d7ff)',offset:.22},
   {opacity:.86,transform:'scale(.98) rotate(-2deg)',offset:.46},
   {opacity:1,transform:'scale(1.05) rotate(1deg)',filter:'brightness(1.45) drop-shadow(0 0 3px #c4adef)',offset:.65},
   {opacity:1,transform:'scale(1) rotate(0deg)',filter:'none'}
  ],{duration:1000,easing:'ease-in-out'});
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
   badgeActive={id:next.id,awardId:next.award.id,remaining:4500};badgeHover=false;badgeFocus=false;
   badgeRegistry.seen.push(next.award.id);badgeRegistry.pending=badgeRegistry.pending.filter(id=>id!==next.award.id);saveBadgeRegistry();
   badgeNotice.innerHTML='<button type="button" class="oa-badge-notice-open cursor-interaction" data-action="badge-view" data-badge="'+h(next.id)+'" aria-haspopup="dialog" aria-label="Voir le badge '+h(next.title)+'">'+badgeMedallion(next,'notice')+'<span class="oa-badge-notice-copy"><small>Badge débloqué</small><strong>'+h(next.title)+'</strong></span></button><button type="button" class="oa-badge-notice-close cursor-interaction" data-action="badge-dismiss" aria-label="Fermer la notification du badge">×</button>';
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
  return '<section class="oa-welcome" aria-labelledby="oa-welcome-title"><img class="oa-welcome-icon" src="./icons/desir-192.png" width="76" height="76" alt=""><div class="oa-welcome-copy"><h1 id="oa-welcome-title">Les dés choisissent une idée à deux.</h1><p>Ta carte rejoint les Missions quand le tirage est terminé.</p><p>Deux coches dans les 24 h, un point pour vous.</p></div><div class="oa-actions">'+btn('C’est parti <span class="oa-arrow" aria-hidden="true">↗</span>','welcome-start')+'</div></section>';
 }
 function renderLogin(){
  if(authBusy)return heading('Votre<br><em>espace.</em>',null,null)+'<div class="oa-login-wait" role="status">Connexion…</div>';
  if(remote?.connection&&remote.authenticated)return heading('Votre<br><em>espace.</em>',null,null)+'<div class="oa-login"><p class="oa-subtitle">Ton accès est conservé sur cet appareil.</p><p class="oa-form-error" data-login-error role="status">'+h(loginError||remote.status.message||'La connexion au duo est momentanément indisponible.')+'</p><div class="oa-actions">'+btn('Réessayer <span class="oa-arrow" aria-hidden="true">↗</span>','reconnect')+'</div></div>';
  return heading('Votre<br><em>espace.</em>',null,null)+'<form class="oa-login" data-login-form><label class="oa-field">Identifiant<input id="oa-username" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="80" value="'+h(loginUsername)+'"></label><label class="oa-field">Mot de passe<input id="oa-password" name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p class="oa-form-error" data-login-error role="alert" '+(!loginError?'hidden':'')+'>'+h(loginError)+'</p><div class="oa-actions"><button type="submit" class="oa-button cursor-interaction" '+(!remote?.enabled?'disabled':'')+'>Se connecter <span class="oa-arrow">↗</span></button></div></form>';
 }
 function renderPersona(){
  const hidden=!welcomeDismissed||remoteMode&&!remoteReady;
  persona.hidden=hidden;navigation.hidden=hidden;const help=root.querySelector('[data-action="rules"]');if(help)help.hidden=hidden;
  for(const {member,label,initials,dot} of remoteMembers){
   const id=member.dataset.member,displayName=hidden?'':name(id);
   member.hidden=hidden;dot.hidden=hidden||!awaitingPlayer(id);
   if(!hidden&&id===viewPlayer)member.setAttribute('aria-current','true');else member.removeAttribute('aria-current');
   if(label.textContent!==displayName){
    label.textContent=displayName;label.title=displayName;
    const words=displayName.normalize().match(/[\p{L}\p{N}]+/gu)||[];
    const edges=words.length>1?[words[0],words.at(-1)]:words;
    initials.textContent=hidden?'':edges.map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('fr-FR')||'·';
   }
  }
  updateStarBudget();
 }
 const rerollStar='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5C12.8 7.5 16.5 11.2 22.5 12C16.5 12.8 12.8 16.5 12 22.5C11.2 16.5 7.5 12.8 1.5 12C7.5 11.2 11.2 7.5 12 1.5Z"/></svg>';
 function updateStarBudget(game=ownState||state){
  const at=serverStamp(),enabled=!persona.hidden&&drawVersion()===G.currentCatalogueVersion;
  for(const id of ['a','b']){
   const counter=persona.querySelector?.('[data-stars-for="'+id+'"]');
   if(!counter)continue;
   counter.hidden=!enabled;
   if(!enabled){
    if(counter.dataset.stars!==undefined){delete counter.dataset.stars;counter.removeAttribute('aria-label');counter.removeAttribute('title');counter.textContent='';}
    continue;
   }
   const {balance,usedToday}=G.cardRerollStars(game,id,at);
   const label=name(id)+' · '+balance+' étoile'+(balance===1?'':'s')+' sur '+G.rules.cardRerollMax+(usedToday?' · Étoile dépensée aujourd’hui':'');
   if(counter.title!==label){counter.setAttribute('aria-label',label);counter.title=label;}
   const signature=balance+':'+usedToday;
   if(counter.dataset.stars===signature)continue;
   counter.dataset.stars=signature;
   counter.innerHTML=Array.from({length:G.rules.cardRerollMax},(_,i)=>'<i'+(i<balance?' class="is-lit"':'')+'>'+rerollStar+'</i>').join('');
  }
 }
 function categoryAction(){
  const quota=remoteSnapshot?.quota;
  if(!remoteMode||!Number.isInteger(quota?.remaining))return rollReadout;
  const {balance}=G.cardRerollStars(ownState||state,viewPlayer,serverStamp());
  if(quota.remaining>0)return rollReadout+'<p class="oa-draw-budget">'+quota.remaining+' tirage'+(quota.remaining===1?'':'s')+' · '+balance+' étoile'+(balance===1?'':'s')+'</p>';
  const nextAt=Date.parse(quota.nextAt),now=serverNow();
  let renewal='à la prochaine plage';
  if(Number.isFinite(nextAt)){
   if(nextAt<=now)renewal='après actualisation du quota';
   else{
    const parts=new Intl.DateTimeFormat('fr-FR',{hour:'numeric',minute:'2-digit',timeZone:'Europe/Paris'}).formatToParts(nextAt);
    const hour=Number(parts.find(part=>part.type==='hour').value),minute=parts.find(part=>part.type==='minute').value;
    const day=G.parisDateKey(nextAt)===G.parisDateKey(now)?'':'demain ';
    renewal='<strong>'+day+'à '+hour+' h'+(minute==='00'?'':' '+minute)+'</strong> (Paris)';
   }
  }
  return '<div class="oa-next-draw" role="status">3 tirages utilisés · Prochain tirage '+renewal+'</div>';
 }
 const rollReadout='<p class="oa-die-readout" data-roll-readout aria-hidden="true"></p>';
 function switchButton(id,label){return btn(label||'Voir côté '+h(name(id)),'profile','oa-secondary','data-player="'+id+'"');}
 function rollScreen(headingMarkup,stageMarkup,actionMarkup,following=''){
  return '<div class="oa-roll-heading">'+headingMarkup+'</div>'+stageMarkup+'<div class="oa-roll-action">'+actionMarkup+'</div>'+following;
 }
 function draftActions(){
  const round=state.round;
  if(!canDraw())return '<div class="oa-actions">'+switchButton(round.from)+'</div>';
  const stars=round.catalogueVersion===G.currentCatalogueVersion,canReroll=canRerollCurrentCard();
  if(stars&&missionError===round.id)return '<div class="oa-actions">'+btn('Réessayer','send')+'</div>';
  if(stars&&!canReroll)return '<p class="oa-mission-transfer" role="status">Ajout aux Missions…</p>';
  return '<div class="oa-actions">'+btn(stars?'Garder la carte':'Ajouter aux Missions','send')+
   (canReroll?textBtn(stars?'Relancer <span class="oa-reroll-cost" aria-hidden="true">1 '+rerollStar+'</span>':'Relancer la carte','reroll',stars?'aria-label="Relancer la carte, coûte une étoile"':''):'')+'</div>';
 }

 function privateHome(incoming=false){
  const r=state.round;
  return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+(incoming?'<button type="button" class="oa-invitation cursor-interaction" data-action="open-invitation" data-round="'+h(r.id)+'"><span class="oa-invitation-dot" aria-hidden="true"></span><span><b>'+'Une invitation t’attend'+'</b><small>'+h(name(r.awaiting===r.from?r.to:r.from))+'</small></span><span class="oa-invitation-arrow" aria-hidden="true">↗</span></button>':'<div class="oa-quiet-home"><span aria-hidden="true">〰</span><p>Aucune invitation.</p></div>')+((state.tasks||[]).length?'<div class="oa-actions">'+btn('Missions · '+state.tasks.length,'tab','oa-secondary','data-tab="tasks"')+'</div>':'');
 }
 function renderPlay(){const r=state.round,c=card();
  if(!canSeeCurrentRound())return privateHome();
  if(cardReveal){
   const reveal=cardReveal,sides=reveal.hand.length,title=G.getCard(reveal.cardId,reveal.catalogueVersion).title;
   return rollScreen(cardHeading(reveal),stage(sides,reveal.reroll?'02 / UNE AUTRE CARTE':'02 / LA CARTE',reveal.face,'card'),
    '<p class="oa-roll-status'+(reveal.reroll?'':' is-first-reveal')+'" data-reveal-mode="'+(reveal.reroll?'reroll':'card')+'" aria-hidden="true">'+h(title)+'</p>',
    sides===8?'':handGrid({hand:reveal.hand,catalogueVersion:reveal.catalogueVersion,intimacyPool:reveal.intimacyPool,discarded:reveal.discarded,selected:{slot:reveal.face,cardId:reveal.cardId}}));
  }
  if(rerolling){
   const sides=G.cardSides(rerolling);
   return rollScreen(cardHeading(rerolling),
    stage(sides,'02 / UNE AUTRE CARTE',rerolling.cardRoll,'card'),'<p class="oa-die-readout" data-roll-status role="status" aria-busy="true"></p>',
    sides===8?'':handGrid({hand:rerolling.hand,catalogueVersion:rerolling.catalogueVersion,intimacyPool:rerolling.intimacyPool,discarded:{cardId:rerolling.cardId,slot:rerolling.cardRoll}}));
  }
  if(!busy&&['category','card','variant'].includes(state.phase)&&!hasRollStar()){
   const {nextAt}=G.cardRerollStars(ownState||state,viewPlayer,serverStamp());
   return heading('Dés en pause.', 'Il te faut une étoile pour lancer les dés.', null)+
    (nextAt?'<div class="oa-next-draw" role="status">Prochaine étoile dans <strong>'+timeLeft({expiresAt:nextAt})+'</strong></div>':'');
  }
  if(state.phase==='category')return rollScreen(eyebrow(currentDate())+'<h1 class="oa-sr">Tirage</h1>',
   stage(G.rules.categorySides,'01 / LE THÈME',3,'category',remoteSnapshot?.quota?.remaining===0?'':'Lancer le D'+G.rules.categorySides),categoryAction(),
   jokerAvailable()?'<div class="oa-actions">'+textBtn('Joker · choisir le thème','open-joker')+'</div>':'');
  if(state.phase==='card'){
   const sides=G.cardSides(state);
   return rollScreen(cardHeading(r),stage(sides,'02 / LA CARTE',1,'card','Lancer le D'+sides),
    rollReadout,(sides===8?'':handGrid())+(canRerollCategoryNow()?'<div class="oa-actions">'+textBtn('Relancer le thème <span class="oa-reroll-frequency">1×/jour</span>','reroll-category')+'</div>':''));
  }
  if(state.phase==='variant')return rollScreen(heading(h(c.title),null,null),
   stage(G.rules.variantSides,'03 / LA VARIANTE',3,'variant','Tirer la variante'),rollReadout);
  if(state.phase==='draft')return heading('Ta prochaine<br><em>idée à deux.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+draftActions();
  if(state.phase==='pending')return heading('Une ancienne<br><em>proposition.</em>','Actualise D6 à deux pour retrouver votre liste.',null);
  if(state.phase==='accepted')return heading('C’est dans<br><em>votre liste.</em>',null,null)+'<div class="oa-summary-card"><div><h2>'+h(c.title)+'</h2><p>'+h(proposalDetail(r)||category().label)+'</p></div></div><div class="oa-actions">'+btn('Voir les choses à faire','tab','','data-tab="tasks"')+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new','oa-secondary')+'</div>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed',expired=r.status==='expired';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Carte écartée.':expired?'Temps écoulé.':'Une autre<br><em>fois, peut-être.</em>',completed?'+1 point pour votre duo.':null,null)+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(category().label)+(r.adapted?' · Variante':'')+'</p></div>'+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
  }
  return '';
 }

 function timeLeft(task){const minutes=Math.max(0,Math.ceil((Date.parse(task.expiresAt)-serverNow())/60000));return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0');}
 function canExtendMission(task,at=serverStamp()){
  return (!remoteMode||remoteSnapshot?.canExtendTasks===true)&&G.canExtendTask(ownState||state,task,viewPlayer,at);
 }
 function taskStatus(task){
  const mine=task.checks[viewPlayer],partner=G.otherPlayer(viewPlayer),theirs=task.checks[partner];
  if(mine&&theirs)return 'Un moment partagé · +1 point pour vous.';
  if(mine)return 'Ta coche est posée · '+name(partner)+' doit encore cocher.';
  if(theirs)return name(partner)+' a coché · ta coche reste à poser.';
  return '';
 }
 function taskRecipient(task){
  const recipient=name(task.to),initial=recipient.normalize().match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase('fr-FR')||'·';
  const label=task.to===viewPlayer?'À toi de jouer':'Pour '+recipient;
  return '<div class="oa-task-recipient" data-recipient="'+h(task.to)+'"><span class="oa-task-initial" aria-hidden="true">'+h(initial)+'</span><span class="oa-task-recipient-label" title="'+h(label)+'">'+h(label)+'</span></div>';
 }
 const checkBox='<span class="oa-check-box" aria-hidden="true"><span class="oa-check-water"><svg viewBox="0 0 96 48" preserveAspectRatio="none"><path d="M0 8Q12 0 24 8T48 8T72 8T96 8V48H0Z"/><path d="M0 12Q12 20 24 12T48 12T72 12T96 12V48H0Z"/></svg></span><svg class="oa-check-mark" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span>';
 function taskCheck(task,player){const checked=task.checks[player],own=player===state.activePlayer,enabled=own&&!pendingChecks.has(task.id);return '<label class="oa-task-check '+(!own?'is-other':'')+'" data-check-player="'+player+'"><input type="checkbox" data-task-check="'+h(task.id)+'" data-player="'+player+'" aria-label="'+h(name(player)+' · '+G.getCard(task.cardId,roundVersion(task)).title)+'" '+(checked?'checked ':'')+(!enabled?'disabled':'')+'>'+checkBox+'<span>'+h(name(player))+'</span></label>';}
 function renderTasks(){
  const tasks=[...(state.tasks||[])].sort((a,b)=>Number(a.checks[viewPlayer])-Number(b.checks[viewPlayer])||Date.parse(a.expiresAt)-Date.parse(b.expiresAt));
  const at=serverStamp(),canRefuse=G.canSpendStar(ownState||state,viewPlayer,at);
  const {balance}=G.cardRerollStars(ownState||state,viewPlayer,at);
  if(refusal)return heading('Un D20<br><em>pour le refus.</em>',h(refusal.title),null)+stage(20,'D20 DU REFUS',refusal.face||1,'refusal')+'<p class="oa-roll-status" data-refusal-status role="status">'+(refusal.face?'':'Confirmation du refus…')+'</p>';
  return '<h1 class="oa-title oa-missions-title">Les choses <em>à faire.</em></h1>'+(tasks.length?'<div class="oa-task-list">'+tasks.map(task=>{
   const c=G.getCard(task.cardId,roundVersion(task)),cat=G.getCategory(task.categoryId,roundVersion(task)),detail=G.getVariant(task)||task.proposal;
   const received=task.to===viewPlayer;
   const face=received?(remoteMode?remoteSnapshot?.failedRefusals?.[task.id]:task.failedRefusalRoll):undefined;
   const penalty=received&&face===undefined&&!task.checks[viewPlayer]&&(remoteMode?remoteSnapshot?.penaltyTaskIds?.includes(task.id):task.starPenalty);
   const refusalNote=face!==undefined?'D20 · '+face+' · −1 étoile':received&&!canRefuse?(balance?'Étoile du jour déjà dépensée':'Aucune étoile disponible'):'';
   const warning=penalty?'<span class="oa-task-penalty" title="Une étoile peut être retirée si ta case reste vide à l’échéance."><span aria-hidden="true">−1 ✦</span><span class="oa-sr">Une étoile peut être retirée si ta case reste vide à l’échéance.</span></span>':'';
   const remaining=timeLeft(task),status=taskStatus(task),target='data-task="'+h(task.id)+'"';
   const actions=(canExtendMission(task,at)?textBtn('+24 h <span class="oa-reroll-cost" aria-hidden="true">1 '+rerollStar+'</span>','extend-task-confirm',target+' aria-label="Prolonger de 24 heures pour une étoile"'):'')+
    (received?textBtn('Refuser · D20 <span class="oa-reroll-cost" aria-hidden="true">1 '+rerollStar+'</span>','refuse-task',target+' aria-label="Tenter de refuser pour une étoile. Réussite à partir de 11 sur 20."'+(canRefuse?'':' disabled aria-describedby="oa-refusal-note-'+h(task.id)+'"')):'');
   const note=refusalNote?'<p class="oa-task-refusal-note" id="oa-refusal-note-'+h(task.id)+'">'+refusalNote+'</p>':'';
   const meta='<div class="oa-task-meta">'+rollFormula(task,c)+taskRecipient(task)+'</div>';
   const deadline='<div class="oa-task-deadline">'+warning+'<time datetime="'+h(task.expiresAt)+'" aria-label="Temps restant : '+remaining+'">'+remaining+'</time></div>';
   return '<article class="oa-task" data-task="'+h(task.id)+'" style="--category:'+cat.color+'"><div class="oa-task-top"><span>'+h(categoryLabel(task))+'</span>'+deadline+'</div>'+meta+'<div class="oa-task-heading"><h2>'+h(c.title)+'</h2>'+(detail?'<p class="oa-task-proposal">'+h(detail)+'</p>':'')+'</div>'+(status?'<p class="oa-task-status">'+h(status)+'</p>':'')+'<div class="oa-task-checks">'+taskCheck(task,'a')+taskCheck(task,'b')+'</div>'+(actions?'<div class="oa-task-actions">'+actions+'</div>':'')+note+'</article>';
  }).join('')+'</div>':'<div class="oa-task-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.5 4.7-5"/></svg><p>Rien en attente.</p></div>')+
   (state.phase==='accepted'?'<div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+'</div>':'');
 }
 function setting(key,label,desc){const enabled=key==='ambient'?ambientMotion:state.prefs[key];return '<label class="oa-setting"><span>'+label+'<small>'+desc+'</small></span><input type="checkbox" class="cursor-interaction" data-pref="'+key+'" '+(enabled?'checked':'')+' aria-label="'+h(label)+'"></label>';}
 const gradeLevels=G.gradeLevels;
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
  const [points,title]=grade,range=next?next[0]-points:points,progress=next?Math.min(range,total-points):range;
  const remaining=next?next[0]-total:0,caption=next?remaining+' point'+(remaining>1?'s':'')+' avant le prochain grade':'Grade maximal atteint.';
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"><path d="m4 17 7-4 4-8 5 11-9-3" stroke="currentColor" stroke-width=".8" opacity=".65"/><path d="M15 2.5v5m-2.5-2.5h5" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/><g fill="currentColor"><circle cx="4" cy="17" r="1.1"/><circle cx="11" cy="13" r="1.4"/><circle cx="15" cy="5" r="1.45"/><circle cx="20" cy="16" r="1.2"/></g></svg>';
  return '<section class="oa-grade-area" aria-label="Votre grade commun"><article class="oa-grade-card" data-grade="'+points+'" aria-labelledby="oa-grade-title"><div class="oa-grade-top"><span class="oa-grade-icon">'+icon+'</span><div class="oa-grade-copy"><p>Votre grade</p><h2 id="oa-grade-title">'+h(title)+'</h2></div></div><div class="oa-badge-progress" role="progressbar" aria-label="'+(next?'Prochain grade':'Grade maximal')+'" aria-valuemin="0" aria-valuemax="'+range+'" aria-valuenow="'+progress+'" aria-valuetext="'+caption+'"><i style="transform:scaleX('+progress/range+')"></i></div><p class="oa-badge-progress-text">'+caption+'</p></article></section>';
 }
 function animateGrade(){
  if(tab!=='us'||!welcomeDismissed||remoteMode&&!remoteReady||pendingGrade===null)return;
  const points=pendingGrade;pendingGrade=null;const el=main.querySelector('[data-grade]');
  if(!el||Number(el.dataset.grade)!==points)return;
  if(!systemReduce&&el.animate)el.animate([{opacity:0,transform:'translateY(9px) rotate(-.8deg) scale(.975)'},{opacity:1,transform:'translateY(-1px) rotate(.2deg) scale(1.004)',offset:.72},{opacity:1,transform:'translateY(0) rotate(0) scale(1)'}],{duration:440,easing:'cubic-bezier(.18,.8,.2,1)'});
  announce('Nouveau grade : '+gradeAt(state.stats.totalCompleted)[1]+'.');
 }
 function sharedScore(){
  const total=state.stats.totalCompleted;
  return `<section class="oa-shared-score" aria-label="Score commun">
   <div class="oa-score-head">
    <h1 class="oa-eyebrow">VOTRE SCORE À DEUX</h1>
    <div class="oa-score-number"><strong>${total.toLocaleString('fr-FR')}</strong><span>point${total>1?'s':''}</span></div>
   </div>
   ${sharedGrade(total)}
  </section>`;
 }
 function notificationSetting(){
  const n=remote.notificationStatus;
  return '<section class="oa-notification-setting"><div class="oa-section-head"><h2>Les notifications</h2></div>'+(n.subscribed?'<p class="oa-note">Activées sur cet appareil.</p>':n.supported&&n.permission!=='denied'?btn('Activer les notifications','enable-notifications','oa-secondary'):'')+(n.message?'<p class="oa-note">'+h(n.message)+'</p>':'')+'</section>';
 }
 function renderUs(){return sharedScore()+infoIdeaCard()+badgesSection();}

 function infoSettings(){
  if(remoteMode)notificationSignature=JSON.stringify(remote.notificationStatus);
  return '<section class="oa-info-card oa-info-settings" id="oa-info-settings" aria-labelledby="oa-info-settings-title"><p class="oa-info-kicker">Sur cet appareil</p><h2 id="oa-info-settings-title">Réglages</h2>'+setting('sound','Son des dés','Un contact feutré à chaque lancer.')+setting('ambient','Animations d’ambiance','Ciel, lignes lumineuses et effets du Carnet.')+(remoteMode?notificationSetting()+'<section class="oa-notification-setting"><div class="oa-section-head"><h2>Mes appareils</h2></div><p class="oa-note">Protège ton compte en retirant l’accès à un appareil.</p><div class="oa-actions">'+textBtn('Déconnecter cet appareil','logout-confirm')+textBtn('Déconnecter mes autres appareils','revoke-others-confirm')+'</div></section>':'<p class="oa-note">Démo locale · '+(persisted?'partie conservée sur cet appareil.':'partie non sauvegardée.')+(recovery?' Ancienne sauvegarde conservée pour récupération.':'')+'</p><div class="oa-actions">'+textBtn('Effacer la partie de démonstration','reset-confirm')+'</div>')+'</section>';
 }
 function infoActivity(){
  const activity=remoteMode?remoteSnapshot?.activity:G.activityCalendar(localRoom,viewPlayer);
  const streak=activity?G.activeStreak(activity,new Date(serverNow()).toISOString()):badgeView?.items.find(item=>item.id==='ind-active-streak-3')?.progress.value;
  const streakLabel=activity||streak===undefined?'Série en cours':'Record';
  const flame=`<svg class="oa-info-flame" viewBox="0 0 24 25" aria-hidden="true">
   <path d="M13.7 1.4c.6 3.9-1.3 5.7-3 7.4-1.3 1.3-2.4 2.7-2.1 4.8-2.1-1-2.7-2.9-2.5-4.5C3.8 11.6 2.8 14 3 16.5c.3 4.6 4 7.5 9 7.5 4.9 0 8.5-3.4 8.5-8.2 0-5.3-3.1-10.7-6.8-14.4Z"/>
   <path d="M13 13c.5 2-.5 3.1-1.4 4.1-.7.7-1.2 1.4-1 2.3-.8-.2-1.2-.7-1.4-1.3-.6.9-.7 1.9-.3 2.8.5 1.2 1.8 1.9 3.3 1.9 2.1 0 3.6-1.5 3.6-3.4 0-2.2-1.2-4.4-2.8-6.4Z"/>
  </svg>`;
  return `<div class="oa-info-streak"><strong>${flame}<b class="oa-info-streak-count">${streak?.toLocaleString('fr-FR')??'—'}</b>${streak===undefined?'':'<small>jour'+(streak>1?'s':'')+'</small>'}</strong><span>${streakLabel}</span></div>`;
 }
 function infoShared(){
  return `<div class="oa-info-shared">
   <h3>Vos cartes partagées</h3>
   <div class="oa-score-grid">${G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+G.categoryScore(state.stats,c.id).toLocaleString('fr-FR')+'</strong></div>').join('')}</div>
  </div>`;
 }

 function infoTickets(){
  const remaining=remoteSnapshot?.quota?.remaining;
  const dots=Array.from({length:3},(_,index)=>'<i'+(index<remaining?' class="is-available"':'')+'></i>').join('');
  const quotaLabel=remaining==null?(remoteMode?'Quota indisponible':'Démo sans quota'):remaining+' tirage'+(remaining===1?' disponible':'s disponibles');
  return `<div class="oa-info-ticket">
   <span>Tirages du jour</span>
   <span class="oa-info-ticket-dots" role="img" aria-label="${quotaLabel}" title="${quotaLabel}">${dots}</span>
   <small>Relance du thème gratuite · 1×/jour</small>
  </div>`;
 }

 const infoIdeas=G.categories.flatMap(({id,label,color})=>(window.DesirInfoQuestions?.[id]||[]).map(text=>({label,color,text})));
 let infoDeck=[],infoIdea=null;
 function infoIdeaMarkup(){
  return infoIdea?`<span class="oa-info-idea-theme" style="--category:${h(infoIdea.color)}">${h(infoIdea.label)}</span><p>${h(infoIdea.text)}</p>`:'';
 }
 function infoIdeaCard(){
  return `<section class="oa-info-card oa-info-lab" aria-labelledby="oa-info-idea">
   <div class="oa-info-idea-head">
    <h2 id="oa-info-idea">Une idée <em>à deux.</em></h2>
    ${btn('Piocher <span class="oa-arrow" aria-hidden="true">↗</span>','info-idea','','aria-label="Piocher une question"')}
   </div>
   <div class="oa-info-idea-output" aria-live="polite" aria-atomic="true">${infoIdeaMarkup()}</div>
  </section>`;
 }
 function renderInfo(){
  const libido=key=>document.getElementById('oa-libido-'+key)?.innerHTML||'';
  return `<article class="oa-info" aria-labelledby="oa-info-title">
   <div class="oa-info-progress" aria-hidden="true"><i></i></div>
   <h1 class="oa-sr" id="oa-info-title">Carnet</h1>
   <div class="oa-info-cards">
    ${libido('benchmarks')}
    <section class="oa-info-card oa-info-summary" id="oa-info-activity" aria-labelledby="oa-info-activity-title">
     <h2 id="oa-info-activity-title">Au fil des tirages.</h2>
     <div class="oa-info-status">
      <div data-info-activity>${infoActivity()}</div>
      <div data-info-tickets>${infoTickets()}</div>
     </div>
     <div data-info-shared>${infoShared()}</div>
     <div class="oa-info-agreement">
      <span class="oa-info-checks" aria-hidden="true">${checkBox}${checkBox}</span>
      <h3>Deux oui en ${G.rules.taskLifetimeMs/3600000} h</h3>
      <strong>+${G.rules.completedCardPoints} point</strong>
     </div>
    </section>
    <details class="oa-info-install oa-info-studies">
     <summary>Études et comparatifs</summary>
     <div class="oa-info-cards">
      ${libido('destinations')}
      ${libido('women')}
      ${libido('places')}
     </div>
    </details>
    <div data-info-settings>${infoSettings()}</div>
   </div>
   ${(remoteMode||root.querySelector('.oa-player-avatar'))?textBtn('Les règles du jeu','rules'):''}
   <details class="oa-info-install">
    <summary>Retrouver D6 à deux sur l’écran d’accueil</summary>
    <p>Sur iPhone, ouvre le jeu dans Safari, touche Partager, puis Sur l’écran d’accueil. Ouvre ensuite l’app pour activer les notifications depuis <strong>Carnet → Réglages</strong>.</p>
   </details>
  </article>`;
 }
 function mountInfo(){
  const panel=main.querySelector('.oa-info');
  if(!panel)return;
  const progress=panel.querySelector('.oa-info-progress i');
  const agreement=panel.querySelector('.oa-info-agreement');
  const rhythm=panel.querySelector('.oa-libido.benchmarks');
  let disposed=false,readingRhythm=false,recordingRhythm=false,rhythmVersion=0,rhythmTimer;
  const editor=rhythm?.querySelector('[data-rhythm-editor]');
  const comparison=rhythm?.querySelector('[data-rhythm-comparison]');
  const rhythmStatus=editor?.querySelector('[data-rhythm-status]');
  const rhythmButtons=editor?.querySelectorAll('[data-rhythm-add]')||[];
  const rateFormat=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});
  const dateFormat=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  function setComparison(open){
   comparison.setAttribute('aria-expanded',String(open));
   for(const cell of rhythm.querySelectorAll('[data-rhythm-reference]'))cell.hidden=!comparison.hidden&&!open;
  }
  const toggleComparison=()=>setComparison(comparison.getAttribute('aria-expanded')!=='true');
  function renderRhythm(data){
   for(const element of rhythm.querySelectorAll('[data-rhythm-rate]')){
    element.textContent=data?rateFormat.format(data[element.dataset.rhythmRate]):'';
   }
   rhythm.querySelector('[data-rhythm-dates]').textContent=data?dateFormat.formatRange(new Date(data.start),new Date(data.end)):'';
   rhythm.querySelectorAll('[data-rhythm-personal]').forEach(element=>element.hidden=!data);
   if(comparison){
    comparison.hidden=!data;
    setComparison(!!data&&comparison.getAttribute('aria-expanded')==='true');
   }
   if(editor){
    editor.hidden=!(data?.canRecord&&remote.recordRhythm);
    if(editor.hidden){editor.open=false;rhythmStatus.textContent='';}
   }
  }
  async function refreshRhythm(){
   if(disposed||document.hidden||readingRhythm||recordingRhythm)return;
   if(!remote.authenticated){renderRhythm(null);return;}
   readingRhythm=true;
   const version=rhythmVersion;
   try{
    const data=await remote.loadRhythm();
    if(!disposed&&version===rhythmVersion)renderRhythm(remote.authenticated?data:null);
   }catch(error){
    if(!disposed&&version===rhythmVersion&&(!remote.authenticated||error.status===401))renderRhythm(null);
   }finally{readingRhythm=false;}
  }
  async function addRhythm(event){
   const button=event.target.closest('[data-rhythm-add]');
   if(!button||editor.hidden||recordingRhythm||!remote.authenticated)return;
   recordingRhythm=true;
   rhythmVersion++;
   for(const choice of rhythmButtons)choice.disabled=true;
   rhythmStatus.textContent='Enregistrement…';
   try{
    const data=await remote.recordRhythm(button.dataset.rhythmAdd);
    if(disposed)return;
    renderRhythm(remote.authenticated?data:null);
    if(!editor.hidden)rhythmStatus.textContent='Rapport enregistré.';
   }catch(error){
    if(disposed)return;
    if(!remote.authenticated)renderRhythm(null);
    else if(error.status===403)editor.hidden=true;
    else rhythmStatus.textContent=error.code==='pending_action'?error.message:'Saisie à confirmer. Retouche la même catégorie.';
   }finally{
    recordingRhythm=false;
    if(!disposed)for(const choice of rhythmButtons)choice.disabled=false;
   }
  }
  if(rhythm&&remoteMode&&remote?.loadRhythm){
   refreshRhythm();
   rhythmTimer=window.setInterval?.(refreshRhythm,15000);
   document.addEventListener('visibilitychange',refreshRhythm);
   editor?.addEventListener('click',addRhythm);
   comparison?.addEventListener('click',toggleComparison);
  }
  const highlight=panel.querySelector('.dest-featured');
  const invitation=panel.querySelector('.women-invitation');
  const [ink,rest]=invitation?.querySelector('.women-invitation-ink')?.children||[];
  const letters=Array.from(ink?.textContent||'');
  const looping=new Set([agreement,rhythm,highlight,invitation,...panel.querySelectorAll('.anal-benchmark,.rough-extra,.place-fantasy-featured')].filter(Boolean));
  let typingTimer=0,typed=letters.length;
  const canType=()=>letters.length&&!systemReduce&&ambientMotion&&!document.hidden&&invitation.classList.contains('is-in-view');
  function drawTyping(count){
   if(!ink||!rest||typed===count)return;
   typed=count;
   ink.textContent=letters.slice(0,count).join('');
   rest.textContent=letters.slice(count).join('');
  }
  function typeNext(){
   typingTimer=0;
   if(!canType()){drawTyping(letters.length);return;}
   drawTyping(typed===letters.length?0:typed+1);
   typingTimer=setTimeout(typeNext,typed===letters.length?3400:46);
  }
  function syncTyping(){
   panel.classList.toggle('is-motion-paused',document.hidden||!ambientMotion);
   if(!canType()){
    clearTimeout(typingTimer);typingTimer=0;drawTyping(letters.length);
   }else if(!typingTimer){
    drawTyping(0);typingTimer=setTimeout(typeNext,240);
   }
  }
  let progressFrame=0;
  const updateProgress=()=>{
   progressFrame=0;
   const distance=main.scrollHeight-main.clientHeight;
   const ratio=distance>0?Math.max(0,Math.min(1,main.scrollTop/distance)):1;
   progress.style.transform='scaleX('+ratio+')';
  };
  const scheduleProgress=()=>{if(!progressFrame)progressFrame=requestAnimationFrame(updateProgress);};
  const observer=window.IntersectionObserver&&new IntersectionObserver(entries=>{
   entries.forEach(({target,isIntersecting,intersectionRatio})=>{
    const visible=isIntersecting&&intersectionRatio>=.18;
    if(looping.has(target))target.classList.toggle('is-in-view',visible&&!systemReduce&&ambientMotion);
    if(target===invitation){syncTyping();return;}
    if(target===highlight)return;
    if(!visible||systemReduce||target.hasAttribute('data-info-visited'))return;
    if(!looping.has(target))observer.unobserve(target);
    target.classList.add('is-reading');target.dataset.infoVisited='';
   });
  },{root:main,threshold:.18});
  const updateMotion=()=>{
   observer?.disconnect();
   if(systemReduce){looping.forEach(target=>target.classList.remove('is-in-view'));}
   else{
    panel.querySelectorAll('.oa-info-card:not([data-info-visited])').forEach(card=>observer?.observe(card));
    if(ambientMotion)looping.forEach(target=>observer?.observe(target));else looping.forEach(target=>target.classList.remove('is-in-view'));
   }
   syncTyping();
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
    const cardWasObserved=previous?.matches('.oa-info-card');
    if(cardWasObserved)observer?.unobserve(previous);
    widget.node.innerHTML=markup;widget.markup=markup;
    const card=widget.node.firstElementChild;
    if(cardWasObserved){
     if(previous.hasAttribute('data-info-visited'))card.dataset.infoVisited='';
     else if(!systemReduce)observer?.observe(card);
    }
    if(focused){
     const controls=Array.from(widget.node.querySelectorAll('[data-action], [data-pref]'));
     const replacement=controls.find(control=>!control.disabled&&(
      focused.dataset.action&&control.dataset.action===focused.dataset.action||
      focused.dataset.pref&&control.dataset.pref===focused.dataset.pref
     ))||(focused.dataset.action==='enable-notifications'&&widget.node.querySelector('.oa-notification-setting h2'))||widget.node.querySelector('h2')||panel.querySelector('#oa-info-activity-title');
     if(replacement){if(replacement.matches('h2'))replacement.setAttribute('tabindex','-1');replacement.focus({preventScroll:true});}
    }
   }
  };
  const resize=window.ResizeObserver&&new ResizeObserver(scheduleProgress);
  resize?.observe(panel);
  resize?.observe(main);
  main.addEventListener('scroll',scheduleProgress,{passive:true});
  window.addEventListener('resize',scheduleProgress);
  panel.addEventListener('toggle',scheduleProgress,true);
  document.addEventListener('visibilitychange',syncTyping);
  updateProgress();
  updateMotion();
  return {refresh,updateMotion,dispose(){
   disposed=true;
   if(rhythmTimer!==undefined)window.clearInterval?.(rhythmTimer);
   document.removeEventListener('visibilitychange',refreshRhythm);
   editor?.removeEventListener('click',addRhythm);
   comparison?.removeEventListener('click',toggleComparison);
   observer?.disconnect();resize?.disconnect();
   if(progressFrame)cancelAnimationFrame(progressFrame);
   clearTimeout(typingTimer);
   main.removeEventListener('scroll',scheduleProgress);
   window.removeEventListener('resize',scheduleProgress);
   panel.removeEventListener('toggle',scheduleProgress,true);
   document.removeEventListener('visibilitychange',syncTyping);
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
  if(!systemReduce){
   output.getAnimations?.().forEach(animation=>animation.cancel());
   playContentTransition(output,[{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'none'}],240);
  }
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
 const calloutReadingMs=1500;
 function waitForReveal(duration=900){return new Promise(resolve=>{const wait={resolve,timer:null};revealWait=wait;wait.timer=setTimeout(()=>{if(revealWait===wait){revealWait=null;resolve();}},duration);});}
 function showRollCallout(text,anchor,tint){
  const callout=anchor&&main.querySelector('[data-roll-callout]');
  if(!callout)return false;
  const label=callout.querySelector('span'),line=callout.querySelector('path');
  label.textContent=text;
  if(tint)callout.style.setProperty('--oa-hud-tint',tint);
  callout.hidden=false;
  const bounds=callout.getBoundingClientRect(),face=canvas.getBoundingClientRect(),title=label.getBoundingClientRect();
  const x=face.left-bounds.left+face.width*anchor.x-20,y=face.top-bounds.top+face.height*anchor.y-11;
  const left=title.left-bounds.left,top=title.bottom-bounds.top+5;
  if(x<=left+36||y<=top+8){callout.hidden=true;return false;}
  const elbow=Math.max(left+20,Math.min(left+70,x-30));
  line.setAttribute('d','M '+x+' '+y+' L '+elbow+' '+top+' H '+left);
  callout.querySelectorAll('circle').forEach(dot=>{dot.setAttribute('cx',x);dot.setAttribute('cy',y);});
  return true;
 }
 function presentationValid(context){return context.epoch===presentationEpoch&&context.actor===viewPlayer&&(!remoteMode||remote?.authenticated&&samePerspective(context,remote.connection));}
 function revealMatches(game,reveal){return game&&game.phase===(reveal.hasVariant?'variant':'draft')&&game.round.id===reveal.roundId&&game.round.from===reveal.actor&&game.round.cardId===reveal.cardId&&game.round.cardRoll===reveal.face;}
 function cancelContentTransitions(){for(const animation of contentTransitions)animation.cancel();contentTransitions.clear();}
 function playContentTransition(element,keyframes,duration,finish,delay=0){
  if(!element?.animate){finish?.(false);return;}
  const animation=element.animate(keyframes,{duration,delay,fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'});contentTransitions.add(animation);
  animation.onfinish=()=>{contentTransitions.delete(animation);finish?.(true);};
  animation.oncancel=()=>{contentTransitions.delete(animation);finish?.(false);};
 }
 async function flyRerollStar(source){
  if(systemReduce||document.hidden||presentationHidden||!source.isConnected)return;
  const card=main.querySelector('.oa-playing-card');
  if(!card)return;
  const shell=root.querySelector('.oa-shell'),base=shell.getBoundingClientRect(),view=main.getBoundingClientRect();
  const target=card.getBoundingClientRect(),star=source.getBoundingClientRect();
  const top=Math.max(view.top,target.top),bottom=Math.min(view.bottom,target.bottom);
  if(bottom<=top||!star.width)return;
  const fromX=star.left+star.width/2,fromY=star.top+star.height/2;
  const toX=target.left+target.width/2,toY=(top+bottom)/2;
  const dx=toX-fromX,dy=toY-fromY,ink=window.getComputedStyle(source).color;
  const x=fromX-base.left-shell.clientLeft,y=fromY-base.top-shell.clientTop;
  const traveler=document.createElement('span');
  traveler.className='oa-reroll-comet';traveler.setAttribute('aria-hidden','true');traveler.innerHTML=rerollStar;
  Object.assign(traveler.style,{left:x+'px',top:y+'px',width:star.width+'px',height:star.height+'px',color:ink});
  const pose=(t,up,scale)=>'translate3d('+dx*t+'px,'+dy*up+'px,0) scale('+scale+')';
  shell.append(traveler);
  const landed=await new Promise(resolve=>playContentTransition(traveler,[
   {transform:pose(0,0,1),opacity:.92},
   {transform:pose(.35,.13,1.8),opacity:1,offset:.27},
   {transform:pose(.79,.57,2.9),opacity:1,offset:.62},
   {transform:pose(1,1,3.65),opacity:.7}
  ],500,resolve));
  traveler.remove();
  if(landed)return {shell,x:x+dx,y:y+dy,ink};
 }
 function showRerollImpact(impact){
  if(!impact||systemReduce||document.hidden||presentationHidden)return;
  const ring=document.createElement('span');
  ring.className='oa-reroll-impact';ring.setAttribute('aria-hidden','true');
  Object.assign(ring.style,{left:impact.x+'px',top:impact.y+'px',color:impact.ink});
  impact.shell.append(ring);
  playContentTransition(ring,[{transform:'scale(.35)',opacity:.8},{transform:'scale(2.4)',opacity:0}],340,()=>ring.remove());
 }
 function frostTransition(element,duration,_blur,finish){
  if(systemReduce||document.hidden||presentationHidden||!element?.animate)return false;
  // Move composited layers instead of filtering a whole scrolling, frosted page.
  playContentTransition(element,[
   {opacity:.72,transform:'translate3d(0,10px,0) scale(.992)'},
   {opacity:1,transform:'translate3d(0,-1px,0) scale(1.001)',offset:.76},
   {opacity:1,transform:'none'}
  ],duration,finish);
  return true;
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
  if(grid)root.classList.add('oa-hand-entering');
  const overflow=holder.style.overflow||'';holder.style.overflow='hidden';
  playContentTransition(canvas,[{transformOrigin:'50% 50%',transform:'translate('+dx+'px,'+dy+'px) scale('+scale+')',opacity:.88},{transformOrigin:'50% 50%',transform:'none',opacity:1}],310,completed=>{
   root.classList.remove('oa-hand-entering');
   holder.style.overflow=overflow;
   if(completed&&canvas.parentElement===holder&&!busy&&!operationBusy&&!systemReduce&&!document.hidden&&!presentationHidden)die.breathe?.();
  });
  frostTransition(main.querySelector('.oa-roll-heading')||main.querySelector('h1'),220,4);
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
  const page=key.split('|',1)[0];
  const previousPage=previousKey.split('|',1)[0];
  const gamePages=['play','tasks','us','info'];
  const pageChanged=page!==previousPage&&gamePages.includes(page)&&gamePages.includes(previousPage);
  const markup=!welcomeDismissed?renderWelcome():remoteMode&&!remoteReady?renderLogin():tab==='play'?renderPlay():tab==='tasks'?renderTasks():tab==='info'?(infoReading?renderedMarkup:renderInfo()):renderUs();
  const replaceMain=key!==renderKey||markup!==renderedMarkup;
  const animate=key!==renderKey;renderKey=key;
  if(replaceMain){infoReading?.dispose();infoReading=null;cancelContentTransitions();clearCharge(true,false);const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);main.innerHTML=markup;renderedMarkup=markup;}
  root.classList.toggle('oa-entering',animate&&!systemReduce&&!document.hidden&&!presentationHidden);
  root.style.setProperty('--oa-accent',(welcomeDismissed&&canSeeCurrentRound()?category():null)?.color||G.categories[1].color);
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!awaitingPlayer(el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const invitationDot=root.querySelector('.oa-incoming-dot');if(invitationDot)invitationDot.hidden=!awaitingPlayer(viewPlayer);
  const count=root.querySelector('.oa-task-count');
  if(count){
   const awaiting=(state.tasks||[]).filter(task=>!task.checks[viewPlayer]).length;
   count.textContent=String(awaiting);count.hidden=!awaiting;
   count.setAttribute('aria-label',awaiting+' mission'+(awaiting===1?'':'s')+' à cocher');
  }
  if(!replaceMain){infoReading?.refresh();scheduleExpiry();scheduleAutoNewRound();scheduleAutomaticMission();updateBadgeNotice();return;}
  const holder=main.querySelector('[data-stage]');
  if(holder){
   const kind=Number(holder.dataset.kind);
   holder.prepend(canvas);
   die.setKind(kind,Number(holder.dataset.value));
   die.setLabels?.(...diceFaces(holder));
   const theme=category();
   const role=holder.dataset.rollRole;
   const tint=role==='category'?null:kind===8||role==='variant'&&state.round.catalogueVersion>=4?dicePigments[theme?.id]:refusal?.color||theme?.color;
   die.setColor?.(tint);
   die.setReducedMotion(systemReduce);
  }
  else die.pauseMotion?.();
  root.classList.toggle('is-busy',busy||operationBusy);
  animateGauge();
  const frost=pageChanged&&!transition&&frostTransition(main,360,4,completed=>{if(completed&&holder&&canvas.parentElement===holder&&!busy&&!operationBusy)die.breathe?.();});
  if(holder&&animate&&!frost&&!transition&&!document.hidden&&!presentationHidden)die.breathe?.();
  if(animate&&!frost&&!systemReduce&&!document.hidden&&!presentationHidden&&main.animate&&!transition){
   frostTransition(main.querySelector(':scope > .oa-card-stage'),360,5);
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score,:scope > .oa-achievements,:scope > .oa-task-empty');
   blocks.forEach((el,i)=>{
    const pinned=window.getComputedStyle?.(el)?.position==='sticky';
    const start=pinned?{opacity:.65}:{opacity:.55,transform:'translateY(6px)'};
    playContentTransition(el,[start,{opacity:1,transform:'none'}],320,undefined,Math.min(i*24,72));
   });
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
  scheduleAutomaticMission();
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
  const layer=document.createElement('div');layer.className='oa-celebration';layer.setAttribute('aria-hidden','true');layer.style.animation='none';root.querySelector('.oa-shell').append(layer);
  // A brief mineral burst: small, compositor-friendly sparks, without obscuring the content.
  const colors=['#f3e8d9','#b8d7ed','#d0b5e4','#e7b8c8'];
  for(let i=0;i<16;i++){
   const spark=document.createElement('i'),angle=(i/16)*Math.PI*2,distance=68+(i%4)*22,dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance-18;
   spark.style.background=colors[i%colors.length];spark.style.width=(i%3===0?6:4)+'px';spark.style.height=(i%3===0?10:4)+'px';spark.style.borderRadius='50%';layer.append(spark);
   spark.animate([{transform:'translate3d(0,0,0) scale(.15)',opacity:0},{transform:'translate3d('+(dx*.45)+'px,'+(dy*.45-7)+'px,0) scale(1.3)',opacity:1,offset:.34},{transform:'translate3d('+dx+'px,'+dy+'px,0) scale(.55)',opacity:0}],{duration:850+(i%4)*55,easing:'cubic-bezier(.12,.65,.2,1)',fill:'forwards'});
  }
  playContentTransition(layer,[{opacity:0,transform:'scale(.94)'},{opacity:.9,transform:'scale(1.02)',offset:.24},{opacity:0,transform:'scale(1.08)'}],1100,()=>layer.remove());
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
 function canFinalizeCard(){
  return welcomeDismissed&&!busy&&!operationBusy&&!missionSending&&state.phase==='draft'&&canSeeCurrentRound()&&canDraw()&&(!remoteMode||remoteReady);
 }
 function scheduleAutomaticMission(){
  const shouldSend=()=>tab==='play'&&canFinalizeCard()&&state.round.catalogueVersion===G.currentCatalogueVersion&&missionError!==state.round.id&&!canRerollCurrentCard();
  if(missionScheduled||!shouldSend())return;
  const roundId=state.round.id;
  missionScheduled=true;
  Promise.resolve().then(()=>{
   missionScheduled=false;
   if(state.round.id===roundId&&shouldSend())void sendCurrentCard();
  });
 }
 async function sendCurrentCard(){
  if(!canFinalizeCard())return;
  const taskId=state.round.id;
  missionSending=true;
  try{
   const starPenalty=!remoteMode||Array.isArray(remoteSnapshot?.penaltyTaskIds);
   const changed=await dispatch({type:'SEND',...(starPenalty?{starPenalty:true}:{})},false);
   const queued=(ownState?.tasks||state.tasks||[]).some(task=>task.id===taskId);
   missionError=!queued&&state.phase==='draft'&&state.round.id===taskId?taskId:null;
   if(queued)tab='tasks';
   if(changed&&queued)announce('Proposition ajoutée aux Missions.');
  }finally{missionSending=false;render();}
 }
 async function rerollCategory(){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  if(!canRerollCategoryNow())return;
  const roundId=state.round.id,catalogueVersion=drawVersion(),action={type:'REROLL_CATEGORY',catalogueVersion,roundId};
  if(!remoteMode){
   action.at=now();action.value=G.rollCategory(catalogueVersion,G.randomInt,action.at);
   Object.assign(action,G.drawCategory(state,action.value,catalogueVersion,G.randomInt));
  }
  busy=true;setControlsBusy(true);
  try{const changed=await dispatch(action);if(changed){announce('Catégorie relancée.');toast('Thème relancé · 1× aujourd’hui.');}}
  finally{busy=false;setControlsBusy(false);render();}
 }
 async function roll(reroll=false,power=0,direction=null){
  if(!welcomeDismissed||busy||operationBusy||tab!=='play'||remoteMode&&!remoteReady)return;
  const expectedPhase=state.phase,expectedRound=state.round.id;if(!remoteMode){pullShared();if(state.phase!==expectedPhase||state.round.id!==expectedRound){render();return;}}
  if(!hasRollStar()){render();return;}
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  const context={actor,roundId,roomId:remote?.connection?.roomId,epoch:presentationEpoch,categoryId:state.round.categoryId,catalogueVersion:state.round.catalogueVersion??1,intimacyPool:state.round.intimacyPool,hasVariant:G.needsVariant(state.round),hand:[...state.round.hand],discarded:reroll?{cardId:state.round.cardId,slot:state.round.cardRoll}:null};
  let sides,action,faceValue,next,resultLabel,settled=false;
  if(remoteMode&&phase==='category'&&remoteSnapshot?.quota?.remaining===0)return;
  if(reroll){if(!canRerollCurrentCard())return;sides=G.cardSides(state);action={type:'REROLL_CARD'};}
  else if(phase==='category'&&canDraw()){sides=G.rules.categorySides;action={type:'ROLL_CATEGORY',catalogueVersion:drawVersion()};}
  else if(phase==='card'&&canDraw()){sides=G.cardSides(state);action={type:'ROLL_CARD'};}
  else if(phase==='variant'&&canDraw()){sides=G.rules.variantSides;action={type:'ROLL_VARIANT'};}
  else return;
  cancelContentTransitions();
  const starSource=reroll&&context.catalogueVersion===G.currentCatalogueVersion&&!systemReduce&&!document.hidden&&!presentationHidden
   ? Array.from(persona.querySelectorAll?.('[data-stars-for="'+actor+'"] .is-lit')||[]).at(-1):null;
  const starFlight=starSource?.animate?starSource:null;
  const serial=++animationSerial;busy=true;rerolling=reroll?state.round:null;
  if(rerolling&&!starFlight){render();centerStage();}
  setControlsBusy(true);
  context.viewKey=renderKey;
  const button=main.querySelector('[data-action="roll"]');if(button){renderedMarkup='';button.setAttribute('aria-busy','true');}
  const readout=main.querySelector('[data-roll-readout]');
  const waitingTarget=readout||main.querySelector('[data-roll-status]')||(reroll?main.querySelector('[data-action="reroll"]'):null);
  const waitingText=waitingTarget?.textContent||'';
  const clearWaitingText=()=>{if(waitingTarget&&['Relance…','Connexion lente…'].includes(waitingTarget.textContent))waitingTarget.textContent=waitingText;};
  let waitingStartedAt=null,slowConnectionTimer=null;
  try{
   if(remoteMode){
    if(!starFlight&&die.startWaiting?.())waitingStartedAt=performance.now();
    if(reroll&&waitingTarget){waitingTarget.textContent='Relance…';announce('Relance en cours.');}
    if(waitingTarget)slowConnectionTimer=setTimeout(()=>{if(serial===animationSerial&&busy){waitingTarget.textContent='Connexion lente…';announce('Connexion lente, le tirage est en cours.');}},2000);
    const value=await remote.action({...action,roundId});
    clearTimeout(slowConnectionTimer);slowConnectionTimer=null;clearWaitingText();
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
    if(action.type==='ROLL_CATEGORY')Object.assign(action,G.drawCategory(state,faceValue,action.catalogueVersion,G.randomInt));
    const nextRoom=G.reduceRoom(localRoom,{...action,actor,roundId});if(nextRoom===localRoom)return;
    localRoom=nextRoom;syncLocalView();next=state;save();
   }
   if(starFlight&&presentationValid(context)){
    const travel=flyRerollStar(starFlight);
    updateStarBudget(next);
    const impact=await travel;
    if(!presentationValid(context))return;
    render();centerStage();setControlsBusy(true);updateStarBudget(next);
    context.viewKey=renderKey;
    showRerollImpact(impact);
   }
   resultLabel=action.type==='ROLL_CATEGORY'?'Catégorie '+(G.getCategory(next.round.categoryId,next.round.catalogueVersion??1)?.label||G.categories.find(c=>c.number===faceValue)?.label||'tirée') : ['ROLL_CARD','REROLL_CARD'].includes(action.type)?(G.getCard(next.round.cardId,roundVersion(next.round))?.title||'Carte tirée.'):action.type==='ROLL_VARIANT'?(G.getVariant(next.round)||'Variante choisie.'):'Lancer terminé.';
   const visualPower=Number.isFinite(power)?Math.max(0,Math.min(1,power)):0;
   if(!document.hidden&&!presentationHidden){
    activeRollFace={kind:sides,value:faceValue};softSound();
    const timing=waitingStartedAt===null?{duration:systemReduce?0:1650}:{durationMs:Math.max(900,1650+850*visualPower-Math.min(750,Math.max(0,performance.now()-waitingStartedAt)))};
    await die.roll(faceValue,{...timing,power:visualPower,...(direction?{direction}:{})});activeRollFace=null;
   }else die.setKind(sides,faceValue);
   settled=true;
   if(serial===animationSerial&&presentationValid(context)){
    if(['ROLL_CARD','REROLL_CARD'].includes(action.type)){
     const preview={...context,reroll,face:faceValue,cardId:context.hand[faceValue-1]},latest=remoteMode?(deferredSnapshot?focusedReply(deferredSnapshot,roundId):next):state;
     if(!document.hidden&&!presentationHidden&&revealMatches(latest,preview)){
      const anchor=sides===8?die.getResultAnchor?.():null;
      cardReveal=preview;render();setControlsBusy(true);
      const callout=showRollCallout(resultLabel,anchor,G.getCategory(context.categoryId,context.catalogueVersion)?.color);
      announce('D'+sides+' : '+faceValue+'. '+resultLabel);await waitForReveal(callout?calloutReadingMs:900);
     }
    }else if(!document.hidden&&!presentationHidden){
     announce('D'+sides+' : '+faceValue+'. '+resultLabel);
     if(action.type==='ROLL_CATEGORY'){
      const resultTheme=G.getCategory(next.round.categoryId,next.round.catalogueVersion??1);
      die.setColor?.(resultTheme.color);
      if(button)button.setAttribute('aria-busy','false');
      if(readout){readout.textContent=resultTheme.label;readout.classList.add('is-result');}
      const callout=showRollCallout(resultTheme.label,die.getResultAnchor?.(),resultTheme.color);
      await waitForReveal(callout?calloutReadingMs:450);
     }else if(action.type==='ROLL_VARIANT'){
      if(readout){readout.textContent=resultLabel;readout.classList.add('is-result');}
      const callout=showRollCallout(resultLabel,die.getResultAnchor?.(),G.getCategory(context.categoryId,context.catalogueVersion)?.color);
      await waitForReveal(callout?calloutReadingMs:900);
     }
    }
    if(reroll&&!document.hidden&&!presentationHidden&&presentationValid(context))toast('Nouvelle carte.');
   }
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{clearTimeout(slowConnectionTimer);clearWaitingText();if(serial===animationSerial){await die.stopWaiting?.();if(serial!==animationSerial)return;const targetPhase=action.type==='ROLL_CATEGORY'?'card':['ROLL_CARD','REROLL_CARD'].includes(action.type)&&context.hasVariant?'variant':null;const fromStage=settled&&targetPhase&&presentationValid(context)&&!document.hidden&&!presentationHidden?main.querySelector('[data-stage]')?.getBoundingClientRect():null;activeRollFace=null;cardReveal=null;finishRevealWait();busy=false;rerolling=null;setControlsBusy(false);if(remoteMode&&!remote?.authenticated){deferredSnapshot=null;const wasReady=remoteReady;remoteReady=false;if(wasReady)render();}else{if(remoteMode)flushRemote(null,false);render(fromStage&&state.phase===targetPhase&&state.round.id===roundId&&state.round.from===actor?fromStage:null);}}}
 }
 async function refuseTask(taskId){
  const task=state.tasks.find(item=>item.id===taskId);
  if(!task||task.to!==viewPlayer||busy||operationBusy||pendingChecks.size||remoteMode&&!remoteReady||!G.canSpendStar(ownState||state,viewPlayer,serverStamp()))return;
  const context={actor:viewPlayer,roomId:remote?.connection?.roomId,epoch:presentationEpoch},roundId=(ownState||state).round.id;
  const serial=++animationSerial;
  refusal={taskId,title:G.getCard(task.cardId,roundVersion(task)).title,color:G.getCategory(task.categoryId,roundVersion(task))?.color,face:null};
  tab='tasks';busy=true;render();setControlsBusy(true);
  try{
   let face;
   if(remoteMode){
    const value=await remote.action({type:'REFUSE_TASK',roundId,taskId,starCost:1});
    if(value.roll?.kind!==20)throw Error('Unconfirmed refusal roll');
    if(!presentationValid(context))return;
    face=value.roll?.value;
    if(!samePerspective(value,deferredSnapshot)||value.revision>=deferredSnapshot.revision)deferredSnapshot=value;
   }else{
    pullShared();
    if(!G.canSpendStar(localRoom,viewPlayer,now()))return;
    face=G.randomInt(20);
    const next=G.reduceRoom(localRoom,{type:'REFUSE_TASK',roundId,taskId,value:face,actor:viewPlayer,at:now()});
    if(next===localRoom)return;localRoom=next;save();
   }
   if(!presentationValid(context))return;
   if(!refusal)return;
   refusal.face=face;const status=main.querySelector('[data-refusal-status]');if(status)status.textContent='';
   if(!document.hidden&&!presentationHidden){activeRollFace={kind:20,value:face};softSound();await die.roll(face,{duration:systemReduce?0:1650});activeRollFace=null;}else die.setKind(20,face);
   if(presentationValid(context)){
    const result=face>10?'Défi retiré.':'Le défi reste actif.';
    announce('D20 : '+face+'. '+result+' Une étoile dépensée.');
    toast(result+' −1 étoile.');
   }
  }catch(error){if(remoteMode)remoteError(error);else lastError=String(error);}
  finally{if(serial===animationSerial){activeRollFace=null;refusal=null;busy=false;setControlsBusy(false);if(remoteMode){if(remote?.authenticated)flushRemote(null,false);else{remoteReady=false;deferredSnapshot=null;}}else syncLocalView();render();}}
 }
 function openSheet(title,body,extraClass=''){
  if(extraClass!=='oa-achievement-sheet'){badgeSheetOpen=false;badgeSheetMarkup='';badgeDetailId=null;badgeGalleryScroll=null;}
  lastFocus=document.activeElement;
  if(sheet.hidden)sheetContext={bodyOverflow:document.body.style.overflow,mainOverflow:main.style.overflow,top:main.scrollTop,left:main.scrollLeft,key:renderKey};
  sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div><p class="oa-sheet-error" data-sheet-error role="alert" hidden></p>'+body+'</section>';
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

 function rules(){
  const version=drawVersion(),stars=version===G.currentCatalogueVersion;
  const cardRule=stars?'Le D8 choisit la carte, puis le D6 donne la variante.':
   (version===4?'Cocon utilise le D8. Les autres thèmes utilisent le D6.':'Le D6 choisit une carte parmi six.')+
   ' Les cartes classiques ont ensuite une variante D6. Le lot Hardcore contient des cartes prêtes à jouer.';
  const rerollRule=stars?'Une relance de carte coûte une étoile. Chacun en gagne une toutes les 12 h, avec une réserve de trois et une dépense par jour.':'Une fois par tour, la carte peut être relancée avant d’être gardée.';
  const missionRule=stars?'La carte gardée rejoint les Missions. Elle y passe automatiquement quand la relance est épuisée.':'La carte gardée rejoint les Missions.';
  const penaltyRule=(!remoteMode||Array.isArray(remoteSnapshot?.penaltyTaskIds))?
   ' Sur une nouvelle mission, une case vide à l’échéance peut coûter une étoile à son destinataire, une fois par jour. À zéro étoile, les dés reprennent à la recharge.':'';
  openSheet('Les règles.',
   '<div class="oa-rule"><b>↗</b><div><h3>Lancer le dé.</h3><p>Appuie sur le dé ou fais-le glisser dans la direction de ton choix. Maintiens avant de relâcher pour lui donner plus d’élan.</p></div></div>'+
   '<div class="oa-rule"><b>D4</b><div><h3>La catégorie.</h3><p>Le D4 choisit l’une des quatre catégories.</p></div></div>'+
   '<div class="oa-rule"><b>'+(version>=4?'D8':'D6')+'</b><div><h3>La carte.</h3><p>'+cardRule+'</p></div></div>'+
   '<div class="oa-rule"><b>↻</b><div><h3>Une relance.</h3><p>'+rerollRule+'</p></div></div>'+
   '<div class="oa-rule"><b>✓</b><div><h3>Les Missions.</h3><p>'+missionRule+' Le destinataire peut dépenser son étoile du jour pour tenter un refus au D20. De 11 à 20, le défi est retiré. De 1 à 10, il reste actif. L’étoile est dépensée dans les deux cas.'+penaltyRule+'</p></div></div>'+
   '<div class="oa-rule"><b>+1</b><div><h3>Les deux cases, un point.</h3><p>Les propositions restent vingt-quatre heures dans les Missions. Elles quittent la liste après vos deux coches, ou à l’expiration.'+(!remoteMode||remoteSnapshot?.canExtendTasks?' Chacun peut dépenser son étoile du jour pour prolonger une mission en cours de 24 h, une seule fois par mission.':'')+'</p></div></div>'+
   '<div class="oa-actions">'+btn('Fermer','close')+'</div>');
 }

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
  if(action==='duo-motion'){
   const resume=el.getAttribute('aria-pressed')==='false';
   el.setAttribute('aria-pressed',String(resume));
   el.title=resume?'Mettre l’animation en pause':'Relancer l’animation';
   return;
  }
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
  if(action==='open-joker'){if(jokerAvailable())openSheet('Choisir le thème',categoriesGrid());return;}
  if(action==='joker'){const category=Number(el.dataset.category);closeSheet();if(!jokerAvailable()||!Number.isInteger(category)||category<1||category>4){render();return;}const catalogueVersion=drawVersion(),act={type:'JOKER_DRAW',category,catalogueVersion,roundId:state.round.id};if(!remoteMode){act.at=now();act.value=category;Object.assign(act,G.drawCategory(state,category,catalogueVersion,G.randomInt));}const ok=await dispatch(act);if(ok)toast('Joker : thème '+((G.categories.find(c=>c.number===category)||{}).label||'choisi')+' !');render();return;}
  if(action==='reroll-category'){await rerollCategory();return;}
  if(action==='tab'){tab=['us','tasks','info'].includes(el.dataset.tab)?el.dataset.tab:'play';render();main.scrollTop=0;main.scrollLeft=0;return;}
  if(action==='info-idea'){showInfoIdea();return;}
  if(action==='profile'){
   if(remoteMode)return;
   if(tab==='us')tab='play';
   changeView(el.dataset.player);
   announce('Profil : '+name(viewPlayer));return;
  }
  if(action==='own-draw'){tab='play';selectedIncomingRoundId=null;openedInvitation=null;if(remoteMode)selectDisplayState();else syncLocalView();render();return;}
  if(action==='open-invitation'){if(isParallel()&&incomingStates.some(incoming=>incoming.round.id===el.dataset.round)){selectedIncomingRoundId=el.dataset.round;selectDisplayState();}if(remoteMode){try{flushRemote(await remote.refresh(),false);}catch(error){remoteError(error);}}else pullShared();if(el.dataset.round===state.round.id&&G.canRespond(state))openedInvitation=invitationKey();render();return;}
  if(action==='send'){await sendCurrentCard();return;}
  if(action==='extend-task-confirm'){
   const task=state.tasks.find(item=>item.id===el.dataset.task);
   if(pendingChecks.size||!canExtendMission(task))return;
   openSheet('Prolonger de 24 h ?', '<p>Une étoile de ta réserve ajoute 24 h à l’échéance de cette mission pour vous deux.</p><div class="oa-actions">'+btn('Dépenser 1 étoile','extend-task','','data-task="'+h(task.id)+'"')+textBtn('Annuler','close')+'</div>');
   return;
  }
  if(action==='extend-task'){
   const taskId=el.dataset.task,task=state.tasks.find(item=>item.id===taskId);
   closeSheet();
   if(!canExtendMission(task)){render();toast('Cette mission ne peut plus être prolongée.');return;}
   const changed=await dispatch({type:'EXTEND_TASK',taskId});
   if(changed){announce('Mission prolongée de 24 heures.');toast('Mission prolongée de 24 h.');}
   return;
  }
  if(action==='refuse-task'){await refuseTask(el.dataset.task);return;}
  if(action==='new'){gaugeFrames.clear();tab='play';await dispatch({type:'NEW_ROUND'});return;}
  if(action==='logout-confirm'){
   openSheet('Déconnecter cet appareil ?', '<p>Cet appareil perdra l’accès à ton compte. Tu pourras te reconnecter avec ton identifiant et ton mot de passe.</p><div class="oa-actions">'+btn('Déconnecter','logout','oa-secondary')+textBtn('Annuler','close')+'</div>');return;
  }
  if(action==='revoke-others-confirm'){
   openSheet('Déconnecter tes autres appareils ?', '<p>Les autres appareils connectés à ton compte devront se reconnecter. Celui-ci et le compte de ton partenaire restent connectés.</p><div class="oa-actions">'+btn('Déconnecter les autres appareils','revoke-others','oa-secondary')+textBtn('Annuler','close')+'</div>');return;
  }
  if(action==='logout'||action==='revoke-others'){
   if(!remoteMode||!remote?.authenticated)return;
   operationBusy=true;el.disabled=true;
   try{
    if(action==='logout'){
     await remote.logout();
     presentationEpoch++;clearMemberPortraits();clearBadgeContext();remoteReady=false;remoteSnapshot=null;deferredSnapshot=null;remoteSignature='';authBusy=false;loginError='';tab='play';closeSheet();render();
    }else{await remote.revokeOtherDevices();closeSheet();toast('Tes autres appareils ont été déconnectés.');}
   }catch(error){remoteError(error);}
   finally{operationBusy=false;if(el.isConnected)el.disabled=false;render();}
   return;
  }
  if(action==='enable-notifications'){operationBusy=true;el.disabled=true;try{await remote.enableNotifications();}catch(error){remoteError(error);}finally{operationBusy=false;flushRemote(null,false);render();}return;}
  if(action==='rules'){rules();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reset-confirm'){if(remoteMode)return;openSheet('Repartir de zéro ?','<p>La partie, le score commun, les favoris et les préférences de cette démonstration seront effacés.</p><div class="oa-actions">'+btn('Effacer la démo','reset','oa-clay')+textBtn('Conserver ma partie','close')+'</div>');return;}
  if(action==='reset'){if(remoteMode)return;closeSheet();tab='play';missionError=null;gaugeFrames.clear();await dispatch({type:'RESET'});syncLocalView();toast('La démonstration repart de zéro.');return;}
 });
 root.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;startCharge(rollButton(event.target),'pointer',event);});
 root.addEventListener('pointermove',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId&&!charge.swipe&&Math.hypot(event.clientX-charge.x,event.clientY-charge.y)>10)clearCharge();});
 root.addEventListener('pointerup',async event=>{if(charge?.source==='pointer')await releaseCharge(event);else if(suppressedClick?.source==='pointer'&&event.pointerId===suppressedClick.pointerId)suppressedClick.until=chargeNow()+600;});
 root.addEventListener('pointercancel',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId)clearCharge();});
 root.addEventListener('lostpointercapture',event=>{if(charge?.source==='pointer'&&event.pointerId===charge.pointerId)clearCharge();});
 root.addEventListener('focusout',event=>{if(charge?.source==='keyboard'&&event.target===charge.button)clearCharge();});
 root.addEventListener('contextmenu',event=>{if(rollButton(event.target))event.preventDefault();});
 root.addEventListener('keyup',async event=>{if((event.code==='Space'||event.key===' ')&&rollButton(event.target)){event.preventDefault();if(charge?.source==='keyboard')await releaseCharge(event);}});
 window.addEventListener('blur',()=>clearCharge());
 window.addEventListener('scroll',()=>clearCharge(),{capture:true,passive:true});
 window.addEventListener('keyup',event=>{if(event.code==='Space'||event.key===' '){if(charge?.source==='keyboard')clearCharge();if(suppressedClick?.source==='keyboard')suppressedClick.until=chargeNow()+600;}});
 function updateReducedMotion(event){systemReduce=event.matches;infoReading?.updateMotion();die.setReducedMotion(systemReduce);root.classList.remove('oa-entering');cancelContentTransitions();if(systemReduce)stopBadgeNoticeAnimation();(root.getAnimations?.({subtree:true})||[]).forEach(a=>{if(!a.effect?.target?.closest?.('.oa-duo-wave'))a.cancel();});}
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
   const celebrationContext={epoch:presentationEpoch,actor:viewPlayer,roomId:remote?.connection?.roomId};
   if(!completed&&!state.tasks.some(item=>item.id===id)){pendingChecks.delete(id);flushRemote(null,false);render();return;}
   el.checked=desired;const label=el.closest('label');label.classList.add('is-waving');const article=el.closest('.oa-task');
   if(completed&&!systemReduce&&article.animate)article.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],{duration:180,delay:1020,fill:'forwards',easing:'ease-out'});
   setTimeout(()=>{
    pendingChecks.delete(id);if(remoteMode)flushRemote(null,false);render();
    const sameContext=celebrationContext.epoch===presentationEpoch&&celebrationContext.actor===viewPlayer&&(!remoteMode||remoteReady&&remote?.authenticated&&celebrationContext.roomId===remote.connection?.roomId);
    if(completed&&sameContext&&tab==='tasks'&&sheet.hidden&&!document.hidden&&!presentationHidden){announce('Action partagée. Un point ajouté au duo.');toast('+1 point pour votre duo.');celebrate();}
   },systemReduce?0:1200);
   return;
  }
  if(el.dataset.pref==='ambient'){setAmbientMotion(el.checked);infoReading?.updateMotion();infoReading?.refresh();return;}
  if(el.dataset.pref){await dispatch({type:'SET_PREFS',patch:{[el.dataset.pref]:el.checked}});die.setReducedMotion(!!systemReduce);if(el.dataset.pref==='sound'&&el.checked)softSound();}
 });
 setInterval(async()=>{
  if(document.hidden||busy||operationBusy||missionSending||pendingChecks.size)return;
  if(welcomeDismissed&&(!remoteMode||remoteReady))updateStarBudget();
  const needsReading=tab==='tasks'||tab==='play';
  if(remoteMode){if(remoteReady&&needsReading)render();}
  else{const changed=await dispatch({type:'EXPIRE_TASKS'},false);if(changed||needsReading||tab==='info')render();}
 },30000);
 document.addEventListener('visibilitychange',()=>{syncDuoVisibility();if(document.hidden){clearCharge();cancelContentTransitions();die.pauseMotion?.();if(activeRollFace)die.setKind(activeRollFace.kind,activeRollFace.value);finishRevealWait();}if(!document.hidden){updateViewportHeight();if(!remoteMode)pullShared();else resumeMemberPortraits();if(!busy&&!operationBusy&&!missionSending&&!pendingChecks.size)render();}updateBadgeNotice();});
 window.addEventListener('storage',event=>{if(event.key===ambientMotionKey){setAmbientMotion(event.newValue!=='0',false);infoReading?.updateMotion();infoReading?.refresh();}if(!remoteMode&&event.key===storageKey&&receiveShared(event.newValue)&&!busy&&!operationBusy&&!pendingChecks.size)render();if(event.key===badgeRegistryKey){let value;try{value=JSON.parse(event.newValue);}catch(_){}mergeBadgeRegistry(value);updateBadgeNotice();}});
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
     clearMemberPortraits();
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
  const shellVersion=document.querySelector('meta[name="onde-version"]')?.content;
  const scope=new URL('./',location.href),script=new URL('./sw.js',scope),releaseKey='d6-release';
  let pendingRelease=null,checking=false;
  const opened=new URL(location.href);
  if(opened.searchParams.get(releaseKey)===shellVersion){
   opened.searchParams.delete(releaseKey);
   history.replaceState(history.state,'',opened.href);
  }
  const switchShell=(manual=false)=>{
   if(!pendingRelease||document.hidden||busy||operationBusy||missionSending||pendingChecks.size||charge||!sheet.hidden)return false;
   if(!manual&&(authBusy||Array.from(main.querySelectorAll('[data-login-form] input')).some(input=>input.value)))return false;
   const target=new URL(location.href);
   if(target.searchParams.get(releaseKey)===pendingRelease){
    if(!manual)return false;
    location.reload();
   }else{
    target.searchParams.set(releaseKey,pendingRelease);
    location.replace(target.href);
   }
   return true;
  };
  const showShellUpdate=()=>{
   if(root.querySelector('.oa-update'))return;
   const bar=document.createElement('section');bar.className='oa-update';bar.setAttribute('aria-label','Mise à jour disponible');
   const label=document.createElement('span');label.textContent='Une mise à jour de D6 à deux est prête.';
   const reload=document.createElement('button');reload.type='button';reload.textContent='Recharger';
   reload.addEventListener('click',()=>{if(!switchShell(true))announce('Attends la fin de l’action en cours.');});
   bar.append(label,reload);root.querySelector('.oa-messages').append(bar);announce('Une mise à jour de D6 à deux est prête. Recharge pour l’utiliser.');
  };
  swApi.addEventListener('message',event=>{
   const update=event.data;
   if(event.source?.scriptURL===script.href&&update?.type==='desir-shell-active'&&shellVersion&&
     typeof update.version==='string'&&/^\d+\.\d+\.\d+$/.test(update.version)&&
     update.version.localeCompare(shellVersion,'en',{numeric:true})>0){
    pendingRelease=update.version;
    if(!switchShell())showShellUpdate();
   }
  });
  const askShellVersion=()=>{
   const controller=swApi.controller;
   if(controller?.scriptURL===script.href)controller.postMessage({type:'desir-shell-version'});
  };
  const checkShellUpdate=async()=>{
   if(document.hidden||checking||switchShell())return;
   askShellVersion();checking=true;
   try{
    const registration=await swApi.getRegistration(scope.href);
    if(registration?.scope===scope.href)await registration.update();
    else await swApi.register(script.href,{scope:scope.pathname,updateViaCache:'none'});
   }catch(_){}finally{checking=false;}
  };
  swApi.addEventListener('controllerchange',askShellVersion);
  document.addEventListener('visibilitychange',checkShellUpdate);
  for(const event of ['pageshow','online','focus'])window.addEventListener(event,checkShellUpdate);
  checkShellUpdate();
 }
 root.dataset.ready='true';
})();
