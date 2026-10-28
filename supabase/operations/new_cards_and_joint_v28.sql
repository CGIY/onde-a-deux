select pg_advisory_xact_lock(hashtext('tcg:main'));
select set_config('tcg.rebalance_before',jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x))::text,true);
-- New catalogue and a private two-player ritual state machine.
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_category_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_category_check check(category in ('EN COUPLE','POUR L''AUTRE','MISE À NUE','LES FOODIES','TO DO','ÉNERGIE','JOKER','SORTILÈGES','IRIS'));
alter table public.tcg_card_templates drop constraint if exists tcg_card_templates_palette_check;
alter table public.tcg_card_templates add constraint tcg_card_templates_palette_check check(palette in ('couple','other','nude','foodies','todo','energy','joker','reducto','presto','adagio','augmento','destructo','iris'));

alter table public.tcg_cards drop constraint if exists tcg_cards_selected_check;
alter table public.tcg_cards add constraint tcg_cards_selected_check check(selected_template_id is null or finish='legendary' or (template_id='fa-couple-defi-simultane' and finish='full_art'));

create table if not exists public.tcg_joint_choices(template_id text primary key references public.tcg_card_templates(id));
create table if not exists public.tcg_joint_sessions(
 card_id uuid primary key references public.tcg_cards(id),
 choice_id text not null references public.tcg_card_templates(id),
 status text not null default 'active' check(status in ('active','completed','failed','unanswered','cancelled')),
 created_at timestamptz not null default now(),resolved_at timestamptz
);
create table if not exists public.tcg_joint_players(
 card_id uuid not null references public.tcg_joint_sessions(card_id),role text not null references public.tcg_players(role),
 status text not null default 'active' check(status in ('active','pending','approved')),
 requested_at timestamptz,reviewed_at timestamptz,primary key(card_id,role)
);
alter table public.tcg_joint_choices enable row level security;
alter table public.tcg_joint_sessions enable row level security;
alter table public.tcg_joint_players enable row level security;
revoke all on public.tcg_joint_choices,public.tcg_joint_sessions,public.tcg_joint_players from public,anon,authenticated;

create or replace function public.tcg_joint_options() returns jsonb language sql stable set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'challenge',t.challenge) order by t.title),'[]'::jsonb)
 from public.tcg_joint_choices allowed join public.tcg_card_templates t on t.id=allowed.template_id
 where t.active and not t.demo and t.card_type='challenge' and t.finish_tier='standard' and t.eligible_role is null
 and (t.draw_from is null or (now()>=t.draw_from and now()<t.draw_until));
$$;
create or replace function public.tcg_joint_snapshot(p_card uuid,p_role text) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('status',j.status,'choice_id',j.choice_id,'choice_title',t.title,'my_status',mine.status,'partner_status',partner.status,
 'can_complete',j.status='active' and mine.status='active' and c.active_until>now(),
 'can_pass',j.status='active' and mine.status in ('active','pending'),
 'can_review',j.status='active' and partner.status='pending' and partner.requested_at+interval '24 hours'>now())
 from public.tcg_joint_sessions j join public.tcg_cards c on c.id=j.card_id join public.tcg_card_templates t on t.id=j.choice_id
 join public.tcg_joint_players mine on mine.card_id=j.card_id and mine.role=p_role
 join public.tcg_joint_players partner on partner.card_id=j.card_id and partner.role<>p_role
 where j.card_id=p_card;
