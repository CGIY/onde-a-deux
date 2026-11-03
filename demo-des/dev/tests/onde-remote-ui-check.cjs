// Run the actual UI against a controlled authenticated transport and DOM shell.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/onde-app-ui.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;const check=fn=>{fn();checks++;};
const roomId='b98c371d-6355-4d37-a9bc-18f1228fd386';
function initial(actor='a'){const s=G.createState();s.activePlayer=actor;s.players=[{id:'a',name:'Personne A'},{id:'b',name:'Personne B'}];return s;}
function scored(total,actor='a'){const s=initial(actor);s.stats.totalCompleted=total;s.stats.byCategory.detente=total;assert.ok(G.validateState(s));return s;}
function gradeSection(html){const found=html.match(/<section class="oa-grade-area[^"]*"[\s\S]*?<\/section>/);assert.ok(found,'grade section is rendered');return found[0];}
function gradeProgress(html){const section=gradeSection(html),progress=section.match(/role="progressbar"[^>]+/)[0];return {points:Number((section.match(/data-grade="(\d+)"/)||[])[1])||null,max:Number(progress.match(/aria-valuemax="(\d+)"/)[1]),value:Number(progress.match(/aria-valuenow="(\d+)"/)[1])};}
function draftGame(actor='a',face=1){let s=initial();s=G.reduce(s,{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});s=G.reduce(s,{type:'ROLL_CARD',value:face});s.activePlayer=actor;assert.ok(G.validateState(s));return s;}
function snap(state,revision=1,remaining=1){return {roomId,state:copy(state),revision,actor:state.activePlayer,paired:true,quota:{remaining,window:'2026-11-02T06:00',label:'6 h – 12 h',nextAt:'2026-11-02T11:00:00.000Z'},serverTime:new Date().toISOString()};}
function mockRemote(restored=null){
 let listener=null,current=restored,identity=restored?{roomId,actor:restored.actor}:null,authenticated=!!restored;
 const calls=[],r={enabled:true,status:{phase:restored?'connected':'disconnected',message:'',errorCode:null},notificationStatus:{supported:true,permission:'default',subscribed:false,message:''},calls,get connection(){return identity;},get authenticated(){return authenticated;},get snapshot(){return current&&copy(current);},subscribeToChanges(fn){listener=fn;return()=>listener=null;},start(){calls.push({method:'start'});},restore:async()=>current&&copy(current),refresh:async()=>current&&copy(current),async login(username,password){calls.push({method:'login',username,password});r.status={phase:'connecting',message:'',errorCode:null};r.emit();try{const next=await (r.loginImpl?r.loginImpl(username,password):snap(initial()));identity={roomId,actor:next.actor};authenticated=true;r.status={phase:'connected',message:'',errorCode:null};r.emit(next);return copy(next);}catch(error){r.status={phase:'error',message:error.message,errorCode:error.code};r.emit();throw error;}},async action(action){calls.push({method:'action',action:copy(action)});const next=await r.actionImpl(action);r.emit({...next,roll:undefined});return copy(next);},async enableNotifications(){calls.push({method:'notifications'});r.notificationStatus={...r.notificationStatus,permission:'granted',subscribed:true};r.emit();return r.notificationStatus;},emit(next){if(next)current=copy(next);if(listener)listener({snapshot:current&&copy(current),status:{...r.status},notificationStatus:{...r.notificationStatus}});},revoke(){authenticated=false;r.status={phase:'error',message:'Reconnecte cet appareil.',errorCode:'unauthorized'};r.emit();}};
 return r;
}
function shell(remote,{mode=true,delayedDie=false,welcomeSeen=true,storageValues=null,storageBlocked=false,reduced=false,randomFace=null,evidence=false,mobileScroll=false,viewport=null}={}){
 const values=storageValues||new Map();if(welcomeSeen)values.set('desir-welcome-v1','1');
 const handlers={},windowHandlers={},timers=[],intervals=[];let mainHTML='',writes=0,rngCalls=0,dieRunning=false,interrupted=0,resolveDie=null,diceCanvas=null;const rngSides=[],gradeAnimations=[],frames=new Map(),elementScrolls=[],scrollCalls=[];let clockMs=0,frameId=0,canvasRelease=null;
 let document;
 function node(dataset={}){const classes=new Set();return {dataset,hidden:false,disabled:false,inert:false,isConnected:true,innerHTML:'',textContent:'',value:'',checked:false,scrollTop:0,scrollLeft:0,clientHeight:600,children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,v){if(v)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},style:{values:new Map(),setProperty(k,v){this.values.set(k,v);},getPropertyValue(k){return this.values.get(k)||'';}},getBoundingClientRect(){return {left:0,top:0,right:240,bottom:50,height:50,width:240};},setAttribute(k,v){this[k]=String(v);},removeAttribute(k){delete this[k];},focus(options){this.focusOptions=options;document.activeElement=this;},matches(){return false;},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},append(x){this.children.push(x);},prepend(x){x.parentElement=this;},removeChild(x){x.parentElement=null;},scrollIntoView(options){elementScrolls.push({node:this,options});},scrollTo(options){this.scrollTop=options.top||0;this.scrollLeft=options.left||0;scrollCalls.push({node:this,options});}};}
 const root=node(),main=node(),sheet=node(),persona=node(),navigation=node(),toast=node(),announcement=node(),help=node(),count=node(),incoming=node(),title=node(),username=node(),password=node(),loginMessage=node(),rollButton=node({action:'roll'}),rollStatus=node(),shellNode=node(),source=node(),sourceSummary=node(),sourceLink=node(),dialog=node(),closeButton=node({action:'close'});
 sourceSummary.tagName='SUMMARY';sourceLink.tagName='A';sourceSummary.closest=sourceLink.closest=()=>source;source.querySelector=selector=>selector==='summary'?sourceSummary:selector==='a'?sourceLink:null;main.getBoundingClientRect=()=>({left:0,top:100,right:402,bottom:700,width:402,height:600});
 sheet.querySelector=selector=>selector==='button'?closeButton:selector==='.oa-sheet'?dialog:null;sheet.querySelectorAll=()=>[closeButton];
 sheet.hidden=true;persona.innerHTML='DEMO-PROFILE-CONTROLS';
 const navButtons=['play','tasks','us'].map(tab=>node({action:'tab',tab}));
 const profileButtons=['a','b'].map(player=>node({action:'profile',player}));
 const actionButtons=new Map([['roll',rollButton],...['reroll','send','accept','new','challenge','challenge-draft'].map(action=>[action,node({action})])]);for(const button of actionButtons.values())button.closest=()=>button;
 const controls=[...navButtons,...profileButtons,help,...actionButtons.values()];
 Object.defineProperty(main,'innerHTML',{get:()=>mainHTML,set:value=>{mainHTML=value;writes++;main.scrollTop=0;main.scrollLeft=0;source.open=false;source.dataset.sourceCard=(value.match(/data-source-card="([^"]+)"/)||[])[1];if(value.includes('id="oa-username"')){username.value=(value.match(/id="oa-username"[^>]*value="([^"]*)"/)||[])[1]||'';password.value='';}}});
 main.querySelector=selector=>{
  if(selector==='[data-grade]'){const match=mainHTML.match(/data-grade="(\d+)"/);if(!match)return null;const grade=node({grade:match[1]});grade.animate=(frames,options)=>gradeAnimations.push({frames,options});return grade;}
  if(selector==='h1')return mainHTML.includes('<h1')?title:null;
  if(selector==='[data-roll-status]')return mainHTML.includes('data-roll-status')?rollStatus:null;
  if(selector==='[data-login-error]')return mainHTML.includes('data-login-error')?loginMessage:null;
  if(selector==='[data-stage]'){const match=mainHTML.match(/data-stage data-kind="(\d+)" data-value="([^"]*)"/);if(!match)return null;const holder=node({kind:match[1],value:match[2]});return holder;}
  const action=selector.match(/^\[data-action="([^"]+)"\]$/);if(action)return mainHTML.includes('data-action="'+action[1]+'"')?actionButtons.get(action[1])||null:null;
  return null;
 };
 main.querySelectorAll=selector=>selector==='details.oa-source'?(mainHTML.includes('data-source-card')?[source]:[]):selector==='button,input'?Array.from(actionButtons.values()):[];
 main.contains=el=>el===title&&mainHTML.includes('<h1')||[username,password].includes(el)&&mainHTML.includes('id="oa-username"')||[sourceSummary,sourceLink].includes(el)&&mainHTML.includes('data-source-card');
 root.contains=()=>true;root.getAnimations=()=>[];
 root.addEventListener=(type,handler)=>{handlers[type]=handler;};
 root.querySelector=selector=>({'#oa-main':main,'#oa-sheet':sheet,'.oa-persona':persona,'.oa-nav':navigation,'#oa-toast':toast,'#oa-announcement':announcement,'[data-action="rules"]':help,'.oa-task-count':count,'.oa-incoming-dot':incoming,'.oa-shell':shellNode,'#oa-username':username,'#oa-password':password}[selector]||null);
 root.querySelectorAll=selector=>selector==='.oa-nav button'?navButtons:selector==='.oa-switch [data-action="profile"]'?profileButtons:controls;
 shellNode.children=[persona,main,navigation,toast,sheet,announcement];
 document={activeElement:null,hidden:false,body:{style:{}},getElementById:id=>id==='onde-app-v1'?root:null,createElement:()=>node(),addEventListener(){}};
 const die={setKind(kind,value){if(dieRunning)interrupted++;die.kinds.push([kind,value]);},setReducedMotion(){},setCharge(power){die.charges.push(power);},async roll(value,options){die.calls.push(value);die.options.push(options);die.visible.push(!!diceCanvas?.parentElement&&mainHTML.includes('data-stage'));dieRunning=true;if(delayedDie)await new Promise(resolve=>resolveDie=resolve);dieRunning=false;},calls:[],kinds:[],options:[],visible:[],charges:[]};
 const ctx={visualViewport:viewport,getComputedStyle:()=>({overflowY:mobileScroll?(main.style.overflow||'auto'):'visible'}),performance:{now:()=>clockMs},requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},console,Date,Map,Set,Array,JSON,String,Number,Math,Promise,document,localStorage:{getItem(k){if(storageBlocked)throw Error('Storage unavailable');return values.get(k)||null;},setItem(k,v){if(storageBlocked)throw Error('Storage unavailable');values.set(k,String(v));},removeItem(k){if(storageBlocked)throw Error('Storage unavailable');values.delete(k);}},sessionStorage:{getItem(){return null;},setItem(){}},OndeGame:{...G,randomInt(n){rngCalls++;rngSides.push(n);return randomFace===null?G.randomInt(n):randomFace;}},OndeDice:{create:(canvas,options)=>{diceCanvas=canvas;canvasRelease=options.onRelease;return die;}},OndeEvidence:{forCard:()=>evidence?{metric:'64 %',headline:'Fixture',detail:'Résultat sourcé.',scope:'Population test',year:2026,limitations:'Contexte de test.',url:'https://example.test/study',sourceTitle:'Étude de contrôle'}:null},OndeRemote:{create:()=>remote},DesirConfig:mode?{endpoint:'https://example.supabase.co/functions/v1/desir-game'}:{},matchMedia:()=>({matches:reduced,addEventListener(){}}),setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},clearInterval(){},addEventListener(type,fn){windowHandlers[type]=fn;},removeEventListener(type,fn){if(windowHandlers[type]===fn)delete windowHandlers[type];}};
 ctx.window=ctx;
 vm.runInNewContext(code,ctx,{filename:'onde-app-ui.js'});
 function event(target,props={}){return {target,detail:0,preventDefault(){this.defaultPrevented=true;},...props};}
 return {root,main,sheet,persona,navigation,help,username,password,loginMessage,rollStatus,die,rngSides,gradeAnimations,controls,timers,intervals,values,announcement,toast,source,sourceSummary,sourceLink,dialog,closeButton,elementScrolls,scrollCalls,bodyStyle:document.body.style,get html(){return mainHTML;},get diceVisible(){return !!diceCanvas?.parentElement&&mainHTML.includes('data-stage');},get activeElement(){return document.activeElement;},get writes(){return writes;},get rngCalls(){return rngCalls;},get interrupted(){return interrupted;},get frameCount(){return frames.size;},advance(ms){clockMs+=ms;const pending=Array.from(frames.values());frames.clear();for(const fn of pending)fn();},windowEvent(type,props={}){return windowHandlers[type]?.(event(null,props));},async pointer(type,action='roll',props={}){const button=actionButtons.get(action);return handlers[type](event(button,{button:0,isPrimary:true,pointerId:1,clientX:50,clientY:25,...props}));},async key(type,key=' ',props={}){const button=actionButtons.get('roll');if(type==='keydown'&&!props.noFocus)button.focus();return handlers[type](event(button,{key,code:key===' '?'Space':key,...props}));},button(action='roll'){return actionButtons.get(action);},async releaseCanvas(power){return canvasRelease(power);},finishDie(){resolveDie();},async click(action,extra={},detail=0){const el=actionButtons.get(action)||node({action,...extra});el.closest=()=>el;await handlers.click(event(el,{detail}));return el;},async submit(user,secret){username.value=user;password.value=secret;const form=node();form.matches=selector=>selector==='[data-login-form]';return handlers.submit(event(form));},async taskCheck(id,checked){const label=node(),article=node(),input=node({taskCheck:id,player:'a'});input.checked=checked;input.closest=selector=>selector==='label'?label:article;const promise=handlers.change(event(input));return {input,label,promise};}};
}
async function rollSession(options={}){
 const remote=mockRemote(snap(initial()));remote.actionImpl=async action=>{assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',roundId:'onde-1'});const game=G.reduce(remote.snapshot.state,{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});return {...snap(game,remote.snapshot.revision+1,0),roll:{kind:6,value:2}};};
 const ui=shell(remote,options);await tick();return {remote,ui};
}
(async()=>{
 // The first launch explains the game once, before login, without starting an action.
 {
  const remote=mockRemote(),ui=shell(remote,{welcomeSeen:false});const before=ui.writes;await tick();
  for(const sentence of ['Les dés choisissent une idée à deux.','Propose-la ou tente de l’écarter au D20.','Deux coches dans les 6 h, un point pour vous.'])check(()=>assert.ok(ui.html.includes(sentence)));
  check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('C’est parti')));check(()=>assert.ok(!ui.html.includes('autocomplete="username"')));check(()=>assert.equal(ui.persona.hidden,true));check(()=>assert.equal(ui.navigation.hidden,true));check(()=>assert.equal(ui.help.hidden,true));
  await ui.click('roll');await ui.click('rules');await ui.submit('fixture-user','fixture-password');check(()=>assert.equal(remote.calls.filter(c=>['action','login'].includes(c.method)).length,0));check(()=>assert.equal(ui.sheet.hidden,true));
  await ui.click('welcome-start');check(()=>assert.equal(ui.values.get('desir-welcome-v1'),'1'));check(()=>assert.ok(ui.html.includes('autocomplete="username"')));check(()=>assert.ok(!ui.html.includes('C’est parti')));
  await ui.submit('fixture-user','fixture-password');check(()=>assert.ok(ui.html.includes('Lancer le D6')));remote.revoke();check(()=>assert.ok(!ui.html.includes('C’est parti')));
  const reloaded=shell(mockRemote(),{welcomeSeen:false,storageValues:ui.values});await tick();check(()=>assert.ok(reloaded.html.includes('autocomplete="username"')));check(()=>assert.ok(!reloaded.html.includes('C’est parti')));
 }
 // An existing session restores behind the welcome without exposing its private card or identities.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{welcomeSeen:false});await tick();const before=ui.writes;
  let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});game=G.reduce(game,{type:'ROLL_CARD',value:1});remote.emit(snap(game,3));remote.emit();
  check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('C’est parti')));check(()=>assert.ok(!ui.html.includes(G.getCard(game.round.cardId).title)));check(()=>assert.equal(ui.persona.innerHTML,''));check(()=>assert.equal(ui.navigation.hidden,true));
  await ui.click('welcome-start');check(()=>assert.ok(ui.html.includes(G.getCard(game.round.cardId).title)));check(()=>assert.ok(ui.persona.innerHTML.includes('Personne A')));check(()=>assert.equal(ui.navigation.hidden,false));check(()=>assert.equal(remote.calls.filter(c=>c.method==='login'||c.method==='action').length,0));
  const reloaded=shell(mockRemote(snap(game,3)),{welcomeSeen:false,storageValues:ui.values});await tick();check(()=>assert.ok(reloaded.html.includes(G.getCard(game.round.cardId).title)));check(()=>assert.ok(!reloaded.html.includes('C’est parti')));
 }
 // Dismissing during a slow restore reveals its pending screen, then the recovered game.
 {
  const remote=mockRemote(snap(initial()));let resolveRestore;remote.restore=()=>new Promise(resolve=>resolveRestore=resolve);const ui=shell(remote,{welcomeSeen:false});await tick();check(()=>assert.ok(ui.html.includes('C’est parti')));await ui.click('welcome-start');check(()=>assert.ok(ui.html.includes('Connexion…')));resolveRestore(snap(initial()));await tick();check(()=>assert.ok(ui.html.includes('Lancer le D6')));check(()=>assert.ok(!ui.html.includes('C’est parti')));
 }
 // Blocked storage degrades to the current page's memory and never prevents dismissal.
 {
  const remote=mockRemote(),ui=shell(remote,{welcomeSeen:false,storageBlocked:true});await tick();check(()=>assert.ok(ui.html.includes('C’est parti')));await ui.click('welcome-start');check(()=>assert.ok(ui.html.includes('autocomplete="username"')));remote.emit();check(()=>assert.ok(!ui.html.includes('C’est parti')));check(()=>assert.equal(ui.values.has('desir-welcome-v1'),false));
  const reopened=shell(mockRemote(),{welcomeSeen:false,storageBlocked:true});await tick();check(()=>assert.ok(reopened.html.includes('C’est parti')));
 }
 // No local game or private identity is rendered while the login is required.
 {
  const remote=mockRemote(),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('autocomplete="username"')));check(()=>assert.ok(ui.html.includes('autocomplete="current-password"')));check(()=>assert.ok(!ui.html.includes('Lancer le D6')));check(()=>assert.ok(!ui.html.includes('Personne A')));check(()=>assert.equal(ui.persona.hidden,true));check(()=>assert.equal(ui.persona.innerHTML,''));check(()=>assert.equal(ui.navigation.hidden,true));
  let finish;remote.loginImpl=()=>new Promise(resolve=>finish=resolve);const work=ui.submit('fixture-user','fixture-password');await tick();check(()=>assert.equal(ui.password.value,''));check(()=>assert.ok(!Array.from(ui.values.values()).join('').includes('fixture-password')));check(()=>assert.ok(ui.html.includes('Connexion…')));finish(snap(initial()));await work;check(()=>assert.ok(ui.html.includes('Lancer le D6')));check(()=>assert.ok(ui.persona.innerHTML.includes('Personne A')));check(()=>assert.ok(!ui.persona.innerHTML.includes('<button')));check(()=>assert.equal(ui.navigation.hidden,false));await ui.click('profile',{player:'b'});check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne A')));
 }
 // The server's face is used, and its new state is hidden until the die settles.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{delayedDie:true});await tick();
  let next=G.reduce(initial(),{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});
  remote.actionImpl=async action=>{check(()=>assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',roundId:'onde-1'}));return {...snap(next,2,0),roll:{kind:6,value:2}};};
  const before=ui.writes,work=ui.click('roll');await tick();check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.deepEqual(ui.die.calls,[2]));check(()=>assert.equal(ui.writes,before));check(()=>assert.ok(ui.html.includes('Un peu de hasard.')));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(ui.html.includes('Détente.')));check(()=>assert.ok(ui.html.includes('Lancer le D4')));check(()=>assert.equal(ui.interrupted,0));
 }
 // Holding changes only visual power, caps its work, and cannot add a second native click roll.
 {
  const {remote,ui}=await rollSession();await ui.pointer('pointerdown');ui.advance(600);check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0.5'));check(()=>assert.equal(ui.die.charges.at(-1),.5));check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));ui.advance(600);check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'1'));check(()=>assert.equal(ui.frameCount,0));ui.advance(9000);check(()=>assert.equal(ui.frameCount,0));await ui.pointer('pointerup');await ui.click('roll',{},1);check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));check(()=>assert.deepEqual(copy(ui.die.options),[{duration:1650,power:1}]));check(()=>assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0'));check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.equal(ui.button()['aria-valuenow'],undefined));
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
   check(()=>{assert.equal(remote.calls.filter(c=>c.method==='action').length,0,reason);assert.equal(ui.frameCount,0);assert.equal(ui.button().style.getPropertyValue('--oa-charge'),'0');assert.equal(ui.die.charges.at(-1),0);});
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
  const {remote,ui}=await rollSession({delayedDie:true});let reply;remote.actionImpl=action=>{check(()=>assert.deepEqual(copy(action),{type:'ROLL_CATEGORY',roundId:'onde-1'}));return new Promise(resolve=>reply=()=>{const game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});resolve({...snap(game,2,0),roll:{kind:6,value:2}});});};await ui.pointer('pointerdown');ui.advance(600);const work=ui.pointer('pointerup');await tick();check(()=>assert.equal(ui.button().textContent,'Tirage…'));check(()=>assert.equal(ui.die.calls.length,0));reply();await tick();check(()=>assert.equal(ui.button().textContent,'Le dé roule…'));check(()=>assert.equal(ui.die.options[0].power,.5));ui.finishDie();await work;await ui.click('roll',{},1);check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
 }
 // Network actions have immediate waiting feedback and preserve disabled controls until acknowledgement.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote);await tick();let resolveAction;remote.actionImpl=()=>new Promise(resolve=>resolveAction=()=>resolve(snap(G.reduce(game,{type:'SEND',at:new Date().toISOString()}),2)));const work=ui.click('send');await tick();check(()=>assert.equal(ui.button('send').textContent,'Envoi…'));check(()=>assert.equal(ui.button('send')['aria-busy'],'true'));check(()=>assert.ok(ui.controls.every(c=>c.disabled)));resolveAction();await work;check(()=>assert.equal(ui.button('send')['aria-busy'],undefined));
 }
 // A newer projection received during the animation wins when it finishes.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote,{delayedDie:true});await tick();
  let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:3,hand:G.cards.filter(c=>c.categoryId==='projets').slice(0,4).map(c=>c.id)});
  remote.actionImpl=async()=>({...snap(game,2,0),roll:{kind:6,value:3}});const work=ui.click('roll');await tick();const before=ui.writes;
  game=G.reduce(game,{type:'ROLL_CARD',value:1});remote.emit(snap(game,3,0));check(()=>assert.equal(ui.writes,before));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(ui.html.includes('Ta prochaine')));check(()=>assert.ok(!ui.html.includes('Lancer le D4')));
 }
 // Quota exhaustion affects only the D6 action and does not open another server request.
 {
  const remote=mockRemote(snap(initial(),1,0)),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('Prochain tirage')));check(()=>assert.ok(!ui.html.includes('data-action="roll"')));await ui.click('roll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));remote.emit(snap(initial(),1,1));check(()=>assert.ok(ui.html.includes('Lancer le D6')));await ui.click('rules');check(()=>assert.ok(!ui.sheet.innerHTML.includes('oa-odds-table')));check(()=>assert.ok(!ui.sheet.innerHTML.includes('quota')));check(()=>assert.ok(!ui.sheet.innerHTML.includes('77,25')));
 }
 // Personal settings and notification permissions remain on this device.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote);await tick();await ui.click('tab',{tab:'us'});check(()=>assert.ok(!ui.html.includes('À notre')));check(()=>assert.ok(!ui.html.includes('reset-confirm')));check(()=>assert.ok(ui.html.includes('Activer les notifications')));await ui.click('enable-notifications');check(()=>assert.equal(remote.calls.filter(c=>c.method==='notifications').length,1));check(()=>assert.ok(ui.html.includes('Activées sur cet appareil.')));
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
 // A remote reroll visibly mounts the D4 before the network reply and reveals only after its animation.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{delayedDie:true});await tick();check(()=>assert.ok(ui.html.includes('Relancer le D4 · sans mon D20')));let resolveAction;const next=G.reduce(game,{type:'REROLL_CARD',value:2});remote.actionImpl=action=>{check(()=>assert.deepEqual(copy(action),{type:'REROLL_CARD',roundId:game.round.id}));return new Promise(resolve=>resolveAction=()=>resolve({...snap(next,2),roll:{kind:4,value:2}}));};
  const work=ui.click('reroll');await tick();check(()=>assert.equal(ui.diceVisible,true));check(()=>{assert.ok(ui.html.includes('class="oa-roll-status" data-roll-status role="status" aria-busy="true"'));assert.ok(!ui.html.includes('data-action="roll"'));assert.equal(ui.rollStatus.textContent,'Tirage…');assert.equal(ui.rollStatus['aria-busy'],'true');assert.equal(ui.rollStatus.disabled,false);});check(()=>assert.ok(ui.html.includes('Le D4')));check(()=>assert.ok(ui.controls.every(c=>c.disabled)));await ui.click('send');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));resolveAction();await tick();check(()=>assert.equal(ui.rollStatus.textContent,'Le dé roule…'));check(()=>assert.deepEqual(ui.die.calls,[2]));check(()=>assert.deepEqual(ui.die.visible,[true]));check(()=>assert.equal(ui.rngCalls,0));check(()=>assert.ok(!ui.html.includes(G.getCard(next.round.cardId).title)));check(()=>assert.equal(ui.interrupted,0));ui.finishDie();await work;check(()=>assert.ok(!ui.html.includes('data-roll-status')));check(()=>assert.ok(ui.html.includes(G.getCard(next.round.cardId).title)));check(()=>assert.ok(!ui.html.includes('Relancer le D4')));check(()=>assert.ok(!ui.html.includes('data-action="challenge-draft"')));check(()=>assert.ok(ui.html.includes('Proposer à')));await ui.click('reroll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,1));
 }
 // During a reroll, the original slot alone stays readable and the other three slots contain no hidden titles.
 {
  for(const slot of [1,2,3,4]){
   const game=draftGame('a',slot),remote=mockRemote(snap(game)),ui=shell(remote,{delayedDie:true});await tick();let resolveAction;const face=slot%4+1,next=G.reduce(game,{type:'REROLL_CARD',value:face});remote.actionImpl=()=>new Promise(resolve=>resolveAction=()=>resolve({...snap(next,2),roll:{kind:4,value:face}}));const work=ui.click('reroll');await tick();
   const grid=ui.html.slice(ui.html.indexOf('<div class="oa-card-grid')),tiles=Array.from(grid.matchAll(/<div class="oa-mini-card oa-card-back([^"]*)" aria-label="([^"]+)">/g));
   check(()=>{assert.equal(tiles.length,4);assert.equal(tiles.filter(tile=>tile[1].includes('oa-card-discarded')).length,1);assert.ok(tiles[slot-1][1].includes('oa-card-discarded'));assert.ok(tiles[slot-1][2].includes(G.getCard(game.round.cardId).title));assert.ok(grid.includes('Écartée'));assert.equal((grid.match(/class="oa-card-ghost"/g)||[]).length,3);assert.ok(!/<(?:button|input)\b|data-action=|tabindex=/.test(grid));for(const id of game.round.hand.filter(id=>id!==game.round.cardId)){assert.ok(!grid.includes(G.getCard(id).title));assert.ok(!grid.includes(id));}});
   resolveAction();await tick();check(()=>{assert.ok(ui.html.includes(G.getCard(game.round.cardId).title));assert.ok(!ui.html.includes(G.getCard(next.round.cardId).title));assert.equal(ui.diceVisible,true);});ui.finishDie();await work;check(()=>{assert.ok(ui.html.includes(G.getCard(next.round.cardId).title));assert.ok(!ui.html.includes('oa-card-discarded'));assert.ok(!ui.html.includes('data-action="challenge-draft"'));});
  }
  const longest=G.cards.reduce((a,b)=>a.title.length>b.title.length?a:b),others=G.cards.filter(c=>c.categoryId===longest.categoryId&&c.id!==longest.id).slice(0,3);let game=G.reduce(initial(),{type:'ROLL_CATEGORY',value:G.getCategory(longest.categoryId).number,hand:[longest.id,...others.map(c=>c.id)]});game=G.reduce(game,{type:'ROLL_CARD',value:1});const values=new Map([['onde-couple-prototype-v1',JSON.stringify(game)]]),local=shell(mockRemote(),{mode:false,storageValues:values,delayedDie:true,randomFace:1});const work=local.click('reroll');await tick();check(()=>{assert.ok(local.html.includes('<h3 class="oa-discarded-title" title="'+longest.title+'">'+longest.title+'</h3>'));assert.ok(local.html.includes('Carte 1 écartée : '+longest.title));assert.equal((local.html.match(/class="oa-card-ghost"/g)||[]).length,3);});local.finishDie();await work;check(()=>assert.ok(!local.html.includes('oa-card-discarded')));
 }
 // Wrong phases and the other perspective cannot reroll; a failed request keeps the original choice available.
 {
  for(const game of [initial(),draftGame('b'),G.reduce(draftGame(),{type:'CHALLENGE_DRAFT'})]){const remote=mockRemote(snap(game)),ui=shell(remote);await tick();check(()=>assert.ok(!ui.html.includes('Relancer le D4')));await ui.click('reroll');check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));}
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote);await tick();remote.actionImpl=async()=>{throw Object.assign(new Error('Connexion interrompue.'),{isDesirRemoteError:true,code:'offline'});};await ui.click('reroll');check(()=>assert.equal(ui.diceVisible,false));check(()=>assert.ok(ui.html.includes(G.getCard(game.round.cardId).title)));check(()=>assert.ok(ui.html.includes('Relancer le D4')));
 }
 // The local demo samples uniformly among the three other faces, with a mounted die in every case.
 {
  for(const index of [1,2,3]){const game=draftGame(),values=new Map([['onde-couple-prototype-v1',JSON.stringify(game)]]),ui=shell(mockRemote(),{mode:false,storageValues:values,randomFace:index});await ui.click('reroll');check(()=>assert.deepEqual(ui.rngSides,[3]));check(()=>assert.deepEqual(ui.die.calls,[index+1]));check(()=>assert.deepEqual(ui.die.visible,[true]));check(()=>assert.ok(!ui.html.includes('data-action="challenge-draft"')));check(()=>assert.ok(!ui.html.includes('Relancer le D4')));}
 }
 // The native checkbox waits for server acknowledgement before the wave starts.
 {
  const at=new Date().toISOString();let game=initial();game=G.reduce(game,{type:'ROLL_CATEGORY',value:1,hand:G.cards.filter(c=>c.categoryId==='complicite').slice(0,4).map(c=>c.id)});game=G.reduce(game,{type:'ROLL_CARD',value:1});game=G.reduce(game,{type:'SEND',at});game=G.reduce(game,{type:'SWITCH_PLAYER',player:'b'});game=G.reduce(game,{type:'ACCEPT',at});game.activePlayer='a';
  const remote=mockRemote(snap(game)),ui=shell(remote);await tick();await ui.click('tab',{tab:'tasks'});let resolveAction;remote.actionImpl=action=>{check(()=>assert.equal(action.type,'TOGGLE_TASK_CHECK'));check(()=>assert.equal(action.checked,true));return new Promise(resolve=>resolveAction=()=>{game=G.reduce(game,{...action,at:new Date().toISOString()});resolve(snap(game,2));});};
  const before=ui.writes,change=await ui.taskCheck(game.tasks[0].id,true);await tick();check(()=>assert.equal(change.input.checked,false));check(()=>assert.equal(change.input.disabled,true));check(()=>assert.equal(ui.writes,before));resolveAction();await change.promise;check(()=>assert.equal(change.input.checked,true));check(()=>assert.equal(change.label.classList.contains('is-waving'),true));check(()=>assert.equal(game.stats.totalCompleted,0));const settle=ui.timers.find(t=>t.ms===640);check(()=>assert.ok(settle));settle.fn();check(()=>assert.ok(ui.html.includes('Les choses')));
 }
 // Revocation hides the previous private screen rather than falling back to the demo.
 {
  const remote=mockRemote(snap(initial())),ui=shell(remote);await tick();check(()=>assert.ok(ui.html.includes('Lancer le D6')));remote.revoke();check(()=>assert.ok(ui.html.includes('autocomplete="current-password"')));check(()=>assert.ok(!ui.html.includes('Lancer le D6')));check(()=>assert.equal(ui.navigation.hidden,true));check(()=>assert.equal(ui.persona.innerHTML,''));
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
  remote.loginImpl=async()=>snap(initial('b'),1);await ui.submit('fixture-b','fixture-secret-b');check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne B')));check(()=>assert.ok(ui.html.includes('Aucune invitation.')));check(()=>assert.equal(ui.navigation.hidden,false));
  const afterLogin=ui.writes;remote.emit(snap(initial('a'),99));check(()=>assert.equal(ui.writes,afterLogin));check(()=>assert.ok(ui.persona.innerHTML.includes('aria-current="true">Personne B')));check(()=>assert.ok(!Array.from(ui.values.values()).join('').includes('secret')));
 }
 // Mobile rendering preserves reading position, source expansion and focus through unrelated updates.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{evidence:true,mobileScroll:true});await tick();ui.main.scrollTop=320;ui.main.scrollLeft=3;ui.source.open=true;ui.sourceSummary.focus();const changed=copy(game);changed.stats.totalCompleted=1;changed.stats.byCategory.detente=1;remote.emit(snap(changed,2));
  check(()=>{assert.equal(ui.main.scrollTop,320);assert.equal(ui.main.scrollLeft,3);assert.equal(ui.source.open,true);assert.equal(ui.activeElement,ui.sourceSummary);assert.equal(ui.sourceSummary.focusOptions.preventScroll,true);assert.equal(ui.elementScrolls.length,0);});
  ui.main.scrollTop=360;ui.sourceLink.focus();remote.emit(snap(changed,3,0));check(()=>{assert.equal(ui.main.scrollTop,360);assert.equal(ui.source.open,true);assert.equal(ui.activeElement,ui.sourceLink);assert.equal(ui.sourceLink.focusOptions.preventScroll,true);});
  await ui.click('tab',{tab:'us'});check(()=>assert.equal(ui.main.scrollTop,0));ui.main.scrollTop=400;ui.help.focus();const pending=G.reduce(changed,{type:'SEND',at:new Date().toISOString()});remote.emit(snap(pending,4,0));check(()=>{assert.equal(ui.main.scrollTop,400);assert.equal(ui.activeElement,ui.help);assert.equal(ui.elementScrolls.length,0);});await ui.click('tab',{tab:'us'});check(()=>assert.equal(ui.main.scrollTop,0));
  await ui.click('tab',{tab:'tasks'});ui.main.scrollTop=220;await ui.intervals.find(timer=>timer.ms===30000).fn();check(()=>assert.equal(ui.main.scrollTop,220));await ui.click('tab',{tab:'play'});check(()=>{assert.equal(ui.main.scrollTop,0);assert.equal(ui.source.open,false);assert.equal(ui.navigation.hidden,false);assert.equal(ui.elementScrolls.length,0);});
 }
 // Opening an invitation starts its content at the top; a reroll centers only the inner scroller.
 {
  let game=G.reduce(draftGame(),{type:'SEND',at:new Date().toISOString()});game.activePlayer='b';const remote=mockRemote(snap(game)),ui=shell(remote,{evidence:true,mobileScroll:true});await tick();ui.main.scrollTop=150;await ui.click('open-invitation',{round:game.round.id});check(()=>{assert.equal(ui.main.scrollTop,0);assert.ok(ui.html.includes(G.getCard(game.round.cardId).title));assert.equal(ui.elementScrolls.length,0);});
  const draft=draftGame(),roller=mockRemote(snap(draft)),rolling=shell(roller,{mobileScroll:true,delayedDie:true});await tick();roller.actionImpl=async()=>({...snap(G.reduce(draft,{type:'REROLL_CARD',value:2}),2),roll:{kind:4,value:2}});rolling.main.scrollTop=280;const work=rolling.click('reroll');await tick();check(()=>{assert.ok(rolling.scrollCalls.length>0);assert.equal(rolling.scrollCalls.at(-1).node,rolling.main);assert.equal(rolling.elementScrolls.length,0);assert.equal(rolling.diceVisible,true);});rolling.finishDie();await work;check(()=>assert.equal(rolling.main.scrollTop,0));
 }
 // The sheet locks the main scroller and returns to the same reading position without moving the page.
 {
  const game=draftGame(),remote=mockRemote(snap(game)),ui=shell(remote,{evidence:true,mobileScroll:true});await tick();ui.main.scrollTop=310;ui.source.open=true;ui.bodyStyle.overflow='clip';ui.help.focus();await ui.click('rules');check(()=>{assert.equal(ui.main.inert,true);assert.equal(ui.main.style.overflow,'hidden');assert.equal(ui.bodyStyle.overflow,'hidden');assert.equal(ui.activeElement,ui.closeButton);assert.equal(ui.closeButton.focusOptions.preventScroll,true);assert.equal(ui.dialog.scrollTop,0);});const changed=copy(game);changed.stats.totalCompleted=1;changed.stats.byCategory.detente=1;remote.emit(snap(changed,2));await ui.click('close');check(()=>{assert.equal(ui.main.inert,false);assert.equal(ui.main.style.overflow,'');assert.equal(ui.bodyStyle.overflow,'clip');assert.equal(ui.main.scrollTop,310);assert.equal(ui.source.open,true);assert.equal(ui.activeElement,ui.help);assert.equal(ui.help.focusOptions.preventScroll,true);assert.equal(ui.elementScrolls.length,0);});
 }
 // The keyboard viewport changes only a CSS height variable, with no render, focus loss, or pinch-zoom shrink.
 {
  const listeners=new Set(),viewport={height:874,scale:1,addEventListener(type,fn){listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);},emit(){for(const fn of listeners)fn();}};const ui=shell(mockRemote(),{viewport,mobileScroll:true});await tick();const before=ui.writes;ui.password.value='being-typed';ui.password.focus();ui.main.scrollTop=80;check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'874px'));viewport.height=500;viewport.emit();check(()=>{assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'500px');assert.equal(ui.writes,before);assert.equal(ui.password.value,'being-typed');assert.equal(ui.activeElement,ui.password);assert.equal(ui.main.scrollTop,80);});viewport.scale=2;viewport.height=250;viewport.emit();check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'500px'));viewport.scale=1;viewport.height=600;viewport.emit();ui.windowEvent('pagehide');check(()=>assert.equal(listeners.size,0));viewport.height=450;viewport.emit();check(()=>assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'600px'));ui.windowEvent('pageshow');ui.windowEvent('pageshow');check(()=>{assert.equal(listeners.size,1);assert.equal(ui.root.style.getPropertyValue('--oa-viewport-height'),'450px');assert.equal(ui.writes,before);});
 }
 // The unconfigured local demo remains usable without the remote connection.
 {
  const ui=shell(mockRemote(),{mode:false});await tick();check(()=>assert.ok(ui.html.includes('Lancer le D6')));check(()=>assert.equal(ui.navigation.hidden,false));check(()=>assert.ok(ui.values.has('onde-couple-prototype-v1')));
 }
 console.log(`Dés·ir remote UI: ${checks} targeted checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
