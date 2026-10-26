/* Ordered transport only. No rendering, credential storage or automatic retries. */
(() => {
  "use strict";
  function create({state,url,key}) {
  async function exchange(action = "sync", payload = {}, accessCode = null) {
    if (!state.role || !state.token) throw new Error("pairing_required");
    const requestRole = state.role, requestToken = state.token;
    const sequence = state.requestSequence = (state.requestSequence || 0) + 1;
    const readOnly = ['sync','login'].includes(action);
    if (!readOnly && !['opening_progress','finish_opening'].includes(action)) state.mutationEpoch = (state.mutationEpoch || 0) + 1;
    const epoch = state.mutationEpoch || 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let data;
    try {
      const response = await fetch(`${url}/rest/v1/rpc/tcg_exchange`, {
        method: "POST", signal: controller.signal,
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_role: requestRole, p_token: requestToken, p_access_code: accessCode, p_action: action, p_payload: action === "sync" ? {...payload,history_limit:state.historyLimit || payload.history_limit || 40} : payload })
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    } catch (error) {
      if (error.name === "AbortError") throw new Error("timeout");
      if (error instanceof TypeError) throw new Error("network_error");
      throw error;
    } finally { clearTimeout(timeout); }
    if (requestRole !== state.role || requestToken !== state.token) throw new Error("profile_changed");
    if (data?.server_now) state.serverOffset = new Date(data.server_now).getTime() - Date.now();
    if (!data?.released && !data?.opening_saved) {
      // A slow poll started before a mutation must never restore the old hand.
      if (sequence < (state.appliedSequence || 0) || (readOnly && epoch !== (state.mutationEpoch || 0))) return state.data;
      state.appliedSequence = sequence;
      state.data = data;
    }
    return data;
  }

    return exchange;
  }
  function matchesMutation(snapshot,action,payload,role) {
    if(!snapshot)return false;
    const events=snapshot.card_events || [];
    const eventType={give_card:"give_card",destroy_card:"destroy_card",complete_card:"complete_card",use_spell:"spell_cast"}[action];
    if(eventType)return events.some(event=>event.actor_role===role && event.card_id===(payload.card_id || payload.spell_card_id) && event.event_type===eventType);
    if(action==="activate_card")return (snapshot.active_cards || []).some(card=>card.id===payload.card_id && card.owner_role===role && (!payload.choice_template_id || card.selected_template_id===payload.choice_template_id));
    if(action==="trade_propose")return (snapshot.trades || []).some(trade=>trade.proposed_by===role && trade.offered.id===payload.offered_card_id && trade.requested.id===payload.requested_card_id);
    const status=action==="trade_cancel"?"cancelled":action==="trade_respond"?(payload.decision==="accept"?"accepted":"rejected"):null;
    return Boolean(status && (snapshot.trades || []).some(trade=>trade.id===payload.trade_id && trade.status===status));
  }
  window.CardTransport=Object.freeze({create,matchesMutation});
})();
