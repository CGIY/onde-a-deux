// Guard evidence coverage and identity across the published catalogue and bundle.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '..');
const G = require('../src/onde-app-core.js');
const facts = JSON.parse(fs.readFileSync(path.join(base, 'data/card-evidence.json'))).activeEvidence;
const sandbox = {OndeEvidenceData:facts};
vm.runInNewContext(fs.readFileSync(path.join(base,'src/onde-app-evidence.js'),'utf8'),sandbox);
assert.equal(facts.length,G.cards.length);
assert.equal(new Set(facts.map(f=>f.statKey)).size,facts.length);
assert.equal(new Set(facts.map(f=>f.detail)).size,facts.length);
for(const card of G.cards){
 const fact=sandbox.OndeEvidence.forCard(card);
 assert.equal(fact.cardId,card.id);
 assert.ok(fact.metric && fact.headline && fact.scope && fact.limitations);
 assert.match(fact.url,/^https:\/\//);
 assert.ok(Number.isInteger(fact.year));
 fact.detail='mutated';
 assert.notEqual(sandbox.OndeEvidence.forCard(card).detail,'mutated');
}
console.log(`ONDE evidence: ${facts.length} cards, ${facts.length} distinct results, source/context present, immutable lookup.`);
