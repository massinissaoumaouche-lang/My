/* CV ATS PRO — interview.js
 * Fiche de préparation à l'entretien : pitch, questions, réponses ancrées dans le CV, méthode STAR,
 * points de vigilance. Aucune expérience ni aucun chiffre n'est inventé : les données absentes
 * apparaissent sous forme de marqueurs « [Information manquante — … ] » à compléter. */
window.CVATS = window.CVATS || {};
(function (C) {
  'use strict';
  const { U, Data } = C;
  const E = () => C.Engine;
  const PH = (w) => C.Gen.PH(w);
  const trimEnd = (s) => String(s || '').trim().replace(/[.;:]\s*$/, '');
  const list = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1] : a[0] || '');

  /* ----- STAR : structure construite uniquement à partir de faits saisis ----- */
  function metricClause(b) {
    const parts = String(b || '').split(/[,;]|\s[—–-]\s/);
    return (parts.find((p) => U.hasMetric(p)) || '').trim();
  }

  function generateSTARAnswer(question, exp, bullet) {
    const missing = [];
    if (!exp) return { s: PH('décrivez la situation'), t: PH('décrivez votre mission'), a: PH('décrivez vos actions'), r: PH('décrivez le résultat obtenu'), missing: ['situation', 'tâche', 'action', 'résultat'] };
    const s = 'Chez ' + (exp.company || PH('entreprise')) + ', en tant que ' + (exp.title || PH('poste')) + (U.period(exp) ? ' (' + U.period(exp) + ')' : '') + '.' +
      (exp.description ? ' Contexte : ' + trimEnd(exp.description) + '.' : '');
    let t = exp.description ? 'Ma mission : ' + trimEnd(exp.description) + '.' : PH('précisez l\'objectif ou le problème à résoudre dans cette situation');
    if (!exp.description) missing.push('tâche');
    let a = bullet ? trimEnd(bullet) + '.' : PH('décrivez précisément ce que vous avez fait, étape par étape');
    if (!bullet) missing.push('action');
    const mc = bullet ? metricClause(bullet) : '';
    let r;
    if (mc) r = U.cap(mc) + '.';
    else { r = PH('ajoutez le résultat obtenu (chiffre réel, délai, retour client…)'); missing.push('résultat'); }
    return { s, t, a, r, missing, question };
  }

  /* ----- Points de vigilance ----- */
  function vigilancePoints(cv, offer, match) {
    const pts = [];
    const exps = (cv.experiences || []).filter((e) => e.start).slice().sort((a, b) => (U.toIdx(a.start) || 0) - (U.toIdx(b.start) || 0));
    // période sans emploi
    for (let i = 1; i < exps.length; i++) {
      const prevEnd = exps[i - 1].current || !exps[i - 1].end ? U.toIdx(U.today()) : U.toIdx(exps[i - 1].end);
      const gap = U.toIdx(exps[i].start) - prevEnd - 1;
      if (gap > 3) {
        pts.push({ type: 'gap', label: 'Période sans emploi', detail: gap + ' mois entre ' + U.fmtMonth(exps[i - 1].end) + ' et ' + U.fmtMonth(exps[i].start) + '.',
          answer: 'Présentez les faits sans justification excessive : ce que vous avez fait réellement pendant cette période (formation, projet, mission ponctuelle, raisons personnelles si vous le souhaitez), puis ce que vous en avez retiré. ' + PH('décrivez cette période telle qu\'elle s\'est réellement passée') });
      }
    }
    // changements fréquents
    if (exps.length >= 3) {
      const avg = exps.reduce((s, e) => s + U.expMonths(e), 0) / exps.length;
      if (avg < 18) pts.push({ type: 'hopping', label: 'Changements fréquents d\'entreprise', detail: 'Durée moyenne par poste : ' + Math.round(avg) + ' mois.',
        answer: 'Expliquez le fil conducteur de votre parcours (progression, spécialisation, fin de contrat, opportunité précise), puis insistez sur ce que vous voulez construire dans la durée. ' + PH('indiquez vos raisons réelles pour chaque changement') });
    }
    if (offer) {
      const f = E().buildFeatures(cv);
      const years = U.expYears(cv.experiences);
      if (offer.minYears && years < offer.minYears) {
        pts.push({ type: 'experience', label: 'Manque d\'expérience', detail: 'L\'offre demande ' + offer.minYears + ' an(s) ; votre CV en totalise ' + years + '.',
          answer: 'Reconnaissez l\'écart sans vous excuser, puis montrez la densité de votre expérience : projets comparables, responsabilités, rythme d\'apprentissage. Appuyez-vous sur des réalisations réelles du CV, sans gonfler la durée.' });
      }
      const cvSectors = f.keywords.filter((k) => k.cat === 'secteur').map((k) => k.term);
      if (offer.sectors.length && cvSectors.length && !offer.sectors.some((s) => cvSectors.includes(s))) {
        pts.push({ type: 'sector', label: 'Changement de secteur', detail: 'Offre : ' + list(offer.sectors) + ' ; votre CV : ' + list(cvSectors) + '.',
          answer: 'Montrez que vos compétences sont transférables avec des exemples réels, et indiquez ce que vous avez déjà fait pour comprendre le nouveau secteur (veille, échanges, formation). ' + PH('citez une démarche réelle pour découvrir ce secteur') });
      }
      if (match) {
        match.missing.filter((k) => k.cat !== 'soft').slice(0, 3).forEach((k) => {
          const v = match.verify.find((x) => x.term === k.term);
          pts.push({ type: 'skill', label: 'Compétence demandée mais absente : ' + k.term, detail: v ? 'Vous pratiquez peut-être un équivalent (' + v.related.join(', ') + ').' : 'Elle n\'apparaît pas dans votre CV.',
            answer: v ? 'Dites honnêtement que vous n\'avez pas pratiqué ' + k.term + ' en contexte professionnel (si c\'est le cas), puis montrez l\'outil ou la méthode voisine que vous maîtrisez (' + v.related.join(', ') + ') et votre capacité à monter en compétence rapidement, avec un exemple réel d\'apprentissage.' :
              'Dites clairement que ce point n\'est pas encore couvert (si c\'est le cas), proposez un plan d\'apprentissage concret et appuyez-vous sur une situation passée où vous avez appris un nouvel outil. ' + PH('décrivez un apprentissage réel comparable') });
        });
      }
      (offer.languages || []).forEach((l) => {
        const mine = (cv.languages || []).find((x) => U.norm(x.name) === U.norm(l.name));
        if (!mine) pts.push({ type: 'language', label: 'Langue demandée absente : ' + l.name, detail: 'Aucun niveau de ' + l.name + ' dans votre CV.', answer: 'Indiquez votre niveau réel et vos projets de progression. Ne surévaluez jamais votre niveau : il peut être testé pendant l\'entretien.' });
        else if (l.rank && E().levelRank(mine.level) < l.rank) pts.push({ type: 'language', label: 'Niveau de ' + l.name + ' à justifier', detail: 'Demandé : ' + (l.level || 'non précisé') + ' ; déclaré : ' + (mine.level || 'non précisé') + '.', answer: 'Annoncez votre niveau réel, illustrez-le par un usage concret (réunions, rédaction, clients) et indiquez comment vous le consolidez.' });
      });
      if (offer.title && years && match && match.titleSim < 0.2) {
        pts.push({ type: 'reconversion', label: 'Reconversion ou intitulé différent', detail: 'Votre intitulé actuel est éloigné de « ' + offer.title + ' ».',
          answer: 'Expliquez la logique de votre évolution, puis reliez 2 ou 3 réalisations réelles aux missions du poste. ' + PH('expliquez votre motivation réelle pour ce changement') });
      }
    }
    return pts;
  }

  /* ----- Pitch de 60 secondes (≈ 150 mots) ----- */
  function buildPitch(cv, offer, match) {
    const p = cv.candidateProfile, name = C.Gen.fullName(cv);
    const years = U.expYears(cv.experiences);
    const f = E().buildFeatures(cv);
    const exp = match && match.relevantExperiences.length ? cv.experiences[match.relevantExperiences[0].index] : cv.experiences[0];
    const terms = (match ? match.matched : f.keywords).filter((k) => k.cat !== 'soft' && k.cat !== 'langue').map((k) => k.term).filter((t, i, a) => a.indexOf(t) === i).slice(0, 4);
    const s = [];
    s.push('Bonjour, je m\'appelle ' + (name || PH('votre nom')) + (p.title ? ' et je suis ' + p.title : '') + (years ? ', avec ' + years + ' an' + (years > 1 ? 's' : '') + ' d\'expérience' : '') + '.');
    if (exp) {
      const bullets = (exp.bullets || []).filter(Boolean);
      const best = bullets.filter(U.hasMetric)[0] || bullets[0];
      const who = (exp.title || PH('poste')) + (exp.company ? ' chez ' + exp.company : '');
      s.push((exp.current ? 'Je travaille actuellement comme ' + who : 'J\'ai notamment été ' + who + (U.period(exp) ? ' (' + U.period(exp) + ')' : '')) + (best ? ' : ' + U.lowerFirst(trimEnd(best)) + '.' : '.'));
    }
    if (terms.length) s.push('Mes points d\'appui sont ' + list(terms) + '.');
    const prev = cv.experiences.find((e) => e !== exp);
    if (prev) s.push('Par ailleurs, j\'ai été ' + (prev.title || PH('poste')) + (prev.company ? ' chez ' + prev.company : '') + '.');
    s.push(offer && offer.title ? 'Je suis ici aujourd\'hui parce que le poste de ' + offer.title + (offer.company ? ' chez ' + offer.company : '') + ' rejoint ce que je sais faire. ' + PH('ajoutez en une phrase votre motivation réelle') : PH('ajoutez en une phrase ce que vous recherchez'));
    const text = s.join(' ');
    const words = U.words(text).length;
    return { text, words, seconds: Math.round(words / 150 * 60) };
  }

  /* ----- Fiche complète ----- */
  function generateInterviewPrep(cv, offer, opts) {
    opts = opts || {};
    const Eng = E();
    const f = Eng.buildFeatures(cv);
    const match = offer ? Eng.calculateMatchScore(f, offer) : null;
    const company = (opts.company || (offer && offer.company) || '').trim();
    const position = (opts.position || (offer && offer.title) || cv.candidateProfile.title || '').trim();
    const offerSet = offer ? new Set(offer.required.concat(offer.nice).map((k) => k.term)) : null;
    const exps = cv.experiences || [];
    const relIdx = match ? match.relevantExperiences.map((r) => r.index) : [];
    const mainExp = exps[relIdx[0] != null ? relIdx[0] : 0];
    const allBullets = [];
    exps.forEach((e, ei) => (e.bullets || []).filter(Boolean).forEach((b) => allBullets.push({ b, e, ei, hit: offerSet ? Eng.extractKeywords(b).filter((k) => offerSet.has(k.term)).length : 0 })));
    const bestMetric = allBullets.filter((x) => U.hasMetric(x.b)).sort((a, b) => b.hit - a.hit)[0];
    const bulletFor = (term) => allBullets.find((x) => Eng.extractKeywords(x.b).some((k) => k.term === term));
    const expRef = (e) => (e ? [(e.title || '') + (e.company ? ' — ' + e.company : '') + (U.period(e) ? ' (' + U.period(e) + ')' : '')] : []);
    const Q = [];
    const add = (o) => Q.push(Object.assign({ id: U.uid('q'), cvElements: [], answer: '', example: '', tip: '', star: null }, o));

    const pitch = buildPitch(cv, offer, match);

    add({ group: 'generic', type: 'generic', question: 'Présentez-vous.', cvElements: expRef(mainExp), answer: pitch.text, example: '', tip: 'Restez sous 60 à 90 secondes : parcours, expérience la plus pertinente, raison de votre présence.' });
    add({ group: 'generic', type: 'generic', question: company ? 'Pourquoi souhaitez-vous rejoindre ' + company + ' ?' : 'Pourquoi souhaitez-vous rejoindre notre entreprise ?',
      cvElements: [], answer: PH('expliquez ce qui vous attire réellement chez ' + (company || 'cette entreprise') + ' (produit, marché, valeurs, projets) — renseignez-vous avant l\'entretien') + (match && match.matched.length ? ' Faites ensuite le lien avec ce que vous maîtrisez déjà : ' + list(match.matched.filter((k) => k.cat !== 'soft' && k.cat !== 'langue').slice(0, 3).map((k) => k.term)) + '.' : ''),
      example: '', tip: 'Citez au moins deux éléments précis et vérifiables sur l\'entreprise ; évitez les généralités.' });
    add({ group: 'generic', type: 'generic', question: position ? 'Pourquoi ce poste de ' + position + ' ?' : 'Pourquoi ce poste ?', cvElements: expRef(mainExp),
      answer: (offer && offer.missions.length ? 'Les missions qui me parlent : ' + offer.missions.slice(0, 2).map((m) => U.lowerFirst(trimEnd(m))).join(' ; ') + '. ' : '') + PH('expliquez pourquoi ces missions correspondent à votre projet professionnel'),
      example: '', tip: 'Reliez le poste à votre trajectoire plutôt qu\'à ce que l\'entreprise peut vous offrir.' });
    add({ group: 'generic', type: 'generic', question: 'Parlez-nous de votre expérience la plus pertinente.', cvElements: expRef(mainExp),
      answer: mainExp ? 'Mon expérience la plus proche du poste est celle de ' + (mainExp.title || PH('poste')) + (mainExp.company ? ' chez ' + mainExp.company : '') + (U.period(mainExp) ? ' (' + U.period(mainExp) + ')' : '') + '. ' + ((mainExp.bullets || []).filter(Boolean).slice(0, 3).map((b) => trimEnd(b)).join(' ; ') || PH('décrivez vos missions')) + '.' : PH('ajoutez une expérience à votre CV'),
      example: '', tip: 'Choisissez l\'expérience qui recoupe le plus les missions de l\'offre et donnez un résultat.' });
    const starOf = (q, bx) => generateSTARAnswer(q, bx ? bx.e : mainExp, bx ? bx.b : null);
    add({ group: 'generic', type: 'behavioral', question: 'Quel est votre principal succès professionnel ?', cvElements: bestMetric ? [trimEnd(bestMetric.b)] : [],
      answer: bestMetric ? 'Mon principal succès : ' + U.lowerFirst(trimEnd(bestMetric.b)) + '.' : PH('citez une réalisation réelle avec son résultat chiffré'), example: '', tip: 'Choisissez un succès mesurable et en rapport avec le poste.', star: starOf('succès', bestMetric) });
    add({ group: 'generic', type: 'behavioral', question: 'Parlez-nous d\'une difficulté professionnelle et de la façon dont vous l\'avez surmontée.', cvElements: expRef(mainExp),
      answer: PH('choisissez une difficulté réelle vécue'), example: '', tip: 'Insistez sur vos actions et sur ce que vous avez appris, pas sur les torts des autres.', star: starOf('difficulté', null) });
    add({ group: 'generic', type: 'behavioral', question: 'Comment gérez-vous les priorités ?', cvElements: expRef(mainExp),
      answer: PH('décrivez votre méthode réelle (outils, critères, arbitrages)') + (allBullets.find((x) => /prioris|planning|delai|budget/.test(U.norm(x.b))) ? ' Exemple tiré de votre CV : ' + trimEnd(allBullets.find((x) => /prioris|planning|delai|budget/.test(U.norm(x.b))).b) + '.' : ''),
      example: '', tip: 'Donnez une méthode concrète, puis une situation réelle où elle a fonctionné.', star: starOf('priorités', allBullets.find((x) => /planning|delai|budget|prioris/.test(U.norm(x.b))) || null) });
    add({ group: 'generic', type: 'behavioral', question: 'Racontez une situation de désaccord avec un collègue, un client ou un manager.', cvElements: [],
      answer: PH('choisissez une situation réelle'), example: '', tip: 'Montrez écoute, factualité et recherche de solution.', star: starOf('désaccord', null) });
    const strong = (match ? match.matched : f.keywords).filter((k) => k.cat !== 'soft' && k.cat !== 'langue').slice(0, 3);
    add({ group: 'generic', type: 'generic', question: 'Quels sont vos points forts ?', cvElements: strong.map((k) => k.term),
      answer: strong.length ? 'Mes points forts, appuyés par mon expérience : ' + strong.map((k) => { const b = bulletFor(k.term); return k.term + (b ? ' (' + U.lowerFirst(trimEnd(b.b)) + ')' : ''); }).join(' ; ') + '.' : PH('listez 2 ou 3 points forts réels et une preuve pour chacun'),
      example: '', tip: 'Un point fort sans exemple reste une affirmation : donnez une preuve pour chacun.' });
    const gap = match ? match.missing.filter((k) => k.cat !== 'soft')[0] : null;
    add({ group: 'generic', type: 'generic', question: 'Quelle compétence devez-vous améliorer ?', cvElements: gap ? [gap.term] : [],
      answer: gap ? 'Un axe de progression réel pour moi est ' + gap.term + ', demandé dans l\'offre et que je n\'ai pas encore pratiqué en contexte professionnel (à confirmer). ' + PH('décrivez ce que vous faites concrètement pour progresser') : PH('choisissez un axe de progression réel, non critique pour le poste, et les actions menées'),
      example: '', tip: 'Choisissez une vraie faiblesse non bloquante et montrez une action en cours. Ne citez pas de « défaut qualité ».' });
    add({ group: 'generic', type: 'generic', question: 'Quelle est votre disponibilité et quelles sont vos attentes ?', cvElements: cv.candidateProfile.availability ? [cv.candidateProfile.availability] : [],
      answer: (cv.candidateProfile.availability ? 'Disponibilité : ' + cv.candidateProfile.availability + '. ' : PH('indiquez votre disponibilité réelle') + ' ') + PH('indiquez vos attentes salariales après vous être renseigné sur les pratiques du marché'),
      example: '', tip: 'Préparez une fourchette argumentée ; renseignez-vous sur les salaires du poste avant l\'entretien.' });

    // Questions spécifiques à l'offre
    if (offer) {
      (offer.missions.concat(offer.responsibilities)).slice(0, 4).forEach((m) => {
        const terms = Eng.extractKeywords(m).map((k) => k.term);
        const bx = allBullets.filter((x) => Eng.extractKeywords(x.b).some((k) => terms.includes(k.term))).sort((a, b) => U.hasMetric(b.b) - U.hasMetric(a.b))[0];
        add({ group: 'specific', type: 'behavioral', question: 'Cette mission fait partie du poste : « ' + trimEnd(m) + ' ». Quelle expérience concrète en avez-vous ?', cvElements: bx ? [trimEnd(bx.b)].concat(expRef(bx.e)) : [],
          answer: bx ? 'Sur ce sujet, j\'ai réalisé chez ' + (bx.e.company || PH('entreprise')) + ' : ' + U.lowerFirst(trimEnd(bx.b)) + '.' : PH('aucune expérience correspondante dans votre CV : citez une situation proche réelle, ou dites clairement que vous n\'avez pas encore eu l\'occasion de le faire et comment vous vous y prendriez'),
          example: '', tip: bx ? 'Complétez la réponse avec le contexte et le résultat (méthode STAR).' : 'Ne prétendez pas avoir fait ce que vous n\'avez pas fait : décrivez votre approche et vos acquis transférables.', star: starOf(m, bx) });
      });
      offer.required.filter((k) => k.cat !== 'soft' && k.cat !== 'langue' && f.keywordSet.has(k.term)).slice(0, 3).forEach((k) => {
        const bx = bulletFor(k.term);
        add({ group: 'specific', type: 'behavioral', question: 'Comment avez-vous utilisé ' + k.term + ' et avec quel résultat ?', cvElements: bx ? [trimEnd(bx.b)].concat(expRef(bx.e)) : [k.term],
          answer: bx ? U.cap(U.lowerFirst(trimEnd(bx.b))) + '.' : PH('précisez dans quel contexte réel vous avez utilisé ' + k.term), example: '', tip: 'Donnez un contexte, l\'usage précis et un résultat.', star: starOf(k.term, bx) });
      });
      if (match) match.missing.filter((k) => k.cat !== 'soft' && k.cat !== 'langue').slice(0, 2).forEach((k) => {
        add({ group: 'specific', type: 'generic', question: 'Votre CV ne mentionne pas ' + k.term + '. Comment comptez-vous combler cet écart ?', cvElements: [],
          answer: 'Vous n\'avez pas (ou pas encore) indiqué ' + k.term + ' : dites-le honnêtement, puis présentez un plan réaliste. ' + PH('décrivez votre plan d\'apprentissage réel : formation, outil voisin déjà pratiqué, délai'), example: '', tip: 'L\'honnêteté associée à un plan précis est mieux perçue qu\'une esquive.' });
      });
      if (offer.minYears) add({ group: 'specific', type: 'generic', question: 'Le poste demande ' + offer.minYears + ' an(s) d\'expérience. Comment votre parcours y répond-il ?', cvElements: expRef(mainExp),
        answer: 'Mon CV totalise ' + U.expYears(exps) + ' an(s) d\'expérience' + (mainExp ? ', dont ' + (mainExp.title || '') + ' chez ' + (mainExp.company || '') : '') + '. ' + (U.expYears(exps) < offer.minYears ? PH('expliquez ce qui compense l\'écart avec des éléments réels') : ''), example: '', tip: 'Appuyez-vous sur des faits : durées exactes, responsabilités, résultats.' });
    }

    Q.forEach((q) => {
      if (q.star && !q.example) q.example = 'Voir la trame STAR ci-dessous : complétez-la avec votre situation réelle.';
    });

    return {
      id: U.uid('prep'), createdAt: new Date().toISOString(), position, company, pitch,
      questions: Q, vigilance: vigilancePoints(cv, offer, match),
      matchScore: match ? match.score : null,
    };
  }

  function prepToText(prep) {
    const out = ['FICHE DE PRÉPARATION À L\'ENTRETIEN' + (prep.position ? ' — ' + prep.position : '') + (prep.company ? ' chez ' + prep.company : ''), '', '1. PITCH DE 60 SECONDES', prep.pitch.text, ''];
    const sec = (title, grp) => {
      out.push(title);
      prep.questions.filter((q) => q.group === grp).forEach((q, i) => {
        out.push('', (i + 1) + '. ' + q.question);
        if (q.cvElements.length) out.push('Éléments du CV : ' + q.cvElements.join(' ; '));
        out.push('Réponse suggérée : ' + q.answer);
        if (q.example) out.push('Exemple concret : ' + q.example);
        if (q.star) out.push('STAR — Situation : ' + q.star.s, 'STAR — Tâche : ' + q.star.t, 'STAR — Action : ' + q.star.a, 'STAR — Résultat : ' + q.star.r);
        if (q.tip) out.push('Conseil : ' + q.tip);
      });
      out.push('');
    };
    sec('2. QUESTIONS PROBABLES', 'generic');
    if (prep.questions.some((q) => q.group === 'specific')) sec('3. QUESTIONS SPÉCIFIQUES À L\'OFFRE', 'specific');
    if (prep.vigilance.length) { out.push('4. POINTS DE VIGILANCE'); prep.vigilance.forEach((v) => out.push('', v.label + ' — ' + v.detail, 'Comment répondre : ' + v.answer)); }
    return out.join('\n');
  }

  function prepToBlocks(prep) {
    const B = [{ t: 'name', x: 'Préparation à l\'entretien' }, { t: 'title', x: [prep.position, prep.company].filter(Boolean).join(' — ') }];
    B.push({ t: 'h2', x: '1. Pitch de 60 secondes' }, { t: 'p', x: prep.pitch.text });
    const sec = (title, grp) => {
      B.push({ t: 'h2', x: title });
      prep.questions.filter((q) => q.group === grp).forEach((q, i) => {
        B.push({ t: 'h3', x: (i + 1) + '. ' + q.question, r: '' });
        if (q.cvElements.length) B.push({ t: 'meta', x: 'Éléments du CV : ' + q.cvElements.join(' ; ') });
        B.push({ t: 'p', x: 'Réponse suggérée : ' + q.answer });
        if (q.star) ['s', 't', 'a', 'r'].forEach((k, j) => B.push({ t: 'b', x: ['Situation', 'Tâche', 'Action', 'Résultat'][j] + ' : ' + q.star[k] }));
        if (q.tip) B.push({ t: 'meta', x: 'Conseil : ' + q.tip });
      });
    };
    sec('2. Questions probables', 'generic');
    if (prep.questions.some((q) => q.group === 'specific')) sec('3. Questions spécifiques à l\'offre', 'specific');
    if (prep.vigilance.length) {
      B.push({ t: 'h2', x: '4. Points de vigilance' });
      prep.vigilance.forEach((v) => { B.push({ t: 'h3', x: v.label, r: '' }, { t: 'meta', x: v.detail }, { t: 'p', x: 'Comment répondre : ' + v.answer }); });
    }
    return B;
  }

  async function exportPrep(cv, prep, format) {
    const name = C.Gen.fileName(cv, 'Entretien', prep.position, format === 'pdf' ? 'pdf' : 'txt');
    if (format === 'pdf') { U.download(C.Gen.buildPDF(prepToBlocks(prep), 'professional', 'Préparation entretien'), name); return true; }
    if (format === 'copy') return C.Gen.copyText(prepToText(prep));
    if (format === 'print') { C.Gen.printHTML('<div class="print-prep">' + U.esc(prepToText(prep)).replace(/\n/g, '<br>') + '</div>', 'print-letter-wrap'); return true; }
    throw new Error('Format inconnu : ' + format);
  }

  C.AI.registerLocal('interviewPrep', ({ cv, offer, opts }) => generateInterviewPrep(cv, offer, opts));
  C.AI.registerLocal('star', ({ question, exp, bullet }) => generateSTARAnswer(question, exp, bullet));

  C.Interview = { generateInterviewPrep, generateSTARAnswer, vigilancePoints, buildPitch, prepToText, prepToBlocks, exportPrep };
})(window.CVATS);
