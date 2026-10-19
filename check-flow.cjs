const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element() { return { hidden: true, dataset:{}, handlers:{}, style: {setProperty() {}}, classList: {add(){},remove(){},toggle(){}}, addEventListener(name, fn){this.handlers[name]=fn;}, textContent:'', value:'', children: [], replaceChildren(...items){this.children=items;}, append(...items){this.children.push(...items);}, setAttribute(){}, querySelectorAll(){return [];} }; }
const context = { window: {}, document: {getElementById(id){if(!elements.has(id)) elements.set(id,element()); return elements.get(id);},createElement(){return element();}, querySelectorAll(){return [];}, querySelector(){return null;}}, localStorage:{getItem(){return null;},setItem(){}}, sessionStorage:{getItem(){return null;}}, location:{search:''}, navigator:{}, URLSearchParams, console, setTimeout, clearTimeout, matchMedia(){return {matches:true};} };
context.window.ondeLive = {push(){}, onChange(){}};
context.window.scrollTo = () => {};
vm.createContext(context);
for (const path of ['media-catalog.js','app.js']) vm.runInContext(fs.readFileSync(`dist/${path}`,'utf8'),context);
const source=fs.readFileSync('dist/flow.js','utf8').replace(/\}\)\(\);\s*$/, 'window.test={state, catalog, resultFor, freshProgress, deckFor, sampleDeck, mysteryFor, prepareOffers, progressFrom};})();');
vm.runInContext(source,context);
const t=context.window.test;
const category=t.catalog.find(c=>c.id==='action');
let assertions=0;
for(const role of ['J1','J2']) for(const a of [undefined,'A','C','pass']) for(const c of [undefined,'A','C','pass']) {
  const pA=t.freshProgress(), pC=t.freshProgress();
  pA.picks.action=0; pC.picks.action=1;
  pA.decisions.action=a; pC.decisions.action=c;
  Object.assign(t.state,{role,room:'TEST42',own:role==='J1'?pA:pC,other:role==='J1'?pC:pA});
  const result=t.resultFor(category,true);
  const expected=a==='pass'||c==='pass'?'reporté':a&&a===c?'choisi':null;
  assert.equal(result?.kind||null,expected);
  if(expected==='choisi') assert.equal(result.title,category.cards[a==='A'?0:1].title);
  assertions++;
}
const games=t.catalog.find(c=>c.id==='jeu');
for(let i=0;i<80;i++) {
  t.state.room=`ROOM${i}`;
  const first=t.sampleDeck(games);
  assert.equal(first.filter(x=>games.cards[x].subtype==='Jeu de société').length,2);
  assert.equal(first.filter(x=>games.cards[x].subtype==='Jeu vidéo').length,1);
  const second=t.sampleDeck(games,first.map(x=>({title:games.cards[x].title,at:Date.now()})));
  assert(!second.some(x=>first.includes(x)));
  assertions++;
}
Object.assign(t.state,{role:'J1',room:'PAIR42',own:t.freshProgress(),other:t.freshProgress()});
t.prepareOffers();
const offers=t.state.own.offers;
for(const c of t.catalog) {
  assert.equal(new Set(offers[c.id]).size,4);
  assert(offers[c.id].every(x=>Number.isInteger(x)&&!!c.cards[x]));
}
const firstDeck=JSON.stringify(t.catalog.map(c=>[t.deckFor(c),t.mysteryFor(c)]));
[t.state.own,t.state.other]=[t.state.other,t.state.own];
t.state.role='J2';
assert.equal(JSON.stringify(t.catalog.map(c=>[t.deckFor(c),t.mysteryFor(c)])),firstDeck);
assert.equal(t.progressFrom({version:2,picks:{},decks:{}}).decisions.constructor.name,'Object');
assert(context.window.ONDE_MEDIA_CATALOG.film.includes('Bad apple'));
for(const mode of ['click','touch','pen']) {
  Object.assign(t.state,{role:'J1',room:'NEXT42',own:t.freshProgress(),other:t.freshProgress(),ready:true});
  for(let position=0;position<t.catalog.length;position++) {
    t.state.screen='kept';
    elements.get('keptScreen').hidden=false;
    t.state.own.picks[t.catalog[position].id]=0;
    const handlers=elements.get('nextCategoryButton').handlers;
    if(mode!=='click') {
      const point={pointerId:1,pointerType:mode,isPrimary:true,clientX:150,clientY:300,preventDefault(){}};
      handlers.pointerdown(point);handlers.pointerup(point);
    }
    handlers.click();
    assert.equal(t.state.own.position,position+1,`${mode}: one tap must advance immediately`);
    handlers.click();
    assert.equal(t.state.own.position,position+1,`${mode}: duplicate click must not skip a category`);
  }
  assert.equal(t.state.own.finished,true);
}
console.log(`${assertions} voting/rotation cases passed; shared offers, mystery and existing progress verified.`);
console.log('Single-tap advance passed for mouse, touch and pen across all categories; duplicate clicks ignored.');
