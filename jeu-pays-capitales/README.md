# Jeu électrique Pays ↔ Capitales

Panneau de 20 pays et 20 capitales. Deux sondes reliées à une pile et une LED (+ buzzer) :
la LED s'allume quand les sondes touchent un pays et **sa** capitale.

## Fichiers

| Fichier | Contenu |
|---|---|
| `gabarit.html` | Outil à ouvrir dans un navigateur : choix du thème, nouvelle grille d'étiquettes, impression |
| `gabarits-A3.pdf` | Gabarit de perçage face avant + plan de câblage face arrière, échelle 1:1, format A3 |
| `cablage-etiquettes-A4.pdf` | Tableau de câblage, schéma électrique, tests, étiquettes de la grille « Monde » n° 0 |

Le format A3 s'imprime en reprographie (environ 1 € la page). Imprimer à **100 %** (pas « ajuster à la page ») et
vérifier que la barre de contrôle en bas mesure 100 mm. Sans imprimante A3 : les cotes suffisent pour tracer à la règle
(voir « Cotes »).

## Le principe électrique

Chaque fil relie une douille pays à une douille capitale et à rien d'autre : 20 circuits isolés.
Les deux sondes forment un interrupteur ; le panneau ferme le circuit uniquement si les deux sondes touchent
les deux bouts du même fil.

```
(+) pile ── sonde A ──[ panneau ]── sonde B ──┬── 150 Ω ── LED ──┬── (−) pile
                                              └──── buzzer ──────┘
```

Conséquences :
- Pas d'interrupteur nécessaire : sans contact, le circuit est ouvert et la pile ne se vide pas.
- La résistance de 150 Ω est **obligatoire** avec une LED : sans elle, la LED grille au premier contact.
- Sondes l'une contre l'autre : la LED s'allume. C'est normal et sans danger (le courant est limité à ~20 mA par la résistance, ~25 mA pour le buzzer).
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
| 1 | LED rouge 5 mm + clip de fixation | Une LED verte ou blanche marche aussi, mettre alors 100 Ω | 1 € |
| 1 | Résistance 150 Ω, 1/4 W | | 0,10 € |
| 1 | Buzzer **actif** 3–5 V (ou 3–24 V) | Optionnel ; « actif » = il sonne seul sous tension. Un buzzer passif reste muet | 1 € |
| 10 m | Fil de câblage souple 0,5 mm² (2 couleurs si possible) | Environ 20 × 35 cm + marge | 4 € |
| — | Colle en bâton, pâte adhésive (Patafix), domino ou bornier 2 plots ×2 | Les dominos évitent de souder | 2 € |

Total : environ 40 €. Outils : perceuse + forets 3, 5, 6 mm (et 8 mm selon les douilles), clé ou pince pour les écrous,
pince à dénuder, scie. Fer à souder optionnel.

Variante économique (~10 €) : 40 attaches parisiennes en laiton à la place des douilles, deux pointes de touche de
multimètre comme sondes. Contact moins fiable et moins durable ; le reste du montage est identique.

## Cotes (si pas d'impression A3)

Panneau 297 × 420 mm, origine en haut à gauche, vue de face.

- Douilles pays P1…P20 : x = 28 mm ; douilles capitales C1…C20 : x = 269 mm.
- Rangées : y = 76 mm pour la n° 1, puis tous les 16,5 mm (n° 20 à y = 389,5 mm).
- Étiquettes 63 × 14 mm : zone pays de x = 38 à 101 mm, zone capitales de x = 196 à 259 mm.
- Sorties de sonde : (60 ; 42) et (237 ; 42), Ø 6 mm. LED : (133 ; 42), Ø 5 mm. Trou du buzzer : (164 ; 42), Ø 3 mm.

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
6. **Circuit de la lampe** (dans le cadre, à l'arrière) :
   - fil + du boîtier de piles → sonde A ;
   - sonde B → résistance 150 Ω → patte **longue** de la LED ; patte courte → fil − du boîtier ;
   - buzzer : son + relié à la sonde B (avant la résistance), son − au fil − du boîtier.
   Faire un nœud dans chaque cordon juste derrière le trou de sortie : un enfant qui tire sur la sonde tire sur le nœud, pas sur les connexions.
7. **Tester** avec la liste de la page 1 du PDF A4 (sondes ensemble, 20 bonnes paires, voisins, mauvaises paires).
8. **Fermer** : visser le cadre puis le fond. Coller les étiquettes de la grille n° 0 dans les cases correspondantes (code P…/C… en coin d'étiquette).

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Rien ne s'allume, même sondes l'une contre l'autre | LED à l'envers, pile à plat, résistance mal connectée |
| Sondes OK, mais une bonne paire ne marche pas | Fil desserré ou coupé sur cette paire, douille mal serrée |
| Une mauvaise paire allume | Deux fils ou deux douilles se touchent : chercher entre les douilles concernées, souvent un brin qui dépasse |
| Buzzer muet, LED OK | Buzzer passif au lieu d'actif, ou buzzer branché à l'envers |
| LED très faible | Résistance trop forte (vérifier les anneaux : marron-vert-marron = 150 Ω) ou piles usées |

## Nouvelles grilles et thèmes

Ouvrir `gabarit.html` dans un navigateur (Chrome, Firefox, Edge), choisir un thème, cliquer « Nouvelle grille »,
puis « Imprimer câblage + étiquettes (A4) » et n'imprimer que la page 2. Le numéro de grille est dans l'adresse
(`#theme=europe&grille=4821`) : garder l'adresse permet de réimprimer la même grille.

Pour ajouter un thème (drapeaux, animaux/continents, mots anglais/français), ajouter une entrée dans `THEMES` dans
`gabarit.html`, avec au moins 20 paires. Ne jamais modifier `WIRING` : il décrit les fils déjà soudés.
