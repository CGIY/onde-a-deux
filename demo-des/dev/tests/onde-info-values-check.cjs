// Run the real Carnet visibility handler with a numerical card and a simulated observer.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/onde-app-ui.js'),'utf8');
const start=source.indexOf(' function mountInfo(){'),end=source.indexOf(' function showInfoIdea(){',start);
assert(start>=0&&end>start);
let callback,frames=0,unobserved=0;
const values=[{textContent:'68',dataset:{infoCount:'68'}},{textContent:'24,6',dataset:{infoCount:'24.6'}}];
const classes=new Set();
const card={dataset:{},classList:{add(name){classes.add(name);},toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}},hasAttribute(name){return name==='data-info-visited'&&Object.hasOwn(this.dataset,'infoVisited');},querySelectorAll(selector){return selector==='[data-info-count]'?values:[];}};
class Observer{constructor(fn){callback=fn;}observe(){}unobserve(){unobserved++;}disconnect(){}}
const progress={style:{}},panel={classList:{toggle(){}},querySelector(selector){return selector==='.oa-info-progress i'?progress:null;},querySelectorAll(selector){return selector==='.oa-info-card:not([data-info-visited])'?[card]:[];},addEventListener(){},removeEventListener(){}};
const main={scrollHeight:100,clientHeight:100,scrollTop:0,querySelector:()=>panel,addEventListener(){},removeEventListener(){}};
const document={hidden:false,addEventListener(){},removeEventListener(){}};
const sandbox={main,document,window:{IntersectionObserver:Observer,addEventListener(){},removeEventListener(){}},IntersectionObserver:Observer,systemReduce:false,ambientMotion:true,infoActivity:()=>'',infoShared:()=>'',infoTickets:()=>'',infoSettings:()=>'',requestAnimationFrame(){frames++;return frames;},cancelAnimationFrame(){},clearTimeout(){},setTimeout(){return 0;},chargeNow:()=>0,Intl,Map,Set,Array};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end)+';globalThis.mounted=mountInfo();',sandbox);
callback([{target:card,isIntersecting:true,intersectionRatio:.5}]);
assert.deepEqual(values.map(node=>node.textContent),['68','24,6'],'values remain exact while the card appears');
assert.equal(frames,0,'reading a card does not schedule numeric count-up frames');
assert.equal(unobserved,1);assert(classes.has('is-reading'),'the CSS reveal still runs');
assert(Object.hasOwn(card.dataset,'infoVisited'));sandbox.mounted.dispose();
console.log('Carnet values remain exact while reading animations play.');
