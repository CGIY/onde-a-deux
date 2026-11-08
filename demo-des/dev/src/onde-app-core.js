/* ONDE — local prototype rules. No networking, storage, or UI side effects. */
(function (scope) {
  'use strict';

  const legacyCategories = [
    { id: 'complicite', number: 1, label: 'Complicité', color: '#92bdc7', icon: 'messages-square', description: 'Des moments à partager.' },
    { id: 'detente', number: 2, label: 'Détente', color: '#a9c48f', icon: 'leaf', description: 'Prendre soin du moment.' },
    { id: 'projets', number: 3, label: 'Projets', color: '#8198b4', icon: 'map', description: 'Imaginer et faire ensemble.' },
    { id: 'attention', number: 4, label: 'Attentions', color: '#e3bd8b', icon: 'gift', description: 'Choisir une attention.' },
    { id: 'bouffe', number: 5, label: 'Bouffe', color: '#e0a08a', icon: 'utensils', description: 'Choisir de quoi se régaler.' },
    { id: 'intimite', number: 6, label: 'Intimité', color: '#c49bc9', icon: 'moon', description: 'À votre rythme et selon vos envies.' }
  ];

  const categories = [
    legacyCategories[0],
    { ...legacyCategories[3], number:2, label:'Plaisirs', description:'À offrir, à goûter, à partager.' },
    legacyCategories[2],
    { ...legacyCategories[5], number:4 }
  ];


  // Equal base weights, with one extra ticket for the two favored themes.
  // On Paris week-ends, Intimité receives exactly 60%; other ratios stay 11:10:10.
  const parisFormatter = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
  function parisParts(at){ const date=new Date(at); if(Number.isNaN(date.getTime())) return null; return Object.fromEntries(parisFormatter.formatToParts(date).map(part=>[part.type,part.value])); }
  function parisDateKey(at){ const parts=parisParts(at); return parts?parts.year+'-'+parts.month+'-'+parts.day:null; }
  function isParisWeekend(at){ const parts=parisParts(at); return !!parts&&(parts.weekday==='Sat'||parts.weekday==='Sun'); }
  // ISO week key of the Paris calendar day (used for the weekly joker).
  function isoWeekKey(at){
    const key=parisDateKey(at);
    if(!key) return null;
    const date=new Date(key+'T12:00:00Z');
    const day=(date.getUTCDay()+6)%7;
    date.setUTCDate(date.getUTCDate()-day+3);
    const firstThursday=new Date(Date.UTC(date.getUTCFullYear(),0,4));
    const firstDay=(firstThursday.getUTCDay()+6)%7;
    firstThursday.setUTCDate(firstThursday.getUTCDate()-firstDay+3);
    const week=1+Math.round((date-firstThursday)/(7*86400000));
    return date.getUTCFullYear()+'-W'+String(week).padStart(2,'0');
  }
  function categoryTickets(at){
    const weekend=at!==undefined&&at!==null&&isParisWeekend(at);
    return categories.flatMap(category =>
      Array(weekend?(category.id==='intimite'?93:category.id==='complicite'?22:20):(category.id==='intimite'||category.id==='complicite'?11:10)).fill(category.number)
    );
  }

  const legacyCards = [
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
  legacyCards.push(...stckCards);
  const stckExistingLinks={"det-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-02","title":"Massage de la tête","collectionId":"12","collectionTitle":"Massage","activeInSource":true},"tend-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"5-02","title":"Câlin (accolade)","collectionId":"11","collectionTitle":"Amour","activeInSource":true},"att-1":{"repository":"CGIY/stck","commit":"98119ed48b8af6e868582eeeed0912214e007e9c","sourcePath":"src/catalog.json","sourceId":"1-05","title":"Mot doux à cacher","collectionId":"11","collectionTitle":"Amour","activeInSource":true}};
  for(const [id,source] of Object.entries(stckExistingLinks)) { const card=legacyCards.find(card=>card.id===id); if(card)card.source=source; }

  // Preserve the published catalogue for cached clients and in-progress rounds.
  const legacyCategory = id => id==='tendresse'?'complicite':id==='decouverte'?'projets':id;
  const hiddenLegacyCards = legacyCards.map(card=>Object.assign({},card,{categoryId:legacyCategory(card.categoryId)}));
  const oldCardById = Object.fromEntries(hiddenLegacyCards.map(card=>[card.id,card]));
  const catalogRows = [
    {id:'new-complicite-01',categoryId:'complicite',title:'Le selfie à deux du jour'},
    {id:'new-complicite-02',categoryId:'complicite',title:'Baiser avec la langue',legacyId:'stck-5-01'},
    {id:'new-complicite-03',categoryId:'complicite',title:'Câlin',legacyId:'tend-1'},
    {id:'new-complicite-04',categoryId:'complicite',title:'Mot doux à cacher',legacyId:'att-1'},
    {id:'new-complicite-05',categoryId:'complicite',title:'Pose de vernis',legacyId:'stck-9-01'},
    {id:'new-complicite-06',categoryId:'complicite',title:'Caresse sous le plaid devant une série'},
    {id:'new-complicite-07',categoryId:'complicite',title:'Une heure sans téléphone'},
    {id:'new-complicite-11',categoryId:'complicite',title:'Cinq heures sans téléphone'},
    {id:'new-complicite-08',categoryId:'complicite',title:'Un jeu de société'},
    {id:'new-complicite-09',categoryId:'complicite',title:'Regarder un film'},
    {id:'new-complicite-10',categoryId:'complicite',title:'Regarder une série'},
    {id:'new-detente-01',categoryId:'detente',title:'Massage de la tête',legacyId:'det-1'},
    {id:'new-detente-02',categoryId:'detente',title:'Massage des épaules',legacyId:'stck-1-03'},
    {id:'new-detente-03',categoryId:'detente',title:'Massage des pieds'},
    {id:'new-detente-04',categoryId:'detente',title:'Massage des cuisses',legacyId:'stck-1-04'},
    {id:'new-detente-05',categoryId:'detente',title:'Massage des oreilles'},
    {id:'new-detente-06',categoryId:'detente',title:'Massage du visage'},
    {id:'new-detente-07',categoryId:'detente',title:'Massage du dos'},
    {id:'new-detente-08',categoryId:'detente',title:'Massage total',legacyId:'stck-1-07'},
    {id:'new-detente-09',categoryId:'detente',title:'Masque visage',legacyId:'stck-9-02'},
    {id:'new-detente-10',categoryId:'detente',title:'Soin complet du visage',legacyId:'stck-1-06'},
    {id:'new-projets-01',categoryId:'projets',title:'Balade en ville'},
    {id:'new-projets-02',categoryId:'projets',title:'Balade en forêt'},
    {id:'new-projets-03',categoryId:'projets',title:'Musée ou visite'},
    {id:'new-projets-04',categoryId:'projets',title:'Aquarelle'},
    {id:'new-projets-05',categoryId:'projets',title:'Poterie'},
    {id:'new-projets-06',categoryId:'projets',title:'Faire des photos dehors'},
    {id:'new-projets-07',categoryId:'projets',title:'Pique-nique'},
    {id:'new-projets-08',categoryId:'projets',title:'Promenade sous la pluie'},
    {id:'new-projets-09',categoryId:'projets',title:'Promenade de nuit'},
    {id:'new-projets-10',categoryId:'projets',title:'Préparer un futur week-end'},
    {id:'new-projets-11',categoryId:'projets',title:'Préparer de futures vacances'},
    {id:'new-projets-12',categoryId:'projets',title:'Réaménager un coin de la maison'},
    {id:'new-projets-13',categoryId:'projets',title:'Jeter 3 choses inutiles'},
    {id:'new-projets-14',categoryId:'projets',title:'Jeter 1 chose inutile'},
    {id:'new-projets-15',categoryId:'projets',title:'Faire une mini rénovation'},
    {id:'new-projets-16',categoryId:'projets',title:'Faire une grosse rénovation'},
    {id:'new-projets-17',categoryId:'projets',title:'Créer ou agrémenter une bucket list'},
    {id:'new-projets-18',categoryId:'projets',title:'Faire une tier list'},
    {id:'new-attention-01',categoryId:'attention',title:'Achat Vinted à petit budget'},
    {id:'new-attention-02',categoryId:'attention',title:'Achat Vinted à gros budget'},
    {id:'new-attention-03',categoryId:'attention',title:'Un café à Columbus'},
    {id:'new-attention-04',categoryId:'attention',title:'Achat d’un roman'},
    {id:'new-attention-05',categoryId:'attention',title:'Achat d’un jeu vidéo'},
    {id:'new-attention-06',categoryId:'attention',title:'Achat d’un roman graphique'},
    {id:'new-attention-07',categoryId:'attention',title:'Achat d’un manga'},
    {id:'new-attention-08',categoryId:'attention',title:'Achat d’un jeu de société de type cartes'},
    {id:'new-attention-09',categoryId:'attention',title:'Achat d’un jeu de société de type plateau (budget plus conséquent)'},
    {id:'new-attention-10',categoryId:'attention',title:'Petit achat sur Passage du Désir'},
    {id:'new-attention-11',categoryId:'attention',title:'Gros achat sur Passage du Désir'},
    {id:'new-attention-12',categoryId:'attention',title:'Achat Rouge Gorge 20 euros'},
    {id:'new-attention-13',categoryId:'attention',title:'Achat Monoprix 20 euros'},
    {id:'new-attention-14',categoryId:'attention',title:'Achat Rouge Gorge +30 euros'},
    {id:'new-attention-15',categoryId:'attention',title:'Achat Monoprix +30 euros'},
    {id:'new-bouffe-01',categoryId:'bouffe',title:'Manger un burger',legacyId:'stck-2-02'},
    {id:'new-bouffe-02',categoryId:'bouffe',title:'Manger de la pizza',legacyId:'stck-2-09'},
    {id:'new-bouffe-03',categoryId:'bouffe',title:'Manger sushi',legacyId:'stck-2-10'},
    {id:'new-bouffe-04',categoryId:'bouffe',title:'Manger un kebab'},
    {id:'new-bouffe-05',categoryId:'bouffe',title:'Acheter de quoi faire un plat mexicain'},
    {id:'new-bouffe-06',categoryId:'bouffe',title:'Acheter de quoi faire un plat asiatique'},
    {id:'new-bouffe-07',categoryId:'bouffe',title:'Acheter de quoi faire un plat d’un pays européen au hasard'},
    {id:'new-bouffe-08',categoryId:'bouffe',title:'Faire des crêpes'},
    {id:'new-bouffe-09',categoryId:'bouffe',title:'Faire des cookies'},
    {id:'new-bouffe-10',categoryId:'bouffe',title:'Faire une tarte ou un gâteau'},
    {id:'new-bouffe-11',categoryId:'bouffe',title:'Apéro sur canapé',legacyId:'stck-2-06'},
    {id:'new-bouffe-12',categoryId:'bouffe',title:'Chocolat du soir et canapé',legacyId:'stck-2-04'},
    {id:'new-intimite-01',categoryId:'intimite',title:'Léchage de chatte'},
    {id:'new-intimite-02',categoryId:'intimite',title:'Sit face'},
    {id:'new-intimite-03',categoryId:'intimite',title:'Massage Nuru'},
    {id:'new-intimite-04',categoryId:'intimite',title:'Lovense'},
    {id:'new-intimite-05',categoryId:'intimite',title:'Fellation'},
    {id:'new-intimite-06',categoryId:'intimite',title:'Faciale'},
    {id:'new-intimite-07',categoryId:'intimite',title:'Dans la bouche'},
    {id:'new-intimite-08',categoryId:'intimite',title:'Avaler le sperme'},
    {id:'new-intimite-09',categoryId:'intimite',title:'Reproduction porno 1:1'},
    {id:'new-intimite-10',categoryId:'intimite',title:'Pénétration anale'},
    {id:'new-intimite-11',categoryId:'intimite',title:'Golden shower'},
    {id:'new-intimite-12',categoryId:'intimite',title:'Double pénétration'},
    {id:'new-intimite-13',categoryId:'intimite',title:'Montrer ses seins sur Reddit'},
    {id:'new-intimite-14',categoryId:'intimite',title:'Montrer ses fesses sur Reddit'},
    {id:'new-intimite-15',categoryId:'intimite',title:'Montrer sa chatte sur Reddit'},
    {id:'new-intimite-16',categoryId:'intimite',title:'Webcam show seins'},
    {id:'new-intimite-17',categoryId:'intimite',title:'Webcam show fesses'},
    {id:'new-intimite-18',categoryId:'intimite',title:'Webcam show masturbation'},
    {id:'new-intimite-19',categoryId:'intimite',title:'Montrer une faciale sur Reddit'},
    {id:'new-intimite-20',categoryId:'intimite',title:'Une heure de soumission'},
    {id:'new-intimite-21',categoryId:'intimite',title:'Session fessée'},
    {id:'new-intimite-22',categoryId:'intimite',title:'Photoshoot original'}
  ];
  const sourceIdByTitle = Object.fromEntries(legacyCards.map(card=>[card.title,card]));
  const categoryPrompts = {
    complicite:'Choisissez le moment et la façon qui vous plaisent à tous les deux.',
    detente:'La personne qui reçoit choisit la zone, les gestes et la pression. Vous pouvez arrêter à tout moment.',
    projets:'Choisissez ensemble l’ampleur du projet, le moment et la façon de participer.',
    attention:'Décidez ensemble de l’achat et respectez le budget indiqué dans la proposition.',
    bouffe:'Choisissez ensemble ce qui vous fait envie et le budget qui vous convient.',
    intimite:'À réserver à des adultes consentants. Définissez ensemble les limites, le cadre et les conditions de sécurité ; chacun peut dire non ou arrêter à tout moment.'
  };
  // First-pass discard resistance estimates selected with the user. Higher PV
  // makes an action harder to discard; these values are independent of consent.
  const resistanceByCard = Object.freeze({
    'new-complicite-01':35,'new-complicite-02':35,'new-complicite-03':35,'new-complicite-04':35,'new-complicite-05':35,'new-complicite-06':35,'new-complicite-07':30,'new-complicite-08':30,'new-complicite-09':35,'new-complicite-10':35,'new-complicite-11':20,
    'new-detente-01':35,'new-detente-02':35,'new-detente-03':35,'new-detente-04':30,'new-detente-05':35,'new-detente-06':35,'new-detente-07':30,'new-detente-08':25,'new-detente-09':35,'new-detente-10':30,
    'new-projets-01':35,'new-projets-02':30,'new-projets-03':25,'new-projets-04':30,'new-projets-05':20,'new-projets-06':30,'new-projets-07':35,'new-projets-08':25,'new-projets-09':25,'new-projets-10':25,'new-projets-11':20,'new-projets-12':20,'new-projets-13':25,'new-projets-14':30,'new-projets-15':20,'new-projets-16':10,'new-projets-17':30,'new-projets-18':35,
    'new-attention-01':35,'new-attention-02':15,'new-attention-03':35,'new-attention-04':35,'new-attention-05':25,'new-attention-06':30,'new-attention-07':35,'new-attention-08':25,'new-attention-09':15,'new-attention-10':35,'new-attention-11':15,'new-attention-12':30,'new-attention-13':30,'new-attention-14':20,'new-attention-15':20,
    'new-bouffe-01':35,'new-bouffe-02':35,'new-bouffe-03':30,'new-bouffe-04':35,'new-bouffe-05':30,'new-bouffe-06':30,'new-bouffe-07':30,'new-bouffe-08':35,'new-bouffe-09':35,'new-bouffe-10':30,'new-bouffe-11':35,'new-bouffe-12':35,
    'new-intimite-01':35,'new-intimite-02':20,'new-intimite-03':25,'new-intimite-04':30,'new-intimite-05':35,'new-intimite-06':25,'new-intimite-07':20,'new-intimite-08':20,'new-intimite-09':15,'new-intimite-10':15,'new-intimite-11':10,'new-intimite-12':10,'new-intimite-13':15,'new-intimite-14':15,'new-intimite-15':10,'new-intimite-16':15,'new-intimite-17':15,'new-intimite-18':10,'new-intimite-19':10,'new-intimite-20':15,'new-intimite-21':20,'new-intimite-22':35
  });
  const publishedCards = catalogRows.map(row=>{
    const old=(row.legacyId&&oldCardById[row.legacyId])||sourceIdByTitle[row.title]||null;
    const prompts=categoryPrompts[row.categoryId];
    return {id:row.id,categoryId:row.categoryId,title:row.title,description:prompts,duration:null,hp:resistanceByCard[row.id],variant:'Choisissez ensemble une version plus simple ou un autre moment.',variantDuration:null,...(old&&old.source?{source:old.source}:{})};
  });

  const legacyFavoriteMap = Object.fromEntries(catalogRows.filter(row=>row.legacyId).map(row=>[row.legacyId,row.id]));

  const newCards = [
    {"id":"six-complicite-petit-mot","categoryId":"complicite","title":"Cacher un petit papier","description":"Écris un petit mot et cache-le pour l’autre.","duration":null,"hp":35,"variants":["Un compliment","Un mot doux","Un surnom débile","Une définition au hasard du dico","Un souvenir en une phrase","Une blague à deux"]},
    {"id":"six-complicite-selfie","categoryId":"complicite","title":"Selfie à deux : souvenir","description":"Prenez un selfie à deux avec le cadrage tiré.","duration":null,"hp":35,"variants":["Parties intimes","Les bras","Les oreilles","Visages entiers","Visages et corps","Vos mains"]},
    {"id":"six-complicite-massage","categoryId":"complicite","title":"Massage et câlins","description":"Partagez le geste tiré.","duration":null,"hp":35,"variants":["Massage de la tête","Massage des cuisses","Massage des pieds","Massage du dos","Câlin","Caresses sous le plaid"]},
    {"id":"six-complicite-soins","categoryId":"complicite","title":"Soin à deux","description":"Prépare le soin tiré.","duration":null,"hp":35,"variants":["Pose de vernis","Masque visage","Soin complet du visage","Crème sur les jambes","Crème sur le corps","Gommage"]},
    {"id":"six-complicite-soiree","categoryId":"complicite","title":"Soirée à deux","description":"Partagez le programme tiré.","duration":null,"hp":30,"variants":["Film · comédie","Film · action ou aventure","Série · policière","Série · fantastique","Jeu de société · coopératif","Jeu de société · ambiance"]},
    {"id":"six-complicite-telephone","categoryId":"complicite","title":"Parenthèse sans téléphone","description":"Mettez vos téléphones de côté pendant la durée tirée.","duration":null,"hp":30,"variants":["15 min en mode silence","30 min en mode avion","1 h dans un tiroir","2 h en mode avion","3 h dans un tiroir","5 h téléphone éteint"]},
    {"id":"six-attention-cadeau","categoryId":"attention","title":"À offrir","description":"Choisis un cadeau dans la famille et le budget tirés.","duration":null,"hp":30,"variants":["Livre · 15 € max","Petit cadeau · 10 € max","Jeu vidéo · 30 € max","Jeu de société · 40 € max","Passage du Désir · 30 € max","Cadeau surprise · 20 € max"]},
    {"id":"six-attention-vinted","categoryId":"attention","title":"Une pièce à offrir","description":"Choisis une pièce dans la sélection tirée.","duration":null,"hp":35,"variants":["Vinted · T-shirt · 10 € max","Vinted · robe · 20 € max","Vinted · chemise · 15 € max","Monoprix · haut · 20 € max","Rouge Gorge · culotte · 20 € max","Rouge Gorge · soutien-gorge · 30 € max"]},
    {"id":"six-attention-emporter","categoryId":"attention","title":"Pause à emporter","description":"Prenez quelque chose à emporter dans le style tiré.","duration":null,"hp":35,"variants":["Burger","Pizza","Sushi","Kebab","Café à Columbus","Sandwich"]},
    {"id":"six-attention-cuisine","categoryId":"attention","title":"Cuisine du monde","description":"Choisissez un plat de la cuisine tirée et préparez-le ensemble.","duration":null,"hp":30,"variants":["Mexique","Japon","Inde","Thaïlande","Italie","Grèce"]},
    {"id":"six-attention-douceur","categoryId":"attention","title":"Douceur maison","description":"Préparez ensemble la douceur tirée.","duration":null,"hp":30,"variants":["Crêpes","Cookies","Tarte aux fruits","Gâteau au chocolat","Gâteau au yaourt","Gaufres"]},
    {"id":"six-attention-petit-truc","categoryId":"attention","title":"Préparer un petit truc","description":"Prépare pour l’autre le petit moment tiré.","duration":null,"hp":35,"variants":["Café","Apéro","Goûter","Thé ou infusion","Petit-déjeuner","Chocolat et canapé"]},
    {"id":"six-projets-balade","categoryId":"projets","title":"Balade","description":"Partez vous promener dans le cadre tiré.","duration":null,"hp":30,"variants":["Dans le quartier","En ville","En forêt","Dans un parc","À 10 minutes en voiture","À 30 minutes en voiture"]},
    {"id":"six-projets-photo","categoryId":"projets","title":"Sortie photo","description":"Faites une sortie photo dans le cadre tiré.","duration":null,"hp":30,"variants":["Dans le quartier","En ville","En forêt","Dans un parc","En Urbex","À 30 minutes en voiture"]},
    {"id":"six-projets-atelier","categoryId":"projets","title":"Atelier créatif","description":"Réalisez une petite création chacun avec le thème tiré.","duration":null,"hp":30,"variants":["Aquarelle · animal","Aquarelle · fleur ou plante","Aquarelle · portrait de l’autre","Argile · coupelle","Argile · figurine","Argile · médaillon"]},
    {"id":"six-projets-escapade","categoryId":"projets","title":"Préparer une escapade","description":"Esquissez ensemble le programme de la sortie tirée.","duration":null,"hp":25,"variants":["Une soirée","Une journée","Un week-end","Des vacances","Une demi-journée près de chez vous","Une nuit ailleurs"]},
    {"id":"six-projets-amenager","categoryId":"projets","title":"Réaménager un coin","description":"Choisissez un endroit de la maison où faire le changement tiré.","duration":null,"hp":20,"variants":["Déplacer un meuble","Changer une décoration","Revoir la décoration d’un mur","Réorganiser un rangement","Réaménager un meuble","Faire une retouche de peinture"]},
    {"id":"six-projets-trier","categoryId":"projets","title":"Désencombrer","description":"Choisissez une pièce et jetez le nombre d’objets tiré.","duration":null,"hp":25,"variants":["1 objet (à jeter!)","2 objets (à jeter!)","3 objets (à jeter!)","4 objets (à jeter!)","5 objets (à jeter!)","6 objets (à jeter!)"]},
    {"id":"six-intimite-baiser","categoryId":"intimite","title":"Un baiser","description":"Retrouvez-vous pour le baiser tiré.","duration":null,"hp":35,"variants":["Avec la langue","Dans le cou","Sur le pénis","Sur les lèvres du bas","Petit bisou","Avant de dormir"]},
    {"id":"six-intimite-fellation","categoryId":"intimite","title":"Fellation","description":"Le dé précise la variante.","duration":null,"hp":35,"variants":["Faciale","Dehors","Douche","Avale","Sous le bureau","En voiture"]},
    {"id":"six-intimite-cunnilingus","categoryId":"intimite","title":"Cunnilingus","description":"Le dé précise la variante.","duration":null,"hp":35,"variants":["Sit-Face","En levrette","Douche","Bureau","Salon","Véranda"]},
    {"id":"six-intimite-penetration","categoryId":"intimite","title":"Pénétration","description":"Le dé précise la position.","duration":null,"hp":25,"variants":["Missionnaire","Andromaque","Andromaque inversée","Levrette","Cuillère","Position au choix"]},
    {"id":"six-intimite-lovense","categoryId":"intimite","title":"Lovense","description":"Le dé précise la variante.","duration":null,"hp":30,"variants":["15 minutes dedans","15 minutes à l'extérieur","30 minutes dedans","30 minutes à l'extérieur","30 minutes avec AdultTime","Une soirée"]},
    {"id":"six-intimite-photoshoot","categoryId":"intimite","title":"Photoshoot original","description":"Prenez une photo à deux avec la particularité tirée.","duration":null,"hp":25,"variants":["À thème","Noir et blanc","Dehors","Ombres","Portrait serré","Sous la douche"]}
  ];

  const players = [{ id:'a', name:'Joueur 1' }, { id:'b', name:'Joueur 2' }];
  const rules = Object.freeze({ dailyRoundLimit:null, activeRoundLimit:2, categorySides:4, cardSides:6, variantSides:6, recentCardLimit:8, completedCardPoints:1, taskLifetimeMs:24*60*60*1000 });
  const legacyCardSides = 4;
  const cardMap = Object.fromEntries([...hiddenLegacyCards,...publishedCards,...newCards].map(card => [card.id, card]));
  const legacyCategoryMap = Object.fromEntries(legacyCategories.map(category => [category.id, category]));
  const categoryMap = Object.fromEntries(categories.map(category => [category.id, category]));
  const catalogueCategories = version => version===2?categories:legacyCategories;
  const categorySides = version => catalogueCategories(version).length;
  const mergedCategory = id => id==='detente'?'complicite':id==='bouffe'?'attention':id;
  const phases = ['category','card','variant','draft','pending','accepted','resolved'];
  const prefKeys = ['reducedMotion','sound','discreet','reminder'];
  const otherPlayer = id => id === 'a' ? 'b' : 'a';
  const getCard = id => Object.prototype.hasOwnProperty.call(cardMap,id)?cardMap[id]:null;
  const getCategory = (id,version=2) => {
    if(version===2 && Object.prototype.hasOwnProperty.call(categoryMap,id)) return categoryMap[id];
    return Object.prototype.hasOwnProperty.call(legacyCategoryMap,id)?legacyCategoryMap[id]:null;
  };
  const getVariant = round => {
    const face=round?.variantRoll;
    return Number.isInteger(face) && face>=1 && face<=rules.variantSides?getCard(round.cardId)?.variants?.[face-1]??null:null;
  };
  const validSelectedVariant = entry => getCard(entry.cardId)?.variants?getVariant(entry)!==null:entry.variantRoll===undefined;
  const validHand = (hand, category, modern) =>
    Array.isArray(hand) && (modern?hand.length===rules.cardSides:[legacyCardSides,rules.cardSides].includes(hand.length)) &&
    new Set(hand).size===hand.length && Array.from(hand).every(id=>{
      const card=getCard(id);
      return card?.categoryId===category && Boolean(card.variants)===modern;
    });
  // Published four-card draws keep their original die until the next round.
  const cardSides = stateOrRound => {
    const round=stateOrRound&&stateOrRound.round||stateOrRound;
    return round&&Array.isArray(round.hand)&&[4,6].includes(round.hand.length)?round.hand.length:rules.cardSides;
  };
  const isoTime = value => typeof value==='string' && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString()===value;
  const taskStartTime = value => isoTime(value) && Date.parse(value)<=8640000000000000-rules.taskLifetimeMs;
  const fallbackTime = '1970-01-01T00:00:00.000Z';

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

  function rollCategory(version, draw=randomInt, at) {
    if(version!==2) return draw(categorySides(version));
    const tickets=categoryTickets(at);
    return tickets[draw(tickets.length)-1];
  }

  function validDaily(daily) {
    if(!daily || typeof daily!=='object' || Array.isArray(daily)) return false;
    if(typeof daily.dateKey!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(daily.dateKey) || daily.usedBy!==null) return false;
    const cat=getCategory(daily.categoryId,2), card=getCard(daily.cardId);
    if(!cat || !card || card.categoryId!==cat.id || daily.categoryRoll!==cat.number) return false;
    if(!validHand(daily.hand,daily.categoryId,true)) return false;
    if(!Number.isInteger(daily.cardRoll) || daily.cardRoll<1 || daily.cardRoll>daily.hand.length || daily.hand[daily.cardRoll-1]!==daily.cardId) return false;
    if(!Number.isInteger(daily.variantRoll) || daily.variantRoll<1 || daily.variantRoll>rules.variantSides) return false;
    return true;
  }

  // One shared card per Paris day, drawn by the server and visible to both.
  // The category of the draw that triggered it is excluded, so the shared card
  // can never coincide with the private hand being drawn at the same moment.
  function drawDaily(state, at, draw=randomInt, excludeCategoryId) {
    if(!isoTime(at)) return null;
    const excluded=getCategory(excludeCategoryId,2)?.number;
    const tickets=categoryTickets(at).filter(number=>number!==excluded);
    const categoryRoll=tickets[draw(tickets.length)-1];
    const category=categories.find(c=>c.number===categoryRoll);
    if(!category) return null;
    const hand=drawHand(state,category.id,2);
    const cardRoll=draw(hand.length);
    const variantRoll=draw(rules.variantSides);
    return {dateKey:parisDateKey(at),categoryId:category.id,categoryRoll,hand:hand.slice(),cardRoll,cardId:hand[cardRoll-1],variantRoll,usedBy:null};
  }

  function blankRound(sequence, from, at) {
    return { id:'onde-'+sequence, from, to:otherPlayer(from), awaiting:null,
      categoryId:null, categoryRoll:null, hand:[], cardId:null, cardRoll:null, cardRerolled:false,
      hp:null, rolls:[], rollTokens:[], challengeUsed:false, status:'drawing',
      draftRolls:[], draftRollTokens:[], draftChallengeUsed:false, autoProposed:false,
      fromConfirmed:false, toConfirmed:false,
      adapted:false, proposal:null, schedule:null, createdAt:at || null,
      sentAt:null, acceptedAt:null, endedAt:null, closedBy:null, modeRoll:null, hardcoreOffer:false };
  }

  function emptyStats() {
    return { totalCompleted:0, byCategory:Object.fromEntries(legacyCategories.map(category=>[category.id,0])) };
  }

  function validStats(stats) {
    if(!stats || typeof stats!=='object' || Array.isArray(stats) || !Number.isSafeInteger(stats.totalCompleted) || stats.totalCompleted<0) return false;
    const byCategory=stats.byCategory;
    if(!byCategory || typeof byCategory!=='object' || Array.isArray(byCategory) || Object.keys(byCategory).length!==legacyCategories.length) return false;
    if(legacyCategories.some(category=>!Object.prototype.hasOwnProperty.call(byCategory,category.id) || !Number.isSafeInteger(byCategory[category.id]) || byCategory[category.id]<0)) return false;
    return legacyCategories.reduce((total,category)=>total+byCategory[category.id],0)===stats.totalCompleted;
  }

  function categoryScore(stats,id) {
    return legacyCategories.filter(category=>mergedCategory(category.id)===id)
      .reduce((total,category)=>total+stats.byCategory[category.id],0);
  }

  function createState() {
    return { version:1, activePlayer:'a', phase:'category', sequence:1,
      players:players.map(p => ({...p})), round:blankRound(1,'a'), history:[], favorites:[],
      prefs:{reducedMotion:false,sound:false,discreet:true,reminder:true}, seen:{}, stats:emptyStats(), tasks:[] };
  }

  function validRolls(rolls, tokens) {
    return Array.isArray(rolls) && Array.isArray(tokens) && rolls.length<=2 && tokens.length===rolls.length &&
      new Set(tokens).size===tokens.length && rolls.every(value=>Number.isInteger(value) && value>=1 && value<=20) &&
      tokens.every(token=>typeof token==='string' && token.length>0 && token.length<=150);
  }

  function validCardReroll(round) {
    return typeof round.cardRerolled==='boolean' && (!round.cardRerolled ||
      round.draftChallengeUsed===false && Array.isArray(round.draftRolls) && round.draftRolls.length===0);
  }

  function validTasks(s) {
    if(!Array.isArray(s.tasks) || new Set(s.tasks.map(task=>task&&task.id)).size!==s.tasks.length) return false;
    const keys=['id','cardId','categoryId','from','to','createdAt','expiresAt','checks','proposal'];
    return s.tasks.every(task=>{
      if(!task || typeof task!=='object' || Array.isArray(task) || !validSelectedVariant(task)) return false;
      const expectedKeys=task.variantRoll===undefined?keys:[...keys,'variantRoll'];
      if(Object.keys(task).length!==expectedKeys.length || expectedKeys.some(key=>!Object.prototype.hasOwnProperty.call(task,key))) return false;
      const card=getCard(task.cardId),sequence=typeof task.id==='string'&&/^onde-[1-9]\d*$/.test(task.id)?Number(task.id.slice(5)):NaN;
      if(!Number.isSafeInteger(sequence) || sequence>s.sequence || !card || task.categoryId!==card.categoryId || !['a','b'].includes(task.from) || task.to!==otherPlayer(task.from)) return false;
      // L'échéance enregistrée fait foi : toute durée bornée (1 h à 48 h) reste valide après un changement de règles.
      if(!isoTime(task.createdAt) || !isoTime(task.expiresAt) || !((Date.parse(task.expiresAt)-Date.parse(task.createdAt)>=3600000)&&(Date.parse(task.expiresAt)-Date.parse(task.createdAt)<=172800000))) return false;
      if(!task.checks || typeof task.checks!=='object' || Array.isArray(task.checks) || Object.keys(task.checks).sort().join(',')!=='a,b' || ['a','b'].some(id=>typeof task.checks[id]!=='boolean') || task.checks.a&&task.checks.b) return false;
      if(task.proposal!==null && (typeof task.proposal!=='string' || !task.proposal.trim() || task.proposal.length>400)) return false;
      if(task.id===s.round.id && (s.phase!=='accepted' || task.cardId!==s.round.cardId || task.variantRoll!==s.round.variantRoll || task.from!==s.round.from || task.to!==s.round.to || task.createdAt!==s.round.acceptedAt)) return false;
      return !s.history.some(round=>round&&round.id===task.id && ['completed','expired','passed','defended'].includes(round.status));
    });
  }

  function validateState(s) {
    if (!s || s.version !== 1 || !['a','b'].includes(s.activePlayer) || !phases.includes(s.phase)) return false;
    if (!validStats(s.stats) || s.progression!==undefined&&!validProgression(s.progression,s.sequence)) return false;
    if (!Number.isSafeInteger(s.sequence) || s.sequence < 1 || !s.round || !Array.isArray(s.history) || s.history.length > 80) return false;
    if (!validTasks(s)) return false;
    if (!Array.isArray(s.favorites) || s.favorites.some(id => !getCard(id)) || !s.prefs || prefKeys.some(k => typeof s.prefs[k] !== 'boolean')) return false;
    if (!s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen)) return false;
    if (Object.entries(s.seen).some(([key,list]) => !getCategory(key,1) || !Array.isArray(list) || list.length>8 || list.some(id=>!getCard(id) || getCard(id).categoryId!==key))) return false;
    if (!Array.isArray(s.players) || s.players.length !== 2 || s.players.some((p,i) => !p || p.id !== players[i].id || typeof p.name !== 'string' || !p.name.trim() || p.name.length>60)) return false;
    if (s.history.some(item=>!item || typeof item.id!=='string' || !getCard(item.cardId) || item.categoryId!==undefined&&item.categoryId!==getCard(item.cardId).categoryId || !['passed','defended','queued','expired','completed'].includes(item.status) || !['a','b'].includes(item.from) || item.to!==otherPlayer(item.from) || !Array.isArray(item.rolls) || item.rolls.length>2 || item.rolls.some(v=>!Number.isInteger(v) || v<1 || v>20) || !validCardReroll(item) || !validSelectedVariant(item))) return false;
    const r=s.round;
    if(r.directQueued!==undefined && typeof r.directQueued!=='boolean') return false;
    if(r.dailyFree!==undefined && typeof r.dailyFree!=='boolean') return false;
    if(r.refusalRoll!==undefined && (!Number.isInteger(r.refusalRoll) || r.refusalRoll<1 || r.refusalRoll>20)) return false;
    if(s.history.some(item=>item.refusalRoll!==undefined && (!Number.isInteger(item.refusalRoll) || item.refusalRoll<1 || item.refusalRoll>20))) return false;
    const roundSequence=typeof r.id==='string'&&/^onde-[1-9]\d*$/.test(r.id)?Number(r.id.slice(5)):NaN;
    if (!Number.isSafeInteger(roundSequence) || roundSequence>s.sequence || !['a','b'].includes(r.from) || r.to !== otherPlayer(r.from)) return false;
    if (![null,'a','b'].includes(r.awaiting) || !Array.isArray(r.hand) || !validRolls(r.rolls,r.rollTokens) || !validRolls(r.draftRolls,r.draftRollTokens)) return false;
    if (['challengeUsed','draftChallengeUsed','autoProposed','fromConfirmed','toConfirmed','adapted'].some(key=>typeof r[key]!=='boolean')) return false;
    if (r.modeRoll!==undefined && r.modeRoll!==null && !(Number.isInteger(r.modeRoll) && r.modeRoll>=1 && r.modeRoll<=20)) return false;
    if (r.hardcoreOffer!==undefined && typeof r.hardcoreOffer!=='boolean') return false;
    const modern=r.catalogueVersion===2;
    if (!validCardReroll(r) || (!modern && (r.catalogueVersion!==undefined || r.variantRoll!==undefined))) return false;
    if ((r.rolls.length && !r.challengeUsed) || (r.draftRolls.length && !r.draftChallengeUsed)) return false;
    if (r.proposal!==null && (typeof r.proposal!=='string' || r.proposal.length>400)) return false;
    if (r.schedule!==null && (typeof r.schedule!=='string' || r.schedule.length>80)) return false;
    const beforeCard=r.rolls.length===0 && r.draftRolls.length===0 && !r.challengeUsed && !r.draftChallengeUsed && !r.autoProposed && !r.fromConfirmed && !r.toConfirmed;
    if (s.phase === 'category') return !modern && r.categoryId === null && r.categoryRoll === null && r.cardId === null && r.cardRoll===null && !r.cardRerolled && r.hp===null && r.hand.length === 0 && beforeCard && r.status==='drawing' && r.awaiting===null;
    const cat=catalogueCategories(r.catalogueVersion).find(category=>category.id===r.categoryId);
    if (!cat || r.categoryRoll !== cat.number || !validHand(r.hand,cat.id,modern)) return false;
    if (s.phase === 'card') return (!modern || r.variantRoll===null) && r.cardId === null && r.cardRoll === null && !r.cardRerolled && r.hp===null && beforeCard && r.status==='drawing' && r.awaiting===null;
    const card=getCard(r.cardId);
    // PV belong to the round that was drawn. A later catalogue update must not
    // rewrite an in-progress challenge or invalidate an already won one.
    if (!card || !Number.isInteger(r.cardRoll) || r.cardRoll<1 || r.cardRoll>cardSides(r) || r.hand[r.cardRoll-1]!==r.cardId || card.categoryId!==cat.id || !Number.isInteger(r.hp) || r.hp<1 || r.hp>40) return false;
    if(s.phase==='variant') return modern && r.variantRoll===null && beforeCard && r.status==='drawing' && r.awaiting===null;
    if(!validSelectedVariant(r)) return false;
    const total=r.rolls.reduce((sum,v)=>sum+v,0),draftTotal=r.draftRolls.reduce((sum,v)=>sum+v,0);
    if(s.phase==='draft') return r.status==='draft' && r.awaiting===null && beforeCard;
    if(s.phase==='pending' && (r.status!=='pending' || r.awaiting!==r.to || r.challengeUsed || r.toConfirmed || !r.fromConfirmed || r.autoProposed)) return false;
    if(s.phase==='accepted' && (r.status!=='accepted' || r.awaiting!==null || !r.fromConfirmed || (!r.toConfirmed && r.directQueued!==true) || !s.tasks.some(task=>task.id===r.id))) return false;
    const confirmationRequired=r.status==='completed' || r.status==='expired'&&r.directQueued!==true;
    if(s.phase==='resolved' && (!['passed','defended','expired','completed'].includes(r.status) || r.awaiting!==null || confirmationRequired&&(!r.fromConfirmed || !r.toConfirmed))) return false;
    if((total>=r.hp || draftTotal>=r.hp) && (s.phase!=='resolved' || r.status!=='defended')) return false;
    return true;
  }

  // Extend old v1 saves in place conceptually, but never mutate their original
  // objects. Counters, current proposals, names and favorites stay intact.
  function normalizeState(state, options={}) {
    if(!state || typeof state!=='object' || Array.isArray(state)) return null;
    if(validateState(state)) return state;
    const has=key=>Object.prototype.hasOwnProperty.call(state,key);
    let migrated;
    try {migrated=JSON.parse(JSON.stringify(state));} catch(_) {return null;}
    if(!migrated.round || typeof migrated.round!=='object' || Array.isArray(migrated.round)) return null;
    let mergedCategories=false;
    if(migrated.stats&&migrated.stats.byCategory&&!validStats(migrated.stats)){
      const old=migrated.stats.byCategory;
      if(!old || typeof old!=='object' || Array.isArray(old)) return null;
      const keys=Object.keys(old).sort().join(',');
      const legacyKeys=['attention,complicite,decouverte,detente,intimite,tendresse','attention,bouffe,complicite,detente,intimite'];
      mergedCategories=keys==='attention,complicite,intimite,projets';
      if((!mergedCategories&&!legacyKeys.includes(keys)) || Object.values(old).some(value=>!Number.isSafeInteger(value)||value<0)) return null;
      // A merged local save cannot tell how its past points were split.
      // Keep its aggregate buckets under Complicité and Attentions.
      migrated.stats.byCategory={complicite:(old.complicite||0)+(old.tendresse||0),detente:old.detente||0,projets:(old.projets||0)+(old.decouverte||0),attention:old.attention||0,bouffe:old.bouffe||0,intimite:old.intimite||0};
    }
    const restoreCategory=(id,cardId)=>{
      const canonical=legacyCategory(id), card=getCard(cardId);
      return mergedCategories && card && mergedCategory(card.categoryId)===canonical?card.categoryId:canonical;
    };
    if(migrated.round.cardId && migrated.round.hp===null){const activeCard=getCard(migrated.round.cardId);if(activeCard)migrated.round.hp=activeCard.hp;}
    migrated.favorites=Array.isArray(migrated.favorites)?Array.from(new Set(migrated.favorites.map(id=>Object.prototype.hasOwnProperty.call(legacyFavoriteMap,id)?legacyFavoriteMap[id]:id))):migrated.favorites;
    if(migrated.seen&&typeof migrated.seen==='object'&&!Array.isArray(migrated.seen)){
      const seen={};
      for(const [id,list] of Object.entries(migrated.seen)){
        if(!getCategory(legacyCategory(id))||!Array.isArray(list)) return null;
        for(const cardId of list){
          const key=restoreCategory(id,cardId);
          seen[key]??=[];
          if(seen[key].length<rules.recentCardLimit&&!seen[key].includes(cardId)) seen[key].push(cardId);
        }
      }
      migrated.seen=seen;
    }
    // The local four-category build combined Détente with Complicité and
    // Bouffe with Attentions. Preserve the card and its face on active draws.
    const active=migrated.round;
    if(mergedCategories && active.catalogueVersion===undefined && getCategory(active.categoryId) && Array.isArray(active.hand) &&
      active.hand.every(id=>mergedCategory(getCard(id)?.categoryId)===active.categoryId)){
      const category=restoreCategory(active.categoryId,active.cardId);
      const replacements=publishedCards.filter(card=>card.categoryId===category&&!active.hand.includes(card.id));
      active.hand=active.hand.map(id=>getCard(id).categoryId===category?id:replacements.shift()?.id);
    }
    function extendRound(round, phase) {
      if(round.categoryId && round.catalogueVersion===undefined){
        round.categoryId=restoreCategory(round.categoryId,round.cardId);
        const mapped=getCategory(round.categoryId,1);
        if(mapped) round.categoryRoll=mapped.number;
      }
      const missing=key=>!Object.prototype.hasOwnProperty.call(round,key);
      if(missing('cardRerolled')) round.cardRerolled=false;
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
    if(Array.isArray(migrated.tasks)) for(const task of migrated.tasks) if(task&&typeof task==='object') task.categoryId=restoreCategory(task.categoryId,task.cardId);
    if(!has('tasks')) {
      migrated.tasks=[];
      if(migrated.phase==='accepted') {
        const ended=Array.isArray(migrated.history)&&migrated.history.find(round=>round.id===migrated.round.id&&['completed','expired'].includes(round.status));
        if(ended) {migrated.phase='resolved';migrated.round.status=ended.status;migrated.round.awaiting=null;}
        else {
          const acceptedAt=[migrated.round.acceptedAt,options.at,migrated.round.sentAt,migrated.round.createdAt].find(taskStartTime)||fallbackTime;
          migrated.round.acceptedAt=acceptedAt;
          enqueueTask(migrated,acceptedAt);
        }
      }
    }
    if(!has('stats')) migrated.stats=emptyStats();
    // Les anciennes négociations (défis, contre-propositions, double
    // confirmation) redeviennent une proposition en attente d'envoi ou une
    // simple invitation à laquelle répondre.
    if(migrated.phase==='draft_challenge') {
      migrated.phase='draft'; migrated.round.status='draft'; migrated.round.awaiting=null;
      migrated.round.draftChallengeUsed=false; migrated.round.draftRolls=[]; migrated.round.draftRollTokens=[];
    } else if(['challenge','challenge_failed','sender_confirmation'].includes(migrated.phase) || ['counterproposal','scheduled_proposal'].includes(migrated.round.status)) {
      migrated.phase='pending'; migrated.round.status='pending'; migrated.round.awaiting=migrated.round.to;
      migrated.round.challengeUsed=false; migrated.round.rolls=[]; migrated.round.rollTokens=[];
      migrated.round.draftChallengeUsed=false; migrated.round.draftRolls=[]; migrated.round.draftRollTokens=[];
      migrated.round.autoProposed=false; migrated.round.fromConfirmed=true; migrated.round.toConfirmed=false;
      migrated.round.adapted=false; migrated.round.schedule=null;
    }
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

  function drawHand(state, categoryId, catalogueVersion) {
    const category=catalogueCategories(catalogueVersion).find(c=>c.number===categoryId||c.id===categoryId);
    if (!category) throw new RangeError('Unknown category.');
    const modern=catalogueVersion===2;
    const sides=modern?rules.cardSides:legacyCardSides;
    const available=(modern?newCards:publishedCards).filter(c=>c.categoryId===category.id).map(c=>c.id);
    const recent=(state.seen[category.id] || []).filter(id=>available.includes(id)).slice(0,Math.min(rules.recentCardLimit,Math.max(0,available.length-sides)));
    const pool=available.filter(id=>!recent.includes(id));
    for(let i=pool.length-1;i>0;i--) { const j=randomInt(i+1)-1; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    return pool.slice(0,sides);
  }

  function canRespond(s) {
    return s.phase==='pending' && s.activePlayer===s.round.awaiting;
  }

  // A private draw becomes visible to its recipient only after it was sent.
  // Older saves can lack sentAt, so their response/accepted phases and the
  // recipient's own rolls also provide evidence that the invitation existed.
  function canSeeRound(state, player=state&&state.activePlayer) {
    if(!state || !state.round || !['a','b'].includes(player)) return false;
    const round=state.round;
    if(!['a','b'].includes(round.from) || round.to!==otherPlayer(round.from)) return false;
    if(state.phase==='category' || player===round.from) return true;
    if(typeof round.sentAt==='string' && round.sentAt.length>0) return true;
    if(['pending','accepted'].includes(state.phase)) return true;
    if(state.phase==='resolved' && ['completed','expired'].includes(round.status)) return true;
    return Array.isArray(round.rolls) && round.rolls.length>0;
  }

  // Une seule relance de carte par tour, gratuite, avant l'envoi.
  const canRerollCard=s=>s.phase==='draft' && s.activePlayer===s.round.from && !s.round.cardRerolled && !s.round.draftChallengeUsed && s.round.draftRolls.length===0;

  function recordHistory(s, round) {
    const rows=[JSON.parse(JSON.stringify(round)),...s.history.filter(item=>item.id!==round.id)];
    const protectedIds=new Set(s.tasks.map(task=>task.id));
    const protectedRows=rows.filter(item=>protectedIds.has(item.id)).slice(0,80);
    const recentRows=rows.filter(item=>!protectedIds.has(item.id)).slice(0,80-protectedRows.length);
    const retained=new Set([...protectedRows,...recentRows].map(item=>item.id));
    s.history=rows.filter(item=>retained.has(item.id));
  }

  function enqueueTask(s, acceptedAt) {
    const r=s.round;
    if(s.tasks.some(task=>task.id===r.id)) return;
    s.tasks.push({id:r.id,cardId:r.cardId,categoryId:r.categoryId,from:r.from,to:r.to,
      createdAt:acceptedAt,expiresAt:new Date(Date.parse(acceptedAt)+rules.taskLifetimeMs).toISOString(),
      checks:{a:false,b:false},proposal:r.adapted?r.proposal:null,...(r.catalogueVersion===2?{variantRoll:r.variantRoll}:{})});
    recordHistory(s,{...r,status:'queued'});
  }

  function finishTask(s, task, status, at, details={}) {
    const current=s.round.id===task.id&&s.phase==='accepted';
    const base=current?s.round:s.history.find(round=>round.id===task.id)||{id:task.id,cardId:task.cardId,categoryId:task.categoryId,from:task.from,to:task.to,rolls:[],cardRerolled:false,acceptedAt:task.createdAt,fromConfirmed:true,toConfirmed:false};
    const ended={...base,...details,status,awaiting:null,endedAt:at,closedBy:s.activePlayer,checks:{...task.checks}};
    if(status==='completed') Object.assign(ended,{fromConfirmed:true,toConfirmed:true});
    if(task.variantRoll!==undefined) Object.assign(ended,{catalogueVersion:2,variantRoll:task.variantRoll});
    recordHistory(s,ended);
    if(current) {s.round={...ended};s.phase='resolved';}
    s.tasks=s.tasks.filter(item=>item.id!==task.id);
  }

  function expireTasks(s, at) {
    const expired=s.tasks.filter(task=>Date.parse(task.expiresAt)<=Date.parse(at));
    for(const task of expired) finishTask(s,task,'expired',at);
    return expired.length>0;
  }

  function closeRound(s, status, action) {
    s.phase='resolved';
    s.round.status=status;
    s.round.awaiting=null;
    s.round.endedAt=action.at || null;
    s.round.closedBy=s.activePlayer;
    s.tasks=s.tasks.filter(task=>task.id!==s.round.id);
    recordHistory(s,s.round);
  }

  function reduceGame(state, action) {
    if (!validateState(state) || !action || typeof action.type !== 'string') return state;
    const kind=action.type;
    if(kind==='RESET') {
      const fresh=createState();
      if(action.keepPrefs) fresh.prefs={...state.prefs};
      return fresh;
    }
    // Reject stale UI callbacks, such as an animation from a previous round.
    if(action.roundId && action.roundId!==state.round.id && !['TOGGLE_TASK_CHECK','REFUSE_TASK','EXPIRE_TASKS'].includes(kind)) return state;
    if(action.actor && action.actor!==state.activePlayer) return state;
    const s=JSON.parse(JSON.stringify(state));
    const r=s.round;
    const actor=s.activePlayer;

    switch(kind) {
      case 'EXPIRE_TASKS': {
        if(!isoTime(action.at)) return state;
        let changed=expireTasks(s,action.at);
        if(action.daily && validDaily(action.daily) && action.daily.dateKey===parisDateKey(action.at) && (!s.daily || s.daily.dateKey!==action.daily.dateKey)){
          s.daily=JSON.parse(JSON.stringify(action.daily));
          changed=true;
        }
        return changed?s:state;
      }
      case 'TOGGLE_TASK_CHECK': {
        if(typeof action.taskId!=='string' || typeof action.checked!=='boolean' || !isoTime(action.at) || action.player&&action.player!==actor) return state;
        if(!s.tasks.some(item=>item.id===action.taskId)) return state;
        const expired=expireTasks(s,action.at);
        const task=s.tasks.find(item=>item.id===action.taskId);
        if(!task || Date.parse(action.at)<Date.parse(task.createdAt) || task.checks[actor]===action.checked) return expired?s:state;
        if(action.checked && task.checks[otherPlayer(actor)] && s.stats.totalCompleted===Number.MAX_SAFE_INTEGER) return expired?s:state;
        task.checks[actor]=action.checked;
        if(task.checks.a&&task.checks.b) {
          s.stats.totalCompleted++;
          s.stats.byCategory[task.categoryId]++;
          finishTask(s,task,'completed',action.at);
        }
        return s;
      }
      case 'REFUSE_TASK': {
        if(typeof action.taskId!=='string' || !isoTime(action.at) || !Number.isInteger(action.value) || action.value<1 || action.value>20) return state;
        const original=s.tasks.find(item=>item.id===action.taskId);
        if(!original || original.to!==actor) return state;
        const expired=expireTasks(s,action.at),task=s.tasks.find(item=>item.id===action.taskId);
        if(!task || Date.parse(action.at)<Date.parse(task.createdAt)) return expired?s:state;
        // The D20 records the refusal; no face can require the challenge.
        finishTask(s,task,'passed',action.at,{refusalRoll:action.value});
        return s;
      }
      case 'SWITCH_PLAYER':
        if(!['a','b'].includes(action.player) || action.player===actor) return state;
        s.activePlayer=action.player;
        // Let either profile start the demo. Later profile switches may be
        // used to check an older task, so they must not change the next drawer.
        if(s.phase==='category'&&s.sequence===1) s.round=blankRound(s.sequence,action.player,r.createdAt);
        return s;
      case 'SET_PREFS':
        for(const key of prefKeys) if(action.patch && typeof action.patch[key]==='boolean') s.prefs[key]=action.patch[key];
        return s;
      case 'TOGGLE_FAVORITE':
        if(!getCard(action.cardId)) return state;
        s.favorites=s.favorites.includes(action.cardId) ? s.favorites.filter(id=>id!==action.cardId) : [...s.favorites,action.cardId];
        return s;
      case 'NEW_ROUND':
        if(!['resolved','accepted','category','card'].includes(s.phase) || s.sequence===Number.MAX_SAFE_INTEGER) return state;
        s.sequence++;
        s.phase='category';
        // Alternate the drawer, regardless of who closed the previous round.
        s.activePlayer=otherPlayer(r.from);
        s.round=blankRound(s.sequence,s.activePlayer,action.at);
        return s;
      case 'ROLL_CATEGORY': {
        if(s.phase!=='category' || !Number.isInteger(action.value) || action.value<1 || action.value>categorySides(action.catalogueVersion)) return state;
        const cat=catalogueCategories(action.catalogueVersion).find(c=>c.number===action.value);
        const modern=action.catalogueVersion===2;
        if(action.catalogueVersion!==undefined && !modern) return state;
        if(!cat || !validHand(action.hand,cat.id,modern)) return state;
        r.from=actor; r.to=otherPlayer(actor);
        r.categoryId=cat.id; r.categoryRoll=action.value; r.hand=action.hand.slice();
        if(modern){
          Object.assign(r,{catalogueVersion:2,variantRoll:null,dailyFree:false});
          r.modeRoll=cat.id==='intimite'&&Number.isInteger(action.modeRoll)&&action.modeRoll>=1&&action.modeRoll<=20?action.modeRoll:null;
          r.hardcoreOffer=r.modeRoll!==null&&r.modeRoll>10;
        }
        if(action.daily && validDaily(action.daily) && action.daily.dateKey===parisDateKey(action.at) && (!s.daily || s.daily.dateKey!==action.daily.dateKey)) s.daily=JSON.parse(JSON.stringify(action.daily));
        s.phase='card';
        return s;
      }
      case 'REROLL_CATEGORY': {
        if(!isoTime(action.at) || s.phase!=='card' || actor!==r.from) return state;
        if(!Number.isInteger(action.value) || action.value<1 || action.value>categorySides(2)) return state;
        const cat=categories.find(c=>c.number===action.value);
        if(!cat || action.catalogueVersion!==2 || !validHand(action.hand,cat.id,true)) return state;
        const dayKey=parisDateKey(action.at);
        const used=s.dailyReroll && s.dailyReroll.dateKey===dayKey && Array.isArray(s.dailyReroll.used) ? s.dailyReroll.used : [];
        if(used.includes(actor)) return state;
        r.categoryId=cat.id; r.categoryRoll=action.value; r.hand=action.hand.slice();
        r.catalogueVersion=2; r.variantRoll=null; r.dailyFree=false;
        r.modeRoll=cat.id==='intimite'&&Number.isInteger(action.modeRoll)&&action.modeRoll>=1&&action.modeRoll<=20?action.modeRoll:null;
        r.hardcoreOffer=r.modeRoll!==null&&r.modeRoll>10;
        s.dailyReroll={dateKey:dayKey,used:[...used,actor]};
        return s;
      }
      case 'JOKER_DRAW': {
        if(!isoTime(action.at) || s.phase!=='category' || actor!==r.from) return state;
        if(!Number.isInteger(action.category) || action.category<1 || action.category>categorySides(2)) return state;
        const cat=categories.find(c=>c.number===action.category);
        if(!cat || action.catalogueVersion!==2 || !validHand(action.hand,cat.id,true)) return state;
        const weekKey=isoWeekKey(action.at);
        const joker=s.joker && s.joker.weekKey===weekKey ? s.joker : {weekKey,usedBy:null};
        if(joker.usedBy) return state;
        r.from=actor; r.to=otherPlayer(actor);
        r.categoryId=cat.id; r.categoryRoll=action.category; r.hand=action.hand.slice();
        r.catalogueVersion=2; r.variantRoll=null; r.dailyFree=false;
        r.modeRoll=cat.id==='intimite'&&Number.isInteger(action.modeRoll)&&action.modeRoll>=1&&action.modeRoll<=20?action.modeRoll:null;
        r.hardcoreOffer=r.modeRoll!==null&&r.modeRoll>10;
        if(action.daily && validDaily(action.daily) && action.daily.dateKey===parisDateKey(action.at) && (!s.daily || s.daily.dateKey!==action.daily.dateKey)) s.daily=JSON.parse(JSON.stringify(action.daily));
        s.joker={weekKey,usedBy:actor};
        s.phase='card';
        return s;
      }
      case 'SEND_DAILY': {
        if(!isoTime(action.at) || s.phase!=='category' || actor!==r.from) return state;
        const daily=s.daily;
        if(!daily || daily.dateKey!==parisDateKey(action.at) || daily.usedBy!==null) return state;
        const cat=getCategory(daily.categoryId,2), card=getCard(daily.cardId);
        if(!cat || !card || card.categoryId!==cat.id || daily.categoryRoll!==cat.number || !validHand(daily.hand,cat.id,true) ||
           !Number.isInteger(daily.cardRoll) || daily.cardRoll<1 || daily.cardRoll>daily.hand.length || daily.hand[daily.cardRoll-1]!==daily.cardId ||
           !Number.isInteger(daily.variantRoll) || daily.variantRoll<1 || daily.variantRoll>rules.variantSides) return state;
        r.from=actor; r.to=otherPlayer(actor);
        r.categoryId=daily.categoryId; r.categoryRoll=daily.categoryRoll;
        r.hand=daily.hand.slice(); r.cardRoll=daily.cardRoll; r.cardId=daily.cardId; r.hp=card.hp;
        r.catalogueVersion=2; r.variantRoll=daily.variantRoll; r.modeRoll=null; r.hardcoreOffer=false; r.dailyFree=true;
        r.status='pending'; r.awaiting=r.to; r.fromConfirmed=true; r.toConfirmed=false; r.autoProposed=false;
        r.sentAt=action.at;
        s.phase='pending';
        s.daily={...JSON.parse(JSON.stringify(daily)),usedBy:actor};
        return s;
      }
      case 'ROLL_CARD':
      case 'REROLL_CARD': {
        const reroll=kind==='REROLL_CARD';
        if(reroll?!canRerollCard(s):s.phase!=='card' || actor!==r.from) return state;
        if(!Number.isInteger(action.value) || action.value<1 || action.value>cardSides(r) || reroll&&action.value===r.cardRoll) return state;
        r.cardRoll=action.value; r.cardId=r.hand[action.value-1]; r.hp=getCard(r.cardId).hp;
        if(reroll) { r.cardRerolled=true; if(r.catalogueVersion===2) r.variantRoll=null; }
        s.seen[r.categoryId]=[r.cardId,...(s.seen[r.categoryId] || []).filter(id=>id!==r.cardId)].slice(0,8);
        s.phase=r.catalogueVersion===2?'variant':'draft';
        r.status=s.phase==='variant'?'drawing':'draft';
        return s;
      }
      case 'ROLL_VARIANT':
        if(s.phase!=='variant' || actor!==r.from || !Number.isInteger(action.value) || action.value<1 || action.value>rules.variantSides) return state;
        r.variantRoll=action.value;
        r.status='draft';
        s.phase='draft';
        return s;
      case 'SEND':
        if(s.phase!=='draft' || actor!==r.from) return state;
        if(action.directQueue===true) {
          if(!taskStartTime(action.at)) return state;
          // "accepted" is the historical task phase, not recipient consent.
          Object.assign(r,{directQueued:true,fromConfirmed:true,toConfirmed:false,autoProposed:false,
            status:'accepted',awaiting:null,sentAt:action.at,acceptedAt:action.at});
          s.phase='accepted';enqueueTask(s,action.at);return s;
        }
        r.fromConfirmed=true; r.toConfirmed=false; r.autoProposed=false;
        r.status='pending'; r.awaiting=r.to; r.sentAt=action.at || null; s.phase='pending';
        return s;
      case 'ACCEPT': {
        if(!canRespond(s)) return state;
        const acceptedAt=action.at===undefined?fallbackTime:taskStartTime(action.at)?action.at:null;
        if(!acceptedAt) return state;
        r.toConfirmed=true;
        r.status='accepted'; r.awaiting=null; r.acceptedAt=acceptedAt; s.phase='accepted';
        enqueueTask(s,acceptedAt);
        return s;
      }
      case 'PASS':
      case 'CANCEL':
        // Le destinataire passe l'invitation : la carte est écartée, sans défi ni pénalité.
        if(s.phase!=='pending' || !r.cardId || !canRespond(s)) return state;
        closeRound(s,'passed',action);
        return s;
      case 'COMPLETE':
        // Completion now requires both independent task checkboxes. Keep the
        // old action inert so an old control cannot bypass that requirement.
        return state;
      default:
        return state;
    }
  }

  // A room shares its score and tasks. Its two lanes allow one active draw per person.
  const roomActors=['a','b'];
  const roomSharedKeys=['sequence','players','prefs','favorites','history','seen','stats','tasks','daily','dailyReroll','joker'];
  const validStoredJoker=x=>x===undefined||x===null||(x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.weekKey==='string'&&/^\d{4}-W\d{2}$/.test(x.weekKey)&&[null,'a','b'].includes(x.usedBy));
  const validStoredDaily=d=>d===undefined||d===null||(d&&typeof d==='object'&&!Array.isArray(d)&&typeof d.dateKey==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.dateKey)&&[null,'a','b'].includes(d.usedBy)&&(()=>{const cat=getCategory(d.categoryId,2),card=getCard(d.cardId);return !!cat&&!!card&&card.categoryId===cat.id&&d.categoryRoll===cat.number&&validHand(d.hand,cat.id,true)&&Number.isInteger(d.cardRoll)&&d.cardRoll>=1&&d.cardRoll<=d.hand.length&&d.hand[d.cardRoll-1]===d.cardId&&Number.isInteger(d.variantRoll)&&d.variantRoll>=1&&d.variantRoll<=rules.variantSides;})());
  const validStoredReroll=x=>x===undefined||x===null||(x&&typeof x==='object'&&!Array.isArray(x)&&(x.dateKey===null||typeof x.dateKey==='string')&&Array.isArray(x.used)&&new Set(x.used).size===x.used.length&&x.used.every(id=>['a','b'].includes(id)));
  const roomCopy=value=>JSON.parse(JSON.stringify(value));
  const roomShared=room=>Object.fromEntries(roomSharedKeys.map(key=>[key,room[key]]));
  const focusedRoomState=(room,actor,lane)=>({version:1,activePlayer:actor,...roomShared(room),phase:lane.phase,round:lane.round});

  function validateRoom(room) {
    if(!room || room.version!==2 || !room.lanes || typeof room.lanes!=='object' || Array.isArray(room.lanes) || Object.keys(room.lanes).sort().join(',')!=='a,b' || !Array.isArray(room.pendingRounds) || room.pendingRounds.length>80) return false;
    if(!validStoredDaily(room.daily) || !validStoredReroll(room.dailyReroll) || !validStoredJoker(room.joker) || room.progression!==undefined&&!validProgression(room.progression,room.sequence)) return false;
    if(!Array.isArray(room.history) || !Array.isArray(room.tasks)) return false;
    const lanes=roomActors.map(actor=>room.lanes[actor]);
    if(lanes.some((lane,index)=>!lane || typeof lane!=='object' || lane.round?.from!==roomActors[index] || lane.phase==='pending')) return false;
    if(lanes[0].round.id===lanes[1].round.id) return false;
    if(room.pendingRounds.some(lane=>!lane || typeof lane!=='object' || lane.phase!=='pending' || !roomActors.includes(lane.round?.from) || lane.round.status!=='pending')) return false;
    const records=[...lanes,...room.pendingRounds];
    if(new Set(records.map(item=>item.round.id)).size!==records.length) return false;
    if(records.some(item=>!validateState(focusedRoomState(room,item.round.from,item)))) return false;
    if(room.pendingRounds.some(item=>room.tasks.some(task=>task.id===item.round.id) || room.history.some(round=>round.id===item.round.id))) return false;
    if(new Set(room.history.map(round=>round.id)).size!==room.history.length) return false;
    return room.history.every(round=>{
      const sequence=typeof round.id==='string'&&/^onde-[1-9]\d*$/.test(round.id)?Number(round.id.slice(5)):NaN;
      const lane=records.find(item=>item.round.id===round.id);
      return Number.isSafeInteger(sequence) && sequence<=room.sequence && (!lane ||
        round.cardId===lane.round.cardId && round.from===lane.round.from && round.to===lane.round.to && round.variantRoll===lane.round.variantRoll);
    });
  }

  function normalizeRoom(raw,options={}) {
    if(validateRoom(raw)) return raw;
    if(raw?.version===2) {
      const migrated=roomCopy(raw);
      if(!Array.isArray(migrated.pendingRounds)) migrated.pendingRounds=[];
      if(migrated.pendingRounds.length>80) return null;
      for(const actor of roomActors) {
        const lane=migrated.lanes?.[actor];
        if(!lane || !lane.round || !['draft_challenge','challenge','challenge_failed','sender_confirmation'].includes(lane.phase)) continue;
        const round=lane.round;
        if(lane.phase==='draft_challenge') {
          lane.phase='draft'; round.status='draft'; round.awaiting=null;
          round.draftChallengeUsed=false; round.draftRolls=[]; round.draftRollTokens=[];
        } else {
          lane.phase='pending'; round.status='pending'; round.awaiting=round.to;
          round.challengeUsed=false; round.rolls=[]; round.rollTokens=[];
          round.draftChallengeUsed=false; round.draftRolls=[]; round.draftRollTokens=[];
          round.autoProposed=false; round.fromConfirmed=true; round.toConfirmed=false;
          round.adapted=false; round.schedule=null;
        }
      }
      for(const actor of roomActors) {
        const lane=migrated.lanes?.[actor];
        if(!lane || lane.phase!=='pending' || !lane.round) continue;
        if(!migrated.pendingRounds.some(item=>item?.round?.id===lane.round.id)) migrated.pendingRounds.push(roomCopy(lane));
        if(migrated.pendingRounds.length>80) return null;
        const used=new Set([
          ...roomActors.map(owner=>migrated.lanes?.[owner]?.round?.id),
          ...migrated.pendingRounds.map(item=>item?.round?.id),
          ...(migrated.history||[]).map(round=>round?.id),
          ...(migrated.tasks||[]).map(task=>task?.id)
        ]);
        let sequence=Number.isSafeInteger(migrated.sequence)&&migrated.sequence<Number.MAX_SAFE_INTEGER?migrated.sequence+1:1;
        while(sequence<=Number.MAX_SAFE_INTEGER&&used.has('onde-'+sequence)) sequence++;
        if(sequence>Number.MAX_SAFE_INTEGER) return null;
        if(sequence>migrated.sequence) migrated.sequence=sequence;
        migrated.lanes[actor]={phase:'category',round:blankRound(sequence,actor,options.at)};
      }
      return validateRoom(migrated)?migrated:null;
    }
    const state=normalizeState(raw,options);
    if(!state) return null;
    const owner=state.round.from,other=otherPlayer(owner);
    const sequence=Math.min(Number.MAX_SAFE_INTEGER,state.sequence+1);
    let otherSequence=sequence;
    if(state.sequence===Number.MAX_SAFE_INTEGER) {
      const occupied=new Set([state.round.id,...state.history.map(round=>round.id),...state.tasks.map(task=>task.id)]);
      otherSequence=1;
      while(occupied.has('onde-'+otherSequence)) otherSequence++;
    }
    const room={version:2,...roomCopy(roomShared(state)),daily:state.daily??null,dailyReroll:state.dailyReroll??{dateKey:isoTime(options.at)?parisDateKey(options.at):null,used:[]},joker:state.joker??null,sequence,pendingRounds:[],lanes:{
      [owner]:{phase:state.phase,round:roomCopy(state.round)},
      [other]:{phase:'category',round:blankRound(otherSequence,other,options.at)}
    }};
    if(state.progression!==undefined) room.progression=roomCopy(state.progression);
    if(state.phase==='pending') {
      room.pendingRounds.push({phase:'pending',round:roomCopy(state.round)});
      const used=new Set([...Object.values(room.lanes).map(lane=>lane.round.id),...room.pendingRounds.map(item=>item.round.id),...room.history.map(round=>round.id),...room.tasks.map(task=>task.id)]);
      let activeSequence=room.sequence<Number.MAX_SAFE_INTEGER?room.sequence+1:1;
      while(activeSequence<=Number.MAX_SAFE_INTEGER&&used.has('onde-'+activeSequence)) activeSequence++;
      if(activeSequence>Number.MAX_SAFE_INTEGER) return null;
      if(activeSequence>room.sequence) room.sequence=activeSequence;
      room.lanes[owner]={phase:'category',round:blankRound(activeSequence,owner,options.at)};
    }
    return validateRoom(room)?room:null;
  }

  function createRoom(options={}) {
    const state=createState();
    state.round.createdAt=options.at || null;
    return normalizeRoom(state,options);
  }

  function resetRoom(room,options={}) {
    if(!validateRoom(room) || room.sequence>Number.MAX_SAFE_INTEGER-2) return null;
    const reset=createRoom({at:options.at});
    reset.players=roomCopy(room.players);
    reset.favorites=roomCopy(room.favorites);
    if(options.keepPrefs!==false) reset.prefs=roomCopy(room.prefs);
    // Never reuse IDs: delayed pre-reset actions must not target a fresh draw.
    reset.sequence=room.sequence+2;
    reset.lanes.a={phase:'category',round:blankRound(room.sequence+1,'a',options.at)};
    reset.lanes.b={phase:'category',round:blankRound(room.sequence+2,'b',options.at)};
    return validateRoom(reset)?reset:null;
  }

  // This is a raw focused view. The server must redact the other person's
  // private draw before returning any such view to a browser.
  function roomView(room,actor,roundId) {
    if(!validateRoom(room) || !roomActors.includes(actor)) return null;
    const records=[...roomActors.map(owner=>room.lanes[owner]),...room.pendingRounds];
    const lane=roundId===undefined?room.lanes[actor]:records.find(item=>item.round.id===roundId);
    return lane?roomCopy(focusedRoomState(room,actor,lane)):null;
  }

  function reconcileRoomTasks(room) {
    for(const owner of roomActors) {
      const lane=room.lanes[owner];
      if(lane.phase!=='accepted' || room.tasks.some(task=>task.id===lane.round.id)) continue;
      const ended=room.history.find(round=>round.id===lane.round.id && ['completed','expired','passed'].includes(round.status));
      if(ended) {
        const round={...lane.round,status:ended.status,awaiting:null,endedAt:ended.endedAt,closedBy:ended.closedBy,checks:{...ended.checks},...(ended.status==='completed'?{fromConfirmed:true,toConfirmed:true}:{}),...(ended.refusalRoll===undefined?{}:{refusalRoll:ended.refusalRoll})};
        room.lanes[owner]={phase:'resolved',round};
        recordHistory(room,round);
      }
    }
  }

  function reduceRoomGame(room,action) {
    if(!validateRoom(room) || !action || typeof action.type!=='string') return room;
    if(action.type==='RESET') {
      return resetRoom(room,{at:action.at,keepPrefs:!!action.keepPrefs})||room;
    }
    const actor=action.actor || (action.type==='EXPIRE_TASKS'?'a':null);
    if(!roomActors.includes(actor)) return room;
    const shared=['TOGGLE_TASK_CHECK','REFUSE_TASK','EXPIRE_TASKS','SET_PREFS','TOGGLE_FAVORITE'].includes(action.type);
    const laneOwner=shared?null:roomActors.find(id=>room.lanes[id].round.id===action.roundId);
    const pendingIndex=shared?-1:room.pendingRounds.findIndex(item=>item.round.id===action.roundId);
    const owner=shared?actor:laneOwner||(pendingIndex>=0?room.pendingRounds[pendingIndex].round.from:null);
    if(!owner) return room;
    const lane=pendingIndex>=0?room.pendingRounds[pendingIndex]:room.lanes[owner];
    if(action.type==='NEW_ROUND') {
      if(owner!==actor || !['accepted','resolved'].includes(lane.phase) || room.sequence===Number.MAX_SAFE_INTEGER) return room;
      const next=roomCopy(room);
      next.sequence++;
      next.lanes[actor]={phase:'category',round:blankRound(next.sequence,actor,action.at)};
      return validateRoom(next)?next:room;
    }
    if(action.type==='ROLL_CATEGORY' && owner!==actor) return room;
    if(['SEND','SEND_DAILY'].includes(action.type) && pendingIndex<0 && (room.sequence===Number.MAX_SAFE_INTEGER || (!action.directQueue && room.pendingRounds.length>=80))) return room;
    const focused=focusedRoomState(room,actor,lane);
    if(!shared && !canSeeRound(focused,actor)) return room;
    const forwarded={...action,actor};
    if(shared) delete forwarded.roundId;
    const result=reduceGame(focused,forwarded);
    if(result===focused) return room;
    const next={version:2,...roomShared(result),lanes:roomCopy(room.lanes),pendingRounds:roomCopy(room.pendingRounds)};
    if(action.type==='SEND' && action.directQueue===true && pendingIndex<0 && result.phase==='accepted') {
      next.sequence=room.sequence+1;
      next.lanes[actor]={phase:'category',round:blankRound(next.sequence,actor,action.at)};
    } else if(['SEND','SEND_DAILY'].includes(action.type) && pendingIndex<0 && result.phase==='pending') {
      next.sequence=room.sequence+1;
      next.lanes[actor]={phase:'category',round:blankRound(next.sequence,actor,action.at)};
      next.pendingRounds.push({phase:'pending',round:roomCopy(result.round)});
    } else if(pendingIndex>=0) {
      if(result.phase==='pending') next.pendingRounds[pendingIndex]={phase:result.phase,round:result.round};
      else next.pendingRounds.splice(pendingIndex,1);
    } else {
      next.lanes[owner]={phase:result.phase,round:result.round};
    }
    reconcileRoomTasks(next);
    return validateRoom(next)?next:room;
  }

  const badgeCatalog=[
    {"id":"ind-draws-1","scope":"individual","title":"Premier lancer, premier sourire","description":"Effectuer un premier tirage de catégorie.","family":"draws","tier":1,"criterion":{"metric":"draws","threshold":1},"order":1,"icon":"dice","target":1},
    {"id":"ind-draws-5","scope":"individual","title":"Dés en confiance","description":"Effectuer 5 tirages de catégorie.","family":"draws","tier":1,"criterion":{"metric":"draws","threshold":5},"order":2,"icon":"dice","target":5},
    {"id":"ind-draws-15","scope":"individual","title":"Poignet bien échauffé","description":"Effectuer 15 tirages de catégorie.","family":"draws","tier":2,"criterion":{"metric":"draws","threshold":15},"order":3,"icon":"dice","target":15},
    {"id":"ind-draws-30","scope":"individual","title":"Ça roule pour moi","description":"Effectuer 30 tirages de catégorie.","family":"draws","tier":2,"criterion":{"metric":"draws","threshold":30},"order":4,"icon":"dice","target":30},
    {"id":"ind-draws-75","scope":"individual","title":"Le hasard a mon numéro","description":"Effectuer 75 tirages de catégorie.","family":"draws","tier":3,"criterion":{"metric":"draws","threshold":75},"order":5,"icon":"dice","target":75},
    {"id":"ind-proposals-1","scope":"individual","title":"J’ai une idée !","description":"Partager une première proposition.","family":"proposals","tier":1,"criterion":{"metric":"proposals","threshold":1},"order":6,"icon":"send","target":1},
    {"id":"ind-proposals-5","scope":"individual","title":"La boîte à bonnes idées","description":"Partager 5 propositions.","family":"proposals","tier":1,"criterion":{"metric":"proposals","threshold":5},"order":7,"icon":"send","target":5},
    {"id":"ind-proposals-15","scope":"individual","title":"Service des propositions","description":"Partager 15 propositions.","family":"proposals","tier":2,"criterion":{"metric":"proposals","threshold":15},"order":8,"icon":"send","target":15},
    {"id":"ind-proposals-30","scope":"individual","title":"Le moteur à idées","description":"Partager 30 propositions.","family":"proposals","tier":2,"criterion":{"metric":"proposals","threshold":30},"order":9,"icon":"send","target":30},
    {"id":"ind-proposals-75","scope":"individual","title":"Jamais à court d’élan","description":"Partager 75 propositions.","family":"proposals","tier":3,"criterion":{"metric":"proposals","threshold":75},"order":10,"icon":"send","target":75},
    {"id":"ind-participations-1","scope":"individual","title":"Au rendez-vous du duo","description":"Participer à un premier défi validé par vos deux coches.","family":"participations","tier":1,"criterion":{"metric":"participations","threshold":1},"order":11,"icon":"handshake","target":1},
    {"id":"ind-participations-5","scope":"individual","title":"Cinq étoiles de présence","description":"Participer à 5 défis validés à deux.","family":"participations","tier":1,"criterion":{"metric":"participations","threshold":5},"order":12,"icon":"handshake","target":5},
    {"id":"ind-participations-15","scope":"individual","title":"Partenaire de compétition","description":"Participer à 15 défis validés à deux.","family":"participations","tier":2,"criterion":{"metric":"participations","threshold":15},"order":13,"icon":"handshake","target":15},
    {"id":"ind-participations-30","scope":"individual","title":"Un pilier très joueur","description":"Participer à 30 défis validés à deux.","family":"participations","tier":3,"criterion":{"metric":"participations","threshold":30},"order":14,"icon":"handshake","target":30},
    {"id":"ind-completed-sent-5","scope":"individual","title":"Bonne idée, bon moment","description":"Voir 5 de vos propres propositions aboutir à une validation à deux.","family":"initiative","tier":1,"criterion":{"metric":"completedSent","threshold":5},"order":15,"icon":"spark","target":5},
    {"id":"ind-completed-sent-15","scope":"individual","title":"Mes idées font leur chemin","description":"Voir 15 de vos propres propositions aboutir à une validation à deux.","family":"initiative","tier":2,"criterion":{"metric":"completedSent","threshold":15},"order":16,"icon":"spark","target":15},
    {"id":"ind-completed-received-5","scope":"individual","title":"Je relève le gant","description":"Valider à deux 5 propositions qui vous ont été adressées.","family":"received","tier":1,"criterion":{"metric":"completedReceived","threshold":5},"order":17,"icon":"handshake","target":5},
    {"id":"ind-completed-received-15","scope":"individual","title":"Partenaire partant","description":"Valider à deux 15 propositions qui vous ont été adressées.","family":"received","tier":2,"criterion":{"metric":"completedReceived","threshold":15},"order":18,"icon":"handshake","target":15},
    {"id":"ind-complicite-3","scope":"individual","title":"Complice en formation","description":"Participer à 3 défis Complicité validés à deux.","family":"categories","tier":1,"criterion":{"metric":"participations","threshold":3,"categoryId":"complicite"},"order":19,"icon":"heart","target":3},
    {"id":"ind-complicite-10","scope":"individual","title":"Complice de haut vol","description":"Participer à 10 défis Complicité validés à deux.","family":"categories","tier":2,"criterion":{"metric":"participations","threshold":10,"categoryId":"complicite"},"order":20,"icon":"heart","target":10},
    {"id":"ind-attention-3","scope":"individual","title":"Plaisirs en poche","description":"Participer à 3 défis Plaisirs validés à deux.","family":"categories","tier":1,"criterion":{"metric":"participations","threshold":3,"categoryId":"attention"},"order":21,"icon":"cup","target":3},
    {"id":"ind-attention-10","scope":"individual","title":"Le goût des petites attentions","description":"Participer à 10 défis Plaisirs validés à deux.","family":"categories","tier":2,"criterion":{"metric":"participations","threshold":10,"categoryId":"attention"},"order":22,"icon":"cup","target":10},
    {"id":"ind-projets-3","scope":"individual","title":"Les mains dans le projet","description":"Participer à 3 défis Projets validés à deux.","family":"categories","tier":1,"criterion":{"metric":"participations","threshold":3,"categoryId":"projets"},"order":23,"icon":"palette","target":3},
    {"id":"ind-projets-10","scope":"individual","title":"Permis de bricoler à deux","description":"Participer à 10 défis Projets validés à deux.","family":"categories","tier":2,"criterion":{"metric":"participations","threshold":10,"categoryId":"projets"},"order":24,"icon":"palette","target":10},
    {"id":"ind-intimite-3","scope":"individual","title":"Club privé","description":"Participer à 3 défis Intimité validés à deux.","family":"categories","tier":1,"criterion":{"metric":"participations","threshold":3,"categoryId":"intimite"},"order":25,"icon":"moon","target":3},
    {"id":"ind-intimite-10","scope":"individual","title":"Complice à huis clos","description":"Participer à 10 défis Intimité validés à deux.","family":"categories","tier":2,"criterion":{"metric":"participations","threshold":10,"categoryId":"intimite"},"order":26,"icon":"moon","target":10},
    {"id":"ind-active-days-3","scope":"individual","title":"On se recroise","description":"Commencer un tirage, proposer ou cocher un défi, sur 3 jours différents.","family":"regularity","tier":1,"criterion":{"metric":"activeDays","threshold":3},"order":27,"icon":"calendar","target":3},
    {"id":"ind-active-days-10","scope":"individual","title":"Petite habitude, grand sourire","description":"Commencer un tirage, proposer ou cocher un défi, sur 10 jours différents.","family":"regularity","tier":2,"criterion":{"metric":"activeDays","threshold":10},"order":28,"icon":"calendar","target":10},
    {"id":"ind-active-streak-3","scope":"individual","title":"Trois jours, trois clins d’œil","description":"Commencer un tirage, proposer ou cocher un défi, trois jours de suite.","family":"regularity","tier":2,"criterion":{"metric":"activeStreakBest","threshold":3},"order":29,"icon":"calendar","target":3},
    {"id":"ind-distinct-variants-6","scope":"individual","title":"Six nuances de moi","description":"Participer à 6 variantes différentes, chacune validée à deux.","family":"exploration","tier":2,"criterion":{"metric":"distinctCompletedVariants","threshold":6},"order":30,"icon":"compass","target":6},
    {"id":"duo-completed-1","scope":"shared","title":"Premier nous","description":"Valider ensemble un premier défi.","family":"milestones","tier":1,"criterion":{"metric":"completed","threshold":1},"order":31,"icon":"heart","target":1},
    {"id":"duo-completed-5","scope":"shared","title":"Duo en rodage","description":"Valider ensemble 5 défis.","family":"milestones","tier":1,"criterion":{"metric":"completed","threshold":5},"order":32,"icon":"heart","target":5},
    {"id":"duo-completed-10","scope":"shared","title":"La fabrique à souvenirs","description":"Valider ensemble 10 défis.","family":"milestones","tier":1,"criterion":{"metric":"completed","threshold":10},"order":33,"icon":"heart","target":10},
    {"id":"duo-completed-25","scope":"shared","title":"Vingt-cinq bonnes raisons","description":"Valider ensemble 25 défis.","family":"milestones","tier":2,"criterion":{"metric":"completed","threshold":25},"order":34,"icon":"star","target":25},
    {"id":"duo-completed-50","scope":"shared","title":"Duo demi-centenaire","description":"Valider ensemble 50 défis.","family":"milestones","tier":2,"criterion":{"metric":"completed","threshold":50},"order":35,"icon":"star","target":50},
    {"id":"duo-completed-100","scope":"shared","title":"La centaine complice","description":"Valider ensemble 100 défis.","family":"milestones","tier":3,"criterion":{"metric":"completed","threshold":100},"order":36,"icon":"star","target":100},
    {"id":"duo-completed-250","scope":"shared","title":"Collectionneurs de moments","description":"Valider ensemble 250 défis.","family":"milestones","tier":3,"criterion":{"metric":"completed","threshold":250},"order":37,"icon":"star","target":250},
    {"id":"duo-completed-500","scope":"shared","title":"Le duo des grands jours","description":"Valider ensemble 500 défis.","family":"milestones","tier":3,"criterion":{"metric":"completed","threshold":500},"order":38,"icon":"star","target":500},
    {"id":"duo-distinct-categories-2","scope":"shared","title":"On change de décor","description":"Valider ensemble au moins un défi dans 2 catégories différentes.","family":"exploration","tier":1,"criterion":{"metric":"distinctCompletedCategories","threshold":2},"order":39,"icon":"compass","target":2},
    {"id":"duo-distinct-categories-4","scope":"shared","title":"Tour complet du duo","description":"Valider ensemble au moins un défi dans chacune des 4 catégories.","family":"exploration","tier":2,"criterion":{"metric":"distinctCompletedCategories","threshold":4},"order":40,"icon":"compass","target":4},
    {"id":"duo-distinct-cards-6","scope":"shared","title":"Six façons de se retrouver","description":"Valider ensemble 6 cartes différentes.","family":"exploration","tier":1,"criterion":{"metric":"distinctCompletedCards","threshold":6},"order":41,"icon":"compass","target":6},
    {"id":"duo-distinct-cards-12","scope":"shared","title":"Douze cartes, zéro routine","description":"Valider ensemble 12 cartes différentes.","family":"exploration","tier":2,"criterion":{"metric":"distinctCompletedCards","threshold":12},"order":42,"icon":"compass","target":12},
    {"id":"duo-distinct-cards-24","scope":"shared","title":"Le grand tour des cartes","description":"Valider ensemble 24 cartes différentes.","family":"exploration","tier":3,"criterion":{"metric":"distinctCompletedCards","threshold":24},"order":43,"icon":"compass","target":24},
    {"id":"duo-distinct-variants-12","scope":"shared","title":"Douze nuances de nous","description":"Valider ensemble 12 variantes différentes.","family":"exploration","tier":1,"criterion":{"metric":"distinctCompletedVariants","threshold":12},"order":44,"icon":"spark","target":12},
    {"id":"duo-distinct-variants-36","scope":"shared","title":"La routine fait sa valise","description":"Valider ensemble 36 variantes différentes.","family":"exploration","tier":2,"criterion":{"metric":"distinctCompletedVariants","threshold":36},"order":45,"icon":"spark","target":36},
    {"id":"duo-distinct-variants-72","scope":"shared","title":"L’art de varier les plaisirs","description":"Valider ensemble 72 variantes différentes.","family":"exploration","tier":3,"criterion":{"metric":"distinctCompletedVariants","threshold":72},"order":46,"icon":"spark","target":72},
    {"id":"duo-completion-days-3","scope":"shared","title":"On remet ça","description":"Terminer au moins un défi ensemble lors de 3 dates différentes.","family":"regularity","tier":1,"criterion":{"metric":"completionDays","threshold":3},"order":47,"icon":"calendar","target":3},
    {"id":"duo-completion-days-10","scope":"shared","title":"Le rendez-vous des bons jours","description":"Terminer au moins un défi ensemble lors de 10 dates différentes.","family":"regularity","tier":2,"criterion":{"metric":"completionDays","threshold":10},"order":48,"icon":"calendar","target":10},
    {"id":"duo-completion-days-30","scope":"shared","title":"Trente jours qui comptent","description":"Terminer au moins un défi ensemble lors de 30 dates différentes.","family":"regularity","tier":3,"criterion":{"metric":"completionDays","threshold":30},"order":49,"icon":"calendar","target":30},
    {"id":"duo-completion-streak-3","scope":"shared","title":"Trois à la suite","description":"Terminer au moins un défi ensemble pendant 3 jours consécutifs.","family":"regularity","tier":1,"criterion":{"metric":"completionStreakBest","threshold":3},"order":50,"icon":"calendar","target":3},
    {"id":"duo-completion-streak-7","scope":"shared","title":"Une semaine en tandem","description":"Terminer au moins un défi ensemble pendant 7 jours consécutifs.","family":"regularity","tier":2,"criterion":{"metric":"completionStreakBest","threshold":7},"order":51,"icon":"calendar","target":7},
    {"id":"duo-weekend-completed-5","scope":"shared","title":"Le week-end nous va bien","description":"Valider ensemble 5 défis un samedi ou un dimanche.","family":"regularity","tier":1,"criterion":{"metric":"weekendCompleted","threshold":5},"order":52,"icon":"sun","target":5},
    {"id":"duo-weekend-completed-20","scope":"shared","title":"Duo du dimanche aussi","description":"Valider ensemble 20 défis un samedi ou un dimanche.","family":"regularity","tier":2,"criterion":{"metric":"weekendCompleted","threshold":20},"order":53,"icon":"sun","target":20},
    {"id":"duo-every-category-5","scope":"shared","title":"Les quatre roues du duo","description":"Valider ensemble au moins 5 défis dans chacune des 4 catégories.","family":"exploration","tier":3,"criterion":{"metric":"completedEveryCategory","threshold":5},"order":54,"icon":"compass","target":5},
    {"id":"duo-thigh-massage-3","scope":"shared","title":"faiseuse de sartorius saillant","description":"Réaliser 3 massages des cuisses, chacun validé par vos deux coches.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-complicite-massage","variantRoll":2},"order":55,"source":"user_requested_exact_title","mappingStatus":"verified_existing_variant_and_user_context","icon":"handshake","target":3},
    {"id":"duo-covered-face-3","scope":"shared","title":"Visage parfaitement recouvert","description":"3 faciales, validées par vos deux coches.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-intimite-fellation","variantRoll":1},"order":56,"source":"user_requested_exact_title","mappingStatus":"verified_existing_variant_and_user_context","icon":"moon","target":3},
    {"id":"duo-kind-note-3","scope":"shared","title":"Post-it, grand effet","description":"Valider ensemble 3 petits mots doux cachés.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-complicite-petit-mot","variantRoll":2},"order":57,"icon":"send","target":3},
    {"id":"duo-crepes-3","scope":"shared","title":"La brigade des crêpes","description":"Valider ensemble 3 réalisations de la variante Crêpes.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-attention-douceur","variantRoll":1},"order":58,"icon":"cup","target":3},
    {"id":"duo-forest-walk-3","scope":"shared","title":"Le duo prend racine","description":"Valider ensemble 3 balades en forêt.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-projets-balade","variantRoll":3},"order":59,"icon":"leaf","target":3},
    {"id":"duo-phone-drawer-3","scope":"shared","title":"Le tiroir gagne, nous aussi","description":"Valider ensemble 3 parenthèses d’une heure avec le téléphone dans un tiroir.","family":"variants","tier":2,"criterion":{"metric":"completed","threshold":3,"cardId":"six-complicite-telephone","variantRoll":3},"order":60,"icon":"moon","target":3}
  ];

  // Cumulative progression is private room data. It is deliberately excluded
  // from roomSharedKeys; only badgeView exposes the reader's own collection.
  const progressMetrics=['draws','proposals','participations','completedSent','completedReceived'];
  const progressCategories=categories.map(category=>category.id);
  const progressCounter=value=>Number.isSafeInteger(value)&&value>=0;
  const progressObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const progressCopy=value=>JSON.parse(JSON.stringify(value));
  const countUp=(object,key,amount=1)=>{object[key]=Math.min(Number.MAX_SAFE_INTEGER,(object[key]||0)+amount);};
  const blankCalendar=()=>({days:0,lastDay:null,streak:0,best:0});
  function calendarOrdinal(key){
    if(typeof key!=='string'||!/^\d{1,6}-\d{2}-\d{2}$/.test(key))return null;
    const [year,month,day]=key.split('-').map(Number),date=new Date(0);
    date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
    return Number.isFinite(date.getTime())&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.getTime()/86400000:null;
  }
  function recordDay(calendar,at){
    if(!isoTime(at))return;
    const key=parisDateKey(at),day=calendarOrdinal(key),last=calendarOrdinal(calendar.lastDay);
    if(day===null||last!==null&&day<=last)return;
    countUp(calendar,'days');
    calendar.streak=last!==null&&day===last+1?Math.min(Number.MAX_SAFE_INTEGER,calendar.streak+1):1;
    calendar.best=Math.max(calendar.best,calendar.streak);calendar.lastDay=key;
  }
  function blankIndividual(){
    return {...Object.fromEntries(progressMetrics.map(metric=>[metric,0])),byCategory:Object.fromEntries(progressCategories.map(id=>[id,Object.fromEntries(progressMetrics.map(metric=>[metric,0]))])),completedByCard:{},completedByVariant:{},activity:blankCalendar()};
  }
  function blankProgression(epoch){
    return {version:1,epoch,individual:{a:blankIndividual(),b:blankIndividual()},shared:{completed:0,byCategory:Object.fromEntries(progressCategories.map(id=>[id,0])),completedByCard:{},completedByVariant:{},completion:blankCalendar(),weekendCompleted:0},awards:{individual:{a:{},b:{}},shared:{}},sequences:{a:0,b:0}};
  }
  function progressCategory(record){return mergedCategory(record.categoryId||getCard(record.cardId)?.categoryId);}
  function completedVariantKey(record){
    const card=getCard(record.cardId);
    return card&&Array.isArray(card.variants)&&Number.isInteger(record.variantRoll)&&record.variantRoll>=1&&record.variantRoll<=card.variants.length?card.id+':v'+record.variantRoll:null;
  }
  function addIndividual(progress,actor,metric,categoryId){
    if(progress.individual[actor][metric]===Number.MAX_SAFE_INTEGER)return;
    countUp(progress.individual[actor],metric);
    if(progressCategories.includes(categoryId))countUp(progress.individual[actor].byCategory[categoryId],metric);
  }
  function addCompletionDetails(progress,task,at){
    const categoryId=progressCategory(task),variant=completedVariantKey(task);
    countUp(progress.shared.completedByCard,task.cardId);
    if(variant)countUp(progress.shared.completedByVariant,variant);
    for(const actor of roomActors){
      countUp(progress.individual[actor].completedByCard,task.cardId);
      if(variant)countUp(progress.individual[actor].completedByVariant,variant);
    }
    addIndividual(progress,task.from,'completedSent',categoryId);
    addIndividual(progress,task.to,'completedReceived',categoryId);
    if(isoTime(at)){
      recordDay(progress.shared.completion,at);
      if(isParisWeekend(at))countUp(progress.shared,'weekendCompleted');
    }
  }
  function badgeMetric(progress,actor,badge){
    const criterion=badge.criterion,individual=badge.scope==='individual',data=individual?progress.individual[actor]:progress.shared;
    const category=criterion.categoryId;
    if(['participations','completed'].includes(criterion.metric)){
      if(criterion.cardId)return data.completedByVariant[criterion.cardId+':v'+criterion.variantRoll]||0;
      if(category)return individual?data.byCategory[category].participations:data.byCategory[category];
      return individual?data.participations:data.completed;
    }
    if(progressMetrics.includes(criterion.metric))return category?data.byCategory[category][criterion.metric]:data[criterion.metric];
    if(criterion.metric==='distinctCompletedCards')return Object.values(data.completedByCard).filter(value=>value>0).length;
    if(criterion.metric==='distinctCompletedVariants')return Object.values(data.completedByVariant).filter(value=>value>0).length;
    if(criterion.metric==='distinctCompletedCategories')return progressCategories.filter(id=>(individual?data.byCategory[id].participations:data.byCategory[id])>0).length;
    if(criterion.metric==='activeDays')return data.activity.days;
    if(criterion.metric==='activeStreakBest')return data.activity.best;
    if(criterion.metric==='completionDays')return data.completion.days;
    if(criterion.metric==='completionStreakBest')return data.completion.best;
    if(criterion.metric==='weekendCompleted')return data.weekendCompleted;
    if(criterion.metric==='completedEveryCategory')return Math.min(...progressCategories.map(id=>data.byCategory[id]));
    return 0;
  }
  function awardBadges(progress,at,imported=false){
    for(const badge of badgeCatalog){
      if(badge.scope==='individual'){
        for(const actor of roomActors){
          if(progress.awards.individual[actor][badge.id]||badgeMetric(progress,actor,badge)<badge.target)continue;
          progress.awards.individual[actor][badge.id]={at,sequence:++progress.sequences[actor],...(imported?{source:'imported'}:{})};
        }
      }else if(!progress.awards.shared[badge.id]&&badgeMetric(progress,'a',badge)>=badge.target){
        progress.awards.shared[badge.id]={at,sequenceByActor:{a:++progress.sequences.a,b:++progress.sequences.b},...(imported?{source:'imported'}:{})};
      }
    }
  }
  function initialProgression(state){
    const progress=blankProgression(state.sequence),records=new Map(),activity=[];
    // Aggregate completions are already cumulative. Unknown old card variants,
    // directions and dates are not reconstructed from those aggregate totals.
    progress.shared.completed=state.stats.totalCompleted;
    for(const categoryId of progressCategories){
      const completed=categoryScore(state.stats,categoryId);
      progress.shared.byCategory[categoryId]=completed;
      for(const actor of roomActors)progress.individual[actor].byCategory[categoryId].participations=completed;
    }
    for(const actor of roomActors)progress.individual[actor].participations=state.stats.totalCompleted;
    const collect=(record,published=false,privateDraw=false)=>{
      if(!record||typeof record.id!=='string'||!roomActors.includes(record.from)||record.to!==otherPlayer(record.from))return;
      const previous=records.get(record.id);
      records.set(record.id,{record:{...(previous?.record||{}),...record},published:published||previous?.published===true,privateDraw:privateDraw||previous?.privateDraw===true});
    };
    if(state.version===2){for(const lane of Object.values(state.lanes))collect(lane.round,false,['card','variant','draft'].includes(lane.phase));for(const pending of state.pendingRounds)collect(pending.round,true);}
    else collect(state.round,false,['card','variant','draft'].includes(state.phase));
    for(const task of state.tasks)collect(task,true);
    for(const record of state.history)collect(record);
    const remaining={...progress.shared.byCategory};
    const completed=[];
    for(const {record,published,privateDraw} of records.values()){
      const categoryId=progressCategory(record);
      if(!progressCategories.includes(categoryId))continue;
      // An unmarked published v2 round might be an old free daily card. A
      // private draw, direct queue, legacy catalogue or marker supplies proof.
      const paid=record.dailyFree!==true&&(record.dailyFree===false||record.directQueued===true||record.catalogueVersion!==2||privateDraw);
      if(paid&&Number.isInteger(record.categoryRoll)&&getCategory(record.categoryId,record.catalogueVersion===2?2:1)?.number===record.categoryRoll)addIndividual(progress,record.from,'draws',categoryId);
      if(published||isoTime(record.sentAt)||['queued','completed','expired'].includes(record.status)){
        addIndividual(progress,record.from,'proposals',categoryId);
        if(isoTime(record.sentAt))activity.push({actor:record.from,at:record.sentAt});
      }
      const confirmed=record.checks?.a===true&&record.checks?.b===true||record.fromConfirmed===true&&record.toConfirmed===true;
      if(record.status==='completed'&&confirmed&&remaining[categoryId]>0){remaining[categoryId]--;completed.push(record);}
    }
    completed.sort((a,b)=>(isoTime(a.endedAt)?Date.parse(a.endedAt):0)-(isoTime(b.endedAt)?Date.parse(b.endedAt):0)||a.id.localeCompare(b.id));
    for(const record of completed){
      addCompletionDetails(progress,record,record.endedAt);
      if(isoTime(record.endedAt)&&roomActors.includes(record.closedBy))activity.push({actor:record.closedBy,at:record.endedAt});
    }
    activity.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    for(const event of activity)recordDay(progress.individual[event.actor].activity,event.at);
    awardBadges(progress,null,true);
    return progress;
  }
  function validCalendar(calendar){
    return progressObject(calendar)&&['days','streak','best'].every(key=>progressCounter(calendar[key]))&&calendar.streak<=calendar.best&&calendar.best<=calendar.days&&(calendar.days===0?calendar.lastDay===null&&calendar.streak===0&&calendar.best===0:calendarOrdinal(calendar.lastDay)!==null&&calendar.streak>0);
  }
  function validProgressMap(map,variant=false){
    if(!progressObject(map))return false;
    return Object.entries(map).every(([key,value])=>{
      if(!progressCounter(value)||value===0)return false;
      if(!variant)return !!getCard(key);
      const match=/^(.+):v([1-6])$/.exec(key),card=match&&getCard(match[1]);
      return !!card&&Array.isArray(card.variants)&&!!card.variants[Number(match[2])-1];
    });
  }
  function validProgression(progress,sequence){
    if(!progressObject(progress)||progress.version!==1||!Number.isSafeInteger(progress.epoch)||progress.epoch<1||progress.epoch>sequence||!progressObject(progress.individual)||!progressObject(progress.shared)||!progressObject(progress.awards)||!progressObject(progress.awards.individual)||!progressObject(progress.awards.shared)||!progressObject(progress.sequences))return false;
    const shared=progress.shared;
    if(!progressCounter(shared.completed)||!progressCounter(shared.weekendCompleted)||shared.weekendCompleted>shared.completed||!progressObject(shared.byCategory)||Object.keys(shared.byCategory).sort().join(',')!==progressCategories.slice().sort().join(',')||!progressCategories.every(id=>progressCounter(shared.byCategory[id]))||!validProgressMap(shared.completedByCard)||!validProgressMap(shared.completedByVariant,true)||!validCalendar(shared.completion))return false;
    if(progressCategories.reduce((total,id)=>total+shared.byCategory[id],0)!==shared.completed)return false;
    const visibleSequences={a:[],b:[]};
    for(const actor of roomActors){
      const own=progress.individual[actor];
      if(!progressObject(own)||!progressMetrics.every(metric=>progressCounter(own[metric]))||!progressObject(own.byCategory)||Object.keys(own.byCategory).sort().join(',')!==progressCategories.slice().sort().join(',')||!progressCategories.every(id=>progressObject(own.byCategory[id])&&progressMetrics.every(metric=>progressCounter(own.byCategory[id][metric])))||!validProgressMap(own.completedByCard)||!validProgressMap(own.completedByVariant,true)||!validCalendar(own.activity)||!progressObject(progress.awards.individual[actor])||!progressCounter(progress.sequences[actor]))return false;
      for(const metric of progressMetrics)if(progressCategories.reduce((total,id)=>total+own.byCategory[id][metric],0)!==own[metric])return false;
      for(const [id,award] of Object.entries(progress.awards.individual[actor])){
        if(!badgeCatalog.some(badge=>badge.id===id&&badge.scope==='individual')||!validStoredAward(award,false))return false;
        visibleSequences[actor].push(award.sequence);
      }
    }
    for(const [id,award] of Object.entries(progress.awards.shared)){
      if(!badgeCatalog.some(badge=>badge.id===id&&badge.scope==='shared')||!validStoredAward(award,true))return false;
      for(const actor of roomActors)visibleSequences[actor].push(award.sequenceByActor[actor]);
    }
    return roomActors.every(actor=>{const list=visibleSequences[actor].sort((a,b)=>a-b);return progress.sequences[actor]===list.length&&list.every((value,index)=>value===index+1);});
  }
  function validStoredAward(award,shared){
    if(!progressObject(award)||!(award.source==='imported'?award.at===null:award.source===undefined&&isoTime(award.at)))return false;
    const sequence=value=>Number.isSafeInteger(value)&&value>=1;
    return shared?progressObject(award.sequenceByActor)&&Object.keys(award.sequenceByActor).sort().join(',')==='a,b'&&roomActors.every(actor=>sequence(award.sequenceByActor[actor])):sequence(award.sequence);
  }
  function retainProgression(before,after){
    if(before.progression!==undefined&&after.progression===undefined)after.progression=progressCopy(before.progression);
    return after;
  }
  function progressTransition(before,after,action,actor){
    if(after===before||action.type==='RESET')return after;
    retainProgression(before,after);
    if(!roomActors.includes(actor)||!isoTime(action.at))return after;
    const lane=state=>state.version===2?state.lanes[actor]:state;
    const previous=lane(before),next=lane(after);
    const drawn=['ROLL_CATEGORY','JOKER_DRAW'].includes(action.type)&&previous.phase==='category'&&next.phase==='card'&&previous.round.id===next.round.id;
    const published=after.tasks.some(task=>task.id===previous.round.id)||(after.version===2?after.pendingRounds.some(item=>item.round.id===previous.round.id):after.phase==='pending');
    const sent=action.type==='SEND'&&previous.phase==='draft'&&previous.round.from===actor&&published;
    const task=action.type==='TOGGLE_TASK_CHECK'?before.tasks.find(task=>task.id===action.taskId):null;
    const remaining=task&&after.tasks.find(item=>item.id===task.id);
    const completed=!!task&&action.checked===true&&!task.checks[actor]&&task.checks[otherPlayer(actor)]&&!remaining&&after.stats.totalCompleted===before.stats.totalCompleted+1;
    const checked=!!task&&action.checked===true&&!task.checks[actor]&&(remaining?.checks[actor]===true||completed);
    if(!drawn&&!sent&&!checked&&!completed)return after;
    const progress=before.progression?progressCopy(before.progression):initialProgression(before);
    if(drawn)addIndividual(progress,actor,'draws',progressCategory(next.round));
    if(sent)addIndividual(progress,actor,'proposals',progressCategory(previous.round));
    if(drawn||sent||checked)recordDay(progress.individual[actor].activity,action.at);
    if(completed){
      const categoryId=progressCategory(task);
      countUp(progress.shared,'completed');countUp(progress.shared.byCategory,categoryId);
      for(const participant of roomActors)addIndividual(progress,participant,'participations',categoryId);
      addCompletionDetails(progress,task,action.at);
    }
    awardBadges(progress,action.at);
    after.progression=progress;
    return after;
  }
  function reduce(state,action){
    const next=reduceGame(state,action);
    return next===state?state:progressTransition(state,next,action,action.actor||state.activePlayer);
  }
  function reduceRoom(room,action){
    const next=reduceRoomGame(room,action);
    return next===room?room:progressTransition(room,next,action,action.actor);
  }
  function badgeView(state,actor){
    if(!roomActors.includes(actor)||!(state?.version===2?validateRoom(state):validateState(state)))return null;
    const progress=state.progression||initialProgression(state);
    return {version:1,epoch:progress.epoch,items:badgeCatalog.map(badge=>{
      const shared=badge.scope==='shared',stored=shared?progress.awards.shared[badge.id]:progress.awards.individual[actor][badge.id];
      const award=stored?{id:progress.epoch+':'+badge.scope+':'+(shared?'':actor+':')+badge.id,at:stored.at,sequence:shared?stored.sequenceByActor[actor]:stored.sequence,...(stored.source?{source:stored.source}:{})}:null;
      return {id:badge.id,progress:{value:badgeMetric(progress,actor,badge),target:badge.target},award};
    })};
  }
  function validateBadgeView(view,actor){
    if(!progressObject(view)||Object.keys(view).sort().join(',')!=='epoch,items,version'||view.version!==1||!Number.isSafeInteger(view.epoch)||view.epoch<1||!Array.isArray(view.items)||view.items.length!==badgeCatalog.length||actor!==undefined&&!roomActors.includes(actor))return false;
    const sequences=[];
    for(let index=0;index<badgeCatalog.length;index++){
      const badge=badgeCatalog[index],item=view.items[index];
      if(!progressObject(item)||Object.keys(item).sort().join(',')!=='award,id,progress'||item.id!==badge.id||!progressObject(item.progress)||Object.keys(item.progress).sort().join(',')!=='target,value'||!progressCounter(item.progress.value)||item.progress.target!==badge.target)return false;
      if(item.award===null)continue;
      const award=item.award,expected=badge.scope==='shared'?[view.epoch+':shared:'+badge.id]:(actor?[actor]:roomActors).map(who=>view.epoch+':individual:'+who+':'+badge.id);
      if(!progressObject(award)||Object.keys(award).sort().join(',')!==(award.source===undefined?'at,id,sequence':'at,id,sequence,source')||!expected.includes(award.id)||!validStoredAward(award,false)||item.progress.value<badge.target)return false;
      sequences.push(award.sequence);
    }
    sequences.sort((a,b)=>a-b);
    return sequences.every((value,index)=>value===index+1);
  }

  const api={badgeCatalog,badgeView,validateBadgeView,categories,legacyCategories,categorySides,rollCategory,categoryScore,cards:newCards,legacyCards:publishedCards,players,rules,cardSides,getVariant,createState,validateState,normalizeState,createRoom,resetRoom,validateRoom,normalizeRoom,roomView,reduceRoom,randomInt,drawHand,reduce,getCard,getCategory,otherPlayer,canRespond,canSeeRound,canRerollCard,parisDateKey,isoWeekKey,drawDaily};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  scope.OndeGame=api;
})(typeof window!=='undefined' ? window : globalThis);
