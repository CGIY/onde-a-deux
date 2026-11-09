'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const G=require('../src/onde-app-core.js');
const Art=require('../src/onde-badge-art.js');
const source=fs.readFileSync(path.join(__dirname,'../src/onde-badge-art.js'),'utf8');
const contexts=['recent','collection','notice','detail','asset'];
const allowedColors=new Set(['#111C2F','#8296B3','#A6B6CB','#F3F1F6','#A7C7DC','#D6B594','#87BDBE','#BCACDB','#D2A2B7']);
const geometry=svg=>svg.match(/<path data-constellation="" d="([^"]+)"/)[1];
const marks=svg=>[...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"\//g)].map(match=>match.slice(1).map(Number));

function inspect(svg,id){
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 160 176" aria-hidden="true" focusable="false"/);
  assert(svg.endsWith('</svg>'));
  assert(svg.includes('data-badge-art="'+id+'"'));
  assert.doesNotMatch(svg,/undefined|NaN|Infinity|url\(|\b(?:href|on\w+)=|<(?:script|foreignObject|image|filter|use|animate\w*|style)\b/i);
  const tags=new Set([...svg.matchAll(/<\/?([A-Za-z][\w:-]*)/g)].map(match=>match[1]));
  assert.deepEqual([...tags].sort(),['circle','g','path','svg']);
  assert(!/\sid=/.test(svg),'no SVG definition IDs can collide between surfaces');
  assert.match(geometry(svg),/^M[\d. ]+L[\d. LM]+$/);
  assert(marks(svg).length>=10,'visible lead stars and a backdrop');
  for(const [x,y,radius] of marks(svg)){
    assert(x-radius>=0&&x+radius<=160&&y-radius>=0&&y+radius<=176,'stars remain inside the canvas');
  }
  for(const match of svg.matchAll(/(?:fill|stroke|color)="(#[0-9a-f]+)"/gi))assert(allowedColors.has(match[1]));
}

assert.equal(Art.version,3);
assert.equal(Art.ids.length,120);
assert.deepEqual(Art.ids,G.badgeCatalog.map(badge=>badge.id),'the artwork follows the full catalogue order');
assert.deepEqual(Art.catalogue.map(item=>item.id),Art.ids);
assert.equal(new Set(Art.ids).size,Art.ids.length);
assert(Object.isFrozen(Art)&&Object.isFrozen(Art.ids)&&Object.isFrozen(Art.catalogue));
assert(Art.catalogue.every(Object.isFrozen));
assert.deepEqual([...new Set(Art.catalogue.map(item=>item.tone))].sort(),['gold','ice','rose','teal','violet']);

const constellations=new Set();
let totalBytes=0,totalRenders=0;
for(const id of Art.ids){
  const asset=Art.render(id);
  constellations.add(geometry(asset));
  totalBytes+=Buffer.byteLength(asset);
  assert(Buffer.byteLength(asset)<2600,'each badge is small enough to inline');
  for(const locked of [false,true])for(const instance of contexts){
    const options={instance,locked},svg=Art.render(id,options);
    inspect(svg,id);
    assert.equal(Art.render(id,options),svg,'repeatable render');
    assert.equal(geometry(svg),geometry(asset),'locked and unlocked badges keep the same constellation');
    assert.deepEqual(marks(svg),marks(asset));
    assert.equal(svg===asset,!locked,'earned and locked have different finishes');
    totalRenders++;
  }
}
assert.equal(constellations.size,Art.ids.length,'every badge has distinct trace geometry');
assert(totalBytes<220000,'complete art collection stays light');

const browser={OndeGame:G};browser.window=browser;vm.runInNewContext(source,browser,{filename:'onde-badge-art.js'});
assert.deepEqual(Array.from(browser.window.OndeBadgeArt.ids),Art.ids);
for(const id of Art.ids)assert.equal(browser.window.OndeBadgeArt.render(id,{instance:'notice'}),Art.render(id,{instance:'notice'}));
assert.throws(()=>Art.render('unknown-badge'),RangeError);
assert.throws(()=>Art.render(Art.ids[0],{instance:'notice" onload="bad'}),RangeError);
assert.throws(()=>Art.render(Art.ids[0],null),TypeError);
assert.throws(()=>Art.render(Art.ids[0],[]),TypeError);
console.log('Dés·ir badge art: '+constellations.size+' distinct constellations, '+totalRenders+' stable SVG renders, '+totalBytes+' earned asset bytes.');
