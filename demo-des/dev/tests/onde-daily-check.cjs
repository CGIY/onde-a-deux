const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');

const clone=value=>JSON.parse(JSON.stringify(value));
const at='2026-11-04T14:00:00.000Z'; // mercredi
const saturday='2026-11-07T14:00:00.000Z'; // samedi
const sundayLate='2026-11-08T22:30:00.000Z'; // dimanche 23 h 30 à Paris
const mondayEarly='2026-11-09T00:30:00.000Z'; // lundi 1 h 30 à Paris
const handOf=(categoryNumber)=>G.cards.filter(c=>c.categoryId===G.categories[categoryNumber-1].id).slice(0,6).map(c=>c.id);

// Dates de Paris (fuseau horaire, pas UTC).
assert.equal(G.parisDateKey(at),'2026-11-04');
assert.equal(G.parisDateKey(saturday),'2026-11-07');
assert.equal(G.parisDateKey(sundayLate),'2026-11-08','23 h 30 UTC reste dimanche à Paris');
assert.equal(G.parisDateKey(mondayEarly),'2026-11-09','1 h 30 UTC lundi est lundi à Paris');
assert.equal(G.parisDateKey('not-a-date'),null);

// Poids du D4 : 11/10/10/11 en semaine, Intimité doublée (22) le week-end.
let intimite=0;for(let k=1;k<=42;k++)if(G.rollCategory(2,()=>k,at)===4)intimite++;
assert.equal(intimite,11,'semaine : 11 tickets Intimité sur 42');
intimite=0;for(let k=1;k<=53;k++)if(G.rollCategory(2,()=>k,saturday)===4)intimite++;
assert.equal(intimite,22,'week-end : 22 tickets Intimité sur 53');
intimite=0;for(let k=1;k<=53;k++)if(G.rollCategory(2,()=>k,sundayLate)===4)intimite++;
assert.equal(intimite,22,'dimanche soir à Paris : poids doublé');
intimite=0;for(let k=1;k<=42;k++)if(G.rollCategory(2,()=>k,mondayEarly)===4)intimite++;
assert.equal(intimite,11,'lundi 1 h 30 à Paris : poids de semaine');
assert.equal(G.rollCategory(1,()=>1,at),1,'le catalogue v1 ignore le poids week-end');

// Offre Hardcore : D20 supplémentaire quand le D4 tombe sur Intimité.
function rollCategoryOn(room,actor,category,modeRoll){
  const roundId=room.lanes[actor].round.id;
  const next=G.reduceRoom(room,{type:'ROLL_CATEGORY',catalogueVersion:2,value:category,hand:handOf(category),modeRoll,actor,roundId,at});
  assert.notEqual(next,room);assert.ok(G.validateRoom(next));
  return next;
}
{
  let room=G.createRoom({at});
  room=rollCategoryOn(room,'a',4,15);
  assert.equal(room.lanes.a.round.modeRoll,15);assert.equal(room.lanes.a.round.hardcoreOffer,true,'D20 15 -> offre Hardcore');
  room=G.createRoom({at});room=rollCategoryOn(room,'a',4,10);
  assert.equal(room.lanes.a.round.modeRoll,10);assert.equal(room.lanes.a.round.hardcoreOffer,false,'D20 10 -> Intimité classique');
  room=G.createRoom({at});room=rollCategoryOn(room,'a',4,11);
  assert.equal(room.lanes.a.round.hardcoreOffer,true,'D20 11 -> offre Hardcore');
  room=G.createRoom({at});room=rollCategoryOn(room,'a',1,20);
  assert.equal(room.lanes.a.round.modeRoll,null,'pas de D20 hors Intimité');
  assert.equal(room.lanes.a.round.hardcoreOffer,false);
}

