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
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function mount({getState,getRole,exchange,renderCard,onUpdate,onCollection,onActions,friendlyError}) {
    const trade=document.querySelector('#tradeView');
    const panel=document.createElement('section');panel.className='economy-panel content-block';panel.id='economyPanel';
    trade.querySelector('.trade-maker').after(panel);
    const modal=document.createElement('dialog');modal.className='bank-dialog';modal.setAttribute('aria-label','Banque des cartes');
    modal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer la Banque">×</button><div class="bank-content"></div>';
    document.body.append(modal);
    const saleModal=document.createElement('dialog');saleModal.className='sale-dialog';saleModal.setAttribute('aria-label','Revendre une carte');
    saleModal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="sale-content"></div>';
    document.body.append(saleModal);
    const bulkModal=document.createElement('dialog');bulkModal.className='bulk-sale-dialog';bulkModal.setAttribute('aria-label','Revendre plusieurs cartes');
    bulkModal.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="bulk-sale-content"></div>';
    document.body.append(bulkModal);
    const tour=document.createElement('dialog');tour.className='economy-tour';tour.setAttribute('aria-label','Nouveautés des Cartes à deux');
    tour.innerHTML='<div class="tour-content"></div>';document.body.append(tour);
    const headerBalance=document.querySelector('#headerShardButton');
    const shardInfo=document.createElement('dialog');shardInfo.className='shard-info-dialog';shardInfo.setAttribute('aria-label','Mes Éclats');
    shardInfo.innerHTML='<button class="bank-close" type="button" aria-label="Fermer">×</button><div class="shard-info-content"></div>';document.body.append(shardInfo);
    const state=()=>getState()?.economy;
    const cards=()=>getState()?.my_cards?.filter(c=>c.status==='available'&&new Date(c.expires_at)>new Date(getState().server_now))||[];
    const kind=card=>card.card_type==='energy'?'energy':card.finish;
    const textNeeds=needs=>Object.entries(needs).map(([key,n])=>key==='energy'?`${n} Énergie${n>1?'s':''} Bisou${n>1?'s':''}`:`${n} ${labels[key]}${n>1?'s':''}`).join(' + ');
    const cardOf=id=>cards().find(card=>card.id===id);
    let recipe=null,selected=new Set(),busy=false,saleCard=null,bulkSelected=new Set(),lastSignature='',tourIndex=0,tourRole=null;
    function countFor(r){const pool=cards();const counts={};for(const c of pool.filter(c=>c.card_type==='challenge'||c.card_type==='energy'))counts[kind(c)]=(counts[kind(c)]||0)+1;
      if(r.id==='reforge')return Math.min(counts.energy||0,3)===3&&pool.some(c=>c.card_type!=='energy');
      return Object.entries(r.needs).every(([k,n])=>(counts[k]||0)>=n);
    }
    function panelMarkup(){const e=state();if(!e)return '';
      const balance=e.balance||0,canBuy=balance>=12&&!e.weekly_booster_used;
      return `<div class="economy-head"><div><span class="eyebrow">LA PETITE ÉCONOMIE</span><h3>Mes Éclats.</h3></div><div class="economy-balance ${balance<0?'is-negative':''}" aria-label="Solde ${balance} Éclats"><i aria-hidden="true"></i><strong>${balance>0?'+':''}${balance}</strong></div></div>
        <div class="economy-buy"><span><b>Booster supplémentaire</b><small>12 Éclats · 1 par semaine</small></span><button type="button" data-economy-buy ${canBuy?'':'disabled'}>${e.weekly_booster_used?'Déjà obtenu':balance<12?`Encore ${12-balance}`:'Obtenir →'}</button></div>
        <div class="bank-head"><span class="eyebrow">LA BANQUE DES CARTES</span><h3>Changer le destin.</h3><p>Les Énergies Bisous servent aux échanges. Un passage par jour.</p></div>
        <div class="bank-offers">${recipes.map((r,i)=>`<button type="button" class="bank-offer bank-offer-${r.motion}" data-bank-open="${r.id}" ${e.bank_used_today||!countFor(r)?'disabled':''}><span class="bank-offer-mark" aria-hidden="true">${['◐','↻','Ⅰ','Ⅱ','Ⅲ','✵'][i]}</span><span><strong>${r.title}</strong><small>${textNeeds(r.needs)} → ${r.result}</small></span><b aria-hidden="true">→</b></button>`).join('')}</div>
        ${e.bank_used_today?'<p class="bank-rest">La Banque rouvre demain à 5 h.</p>':''}
        <details class="economy-history"><summary>Mouvements d’Éclats <span aria-hidden="true">⌄</span></summary><div>${(e.events||[]).slice(0,12).map(item=>`<p><span>${({launch_bonus:'Cadeau de bienvenue',booster_shards:'Trouvé dans un booster',ritual_approved:'Défi validé',ritual_rejected:'Défi non validé',ritual_expired:'Défi expiré',ritual_passed:'Défi passé',card_sold:'Carte revendue',booster_bought:'Booster obtenu',bank_exchange:'Échange à la Banque',ritual_unanswered:'Demande sans réponse'})[item.type]||'Éclats'}</span><b>${item.amount>0?'+':''}${item.amount}</b></p>`).join('')||'<p>Aucun mouvement.</p>'}</div></details>`;
    }
    function refresh(){
      const e=state(),role=getRole();
      if(!e){panel.hidden=true;headerBalance.hidden=true;if(modal.open)modal.close();if(saleModal.open)saleModal.close();if(bulkModal.open)bulkModal.close();if(shardInfo.open)shardInfo.close();if(tour.open)tour.close();return;}
      panel.hidden=false;
      headerBalance.hidden=false;document.querySelector('#headerShardCount').textContent=String(e.balance);
      if(shardInfo.open)drawShardInfo();
      const signature=JSON.stringify([role,e.balance,e.bank_used_today,e.weekly_booster_used,e.events?.[0]?.id,cards().map(c=>[c.id,c.sale_price])]);
      if(signature!==lastSignature){panel.innerHTML=panelMarkup();lastSignature=signature;}
      if(tourRole!==role){tourRole=role;tourIndex=0;}
      if(!localStorage.getItem(`les-cartes-economy-tour:v18:${role}`)&&!document.querySelector('dialog[open]')){drawTour();tour.showModal();}
    }
    function eligible(r){return cards().filter(c=>c.card_type==='energy'||r.id==='reforge'&&c.card_type!=='energy'||r.id==='legendary'&&c.card_type==='challenge'&&['full_art','foil'].includes(c.finish)||r.id==='common_to_art'&&c.card_type==='challenge'&&c.finish==='standard'||r.id==='art_to_foil'&&c.card_type==='challenge'&&c.finish==='full_art'||r.id==='foil_to_artfoil'&&c.card_type==='challenge'&&c.finish==='foil');}
    function valid(){if(!recipe)return false;const picked=[...selected].map(cardOf).filter(Boolean),groups={};picked.forEach(c=>groups[kind(c)]=(groups[kind(c)]||0)+1);
      if(recipe.id==='reforge')return picked.length===4&&groups.energy===3&&picked.filter(c=>c.card_type!=='energy').length===1;
      return picked.length===Object.values(recipe.needs).reduce((a,b)=>a+b,0)&&Object.entries(recipe.needs).every(([key,n])=>groups[key]===n);
    }
    function drawSelection(){if(!recipe||!modal.open)return;const pool=eligible(recipe),picked=[...selected].map(cardOf).filter(Boolean);
      modal.querySelector('.bank-content').innerHTML=`<div class="bank-intro"><span class="eyebrow">BANQUE DES CARTES · ${escape(recipe.title)}</span><h2>${escape(recipe.result)}</h2><p>${escape(recipe.subtitle)}</p></div><div class="bank-recipe"><span>À déposer</span><strong>${escape(textNeeds(recipe.needs))}</strong></div><div class="bank-selected"><b>${picked.length} / ${Object.values(recipe.needs).reduce((a,b)=>a+b,0)}</b><button type="button" data-bank-auto>Choisir automatiquement</button></div><div class="bank-card-list">${pool.map(c=>`<button type="button" data-bank-card="${escape(c.id)}" class="bank-card-choice ${selected.has(c.id)?'selected':''}" aria-pressed="${selected.has(c.id)}"><span class="bank-card-sigil palette-${escape(c.palette)}" aria-hidden="true">${escape(c.symbol||'✧')}</span><span><strong>${escape(c.title)}</strong><small>${escape(c.card_type==='energy'?'Énergie Bisous':finishLabels[c.finish]||c.finish)} · ${Math.max(1,Math.ceil((new Date(c.expires_at)-new Date(getState().server_now))/86400000))} j</small></span><i>${selected.has(c.id)?'✓':'+'}</i></button>`).join('')}</div><p class="bank-warning">Les cartes déposées restent dans « Déjà vues ». La Refrappe peut rendre la même carte.</p><button type="button" class="bank-submit" data-bank-submit ${valid()?'':'disabled'}>Sceller l’échange →</button>`;
    }
    function openBank(id){recipe=recipes.find(r=>r.id===id);if(!recipe||state()?.bank_used_today)return;selected=new Set();modal.className='bank-dialog';modal.showModal();drawSelection();}
    function autoSelect(){selected.clear();const needed={...recipe.needs};if(recipe.id==='reforge')needed.any=1;
      for(const c of eligible(recipe).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at))){const k=c.card_type==='energy'?'energy':recipe.id==='reforge'?'any':kind(c);if(needed[k]>0){selected.add(c.id);needed[k]--;}}
      drawSelection();
    }
    function toggleCard(id){const c=cardOf(id);if(!c)return;if(selected.has(id)){selected.delete(id);return drawSelection();}
      const k=c.card_type==='energy'?'energy':recipe.id==='reforge'?'any':kind(c);
      const max=recipe.needs[k]||0,count=[...selected].map(cardOf).filter(item=>item&&(item.card_type==='energy'?'energy':recipe.id==='reforge'?'any':kind(item))===k).length;
      if(count<max)selected.add(id);drawSelection();
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
    function sell(id){const c=cardOf(id);if(!c||busy)return;saleCard=c;saleModal.className='sale-dialog';saleModal.querySelector('.sale-content').innerHTML=`<span class="eyebrow">COMPTOIR DES ÉCLATS</span><h2>Revendre cet exemplaire ?</h2><div class="sale-card-stage">${renderCard(c)}</div><div class="sale-quote"><span>Prix du jour</span><strong>+${c.sale_price} Éclat${c.sale_price>1?'s':''}</strong></div><p>La carte quitte ta main. Sa découverte reste dans « Déjà vues ».</p><button type="button" class="bank-submit" data-sale-confirm>Revendre →</button>`;saleModal.showModal();}
    function openBulk(){if(busy||cards().length<2)return;bulkSelected=new Set();bulkModal.className='bulk-sale-dialog';bulkModal.showModal();drawBulk();}
    function drawBulk(){if(!bulkModal.open||busy)return;const scroll=bulkModal.querySelector('.bulk-sale-list')?.scrollTop||0;const pool=cards().sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
      bulkSelected=new Set([...bulkSelected].filter(id=>pool.some(c=>c.id===id)));
      const picked=pool.filter(c=>bulkSelected.has(c.id)),total=picked.reduce((sum,c)=>sum+c.sale_price,0);
      bulkModal.querySelector('.bulk-sale-content').innerHTML=`<span class="eyebrow">COMPTOIR DES ÉCLATS</span><h2>Revendre en lot.</h2><p>Choisis les exemplaires à céder. Leur découverte reste dans « Déjà vues ».</p><div class="bulk-sale-tools"><button type="button" data-bulk-all>Tout sélectionner</button><button type="button" data-bulk-clear>Effacer</button></div><div class="bulk-sale-list">${pool.map((c,i)=>`<button type="button" class="bulk-sale-row ${bulkSelected.has(c.id)?'selected':''}" style="--row-index:${Math.min(i,8)}" data-bulk-card="${escape(c.id)}" aria-pressed="${bulkSelected.has(c.id)}"><span class="bank-card-sigil palette-${escape(c.palette)}" aria-hidden="true">${escape(c.symbol||'✧')}</span><span class="bulk-sale-card-copy"><strong>${escape(c.title)}</strong><small>${escape(finishLabels[c.finish]||c.finish)} · ${Math.max(1,Math.ceil((new Date(c.expires_at)-new Date(getState().server_now))/86400000))} j</small></span><b>+${c.sale_price}</b><i>${bulkSelected.has(c.id)?'✓':'+'}</i></button>`).join('')}</div><div class="bulk-sale-total"><span>${picked.length} carte${picked.length>1?'s':''} sélectionnée${picked.length>1?'s':''}</span><strong>+${total} Éclat${total>1?'s':''}</strong></div><button type="button" class="bank-submit" data-bulk-confirm ${picked.length<2?'disabled':''}>Revendre le lot →</button>`;
      bulkModal.querySelector('.bulk-sale-list').scrollTop=scroll;
    }
    async function confirmBulk(){if(busy||bulkSelected.size<2)return;const ids=[...bulkSelected],before=state()?.balance||0;busy=true;
      const button=bulkModal.querySelector('[data-bulk-confirm]');button.disabled=true;button.textContent='Revente en cours…';
      try{
        let result;
        try{result=await exchange('sell_cards',{card_ids:ids});}
        catch(error){const synced=await exchange('sync');if(ids.some(id=>synced.my_cards.some(c=>c.id===id)))throw error;result=synced;}
        const amount=result.economy.balance-before;
        bulkModal.classList.add('is-selling');await wait(reduced.matches?80:1050);
        bulkModal.querySelector('.bulk-sale-content').innerHTML=`<div class="bulk-sale-result"><span class="eyebrow">REVENTE TERMINÉE</span><div class="shard-info-value"><i aria-hidden="true">✦</i><strong>+${amount}</strong></div><h2>${ids.length} cartes revendues.</h2><p>Leurs découvertes restent dans ta collection.</p><button type="button" class="bank-submit" data-bulk-finish>Retour aux Actions →</button></div>`;
        onUpdate();
      }catch(error){button.disabled=false;button.textContent='Revendre le lot →';bulkModal.querySelector('.bulk-sale-total').insertAdjacentHTML('beforebegin',`<p class="bulk-sale-error">${escape(friendlyError(error))}</p>`);}
      finally{busy=false;}
    }
    function drawShardInfo(){const e=state();if(!e)return;shardInfo.querySelector('.shard-info-content').innerHTML=`<span class="eyebrow">MON SOLDE</span><div class="shard-info-value"><i aria-hidden="true">✦</i><strong>${e.balance>0?'+':''}${e.balance}</strong><span>Éclats</span></div><h2>Mes Éclats.</h2><p>Les défis validés rapportent de 1 à 10 Éclats selon leur rareté. Tu peux aussi revendre les cartes de ta main ou en trouver dans un booster.</p><div class="shard-info-uses"><span><b>12 Éclats</b><small>Un booster supplémentaire par semaine</small></span><span><b>La Banque</b><small>Échange des cartes et des Énergies Bisous</small></span></div><p class="shard-info-note">Un défi laissé passer peut réduire le solde, jusqu’à −12. Mise à nue reste sans malus.</p><button type="button" class="bank-submit" data-shard-actions>Voir les Actions →</button>`;}
    async function confirmSale(){if(busy||!saleCard)return;busy=true;const id=saleCard.id,price=saleCard.sale_price;
      const button=saleModal.querySelector('[data-sale-confirm]');button.disabled=true;button.textContent='Un instant…';
      try{await exchange('sell_card',{card_id:id});saleModal.classList.add('is-selling');saleModal.querySelector('.sale-quote strong').textContent=`+${price} Éclat${price>1?'s':''}`;await wait(reduced.matches?80:1050);if(saleModal.open)saleModal.close();onUpdate();}
      catch(error){button.disabled=false;button.textContent='Revendre →';saleModal.querySelector('p').textContent=friendlyError(error);}
      finally{busy=false;saleCard=null;}
    }
    async function buy(){if(busy||state()?.balance<12||state()?.weekly_booster_used)return;busy=true;
      const button=panel.querySelector('[data-economy-buy]');button.disabled=true;button.textContent='Un instant…';
      try{await exchange('buy_booster');panel.classList.add('economy-bought');onUpdate();await wait(reduced.matches?80:850);panel.classList.remove('economy-bought');document.querySelector('[data-nav="today"]')?.click();}
      catch(error){button.textContent=friendlyError(error);await wait(1500);onUpdate();}
      finally{busy=false;}
    }
    const slides=[
      {icon:'✦',title:'Cinq surprises.',copy:'Chaque booster contient au moins trois cartes. Les deux autres places peuvent révéler des Éclats.'},
      {icon:'♡',title:'Un défi à deux.',copy:'Après un rituel, demande sa validation. L’autre confirme et les Éclats suivent la rareté. Une carte non réalisée peut coûter des Éclats, jusqu’à −12.'},
      {icon:'◌',title:'Revendre une carte.',copy:'Dans Actions, échange un exemplaire contre des Éclats. Le prix dépend de sa rareté et du temps qu’il lui reste.'},
      {icon:'✵',title:'La Banque des cartes.',copy:'Dépose des cartes et des Énergies Bisous pour tenter un nouveau tirage, une Refrappe ou une transmutation. Une fois par jour.'}
    ];
    function drawTour(){const s=slides[tourIndex];tour.querySelector('.tour-content').innerHTML=`<button type="button" class="tour-skip" data-tour-skip>Passer</button><div class="tour-visual tour-visual-${tourIndex}" aria-hidden="true"><i>${s.icon}</i>${Array.from({length:5},(_,i)=>`<b style="--i:${i}"></b>`).join('')}</div><div class="tour-pages" aria-label="Étape ${tourIndex+1} sur ${slides.length}">${slides.map((_,i)=>`<i class="${i===tourIndex?'active':''}"></i>`).join('')}</div><h2>${escape(s.title)}</h2><p>${escape(s.copy)}</p><button type="button" class="bank-submit" data-tour-next>${tourIndex===slides.length-1?'C’est parti':'Suivant →'}</button>`;}
    function closeTour(){localStorage.setItem(`les-cartes-economy-tour:v18:${getRole()}`,'1');tour.close();}
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-economy-buy]'))return void buy();
      const opener=event.target.closest('[data-bank-open]');if(opener)return openBank(opener.dataset.bankOpen);
    });
    headerBalance.addEventListener('click',()=>{drawShardInfo();shardInfo.showModal();});
    shardInfo.addEventListener('click',event=>{if(event.target.closest('.bank-close'))return shardInfo.close();if(event.target.closest('[data-shard-actions]')){shardInfo.close();onActions();}});
    modal.addEventListener('click',event=>{if(event.target.closest('.bank-close'))return modal.close();if(event.target.closest('[data-bank-auto]'))return autoSelect();const pick=event.target.closest('[data-bank-card]');if(pick)return toggleCard(pick.dataset.bankCard);if(event.target.closest('[data-bank-submit]'))return void submit();if(event.target.closest('[data-bank-back]'))return drawSelection();if(event.target.closest('[data-bank-finish]')){modal.close();onCollection();}});
    saleModal.addEventListener('click',event=>{if(event.target.closest('.bank-close'))return saleModal.close();if(event.target.closest('[data-sale-confirm]'))return void confirmSale();});
    bulkModal.addEventListener('click',event=>{if(event.target.closest('.bank-close')&&!busy)return bulkModal.close();const pick=event.target.closest('[data-bulk-card]');if(pick&&!busy){const id=pick.dataset.bulkCard;if(bulkSelected.has(id))bulkSelected.delete(id);else bulkSelected.add(id);return drawBulk();}if(event.target.closest('[data-bulk-all]')&&!busy){bulkSelected=new Set(cards().map(c=>c.id));return drawBulk();}if(event.target.closest('[data-bulk-clear]')&&!busy){bulkSelected.clear();return drawBulk();}if(event.target.closest('[data-bulk-confirm]'))return void confirmBulk();if(event.target.closest('[data-bulk-finish]'))bulkModal.close();});
    bulkModal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    bulkModal.addEventListener('close',()=>bulkSelected.clear());
    tour.addEventListener('click',event=>{if(event.target.closest('[data-tour-skip]'))return closeTour();if(event.target.closest('[data-tour-next]')){if(tourIndex===slides.length-1)closeTour();else{tourIndex++;drawTour();}}});
    tour.addEventListener('cancel',event=>{event.preventDefault();closeTour();});
    modal.addEventListener('close',()=>{recipe=null;selected.clear();});
    saleModal.addEventListener('close',()=>{saleCard=null;});
    return Object.freeze({refresh,sell,openBulk,isOpen:()=>modal.open||saleModal.open||bulkModal.open||shardInfo.open||tour.open});
  }
  window.CardEconomy=Object.freeze({mount});
})();
