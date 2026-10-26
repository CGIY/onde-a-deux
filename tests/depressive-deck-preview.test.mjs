import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./depressive-deck-preview.js',import.meta.url),'utf8');
const win={};runInNewContext(source,{window:win});
const {createMemory,finishForRoll,drawRewards}=win.DepressiveDeckPreview;
const rewards=Array.from({length:10},(_,i)=>({id:'reward-'+i,template_id:'challenge-'+i,card_type:'challenge'}));
const energy={id:'energy',template_id:'energy',card_type:'energy'};
function fixture(onRewards){const awards=[];const game=createMemory({rewards,energy,random:()=>.99999,onRewards:cards=>{onRewards?.(cards);awards.push(...cards);}});return {game,awards};}
const {game,awards}=fixture();
assert.equal(game.snapshot().tiles.length,20);assert(game.snapshot().tiles.every(tile=>tile.motif===null));assert.equal(awards.length,0);
assert.equal(game.flip(0).kind,'first');assert.equal(game.snapshot().turns,0);assert.equal(game.flip(0).kind,'ignored');assert.equal(game.flip(1).kind,'match');assert.equal(game.snapshot().turns,1);assert.equal(awards.length,0,'No award before the pair resolves');
assert.equal(game.flip(2).kind,'ignored','Third click blocked');game.resolve();assert.equal(awards.length,1);assert.equal(game.resolve(),null);assert.equal(game.flip(0).kind,'ignored');
for(let i=1;i<10;i++){game.flip(i*2);game.flip(i*2+1);game.resolve();}
assert.equal(game.snapshot().done,true);assert.equal(game.snapshot().found,10);assert.equal(game.snapshot().turns,10);assert.equal(awards.length,10);assert(awards.every(c=>c.card_type==='challenge'));
assert.equal(game.flip(10).kind,'ignored');assert.equal(game.resolve(),null);assert.equal(awards.length,10);
// Every miss costs one attempt; original unearned cards never enter discoveries.
const lose=fixture();
for(let i=0;i<20;i++){assert.equal(lose.game.flip(0).kind,'first');assert.equal(lose.game.flip(2).kind,'miss');assert.equal(lose.awards.length,0);lose.game.resolve();}
assert.equal(lose.game.snapshot().done,true);assert.equal(lose.game.snapshot().found,0);assert.equal(lose.game.snapshot().remaining,0);assert.equal(lose.awards.length,10);assert(lose.awards.every(c=>c.card_type==='energy'));assert.equal(new Set(lose.awards.map(c=>c.id)).size,10);assert.equal(new Set(lose.awards.map(c=>c.template_id)).size,1);
const mixed=fixture();for(let i=0;i<7;i++){mixed.game.flip(i*2);mixed.game.flip(i*2+1);mixed.game.resolve();}for(let i=0;i<13;i++){mixed.game.flip(14);mixed.game.flip(16);mixed.game.resolve();}
assert.equal(mixed.awards.filter(c=>c.card_type==='challenge').length,7);assert.equal(mixed.awards.filter(c=>c.card_type==='energy').length,3);
const last=fixture();for(let i=0;i<10;i++){last.game.flip(0);last.game.flip(2);last.game.resolve();}for(let i=0;i<10;i++){last.game.flip(i*2);last.game.flip(i*2+1);last.game.resolve();}assert.equal(last.game.snapshot().turns,20);assert.equal(last.game.snapshot().found,10);assert(last.awards.every(c=>c.card_type==='challenge'),'A match on the final attempt is still won');
let failing=true;const retry=fixture(()=>{if(failing)throw Error('callback failed');});retry.game.flip(0);retry.game.flip(1);assert.throws(()=>retry.game.resolve());assert.equal(retry.game.snapshot().found,0);assert.equal(retry.game.snapshot().pending,true);failing=false;retry.game.resolve();assert.equal(retry.awards.length,1);
assert.throws(()=>createMemory({rewards:rewards.slice(1),energy}));
const distribution={};for(let i=0;i<100000;i++){const key=finishForRoll((i+.5)/100000);distribution[key]=(distribution[key]||0)+1;}
assert.deepEqual(distribution,{legendary:500,full_art_foil:2000,foil:8000,full_art:20000,standard:69500});
assert.throws(()=>finishForRoll(1));assert.throws(()=>finishForRoll(-.1));
const bank=Object.keys(distribution).flatMap(finish=>[{...rewards[0],id:finish,template_id:finish,finish,palette:'couple'}]);
const draws=drawRewards(bank,()=>.9);assert.equal(draws.length,10);assert.equal(new Set(draws.map(c=>c.id)).size,10);assert(draws.every(c=>c.finish==='standard'));assert.throws(()=>drawRewards([]));
// Uniform finish rolls retain the established 0.8 weight for Mise à nue.
const weighted=[...bank,{...bank.find(c=>c.finish==='standard'),id:'nude',template_id:'nude',palette:'nude'}];let n=0;const drawsWeighted=drawRewards(weighted,()=>++n%2?.9:.6);assert(drawsWeighted.every(c=>c.palette==='nude'));
assert.doesNotMatch(source,/\bfetch\s*\(|localStorage|sessionStorage|supabase/i);
const server=readFileSync(new URL('./booster-preview.mjs',import.meta.url),'utf8');assert.match(server,/connect-src 'none'/);assert.match(server,/_deck-preview/);
console.log('OK: 20 tiles/20 attempts, match locking, no early discovery, exact 7+3 result, energy-only failure, final-attempt victory, safe resolution retry and normal rarity distribution with Nude ×0.8.');
