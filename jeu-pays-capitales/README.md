# Circuit Capital (دائرة العواصم)

Jeu électrique pays ↔ capitales.

Panneau de 20 pays et 20 capitales. L'enfant branche une sonde sur un pays, l'autre sur une capitale, puis appuie
sur le bouton **VALIDER** : LED verte + buzzer si la capitale est la bonne, LED rouge sinon.

## Fichiers

| Fichier | Contenu |
|---|---|
| `gabarit.html` | Outil à ouvrir dans un navigateur : choix du thème, nouvelle grille d'étiquettes, impression |
| `gabarits-A3.pdf` | Gabarit de perçage face avant (version 9 V : tiges, lampes, interrupteur, sorties A/B, zones d'étiquettes) + plan de câblage face arrière avec les 4 pieds, échelle 1:1, format A3 |
| `cablage-etiquettes-A4.pdf` | Tableau de câblage, schéma 9 V, tests, plan de pose et étiquettes de la grille « Monde » n° 0 |
| `etiquettes-FR.pdf` | **Étiquettes à imprimer** à 100 % : plan de pose + titre 180 × 16 mm, en-têtes 63 × 8 mm, 40 noms 63 × 14 mm (style néon) |
| `etiquettes-AR.pdf` | Étiquettes arabes, style « cyberpunk en panneaux » : pays sur 2 pages, capitales sur 2 pages. Les étiquettes sont en colonne, au pas réel de 16,5 mm, dans un cadre : on découpe le cadre et on pose le panneau d'un bloc, chaque tige passant dans son anneau (disque central Ø 11 à retirer). Les deux moitiés se raccordent bord à bord entre les rangées 10 et 11 |
| `notice-montage.html` / `notice-montage.pdf` | **Notice de montage illustrée** de la version 9 V, de la planche nue aux tests (13 pages) |
| `notice-montage-ar.html` / `notice-montage-ar.pdf` | Même notice **en arabe** (mise en page de droite à gauche, image de couverture `rendu/rendu-cyberpunk-ar.png`) |
| `plan-cote.html` / `plan-cote.pdf` | **Plan coté** façon architecte (A3 paysage) : vue de face 1:2, coupe A-A, détail d'une tige 1:1, vue de dos 1:5, cartouche |
| `schema-9V-ar.html` / `schema-9V-ar.pdf` | Même schéma **en arabe** (plan aux positions des étiquettes arabes en panneaux) |
| `schema-9V.html` / `schema-9V.pdf` | **Version simple** : pile 9 V, interrupteur, 3 lampes en série, 40 tiges, planche 30 × 40 cm |

Le format A3 s'imprime en reprographie (environ 1 € la page). Imprimer à **100 %** (pas « ajuster à la page ») et
vérifier que la barre de contrôle en bas mesure 100 mm. Sans imprimante A3 : les cotes suffisent pour tracer à la règle
(voir « Cotes »).

## Version simple : pile 9 V, interrupteur, 3 lampes en série

Variante sans transistor ni LED rouge, décrite dans `schema-9V.pdf` (schéma, plan de la planche 30 × 40 cm, matériel,
tableau de câblage). Une seule boucle : + pile → interrupteur → L1 → L2 → L3 → câble B → tige capitale → fil →
tige pays → câble A → − pile. Points clés :
- 3 ampoules **identiques** de 3,5 V (culot E10) : en série, chacune reçoit ≈ 3 V sur les 9 V.
- Une ampoule dévissée ou grillée éteint les trois.
- Les tiges sont des vis M4 × 35 passées depuis l'arrière ; les câbles se terminent par des pinces crocodile.
- La planche repose sur 4 pieds 20 × 20 × 30 mm collés dans les coins : des tasseaux le long des bords passeraient sous la colonne des pays et sous les deux dernières rangées.
- Étiquettes : `etiquettes-FR.pdf` ou `etiquettes-AR.pdf`, à poser selon le plan de pose (page 1). Le titre occupe le haut (y = 5 à 21 mm), la ligne des lampes y = 38 mm, les en-têtes y = 58 à 66 mm, les noms à partir de y = 69 mm.
- Mêmes positions de tiges et même câblage (`WIRING`) que les gabarits A3 : les étiquettes de `gabarit.html` restent utilisables.

Le reste de ce document décrit la version avec LED verte, LED rouge et bouton VALIDER. Pour cette variante, les trous du haut sont aux cotes de la section « Cotes » (le gabarit A3 montre ceux de la version 9 V), et son schéma est le bloc ci-dessous.

## Le principe électrique

Chaque fil relie une douille pays à une douille capitale et à rien d'autre : 20 circuits isolés.
Les deux sondes forment un interrupteur ; le panneau ferme le circuit uniquement si les deux sondes touchent
les deux bouts du même fil.

```
(+) pile ── bouton VALIDER ──┬── sonde A ──[ panneau ]── sonde B ──(B)──┬── R1 150 Ω ── LED verte ──┐
                             │                                         ├── buzzer ─────────────────┤
                             │                                         └── R3 4,7 kΩ ── base Q1    │
                             └── R2 150 Ω ──(K)──┬── LED rouge ────────────────────────────────────┤
                                                 └── collecteur Q1 ; émetteur Q1 ──────────────────┴── (−) pile
                                                     (R4 100 kΩ entre base Q1 et (−))
```

**Pourquoi un bouton est nécessaire pour la lampe rouge.** Pour le circuit, une mauvaise paire et des sondes posées
nulle part sont identiques : dans les deux cas, le circuit est ouvert. Une lampe « incorrect » branchée sans bouton
serait donc allumée en permanence, y compris quand personne ne joue, et viderait les piles. Le bouton règle les deux
problèmes : le montage n'est alimenté que pendant l'appui, et l'appui signifie « je donne ma réponse ».
Les fiches banane tiennent seules dans les douilles : l'enfant a les mains libres pour appuyer.

**Comment la rouge s'éteint sur une bonne réponse.** Le transistor Q1 est un interrupteur commandé :
- bonne paire : le point B reçoit le + ; un petit courant passe dans R3 vers la base de Q1, qui conduit et court-circuite
  la LED rouge (le point K tombe à ~0,1 V) ; la LED verte et le buzzer sont alimentés ;
- mauvaise paire : B n'est relié à rien, R4 tire la base à 0 V, Q1 est bloqué, la LED rouge s'allume par R2.

Conséquences :
- Sans appui sur le bouton, rien ne consomme : pas d'interrupteur marche/arrêt nécessaire.
- Les résistances de 150 Ω sont **obligatoires** : sans elles, les LED grillent au premier essai.
- Sondes l'une contre l'autre : vert, comme une bonne paire. C'est normal et sans danger (~70 mA au total pendant l'appui).
- 4,5 V ne présente aucun danger pour un enfant. Ne jamais brancher ce montage sur un transformateur ou sur le secteur.

