(function(){
 'use strict';
 const root=document.getElementById('onde-app-v1');
 if(!root || !window.OndeGame || !window.OndeDice)return;
 const G=window.OndeGame, main=root.querySelector('#oa-main'), sheet=root.querySelector('#oa-sheet');
 const storageKey='onde-couple-prototype-v1';
 const motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 let systemReduce=!!(motionQuery&&motionQuery.matches);
 let state=G.createState(), tab='play', catalog='detente', favoritesOnly=false, busy=false, toastTimer, lastFocus=null, animationSerial=0;
 let persisted=false, lastError='';
 let feedbackNote='', feedbackContext='', renderKey='';
 const deckPositions=Object.create(null);
 let deckFrame=0;
 try{const raw=localStorage.getItem(storageKey);if(raw){const saved=G.normalizeState(JSON.parse(raw));if(saved)state=saved;}localStorage.setItem(storageKey,JSON.stringify(state));persisted=true;}catch(_){persisted=false;}
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
 const remaining=()=>Math.max(0,(state.round.hp||0)-sum());
 const canDraw=()=>state.activePlayer===state.round.from;
 const currentDate=()=>new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));persisted=true;}catch(_){persisted=false;}}
 function announce(text){root.querySelector('#oa-announcement').textContent=text;}
 function dispatch(action,doRender=true){const next=G.reduce(state,{at:now(),...action});const changed=next!==state;state=next;if(changed)save();if(doRender)render();return changed;}
 function toast(text){clearTimeout(toastTimer);const el=root.querySelector('#oa-toast');el.textContent=text;el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},3600);}
 function btn(label,action,style='',extra=''){return '<button type="button" class="oa-button cursor-interaction '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function textBtn(label,action,extra=''){return '<button type="button" class="oa-text-button cursor-interaction" data-action="'+action+'" '+extra+'>'+label+'</button>';}
 function eyebrow(text){return '<p class="oa-eyebrow">'+h(text)+'</p>';}
 function heading(title,sub,eyebrowText){return (eyebrowText?eyebrow(eyebrowText):'')+'<h1 class="oa-title">'+title+'</h1>'+(sub?'<p class="oa-subtitle">'+sub+'</p>':'');}
 function steps(active){return '<div class="oa-steps" aria-label="Parcours du jeu"><span class="oa-step '+(active===1?'is-active':active>1?'is-done':'')+'"><b>D6</b>Catégorie</span><span class="oa-step-sep" aria-hidden="true">›</span><span class="oa-step '+(active===2?'is-active':active>2?'is-done':'')+'"><b>D4</b>Carte</span><span class="oa-step-sep" aria-hidden="true">›</span><span class="oa-step '+(active===3?'is-active':'')+'"><b>D20</b>Défi</span></div>';}
 function stage(type,label,value){return '<section class="oa-dice-section" aria-label="Lancer le dé D'+type+'"><div class="oa-die-caption"><span>'+h(label)+'</span><span>D'+type+' · RUBBER</span></div><div class="oa-stage" data-stage data-kind="'+type+'" data-value="'+value+'"><div class="oa-gesture">Appuyer · relâcher</div></div></section>';}
 function categoriesGrid(interactive=false){return '<div class="oa-category-grid">'+G.categories.map(c=>'<'+(interactive?'button type="button" data-action="catalog" data-category="'+c.id+'" aria-pressed="'+(catalog===c.id&&!favoritesOnly)+'"':'div')+' class="oa-category '+(interactive?'cursor-interaction':'')+'" style="--category:'+c.color+'"><div class="oa-category-top"><span class="oa-category-swatch"></span><span class="oa-category-number">0'+c.number+'</span></div><span class="oa-category-label">'+h(c.label)+'</span></'+(interactive?'button':'div')+'>').join('')+'</div>';}
 function handGrid(){return '<div class="oa-card-grid">'+state.round.hand.map((id,i)=>{const c=G.getCard(id);return '<div class="oa-mini-card '+(state.round.cardRoll===i+1?'is-picked':'')+'"><span class="oa-mini-number">'+(i+1)+'</span><h3>'+h(c.title)+'</h3><p>'+c.duration+' min · '+c.hp+' PV</p></div>';}).join('')+'</div>';}
 function statusStrip(text,amber=false){return '<div class="oa-status-strip '+(amber?'oa-amber':'')+'"><span class="oa-status-dot"></span><span>'+text+'</span></div>';}
 function favoriteButton(c){const selected=state.favorites.includes(c.id);return '<button type="button" class="oa-favorite cursor-interaction" data-action="favorite" data-card="'+c.id+'" aria-pressed="'+selected+'" aria-label="'+(selected?'Retirer des favoris':'Ajouter aux favoris')+'">'+(selected?'♥':'♡')+'</button>';}

 function source(c){
  const fact=window.OndeEvidence&&window.OndeEvidence.forCard(c);
  if(!fact)return '';
  const scope=[fact.scope,fact.year].filter(Boolean).join(' · ');
  return '<section class="oa-evidence" aria-label="Un repère sur cette carte"><p class="oa-eyebrow">UN REPÈRE SUR CE THÈME</p>'+(fact.metric?'<strong class="oa-evidence-number">'+h(fact.metric)+'</strong>':'')+'<h3>'+h(fact.headline)+'</h3><p>'+h(fact.detail)+'</p>'+(scope?'<p class="oa-evidence-scope">'+h(scope)+'</p>':'')+(fact.url?'<details class="oa-source"><summary>Source & contexte de l’étude</summary><p>'+h(fact.limitations)+'</p><a href="'+h(fact.url)+'" target="_blank" rel="noopener noreferrer">'+h(fact.sourceTitle)+' ↗</a></details>':'')+'</section>';
 }
 function playingCard(c,compact=false){const cat=G.getCategory(c.categoryId),r=state.round;const own=c.id===r.cardId;const adapted=own&&r.adapted;return '<article class="oa-playing-card" style="--category:'+cat.color+'"><div class="oa-card-top"><span class="oa-card-category">'+h(cat.label)+' · '+(adapted?'VARIANTE':'À PARTAGER')+'</span>'+favoriteButton(c)+'</div>'+(!compact?'<div class="oa-card-illustration" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<h2 class="oa-card-title">'+h(c.title)+'</h2><p class="oa-card-description">'+h(adapted?r.proposal:c.description)+'</p><div class="oa-card-meta"><span>'+(adapted&&r.proposal!==c.variant?'Durée à convenir':'<b>'+(adapted?c.variantDuration:c.duration)+' min</b> à deux')+'</span><span><b>'+c.hp+' PV</b> de résistance</span></div><div class="oa-card-foot"><span>'+(c.source?'STCK · '+h(c.source.collectionTitle):'ONDE / '+h(c.id.toUpperCase()))+'</span><span>le temps de nous.</span></div></article>';}
 function hpTrack(){const hp=state.round.hp,rem=remaining(),fraction=rem/hp;let mark='',used=0;const weights=[2.3,1,1,1.65,2.3,1,1.65,1,2.3,1.65],weightTotal=weights.reduce((a,b)=>a+b,0);for(let i=0;i<10;i++){const fill=Math.max(0,Math.min(1,(fraction*weightTotal-used)/weights[i]));used+=weights[i];mark+='<i><span style="transform:scaleX('+fill+');'+(rem===0?'background:#a8c08c':'')+'"></span></i>';}
 return '<div class="oa-hp"><div class="oa-hp-top"><p>Résistance de la carte</p><strong>'+rem+' <span>/ '+hp+' PV</span></strong></div><div class="oa-hp-track" role="progressbar" aria-label="Points de vie restants" aria-valuemin="0" aria-valuemax="'+hp+'" aria-valuenow="'+rem+'">'+mark+'</div><div class="oa-roll-history"><span class="oa-roll-token">JET 1 <b>'+(shownRolls()[0]||'—')+'</b></span><span class="oa-roll-token">JET 2 <b>'+(shownRolls()[1]||'—')+'</b></span></div></div>';}
 function switchButton(id,label){return btn(label||'Voir côté '+h(name(id)),'profile','oa-secondary','data-player="'+id+'"');}
 function responseActions(){const r=state.round;return '<div class="oa-actions">'+btn(r.status==='scheduled_proposal'?'Confirmer ce moment':r.status==='counterproposal'?'Accepter la variante':'J’accepte','accept')+((!r.challengeUsed&&r.status==='pending')?btn('Défier la carte <span class="oa-arrow">D20</span>','challenge','oa-secondary'):'')+'<div class="oa-action-row">'+textBtn('Adapter','adapt')+textBtn('Plus tard','later')+textBtn('Passer','pass')+'</div></div>';}

 function renderPlay(){const r=state.round,c=card();
  if(state.phase==='category')return heading('Un peu de hasard.<br><em>Un moment à deux.</em>','Lance le dé. Une catégorie, puis une carte à proposer.',currentDate())+steps(1)+stage(6,'01 / LE THÈME',3)+btn('Lancer le D6 <span class="oa-arrow">↗</span>','roll')+'<div class="oa-section-head"><h2>Six façons de se retrouver</h2><span>'+G.cards.length+' cartes</span></div>'+categoriesGrid();
  if(state.phase==='card'){
   if(!canDraw())return heading(h(name(r.from))+' prépare<br><em>une invitation.</em>','La catégorie a été tirée. La prochaine étape est la carte.','UN TOUR EN COURS')+steps(2)+statusStrip(h(category().label))+'<div class="oa-actions">'+switchButton(r.from,'Revenir côté '+h(name(r.from)))+'</div>';
   return heading(h(category().label)+'.<br><em>Laquelle pour vous ?</em>',h(category().description),'LE D6 A DONNÉ '+r.categoryRoll)+steps(2)+stage(4,'02 / LA CARTE',1)+btn('Lancer le D4 <span class="oa-arrow">↗</span>','roll')+handGrid();
  }
  if(state.phase==='draft')return heading(canDraw()?'Ta prochaine<br><em>invitation.</em>':h(name(r.from))+' a tiré<br><em>une carte.</em>',canDraw()?'Propose-la directement. Si tu préfères l’écarter, tente le D20 : deux jets insuffisants la proposeront automatiquement à '+h(name(r.to))+'.':'Elle attend encore d’être proposée.','D6 · '+r.categoryRoll+'  /  D4 · '+r.cardRoll)+'<div class="oa-card-stage">'+playingCard(c)+'</div>'+(canDraw()?'<div class="oa-actions">'+btn('Proposer à '+h(name(r.to))+' <span class="oa-arrow">↗</span>','send')+btn('Tenter de l’écarter <span class="oa-arrow">D20</span>','challenge-draft','oa-secondary')+'</div>':'<div class="oa-actions">'+switchButton(r.from)+'</div>')+textBtn('Le repère & les détails de cette carte','card-detail','data-card="'+c.id+'"');
  if(state.phase==='draft_challenge'){
   if(!canDraw())return heading(h(name(r.from))+' tente<br><em>le hasard.</em>','Si ses deux jets échouent, la carte te sera proposée automatiquement.','AVANT LA PROPOSITION')+hpTrack()+'<div class="oa-actions">'+switchButton(r.from)+'</div>';
   return heading(r.draftRolls.length?'Encore<br><em>'+remaining()+' points.</em>':'Tu la joues<br><em>au hasard.</em>',h(c.title)+' · atteindre '+r.hp+' PV pour l’écarter.','TON D20 / JET '+(r.draftRolls.length+1)+' SUR 2')+hpTrack()+stage(20,r.draftRolls.length?'LE SECOND LANCER':'LE PREMIER LANCER',r.draftRolls[0]||12)+btn(r.draftRolls.length?'Lancer le dernier D20':'Lancer le premier D20','roll','oa-clay')+'<p class="oa-note oa-center">Si les deux jets échouent, la carte est proposée automatiquement à '+h(name(r.to))+'.</p>';
  }
  if(state.phase==='pending'){
   const responds=G.canRespond(state),isCounter=r.status==='counterproposal',isLater=r.status==='scheduled_proposal';
   const automatic=r.autoProposed&&r.status==='pending';
   let title=responds?(isCounter?'Une autre<br><em>façon de jouer.</em>':isLater?'Un moment<br><em>à confirmer.</em>':'Une invitation<br><em>pour toi.</em>'):'L’invitation<br><em>est posée.</em>';
   let sub=responds?(isCounter?'Une variante a été proposée. À toi de choisir.':isLater?'Le créneau proposé : '+h(r.schedule):automatic?'Le D20 a proposé cette carte. À toi de choisir.':h(name(r.from))+' te propose un moment à deux.'):'Réponse attendue : '+h(name(r.awaiting))+'.';
   return (responds?'<div class="oa-notification"><span class="oa-notification-logo">ON</span><div><small>ONDE · MAINTENANT</small><p>'+h(state.prefs.discreet?'Une invitation t’attend.':c.title)+'</p></div></div>':'')+heading(title,sub,responds?'À TOI DE RÉPONDRE':'TOUR '+state.sequence)+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+(automatic?statusStrip('Proposée par le dé · vos deux accords restent à confirmer.',true):'')+(r.schedule?statusStrip('Proposition : <strong>'+h(r.schedule)+'</strong>'):'')+(responds?responseActions():'<div class="oa-actions">'+switchButton(r.awaiting,'Répondre côté '+h(name(r.awaiting)))+textBtn('Retirer la proposition','pass')+'</div>')+textBtn('Le repère & les détails de cette carte','card-detail','data-card="'+c.id+'"');
  }
  if(state.phase==='sender_confirmation'){
   const responds=G.canRespond(state);
   return heading(responds?'L’envie<br><em>se rencontre ?</em>':'Une dernière<br><em>confirmation.</em>',responds?h(name(r.to))+' a accepté. Comme la carte a été proposée par le dé, confirme aussi ton envie.':'Ton accord est enregistré. '+h(name(r.from))+' doit encore confirmer le sien.','PROPOSITION DU D20')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+statusStrip('Accord de '+h(name(r.to))+' reçu · accord de '+h(name(r.from))+' attendu.')+(responds?'<div class="oa-actions">'+btn('Oui, j’en ai envie aussi','accept')+'<div class="oa-action-row">'+textBtn('Adapter','adapt')+textBtn('Plus tard','later')+textBtn('Arrêter ce tour','pass')+'</div></div>':'<div class="oa-actions">'+switchButton(r.from,'Confirmer côté '+h(name(r.from)))+textBtn('Arrêter ce tour','pass')+'</div>');
  }
  if(state.phase==='challenge'){
   if(!G.canRespond(state))return heading(h(name(r.to))+' tente<br><em>le hasard.</em>','Deux lancers au maximum pour écarter la carte.','DÉFI D20')+hpTrack()+'<div class="oa-actions">'+switchButton(r.to,'Voir le défi de '+h(name(r.to)))+textBtn('Arrêter ce tour','pass')+'</div>';
   return heading(r.rolls.length?'Encore<br><em>'+remaining()+' points.</em>':'Défie<br><em>la carte.</em>',h(c.title)+' · '+c.duration+' minutes','D20 / JET '+(r.rolls.length+1)+' SUR 2')+hpTrack()+stage(20,r.rolls.length?'LE SECOND LANCER':'LE PREMIER LANCER',r.rolls[0]||12)+btn(r.rolls.length?'Lancer le dernier D20':'Lancer le premier D20','roll','oa-clay')+'<p class="oa-note oa-center">'+(r.rolls.length?'Le total des deux dés doit atteindre '+r.hp+' PV.':percent(r.hp)+' de chances d’atteindre '+r.hp+' PV en deux jets.')+'</p><div class="oa-action-row">'+textBtn('Accepter plutôt','accept')+textBtn('Arrêter ce tour','pass')+'</div>';
  }
  if(state.phase==='challenge_failed')return heading('La carte<br><em>résiste encore.</em>',h(c.title),'DÉFI TERMINÉ')+hpTrack()+statusStrip(sum()+' points obtenus sur '+r.hp+'. La proposition reste ouverte.',true)+(G.canRespond(state)?responseActions():'<div class="oa-actions">'+switchButton(r.to)+textBtn('Arrêter ce tour','pass')+'</div>')+'<p class="oa-note oa-center">Tu peux adapter ou arrêter, quel que soit le résultat.</p>';
  if(state.phase==='accepted')return heading('Un moment<br><em>pour vous.</em>','Vous avez tous les deux accepté cette proposition.','ACCORD À DEUX')+'<div class="oa-card-stage">'+playingCard(c,true)+'</div>'+statusStrip(r.schedule?'Moment prévu : <strong>'+h(r.schedule)+'</strong>':'À vivre au moment qui vous convient.')+'<div class="oa-actions">'+btn('Marquer comme partagé','complete')+(state.prefs.reminder?textBtn('Aperçu du rappel','reminder'):'')+textBtn('Finalement, passer','pass')+'</div><p class="oa-note oa-center">Votre accord reste modifiable à tout moment.</p>';
  if(state.phase==='resolved'){
   const defended=r.status==='defended',completed=r.status==='completed';
   return heading(completed?'Un moment<br><em>à garder.</em>':defended?'Bien joué.<br><em>Carte écartée.</em>':'Une autre<br><em>fois, peut-être.</em>',completed?'Un point de plus pour votre duo. Vous pouvez aussi garder cette carte parmi vos favoris.':defended?'Le hasard a tranché ce petit défi.':'Cette proposition a été passée. Le prochain tour vous attend.',completed?'MOMENT PARTAGÉ':defended?'DÉFI RÉUSSI':'CARTE PASSÉE')+(defended?hpTrack():'')+'<div class="oa-summary-card"><span class="oa-summary-glyph" aria-hidden="true">'+(completed?'✓':defended?'↗':'—')+'</span><div><h2>'+h(c.title)+'</h2><p>'+h(G.getCategory(c.categoryId).label)+(r.adapted?' · Variante':' · '+c.duration+' min')+'</p></div>'+favoriteButton(c)+'</div><div class="oa-actions">'+btn('Un nouveau tour <span class="oa-arrow">↗</span>','new')+textBtn('Voir notre score','tab','data-tab="us"')+'</div>';
  }
  return '';
 }

 function renderCatalog(){
  const cat=G.getCategory(catalog),list=favoritesOnly?G.cards.filter(c=>state.favorites.includes(c.id)):G.cards.filter(c=>c.categoryId===catalog);
  const deckKey=favoritesOnly?'favorites':catalog;
  return heading('Des petits<br><em>possibles.</em>','Fais défiler les cartes. Garde celles qui vous ressemblent.','VOTRE JEU')+categoriesGrid(true)+'<div class="oa-filter-row" role="group" aria-label="Afficher les cartes"><button type="button" class="cursor-interaction" data-action="filter" data-favorites="false" aria-pressed="'+!favoritesOnly+'">'+h(cat.label)+'</button><button type="button" class="cursor-interaction" data-action="filter" data-favorites="true" aria-pressed="'+favoritesOnly+'">Favoris · '+state.favorites.length+'</button></div>'+(list.length?'<div class="oa-deck-toolbar"><p><span data-deck-counter>1 / '+list.length+'</span> <span class="oa-deck-hint">Glisse pour explorer</span></p><div><button type="button" class="oa-deck-arrow" data-action="deck-prev" aria-label="Carte précédente">←</button><button type="button" class="oa-deck-arrow" data-action="deck-next" aria-label="Carte suivante">→</button></div></div><div class="oa-deck" data-deck="'+deckKey+'" role="region" aria-label="Cartes à faire défiler" tabindex="0">'+list.map((c,i)=>'<section class="oa-deck-slide" aria-label="Carte '+(i+1)+' sur '+list.length+'" style="--category:'+G.getCategory(c.categoryId).color+'">'+playingCard(c)+'<button type="button" class="oa-deck-open" data-action="card-detail" data-card="'+c.id+'">Déplier la carte <span>↗</span></button></section>').join('')+'</div>':'<div class="oa-empty"><p>Les cartes que vous aimez<br>se retrouveront ici.</p></div>');
 }
 function setting(key,label,desc){return '<label class="oa-setting"><span>'+label+'<small>'+desc+'</small></span><input type="checkbox" class="cursor-interaction" data-pref="'+key+'" '+(state.prefs[key]?'checked':'')+' aria-label="'+h(label)+'"></label>';}
 function sharedScore(){
  const stats=state.stats,total=stats.totalCompleted;
  return '<section class="oa-shared-score" aria-label="Score commun"><p class="oa-eyebrow">VOTRE SCORE À DEUX</p><div class="oa-score-number"><strong>'+total.toLocaleString('fr-FR')+'</strong><span>point'+(total>1?'s':'')+'</span></div><p class="oa-score-caption">'+(total?'Des moments vécus, à votre rythme.':'Votre première carte partagée ouvre le score.')+'</p><div class="oa-score-rule"><span aria-hidden="true">✓</span> 1 carte partagée = 1 point</div></section><div class="oa-section-head"><h2>Vos cartes partagées</h2></div><div class="oa-score-grid">'+G.categories.map(c=>'<div class="oa-score-category" style="--category:'+c.color+'"><span class="oa-score-label"><i aria-hidden="true"></i>'+h(c.label)+'</span><strong>'+stats.byCategory[c.id].toLocaleString('fr-FR')+'</strong></div>').join('')+'</div><p class="oa-note">Le score augmente quand une carte est marquée « partagée ». Il reste commun à votre duo.</p>';
 }
 function renderUs(){return heading('À notre<br><em>rythme.</em>','Vos moments partagés, un point à la fois.','VOTRE DUO')+sharedScore()+'<div class="oa-section-head"><h2>Le confort du jeu</h2></div>'+setting('sound','Son des dés','Un contact feutré à chaque lancer.')+setting('discreet','Aperçus discrets','Le contenu de la carte reste masqué.')+setting('reminder','Rappel du moment','Aperçu disponible après un accord.')+'<p class="oa-note">Démo sur cet appareil : les deux profils et les notifications sont simulés. '+(persisted?'Votre partie et votre score sont conservés dans ce navigateur.':'La partie et le score restent disponibles tant que cette page est ouverte.')+'</p><div class="oa-actions">'+textBtn('Donner mon avis','feedback')+textBtn('Revoir les règles','rules')+textBtn('Effacer la partie de démonstration','reset-confirm')+'</div>';}

 function render(){
  const parent=canvas.parentElement;if(parent)parent.removeChild(canvas);
  const key=[tab,state.phase,state.round.id,state.round.cardId,state.round.rolls.length,state.round.draftRolls.length,state.activePlayer,tab==='cards'?catalog:'',tab==='cards'?favoritesOnly:''].join('|');
  const animate=key!==renderKey;renderKey=key;
  root.style.setProperty('--oa-accent',tab==='cards'&&!favoritesOnly?G.getCategory(catalog).color:(category()||G.categories[1]).color);
  main.innerHTML=tab==='play'?renderPlay():tab==='cards'?renderCatalog():renderUs();
  root.querySelectorAll('.oa-switch [data-action="profile"]').forEach(el=>{const selected=el.dataset.player===state.activePlayer;el.setAttribute('aria-pressed',String(selected));const dot=el.querySelector('.oa-unread');if(dot)dot.hidden=!(['pending','sender_confirmation'].includes(state.phase)&&state.round.awaiting===el.dataset.player&&state.activePlayer!==el.dataset.player);});
  root.querySelectorAll('.oa-nav button').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const holder=main.querySelector('[data-stage]');
  if(holder){holder.prepend(canvas);die.setKind(Number(holder.dataset.kind),Number(holder.dataset.value));die.setReducedMotion(systemReduce);}
  root.classList.toggle('is-busy',busy);
  initDeck();
  if(animate&&!systemReduce&&main.animate){
   const blocks=main.querySelectorAll(':scope > .oa-title,:scope > .oa-subtitle,:scope > .oa-steps,:scope > .oa-card-stage,:scope > .oa-actions,:scope > .oa-status-strip,:scope > .oa-notification,:scope > .oa-shared-score');
   blocks.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:520,delay:Math.min(i*38,160),easing:'cubic-bezier(.18,.8,.2,1)',fill:'backwards'}));
   main.querySelectorAll('.oa-category,.oa-mini-card').forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px) rotate(-2deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:440,delay:90+i*30,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
   const revealed=main.querySelector('.oa-card-stage .oa-playing-card');
   if(revealed)revealed.animate([{transform:'perspective(850px) translateY(24px) rotateX(10deg) rotateZ(-3deg) scale(.94)'},{transform:'perspective(850px) translateY(-3px) rotateX(-1deg) rotateZ(.6deg) scale(1.006)',offset:.7},{transform:'perspective(850px) translateY(0) rotateX(0) rotateZ(0) scale(1)'}],{duration:740,easing:'cubic-bezier(.18,.76,.2,1)'});
  }
 }
 function initDeck(){
  cancelAnimationFrame(deckFrame);
  const rail=main.querySelector('[data-deck]');if(!rail)return;
  const slides=Array.from(rail.children),key=rail.dataset.deck;
  let current=Math.max(0,Math.min(slides.length-1,deckPositions[key]||0));
  function update(){
   if(!rail.isConnected)return;
   const center=rail.scrollLeft+rail.clientWidth/2;
   let nearest=0,distance=Infinity;
   slides.forEach((slide,i)=>{
    const offset=(slide.offsetLeft+slide.offsetWidth/2-center)/slide.offsetWidth;
    const amount=Math.min(1.5,Math.abs(offset));
    if(Math.abs(offset)<distance){nearest=i;distance=Math.abs(offset);}
    slide.style.transform=systemReduce?'none':'translateY('+(amount*9)+'px) scale('+(1-amount*.055)+') rotate('+(Math.max(-1.5,Math.min(1.5,offset))*2.8)+'deg)';
    slide.style.zIndex=String(10-Math.round(amount*3));
   });
   current=nearest;deckPositions[key]=current;
   const counter=main.querySelector('[data-deck-counter]');if(counter)counter.textContent=(current+1)+' / '+slides.length;
   const prev=main.querySelector('[data-action="deck-prev"]'),next=main.querySelector('[data-action="deck-next"]');
   if(prev)prev.disabled=current===0;if(next)next.disabled=current===slides.length-1;
  }
  rail.scrollLeft=slides[current].offsetLeft-(rail.clientWidth-slides[current].offsetWidth)/2;
  update();
  rail.addEventListener('scroll',()=>{cancelAnimationFrame(deckFrame);deckFrame=requestAnimationFrame(update);},{passive:true});
  rail.addEventListener('keydown',e=>{if(e.target!==rail)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();moveDeck(e.key==='ArrowRight'?1:-1);}});
 }
 function moveDeck(direction){const rail=main.querySelector('[data-deck]');if(!rail)return;const index=Math.max(0,Math.min(rail.children.length-1,(deckPositions[rail.dataset.deck]||0)+direction)),slide=rail.children[index];rail.scrollTo({left:slide.offsetLeft-(rail.clientWidth-slide.offsetWidth)/2,behavior:systemReduce?'instant':'smooth'});}
 function celebrate(){
  if(systemReduce||!main.animate)return;
  const badge=main.querySelector('.oa-summary-glyph');
  if(badge)badge.animate([{transform:'scale(.7) rotate(-12deg)'},{transform:'scale(1.15) rotate(7deg)',offset:.55},{transform:'scale(1) rotate(0)'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
  const layer=document.createElement('div');layer.className='oa-celebration';layer.setAttribute('aria-hidden','true');root.querySelector('.oa-shell').append(layer);
  for(let i=0;i<12;i++){const dot=document.createElement('i');dot.style.background=G.categories[i%6].color;layer.append(dot);const angle=(i/12)*Math.PI*2;dot.animate([{transform:'translate(0,0) scale(.2)',opacity:0},{opacity:1,offset:.12},{transform:'translate('+Math.cos(angle)*(65+i*4)+'px,'+(Math.sin(angle)*75-30)+'px) rotate('+(i*51)+'deg) scale(.85)',opacity:0}],{duration:900+i*20,easing:'cubic-bezier(.1,.6,.2,1)',fill:'forwards'});}
  setTimeout(()=>layer.remove(),1300);
 }
 let audioContext;
 function softSound(){if(!state.prefs.sound)return;try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();[0,.44,.83].forEach((delay,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(155-i*18,t);osc.frequency.exponentialRampToValueAtTime(48,t+.1);gain.gain.setValueAtTime(.055/(i+1),t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.14);});}catch(_){}}
 async function roll(){
  if(busy||tab!=='play')return;
  const phase=state.phase,actor=state.activePlayer,roundId=state.round.id;
  let sides,action;
  if(phase==='category'&&canDraw()){sides=6;const value=G.randomInt(6);action={type:'ROLL_CATEGORY',value,hand:G.drawHand(state,value)};}
  else if(phase==='card'&&canDraw()){sides=4;action={type:'ROLL_CARD',value:G.randomInt(4)};}
  else if(phase==='draft_challenge'&&G.canRollDraftDefense(state)){sides=20;action={type:'ROLL_DRAFT_DEFENSE',value:G.randomInt(20),token:roundId+'-draft-'+(state.round.draftRolls.length+1)};}
  else if(phase==='challenge'&&G.canRespond(state)){sides=20;action={type:'ROLL_DEFENSE',value:G.randomInt(20),token:roundId+'-'+(state.round.rolls.length+1)};}
  else return;
  const serial=++animationSerial;
  const next=G.reduce(state,{...action,actor,roundId,at:now()});if(next===state)return;
  busy=true;root.classList.add('is-busy');
  root.querySelectorAll('[data-action="roll"],[data-action="profile"],[data-action="tab"],[data-action="rules"],[data-action="feedback"],[data-action="accept"]').forEach(el=>{el.disabled=true;});
  const button=main.querySelector('[data-action="roll"]');if(button)button.textContent='Le hasard fait son chemin…';
  state=next;save();softSound();
  try{await die.roll(action.value,{duration:systemReduce?0:1650});}catch(error){lastError=String(error);}
  if(serial!==animationSerial)return;
  busy=false;
  root.querySelectorAll('[data-action="profile"],[data-action="tab"],[data-action="rules"],[data-action="feedback"],[data-action="accept"]').forEach(el=>{el.disabled=false;});
  root.classList.remove('is-busy');render();
  announce('D'+sides+' : '+action.value+'. '+(sides===6?'Catégorie '+category().label:sides===4?card().title:remaining()+' points de vie restants.'));
 }
 function openSheet(title,body,extraClass=''){lastFocus=document.activeElement;sheet.innerHTML='<section class="oa-sheet '+h(extraClass)+'" role="dialog" aria-modal="true" aria-labelledby="oa-sheet-title"><div class="oa-sheet-head"><h2 id="oa-sheet-title">'+h(title)+'</h2><button type="button" class="oa-close cursor-interaction" data-action="close" aria-label="Fermer">×</button></div>'+body+'</section>';sheet.hidden=false;const shell=root.querySelector('.oa-shell');Array.from(shell.children).forEach(el=>{if(el!==sheet&&el.id!=='oa-announcement')el.inert=true;});const top=sheet.querySelector('button');top&&top.focus();}
 function closeSheet(){sheet.hidden=true;sheet.innerHTML='';Array.from(root.querySelector('.oa-shell').children).forEach(el=>el.inert=false);if(lastFocus&&lastFocus.isConnected)lastFocus.focus();lastFocus=null;}

 function rules(){openSheet('Le hasard, à deux.','<div class="oa-rule"><b>D6</b><div><h3>Une catégorie parmi six.</h3><p>Complicité, détente, tendresse, attention, découverte ou intimité.</p></div></div><div class="oa-rule"><b>D4</b><div><h3>Une carte parmi quatre.</h3><p>Tu peux la proposer directement. Si tu ne souhaites pas la proposer, tente de l’écarter au D20.</p></div></div><div class="oa-rule"><b>D20</b><div><h3>Deux jets pour atteindre ses PV.</h3><p>Si tu atteins le seuil, la carte est écartée. Sinon, elle est proposée automatiquement à l’autre.</p></div></div><p>L’autre peut accepter, tenter ses propres deux jets, adapter, proposer un autre moment ou passer. Une proposition automatique demande ensuite ta confirmation aussi.</p><p>Vous pouvez arrêter ou passer une proposition sans pénalité. Seule une carte acceptée à deux puis marquée « partagée » ajoute 1 point à votre score commun.</p><div class="oa-actions">'+btn('C’est parti','close')+'</div><p>Pour tester les deux côtés, change de profil en haut. Les notifications sont simulées sur cet appareil.</p>');}

 function challengeSheet(draft=false){const c=card();openSheet(draft?'L’écarter avec le D20':'Tenter le D20','<p>Deux lancers au maximum pour atteindre les <strong>'+c.hp+' PV</strong> de « '+h(c.title)+' ».</p><div class="oa-summary-card"><span class="oa-summary-glyph">'+c.hp+'</span><div><h2>'+percent(c.hp)+' de réussite</h2><p>Total des deux D20 ≥ '+c.hp+'</p></div></div><p>'+(draft?'Si tes deux jets échouent, la carte est proposée automatiquement à '+h(name(state.round.to))+'. Si l’autre accepte, tu confirmes aussi ton envie.':'Si la carte résiste, tu peux l’accepter, l’adapter ou arrêter ce tour.')+'</p><div class="oa-actions">'+btn('Je tente le défi',draft?'start-draft-challenge':'start-challenge','oa-clay')+textBtn('Revenir à la carte','close')+'</div>');}
 function showAdapt(){const c=card();openSheet('Proposer une variante','<p>Cette proposition devra être acceptée par '+h(name(G.otherPlayer(state.activePlayer)))+'.</p><label class="oa-field">Ta variante<textarea id="oa-adapt-text" aria-label="Ta variante" maxlength="300">'+h(state.round.adapted?state.round.proposal:c.variant)+'</textarea></label><div class="oa-actions">'+btn('Envoyer la variante','confirm-adapt')+'</div>');}
 function showLater(){openSheet('Trouver le bon moment','<p>Propose un créneau à '+h(name(G.otherPlayer(state.activePlayer)))+'. Le moment sera confirmé à deux.</p><label class="oa-field">Quand ?<select id="oa-schedule"><option>Ce soir, quand nous sommes disponibles</option><option>Demain</option><option>Ce week-end</option><option>À convenir ensemble</option></select></label><div class="oa-actions">'+btn('Proposer ce moment','confirm-later')+'</div>');}

 function details(id){const c=G.getCard(id);if(!c)return;openSheet(c.title,playingCard(c,true)+source(c)+'<div class="oa-detail-variant"><p class="oa-eyebrow">UNE AUTRE FAÇON · '+c.variantDuration+' MIN</p><p>'+h(c.variant)+'</p></div><p class="oa-detail-odds">Côté jeu · '+c.hp+' PV : '+percent(c.hp)+' de chances de les atteindre avec deux D20.</p>','oa-card-sheet');}
 function feedbackReport(){return feedbackContext+'\n\nMon retour :\n'+(feedbackNote.trim()||'À compléter.');}
 function showFeedback(){
  const round=state.round;
  feedbackContext=['ONDE — Retour de test','Version : 0.3.0','Écran : '+({play:'Jouer',cards:'Les cartes',us:'Nous'}[tab]||tab),'Étape : '+state.phase,'Catégorie : '+(round.categoryId||'—'),'Carte (cardId) : '+(round.cardId||'—'),'PV : '+(round.hp==null?'—':round.hp),'D6 : '+(round.categoryRoll||'—')+' · D4 : '+(round.cardRoll||'—')+' · D20 initiateur : '+(round.draftRolls.length?round.draftRolls.join(' + '):'—')+' · D20 destinataire : '+(round.rolls.length?round.rolls.join(' + '):'—'),'Fenêtre : '+window.innerWidth+' × '+window.innerHeight+' px','Rendu : '+(die.mode||canvas.dataset.renderer||'inconnu')].join('\n');
  openSheet('Donner mon avis','<p>Qu’est-ce qui te plaît, te gêne ou te manque ? Copie ce retour pour le partager dans notre conversation.</p><label class="oa-field">Ton avis<textarea id="oa-feedback-note" rows="3" maxlength="2000" placeholder="Par exemple : le dé rebondit trop vite…">'+h(feedbackNote)+'</textarea></label><label class="oa-field">Le rapport à copier<textarea id="oa-feedback-report" rows="5" readonly aria-describedby="oa-feedback-status" spellcheck="false">'+h(feedbackReport())+'</textarea></label><div class="oa-actions">'+btn('Copier mon retour','copy-feedback')+'</div><p id="oa-feedback-status" role="status">Aucun envoi automatique. Ton avis reste dans cette page jusqu’à sa fermeture.</p>','oa-feedback-sheet');
 }
 async function copyFeedback(){
  const field=sheet.querySelector('#oa-feedback-report'),status=sheet.querySelector('#oa-feedback-status'),button=sheet.querySelector('[data-action="copy-feedback"]');
  if(!field||!status||!button)return;
  button.disabled=true;
  try{
   if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('clipboard-unavailable');
   await navigator.clipboard.writeText(field.value);
   status.textContent='Retour copié. Tu peux maintenant le coller dans notre conversation.';
  }catch(_){
   if(field.isConnected){field.focus();field.select();field.setSelectionRange(0,field.value.length);status.textContent='Copie automatique indisponible. Le rapport est sélectionné : utilise la commande Copier de ton appareil.';}
  }finally{button.disabled=false;}
 }
 root.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||!root.contains(el))return;event.preventDefault();const action=el.dataset.action;
  if(busy&&action!=='pass'&&action!=='close')return;
  if(action==='roll'){roll();return;}
  if(action==='deck-prev'||action==='deck-next'){moveDeck(action==='deck-next'?1:-1);return;}
  if(action==='tab'){tab=el.dataset.tab;render();return;}
  if(action==='profile'){dispatch({type:'SWITCH_PLAYER',player:el.dataset.player});tab='play';render();announce('Profil : '+name(state.activePlayer));return;}
  if(action==='send'){dispatch({type:'SEND'});toast('Invitation pour '+name(state.round.to)+' · simulée dans la démo');return;}
  if(action==='accept'){dispatch({type:'ACCEPT'});announce(state.phase==='accepted'?'Proposition acceptée à deux.':'Accord reçu. Confirmation de '+name(state.round.awaiting)+' attendue.');return;}
  if(action==='pass'){
   if(busy){animationSerial++;busy=false;die.setKind(die.kind,die.value);root.querySelectorAll('button:disabled').forEach(b=>{b.disabled=false;});}
   dispatch({type:'PASS'});announce('Carte passée.');return;
  }
  if(action==='challenge'){challengeSheet(false);return;}
  if(action==='challenge-draft'){challengeSheet(true);return;}
  if(action==='start-draft-challenge'){closeSheet();dispatch({type:'CHALLENGE_DRAFT'});return;}
  if(action==='start-challenge'){closeSheet();dispatch({type:'CHALLENGE'});return;}
  if(action==='adapt'){showAdapt();return;}
  if(action==='confirm-adapt'){const field=root.querySelector('#oa-adapt-text');if(!field.value.trim()){field.focus();return;}const text=field.value.trim();closeSheet();dispatch({type:'ADAPT',text});return;}
  if(action==='later'){showLater();return;}
  if(action==='confirm-later'){const schedule=root.querySelector('#oa-schedule').value;closeSheet();dispatch({type:'LATER',schedule});return;}
  if(action==='complete'){if(dispatch({type:'COMPLETE'})){announce('Moment partagé. Un point ajouté au score de votre duo.');toast('+1 point pour votre duo.');celebrate();}return;}
  if(action==='new'){dispatch({type:'NEW_ROUND'});tab='play';render();return;}
  if(action==='favorite'){const selectedId=el.dataset.card;dispatch({type:'TOGGLE_FAVORITE',cardId:selectedId});if(!systemReduce)root.querySelectorAll('[data-action="favorite"][data-card="'+selectedId+'"]').forEach(b=>b.animate([{transform:'scale(.75)'},{transform:'scale(1.18)',offset:.55},{transform:'scale(1)'}],{duration:340,easing:'ease-out'}));if(!sheet.hidden){const pressed=state.favorites.includes(el.dataset.card);sheet.querySelectorAll('[data-action="favorite"]').forEach(b=>{b.setAttribute('aria-pressed',String(pressed));b.textContent=pressed?'♥':'♡';});}return;}
  if(action==='catalog'){catalog=el.dataset.category;favoritesOnly=false;render();return;}
  if(action==='filter'){favoritesOnly=el.dataset.favorites==='true';render();return;}
  if(action==='card-detail'){details(el.dataset.card);return;}
  if(action==='rules'){rules();return;}
  if(action==='feedback'){showFeedback();return;}
  if(action==='copy-feedback'){copyFeedback();return;}
  if(action==='close'){closeSheet();return;}
  if(action==='reminder'){openSheet('Aperçu du rappel','<div class="oa-notification"><span class="oa-notification-logo">ON</span><div><small>ONDE · RAPPEL</small><p>'+h(state.prefs.discreet?'Votre moment à deux vous attend.':card().title)+'</p></div></div><p>Ceci est un aperçu dans la démo. Aucun rappel système n’est programmé.</p><div class="oa-actions">'+btn('Fermer l’aperçu','close')+'</div>');return;}
  if(action==='reset-confirm'){openSheet('Repartir de zéro ?','<p>La partie, le score commun, les favoris et les préférences de cette démonstration seront effacés.</p><div class="oa-actions">'+btn('Effacer la démo','reset','oa-clay')+textBtn('Conserver ma partie','close')+'</div>');return;}
  if(action==='reset'){closeSheet();dispatch({type:'RESET'});tab='play';catalog='detente';favoritesOnly=false;render();toast('La démonstration repart de zéro.');return;}
 });
 if(motionQuery&&motionQuery.addEventListener)motionQuery.addEventListener('change',event=>{systemReduce=event.matches;die.setReducedMotion(systemReduce);root.getAnimations({subtree:true}).forEach(a=>a.cancel());if(tab==='cards')initDeck();});
 root.addEventListener('input',event=>{if(event.target.id==='oa-feedback-note'){feedbackNote=event.target.value;const report=sheet.querySelector('#oa-feedback-report');if(report)report.value=feedbackReport();}});
 root.addEventListener('change',event=>{const el=event.target;if(el.dataset.pref){dispatch({type:'SET_PREFS',patch:{[el.dataset.pref]:el.checked}});die.setReducedMotion(!!systemReduce);if(el.dataset.pref==='sound'&&el.checked)softSound();}});
 sheet.addEventListener('click',event=>{if(event.target===sheet)closeSheet();});
 root.addEventListener('keydown',event=>{if(sheet.hidden)return;if(event.key==='Escape'){closeSheet();return;}if(event.key==='Tab'){const focusable=Array.from(sheet.querySelectorAll('button,a,input,select,textarea,summary')).filter(x=>!x.disabled);const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 render();
 root.dataset.ready='true';
})();
