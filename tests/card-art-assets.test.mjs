import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const catalogue=JSON.parse(readFileSync(new URL('../docs/card-art-catalogue.json',import.meta.url)));
const mapping=JSON.parse(readFileSync(new URL('../docs/card-art-b64/art-mapping.json',import.meta.url)));
const byId=new Map(Object.entries(mapping).map(([slug,value])=>[value.template_id,slug]));
const folder=new URL('../cartes/assets/cards-v3/',import.meta.url),hashes=new Set();
assert.equal(catalogue.length,132);assert.equal(byId.size,132);
assert.equal(readdirSync(folder).filter(name=>name.endsWith('.webp')).length,132);
for(const card of catalogue){
  const slug=byId.get(card.id);assert(slug,`Missing mapping for ${card.id}`);
  const bytes=readFileSync(new URL(slug+'.webp',folder));assert(bytes.length>20000,`Empty or undersized artwork: ${slug}`);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.toString('ascii',12,16),'VP8 ');
  const dimensions={width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
  assert(dimensions.width>=800&&dimensions.height>=1200,`Artwork too small: ${slug}`);
  assert(Math.abs(dimensions.width/dimensions.height-2/3)<.02,`Wrong portrait ratio: ${slug}`);
  const hash=createHash('sha256').update(bytes).digest('hex');assert(!hashes.has(hash),`Duplicated image: ${slug}`);hashes.add(hash);
}
console.log('OK: 132 catalogue entries, 132 distinct portrait WebP images, complete ID mapping, sufficient dimensions and no empty files.');
