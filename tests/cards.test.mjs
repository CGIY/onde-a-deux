import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the real rendering functions without storing fake cards in the app.
const source = readFileSync(new URL('../cartes/app.js', import.meta.url), 'utf8');
const nodes = new Map();
const $ = selector => {
  if (!nodes.has(selector)) nodes.set(selector, { value: 'all', textContent: '', innerHTML: '' });
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
const api = runInNewContext(source.slice(source.indexOf('  function finishLabel'), source.indexOf('  function option(')) + '\n({cardMarkup,renderCollection,collectionCards,halloweenActive})', {
  $, state, serverNow:()=>now, duration:()=>'', name:()=> 'Mamamouth', escapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'), document:{}
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
console.log('OK: album 90 slots, known-only contents, edition/finish/search filters, foil/full-art, empty hand, seven-day copy, Paris seasonal boundaries, escaped titles.');
