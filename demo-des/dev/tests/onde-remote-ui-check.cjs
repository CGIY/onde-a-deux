// Run the actual UI against a controlled authenticated transport and DOM shell.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/onde-app-ui.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const cardNotesFixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/card-notes.json'),'utf8'));
const roleplayFixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/card-roleplay.json'),'utf8'));
function roleplayCount(html){return (html.match(/class="oa-roleplay(?:\s[^"]*)?"/g)||[]).length;}
function finalGame(cardId,variant=1,actor='a'){
 const c=G.getCard(cardId),category=G.categories.find(item=>item.id===c.categoryId);
 let game=drawModern(initial(),category.number);
 game=G.reduce(game,{type:'ROLL_CARD',value:game.round.hand.indexOf(cardId)+1});
 game=G.reduce(game,{type:'ROLL_VARIANT',value:variant});
 game.activePlayer=actor;assert.equal(game.phase,'draft');assert.ok(G.validateState(game));return game;
}
function escapedText(text){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hasTitle(html,title){const escaped=escapedText(title);return html.includes('>'+escaped+'</h2>')||html.includes('>'+escaped+'</h3>')||html.includes('title="'+escaped+'"');}
function assertNoEvidence(html){assert.doesNotMatch(html,/oa-card-fact|oa-source|data-source-card|Source & contexte|repère|statistique/i);}
let checks=0;const check=fn=>{fn();checks++;};
const roomId='b98c371d-6355-4d37-a9bc-18f1228fd386';
function initial(actor='a'){const s=G.createState();s.activePlayer=actor;s.players=[{id:'a',name:'Personne A'},{id:'b',name:'Personne B'}];return s;}
function drawModern(state=initial(),value=2){
 const category=G.categories.find(c=>c.number===value);
 return G.reduce(state,{type:'ROLL_CATEGORY',catalogueVersion:2,value,hand:G.cards.filter(c=>c.categoryId===category.id).map(c=>c.id)});
}
function scored(total,actor='a'){const s=initial(actor);s.stats.totalCompleted=total;s.stats.byCategory.attention=total;assert.ok(G.validateState(s));return s;}
function gradeSection(html){const found=html.match(/<section class="oa-grade-area[^"]*"[\s\S]*?<\/section>/);assert.ok(found,'grade section is rendered');return found[0];}
function gradeProgress(html){const section=gradeSection(html),progress=section.match(/role="progressbar"[^>]+/)[0];return {points:Number((section.match(/data-grade="(\d+)"/)||[])[1])||null,max:Number(progress.match(/aria-valuemax="(\d+)"/)[1]),value:Number(progress.match(/aria-valuenow="(\d+)"/)[1])};}
function draftGame(actor='a',face=1){let s=initial();s=G.reduce(s,{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)});s=G.reduce(s,{type:'ROLL_CARD',value:face});s.activePlayer=actor;assert.ok(G.validateState(s));return s;}
function snap(state,revision=1,remaining=1){return {roomId,state:copy(state),revision,actor:state.activePlayer,paired:true,drawAvailable:state.phase==='category',quota:{remaining,window:'2026-11-02T06:00',label:'6 h – 12 h',nextAt:'2026-11-02T11:00:00.000Z'},serverTime:new Date().toISOString()};}
function roomSnapshot(room,actor='a',revision=1,remaining=1){
 const own=G.roomView(room,actor),partner=G.roomView(room,actor,room.lanes[G.otherPlayer(actor)].round.id);
 return {...snap(own,revision,remaining),gameVersion:3,incoming:partner.phase!=='category'&&G.canSeeRound(partner,actor)?[partner]:[]};
}
function roomDraw(room,owner,category=1,card=1,variant=1){
 const roundId=room.lanes[owner].round.id;
 for(const action of [{type:'ROLL_CATEGORY',catalogueVersion:2,value:category,hand:G.cards.filter(c=>c.categoryId===G.categories[category-1].id).map(c=>c.id)},{type:'ROLL_CARD',value:card},{type:'ROLL_VARIANT',value:variant}])room=G.reduceRoom(room,{...action,actor:owner,roundId});
 return room;
}
function mockRemote(restored=null){
 let listener=null,current=restored,identity=restored?{roomId,actor:restored.actor}:null,authenticated=!!restored;
 const calls=[],r={enabled:true,status:{phase:restored?'connected':'disconnected',message:'',errorCode:null},notificationStatus:{supported:true,permission:'default',subscribed:false,message:''},calls,get connection(){return identity;},get authenticated(){return authenticated;},get snapshot(){return current&&copy(current);},subscribeToChanges(fn){listener=fn;return()=>listener=null;},start(){calls.push({method:'start'});},restore:async()=>current&&copy(current),refresh:async()=>current&&copy(current),async login(username,password){calls.push({method:'login',username,password});r.status={phase:'connecting',message:'',errorCode:null};r.emit();try{const next=await (r.loginImpl?r.loginImpl(username,password):snap(initial()));identity={roomId,actor:next.actor};authenticated=true;r.status={phase:'connected',message:'',errorCode:null};r.emit(next);return copy(next);}catch(error){r.status={phase:'error',message:error.message,errorCode:error.code};r.emit();throw error;}},async action(action){calls.push({method:'action',action:copy(action)});const next=await r.actionImpl(action);r.emit({...next,roll:undefined});return copy(next);},async enableNotifications(){calls.push({method:'notifications'});r.notificationStatus={...r.notificationStatus,permission:'granted',subscribed:true};r.emit();return r.notificationStatus;},emit(next){if(next)current=copy(next);if(listener)listener({snapshot:current&&copy(current),status:{...r.status},notificationStatus:{...r.notificationStatus}});},revoke(){authenticated=false;r.status={phase:'error',message:'Reconnecte cet appareil.',errorCode:'unauthorized'};r.emit();}};
 return r;
}
function shell(remote,{mode=true,delayedDie=false,welcomeSeen=true,storageValues=null,storageBlocked=false,reduced=false,randomFace=null,evidenceTrap=true,mobileScroll=false,viewport=null,autoReveal=true,autoResult=true,installed=false,layoutHeight=874,notes=cardNotesFixture,roleplay=roleplayFixture,motionAPI=false,legacyMotionQuery=false,queryAnimations=true}={}){
 const values=storageValues||new Map();if(welcomeSeen)values.set('desir-welcome-v1','1');
 const handlers={},windowHandlers={},documentHandlers={},timers=[],intervals=[];let mainHTML='',writes=0,rngCalls=0,evidenceReads=0,dieRunning=false,interrupted=0,resolveDie=null,diceCanvas=null;const rngSides=[],gradeAnimations=[],motionAnimations=[],frames=new Map(),elementScrolls=[],scrollCalls=[],announcements=[];let clockMs=0,frameId=0,canvasRelease=null,currentStage=null,currentGrid=null;
 let document,motionChange;
 function node(dataset={}){const classes=new Set();const element={dataset,hidden:false,disabled:false,inert:false,isConnected:true,innerHTML:'',textContent:'',value:'',checked:false,scrollTop:0,scrollLeft:0,clientHeight:600,children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,v){if(v)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},style:{values:new Map(),setProperty(k,v){this.values.set(k,v);},getPropertyValue(k){return this.values.get(k)||'';}},getBoundingClientRect(){return {left:0,top:0,right:240,bottom:50,height:50,width:240};},setAttribute(k,v){this[k]=String(v);},removeAttribute(k){delete this[k];},focus(options){this.focusOptions=options;document.activeElement=this;},matches(){return false;},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},append(x){this.children.push(x);},prepend(x){x.parentElement=this;},removeChild(x){x.parentElement=null;},scrollIntoView(options){elementScrolls.push({node:this,options});},scrollTo(options){this.scrollTop=options.top||0;this.scrollLeft=options.left||0;scrollCalls.push({node:this,options});}};if(motionAPI)element.animate=(keyframes,options)=>{const animation={node:element,keyframes,options,cancelled:false,finished:false,cancel(){this.cancelled=true;this.oncancel?.();},finish(){this.finished=true;this.onfinish?.();}};motionAnimations.push(animation);return animation;};return element;}
 const root=node(),main=node(),sheet=node(),persona=node(),navigation=node(),toast=node(),announcement=node(),help=node(),count=node(),incoming=node(),title=node(),username=node(),password=node(),loginMessage=node(),rollButton=node({action:'roll'}),rollStatus=node(),shellNode=node(),dialog=node(),closeButton=node({action:'close'});
 main.getBoundingClientRect=()=>({left:0,top:100,right:402,bottom:700,width:402,height:600});
 sheet.querySelector=selector=>selector==='button'?closeButton:selector==='.oa-sheet'?dialog:null;sheet.querySelectorAll=()=>[closeButton];let announced='';Object.defineProperty(announcement,'textContent',{get:()=>announced,set:value=>{announced=value;announcements.push(value);}});
 sheet.hidden=true;persona.innerHTML='DEMO-PROFILE-CONTROLS';username.matches=password.matches=selector=>selector==='input,textarea,[contenteditable="true"]';
 const navButtons=['play','tasks','us'].map(tab=>node({action:'tab',tab}));
 const profileButtons=['a','b'].map(player=>node({action:'profile',player}));
 const actionButtons=new Map([['roll',rollButton],...['reroll','send','accept','new','challenge','challenge-draft'].map(action=>[action,node({action})])]);for(const button of actionButtons.values())button.closest=()=>button;
 const controls=[...navButtons,...profileButtons,help,...actionButtons.values()];
 Object.defineProperty(main,'innerHTML',{get:()=>mainHTML,set:value=>{mainHTML=value;currentStage=null;currentGrid=null;writes++;main.scrollTop=0;main.scrollLeft=0;if(value.includes('id="oa-username"')){username.value=(value.match(/id="oa-username"[^>]*value="([^"]*)"/)||[])[1]||'';password.value='';}}});
 main.querySelector=selector=>{
  if(selector==='[data-reveal-selected]'){const face=Number((mainHTML.match(/data-reveal-selected aria-label="Carte (\d) choisie"/)||[])[1]);if(!face)return null;const tile=node();tile.getBoundingClientRect=()=>({left:0,right:140,top:face>3?780:350,bottom:face>3?884:454,height:104,width:140});return tile;}
  if(selector==='[data-grade]'){const match=mainHTML.match(/data-grade="(\d+)"/);if(!match)return null;const grade=node({grade:match[1]});grade.animate=(frames,options)=>gradeAnimations.push({frames,options});return grade;}
  if(selector==='h1')return mainHTML.includes('<h1')?title:null;
  if(selector==='[data-roll-status]')return mainHTML.includes('data-roll-status')?rollStatus:null;
  if(selector==='[data-login-error]')return mainHTML.includes('data-login-error')?loginMessage:null;
  if(selector==='[data-stage]'){const match=mainHTML.match(/data-stage data-kind="(\d+)" data-value="([^"]*)"/);if(!match)return null;if(!currentStage){currentStage=node({kind:match[1],value:match[2],rollRole:(mainHTML.match(/data-roll-role="([^"]+)"/)||[])[1]});const height=currentStage.dataset.rollRole==='category'?420:300;currentStage.getBoundingClientRect=()=>({left:10,top:150,right:392,bottom:150+height,width:382,height});}return currentStage;}
  if(selector==='.oa-card-grid'){if(!mainHTML.includes('class="oa-card-grid'))return null;if(!currentGrid){currentGrid=node();currentGrid.children=Array.from({length:(mainHTML.match(/class="oa-mini-card /g)||[]).length},()=>node());currentGrid.querySelectorAll=selector=>selector==='.oa-mini-card'?currentGrid.children:[];}return currentGrid;}
  const action=selector.match(/^\[data-action="([^"]+)"\]$/);if(action)return mainHTML.includes('data-action="'+action[1]+'"')?actionButtons.get(action[1])||null:null;
  return null;
 };
 main.querySelectorAll=selector=>selector==='button,input'?Array.from(actionButtons.values()).filter(el=>mainHTML.includes('data-action="'+el.dataset.action+'"')):[];
 main.contains=el=>el===title&&mainHTML.includes('<h1')||[username,password].includes(el)&&mainHTML.includes('id="oa-username"')||Array.from(actionButtons.values()).includes(el)&&mainHTML.includes('data-action="'+el.dataset.action+'"');
 root.contains=()=>true;if(queryAnimations)root.getAnimations=()=>[];
 root.addEventListener=(type,handler)=>{handlers[type]=handler;};
 root.querySelector=selector=>({'#oa-main':main,'#oa-sheet':sheet,'.oa-persona':persona,'.oa-nav':navigation,'#oa-toast':toast,'#oa-announcement':announcement,'[data-action="rules"]':help,'.oa-task-count':count,'.oa-incoming-dot':incoming,'.oa-shell':shellNode,'#oa-username':username,'#oa-password':password}[selector]||null);
 root.querySelectorAll=selector=>selector==='.oa-nav button'?navButtons:selector==='.oa-switch [data-action="profile"]'?profileButtons:controls;
 shellNode.children=[persona,main,navigation,toast,sheet,announcement];
 document={activeElement:null,hidden:false,documentElement:{clientHeight:layoutHeight},body:{style:{}},getElementById:id=>id==='onde-app-v1'?root:null,createElement:()=>node(),addEventListener(type,fn){documentHandlers[type]=fn;}};
 const die={setKind(kind,value){if(dieRunning){interrupted++;resolveDie?.();}die.kinds.push([kind,value]);},setReducedMotion(value){die.reduced.push(value);},setColor(color){die.colors.push(color);},setCharge(power){die.charges.push(power);},async roll(value,options){die.calls.push(value);die.options.push(options);die.visible.push(!!diceCanvas?.parentElement&&mainHTML.includes('data-stage'));dieRunning=true;if(delayedDie)await new Promise(resolve=>resolveDie=resolve);dieRunning=false;},calls:[],kinds:[],options:[],visible:[],charges:[],colors:[],reduced:[]};
 const ctx={visualViewport:viewport,getComputedStyle:()=>({overflowY:mobileScroll?(main.style.overflow||'auto'):'visible'}),performance:{now:()=>clockMs},requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},console,Date,Map,Set,Array,JSON,String,Number,Math,Promise,document,localStorage:{getItem(k){if(storageBlocked)throw Error('Storage unavailable');return values.get(k)||null;},setItem(k,v){if(storageBlocked)throw Error('Storage unavailable');values.set(k,String(v));},removeItem(k){if(storageBlocked)throw Error('Storage unavailable');values.delete(k);}},sessionStorage:{getItem(){return null;},setItem(){}},OndeGame:{...G,randomInt(n){rngCalls++;rngSides.push(n);return randomFace===null?G.randomInt(n):randomFace;}},OndeDice:{create:(canvas,options)=>{diceCanvas=canvas;canvasRelease=options.onRelease;return die;}},DesirCardNotes:notes,DesirRoleplay:roleplay,OndeRemote:{create:()=>remote},DesirConfig:mode?{endpoint:'https://example.supabase.co/functions/v1/desir-game'}:{},matchMedia:query=>({matches:query==='(display-mode: standalone)'?installed:reduced,...(legacyMotionQuery?{addListener(fn){if(query.includes('prefers-reduced-motion'))motionChange=fn;}}:{addEventListener(type,fn){if(query.includes('prefers-reduced-motion'))motionChange=fn;}})}),setTimeout(fn,ms){const timer={fn,ms,active:true,scrollTop:main.scrollTop};timers.push(timer);if(ms===2800&&autoReveal||ms===1800&&autoResult)Promise.resolve().then(()=>{if(timer.active){timer.active=false;fn();}});return timers.length;},clearTimeout(id){if(timers[id-1])timers[id-1].active=false;},setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},clearInterval(){},addEventListener(type,fn){windowHandlers[type]=fn;},removeEventListener(type,fn){if(windowHandlers[type]===fn)delete windowHandlers[type];}};
 if(roleplay===null)delete ctx.DesirRoleplay;
 if(evidenceTrap)for(const key of ['OndeEvidence','OndeEvidenceData'])Object.defineProperty(ctx,key,{get(){evidenceReads++;throw Error('Statistics must never be accessed by the game UI');}});
 ctx.window=ctx;
 vm.runInNewContext(code,ctx,{filename:'onde-app-ui.js'});
 function event(target,props={}){return {target,detail:0,preventDefault(){this.defaultPrevented=true;},...props};}
 return {root,main,sheet,persona,navigation,help,motionAnimations,setMotion(matches){motionChange({matches});},get canvas(){return diceCanvas;},get stage(){return currentStage;},get grid(){return currentGrid;},username,password,loginMessage,rollStatus,die,rngSides,gradeAnimations,controls,timers,intervals,values,announcement,toast,dialog,closeButton,elementScrolls,scrollCalls,announcements,bodyStyle:document.body.style,get html(){return mainHTML;},get diceVisible(){return !!diceCanvas?.parentElement&&mainHTML.includes('data-stage');},get activeElement(){return document.activeElement;},get writes(){return writes;},get rngCalls(){return rngCalls;},get evidenceReads(){return evidenceReads;},get interrupted(){return interrupted;},get frameCount(){return frames.size;},get resultPending(){return timers.filter(timer=>timer.ms===1800&&timer.active).length;},finishResult(){const timer=timers.findLast(timer=>timer.ms===1800&&timer.active);assert.ok(timer,'a category result is pending');timer.active=false;timer.fn();},get revealPending(){return timers.filter(timer=>timer.ms===2800&&timer.active).length;},finishReveal(){const timer=timers.findLast(timer=>timer.ms===2800&&timer.active);assert.ok(timer,'a reveal is pending');timer.active=false;timer.fn();},documentEvent(type,props={}){if(typeof props.hidden==='boolean')document.hidden=props.hidden;return documentHandlers[type]?.(event(null,props));},advance(ms){clockMs+=ms;const pending=Array.from(frames.values());frames.clear();for(const fn of pending)fn();},windowEvent(type,props={}){return windowHandlers[type]?.(event(null,props));},async pointer(type,action='roll',props={}){const button=actionButtons.get(action);return handlers[type](event(button,{button:0,isPrimary:true,pointerId:1,clientX:50,clientY:25,...props}));},async key(type,key=' ',props={}){const button=actionButtons.get('roll');if(type==='keydown'&&!props.noFocus)button.focus();return handlers[type](event(button,{key,code:key===' '?'Space':key,...props}));},button(action='roll'){return actionButtons.get(action);},async releaseCanvas(power){return canvasRelease(power);},finishDie(){resolveDie();},async click(action,extra={},detail=0){const el=actionButtons.get(action)||node({action,...extra});el.closest=()=>el;await handlers.click(event(el,{detail}));return el;},async submit(user,secret){username.value=user;password.value=secret;const form=node();form.matches=selector=>selector==='[data-login-form]';return handlers.submit(event(form));},async taskCheck(id,checked){const label=node(),article=node(),input=node({taskCheck:id,player:'a'});input.checked=checked;input.closest=selector=>selector==='label'?label:article;const promise=handlers.change(event(input));return {input,label,promise};}};
}
async function rollSession(options={}){
 const remote=mockRemote(snap(initial()));remote.actionImpl=async action=>{assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',catalogueVersion:2,roundId:'onde-1'});const game=drawModern(remote.snapshot.state);return {...snap(game,remote.snapshot.revision+1,0),roll:{kind:4,value:2}};};
 const ui=shell(remote,options);await tick();return {remote,ui};
}
(async()=>{
 // Runtime accessibility changes work with both MediaQueryList APIs and no getAnimations.
 for(const legacyMotionQuery of [false,true]){
  const ui=shell(mockRemote(),{mode:false,legacyMotionQuery,queryAnimations:false});
  check(()=>assert.equal(ui.root.classList.contains('oa-entering'),true));
  ui.setMotion(true);check(()=>{assert.equal(ui.die.reduced.at(-1),true);assert.equal(ui.root.classList.contains('oa-entering'),false);});
  ui.setMotion(false);check(()=>{assert.equal(ui.die.reduced.at(-1),false);assert.equal(ui.root.classList.contains('oa-entering'),false);});
 }
 // Final roleplay copy follows the exact variant, not merely the parent card.
 {
  const cardId='six-attention-cadeau',first=roleplayFixture.cards[cardId+':v1'],second=roleplayFixture.cards[cardId+':v6'];
  check(()=>{assert.ok(first);assert.ok(second);assert.notEqual(first.text,second.text);});
  for(const variant of [1,6]){
   const game=finalGame(cardId,variant),before=copy(game),entry=roleplayFixture.cards[cardId+':v'+variant],other=variant===1?second:first;
   const remote=mockRemote(snap(game)),ui=shell(remote);await tick();
   check(()=>{assert.equal(roleplayCount(ui.html),1);assert.ok(ui.html.includes('class="oa-roleplay-value"'));assert.ok(ui.html.includes('class="oa-roleplay-copy"'));assert.ok(ui.html.includes(escapedText(entry.metric)));assert.ok(ui.html.includes(escapedText(entry.text)));assert.ok(!ui.html.includes(escapedText(other.text)));assert.ok(ui.html.includes('Club des Deux'));assert.ok(ui.html.includes('Roleplay'));assert.doesNotMatch(ui.html,/<a\b|Source & contexte|data-source-card/);assert.equal(ui.evidenceReads,0);});
   const without=shell(mockRemote(snap(game)),{roleplay:null});await tick();
   check(()=>{assert.equal(roleplayCount(without.html),0);assert.ok(hasTitle(without.html,G.getCard(cardId).title));for(const action of ['send','challenge-draft'])assert.equal(ui.html.includes('data-action="'+action+'"'),without.html.includes('data-action="'+action+'"'));assert.deepEqual(game,before);assert.equal(game.stats.totalCompleted,0);assert.equal(G.rules.completedCardPoints,1);assert.equal(remote.calls.filter(call=>call.method==='action').length,0);});
  }
 }
 // Neither unfinished variants nor unopened/private invitations reveal roleplay copy.
 {
  const cardId='six-attention-cadeau',entry=roleplayFixture.cards[cardId+':v1'];
  let game=drawModern(initial(),2);game=G.reduce(game,{type:'ROLL_CARD',value:game.round.hand.indexOf(cardId)+1});
  const unfinished=shell(mockRemote(snap(game)));await tick();
  check(()=>{assert.equal(game.phase,'variant');assert.equal(roleplayCount(unfinished.html),0);assert.ok(!unfinished.html.includes(escapedText(entry.text)));});
  const privateGame=finalGame(cardId,1,'b'),hidden=shell(mockRemote(snap(privateGame)));await tick();
  check(()=>{assert.equal(roleplayCount(hidden.html),0);assert.ok(!hidden.html.includes(escapedText(entry.metric)));assert.ok(!hidden.html.includes(escapedText(entry.text)));assert.ok(!hasTitle(hidden.html,G.getCard(cardId).title));});
  game=G.reduce(finalGame(cardId,1),{type:'SEND',at:new Date().toISOString()});game.activePlayer='b';
  const received=shell(mockRemote(snap(game)));await tick();
  check(()=>{assert.equal(roleplayCount(received.html),0);assert.ok(!received.html.includes(escapedText(entry.text)));});
  await received.click('open-invitation',{round:game.round.id});
  check(()=>{assert.equal(roleplayCount(received.html),1);assert.ok(received.html.includes(escapedText(entry.text)));assert.ok(received.html.includes('data-action="accept"'));assertNoEvidence(received.html);});
 }
 // Roleplay is optional, leaves old cards intact, and escapes its text as plain copy.
 {
  const legacy=draftGame(),legacyUI=shell(mockRemote(snap(legacy)));await tick();
  check(()=>{assert.equal(roleplayCount(legacyUI.html),0);assert.ok(legacyUI.html.includes(cardNotesFixture[legacy.round.cardId]));assertNoEvidence(legacyUI.html);});
  const cardId='six-attention-cadeau',game=finalGame(cardId,1);
  for(const roleplay of [null,{}, {...roleplayFixture,mode:'evidence'}]){
   const ui=shell(mockRemote(snap(game)),{roleplay});await tick();
   check(()=>{assert.equal(roleplayCount(ui.html),0);assert.ok(hasTitle(ui.html,G.getCard(cardId).title));assert.ok(ui.html.includes('data-action="send"'));assert.equal(ui.evidenceReads,0);});
  }
  const text='<img src=x onerror="alert(1)"> & une phrase du club',roleplay={mode:'roleplay',universe:'Club des Deux',cards:{[cardId+':v1']:{metric:'91,3 %',text}}};
  const ui=shell(mockRemote(snap(game)),{roleplay});await tick();
  check(()=>{assert.equal(roleplayCount(ui.html),1);assert.ok(ui.html.includes(escapedText(text)));assert.ok(!ui.html.includes('<img src=x'));assert.equal(ui.evidenceReads,0);});
 }
 // New draws expose four category labels, then six unreadable challenge slots.
 {
  const ui=shell(mockRemote(),{mode:false,randomFace:12});
  check(()=>{assert.equal((ui.html.match(/class="oa-category"/g)||[]).length,4);assert.ok(ui.html.includes('Complicité'));assert.ok(ui.html.includes('Plaisirs'));assert.ok(!ui.html.includes('Détente'));assert.ok(ui.html.includes('data-kind="4" data-value="3" data-roll-role="category"'));});
  await ui.click('roll');check(()=>{assert.deepEqual(ui.rngSides,[42]);assert.deepEqual(ui.die.calls,[2]);assert.equal(ui.stage.dataset.rollRole,'card');assert.equal(ui.stage.dataset.kind,'6');assert.ok(ui.html.includes('class="oa-card-grid is-six"'));assert.ok(ui.html.includes('Six cartes face cachée'));assert.equal((ui.html.match(/aria-label="Carte [1-6] face cachée"/g)||[]).length,6);});
 }
 // A settled category remains readable before its six hidden challenges appear.
 {
  const {remote,ui}=await rollSession({autoResult:false});
  const work=ui.click('roll');await tick();
  check(()=>{assert.equal(ui.resultPending,1);assert.equal(ui.stage.dataset.rollRole,'category');assert.equal(ui.button().textContent,'D4 · Plaisirs');assert.equal(ui.button()['aria-busy'],'false');assert.equal(ui.button().disabled,true);assert.ok(!ui.html.includes('Six cartes face cachée'));assert.deepEqual(ui.announcements,['D4 : 2. Catégorie Plaisirs']);});
  await ui.click('roll');await ui.click('tab',{tab:'us'});await tick();
  check(()=>{assert.equal(remote.calls.filter(c=>c.method==='action').length,1);assert.equal(ui.resultPending,1);assert.equal(ui.stage.dataset.rollRole,'category');assert.equal(ui.revealPending,0);});
  ui.finishResult();await work;
  check(()=>{assert.equal(ui.resultPending,0);assert.equal(ui.stage.dataset.rollRole,'card');assert.ok(ui.html.includes('Six cartes face cachée'));assert.equal(ui.button().disabled,false);});
 }
 // Leaving the app or losing access cancels the category pause without replay.
 {
  for(const event of ['visibilitychange','pagehide','revoke']){
   const {remote,ui}=await rollSession({autoResult:false});
   const work=ui.click('roll');await tick();check(()=>assert.equal(ui.resultPending,1));
   if(event==='revoke')remote.revoke();else if(event==='pagehide')ui.windowEvent(event);else ui.documentEvent(event,{hidden:true});
   await work;
   check(()=>{assert.equal(ui.resultPending,0);assert.equal(remote.calls.filter(c=>c.method==='action').length,1);if(event==='revoke'){assert.ok(ui.html.includes('autocomplete="current-password"'));assert.equal(ui.navigation.hidden,true);assert.equal(ui.announcement.textContent,'');}else{assert.equal(ui.stage.dataset.rollRole,'card');assert.ok(ui.html.includes('Six cartes face cachée'));}});
   if(event==='pagehide')ui.windowEvent('pageshow');else if(event==='visibilitychange')ui.documentEvent(event,{hidden:false});
   check(()=>{assert.equal(ui.resultPending,0);assert.equal(remote.calls.filter(c=>c.method==='action').length,1);});
  }
 }
 // Parallel invitation focus preserves the owner's private card and routes the other lane's response.
 {
  let room=roomDraw(G.createRoom(),'a',1,1,2);room=roomDraw(room,'b',3,2,3);
  const ownId=room.lanes.a.round.id,incomingId=room.lanes.b.round.id;
  room=G.reduceRoom(room,{type:'SEND',actor:'b',roundId:incomingId,at:new Date().toISOString()});
  const ownCard=G.getCard(room.lanes.a.round.cardId),otherCard=G.getCard(room.lanes.b.round.cardId),remote=mockRemote(roomSnapshot(room)),ui=shell(remote);await tick();
  check(()=>{assert.ok(hasTitle(ui.html,ownCard.title));assert.ok(!hasTitle(ui.html,otherCard.title));assert.ok(ui.html.includes('Invitation de'));assert.ok(ui.html.includes('data-round="'+incomingId+'"'));});
  await ui.click('open-invitation',{round:incomingId});
  check(()=>{assert.ok(hasTitle(ui.html,otherCard.title));assert.ok(ui.html.includes('data-action="own-draw"'));assert.ok(ui.html.includes('data-action="accept"'));assert.ok(!hasTitle(ui.html,ownCard.title));});
  await ui.click('own-draw');check(()=>{assert.ok(hasTitle(ui.html,ownCard.title));assert.equal(room.lanes.a.round.id,ownId);assert.equal(room.lanes.a.phase,'draft');});
  await ui.click('open-invitation',{round:incomingId});
  remote.actionImpl=async action=>{check(()=>assert.equal(action.roundId,incomingId));room=G.reduceRoom(room,{...action,actor:'a',at:new Date().toISOString()});return roomSnapshot(room,'a',2,0);};
  await ui.click('accept');check(()=>{assert.equal(room.tasks.length,1);assert.equal(room.lanes.a.phase,'draft');assert.equal(room.lanes.a.round.id,ownId);assert.ok(ui.html.includes(otherCard.title));});
  check(()=>{assert.ok(ui.html.includes('Les choses'));assert.ok(ui.html.includes('data-action="own-draw"'));assert.ok(!ui.html.includes('data-action="new"'));});
  await ui.click('own-draw');check(()=>{assert.ok(hasTitle(ui.html,ownCard.title));assert.ok(ui.html.includes('Ta prochaine'));assert.ok(!ui.html.includes('Les choses'));});
  const reloaded=shell(mockRemote(roomSnapshot(room,'a',2,0)));await tick();check(()=>assert.ok(hasTitle(reloaded.html,ownCard.title)));
 }
 // The other private draw is absent, while a received invitation can coexist with an available die.
 {
  let room=roomDraw(G.createRoom(),'b',3,1,1);
  const hiddenRemote=mockRemote(roomSnapshot(room)),hidden=shell(hiddenRemote);await tick();
  check(()=>{assert.ok(hidden.html.includes('Lancer le D4'));assert.ok(!hidden.html.includes('Invitation de'));assert.ok(!hasTitle(hidden.html,G.getCard(room.lanes.b.round.cardId).title));});
  room=G.reduceRoom(room,{type:'SEND',actor:'b',roundId:room.lanes.b.round.id,at:new Date().toISOString()});
  hiddenRemote.emit(roomSnapshot(room,'a',2));check(()=>{assert.ok(hidden.html.includes('Lancer le D4'));assert.ok(hidden.html.includes('Invitation de'));assert.ok(!hasTitle(hidden.html,G.getCard(room.lanes.b.round.cardId).title));});
  hiddenRemote.emit(roomSnapshot(room,'a',3,0));check(()=>{assert.ok(hidden.html.includes('Prochain tirage'));assert.ok(hidden.html.includes('Invitation de'));assert.ok(!hidden.html.includes('data-action="roll"'));});
 }
 // Switching local worlds keeps both independent hands in the stored room.
 {
  const local=shell(mockRemote(),{mode:false,randomFace:12});await local.click('roll');
  let saved=JSON.parse(local.values.get('onde-couple-prototype-v1'));const first=[...saved.lanes.a.round.hand];
  await local.click('profile',{player:'b'});check(()=>assert.ok(local.html.includes('Lancer le D4')));await local.click('roll');
  saved=JSON.parse(local.values.get('onde-couple-prototype-v1'));check(()=>{assert.equal(saved.version,2);assert.equal(saved.lanes.a.phase,'card');assert.equal(saved.lanes.b.phase,'card');assert.notEqual(saved.lanes.a.round.id,saved.lanes.b.round.id);assert.deepEqual(saved.lanes.a.round.hand,first);});
  await local.click('profile',{player:'a'});check(()=>{assert.equal(local.stage.dataset.rollRole,'card');assert.ok(local.html.includes('Six cartes face cachée'));});
 }
 // Either account can claim a truly idle category draw; only server availability grants it.
 {
  for(const actor of ['a','b']){
   const start=initial(actor),remote=mockRemote(snap(start)),ui=shell(remote);await tick();
   check(()=>{assert.ok(ui.html.includes('Lancer le D4'));assert.ok(!ui.html.includes('Aucune invitation.'));});
   remote.actionImpl=async action=>{assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',catalogueVersion:2,roundId:start.round.id});return {...snap(drawModern(start),2,0),roll:{kind:4,value:2}};};
   await ui.click('roll');
   check(()=>{assert.equal(remote.calls.filter(c=>c.method==='action').length,1);assert.equal(ui.stage.dataset.rollRole,'card');assert.equal(remote.snapshot.state.round.from,actor);});
  }
  const empty=initial('b'),quotaRemote=mockRemote(snap(empty,1,0)),quotaUI=shell(quotaRemote);await tick();
  check(()=>{assert.ok(quotaUI.html.includes('Prochain tirage'));assert.ok(!quotaUI.html.includes('data-action="roll"'));});
  await quotaUI.click('roll');check(()=>assert.equal(quotaRemote.calls.filter(c=>c.method==='action').length,0));
  const hidden={...snap(empty),drawAvailable:false},remote=mockRemote(hidden),ui=shell(remote);await tick();
  check(()=>{assert.ok(ui.html.includes('Aucune invitation.'));assert.ok(!ui.html.includes('data-action="roll"'));assert.equal(ui.diceVisible,false);});
  await ui.click('roll');check(()=>{assert.equal(remote.calls.filter(c=>c.method==='action').length,0);assert.equal(ui.rngCalls,0);});
  remote.emit({...hidden,drawAvailable:true});check(()=>assert.ok(ui.html.includes('Lancer le D4')));
  remote.emit(hidden);check(()=>assert.ok(ui.html.includes('Aucune invitation.')));
  const oldReply=snap(empty);delete oldReply.drawAvailable;const legacy=shell(mockRemote(oldReply));await tick();
  check(()=>{assert.ok(legacy.html.includes('Aucune invitation.'));assert.ok(!legacy.html.includes('data-action="roll"'));});
  const localValues=new Map([['onde-couple-prototype-v1',JSON.stringify(empty)]]),local=shell(mockRemote(),{mode:false,storageValues:localValues,randomFace:12});
  check(()=>assert.ok(local.html.includes('Lancer le D4')));await local.click('roll');
  check(()=>{assert.equal(JSON.parse(local.values.get('onde-couple-prototype-v1')).lanes.b.round.from,'b');assert.equal(local.stage.dataset.rollRole,'card');});
 }
 // The new third roll remains private, survives reload, and carries its exact detail through both worlds.
 {
  const start=initial(),hand=G.cards.filter(c=>c.categoryId==='attention').map(c=>c.id);
  const actions=[
   {type:'ROLL_CATEGORY',catalogueVersion:2,value:2,hand},
   {type:'ROLL_CARD',value:5},
   {type:'ROLL_VARIANT',value:6}
  ];
  const remote=mockRemote(snap(start)),ui=shell(remote,{delayedDie:true,autoReveal:false,motionAPI:true,mobileScroll:true});await tick();
  let game=start;
  for(const [index,action] of actions.entries()){
   const before=game,next=G.reduce(before,action);
   remote.actionImpl=async request=>{
    assert.deepEqual(copy(request),{type:action.type,...(index===0?{catalogueVersion:2}:{}),roundId:before.round.id});
    return {...snap(next,index+2,0),roll:{kind:index===0?4:6,value:action.value}};
   };
   const work=ui.click('roll');await tick();
   check(()=>{assert.equal(ui.stage.dataset.rollRole,['category','card','variant'][index]);assert.equal(ui.die.calls.at(-1),action.value);assert.ok(!ui.html.includes('data-action="send"'));assert.equal(ui.revealPending,0);});
   ui.finishDie();await tick();
   if(index===1){
    check(()=>{assert.equal(ui.revealPending,1);assert.ok(hasTitle(ui.html,G.getCard(next.round.cardId).title));assert.ok(ui.html.includes('Carte 5 choisie'));assert.equal((ui.html.match(/oa-card-ghost/g)||[]).length,5);assert.ok(!ui.html.includes('Tirer la variante'));});
    ui.finishReveal();
   }
   await work;game=next;
  }
  const selected=G.getCard(game.round.cardId),detail=G.getVariant(game.round);
  check(()=>{assert.ok(detail);assert.ok(hasTitle(ui.html,selected.title));assert.ok(ui.html.includes('<p class="oa-card-description">'+escapedText(detail)+'</p>'));assert.ok(!ui.html.includes('data-action="reroll"'));assert.ok(ui.html.includes('data-action="challenge-draft"'));assert.equal(ui.rngCalls,0);assert.equal(ui.evidenceReads,0);assertNoEvidence(ui.html);});
  const halfway=G.reduce(G.reduce(start,actions[0]),actions[1]),privateView=shell(mockRemote(snap({...halfway,activePlayer:'b'})),{motionAPI:true});await tick();
  check(()=>{assert.ok(!privateView.html.includes(selected.title));assert.ok(!privateView.html.includes('data-action="roll"'));});
  const restored=shell(mockRemote(snap(halfway,3,0)),{motionAPI:true});await tick();
  check(()=>{assert.equal(restored.stage.dataset.rollRole,'variant');assert.equal(restored.motionAnimations.filter(a=>a.node===restored.canvas).length,0);assert.ok(restored.html.includes('Tirer la variante'));});
  const defended=G.reduce(game,{type:'CHALLENGE_DRAFT'}),defense=shell(mockRemote(snap(defended,5,0)));await tick();
  check(()=>{assert.equal(defense.stage.dataset.kind,'20');assert.ok(defense.html.includes(escapedText(detail)));assert.ok(defense.html.includes('role="progressbar"'));});
  const at=new Date().toISOString(),sent=G.reduce(game,{type:'SEND',at}),other={...sent,activePlayer:'b'};
  const otherRemote=mockRemote(snap(other,5,0)),otherUI=shell(otherRemote);await tick();await otherUI.click('open-invitation',{round:sent.round.id});
  check(()=>{assert.ok(hasTitle(otherUI.html,selected.title));assert.ok(otherUI.html.includes(escapedText(detail)));assert.ok(otherUI.html.includes('data-action="challenge"'));});
  const accepted=G.reduce(other,{type:'ACCEPT',at});
  otherRemote.actionImpl=async()=>snap(accepted,6,0);await otherUI.click('accept');
  check(()=>{assert.ok(hasTitle(otherUI.html,selected.title));assert.ok(otherUI.html.includes('<p class="oa-task-proposal">'+escapedText(detail)+'</p>'));});
 }
 // All six faces for every challenge display the same exact result after restoration.
 {
  check(()=>assert.equal(G.cards.length,24));
  for(const category of G.categories){
   const cards=G.cards.filter(card=>card.categoryId===category.id);
   const hand=cards.map(card=>card.id),game=G.reduce(initial(),{type:'ROLL_CATEGORY',catalogueVersion:2,value:category.number,hand});
   check(()=>assert.equal(cards.length,6));
   for(const [index,selected] of cards.entries()){
    const chosen=G.reduce(game,{type:'ROLL_CARD',value:index+1});
    for(const [face,detail] of selected.variants.entries()){
     const draft=G.reduce(chosen,{type:'ROLL_VARIANT',value:face+1});
     const ui=shell(mockRemote(snap(draft,4,0)));await tick();
     check(()=>{assert.ok(hasTitle(ui.html,selected.title));assert.equal(G.getVariant(draft.round),detail);assert.ok(ui.html.includes('oa-card-description'));assert.ok(ui.html.includes(escapedText(detail)));assert.ok(ui.html.includes('data-action="send"'));assert.ok(!ui.html.includes('data-action="reroll"'));});
    }
   }
  }
 }
 // In-progress four-card hands retain their D4, reveal pause and three-way reroll.
 {
  let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)});game=copy(game);game.round.hand=game.round.hand.slice(0,4);assert.ok(G.validateState(game));
  const remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false});await tick();
  check(()=>{assert.equal(ui.stage.dataset.kind,'4');assert.equal(ui.stage.dataset.rollRole,'card');assert.ok(ui.html.includes('Quatre cartes face cachée'));assert.ok(!ui.html.includes('is-six'));assert.ok(ui.html.includes('Lancer le D4'));});
  const selected=G.reduce(game,{type:'ROLL_CARD',value:4});remote.actionImpl=async()=>({...snap(selected,2),roll:{kind:4,value:4}});const work=ui.click('roll');await tick();check(()=>{assert.equal(ui.revealPending,1);assert.ok(ui.html.includes('Quatre emplacements, carte 4 choisie'));assert.equal((ui.html.match(/class="oa-card-ghost"/g)||[]).length,3);assert.deepEqual(ui.announcements,['D4 : 4. '+G.getCard(selected.round.cardId).title]);});ui.finishReveal();await work;
  const values=new Map([['onde-couple-prototype-v1',JSON.stringify(selected)]]),local=shell(mockRemote(),{mode:false,storageValues:values,randomFace:1});await local.click('reroll');check(()=>{assert.deepEqual(local.rngSides,[3]);assert.deepEqual(local.die.calls,[1]);assert.ok(!local.html.includes('data-action="challenge-draft"'));assert.ok(!local.html.includes('data-action="reroll"'));});
 }
 // A durable pre-update category receipt resumes its original four-card hand.
 {
  for(const [index,oldId] of ['complicite','detente','projets','attention','bouffe','intimite'].entries()){
   const category=G.getCategory(oldId,1),hand=G.legacyCards.filter(c=>c.categoryId===category.id).slice(0,6).map(c=>c.id);let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:category.number,hand});game=copy(game);game.round.hand=game.round.hand.slice(0,4);game.round.categoryId=oldId;game.round.categoryRoll=index+1;
   const remote=mockRemote(snap(initial())),ui=shell(remote,{motionAPI:true});await tick();remote.actionImpl=async()=>({...snap(game,2,0),roll:{kind:6,value:index+1}});await ui.click('roll');
   check(()=>{assert.equal(ui.toast.textContent,'');assert.deepEqual(ui.die.calls,[]);assert.equal(ui.revealPending,0);assert.equal(ui.motionAnimations.filter(a=>a.node===ui.canvas).length,0);assert.ok(ui.html.includes('Lancer le D4'));assert.ok(ui.html.includes('Quatre cartes face cachée'));assert.equal(ui.stage.dataset.rollRole,'card');assert.equal((ui.html.match(/aria-label="Carte [1-4] face cachée"/g)||[]).length,4);assert.equal(remote.calls.filter(c=>c.method==='action').length,1);});
   const restored=G.normalizeState(game),next=G.reduce(restored,{type:'ROLL_CARD',value:4});remote.actionImpl=async()=>({...snap(next,3,0),roll:{kind:4,value:4}});await ui.click('roll');check(()=>{assert.deepEqual(ui.die.calls,[4]);assert.ok(hasTitle(ui.html,G.getCard(next.round.cardId).title));assert.ok(ui.html.includes('Proposer à'));});
  }
 }
 // The compatibility path does not animate or silently accept a mismatched new receipt.
 {
  const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(initial())),ui=shell(remote);await tick();remote.actionImpl=async()=>({...snap(game,2),roll:{kind:6,value:2}});await ui.click('roll');check(()=>{assert.deepEqual(ui.die.calls,[]);assert.ok(ui.toast.textContent);assert.equal(ui.revealPending,0);});
 }
 // The first launch explains the game once, before login, without starting an action.
 {
  const remote=mockRemote(),ui=shell(remote,{welcomeSeen:false});const before=ui.writes;await tick();
  for(const sentence of ['Les dés choisissent une idée à deux.','Propose-la ou tente de l’écarter au D20.','Deux coches dans les 6 h, un point pour vous.'])check(()=>assert.ok(ui.html.includes(sentence)));
  check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('C’est parti')));check(()=>assert.ok(!ui.html.includes('autocomplete="username"')));check(()=>assert.equal(ui.persona.hidden,true));check(()=>assert.equal(ui.navigation.hidden,true));check(()=>assert.equal(ui.help.hidden,true));
  await ui.click('roll');await ui.click('rules');await ui.submit('fixture-user','fixture-password');check(()=>assert.equal(remote.calls.filter(c=>['action','login'].includes(c.method)).length,0));check(()=>assert.equal(ui.sheet.hidden,true));
  await ui.click('welcome-start');check(()=>assert.equal(ui.values.get('desir-welcome-v1'),'1'));check(()=>assert.ok(ui.html.includes('autocomplete="username"')));check(()=>assert.ok(!ui.html.includes('C’est parti')));
  await ui.submit('fixture-user','fixture-password');check(()=>assert.ok(ui.html.includes('Lancer le D4')));remote.revoke();check(()=>assert.ok(!ui.html.includes('C’est parti')));
  const reloaded=shell(mockRemote(),{welcomeSeen:false,storageValues:ui.values});await tick();check(()=>assert.ok(reloaded.html.includes('autocomplete="username"')));check(()=>assert.ok(!reloaded.html.includes('C’est parti')));
 }
 // An existing session restores behind the welcome without exposing its private card or identities.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{welcomeSeen:false});await tick();const before=ui.writes;
  let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)});game=G.reduce(game,{type:'ROLL_CARD',value:1});remote.emit(snap(game,3));remote.emit();
  check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('C’est parti')));check(()=>assert.ok(!hasTitle(ui.html,G.getCard(game.round.cardId).title)));check(()=>assert.equal(ui.persona.innerHTML,''));check(()=>assert.equal(ui.navigation.hidden,true));
  await ui.click('welcome-start');check(()=>assert.ok(hasTitle(ui.html,G.getCard(game.round.cardId).title)));check(()=>assert.ok(ui.persona.innerHTML.includes('Personne A')));check(()=>assert.equal(ui.navigation.hidden,false));check(()=>assert.equal(remote.calls.filter(c=>c.method==='login'||c.method==='action').length,0));
  const reloaded=shell(mockRemote(snap(game,3)),{welcomeSeen:false,storageValues:ui.values});await tick();check(()=>assert.ok(reloaded.html.includes(G.getCard(game.round.cardId).title)));check(()=>assert.ok(!reloaded.html.includes('C’est parti')));
 }
 // Dismissing during a slow restore reveals its pending screen, then the recovered game.
 {
  const remote=mockRemote(snap(initial()));let resolveRestore;remote.restore=()=>new Promise(resolve=>resolveRestore=resolve);const ui=shell(remote,{welcomeSeen:false});await tick();check(()=>assert.ok(ui.html.includes('C’est parti')));await ui.click('welcome-start');check(()=>assert.ok(ui.html.includes('Connexion…')));resolveRestore(snap(initial()));await tick();check(()=>assert.ok(ui.html.includes('Lancer le D4')));check(()=>assert.ok(!ui.html.includes('C’est parti')));
 }
 // Blocked storage degrades to the current page's memory and never prevents dismissal.
 {
  const remote=mockRemote(),ui=shell(remote,{welcomeSeen:false,storageBlocked:true});await tick();check(()=>assert.ok(ui.html.includes('C’est parti')));await ui.click('welcome-start');check(()=>assert.ok(ui.html.includes('autocomplete="username"')));remote.emit();check(()=>assert.ok(!ui.html.includes('C’est parti')));check(()=>assert.equal(ui.values.has('desir-welcome-v1'),false));
  const reopened=shell(mockRemote(),{welcomeSeen:false,storageBlocked:true});await tick();check(()=>assert.ok(reopened.html.includes('C’est parti')));
 }
 // No local game or private identity is rendered while the login is required.
 {
  const remote=mockRemote(),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('autocomplete="username"')));check(()=>assert.ok(ui.html.includes('autocomplete="current-password"')));check(()=>assert.ok(!ui.html.includes('Lancer le D4')));check(()=>assert.ok(!ui.html.includes('Personne A')));check(()=>assert.equal(ui.persona.hidden,true));check(()=>assert.equal(ui.persona.innerHTML,''));check(()=>assert.equal(ui.navigation.hidden,true));
  let finish;remote.loginImpl=()=>new Promise(resolve=>finish=resolve);const work=ui.submit('fixture-user','fixture-password');await tick();check(()=>assert.equal(ui.password.value,''));check(()=>assert.ok(!Array.from(ui.values.values()).join('').includes('fixture-password')));check(()=>assert.ok(ui.html.includes('Connexion…')));finish(snap(initial()));await work;check(()=>assert.ok(ui.html.includes('Lancer le D4')));check(()=>assert.ok(ui.persona.innerHTML.includes('Personne A')));check(()=>assert.ok(!ui.persona.innerHTML.includes('<button')));check(()=>assert.equal(ui.navigation.hidden,false));await ui.click('profile',{player:'b'});check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne A')));
 }
 // All 88 cards remain playable even if an old cached statistics module is still present and trapped.
 {
  check(()=>assert.equal(G.legacyCards.length,88));
  for(const selected of G.legacyCards){
   const hand=[selected.id,...G.legacyCards.filter(c=>c.categoryId===selected.categoryId&&c.id!==selected.id).slice(0,5).map(c=>c.id)];
   let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:G.getCategory(selected.categoryId,1).number,hand});game=G.reduce(game,{type:'ROLL_CARD',value:1});
   const remote=mockRemote(snap(game)),ui=shell(remote,{evidenceTrap:true});await tick();
   check(()=>{assert.equal(game.round.cardId,selected.id);assert.equal(G.validateState(game),true);assert.ok(ui.html.includes('oa-card-title'));assert.ok(ui.html.includes(selected.title));assert.ok(ui.html.includes('data-action="send"'));assert.ok(ui.html.includes('data-action="challenge-draft"'));assert.equal(ui.navigation.hidden,false);assertNoEvidence(ui.html);assert.equal(ui.evidenceReads,0);assert.ok(ui.html.includes(cardNotesFixture[selected.id]));assert.equal((ui.html.match(/class="oa-card-note"/g)||[]).length,1);});
  }
 }
 // The server's face is used, and its new state is hidden until the die settles.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{delayedDie:true});await tick();
  const next=drawModern();
  remote.actionImpl=async action=>{check(()=>assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',catalogueVersion:2,roundId:'onde-1'}));return {...snap(next,2,0),roll:{kind:4,value:2}};};
  const before=ui.writes,work=ui.click('roll');await tick();check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.deepEqual(ui.die.calls,[2]));check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('Un peu de hasard.')));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(ui.html.includes('Plaisirs')));check(()=>assert.ok(ui.html.includes('Lancer le D6')));check(()=>assert.equal(ui.interrupted,0));
 }
 // The category D4 hands off only after its confirmed face settles; the six slots never translate or stagger.
 {
  const {remote,ui}=await rollSession({delayedDie:true,motionAPI:true,mobileScroll:true});ui.main.scrollTop=170;
  const work=ui.click('roll');await tick();check(()=>{assert.equal(ui.motionAnimations.length,0);assert.ok(!ui.html.includes('oa-card-grid'));});
  ui.finishDie();await work;const animations=[...ui.motionAnimations],canvasMotion=animations.find(a=>a.node===ui.canvas),gridMotion=animations.find(a=>a.node===ui.grid),holder=ui.stage;
  check(()=>{assert.equal(animations.length,3);assert.ok(canvasMotion);assert.ok(gridMotion);assert.ok(animations.every(a=>![ui.root,ui.main,ui.persona,ui.navigation].includes(a.node)));assert.equal(ui.main.scrollTop,0);assert.equal(ui.navigation.hidden,false);assert.equal((ui.html.match(/aria-label="Carte [1-6] face cachée"/g)||[]).length,6);});
  check(()=>{assert.equal(canvasMotion.keyframes[0].transform,'translate(0px,60px) scale(1.4)');assert.equal(canvasMotion.keyframes.at(-1).transform,'none');assert.ok(canvasMotion.options.duration<=400);assert.ok(gridMotion.keyframes.every(frame=>!Object.hasOwn(frame,'transform')));assert.equal(gridMotion.options.delay,undefined);assert.equal(gridMotion.keyframes.at(-1).opacity,1);assert.ok(ui.grid.children.every(tile=>tile.style.animation==='none'));assert.equal(holder.style.overflow,'hidden');});
  animations.forEach(a=>a.finish());check(()=>assert.equal(holder.style.overflow,''));
  const changed=remote.snapshot;changed.revision++;changed.state.stats.totalCompleted=1;changed.state.stats.byCategory.attention=1;remote.emit(changed);check(()=>{assert.equal(ui.motionAnimations.length,3);assert.ok(animations.every(a=>!a.cancelled));assert.ok(ui.html.includes('Lancer le D6'));assert.equal(remote.calls.filter(c=>c.method==='action').length,1);});
 }
 // Interrupting the adaptive presentation restores clipping immediately without blocking navigation or login.
 {
  for(const reason of ['pagehide','visibilitychange','revoke','tab']){
   const {remote,ui}=await rollSession({motionAPI:true});await ui.click('roll');const holder=ui.stage,animations=[...ui.motionAnimations];assert.equal(holder.style.overflow,'hidden');
   if(reason==='revoke')remote.revoke();else if(reason==='tab')await ui.click('tab',{tab:'tasks'});else if(reason==='pagehide')ui.windowEvent(reason);else ui.documentEvent(reason,{hidden:true});
   check(()=>{assert.ok(animations.every(a=>a.cancelled));assert.equal(holder.style.overflow,'');assert.equal(remote.calls.filter(c=>c.method==='action').length,1);if(reason==='revoke'){assert.ok(ui.html.includes('autocomplete="current-password"'));assert.ok(!ui.html.includes('oa-card-grid'));}if(reason==='tab')assert.ok(ui.html.includes('Les choses'));});
  }
 }
 // Starting the D6 before the handoff ends cancels its transform before the physical roll begins.
 {
  const {remote,ui}=await rollSession({motionAPI:true,autoReveal:false});await ui.click('roll');const holder=ui.stage,animations=[...ui.motionAnimations],physicalRoll=ui.die.roll;
  remote.actionImpl=async action=>({...snap(G.reduce(remote.snapshot.state,{...action,value:1}),3),roll:{kind:6,value:1}});
  ui.die.roll=async(...args)=>{check(()=>{assert.ok(animations.every(a=>a.cancelled));assert.equal(holder.style.overflow,'');});return physicalRoll(...args);};
  const work=ui.click('roll');await tick();ui.finishReveal();await work;
 }
 // Reduced motion, hidden pages and missing animation APIs use the final layout directly, without replay.
 {
  for(const mode of ['reduced','hidden','pagehidden','unsupported']){
   const {ui}=await rollSession({motionAPI:mode!=='unsupported',reduced:mode==='reduced'});if(mode==='hidden')ui.documentEvent('visibilitychange',{hidden:true});if(mode==='pagehidden')ui.windowEvent('pagehide');await ui.click('roll');
   if(mode==='hidden')ui.documentEvent('visibilitychange',{hidden:false});if(mode==='pagehidden')ui.windowEvent('pageshow');
   check(()=>{assert.equal(ui.motionAnimations.length,0);assert.ok(ui.html.includes('Lancer le D6'));assert.equal((ui.html.match(/aria-label="Carte [1-6] face cachée"/g)||[]).length,6);assert.notEqual(ui.stage.style.overflow,'hidden');});
  }
 }
 // Restoring a hand fades its grid as a group; an unsuccessful or obsolete category roll never starts a die handoff.
 {
  const game=drawModern(),restored=shell(mockRemote(snap(game)),{motionAPI:true});await tick();
  check(()=>{assert.equal(restored.motionAnimations.filter(a=>a.node===restored.canvas).length,0);assert.equal(restored.motionAnimations.length,1);assert.ok(restored.motionAnimations[0].keyframes.every(frame=>!Object.hasOwn(frame,'transform')));});
  const failure=await rollSession({motionAPI:true});failure.remote.actionImpl=async()=>{throw Object.assign(new Error('Connexion interrompue.'),{isDesirRemoteError:true,code:'offline',snapshot:snap(game,2)});};await failure.ui.click('roll');check(()=>assert.equal(failure.ui.motionAnimations.filter(a=>a.node===failure.ui.canvas).length,0));
  const superseded=await rollSession({motionAPI:true,delayedDie:true});const work=superseded.ui.click('roll');await tick();superseded.remote.emit(snap(G.reduce(game,{type:'ROLL_CARD',value:1}),3));superseded.ui.finishDie();await work;check(()=>{assert.equal(superseded.ui.motionAnimations.filter(a=>a.node===superseded.ui.canvas).length,0);assert.ok(superseded.ui.html.includes('Tirer la variante'));});
  const revoked=await rollSession({motionAPI:true,delayedDie:true});const old=revoked.ui.click('roll');await tick();revoked.remote.revoke();revoked.ui.finishDie();await old;check(()=>{assert.equal(revoked.ui.motionAnimations.length,0);assert.ok(revoked.ui.html.includes('autocomplete="current-password"'));});
 }
 // The local demo uses the same visual handoff and persists only the regular card phase.
 {
  const ui=shell(mockRemote(),{mode:false,motionAPI:true,randomFace:2});await ui.click('roll');const saved=G.roomView(JSON.parse(ui.values.get('onde-couple-prototype-v1')),'a');
  check(()=>{assert.equal(ui.motionAnimations.filter(a=>a.node===ui.canvas).length,1);assert.equal(saved.phase,'card');assert.equal(G.validateState(saved),true);assert.ok(!Object.hasOwn(saved,'contentTransitions'));assert.equal((ui.html.match(/aria-label="Carte [1-6] face cachée"/g)||[]).length,6);});
 }
 // Holding changes only visual power, caps its work, and cannot add a second native click roll.
 {
  const {remote,ui}=await rollSession();await ui.pointer('pointerdown');check(()=>assert.equal(ui.button().classList.contains('is-charging'),true));ui.advance(600);check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0.5'));check(()=>assert.equal(ui.die.charges.at(-1),.5));check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));ui.advance(600);check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'1'));check(()=>assert.equal(ui.frameCount,0));ui.advance(9000);check(()=>assert.equal(ui.frameCount,0));await ui.pointer('pointerup');await ui.click('roll',{},1);check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));check(()=>assert.deepEqual(copy(ui.die.options),[{duration:1650,power:1}]));check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0'));check(()=>assert.equal(ui.button().classList.contains('is-charging'),false));check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.equal(ui.button()['aria-valuenow'],undefined));
 }
 // Quick taps, Enter, and assistive clicks keep classic power; Space also dispatches exactly once.
 {
  const tap=await rollSession();await tap.ui.pointer('pointerdown');await tap.ui.pointer('pointerup');await tap.ui.click('roll',{},1);check(()=>assert.equal(tap.remote.calls.filter(c=>c.method==='action').length,1));check(()=>assert.equal(tap.ui.die.options[0].power,0));
  const enter=await rollSession();await enter.ui.key('keydown','Enter');await enter.ui.click('roll');check(()=>assert.equal(enter.ui.die.options[0].power,0));
  const space=await rollSession();await space.ui.key('keydown');space.ui.advance(300);await space.ui.key('keydown',' ',{repeat:true});space.ui.advance(300);await space.ui.key('keyup');await space.ui.click('roll');check(()=>assert.equal(space.remote.calls.filter(c=>c.method==='action').length,1));check(()=>assert.equal(space.ui.die.options[0].power,.5));
  const canvas=await rollSession();await canvas.ui.releaseCanvas(.7);check(()=>assert.equal(canvas.ui.die.options[0].power,.7));
 }
 // Cancellation remains effective even if the finger stays down for seconds after the cancelled gesture.
 {
  for(const reason of ['pointercancel','lostpointercapture','move','blur','scroll','outside']){
   const {remote,ui}=await rollSession();await ui.pointer('pointerdown');ui.advance(350);
   if(reason==='move')await ui.pointer('pointermove','roll',{clientY:45});else if(reason==='blur'||reason==='scroll')ui.windowEvent(reason);else if(reason!=='outside')await ui.pointer(reason);
   ui.advance(3000);await ui.pointer('pointerup','roll',reason==='outside'?{clientX:300}:{});await ui.click('roll',{},1);
   check(()=>{assert.equal(remote.calls.filter(c=>c.method==='action').length,0,reason);assert.equal(ui.frameCount,0);assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0');assert.equal(ui.button().classList.contains('is-charging'),false);assert.equal(ui.die.charges.at(-1),0);});
  }
  const secondary=await rollSession();await secondary.ui.pointer('pointerdown');await secondary.ui.pointer('pointerdown','roll',{pointerId:2,isPrimary:false});await secondary.ui.pointer('pointerup','roll',{pointerId:2,isPrimary:false});secondary.ui.advance(600);await secondary.ui.pointer('pointerup');check(()=>assert.equal(secondary.ui.die.options[0].power,.5));check(()=>assert.equal(secondary.remote.calls.filter(c=>c.method==='action').length,1));
  for(const reason of ['Escape','focusout','blur']){const {remote,ui}=await rollSession();await ui.key('keydown');ui.advance(400);if(reason==='Escape')await ui.key('keydown','Escape');else if(reason==='blur')ui.windowEvent('blur');else await ui.pointer('focusout');ui.advance(3000);await ui.key('keyup');ui.windowEvent('keyup',{key:' ',code:'Space'});await ui.click('roll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0,reason));}
 }
 // A state change cancels an active press; reduced motion keeps its progress but settles the die immediately.
 {
  const {remote,ui}=await rollSession();await ui.pointer('pointerdown');ui.advance(500);remote.emit(snap(initial(),2,0));await ui.pointer('pointerup');await ui.click('roll',{},1);check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));check(()=>assert.equal(ui.frameCount,0));
  const reduced=await rollSession({reduced:true});await reduced.ui.pointer('pointerdown');reduced.ui.advance(600);check(()=>assert.equal(reduced.ui.button().style.getPropertyValue('--oa-charge'),'0.5'));await reduced.ui.pointer('pointerup');check(()=>assert.deepEqual(copy(reduced.ui.die.options[0]),{duration:0,power:.5}));
 }
 // Shared score updates wait behind the press; the next tap after a cancelled press is never swallowed.
 {
  const {remote,ui}=await rollSession();await ui.pointer('pointerdown');ui.advance(400);const before=ui.writes;remote.emit(snap(scored(1),2));check(()=>assert.equal(ui.writes,before));ui.advance(200);check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0.5'));await ui.pointer('pointerup');check(()=>assert.equal(ui.die.options[0].power,.5));check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
  const retry=await rollSession();await retry.ui.pointer('pointerdown');retry.ui.advance(300);retry.ui.windowEvent('scroll');retry.ui.advance(3000);await retry.ui.pointer('pointerup');await retry.ui.click('roll',{},1);await retry.ui.pointer('pointerdown');await retry.ui.pointer('pointerup');await retry.ui.click('roll',{},1);check(()=>assert.equal(retry.remote.calls.filter(c=>c.method==='action').length,1));check(()=>assert.equal(retry.ui.die.options[0].power,0));
 }
 // Waiting for the server is distinct from the animation, and power never enters the action payload.
 {
  const {remote,ui}=await rollSession({delayedDie:true});let reply;remote.actionImpl=action=>{check(()=>assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',catalogueVersion:2,roundId:'onde-1'}));return new Promise(resolve=>reply=()=>{const game=drawModern();resolve({...snap(game,2,0),roll:{kind:4,value:2}});});};await ui.pointer('pointerdown');ui.advance(600);const work=ui.pointer('pointerup');await tick();check(()=>assert.equal(ui.button().textContent,'Tirage…'));check(()=>assert.equal(ui.die.calls.length,0));reply();await tick();check(()=>assert.equal(ui.button().textContent,'Le dé roule…'));check(()=>assert.equal(ui.die.options[0].power,.5));ui.finishDie();await work;await ui.click('roll',{},1);check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
 }
 // Network actions have immediate waiting feedback and preserve disabled controls until acknowledgement.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote);await tick();let resolveAction;remote.actionImpl=()=>new Promise(resolve=>resolveAction=()=>resolve(snap(G.reduce(game,{type:'SEND',at:new Date().toISOString()}),2)));const work=ui.click('send');await tick();check(()=>assert.equal(ui.button('send').textContent,'Envoi…'));check(()=>assert.equal(ui.button('send')['aria-busy'],'true'));check(()=>assert.ok(ui.controls.every(c=>c.disabled)));resolveAction();await work;check(()=>assert.equal(ui.button('send')['aria-busy'],undefined));
 }
 // A newer projection received during the animation wins when it finishes.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{delayedDie:true});await tick();
  let game=drawModern(initial(),3);
  remote.actionImpl=async()=>({...snap(game,2,0),roll:{kind:4,value:3}});const work=ui.click('roll');await tick();const before=ui.writes;
  game=G.reduce(game,{type:'ROLL_CARD',value:1});remote.emit(snap(game,3,0));check(()=>assert.equal(ui.writes,before));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(ui.html.includes('Tirer la variante')));check(()=>assert.ok(!ui.html.includes('Lancer le D4')));
 }
 // Quota exhaustion affects only the category action and does not open another server request.
 {
  const remote=mockRemote(snap(initial(),1,0)),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('Prochain tirage')));check(()=>assert.ok(!ui.html.includes('data-action="roll"')));await ui.click('roll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));remote.emit(snap(initial(),1,1));check(()=>assert.ok(ui.html.includes('Lancer le D4')));await ui.click('rules');check(()=>assert.ok(!ui.sheet.innerHTML.includes('oa-odds-table')));check(()=>assert.ok(!ui.sheet.innerHTML.includes('quota')));check(()=>assert.ok(!ui.sheet.innerHTML.includes('77,25')));
 }
 // Personal settings and notification permissions remain on this device.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote);await tick();await ui.click('tab',{tab:'us'});check(()=>assert.ok(!ui.html.includes('À notre')));check(()=>assert.ok(!ui.html.includes('reset-confirm')));check(()=>assert.ok(ui.html.includes('Activer les notifications')));await ui.click('enable-notifications');check(()=>assert.equal(remote.calls.filter(c=>c.method==='notifications').length,1));check(()=>assert.ok(ui.html.includes('Activées sur cet appareil.')));
 }
 // The four displayed scores include counts from both historical merged categories.
 {
  const game=initial();game.stats.totalCompleted=14;Object.assign(game.stats.byCategory,{complicite:1,detente:2,attention:3,bouffe:4,projets:3,intimite:1});
  const ui=shell(mockRemote(snap(game)));await tick();await ui.click('tab',{tab:'us'});
  const rows=Array.from(ui.html.matchAll(/class="oa-score-label"><i aria-hidden="true"><\/i>([^<]+)<\/span><strong>(\d+)<\/strong>/g),row=>row.slice(1));
  check(()=>assert.deepEqual(rows,[['Complicité','3'],['Plaisirs','7'],['Projets','3'],['Intimité','1']]));
 }
 // Only the highest earned grade is shown; future and previous grade names stay out of the DOM.
 {
  const levels=[[5,'Couple complice'],[8,'Duo accordé'],[10,'Couple stable'],[12,'Couple soudé'],[15,'Super couple'],[20,'Duo inséparable'],[25,'Couple remarquable'],[30,'Couple légendaire'],[35,'Duo d’exception'],[40,'Couple iconique'],[45,'Duo mythique'],[50,'Couple éternel']];
  for(const total of [0,4,5,7,8,10,12,15,20,25,30,35,40,45,49,50,51,95]){
   const remote=mockRemote(snap(scored(total))),ui=shell(remote);await tick();const keys=Array.from(ui.values.keys());await ui.click('tab',{tab:'us'});const section=gradeSection(ui.html),got=gradeProgress(ui.html),current=levels.filter(g=>g[0]<=total).at(-1),next=levels.find(g=>g[0]>total);
   check(()=>{assert.equal(got.points,current?.[0]||null);assert.equal((section.match(/<article\b/g)||[]).length,current?1:0);assert.deepEqual(levels.filter(g=>section.includes(g[1])).map(g=>g[1]),current?[current[1]]:[]);assert.equal(got.max,next?next[0]-(current?.[0]||0):50);assert.equal(got.value,next?total-(current?.[0]||0):50);assert.ok(!/<(?:button|input)\b|data-action=/.test(section));assert.ok(ui.html.indexOf('class="oa-shared-score"')<ui.html.indexOf('class="oa-grade-area'));assert.ok(ui.html.indexOf('class="oa-grade-area')<ui.html.indexOf('class="oa-score-grid"'));if(!current)assert.ok(section.includes('Premier grade à 5 points'));else if(next)assert.ok(section.includes((next[0]-total)+' point'));else assert.ok(section.includes('Grade maximal atteint.'));assert.equal(ui.gradeAnimations.length,0);assert.deepEqual(Array.from(ui.values.keys()),keys);assert.equal(remote.calls.filter(c=>c.method==='action').length,0);});
  }
 }
 // A grade replaces its predecessor once at a crossing, never on polls, tab changes, reload, or another identity.
 {
  const remote=mockRemote(snap(scored(4))),ui=shell(remote);await tick();await ui.click('tab',{tab:'us'});remote.emit(snap(scored(5),2));const earned=gradeSection(ui.html);check(()=>assert.equal(ui.gradeAnimations.length,1));remote.emit();remote.emit(snap(scored(6),3));check(()=>assert.equal(ui.gradeAnimations.length,1));remote.emit(snap(scored(8),4));check(()=>assert.equal(ui.gradeAnimations.length,2));check(()=>assert.ok(!gradeSection(ui.html).includes('Couple complice')));remote.emit(snap(scored(5),2));check(()=>assert.equal(gradeProgress(ui.html).points,8));await ui.click('tab',{tab:'play'});await ui.click('tab',{tab:'us'});check(()=>assert.equal(ui.gradeAnimations.length,2));
  const other=shell(mockRemote(snap(scored(5,'b'),2)));await tick();await other.click('tab',{tab:'us'});check(()=>assert.equal(gradeSection(other.html),earned));check(()=>assert.equal(other.gradeAnimations.length,0));
  const reloaded=shell(mockRemote(snap(scored(5),2)),{storageValues:ui.values});await tick();await reloaded.click('tab',{tab:'us'});check(()=>assert.equal(gradeSection(reloaded.html),earned));check(()=>assert.equal(reloaded.gradeAnimations.length,0));
  const reducedRemote=mockRemote(snap(scored(4))),still=shell(reducedRemote,{reduced:true});await tick();await still.click('tab',{tab:'us'});reducedRemote.emit(snap(scored(5),2));check(()=>assert.equal(still.gradeAnimations.length,0));check(()=>assert.equal(gradeProgress(still.html).points,5));
 }
 // A remote reroll visibly mounts the D6 before the network reply and reveals only after its animation.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{delayedDie:true});await tick();check(()=>assert.ok(ui.html.includes('Relancer le D6 · sans mon D20')));let resolveAction;const next=G.reduce(game,{type:'REROLL_CARD',value:2});remote.actionImpl=action=>{check(()=>assert.deepEqual(copy(action),{type:'REROLL_CARD',roundId:game.round.id}));return new Promise(resolve=>resolveAction=()=>resolve({...snap(next,2),roll:{kind:6,value:2}}));};
  const work=ui.click('reroll');await tick();check(()=>assert.equal(ui.diceVisible,true));check(()=>{assert.ok(ui.html.includes('class="oa-roll-status" data-roll-status role="status" aria-busy="true"'));assert.ok(!ui.html.includes('data-action="roll"'));assert.equal(ui.rollStatus.textContent,'Tirage…');assert.equal(ui.rollStatus['aria-busy'],'true');assert.equal(ui.rollStatus.disabled,false);});check(()=>assert.ok(ui.html.includes('Le D6')));check(()=>assert.ok(ui.controls.every(c=>c.disabled)));await ui.click('send');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));resolveAction();await tick();check(()=>assert.equal(ui.rollStatus.textContent,'Le dé roule…'));check(()=>assert.deepEqual(ui.die.calls,[2]));check(()=>assert.deepEqual(ui.die.visible,[true]));check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.ok(!hasTitle(ui.html,G.getCard(next.round.cardId).title)));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(!ui.html.includes('data-roll-status')));check(()=>assert.ok(hasTitle(ui.html,G.getCard(next.round.cardId).title)));check(()=>assert.ok(!ui.html.includes('Relancer le D6')));check(()=>assert.ok(!ui.html.includes('data-action="challenge-draft"')));check(()=>assert.ok(ui.html.includes('Proposer à')));await ui.click('reroll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
 }
 // Every selected D6 slot is revealed only after the confirmed die, then replaced by its full invitation.
 {
  for(const reroll of [false,true])for(const face of [1,2,3,4,5,6]){
   const oldFace=face%6+1,game=reroll?draftGame('a',oldFace):G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false,delayedDie:true,evidenceTrap:true,mobileScroll:true});await tick();const actionType=reroll?'REROLL_CARD':'ROLL_CARD',next=G.reduce(game,{type:actionType,value:face}),chosen=G.getCard(next.round.cardId);remote.actionImpl=async action=>{assert.deepEqual(copy(action),{type:actionType,roundId:game.round.id});return {...snap(next,2),roll:{kind:6,value:face}};};const work=ui.click(reroll?'reroll':'roll');await tick();
   check(()=>{assert.ok(!hasTitle(ui.html,chosen.title));assert.ok(!ui.html.includes('data-reveal-selected'));assert.equal(ui.revealPending,0);assert.equal(ui.announcements.filter(text=>text.includes(chosen.title)).length,0);});
   ui.finishDie();await tick();check(()=>{assert.ok(ui.html.includes('oa-card-revealed'));assert.equal(ui.html.includes('is-first-reveal'),!reroll);assert.ok(ui.html.includes('data-reveal-selected aria-label="Carte '+face+' choisie"'));assert.ok(ui.html.includes('<h3>'+chosen.title+'</h3>'));assertNoEvidence(ui.html);assert.ok(!ui.html.includes('oa-playing-card'));assert.ok(!ui.html.includes('oa-card-note'));assert.ok(!ui.html.includes('data-action='));assert.equal((ui.html.match(/class="oa-card-ghost"/g)||[]).length,reroll?4:5);for(const id of game.round.hand.filter(id=>id!==chosen.id&&(!reroll||id!==game.round.cardId)))assert.ok(!hasTitle(ui.html,G.getCard(id).title));if(reroll)assert.ok(ui.html.includes('Carte '+oldFace+' écartée : '+G.getCard(game.round.cardId).title));assert.equal(ui.revealPending,1);assert.equal(ui.timers.findLast(timer=>timer.ms===2800).scrollTop,ui.main.scrollTop);if(face>3)assert.ok(ui.main.scrollTop>0);assert.deepEqual(ui.announcements,['D6 : '+face+'. '+chosen.title]);});
   await ui.click('tab',{tab:'us'});await ui.click('send');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
   if(face===1){remote.emit(snap(game,1));check(()=>assert.equal(ui.revealPending,1));}
   if(face===4&&!reroll){const latest=copy(next);latest.stats.totalCompleted=1;latest.stats.byCategory.attention=1;remote.emit(snap(latest,3));check(()=>assert.equal(ui.revealPending,1));}
   ui.finishReveal();await work;check(()=>{assert.ok(ui.html.includes('Ta prochaine'));assert.ok(hasTitle(ui.html,chosen.title));assert.ok(ui.html.includes(cardNotesFixture[chosen.id]));assertNoEvidence(ui.html);assert.equal(ui.evidenceReads,0);assert.ok(!ui.html.includes('data-reveal-selected'));assert.ok(ui.html.includes('data-action="send"'));assert.equal(ui.html.includes('data-action="challenge-draft"'),!reroll);assert.equal(ui.revealPending,0);assert.equal(ui.main.scrollTop,0);assert.deepEqual(ui.announcements,['D6 : '+face+'. '+chosen.title]);assert.equal(ui.interrupted,0);});
   if(face===4&&!reroll){await ui.click('tab',{tab:'us'});check(()=>assert.ok(ui.html.includes('<strong>1</strong>')));}
  }
 }
 // Local and reduced-motion draws retain the same reading pause without persisting a visual phase.
 {
  for(const reroll of [false,true]){const game=reroll?draftGame():G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),values=new Map([['onde-couple-prototype-v1',JSON.stringify(game)]]),ui=shell(mockRemote(),{mode:false,storageValues:values,autoReveal:false,reduced:true,randomFace:2,evidenceTrap:true,mobileScroll:true});const work=ui.click(reroll?'reroll':'roll');await tick();check(()=>{assert.ok(ui.html.includes('data-reveal-selected'));assert.equal(ui.revealPending,1);assert.equal(ui.die.options[0].duration,0);assert.equal(ui.timers.findLast(timer=>timer.ms===2800).ms,2800);const saved=G.roomView(JSON.parse(values.get('onde-couple-prototype-v1')),'a');assert.equal(saved.phase,'draft');assert.equal(G.validateState(saved),true);assert.equal(Object.hasOwn(saved,'cardReveal'),false);});ui.finishReveal();await work;check(()=>{assert.ok(ui.html.includes('Ta prochaine'));assert.equal(ui.revealPending,0);assert.equal(ui.announcements.length,1);});}
 }
 // Hiding the page finishes the visual pause without replay or extra requests when returning.
 {
  for(const event of ['visibilitychange','pagehide']){const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false});await tick();remote.actionImpl=async()=>({...snap(G.reduce(game,{type:'ROLL_CARD',value:3}),2),roll:{kind:6,value:3}});const work=ui.click('roll');await tick();check(()=>assert.equal(ui.revealPending,1));if(event==='pagehide')ui.windowEvent(event);else ui.documentEvent(event,{hidden:true});await work;check(()=>{assert.equal(ui.revealPending,0);assert.ok(!ui.html.includes('data-reveal-selected'));assert.ok(ui.html.includes('Ta prochaine'));});if(event==='pagehide')ui.windowEvent('pageshow');else ui.documentEvent(event,{hidden:false});check(()=>{assert.ok(!ui.html.includes('data-reveal-selected'));assert.equal(remote.calls.filter(c=>c.method==='action').length,1);});}
  const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false});await tick();let reply;remote.actionImpl=()=>new Promise(resolve=>reply=()=>resolve({...snap(G.reduce(game,{type:'ROLL_CARD',value:2}),2),roll:{kind:6,value:2}}));const work=ui.click('roll');ui.documentEvent('visibilitychange',{hidden:true});reply();await work;check(()=>{assert.equal(ui.die.calls.length,0);assert.equal(ui.revealPending,0);assert.ok(ui.html.includes('Ta prochaine'));});
 }
 // Backgrounding during the die settles it too; no animation or reveal is replayed on return.
 {
  for(const event of ['visibilitychange','pagehide']){const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false,delayedDie:true});await tick();remote.actionImpl=async()=>({...snap(G.reduce(game,{type:'ROLL_CARD',value:4}),2),roll:{kind:6,value:4}});const work=ui.click('roll');await tick();if(event==='pagehide')ui.windowEvent(event);else ui.documentEvent(event,{hidden:true});await work;check(()=>{assert.equal(ui.revealPending,0);assert.ok(!ui.html.includes('data-reveal-selected'));assert.ok(ui.html.includes('Ta prochaine'));assert.equal(ui.announcements.length,0);});if(event==='pagehide')ui.windowEvent('pageshow');else ui.documentEvent(event,{hidden:false});check(()=>{assert.equal(ui.die.calls.length,1);assert.equal(remote.calls.filter(c=>c.method==='action').length,1);assert.ok(!ui.html.includes('data-reveal-selected'));});}
 }
 // Revocation during the die or reading pause never restores private content from its deferred snapshot.
 {
  for(const duringPause of [false,true]){const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false,delayedDie:!duringPause});await tick();remote.actionImpl=async()=>({...snap(G.reduce(game,{type:'ROLL_CARD',value:2}),2),roll:{kind:6,value:2}});const work=ui.click('roll');await tick();remote.revoke();ui.password.value='still-typing';const writes=ui.writes;if(!duringPause)ui.finishDie();await work;check(()=>{assert.ok(ui.html.includes('autocomplete="current-password"'));assert.ok(!ui.html.includes('data-reveal-selected'));assert.equal(ui.revealPending,0);assert.equal(ui.navigation.hidden,true);assert.equal(ui.persona.innerHTML,'');assert.equal(ui.announcement.textContent,'');assert.equal(ui.password.value,'still-typing');assert.equal(ui.writes,writes);});}
 }
 // A newer choice or another identity cannot be replaced by an old D6 visual receipt.
 {
  const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:4,hand:G.legacyCards.filter(c=>c.categoryId==='attention').slice(0,6).map(c=>c.id)}),next=G.reduce(game,{type:'ROLL_CARD',value:1}),remote=mockRemote(snap(game)),ui=shell(remote,{autoReveal:false,delayedDie:true});await tick();remote.actionImpl=async()=>({...snap(next,2),roll:{kind:6,value:1}});const work=ui.click('roll');await tick();const newer=G.reduce(next,{type:'REROLL_CARD',value:2});remote.emit(snap(newer,3));ui.finishDie();await work;check(()=>{assert.equal(ui.revealPending,0);assert.ok(!ui.html.includes('data-reveal-selected'));assert.ok(ui.html.includes(G.getCard(newer.round.cardId).title));assert.equal(ui.announcements.length,0);});
  const otherRemote=mockRemote(snap(game)),other=shell(otherRemote,{autoReveal:false,delayedDie:true});await tick();otherRemote.actionImpl=async()=>({...snap(next,2),roll:{kind:6,value:1}});const old=other.click('roll');await tick();otherRemote.revoke();otherRemote.loginImpl=async()=>snap(initial('b'),1);await other.submit('fixture-b','fixture-secret');other.finishDie();await old;check(()=>{assert.ok(other.persona.innerHTML.includes('aria-current="true">Personne B'));assert.ok(!other.html.includes(G.getCard(next.round.cardId).title));assert.ok(!other.html.includes('data-reveal-selected'));assert.equal(other.revealPending,0);assert.equal(other.announcement.textContent,'');});
 }
 // During a reroll, the original slot alone stays readable and the other five slots contain no hidden titles.
 {
  for(const slot of [1,2,3,4,5,6]){
   const game=draftGame('a',slot),remote=mockRemote(snap(game)),ui=shell(remote,{delayedDie:true});await tick();let resolveAction;const face=slot%6+1,next=G.reduce(game,{type:'REROLL_CARD',value:face});remote.actionImpl=()=>new Promise(resolve=>resolveAction=()=>resolve({...snap(next,2),roll:{kind:6,value:face}}));const work=ui.click('reroll');await tick();
   const grid=ui.html.slice(ui.html.indexOf('<div class="oa-card-grid')),tiles=Array.from(grid.matchAll(/<div class="oa-mini-card oa-card-back([^"]*)" aria-label="([^"]+)">/g));
   check(()=>{assert.equal(tiles.length,6);assert.equal(tiles.filter(tile=>tile[1].includes('oa-card-discarded')).length,1);assert.ok(tiles[slot-1][1].includes('oa-card-discarded'));assert.ok(tiles[slot-1][2].includes(G.getCard(game.round.cardId).title));assert.ok(grid.includes('Écartée'));assert.equal((grid.match(/class="oa-card-ghost"/g)||[]).length,5);assert.ok(!/<(?:button|input)\b|data-action=|tabindex=/.test(grid));for(const id of game.round.hand.filter(id=>id!==game.round.cardId)){assert.ok(!hasTitle(grid,G.getCard(id).title));assert.ok(!grid.includes(id));}});
   resolveAction();await tick();check(()=>{assert.ok(hasTitle(ui.html,G.getCard(game.round.cardId).title));assert.ok(!hasTitle(ui.html,G.getCard(next.round.cardId).title));assert.equal(ui.diceVisible,true);});ui.finishDie();await work;check(()=>{assert.ok(hasTitle(ui.html,G.getCard(next.round.cardId).title));assert.ok(!ui.html.includes('oa-card-discarded'));assert.ok(!ui.html.includes('data-action="challenge-draft"'));});
  }
  const longest=G.legacyCards.reduce((a,b)=>a.title.length>b.title.length?a:b),others=G.legacyCards.filter(c=>c.categoryId===longest.categoryId&&c.id!==longest.id).slice(0,5);let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:G.getCategory(longest.categoryId,1).number,hand:[longest.id,...others.map(c=>c.id)]});game=G.reduce(game,{type:'ROLL_CARD',value:1});const values=new Map([['onde-couple-prototype-v1',JSON.stringify(game)]]),local=shell(mockRemote(),{mode:false,storageValues:values,delayedDie:true,randomFace:1});const work=local.click('reroll');await tick();check(()=>{assert.ok(local.html.includes('<h3 class="oa-discarded-title" title="'+longest.title+'">'+longest.title+'</h3>'));assert.ok(local.html.includes('Carte 1 écartée : '+longest.title));assert.equal((local.html.match(/class="oa-card-ghost"/g)||[]).length,5);});local.finishDie();await work;check(()=>assert.ok(!local.html.includes('oa-card-discarded')));
 }
 // Wrong phases and the other perspective cannot reroll; a failed request keeps the original choice available.
 {
  for(const game of [initial(),draftGame('b'),G.reduce(draftGame(),{type:'CHALLENGE_DRAFT'})]){const remote=mockRemote(snap(game)),ui=shell(remote);await tick();check(()=>assert.ok(!ui.html.includes('Relancer le D6')));await ui.click('reroll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));}
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote);await tick();remote.actionImpl=async()=>{throw Object.assign(new Error('Connexion interrompue.'),{isDesirRemoteError:true,code:'offline'});};await ui.click('reroll');check(()=>assert.equal(ui.diceVisible,false));check(()=>assert.ok(hasTitle(ui.html,G.getCard(game.round.cardId).title)));check(()=>assert.ok(ui.html.includes('Relancer le D6')));
 }
 // The local demo samples uniformly among the three other faces, with a mounted die in every case.
 {
  for(const index of [1,2,3,4,5]){const game=draftGame(),values=new Map([['onde-couple-prototype-v1',JSON.stringify(game)]]),ui=shell(mockRemote(),{mode:false,storageValues:values,randomFace:index});await ui.click('reroll');check(()=>assert.deepEqual(ui.rngSides,[5]));check(()=>assert.deepEqual(ui.die.calls,[index+1]));check(()=>assert.deepEqual(ui.die.visible,[true]));check(()=>assert.ok(!ui.html.includes('data-action="challenge-draft"')));check(()=>assert.ok(!ui.html.includes('Relancer le D6')));}
 }
 // The native checkbox waits for server acknowledgement before the wave starts.
 {
  const at=new Date().toISOString();let game=initial();game=G.reduce(game,{type:'ROLL_CATEGORY',value:1,hand:G.legacyCards.filter(c=>c.categoryId==='complicite').slice(0,6).map(c=>c.id)});game=G.reduce(game,{type:'ROLL_CARD',value:1});game=G.reduce(game,{type:'SEND',at});game=G.reduce(game,{type:'SWITCH_PLAYER',player:'b'});game=G.reduce(game,{type:'ACCEPT',at});game.activePlayer='a';
  const remote=mockRemote(snap(game)),ui=shell(remote);await tick();await ui.click('tab',{tab:'tasks'});check(()=>assert.ok(ui.html.includes('Une fois vécu, chacun coche sa case.')));let resolveAction;remote.actionImpl=action=>{check(()=>assert.equal(action.type,'TOGGLE_TASK_CHECK'));check(()=>assert.equal(action.checked,true));return new Promise(resolve=>resolveAction=()=>{game=G.reduce(game,{...action,at:new Date().toISOString()});resolve(snap(game,2));});};
  const before=ui.writes,change=await ui.taskCheck(game.tasks[0].id,true);await tick();check(()=>assert.equal(change.input.checked,false));check(()=>assert.equal(change.input.disabled,true));check(()=>assert.equal(ui.writes,before));resolveAction();await change.promise;check(()=>assert.equal(change.input.checked,true));check(()=>assert.equal(change.label.classList.contains('is-waving'),true));check(()=>assert.equal(game.stats.totalCompleted,0));const settle=ui.timers.find(t=>t.ms===1200);check(()=>assert.ok(settle));settle.fn();check(()=>assert.ok(ui.html.includes('Les choses')));check(()=>assert.ok(ui.html.includes('Ta coche est posée · Personne B doit encore cocher.')));game.activePlayer='b';const otherUI=shell(mockRemote(snap(game,3)));await tick();await otherUI.click('tab',{tab:'tasks'});check(()=>assert.ok(otherUI.html.includes('Personne A a coché · à toi de jouer.')));
 }
 // Revocation hides the previous private screen rather than falling back to the demo.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('Lancer le D4')));remote.revoke();check(()=>assert.ok(ui.html.includes('autocomplete="current-password"')));check(()=>assert.ok(!ui.html.includes('Lancer le D4')));check(()=>assert.equal(ui.navigation.hidden,true));check(()=>assert.equal(ui.persona.innerHTML,''));
 }
 // Recovery keeps the typed form and pending screen stable, then accepts another actor's lower revision.
 {
  const remote=mockRemote(snap(initial(),10)),ui=shell(remote);await tick();remote.revoke();
  ui.username.value='fixture-b';ui.password.value='still-being-typed';const before=ui.writes;ui.password.focus();
  remote.emit();remote.emit();check(()=>assert.equal(ui.writes,before));check(()=>assert.equal(ui.username.value,'fixture-b'));check(()=>assert.equal(ui.password.value,'still-being-typed'));check(()=>assert.equal(ui.activeElement,ui.password));
  remote.status={...remote.status,message:'La connexion est interrompue.'};remote.emit();check(()=>assert.equal(ui.writes,before));check(()=>assert.equal(ui.password.value,'still-being-typed'));check(()=>assert.equal(ui.loginMessage.textContent,'La connexion est interrompue.'));
  let rejectLogin;remote.loginImpl=()=>new Promise((resolve,reject)=>rejectLogin=reject);const retry=ui.submit('fixture-b','bad-secret');await tick();
  check(()=>assert.ok(ui.html.includes('Connexion…')));check(()=>assert.ok(!ui.html.includes('autocomplete="current-password"')));const pendingWrites=ui.writes;remote.emit();check(()=>assert.equal(ui.writes,pendingWrites));
  rejectLogin(Object.assign(new Error('L’identifiant ou le mot de passe n’est pas reconnu.'),{code:'invalid_credentials',isDesirRemoteError:true}));await retry;
  check(()=>assert.ok(ui.html.includes('autocomplete="current-password"')));check(()=>assert.ok(ui.html.includes('n’est pas reconnu.')));ui.password.value='correcting-password';const afterError=ui.writes;remote.emit();check(()=>assert.equal(ui.writes,afterError));check(()=>assert.equal(ui.password.value,'correcting-password'));
  remote.loginImpl=async()=>snap(initial('b'),1);await ui.submit('fixture-b','fixture-secret-b');check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne B')));check(()=>assert.ok(ui.html.includes('Lancer le D4')));check(()=>assert.equal(ui.navigation.hidden,false));
  const afterLogin=ui.writes;remote.emit(snap(initial('a'),99));check(()=>assert.equal(ui.writes,afterLogin));check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne B')));check(()=>assert.ok(!Array.from(ui.values.values()).join('').includes('secret')));
 }
 // Mobile rendering preserves reading position and the useful action's focus through unrelated updates.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{evidenceTrap:true,mobileScroll:true});await tick();ui.main.scrollTop=320;ui.main.scrollLeft=3;ui.button('send').focus();const changed=copy(game);changed.stats.totalCompleted=1;changed.stats.byCategory.attention=1;remote.emit(snap(changed,2));
  check(()=>{assert.equal(ui.main.scrollTop,320);assert.equal(ui.main.scrollLeft,3);assert.equal(ui.activeElement,ui.button('send'));assert.equal(ui.button('send').focusOptions.preventScroll,true);assertNoEvidence(ui.html);assert.equal(ui.elementScrolls.length,0);});
  ui.main.scrollTop=360;ui.button('challenge-draft').focus();remote.emit(snap(changed,3,0));check(()=>{assert.equal(ui.main.scrollTop,360);assert.equal(ui.activeElement,ui.button('challenge-draft'));assert.equal(ui.button('challenge-draft').focusOptions.preventScroll,true);});
  await ui.click('tab',{tab:'us'});check(()=>assert.equal(ui.main.scrollTop,0));ui.main.scrollTop=400;ui.help.focus();const pending=G.reduce(changed,{type:'SEND',at:new Date().toISOString()});remote.emit(snap(pending,4,0));check(()=>{assert.equal(ui.main.scrollTop,400);assert.equal(ui.activeElement,ui.help);assert.equal(ui.elementScrolls.length,0);});await ui.click('tab',{tab:'us'});check(()=>assert.equal(ui.main.scrollTop,0));
  await ui.click('tab',{tab:'tasks'});ui.main.scrollTop=220;await ui.intervals.find(timer=>timer.ms===30000).fn();check(()=>assert.equal(ui.main.scrollTop,220));await ui.click('tab',{tab:'play'});check(()=>{assert.equal(ui.main.scrollTop,0);assertNoEvidence(ui.html);assert.equal(ui.navigation.hidden,false);assert.equal(ui.elementScrolls.length,0);});
 }
 // Opening an invitation starts its content at the top; a reroll centers only the inner scroller.
 {
  let game=G.reduce(draftGame(),{type:'SEND',at:new Date().toISOString()});game.activePlayer='b';const remote=mockRemote(snap(game)),ui=shell(remote,{evidenceTrap:true,mobileScroll:true});await tick();ui.main.scrollTop=150;await ui.click('open-invitation',{round:game.round.id});check(()=>{assert.equal(ui.main.scrollTop,0);assert.ok(hasTitle(ui.html,G.getCard(game.round.cardId).title));assert.equal(ui.elementScrolls.length,0);});
  const draft=draftGame(),roller=mockRemote(snap(draft)),rolling=shell(roller,{mobileScroll:true,delayedDie:true});await tick();roller.actionImpl=async()=>({...snap(G.reduce(draft,{type:'REROLL_CARD',value:2}),2),roll:{kind:6,value:2}});rolling.main.scrollTop=280;const work=rolling.click('reroll');await tick();check(()=>{assert.ok(rolling.scrollCalls.length>0);assert.equal(rolling.scrollCalls.at(-1).node,rolling.main);assert.equal(rolling.elementScrolls.length,0);assert.equal(rolling.diceVisible,true);});rolling.finishDie();await work;check(()=>assert.equal(rolling.main.scrollTop,0));
 }
 // The sheet locks the main scroller and returns to the same reading position without moving the page.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{evidenceTrap:true,mobileScroll:true});await tick();ui.main.scrollTop=310;ui.bodyStyle.overflow='clip';ui.help.focus();await ui.click('rules');check(()=>{assert.equal(ui.main.inert,true);assert.equal(ui.main.style.overflow,'hidden');assert.equal(ui.bodyStyle.overflow,'hidden');assert.equal(ui.activeElement,ui.closeButton);assert.equal(ui.closeButton.focusOptions.preventScroll,true);assert.equal(ui.dialog.scrollTop,0);});const changed=copy(game);changed.stats.totalCompleted=1;changed.stats.byCategory.attention=1;remote.emit(snap(changed,2));await ui.click('close');check(()=>{assert.equal(ui.main.inert,false);assert.equal(ui.main.style.overflow,'');assert.equal(ui.bodyStyle.overflow,'clip');assert.equal(ui.main.scrollTop,310);assertNoEvidence(ui.html);assert.equal(ui.activeElement,ui.help);assert.equal(ui.help.focusOptions.preventScroll,true);assert.equal(ui.elementScrolls.length,0);});
 }
 // The keyboard viewport changes only a CSS height variable, with no render, focus loss, or pinch-zoom shrink.
 {
  const listeners=new Set(),viewport={height:874,scale:1,addEventListener(type,fn){listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);},emit(){for(const fn of listeners)fn();}};const ui=shell(mockRemote(),{viewport,mobileScroll:true});await tick();const before=ui.writes;ui.password.value='being-typed';ui.password.focus();ui.main.scrollTop=80;check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'874px'));viewport.height=500;viewport.emit();check(()=>{assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'500px');assert.equal(ui.writes,before);assert.equal(ui.password.value,'being-typed');assert.equal(ui.activeElement,ui.password);assert.equal(ui.main.scrollTop,80);});viewport.scale=2;viewport.height=250;viewport.emit();check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'500px'));viewport.scale=1;viewport.height=600;viewport.emit();ui.windowEvent('pagehide');check(()=>assert.equal(listeners.size,0));viewport.height=450;viewport.emit();check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'600px'));ui.windowEvent('pageshow');ui.windowEvent('pageshow');check(()=>{assert.equal(listeners.size,1);assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'450px');assert.equal(ui.writes,before);});
 }
 // Installed iOS must not treat the status-bar-sized visual viewport deficit as a keyboard.
 {
  const listeners=new Set(),viewport={height:812,scale:1,addEventListener(type,fn){listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);},emit(){for(const fn of listeners)fn();}};
  const ui=shell(mockRemote(),{viewport,installed:true,layoutHeight:874,mobileScroll:true});await tick();
  const before=ui.writes;
  check(()=>{assert.equal(ui.root.classList.contains('oa-installed'),true);assert.equal(ui.root.classList.contains('oa-keyboard'),false);});
  ui.password.focus();ui.documentEvent('focusin');check(()=>assert.equal(ui.root.classList.contains('oa-keyboard'),false));
  viewport.height=500;viewport.emit();check(()=>{assert.equal(ui.root.classList.contains('oa-keyboard'),true);assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'500px');assert.equal(ui.activeElement,ui.password);assert.equal(ui.writes,before);});
  viewport.height=812;viewport.emit();check(()=>assert.equal(ui.root.classList.contains('oa-keyboard'),false));
  viewport.height=500;viewport.emit();ui.help.focus();ui.documentEvent('focusout');check(()=>assert.equal(ui.root.classList.contains('oa-keyboard'),false));
 }
 // The unconfigured local demo remains usable without the remote connection.
 {
  const ui=shell(mockRemote(),{mode:false});await tick();check(()=>assert.ok(ui.html.includes('Lancer le D4')));check(()=>assert.equal(ui.navigation.hidden,false));check(()=>assert.ok(ui.values.has('onde-couple-prototype-v1')));
 }
 console.log(`Dés·ir remote UI: ${checks} targeted checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
