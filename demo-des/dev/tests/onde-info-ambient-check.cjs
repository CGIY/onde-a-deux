// Exercise ambient pause/resume in the real Carnet controller without altering game motion.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/onde-app-ui.js'),'utf8');
const start=source.indexOf(' function mountInfo(){'),end=source.indexOf(' function showInfoIdea(){',start);
assert(start>=0&&end>start);
let callback,nextTimer=0;const active=new Set();
function classes(){const values=new Set();return {add(name){values.add(name);},remove(name){values.delete(name);},contains(name){return values.has(name);},toggle(name,on){if(on)values.add(name);else values.delete(name);}};}
const agreement={classList:classes(),dataset:{},hasAttribute(){return false;}};
class Observer{constructor(fn){callback=fn;}observe(){}unobserve(){}disconnect(){}}
const progress={style:{}},panel={classList:classes(),querySelector(selector){return ({'.oa-info-progress i':progress,'.oa-info-agreement':agreement})[selector]||null;},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){}};
const main={scrollHeight:100,clientHeight:100,scrollTop:0,querySelector:()=>panel,addEventListener(){},removeEventListener(){}};
const document={hidden:false,addEventListener(){},removeEventListener(){}};
const sandbox={main,document,window:{IntersectionObserver:Observer,addEventListener(){},removeEventListener(){}},IntersectionObserver:Observer,systemReduce:false,ambientMotion:true,infoActivity:()=>'',infoShared:()=>'',infoTickets:()=>'',infoSettings:()=>'',requestAnimationFrame(){return 1;},cancelAnimationFrame(){},clearTimeout(id){active.delete(id);},setTimeout(){const id=++nextTimer;active.add(id);return id;},chargeNow:()=>0,Map,Set,Array};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end)+';globalThis.mounted=mountInfo();',sandbox);
const appear=target=>callback([{target,isIntersecting:true,intersectionRatio:.5}]);
appear(agreement);
assert(agreement.classList.contains('is-in-view'));
sandbox.ambientMotion=false;sandbox.mounted.updateMotion();
assert(panel.classList.contains('is-motion-paused'));assert(!agreement.classList.contains('is-in-view'));
sandbox.ambientMotion=true;sandbox.mounted.updateMotion();appear(agreement);
assert(!panel.classList.contains('is-motion-paused'));assert(agreement.classList.contains('is-in-view'));
sandbox.systemReduce=true;sandbox.mounted.updateMotion();
assert(!agreement.classList.contains('is-in-view'),'system reduced motion takes precedence');
assert.equal(active.size,0,'the simplified Carnet does not run typing or rhythm refresh timers');
sandbox.mounted.dispose();console.log('Carnet ambient motion pauses and respects reduced motion without polling removed modules.');
