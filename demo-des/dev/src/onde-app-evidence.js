/* ONDE — contextual evidence for cards. Plain text only; no UI or network effects.
 * Active results: dev/data/card-evidence.json, injected by build.py.
 * Remaining facts only support older saved cards.
 * An interest survey is neither a measure of practice nor a recommendation.
 */
(function (scope) {
  'use strict';

  const sources = {
    appeal: {
      year: 2017,
      sourceTitle: 'Herbenick et al. · PLOS ONE · tableau 5',
      url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0181198'
    },
    meals: {
      year: 2017,
      sourceTitle: 'Dunbar · Breaking Bread',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6979515/'
    },
    gratitude: {
      year: 2022,
      sourceTitle: 'Chang et al. · Scientific Reports · tableau 1',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9271060/'
    },
    sharedActivities: {
      year: 2000,
      sourceTitle: 'Aron et al. · Journal of Personality and Social Psychology',
      url: 'https://pubmed.ncbi.nlm.nih.gov/10707334/'
    },
    facialCare: {
      year: 2023,
      sourceTitle: 'Bouhout et al. · International Journal of Cosmetic Science',
      url: 'https://doi.org/10.1111/ics.12855'
    },
    coupleMassage: {
      year: 2021,
      sourceTitle: 'Effects of couples positive massage programme',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8114367/'
    },
    spending: {
      year: 2024,
      sourceTitle: 'How spending decisions shape happiness in everyday life',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11659422/'
    },
    sexualCommunication: {
      year: 2019,
      sourceTitle: 'Méta-analyse · Couples’ sexual communication and dimensions of sexual function',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6699928/'
    }
  };

  function fact(source, values) {
    return Object.freeze(Object.assign({}, sources[source], values));
  }

  const facts = {
    cuddling: fact('appeal', {
      metric: '87,8 %',
      headline: 'L’envie de câlins',
      detail: 'Dans cette enquête, se câliner plus souvent était jugé assez ou très attirant par 87,8 % des répondants.',
      scope: 'États-Unis · adultes · enquête 2015 · 1 966 réponses à cette question.',
      limitations: 'Intérêt déclaré, pas fréquence de pratique ni bénéfice mesuré. Ce chiffre ne prédit pas les envies de votre partenaire.'
    }),
    massage: fact('appeal', {
      metric: '79,3 %',
      headline: 'Le massage dans l’intimité',
      detail: '79,3 % des répondants trouvaient assez ou très attirant de donner ou recevoir un massage avant un rapport.',
      scope: 'États-Unis · adultes · enquête 2015 · 1 963 réponses à cette question.',
      limitations: 'La question portait sur le massage avant un rapport, sans mesurer une zone ni une durée précise. Il s’agit d’intérêt déclaré, pas d’une pratique ou d’une suite à prévoir.'
    }),
    kissing: fact('appeal', {
      metric: '86,4 %',
      headline: 'La place du baiser',
      detail: '86,4 % des répondants trouvaient assez ou très attirante l’idée de s’embrasser davantage pendant les rapports.',
      scope: 'États-Unis · adultes · enquête 2015 · 1 959 réponses à cette question.',
      limitations: 'Intérêt déclaré dans ce contexte intime. Aucune technique de baiser mesurée, ni recommandation sur votre moment.'
    }),
    atmosphere: fact('appeal', {
      metric: '77,1 %',
      headline: 'Changer l’ambiance',
      detail: 'Rendre une pièce plus romantique était jugé assez ou très attirant par 77,1 % des répondants.',
      scope: 'États-Unis · adultes · enquête sur l’intimité en 2015 · 1 964 réponses à cette question.',
      limitations: 'Il s’agit d’un intérêt déclaré. L’étude ne mesure pas l’effet de la lumière, des coussins ou de cette carte.'
    }),
    meal: fact('meals', {
      metric: '76,4 %',
      headline: 'Se retrouver autour d’un repas',
      detail: '76,4 % des personnes interrogées voyaient le repas partagé comme un bon moyen de rapprocher les gens.',
      scope: 'Royaume-Uni · enquête de 2016 auprès de 2 000 adultes · liens familiaux et amicaux inclus.',
      limitations: 'Opinion déclarée sur les repas partagés, pas effet démontré d’un plat, de la cuisine à deux ou de cette carte.'
    }),
    memories: fact('meals', {
      metric: '51,5 %',
      headline: 'Les souvenirs à partager',
      detail: '51,5 % des derniers dîners rapportés comportaient des souvenirs partagés. Ceux-ci étaient associés à davantage de proximité ressentie.',
      scope: 'Royaume-Uni · enquête de 2016 auprès de 2 000 adultes · dîners avec une personne extérieure au foyer.',
      limitations: 'Le pourcentage décrit la présence de souvenirs pendant ces dîners. Il ne mesure pas un taux de bénéfice, ni l’effet de cette carte.'
    }),
    thanks: fact('gratitude', {
      metric: '≈ 68 min / jour',
      headline: 'Faire une place aux mercis',
      detail: 'Après un plan pour remercier davantage, le groupe gratitude a augmenté sa présence commune d’environ 68 minutes par jour.',
      scope: '125 couples sur cinq semaines : 63 dans le groupe gratitude et 62 témoins. Intervention durant les trois dernières semaines.',
      limitations: 'Augmentation moyenne avant/après du groupe gratitude. Présence dans la même pièce, sommeil compris ; pas un gain garanti après un seul merci.'
    }),
    sharedActivity: fact('sharedActivities', {
      metric: '3 expériences en laboratoire',
      headline: 'La nouveauté partagée',
      detail: 'Dans trois expériences, les couples qui faisaient ensemble une activité nouvelle et stimulante ont rapporté une hausse plus forte de la qualité relationnelle que ceux qui faisaient une tâche ordinaire.',
      scope: 'Trois expériences de laboratoire auprès de couples ; certaines tâches duraient 7 minutes.',
      limitations: 'Le résultat porte sur des tâches nouvelles et stimulantes, pas sur chacune des activités de cette carte. Les résultats ne prédisent pas ce que ressentira votre duo.'
    }),
    faceCare: fact('facialCare', {
      metric: '32 personnes · soin d’une heure',
      headline: 'Le soin du visage et la détente',
      detail: 'Dans un groupe de 32 participantes ayant reçu un soin du visage, les mesures physiologiques et les réponses émotionnelles indiquaient un état de détente associé au soin.',
      scope: '63 femmes en bonne santé, âgées de 25 à 47 ans : 32 ont reçu le soin et 31 se sont reposées.',
      limitations: 'Étude de courte durée, soin professionnel d’une heure et petit échantillon féminin. Elle ne mesure ni un masque seul, ni un soin fait à deux.'
    }),
    mutualMassage: fact('coupleMassage', {
      metric: '3 semaines · 38 participants',
      headline: 'Le massage à deux',
      detail: 'Après un programme de massage réciproque, le bien-être mental et la gestion du stress s’étaient améliorés par rapport au début du programme.',
      scope: 'Étude préliminaire auprès de couples ; mesures au départ, après le programme puis trois semaines plus tard.',
      limitations: 'Petit échantillon et étude préliminaire ; la satisfaction relationnelle n’a pas changé de façon significative. Le protocole ne mesure pas une zone précise.'
    }),
    thoughtfulPurchase: fact('spending', {
      metric: '200 personnes · 7 pays',
      headline: 'Les cadeaux parmi les dépenses heureuses',
      detail: 'Dans cette étude de dépenses quotidiennes, les cadeaux et les expériences figuraient parmi les catégories associées aux niveaux de bonheur déclarés les plus élevés.',
      scope: 'Échantillon multinational de 200 adultes ayant reçu une somme à dépenser ; suivis à 3 et 6 mois.',
      limitations: 'Résultat autodéclaré dans une étude de dépenses avec dotation. Il ne fixe aucun budget et ne garantit pas qu’un achat précis fasse plaisir à votre partenaire.'
    }),
    sexualConversation: fact('sexualCommunication', {
      metric: 'r = 0,35 · 48 études',
      headline: 'Parler de ses envies compte',
      detail: 'La méta-analyse observe une association positive entre la communication sexuelle des partenaires et le fonctionnement sexuel global.',
      scope: 'Méta-analyse de 48 études portant majoritairement sur des personnes en couple.',
      limitations: 'Association statistique, pas preuve de causalité. La mesure porte sur communication et fonctionnement sexuel, pas sur l’efficacité ou le plaisir d’un acte précis.'
    })
  };

  // Deliberate ID mapping: a category alone never selects a statistic.
  const factByCard = Object.freeze({
    'comp-2': 'memories',
    'comp-4': 'memories',
    'det-1': 'massage',
    'det-2': 'massage',
    'det-6': 'atmosphere',
    'tend-1': 'cuddling',
    'tend-4': 'cuddling',
    'att-3': 'thanks',
    'att-5': 'meal',
    'dec-3': 'meal',
    'int-2': 'kissing',
    'int-3': 'atmosphere',
    'stck-5-01': 'kissing',
    'stck-1-03': 'massage',
    'stck-1-04': 'massage',
    'stck-1-07': 'massage',
    'stck-1-06': 'faceCare',
    'stck-9-02': 'faceCare',
    'stck-2-02': 'meal',
    'stck-2-09': 'meal',
    'stck-2-10': 'meal',
    'stck-2-11': 'meal',
    'stck-2-03': 'meal',
    'stck-2-12': 'meal',
    'stck-2-13': 'meal',
    'stck-9-03': 'meal',
    'stck-2-05': 'meal',
    'stck-9-04': 'meal'
  });

  const fallbackText = Object.freeze({
    conversation: 'Une question peut servir de point de départ. Vous choisissez ce que vous avez envie de raconter et d’écouter.',
    day: 'Un petit événement suffit pour commencer à raconter votre journée. À vous de choisir le détail que vous souhaitez partager.',
    planning: 'Vous pouvez imaginer une sortie ensemble et décider plus tard du moment qui vous convient.',
    appreciation: 'Vous pouvez nommer un détail que vous appréciez chez l’autre, avec vos propres mots.',
    quiet: 'Cette pause peut se passer en parlant ou en silence. Choisissez ce qui vous convient aujourd’hui.',
    drink: 'Une boisson que vous aimez et un moment choisi ensemble : à vous de donner sa forme à cette pause.',
    music: 'Choisissez un morceau pour vos goûts, les souvenirs qu’il évoque ou l’envie de le faire découvrir à l’autre.',
    hand: 'Main dans la main, en marchant ou au repos : choisissez ensemble ce qui est agréable pour vous.',
    message: 'Une phrase sincère suffit. Vous choisissez ce que vous souhaitez dire et la façon de le partager.',
    welcome: 'Inventez un mot ou un geste pour vos retrouvailles, selon ce qui vous fait plaisir à tous les deux.',
    walk: 'La promenade peut être courte et familière, ou emprunter un autre chemin. Décidez ensemble de votre parenthèse.',
    care: 'Choisissez le soin, le geste et le moment qui plaisent à la personne qui reçoit cette attention.',
    drawing: 'Le dessin peut être rapide, tendre ou amusant. Vous choisissez vous-mêmes ce que vous voulez en faire.',
    creating: 'Inventez une proposition qui vous ressemble. Son contenu et son rythme se décident à deux.',
    wishes: 'Vous pouvez partager une envie sans vous engager à la réaliser. La conversation peut simplement vous permettre de préciser vos préférences.',
    preferences: 'Racontez un détail qui vous plaît et écoutez celui de l’autre. Vous choisissez la place que vous voulez lui donner.',
    invitation: 'Une invitation ouvre une conversation. Vous pouvez convenir ensemble d’un moment et de ce que vous souhaitez y partager.',
    rhythm: 'Vos envies peuvent changer d’un jour à l’autre. Chacun peut préciser ce qui lui convient pour ce moment.',
    snack: 'Choisissez une boisson, quelque chose à grignoter et un moment où vous avez envie de vous retrouver.',
    general: 'Adaptez cette proposition à vos goûts, au temps disponible et à ce qui vous convient à tous les deux.'
  });

  const fallbackByCard = Object.freeze({
    'comp-1': 'conversation',
    'comp-3': 'day',
    'comp-5': 'planning',
    'comp-6': 'appreciation',
    'det-3': 'quiet',
    'det-4': 'drink',
    'det-5': 'music',
    'tend-2': 'hand',
    'tend-3': 'message',
    'tend-5': 'welcome',
    'tend-6': 'walk',
    'att-1': 'message',
    'att-2': 'music',
    'att-4': 'care',
    'att-6': 'message',
    'dec-1': 'walk',
    'dec-2': 'drawing',
    'dec-4': 'music',
    'dec-5': 'conversation',
    'dec-6': 'creating',
    'int-1': 'wishes',
    'int-4': 'preferences',
    'int-5': 'invitation',
    'int-6': 'rhythm',
    'stck-5-03': 'message',
    'stck-9-01': 'care',
    'stck-9-02': 'care',
    'stck-1-06': 'care',
    'stck-1-08': 'care',
    'stck-2-04': 'drink',
    'stck-2-06': 'snack'
  });

  const fallbackByCategory = Object.freeze({
    complicite: 'conversation',
    detente: 'quiet',
    tendresse: 'general',
    attention: 'care',
    decouverte: 'creating',
    intimite: 'wishes'
  });

  function ownValue(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : null;
  }

  const active = new Map((scope.OndeEvidenceData || []).map(fact => [fact.cardId, Object.freeze(fact)]));

  function forCard(card) {
    const id = card && typeof card.id === 'string' ? card.id : '';
    if (active.has(id)) return Object.assign({}, active.get(id));
    const factKey = ownValue(factByCard, id);
    if (factKey) return Object.assign({}, facts[factKey]);

    const categoryId = card && typeof card.categoryId === 'string' ? card.categoryId : '';
    const fallbackKey = ownValue(fallbackByCard, id) || ownValue(fallbackByCategory, categoryId) || 'general';
    return {
      metric: null,
      headline: 'Un moment à votre façon',
      detail: fallbackText[fallbackKey],
      scope: 'Suggestion ONDE · pas une statistique.',
      year: null,
      sourceTitle: 'Repère ONDE',
      url: null,
      limitations: 'Aucun chiffre spécifique vérifié pour cette proposition.'
    };
  }

  scope.OndeEvidence = Object.freeze({ forCard });
})(typeof window !== 'undefined' ? window : globalThis);
