/* Brief cartoon doodles around the die. Presentation never changes a roll. */
(function(scope){
 'use strict';
 const shapes=['✦','✧','♡','!','?','≈','✺','·'];
 let previous=-1;
 function roll(canvas,launch,{reducedMotion=false}={}){
  const host=canvas.parentElement,query=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
  if(reducedMotion||query?.matches||scope.document.hidden||!host||!canvas.animate)return launch();
  // Cycle through different little mishaps: dizzy stars, sweat, spring, pop,
  // hearts, comic surprise, zigzags and a tiny confetti shower.
  const variant=(previous+1+Math.floor(Math.random()*7))%8;previous=variant;
  const layer=scope.document.createElement('span'),animations=[];
  layer.className='oa-dice-fx';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'3'});
  host.append(layer);
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;animations.forEach(a=>a.cancel());layer.remove();scope.document.removeEventListener('visibilitychange',hide);scope.removeEventListener('pagehide',cleanup);query?.removeEventListener?.('change',cleanup);};
  const hide=()=>{if(scope.document.hidden)cleanup();};
  scope.document.addEventListener('visibilitychange',hide);scope.addEventListener('pagehide',cleanup);query?.addEventListener?.('change',cleanup);
  try{
   for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,side=i%2?-1:1,particle=scope.document.createElement('i');
    const glyph=variant===0?'✦':variant===1?'·':variant===2?'≈':variant===3?'✺':variant===4?'♡':variant===5?(i%2?'!':'?'):variant===6?'ϟ':shapes[i%shapes.length];
    particle.textContent=glyph;
    const x=Math.cos(angle)*(105+i%3*9),y=Math.sin(angle)*90;
    Object.assign(particle.style,{position:'absolute',left:'50%',top:'48%',font:'600 '+(variant===1?30:15+i%3*3)+'px system-ui',fontStyle:'normal',lineHeight:'1',color:['#dfc8a9','#b9d9e6','#d7b8e4','#f0bbbd'][i%4],textShadow:'0 1px 3px #10152666'});
    layer.append(particle);
    const orbit=variant===0||variant===4,scatter=variant===7;
    const from='translate('+x+'px,'+(y+12)+'px) scale(.2) rotate('+(-side*25)+'deg)';
    const middle='translate('+(x+(orbit?side*18:side*6))+'px,'+(y-18)+'px) scale(1.15) rotate('+(side*12)+'deg)';
    const end='translate('+(scatter?x*1.6:x+side*24)+'px,'+(scatter?y+85:y-36)+'px) scale(.55) rotate('+(side*65)+'deg)';
    animations.push(particle.animate([{opacity:0,transform:from},{opacity:.95,transform:middle,offset:.35},{opacity:0,transform:end}],{duration:variant===2?680:860,delay:(i%4)*170+80,easing:'cubic-bezier(.22,.8,.3,1)',fill:'both'}));
   }
   return Promise.resolve(launch()).finally(cleanup);
  }catch(error){cleanup();throw error;}
 }
 scope.OndeDiceFX=Object.freeze({roll});
})(window);
