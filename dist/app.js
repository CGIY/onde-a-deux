const mediaCatalog = window.ONDE_MEDIA_CATALOG || { film: [], serie: [], spectacle: [] };
const titleArtwork = window.ONDE_ARTWORK || {};

const posterByType = {
  film: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80",
  serie: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=500&q=80",
  spectacle: "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=500&q=80",
  jeu: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=500&q=80"
};

const posterPool = {
  film: [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=82"
  ],
  serie: [
    "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=600&q=82"
  ],
  spectacle: [
    "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=82"
  ],
  jeu: [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=600&q=82",
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=82"
  ]
};

function visualForTitle(type, title) {
  const artwork = titleArtwork[type]?.[title];
  if (artwork) return artwork;
  const pool = posterPool[type] || [posterByType[type]];
  const hash = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

function mediaCards(type, description, subtype) {
  return (mediaCatalog[type] || []).map((title) => ({ title, description, subtype, visual: visualForTitle(type, title) }));
}

const categories = [
  {
    id: "media", name: "Médias", icon: "◐", color: "#668aa3",
    art: "linear-gradient(145deg, #668aa3, #335667)",
    cards: [
      ...mediaCards("film", "Un film de votre bibliothèque.", "Film"),
      ...mediaCards("serie", "Une série de votre bibliothèque.", "Série"),
      ...mediaCards("spectacle", "Un spectacle de votre bibliothèque.", "Spectacle")
    ]
  },
  {
    id: "jeu", name: "Jeu", icon: "J", color: "#7d9a86",
    art: "linear-gradient(145deg, #8baa94, #486d56)",
    cards: [
      ...["Minecraft Dungeon 2", "Minecraft", "Mario Tennis", "Mario Kart", "Baldurs Gate", "Cult of the Lamb", "Mini-jeu Switch"].map((title) => ({ title, description: "Un jeu vidéo à choisir et partager à deux.", subtype: "Jeu vidéo", visual: visualForTitle("jeu", title) })),
      ...[
        "Jaipur", "Trio", "That's Not a Hat", "District Noir", "Mantis", "Compagnons", "Athlètes de Compète", "CT Words", "Les Aventuriers du Rail", "Fire Tower", "Après-Ski", "Regicide", "Cérébré", "Eternal Decks", "DOS", "Zenith", "Coffee Rush", "Captain Flip", "Ink It", "Hues and Cues", "Red Notice", "The Vale of Eternity", "7 Wonders", "Agent Avenue", "iKnow", "Redac Chef", "Happy Salmon", "Locus", "Cat in the Box", "Cités Royales", "Splendor Duel", "The Gang", "Sky Team", "e-pense", "Flowers", "Splendor", "Cocoon", "7 Wonders Dice", "Take Time", "Harmonies", "Finspan", "Rebirth", "Bomb Busters", "Art Society", "Kronologic", "Dracula vs Van Helsing", "Mad Trip", "Reykholt", "Carnival of Monsters", "Marrakech", "Codenames", "Bunker", "Code Names", "Échecs", "Faraway", "Codex Naturalis"
      ].map((title) => ({ title, description: "Un jeu de société de votre collection.", subtype: "Jeu de société", visual: visualForTitle("jeu", title) }))
    ]
  },
  {
    id: "action", name: "Action", icon: "✦", color: "#d2a95e",
    art: "linear-gradient(145deg, #dda95b, #b36b48)",
    cards: [
      { title: "Balade en ville", description: "Sortir sans itinéraire et choisir la direction à tour de rôle.", subtype: "Action", visual: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=500&q=80" },
      { title: "Petit massage partagé", description: "Prendre quelques minutes pour se masser à tour de rôle.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=500&q=80" },
      { title: "Massage cuisse C", description: "Un massage choisi pour C, avec accord et arrêt possible à tout moment.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=500&q=80" },
      { title: "Massage tête A", description: "Un massage choisi pour A, avec accord et arrêt possible à tout moment.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=500&q=80" },
      { title: "Soin du visage", description: "Préparer un soin doux et prendre soin l’un de l’autre.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=500&q=80" },
      { title: "Café en ville", description: "Sortir prendre un café sans autre programme.", subtype: "Action", visual: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=500&q=80" },
      { title: "Mot doux caché", description: "Glisser un petit mot tendre dans un endroit où l’autre le trouvera plus tard.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=500&q=80" },
      { title: "Aquarelle à deux", description: "Peindre ensemble sans chercher à faire parfait.", subtype: "Action", visual: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=500&q=80" },
      { title: "Photos souvenir", description: "Faire quelques photos spontanées du moment, juste pour vous.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=500&q=80" },
      ...[
        ["Petit-déjeuner au lit", "Préparer un petit-déjeuner et le partager au lit, sans se presser."],
        ["Préparer la boisson préférée de l’autre", "Préparer la boisson préférée de l’autre et la lui apporter comme une attention surprise."],
        ["6h sans téléphone", "Passer six heures sans téléphone, sauf urgence, pour profiter pleinement du moment à deux."],
        ["Se préparer une mini boîte de snacks préférés", "Composer une petite boîte avec les snacks préférés de l’autre."],
        ["Faire un portrait rapide de l’autre", "Dessiner ou peindre un portrait rapide de l’autre, sans chercher la perfection."],
        ["Faire une sieste enlacés", "S’accorder une sieste enlacés, au calme, sans programme derrière."],
        ["Choisir une tenue l’un pour l’autre", "Choisir chacun une tenue pour l’autre et jouer le jeu le temps d’une sortie ou d’un moment à deux."],
        ["Se faire un massage des mains", "Prendre quelques minutes pour se masser les mains à tour de rôle."]
      ].map(([title, description]) => ({ title, description, subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=500&q=80" })),
      ...[
        ["Défi magasin d’occasion avec 10 € maximum", "Trouver chacun un objet amusant ou utile dans un magasin d’occasion, avec 10 € maximum."],
        ["Visiter une rue ou un quartier inconnu", "Choisir une rue ou un quartier que vous ne connaissez pas et l’explorer ensemble."],
        ["Faire une chasse photo dans la ville", "Partir avec une petite liste de choses à photographier dans la ville."],
        ["Aller s’acheter chacun un livre à moins de 10 €", "Choisir chacun un livre à moins de 10 €, puis prendre un moment pour en parler."],
        ["Préparer ensemble une recette avec trois ingrédients imposés", "Inventer un plat à deux à partir de trois ingrédients imposés."],
        ["Fabriquer un objet ou une décoration pour la maison", "Créer ensemble un petit objet ou une décoration pour la maison."]
      ].map(([title, description]) => ({ title, description, subtype: "Action", visual: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=500&q=80" }))
    ]
  },
  {
    id: "cocooning", name: "Apéro & cocooning", icon: "☕", color: "#c67b52",
    art: "linear-gradient(145deg, #d99a62, #8a4e3b)",
    cards: [
      { title: "Popcorn", description: "Un grand bol au milieu, un film choisi ensemble et le canapé pour nous.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=500&q=80" },
      { title: "Apéro dinatoire", description: "Installer plusieurs petites choses à grignoter et prendre son temps.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" },
      { title: "Croque-monsieur", description: "Préparer quelque chose de chaud et croustillant à manger avec les doigts.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=500&q=80" },
      { title: "Cake", description: "Faire un cake ensemble, même imparfait, puis le goûter encore tiède.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80" },
      { title: "Feuillette", description: "Choisir ou préparer une douceur feuilletée à partager.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=80" },
      { title: "Crêpes", description: "Une pâte, des garnitures et chacun compose la prochaine crêpe.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=500&q=80" },
      { title: "Pizza", description: "Choisir une pizza à partager et manger directement dans la boîte.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=500&q=80" },
      { title: "BK", description: "Le plaisir régressif assumé, avec la commande que l’on connaît déjà par cœur.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1619881590738-a111d176d906?auto=format&fit=crop&w=500&q=80" },
      ...["KFC", "Kebab/Tacos", "Sushi"].map((title) => ({ title, description: "Une commande à choisir et partager à deux.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1552566626-52f8b828?auto=format&fit=crop&w=500&q=80" })),
      { title: "McDonald’s", description: "Le plaisir régressif assumé, avec la commande que l’on connaît déjà par cœur.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1619881590738-a111d176d906?auto=format&fit=crop&w=500&q=80" },
      { title: "Plaid et chocolat", description: "Éteindre les grandes lumières, sortir le plaid et prendre du chocolat.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=500&q=80" },
      ...[
        ["Petites pizzas trois fromages", "Préparer de petites pizzas trois fromages et les partager à la sortie du four."],
        ["Petits feuilletés + crudités", "Installer quelques petits feuilletés, des crudités et une sauce à partager."],
        ["Gougères + jus de pomme pétillant", "Préparer ou réchauffer des gougères et servir un jus de pomme pétillant."],
        ["Mini-quiches + salade rapide", "Préparer des mini-quiches accompagnées d’une salade simple et rapide."],
        ["Plateau Thiriet · moins de 20 €", "Composer un plateau apéro Thiriet à moins de 20 € et le déguster ensemble."],
        ["Nachos and Dip", "Préparer des nachos avec une ou plusieurs sauces à tremper et choisir la musique du canapé."]
      ].map(([title, description]) => ({ title, description, subtype: title === "Nachos and Dip" ? "Canapé" : "Apéro", visual: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" }))
    ]
  },
  {
    id: "sexualite", name: "Sexualité", icon: "♥", color: "#d88a27",
    art: "linear-gradient(145deg, #85506c, #42263b)",
    cards: [
      ...["Fellation", "Cunni"].map((title) => ({ title, description: "Une idée intime, seulement avec accord clair et retrait possible à tout moment.", subtype: "Simple", art: "linear-gradient(145deg, #f4d35e, #e9a23b)" })),
      ...["Faciale Ahegao", "Session Fessée", "Lovense", "Poste une nude en ligne", "Biffle", "Sitting face"].map((title) => ({ title, description: "Une proposition à discuter ensemble avant de commencer, avec retrait possible à tout moment.", subtype: "Fun", art: "linear-gradient(145deg, #f29e4c, #d1495b)" })),
      ...[
        ["Gorge profonde", "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible."],
        ["Anal Time", "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible."],
        ["Webcam Pussy", "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible."],
        ["Violent roleplay", "Jeu de rôle intense uniquement avec accord préalable, limites définies et mot d’arrêt."],
        ["Golden Shower sur A", "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible."],
        ["Golden Shower sur C", "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible."],
        ["Avale le sperme de C", "Uniquement avec accord explicite, limites discutées et possibilité d’arrêter à tout moment."],
        ["Porter un plug anal pendant toute la session", "Uniquement avec accord explicite, confort vérifié et possibilité d’arrêter à tout moment."],
        ["Pegging A", "Pratique à discuter précisément ensemble, avec accord explicite, limites et mot d’arrêt."],
        ["Pegging C", "Pratique à discuter précisément ensemble, avec accord explicite, limites et mot d’arrêt."],
        ["Double stimulation avec deux jouets A", "Uniquement avec accord explicite, progression douce, limites définies et arrêt immédiat possible."],
        ["Session de domination complète (insultes, gifles, crachat, humiliation) · abricot", "Uniquement avec accord explicite préalable, limites définies et « abricot » comme mot d’arrêt."]
      ].map(([title, description]) => ({ title, description, subtype: "Hardcore", art: "linear-gradient(145deg, #d1495b, #7b2342)" })),
      ...[
        ["Sabre Laser", "La lueur du sabre comme seule source lumineuse : corps dans la fumée, ombres bleues et rouges, ambiance sci-fi torride."],
        ["L’étudiante", "Costume schoolgirl, jupe plissée et posture complice autour d’un bureau."],
        ["Faciale", "Gros plan artistique sur le visage, le regard caméra et les cheveux mouillés."],
        ["Cosplay nonne", "Voile et lingerie noire, clair-obscur à la bougie, contraste sacré-profane."],
        ["Berlin", "Nuit pluvieuse en ville, manteau ouvert sur la lingerie, réverbères et fumée."],
        ["Chemise d’homme", "Une chemise à peine boutonnée, assise au bord du lit, lumière du matin."],
        ["Miroir", "Corps en reflet, regard dans le miroir, buée et traces de doigts sur le verre."],
        ["Cuisine", "Tablier, farine sur la peau et lumière douce sur le plan de travail."],
        ["Douche vapeur", "Chemise blanche mouillée, carrelage et buée sur l’objectif."],
        ["Matin", "Draps froissés, déclencheur à distance et lumière naturelle."],
        ["Après-sport", "Sueur, main dans les cheveux et tee-shirt trempé devant le miroir."],
        ["Sur les rochers", "Drapé au vent sur les rochers battus par les embruns, à la golden hour."],
        ["Sous la pluie", "Robe mouillée, rires et baisers sous l’averse, éclairage urbain."],
        ["Capot de voiture", "Nuit, phares en contre-jour, cuir, chrome et reflets sur la carrosserie."],
        ["Golden hour en silhouette", "Contre-jour au coucher du soleil, silhouettes entrelacées à la limite du montrable."],
        ["Néons underground", "Parking souterrain, enseignes colorées, cuir et poses contre les piliers."]
      ].map(([title, description]) => ({ title, description, subtype: "Fujifilm", art: "linear-gradient(145deg, #f4d35e, #e76f51)" }))
      , ...[
        "Eden Ivy", "First Bang - OnlyFans", "Tushy - Scène 1", "Tushy - Scène 2", "Tushy - Scène 3", "Tushy - Scène 4", "Tushy - 2025-11-16", "Tushy - 2026-06-21", "Ma Première Double Pénétration",
        "Freeze - Prison Bitch - Veronica Leal", "Freeze - Becoming Superhuman - Little Puck", "Freeze - Squatters Revenge - Clemence Audiard", "Freeze - The Hustle - Fanta Sie", "Freeze - Witchs Gift - Clea Gaultier", "Freeze - Dont Waste Time - Chanel Camryn", "Freeze - Spoiled Brat - Bunny Brownie Sarah Heizel", "Freeze - Ghost Hunter - Tiffany Tatum", "Freeze - Stressed - Matty Mila Perez", "Freeze - LinkedIn Profile - Tiffany Tatum", "Freeze - Domestic Dynamics - Melody Marks", "Freeze - Corrupted Priest - Chloe Temple", "Freeze - Breast Pump - Veronica Leal", "Freeze - Ouija - Norah Juliette", "Freeze - Soho Spiral - Bella Spark", "Freeze - The Lab Rat - Barbie Brill",
        "Je m’éclate comme une pornstar", "Les fantasmes de Lexi", "Nata Ocean, ma femme sexy", "Les fantasmes d’Alice Martin", "Megan Fiore, ma petite amie sexy", "Last splash", "Epouses Indecentes", "Room 212 - Part 1", "Room 212 - Part 2", "Room 212 - Part 3", "Room 212 - Part 4", "Room 212 - Part 5", "Boldness - Part 1", "Boldness - Part 2", "Boldness - Part 3", "Boldness - Part 4", "Boldness - Part 5", "Ines - Part 1", "Ines - Part 2", "Ines - Part 3", "Ines - Part 4", "Ines - Part 5", "La ferme - Partie 1", "La ferme - Partie 2", "La ferme - Partie 3", "La ferme - Partie 4", "La ferme - Partie 5", "La ferme - Partie 6"
      ].map((title) => ({ title, description: "Un film adulte de votre bibliothèque, à choisir ensemble.", subtype: "Adulte", art: "linear-gradient(145deg, #c96b3d, #7b2342)" }))
    ]
  }
];

window.ONDE_CATEGORIES = categories;
