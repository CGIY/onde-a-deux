/* Economy screens only. Every card and balance change is committed by tcg_exchange. */
(() => {
  'use strict';
  const recipes=[
    {id:'draw',title:'Nouveau tirage',subtitle:'Le hasard reprend la main',needs:{energy:5},result:'1 carte aléatoire',motion:'draw'},
    {id:'reforge',title:'Refrappe',subtitle:'La rareté et la catégorie restent',needs:{any:1,energy:3},result:'1 carte de même rareté',motion:'reforge'},
    {id:'common_to_art',title:'Première transmutation',subtitle:'Du papier à l’illustration',needs:{standard:5,energy:3},result:'1 full art',motion:'rise'},
    {id:'art_to_foil',title:'Seconde transmutation',subtitle:'La lumière prend le relais',needs:{full_art:3,energy:3},result:'1 foil',motion:'foil'},
    {id:'foil_to_artfoil',title:'Troisième transmutation',subtitle:'L’image et la lumière fusionnent',needs:{foil:3,energy:3},result:'1 full art + foil',motion:'prism'},
    {id:'legendary',title:'Invocation légendaire',subtitle:'Une constellation de cartes',needs:{full_art:5,foil:5,energy:5},result:'1 légendaire',motion:'legendary'}
  ];
  const labels={standard:'commune',full_art:'full art',foil:'foil',any:'autre carte'};
  const finishLabels={standard:'Commune',full_art:'Full art',foil:'Foil',full_art_foil:'Full art + foil',legendary:'Légendaire'};
  const shopOffers=[
    {kind:'classic',title:'Classique',price:20,promise:'Le tirage habituel',mark:'sparkle'},
    {kind:'magician',title:'Magicien',price:25,promise:'1 sortilège garanti',mark:'moon'},
    {kind:'pleasure',title:'Plaisir',price:25,promise:'1 défi Mise à nue garanti',mark:'heart'},
    {kind:'relax',title:'Détente',price:25,promise:'1 massage ou soin garanti',mark:'flower'}
  ];
  const helperOffers=[
    {kind:'assassin',title:'Assassin',price:25,promise:'Détruit une carte au hasard de la main adverse',mark:'skull'},
    {kind:'druide',title:'Druide',price:18,promise:'Rend 7 jours de vie à une carte de ta main',mark:'clover'},
    {kind:'voleur',title:'Voleur',price:8,promise:'Vole 1 à 10 Éclats à l’autre joueur',mark:'exchange'}
  ];
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ui-${name}"/></svg>`;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function mount({getState,getRole,exchange,renderCard,onUpdate,onCollection,onShop,onRecycleMode,onActionMode,onRecycle,friendlyError}) {
    const trade=document.querySelector('#tradeView');
    const shop=document.querySelector('#shopView');
    const tradeMaker=trade.querySelector('.trade-maker');
    const tradeInbox=trade.querySelector('#pendingTrades').closest('.content-block');
    const actionTabs=document.createElement('div');actionTabs.className='action-hub-tabs';actionTabs.setAttribute('role','tablist');actionTabs.setAttribute('aria-label','Boutique');
    actionTabs.innerHTML='<button type="button" role="tab" data-action-hub="shop">Acheter</button><button type="button" role="tab" data-action-hub="recycle">Recycler</button><button type="button" role="tab" data-action-hub="bank">Banque</button>';
    shop.append(actionTabs);
    const panel=document.createElement('section');panel.className='economy-panel content-block';panel.id='economyPanel';
    shop.append(panel);
    const recyclePanel=document.createElement('section');recyclePanel.className='recycle-inline bulk-recycle-content';recyclePanel.hidden=true;shop.append(recyclePanel);
    let boosterShopOpen=true;
    panel.addEventListener('toggle',event=>{if(event.target.matches('.booster-shop-drawer'))boosterShopOpen=event.target.open;},true);
    const modal=document.createElement('dialog');modal.className='bank-dialog';modal.setAttribute('aria-label','Banque des cartes');
    modal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer la Banque">×</button><div class="bank-content"></div>';
    document.body.append(modal);
    const bulkModal=document.createElement('dialog');bulkModal.className='bulk-recycle-dialog';bulkModal.setAttribute('aria-label','Recycler plusieurs cartes');
    bulkModal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="bulk-recycle-content"></div>';
    document.body.append(bulkModal);
    const tour=document.createElement('dialog');tour.className='economy-tour';tour.setAttribute('aria-label','Nouveautés des Cartes à deux');
    tour.innerHTML='<div class="tour-content"></div>';document.body.append(tour);
    const headerBalance=document.querySelector('#headerShardButton');
    const shardInfo=document.createElement('dialog');shardInfo.className='shard-info-dialog';shardInfo.setAttribute('aria-label','Mes Éclats');
    shardInfo.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="shard-info-content"></div>';document.body.append(shardInfo);
    const helperModal=document.createElement('dialog');helperModal.className='bank-dialog';helperModal.setAttribute('aria-label','Les Complices');
    helperModal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="bank-content helper-content"></div>';document.body.append(helperModal);
    const state=()=>getState()?.economy;
    const cards=()=>getState()?.my_cards?.filter(c=>c.status==='available'&&new Date(c.expires_at)>new Date(getState().server_now))||[];
    const kind=card=>card.card_type==='energy'?'energy':card.finish;
    const textNeeds=needs=>Object.entries(needs).map(([key,n])=>key==='energy'?`${n} Énergie${n>1?'s':''} Bisou${n>1?'s':''}`:`${n} ${labels[key]}${n>1?'s':''}`).join(' + ');
    const cardOf=id=>cards().find(card=>card.id===id);
    let recipe=null,selected=new Set(),bankStep=0,bankReview=false,busy=false,bulkSelected=new Set(),lastSignature='',tourIndex=0,tourRole=null,actionMode='shop';
    function showActionMode(){
      tradeInbox.before(tradeMaker);tradeMaker.hidden=false;
      recyclePanel.hidden=actionMode!=='recycle';
      if(actionMode==='recycle')drawBulk();
      panel.hidden=actionMode==='recycle';
      panel.querySelector('.economy-shop-section')?.toggleAttribute('hidden',actionMode!=='shop');
      panel.querySelector('.economy-bank-section')?.toggleAttribute('hidden',actionMode!=='bank');
      actionTabs.querySelectorAll('[data-action-hub]').forEach(button=>{const selected=button.dataset.actionHub===actionMode;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
    }
    function countFor(r){const pool=cards();const counts={};for(const c of pool.filter(c=>c.card_type==='challenge'||c.card_type==='energy'))counts[kind(c)]=(counts[kind(c)]||0)+1;
      if(r.id==='reforge')return Math.min(counts.energy||0,3)===3&&pool.some(c=>c.card_type!=='energy');
      return Object.entries(r.needs).every(([k,n])=>(counts[k]||0)>=n);
    }
    function panelMarkup(){const e=state();if(!e)return '';
      const balance=e.balance||0,bought=Math.min(3,Number(e.weekly_boosters_bought||0));
      return `<div class="economy-shop-section">
        <details class="booster-shop-drawer" ${boosterShopOpen?'open':''}><summary class="economy-shop-head"><span><b>Choisis ton booster.</b><small>Jusqu’à 3 achats par semaine · ${bought}/3</small></span><i aria-hidden="true">${3-bought} restant${3-bought>1?'s':''} ⌄</i></summary>
        <div class="economy-shop">${shopOffers.map(offer=>`<div class="economy-buy economy-buy-${offer.kind}"><span class="shop-mark" aria-hidden="true">${icon(offer.mark)}</span><span class="shop-copy"><b>${offer.title}</b><small>${offer.promise}</small></span><button type="button" data-economy-buy="${offer.kind}" ${bought>=3||balance<offer.price?'disabled':''}>${bought>=3?'Épuisé':balance<offer.price?`Encore ${offer.price-balance}`:`${offer.price} Éclats →`}</button></div>`).join('')}</div></details><details class="helper-drawer"><summary>Les Complices <small>3 aides</small><span aria-hidden="true">⌄</span></summary><div class="economy-shop economy-helpers">${helperOffers.map(offer=>`<div class="economy-buy economy-buy-${offer.kind}"><span class="shop-mark" aria-hidden="true">${icon(offer.mark)}</span><span class="shop-copy"><b>${offer.title}</b><small>${offer.promise}</small></span><button type="button" data-helper-buy="${offer.kind}" ${balance<offer.price?'disabled':''}>${balance<offer.price?`Encore ${offer.price-balance}`:`${offer.price} Éclats →`}</button></div>`).join('')}</div></details></div>
        <div class="economy-bank-section"><div class="bank-head"><span class="eyebrow">LA BANQUE DES CARTES</span><h3>Changer le destin.</h3><p>Un échange par jour.</p></div>
        <div class="bank-offers">${recipes.map((r,i)=>`<button type="button" class="bank-offer bank-offer-${r.motion}" data-bank-open="${r.id}" ${e.bank_used_today||!countFor(r)?'disabled':''}><span class="bank-offer-mark" aria-hidden="true">${['░','↻','Ⅰ','Ⅱ','Ⅲ','✵'][i]}</span><span><strong>${r.title}</strong><small>${textNeeds(r.needs)} → ${r.result}</small></span><b aria-hidden="true">→</b></button>`).join('')}</div>
        ${e.bank_used_today?'<p class="bank-rest">La Banque rouvre demain à 5 h.</p>':''}
        <details class="economy-history"><summary>Mouvements d’Éclats <span aria-hidden="true">⌄</span></summary><div>${(e.events||[]).slice(0,12).map(item=>`<p><span>${({launch_bonus:'Cadeau de bienvenue',booster_shards:'Trouvé dans un booster',ritual_approved:'Défi validé',ritual_rejected:'Défi non validé',ritual_expired:'Défi expiré',ritual_passed:'Défi passé',card_sold:'Carte revendue',booster_bought:'Booster obtenu',bank_exchange:'Échange à la Banque',ritual_unanswered:'Demande sans réponse',helper_assassin:'Assassin engagé',helper_druide:'Druide engagé',helper_voleur:'Éclats volés',helper_stolen:'Éclats volés'})[item.type]||'Éclats'}</span><b>${item.amount>0?'+':''}${item.amount}</b></p>`).join('')||'<p>Aucun mouvement.</p>'}</div></details></div>`;
    }
    function refresh(){
      const e=state(),role=getRole();
      if(!e){panel.hidden=true;headerBalance.hidden=true;if(modal.open)modal.close();if(bulkModal.open)bulkModal.close();if(shardInfo.open)shardInfo.close();if(tour.open)tour.close();return;}
      headerBalance.hidden=false;document.querySelector('#headerShardCount').textContent=String(e.balance);headerBalance.setAttribute('aria-label',`${e.balance} Éclats. Voir mon solde et ses utilisations.`);
      if(shardInfo.open)drawShardInfo();
      const signature=JSON.stringify([role,e.balance,e.bank_used_today,e.weekly_boosters_bought,e.events?.[0]?.id,cards().map(c=>[c.id,c.sale_price])]);
      if(signature!==lastSignature){panel.innerHTML=panelMarkup();lastSignature=signature;}
      showActionMode();
      if(tourRole!==role){tourRole=role;tourIndex=0;}
      if(!localStorage.getItem(`les-cartes-economy-tour:v22:${role}`)&&!document.querySelector('dialog[open]')){drawTour();tour.showModal();}
    }
    const stageLabel=key=>({energy:'Énergie Bisou',any:'Carte à refrapper',standard:'Commune',full_art:'Full art',foil:'Foil'})[key]||key;
    const stagePhrase=(key,amount)=>key==='energy'?`${amount} Énergie${amount>1?'s':''} Bisou${amount>1?'s':''}`:key==='any'?`${amount} carte${amount>1?'s':''} à refrapper`:`${amount} ${stageLabel(key)}${amount>1?'s':''}`;
    function stages(){return recipe?Object.entries(recipe.needs).map(([key,amount])=>({key,amount})):[];}
    function stageCards(key){return cards().filter(c=>key==='energy'?c.card_type==='energy':key==='any'?c.card_type!=='energy':c.card_type==='challenge'&&c.finish===key).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));}
    function stageCount(key){return stageCards(key).filter(c=>selected.has(c.id)).length;}
    function stageReady(index){const stage=stages()[index];return !!stage&&stageCount(stage.key)===stage.amount;}
    function valid(){const parts=stages();return parts.length>0&&parts.every((_,i)=>stageReady(i))&&selected.size===parts.reduce((sum,part)=>sum+part.amount,0);}
    function resultRarity(){if(recipe?.id==='reforge'){const source=[...selected].map(cardOf).find(c=>c&&c.card_type!=='energy');return source?finishLabels[source.finish]||source.finish:'Même rareté';}return ({draw:'Aléatoire',common_to_art:'Full art',art_to_foil:'Foil',foil_to_artfoil:'Full art + foil',legendary:'Légendaire'})[recipe?.id]||'';}
    function drawSelection(){if(!recipe||!modal.open)return;
      const list=modal.querySelector('.bank-card-list'),scroll=list?.scrollTop||0,parts=stages(),current=parts[bankStep];
      const progress=`<div class="bank-progress" aria-label="Progression">${parts.map((part,i)=>`<button type="button" data-bank-step="${i}" class="bank-progress-step ${!bankReview&&bankStep===i?'current':''} ${stageReady(i)?'done':''}" ${i>0&&!parts.slice(0,i).every((_,n)=>stageReady(n))?'disabled':''}><small>ÉTAPE ${i+1}</small><strong>${escape(stageLabel(part.key))}</strong><em>${stageCount(part.key)}/${part.amount}</em></button>`).join('')}<span class="bank-progress-result"><small>RÉSULTAT</small><strong>${escape(resultRarity())}</strong></span></div>`;
      const intro=`<div class="bank-intro"><span class="eyebrow">BANQUE DES CARTES · ${escape(recipe.title)}</span><h2>${escape(recipe.result)}</h2><p>${escape(recipe.subtitle)}</p></div>${progress}`;
      if(bankReview){const groups=parts.map(part=>`<div class="bank-review-group"><span class="bank-rarity-tag">${escape(stageLabel(part.key))}</span><strong>${part.amount} carte${part.amount>1?'s':''}</strong><small>${stageCards(part.key).filter(c=>selected.has(c.id)).map(c=>escape(c.title)).join(' · ')}</small></div>`).join('');
        modal.querySelector('.bank-content').innerHTML=`${intro}<div class="bank-review"><span class="eyebrow">DERNIÈRE VÉRIFICATION</span><h3>Tu déposes</h3>${groups}<div class="bank-review-result"><small>TU REÇOIS</small><strong>${escape(recipe.result)}</strong><span class="bank-rarity-tag">${escape(resultRarity())}</span></div></div><p class="bank-warning">Les cartes déposées restent dans « Déjà vues ». La Refrappe peut rendre la même carte.</p><div class="bank-step-actions"><button type="button" data-bank-edit>Modifier</button><button type="button" class="bank-submit" data-bank-submit ${valid()?'':'disabled'}>Sceller l’échange →</button></div>`;return;
      }
      const pool=stageCards(current.key);
      modal.querySelector('.bank-content').innerHTML=`${intro}<div class="bank-stage-heading"><span class="eyebrow">ÉTAPE ${bankStep+1} / ${parts.length}</span><h3>Choisis ${escape(stagePhrase(current.key,current.amount))}</h3><span class="bank-rarity-tag">${escape(stageLabel(current.key))}</span></div><div class="bank-selected"><b>${stageCount(current.key)} / ${current.amount}</b><button type="button" data-bank-auto>Compléter cette étape</button></div><div class="bank-card-list">${pool.map(c=>`<button type="button" data-bank-card="${escape(c.id)}" class="bank-card-choice ${selected.has(c.id)?'selected':''}" aria-pressed="${selected.has(c.id)}"><span class="bank-card-sigil palette-${escape(c.palette)}" aria-hidden="true">${renderCard(c)}</span><span><strong>${escape(c.title)}</strong><small><span class="bank-card-rarity">${escape(c.card_type==='energy'?'Énergie Bisou':finishLabels[c.finish]||c.finish)}</span> · ${Math.max(1,Math.ceil((new Date(c.expires_at)-new Date(getState().server_now))/86400000))} j</small></span><i>${selected.has(c.id)?'✓':'+'}</i></button>`).join('')}</div><div class="bank-step-actions">${bankStep>0?'<button type="button" data-bank-previous>Retour</button>':''}<button type="button" class="bank-submit" data-bank-next ${stageReady(bankStep)?'':'disabled'}>${bankStep===parts.length-1?'Vérifier mes cartes →':`Continuer : ${escape(stageLabel(parts[bankStep+1].key))} →`}</button></div>`;
      modal.querySelector('.bank-card-list').scrollTop=scroll;
    }
    function openBank(id){recipe=recipes.find(r=>r.id===id);if(!recipe||state()?.bank_used_today)return;selected=new Set();bankStep=0;bankReview=false;modal.className='bank-dialog';modal.showModal();drawSelection();}
    function autoSelect(){const stage=stages()[bankStep];if(!stage)return;let left=stage.amount-stageCount(stage.key);
      for(const c of stageCards(stage.key)){if(left<=0)break;if(!selected.has(c.id)){selected.add(c.id);left--;}}
      drawSelection();
    }
    function toggleCard(id){const stage=stages()[bankStep],c=stageCards(stage?.key).find(item=>item.id===id);if(!c)return;
      if(selected.has(id))selected.delete(id);else if(stageCount(stage.key)<stage.amount)selected.add(id);
      drawSelection();
    }
    async function submit(){if(busy||!valid())return;busy=true;const r=recipe,ids=[...selected],oldId=state()?.last_bank_trade?.id;
      modal.querySelector('.bank-content').innerHTML=`<div class="bank-ceremony bank-${r.motion}"><span class="eyebrow">${escape(r.title)}</span><div class="bank-vortex" aria-hidden="true">${Array.from({length:Math.min(ids.length,15)},(_,i)=>`<i style="--i:${i};--n:${Math.min(ids.length,15)}"></i>`).join('')}<span class="bank-core"></span></div><h2>Les cartes se transforment…</h2></div>`;
      try {
        let result;
        try{result=await exchange('bank_exchange',{recipe:r.id,card_ids:ids});}
        catch(error){const synced=await exchange('sync');if(synced.economy?.last_bank_trade?.id===oldId)throw error;result=synced;}
        const rewardId=result.economy?.last_bank_trade?.reward_card_id;
        const reward=result.my_cards?.find(c=>c.id===rewardId);
        await wait(reduced.matches?80:r.motion==='legendary'?2100:r.motion==='draw'?1500:1300);
        if(modal.open){modal.querySelector('.bank-content').innerHTML=`<div class="bank-result bank-result-${r.motion}"><span class="eyebrow">UNE NOUVELLE CARTE</span><h2>${escape(reward?.title||'Dans ta collection')}</h2>${reward?`<div class="bank-reward-card">${renderCard(reward)}</div>`:''}<button class="bank-submit" type="button" data-bank-finish>Voir ma collection →</button></div>`;}
        onUpdate();
      }catch(error){modal.querySelector('.bank-content').innerHTML=`<div class="bank-error"><h2>Échange interrompu</h2><p>${escape(friendlyError(error))}</p><button class="bank-submit" type="button" data-bank-back>Revoir les cartes</button></div>`;}
      finally{busy=false;}
    }
    function recycle(id){const c=cardOf(id);if(!c||busy)return;if(c.finish==='standard')return openBulk(id);onRecycle([c]);}
    function openBulk(selectedId){if(busy)return;bulkSelected=new Set(typeof selectedId==='string'?[selectedId]:[]);bulkModal.className='bulk-recycle-dialog';bulkModal.showModal();drawBulk();}
    function drawBulk(){if((!bulkModal.open&&actionMode!=='recycle')||busy)return;const target=bulkModal.open?bulkModal.querySelector('.bulk-recycle-content'):recyclePanel;const scroll=target.querySelector('.bulk-recycle-list')?.scrollTop||0;const pool=cards().sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
      bulkSelected=new Set([...bulkSelected].filter(id=>pool.some(c=>c.id===id)));
      const picked=pool.filter(c=>bulkSelected.has(c.id)),commons=picked.filter(c=>c.finish==='standard').length,total=Math.floor(commons/3)+picked.filter(c=>c.finish!=='standard').reduce((sum,c)=>sum+c.sale_price,0);
      target.innerHTML=`<span class="eyebrow">COMPTOIR DES ÉCLATS</span><h2>Trois cartes. Un Éclat.</h2><p>Choisis les exemplaires à céder. Communes et Énergies : 3 cartes → 1 Éclat. Découvertes conservées.</p><div class="recycle-triplet" aria-label="Cartes du lot">${[0,1,2].map(i=>`<span class="recycle-triplet-slot">${picked.filter(c=>c.finish==='standard')[i]?renderCard(picked.filter(c=>c.finish==='standard')[i]):`<i>${i+1}</i>`}</span>`).join('')}</div><div class="bulk-recycle-tools"><button type="button" data-bulk-all>Tout sélectionner</button><button type="button" data-bulk-clear>Effacer</button></div><div class="bulk-recycle-list">${pool.map((c,i)=>`<button type="button" class="bulk-recycle-row ${bulkSelected.has(c.id)?'selected':''}" style="--row-index:${Math.min(i,8)}" data-bulk-card="${escape(c.id)}" aria-pressed="${bulkSelected.has(c.id)}"><span class="bank-card-sigil palette-${escape(c.palette)}" aria-hidden="true">${renderCard(c)}</span><span class="bulk-recycle-card-copy"><strong>${escape(c.title)}</strong><small>${escape(finishLabels[c.finish]||c.finish)} · ${Math.max(1,Math.ceil((new Date(c.expires_at)-new Date(getState().server_now))/86400000))} j</small></span><b>${c.finish==='standard'?'3 → 1':`+${c.sale_price}`}</b><i>${bulkSelected.has(c.id)?'✓':'+'}</i></button>`).join('')}</div><div class="bulk-recycle-total"><span>${picked.length} carte${picked.length>1?'s':''} sélectionnée${picked.length>1?'s':''}</span><strong>+${total} Éclat${total>1?'s':''}</strong></div><button type="button" class="bank-submit" data-bulk-confirm ${!picked.length||picked.length>50||commons%3!==0?'disabled':''}>${commons%3?`Encore ${3-commons%3} commune${3-commons%3>1?'s':''} ou Énergie${3-commons%3>1?'s':''}`:'Recycler le lot →'}</button>`;
      target.querySelector('.bulk-recycle-list').scrollTop=scroll;
    }
    function confirmBulk(){if(busy)return;const picked=cards().filter(c=>bulkSelected.has(c.id));if(!picked.length||picked.length>50||picked.filter(c=>c.finish==='standard').length%3)return;if(bulkModal.open)bulkModal.close();onRecycle(picked);}
    function drawShardInfo(){const e=state();if(!e)return;shardInfo.querySelector('.shard-info-content').innerHTML=`<span class="eyebrow">MON SOLDE</span><div class="shard-info-value"><i aria-hidden="true">✦</i><strong>${e.balance>0?'+':''}${e.balance}</strong><span>Éclats</span></div><h2>Mes Éclats.</h2><p>Les défis validés rapportent de 1 à 10 Éclats selon leur rareté. Tu peux aussi recycler les cartes de ta main ou en trouver dans un booster.</p><div class="shard-info-uses"><span><b>20 ou 25 Éclats</b><small>Jusqu’à 3 boosters par semaine, classiques ou à thème</small></span><span><b>La Banque</b><small>Échange des cartes et des Énergies Bisous</small></span></div><p class="shard-info-note">Un défi laissé passer peut réduire le solde selon sa rareté, jusqu’à −12.</p><button type="button" class="bank-submit" data-shard-actions>Ouvrir la Boutique →</button>`;}
    async function buy(kind){const offer=shopOffers.find(item=>item.kind===kind);if(!offer||busy||state()?.balance<offer.price||Number(state()?.weekly_boosters_bought||0)>=3)return;busy=true;
      const button=panel.querySelector(`[data-economy-buy="${kind}"]`);button.disabled=true;button.textContent='Un instant…';
      try{await exchange('buy_booster',{kind});headerBalance.classList.add('economy-bought');onUpdate();await wait(reduced.matches?80:850);headerBalance.classList.remove('economy-bought');document.querySelector('[data-nav="today"]')?.click();}
      catch(error){button.textContent=friendlyError(error);await wait(1500);onUpdate();}
      finally{busy=false;}
    }
    async function useHelper(kind,cardId){
      const offer=helperOffers.find(item=>item.kind===kind);
      if(!offer||busy||state()?.balance<offer.price)return;busy=true;
      const before=new Set((state()?.events||[]).map(event=>event.id));
      const matches=event=>event.type===`helper_${kind}`&&!before.has(event.id)&&(!cardId||event.card_id===cardId);
      try{
        let result;
        try{result=await exchange('use_helper',{kind,card_id:cardId});}
        catch(error){const synced=await exchange('sync');if(!(synced?.economy?.events||[]).some(matches))throw error;result=synced;}
        const ev=(result.economy?.events||[]).find(matches);
        const detail=ev?.detail||{};
        let title='',body='';
        if(kind==='assassin'){title='Assassin exécuté.';body=detail.title?`« ${detail.title} » a été détruite de la main de l’autre joueur.`:'Une carte adverse a été détruite.';}
        else if(kind==='druide'){title='Druide invoqué.';body=detail.title?`« ${detail.title} » repart pour 7 jours.`:'Ta carte repart pour 7 jours.';}
        else{title='Vol commis.';body=`Tu as volé ${detail.stolen??'?'} Éclat${(detail.stolen??2)>1?'s':''} à l’autre joueur.`;}
        helperModal.className='bank-dialog';
        helperModal.querySelector('.helper-content').innerHTML=`<div class="bank-result bank-result-draw"><span class="eyebrow">LES COMPLICES</span><h2>${escape(title)}</h2><p>${escape(body)}</p><button class="bank-submit" type="button" data-helper-finish>Retour à la Boutique →</button></div>`;
        if(!helperModal.open)helperModal.showModal();
        onUpdate();
      }catch(error){
        helperModal.className='bank-dialog';
        helperModal.querySelector('.helper-content').innerHTML=`<div class="bank-error"><h2>Complice interrompu</h2><p>${escape(friendlyError(error))}</p><button class="bank-submit" type="button" data-helper-finish>Retour à la Boutique →</button></div>`;
        if(!helperModal.open)helperModal.showModal();
      }
      finally{busy=false;}
    }
    function openDruidePicker(){
      const pool=cards().slice().sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
      helperModal.className='bank-dialog';
      helperModal.querySelector('.helper-content').innerHTML=`<div class="bank-intro"><span class="eyebrow">LE DRUIDE · 18 ÉCLATS</span><h2>Choisis la carte à sauver.</h2><p>Le compteur repart à 7 jours.</p></div>
        <div class="bank-card-list">${pool.map(c=>`<button type="button" data-helper-card="${escape(c.id)}" class="bank-card-choice"><span class="bank-card-sigil palette-${escape(c.palette)}" aria-hidden="true">${renderCard(c)}</span><span><strong>${escape(c.title)}</strong><small><span class="bank-card-rarity">${escape(finishLabels[c.finish]||c.finish)}</span> · ${Math.max(1,Math.ceil((new Date(c.expires_at)-new Date(getState().server_now))/3600000))} h restantes</small></span><i>→</i></button>`).join('')||'<p class="bulk-recycle-error">Aucune carte à sauver pour l’instant.</p>'}</div>
        <div class="bank-step-actions"><button type="button" data-helper-finish>Annuler</button></div>`;
      helperModal.showModal();
    }
    async function buyHelper(kind){
      const selected=helperOffers.find(item=>item.kind===kind);
      if(!selected||busy||state()?.balance<selected.price)return;
      if(kind==='druide')return openDruidePicker();
      const offer=helperOffers.find(item=>item.kind===kind);
      const confirm=await new Promise(resolve=>{
        helperModal.className='bank-dialog';
        helperModal.querySelector('.helper-content').innerHTML=`<div class="bank-intro"><span class="eyebrow">${escape(offer.title.toUpperCase())} · ${offer.price} ÉCLATS</span><h2>${escape(offer.title)}.</h2><p>${escape(offer.promise)}.</p></div><div class="bank-step-actions"><button type="button" data-helper-finish>Annuler</button><button type="button" class="bank-submit" data-helper-confirm>Engager le ${escape(offer.title.toLowerCase())} →</button></div>`;
        helperModal._resolve=resolve;
        helperModal.showModal();
      });
      if(confirm)useHelper(kind);
    }
    const slides=[
      {icon:'sparkle',title:'Cinq surprises.',copy:'Chaque booster contient au moins trois cartes. Les deux autres places peuvent révéler des Éclats.'},
      {icon:'heart',title:'Un défi à deux.',copy:'Après un rituel, demande sa validation. L’autre confirme et les Éclats suivent la rareté. Une carte non réalisée peut coûter des Éclats, jusqu’à −12.'},
      {icon:'cards',title:'Revendre une carte.',copy:'Dans Boutique, échange un exemplaire contre des Éclats. Le prix dépend de sa rareté et du temps qu’il lui reste.'},
      {icon:'wand',title:'La Banque des cartes.',copy:'Dépose des cartes et des Énergies Bisous pour tenter un nouveau tirage, une Refrappe ou une transmutation. Une fois par jour.'},
      {icon:'skull',title:'Les Complices.',copy:'Assassin, Druide ou Voleur : une intervention directe dans la partie de l’autre — ou la tienne — contre des Éclats.'}
    ];
    function drawTour(){const s=slides[tourIndex];tour.querySelector('.tour-content').innerHTML=`<button type="button" class="tour-skip" data-tour-skip>Passer</button><div class="tour-visual tour-visual-${tourIndex}" aria-hidden="true">${icon(s.icon)}${Array.from({length:5},(_,i)=>`<b style="--i:${i}"></b>`).join('')}</div><div class="tour-pages" aria-label="Étape ${tourIndex+1} sur ${slides.length}">${slides.map((_,i)=>`<i class="${i===tourIndex?'active':''}"></i>`).join('')}</div><h2>${escape(s.title)}</h2><p>${escape(s.copy)}</p><button type="button" class="bank-submit" data-tour-next>${tourIndex===slides.length-1?'C’est parti':'Suivant →'}</button>`;}
    function closeTour(){localStorage.setItem(`les-cartes-economy-tour:v22:${getRole()}`,'1');tour.close();}
    document.addEventListener('click',event=>{
      const purchase=event.target.closest('[data-economy-buy]');if(purchase)return void buy(purchase.dataset.economyBuy);
      const helperBuy=event.target.closest('[data-helper-buy]');if(helperBuy)return void buyHelper(helperBuy.dataset.helperBuy);
      const opener=event.target.closest('[data-bank-open]');if(opener)return openBank(opener.dataset.bankOpen);
    });
    actionTabs.addEventListener('click',event=>{const button=event.target.closest('[data-action-hub]');if(!button)return;actionMode=button.dataset.actionHub;showActionMode();});
    headerBalance.addEventListener('click',()=>{drawShardInfo();shardInfo.showModal();});
    helperModal.addEventListener('click',event=>{
      if(event.target.closest('.bank-close')){helperModal._resolve?.(false);helperModal._resolve=null;return helperModal.close();}
      if(event.target.closest('[data-helper-finish]')){helperModal._resolve?.(false);helperModal._resolve=null;return helperModal.close();}
      if(event.target.closest('[data-helper-confirm]')){helperModal._resolve?.(true);helperModal._resolve=null;return helperModal.close();}
      const pick=event.target.closest('[data-helper-card]');
      if(pick&&!busy){helperModal.close();return void useHelper('druide',pick.dataset.helperCard);}
    });
    helperModal.addEventListener('close',()=>{helperModal._resolve?.(false);helperModal._resolve=null;});
    shardInfo.addEventListener('click',event=>{if(event.target.closest('.bank-close'))return shardInfo.close();if(event.target.closest('[data-shard-actions]')){shardInfo.close();actionMode='shop';onShop();showActionMode();}});
    modal.addEventListener('click',event=>{if(event.target.closest('.bank-close')&&!busy)return modal.close();if(busy)return;
      if(event.target.closest('[data-bank-auto]'))return autoSelect();
      const pick=event.target.closest('[data-bank-card]');if(pick)return toggleCard(pick.dataset.bankCard);
      const step=event.target.closest('[data-bank-step]');if(step&&!step.disabled){bankStep=Number(step.dataset.bankStep);bankReview=false;return drawSelection();}
      if(event.target.closest('[data-bank-previous]')){bankStep=Math.max(0,bankStep-1);return drawSelection();}
      if(event.target.closest('[data-bank-next]')&&stageReady(bankStep)){if(bankStep===stages().length-1)bankReview=true;else bankStep++;return drawSelection();}
      if(event.target.closest('[data-bank-edit]')){bankReview=false;return drawSelection();}
      if(event.target.closest('[data-bank-submit]')&&bankReview)return void submit();
      if(event.target.closest('[data-bank-back]')){bankReview=false;return drawSelection();}
      if(event.target.closest('[data-bank-finish]')){modal.close();onCollection();}
    });
    modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    const handleBulkClick=event=>{if(event.target.closest('.bank-close')&&!busy)return bulkModal.close();const pick=event.target.closest('[data-bulk-card]');if(pick&&!busy){const id=pick.dataset.bulkCard;if(bulkSelected.has(id))bulkSelected.delete(id);else bulkSelected.add(id);return drawBulk();}if(event.target.closest('[data-bulk-all]')&&!busy){bulkSelected=new Set(cards().slice(0,50).map(c=>c.id));return drawBulk();}if(event.target.closest('[data-bulk-clear]')&&!busy){bulkSelected.clear();return drawBulk();}if(event.target.closest('[data-bulk-confirm]'))return void confirmBulk();if(event.target.closest('[data-bulk-finish]'))bulkModal.close();};
    bulkModal.addEventListener('click',handleBulkClick);recyclePanel.addEventListener('click',handleBulkClick);
    bulkModal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    bulkModal.addEventListener('close',()=>bulkSelected.clear());
    tour.addEventListener('click',event=>{if(event.target.closest('[data-tour-skip]'))return closeTour();if(event.target.closest('[data-tour-next]')){if(tourIndex===slides.length-1)closeTour();else{tourIndex++;drawTour();}}});
    tour.addEventListener('cancel',event=>{event.preventDefault();closeTour();});
    modal.addEventListener('close',()=>{recipe=null;selected.clear();bankStep=0;bankReview=false;});
    return Object.freeze({refresh,recycle,openBulk,
      enterActions:()=>{tradeInbox.before(tradeMaker);tradeMaker.hidden=false;onActionMode();},
      enterShop:()=>{actionMode='shop';showActionMode();},
      isOpen:()=>modal.open||bulkModal.open||shardInfo.open||tour.open||helperModal.open});
  }
  window.CardEconomy=Object.freeze({mount});
})();
