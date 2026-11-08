'use strict';
// Standalone vector integrity checks. The release build additionally parses
// every exported SVG as XML; visual contact sheets are reviewed separately.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const G=require('../src/onde-app-core.js');
const Art=require('../src/onde-badge-art.js');
const source=fs.readFileSync(path.join(__dirname,'../src/onde-badge-art.js'),'utf8');
let checks=0;
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const fails=(fn,type)=>{checks++;assert.throws(fn,type);};
const contexts=['recent','collection','notice','detail','asset'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const geometries=svg=>[...svg.matchAll(/\b(?:d|points)="([^"]*)"/g)].map(match=>match[1]);
const allowedElements=new Set(['svg','defs','linearGradient','radialGradient','stop','clipPath','path','ellipse','circle','rect','g']);

function inspect(svg,prefix,label){
  ok(svg.startsWith('<svg ')&&svg.endsWith('</svg>'),label+' has one complete SVG root');
  ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'),label+' is standalone');
  ok(svg.includes('viewBox="0 0 160 176"'),label+' uses the shared canvas');
  ok(svg.includes('aria-hidden="true"')&&svg.includes('focusable="false"'),label+' is decorative beside its text label');
  const root=svg.slice(0,svg.indexOf('>')+1);
  ok(!/\b(?:width|height)=/.test(root),label+' scales without a fixed viewport');
  ok(!/undefined|NaN|Infinity/.test(svg),label+' has finite, complete values');
  ok(!/<(?:script|foreignObject|image|use|filter|fe\w+|animate\w*|set|style|text)\b/i.test(svg),label+' has no external, animated or filter-based artwork');
  ok(!/\b(?:href|xlink:href|on\w+)=|@import|font-family|turbulence|javascript:/i.test(svg),label+' cannot fetch or execute content');
  ok(!/url\(\s*(?!#)/i.test(svg),label+' only uses local paint references');
  const stack=[];let roots=0,elements=0;
  for(const token of svg.matchAll(/<\/?([A-Za-z][\w:-]*)(?:\s+[^<>]*?)?\/?>/g)){
    const tag=token[1],closing=token[0].startsWith('</'),empty=token[0].endsWith('/>');
    ok(allowedElements.has(tag),label+' uses a native drawing element');elements++;
    if(closing)eq(stack.pop(),tag,label+' closes the correct element');
    else{if(tag==='svg')roots++;if(!empty)stack.push(tag);}
  }
  eq(stack,[],label+' leaves no open groups');eq(roots,1,label+' is not a nested document');
  ok(elements>=35,label+' contains a complete material and illustration composition');
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  const references=[...svg.matchAll(/url\(#([^)]*)\)/g)].map(match=>match[1]);
  eq(ids.length,new Set(ids).size,label+' does not reuse a definition ID');
  ok(ids.length>=6,label+' includes its metal, enamel, bevel, gloss and clipping definitions');
  for(const id of ids){ok(id.startsWith(prefix+'-'),label+' namespaces every definition');ok(/^[a-z][a-z0-9-]*$/.test(id),label+' uses valid stable IDs');}
  for(const id of new Set(references))ok(ids.includes(id),label+' resolves every local reference');
  for(const match of svg.matchAll(/(?:fill|stroke|stop-color)="(#[^"]+)"/g))ok(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(match[1]),label+' has a valid color');
  return ids;
}

eq(Art.version,1);eq(Art.ids.length,90);eq(Art.catalogue.length,90);
eq(Art.ids,G.badgeCatalog.map(badge=>badge.id),'all current badge IDs appear exactly once in catalogue order');
eq(Art.catalogue.map(item=>item.id),Art.ids);
eq(new Set(Art.ids).size,90);eq(new Set(Art.catalogue.map(item=>item.motif)).size,90,'all ninety badges have an explicitly distinct illustration');
ok(Object.isFrozen(Art)&&Object.isFrozen(Art.ids)&&Object.isFrozen(Art.catalogue));
ok(Art.catalogue.every(Object.isFrozen));
ok(new Set(Art.catalogue.map(item=>item.shape)).size>=14,'collection uses many silhouettes');
eq(new Set(Art.catalogue.map(item=>item.metal)).size,4,'four original metal treatments');
ok(new Set(Art.catalogue.map(item=>item.enamel)).size>=8,'enamel colors vary across the collection');
for(const item of Art.catalogue)eq(item.mark,String(G.badgeCatalog.find(badge=>badge.id===item.id).target),'engraved milestones agree with their badge thresholds');
const semanticBindings={
  'duo-thigh-massage-3':'anatomical-thigh',
  'duo-phone-drawer-3':'quiet-drawer',
  'duo-oral-desk-3':'desk-files',
  'duo-veranda-3':'glasshouse',
  'duo-spoon-3':'silver-spoons',
  'duo-lovense-quarter-3':'vibration-timer',
  'duo-hc-golden-3':'golden-rain',
  'duo-hc-chapel-3':'rose-window',
  'duo-hc-hour-contract-3':'hour-contract',
  'duo-hc-private-cinema-3':'private-cinema',
  'duo-hc-remake-3':'remake-projector'
};
for(const [id,motif] of Object.entries(semanticBindings))eq(Art.catalogue.find(item=>item.id===id).motif,motif,'specific motif remains attached to '+id);

// Distinct artwork is checked after removing identifiers and metadata, so a
// unique badge name alone cannot make a repeated pictogram pass this check.
const actualCompositions=new Set(),allMountedIds=new Set();let totalAssetBytes=0,totalRenders=0;
for(const id of Art.ids){
  const asset=Art.render(id,{instance:'asset',locked:false}),basePrefix='oba-asset-'+id+'-e';
  const normalized=asset.split(basePrefix).join('badge').replace(/ data-badge-art="[^"]*"/,'').replace(/ data-art-motif="[^"]*"/,'');
  actualCompositions.add(digest(normalized));totalAssetBytes+=Buffer.byteLength(asset);
  ok(Buffer.byteLength(asset)<20000,id+' stays small enough for a mobile collection');
  eq(Art.render(id),asset,id+' has explicit deterministic defaults');
  for(const locked of [false,true])for(const instance of contexts){
    const options={instance,locked},svg=Art.render(id,options),label=id+'/'+instance+'/'+locked;
    const prefix='oba-'+instance+'-'+id+'-'+(locked?'l':'e');
    eq(Art.render(id,options),svg,label+' is byte-for-byte repeatable');
    const elementIds=inspect(svg,prefix,label);
    for(const elementId of elementIds){ok(!allMountedIds.has(elementId),label+' remains collision-free when all surfaces are mounted');allMountedIds.add(elementId);}
    eq(geometries(svg),geometries(asset),label+' preserves the authored silhouette and motif');
    if(locked)ok(svg!==asset,label+' has an actual locked material treatment');
    totalRenders++;
  }
}
eq(actualCompositions.size,90,'ninety different compositions remain after identity metadata is removed');
ok(totalAssetBytes<1000000,'the complete earned collection remains under one megabyte of SVG');
eq(totalRenders,900);eq(allMountedIds.size,5400);

// Browser script loading and CommonJS produce exactly the same assets.
const browser={window:{}};vm.runInNewContext(source,browser,{filename:'onde-badge-art.js'});
eq(Array.from(browser.window.OndeBadgeArt.ids),Art.ids);
for(const id of Art.ids)eq(browser.window.OndeBadgeArt.render(id,{locked:false,instance:'notice'}),Art.render(id,{locked:false,instance:'notice'}),id+' renders identically in both module environments');
fails(()=>Art.render('unknown-badge'),RangeError);
fails(()=>Art.render(Art.ids[0],{instance:'notice" onload="bad'}),RangeError);
fails(()=>Art.render(Art.ids[0],null),TypeError);
fails(()=>Art.render(Art.ids[0],[]),TypeError);
eq(Art.render(Art.ids[0],{instance:'detail',locked:true}),Art.render(Art.ids[0],{locked:true,instance:'detail'}),'option property order is irrelevant');
console.log('Dés·ir badge art: '+checks+' coverage, composition, material, namespace and deterministic SVG checks passed; '+totalRenders+' renders, '+totalAssetBytes+' earned asset bytes.');
