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
function badgeSection(html){const found=html.match(/<section class="oa-badge-grid"[\s\S]*?<\/section>/);assert.ok(found,'badge section is rendered');return found[0];}
function badgeProgress(html){return Array.from(badgeSection(html).matchAll(/<article class="oa-badge ([^"]+)"[\s\S]*?<\/article>/g),match=>{const article=match[0],progress=article.match(/role="progressbar"[^>]+/)[0];return {status:match[1],max:Number(progress.match(/aria-valuemax="(\d+)"/)[1]),value:Number(progress.match(/aria-valuenow="(\d+)"/)[1]),name:progress.match(/aria-label="([^"]+)"/)[1],text:progress.match(/aria-valuetext="([^"]+)"/)[1]};});}
function snap(state,revision=1,remaining=1){return {roomId,state:copy(state),revision,actor:state.activePlayer,paired:true,quota:{remaining,window:'2026-11-02T06:00',label:'6 h – 12 h',nextAt:'2026-11-02T11:00:00.000Z'},serverTime:new Date().toISOString()};}
function mockRemote(restored=null){
 let listener=null,current=restored,identity=restored?{roomId,actor:restored.actor}:null,authenticated=!!restored;
 const calls=[],r={enabled:true,status:{phase:restored?'connected':'disconnected',message:'',errorCode:null},notificationStatus:{supported:true,permission:'default',subscribed:false,message:''},calls,get connection(){return identity;},get authenticated(){return authenticated;},get snapshot(){return current&&copy(current);},subscribeToChanges(fn){listener=fn;return()=>listener=null;},start(){calls.push({method:'start'});},restore:async()=>current&&copy(current),refresh:async()=>current&&copy(current),async login(username,password){calls.push({method:'login',username,password});r.status={phase:'connecting',message:'',errorCode:null};r.emit();try{const next=await (r.loginImpl?r.loginImpl(username,password):snap(initial()));identity={roomId,actor:next.actor};authenticated=true;r.status={phase:'connected',message:'',errorCode:null};r.emit(next);return copy(next);}catch(error){r.status={phase:'error',message:error.message,errorCode:error.code};r.emit();throw error;}},async action(action){calls.push({method:'action',action:copy(action)});const next=await r.actionImpl(action);r.emit({...next,roll:undefined});return copy(next);},async enableNotifications(){calls.push({method:'notifications'});r.notificationStatus={...r.notificationStatus,permission:'granted',subscribed:true};r.emit();return r.notificationStatus;},emit(next){if(next)current=copy(next);if(listener)listener({snapshot:current&&copy(current),status:{...r.status},notificationStatus:{...r.notificationStatus}});},revoke(){authenticated=false;r.status={phase:'error',message:'Reconnecte cet appareil.',errorCode:'unauthorized'};r.emit();}};
 return r;
}
function shell(remote,{mode=true,delayedDie=false,welcomeSeen=true,storageValues=null,storageBlocked=false}={}){
 const values=storageValues||new Map();if(welcomeSeen)values.set('desir-welcome-v1','1');
 const handlers={},windowHandlers={},timers=[],intervals=[];let mainHTML='',writes=0,rngCalls=0,dieRunning=false,interrupted=0,resolveDie=null;
 let document;
 function node(dataset={}){const classes=new Set();return {dataset,hidden:false,disabled:false,inert:false,isConnected:true,innerHTML:'',textContent:'',value:'',checked:false,children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,v){if(v)classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},style:{setProperty(){}},setAttribute(k,v){this[k]=String(v);},removeAttribute(k){delete this[k];},focus(){document.activeElement=this;},matches(){return false;},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},append(x){this.children.push(x);},prepend(x){x.parentElement=this;},removeChild(x){x.parentElement=null;},scrollIntoView(){}};}
 const root=node(),main=node(),sheet=node(),persona=node(),navigation=node(),toast=node(),announcement=node(),help=node(),count=node(),incoming=node(),title=node(),username=node(),password=node(),loginMessage=node(),rollButton=node({action:'roll'}),shellNode=node();
 sheet.hidden=true;persona.innerHTML='DEMO-PROFILE-CONTROLS';
 const navButtons=['play','tasks','us'].map(tab=>node({action:'tab',tab}));
 const profileButtons=['a','b'].map(player=>node({action:'profile',player}));
 const controls=[...navButtons,...profileButtons,help,rollButton];
 Object.defineProperty(main,'innerHTML',{get:()=>mainHTML,set:value=>{mainHTML=value;writes++;if(value.includes('id="oa-username"')){username.value=(value.match(/id="oa-username"[^>]*value="([^"]*)"/)||[])[1]||'';password.value='';}}});
 main.querySelector=selector=>{
  if(selector==='h1')return mainHTML.includes('<h1')?title:null;
  if(selector==='[data-login-error]')return mainHTML.includes('data-login-error')?loginMessage:null;
  if(selector==='[data-stage]'){const match=mainHTML.match(/data-stage data-kind="(\d+)" data-value="([^"]*)"/);if(!match)return null;const holder=node({kind:match[1],value:match[2]});return holder;}
  if(selector==='[data-action="roll"]')return mainHTML.includes('data-action="roll"')?rollButton:null;
  return null;
 };
 main.contains=el=>[title,username,password].includes(el);
 root.contains=()=>true;root.getAnimations=()=>[];
 root.addEventListener=(type,handler)=>{handlers[type]=handler;};
 root.querySelector=selector=>({'#oa-main':main,'#oa-sheet':sheet,'.oa-persona':persona,'.oa-nav':navigation,'#oa-toast':toast,'#oa-announcement':announcement,'[data-action="rules"]':help,'.oa-task-count':count,'.oa-incoming-dot':incoming,'.oa-shell':shellNode,'#oa-username':username,'#oa-password':password}[selector]||null);
 root.querySelectorAll=selector=>selector==='.oa-nav button'?navButtons:selector==='.oa-switch [data-action="profile"]'?profileButtons:controls;
 shellNode.children=[persona,main,navigation,toast,sheet,announcement];
 document={activeElement:null,hidden:false,body:{style:{}},getElementById:id=>id==='onde-app-v1'?root:null,createElement:()=>node(),addEventListener(){}};
 const die={setKind(){if(dieRunning)interrupted++;},setReducedMotion(){},async roll(value){die.calls.push(value);dieRunning=true;if(delayedDie)await new Promise(resolve=>resolveDie=resolve);dieRunning=false;},calls:[]};
 const ctx={console,Date,Map,Set,Array,JSON,String,Number,Math,Promise,document,localStorage:{getItem(k){if(storageBlocked)throw Error('Storage unavailable');return values.get(k)||null;},setItem(k,v){if(storageBlocked)throw Error('Storage unavailable');values.set(k,String(v));},removeItem(k){if(storageBlocked)throw Error('Storage unavailable');values.delete(k);}},sessionStorage:{getItem(){return null;},setItem(){}},OndeGame:{...G,randomInt(n){rngCalls++;return G.randomInt(n);}},OndeDice:{create:()=>die},OndeEvidence:{forCard:()=>null},OndeRemote:{create:()=>remote},DesirConfig:mode?{endpoint:'https://example.supabase.co/functions/v1/desir-game'}:{},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},clearInterval(){},addEventListener(type,fn){windowHandlers[type]=fn;}};
 ctx.window=ctx;
 vm.runInNewContext(code,ctx,{filename:'onde-app-ui.js'});
 function event(target){return {target,preventDefault(){}};}
 return {root,main,sheet,persona,navigation,help,username,password,loginMessage,die,timers,values,announcement,toast,get html(){return mainHTML;},get activeElement(){return document.activeElement;},get writes(){return writes;},get rngCalls(){return rngCalls;},get interrupted(){return interrupted;},finishDie(){resolveDie();},async click(action,extra={}){const el=node({action,...extra});el.closest=()=>el;await handlers.click(event(el));return el;},async submit(user,secret){username.value=user;password.value=secret;const form=node();form.matches=selector=>selector==='[data-login-form]';return handlers.submit(event(form));},async taskCheck(id,checked){const label=node(),article=node(),input=node({taskCheck:id,player:'a'});input.checked=checked;input.closest=selector=>selector==='label'?label:article;const promise=handlers.change(event(input));return {input,label,promise};}};
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
 // Badges follow the persistent shared score at each boundary; progress never exceeds its own target.
 {
  const levels=[5,10,15,30],names=['Couple complice','Couple stable','Super couple','Couple légendaire'];
  const cases=[[0,0,5,[0,0,0,0]],[4,0,5,[4,4,4,4]],[5,1,10,[5,5,5,5]],[9,1,10,[5,9,9,9]],[10,2,15,[5,10,10,10]],[14,2,15,[5,10,14,14]],[15,3,30,[5,10,15,15]],[29,3,30,[5,10,15,29]],[30,4,null,[5,10,15,30]],[31,4,null,[5,10,15,30]],[95,4,null,[5,10,15,30]]];
  for(const [total,acquired,next,values] of cases){
   const remote=mockRemote(snap(scored(total))),ui=shell(remote);await tick();const storageBefore=Array.from(ui.values.keys());await ui.click('tab',{tab:'us'});const badges=badgeProgress(ui.html);
   check(()=>{assert.deepEqual(badges.map(b=>b.max),levels);assert.deepEqual(badges.map(b=>b.value),values);assert.deepEqual(badges.map(b=>b.name),names);assert.equal(badges.filter(b=>b.status==='is-earned').length,acquired);assert.deepEqual(badges.filter(b=>b.status==='is-next').map(b=>b.max),next?[next]:[]);badges.forEach(b=>assert.ok(b.text.includes((b.status==='is-earned'?'Acquis':b.status==='is-next'?'Prochain':'À débloquer')+' · '+b.value+' sur '+b.max+' points')));});
   check(()=>{const section=badgeSection(ui.html);assert.ok(!/<(?:button|input)\b|data-action=/.test(section));assert.equal((section.match(/aria-hidden="true" focusable="false"/g)||[]).length,4);assert.ok(ui.html.indexOf('class="oa-shared-score"')<ui.html.indexOf('class="oa-badge-grid"'));assert.ok(ui.html.indexOf('class="oa-badge-grid"')<ui.html.indexOf('class="oa-score-grid"'));assert.equal(remote.calls.filter(c=>c.method==='action').length,0);assert.deepEqual(Array.from(ui.values.keys()),storageBefore);});
  }
 }
 // Both accounts see the same badges, and an old response cannot undo an acquired grade.
 {
  const remote=mockRemote(snap(scored(4))),ui=shell(remote);await tick();await ui.click('tab',{tab:'us'});remote.emit(snap(scored(5),2));const earned=badgeSection(ui.html);check(()=>assert.equal(badgeProgress(ui.html)[0].status,'is-earned'));remote.emit(snap(scored(4),1));check(()=>assert.equal(badgeSection(ui.html),earned));
  const other=shell(mockRemote(snap(scored(5,'b'),2)));await tick();await other.click('tab',{tab:'us'});check(()=>assert.equal(badgeSection(other.html),earned));
  const reloaded=shell(mockRemote(snap(scored(5),2)),{storageValues:ui.values});await tick();await reloaded.click('tab',{tab:'us'});check(()=>assert.equal(badgeSection(reloaded.html),earned));check(()=>assert.equal(remote.calls.filter(c=>c.method==='action').length,0));
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
 // The unconfigured local demo remains usable without the remote connection.
 {
  const ui=shell(mockRemote(),{mode:false});await tick();check(()=>assert.ok(ui.html.includes('Lancer le D6')));check(()=>assert.equal(ui.navigation.hidden,false));check(()=>assert.ok(ui.values.has('onde-couple-prototype-v1')));
 }
 console.log(`Dés·ir remote UI: ${checks} targeted checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
