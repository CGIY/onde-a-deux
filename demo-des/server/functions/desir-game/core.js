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
  // On Paris week-ends, Intimité gets a doubled weight.
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
      Array(category.id==='intimite'?(weekend?22:11):category.id==='complicite'?11:10).fill(category.number)
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
    if (!validStats(s.stats)) return false;
    if (!Number.isSafeInteger(s.sequence) || s.sequence < 1 || !s.round || !Array.isArray(s.history) || s.history.length > 80) return false;
    if (!validTasks(s)) return false;
    if (!Array.isArray(s.favorites) || s.favorites.some(id => !getCard(id)) || !s.prefs || prefKeys.some(k => typeof s.prefs[k] !== 'boolean')) return false;
    if (!s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen)) return false;
    if (Object.entries(s.seen).some(([key,list]) => !getCategory(key,1) || !Array.isArray(list) || list.length>8 || list.some(id=>!getCard(id) || getCard(id).categoryId!==key))) return false;
    if (!Array.isArray(s.players) || s.players.length !== 2 || s.players.some((p,i) => !p || p.id !== players[i].id || typeof p.name !== 'string' || !p.name.trim() || p.name.length>60)) return false;
    if (s.history.some(item=>!item || typeof item.id!=='string' || !getCard(item.cardId) || item.categoryId!==undefined&&item.categoryId!==getCard(item.cardId).categoryId || !['passed','defended','queued','expired','completed'].includes(item.status) || !['a','b'].includes(item.from) || item.to!==otherPlayer(item.from) || !Array.isArray(item.rolls) || item.rolls.length>2 || item.rolls.some(v=>!Number.isInteger(v) || v<1 || v>20) || !validCardReroll(item) || !validSelectedVariant(item))) return false;
    const r=s.round;
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
    if(s.phase==='accepted' && (r.status!=='accepted' || r.awaiting!==null || !r.fromConfirmed || !r.toConfirmed || !s.tasks.some(task=>task.id===r.id))) return false;
    if(s.phase==='resolved' && (!['passed','defended','expired','completed'].includes(r.status) || r.awaiting!==null || (['completed','expired'].includes(r.status) && (!r.fromConfirmed || !r.toConfirmed)))) return false;
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
    s.history=[JSON.parse(JSON.stringify(round)),...s.history.filter(item=>item.id!==round.id)].slice(0,80);
  }

  function enqueueTask(s, acceptedAt) {
    const r=s.round;
    if(s.tasks.some(task=>task.id===r.id)) return;
    s.tasks.push({id:r.id,cardId:r.cardId,categoryId:r.categoryId,from:r.from,to:r.to,
      createdAt:acceptedAt,expiresAt:new Date(Date.parse(acceptedAt)+rules.taskLifetimeMs).toISOString(),
      checks:{a:false,b:false},proposal:r.adapted?r.proposal:null,...(r.catalogueVersion===2?{variantRoll:r.variantRoll}:{})});
    recordHistory(s,{...r,status:'queued'});
  }

  function finishTask(s, task, status, at) {
    const current=s.round.id===task.id&&s.phase==='accepted';
    const base=current?s.round:s.history.find(round=>round.id===task.id)||{id:task.id,cardId:task.cardId,categoryId:task.categoryId,from:task.from,to:task.to,rolls:[],cardRerolled:false,acceptedAt:task.createdAt,fromConfirmed:true,toConfirmed:true};
    const ended={...base,status,awaiting:null,endedAt:at,closedBy:s.activePlayer,checks:{...task.checks}};
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

  function reduce(state, action) {
    if (!validateState(state) || !action || typeof action.type !== 'string') return state;
    const kind=action.type;
    if(kind==='RESET') {
      const fresh=createState();
      if(action.keepPrefs) fresh.prefs={...state.prefs};
      return fresh;
    }
    // Reject stale UI callbacks, such as an animation from a previous round.
    if(action.roundId && action.roundId!==state.round.id && !['TOGGLE_TASK_CHECK','EXPIRE_TASKS'].includes(kind)) return state;
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
          Object.assign(r,{catalogueVersion:2,variantRoll:null});
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
        r.catalogueVersion=2; r.variantRoll=null;
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
        r.catalogueVersion=2; r.variantRoll=null;
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
        r.catalogueVersion=2; r.variantRoll=daily.variantRoll; r.modeRoll=null; r.hardcoreOffer=false;
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
    if(!room || room.version!==2 || !room.lanes || typeof room.lanes!=='object' || Array.isArray(room.lanes) || Object.keys(room.lanes).sort().join(',')!=='a,b') return false;
    if(!validStoredDaily(room.daily) || !validStoredReroll(room.dailyReroll) || !validStoredJoker(room.joker)) return false;
    const lanes=roomActors.map(actor=>room.lanes[actor]);
    if(lanes.some((lane,index)=>!lane || typeof lane!=='object' || lane.round?.from!==roomActors[index])) return false;
    if(lanes[0].round.id===lanes[1].round.id) return false;
    if(roomActors.some(actor=>!validateState(focusedRoomState(room,actor,room.lanes[actor])))) return false;
    if(new Set(room.history.map(round=>round.id)).size!==room.history.length) return false;
    return room.history.every(round=>{
      const sequence=typeof round.id==='string'&&/^onde-[1-9]\d*$/.test(round.id)?Number(round.id.slice(5)):NaN;
      const lane=lanes.find(item=>item.round.id===round.id);
      return Number.isSafeInteger(sequence) && sequence<=room.sequence && (!lane ||
        round.cardId===lane.round.cardId && round.from===lane.round.from && round.to===lane.round.to && round.variantRoll===lane.round.variantRoll);
    });
  }

  function normalizeRoom(raw,options={}) {
    if(validateRoom(raw)) return raw;
    if(raw?.version===2) {
      // Migration : une salle en pleine négociation héritée (défi, contre-
      // proposition, double confirmation) revient à une proposition prête
      // ou à une invitation simple, sans jamais perdre le tour en cours.
      const migrated=roomCopy(raw);
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
    const room={version:2,...roomCopy(roomShared(state)),daily:state.daily??null,dailyReroll:state.dailyReroll??{dateKey:isoTime(options.at)?parisDateKey(options.at):null,used:[]},joker:state.joker??null,sequence,lanes:{
      [owner]:{phase:state.phase,round:roomCopy(state.round)},
      [other]:{phase:'category',round:blankRound(otherSequence,other,options.at)}
    }};
    return validateRoom(room)?room:null;
  }

  function createRoom(options={}) {
    const state=createState();
    state.round.createdAt=options.at || null;
    return normalizeRoom(state,options);
  }

  // This is a raw focused view. The server must redact the other person's
  // private draw before returning any such view to a browser.
  function roomView(room,actor,roundId) {
    if(!validateRoom(room) || !roomActors.includes(actor)) return null;
    const lane=roundId===undefined?room.lanes[actor]:roomActors.map(owner=>room.lanes[owner]).find(item=>item.round.id===roundId);
    return lane?roomCopy(focusedRoomState(room,actor,lane)):null;
  }

  function reconcileRoomTasks(room) {
    for(const owner of roomActors) {
      const lane=room.lanes[owner];
      if(lane.phase!=='accepted' || room.tasks.some(task=>task.id===lane.round.id)) continue;
      const ended=room.history.find(round=>round.id===lane.round.id && ['completed','expired'].includes(round.status));
      if(ended) {
        const round={...lane.round,status:ended.status,awaiting:null,endedAt:ended.endedAt,closedBy:ended.closedBy,checks:{...ended.checks}};
        room.lanes[owner]={phase:'resolved',round};
        recordHistory(room,round);
      }
    }
  }

  function reduceRoom(room,action) {
    if(!validateRoom(room) || !action || typeof action.type!=='string') return room;
    if(action.type==='RESET') {
      const reset=createRoom({at:action.at});
      if(action.keepPrefs) reset.prefs=roomCopy(room.prefs);
      return reset;
    }
    const actor=action.actor || (action.type==='EXPIRE_TASKS'?'a':null);
    if(!roomActors.includes(actor)) return room;
    const shared=['TOGGLE_TASK_CHECK','EXPIRE_TASKS','SET_PREFS','TOGGLE_FAVORITE'].includes(action.type);
    const owner=shared?actor:roomActors.find(id=>room.lanes[id].round.id===action.roundId);
    if(!owner) return room;
    const lane=room.lanes[owner];
    if(action.type==='NEW_ROUND') {
      if(owner!==actor || !['accepted','resolved'].includes(lane.phase) || room.sequence===Number.MAX_SAFE_INTEGER) return room;
      const next=roomCopy(room);
      next.sequence++;
      next.lanes[actor]={phase:'category',round:blankRound(next.sequence,actor,action.at)};
      return validateRoom(next)?next:room;
    }
    if(action.type==='ROLL_CATEGORY' && owner!==actor) return room;
    const focused=focusedRoomState(room,actor,lane);
    if(!shared && !canSeeRound(focused,actor)) return room;
    const forwarded={...action,actor};
    if(shared) delete forwarded.roundId;
    const result=reduce(focused,forwarded);
    if(result===focused) return room;
    const next={version:2,...roomShared(result),lanes:roomCopy(room.lanes)};
    next.lanes[owner]={phase:result.phase,round:result.round};
    reconcileRoomTasks(next);
    return validateRoom(next)?next:room;
  }

  const api={categories,legacyCategories,categorySides,rollCategory,categoryScore,cards:newCards,legacyCards:publishedCards,players,rules,cardSides,getVariant,createState,validateState,normalizeState,createRoom,validateRoom,normalizeRoom,roomView,reduceRoom,randomInt,drawHand,reduce,getCard,getCategory,otherPlayer,canRespond,canSeeRound,canRerollCard,parisDateKey,isoWeekKey,drawDaily};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  scope.OndeGame=api;
})(typeof window!=='undefined' ? window : globalThis);
