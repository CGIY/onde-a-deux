import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

let now=Date.parse("2026-10-26T21:59:59Z"),timerId=0;
class Clock extends Date { static now(){return now;} }
const bat={classList:{contains:name=>name==="halloween-atmosphere__bat"}};
const layer={hidden:true,children:[bat],classList:{},replaceChildren(...children){this.children=children;}};
const document={hidden:false,addEventListener(){},querySelector:()=>layer,createElement:()=>({classList:{contains:()=>false},style:{},remove(){}})};
const window={};
runInNewContext(readFileSync(new URL("../cartes/season-dates.js",import.meta.url),"utf8"),{window});
runInNewContext(readFileSync(new URL("../cartes/halloween-atmosphere.js",import.meta.url),"utf8"),{
  document,window,Date:Clock,Math,matchMedia:()=>({matches:false,addEventListener(){}}),
  setTimeout:()=>++timerId,clearTimeout(){},setInterval(){},
});
assert.equal(layer.hidden,true,"No Halloween effects before the event starts in Paris");
now=Date.parse("2026-10-26T22:00:00Z");window.HalloweenAtmosphere.refresh();
assert.equal(layer.hidden,false,"Effects start at midnight in Paris on 27 October");
now=Date.parse("2026-11-01T22:59:59Z");window.HalloweenAtmosphere.refresh();
assert.equal(layer.hidden,false,"Effects remain active through 23:59 on 1 November in Paris");
now=Date.parse("2026-11-01T23:00:00Z");window.HalloweenAtmosphere.refresh();
assert.equal(layer.hidden,true,"Effects stop at midnight after 1 November in Paris");
console.log("OK: ambient Halloween decorations follow the Paris event window and stop after 1 November.");