## Deux défauts du projet initial, corrigés ici

1. **Câblage en face à face.** Si le pays n° 3 est relié à la capitale n° 3, l'enfant trouve la règle en deux essais.
   Le câblage fourni est mélangé (P1 → C17, P2 → C11, …), sans paire sur la même ligne ni sur une ligne voisine.
2. **Mémorisation des positions.** Après quelques parties, l'enfant retient que « Paris est en bas à droite » au lieu
   d'apprendre la capitale. Solution : les noms sont sur des **étiquettes amovibles** (pâte adhésive), pas imprimés sur le panneau.
   Le câblage reste fixe ; l'outil `gabarit.html` génère d'autres répartitions des 20 paires sur les mêmes douilles,
   et d'autres thèmes (Europe, Afrique, Amériques-Asie-Océanie). Changer de grille = réimprimer une page A4, recoller 40 étiquettes.

Limite qui demeure : un enfant peut tout trouver par essais successifs (20 essais maximum par pays).
Règle de jeu qui compense : il annonce la capitale **à voix haute avant** de poser la sonde ; seule une réponse annoncée puis confirmée par la LED rapporte un point.

## Matériel

Prix indicatifs (boutiques d'électronique en ligne, Amazon, Leroy Merlin) ; ils varient selon la source.

| Qté | Élément | Remarque | Prix ~ |
|---|---|---|---|
| 1 | Panneau contreplaqué ou MDF 5 mm, 297 × 420 mm | Épaisseur ≤ 6 mm : le filetage des douilles doit dépasser à l'arrière | 5 € |
| 4 | Tasseaux 20 × 20 mm (2 × 297 mm, 2 × 380 mm) | Cadre qui donne la profondeur pour les fils | 4 € |
| 1 | Fond en contreplaqué 3 mm, 297 × 420 mm | Fermé par 4 vis, pour cacher les fils et accéder aux piles | 3 € |
| 40 | Douilles banane 4 mm à visser (châssis) | Vérifier le Ø de perçage sur la fiche produit (souvent 6 mm, parfois 8 mm) | 10–15 € |
| 2 | Cordons de test banane 4 mm, 1 m | On coupe une extrémité de chacun ; l'autre fiche sert de sonde | 5 € |
| 1 | Boîtier 3 piles AA avec fils + 3 piles AA | 4,5 V ; plus pratique qu'une pile plate 4,5 V à lamelles | 3 € |
| 1 | LED verte 5 mm + clip de fixation | Bonne réponse | 0,50 € |
| 1 | LED rouge 5 mm + clip de fixation | Mauvaise réponse | 0,50 € |
| 2 | Résistances 150 Ω, 1/4 W (R1, R2) | Anneaux marron-vert-marron | 0,20 € |
| 1 | Résistance 4,7 kΩ, 1/4 W (R3) | Anneaux jaune-violet-rouge | 0,10 € |
| 1 | Résistance 100 kΩ, 1/4 W (R4) | Anneaux marron-noir-jaune | 0,10 € |
| 1 | Transistor NPN **BC547** (Q1) | Un BC548, BC337 ou 2N3904 convient aussi, mais l'ordre des pattes peut différer | 0,20 € |
| 1 | Bouton poussoir à contact momentané (« NO », normalement ouvert), à visser | Le diamètre de perçage est sur la fiche produit (souvent 7, 12 ou 16 mm) | 1–3 € |
| 1 | Mini plaque d'essai (breadboard 170 points) + fils de liaison | Pour monter Q1 et les résistances sans soudure | 3 € |
| 1 | Buzzer **actif** 3–5 V (ou 3–24 V) | Optionnel ; « actif » = il sonne seul sous tension. Un buzzer passif reste muet | 1 € |
| 10 m | Fil de câblage souple 0,5 mm² (2 couleurs si possible) | Environ 20 × 35 cm + marge | 4 € |
| — | Colle en bâton, pâte adhésive (Patafix), domino ou bornier 2 plots ×2 | Les dominos évitent de souder | 2 € |

Total : environ 45 €. Outils : perceuse + forets 3, 5, 6 mm (et 8 mm selon les douilles), clé ou pince pour les écrous,
pince à dénuder, scie. Fer à souder optionnel.

Variante économique (~10 €) : 40 attaches parisiennes en laiton à la place des douilles, deux pointes de touche de
multimètre comme sondes. Contact moins fiable et moins durable ; le reste du montage est identique.

## Cotes (si pas d'impression A3)

Panneau 297 × 420 mm, origine en haut à gauche, vue de face.

- Douilles pays P1…P20 : x = 28 mm ; douilles capitales C1…C20 : x = 269 mm.
- Rangées : y = 76 mm pour la n° 1, puis tous les 16,5 mm (n° 20 à y = 389,5 mm).
- Étiquettes 63 × 14 mm : zone pays de x = 38 à 101 mm, zone capitales de x = 196 à 259 mm.
- Sorties de sonde : (60 ; 42) et (237 ; 42), Ø 6 mm. LED verte : (106 ; 42) et LED rouge : (132 ; 42), Ø 5 mm.
  Trou du buzzer : (156 ; 42), Ø 3 mm. Bouton VALIDER : (190 ; 42), au diamètre du bouton.

## Étapes

1. **Imprimer** `gabarits-A3.pdf` à 100 %. Contrôler la barre de 100 mm.
2. **Coller** la page 1 (face avant) sur le panneau. Pointer chaque croix au clou, percer d'abord à 3 mm, puis au diamètre final.
   Percer en appuyant le panneau sur une chute de bois pour ne pas faire éclater l'arrière.
3. **Monter les 40 douilles**, écrou serré à l'arrière. Vérifier qu'aucune cosse ou écrou ne touche son voisin.
4. **Coller** la page 2 (face arrière, vue miroir) au dos du panneau, en perçant le papier aux douilles : chaque douille
   y porte son code et sa destination (`P1 → C17`, `C17 ← P1`).
5. **Câbler les 20 fils** un par un en suivant le tableau de câblage (`cablage-etiquettes-A4.pdf`, page 1).
   Dénuder 1 cm, enrouler le cuivre dans le sens de serrage sous l'écrou ou la cosse, serrer, couper les brins qui dépassent.
   Cocher la case du fil dans le tableau.
6. **Circuit des lampes** (dans le cadre, à l'arrière), en suivant le schéma de la section « Le principe électrique » :
   - fil + du boîtier de piles → une patte du bouton ; l'autre patte du bouton → sonde A **et** R2 (fil en Y) ;
   - sonde B → point B sur la plaque d'essai ; de B partent R1, le + du buzzer et R3 ;
   - R1 → patte **longue** de la LED verte ; patte courte → ligne − ;
   - R2 → point K ; de K partent la patte longue de la LED rouge et le collecteur de Q1 ; patte courte de la LED rouge → ligne − ;
   - R3 → base de Q1 ; R4 entre la base de Q1 et la ligne − ; émetteur de Q1 → ligne − ; − du buzzer → ligne − ;
   - ligne − de la plaque → fil − du boîtier de piles.

   **Pattes du BC547** : face plate vers toi, pattes vers le bas, de gauche à droite : collecteur, base, émetteur (C-B-E).
   Vérifier sur la fiche du transistor acheté : un 2N2222 ou un 2N3904 n'a pas forcément le même ordre.
   Faire un nœud dans chaque cordon juste derrière le trou de sortie : un enfant qui tire sur la sonde tire sur le nœud, pas sur les connexions.
7. **Tester** avec la liste de la page 1 du PDF A4 (sans bouton, sondes en l'air, sondes ensemble, 20 bonnes paires, voisins, mauvaises paires).
8. **Fermer** : visser le cadre puis le fond. Coller les étiquettes de la grille n° 0 dans les cases correspondantes (code P…/C… en coin d'étiquette).

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Rien ne s'allume, même bouton appuyé | Piles à plat ou à l'envers, bouton mal branché, ligne − non reliée |
| Rouge OK sondes en l'air, mais rien sondes l'une contre l'autre | LED verte à l'envers, R1 mal connectée |
| Vert OK, mais la rouge reste allumée aussi | Q1 ne conduit pas : pattes inversées, R3 absente ou de mauvaise valeur |
| Rouge jamais allumée | LED rouge à l'envers, ou Q1 grillé / pattes C et E en court-circuit |
| Une bonne paire donne rouge | Fil desserré ou coupé sur cette paire, douille mal serrée |
| Une mauvaise paire donne vert | Deux fils ou deux douilles se touchent : chercher entre les douilles concernées, souvent un brin qui dépasse |
| Buzzer muet, LED verte OK | Buzzer passif au lieu d'actif, ou buzzer branché à l'envers |
| LED très faible | Mauvaise résistance (vérifier les anneaux) ou piles usées |

## Nouvelles grilles et thèmes

Ouvrir `gabarit.html` dans un navigateur (Chrome, Firefox, Edge), choisir un thème, cliquer « Nouvelle grille »,
puis « Imprimer câblage + étiquettes (A4) » et n'imprimer que la page 2. Le numéro de grille est dans l'adresse
(`#theme=europe&grille=4821`) : garder l'adresse permet de réimprimer la même grille.

Pour ajouter un thème (drapeaux, animaux/continents, mots anglais/français), ajouter une entrée dans `THEMES` dans
`gabarit.html`, avec au moins 20 paires. Ne jamais modifier `WIRING` : il décrit les fils déjà soudés.
