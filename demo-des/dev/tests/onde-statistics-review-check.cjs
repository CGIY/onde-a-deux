'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=require('node:path').join(__dirname,'../src/onde-statistics-review.html');
const script=fs.readFileSync(file,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

class El {
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.style={};this.className='';this.value='';this.disabled=false;this.hidden=false;this.checked=false;this._text='';this.classList={toggle:(n,on)=>{const a=this.className.split(' ').filter(Boolean),s=new Set(a);on?s.add(n):s.delete(n);this.className=[...s].join(' ')}};}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 set textContent(t){this._text=String(t);this.children=[]}
 append(...a){for(const c of a){this.children.push(c);c.parent=this}}
 replaceChildren(...a){this.children=[];this._text='';this.append(...a)}
 setAttribute(k,v){this.attributes[k]=String(v)}
 addEventListener(k,fn,opts){(this.events[k]||=[]).push({fn,opts})}
 fire(k){for(const x of [...(this.events[k]||[])]){x.fn({target:this});if(x.opts?.once)this.events[k]=this.events[k].filter(y=>y!==x)}}
 click(){this.fire('click')}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
}
function all(root,p){return(root.children||[]).flatMap(c=>[...(p(c)?[c]:[]),...all(c,p)])}
const fixture=[
 {cardId:'a',category:'complicite',challenge:'Été <script>test</script>',variantes:[{statKey:'k1',texte:'42,2 % des adultes interrogés…',chiffre:42.2,angle:'pratique',source:'Institut',year:2025,population:'Adultes',confiance:'haute',url:'https://example.org/a'},{statKey:'k2',texte:'81 % apprécient…',chiffre:81,angle:'appreciation',source:'Autre',url:'javascript:alert(1)'}],statut:'OK'},
 {cardId:'b',category:'projets',challenge:'Musée',variantes:[],statut:'OK',sources_consultees_si_introuvable:[{title:'Source',url:'https://example.org/b'}],reason:'Pas de chiffre direct.'},
 {cardId:'c',category:'detente',challenge:'Massage',variantes:[0,1,2].map(i=>({statKey:'c'+i,texte:(10+i)+' % des adultes…',chiffre:10+i,angle:['pratique','appreciation','envie'][i],source:'Institut'})),statut:'PARTIEL'}
];
async function setup({stored={},failStorage=false,failFetch=false,data=fixture}={}){
 const els=Object.fromEntries(['save-status','total-cards','total-variants','incomplete-cards','kept-variants','export-count','search','category','status','results','result-count','clear-filters','export','notice'].map(k=>[k,new El('div')]));
 const memory=new Map(Object.entries(stored));const timers=[];let blob;
 const document={body:new El('body'),getElementById:id=>els[id],createElement:tag=>new El(tag),createTextNode:t=>{const e=new El('#text');e.textContent=t;return e},createDocumentFragment:()=>new El('#fragment')};
 class TestURL extends URL{static createObjectURL(b){blob=b;return'blob:test'}static revokeObjectURL(){}}
 const context=vm.createContext({document,URL:TestURL,Blob,Option:function(t,v){const e=new El('option');e.textContent=t;e.value=v;return e},localStorage:{getItem(k){if(failStorage)throw Error();return memory.get(k)||null},setItem(k,v){if(failStorage)throw Error();memory.set(k,v)}},fetch:async()=>{if(failFetch)throw Error();return{ok:true,json:async()=>data}},setTimeout:(fn)=>{timers.push(fn);return timers.length},clearTimeout:()=>{},console});
 vm.runInContext(script,context);await new Promise(setImmediate);
 return{els,memory,timers,document,getBlob:()=>blob};
}
(async()=>{
 let h=await setup({stored:{'desir-statistics-review-v1':JSON.stringify({k2:false})}});let n=0;
 const eq=(a,b)=>{assert.equal(a,b);n++};
 eq(h.els['total-cards'].textContent,'3');eq(h.els['total-variants'].textContent,'5');eq(h.els['incomplete-cards'].textContent,'2');eq(h.els['kept-variants'].textContent,'4');
 eq(all(h.els.results,x=>x.tagName==='article').length,3);
 eq(all(h.els.results,x=>x.tagName==='strong'&&x.textContent==='42,2 %').length,1);
 eq(all(h.els.results,x=>x.tagName==='a'&&x.href?.startsWith('javascript:')).length,0);
 eq(all(h.els.results,x=>x.tagName==='h3')[0].textContent,'Été <script>test</script>');
 const article=all(h.els.results,x=>x.tagName==='article')[0],check=all(article,x=>x.tagName==='input')[0];check.checked=false;check.fire('change');
 eq(h.els['kept-variants'].textContent,'3');eq(JSON.parse(h.memory.get('desir-statistics-review-v1')).k1,false);eq(all(h.els.results,x=>x.tagName==='article')[0],article);
 h.els.status.value='PARTIEL';h.els.status.fire('change');eq(all(h.els.results,x=>x.tagName==='article').length,1);
 h.els.status.value='INTROUVABLE';h.els.status.fire('change');eq(all(h.els.results,x=>x.tagName==='h3')[0].textContent,'Musée');
 h.els['clear-filters'].click();h.els.search.value='ete <script>';h.els.search.fire('input');eq(all(h.els.results,x=>x.tagName==='article').length,1);
 h.els['clear-filters'].click();h.els.category.value='Détente';h.els.category.fire('change');eq(all(h.els.results,x=>x.tagName==='article').length,1);
 h.els.export.click();let exp=JSON.parse(await h.getBlob().text());eq(exp.choices.length,5);eq(exp.summary.kept,3);eq(exp.choices.find(x=>x.statKey==='k2').garder,false);
 for(const check of all(h.els.results,x=>x.tagName==='input')){check.checked=false;check.fire('change')}
 eq(h.els['kept-variants'].textContent,'0');eq(h.els.export.disabled,false);h.els.export.click();exp=JSON.parse(await h.getBlob().text());eq(exp.summary.kept,0);
 let restored=await setup({stored:Object.fromEntries(h.memory)});eq(restored.els['kept-variants'].textContent,'0');
 let memoryOnly=await setup({failStorage:true});eq(memoryOnly.els['save-status'].textContent,'Choix pour cette session');eq(memoryOnly.els.export.disabled,false);
 let failed=await setup({failFetch:true});eq(failed.els.export.disabled,true);eq(failed.els['result-count'].textContent,'Sources indisponibles');eq(failed.els.results.attributes['aria-busy'],'false');
 let invalid=await setup({data:[fixture[0],fixture[0]]});eq(invalid.els.export.disabled,true);
 console.log(n+' contrôles : compteurs réels, statuts dérivés, recherches accentuées, filtres, sécurité des liens/texte, coches sans rerender, persistance, export global/choix vide, stockage indisponible, erreur réseau/données.');
})().catch(e=>{console.error(e);process.exitCode=1});