$$;
create or replace function public.tcg_joint_settle(p_card uuid,p_result text) returns void language plpgsql set search_path=public,pg_temp as $$
declare session_row public.tcg_joint_sessions%rowtype; owned public.tcg_cards%rowtype; participant record; amount integer;
begin
 if p_result not in ('completed','failed','unanswered') then raise exception 'invalid_request'; end if;
 select * into session_row from public.tcg_joint_sessions where card_id=p_card for update;
 if not found or session_row.status<>'active' then return; end if;
 select * into owned from public.tcg_cards where id=p_card for update;
 amount:=case p_result when 'completed' then public.tcg_ritual_value(owned.finish) when 'failed' then -public.tcg_ritual_value(owned.finish) else 0 end;
 update public.tcg_joint_sessions set status=p_result,resolved_at=now() where card_id=p_card;
 update public.tcg_cards set status='used',active_until=least(active_until,now()),consumed_at=now() where id=p_card;
 for participant in select role from public.tcg_joint_players where card_id=p_card order by role loop
  perform public.tcg_economy_apply(participant.role,amount,case p_result when 'completed' then 'ritual_approved' when 'failed' then 'ritual_rejected' else 'ritual_unanswered' end,p_card,jsonb_build_object('joint',true,'result',p_result));
  if p_result='completed' then insert into public.tcg_card_events(card_id,actor_role,event_type) values(p_card,participant.role,'complete_card'); end if;
  perform public.tcg_push_notify(participant.role,'Défi simultané',case p_result when 'completed' then 'Défi réussi à deux. Éclats versés.' when 'failed' then 'Défi partagé non réalisé. Malus pour les deux joueurs.' else 'Validation restée sans réponse. Aucun malus.' end,'/cartes/');
 end loop;
end;
$$;
create or replace function public.tcg_joint_start(p_card uuid,p_choice text) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from jsonb_array_elements(public.tcg_joint_options()) x where x->>'id'=p_choice) then raise exception 'invalid_joint_choice'; end if;
 insert into public.tcg_joint_sessions(card_id,choice_id) values(p_card,p_choice);
 insert into public.tcg_joint_players(card_id,role) values(p_card,'AG'),(p_card,'CL');
end;
$$;
create or replace function public.tcg_joint_tick() returns void language plpgsql set search_path=public,pg_temp as $$
declare item record;
begin
 for item in select j.card_id,c.status from public.tcg_joint_sessions j join public.tcg_cards c on c.id=j.card_id where j.status='active' order by j.card_id for update of j loop
  if item.status<>'activated' then
   update public.tcg_joint_sessions set status='cancelled',resolved_at=now() where card_id=item.card_id;
  elsif exists(select 1 from public.tcg_joint_players p join public.tcg_cards c on c.id=p.card_id where p.card_id=item.card_id and p.status='active' and c.active_until<=now()) then
   perform public.tcg_joint_settle(item.card_id,'failed');
  elsif exists(select 1 from public.tcg_joint_players where card_id=item.card_id and status='pending' and requested_at+interval '24 hours'<=now()) then
   perform public.tcg_joint_settle(item.card_id,'unanswered');
  end if;
 end loop;
end;
$$;
create or replace function public.tcg_joint_action(p_role text,p_action text,p_payload jsonb) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare target uuid; session_row public.tcg_joint_sessions%rowtype; mine public.tcg_joint_players%rowtype; partner public.tcg_joint_players%rowtype; owned public.tcg_cards%rowtype;
begin
 begin target:=(p_payload->>'card_id')::uuid; exception when invalid_text_representation then raise exception 'card_unavailable'; end;
 select * into session_row from public.tcg_joint_sessions where card_id=target for update;
 if not found then return false; end if;
 if session_row.status<>'active' then raise exception 'ritual_unavailable'; end if;
 select * into mine from public.tcg_joint_players where card_id=target and role=p_role for update;
 if not found then raise exception 'ritual_unavailable'; end if;
 select * into partner from public.tcg_joint_players where card_id=target and role<>p_role for update;
 select * into owned from public.tcg_cards where id=target for update;
 if p_action='complete_card' then
  if mine.status<>'active' or owned.active_until<=now() then raise exception 'ritual_unavailable'; end if;
  update public.tcg_joint_players set status='pending',requested_at=now() where card_id=target and role=p_role;
  perform public.tcg_push_notify(partner.role,'Défi simultané','Ton partenaire demande de valider sa participation.','/cartes/');
 elsif p_action='ritual_pass' then
  if mine.status not in ('active','pending') then raise exception 'ritual_unavailable'; end if;
  perform public.tcg_joint_settle(target,'failed');
 elsif p_action='ritual_review' then
  if partner.status<>'pending' or partner.requested_at+interval '24 hours'<=now() then raise exception 'ritual_unavailable'; end if;
  if p_payload->>'decision'='approve' then
   update public.tcg_joint_players set status='approved',reviewed_at=now() where card_id=target and role=partner.role;
   if not exists(select 1 from public.tcg_joint_players where card_id=target and status<>'approved') then perform public.tcg_joint_settle(target,'completed'); end if;
  elsif p_payload->>'decision'='reject' then perform public.tcg_joint_settle(target,'failed');
  else raise exception 'invalid_request'; end if;
 else raise exception 'invalid_request'; end if;
 return true;
