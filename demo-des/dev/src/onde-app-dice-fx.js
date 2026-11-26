/* Fine orbital filaments and dust: decorative, independent of dice results. */
(function(scope){
 'use strict';
 const filaments=[
  'M2 28C18 4 45 4 77 14','M2 19C24 30 42 1 78 9',
  'M4 31C12 12 49 0 76 19','M2 12C28 1 43 33 78 22',
  'M3 25C24 4 56 31 77 6','M3 8C22 28 54 0 78 17',
  'M2 24C36 30 41 2 78 10','M4 29C23 1 61 2 76 25'
 ];
 let previous=-1;
 function roll(canvas,launch,{reducedMotion=false}={}){
  const host=canvas.parentElement,query=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
  if(reducedMotion||query?.matches||scope.document.hidden||!host||!canvas.animate)return launch();
  // Fixed dust count and palette, chosen before launch: nothing encodes a face.
  const variant=(previous+1+Math.floor(Math.random()*7))%8;previous=variant;
  const layer=scope.document.createElement('span'),animations=[];
  layer.className='oa-dice-fx';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'-1'});
  host.append(layer);
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;animations.forEach(a=>a.cancel());layer.remove();scope.document.removeEventListener('visibilitychange',hide);scope.removeEventListener('pagehide',cleanup);query?.removeEventListener?.('change',cleanup);};
  const hide=()=>{if(scope.document.hidden)cleanup();};
  scope.document.addEventListener('visibilitychange',hide);scope.addEventListener('pagehide',cleanup);query?.addEventListener?.('change',cleanup);
  try{
   for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,side=i%2?-1:1,particle=scope.document.createElement('i');
    const dust=i>=4;
    const x=Math.cos(angle)*(dust?131:111),y=Math.sin(angle)*(dust?100:94);
    Object.assign(particle.style,{position:'absolute',left:'50%',top:'50%',width:dust?'2px':'80px',height:dust?'2px':'36px',color:['#c7e3ef','#d3c6e9','#e9dfcd'][i%3],transformOrigin:'center',borderRadius:'50%',background:dust?'currentColor':'none'});
    if(!dust)particle.innerHTML='<svg viewBox="0 0 80 36" width="80" height="36" fill="none" aria-hidden="true"><path d="'+filaments[(variant+i)%8]+'" stroke="currentColor" stroke-width=".55" stroke-linecap="round"/><path d="'+filaments[(variant+i+3)%8]+'" stroke="currentColor" stroke-width=".35" opacity=".35"/></svg>';
    layer.append(particle);
    const from='translate('+x+'px,'+(y+12)+'px) scale(.8) rotate('+(-side*12)+'deg)';
    const middle='translate('+(x+side*9)+'px,'+(y-3)+'px) scale(1) rotate('+(side*4)+'deg)';
    const end='translate('+(x+side*24)+'px,'+(y-25)+'px) scale(1.08) rotate('+(side*18)+'deg)';
    animations.push(particle.animate([{opacity:0,transform:from},{opacity:dust?.65:.44,transform:middle,offset:.4},{opacity:0,transform:end}],{duration:dust?820:1040,delay:(i%4)*110,easing:'cubic-bezier(.22,.65,.35,1)',fill:'both'}));
   }
   return Promise.resolve(launch()).finally(cleanup);
  }catch(error){cleanup();throw error;}
 }
 scope.OndeDiceFX=Object.freeze({roll});
})(window);
