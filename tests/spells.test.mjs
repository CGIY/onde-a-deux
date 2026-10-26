import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const now=new Date('2026-10-25T16:00:00Z'),future='2026-10-25T22:00:00Z';
const base={template_id:'known',status:'available',title:'Défi inchangé',challenge:'Le challenge reste exactement identique.',finish:'standard',category:'EN COUPLE',palette:'couple',wear_seed:1,expires_at:future};
const state={role:'AG',view:'today',viewerSession:0,newTemplates:new Set(),data:{partner_role:'CL',known_cards:[{template_id:'known'}],my_cards:[],partner_cards:[{...base,id:'available'},{...base,id:'trading',status:'trading'},{...base,id:'unknown',template_id:'secret'},{...base,id:'expired',expires_at:'2026-10-25T15:00:00Z'}],active_cards:[{...base,id:'both',owner_role:'CL',active_until:future},{...base,id:'effect',owner_role:'CL',effect_modifier:'reducto',active_until:future},{...base,id:'time',owner_role:'CL',time_modifier:'adagio',active_until:future},{...base,id:'mine',owner_role:'AG',active_until:future},{...base,id:'ended',owner_role:'CL',active_until:'2026-10-25T15:00:00Z'}]}};
const nodes=new Map();const $=key=>{if(!nodes.has(key))nodes.set(key,{remove(){},before(){},innerHTML:'',selectedOptions:[],after(){},addEventListener(){},value:''});return nodes.get(key);};
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const renderCode=source.slice(source.indexOf('  function finishLabel('),source.indexOf('  function option('));
const targetsCode=source.slice(source.indexOf('  function spellTargets('),source.indexOf('  async function moveViewer('));
const cardDialog={open:false,showModal(){this.open=true;}};
const api=runInNewContext(source.slice(source.indexOf('  function isAvailable('),source.indexOf('  function expireLocalData('))+renderCode+targetsCode+'\n({spellTargets,cardMarkup,openCard})',{state,$,escapeHtml,serverNow:()=>now,duration:()=> '6h 00',cardDialog,attachFoilMotion:()=>{},setupSwipe:()=>{},document:{createElement:()=>({dataset:{},classList:{},remove(){}})},finishSymbol:()=>"●",name:r=>r==='CL'?'Papapouf':'Mamamouth'});
const ids=code=>[...api.spellTargets({spell_code:code})].map(c=>c.id);
assert.deepEqual(ids('reducto'),['both','time']);assert.deepEqual(ids('augmento'),['both','time']);assert.deepEqual(ids('presto'),['both','effect']);assert.deepEqual(ids('adagio'),['both','effect']);assert.deepEqual(ids('destructo'),['available']);
const reduced=api.cardMarkup({...base,effect_modifier:'reducto',time_modifier:'presto'});
assert.match(reduced,/REDUCTO · Effet ÷2/);assert.match(reduced,/PRESTO · Temps ÷2/);assert.match(reduced,/Le challenge reste exactement identique\./);
const doubled=api.cardMarkup({...base,effect_modifier:'augmento',time_modifier:'adagio'});assert.match(doubled,/AUGMENTO · Effet ×2/);assert.match(doubled,/ADAGIO · Temps ×2/);
for(const code of ['reducto','destructo']){
  const spell={...base,id:'spell-'+code,card_type:'spell',spell_code:code,title:code.toUpperCase(),palette:code};state.data.my_cards=[spell];api.openCard(spell);
  assert.match($('#cardDialogContent').innerHTML,new RegExp('data-use-spell="spell-'+code+'"'));
  assert.doesNotMatch($('#cardDialogContent').innerHTML,/data-activate-card=/,'A spell must never look activatable as a normal challenge');
  if(code==='destructo'){assert.match($('#cardDialogContent').innerHTML,/Carte connue dans la main adverse/);assert.doesNotMatch($('#cardDialogContent').innerHTML,/<option value="unknown"/);}
}
console.log('OK: eligible targets per spell, known/available/expiry/owner filters, independent modifier limits, readable bands, unchanged challenge and explicit consumable action.');

const legend={...base,finish:'legendary',legendary_options:[{id:'a',title:'Premier choix',challenge:'A'},{id:'b',title:'Second choix',challenge:'B'}]};
assert.match(api.cardMarkup(legend),/data-legend-cycle=/);
const activated=api.cardMarkup({...legend,selected_template_id:'b',title:'Second choix',challenge:'B'});
assert.doesNotMatch(activated,/data-legend-cycle=/);assert.match(activated,/Second choix/);assert.doesNotMatch(activated,/Premier choix/);
console.log('OK: legendary choices animate before selection and stay fixed once activated.');