end;
$$;
revoke all on function public.tcg_joint_options(),public.tcg_joint_snapshot(uuid,text),public.tcg_joint_settle(uuid,text),public.tcg_joint_start(uuid,text),public.tcg_joint_tick(),public.tcg_joint_action(text,text,jsonb) from public,anon,authenticated;

DO $integrate$
declare definition text;
begin
 definition:=pg_get_functiondef('public.tcg_economy_action(text,text,jsonb)'::regprocedure);
 if position('tcg_joint_action' in definition)=0 then
  definition:=replace(definition,$old$  if p_action in ('complete_card','ritual_pass') then$old$,$new$  if p_action in ('complete_card','ritual_pass','ritual_review') and public.tcg_joint_action(p_role,p_action,p_payload) then return; end if;
  if p_action in ('complete_card','ritual_pass') then$new$);
 end if; execute definition;
 definition:=pg_get_functiondef('public.tcg_economy_tick()'::regprocedure);
 if position('tcg_joint_tick' in definition)=0 then
  definition:=replace(definition,'begin','begin'||chr(10)||'  perform public.tcg_joint_tick();');
  definition:=replace(definition,$old$where x.status='activated' and x.active_until<=now() and x.economy_eligible$old$,$new$where x.status='activated' and x.active_until<=now() and x.economy_eligible and not exists(select 1 from public.tcg_joint_sessions j where j.card_id=x.id)$new$);
 end if; execute definition;
 definition:=pg_get_functiondef('public.tcg_exchange(text,text,text,text,jsonb)'::regprocedure);
 if position('tcg_joint_start' in definition)=0 then
  definition:=replace(definition,$old$    if offered.finish='legendary' then$old$,$new$    if offered.template_id='fa-couple-defi-simultane' then
      select * into choice_row from public.tcg_card_templates t where t.id=p_payload->>'choice_template_id'
        and exists(select 1 from jsonb_array_elements(public.tcg_joint_options()) x where x->>'id'=t.id);
      if not found then raise exception 'invalid_joint_choice'; end if;
    end if;
    if offered.finish='legendary' then$new$);
  definition:=replace(definition,$old$selected_template_id=case when offered.finish='legendary' then choice_row.id end$old$,$new$selected_template_id=case when offered.finish='legendary' or offered.template_id='fa-couple-defi-simultane' then choice_row.id end$new$);
  definition:=replace(definition,$old$    where id = offered.id;

  elsif p_action = 'pin_card' then$old$,$new$    where id = offered.id;
    if offered.template_id='fa-couple-defi-simultane' then perform public.tcg_joint_start(offered.id,choice_row.id); end if;

  elsif p_action = 'pin_card' then$new$);
  definition:=replace(definition,$old$'ritual_claim_status',(select r.status from public.tcg_ritual_claims r where r.card_id=c.id),$old$,$new$'ritual_claim_status',(select r.status from public.tcg_ritual_claims r where r.card_id=c.id),
    'joint_ritual',public.tcg_joint_snapshot(c.id,v_role),$new$);
  definition:=replace(definition,$old$'rules', jsonb_build_object($old$,$new$'joint_options',case when exists(select 1 from public.tcg_cards where owner_role=v_role and template_id='fa-couple-defi-simultane' and status='available' and expires_at>now()) then public.tcg_joint_options() else '[]'::jsonb end,
    'rules', jsonb_build_object($new$);
  definition:=replace(definition,$old$where status = 'activated' and active_until <= now() and not exists($old$,$new$where status = 'activated' and active_until <= now() and not exists(select 1 from public.tcg_joint_sessions j where j.card_id=tcg_cards.id and j.status='active') and not exists($new$);
  definition:=replace(definition,$old$where c.status = 'activated' and (c.active_until > now() or exists($old$,$new$where c.status = 'activated' and (c.active_until > now() or exists(select 1 from public.tcg_joint_sessions j where j.card_id=c.id and j.status='active') or exists($new$);
 end if;
 if position('tcg_joint_start' in definition)=0 or position('joint_ritual' in definition)=0 then raise exception 'Joint activation integration failed'; end if;
 execute definition;
end;
$integrate$;

insert into public.tcg_card_templates(id,category,title,challenge,symbol,palette,card_type,finish_tier,rarity,active,demo,edition) values
('autre-mission-dehors','POUR L''AUTRE','MISSION DEHORS','Réalise dehors une petite mission demandée par l’autre.','✿','other','challenge','standard','commune',true,false,'edition_01'),
('autre-vetement-impose','POUR L''AUTRE','VÊTEMENT IMPOSÉ','Porte le vêtement choisi par l’autre pour votre sortie.','✿','other','challenge','standard','commune',true,false,'edition_01'),
('couple-objet-absurde','EN COUPLE','OBJET ABSURDE','Fixez le même budget, puis achetez chacun un objet absurde pour l’autre.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('autre-aliment-interdit','POUR L''AUTRE','ALIMENT INTERDIT','Engage-toi pendant une journée à ne pas manger un aliment ou condiment choisi ensemble.','✿','other','challenge','standard','commune',true,false,'edition_01'),
('fa-autre-objet-cache','POUR L''AUTRE','OBJET CACHÉ','L’autre cache un objet dans la maison. Tu as 24 heures pour le trouver, avec des indices.','✿','other','challenge','full_art','rare',true,false,'edition_01'),
('fa-couple-photo-reproduite','EN COUPLE','LA MÊME PHOTO','Reprenez une vieille photo de votre couple et reproduisez-la à l’identique.','✿','couple','challenge','full_art','rare',true,false,'edition_01'),
('fa-couple-capsule-temporelle','EN COUPLE','CAPSULE TEMPORELLE','Enterrez ou cachez ensemble un objet et une note. Choisissez une date pour les retrouver.','✿','couple','challenge','full_art','rare',true,false,'edition_01'),
('fa-couple-defi-simultane','EN COUPLE','DÉFI SIMULTANÉ','Choisissez un défi commun à réaliser tous les deux. Si l’un abandonne, vous perdez tous les deux des Éclats.','✿','couple','challenge','full_art','rare',true,false,'edition_01'),
('couple-argile','EN COUPLE','SESSION ARGILE','Faites une session argile ensemble.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('todo-decoration-theme','TO DO','DÉCORATION À THÈME','Faites ensemble une session décoration sur un thème choisi.','✿','todo','challenge','standard','commune',true,false,'edition_01'),
('fa-nue-photo-foret','MISE À NUE','SÉANCE PHOTO · EN FORÊT','Séance photo : en forêt.','✿','nude','challenge','full_art','rare',true,false,'edition_01'),
('nue-photo-bdsm','MISE À NUE','SÉANCE PHOTO · BDSM','Séance photo : BDSM.','✿','nude','challenge','standard','commune',true,false,'edition_01'),
('nue-photo-ahegao','MISE À NUE','SÉANCE PHOTO · AHEGAO','Séance photo : ahegao.','✿','nude','challenge','standard','commune',true,false,'edition_01'),
('fa-nue-photo-anal-play','MISE À NUE','SÉANCE PHOTO · ANAL PLAY','Séance photo : anal play.','✿','nude','challenge','full_art','rare',true,false,'edition_01'),
('faf-nue-journee-envies','MISE À NUE','JOURNÉE DES ENVIES','Trois propositions choisies dans une liste acceptée ensemble, pour une journée à deux.','✿','nude','challenge','full_art_foil','rare',true,false,'edition_01'),
('couple-portrait-aveugle','EN COUPLE','PORTRAIT À L’AVEUGLE','Dessine l’autre sans regarder ta feuille.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('couple-playlist-secrete','EN COUPLE','PLAYLIST SECRÈTE','Choisis cinq morceaux qui te font penser à l’autre, à écouter ensuite.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('couple-interview-improbable','EN COUPLE','INTERVIEW IMPROBABLE','Pose une question que tu ne lui as jamais posée. NSFW autorisé.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('autre-origami-messager','POUR L''AUTRE','ORIGAMI MESSAGER','Plie un petit objet contenant un message. Cache-le.','✿','other','challenge','standard','commune',true,false,'edition_01'),
('todo-objet-detourne','TO DO','OBJET DÉTOURNÉ','Invente une nouvelle utilisation pour un objet choisi par l’autre. Tu dois le faire toute la journée.','✿','todo','challenge','standard','commune',true,false,'edition_01'),
('foodies-cocktail-mystere','LES FOODIES','COCKTAIL MYSTÈRE','Fais goûter à l’autre un cocktail improbable, les yeux fermés.','✿','foodies','challenge','standard','commune',true,false,'edition_01'),
('couple-mot-interdit','EN COUPLE','LE MOT INTERDIT','L’autre choisit pour toi un mot courant à éviter pendant une heure.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('couple-carte-postale','EN COUPLE','CARTE POSTALE DU QUARTIER','Envoie une carte postale à une adresse trouvée sur Internet ou imposée. Au hasard.','✿','couple','challenge','standard','commune',true,false,'edition_01'),
('fa-couple-minute-cinema','EN COUPLE','MINUTE DE CINÉMA','Tournez une scène d’une minute dans un genre tiré au sort.','✿','couple','challenge','full_art','rare',true,false,'edition_01'),
('fa-couple-mini-escape','EN COUPLE','MINI ESCAPE MAISON','Prépare trois énigmes menant à une petite surprise pour l’autre.','✿','couple','challenge','full_art','rare',true,false,'edition_01'),
('nue-trois-baisers','MISE À NUE','TROIS BAISERS','Choisis trois endroits où recevoir un baiser. NSFW.','✿','nude','challenge','standard','commune',true,false,'edition_01'),
('nue-bougie-massage','MISE À NUE','RENDEZ-VOUS PARFUMÉ','Bougie de massage sur le corps.','✿','nude','challenge','standard','commune',true,false,'edition_01'),
('iris-cadeau-5','IRIS','CADEAU POUR IRIS · 5 €','L’autre achète un cadeau à Iris de 5 euros.','✿','iris','challenge','standard','commune',true,false,'edition_01'),
('iris-cadeau-10','IRIS','CADEAU POUR IRIS · 10 €','L’autre achète un cadeau à Iris de 10 euros.','✿','iris','challenge','standard','commune',true,false,'edition_01'),
('iris-livre-10','IRIS','LIVRE POUR IRIS · 10 €','L’autre achète un livre à Iris de 10 euros.','✿','iris','challenge','standard','commune',true,false,'edition_01'),
('iris-vetement-10','IRIS','VÊTEMENT POUR IRIS · 10 €','L’autre achète un vêtement à Iris de 10 euros.','✿','iris','challenge','standard','commune',true,false,'edition_01'),
('iris-depense-30','IRIS','POUR IRIS · 30 €','L’autre dépense 30 euros pour Iris.','✿','iris','challenge','standard','commune',true,false,'edition_01')
on conflict(id) do nothing;
insert into public.tcg_joint_choices(template_id) values ('couple-aquarelle'),('couple-dessin'),('couple-balade-rapide'),('couple-argile'),('couple-portrait-aveugle'),('couple-playlist-secrete'),('autre-origami-messager'),('couple-mot-interdit'),('couple-interview-improbable') on conflict do nothing;

DO $preserve$ begin if current_setting('tcg.rebalance_before')::jsonb is distinct from jsonb_build_object('wallets',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role),'')) from public.tcg_economy_wallets x),'cards',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_cards x),'discoveries',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by role,template_id),'')) from public.tcg_discoveries x),'events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_economy_events x),'card_events',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_card_events x),'boosters',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_boosters x),'receipts',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by booster_id),'')) from public.tcg_opening_receipts x),'trades',(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by id),'')) from public.tcg_trades x)) then raise exception 'Player state changed during rule update'; end if; end; $preserve$;
