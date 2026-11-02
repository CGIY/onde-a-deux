(function(){
 'use strict';
 const root=document.getElementById('onde-app-v1');
 if(!root || !window.OndeGame || !window.OndeDice)return;
 const G=window.OndeGame, main=root.querySelector('#oa-main'), sheet=root.querySelector('#oa-sheet');
 const storageKey='onde-couple-prototype-v1';
 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let state=G.createState(), tab='play', busy=false, toastTimer, lastFocus=null, animationSerial=0;
 let persisted=false, canPersist=true, recovery=false, lastError='';
 let renderKey='';
 const gaugeFrames=new Map();
 let visibleCardId=null;
 try{
  const raw=localStorage.getItem(storageKey);
  if(raw){let saved=null;try{saved=G.normalizeState(JSON.parse(raw));}catch(_){}if(saved)state=saved;else{localStorage.setItem(storageKey+'-recovery',raw);recovery=true;}}
  localStorage.setItem(storageKey,JSON.stringify(state));persisted=true;
 }catch(_){canPersist=false;persisted=false;}
 const canvas=document.createElement('canvas');
 canvas.id='oa-dice';canvas.className='cursor-interaction';canvas.setAttribute('role','img');
 const die=window.OndeDice.create(canvas,{kind:6,value:3,duration:1650,maxPixelRatio:2,reducedMotion:!!systemReduce,onRelease:()=>{if(tab==='play'&&!busy)roll();}});
 const h=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=id=>(state.players.find(p=>p.id===id)||{}).name||'Partenaire';
 const now=()=>new Date().toISOString();
 const percent=hp=>(G.probability(hp)*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
 const card=()=>G.getCard(state.round.cardId);
 const category=()=>G.getCategory(state.round.categoryId);
 const shownRolls=()=>state.phase==='draft_challenge'||(state.round.status==='defended'&&!state.round.rolls.length)?state.round.draftRolls:state.round.rolls;
 const sum=()=>shownRolls().reduce((a,b)=>a+b,0);
 const canDraw=()=>state.activePlayer===state.round.from;
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 function save(){if(!canPersist)return;try{localStorage.setItem(storageKey,JSON.stringify(state));persisted=true;}catch(_){persisted=false;}}
 function announce(text){root.querySelector('#oa-announcement').textContent=text;}
 function dispatch(action,doRender=true){const next=G.reduce(state,{at:now(),...action});const changed=next!==state;state=next;if(changed)save();if(doRender)render();return changed;}
 function toast(text){clearTimeout(toastTimer);const el=root.querySelector('#oa-toast');el.textContent=text;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},3600);}
 function btn(label,action,style='',extra=''){return '<button type="button" class="oa-button cursor-interaction '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function textBtn(label,action,extra=''){return '<button type="button" class="oa-text-button cursor-interaction" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function eyebrow(text){return '<p class="oa-eyebrow">'+h(text)+'</p>';}
 function heading(title,sub,eyebrowText){return (eyebrowText?eyebrow(eyebrowText):'')+'<h1 class="oa-title">'+title+'</h1>'+(sub?'<p class="oa-subtitle">'+sub+'</p>':'');}
 function steps(active){return '<div class="oa-steps" aria-label="Parcours du jeu"><span class="oa-step '+(active===1?'is-active':active>1?'is-done':'')+'"><b>D6</b>Catégorie</span><span class="oa-step-sep" aria-hidden="true">›</span><span class="oa-step '+(active===2?'is-active':'')+'"><b>D4</b>Carte</span></div>'; }
 function stage(type,label,value){return '<section class="oa-dice-section" aria-label="Lancer le dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+'</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'"></div></section>';}
 function categoriesGrid(){return '<div class="oa-category-grid">'+G.categories.map(c=>'<div class="oa-category" style="--category:'+c.color+'"><div class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></div><span class="oa-category-label">'+h(c.label)+'</span></div>').join('')+'</div>';}
 function handGrid(){return '<div class="oa-card-grid" aria-label="Quatre cartes face cachée">'+state.round.hand.map((id,i)=>'<div class="oa-mini-card oa-card-back" aria-label="Carte '+(i+1)+' face cachée"><span class="oa-mini-number">'+(i+1)+'</span><span class="oa-back-symbol" aria-hidden="true">ON</span></div>').join('')+'</div>';}
 function healthGauge(owner){
  const r=state.round,rolls=owner==='from'?r.draftRolls:r.rolls,total=rolls.reduce((a,b)=>a+b,0),left=Math.max(0,r.hp-total),ratio=left/r.hp;
  const needed=r.hp-total,chance=rolls.length===0?G.probability(r.hp):rolls.length===1?Math.max(0,Math.min(20,21-needed))/20:0;
  const odds=left===0?'Carte écartée':rolls.length===2?'Deux jets terminés':(chance*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' % de chance '+(rolls.length?'au dernier jet':'sur deux jets');
  return '<section class="oa-hp" data-gauge="'+r.id+'-'+owner+'" data-ratio="'+ratio+'" aria-label="Résistance de la carte"><div class="oa-hp-top"><p>Résistance de la carte</p><strong>'+left+' <span>/ '+r.hp+' PV</span></strong></div><div class="oa-hp-track" role="progressbar" aria-label="Points de vie restants" aria-valuemin="0" aria-valuemax="'+r.hp+'" aria-valuenow="'+left+'">'+Array.from({length:12},(_,i)=>'<i aria-hidden="true"><span style="transform:scaleX('+Math.max(0,Math.min(1,ratio*12-i))+')"></span></i>').join('')+'</div><div class="oa-roll-history">'+[0,1].map(i=>'<span class="oa-roll-token">Jet '+(i+1)+' <b>'+(rolls[i]||'—')+'</b></span>').join('')+'</div><p class="oa-hp-odds">'+odds+'</p></section>';
 }
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function cardFact(c){
  const fact=window.OndeEvidence&&window.OndeEvidence.forCard(c);
  if(!fact||!fact.metric)return '';
  return '<section class="oa-card-fact"><strong>'+h(fact.metric)+'</strong><div><b>'+h(fact.headline)+'</b><p>'+h(fact.detail)+'</p><details class="oa-source"><summary>Source & contexte ↗</summary><p>'+h([fact.scope,fact.year].filter(Boolean).join(' · '))+'</p><p>'+h(fact.limitations)+'</p><a href="'+h(fact.url)+'" target="_blank" rel="noopener noreferrer">'+h(fact.sourceTitle)+' ↗</a></details></div></section>';
 }
 function playingCard(c,compact=false){const cat=G.getCategory(c.categoryId),r=state.round;const own=c.id===r.cardId;const adapted=own&&r.adapted;return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(cat.label)+(adapted?' · VARIANTE':'')+'</span>'+''+'</div>'+(!compact?'<div class="oa-card-illustration" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2>'+(adapted?'<p class="oa-card-description">'+h(r.proposal)+'</p>':'')+cardFact(c)+'</article>';}

 function switchButton(id,label){return btn(label||'Voir côté '+h(name(id)),'profile','oa-secondary','data-player="'+id+'"');}
 function responseActions(){const r=state.round;const defend=state.phase==='pending'&&r.status==='pending'&&!r.challengeUsed&&Number.isFinite(r.hp)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge','oa-secondary'):'';return '<div class="oa-actions">'+btn(r.status==='scheduled_proposal'?'Confirmer ce moment':r.status==='counterproposal'?'Accepter la variante':'J’accepte','accept')+defend+'<div class="oa-action-row">'+textBtn('Adapter','adapt')+textBtn('Plus tard','later')+textBtn('Passer','pass')+'</div></div>';}

 function renderPlay(){const r=state.round,c=card();
  if(state.phase==='category')return heading('Un peu de hasard.<br><em>Un moment à deux.</em>',null,currentDate())+steps(1)+stage(6,'01 / LE THÈME',3)+btn('Lancer le D6 <span class="oa-arrow">↗</span>','roll')+'<div class="oa-section-head"><h2>Six façons de se retrouver</h2><span>'+G.cards.length+' cartes</span></div>'+categoriesGrid();
  if(state.phase==='card'){
   if(!canDraw())return heading(h(name(r.from))+' prépare<br><em>une invitation.</em>',null,'UN TOUR EN COURS')+steps(2)+statusStrip(h(category().label))+'<div class="oa-actions">'+switchButton(r.from,'Revenir côté '+h(name(r.from)))+'</div>';
   return heading(h(category().label)+'.<br><em>Laquelle pour vous ?</em>',null,null)+steps(2)+stage(4,'02 / LA CARTE',1)+btn('Lancer le D4 <span class="oa-arrow">↗</span>','roll')+handGrid();
  }
  if(state.phase==='draft')return heading(canDraw()?'Ta prochaine<br><em>invitation.</em>':'Une carte<br><em>à proposer.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+(canDraw()?'<div class="oa-actions">'+btn('Proposer à '+h(name(r.to))+' <span class="oa-arrow">↗</span>','send')+(Number.isFinite(r.hp)?btn('Tenter de l’écarter · D20 · '+r.hp+' PV','challenge-draft','oa-secondary'):'')+'</div>':'<div class="oa-actions">'+switchButton(r.from)+'</div>');
  if(state.phase==='draft_challenge'&&!canDraw())return heading('Un défi<br><em>en cours.</em>',h(name(r.from))+' tente d’écarter la carte.',null)+switchButton(r.from);
  if(state.phase==='draft_challenge')return heading('Tenter de<br><em>l’écarter.</em>',h(c.title),null)+healthGauge('from')+stage(20,'03 / ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.draftRolls.length+1)+' sur 2','roll');
  if(state.phase==='pending'){
   const responds=G.canRespond(state),isCounter=r.status==='counterproposal',isLater=r.status==='scheduled_proposal';
   const automatic=r.autoProposed&&r.status==='pending';
   let title=responds?(isCounter?'Une autre<br><em>façon de jouer.</em>':isLater?'Un moment<br><em>à confirmer.</em>':'Une invitation<br><em>pour toi.</em>'):'L’invitation<br><em>est posée.</em>';
   let sub=responds?(isCounter?'Une variante a été proposée. À toi de choisir.':isLater?'Le créneau proposé : '+h(r.schedule):automatic?'Proposée par le D20.':h(name(r.from))+' te propose…'):'Réponse attendue : '+h(name(r.awaiting))+'.';
   return heading(title,sub,null)+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(automatic&&!responds?healthGauge('from'):'')+(r.schedule?statusStrip('Proposition : <strong>'+h(r.schedule)+'</strong>'):'')+(responds?responseActions():'<div class="oa-actions">'+switchButton(r.awaiting,'Répondre côté '+h(name(r.awaiting)))+textBtn('Retirer la proposition','pass')+'</div>');
  }
  if(state.phase==='sender_confirmation'){
   const responds=G.canRespond(state);
   return heading(responds?'L’envie<br><em>se rencontre ?</em>':'Une dernière<br><em>confirmation.</em>',responds?h(name(r.to))+' a accepté.':h(name(r.from))+' doit confirmer.','PROPOSITION ENVOYÉE')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(responds?'<div class="oa-actions">'+btn('Confirmer','accept')+'<div class="oa-action-row">'+textBtn('Adapter','adapt')+textBtn('Plus tard','later')+textBtn('Arrêter ce tour','pass')+'</div></div>':'<div class="oa-actions">'+switchButton(r.from,'Confirmer côté '+h(name(r.from)))+textBtn('Arrêter ce tour','pass')+'</div>');
  }
  if(state.phase==='challenge'&&!G.canRespond(state))return heading('Un défi<br><em>en cours.</em>',h(name(r.to))+' tente d’écarter la carte.',null)+switchButton(r.to);
  if(state.phase==='challenge')return heading('Tenter de<br><em>l’écarter.</em>',h(c.title),null)+healthGauge('to')+stage(20,'03 / ÉCARTER LA CARTE',sum()||3)+btn('Lancer le D20 · jet '+(r.rolls.length+1)+' sur 2','roll')+textBtn('Passer','pass');
  if(state.phase==='challenge_failed')return heading('La proposition<br><em>reste ouverte.</em>',h(c.title),null)+healthGauge('to')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(G.canRespond(state)?responseActions():'<div class="oa-actions">'+switchButton(r.to)+textBtn('Arrêter ce tour','pass')+'</div>');
  if(state.phase==='accepted')return heading('Un moment<br><em>pour vous.</em>',null,null)+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(r.schedule?statusStrip('<strong>'+h(r.schedule)+'</strong>'):'')+'<div class="oa-actions">'+btn('Marquer comme partagé','complete')+(state.prefs.reminder?textBtn('Aperçu du rappel','reminder'):'')+textBtn('Finalement, passer','pass')+'</div>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Carte écartée.':'Une autre<br><em>fois, peut-être.</em>',completed?'+1 point pour votre duo.':null,null)+(defended?healthGauge(r.rolls.length?'to':'from'):'')+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(G.getCategory(c.categoryId).label)+(r.adapted?' · Variante':'')+'</p></div>'+''+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
  }
  return '';
 }

 function setting(key,label,desc){return '<label class="oa-setting"><span>'+label+'<small>'+desc+'</small></span><input type="checkbox" class="cursor-interaction" data-pref="'+key+'" '+(state.prefs[key]?'checked':'')+' aria-label="'+h(label)+'"></label>';}
 function sharedScore(){
  const stats=state.stats,total=stats.totalCompleted;
  return '<section class="oa-shared-score" aria-label="Score commun"><p class="oa-eyebrow">VOTRE SCORE À DEUX</p><div class="oa-score-number"><strong>'+total.toLocaleString('fr-FR')+'</strong><span>point'+(total>1?'s':'')+'</span></div><p class="oa-score-caption">'+(total?'Des moments vécus, à votre rythme.':'Votre première carte partagée ouvre le score.')+'</p><div class="oa-score-rule"><span aria-hidden="true">✓</span> 1 carte partagée = 1 point</div></section><div class="oa-section-head"><h2>Vos cartes partagées</h2></div><div class="oa-score-grid">'+G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+stats.byCategory[c.id].toLocaleString('fr-FR')+'</strong></div>').join('')+'</div>';
 }
 function renderUs(){return heading('À notre<br><em>rythme.</em>',null,null)+sharedScore()+'<div class="oa-section-head"><h2>Le confort du jeu</h2></div>'+setting('sound','Son des dés','Un contact feutré à chaque lancer.')+setting('discreet','Aperçus discrets','Le contenu de la carte reste masqué.')+setting('reminder','Rappel du moment','Aperçu du rappel.')+'<p class="oa-note">Démo locale · '+(persisted?'partie conservée sur cet appareil.':'partie non sauvegardée.')+(recovery?' Ancienne sauvegarde conservée pour récupération.':'')+'</p><div class="oa-actions">'+textBtn('Revoir les règles','rules')+textBtn('Effacer la partie de démonstration','reset-confirm')+'</div>';}

 function render(){
  const focused=document.activeElement,focusData=focused&&main.contains(focused)?{...focused.dataset}:null;
  const previousKey=renderKey;
  const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);
  const key=[tab,state.phase,state.round.id,state.round.cardId,state.round.rolls.length,state.round.draftRolls.length,state.activePlayer].join('|');
  const animate=key!==renderKey;renderKey=key;
  root.style.setProperty('--oa-accent',(category()||G.categories[1]).color);
  main.innerHTML=tab==='play'?renderPlay():renderUs();
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!(['pending','sender_confirmation'].includes(state.phase)&&state.round.awaiting===el.dataset.player&&state.activePlayer!==el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const holder=main.querySelector('[data-stage]');
  if(holder){holder.prepend(canvas);die.setKind(Number(holder.dataset.kind),Number(holder.dataset.value));die.setReducedMotion(systemReduce);}
  root.classList.toggle('is-busy',busy);
  animateGauge();
  if(animate&&!systemReduce&&main.animate){
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-subtitle,:scope > .oa-steps,:scope > .oa-card-stage,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score');
   blocks.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,delay:Math.min(i*28,100),easing:'cubic-bezier(.18,.8,.2,1)',fill:'backwards'}));
   main.querySelectorAll('.oa-category,.oa-mini-card').forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px) rotate(-2deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:440,delay:90+i*30,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
   const revealed=main.querySelector('.oa-card-stage .oa-playing-card');
   if(revealed&&visibleCardId!==state.round.cardId)revealed.animate([{transform:'perspective(850px) translateY(24px) rotateX(10deg) rotateZ(-3deg) scale(.94)'},{transform:'perspective(850px) translateY(-3px) rotateX(-1deg) rotateZ(.6deg) scale(1.006)',offset:.7},{transform:'perspective(850px) translateY(0) rotateX(0) rotateZ(0) scale(1)'}],{duration:480,easing:'cubic-bezier(.18,.76,.2,1)'});
  }
  visibleCardId=state.round.cardId;
  if(focusData&&previousKey===renderKey){const controls=Array.from(main.querySelectorAll('button,input'));const same=controls.find(el=>['action','pref','card','tab'].every(k=>(el.dataset[k]||'')===(focusData[k]||'')));if(same)same.focus({preventScroll:true});}
  else if(previousKey&&previousKey!==renderKey){const title=main.querySelector('h1');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
 }
 function animateGauge(){
  const gauge=main.querySelector('[data-gauge]');if(!gauge)return;
  const key=gauge.dataset.gauge,ratio=Number(gauge.dataset.ratio),previous=gaugeFrames.has(key)?gaugeFrames.get(key):ratio;
  gaugeFrames.set(key,ratio);
  if(systemReduce||!gauge.animate||previous===ratio)return;
  gauge.querySelectorAll('.oa-hp-track i span').forEach((fill,i)=>fill.animate([{transform:'scaleX('+Math.max(0,Math.min(1,previous*12-i))+')'},{transform:'scaleX('+Math.max(0,Math.min(1,ratio*12-i))+')'}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'}));
  gauge.querySelector('.oa-hp-top strong').animate([{transform:'translateY(-3px)',opacity:.55},{transform:'translateY(0)',opacity:1}],{duration:280,easing:'ease-out'});
 }
 function celebrate(){
  if(systemReduce||!main.animate)return;
  const badge=main.querySelector('.oa-summary-glyph');
  if(badge)badge.animate([{transform:'scale(.7) rotate(-12deg)'},{transform:'scale(1.15) rotate(7deg)',offset:.55},{transform:'scale(1) rotate(0)'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
  const layer=document.createElement('div');layer.className='oa-celebration';layer.setAttribute('aria-hidden','true');root.querySelector('.oa-shell').append(layer);
  for(let i=0;i<12;i++){const dot=document.createElement('i');dot.style.background=G.categories[i%G.categories.length].color;layer.append(dot);const angle=(i/12)*Math.PI*2;dot.animate([{transform:'translate(0,0) scale(.2)',opacity:0},{opacity:1,offset:.12},{transform:'translate('+Math.cos(angle)*(65+i*4)+'px,'+(Math.sin(angle)*75-30)+'px) rotate('+(i*51)+'deg) scale(.85)',opacity:0}],{duration:900+i*20,easing:'cubic-bezier(.1,.6,.2,1)',fill:'forwards'});}
  setTimeout(()=>layer.remove(),1300);
 }
 let audioContext;
 function softSound(){if(!state.prefs.sound)return;try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();[0,.44,.83].forEach((delay,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(155-i*18,t);osc.frequency.exponentialRampToValueAtTime(48,t+.1);gain.gain.setValueAtTime(.055/(i+1),t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.14);});}catch(_){}}
 async function roll(){
  if(busy||tab!=='play')return;
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  let sides,action,faceValue;
  if(phase==='category'&&canDraw()){
   sides=6;faceValue=G.randomInt(6);
   action={type:'ROLL_CATEGORY',value:faceValue,hand:G.drawHand(state,faceValue)};
  }
  else if(phase==='card'&&canDraw()){sides=4;faceValue=G.randomInt(4);action={type:'ROLL_CARD',value:faceValue};}
  else if(phase==='draft_challenge'&&G.canRollDraftDefense(state)){sides=20;faceValue=G.randomInt(20);action={type:'ROLL_DRAFT_DEFENSE',value:faceValue,token:roundId+'-draft-'+(state.round.draftRolls.length+1)};}
  else if(phase==='challenge'&&G.canRespond(state)){sides=20;faceValue=G.randomInt(20);action={type:'ROLL_DEFENSE',value:faceValue,token:roundId+'-'+(state.round.rolls.length+1)};}
  else return;
  const serial=++animationSerial;
  const next=G.reduce(state,{...action,actor,roundId,at:now()});if(next===state)return;
  busy=true;root.classList.add('is-busy');
  root.querySelectorAll('[data-action="roll"],[data-action="profile"],[data-action="tab"],[data-action="rules"],[data-action="accept"]').forEach(el=>{el.disabled=true;});
  const button=main.querySelector('[data-action="roll"]');if(button)button.textContent='Le dé roule…';if(button)button.setAttribute('aria-busy','true');
  state=next;save();softSound();
  try{await die.roll(faceValue,{duration:systemReduce?0:1650});}catch(error){lastError=String(error);}
  if(serial!==animationSerial)return;
  busy=false;
  root.querySelectorAll('[data-action="profile"],[data-action="tab"],[data-action="rules"],[data-action="accept"]').forEach(el=>{el.disabled=false;});
  root.classList.remove('is-busy');render();
  announce('D'+sides+' : '+faceValue+'. '+(sides===6?'Catégorie '+category().label:sides===4?card().title:'Lancer terminé.'));
 }
 function openSheet(title,body,extraClass=''){lastFocus=document.activeElement;sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div>'+body+'</section>';sheet.hidden=false;document.body.style.overflow='hidden';const shell=root.querySelector('.oa-shell');Array.from(shell.children).forEach(el=>{if(el!==sheet&&el.id!=='oa-announcement')el.inert=true;});const top=sheet.querySelector('button');top&&top.focus();}
 function closeSheet(){sheet.hidden=true;document.body.style.overflow='';sheet.innerHTML='';Array.from(root.querySelector('.oa-shell').children).forEach(el=>el.inert=false);if(lastFocus&&lastFocus.isConnected)lastFocus.focus();lastFocus=null;}

 function rules(){openSheet('Les règles.','<div class="oa-rule"><b>D6</b><div><h3>La catégorie.</h3><p>Six catégories · une chance sur six chacune.</p></div></div><div class="oa-rule"><b>D4</b><div><h3>La carte.</h3><p>Quatre cartes cachées · une chance sur quatre. Les derniers tirages sont évités.</p></div></div><div class="oa-rule"><b>D20</b><div><h3>Écarter la carte.</h3><p>Deux jets par personne. Leur somme retire les PV. À zéro, la carte est écartée. Après deux jets insuffisants de la personne qui tire, elle est proposée à l’autre.</p></div></div><div class="oa-odds-table"><span>PV</span><span>Chance sur 2 jets</span>'+[10,15,20,25,30,35].map(pv=>'<b>'+pv+'</b><span>'+percent(pv)+'</span>').join('')+'</div><div class="oa-rule"><b>∞</b><div><h3>Pas de quota quotidien.</h3><p>Une manche à la fois. Les rôles alternent à chaque tour.</p></div></div><div class="oa-rule"><b>+1</b><div><h3>Une carte partagée, un point.</h3><p>Le score est commun. Les cartes passées ou écartées ne comptent pas.</p></div></div><div class="oa-actions">'+btn('Fermer','close')+'</div>');}

 function showAdapt(){const c=card();openSheet('Proposer une variante','<label class="oa-field">Ta variante<textarea id="oa-adapt-text" aria-label="Ta variante" maxlength="300">'+h(state.round.adapted?state.round.proposal:c.variant)+'</textarea></label><div class="oa-actions">'+btn('Envoyer la variante','confirm-adapt')+'</div>');}
 function showLater(){openSheet('Trouver le bon moment','<label class="oa-field">Quand ?<select id="oa-schedule"><option>Ce soir, quand nous sommes disponibles</option><option>Demain</option><option>Ce week-end</option><option>À convenir ensemble</option></select></label><div class="oa-actions">'+btn('Proposer ce moment','confirm-later')+'</div>');}

 root.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||!root.contains(el))return;event.preventDefault();const action=el.dataset.action;
  if(busy&&action!=='pass'&&action!=='close')return;
  if(action==='roll'){roll();return;}
  if(action==='tab'){tab=el.dataset.tab==='us'?'us':'play';render();return;}
  if(action==='profile'){tab='play';dispatch({type:'SWITCH_PLAYER',player:el.dataset.player});announce('Profil : '+name(state.activePlayer));return;}
  if(action==='send'){dispatch({type:'SEND'});toast('Proposée à '+name(state.round.to));return;}
  if(action==='challenge-draft'){dispatch({type:'CHALLENGE_DRAFT'});return;}
  if(action==='challenge'){dispatch({type:'CHALLENGE'});return;}
  if(action==='accept'){dispatch({type:'ACCEPT'});announce(state.phase==='accepted'?'Proposition acceptée à deux.':'Accord reçu. Confirmation de '+name(state.round.awaiting)+' attendue.');return;}
  if(action==='pass'){
   if(busy){animationSerial++;busy=false;die.setKind(die.kind,die.value);root.querySelectorAll('button:disabled').forEach(b=>{b.disabled=false;});}
   dispatch({type:'PASS'});announce('Carte passée.');return;
  }
  if(action==='adapt'){showAdapt();return;}
  if(action==='confirm-adapt'){const field=root.querySelector('#oa-adapt-text');if(!field.value.trim()){field.focus();return;}const text=field.value.trim();closeSheet();dispatch({type:'ADAPT',text});return;}
  if(action==='later'){showLater();return;}
  if(action==='confirm-later'){const schedule=root.querySelector('#oa-schedule').value;closeSheet();dispatch({type:'LATER',schedule});return;}
  if(action==='complete'){if(dispatch({type:'COMPLETE'})){announce('Moment partagé. Un point ajouté au score de votre duo.');toast('+1 point pour votre duo.');celebrate();}return;}
  if(action==='new'){gaugeFrames.clear();tab='play';dispatch({type:'NEW_ROUND'});return;}
  if(action==='rules'){rules();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reminder'){openSheet('Aperçu du rappel','<div class="oa-notification"><span class="oa-notification-logo">ON</span><div><small>ONDE · RAPPEL</small><p>'+h(state.prefs.discreet?'Votre moment à deux vous attend.':card().title)+'</p></div></div><p>Ceci est un aperçu dans la démo. Aucun rappel système n’est programmé.</p><div class="oa-actions">'+btn('Fermer l’aperçu','close')+'</div>');return;}
  if(action==='reset-confirm'){openSheet('Repartir de zéro ?','<p>La partie, le score commun, les favoris et les préférences de cette démonstration seront effacés.</p><div class="oa-actions">'+btn('Effacer la démo','reset','oa-clay')+textBtn('Conserver ma partie','close')+'</div>');return;}
  if(action==='reset'){closeSheet();tab='play';gaugeFrames.clear();dispatch({type:'RESET'});toast('La démonstration repart de zéro.');return;}
 });
 if(motionQuery&&motionQuery.addEventListener)motionQuery.addEventListener('change',event=>{systemReduce=event.matches;die.setReducedMotion(systemReduce);root.getAnimations({subtree:true}).forEach(a=>a.cancel());});
 root.addEventListener('change',event=>{const el=event.target;if(el.dataset.pref){dispatch({type:'SET_PREFS',patch:{[el.dataset.pref]:el.checked}});die.setReducedMotion(!!systemReduce);if(el.dataset.pref==='sound'&&el.checked)softSound();}});
 sheet.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
 root.addEventListener('keydown',event=>{if(sheet.hidden)return;if(event.key==='Escape'){closeSheet();return;}if(event.key==='Tab'){const focusable=Array.from(sheet.querySelectorAll('button,a,input,select,textarea,summary')).filter(x=>!x.disabled);const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 render();
 root.dataset.ready='true';
})();
