const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');

const at='2026-11-04T14:00:00.000Z'; // mercredi
const handOf=n=>G.cards.filter(c=>c.categoryId===G.categories[n-1].id).slice(0,6).map(c=>c.id);

// Semaines ISO de Paris.
assert.match(G.isoWeekKey(at),/^\d{4}-W\d{2}$/);
assert.equal(G.isoWeekKey(at),G.isoWeekKey('2026-11-08T22:30:00.000Z'),'dimanche 23 h 30 à Paris : même semaine ISO');
assert.notEqual(G.isoWeekKey(at),G.isoWeekKey('2026-11-09T00:30:00.000Z'),'lundi 1 h 30 à Paris : semaine suivante');
assert.equal(G.isoWeekKey('invalid'),null);

// Joker hebdomadaire : catégorie choisie, une fois par semaine ISO et par salle.
{
  let room=G.createRoom({at});
  const roundId=room.lanes.a.round.id;
  const bad=G.reduceRoom(room,{type:'JOKER_DRAW',category:9,catalogueVersion:2,hand:handOf(1),actor:'a',roundId,at});
  assert.equal(bad,room,'catégorie hors plage refusée');
  const joker=G.reduceRoom(room,{type:'JOKER_DRAW',category:3,catalogueVersion:2,hand:handOf(3),actor:'a',roundId,at});
  assert.notEqual(joker,room,'le joker s’applique');
  assert.ok(G.validateRoom(joker));
  assert.equal(joker.lanes.a.round.categoryId,'projets');
  assert.equal(joker.lanes.a.phase,'card');
  assert.equal(joker.joker.usedBy,'a');
  assert.equal(joker.joker.weekKey,G.isoWeekKey(at));

  let r=joker;
  r=G.reduceRoom(r,{type:'ROLL_CARD',value:1,actor:'a',roundId,at});
  r=G.reduceRoom(r,{type:'ROLL_VARIANT',value:1,actor:'a',roundId,at});
  r=G.reduceRoom(r,{type:'SEND',actor:'a',roundId,at});
  r=G.reduceRoom(r,{type:'PASS',actor:'b',roundId,at});
  r=G.reduceRoom(r,{type:'NEW_ROUND',actor:'a',roundId,at});
  assert.equal(r.lanes.a.phase,'category','retour en phase catégorie');
  const second=G.reduceRoom(r,{type:'JOKER_DRAW',category:1,catalogueVersion:2,hand:handOf(1),actor:'a',roundId:r.lanes.a.round.id,at});
  assert.equal(second,r,'joker déjà utilisé cette semaine');

  const nextWeekAt='2026-11-11T10:00:00.000Z'; // mercredi suivant
  const nextWeek=G.reduceRoom(r,{type:'JOKER_DRAW',category:1,catalogueVersion:2,hand:handOf(1),actor:'a',roundId:r.lanes.a.round.id,at:nextWeekAt});
  assert.notEqual(nextWeek,r,'joker renouvelé la semaine suivante');
  assert.deepEqual(nextWeek.joker,{weekKey:G.isoWeekKey(nextWeekAt),usedBy:'a'});
}

// Le joker sur Intimité suit la même règle du D20 que le D4.
{
  const mk=modeRoll=>{const room=G.createRoom({at});const id=room.lanes.a.round.id;return G.reduceRoom(room,{type:'JOKER_DRAW',category:4,catalogueVersion:2,hand:handOf(4),modeRoll,actor:'a',roundId:id,at});};
  assert.equal(mk(15).lanes.a.round.hardcoreOffer,true,'D20 15 -> offre Hardcore');
  assert.equal(mk(7).lanes.a.round.hardcoreOffer,false,'D20 7 -> Intimité classique');
}

// Les salles anciennes sans joker restent valides.
{
  const room=G.createRoom({at});
  const stripped=JSON.parse(JSON.stringify(room));delete stripped.joker;
  assert.ok(G.validateRoom(stripped),'salle sans joker toujours valide');
  const restored=G.normalizeRoom(stripped,{at});
  assert.ok(restored&&G.validateRoom(restored));
}

console.log('Dés·ir joker hebdomadaire : toutes les assertions passent.');