// Relance gratuite du thème : une fois par jour de Paris et par personne, hors quota.
{
  let room=G.createRoom({at});
  room=rollCategoryOn(room,'a',1,undefined);
  const roundId=room.lanes.a.round.id;
  const rerolled=G.reduceRoom(room,{type:'REROLL_CATEGORY',catalogueVersion:2,value:3,hand:handOf(3),actor:'a',roundId,at});
  assert.notEqual(rerolled,room,'la relance de thème s’applique');
  assert.ok(G.validateRoom(rerolled));
  assert.equal(rerolled.lanes.a.round.categoryId,'projets');
  assert.equal(rerolled.lanes.a.phase,'card');
  assert.deepEqual(rerolled.dailyReroll,{dateKey:'2026-11-04',used:['a']});
  const again=G.reduceRoom(rerolled,{type:'REROLL_CATEGORY',catalogueVersion:2,value:1,hand:handOf(1),actor:'a',roundId,at});
  assert.equal(again,rerolled,'seconde relance le même jour bloquée');
  const otherActor=G.reduceRoom(rerolled,{type:'REROLL_CATEGORY',catalogueVersion:2,value:1,hand:handOf(1),actor:'b',roundId:rerolled.lanes.b.round.id,at});
  // la lane b est en phase category : bloquée aussi, mais pour la phase
  assert.equal(otherActor,rerolled,'relance bloquée hors phase card');
  const nextDay=G.reduceRoom(rerolled,{type:'REROLL_CATEGORY',catalogueVersion:2,value:1,hand:handOf(1),actor:'a',roundId,at:'2026-11-05T10:00:00.000Z'});
  assert.notEqual(nextDay,rerolled,'nouvelle relance disponible le lendemain');
  assert.deepEqual(nextDay.dailyReroll,{dateKey:'2026-11-05',used:['a']});
  const fresh=G.createRoom({at});
  assert.equal(G.reduceRoom(fresh,{type:'REROLL_CATEGORY',catalogueVersion:2,value:1,hand:handOf(1),actor:'a',roundId:fresh.lanes.a.round.id,at}),fresh,'relance bloquée en phase category');
}

// Carte du jour : tirée avec le premier lancer de la journée, partagée, proposée une fois.
{
  let room=G.createRoom({at});
  const daily=G.drawDaily(room,at,()=>1);
  assert.ok(daily&&daily.dateKey==='2026-11-04'&&daily.usedBy===null);
  room=G.reduceRoom(room,{type:'EXPIRE_TASKS',at,daily});
  assert.ok(room.daily&&room.daily.cardId,'la carte du jour est enregistrée');
  assert.ok(G.validateRoom(room));

  const roundId=room.lanes.a.round.id;
  const sent=G.reduceRoom(room,{type:'SEND_DAILY',actor:'a',roundId,at});
  assert.notEqual(sent,room,'proposer la carte du jour s’applique');
  assert.ok(G.validateRoom(sent));
  assert.equal(sent.pendingRounds.length,1);
  assert.equal(sent.pendingRounds[0].round.id,roundId);
  assert.equal(sent.pendingRounds[0].round.awaiting,'b');
  assert.equal(sent.pendingRounds[0].round.cardId,room.daily.cardId);
  assert.equal(sent.pendingRounds[0].round.from,'a');
  assert.equal(sent.lanes.a.phase,'category','le tirage suivant est disponible sans attendre');
  assert.equal(sent.daily.usedBy,'a','la carte du jour est consommée');

  const passed=G.reduceRoom(sent,{type:'PASS',actor:'b',roundId,at});
  assert.equal(passed.lanes.a.phase,'category');
  assert.equal(passed.pendingRounds.length,0);
  const resend=G.reduceRoom(passed,{type:'SEND_DAILY',actor:'a',roundId:passed.lanes.a.round.id,at});
  assert.equal(resend,passed,'carte du jour déjà proposée aujourd’hui');

  const bare=G.createRoom({at});
  assert.equal(G.reduceRoom(bare,{type:'SEND_DAILY',actor:'a',roundId:bare.lanes.a.round.id,at}),bare,'sans carte du jour, rien à proposer');
  const stale=clone(room);stale.daily={...room.daily,dateKey:'2026-11-03'};
  assert.ok(G.validateRoom(stale));
  assert.equal(G.reduceRoom(stale,{type:'SEND_DAILY',actor:'a',roundId:stale.lanes.a.round.id,at}),stale,'carte du jour périmée refusée');
}

// Le premier ROLL_CATEGORY de la journée tire aussi la carte du jour (chemin serveur).
{
  let room=G.createRoom({at});
  const roundId=room.lanes.a.round.id;
  const daily=G.drawDaily(room,at,()=>1);
  room=G.reduceRoom(room,{type:'ROLL_CATEGORY',catalogueVersion:2,value:1,hand:handOf(1),daily,actor:'a',roundId,at});
  assert.ok(room.daily&&room.daily.dateKey==='2026-11-04','le lancer de catégorie tire la carte du jour');
  assert.ok(G.validateRoom(room));
  const again=G.reduceRoom(room,{type:'ROLL_CARD',value:1,actor:'a',roundId,at});
  assert.equal(again.daily.dateKey,'2026-11-04','la carte du jour ne change pas dans la journée');
}

// Les salles anciennes sans ces champs restent valides.
{
  const room=G.createRoom({at});
  const stripped=clone(room);delete stripped.daily;delete stripped.dailyReroll;
  assert.ok(G.validateRoom(stripped),'salle sans daily/dailyReroll toujours valide');
  const restored=G.normalizeRoom(stripped,{at});
  assert.ok(restored&&G.validateRoom(restored));
}

console.log('Dés·ir carte du jour, relance quotidienne, poids week-end et offre Hardcore : toutes les assertions passent.');
