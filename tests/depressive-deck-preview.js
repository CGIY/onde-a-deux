/* Local test only: all rewards live in the isolated preview's memory. */
(() => {
  'use strict';
  const motifs = ['Soleil','Lune','Clé','Fleur','Feuille','Tasse','Enveloppe','Couronne','Papillon','Ancre'];
  const finishForRoll = roll => {
    if (!(roll >= 0 && roll < 1)) throw new Error('Invalid rarity roll');
    return roll < .005 ? 'legendary' : roll < .025 ? 'full_art_foil' : roll < .105 ? 'foil' : roll < .305 ? 'full_art' : 'standard';
  };
  function drawRewards(bank, random = Math.random) {
    for (const finish of ['standard','full_art','foil','full_art_foil','legendary']) if (!bank.some(card=>card.finish===finish)) throw new Error('Missing rarity pool');
    return Array.from({length:10},(_,i)=>{
      const finish = finishForRoll(random());
      const pool = bank.filter(card=>card.finish===finish);
      let value = random()*pool.reduce((sum,card)=>sum+(card.palette==='nude'?.8:1),0);
      const card = pool.find(card=>(value-=card.palette==='nude'?.8:1)<0) || pool.at(-1);
      return {...card,id:'test-memory-copy-'+i};
    });
  }
  function createMemory({rewards,energy,onRewards=()=>{},random=Math.random}) {
    if(rewards.length!==10 || new Set(rewards.map(card=>card.id)).size!==10)throw new Error('Ten physical rewards required');
    const board=Array.from({length:20},(_,i)=>Math.floor(i/2));
    for(let i=board.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[board[i],board[j]]=[board[j],board[i]];}
    const found=new Set(),settled=new Map();let exposed=[],turns=0,pending=false,done=false;
    const snapshot=()=>({turns,remaining:20-turns,found:found.size,pending,done,rewards:[...settled.values()],tiles:board.map((pair,index)=>({index,up:found.has(pair)||exposed.includes(index),matched:found.has(pair),motif:found.has(pair)||exposed.includes(index)?pair:null}))});
    return Object.freeze({
      snapshot,
      flip(index){
        if(done||pending||!Number.isInteger(index)||index<0||index>=20||exposed.includes(index)||found.has(board[index]))return {kind:'ignored'};
        exposed.push(index);
        if(exposed.length===1)return {kind:'first'};
        turns++;pending=true;
        return {kind:board[exposed[0]]===board[exposed[1]]?'match':'miss'};
      },
      resolve(){
        if(!pending)return null;
        const match=board[exposed[0]]===board[exposed[1]],pair=board[exposed[0]];
        const won=match?rewards[pair]:null;
        const ending=turns===20 || found.size+(match?1:0)===10;
        const additions=[];
        if(won && !settled.has(pair))additions.push([pair,won]);
        if(ending)for(let i=0;i<10;i++)if(!settled.has(i)&&(!match||i!==pair))additions.push([i,{...energy,id:'test-memory-energy-'+i}]);
        // Callback failure leaves the pending resolution available for a safe retry.
        if(additions.length)onRewards(additions.map(([,card])=>card));
        additions.forEach(([key,card])=>settled.set(key,card));
        if(match)found.add(pair);
        exposed=[];pending=false;done=ending;
        return {kind:match?'match':'miss',card:won,done};
      }
    });
  }
  const escape = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const motifMarkup = index => `<span class="memory-illustration" aria-hidden="true" style="--motif-x:${index%5*25}%;--motif-y:${index<5?0:100}%"></span>`;
  function mount({bank,energy,renderCard,onRewards,onCollection}) {
    const game=createMemory({rewards:drawRewards(bank),energy,onRewards});
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const modal=document.createElement('dialog');modal.className='depressive-deck-dialog';modal.setAttribute('aria-labelledby','deckTitle');
    modal.innerHTML='<span class="deck-demo-label">PHASE DE TEST · AUCUN GAIN RÉEL</span><button type="button" class="deck-close" aria-label="Fermer le Deck">×</button><div class="deck-content"></div>';
    document.body.append(modal);const content=modal.querySelector('.deck-content');
    const launcher=document.createElement('button');launcher.type='button';launcher.className='deck-preview-launch';
    launcher.innerHTML='<span aria-hidden="true">◐</span><span><strong>The depressive Deck</strong><small>Memory · 10 paires · 20 tentatives</small></span><b aria-hidden="true">→</b>';document.querySelector('#seasonBanner').after(launcher);
    let phase='intro',timer,lastReward=null,message='Retourne deux tuiles.';
    const later=(fn,ms)=>{clearTimeout(timer);timer=setTimeout(fn,reduce.matches?0:ms);};
    const stats=()=>{const s=game.snapshot();return `<div class="deck-totals"><span><b>${s.found}/10</b> paires</span><span><b>${s.remaining}</b> tentatives restantes</span></div><div class="deck-progress" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<s.found?'complete':''}"></i>`).join('')}</div>`;};
    const header=title=>`<header class="deck-reading-head"><span class="eyebrow">The depressive Deck</span><h2 id="deckTitle">${title}</h2>${stats()}</header>`;
    function drawBoard(){
      const s=game.snapshot();
      const grid=content.querySelector('.memory-grid');
      if(!grid.children.length)grid.innerHTML=Array.from({length:20},(_,i)=>`<button type="button" class="memory-tile" data-memory-tile="${i}" style="--tile-delay:${i*12}ms"><span class="memory-flip"><span class="memory-back" aria-hidden="true"></span><span class="memory-front" aria-hidden="true"></span></span></button>`).join('');
      s.tiles.forEach(tile=>{const button=grid.children[tile.index];button.dataset.face=tile.up?'up':'down';button.classList.toggle('is-matched',tile.matched);button.disabled=tile.matched||s.pending;button.setAttribute('aria-label',`Tuile ${tile.index+1}, ${tile.motif===null?'cachée':motifs[tile.motif]}${tile.matched?', retrouvée':''}`);button.setAttribute('aria-pressed',String(tile.up));if(tile.motif!==null)button.querySelector('.memory-front').innerHTML=motifMarkup(tile.motif);});
      content.querySelector('.deck-stats').innerHTML=stats();content.querySelector('.memory-status').textContent=message;
    }
    function render(){
      const s=game.snapshot();
      if(phase==='intro'||phase==='opening'){
        content.innerHTML=`<div class="deck-intro"><span class="eyebrow">Événement spécial · à tester</span><h2 id="deckTitle">The depressive<br><em>Deck.</em></h2><p>Retrouve les paires. Découvre ton tirage.</p><div class="deck-box-stage" aria-hidden="true"><div class="deck-box ${phase==='opening'?'is-opening':''}"><div class="deck-box-back"></div><div class="deck-box-side deck-box-left"></div><div class="deck-box-side deck-box-right"></div><div class="deck-box-bottom"></div><div class="deck-box-mouth"></div><div class="deck-box-card"></div><div class="deck-box-face"><span>LES CARTES À DEUX</span><i class="deck-box-emblem"></i><b>The depressive<em>Deck.</em></b><small>10 PAIRES À RETROUVER</small></div><div class="deck-box-lid"></div></div></div><button class="deck-primary" type="button" data-memory-start ${phase==='opening'?'disabled':''}>Ouvrir la boîte</button><div class="memory-rules"><p>Une paire retrouvée révèle une carte.</p><p>À la fin, chaque paire restante devient une Énergie Bisous.</p><details class="memory-rarity"><summary>Raretés habituelles</summary><p>Commune 69,5 % · Full art 20 % · Foil 8 % · Full art + foil 2 % · Légendaire 0,5 %</p></details></div></div>`;return;
      }
      if(phase==='reveal'){
        content.innerHTML=`${header('Paire retrouvée.')}<div class="memory-prize ${lastReward.finish!=='standard'?'is-rare':''}">${renderCard(lastReward)}</div><p class="deck-pair-status" role="status">${escape(lastReward.title)} · conservée</p><button class="deck-primary" type="button" data-memory-continue>${s.done?'Voir le bilan':'Continuer le Memory →'}</button><small class="deck-note">La carte gagnée rejoint la collection de test.</small>`;return;
      }
      if(phase==='summary'){
        const energies=s.rewards.filter(card=>card.card_type==='energy');const wins=s.rewards.filter(card=>card.card_type!=='energy');
        content.innerHTML=`${header('Ta boîte est ouverte.')}<p class="memory-result" role="status"><strong>${wins.length ? `${wins.length} défi${wins.length>1?"s":""} gagné${wins.length>1?"s":""}` : "Aucun défi retrouvé"}</strong><span>${energies.length ? `+ ${energies.length} Énergie${energies.length>1?"s":""} Bisous` : "Toutes les paires ont été retrouvées."}</span></p><div class="deck-summary">${[...wins,...energies.length?[energies[0]]:[]].map(card=>`<div>${renderCard(card)}${card.card_type==='energy'&&energies.length>1?`<b class="memory-energy-count">×${energies.length}</b>`:''}</div>`).join('')}</div><button class="deck-primary" type="button" data-memory-collection>Voir ma collection de test</button><button class="deck-text" type="button" data-memory-reset>Recharger la démo</button><small class="deck-note">Les récompenses non retrouvées n’ont pas été découvertes.</small>`;return;
      }
      content.innerHTML=`<header class="deck-reading-head memory-head"><span class="eyebrow">The depressive Deck</span><h2 id="deckTitle">Retrouve les paires.</h2></header><div class="deck-stats"></div><div class="memory-grid" role="group" aria-label="Table de Memory, vingt tuiles"></div><p class="memory-status" role="status"></p><small class="deck-note memory-help">Les motifs cachent des cartes aux raretés habituelles.</small>`;drawBoard();
    }
    function resolve(){
      const result=game.resolve();if(!result)return;
      if(result.card){lastReward=result.card;phase='reveal';navigator.vibrate?.(result.card.finish==='standard'?10:[10,20,20]);}
      else {phase=result.done?'summary':'board';message='Ces deux motifs sont différents. À toi de jouer.';}
      if(modal.open){if(phase==='board')drawBoard();else render();}
    }
    function open(){render();if(!modal.open)modal.showModal();}
    modal.addEventListener('click',event=>{
      if(event.target.closest('.deck-close'))return modal.close();
      if(event.target.closest('[data-memory-start]')&&phase==='intro'){phase='opening';content.querySelector('.deck-box').classList.add('is-opening');event.target.closest('[data-memory-start]').disabled=true;later(()=>{phase='board';if(modal.open)render();},1250);return;}
      const tile=event.target.closest('[data-memory-tile]');
      if(tile&&phase==='board'){
        const index=Number(tile.dataset.memoryTile),result=game.flip(index);if(result.kind==='ignored')return;
        message=result.kind==='first'?'Choisis une deuxième tuile.':result.kind==='match'?'Une paire… quelle carte cache-t-elle ?':'Observe leurs emplacements.';drawBoard();
        if(result.kind==='match'||result.kind==='miss')later(resolve,result.kind==='match'?650:950);
        else content.querySelector(`[data-memory-tile="${index}"]`).focus({preventScroll:true});return;
      }
      if(event.target.closest('[data-memory-continue]')){phase=game.snapshot().done?'summary':'board';message='Retourne deux tuiles.';render();return;}
      if(event.target.closest('[data-memory-collection]')){modal.close();onCollection();return;}
      if(event.target.closest('[data-memory-reset]'))location.reload();
    });
    modal.addEventListener('close',()=>{
      clearTimeout(timer);if(game.snapshot().pending)resolve();if(phase==='opening')phase='board';
      const s=game.snapshot();launcher.querySelector('small').textContent=s.done?`${s.found} paires retrouvées · voir le bilan`:s.turns?`${s.found}/10 paires · ${s.remaining} tentatives · reprendre`:'Memory · 10 paires · 20 tentatives';launcher.focus({preventScroll:true});
    });
    launcher.addEventListener('click',open);
    if(new URLSearchParams(location.search).get('scene')==='deck')later(open,0);
    return Object.freeze({open});
  }
  window.DepressiveDeckPreview=Object.freeze({finishForRoll,drawRewards,createMemory,mount});
})();
