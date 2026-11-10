const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/onde-app-ui.js'),'utf8');
const start=source.indexOf(' function mountInfo(){'),end=source.indexOf(' function showInfoIdea(){',start);
assert(start>=0&&end>start,'the real info widget mount is available');
let settingVersion=0,doc;
function control(dataset={},tag='BUTTON'){
 return {dataset,tag,disabled:false,attributes:{},matches(selector){return selector==='h2'&&tag==='H2';},setAttribute(name,value){this.attributes[name]=value;},focus(){doc.activeElement=this;}};
}
function widget(kind){
 let markup=kind==='settings'?'settings-0':kind,items=[],heading=control({},'H2'),notificationHeading=control({},'H2');
 const node={firstElementChild:{matches:()=>false},contains(target){return items.includes(target);},querySelectorAll(selector){return selector==='[data-action], [data-pref]'?items:[];},querySelector(selector){return selector==='.oa-notification-setting h2'?notificationHeading:selector==='h2'?heading:null;}};
 function reset(){items=[control({pref:'sound'}),control({action:'logout-confirm'}),control({action:'revoke-others-confirm'})];if(!settingVersion)items.push(control({action:'enable-notifications'}));}
 if(kind==='settings')reset();
 Object.defineProperty(node,'innerHTML',{get(){return markup;},set(value){markup=value;reset();}});
 node.items=()=>items;node.heading=()=>heading;node.notificationHeading=()=>notificationHeading;
 return node;
}
const activity=widget('activity'),shared=widget('shared'),tickets=widget('tickets'),settings=widget('settings');
const progress={style:{}},panel={classList:{toggle(){}},querySelector(selector){return ({'.oa-info-progress i':progress,'[data-info-activity]':activity,'[data-info-shared]':shared,'[data-info-tickets]':tickets,'[data-info-settings]':settings,'#oa-info-activity-title':activity.heading()}[selector]||null);},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){}};
const main={scrollHeight:400,clientHeight:400,scrollTop:0,querySelector:()=>panel,addEventListener(){},removeEventListener(){}};
doc={activeElement:null,hidden:false,addEventListener(){},removeEventListener(){}};
const sandbox={main,document:doc,window:{addEventListener(){},removeEventListener(){}},systemReduce:false,ambientMotion:true,infoActivity:()=> 'activity',infoShared:()=> 'shared',infoTickets:()=> 'tickets',infoSettings:()=>`settings-${settingVersion}`,requestAnimationFrame:()=>0,cancelAnimationFrame(){},clearTimeout(){},setTimeout(){return 0;},chargeNow:()=>0,Intl,Map,Set,Array};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end)+';globalThis.mounted=mountInfo();',sandbox);
const {mounted}=sandbox;
function changeFocused(dataset,expected){
 const old=settings.items().find(item=>Object.entries(dataset).every(([key,value])=>item.dataset[key]===value));assert(old,'existing focused control');old.focus();settingVersion++;mounted.refresh();assert.equal(doc.activeElement,expected(settings),'focus follows the matching updated control');
}
changeFocused({action:'logout-confirm'},w=>w.items().find(item=>item.dataset.action==='logout-confirm'));
changeFocused({action:'revoke-others-confirm'},w=>w.items().find(item=>item.dataset.action==='revoke-others-confirm'));
changeFocused({pref:'sound'},w=>w.items().find(item=>item.dataset.pref==='sound'));
// A removed notification action falls back to the heading of the same section.
settingVersion=0;mounted.refresh();const enable=settings.items().find(item=>item.dataset.action==='enable-notifications');enable.focus();settingVersion=1;mounted.refresh();assert.equal(doc.activeElement,settings.notificationHeading());assert.equal(doc.activeElement.attributes.tabindex,'-1');
const outside=control({action:'outside'});outside.focus();settingVersion++;mounted.refresh();assert.equal(doc.activeElement,outside,'a background update never steals outside focus');
mounted.dispose();
console.log('Info settings: focus is retained on surviving controls, returns to the notification section when needed, and is not stolen.');
