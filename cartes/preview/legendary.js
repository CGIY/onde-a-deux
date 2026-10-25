(() => {
  'use strict';
  const themes={
    couple:{label:'En couple',color:'#ed6937',crop:'3.25%',effects:["L’autre prépare une super sortie à deux","Préparation d’un week-end ailleurs"]},
    other:{label:'Pour l’autre',color:'#f4cd7c',crop:'26.5%',effects:['Cadeau 100 euros']},
    nude:{label:'Mise à nue',color:'#cf6da1',crop:'49.9%',effects:['Achat sur Scandale',"Achat d’un gros sextoy"]},
    foodies:{label:'Les foodies',color:'#9bce58',crop:'73.4%',effects:['on mange TOUT ce que je veux, toute la journée']},
    todo:{label:'To do',color:'#53beef',crop:'96.7%',effects:["gros travaux effectué par l’autre"]}
  };
  const $=selector=>document.querySelector(selector), reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let theme='couple',index=0,chosen=false,timer,transition,rect,frame;
  const face=$('#legendFace'),dialog=$('#choiceDialog');
  for(let i=0;i<16;i++){const mote=document.createElement('i');mote.style.setProperty('--x',`${(i*37)%100}%`);mote.style.setProperty('--y',`${(i*61)%100}%`);mote.style.setProperty('--delay',`${-i*.31}s`);$('#motes').append(mote);}
  function showEffect(){ $('#effectLine').textContent=themes[theme].effects[index];$('#effectLine').classList.remove('changing'); }
  function schedule(){clearInterval(timer);if(reduce.matches||themes[theme].effects.length<2)return;timer=setInterval(()=>{if(chosen||dialog.open||document.hidden)return;$('#effectLine').classList.add('changing');clearTimeout(transition);transition=setTimeout(()=>{index=(index+1)%themes[theme].effects.length;showEffect();},170);},2400);}
  function pick(){clearTimeout(transition);showEffect();$('#choiceCategory').textContent=themes[theme].label;$('#choices').replaceChildren(...themes[theme].effects.map((effect,i)=>{const button=document.createElement('button');button.type='button';button.textContent=effect;button.addEventListener('click',()=>{index=i;chosen=true;showEffect();$('#effectLabel').textContent='Ton choix';$('#chooseButton').textContent='Modifier mon choix ✧';dialog.close();});return button;}));dialog.showModal();}
  for(const button of document.querySelectorAll('[data-theme]'))button.addEventListener('click',()=>{theme=button.dataset.theme;index=0;chosen=false;clearTimeout(transition);document.documentElement.style.setProperty('--aura',themes[theme].color);document.documentElement.style.setProperty('--crop-x',themes[theme].crop);$('#effectLabel').textContent=themes[theme].effects.length>1?'Un défi, à ton choix':'Ton défi légendaire';$('#chooseButton').textContent='Choisir mon défi ✧';document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));showEffect();schedule();});
  $('#chooseButton').addEventListener('click',pick);face.addEventListener('click',pick);$('#closeChoice').addEventListener('click',()=>dialog.close());
  face.addEventListener('pointermove',event=>{if(reduce.matches)return;rect||=face.getBoundingClientRect();const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{face.classList.add('touching');document.documentElement.style.setProperty('--rx',`${(y-.5)*-15}deg`);document.documentElement.style.setProperty('--ry',`${(x-.5)*20}deg`);document.documentElement.style.setProperty('--px',`${x*100}%`);document.documentElement.style.setProperty('--py',`${y*100}%`);});},{passive:true});
  function rest(){cancelAnimationFrame(frame);rect=null;face.classList.remove('touching');document.documentElement.style.setProperty('--rx','0deg');document.documentElement.style.setProperty('--ry','0deg');}
  for(const type of ['pointerleave','pointerup','pointercancel'])face.addEventListener(type,rest);
  reduce.addEventListener('change',()=>{rest();showEffect();schedule();});showEffect();schedule();
})();
