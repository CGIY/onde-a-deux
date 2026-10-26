/* Rendering only: board, attempts, rewards and one-shot eligibility belong to the server. */
(() => {
  'use strict';
  const motifs=['Soleil','Lune','Clé','Fleur','Feuille','Tasse','Enveloppe','Couronne','Papillon','Ancre'];
  const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const motifMarkup=index=>`<span class="memory-illustration" aria-hidden="true" style="--motif-x:${index%5*25}%;--motif-y:${index<5?0:100}%"></span>`;

  function mount({getState,getRole,exchange,renderCard,onUpdate,onCollection,friendlyError}) {
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const modal=document.createElement('dialog');
    modal.className='depressive-deck-dialog';modal.setAttribute('aria-labelledby','deckTitle');
    modal.innerHTML='<span class="deck-demo-label">ÉVÉNEMENT UNIQUE · UNE PARTIE PAR JOUEUR</span><button type="button" class="deck-close" aria-label="Fermer le Deck">×</button><div class="deck-content"></div>';
    document.body.append(modal);
    const content=modal.querySelector('.deck-content');
    const launcher=document.createElement('button');launcher.type='button';launcher.className='deck-preview-launch';launcher.hidden=true;
    launcher.innerHTML='<span aria-hidden="true">◐</span><span><strong>The depressive Deck</strong><small>Une seule partie · jusqu’au 27 octobre à 5 h</small></span><b aria-hidden="true">→</b>';
    document.querySelector('#seasonBanner').after(launcher);
    let role=null,busy=false,opening=false,signature='',message='',timer=null,pendingRevision=null,blockedResolution=false,closingForProfile=false,generation=0;
    const autoShown=new Set();
    const game=()=>getState();
    const phase=()=>opening?'opening':!game()?.started?'intro':game().last_reward?'reveal':game().done?'summary':'board';
    const stats=()=>{const s=game();return `<div class="deck-totals"><span><b>${s.found}/10</b> paires</span><span><b>${s.remaining}</b> tentatives restantes</span></div><div class="deck-progress" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<s.found?'complete':''}"></i>`).join('')}</div>`;};
    const header=title=>`<header class="deck-reading-head"><span class="eyebrow">The depressive Deck</span><h2 id="deckTitle">${title}</h2>${stats()}</header>`;
    const errorMarkup=()=>`<p class="deck-message" role="status">${escape(message)}</p>${message?'<button class="deck-text" type="button" data-deck-refresh>Actualiser la partie</button>':''}`;
    function drawBoard() {
      const s=game(),grid=content.querySelector('.memory-grid');if(!grid)return;
      if(!grid.children.length)grid.innerHTML=Array.from({length:20},(_,i)=>`<button type="button" class="memory-tile" data-deck-tile="${i}" style="--tile-delay:${i*12}ms"><span class="memory-flip"><span class="memory-back" aria-hidden="true"></span><span class="memory-front" aria-hidden="true"></span></span></button>`).join('');
      s.tiles.forEach(tile=>{
        const button=grid.children[tile.index];button.dataset.face=tile.up?'up':'down';button.classList.toggle('is-matched',tile.matched);
        button.disabled=busy||s.pending||tile.matched||tile.up;
        button.setAttribute('aria-label',`Tuile ${tile.index+1}, ${tile.motif===null?'cachée':motifs[tile.motif]}${tile.matched?', retrouvée':''}`);
        button.setAttribute('aria-pressed',String(tile.up));
        if(tile.motif!==null)button.querySelector('.memory-front').innerHTML=motifMarkup(tile.motif);
      });
      content.querySelector('.deck-stats').innerHTML=stats();
      const exposed=s.tiles.filter(tile=>tile.up&&!tile.matched);
      content.querySelector('.memory-status').textContent=busy?'Un instant…':s.pending?(exposed[0]?.motif===exposed[1]?.motif?'Une paire… quelle carte cache-t-elle ?':'Observe leurs emplacements.'):exposed.length?'Choisis une deuxième tuile.':'Retourne deux tuiles.';
      content.querySelector('.deck-errors').innerHTML=errorMarkup();
      content.classList.toggle('deck-network-pending',busy);
    }
    function render(force=false) {
      const s=game();if(!s||!modal.open)return;
      const key=`${phase()}:${s.revision}:${busy}:${message}`;
      if(!force&&key===signature)return;
      if(opening&&content.querySelector('.deck-box')){signature=key;return;}
      const sameBoard=signature.startsWith('board:')&&phase()==='board';signature=key;
      if(sameBoard){drawBoard();return;}
      if(phase()==='intro'||phase()==='opening') {
        content.innerHTML=`<div class="deck-intro"><span class="eyebrow">Ce soir seulement · événement unique</span><h2 id="deckTitle">The depressive<br><em>Deck.</em></h2><p>Retrouve les paires. Découvre ton tirage.</p><div class="deck-box-stage" aria-hidden="true"><div class="deck-box ${opening?'is-opening':''}"><div class="deck-box-back"></div><div class="deck-box-side deck-box-left"></div><div class="deck-box-side deck-box-right"></div><div class="deck-box-bottom"></div><div class="deck-box-mouth"></div><div class="deck-box-card"></div><div class="deck-box-face"><span>LES CARTES À DEUX</span><i class="deck-box-emblem"></i><b>The depressive<em>Deck.</em></b><small>10 PAIRES À RETROUVER</small></div><div class="deck-box-lid"></div></div></div><button class="deck-primary" type="button" data-deck-start ${busy||!s.available?'disabled':''}>${opening?'Ouverture…':'Ouvrir la boîte'}</button><div class="memory-rules"><p>10 paires · 20 tentatives · une seule partie.</p><p>Une paire retrouvée révèle une carte.<br>Les paires restantes deviennent des Énergies Bisous.</p><details class="memory-rarity"><summary>Raretés habituelles</summary><p>Commune 69,5 % · Full art 20 % · Foil 8 % · Full art + foil 2 % · Légendaire 0,5 %</p></details></div>${errorMarkup()}</div>`;
      } else if(phase()==='reveal') {
        const card=s.last_reward;
        content.innerHTML=`${header('Paire retrouvée.')}<div class="memory-prize ${card.finish!=='standard'?'is-rare':''}">${renderCard(card)}</div><p class="deck-pair-status" role="status">${escape(card.title)} · conservée</p><button class="deck-primary" type="button" data-deck-continue ${busy?'disabled':''}>${s.done?'Voir le bilan':'Continuer le Memory →'}</button><small class="deck-note">Ta carte a rejoint la collection.</small>${errorMarkup()}`;
      } else if(phase()==='summary') {
        const energy=s.rewards.filter(c=>c.card_type==='energy'),wins=s.rewards.filter(c=>c.card_type!=='energy');
        content.innerHTML=`${header('Ta boîte est ouverte.')}<p class="memory-result" role="status"><strong>${wins.length?`${wins.length} carte${wins.length>1?'s':''} gagnée${wins.length>1?'s':''}`:'Aucune paire retrouvée'}</strong><span>${energy.length?`+ ${energy.length} Énergie${energy.length>1?'s':''} Bisous`:'Toutes les paires ont été retrouvées.'}</span></p><div class="deck-summary">${[...wins,...energy.length?[energy[0]]:[]].map(c=>`<div>${renderCard(c)}${c.card_type==='energy'&&energy.length>1?`<b class="memory-energy-count">×${energy.length}</b>`:''}</div>`).join('')}</div><button class="deck-primary" type="button" data-deck-collection>Voir ma collection</button><small class="deck-note">Événement terminé pour toi. Les cartes gagnées durent 7 jours à partir de leur obtention.</small>${errorMarkup()}`;
      } else {
        content.innerHTML=`<header class="deck-reading-head memory-head"><span class="eyebrow">The depressive Deck</span><h2 id="deckTitle">Retrouve les paires.</h2></header><div class="deck-stats"></div><div class="memory-grid" role="group" aria-label="Table de Memory, vingt tuiles"></div><p class="memory-status" role="status"></p><div class="deck-errors"></div><small class="deck-note memory-help">Tu peux fermer et reprendre ta partie.</small>`;drawBoard();
      }
    }
    function scheduleResolution() {
      const s=game();
      if(!modal.open||!s?.pending||busy||blockedResolution||pendingRevision===s.revision)return;
      clearTimeout(timer);pendingRevision=s.revision;
      const shown=s.tiles.filter(t=>t.up&&!t.matched),match=shown[0]?.motif===shown[1]?.motif;
      timer=setTimeout(()=>{pendingRevision=null;void mutate('deck_resolve');},reduce.matches?0:match?650:950);
    }
    function refresh() {
      const nextRole=getRole(),s=game();
      if(role!==nextRole||!s){
        clearTimeout(timer);pendingRevision=null;signature='';message='';blockedResolution=false;
        generation++;busy=false;opening=false;role=nextRole;
        if(modal.open){closingForProfile=true;modal.close();}
      }
      launcher.hidden=!s||(!s.available&&!s.started)||(s.done&&!s.last_reward&&!modal.open&&!s.available);
      if(!s)return;
      launcher.querySelector('small').textContent=s.done?'Événement terminé · voir le bilan':s.started?`${s.found}/10 paires · ${s.remaining} tentatives · reprendre`:'Une seule partie · jusqu’au 27 octobre à 5 h';
      render();scheduleResolution();
      if(!closingForProfile&&s.available&&!s.announced&&!autoShown.has(role)&&!document.querySelector('dialog[open]')) {
        autoShown.add(role);open();
      }
    }
    function open() {
      if(!game()||(!game().available&&!game().started))return;
      autoShown.add(role);signature='';if(!modal.open)modal.showModal();render(true);scheduleResolution();
    }
    async function mutate(action,extra={}) {
      if(busy||!game())return;
      const requestRole=role,requestGeneration=generation,revision=game().revision;
      busy=true;message='';render();
      try {
        await exchange(action,{...extra,revision});
        if(getRole()!==requestRole||generation!==requestGeneration)return;
        blockedResolution=false;onUpdate();
      } catch(error) {
        if(getRole()!==requestRole||generation!==requestGeneration)return;
        // The ordered transport may already have recovered a lost response by sync.
        // Never replay a flip or reward write just because its response was lost.
        if((game()?.revision??revision)<=revision) {
          blockedResolution=blockedResolution||action==='deck_resolve';
          message=friendlyError(error);
        }
        onUpdate();
      } finally {
        if(getRole()===requestRole&&generation===requestGeneration){busy=false;render();scheduleResolution();}
      }
    }
    async function start() {
      if(busy||!game()?.available)return;
      opening=true;
      const box=content.querySelector('.deck-box'),button=content.querySelector('[data-deck-start]');
      box?.classList.add('is-opening');if(button){button.disabled=true;button.textContent='Ouverture…';}
      // Keep the current 3D pose instead of recreating it at the animation's start.
      signature=`opening:${game().revision}:true:`;
      const motion=new Promise(resolve=>setTimeout(resolve,reduce.matches?0:1250));
      await Promise.all([mutate('deck_start'),motion]);
      opening=false;signature='';render(true);scheduleResolution();
    }
    modal.addEventListener('click',event=>{
      if(event.target.closest('.deck-close'))return modal.close();
      if(event.target.closest('[data-deck-start]'))return void start();
      const tile=event.target.closest('[data-deck-tile]');
      if(tile&&phase()==='board')return void mutate('deck_flip',{index:Number(tile.dataset.deckTile)});
      if(event.target.closest('[data-deck-continue]'))return void mutate('deck_continue');
      if(event.target.closest('[data-deck-collection]')){modal.close();onCollection();return;}
      if(event.target.closest('[data-deck-refresh]')&&!busy){
        blockedResolution=true;
        return void mutate('sync');
      }
    });
    modal.addEventListener('close',()=>{
      clearTimeout(timer);pendingRevision=null;signature='';
      if(closingForProfile){closingForProfile=false;setTimeout(refresh,0);return;}
      if(getRole()===role&&game()&&!game().announced&&!busy)void mutate('deck_dismiss');
      if(!launcher.hidden)launcher.focus({preventScroll:true});
    });
    launcher.addEventListener('click',open);
    document.addEventListener('close',refresh,true);
    return Object.freeze({refresh,isOpen:()=>modal.open});
  }
  window.DepressiveDeck=Object.freeze({mount});
})();
