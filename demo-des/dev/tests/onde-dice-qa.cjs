const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const filename=require('node:path').join(__dirname,'../src/onde-app-dice.js');
const src=fs.readFileSync(filename,'utf8').replace('global.OndeDice=Object.freeze({create});','global.OndeDice=Object.freeze({create});global.__qa={CUBE_FACES,POLYS,targetRotation,matrix,transform,support,FRAGMENT,VERTEX};');
let now=0,nextRaf=0,queue=new Map(),uniforms={},labels=[],atlas=[];
const ctx2d=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),fillText(text){atlas.push(String(text));}}, {get(o,p){return p in o?o[p]:()=>{}},set(o,p,v){o[p]=v;return true;}});
const gl=new Proxy({VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_p,n)=>n,getAttribLocation:()=>0,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),uniformMatrix3fv(n,_transpose,a){uniforms[n]=Array.from(a);},uniform3fv(n,a){uniforms[n]=Array.from(a);},uniform3f(n,...a){uniforms[n]=a;},uniform2f(n,...a){uniforms[n]=a;},uniform1f(n,a){uniforms[n]=a;},uniform1i(n,a){uniforms[n]=a;}},{get(o,p){return p in o?o[p]:()=>{}}});
const makeCanvas=(useWebgl=true)=>({width:0,height:0,clientWidth:452,clientHeight:238,style:{},getContext:type=>type==='webgl'?(useWebgl?gl:null):ctx2d,setAttribute(n,v){labels.push([n,v]);},addEventListener(){},removeEventListener(){},toDataURL:()=>''});
const window={devicePixelRatio:3,addEventListener(){},removeEventListener(){}};
const sandbox={window,document:{createElement:()=>makeCanvas(false),addEventListener(){},removeEventListener(){}},performance:{now:()=>now},requestAnimationFrame(fn){queue.set(++nextRaf,fn);return nextRaf;},cancelAnimationFrame(id){queue.delete(id);},console};
vm.createContext(sandbox);vm.runInContext(src,sandbox);const q=window.__qa;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>a.map(x=>x/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],maxdiff=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const view=norm([4.3,5.25,6.4]);let poses=0,minVisible=1;
for(const kind of [4,6,20])for(let value=1;value<=kind;value++){
 const faces=kind===6?q.CUBE_FACES:q.POLYS[kind].faces,m=q.matrix(q.targetRotation(kind,value)),f=faces[value-1],n=q.transform(m,f.n);
 assert(maxdiff(cross(f.t,f.b),f.n)<1e-12,'right-handed label face');
 assert(Math.abs(dot(f.t,f.b))<1e-12,'orthogonal label axes');
 if(kind!==4){assert(maxdiff(n,[0,1,0])<1e-12,`top result ${kind}/${value}`);const b=q.transform(m,f.b);assert(dot(b,norm([-4.3,0,-6.4]))>.999,'upright numeral');}
 else {assert(dot(n,view)>.7,'D4 result visible');}
 minVisible=Math.min(minVisible,dot(n,view));poses++;
}
function advance(t){now=t;const callbacks=[...queue.values()];queue.clear();for(const callback of callbacks)callback(t);return {m:uniforms.uRotation.slice(),p:uniforms.uPosition.slice(),s:uniforms.uScale.slice()};}
let worstJoin=0,joins=0;
(async()=>{
 for(const kind of [4,6,20]){
  now=0;queue.clear();const canvas=makeCanvas(),die=window.OndeDice.create(canvas,{kind,value:1,duration:2250,maxPixelRatio:2});
  assert.equal(die.mode,'webgl');assert.equal(uniforms.uCount,kind);assert.equal(canvas.width,904);assert.equal(canvas.height,476);
  const done=die.roll(kind);
  for(const boundary of [160,1160,1160+440*.36,1600,2250]){
   const a=advance(boundary-.001),b=advance(boundary+.001);
   const delta=Math.max(maxdiff(a.m,b.m),maxdiff(a.p,b.p),maxdiff(a.s,b.s));worstJoin=Math.max(worstJoin,delta);assert(delta<.0001,`continuous phase ${kind}/${boundary}: ${delta}`);joins++;
  }
  assert.equal(await done,kind);assert.equal(die.busy,false);
  const rest=uniforms.uRotation.slice();die.setKind(kind,kind);assert(maxdiff(rest,uniforms.uRotation)===0,'no same-result pose reset');
  const next=die.roll(1);advance(now+100);die.setKind(kind,1);assert.equal(die.busy,false);assert.equal(await next,1);assert.equal(queue.size,0,'roll cancellation');
  die.setReducedMotion(true);assert.equal(await die.roll(kind),kind);assert.equal(die.busy,false);die.destroy();assert.equal(queue.size,0);
 }
 // The actual 2D fallback paints a numeric result for every D6 result.
 let fallbackValues=[];
 for(let value=1;value<=6;value++){atlas=[];const die=window.OndeDice.create(makeCanvas(false),{kind:6,value,reducedMotion:true});assert.equal(die.mode,'fallback');assert(atlas.includes(String(value)),`numeric fallback face ${value}`);fallbackValues.push(value);die.destroy();}
 fs.writeFileSync('/tmp/onde-dice-shaders.json',JSON.stringify({vertex:q.VERTEX,fragment:q.FRAGMENT}));
 console.log(JSON.stringify({status:'PASS',poses,minimumResultVisibility:minVisible,continuousPhaseJoins:joins,maximumJoinDelta:worstJoin,restPosePreserved:true,rollCancellation:true,reducedMotion:true,dpr2:[904,476],fallbackNumericResults:fallbackValues,shaderCompile:'Not validated by mock; shader sources exported for optional real compiler.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
