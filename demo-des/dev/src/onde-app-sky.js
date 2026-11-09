(function(){
 'use strict';
 const sky=document.querySelector('#onde-app-v1 .oa-sky');
 if(!sky)return;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const colors=['177 207 237','201 181 220','211 199 187'];
 const random=(min,max)=>min+Math.random()*(max-min);
 let timer=null,aster=null,away=false;
 const isVisible=()=>!away&&!document.hidden;

 function schedule(first=false){
  timer=setTimeout(pass,first?random(16000,30000):random(46000,105000));
 }

 function pass(){
  timer=null;
  if(motion.matches||!isVisible())return;
  const angle=random(0,Math.PI*2), distance=sky.clientWidth*random(.23,.45);
  const dx=Math.cos(angle)*distance, dy=Math.sin(angle)*distance;
  aster=document.createElement('span');
  aster.className='oa-distant-aster';
  aster.style.left=`calc(${random(5,95)}% - ${dx/2}px)`;
  aster.style.top=`calc(${random(9,92)}% - ${dy/2}px)`;
  aster.style.setProperty('--oa-aster-x',`${dx}px`);
  aster.style.setProperty('--oa-aster-y',`${dy}px`);
  aster.style.setProperty('--oa-aster-angle',`${angle}rad`);
  aster.style.setProperty('--oa-aster-tail',`${random(21,46)}px`);
  aster.style.setProperty('--oa-aster-time',`${random(1050,1900)}ms`);
  aster.style.setProperty('--oa-aster-color',colors[Math.floor(random(0,colors.length))]);
  aster.addEventListener('animationend',()=>{aster?.remove();aster=null;},{once:true});
  sky.append(aster);
  schedule();
 }

 function sync(){
  sky.classList.toggle('is-drifting',!motion.matches);
  sky.classList.toggle('is-suspended',!isVisible());
  if(isVisible()&&!motion.matches){
   if(timer===null)schedule(true);
   return;
  }
  clearTimeout(timer);
  timer=null;
  aster?.remove();
  aster=null;
 }

 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{away=true;sync();});
 window.addEventListener('pageshow',()=>{away=false;sync();});
 if(motion.addEventListener)motion.addEventListener('change',sync);
 else motion.addListener(sync);
 sync();
})();
