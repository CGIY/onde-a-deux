// Exercise the shared evidence lookup, including withheld cards and repeated rounds.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '..');
const G = require('../src/onde-app-core.js');
const source = fs.readFileSync(path.join(base, 'src/onde-app-evidence.js'), 'utf8');
const document = JSON.parse(fs.readFileSync(path.join(base, 'data/card-evidence.json')));
function load(data) {
  const sandbox = { OndeEvidenceData: data };
  vm.runInNewContext(source, sandbox);
  return sandbox.OndeEvidence;
}
const legacy = !Object.hasOwn(document, 'unavailableEvidence');
const evidence = load(legacy ? document.activeEvidence : document);
const active = new Map(document.activeEvidence.map(fact => [fact.cardId, fact]));
const unavailable = new Set((document.unavailableEvidence || []).map(fact => fact.cardId));
assert.equal(active.size + unavailable.size, G.cards.length);
assert.equal(new Set([...active.keys(), ...unavailable]).size, G.cards.length);
for (const card of G.cards) {
  const fact = evidence.forCard(card);
  if (unavailable.has(card.id)) {
    assert.equal(fact, null, `Withheld evidence must stay absent: ${card.id}`);
    continue;
  }
  assert.ok(active.has(card.id), `Unregistered card: ${card.id}`);
  assert.equal(fact.cardId, card.id);
  assert.ok(fact.metric && fact.headline && fact.scope && fact.limitations);
  assert.match(fact.url, /^https:\/\//);
  assert.ok(Number.isInteger(fact.year));
  assert.ok(Object.isFrozen(fact));
  assert.notEqual(fact, evidence.forCard(card), 'Each lookup returns an independent flat object');
  if (active.get(card.id).variants) {
    assert.equal(fact.statKey, active.get(card.id).variants[0].statKey, 'No context selects the primary');
    assert.equal(fact.variants, undefined);
  }
}

const card = { id: 'new-detente-test', categoryId: 'detente' };
const variants = [24, 51, 78].map((value, index) => ({
  metric: `${value} %`, sourceValue: value, headline: 'Résultat de contrôle',
  detail: `Résultat distinct ${index}.`, scope: 'Adultes, contexte de contrôle.',
  limitations: 'Donnée de test.', year: 2026, sourceTitle: 'Source de contrôle',
  url: 'https://example.test/study', statKey: `fixture-${index}`,
  angle: ['pratique', 'appréciation', 'envie'][index], confidence: 'modérée'
}));
const fixture = {
  activeEvidence: [{ cardId: card.id, ...variants[0], variants }],
  unavailableEvidence: [{ cardId: 'new-detente-withheld', status: 'INTROUVABLE' }]
};
const playerOne = load(fixture);
const playerTwo = load(JSON.parse(JSON.stringify(fixture)));
assert.equal(playerOne.forCard(card).statKey, 'fixture-0');
for (const firstRound of [1, 8, 9, 10, 98, 99, 999]) {
  const keys = [0, 1, 2].map(offset => {
    const context = `onde-${firstRound + offset}`;
    const one = playerOne.forCard(card, context);
    const two = playerTwo.forCard(card, context);
    assert.equal(one.statKey, two.statKey, 'Both players must see the same round result');
    assert.equal(one.statKey, playerOne.forCard(card, context).statKey, 'Renders must not reroll evidence');
    assert.ok(Object.isFrozen(one));
    assert.equal(one.variants, undefined);
    return one.statKey;
  });
  assert.equal(new Set(keys).size, 3, 'Three consecutive rounds should expose three different variants');
}
assert.equal(playerOne.forCard(card, 'opaque-shared-room-context').statKey,
             playerTwo.forCard(card, 'opaque-shared-room-context').statKey);
variants[0].detail = 'Changed after module loading';
fixture.activeEvidence[0].detail = 'Changed primary after module loading';
assert.notEqual(playerOne.forCard(card).detail, variants[0].detail, 'Injection is snapshotted');
const frozenResult = playerOne.forCard(card);
assert.equal(Reflect.set(frozenResult, 'detail', 'Modified result'), false);
assert.notEqual(playerOne.forCard(card).detail, 'Modified result');
assert.equal(playerOne.forCard({ id: 'new-detente-withheld', categoryId: 'detente' }), null);
assert.equal(playerOne.forCard({ id: 'new-detente-unknown', categoryId: 'detente' }), null,
             'A current card cannot fall back to a category statistic or suggestion');
assert.equal(playerOne.forCard({ id: 'int-2' }), null, 'Curated data cannot revive an unreviewed legacy statistic');
assert.equal(playerOne.forCard({ id: 'old-unmapped', categoryId: 'complicite' }), null);
// Old flat arrays still load while curation is being migrated.
assert.equal(load([{ cardId: card.id, ...variants[1] }]).forCard(card, 'onde-9').statKey, 'fixture-1');
assert.equal(load([]).forCard({ id: 'int-2' }).metric, '86,4 %', 'Legacy array loading stays compatible');
console.log(`ONDE evidence: ${active.size} sourced cards, ${unavailable.size} withheld; stable shared variants and immutable lookups passed.`);
