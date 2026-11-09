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
const allowedElements=new Set(['svg','defs','clipPath','path','ellipse','circle','rect','g']);

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
  ok(elements>=12,label+' contains the frame, clip and scene');
  const scene=svg.slice(svg.indexOf('<g clip-path='));
  ok(/<path d="M[^"]{100,}" fill-rule="evenodd"\/>/i.test(scene),label+' has visible vector contours');
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  const references=[...svg.matchAll(/url\(#([^)]*)\)/g)].map(match=>match[1]);
  eq(ids.length,new Set(ids).size,label+' does not reuse a definition ID');
  eq(ids.length,1,label+' needs only one local clipping definition');
  for(const id of ids){ok(id.startsWith(prefix+'-'),label+' namespaces every definition');ok(/^[a-z][a-z0-9-]*$/.test(id),label+' uses valid stable IDs');}
  for(const id of new Set(references))ok(ids.includes(id),label+' resolves every local reference');
  for(const match of svg.matchAll(/(?:fill|stroke|stop-color)="(#[^"]+)"/g))ok(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(match[1]),label+' has a valid color');
  return ids;
}

eq(Art.version,2);eq(Art.ids.length,90);eq(Art.catalogue.length,90);
eq(Art.ids,G.badgeCatalog.map(badge=>badge.id),'all current badge IDs appear exactly once in catalogue order');
eq(Art.catalogue.map(item=>item.id),Art.ids);
eq(new Set(Art.ids).size,90);eq(new Set(Art.catalogue.map(item=>item.motif)).size,90,'all ninety badges have an explicitly distinct illustration');
ok(Object.isFrozen(Art)&&Object.isFrozen(Art.ids)&&Object.isFrozen(Art.catalogue));
ok(Art.catalogue.every(Object.isFrozen));
eq([...new Set(Art.catalogue.map(item=>item.shape))].sort(),['circle','hex','oval','rosette','shield'],'the five approved soft silhouettes are used');
eq([...new Set(Art.catalogue.map(item=>item.tone))].sort(),['ivory','peach','rose','sage'],'only the four approved matte fields are used');
const allowedColors=new Set(['#F1D6C6','#F0EEE7','#D0D6B8','#ECD1CF','#176B97','#DCCCB7','#A59C89','#C9C8BC','#66705F','#B0B1A4','#929A8B']);

// Distinct artwork is checked after removing identifiers and metadata, so a
// unique badge name alone cannot make a repeated pictogram pass this check.
const actualCompositions=new Set(),sceneGeometries=new Set(),allMountedIds=new Set();let totalAssetBytes=0,totalRenders=0;
for(const id of Art.ids){
  const asset=Art.render(id,{instance:'asset',locked:false}),basePrefix='oba-asset-'+id+'-e';
  const normalized=asset.split(basePrefix).join('badge').replace(/ data-badge-art="[^"]*"/,'').replace(/ data-art-motif="[^"]*"/,'');
  actualCompositions.add(digest(normalized));
  const scene=asset.slice(asset.indexOf('<g clip-path='));
  sceneGeometries.add(digest(scene.replace(/url\(#[^)]*\)/g,'url(#scene)').replace(/#[0-9a-f]{6}/gi,'#color')));
  totalAssetBytes+=Buffer.byteLength(asset);
  ok(Buffer.byteLength(asset)<14000,id+' stays small enough for a mobile collection');
  eq(Art.render(id),asset,id+' has explicit deterministic defaults');
  for(const locked of [false,true])for(const instance of contexts){
    const options={instance,locked},svg=Art.render(id,options),label=id+'/'+instance+'/'+locked;
    const prefix='oba-'+instance+'-'+id+'-'+(locked?'l':'e');
    eq(Art.render(id,options),svg,label+' is byte-for-byte repeatable');
    const elementIds=inspect(svg,prefix,label);
    for(const match of svg.matchAll(/(?:fill|stroke)="(#[^"]+)"/g))ok(allowedColors.has(match[1]),label+' uses the approved UI-derived palette');
    for(const elementId of elementIds){ok(!allMountedIds.has(elementId),label+' remains collision-free when all surfaces are mounted');allMountedIds.add(elementId);}
    eq(geometries(svg),geometries(asset),label+' preserves the authored silhouette and motif');
    if(locked)ok(svg!==asset,label+' has an actual muted locked treatment');
    totalRenders++;
  }
}
eq(actualCompositions.size,90,'ninety different compositions remain after identity metadata is removed');
eq(sceneGeometries.size,90,'all ninety scenes remain distinct without their name, frame or colour');
ok(totalAssetBytes<750000,'the complete earned collection remains under 750 kilobytes of SVG');
eq(totalRenders,900);eq(allMountedIds.size,900);

// Browser script loading and CommonJS produce exactly the same assets.
const browser={};browser.window=browser;vm.runInNewContext(source,browser,{filename:'onde-badge-art.js'});
eq(Array.from(browser.window.OndeBadgeArt.ids),Art.ids);
for(const id of Art.ids)eq(browser.window.OndeBadgeArt.render(id,{locked:false,instance:'notice'}),Art.render(id,{locked:false,instance:'notice'}),id+' renders identically in both module environments');
fails(()=>Art.render('unknown-badge'),RangeError);
fails(()=>Art.render(Art.ids[0],{instance:'notice" onload="bad'}),RangeError);
fails(()=>Art.render(Art.ids[0],null),TypeError);
fails(()=>Art.render(Art.ids[0],[]),TypeError);
eq(Art.render(Art.ids[0],{instance:'detail',locked:true}),Art.render(Art.ids[0],{locked:true,instance:'detail'}),'option property order is irrelevant');
console.log('Dés·ir badge art: '+checks+' coverage, scene, palette, namespace and deterministic SVG checks passed; '+totalRenders+' renders, '+totalAssetBytes+' earned asset bytes.');
