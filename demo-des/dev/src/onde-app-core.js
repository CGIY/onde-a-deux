/* ONDE — local prototype rules. No networking, storage, or UI side effects. */
(function (scope) {
  'use strict';

  const categories = [
    { id: 'complicite', number: 1, label: 'Complicité', color: '#8BB7C2', icon: 'messages-square', description: 'Se retrouver dans les petits échanges.' },
    { id: 'detente', number: 2, label: 'Détente', color: '#A3BD8B', icon: 'leaf', description: 'Prendre soin du moment, à votre rythme.' },
    { id: 'tendresse', number: 3, label: 'Tendresse', color: '#E1ABB5', icon: 'heart', description: 'Des gestes simples, choisis ensemble.' },
    { id: 'attention', number: 4, label: 'Attention', color: '#E6B66E', icon: 'gift', description: 'Une petite attention qui vous ressemble.' },
    { id: 'decouverte', number: 5, label: 'Découverte', color: '#B5A2D5', icon: 'sparkles', description: 'Essayer une autre façon de passer du temps à deux.' },
    { id: 'intimite', number: 6, label: 'Intimité', color: '#DB9278', icon: 'moon', description: 'Faire une place à vos envies et à vos limites.' }
  ];

  const cards = [
    { id:'comp-1', categoryId:'complicite', title:'La question inattendue', description:'Choisissez une question que vous ne vous posez jamais, puis prenez le temps d’écouter la réponse de chacun.', duration:5, hp:21, variant:'Une seule question, une réponse chacun.', variantDuration:2 },
    { id:'comp-2', categoryId:'complicite', title:'Un souvenir à deux', description:'Racontez chacun un détail d’un moment partagé que vous aimeriez revivre.', duration:5, hp:18, variant:'Partagez simplement le nom de ce souvenir.', variantDuration:1 },
    { id:'comp-3', categoryId:'complicite', title:'Trois choses de ta journée', description:'Racontez une petite joie, une difficulté et une surprise de votre journée.', duration:8, hp:21, variant:'Gardez seulement la petite joie du jour.', variantDuration:2 },
    { id:'comp-4', categoryId:'complicite', title:'Une photo, une histoire', description:'Choisissez une photo dans vos souvenirs et racontez ce qu’elle vous rappelle.', duration:5, hp:18, variant:'Envoyez la photo avec une phrase.', variantDuration:1 },
    { id:'comp-5', categoryId:'complicite', title:'Notre prochaine parenthèse', description:'Imaginez ensemble une petite sortie qui vous ferait plaisir, sans obligation de la planifier aujourd’hui.', duration:10, hp:25, variant:'Proposez chacun une seule idée.', variantDuration:3 },
    { id:'comp-6', categoryId:'complicite', title:'Le détail que j’aime', description:'Dites-vous chacun un détail du quotidien que vous appréciez chez l’autre.', duration:3, hp:15, variant:'Un compliment précis, simplement.', variantDuration:1 },

    { id:'det-1', categoryId:'detente', title:'Massage de la tête', description:'Propose un massage de la tête pendant dix minutes. La personne qui le reçoit choisit les gestes et la pression qui lui conviennent.', duration:10, hp:30, variant:'Un massage de la tête pendant trois minutes, avec les gestes choisis ensemble.', variantDuration:3 },
    { id:'det-2', categoryId:'detente', title:'Les mains au repos', description:'Propose un massage des mains, en ajustant les gestes à ce que l’autre apprécie.', duration:5, hp:21, variant:'Une seule main, pendant deux minutes.', variantDuration:2 },
    { id:'det-3', categoryId:'detente', title:'Une pause sans écrans', description:'Installez-vous ensemble et laissez les téléphones de côté le temps d’une courte pause.', duration:10, hp:21, variant:'Une pause de trois minutes, même sans parler.', variantDuration:3 },
    { id:'det-4', categoryId:'detente', title:'La boisson choisie', description:'Prépare une boisson que l’autre aime et partagez un moment tranquille.', duration:10, hp:18, variant:'Apporte simplement sa boisson préférée.', variantDuration:3 },
    { id:'det-5', categoryId:'detente', title:'Le morceau du moment', description:'Choisissez un morceau et écoutez-le ensemble, confortablement installés.', duration:5, hp:15, variant:'Écoutez un extrait choisi à deux.', variantDuration:2 },
    { id:'det-6', categoryId:'detente', title:'Un coin confortable', description:'Prépare un endroit agréable pour une pause à deux : coussins, lumière et place pour se poser.', duration:10, hp:25, variant:'Choisissez simplement votre place préférée.', variantDuration:2 },

    { id:'tend-1', categoryId:'tendresse', title:'Un câlin choisi', description:'Proposez-vous un câlin et choisissez ensemble sa durée et la façon de vous installer.', duration:3, hp:21, variant:'Un bref câlin, à votre rythme.', variantDuration:1 },
    { id:'tend-2', categoryId:'tendresse', title:'Main dans la main', description:'Prenez quelques minutes pour vous tenir la main, en marchant ou installés ensemble.', duration:5, hp:18, variant:'Un instant main dans la main.', variantDuration:1 },
    { id:'tend-3', categoryId:'tendresse', title:'Un mot tout près', description:'Dites à l’autre une phrase que vous aimeriez qu’il ou elle garde en tête aujourd’hui.', duration:2, hp:15, variant:'Écrivez cette phrase dans un petit mot.', variantDuration:1 },
    { id:'tend-4', categoryId:'tendresse', title:'Tout contre', description:'Proposez de vous installer l’un contre l’autre et choisissez une position confortable pour les deux.', duration:10, hp:25, variant:'Trois minutes ensemble, dans la position de votre choix.', variantDuration:3 },
    { id:'tend-5', categoryId:'tendresse', title:'Un accueil différent', description:'Imaginez ensemble une petite façon de vous accueillir lors de vos prochaines retrouvailles.', duration:5, hp:18, variant:'Choisissez un mot ou un geste pour vous retrouver.', variantDuration:2 },
    { id:'tend-6', categoryId:'tendresse', title:'Quelques pas ensemble', description:'Faites une petite promenade à deux, avec ou sans conversation.', duration:15, hp:25, variant:'Quelques pas, ou un moment à la fenêtre ensemble.', variantDuration:3 },

    { id:'att-1', categoryId:'attention', title:'Le petit mot caché', description:'Écris une attention et laisse-la dans un endroit où l’autre la découvrira.', duration:3, hp:18, variant:'Un message court envoyé directement.', variantDuration:1 },
    { id:'att-2', categoryId:'attention', title:'Un morceau pour toi', description:'Choisis un morceau pour l’autre et explique en une phrase pourquoi tu y as pensé.', duration:5, hp:18, variant:'Partage simplement le titre du morceau.', variantDuration:1 },
    { id:'att-3', categoryId:'attention', title:'Merci pour ce détail', description:'Remercie l’autre pour une attention précise, récente ou ancienne.', duration:3, hp:15, variant:'Un merci précis en une phrase.', variantDuration:1 },
    { id:'att-4', categoryId:'attention', title:'Une pause offerte', description:'Demande à l’autre ce qui lui ferait plaisir pendant dix minutes, puis convenez d’une petite attention réalisable.', duration:10, hp:25, variant:'Demande simplement quelle attention serait bienvenue.', variantDuration:2 },
    { id:'att-5', categoryId:'attention', title:'Une table pour deux', description:'Ajoute une petite attention au prochain repas partagé : une lumière, un mot ou une présentation différente.', duration:10, hp:21, variant:'Choisis un seul détail pour le prochain repas.', variantDuration:2 },
    { id:'att-6', categoryId:'attention', title:'La voix du jour', description:'Enregistre un bref message vocal pour raconter à l’autre une chose qui t’a fait penser à vous.', duration:3, hp:18, variant:'Une phrase, écrite ou dite de vive voix.', variantDuration:1 },

    { id:'dec-1', categoryId:'decouverte', title:'Un chemin différent', description:'Choisissez une petite promenade ou un détour que vous n’avez pas l’habitude de faire ensemble.', duration:15, hp:25, variant:'Repérez seulement un endroit à découvrir une autre fois.', variantDuration:3 },
    { id:'dec-2', categoryId:'decouverte', title:'Le portrait minute', description:'Dessinez chacun un petit portrait de l’autre et échangez vos créations.', duration:5, hp:21, variant:'Un portrait en trois traits.', variantDuration:1 },
    { id:'dec-3', categoryId:'decouverte', title:'Une recette à choisir', description:'Choisissez ensemble quelque chose de nouveau à cuisiner ou à goûter un autre jour.', duration:10, hp:21, variant:'Proposez chacun un ingrédient ou une idée.', variantDuration:2 },
    { id:'dec-4', categoryId:'decouverte', title:'La playlist commune', description:'Ajoutez chacun deux morceaux à une petite playlist destinée à vos moments ensemble.', duration:10, hp:25, variant:'Un seul morceau chacun.', variantDuration:3 },
    { id:'dec-5', categoryId:'decouverte', title:'Une question à inventer', description:'Inventez une question amusante et laissez l’autre choisir s’il ou elle veut y répondre ou vous la retourner.', duration:5, hp:18, variant:'Une question courte, sans explication obligatoire.', variantDuration:2 },
    { id:'dec-6', categoryId:'decouverte', title:'Notre carte à nous', description:'Inventez ensemble une nouvelle proposition que vous aimeriez retrouver dans le jeu.', duration:10, hp:21, variant:'Donnez seulement un titre à votre future carte.', variantDuration:3 },

    { id:'int-1', categoryId:'intimite', title:'Parler de nos envies', description:'Partagez chacun une envie de proximité pour les jours à venir, sans promesse de la réaliser.', duration:10, hp:21, variant:'Exprimez une seule envie, sans devoir la détailler.', variantDuration:3 },
    { id:'int-2', categoryId:'intimite', title:'Un baiser choisi', description:'Proposez-vous un baiser et laissez chacun préciser ce qui lui ferait plaisir.', duration:2, hp:18, variant:'Choisissez un autre geste tendre qui vous convient.', variantDuration:1 },
    { id:'int-3', categoryId:'intimite', title:'Une parenthèse à deux', description:'Convenez d’un court moment de proximité, avec une ambiance et des gestes que vous choisissez ensemble.', duration:15, hp:25, variant:'Cinq minutes de proximité, définies ensemble.', variantDuration:5 },
    { id:'int-4', categoryId:'intimite', title:'Ce qui me plaît', description:'Racontez chacun un détail qui vous plaît dans vos moments de proximité.', duration:5, hp:18, variant:'Un détail chacun, en une phrase.', variantDuration:2 },
    { id:'int-5', categoryId:'intimite', title:'Une invitation pour ce soir', description:'Proposez un moment à deux pour ce soir, puis choisissez ensemble ce que vous aimeriez y partager.', duration:10, hp:21, variant:'Choisissez seulement un moment pour en reparler.', variantDuration:2 },
    { id:'int-6', categoryId:'intimite', title:'Notre rythme du moment', description:'Prenez quelques minutes pour dire ce qui vous tente aujourd’hui, ce qui attendra et ce que vous préférez laisser de côté.', duration:5, hp:15, variant:'Chacun nomme simplement ce qui lui ferait plaisir aujourd’hui.', variantDuration:2 }
  ];

  // STCK titles adapted for ONDE; durations and HP are prototype values.
  const stckCards=[{"id":"stck-5-01","categoryId":"intimite","title":"Bisou avec la langue","description":"Propose ce baiser et prenez un instant pour choisir ensemble le moment qui vous convient.","duration":2,"hp":18,"variant":"Proposez-vous un baiser bref, à votre rythme.","variantDuration":1,"sourceId":"5-01","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"5-01","title":"Bisou avec la langue","collectionId":"11","collectionTitle":"Amour","activeInSource":true}},{"id":"stck-5-03","categoryId":"complicite","title":"Message d’amour sincère","description":"Écris à l’autre quelques phrases sincères sur ce que tu apprécies dans votre relation, puis partage ton message.","duration":5,"hp":21,"variant":"Dis ou écris une seule phrase qui te tient à cœur.","variantDuration":1,"sourceId":"5-03","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"5-03","title":"Message d’amour sincère","collectionId":"11","collectionTitle":"Amour","activeInSource":true}},{"id":"stck-1-03","categoryId":"detente","title":"Massage des épaules","description":"Propose un massage des épaules pendant dix minutes. La personne qui le reçoit indique les gestes et la pression qui lui conviennent.","duration":10,"hp":25,"variant":"Masse les épaules pendant trois minutes, avec la pression choisie ensemble.","variantDuration":3,"sourceId":"1-03","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-03","title":"Massage des épaules","collectionId":"12","collectionTitle":"Massage","activeInSource":true}},{"id":"stck-1-04","categoryId":"detente","title":"Massage des cuisses","description":"Propose un massage des cuisses. Choisissez une installation confortable et ajustez les gestes et la pression aux préférences de la personne qui reçoit.","duration":8,"hp":25,"variant":"Propose un massage de trois minutes sur une zone choisie ensemble.","variantDuration":3,"sourceId":"1-04","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-04","title":"Massage des cuisses","collectionId":"12","collectionTitle":"Massage","activeInSource":true}},{"id":"stck-1-07","categoryId":"detente","title":"Massage total","description":"Propose vingt minutes de massage en passant entre les zones choisies ensemble. La personne qui reçoit guide la pression et peut demander une pause.","duration":20,"hp":35,"variant":"Choisissez une seule zone confortable pour cinq minutes de massage.","variantDuration":5,"sourceId":"1-07","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-07","title":"Massage total","collectionId":"12","collectionTitle":"Massage","activeInSource":true}},{"id":"stck-9-01","categoryId":"attention","title":"Pose de vernis","description":"Propose de poser du vernis à l’autre. Choisissez une couleur parmi celles disponibles et installez-vous confortablement pour prendre votre temps.","duration":20,"hp":25,"variant":"Choisissez ensemble une couleur pour une prochaine pose.","variantDuration":3,"sourceId":"9-01","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"9-01","title":"Pose de vernis","collectionId":"13","collectionTitle":"Soin","activeInSource":true}},{"id":"stck-9-02","categoryId":"detente","title":"Masque (soin)","description":"Prévoyez une pause avec un masque de soin que vous utilisez déjà. Installez-vous ensemble et suivez le temps indiqué sur le produit.","duration":15,"hp":21,"variant":"Prenez cinq minutes pour un soin habituel, sans ajouter de produit nouveau.","variantDuration":5,"sourceId":"9-02","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"9-02","title":"Masque (soin)","collectionId":"13","collectionTitle":"Soin","activeInSource":true}},{"id":"stck-1-06","categoryId":"attention","title":"Soin complet du visage","description":"Prépare un moment de soin du visage avec les produits habituels de l’autre. Laisse la personne choisir les étapes et propose ton aide.","duration":20,"hp":30,"variant":"Propose ton aide pour une seule étape de son soin habituel.","variantDuration":5,"sourceId":"1-06","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-06","title":"Soin complet du visage","collectionId":"13","collectionTitle":"Soin","activeInSource":true}},{"id":"stck-1-08","categoryId":"tendresse","title":"Soirée complète de soin","description":"Prévoyez une soirée de soin à deux avec ce que vous avez déjà : visage, mains ou vernis. Choisissez vos soins et prenez soin l’un de l’autre.","duration":45,"hp":35,"variant":"Choisissez un seul soin à partager pendant dix minutes.","variantDuration":10,"sourceId":"1-08","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-08","title":"Soirée complète de soin","collectionId":"13","collectionTitle":"Soin","activeInSource":true}},{"id":"stck-2-02","categoryId":"complicite","title":"Burger","description":"Prévoyez un repas burger à deux. Choisissez ensemble les garnitures et le moment, puis partagez le repas tranquillement.","duration":30,"hp":25,"variant":"Choisissez les garnitures et une date pour ce repas.","variantDuration":3,"sourceId":"2-02","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-02","title":"Burger","collectionId":"14","collectionTitle":"Fast Food","activeInSource":true}},{"id":"stck-2-09","categoryId":"complicite","title":"Pizza","description":"Prévoyez un repas pizza à deux. Choisissez une garniture commune ou chacun la sienne, puis installez-vous pour partager ce moment.","duration":30,"hp":25,"variant":"Choisissez ensemble la garniture de votre prochaine pizza.","variantDuration":3,"sourceId":"2-09","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-09","title":"Pizza","collectionId":"14","collectionTitle":"Fast Food","activeInSource":true}},{"id":"stck-2-10","categoryId":"decouverte","title":"Sushi","description":"Prévoyez un repas sushi à deux. Choisissez ensemble ce que vous aimeriez goûter et prenez le temps de découvrir vos préférences.","duration":30,"hp":25,"variant":"Choisissez chacun une saveur pour un prochain repas sushi.","variantDuration":3,"sourceId":"2-10","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-10","title":"Sushi","collectionId":"14","collectionTitle":"Fast Food","activeInSource":true}},{"id":"stck-2-11","categoryId":"complicite","title":"Kébab","description":"Prévoyez une pause kébab à deux. Choisissez ensemble le moment et profitez du repas pour vous retrouver.","duration":25,"hp":21,"variant":"Choisissez un moment pour votre prochaine pause kébab.","variantDuration":2,"sourceId":"2-11","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-11","title":"Kébab","collectionId":"14","collectionTitle":"Fast Food","activeInSource":true}},{"id":"stck-2-03","categoryId":"decouverte","title":"Faire un cake","description":"Préparez un cake ensemble avec une recette choisie à deux. Répartissez les étapes et gardez un moment pour le goûter une fois prêt.","duration":60,"hp":30,"variant":"Choisissez une recette de cake et répartissez les étapes pour une autre fois.","variantDuration":5,"sourceId":"2-03","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-03","title":"Faire un cake","collectionId":"15","collectionTitle":"Pâtissier","activeInSource":true}},{"id":"stck-2-12","categoryId":"decouverte","title":"Faire des cookies","description":"Préparez une petite fournée de cookies ensemble. Choisissez les ajouts, partagez les étapes et goûtez votre préparation une fois prête.","duration":30,"hp":25,"variant":"Choisissez une recette et les ajouts de votre prochaine fournée.","variantDuration":3,"sourceId":"2-12","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-12","title":"Faire des cookies","collectionId":"15","collectionTitle":"Pâtissier","activeInSource":true}},{"id":"stck-2-13","categoryId":"decouverte","title":"Faire des crêpes","description":"Préparez des crêpes à deux. Alternez les étapes et choisissez chacun une garniture à faire découvrir à l’autre.","duration":30,"hp":25,"variant":"Choisissez chacun une garniture pour une prochaine tournée de crêpes.","variantDuration":3,"sourceId":"2-13","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-13","title":"Faire des crêpes","collectionId":"15","collectionTitle":"Pâtissier","activeInSource":true}},{"id":"stck-9-03","categoryId":"decouverte","title":"Faire une tarte","description":"Préparez une tarte ensemble avec les ingrédients disponibles. Choisissez la recette et répartissez la préparation.","duration":50,"hp":30,"variant":"Choisissez la recette de votre prochaine tarte et notez les ingrédients nécessaires.","variantDuration":5,"sourceId":"9-03","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"9-03","title":"Faire une tarte","collectionId":"15","collectionTitle":"Pâtissier","activeInSource":true}},{"id":"stck-2-05","categoryId":"attention","title":"Petit-déjeuner sur canapé","description":"Prépare un petit-déjeuner à partager sur le canapé, avec ce que vous aimez et ce que vous avez déjà. Convenez du matin qui vous convient.","duration":20,"hp":21,"variant":"Apporte une boisson et partagez cinq minutes sur le canapé.","variantDuration":5,"sourceId":"2-05","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-05","title":"Petit-déjeuner sur canapé","collectionId":"16","collectionTitle":"Canapé","activeInSource":true}},{"id":"stck-9-04","categoryId":"attention","title":"Petit goûter sur canapé","description":"Prépare un petit goûter à partager sur le canapé. Choisissez une collation disponible et faites une pause ensemble.","duration":15,"hp":18,"variant":"Partagez une petite collation pendant cinq minutes.","variantDuration":5,"sourceId":"9-04","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"9-04","title":"Petit goûter sur canapé","collectionId":"16","collectionTitle":"Canapé","activeInSource":true}},{"id":"stck-2-04","categoryId":"tendresse","title":"Chocolat du soir et canapé","description":"Préparez votre chocolat du soir et installez-vous ensemble sur le canapé pour une pause tranquille.","duration":15,"hp":18,"variant":"Partagez cinq minutes sur le canapé avec votre boisson du soir.","variantDuration":5,"sourceId":"2-04","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-04","title":"Chocolat du soir et canapé","collectionId":"16","collectionTitle":"Canapé","activeInSource":true}},{"id":"stck-2-06","categoryId":"complicite","title":"Apéro sur canapé","description":"Prévoyez un apéro sur le canapé avec une boisson de votre choix et de quoi grignoter. Prenez le temps de vous retrouver.","duration":20,"hp":21,"variant":"Partagez une boisson et une courte pause sur le canapé.","variantDuration":5,"sourceId":"2-06","source":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"2-06","title":"Apéro sur canapé","collectionId":"16","collectionTitle":"Canapé","activeInSource":true}}];
  cards.push(...stckCards);
  const stckExistingLinks={"det-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-02","title":"Massage de la tête","collectionId":"12","collectionTitle":"Massage","activeInSource":true},"tend-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"5-02","title":"Câlin (accolade)","collectionId":"11","collectionTitle":"Amour","activeInSource":true},"att-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-05","title":"Mot doux à cacher","collectionId":"11","collectionTitle":"Amour","activeInSource":true}};
  for(const [id,source] of Object.entries(stckExistingLinks)) { const card=cards.find(card=>card.id===id); if(card)card.source=source; }

  const players = [{ id:'a', name:'Joueur 1' }, { id:'b', name:'Joueur 2' }];
  const cardMap = Object.fromEntries(cards.map(card => [card.id, card]));
  const categoryMap = Object.fromEntries(categories.map(category => [category.id, category]));
  const phases = ['category','card','draft','draft_challenge','pending','challenge','challenge_failed','sender_confirmation','accepted','resolved'];
  const prefKeys = ['reducedMotion','sound','discreet','reminder'];
  const otherPlayer = id => id === 'a' ? 'b' : 'a';
  const getCard = id => cardMap[id] || null;
  const getCategory = id => categoryMap[id] || null;

  function randomInt(n) {
    if (!Number.isInteger(n) || n < 1 || n > 4294967296) throw new RangeError('randomInt expects an integer from 1 to 2^32.');
    if (scope.crypto && typeof scope.crypto.getRandomValues === 'function') {
      const sample = new Uint32Array(1);
      const limit = Math.floor(4294967296 / n) * n;
      do { scope.crypto.getRandomValues(sample); } while (sample[0] >= limit);
      return (sample[0] % n) + 1;
    }
    return Math.floor(Math.random() * n) + 1;
  }

  function blankRound(sequence, from, at) {
    return { id:'onde-'+sequence, from, to:otherPlayer(from), awaiting:null,
      categoryId:null, categoryRoll:null, hand:[], cardId:null, cardRoll:null,
      hp:null, rolls:[], rollTokens:[], challengeUsed:false, status:'drawing',
      draftRolls:[], draftRollTokens:[], draftChallengeUsed:false, autoProposed:false,
      fromConfirmed:false, toConfirmed:false,
      adapted:false, proposal:null, schedule:null, createdAt:at || null,
      sentAt:null, acceptedAt:null, endedAt:null, closedBy:null };
  }

  function emptyStats() {
    return { totalCompleted:0, byCategory:Object.fromEntries(categories.map(category=>[category.id,0])) };
  }

  function validStats(stats) {
    if(!stats || typeof stats!=='object' || Array.isArray(stats) || !Number.isSafeInteger(stats.totalCompleted) || stats.totalCompleted<0) return false;
    const byCategory=stats.byCategory;
    if(!byCategory || typeof byCategory!=='object' || Array.isArray(byCategory) || Object.keys(byCategory).length!==categories.length) return false;
    if(categories.some(category=>!Object.prototype.hasOwnProperty.call(byCategory,category.id) || !Number.isSafeInteger(byCategory[category.id]) || byCategory[category.id]<0)) return false;
    return categories.reduce((total,category)=>total+byCategory[category.id],0)===stats.totalCompleted;
  }

  function createState() {
    return { version:1, activePlayer:'a', phase:'category', sequence:1,
      players:players.map(p => ({...p})), round:blankRound(1,'a'), history:[], favorites:[],
      prefs:{reducedMotion:false,sound:false,discreet:true,reminder:true}, seen:{}, stats:emptyStats() };
  }

  function validRolls(rolls, tokens) {
    return Array.isArray(rolls) && Array.isArray(tokens) && rolls.length<=2 && tokens.length===rolls.length &&
      new Set(tokens).size===tokens.length && rolls.every(value=>Number.isInteger(value) && value>=1 && value<=20) &&
      tokens.every(token=>typeof token==='string' && token.length>0 && token.length<=150);
  }

  function validateState(s) {
    if (!s || s.version !== 1 || !['a','b'].includes(s.activePlayer) || !phases.includes(s.phase)) return false;
    if (!validStats(s.stats)) return false;
    if (!Number.isInteger(s.sequence) || s.sequence < 1 || !s.round || !Array.isArray(s.history) || s.history.length > 80) return false;
    if (!Array.isArray(s.favorites) || s.favorites.some(id => !getCard(id)) || !s.prefs || prefKeys.some(k => typeof s.prefs[k] !== 'boolean')) return false;
    if (!s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen)) return false;
    if (Object.entries(s.seen).some(([key,list]) => !getCategory(key) || !Array.isArray(list) || list.length>8 || list.some(id=>!getCard(id) || getCard(id).categoryId!==key))) return false;
    if (!Array.isArray(s.players) || s.players.length !== 2 || s.players.some((p,i) => !p || p.id !== players[i].id || typeof p.name !== 'string' || !p.name.trim() || p.name.length>60)) return false;
    if (s.history.some(item=>!item || typeof item.id!=='string' || !getCard(item.cardId) || !['passed','defended','completed'].includes(item.status) || !['a','b'].includes(item.from) || item.to!==otherPlayer(item.from) || !Array.isArray(item.rolls) || item.rolls.length>2 || item.rolls.some(v=>!Number.isInteger(v) || v<1 || v>20))) return false;
    const r=s.round;
    if (r.id !== 'onde-'+s.sequence || !['a','b'].includes(r.from) || r.to !== otherPlayer(r.from)) return false;
    if (![null,'a','b'].includes(r.awaiting) || !Array.isArray(r.hand) || !validRolls(r.rolls,r.rollTokens) || !validRolls(r.draftRolls,r.draftRollTokens)) return false;
    if (['challengeUsed','draftChallengeUsed','autoProposed','fromConfirmed','toConfirmed','adapted'].some(key=>typeof r[key]!=='boolean')) return false;
    if ((r.rolls.length && !r.challengeUsed) || (r.draftRolls.length && !r.draftChallengeUsed)) return false;
    if (r.proposal!==null && (typeof r.proposal!=='string' || r.proposal.length>400)) return false;
    if (r.schedule!==null && (typeof r.schedule!=='string' || r.schedule.length>80)) return false;
    const beforeCard=r.rolls.length===0 && r.draftRolls.length===0 && !r.challengeUsed && !r.draftChallengeUsed && !r.autoProposed && !r.fromConfirmed && !r.toConfirmed;
    if (s.phase === 'category') return r.categoryId === null && r.categoryRoll === null && r.cardId === null && r.cardRoll===null && r.hp===null && r.hand.length === 0 && beforeCard && r.status==='drawing' && r.awaiting===null;
    const cat=getCategory(r.categoryId);
    if (!cat || r.categoryRoll !== cat.number || r.hand.length !== 4 || new Set(r.hand).size !== 4 || r.hand.some(id => !getCard(id) || getCard(id).categoryId !== cat.id)) return false;
    if (s.phase === 'card') return r.cardId === null && r.cardRoll === null && r.hp===null && beforeCard && r.status==='drawing' && r.awaiting===null;
    const card=getCard(r.cardId);
    if (!card || !Number.isInteger(r.cardRoll) || r.cardRoll<1 || r.cardRoll>4 || r.hand[r.cardRoll-1]!==r.cardId || card.categoryId!==cat.id || r.hp!==card.hp) return false;
    const total=r.rolls.reduce((sum,v)=>sum+v,0),draftTotal=r.draftRolls.reduce((sum,v)=>sum+v,0);
    if(r.autoProposed && (!r.draftChallengeUsed || r.draftRolls.length!==2 || draftTotal>=r.hp)) return false;
    if(s.phase==='draft') return r.status==='draft' && r.awaiting===null && beforeCard;
    if(s.phase==='draft_challenge') return r.status==='draft_challenge' && r.awaiting===r.from && r.draftChallengeUsed && r.draftRolls.length<2 && draftTotal<r.hp && !r.challengeUsed && !r.rolls.length && !r.autoProposed && !r.fromConfirmed && !r.toConfirmed;
    if(s.phase==='pending') {
      if(!['a','b'].includes(r.awaiting) || !['pending','counterproposal','scheduled_proposal'].includes(r.status)) return false;
      if(r.status==='pending' && (r.awaiting!==r.to || r.challengeUsed || r.toConfirmed || r.fromConfirmed!==!r.autoProposed)) return false;
      if(r.status==='counterproposal' && (!r.adapted || !r.proposal)) return false;
      if(r.status==='scheduled_proposal' && !r.schedule) return false;
      if(r.status!=='pending') {
        const awaitingConfirmed=r.awaiting===r.from?r.fromConfirmed:r.toConfirmed;
        const proposerConfirmed=r.awaiting===r.from?r.toConfirmed:r.fromConfirmed;
        if(awaitingConfirmed || !proposerConfirmed) return false;
      }
    }
    if(s.phase==='sender_confirmation' && (r.status!=='sender_confirmation' || r.awaiting!==r.from || r.fromConfirmed || !r.toConfirmed || !r.autoProposed)) return false;
    if(s.phase==='accepted' && (r.status!=='accepted' || r.awaiting!==null || !r.fromConfirmed || !r.toConfirmed)) return false;
    if(s.phase==='challenge' && (r.status!=='challenge' || !r.challengeUsed || r.rolls.length>=2 || total>=r.hp || r.awaiting!==r.to || r.toConfirmed || r.fromConfirmed!==!r.autoProposed)) return false;
    if(s.phase==='challenge_failed' && (r.status!=='challenge_failed' || !r.challengeUsed || r.rolls.length!==2 || total>=r.hp || r.awaiting!==r.to || r.toConfirmed || r.fromConfirmed!==!r.autoProposed)) return false;
    if(s.phase==='resolved' && (!['passed','defended','completed'].includes(r.status) || r.awaiting!==null || (r.status==='completed' && (!r.fromConfirmed || !r.toConfirmed)))) return false;
    if((total>=r.hp || draftTotal>=r.hp) && (s.phase!=='resolved' || r.status!=='defended')) return false;
    return true;
  }

  // Extend old v1 saves in place conceptually, but never mutate their original
  // objects. Counters, current proposals, names and favorites stay intact.
  function normalizeState(state) {
    if(!state || typeof state!=='object' || Array.isArray(state)) return null;
    if(validateState(state)) return state;
    const has=key=>Object.prototype.hasOwnProperty.call(state,key);
    let migrated;
    try {migrated=JSON.parse(JSON.stringify(state));} catch(_) {return null;}
    if(!migrated.round || typeof migrated.round!=='object' || Array.isArray(migrated.round)) return null;
    function extendRound(round, phase) {
      const missing=key=>!Object.prototype.hasOwnProperty.call(round,key);
      if(missing('draftRolls')) round.draftRolls=[];
      if(missing('draftRollTokens')) round.draftRollTokens=[];
      if(missing('draftChallengeUsed')) round.draftChallengeUsed=false;
      if(missing('autoProposed')) round.autoProposed=false;
      let fromConfirmed=false,toConfirmed=false;
      if(phase==='accepted' || round.status==='completed') fromConfirmed=toConfirmed=true;
      else if(phase==='sender_confirmation') toConfirmed=true;
      else if(['counterproposal','scheduled_proposal'].includes(round.status) && ['a','b'].includes(round.awaiting)) {
        fromConfirmed=round.awaiting===round.to;toConfirmed=round.awaiting===round.from;
      } else if(['pending','challenge','challenge_failed'].includes(phase) || round.status==='defended') fromConfirmed=!round.autoProposed;
      else if(round.acceptedAt) fromConfirmed=toConfirmed=true;
      else if(round.sentAt) fromConfirmed=!round.autoProposed;
      if(missing('fromConfirmed')) round.fromConfirmed=fromConfirmed;
      if(missing('toConfirmed')) round.toConfirmed=toConfirmed;
    }
    extendRound(migrated.round,migrated.phase);
    if(Array.isArray(migrated.history)) for(const round of migrated.history) if(round && typeof round==='object') extendRound(round,'resolved');
    if(!has('stats')) migrated.stats=emptyStats();
    if(!validateState(migrated)) return null;
    // Only old states without cumulative counters need history reconstruction.
    // Entries evicted by the previous 80-item history limit remain unknown.
    if(!has('stats')) {
      const counted=new Set();
      for(const round of migrated.history) {
        if(round.status!=='completed' || counted.has(round.id)) continue;
        counted.add(round.id);
        migrated.stats.totalCompleted++;
        migrated.stats.byCategory[getCard(round.cardId).categoryId]++;
      }
    }
    return migrated;
  }

  function drawHand(state, categoryId) {
    const category=typeof categoryId==='number' ? categories.find(c=>c.number===categoryId) : getCategory(categoryId);
    if (!category) throw new RangeError('Unknown category.');
    const previous=(state.seen[category.id] || [])[0];
    const pool=cards.filter(c=>c.categoryId===category.id && c.id!==previous).map(c=>c.id);
    for(let i=pool.length-1;i>0;i--) { const j=randomInt(i+1)-1; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    return pool.slice(0,4);
  }

  /* Exact probability of reaching HP with at most two fair, independent D20s. */
  function probability(hp) {
    if (!Number.isFinite(hp)) return 0;
    let successes=0;
    for(let a=1;a<=20;a++) for(let b=1;b<=20;b++) if(a+b>=hp) successes++;
    return successes/400;
  }

  function canRespond(s) {
    return ['pending','challenge','challenge_failed','sender_confirmation'].includes(s.phase) && s.activePlayer===s.round.awaiting;
  }

  const canChallengeDraft=s=>s.phase==='draft' && s.activePlayer===s.round.from && !s.round.draftChallengeUsed;
  const canRollDraftDefense=s=>s.phase==='draft_challenge' && s.activePlayer===s.round.from && s.round.awaiting===s.activePlayer;

  function closeRound(s, status, action) {
    s.phase='resolved';
    s.round.status=status;
    s.round.awaiting=null;
    s.round.endedAt=action.at || null;
    s.round.closedBy=s.activePlayer;
    if(!s.history.some(item=>item.id===s.round.id)) s.history.unshift(JSON.parse(JSON.stringify(s.round)));
    s.history=s.history.slice(0,80);
  }

  function reduce(state, action) {
    if (!validateState(state) || !action || typeof action.type !== 'string') return state;
    const kind=action.type;
    if(kind==='RESET') {
      const fresh=createState();
      if(action.keepPrefs) fresh.prefs={...state.prefs};
      return fresh;
    }
    // Reject stale UI callbacks, such as an animation from a previous round.
    if(action.roundId && action.roundId!==state.round.id) return state;
    if(action.actor && action.actor!==state.activePlayer) return state;
    const s=JSON.parse(JSON.stringify(state));
    const r=s.round;
    const actor=s.activePlayer;

    switch(kind) {
      case 'SWITCH_PLAYER':
        if(!['a','b'].includes(action.player) || action.player===actor) return state;
        s.activePlayer=action.player;
        // A blank, untouched table follows the profile that starts the turn.
        if(s.phase==='category') s.round=blankRound(s.sequence,action.player,r.createdAt);
        return s;
      case 'SET_PREFS':
        for(const key of prefKeys) if(action.patch && typeof action.patch[key]==='boolean') s.prefs[key]=action.patch[key];
        return s;
      case 'TOGGLE_FAVORITE':
        if(!getCard(action.cardId)) return state;
        s.favorites=s.favorites.includes(action.cardId) ? s.favorites.filter(id=>id!==action.cardId) : [...s.favorites,action.cardId];
        return s;
      case 'NEW_ROUND':
        if(!['resolved','category','card'].includes(s.phase)) return state;
        s.sequence++;
        s.phase='category';
        s.round=blankRound(s.sequence,actor,action.at);
        return s;
      case 'ROLL_CATEGORY': {
        if(s.phase!=='category' || actor!==r.from || !Number.isInteger(action.value) || action.value<1 || action.value>6) return state;
        const cat=categories.find(c=>c.number===action.value);
        if(!Array.isArray(action.hand) || action.hand.length!==4 || new Set(action.hand).size!==4 || action.hand.some(id=>!getCard(id) || getCard(id).categoryId!==cat.id)) return state;
        r.categoryId=cat.id; r.categoryRoll=action.value; r.hand=action.hand.slice();
        s.phase='card';
        return s;
      }
      case 'ROLL_CARD':
        if(s.phase!=='card' || actor!==r.from || !Number.isInteger(action.value) || action.value<1 || action.value>4) return state;
        r.cardRoll=action.value; r.cardId=r.hand[action.value-1]; r.hp=getCard(r.cardId).hp; r.status='draft';
        s.seen[r.categoryId]=[r.cardId,...(s.seen[r.categoryId] || []).filter(id=>id!==r.cardId)].slice(0,8);
        s.phase='draft';
        return s;
      case 'SEND':
        if(!['draft','draft_challenge'].includes(s.phase) || actor!==r.from) return state;
        r.fromConfirmed=true; r.toConfirmed=false; r.autoProposed=false;
        r.status='pending'; r.awaiting=r.to; r.sentAt=action.at || null; s.phase='pending';
        return s;
      case 'CHALLENGE_DRAFT':
        if(!canChallengeDraft(s)) return state;
        r.draftChallengeUsed=true; r.status='draft_challenge'; r.awaiting=r.from; s.phase='draft_challenge';
        return s;
      case 'ROLL_DRAFT_DEFENSE': {
        if(!canRollDraftDefense(s) || r.draftRolls.length>=2 || !Number.isInteger(action.value) || action.value<1 || action.value>20) return state;
        if(typeof action.token!=='string' || !action.token || action.token.length>150 || r.draftRollTokens.includes(action.token)) return state;
        r.draftRolls.push(action.value); r.draftRollTokens.push(action.token);
        const total=r.draftRolls.reduce((sum,v)=>sum+v,0);
        if(total>=r.hp) closeRound(s,'defended',action);
        else if(r.draftRolls.length===2) {
          // The random result sends an invitation, never a person's agreement.
          r.autoProposed=true; r.fromConfirmed=false; r.toConfirmed=false;
          r.status='pending'; r.awaiting=r.to; r.sentAt=action.at || null; s.phase='pending';
        }
        return s;
      }
      case 'ACCEPT':
        if(!canRespond(s)) return state;
        if(actor===r.from) r.fromConfirmed=true; else r.toConfirmed=true;
        if(!r.fromConfirmed) {
          r.status='sender_confirmation'; r.awaiting=r.from; s.phase='sender_confirmation';
        } else {
          r.status='accepted'; r.awaiting=null; r.acceptedAt=action.at || null; s.phase='accepted';
        }
        return s;
      case 'LATER':
        if(!canRespond(s)) return state;
        r.schedule=(typeof action.schedule==='string' && action.schedule.trim() ? action.schedule.trim() : 'À convenir').slice(0,80);
        r.fromConfirmed=actor===r.from; r.toConfirmed=actor===r.to;
        r.status='scheduled_proposal'; r.awaiting=otherPlayer(actor); s.phase='pending';
        return s;
      case 'ADAPT':
        if(!canRespond(s)) return state;
        r.proposal=(typeof action.text==='string' && action.text.trim() ? action.text.trim() : getCard(r.cardId).variant).slice(0,400);
        r.fromConfirmed=actor===r.from; r.toConfirmed=actor===r.to;
        r.adapted=true; r.status='counterproposal'; r.awaiting=otherPlayer(actor); s.phase='pending';
        return s;
      case 'CHALLENGE':
        if(s.phase!=='pending' || r.status!=='pending' || actor!==r.to || r.awaiting!==actor || r.challengeUsed) return state;
        r.challengeUsed=true; r.status='challenge'; s.phase='challenge';
        return s;
      case 'ROLL_DEFENSE': {
        if(s.phase!=='challenge' || actor!==r.to || r.awaiting!==actor || r.rolls.length>=2 || !Number.isInteger(action.value) || action.value<1 || action.value>20) return state;
        if(typeof action.token!=='string' || !action.token || action.token.length>150 || r.rollTokens.includes(action.token)) return state;
        r.rolls.push(action.value); r.rollTokens.push(action.token);
        const total=r.rolls.reduce((sum,v)=>sum+v,0);
        if(total>=r.hp) closeRound(s,'defended',action);
        else if(r.rolls.length===2) {s.phase='challenge_failed'; r.status='challenge_failed';}
        return s;
      }
      case 'PASS':
      case 'CANCEL':
        if(!r.cardId || s.phase==='resolved') return state;
        closeRound(s,'passed',action);
        return s;
      case 'COMPLETE':
        if(s.phase!=='accepted') return state;
        // A resolved round cannot be completed again. Also tolerate a legacy
        // saved history that already contains this completed round without
        // crediting it a second time. Future rounds may reuse the same card.
        if(!s.history.some(item=>item.id===r.id && item.status==='completed')) {
          if(s.stats.totalCompleted===Number.MAX_SAFE_INTEGER) return state;
          s.stats.totalCompleted++;
          s.stats.byCategory[r.categoryId]++;
        }
        closeRound(s,'completed',action);
        return s;
      default:
        return state;
    }
  }

  const api={categories,cards,players,createState,validateState,normalizeState,randomInt,drawHand,probability,reduce,getCard,getCategory,otherPlayer,canRespond,canChallengeDraft,canRollDraftDefense};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  scope.OndeGame=api;
})(typeof window!=='undefined' ? window : globalThis);
