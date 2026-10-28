/* REROLL EN VILLE · rarity-preserving random replacements. */
(() => {
  "use strict";
  const DEADLINE = Date.parse("2026-11-02T00:00:00+01:00");
  const MAX_CARDS = 10;
  const labels = {standard:"Commune",full_art:"Full art",foil:"Foil",full_art_foil:"Full art + foil",legendary:"Légendaire"};
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function mount({getState,getRole,exchange,renderCard,onUpdate,onCollection,friendlyError}) {
    const launcher=document.createElement("button");
    launcher.type="button";launcher.className="reroll-event-launcher";launcher.hidden=true;
    launcher.setAttribute("aria-haspopup","dialog");
    launcher.innerHTML=`<span class="reroll-launch-copy"><span class="reroll-launch-eyebrow">ÉVÉNEMENT · JUSQU’AU 1ER NOVEMBRE</span><strong>REROLL EN VILLE</strong><small>Échange tes cartes contre un tirage éphémère</small></span><span class="reroll-launch-mark" aria-hidden="true">${icon("M4 7h12l-2.5-2.5M20 17H8l2.5 2.5M17 7l3 3-3 3M7 17l-3-3 3-3")}</span>`;
    document.querySelector("#todayView .view-heading")?.insertAdjacentElement("afterend",launcher);

    const dialog=document.createElement("dialog");
    dialog.className="reroll-event-dialog";dialog.setAttribute("aria-labelledby","rerollEventTitle");
    dialog.innerHTML=`<button class="reroll-event-close" type="button" data-event-action="close" aria-label="Fermer">${icon("M6 6l12 12M18 6 6 18")}</button><div class="reroll-event-content" id="rerollEventContent"></div>`;
    document.body.append(dialog);

    let role=null,status=null,statusPromise=null,selected=new Set(),screen="selection",busy=false,notice="",autoOpenQueued=false;
    const appState=()=>getState();
    const serverNow=()=>new Date(Date.now()+(window.CardTransport?.getState()?.serverOffset||0));
    const launchKey=target=>`les-cartes-reroll-en-ville-seen:v1:${target}`;
    const seen=()=>{try{return localStorage.getItem(launchKey(role))==="1"}catch{return false}};
    const markSeen=()=>{try{if(role)localStorage.setItem(launchKey(role),"1")}catch{}};
    const available=()=> (appState()?.my_cards||[]).filter(c=>c.card_type==="challenge"&&c.status==="available"&&new Date(c.expires_at)>serverNow()).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
    const cardsByIds=ids=>{const map=new Map((appState()?.my_cards||[]).map(c=>[c.id,c]));return(ids||[]).map(id=>map.get(id)).filter(Boolean)};
    const rarity=c=>labels[c.finish]||c.finish||"Carte";
    const countLabel=n=>`${n} carte${n>1?"s":""}`;

    function cardGrid(items,selectable){
      if(!items.length)return '<p class="reroll-event-empty">Aucune carte de défi disponible dans ta galerie pour le moment.</p>';
      return `<div class="reroll-event-gallery">${items.map(c=>{const chosen=selected.has(c.id);return `<button type="button" class="reroll-event-card ${chosen?"selected":""}" data-event-action="${selectable?"toggle":"noop"}" data-card-id="${escape(c.id)}" aria-pressed="${chosen}" ${selectable?"":"disabled"}><span class="reroll-card-art">${renderCard(c)}</span><span class="reroll-card-meta"><strong>${escape(c.title)}</strong><small>${escape(rarity(c))} · ${escape(c.category||"Catégorie conservée")}</small></span><span class="reroll-card-check" aria-hidden="true">${chosen?"✓":"+"}</span></button>`}).join("")}</div>`;
    }

    function renderSelection(){
      const chosen=available().filter(c=>selected.has(c.id));
      dialog.querySelector("#rerollEventContent").innerHTML=`
        <header class="reroll-event-heading"><span class="reroll-event-kicker">ÉVÉNEMENT · 28 OCTOBRE — 1ER NOVEMBRE</span><h1 id="rerollEventTitle">REROLL <em>EN VILLE</em></h1><p>Choisis entre 1 et ${MAX_CARDS} cartes de ta galerie. Chacune sera consommée puis remplacée par une carte aléatoire de même catégorie et de même rareté.</p></header>
        <div class="reroll-event-rules"><p><strong>Un tirage pour chaque carte.</strong> Le booster s’ouvre immédiatement avec le même nombre de cartes que ta sélection.</p><p><strong>Éphémères.</strong> Les cartes obtenues expirent dimanche 1er novembre à 23 h 59.</p><p><strong>Une seule participation par profil.</strong> Le tirage est aléatoire : un doublon reste possible.</p></div>
        <div class="reroll-event-select-head"><div><span class="reroll-event-kicker">TA GALERIE</span><h2>Sélectionne tes cartes.</h2></div><span class="reroll-event-count">${chosen.length} / ${MAX_CARDS}</span></div>
        ${cardGrid(available(),true)}${notice?`<p class="reroll-event-notice" role="status">${escape(notice)}</p>`:""}
        <footer class="reroll-event-footer"><button type="button" class="reroll-event-secondary" data-event-action="close">Plus tard</button><button type="button" class="reroll-event-primary" data-event-action="review" ${chosen.length?"":"disabled"}>Vérifier · ${countLabel(chosen.length)} →</button></footer>`;
    }

    function renderReview(){
      const chosen=available().filter(c=>selected.has(c.id));
      dialog.querySelector("#rerollEventContent").innerHTML=`
        <header class="reroll-event-heading"><span class="reroll-event-kicker">DERNIÈRE VÉRIFICATION</span><h1 id="rerollEventTitle">Ton booster.</h1><p>${chosen.length} carte${chosen.length===1?"":"s"} vont être consommée${chosen.length===1?"":"s"} et remplacée${chosen.length===1?"":"s"} par autant de cartes.</p></header>
        ${cardGrid(chosen,false)}
        <div class="reroll-event-warning"><strong>Les cartes sélectionnées ne pourront pas être récupérées.</strong><span>Chaque carte obtenue garde la catégorie et la rareté de son entrée. Le tirage est aléatoire, donc un doublon reste possible. Toutes expireront dimanche 1er novembre à 23 h 59.</span></div>
        ${notice?`<p class="reroll-event-notice" role="status">${escape(notice)}</p>`:""}
        <footer class="reroll-event-footer"><button type="button" class="reroll-event-secondary" data-event-action="back">Modifier</button><button type="button" class="reroll-event-primary" data-event-action="claim" ${busy||chosen.length!==selected.size?"disabled":""}>Consommer et ouvrir →</button></footer>`;
    }

    function renderLoading(){
      dialog.querySelector("#rerollEventContent").innerHTML=`<div class="reroll-event-opening" role="status"><span class="reroll-event-orbit" aria-hidden="true"><i></i><i></i><i></i></span><span class="reroll-event-kicker">REROLL EN VILLE</span><h1 id="rerollEventTitle">Le tirage se prépare.</h1><p>Les cartes choisies sont échangées. Ton booster s’ouvre dans un instant.</p></div>`;
    }
    function renderReveal(result){
      const cards=cardsByIds(result?.output_card_ids);
      dialog.querySelector("#rerollEventContent").innerHTML=`<header class="reroll-event-heading reroll-event-reveal"><span class="reroll-event-kicker">BOOSTER OUVERT · ${cards.length} CARTE${cards.length===1?"":"S"}</span><h1 id="rerollEventTitle">Ton nouveau tirage.</h1><p>Les cartes obtenues restent dans ta collection jusqu’au dimanche 1er novembre à 23 h 59. Des doublons sont possibles.</p></header>${cardGrid(cards,false)}${cards.length?"":'<p class="reroll-event-empty">Le tirage est enregistré. Retrouve les cartes dans ta collection.</p>'}<footer class="reroll-event-footer reroll-event-footer-single"><button type="button" class="reroll-event-primary" data-event-action="collection">Voir ma collection →</button></footer>`;
    }
    function renderUsed(){
      const cards=cardsByIds(status?.output_card_ids);
      dialog.querySelector("#rerollEventContent").innerHTML=`<header class="reroll-event-heading"><span class="reroll-event-kicker">REROLL EN VILLE</span><h1 id="rerollEventTitle">Participation utilisée.</h1><p>Une seule participation est possible par profil. Tes cartes de remplacement sont dans ta collection jusqu’au dimanche 1er novembre à 23 h 59.</p></header>${cards.length?cardGrid(cards,false):'<p class="reroll-event-empty">Les cartes obtenues sont déjà dans ta collection.</p>'}<footer class="reroll-event-footer reroll-event-footer-single"><button type="button" class="reroll-event-primary" data-event-action="collection">Voir ma collection →</button></footer>`;
    }
    function renderClosed(){dialog.querySelector("#rerollEventContent").innerHTML=`<header class="reroll-event-heading"><span class="reroll-event-kicker">ÉVÉNEMENT TERMINÉ</span><h1 id="rerollEventTitle">Le tirage est fermé.</h1><p>REROLL EN VILLE est terminé. Les cartes obtenues pendant l’événement restent valables jusqu’au dimanche 1er novembre à 23 h 59.</p></header><footer class="reroll-event-footer reroll-event-footer-single"><button type="button" class="reroll-event-primary" data-event-action="close">Fermer</button></footer>`;}
    function renderStatusLoading(){dialog.querySelector("#rerollEventContent").innerHTML=`<div class="reroll-event-opening" role="status"><span class="reroll-event-kicker">REROLL EN VILLE</span><h1 id="rerollEventTitle">Vérification de l’événement.</h1><p>Un instant…</p></div>`;}
    function render(){if(!dialog.open)return;if(busy&&screen==="loading"){renderLoading();return}if(!status){renderStatusLoading();return}if(screen==="reveal"&&status.used){renderReveal(status);return}if(status.used){screen="used";renderUsed();return}if(!status.active){screen="closed";renderClosed();return}if(screen==="review"){renderReview();return}if(screen==="loading"){renderLoading();return}if(screen==="reveal"){renderReveal(status);return}renderSelection();}

    function maybeAutoOpen(){
      if(autoOpenQueued||!status?.active||seen())return;
      const open=document.querySelectorAll("dialog[open]");
      if(open.length){open.forEach(d=>d.addEventListener("close",maybeAutoOpen,{once:true}));return}
      autoOpenQueued=true;screen=status.used?"used":"selection";dialog.showModal();render();
    }
    async function loadStatus(targetRole){
      if(statusPromise)return statusPromise;
      const pending=exchange("reroll_en_ville",{mode:"status"}).then(value=>{
        if(targetRole!==role)return;
        status=value;screen=value?.used?"used":value?.active?"selection":"closed";
        launcher.hidden=!value?.active;launcher.classList.toggle("is-used",Boolean(value?.used));
        launcher.querySelector("small").textContent=value?.used?"Participation utilisée · voir les cartes":"Échange tes cartes contre un tirage éphémère";
        maybeAutoOpen();if(dialog.open)render();
      }).catch(error=>{
        if(targetRole!==role)return;
        status={active:serverNow().getTime()<DEADLINE,used:false,error:true};
        launcher.hidden=!status.active;
        if(dialog.open){notice=friendlyError?.(error)||"Impossible de vérifier l’événement. Réessaie.";render()}
      }).finally(()=>{if(statusPromise===pending)statusPromise=null});
      statusPromise=pending;return pending;
    }
    function refresh(){
      const next=getRole();
      if(!next||!appState()){launcher.hidden=true;if(dialog.open)dialog.close();return}
      if(next!==role){autoOpenQueued=false;role=next;status=null;statusPromise=null;selected.clear();notice="";launcher.hidden=serverNow().getTime()>=DEADLINE;if(launcher.hidden)return;loadStatus(role)}
      if(appState()?.reroll_en_ville&&!busy)status=appState().reroll_en_ville;
      launcher.hidden=status?!status.active:serverNow().getTime()>=DEADLINE;
      if(dialog.open)render();
    }

    async function claim(){
      const chosen=available().filter(c=>selected.has(c.id)),ids=[...selected];
      if(busy||ids.length<1||ids.length>MAX_CARDS||chosen.length!==ids.length){notice="La sélection a changé. Vérifie les cartes encore disponibles.";screen="selection";render();return}
      busy=true;screen="loading";notice="";render();
      try{
        let result;
        try{result=await exchange("reroll_en_ville",{mode:"claim",card_ids:ids})}
        catch(error){const recovered=await exchange("reroll_en_ville",{mode:"status"}).catch(()=>null);if(recovered?.used&&JSON.stringify(recovered.input_card_ids)===JSON.stringify(ids))result=recovered;else throw error}
        status=result;screen="reveal";onUpdate();render();
      }catch(error){
        const message=String(error?.message||error);
        notice=message.includes("reroll_en_ville_used")?"Cette participation a déjà été utilisée pour ce profil.":message.includes("reroll_en_ville_closed")?"L’événement est terminé.":message.includes("reroll_en_ville_no_match")?"Aucun tirage de même catégorie et rareté n’est disponible pour une des cartes choisies.":friendlyError?.(error)||"Le tirage n’a pas abouti. Réessaie.";
        status=await exchange("reroll_en_ville",{mode:"status"}).catch(()=>status);screen=status?.used?"used":"review";render();
      }finally{busy=false}
    }

    launcher.addEventListener("click",async()=>{if(!status&&role)await loadStatus(role);selected.clear();notice="";screen=status?.used?"used":"selection";if(!dialog.open)dialog.showModal();render()});
    dialog.addEventListener("click",event=>{
      const control=event.target.closest("[data-event-action]");if(!control||control.disabled)return;
      const action=control.dataset.eventAction;
      if(action==="close"){if(!busy)dialog.close();return}
      if(action==="noop")return;
      if(action==="toggle"){const id=control.dataset.cardId;if(selected.has(id))selected.delete(id);else if(selected.size<MAX_CARDS)selected.add(id);notice="";renderSelection()}
      else if(action==="review"){if(selected.size){screen="review";notice="";render()}}
      else if(action==="back"){screen="selection";notice="";render()}
      else if(action==="claim")claim()
      else if(action==="collection"){dialog.close();onCollection?.()}
    });
    dialog.addEventListener("close",markSeen);
    dialog.addEventListener("cancel",event=>{event.preventDefault();if(!busy)dialog.close()});
    return {refresh,isOpen:()=>dialog.open};
  }
  window.RerollEnVille={mount};
})();