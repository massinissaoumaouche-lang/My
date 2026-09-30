/* CV ATS PRO — app.js
 * Interface, routage, état local (localStorage) et orchestration des modules :
 *   data.js · ai.js · ats-engine.js · cv-generator.js · interview.js
 *
 * Toutes les données restent dans le navigateur (localStorage). Aucun envoi automatique de CV. */
(function () {
  'use strict';
  const C = window.CVATS;
  const { U, Data, Engine, Gen, Interview, AI } = C;
  const esc = U.esc;
  const $ = (s, r) => (r || document).querySelector(s);

  /* ================================================================== */
  /* Stockage : candidateProfile, experiences[], education[], skills[],   */
  /* languages[], certifications[], projects[], jobOffers[],               */
  /* applications[], generatedCVs[], coverLetters[], interviewPreparations[] */
  /* ================================================================== */
  const KEY = 'cvatspro.v1';

  function blankState() {
    return {
      version: 1, demo: false, onboarded: false, currentOfferId: null,
      progress: { analyzed: false, exported: false },
      settings: { country: 'France', template: 'professional', cvLang: 'fr', aiProvider: 'local', aiEndpoint: '' },
      candidateProfile: U.clone(Data.EMPTY_PROFILE),
      experiences: [], education: [], skills: [], languages: [], certifications: [], projects: [],
      jobOffers: [], applications: [], generatedCVs: [], coverLetters: [], interviewPreparations: [],
    };
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw), b = blankState();
        return Object.assign(b, s, { settings: Object.assign(b.settings, s.settings || {}), progress: Object.assign(b.progress, s.progress || {}) });
      }
    } catch (e) { /* stockage indisponible : on repart d'un état vide */ }
    return blankState();
  }

  let state = loadProfile();

  function saveProfile() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { toast('Sauvegarde locale impossible (stockage plein ou bloqué par le navigateur).'); return false; }
  }
  const saveSoon = U.debounce(saveProfile, 300);

  const ui = {
    step: 0, analysis: null, analysisMeta: null, importText: '', importFlags: null, importName: '', importError: '', analysisOfferId: '',
    offerDraft: '', tailored: null, cvSource: 'master', letterOpts: { length: 'standard', tone: 'professionnel', company: '', position: '', motivationPosition: '', motivationCompany: '', offerId: '' },
    letterId: null, prepId: null, prepOfferId: '', applicationId: null, helperId: null, previewMobile: false, busy: false,
  };

  /* ------------------------------------------------------------------ */
  /* Accès aux données                                                    */
  /* ------------------------------------------------------------------ */
  const getCV = () => Gen.createCV(Object.assign({}, state, { settings: { country: state.settings.country, template: state.settings.template, cvLang: state.settings.cvLang } }));
  const currentOffer = () => state.jobOffers.find((o) => o.id === state.currentOfferId) || null;
  const offerById = (id) => state.jobOffers.find((o) => o.id === id) || null;
  const hasCV = () => !!(state.candidateProfile.firstName || state.candidateProfile.lastName) && state.experiences.length > 0;
  function cvFromSource(src) {
    if (src && src !== 'master') { const g = state.generatedCVs.find((x) => x.id === src); if (g) return Object.assign(U.clone(g.cv), { settings: getCV().settings }); }
    return getCV();
  }
  const scoreOf = (cv, offer) => Engine.calculateATSScore(Engine.buildFeatures(cv), offer || null);
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch (e) { return d || ''; } };
  const nowIso = () => new Date().toISOString();

  /* ------------------------------------------------------------------ */
  /* Composants d'interface                                               */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10', file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
    scan: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 12h8',
    briefcase: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18', wand: 'M4 20L16 8M14 4l1.5 2.5L18 8l-2.5 1.5L14 12l-1.5-2.5L10 8l2.5-1.5z',
    mail: 'M3 6h18v12H3zM3 7l9 7 9-7', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M10 10v4M16 16v4',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14', plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    check: 'M5 12l4 4 10-10', alert: 'M12 4l9 16H3zM12 10v4M12 17h.01', arrow: 'M5 12h14M13 6l6 6-6 6', upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
    copy: 'M9 9h11v11H9zM5 15V4h11', print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', x: 'M6 6l12 12M18 6L6 18',
    sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  };
  const icon = (n, s) => '<svg class="ic" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICONS[n] || '') + '"/></svg>';
  const btn = (label, action, o) => {
    o = o || {};
    const data = Object.entries(o.data || {}).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('');
    return '<button type="button" class="btn ' + (o.cls || '') + '" data-action="' + action + '"' + data + (o.title ? ' title="' + esc(o.title) + '"' : '') + (o.disabled ? ' disabled' : '') + '>' + (o.icon ? icon(o.icon, 16) : '') + '<span>' + esc(label) + '</span></button>';
  };
  const chips = (arr, cls) => (arr && arr.length ? '<ul class="chips">' + arr.map((x) => '<li class="chip ' + (cls || '') + '">' + esc(x) + '</li>').join('') + '</ul>' : '');
  const empty = (txt) => '<p class="muted">' + txt + '</p>';

  function ring(score, o) {
    o = o || {};
    const r = 52, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    const cls = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'bad';
    return '<div class="ring ' + cls + '" style="width:' + (o.size || 150) + 'px;height:' + (o.size || 150) + 'px" role="img" aria-label="' + esc(o.aria || 'Score ' + score + ' sur 100') + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="' + r + '"/><circle class="ring-fg" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>' +
      '<div class="ring-txt"><strong>' + score + (o.unit || '') + '</strong><span>' + (o.sub || '/ 100') + '</span></div></div>';
  }
  const tone = (p) => (p >= 80 ? 'good' : p >= 60 ? 'mid' : 'bad');
  const bar = (label, pct, extra) => '<div class="bar"><div class="bar-top"><span>' + esc(label) + '</span><b>' + pct + ' %</b></div><div class="bar-track" role="presentation"><i class="' + tone(pct) + '" style="width:' + pct + '%"></i></div>' + (extra ? '<small class="muted">' + extra + '</small>' : '') + '</div>';
  const badge = (txt, cls) => '<span class="badge ' + (cls || '') + '">' + esc(txt) + '</span>';
  const statusCls = { 'À préparer': 'gray', 'Prête': 'blue', 'Envoyée': 'violet', 'Entretien': 'green', 'Relance': 'amber', 'Refusée': 'red', 'Acceptée': 'green' };

  let fid = 0;
  function field(label, bind, val, o) {
    o = o || {};
    const id = 'f' + (++fid), t = o.type || 'text';
    const common = 'id="' + id + '" data-bind="' + bind + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.disabled ? ' disabled' : '') + (o.req ? ' aria-required="true"' : '') + (o.hint ? ' aria-describedby="' + id + 'h"' : '');
    let ctl;
    if (t === 'textarea') ctl = '<textarea ' + common + ' rows="' + (o.rows || 4) + '">' + esc(val) + '</textarea>';
    else if (t === 'select') ctl = '<select ' + common + '>' + o.options.map((op) => '<option value="' + esc(op[0]) + '"' + (op[0] === val ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select>';
    else ctl = '<input type="' + t + '" ' + common + ' value="' + esc(val) + '"' + (o.pattern ? ' pattern="' + o.pattern + '"' : '') + '>';
    return '<div class="field ' + (o.cls || '') + '"><label for="' + id + '">' + esc(label) + (o.req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' + ctl + (o.hint ? '<small class="hint" id="' + id + 'h">' + o.hint + '</small>' : '') + '</div>';
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 4200);
  }

  let lastFocus = null;
  function openModal(title, body, footer) {
    closeModal();
    lastFocus = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal-backdrop'; m.id = 'modal';
    m.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="modal-head"><h2 id="mTitle">' + esc(title) + '</h2><button type="button" class="icon-btn" data-action="modal-close" aria-label="Fermer">' + icon('x') + '</button></div><div class="modal-body">' + body + '</div>' + (footer ? '<div class="modal-foot">' + footer + '</div>' : '') + '</div>';
    document.body.appendChild(m);
    const first = m.querySelector('input,select,textarea,button.btn');
    if (first) first.focus();
  }
  function closeModal() { const m = $('#modal'); if (m) { m.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); } }

  /* ================================================================== */
  /* Pages                                                                */
  /* ================================================================== */
  const NAV = [
    ['dashboard', 'Tableau de bord', 'home'], ['cv', 'Mon CV', 'file'], ['analyze', 'Analyser mon CV', 'scan'], ['offer', 'Analyser une offre', 'briefcase'],
    ['tailor', 'Adapter mon CV', 'wand'], ['letter', 'Lettre de motivation', 'mail'], ['interview', 'Préparation entretien', 'mic'],
    ['applications', 'Mes candidatures', 'list'], ['settings', 'Paramètres', 'settings'],
  ];
  const logo = '<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M9 16.5l4.5 4.5L23 11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------------------------- Landing ----------------------------- */
  function landing() {
    const steps = [
      ['scan', 'Analyse du CV', 'Score ATS détaillé sur 100, points forts, erreurs et actions classées par impact.'],
      ['briefcase', 'Analyse de l\'offre', 'Extraction du poste, des compétences obligatoires, souhaitées et des mots-clés ATS.'],
      ['wand', 'Optimisation ATS', 'Un CV reformulé avec le vocabulaire de l\'offre, sans jamais inventer une compétence.'],
      ['mail', 'Lettre personnalisée', 'Six paragraphes construits à partir de votre expérience réelle et de l\'offre.'],
      ['mic', 'Préparation entretien', 'Pitch, questions probables, trames STAR et points de vigilance honnêtes.'],
    ];
    return '<div class="landing">' +
      '<header class="l-head"><a class="brand" href="#/">' + logo + '<span>CV ATS PRO</span></a><nav aria-label="Navigation principale"><a class="btn btn-ghost" href="#/dashboard">Ouvrir l\'application</a></nav></header>' +
      '<main id="main"><section class="hero"><div class="hero-copy">' +
      '<p class="eyebrow">Candidatures plus claires, plus ciblées</p><h1>Créez un CV qui passe les filtres ATS.</h1>' +
      '<p class="lead">Analysez votre CV, adaptez-le à chaque offre, générez votre lettre de motivation et préparez votre entretien depuis une seule plateforme.</p>' +
      '<div class="hero-cta"><a class="btn btn-primary btn-lg" href="#/cv">Créer mon CV</a><a class="btn btn-lg" href="#/analyze">Analyser mon CV</a></div>' +
      '<p class="fine">' + icon('shield', 16) + ' Vos données restent dans votre navigateur. Aucun envoi automatique.</p></div>' +
      '<div class="hero-card" aria-label="Exemple de résultat d\'analyse"><p class="tag">Exemple</p>' + ring(82, { size: 130 }) +
      '<div class="mini-bars">' + bar('Structure', 95) + bar('Mots-clés', 76) + bar('Expérience', 88) + '</div>' +
      '<p class="fine">Estimation d\'optimisation : le score ne garantit pas un entretien.</p></div></section>' +
      '<section class="l-section"><h2>Un CV. Une offre. Une candidature optimisée.</h2><ol class="step-cards">' +
      steps.map((s, i) => '<li class="card step-card"><span class="step-n">' + (i + 1) + '</span><div class="step-ic">' + icon(s[0], 22) + '</div><h3>' + s[1] + '</h3><p>' + s[2] + '</p></li>').join('') + '</ol></section>' +
      '<section class="l-section l-principles"><div><h3>Zéro invention</h3><p>Aucune expérience, compétence, diplôme ou chiffre n\'est ajouté à votre place. Ce qui manque est signalé pour que vous le complétiez.</p></div>' +
      '<div><h3>Adapté au pays</h3><p>Dix marchés, avec des usages présentés comme courants et non universels.</p></div>' +
      '<div><h3>Prêt à brancher une IA</h3><p>Couche AI.generate() prête pour OpenAI, Claude ou Gemini via votre propre backend.</p></div></section></main>' +
      '<footer class="l-foot"><p>CV ATS PRO — prototype MVP. Le score ATS est une estimation interne et ne reproduit pas le fonctionnement d\'un ATS réel.</p></footer></div>';
  }

  /* ---------------------------- Dashboard ---------------------------- */
  function dashboard() {
    const p = state.candidateProfile, cv = getCV();
    const name = Gen.fullName(cv);
    const sc = scoreOf(cv);
    const L = { structure: 'Structure', keywords: 'Mots-clés', experience: 'Expérience', readability: 'Lisibilité', relevance: 'Cohérence' };
    const apps = state.applications.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    const steps = [
      ['Créer ou importer son CV', hasCV(), '#/cv'], ['Analyser le CV', state.progress.analyzed, '#/analyze'], ['Obtenir le score ATS', state.progress.analyzed, '#/analyze'],
      ['Coller une offre', state.jobOffers.length > 0, '#/offer'], ['Analyser la correspondance', state.jobOffers.length > 0, '#/offer'],
      ['Optimiser le CV', state.generatedCVs.length > 0, '#/tailor'], ['Créer la lettre', state.coverLetters.length > 0, '#/letter'],
      ['Préparer l\'entretien', state.interviewPreparations.length > 0, '#/interview'], ['Exporter la candidature', state.progress.exported, '#/applications'],
    ];
    const done = steps.filter((s) => s[1]).length;
    return '<div class="page-head"><div><h1>Tableau de bord</h1><p class="muted">Vue d\'ensemble de votre candidature.</p></div><div class="actions">' +
      '<a class="btn btn-primary" href="#/cv">' + icon('plus', 16) + 'Créer un CV</a><a class="btn" href="#/analyze">' + icon('scan', 16) + 'Analyser mon CV</a><a class="btn" href="#/offer">' + icon('briefcase', 16) + 'Analyser une offre</a></div></div>' +
      '<div class="grid-dash">' +
      '<section class="card"><h2>Profil</h2>' + (name ? '<div class="profile"><div class="avatar" aria-hidden="true">' + esc((p.firstName[0] || '') + (p.lastName[0] || '')) + '</div><div><p class="big">' + esc(name) + '</p><p>' + esc(p.title || 'Titre professionnel non renseigné') + '</p></div></div>' +
        '<dl class="kv"><dt>Localisation</dt><dd>' + esc([p.city, p.country].filter(Boolean).join(', ') || '—') + '</dd><dt>Disponibilité</dt><dd>' + esc(p.availability || '—') + '</dd><dt>Expérience</dt><dd>' + U.expYears(state.experiences) + ' an(s)</dd></dl><a class="btn btn-sm" href="#/cv">Modifier mon profil</a>' :
        empty('Aucun profil pour le moment.') + '<p><a class="btn btn-primary" href="#/cv">Créer mon profil</a></p>') + '</section>' +
      '<section class="card score-card"><h2>Score du CV</h2><div class="score-flex">' + ring(sc.total) + '<div><p class="score-label ' + tone(sc.total) + '">' + sc.label + '</p><p class="big">ATS Score : ' + sc.total + '/100</p><p class="fine">Estimation d\'optimisation interne, sans garantie d\'entretien.</p></div></div><div class="bars">' +
      Object.entries(sc.dims).map(([k, d]) => bar(L[k], d.pct)).join('') + '</div><a class="btn btn-sm" href="#/analyze">Voir le rapport détaillé</a></section>' +
      '<section class="card"><h2>Parcours conseillé <small class="muted">' + done + '/9</small></h2><ol class="journey">' +
      steps.map((s, i) => '<li class="' + (s[1] ? 'done' : '') + '"><a href="' + s[2] + '"><span class="dot" aria-hidden="true">' + (s[1] ? icon('check', 14) : i + 1) + '</span><span>' + s[0] + '</span><span class="sr-only">' + (s[1] ? ' (terminé)' : ' (à faire)') + '</span></a></li>').join('') + '</ol></section>' +
      '<section class="card wide"><div class="card-head"><h2>Dernières candidatures</h2><a class="btn btn-sm" href="#/applications">Tout voir</a></div>' +
      (apps.length ? '<div class="table-wrap"><table><thead><tr><th scope="col">Poste</th><th scope="col">Entreprise</th><th scope="col" class="num">Match</th><th scope="col">Statut</th></tr></thead><tbody>' +
        apps.map((a) => '<tr><td>' + esc(a.title) + '</td><td>' + esc(a.company) + '</td><td class="num">' + (a.match != null ? a.match + ' %' : '—') + '</td><td>' + badge(a.status, statusCls[a.status]) + '</td></tr>').join('') + '</tbody></table></div>' : empty('Aucune candidature suivie. Analysez une offre puis cliquez sur « Préparer ma candidature ».')) + '</section></div>';
  }

  /* ---------------------------- Mon CV ---------------------------- */
  const STEPS = ['Informations', 'Profil', 'Expériences', 'Formation', 'Compétences', 'Certifications & projets'];

  function stepContent(step) {
    const p = state.candidateProfile, S = state.settings;
    const country = Data.COUNTRIES[S.country] || { extra: [], tips: [] };
    if (step === 0) {
      return '<h2>Informations personnelles</h2><div class="row">' + field('Prénom', 'candidateProfile.firstName', p.firstName, { req: 1, auto: 'given-name' }) + field('Nom', 'candidateProfile.lastName', p.lastName, { req: 1, auto: 'family-name' }) + '</div>' +
        field('Titre professionnel', 'candidateProfile.title', p.title, { ph: 'Ex. Chef de projet digital', hint: 'Utilisez l\'intitulé du poste visé, cohérent avec vos expériences.' }) +
        '<div class="row">' + field('Téléphone', 'candidateProfile.phone', p.phone, { type: 'tel', auto: 'tel' }) + field('Email', 'candidateProfile.email', p.email, { type: 'email', auto: 'email' }) + '</div>' +
        '<div class="row">' + field('Ville', 'candidateProfile.city', p.city, { auto: 'address-level2' }) + field('Pays', 'candidateProfile.country', p.country, { auto: 'country-name' }) + '</div>' +
        '<div class="row">' + field('LinkedIn', 'candidateProfile.linkedin', p.linkedin, { ph: 'linkedin.com/in/…' }) + field('Portfolio', 'candidateProfile.portfolio', p.portfolio) + '</div>' +
        field('Site internet', 'candidateProfile.website', p.website) + field('Disponibilité (affichée dans le tableau de bord)', 'candidateProfile.availability', p.availability, { ph: 'Ex. Disponible sous 2 mois' }) +
        '<div class="note info"><strong>Âge, situation familiale, enfants : non demandés.</strong> Ces informations ne sont proposées que si les usages du pays cible (' + esc(S.country) + ') les rendent courantes.' +
        (country.extra.length ? '<div class="row">' + country.extra.map((k) => field(Data.EXTRA_LABELS[k], 'candidateProfile.' + k, p[k] || '', k === 'birthDate' ? { type: 'text', ph: 'JJ/MM/AAAA' } : {})).join('') + '</div>' : '<p class="fine">Aucun champ supplémentaire proposé pour ce pays.</p>') + '</div>';
    }
    if (step === 1) {
      const g = Engine.isGenericSummary(p.summary || '');
      const words = U.words(p.summary).length;
      return '<h2>Profil professionnel</h2>' + field('Résumé professionnel (3 à 5 lignes)', 'candidateProfile.summary', p.summary, { type: 'textarea', rows: 6, hint: 'Métier, années d\'expérience, 2 à 4 compétences clés, un résultat réel. Évitez « motivé, dynamique, sérieux ».' }) +
        '<div class="inline-actions">' + btn('Proposer un résumé', 'gen-summary', { icon: 'sparkle', cls: 'btn-sm' }) + '</div>' +
        '<div id="summaryCheck" class="note ' + (p.summary && !g.generic && words >= 25 ? 'ok' : 'warn') + '">' + summaryCheck(p.summary, g, words) + '</div>';
    }
    if (step === 2) {
      return '<h2>Expériences professionnelles</h2>' + (state.experiences.length ? '' : empty('Aucune expérience. Ajoutez votre poste le plus récent en premier.')) +
        state.experiences.map(expCard).join('') + '<p>' + btn('Ajouter une expérience', 'add-item', { icon: 'plus', data: { list: 'experiences' } }) + '</p>';
    }
    if (step === 3) {
      return '<h2>Formation</h2>' + state.education.map((d, i) => '<fieldset class="item"><legend>Formation ' + (i + 1) + '</legend><div class="row">' + field('Diplôme', 'education.' + i + '.degree', d.degree) + field('Établissement', 'education.' + i + '.school', d.school) + '</div><div class="row">' +
        field('Localisation', 'education.' + i + '.location', d.location) + field('Année', 'education.' + i + '.year', d.year) + field('Spécialité', 'education.' + i + '.specialty', d.specialty) + '</div>' +
        '<div class="item-actions">' + btn('Supprimer', 'del-item', { cls: 'btn-sm btn-danger', icon: 'trash', data: { list: 'education', idx: i } }) + '</div></fieldset>').join('') + '<p>' + btn('Ajouter une formation', 'add-item', { icon: 'plus', data: { list: 'education' } }) + '</p>';
    }
    if (step === 4) {
      return '<h2>Compétences</h2><p class="muted">Ajoutez uniquement des compétences que vous maîtrisez réellement. Séparez plusieurs éléments par des virgules.</p>' +
        Data.SKILL_CATS.map(([k, label]) => {
          const items = state.skills.map((s, i) => ({ s, i })).filter((x) => x.s.category === k);
          return '<div class="skill-cat"><h3 id="sk-' + k + '">' + label + '</h3><ul class="chips editable" aria-labelledby="sk-' + k + '">' + items.map((x) => '<li class="chip">' + esc(x.s.name) + '<button type="button" class="chip-x" data-action="skill-del" data-idx="' + x.i + '" aria-label="Supprimer ' + esc(x.s.name) + '">×</button></li>').join('') + '</ul>' +
            '<div class="add-row"><label class="sr-only" for="sk-in-' + k + '">Ajouter une compétence — ' + label + '</label><input id="sk-in-' + k + '" data-skill-input="' + k + '" placeholder="Ajouter…" autocomplete="off">' + btn('Ajouter', 'skill-add', { cls: 'btn-sm', data: { cat: k } }) + '</div></div>';
        }).join('') +
        '<div class="skill-cat"><h3>Langues</h3>' + state.languages.map((l, i) => '<div class="row lang-row">' + field('Langue', 'languages.' + i + '.name', l.name) + field('Niveau', 'languages.' + i + '.level', l.level, { type: 'select', options: [['', '—']].concat(Data.LANG_LEVELS.map((x) => [x, x])) }) +
          btn('Supprimer', 'del-item', { cls: 'btn-sm btn-danger', icon: 'trash', data: { list: 'languages', idx: i } }) + '</div>').join('') + '<p>' + btn('Ajouter une langue', 'add-item', { icon: 'plus', data: { list: 'languages' } }) + '</p></div>';
    }
    return '<h2>Certifications</h2>' + state.certifications.map((c, i) => '<fieldset class="item"><legend>Certification ' + (i + 1) + '</legend><div class="row">' + field('Certification', 'certifications.' + i + '.name', c.name) + field('Organisme', 'certifications.' + i + '.issuer', c.issuer) + '</div><div class="row">' +
      field('Année', 'certifications.' + i + '.year', c.year) + field('Numéro (facultatif)', 'certifications.' + i + '.number', c.number) + '</div><div class="item-actions">' + btn('Supprimer', 'del-item', { cls: 'btn-sm btn-danger', icon: 'trash', data: { list: 'certifications', idx: i } }) + '</div></fieldset>').join('') +
      '<p>' + btn('Ajouter une certification', 'add-item', { icon: 'plus', data: { list: 'certifications' } }) + '</p><h2>Projets</h2>' +
      state.projects.map((c, i) => '<fieldset class="item"><legend>Projet ' + (i + 1) + '</legend>' + field('Nom du projet', 'projects.' + i + '.name', c.name) + '<div class="row">' + field('Contexte', 'projects.' + i + '.context', c.context) + field('Rôle', 'projects.' + i + '.role', c.role) + '</div>' +
        field('Technologies / outils', 'projects.' + i + '.tools', c.tools) + field('Résultats', 'projects.' + i + '.results', c.results, { type: 'textarea', rows: 2, hint: 'Chiffres réels uniquement. ' + (c.results ? '' : Gen.MISSING_NOTE) }) +
        '<div class="item-actions">' + btn('Supprimer', 'del-item', { cls: 'btn-sm btn-danger', icon: 'trash', data: { list: 'projects', idx: i } }) + '</div></fieldset>').join('') + '<p>' + btn('Ajouter un projet', 'add-item', { icon: 'plus', data: { list: 'projects' } }) + '</p>';
  }

  function summaryCheck(summary, g, words) {
    if (!summary || !summary.trim()) return 'Aucun résumé. Utilisez « Proposer un résumé » (construit à partir de vos expériences et compétences) puis relisez-le.';
    const out = [];
    if (g.hits.length) out.push('Formules génériques détectées : ' + g.hits.map((h) => '« ' + esc(h) + ' »').join(', ') + '.');
    if (g.kw < 3) out.push('Peu de mots-clés métier (' + g.kw + '). Citez 3 à 4 compétences clés.');
    if (words < 25) out.push('Résumé court (' + words + ' mots) : visez 40 à 80 mots.');
    if (words > 110) out.push('Résumé long (' + words + ' mots) : visez 3 à 5 lignes.');
    return out.length ? out.join(' ') : 'Résumé spécifique et riche en mots-clés (' + words + ' mots).';
  }

  function expCard(e, i) {
    const b = 'experiences.' + i + '.';
    return '<fieldset class="item"><legend>Expérience ' + (i + 1) + (e.title ? ' — ' + esc(e.title) : '') + '</legend>' +
      '<div class="row">' + field('Poste', b + 'title', e.title, { req: 1 }) + field('Entreprise', b + 'company', e.company, { req: 1 }) + '</div>' +
      '<div class="row">' + field('Localisation', b + 'location', e.location) + field('Début', b + 'start', e.start, { type: 'month', ph: 'AAAA-MM', pattern: '\\d{4}-\\d{2}' }) + field('Fin', b + 'end', e.end, { type: 'month', ph: 'AAAA-MM', pattern: '\\d{4}-\\d{2}', disabled: e.current }) + '</div>' +
      '<label class="check"><input type="checkbox" data-bind="' + b + 'current" data-kind="check"' + (e.current ? ' checked' : '') + '> Poste actuel</label>' +
      field('Description (contexte, périmètre)', b + 'description', e.description, { type: 'textarea', rows: 2 }) +
      field('Réalisations (une par ligne)', b + 'bullets', (e.bullets || []).join('\n'), { type: 'textarea', rows: 5, kind: 'lines', hint: 'Verbe d\'action + action + résultat. Ajoutez des chiffres réels (%, €, volumes, équipe, délais). Ne jamais inventer de chiffre.' }) +
      field('Outils utilisés', b + 'tools', e.tools, { ph: 'Jira, Excel, Google Analytics…' }) +
      '<div class="item-actions">' + btn(ui.helperId === e.id ? 'Masquer l\'assistant' : 'Assistant réalisations', 'helper', { cls: 'btn-sm', icon: 'sparkle', data: { id: e.id } }) + btn('Supprimer', 'del-item', { cls: 'btn-sm btn-danger', icon: 'trash', data: { list: 'experiences', idx: i } }) + '</div>' +
      (ui.helperId === e.id ? helperPanel(e, i) : '') + '</fieldset>';
  }

  function helperPanel(e, i) {
    const items = (e.bullets || []).map((b, bi) => ({ b, bi, d: Gen.bulletDiagnostics(b) })).filter((x) => x.b.trim());
    if (!items.length) return '<div class="helper"><p class="muted">Saisissez d\'abord quelques réalisations : l\'assistant en vérifiera la forme et les chiffres.</p></div>';
    return '<div class="helper" aria-live="polite"><p class="fine">L\'assistant signale les faiblesses et vous laisse compléter avec vos <strong>données réelles</strong>. Il n\'invente aucun chiffre ni résultat.</p>' +
      items.map((x) => {
        const tight = Gen.tightenBullet(x.b);
        const noMetric = x.d.some((d) => d.type === 'metric');
        return '<div class="h-item"><p class="h-text">' + esc(x.b) + '</p>' +
          (x.d.length ? '<ul class="h-issues">' + x.d.map((d) => '<li>' + (d.type === 'metric' ? '⚠ ' : '• ') + esc(d.msg) + '</li>').join('') + '</ul>' : '<p class="ok-text">✓ Forme correcte et chiffrée.</p>') +
          (tight !== x.b.trim() ? '<p>Formulation plus directe : « ' + esc(tight) + ' » ' + btn('Appliquer', 'h-tighten', { cls: 'btn-sm', data: { exp: i, b: x.bi } }) + '</p>' : '') +
          (noMetric ? '<div class="h-form row"><div class="field"><label for="hd-' + x.bi + '-' + i + '">Précision chiffrée réelle (volume, taille, budget…)</label><input id="hd-' + x.bi + '-' + i + '" data-h-detail="' + i + '-' + x.bi + '" placeholder="ex. portefeuille de … clients"></div>' +
            '<div class="field"><label for="hr-' + x.bi + '-' + i + '">Résultat obtenu (réel)</label><input id="hr-' + x.bi + '-' + i + '" data-h-result="' + i + '-' + x.bi + '" placeholder="ex. délai réduit de … %"></div>' + btn('Compléter', 'h-compose', { cls: 'btn-sm', data: { exp: i, b: x.bi } }) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
  }

  function templatePicker() {
    return '<div class="tpl-pick" role="radiogroup" aria-label="Modèle de CV">' + Data.TEMPLATES.map((t) =>
      '<label class="tpl ' + (state.settings.template === t.id ? 'on' : '') + '"><input type="radio" name="tpl" value="' + t.id + '" data-bind="settings.template"' + (state.settings.template === t.id ? ' checked' : '') + '><strong>' + t.label + '</strong><small>' + t.desc + '</small></label>').join('') + '</div>';
  }

  function cvPage() {
    const S = state.settings, country = Data.COUNTRIES[S.country];
    return '<div class="page-head"><div><h1>Mon CV</h1><p class="muted">Modifiez vos informations à gauche, l\'aperçu se met à jour en direct.</p></div><div class="actions">' +
      btn('Enregistrer', 'save-profile', { cls: 'btn-primary', icon: 'save' }) + btn('Prévisualiser', 'toggle-preview', { cls: 'only-mobile', icon: 'eye' }) + btn('Analyser', 'analyze-app', { icon: 'scan' }) + btn('Télécharger', 'export-cv', { icon: 'download', data: { format: 'pdf', src: 'master' } }) + '</div></div>' +
      '<div class="cv-layout ' + (ui.previewMobile ? 'show-preview' : '') + '"><section class="card cv-editor" aria-label="Éditeur de CV"><nav class="stepper" aria-label="Étapes de création du CV"><ol>' +
      STEPS.map((s, i) => '<li><button type="button" class="' + (i === ui.step ? 'on' : i < ui.step ? 'past' : '') + '" data-action="step" data-step="' + i + '"' + (i === ui.step ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '</span>' + s + '</button></li>').join('') + '</ol></nav>' +
      '<div id="stepBody">' + stepContent(ui.step) + '</div><div class="step-nav">' + btn('Précédent', 'step-prev', { disabled: ui.step === 0 }) + (ui.step < STEPS.length - 1 ? btn('Suivant', 'step-next', { cls: 'btn-primary', icon: 'arrow' }) : btn('Terminer', 'save-profile', { cls: 'btn-primary', icon: 'check' })) + '</div></section>' +
      '<aside class="cv-side" aria-label="Aperçu du CV"><div class="card side-head"><div class="row">' +
      field('Pays cible', 'settings.country', S.country, { type: 'select', options: Object.keys(Data.COUNTRIES).map((c) => [c, c]) }) + field('Langue des titres', 'settings.cvLang', S.cvLang, { type: 'select', options: [['fr', 'Français'], ['en', 'English']] }) + '</div>' + templatePicker() +
      '<details class="country-tips"><summary>Usages courants — ' + esc(S.country) + '</summary><ul>' + country.tips.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul><p class="fine">Usages généralement observés, variables selon le secteur et l\'employeur : à vérifier pour chaque candidature. Aucune règle locale n\'est universelle.</p></details>' +
      '<div class="export-row">' + btn('PDF', 'export-cv', { cls: 'btn-sm', icon: 'download', data: { format: 'pdf', src: 'master' } }) + btn('DOCX', 'export-cv', { cls: 'btn-sm', icon: 'download', data: { format: 'docx', src: 'master' } }) + btn('Copier', 'export-cv', { cls: 'btn-sm', icon: 'copy', data: { format: 'copy', src: 'master' } }) + btn('Imprimer', 'export-cv', { cls: 'btn-sm', icon: 'print', data: { format: 'print', src: 'master' } }) + '</div></div>' +
      '<div class="paper"><div id="cvPreview">' + Gen.renderCVHtml(getCV()) + '</div></div></aside></div>';
  }

  /* ---------------------------- Analyse du CV ---------------------------- */
  function analysisView(res, meta) {
    const s = res.score, f = res.features;
    const L = { structure: 'Structure ATS', keywords: 'Mots-clés', experience: 'Expérience', readability: 'Lisibilité', relevance: s.mode === 'offer' ? 'Pertinence (offre)' : 'Cohérence avec le poste visé' };
    const icon3 = { ok: '✓', warn: '⚠', bad: '✕' };
    const cats = res.keywordsByCat;
    return '<div class="card result"><div class="score-flex big-score">' + ring(s.total, { size: 180 }) + '<div><p class="score-label ' + tone(s.total) + '">' + s.label + '</p><p class="score-line"><strong>' + s.total + ' / 100</strong></p>' +
      '<p class="fine scale">Excellent 80–100 · À améliorer 60–79 · Faible 0–59</p><p class="fine">' + esc(s.disclaimer) + '</p>' + (meta && meta.source ? '<p class="fine">Source : ' + esc(meta.source) + (f.mode === 'text' ? ' (analyse du texte : certaines vérifications de mise en page sont limitées)' : '') + '</p>' : '') + '</div></div>' +
      '<div class="bars">' + Object.entries(s.dims).map(([k, d]) => bar(L[k], d.pct, d.points + ' / ' + d.max + ' points')).join('') + '</div>' +
      '<details class="calc"><summary>Détail des calculs</summary><p class="formula">' + esc(s.formula) + '</p>' +
      Object.entries(s.dims).map(([k, d]) => '<h4>' + L[k] + ' — ' + d.points + ' / ' + d.max + '</h4><div class="table-wrap"><table class="checks"><thead><tr><th scope="col">Critère</th><th scope="col">Mesure</th><th scope="col" class="num">Points</th></tr></thead><tbody>' +
        d.checks.map((c) => '<tr class="' + c.status + '"><td><span class="st" aria-hidden="true">' + icon3[c.status] + '</span> ' + esc(c.label) + '<span class="sr-only"> (' + (c.status === 'ok' ? 'validé' : c.status === 'warn' ? 'à améliorer' : 'insuffisant') + ')</span></td><td>' + esc(c.note || '') + (c.unverified ? ' <em>(non vérifié)</em>' : '') + '</td><td class="num">' + c.points + ' / ' + c.max + '</td></tr>').join('') + '</tbody></table></div>').join('') +
      '<p class="fine">Heuristiques locales inspirées des bonnes pratiques de lisibilité par les ATS. Elles ne reproduisent pas un ATS réel.</p></details></div>' +
      '<div class="grid-3"><section class="card"><h3 class="ok-h">Points forts</h3>' + (s.strengths.length ? '<ul class="list ok">' + s.strengths.map((x) => '<li><span aria-hidden="true">✓</span> ' + esc(x) + '</li>').join('') + '</ul>' : empty('Aucun point fort marqué pour l\'instant.')) + '</section>' +
      '<section class="card"><h3 class="warn-h">Points à améliorer</h3>' + (s.issues.length ? '<ul class="list warn">' + s.issues.map((x) => '<li><span aria-hidden="true">⚠</span> ' + esc(x) + '</li>').join('') + '</ul>' : empty('Aucun problème majeur détecté.')) + '</section>' +
      '<section class="card"><h3>Actions recommandées</h3>' + (s.actions.length ? '<ol class="list">' + s.actions.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : empty('Rien à signaler.')) + '</section></div>' +
      '<section class="card"><h3>Mots-clés reconnus <small class="muted">(' + f.keywords.length + ')</small></h3>' + (f.keywords.length ? Object.entries(cats).map(([c, arr]) => '<p class="kw-cat"><strong>' + Data.CATEGORY_LABELS[c] + '</strong></p>' + chips(arr.map((k) => k.term + (k.count > 1 ? ' ×' + k.count : '')))).join('') : empty('Aucun mot-clé reconnu.')) + '</section>' +
      (s.match ? '<section class="card"><h3>Correspondance avec l\'offre : ' + s.match.score + ' %</h3><p class="muted">Consultez la page « Analyser une offre » pour le détail.</p></section>' : '');
  }

  function analyzePage() {
    const offers = state.jobOffers;
    return '<div class="page-head"><div><h1>Analyser mon CV</h1><p class="muted">Importez, collez ou analysez le CV créé dans l\'application.</p></div></div>' +
      '<div class="split"><section class="card"><h2>Votre CV</h2>' +
      '<label class="dropzone" id="dropzone" for="fileInput">' + icon('upload', 30) + '<strong>Déposez votre CV ici</strong><span>PDF / DOCX / TXT — ou cliquez pour choisir un fichier</span><input type="file" id="fileInput" accept=".pdf,.docx,.txt,.md" class="sr-only"></label>' +
      (ui.importName ? '<p class="fine">Fichier lu : <strong>' + esc(ui.importName) + '</strong></p>' : '') + (ui.importError ? '<div class="note warn" role="alert">' + esc(ui.importError) + '</div>' : '') +
      '<p class="fine">Les fichiers sont lus dans votre navigateur et ne sont envoyés nulle part. Lecture PDF « au mieux » : pour un PDF scanné ou à police encodée, collez le texte.</p>' +
      field('Ou collez le texte de votre CV', 'ui.importText', ui.importText, { type: 'textarea', rows: 10, ph: 'Collez ici le contenu de votre CV…' }) +
      field('Comparer avec une offre (facultatif)', 'ui.analysisOfferId', ui.analysisOfferId, { type: 'select', options: [['', 'Aucune : analyse générale']].concat(offers.map((o) => [o.id, (o.parsed.title || 'Offre') + (o.parsed.company ? ' — ' + o.parsed.company : '')])) }) +
      '<div class="actions">' + btn('Analyser mon CV', 'analyze-text', { cls: 'btn-primary', icon: 'scan' }) + btn('Analyser le CV créé dans l\'application', 'analyze-app', { icon: 'file' }) + '</div></section>' +
      '<div id="analysisResult">' + (ui.analysis ? analysisView(ui.analysis, ui.analysisMeta) : '<section class="card"><h2>Résultat</h2><p class="muted">Le rapport (score, points forts, erreurs, actions) apparaît ici.</p><ul class="list"><li>Structure, mots-clés, expérience, lisibilité et pertinence</li><li>Détail de chaque calcul</li><li>Actions classées par impact</li></ul><p class="fine">Le score est une estimation d\'optimisation, pas une garantie d\'obtenir un entretien.</p></section>') + '</div></div>';
  }

  function runAnalysis(src, source) {
    const off = state.jobOffers.find((o) => o.id === ui.analysisOfferId);
    ui.analysis = Engine.analyzeCV(src, { offer: off ? off.parsed : null, country: state.settings.country });
    ui.analysisMeta = { source };
    state.progress.analyzed = true; saveSoon();
    const box = $('#analysisResult');
    if (box) { box.innerHTML = analysisView(ui.analysis, ui.analysisMeta); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else render();
  }

  async function handleFile(file) {
    ui.importError = ''; ui.importName = file.name;
    try {
      const r = await Engine.extractTextFromFile(file);
      ui.importText = r.text; ui.importFlags = r.flags;
      render();
      runAnalysis({ text: r.text, flags: r.flags }, 'fichier ' + file.name);
    } catch (err) { ui.importError = err.message; ui.importFlags = null; render(); }
  }

  /* ---------------------------- Offre ---------------------------- */
  function offerPanel(rec) {
    if (!rec) return '<section class="card"><h2>Analyse</h2><p class="muted">Collez une offre puis cliquez sur « Analyser l\'offre » : poste, compétences, mots-clés ATS et correspondance avec votre CV apparaissent ici.</p></section>';
    const o = rec.parsed, cv = getCV(), f = Engine.buildFeatures(cv), m = Engine.calculateMatchScore(f, o);
    const nd = '<span class="muted">Non détecté</span>';
    const fact = (l, v) => '<div class="fact"><dt>' + l + '</dt><dd>' + (v ? esc(v) : nd) + '</dd></div>';
    const listBlock = (title, arr) => '<div class="blk"><h4>' + title + '</h4>' + (arr && arr.length ? '<ul class="list">' + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="muted">Non détecté</p>') + '</div>';
    const kwChips = (arr) => arr && arr.length ? chips(arr.map((k) => k.term)) : '<p class="muted">Aucun</p>';
    return '<section class="card"><div class="compare"><div class="cmp-side"><p class="tag">Votre CV</p><strong>' + esc(Gen.fullName(cv) || '—') + '</strong><span>' + esc(cv.candidateProfile.title || '') + '</span></div>' +
      '<div class="cmp-mid">' + ring(m.score, { size: 130, unit: ' %', sub: 'match', aria: 'Match ' + m.score + ' pour cent' }) + '</div><div class="cmp-side"><p class="tag">Cette offre</p><strong>' + esc(o.title || 'Poste non détecté') + '</strong><span>' + esc(o.company || '') + '</span></div></div>' +
      '<p class="fine center">Estimation de correspondance par mots-clés. Elle ne garantit aucun résultat.</p>' +
      '<details class="calc"><summary>Détail du calcul du match</summary><ul class="list">' + m.parts.map((p) => '<li>' + esc(p.label) + ' : ' + esc(p.detail) + ' (pondération ' + p.w + ')</li>').join('') + '</ul></details>' +
      (!hasCV() ? '<div class="note warn">Votre CV est vide ou incomplet : le match sera plus faible. <a href="#/cv">Compléter mon CV</a></div>' : '') + '</section>' +
      '<div class="grid-2"><section class="card"><h3 class="ok-h">Correspondances</h3>' + (m.matched.length ? '<ul class="list ok">' + m.matched.map((k) => '<li><span aria-hidden="true">✓</span> ' + esc(k.term) + '</li>').join('') + '</ul>' : empty('Aucune correspondance détectée.')) + '<h4>Compétences correspondantes (obligatoires)</h4><p class="fine">' + m.reqFound + ' sur ' + m.reqTotal + ' critères obligatoires couverts.</p></section>' +
      '<section class="card"><h3 class="warn-h">Mots-clés manquants</h3>' + (m.missing.length || m.missingNice.length ? '<ul class="list warn">' + m.missing.map((k) => '<li><span aria-hidden="true">⚠</span> ' + esc(k.term) + ' <small>(obligatoire)</small></li>').join('') + m.missingNice.map((k) => '<li><span aria-hidden="true">⚠</span> ' + esc(k.term) + ' <small>(souhaité)</small></li>').join('') + '</ul>' : empty('Aucun mot-clé manquant.')) +
      '<p class="fine">N\'ajoutez un mot-clé que s\'il correspond réellement à votre expérience.</p></section></div>' +
      '<div class="grid-2"><section class="card"><h3>Compétences à vérifier</h3>' + (m.verify.length ? '<ul class="list">' + m.verify.map((v) => '<li><strong>' + esc(v.term) + '</strong> : absent du CV, mais vous pratiquez peut-être un équivalent (' + esc(v.related.join(', ')) + '). ' + esc(Gen.MISSING_NOTE) + '</li>').join('') + '</ul>' : empty('Aucune équivalence proche détectée.')) + '</section>' +
      '<section class="card"><h3>Expériences pertinentes</h3>' + (m.relevantExperiences.length ? '<ul class="list">' + m.relevantExperiences.map((e) => '<li><strong>' + esc(e.title || 'Poste') + '</strong>' + (e.company ? ' — ' + esc(e.company) : '') + '<br><small>' + esc(e.terms.slice(0, 6).join(', ') || 'Intitulé proche') + '</small></li>').join('') + '</ul>' : empty('Aucune expérience ne recoupe les exigences détectées.')) + '</section></div>' +
      '<section class="card"><h3>Extraction de l\'offre</h3><dl class="facts">' + fact('Poste', o.title) + fact('Entreprise', o.company) + fact('Localisation', o.location) + fact('Contrat', o.contract) + fact('Niveau d\'expérience', o.experienceLevel) + fact('Formation', o.education.join(' ; ')) + '</dl>' +
      '<div class="grid-2"><div class="blk"><h4>Compétences obligatoires</h4>' + kwChips(o.required) + '</div><div class="blk"><h4>Compétences souhaitées</h4>' + kwChips(o.nice) + '</div>' +
      '<div class="blk"><h4>Logiciels</h4>' + kwChips(o.software) + '</div><div class="blk"><h4>Technologies</h4>' + kwChips(o.tech) + '</div>' +
      '<div class="blk"><h4>Langues</h4>' + (o.languages.length ? chips(o.languages.map((l) => l.name + (l.level ? ' — ' + l.level : ''))) : '<p class="muted">Aucune</p>') + '</div><div class="blk"><h4>Mots-clés ATS</h4>' + chips(o.keywords.filter((k) => k.cat !== 'langue').map((k) => k.term).concat(o.frequent.map((k) => k.term))) + '</div>' +
      listBlock('Missions', o.missions) + listBlock('Responsabilités', o.responsibilities) + '</div>' +
      (o.notes.length ? '<p class="fine">Éléments non détectés automatiquement : ' + esc(o.notes.join(', ')) + '. Vérifiez le texte de l\'offre.</p>' : '') + '</section>' +
      '<div class="actions sticky-actions">' + btn('Optimiser mon CV pour cette offre', 'go-tailor', { cls: 'btn-primary', icon: 'wand' }) + btn('Générer la lettre', 'go-letter', { icon: 'mail' }) + btn('Préparer l\'entretien', 'go-interview', { icon: 'mic' }) + btn('Préparer ma candidature', 'prepare-app', { icon: 'check' }) + '</div>';
  }

  function offerPage() {
    const rec = currentOffer();
    return '<div class="page-head"><div><h1>Analyser une offre</h1><p class="muted">Collez l\'offre : l\'application extrait les exigences et les compare à votre CV.</p></div></div>' +
      '<div class="split"><section class="card sticky"><h2>Offre d\'emploi</h2>' +
      (state.jobOffers.length ? field('Offres enregistrées', 'ui.savedOffer', state.currentOfferId || '', { type: 'select', options: [['', '—']].concat(state.jobOffers.map((o) => [o.id, (o.parsed.title || 'Offre') + (o.parsed.company ? ' — ' + o.parsed.company : '')])) }) : '') +
      field('Collez votre offre d\'emploi ici', 'ui.offerDraft', ui.offerDraft, { type: 'textarea', rows: 18, ph: 'Titre du poste, missions, profil recherché…' }) +
      '<div class="actions">' + btn('Analyser l\'offre', 'analyze-offer', { cls: 'btn-primary', icon: 'briefcase' }) + btn('Charger un exemple', 'load-offer-demo', { icon: 'file' }) + (rec ? btn('Supprimer cette offre', 'del-offer', { cls: 'btn-danger', icon: 'trash' }) : '') + '</div></section>' +
      '<div id="offerPanel">' + offerPanel(rec) + '</div></div>';
  }

  /* ---------------------------- Adapter le CV ---------------------------- */
  function offerSelect(bind, val) {
    return field('Offre ciblée', bind, val, { type: 'select', options: [['', '— Choisir une offre —']].concat(state.jobOffers.map((o) => [o.id, (o.parsed.title || 'Offre') + (o.parsed.company ? ' — ' + o.parsed.company : '')])) });
  }
  function cvSourceSelect() {
    return field('CV utilisé', 'ui.cvSource', ui.cvSource, { type: 'select', options: [['master', 'Mon CV principal']].concat(state.generatedCVs.map((g) => [g.id, 'Version : ' + g.label])) });
  }

  function tailorView() {
    const t = ui.tailored;
    if (!t) return '<section class="card"><h2>Résultat</h2><p class="muted">Choisissez une offre puis cliquez sur « Optimiser mon CV pour cette offre ». Vous verrez côte à côte le CV original et le CV optimisé, avec les modifications surlignées.</p>' +
      '<ul class="list"><li>Seules des informations vraies sont conservées</li><li>Les mots-clés de l\'offre sont utilisés uniquement s\'ils correspondent à votre profil</li><li>Résumé, compétences et réalisations sont réordonnés et reformulés</li></ul></section>';
    const master = getCV();
    const gain = t.matchAfter - t.matchBefore;
    return '<section class="card"><div class="score-flex"><div class="delta"><span class="fine">Match avant</span><strong>' + t.matchBefore + ' %</strong></div><span aria-hidden="true">' + icon('arrow', 26) + '</span><div class="delta"><span class="fine">Match après</span><strong class="' + tone(t.matchAfter) + '">' + t.matchAfter + ' %</strong></div>' +
      '<p class="fine grow">' + (gain > 0 ? 'Gain de ' + gain + ' point(s) grâce à la reformulation.' : 'Le score ne progresse que si votre CV contient réellement les termes recherchés : aucun mot-clé n\'est ajouté artificiellement.') + '</p></div></section>' +
      '<div class="compare-cv"><section><h2>CV original</h2><div class="paper small"><div>' + Gen.renderCVHtml(master, { marks: t.beforeMarks }) + '</div></div></section>' +
      '<section><h2>CV optimisé <span class="legend"><mark>modifié</mark></span></h2><div class="paper small"><div id="tailorPreview">' + Gen.renderCVHtml(t.cv, { marks: t.marks }) + '</div></div></section></div>' +
      '<section class="card"><h3>Modifications appliquées</h3>' + (t.changes.length ? '<ul class="list">' + t.changes.map((c) => '<li><strong>' + esc(c.where) + '</strong> : ' + (c.before ? 'reformulé (« ' + esc(c.before.slice(0, 80)) + (c.before.length > 80 ? '…' : '') + ' » → « ' + esc(c.after.slice(0, 120)) + (c.after.length > 120 ? '…' : '') + ' »)' : esc(c.after)) + '</li>').join('') + '</ul>' : empty('Aucune modification nécessaire.')) +
      (t.notAdded.length ? '<h4>Mots-clés de l\'offre non ajoutés (absents de votre CV)</h4>' + chips(t.notAdded, 'warn') + '<p class="fine">Ajoutez-les vous-même dans « Mon CV » uniquement s\'ils correspondent réellement à votre expérience.</p>' : '') + '</section>' +
      '<details class="card edit-tailored"><summary>Modifier manuellement la version optimisée</summary>' + field('Résumé professionnel', 'ui.tailored.cv.candidateProfile.summary', t.cv.candidateProfile.summary, { type: 'textarea', rows: 5 }) +
      t.cv.experiences.map((e, i) => field('Réalisations — ' + [e.title, e.company].filter(Boolean).join(' — '), 'ui.tailored.cv.experiences.' + i + '.bullets', (e.bullets || []).join('\n'), { type: 'textarea', rows: 5, kind: 'lines' })).join('') + '</details>' +
      '<div class="actions">' + btn('Enregistrer cette version', 'save-tailored', { cls: 'btn-primary', icon: 'save' }) + btn('Appliquer à mon CV principal', 'apply-tailored', { icon: 'check' }) +
      btn('PDF', 'export-cv', { icon: 'download', data: { format: 'pdf', src: 'tailored' } }) + btn('DOCX', 'export-cv', { icon: 'download', data: { format: 'docx', src: 'tailored' } }) + btn('Copier', 'export-cv', { icon: 'copy', data: { format: 'copy', src: 'tailored' } }) + btn('Imprimer', 'export-cv', { icon: 'print', data: { format: 'print', src: 'tailored' } }) + '</div>';
  }

  function tailorPage() {
    if (!ui.tailorOfferId) ui.tailorOfferId = state.currentOfferId || '';
    return '<div class="page-head"><div><h1>Adapter mon CV</h1><p class="muted">Générez une version du CV alignée sur l\'offre, sans inventer quoi que ce soit.</p></div></div>' +
      '<section class="card toolbar">' + offerSelect('ui.tailorOfferId', ui.tailorOfferId) + btn('Optimiser mon CV pour cette offre', 'tailor', { cls: 'btn-primary', icon: 'wand' }) + '</section>' +
      (state.jobOffers.length ? '' : '<div class="note warn">Aucune offre enregistrée. <a href="#/offer">Analysez d\'abord une offre</a>.</div>') +
      '<div id="tailorBody">' + tailorView() + '</div>' +
      (state.generatedCVs.length ? '<section class="card"><h3>Versions enregistrées</h3><ul class="saved">' + state.generatedCVs.map((g) => '<li><span><strong>' + esc(g.label) + '</strong><small> · ' + fmtDate(g.createdAt) + (g.matchAfter != null ? ' · match ' + g.matchAfter + ' %' : '') + '</small></span><span class="row-actions">' +
        btn('PDF', 'export-cv', { cls: 'btn-sm', data: { format: 'pdf', src: g.id } }) + btn('DOCX', 'export-cv', { cls: 'btn-sm', data: { format: 'docx', src: g.id } }) + btn('Supprimer', 'del-saved', { cls: 'btn-sm btn-danger', data: { kind: 'generatedCVs', id: g.id } }) + '</span></li>').join('') + '</ul></section>' : '');
  }

  /* ---------------------------- Lettre ---------------------------- */
  function letterPage() {
    const o = ui.letterOpts;
    if (!o.offerId) o.offerId = state.currentOfferId || '';
    const letter = state.coverLetters.find((l) => l.id === ui.letterId);
    return '<div class="page-head"><div><h1>Lettre de motivation</h1><p class="muted">Six paragraphes construits à partir de votre CV et de l\'offre. Tout reste modifiable.</p></div></div>' +
      '<div class="split"><section class="card"><h2>Paramètres</h2>' + offerSelect('ui.letterOpts.offerId', o.offerId) + cvSourceSelect() +
      '<div class="row">' + field('Entreprise', 'ui.letterOpts.company', o.company, { ph: 'Par défaut : entreprise de l\'offre' }) + field('Poste', 'ui.letterOpts.position', o.position, { ph: 'Par défaut : poste de l\'offre' }) + '</div>' +
      '<div class="row">' + field('Longueur', 'ui.letterOpts.length', o.length, { type: 'select', options: [['courte', 'Courte'], ['standard', 'Standard'], ['détaillée', 'Détaillée']] }) + field('Ton', 'ui.letterOpts.tone', o.tone, { type: 'select', options: [['professionnel', 'Professionnel'], ['direct', 'Direct'], ['chaleureux', 'Chaleureux'], ['très formel', 'Très formel']] }) + '</div>' +
      field('Pourquoi ce poste ? (vos mots)', 'ui.letterOpts.motivationPosition', o.motivationPosition, { type: 'textarea', rows: 3, hint: 'Sans votre motivation réelle, un passage « Information manquante » est laissé à compléter.' }) +
      field('Pourquoi cette entreprise ? (vos mots)', 'ui.letterOpts.motivationCompany', o.motivationCompany, { type: 'textarea', rows: 3 }) +
      '<div class="actions">' + btn('Générer ma lettre', 'gen-letter', { cls: 'btn-primary', icon: 'sparkle' }) + '</div></section>' +
      '<section class="card" id="letterBox">' + letterBox(letter) + '</section></div>';
  }
  function letterBox(letter) {
    if (!letter) return '<h2>Votre lettre</h2><p class="muted">Cliquez sur « Générer ma lettre ». Le texte apparaît ici, entièrement modifiable.</p>';
    const idx = state.coverLetters.indexOf(letter);
    return '<h2>Votre lettre</h2><div id="letterWarn">' + letterWarn(letter.text) + '</div><label class="sr-only" for="letterText">Texte de la lettre</label><textarea id="letterText" class="letter-text" rows="26" data-bind="coverLetters.' + idx + '.text">' + esc(letter.text) + '</textarea>' +
      '<div class="actions">' + btn('Copier la lettre', 'export-letter', { icon: 'copy', data: { format: 'copy' } }) + btn('Télécharger en PDF', 'export-letter', { icon: 'download', data: { format: 'pdf' } }) + btn('DOCX', 'export-letter', { icon: 'download', data: { format: 'docx' } }) + btn('Imprimer', 'export-letter', { icon: 'print', data: { format: 'print' } }) + '</div>';
  }
  const letterWarn = (txt) => { const n = (txt.match(/\[Information manquante/g) || []).length; return n ? '<div class="note warn" role="status">' + n + ' passage(s) à compléter, repérables par « [Information manquante — … ] » : remplacez-les par votre propre contenu, correspondant à votre situation réelle.</div>' : '<div class="note ok">Aucun passage à compléter détecté.</div>'; };

  /* ---------------------------- Entretien ---------------------------- */
  function qCard(q, qi, pi) {
    const b = 'interviewPreparations.' + pi + '.questions.' + qi + '.';
    return '<details class="q"><summary><span class="q-text">' + esc(q.question) + '</span>' + badge(q.type === 'behavioral' ? 'Comportementale · STAR' : q.group === 'specific' ? 'Offre' : 'Générale', q.type === 'behavioral' ? 'violet' : 'gray') + '</summary><div class="q-body">' +
      '<h4>Éléments du CV pertinents</h4>' + (q.cvElements.length ? '<ul class="list">' + q.cvElements.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="muted">Aucun élément du CV ne correspond directement. Appuyez-vous sur une situation réelle.</p>') +
      field('Réponse suggérée (modifiable)', b + 'answer', q.answer, { type: 'textarea', rows: 5 }) + field('Exemple concret', b + 'example', q.example, { type: 'textarea', rows: 2, ph: 'Un exemple réel, daté et chiffré si possible' }) +
      (q.star ? '<div class="star"><h4>Méthode STAR</h4>' + [['s', 'S — Situation'], ['t', 'T — Tâche'], ['a', 'A — Action'], ['r', 'R — Résultat']].map(([k, l]) => field(l, b + 'star.' + k, q.star[k], { type: 'textarea', rows: 2 })).join('') +
        '<div class="inline-actions"><label class="sr-only" for="star-' + qi + '">Construire la trame à partir d\'une expérience</label><select id="star-' + qi + '" data-change-action="star-from" data-q="' + qi + '"><option value="">Reconstruire à partir d\'une expérience…</option>' + state.experiences.map((e, i) => '<option value="' + i + '">' + esc([e.title, e.company].filter(Boolean).join(' — ')) + '</option>').join('') + '</select></div></div>' : '') +
      '<p class="tip"><strong>Conseil :</strong> ' + esc(q.tip) + '</p></div></details>';
  }

  function prepView(prep, pi) {
    const base = 'interviewPreparations.' + pi + '.';
    const nMiss = (Interview.prepToText(prep).match(/\[Information manquante/g) || []).length;
    const qs = (grp) => prep.questions.map((q, qi) => ({ q, qi })).filter((x) => x.q.group === grp).map((x) => qCard(x.q, x.qi, pi)).join('');
    return '<div class="note ' + (nMiss ? 'warn' : 'ok') + '" role="status">' + (nMiss ? nMiss + ' élément(s) « Information manquante » à compléter à partir de votre expérience réelle. Les réponses sont des bases de travail : relisez-les et personnalisez-les.' : 'Aucun passage manquant détecté.') + '</div>' +
      '<section class="card"><h2>1. Présentation du candidat — pitch de 60 secondes</h2>' + field('Pitch (modifiable)', base + 'pitch.text', prep.pitch.text, { type: 'textarea', rows: 7, hint: '≈ ' + prep.pitch.words + ' mots, soit environ ' + prep.pitch.seconds + ' s à l\'oral (150 mots/min).' }) + '</section>' +
      '<section class="card"><h2>2. Questions probables</h2>' + qs('generic') + '</section>' +
      (prep.questions.some((q) => q.group === 'specific') ? '<section class="card"><h2>3. Questions spécifiques à l\'offre</h2>' + qs('specific') + '</section>' : '') +
      '<section class="card"><h2>4. Points de vigilance</h2>' + (prep.vigilance.length ? prep.vigilance.map((v, vi) => '<div class="vig"><h4>' + esc(v.label) + '</h4><p class="muted">' + esc(v.detail) + '</p>' + field('Comment répondre sans mentir', base + 'vigilance.' + vi + '.answer', v.answer, { type: 'textarea', rows: 4 }) + '</div>').join('') : empty('Aucun point de vigilance détecté. Vérifiez néanmoins : période sans emploi, changements fréquents, manque d\'expérience, changement de secteur, niveau de langue, reconversion.')) + '</section>' +
      '<div class="actions">' + btn('Copier', 'export-prep', { icon: 'copy', data: { format: 'copy' } }) + btn('Télécharger en PDF', 'export-prep', { icon: 'download', data: { format: 'pdf' } }) + btn('Imprimer', 'export-prep', { icon: 'print', data: { format: 'print' } }) + '</div>';
  }

  function interviewPage() {
    if (!ui.prepOfferId) ui.prepOfferId = state.currentOfferId || '';
    const pi = state.interviewPreparations.findIndex((p) => p.id === ui.prepId);
    return '<div class="page-head"><div><h1>Préparation entretien</h1><p class="muted">Pitch, questions probables, réponses ancrées dans votre CV, trames STAR et points de vigilance.</p></div></div>' +
      '<section class="card toolbar">' + offerSelect('ui.prepOfferId', ui.prepOfferId) + cvSourceSelect() + btn('Générer la fiche', 'gen-prep', { cls: 'btn-primary', icon: 'sparkle' }) + '</section>' +
      (pi >= 0 ? prepView(state.interviewPreparations[pi], pi) : '<section class="card"><h2>INTERVIEW PREP</h2><p class="muted">Choisissez une offre (recommandé) puis générez la fiche. Sans offre, seules les questions générales sont produites.</p></section>') +
      (state.interviewPreparations.length ? '<section class="card"><h3>Fiches enregistrées</h3><ul class="saved">' + state.interviewPreparations.map((p) => '<li><span><strong>' + esc(p.position || 'Fiche') + (p.company ? ' — ' + esc(p.company) : '') + '</strong><small> · ' + fmtDate(p.createdAt) + '</small></span><span class="row-actions">' + btn('Ouvrir', 'open-prep', { cls: 'btn-sm', data: { id: p.id } }) + btn('Supprimer', 'del-saved', { cls: 'btn-sm btn-danger', data: { kind: 'interviewPreparations', id: p.id } }) + '</span></li>').join('') + '</ul></section>' : '');
  }

  /* ---------------------------- Candidatures ---------------------------- */
  function appDetail(a) {
    const cv = state.generatedCVs.find((g) => g.id === a.cvId), letter = state.coverLetters.find((l) => l.id === a.letterId), prep = state.interviewPreparations.find((p) => p.id === a.prepId);
    const cell = (l, v) => '<div class="s-cell"><dt>' + l + '</dt><dd>' + v + '</dd></div>';
    return '<section class="card"><div class="card-head"><h2>Candidature : ' + esc(a.title) + '</h2>' + btn('Fermer', 'app-close', { cls: 'btn-sm' }) + '</div><dl class="summary-grid">' +
      cell('POSTE', esc(a.title)) + cell('ENTREPRISE', esc(a.company)) + cell('MATCH ATS', a.match != null ? a.match + ' %' : '—') +
      cell('CV', cv ? esc(cv.label) + '<br>' + btn('PDF', 'export-cv', { cls: 'btn-sm', data: { format: 'pdf', src: cv.id } }) : '<span class="muted">Non généré</span>') +
      cell('LETTRE', letter ? 'Générée le ' + fmtDate(letter.createdAt) + '<br>' + btn('Ouvrir', 'open-letter', { cls: 'btn-sm', data: { id: letter.id } }) : '<span class="muted">Non générée</span>') +
      cell('ENTRETIEN', prep ? 'Fiche du ' + fmtDate(prep.createdAt) + '<br>' + btn('Ouvrir', 'open-prep', { cls: 'btn-sm', data: { id: prep.id } }) : '<span class="muted">Non générée</span>') +
      cell('STATUT', '<label class="sr-only" for="st-' + a.id + '">Statut</label><select id="st-' + a.id + '" data-change-action="app-status" data-id="' + a.id + '">' + Data.STATUSES.map((s) => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>') + '</dl>' +
      '<div class="actions">' + btn('Préparer ma candidature', 'prepare-app', { cls: 'btn-primary', icon: 'sparkle', data: { id: a.id } }) + (a.url ? '<a class="btn" href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">Voir l\'offre</a>' : '') + '</div>' +
      '<p class="fine">' + icon('shield', 14) + ' Aucun envoi automatique : téléchargez vos documents et envoyez-les vous-même, après relecture.</p></section>';
  }

  function applicationsPage() {
    const apps = state.applications.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const sel = state.applications.find((a) => a.id === ui.applicationId);
    return '<div class="page-head"><div><h1>Mes candidatures</h1><p class="muted">Suivi personnel de vos candidatures.</p></div><div class="actions">' + btn('Nouvelle candidature', 'app-new', { cls: 'btn-primary', icon: 'plus' }) + btn('Préparer ma candidature', 'prepare-app', { icon: 'sparkle', title: 'Utilise l\'offre active' }) + '</div></div>' +
      (sel ? appDetail(sel) : '') +
      '<section class="card">' + (apps.length ? '<div class="table-wrap"><table><thead><tr><th scope="col">Poste</th><th scope="col">Entreprise</th><th scope="col">Date</th><th scope="col" class="num">Match</th><th scope="col">Documents</th><th scope="col">Statut</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        apps.map((a) => '<tr><td>' + esc(a.title) + '</td><td>' + esc(a.company) + '</td><td>' + fmtDate(a.date) + '</td><td class="num">' + (a.match != null ? a.match + ' %' : '—') + '</td><td>' + [a.cvId ? badge('CV', 'blue') : '', a.letterId ? badge('Lettre', 'blue') : '', a.prepId ? badge('Entretien', 'blue') : ''].join(' ') + '</td>' +
          '<td><label class="sr-only" for="s' + a.id + '">Statut de ' + esc(a.title) + '</label><select id="s' + a.id + '" data-change-action="app-status" data-id="' + a.id + '">' + Data.STATUSES.map((s) => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td>' +
          '<td class="row-actions">' + btn('Ouvrir', 'app-open', { cls: 'btn-sm', data: { id: a.id } }) + btn('Supprimer', 'del-saved', { cls: 'btn-sm btn-danger', data: { kind: 'applications', id: a.id } }) + '</td></tr>').join('') + '</tbody></table></div>' :
        empty('Aucune candidature. Créez-en une ou analysez une offre puis cliquez sur « Préparer ma candidature ».')) + '</section>';
  }

  function appForm(a) {
    a = a || { company: '', title: '', url: '', date: new Date().toISOString().slice(0, 10), status: 'À préparer', offerId: state.currentOfferId || '' };
    const f = (id, label, val, type) => '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></div>';
    return '<div class="row">' + f('ap-title', 'Poste', a.title) + f('ap-company', 'Entreprise', a.company) + '</div><div class="row">' + f('ap-date', 'Date', a.date, 'date') + f('ap-url', 'Lien de l\'offre', a.url, 'url') + '</div>' +
      '<div class="field"><label for="ap-offer">Offre analysée associée</label><select id="ap-offer"><option value="">Aucune</option>' + state.jobOffers.map((o) => '<option value="' + o.id + '"' + (o.id === a.offerId ? ' selected' : '') + '>' + esc((o.parsed.title || 'Offre') + (o.parsed.company ? ' — ' + o.parsed.company : '')) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="ap-status">Statut</label><select id="ap-status">' + Data.STATUSES.map((s) => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>';
  }

  /* ---------------------------- Paramètres ---------------------------- */
  function settingsPage() {
    const S = state.settings;
    return '<div class="page-head"><div><h1>Paramètres</h1></div></div><div class="grid-2">' +
      '<section class="card"><h2>Préférences du CV</h2>' + field('Pays cible par défaut', 'settings.country', S.country, { type: 'select', options: Object.keys(Data.COUNTRIES).map((c) => [c, c]) }) + templatePicker() +
      field('Langue des titres de sections', 'settings.cvLang', S.cvLang, { type: 'select', options: [['fr', 'Français'], ['en', 'English']] }) + '</section>' +
      '<section class="card"><h2>Fournisseur IA</h2><p class="muted">Le MVP fonctionne avec des moteurs locaux (réponses simulées). Pour brancher OpenAI, Claude ou Gemini, exposez un endpoint backend : <code>POST {task, payload} → {result}</code>.</p>' +
      field('Fournisseur', 'settings.aiProvider', S.aiProvider, { type: 'select', options: [['local', 'Local (simulé, par défaut)'], ['backend', 'Backend personnalisé']] }) +
      field('URL de votre backend', 'settings.aiEndpoint', S.aiEndpoint, { type: 'url', ph: 'https://api.exemple.com/ai/generate', hint: 'Ne saisissez <strong>jamais</strong> de clé API ici : elle doit rester côté serveur. Chaque envoi demandera votre confirmation.' }) + '</section>' +
      '<section class="card"><h2>Mes données</h2><p class="muted">Stockées uniquement dans ce navigateur (localStorage).</p><div class="stack">' +
      btn('Exporter mes données (JSON)', 'data-export', { icon: 'download' }) + '<div class="field"><label for="importJson">Importer un export JSON</label><input type="file" id="importJson" accept="application/json,.json"></div>' +
      btn('Charger les données de démonstration', 'load-demo', { icon: 'user' }) + (state.demo ? btn('Supprimer les données de démonstration', 'clear-demo', { cls: 'btn-danger', icon: 'trash' }) : '') +
      btn('Supprimer toutes mes données', 'wipe', { cls: 'btn-danger', icon: 'trash' }) + '</div></section>' +
      '<section class="card"><h2>Transparence</h2><ul class="list"><li>Le score ATS est une estimation d\'optimisation interne, pas le calcul d\'un ATS réel.</li><li>Aucun CV n\'est envoyé sans votre confirmation.</li><li>Les règles par pays sont des usages courants, variables selon secteur et employeur.</li><li>Prévu pour la suite : authentification, chiffrement, suppression de compte, export RGPD.</li></ul></section></div>';
  }

  /* ================================================================== */
  /* Routage et rendu                                                     */
  /* ================================================================== */
  const ROUTES = { dashboard, cv: cvPage, analyze: analyzePage, offer: offerPage, tailor: tailorPage, letter: letterPage, interview: interviewPage, applications: applicationsPage, settings: settingsPage };
  const TITLES = { dashboard: 'Tableau de bord', cv: 'Mon CV', analyze: 'Analyser mon CV', offer: 'Analyser une offre', tailor: 'Adapter mon CV', letter: 'Lettre de motivation', interview: 'Préparation entretien', applications: 'Mes candidatures', settings: 'Paramètres' };
  const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');
  const go = (r) => { if (currentRoute() === r) render(); else location.hash = '#/' + r; };

  function shell(route, inner) {
    const nav = NAV.map(([k, l, ic]) => '<a href="#/' + k + '" class="' + (k === route ? 'on' : '') + '"' + (k === route ? ' aria-current="page"' : '') + '>' + icon(ic, 20) + '<span>' + l + '</span></a>').join('');
    const short = NAV.filter((n) => ['dashboard', 'cv', 'offer', 'letter', 'applications'].includes(n[0]));
    return '<a class="skip" href="#main">Aller au contenu</a><div class="app"><aside class="sidebar"><a class="brand" href="#/">' + logo + '<span>CV ATS PRO</span></a><nav aria-label="Navigation de l\'application">' + nav + '</nav><p class="side-note">Score = estimation d\'optimisation, sans garantie.</p></aside>' +
      '<div class="content">' + (state.demo ? '<div class="demo-banner" role="status"><span>Données de démonstration (profil fictif).</span>' + btn('Supprimer les données de démo', 'clear-demo', { cls: 'btn-sm' }) + '</div>' : '') +
      '<main id="main" tabindex="-1">' + inner + '</main></div>' +
      '<nav class="bottom-nav" aria-label="Navigation mobile">' + short.map(([k, l, ic]) => '<a href="#/' + k + '" class="' + (k === route ? 'on' : '') + '"' + (k === route ? ' aria-current="page"' : '') + '>' + icon(ic, 22) + '<span>' + l.split(' ')[0] + '</span></a>').join('') +
      '<button type="button" data-action="more-menu" aria-haspopup="dialog">' + icon('list', 22) + '<span>Plus</span></button></nav></div>';
  }

  function render() {
    const route = currentRoute(), app = $('#app');
    const view = ROUTES[route];
    if (!view) { app.innerHTML = landing(); document.title = 'CV ATS PRO — CV optimisé pour les ATS'; window.scrollTo(0, 0); return; }
    const y = window.scrollY;
    app.innerHTML = shell(route, view());
    document.title = TITLES[route] + ' — CV ATS PRO';
    if (render.last !== route) { window.scrollTo(0, 0); const m = $('#main'); if (m) m.focus({ preventScroll: true }); }
    else window.scrollTo(0, y);
    render.last = route;
    if (!state.onboarded) welcome();
  }

  function welcome() {
    if ($('#modal')) return;
    openModal('Bienvenue sur CV ATS PRO',
      '<p>Pour découvrir l\'application tout de suite, chargez un profil fictif (Emma Martin, Digital Project Manager) avec une offre d\'exemple. Vous pourrez le supprimer à tout moment.</p><p class="fine">Vos données restent dans ce navigateur.</p>',
      btn('Utiliser les données de démonstration', 'load-demo', { cls: 'btn-primary' }) + btn('Commencer avec un profil vide', 'start-empty'));
  }

  /* ================================================================== */
  /* Actions                                                              */
  /* ================================================================== */
  function loadDemo() {
    const d = Data.demoState(), b = blankState();
    state = Object.assign(b, d, { settings: state.settings, demo: true, onboarded: true });
    const parsed = Engine.analyzeJobOffer(Data.DEMO_OFFER);
    const rec = { id: U.uid('offer'), raw: Data.DEMO_OFFER, parsed, createdAt: nowIso() };
    state.jobOffers = [rec]; state.currentOfferId = rec.id;
    const today = new Date(), d2 = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
    state.applications = [
      { id: U.uid('app'), title: 'Chef de projet', company: 'Entreprise A', date: d2(1), url: '', offerId: '', match: 87, status: 'Prête' },
      { id: U.uid('app'), title: 'Responsable commercial', company: 'Entreprise B', date: d2(6), url: '', offerId: '', match: 78, status: 'Envoyée' },
      { id: U.uid('app'), title: 'Business Developer', company: 'Entreprise C', date: d2(12), url: '', offerId: '', match: 91, status: 'Entretien' },
    ];
    ui.offerDraft = Data.DEMO_OFFER; ui.analysis = null; ui.tailored = null; ui.letterId = null; ui.prepId = null; ui.step = 0;
    saveProfile(); closeModal(); render(); toast('Données de démonstration chargées (profil fictif).');
  }

  function clearDemo() {
    if (!confirm('Supprimer les données de démonstration ? Votre profil sera vidé.')) return;
    const settings = state.settings;
    state = Object.assign(blankState(), { settings, onboarded: true });
    ui.analysis = null; ui.tailored = null; ui.letterId = null; ui.prepId = null; ui.offerDraft = ''; ui.importText = '';
    saveProfile(); render(); toast('Données de démonstration supprimées.');
  }

  function analyzeOffer() {
    const raw = (ui.offerDraft || '').trim();
    if (raw.length < 30) { toast('Collez une offre d\'emploi plus complète (au moins quelques lignes).'); return; }
    let rec = state.jobOffers.find((o) => o.raw.trim() === raw);
    if (!rec) { rec = { id: U.uid('offer'), raw, parsed: Engine.analyzeJobOffer(raw), createdAt: nowIso() }; state.jobOffers.push(rec); }
    state.currentOfferId = rec.id; saveProfile(); render();
    const p = $('#offerPanel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function generate(task, payload) {
    const { result, source, error } = await AI.generate(task, payload);
    if (error && source !== 'local') toast('Fournisseur IA indisponible (' + error + ') : génération locale utilisée.');
    return result;
  }

  async function doTailor() {
    const offer = offerById(ui.tailorOfferId);
    if (!offer) { toast('Choisissez d\'abord une offre.'); return; }
    if (!hasCV()) { toast('Complétez d\'abord votre CV (nom et au moins une expérience).'); return; }
    const t = await generate('tailorCV', { cv: getCV(), offer: offer.parsed });
    ui.tailored = { offerId: offer.id, cv: t.cv, changes: t.changes, marks: t.marks, beforeMarks: t.beforeMarks, matchBefore: t.matchBefore.score, matchAfter: t.matchAfter.score, notAdded: t.notAdded };
    $('#tailorBody').innerHTML = tailorView();
  }

  async function doLetter() {
    const o = ui.letterOpts, offer = offerById(o.offerId);
    const cv = cvFromSource(ui.cvSource);
    if (!(cv.candidateProfile.firstName || cv.candidateProfile.lastName)) { toast('Renseignez d\'abord votre nom dans « Mon CV ».'); return; }
    const L = await generate('coverLetter', { cv, offer: offer ? offer.parsed : null, opts: Object.assign({}, o, { company: o.company || (offer && offer.parsed.company) || '', position: o.position || (offer && offer.parsed.title) || '' }) });
    const rec = { id: U.uid('letter'), offerId: o.offerId, opts: U.clone(o), text: L.text, missing: L.missing, createdAt: nowIso() };
    state.coverLetters.push(rec); ui.letterId = rec.id; saveProfile();
    $('#letterBox').innerHTML = letterBox(rec);
  }

  async function doPrep() {
    const offer = offerById(ui.prepOfferId), cv = cvFromSource(ui.cvSource);
    if (!cv.experiences.length) { toast('Ajoutez d\'abord au moins une expérience à votre CV.'); return; }
    const P = await generate('interviewPrep', { cv, offer: offer ? offer.parsed : null, opts: {} });
    P.offerId = offer ? offer.id : ''; state.interviewPreparations.push(P); ui.prepId = P.id; saveProfile(); render();
  }

  async function prepareApplication(appId) {
    let app = appId ? state.applications.find((a) => a.id === appId) : null;
    const offerRec = offerById((app && app.offerId) || state.currentOfferId);
    if (!offerRec) { toast('Analysez d\'abord une offre d\'emploi : elle sert de base à la candidature.'); go('offer'); return; }
    if (!hasCV()) { toast('Complétez d\'abord votre CV (nom et au moins une expérience).'); go('cv'); return; }
    const offer = offerRec.parsed, cv = getCV();
    const t = await generate('tailorCV', { cv, offer });
    const gcv = { id: U.uid('cv'), offerId: offerRec.id, createdAt: nowIso(), label: (offer.title || 'Poste') + (offer.company ? ' — ' + offer.company : ''), cv: t.cv, matchAfter: t.matchAfter.score };
    state.generatedCVs.push(gcv);
    const L = await generate('coverLetter', { cv: t.cv, offer, opts: { length: 'standard', tone: 'professionnel', company: offer.company, position: offer.title, motivationPosition: '', motivationCompany: '' } });
    const letter = { id: U.uid('letter'), offerId: offerRec.id, opts: { length: 'standard', tone: 'professionnel' }, text: L.text, missing: L.missing, createdAt: nowIso() };
    state.coverLetters.push(letter);
    const P = await generate('interviewPrep', { cv: t.cv, offer, opts: {} }); P.offerId = offerRec.id; state.interviewPreparations.push(P);
    if (!app) { app = { id: U.uid('app'), date: new Date().toISOString().slice(0, 10), url: '', status: 'À préparer' }; state.applications.unshift(app); }
    Object.assign(app, { title: offer.title || app.title || 'Poste', company: offer.company || app.company || '', offerId: offerRec.id, cvId: gcv.id, letterId: letter.id, prepId: P.id, match: t.matchAfter.score, status: app.status === 'À préparer' ? 'Prête' : app.status });
    ui.applicationId = app.id; saveProfile(); go('applications'); render();
    toast('Candidature préparée : CV, lettre et fiche d\'entretien générés. ' + (L.missing ? L.missing + ' passage(s) à compléter dans la lettre.' : ''));
  }

  async function doExport(kind, format, src) {
    try {
      let cv;
      if (src === 'tailored') { if (!ui.tailored) return; cv = Object.assign(U.clone(ui.tailored.cv), { settings: getCV().settings }); } else cv = cvFromSource(src || 'master');
      if (kind === 'cv') {
        const offerRec = src === 'tailored' && ui.tailored ? offerById(ui.tailored.offerId) : null;
        const ok = await Gen.exportCV(cv, format, { position: offerRec ? offerRec.parsed.title : undefined });
        if (format === 'copy') toast(ok ? 'CV copié dans le presse-papiers.' : 'Copie impossible : sélectionnez le texte manuellement.');
        else if (format === 'pdf' || format === 'docx') toast('Fichier ' + format.toUpperCase() + ' généré : ' + Gen.fileName(cv, 'CV', offerRec ? offerRec.parsed.title : cv.candidateProfile.title, format));
      }
      state.progress.exported = true; saveSoon();
    } catch (err) { toast('Export impossible : ' + err.message); }
  }

  const actions = {
    'modal-close': closeModal,
    'start-empty': () => { state.onboarded = true; saveProfile(); closeModal(); },
    'load-demo': () => { if (state.experiences.length && !state.demo && !confirm('Remplacer vos données actuelles par la démonstration ?')) return; loadDemo(); },
    'clear-demo': clearDemo,
    'save-profile': () => { if (saveProfile()) toast('CV enregistré dans ce navigateur.'); },
    'toggle-preview': () => { ui.previewMobile = !ui.previewMobile; const l = $('.cv-layout'); if (l) l.classList.toggle('show-preview', ui.previewMobile); const pv = $('.cv-side'); if (pv && ui.previewMobile) pv.scrollIntoView({ behavior: 'smooth' }); },
    'analyze-app': () => { if (!hasCV() && !state.experiences.length) { toast('Complétez d\'abord votre CV.'); go('cv'); return; } if (currentRoute() !== 'analyze') { ui.analysis = null; go('analyze'); } runAnalysis(getCV(), 'CV créé dans l\'application'); },
    'analyze-text': () => { if ((ui.importText || '').trim().length < 80) { toast('Collez le texte complet de votre CV (au moins quelques lignes) ou déposez un fichier.'); return; } runAnalysis({ text: ui.importText, flags: ui.importFlags || {} }, ui.importName ? 'fichier ' + ui.importName : 'texte collé'); },
    'step': (el) => { ui.step = +el.dataset.step; refreshEditor(); },
    'step-next': () => { ui.step = Math.min(STEPS.length - 1, ui.step + 1); refreshEditor(); window.scrollTo({ top: 0 }); },
    'step-prev': () => { ui.step = Math.max(0, ui.step - 1); refreshEditor(); window.scrollTo({ top: 0 }); },
    'add-item': (el) => {
      const l = el.dataset.list, tpl = {
        experiences: () => ({ id: U.uid('exp'), title: '', company: '', location: '', start: '', end: '', current: false, description: '', bullets: [], tools: '' }),
        education: () => ({ id: U.uid('edu'), degree: '', school: '', location: '', year: '', specialty: '' }), languages: () => ({ name: '', level: '' }),
        certifications: () => ({ id: U.uid('cert'), name: '', issuer: '', year: '', number: '' }), projects: () => ({ id: U.uid('proj'), name: '', context: '', role: '', tools: '', results: '' }),
      }[l]();
      state[l].push(tpl); if (l === 'experiences') state.experiences.sort(() => 0); saveSoon(); refreshEditor();
    },
    'del-item': (el) => { if (!confirm('Supprimer cet élément ?')) return; state[el.dataset.list].splice(+el.dataset.idx, 1); saveSoon(); refreshEditor(); },
    'skill-add': (el) => addSkills(el.dataset.cat),
    'skill-del': (el) => { state.skills.splice(+el.dataset.idx, 1); saveSoon(); refreshEditor(); },
    'helper': (el) => { ui.helperId = ui.helperId === el.dataset.id ? null : el.dataset.id; refreshEditor(); },
    'h-tighten': (el) => { const e = state.experiences[+el.dataset.exp], i = +el.dataset.b; e.bullets[i] = Gen.tightenBullet(e.bullets[i]); saveSoon(); refreshEditor(); },
    'h-compose': (el) => {
      const k = el.dataset.exp + '-' + el.dataset.b, e = state.experiences[+el.dataset.exp], i = +el.dataset.b;
      const d = $('[data-h-detail="' + k + '"]').value, r = $('[data-h-result="' + k + '"]').value;
      if (!d.trim() && !r.trim()) { toast('Renseignez au moins une donnée réelle (chiffre, volume ou résultat).'); return; }
      e.bullets[i] = Gen.composeBullet(e.bullets[i], d, r); saveSoon(); refreshEditor(); toast('Réalisation complétée avec vos données.');
    },
    'gen-summary': async () => {
      if (!state.experiences.length && !state.candidateProfile.title) { toast('Ajoutez au moins un titre et une expérience pour générer un résumé fondé sur vos données.'); return; }
      if (state.candidateProfile.summary.trim() && !confirm('Remplacer le résumé actuel par la proposition ?')) return;
      state.candidateProfile.summary = await generate('summary', { cv: getCV(), offer: null }); saveSoon(); refreshEditor(); toast('Résumé proposé à partir de vos données : relisez-le et ajustez-le.');
    },
    'export-cv': (el) => doExport('cv', el.dataset.format, el.dataset.src),
    'export-letter': async (el) => {
      const l = state.coverLetters.find((x) => x.id === ui.letterId); if (!l) return;
      const cv = cvFromSource(ui.cvSource), off = offerById(l.offerId);
      const pos = l.opts.position || (off && off.parsed.title) || cv.candidateProfile.title;
      const ok = await Gen.exportCoverLetter(cv, l.text, el.dataset.format, { position: pos });
      if (el.dataset.format === 'copy') toast(ok ? 'Lettre copiée.' : 'Copie impossible.'); else toast('Lettre exportée.');
      state.progress.exported = true; saveSoon();
    },
    'export-prep': async (el) => {
      const p = state.interviewPreparations.find((x) => x.id === ui.prepId); if (!p) return;
      const ok = await Interview.exportPrep(cvFromSource(ui.cvSource), p, el.dataset.format);
      if (el.dataset.format === 'copy') toast(ok ? 'Fiche copiée.' : 'Copie impossible.'); state.progress.exported = true; saveSoon();
    },
    'analyze-offer': analyzeOffer,
    'load-offer-demo': () => { ui.offerDraft = Data.DEMO_OFFER; const t = $('[data-bind="ui.offerDraft"]'); if (t) t.value = Data.DEMO_OFFER; toast('Offre d\'exemple chargée : cliquez sur « Analyser l\'offre ».'); },
    'del-offer': () => { if (!confirm('Supprimer cette offre ?')) return; state.jobOffers = state.jobOffers.filter((o) => o.id !== state.currentOfferId); state.currentOfferId = state.jobOffers[0] ? state.jobOffers[0].id : null; saveProfile(); render(); },
    'go-tailor': () => { ui.tailorOfferId = state.currentOfferId; ui.tailored = null; go('tailor'); },
    'go-letter': () => { ui.letterOpts.offerId = state.currentOfferId; go('letter'); },
    'go-interview': () => { ui.prepOfferId = state.currentOfferId; go('interview'); },
    'tailor': doTailor,
    'save-tailored': () => {
      const t = ui.tailored; if (!t) return; const off = offerById(t.offerId);
      state.generatedCVs.push({ id: U.uid('cv'), offerId: t.offerId, createdAt: nowIso(), label: ((off && off.parsed.title) || 'Poste') + (off && off.parsed.company ? ' — ' + off.parsed.company : ''), cv: U.clone(t.cv), matchAfter: t.matchAfter });
      saveProfile(); render(); toast('Version optimisée enregistrée.');
    },
    'apply-tailored': () => {
      const t = ui.tailored; if (!t || !confirm('Remplacer résumé, compétences et réalisations de votre CV principal par cette version ? Votre CV actuel sera écrasé.')) return;
      state.candidateProfile = U.clone(t.cv.candidateProfile); state.experiences = U.clone(t.cv.experiences); state.skills = U.clone(t.cv.skills); saveProfile(); toast('CV principal mis à jour.');
    },
    'gen-letter': doLetter,
    'gen-prep': doPrep,
    'open-prep': (el) => { ui.prepId = el.dataset.id; go('interview'); },
    'open-letter': (el) => { ui.letterId = el.dataset.id; go('letter'); },
    'del-saved': (el) => {
      if (!confirm('Supprimer définitivement cet élément ?')) return;
      const k = el.dataset.kind; state[k] = state[k].filter((x) => x.id !== el.dataset.id);
      if (k === 'applications' && ui.applicationId === el.dataset.id) ui.applicationId = null;
      if (k === 'interviewPreparations' && ui.prepId === el.dataset.id) ui.prepId = null; saveProfile(); render();
    },
    'prepare-app': (el) => { if (ui.busy) return; ui.busy = true; prepareApplication(el && el.dataset ? el.dataset.id : null).finally(() => { ui.busy = false; }); },
    'app-new': () => openModal('Nouvelle candidature', appForm(), btn('Enregistrer', 'app-save', { cls: 'btn-primary' }) + btn('Annuler', 'modal-close')),
    'app-save': () => {
      const v = (id) => $('#' + id).value.trim();
      if (!v('ap-title')) { toast('Indiquez au moins le poste.'); return; }
      const offerId = v('ap-offer'), off = offerById(offerId);
      state.applications.unshift({ id: U.uid('app'), title: v('ap-title'), company: v('ap-company'), date: v('ap-date') || new Date().toISOString().slice(0, 10), url: v('ap-url'), offerId, status: v('ap-status'), match: off ? Engine.calculateMatchScore(Engine.buildFeatures(getCV()), off.parsed).score : null });
      saveProfile(); closeModal(); render();
    },
    'app-open': (el) => { ui.applicationId = el.dataset.id; render(); window.scrollTo(0, 0); },
    'app-close': () => { ui.applicationId = null; render(); },
    'more-menu': () => openModal('Menu', '<nav class="more-nav" aria-label="Autres pages">' + NAV.map(([k, l, ic]) => '<a href="#/' + k + '" data-action="modal-close">' + icon(ic, 20) + '<span>' + l + '</span></a>').join('') + '</nav>'),
    'data-export': () => { U.download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'cv-ats-pro-donnees.json'); toast('Export JSON téléchargé.'); },
    'wipe': () => { if (!confirm('Supprimer TOUTES vos données de ce navigateur ? Cette action est irréversible.')) return; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } state = blankState(); state.onboarded = true; ui.analysis = null; ui.tailored = null; saveProfile(); render(); toast('Toutes les données ont été supprimées.'); },
  };

  const changeActions = {
    'app-status': (el) => { const a = state.applications.find((x) => x.id === el.dataset.id); if (a) { a.status = el.value; saveProfile(); if (currentRoute() === 'applications') { const keep = ui.applicationId; render(); ui.applicationId = keep; } } },
    'star-from': (el) => {
      if (el.value === '') return;
      const p = state.interviewPreparations.find((x) => x.id === ui.prepId), q = p.questions[+el.dataset.q], exp = state.experiences[+el.value];
      const best = (exp.bullets || []).filter(Boolean).sort((a, b) => U.hasMetric(b) - U.hasMetric(a))[0];
      q.star = Interview.generateSTARAnswer(q.question, exp, best); saveSoon(); render();
    },
  };

  function addSkills(cat) {
    const input = $('[data-skill-input="' + cat + '"]');
    const names = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    names.forEach((n) => { if (!state.skills.some((s) => s.category === cat && U.norm(s.name) === U.norm(n))) state.skills.push({ name: n, category: cat }); });
    saveSoon(); refreshEditor();
    const again = $('[data-skill-input="' + cat + '"]'); if (again) again.focus();
  }

  function refreshEditor() {
    const body = $('#stepBody');
    if (!body) { render(); return; }
    body.innerHTML = stepContent(ui.step);
    document.querySelectorAll('.stepper button').forEach((b, i) => { b.className = i === ui.step ? 'on' : i < ui.step ? 'past' : ''; if (i === ui.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    const prev = document.querySelector('[data-action="step-prev"]'); if (prev) prev.disabled = ui.step === 0;
    const nxt = $('.step-nav .btn-primary');
    if (nxt) { nxt.dataset.action = ui.step < STEPS.length - 1 ? 'step-next' : 'save-profile'; nxt.querySelector('span').textContent = ui.step < STEPS.length - 1 ? 'Suivant' : 'Terminer'; }
    refreshPreview();
  }
  function refreshPreview() { const pv = $('#cvPreview'); if (pv) pv.innerHTML = Gen.renderCVHtml(getCV()); }

  /* ------------------------------------------------------------------ */
  /* Liaison des champs : data-bind="chemin.vers.la.valeur"               */
  /* ------------------------------------------------------------------ */
  function resolve(path) {
    const k = path.split('.');
    let root = state;
    if (k[0] === 'ui') { root = ui; k.shift(); }
    return { root, keys: k };
  }
  function setPath(path, val) { const { root, keys } = resolve(path); let o = root; for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) return; o = o[keys[i]]; } o[keys[keys.length - 1]] = val; }

  function onBind(el) {
    const path = el.dataset.bind, kind = el.dataset.kind;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (kind === 'lines') v = el.value.split('\n');
    if (el.type === 'radio' && !el.checked) return;
    setPath(path, v);
    if (path.startsWith('ui.tailored')) { const pv = $('#tailorPreview'); if (pv) pv.innerHTML = Gen.renderCVHtml(ui.tailored.cv, { marks: ui.tailored.marks }); return; }
    if (path.startsWith('ui.')) {
      if (path === 'ui.savedOffer') { state.currentOfferId = v || null; const rec = currentOffer(); ui.offerDraft = rec ? rec.raw : ''; saveSoon(); render(); }
      return;
    }
    if (/^coverLetters\./.test(path)) { const w = $('#letterWarn'); if (w) w.innerHTML = letterWarn(v); saveSoon(); return; }
    saveSoon();
    if (/^(candidateProfile|experiences|education|skills|languages|certifications|projects|settings)/.test(path)) refreshPreview();
    if (path === 'candidateProfile.summary') { const sc = $('#summaryCheck'); if (sc) { const g = Engine.isGenericSummary(v), w = U.words(v).length; sc.className = 'note ' + (v && !g.generic && w >= 25 ? 'ok' : 'warn'); sc.innerHTML = summaryCheck(v, g, w); } }
    if (/\.current$/.test(path) || path === 'settings.country' || path === 'settings.cvLang' || path === 'settings.template') {
      if (/\.current$/.test(path) && el.checked) { const m = /^experiences\.(\d+)\./.exec(path); if (m) state.experiences[+m[1]].end = ''; }
      if (currentRoute() === 'cv' || path.startsWith('settings')) { const y = window.scrollY; render(); window.scrollTo(0, y); }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Écouteurs globaux                                                    */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t && actions[t.dataset.action]) { if (t.tagName !== 'A') e.preventDefault(); actions[t.dataset.action](t, e); return; }
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) closeModal();
  });
  document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.bind && e.target.type !== 'radio' && e.target.tagName !== 'SELECT') onBind(e.target); });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.changeAction && changeActions[t.dataset.changeAction]) { changeActions[t.dataset.changeAction](t); return; }
    if (t.dataset && t.dataset.bind && (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox')) { onBind(t); return; }
    if (t.id === 'fileInput' && t.files[0]) handleFile(t.files[0]);
    if (t.id === 'importJson' && t.files[0]) {
      t.files[0].text().then((txt) => {
        try { const s = JSON.parse(txt); if (!s || typeof s !== 'object' || !s.candidateProfile) throw new Error('format'); if (!confirm('Remplacer vos données actuelles par ce fichier ?')) return; const b = blankState(); state = Object.assign(b, s, { settings: Object.assign(b.settings, s.settings || {}), onboarded: true }); saveProfile(); render(); toast('Données importées.'); }
        catch (err) { toast('Fichier invalide : utilisez un export JSON de CV ATS PRO.'); }
      });
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal')) closeModal();
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.skillInput) { e.preventDefault(); addSkills(e.target.dataset.skillInput); }
    if (e.key === 'Tab' && $('#modal')) {
      const f = [...$('#modal').querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { const z = e.target.closest && e.target.closest('#dropzone'); if (z) { e.preventDefault(); z.classList.add('over'); } }));
  document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('#dropzone'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('#dropzone');
    if (z) { e.preventDefault(); z.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }
    else if (e.dataTransfer && e.dataTransfer.files.length) e.preventDefault();
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('hashchange', render);

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                            */
  /* ------------------------------------------------------------------ */
  AI.configure({ provider: state.settings.aiProvider, endpoint: state.settings.aiEndpoint });
  AI.confirmSend = async (task) => confirm('Les données de votre CV vont être envoyées à votre serveur (' + state.settings.aiEndpoint + ') pour la tâche « ' + task + ' ». Continuer ?');
  const origSave = saveProfile;
  saveProfile = function () { AI.configure({ provider: state.settings.aiProvider, endpoint: state.settings.aiEndpoint }); return origSave(); }; // eslint-disable-line no-func-assign

  // API publique alignée sur les noms du cahier des charges
  Object.assign(window, {
    createCV: () => getCV(),
    analyzeCV: (src, opts) => Engine.analyzeCV(src || getCV(), opts),
    calculateATSScore: (src, offer) => Engine.calculateATSScore(Engine.buildFeatures(src || getCV()), offer),
    analyzeJobOffer: Engine.analyzeJobOffer,
    calculateMatchScore: (cv, offer) => Engine.calculateMatchScore(Engine.buildFeatures(cv || getCV()), offer),
    extractKeywords: Engine.extractKeywords,
    findMissingKeywords: (cv, offer) => Engine.findMissingKeywords(Engine.buildFeatures(cv || getCV()), offer),
    tailorCV: (cv, offer) => Gen.tailorCV(cv || getCV(), offer),
    generateCoverLetter: (cv, offer, opts) => Gen.generateCoverLetter(cv || getCV(), offer, opts),
    generateInterviewPrep: (cv, offer, opts) => Interview.generateInterviewPrep(cv || getCV(), offer, opts),
    generateSTARAnswer: Interview.generateSTARAnswer,
    saveProfile: () => saveProfile(), loadProfile: () => { state = loadProfile(); render(); return state; },
    exportCV: (format, opts) => Gen.exportCV(getCV(), format, opts),
    exportCoverLetter: (text, format, opts) => Gen.exportCoverLetter(getCV(), text, format, opts),
  });
  window.CVATS.App = { get state() { return state; }, ui, render, getCV };

  document.addEventListener('DOMContentLoaded', render);
  if (document.readyState !== 'loading') render();
})();
