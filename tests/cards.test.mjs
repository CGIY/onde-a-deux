import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the real rendering functions without storing fake cards in the app.
const source = readFileSync(new URL('../cartes/app.js', import.meta.url), 'utf8');
const nodes = new Map();
const $ = selector => {
  if (!nodes.has(selector)) nodes.set(selector, { value: 'all', textContent: '', innerHTML: '', classList:{toggle:()=>{}},setAttribute:()=>{} });
  return nodes.get(selector);
};
$('#cardSearch').value = '';
const data = {
  catalogue_total: 90,
  known_cards: [
    { template_id:'known-base', title:'Film', category:'EN COUPLE', palette:'couple', finish_tier:'standard', edition:'edition_01', owned_count:0 },
    { template_id:'known-foil', title:'Cadeau · 66 €', category:'POUR L’AUTRE', palette:'other', finish_tier:'foil', edition:'halloween_2026', owned_count:1 },
    { template_id:'known-art', title:'Repas effrayant proposé par l’autre', category:'LES FOODIES', palette:'foodies', finish_tier:'full_art', edition:'halloween_2026', owned_count:0 }
  ],
  my_cards: [],
  editions: [{id:'edition_01',total:80,discovered:1},{id:'halloween_2026',total:10,discovered:2}]
};
data.catalogue_slots = data.editions.flatMap(edition => Array.from({length:edition.total},(_,i) => ({number:i+1,edition:edition.id,template_id:edition.id==='edition_01' ? (i===0?'known-base':null) : (i===0?'known-foil':i===1?'known-art':null)})));
const state = { data, role:'AG', collectionTab:'known', category:'all' };
let now = new Date('2026-10-28T22:59:59Z');
const helpers=source.slice(source.indexOf('  const markupCache ='),source.indexOf('  const escapeHtml ='));
const api = runInNewContext(helpers+source.slice(source.indexOf('  function finishLabel'), source.indexOf('  function option(')) + '\n({cardMarkup,renderCollection,collectionCards,halloweenActive,groupCards,finishSymbol,putMarkup,expiryHint})', {
  cardCountdown:()=>'', $, state, serverNow:()=>now, duration:()=>'', name:()=> 'Mamamouth', escapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'), document:{}
});
api.renderCollection();
assert.equal($('#knownTabCount').textContent,'3/90');
assert.equal(($('#collectionGrid').innerHTML.match(/role="img"/g)||[]).length,87);
assert.equal(($('#collectionGrid').innerHTML.match(/class="card-button"/g)||[]).length,3);
assert.match($('#collectionGrid').innerHTML,/finish-foil edition-halloween/);
assert.match($('#collectionGrid').innerHTML,/finish-full_art edition-halloween/);
$('#editionFilter').value='halloween_2026'; api.renderCollection();
assert.equal(($('#collectionGrid').innerHTML.match(/role="img"/g)||[]).length,8);
assert.doesNotMatch($('#collectionGrid').innerHTML,/known-base/);
$('#finishFilter').value='foil'; api.renderCollection();
assert.equal(($('#collectionGrid').innerHTML.match(/class="card-button"/g)||[]).length,1);
assert.doesNotMatch($('#collectionGrid').innerHTML,/empty-card-slot/);
$('#cardSearch').value='aucun résultat'; api.renderCollection();
assert.match($('#collectionGrid').innerHTML,/Aucune carte/);
state.collectionTab='available'; $('#cardSearch').value=''; $('#editionFilter').value='all'; $('#finishFilter').value='all'; api.renderCollection();
assert.doesNotMatch($('#collectionGrid').innerHTML,/empty-card-slot|class="card-button"/);
assert.match($('#collectionNote').textContent,/7 jours/);
assert.equal(api.halloweenActive(),false);
now=new Date('2026-10-28T23:00:00Z'); assert.equal(api.halloweenActive(),true);
now=new Date('2026-11-01T22:59:59Z'); assert.equal(api.halloweenActive(),true);
now=new Date('2026-11-01T23:00:00Z'); assert.equal(api.halloweenActive(),false);
assert.match(api.cardMarkup({...data.known_cards[1],title:'<img onerror="oops">'}),/&lt;img/);
assert.equal(api.finishSymbol('standard'),'●');assert.equal(api.finishSymbol('full_art'),'◇');assert.equal(api.finishSymbol('foil'),'✦');assert.equal(api.finishSymbol('full_art_foil'),'✺');
const copies=[{id:'later',template_id:'same',finish:'standard',expires_at:'2026-10-29'},{id:'first',template_id:'same',finish:'standard',expires_at:'2026-10-25'},{id:'different-finish',template_id:'same',finish:'foil',expires_at:'2026-10-26'}];
const grouped=api.groupCards(copies);assert.equal(grouped.length,2);assert.equal(grouped[0].id,'first');assert.equal(grouped[0].stack_count,2);assert.equal(copies[0].id,'later');assert.equal(copies[0].stack_count,undefined);
data.my_cards=copies.slice(0,2).map(c=>({...c,status:'available',title:'Film',category:'EN COUPLE',palette:'couple'}));
api.renderCollection();assert.equal($('#availableTabCount').textContent,2);assert.equal(($('#collectionGrid').innerHTML.match(/class="card-button stacked-card"/g)||[]).length,1);assert.match($('#collectionGrid').innerHTML,/×2/);assert.match($('#collectionGrid').innerHTML,/data-card-id="first"/);
assert.doesNotMatch($('#collectionGrid').innerHTML,/data-card-id="later"/);
const stable='<span data-until="2026-10-25">2j 3h</span>';api.putMarkup('#stable',stable);api.putMarkup('#stable',stable.replace('2j 3h','2j 2h'));assert.equal($('#stable').innerHTML,stable,'Countdown updates must not remount the cards');
data.my_cards=data.my_cards.map(c=>({...c,is_pinned:c.id==='later'}));api.renderCollection();assert.equal(api.collectionCards().length,1);assert.doesNotMatch($('#collectionGrid').innerHTML,/data-pin-card|is-pinned|pin-toggle/,'Legacy pin flags must have no UI or sorting effect');
now=new Date('2026-10-25T22:30:00Z');assert.equal(api.expiryHint('2026-10-25T22:45:00Z'),'Expire aujourd’hui');assert.equal(api.expiryHint('2026-10-25T23:15:00Z'),'');assert.equal(api.expiryHint('2026-10-25T22:29:59Z'),'Expirée');assert.equal(api.expiryHint('invalid'),'');
const historyCode=source.slice(source.indexOf('  function icon('),source.indexOf('  const isHalloween'))+source.slice(source.indexOf('  function cardEventMarkup('),source.indexOf('  function renderTradeSelection('));
const eventMarkup=runInNewContext(historyCode+'\ncardEventMarkup',{state,escapeHtml:v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),name:r=>r==='AG'?'Mamamouth':'Papapouf',finishLabel:()=> 'Commune'});
const event={title:'<script>fixture</script>',created_at:'2026-10-25T22:00:00Z',finish:'standard',event_type:'give_card',actor_role:'AG',recipient_role:'CL'};
assert.match(eventMarkup(event),/Donné à Papapouf/);assert.match(eventMarkup({...event,actor_role:'CL',recipient_role:'AG'}),/Reçu de Papapouf/);assert.match(eventMarkup({...event,event_type:'complete_card'}),/Défi réalisé/);assert.doesNotMatch(eventMarkup(event),/<script>/);
console.log('OK: album 90 slots, known-only contents, edition/finish/search filters, foil/full-art, empty hand, seven-day copy, Paris seasonal boundaries, escaped titles.');
