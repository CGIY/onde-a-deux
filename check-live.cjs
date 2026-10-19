const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map();
const makeElement=()=>({textContent:'',dataset:{},handlers:{},classList:{toggle(){}},addEventListener(name,fn){this.handlers[name]=fn;},parentElement:{dataset:{}}});
let inflight=0,maxInflight=0,stored=null,fail=false,expire=false,poll;
const reserved=new Set();
let collisionCount=0;
const rpc=async(_name,args)=>{
  inflight++;maxInflight=Math.max(maxInflight,inflight);
  await new Promise(r=>setTimeout(r,2));
  inflight--;
  if(fail){fail=false;return {error:{message:'network'}};}
  if(expire)return {error:{message:'room_expired'}};
  if(args.p_create && reserved.has(args.p_room_code)){collisionCount++;return {error:{message:'room_taken'}};}
  if(args.p_create)reserved.add(args.p_room_code);
  if(args.p_state)stored=args.p_state;
  return {data:[{role:'J1',state:stored||{},last_seen:new Date().toISOString()},{role:'J2',state:{},last_seen:new Date().toISOString()}]};
};
const ctx={window:{supabase:{createClient:()=>({rpc})}},document:{getElementById(id){if(!elements.has(id))elements.set(id,makeElement());return elements.get(id);},querySelector(selector){return selector.includes('.player-choice-button.selected')?{dataset:{player:'J1'}}:makeElement();}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,setInterval(fn){poll=fn;return 1;},clearInterval(){},URL,navigator:{},location:{href:'http://localhost/'}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/live.js','utf8'),ctx);
(async()=>{
  const live=ctx.window.ondeLive;
  assert(await live.connect('TEST42','J1',true));
  await Promise.all(Array.from({length:16},(_,n)=>live.push({n})));
  assert.equal(maxInflight,1);assert.equal(stored.n,15);
  fail=true;assert.equal(await live.push({n:99}),false);assert.equal(live.ready,false);
  poll();await new Promise(r=>setTimeout(r,25));
  assert.equal(stored.n,99);assert.equal(live.ready,true);
  assert.equal(elements.get('syncLabel').textContent,'Synchronisé');
  for(const word of ['FION','BITE','TEUB','CULS','FUCK','SHIT','PIPE','RAIE'])reserved.add(word);
  await elements.get('createRoomButton').handlers.click();
  assert.equal(collisionCount,8);
  assert.match(live.roomCode,/^[A-Z0-9]{4}$/);
  assert.equal(elements.get('createRoomButton').disabled,false);
  assert.equal(elements.get('joinRoomButton').disabled,false);
  expire=true;
  assert.equal(await live.push({n:100}),false);
  assert.equal(live.ready,false);
  assert.equal(elements.get('syncLabel').textContent,'Session terminée');
  assert.equal(await live.push({n:101}),false);
  console.log('Live sync passed: serialized writes, newest state retained and failed save retried.');
  console.log('Four-character codes passed; all eight reserved words retried safely; legacy code accepted.');
  console.log('Expired sessions stop writes and display the end-of-session status.');
})().catch(e=>{console.error(e);process.exitCode=1;});
