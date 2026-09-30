# CV ATS PRO (MVP)

Application web statique : ouvrir `index.html` dans un navigateur (aucun serveur, aucune dépendance).

- `data.js` : lexique de mots-clés, règles par pays, modèles, données de démonstration
- `ai.js` : couche `AI.generate(task, payload)` (local par défaut, backend personnalisé en option)
- `ats-engine.js` : analyse d'offre, score ATS, matching, import TXT/DOCX/PDF
- `cv-generator.js` : rendu du CV, adaptation à l'offre, lettre, export PDF/DOCX/impression
- `interview.js` : fiche d'entretien, STAR, points de vigilance
- `app.js` : interface, routage, stockage localStorage

Le score ATS est une estimation interne, pas le calcul d'un ATS réel.
