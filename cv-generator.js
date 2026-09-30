/* CV ATS PRO — cv-generator.js
 * Construction du CV (HTML, texte, blocs), reformulation, adaptation à une offre, lettre de motivation,
 * et exports (PDF texte natif, DOCX, impression, presse-papiers).
 *
 * Règle absolue : aucun fait n'est inventé. Toute information absente est signalée par un marqueur
 * « [Information manquante — … ] » que l'utilisateur complète lui-même. */
window.CVATS = window.CVATS || {};
(function (C) {
  'use strict';
  const { U, Data } = C;
  const E = () => C.Engine;

  const PH = (what) => '[Information manquante — ' + what + ']';
  const MISSING_NOTE = 'Information manquante — ajoutez cette donnée si elle correspond réellement à votre expérience.';

  const HEAD = {
    fr: { summary: 'Résumé professionnel', experience: 'Expérience professionnelle', education: 'Formation', skills: 'Compétences', certifications: 'Certifications', projects: 'Projets', languages: 'Langues', tools: 'Outils', context: 'Contexte', role: 'Rôle', results: 'Résultats', issuer: 'Organisme', present: 'Présent' },
    en: { summary: 'Professional Summary', experience: 'Work Experience', education: 'Education', skills: 'Skills', certifications: 'Certifications', projects: 'Projects', languages: 'Languages', tools: 'Tools', context: 'Context', role: 'Role', results: 'Results', issuer: 'Issuer', present: 'Present' },
  };
  const SKILL_LABEL_EN = { technique: 'Technical skills', logiciel: 'Software', methode: 'Methodologies', sectorielle: 'Industry knowledge', soft: 'Soft skills' };

  function headings(cv) { return HEAD[(cv.settings && cv.settings.cvLang) === 'en' ? 'en' : 'fr']; }

  function createCV(data) {
    return {
      candidateProfile: U.clone(data.candidateProfile || Data.EMPTY_PROFILE),
      experiences: U.clone(data.experiences || []), education: U.clone(data.education || []), skills: U.clone(data.skills || []),
      languages: U.clone(data.languages || []), certifications: U.clone(data.certifications || []), projects: U.clone(data.projects || []),
      settings: Object.assign({ country: 'France', template: 'professional', cvLang: 'fr' }, U.clone(data.settings || {})),
    };
  }

  const fullName = (cv) => [cv.candidateProfile.firstName, cv.candidateProfile.lastName].filter(Boolean).join(' ');

  function contactParts(cv) {
    const p = cv.candidateProfile;
    const place = [p.city, p.country].filter(Boolean).join(', ');
    return [p.email, p.phone, place, p.linkedin, p.portfolio, p.website].filter(Boolean);
  }
  function extraParts(cv) {
    const p = cv.candidateProfile;
    const allowed = (Data.COUNTRIES[cv.settings.country] || { extra: [] }).extra;
    const L = { birthDate: 'Date de naissance', nationality: 'Nationalité', workPermit: 'Autorisation de travail' };
    return allowed.filter((k) => p[k]).map((k) => L[k] + ' : ' + p[k]);
  }
  function skillGroups(cv) {
    const en = (cv.settings && cv.settings.cvLang) === 'en';
    return Data.SKILL_CATS.map(([k, label]) => ({ key: k, label: en ? SKILL_LABEL_EN[k] : label, items: (cv.skills || []).filter((s) => s.category === k && s.name).map((s) => s.name) })).filter((g) => g.items.length);
  }

  /* ----- Texte brut ----- */
  function cvToText(cv) {
    const out = [];
    cvToBlocks(cv).forEach((b) => {
      if (b.t === 'h2') out.push('', b.x.toUpperCase());
      else if (b.t === 'h3') out.push('', b.r ? b.x + ' (' + b.r + ')' : b.x);
      else if (b.t === 'b') out.push('- ' + b.x);
      else out.push(b.x);
    });
    return out.join('\n').replace(/^\n+/, '');
  }

  /* ----- Blocs neutres (PDF, DOCX, texte) ----- */
  function cvToBlocks(cv) {
    const H = headings(cv), p = cv.candidateProfile, B = [];
    if (fullName(cv)) B.push({ t: 'name', x: fullName(cv) });
    if (p.title) B.push({ t: 'title', x: p.title });
    const cp = contactParts(cv).concat(extraParts(cv));
    if (cp.length) B.push({ t: 'contact', x: cp.join(' | ') });
    if (p.summary && p.summary.trim()) { B.push({ t: 'h2', x: H.summary }); B.push({ t: 'p', x: p.summary.trim() }); }
    if ((cv.experiences || []).length) {
      B.push({ t: 'h2', x: H.experience });
      cv.experiences.forEach((e) => {
        B.push({ t: 'h3', x: [e.title, e.company].filter(Boolean).join(' — '), r: U.period(e).replace('Présent', H.present) });
        if (e.location) B.push({ t: 'meta', x: e.location });
        if (e.description && e.description.trim()) B.push({ t: 'p', x: e.description.trim() });
        (e.bullets || []).filter((b) => b && b.trim()).forEach((b) => B.push({ t: 'b', x: b.trim() }));
        if (e.tools && e.tools.trim()) B.push({ t: 'p', x: H.tools + ' : ' + e.tools.trim() });
      });
    }
    if ((cv.education || []).length) {
      B.push({ t: 'h2', x: H.education });
      cv.education.forEach((d) => {
        B.push({ t: 'h3', x: [d.degree, d.school].filter(Boolean).join(' — '), r: d.year || '' });
        const m = [d.specialty, d.location].filter(Boolean).join(' | ');
        if (m) B.push({ t: 'meta', x: m });
      });
    }
    const groups = skillGroups(cv);
    if (groups.length) { B.push({ t: 'h2', x: H.skills }); groups.forEach((g) => B.push({ t: 'p', x: g.label + ' : ' + g.items.join(', ') })); }
    if ((cv.certifications || []).length) {
      B.push({ t: 'h2', x: H.certifications });
      cv.certifications.forEach((c) => B.push({ t: 'b', x: [c.name, c.issuer, c.year, c.number ? 'n° ' + c.number : ''].filter(Boolean).join(' — ') }));
    }
    if ((cv.projects || []).length) {
      B.push({ t: 'h2', x: H.projects });
      cv.projects.forEach((pr) => {
        B.push({ t: 'h3', x: pr.name || '', r: '' });
        [[H.context, pr.context], [H.role, pr.role], [H.tools, pr.tools], [H.results, pr.results]].forEach(([l, v]) => { if (v && v.trim()) B.push({ t: 'p', x: l + ' : ' + v.trim() }); });
      });
    }
    if ((cv.languages || []).length) {
      B.push({ t: 'h2', x: H.languages });
      B.push({ t: 'p', x: cv.languages.filter((l) => l.name).map((l) => l.name + (l.level ? ' (' + l.level + ')' : '')).join(' ; ') });
    }
    return B;
  }

  /* ----- HTML (aperçu) — une seule colonne, aucun graphique ----- */
  function renderCVHtml(cv, opts) {
    opts = opts || {};
    const tpl = opts.template || (cv.settings && cv.settings.template) || 'professional';
    const marks = opts.marks || null;
    const m = (s) => (marks && marks.has(s) ? '<mark>' + U.esc(s) + '</mark>' : U.esc(s));
    const blocks = cvToBlocks(cv);
    if (!blocks.length) return '<article class="cv tpl-' + tpl + ' cv-empty"><p>Votre CV apparaîtra ici dès que vous renseignerez vos informations.</p></article>';
    const H = headings(cv), p = cv.candidateProfile;
    let html = '<article class="cv tpl-' + tpl + '" lang="' + ((cv.settings && cv.settings.cvLang) === 'en' ? 'en' : 'fr') + '">';
    html += '<header>' + (fullName(cv) ? '<h1>' + U.esc(fullName(cv)) + '</h1>' : '') + (p.title ? '<p class="cv-title">' + U.esc(p.title) + '</p>' : '');
    const cp = contactParts(cv).concat(extraParts(cv));
    if (cp.length) html += '<p class="cv-contact">' + cp.map(U.esc).join(' <span aria-hidden="true">|</span> ') + '</p>';
    html += '</header>';
    if (p.summary && p.summary.trim()) html += '<section><h2>' + H.summary + '</h2><p>' + m(p.summary.trim()) + '</p></section>';
    if ((cv.experiences || []).length) {
      html += '<section><h2>' + H.experience + '</h2>';
      cv.experiences.forEach((e) => {
        html += '<div class="cv-item"><h3><span>' + U.esc([e.title, e.company].filter(Boolean).join(' — ')) + '</span><span class="cv-date">' + U.esc(U.period(e).replace('Présent', H.present)) + '</span></h3>';
        if (e.location) html += '<p class="cv-meta">' + U.esc(e.location) + '</p>';
        if (e.description && e.description.trim()) html += '<p>' + U.esc(e.description.trim()) + '</p>';
        const bl = (e.bullets || []).filter((b) => b && b.trim());
        if (bl.length) html += '<ul>' + bl.map((b) => '<li>' + m(b.trim()) + '</li>').join('') + '</ul>';
        if (e.tools && e.tools.trim()) html += '<p class="cv-meta">' + H.tools + ' : ' + U.esc(e.tools.trim()) + '</p>';
        html += '</div>';
      });
      html += '</section>';
    }
    if ((cv.education || []).length) {
      html += '<section><h2>' + H.education + '</h2>';
      cv.education.forEach((d) => {
        html += '<div class="cv-item"><h3><span>' + U.esc([d.degree, d.school].filter(Boolean).join(' — ')) + '</span><span class="cv-date">' + U.esc(d.year || '') + '</span></h3>';
        const meta = [d.specialty, d.location].filter(Boolean).join(' | ');
        if (meta) html += '<p class="cv-meta">' + U.esc(meta) + '</p>';
        html += '</div>';
      });
      html += '</section>';
    }
    const groups = skillGroups(cv);
    if (groups.length) {
      html += '<section><h2>' + H.skills + '</h2>' + groups.map((g) => '<p><strong>' + U.esc(g.label) + ' :</strong> ' + g.items.map(m).join(', ') + '</p>').join('') + '</section>';
    }
    if ((cv.certifications || []).length) {
      html += '<section><h2>' + H.certifications + '</h2><ul>' + cv.certifications.map((c) => '<li>' + U.esc([c.name, c.issuer, c.year, c.number ? 'n° ' + c.number : ''].filter(Boolean).join(' — ')) + '</li>').join('') + '</ul></section>';
    }
    if ((cv.projects || []).length) {
      html += '<section><h2>' + H.projects + '</h2>' + cv.projects.map((pr) => {
        let s = '<div class="cv-item"><h3><span>' + U.esc(pr.name || '') + '</span></h3>';
        [[H.context, pr.context], [H.role, pr.role], [H.tools, pr.tools], [H.results, pr.results]].forEach(([l, v]) => { if (v && v.trim()) s += '<p>' + l + ' : ' + U.esc(v.trim()) + '</p>'; });
        return s + '</div>';
      }).join('') + '</section>';
    }
    if ((cv.languages || []).length) {
      html += '<section><h2>' + H.languages + '</h2><p>' + U.esc(cv.languages.filter((l) => l.name).map((l) => l.name + (l.level ? ' (' + l.level + ')' : '')).join(' ; ')) + '</p></section>';
    }
    return html + '</article>';
  }

  /* ------------------------------------------------------------------ */
  /* Réalisations : diagnostic et reformulation sans invention             */
  /* ------------------------------------------------------------------ */
  function bulletDiagnostics(b) {
    const out = [];
    const n = U.words(b).length;
    if (!b.trim()) return out;
    if (n < 5) out.push({ type: 'short', msg: 'Réalisation très courte : précisez le contexte, l\'action menée et le résultat.' });
    if (!E().startsWithAction(b)) out.push({ type: 'verb', msg: 'Commencez par un verbe d\'action ou un nom d\'action (piloté, déployé, gestion de…).' });
    if (!U.hasMetric(b)) out.push({ type: 'metric', msg: MISSING_NOTE });
    return out;
  }

  const NOMINAL = /^(gestion|suivi|pilotage|coordination|animation|mise|conception|analyse|developpement|organisation|realisation|redaction|supervision|planification|encadrement|formation|creation|lancement|optimisation|negociation|prospection|deploiement|elaboration|reporting)/;
  // Réécriture « sûre » : retire uniquement une tournure passive, sans ajouter aucun fait
  function tightenBullet(b) {
    const s = b.trim();
    const m = /^(?:j'ai\s+)?(?:(?:été\s+)?en charge|chargée?|responsable)\s+(?:de la |de l'|du |des |de )(.+)$/i.exec(s);
    if (m && NOMINAL.test(U.norm(m[1]))) return U.cap(m[1]);
    return s;
  }
  // Compose une réalisation à partir des données RÉELLES saisies par l'utilisateur
  function composeBullet(base, detail, result) {
    let s = base.trim().replace(/[.;]\s*$/, '');
    if (detail && detail.trim()) s += ' (' + detail.trim().replace(/[.;]\s*$/, '') + ')';
    if (result && result.trim()) s += ' — ' + result.trim().replace(/[.;]\s*$/, '');
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Résumé professionnel                                                  */
  /* ------------------------------------------------------------------ */
  function pickBullets(exp, offerSet, n) {
    const scored = (exp.bullets || []).filter((b) => b && b.trim()).map((b, i) => ({
      b: b.trim(), i, s: (offerSet ? E().extractKeywords(b).filter((k) => offerSet.has(k.term)).length : 0) * 2 + (U.hasMetric(b) ? 1 : 0),
    }));
    return scored.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map((x) => x.b);
  }

  function buildSummary(cv, offer) {
    const p = cv.candidateProfile;
    const f = E().buildFeatures(cv);
    const years = U.expYears(cv.experiences);
    const offerSet = offer ? new Set(offer.required.concat(offer.nice).map((k) => k.term)) : null;
    const kws = f.keywords.filter((k) => ['competence', 'methode', 'logiciel', 'technologie'].includes(k.cat));
    const focus = (offerSet ? kws.filter((k) => offerSet.has(k.term)).concat(kws.filter((k) => !offerSet.has(k.term))) : kws).map((k) => k.term).filter((t, i, a) => a.indexOf(t) === i).slice(0, 5);
    const sectors = f.keywords.filter((k) => k.cat === 'secteur').map((k) => k.term).slice(0, 2);
    const parts = [];
    const head = p.title || '';
    if (head || years) {
      let s = (head || 'Professionnel') + (years ? ' avec ' + years + ' an' + (years > 1 ? 's' : '') + ' d\'expérience' : '');
      if (sectors.length) s += ' dans ' + (sectors.length > 1 ? 'les secteurs ' : 'le secteur ') + sectors.join(' et ');
      parts.push(s + '.');
    }
    if (focus.length) parts.push('Compétences clés : ' + focus.join(', ') + '.');
    let best = null, bestScore = -1;
    (cv.experiences || []).forEach((e, ei) => {
      (e.bullets || []).forEach((b) => {
        if (!b || !U.hasMetric(b) || b.length > 220) return;
        const sc = (offerSet ? E().extractKeywords(b).filter((k) => offerSet.has(k.term)).length : 0) * 2 + (ei === 0 ? 1 : 0);
        if (sc > bestScore) { bestScore = sc; best = b.trim(); }
      });
    });
    if (best) parts.push('Réalisation marquante : ' + U.lowerFirst(best.replace(/[.;]\s*$/, '')) + '.');
    if (offer && offer.title) parts.push('Objectif : ' + offer.title + (offer.company ? ' chez ' + offer.company : '') + '.');
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* Adaptation du CV à une offre                                          */
  /* ------------------------------------------------------------------ */
  // Remplace un synonyme réel (alias multi-mots, compétence/méthode) par la formulation de l'offre
  function rewordWithOfferTerms(text, offerSet) {
    const n = U.norm(text);
    if (n.length !== text.length) return text;
    let out = text;
    const edits = [];
    E().LEX.forEach((e) => {
      if (!offerSet.has(e.canon) || e.cat !== 'competence' || n.includes(U.norm(e.canon))) return;
      e.re.lastIndex = 0;
      let m;
      while ((m = e.re.exec(n))) {
        const form = m[2];
        if (form === U.norm(e.canon) || form.indexOf(' ') < 0) continue;
        const start = m.index + m[1].length;
        edits.push({ start, end: start + m[0].length - m[1].length, repl: /[A-ZÀ-Ý]/.test(text[start]) ? U.cap(e.canon) : e.canon });
      }
    });
    edits.sort((a, b) => b.start - a.start).forEach((ed) => { out = out.slice(0, ed.start) + ed.repl + out.slice(ed.end); });
    return out;
  }

  function tailorCV(cv, offer) {
    const Eng = E();
    const before = Eng.buildFeatures(cv);
    const matchBefore = Eng.calculateMatchScore(before, offer);
    const out = U.clone(cv);
    const changes = [], marks = new Set();
    const offerSet = new Set(offer.required.concat(offer.nice).filter((k) => k.cat !== 'langue').map((k) => k.term));

    out.experiences.forEach((e) => {
      const where = [e.title, e.company].filter(Boolean).join(' — ');
      e.bullets = (e.bullets || []).map((b) => {
        const nb = rewordWithOfferTerms(b, offerSet);
        if (nb !== b) { changes.push({ kind: 'reword', where, before: b, after: nb }); marks.add(nb); }
        return nb;
      });
      const scored = e.bullets.map((b, i) => ({ b, i, s: Eng.extractKeywords(b).filter((k) => offerSet.has(k.term)).length }));
      const sorted = scored.slice().sort((a, b) => b.s - a.s || a.i - b.i);
      if (sorted.some((x, i) => x.i !== i)) {
        sorted.forEach((x, i) => { if (x.s > 0 && i < x.i) marks.add(x.b); });
        e.bullets = sorted.map((x) => x.b);
        changes.push({ kind: 'reorder', where, before: '', after: 'Réalisations les plus pertinentes pour l\'offre placées en premier.' });
      }
    });

    // compétences : celles qui correspondent à l'offre passent en premier dans leur catégorie
    const moved = [];
    const skillHit = (s) => Eng.extractKeywords(s.name).some((k) => offerSet.has(k.term));
    Data.SKILL_CATS.forEach(([k]) => {
      const group = out.skills.filter((s) => s.category === k);
      const hit = group.filter(skillHit), rest = group.filter((s) => !skillHit(s));
      if (hit.length && group.some((s, i) => s !== hit.concat(rest)[i])) { hit.forEach((s) => { marks.add(s.name); moved.push(s.name); }); }
      let gi = 0;
      const reordered = hit.concat(rest);
      out.skills = out.skills.map((s) => (s.category === k ? reordered[gi++] : s));
    });
    if (moved.length) changes.push({ kind: 'skills', where: 'Compétences', before: '', after: 'Compétences correspondant à l\'offre placées en premier : ' + moved.join(', ') + '.' });

    // résumé
    const newSummary = buildSummary(out, offer);
    if (newSummary && newSummary !== (cv.candidateProfile.summary || '').trim()) {
      changes.push({ kind: 'summary', where: 'Résumé professionnel', before: cv.candidateProfile.summary || '', after: newSummary });
      out.candidateProfile.summary = newSummary; marks.add(newSummary);
    }

    const after = Eng.buildFeatures(out);
    const matchAfter = Eng.calculateMatchScore(after, offer);
    const beforeMarks = new Set();
    changes.forEach((c) => { if (c.before) beforeMarks.add(c.before); });
    return {
      cv: out, changes, marks, beforeMarks, matchBefore, matchAfter,
      notAdded: matchAfter.missing.filter((k) => k.cat !== 'soft').map((k) => k.term),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lettre de motivation                                                  */
  /* ------------------------------------------------------------------ */
  const TONES = {
    'professionnel': { greet: 'Madame, Monsieur,', open: (pos, co) => 'Je vous adresse ma candidature au poste de ' + pos + co + '.', close: 'Je me tiens à votre disposition pour échanger sur ma candidature lors d\'un entretien. Je vous prie d\'agréer, Madame, Monsieur, mes salutations distinguées.' },
    'direct': { greet: 'Bonjour,', open: (pos, co) => 'Je postule au poste de ' + pos + co + '.', close: 'Je suis disponible pour un échange à votre convenance.\nCordialement,' },
    'chaleureux': { greet: 'Bonjour,', open: (pos, co) => 'C\'est avec un réel intérêt que je vous adresse ma candidature au poste de ' + pos + co + '.', close: 'Ce serait un plaisir d\'échanger avec vous sur ce poste et sur la façon dont je peux y contribuer.\nBien cordialement,' },
    'très formel': { greet: 'Madame, Monsieur,', open: (pos, co) => 'J\'ai l\'honneur de vous soumettre ma candidature au poste de ' + pos + co + '.', close: 'Dans l\'attente de votre réponse, je vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations les plus respectueuses.' },
  };

  function list(arr) { return arr.length > 1 ? arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1] : arr[0] || ''; }
  const trimEnd = (s) => String(s).trim().replace(/[.;:]\s*$/, '');

  function generateCoverLetter(cv, offer, opts) {
    opts = Object.assign({ length: 'standard', tone: 'professionnel', motivationPosition: '', motivationCompany: '', company: '', position: '' }, opts || {});
    const Eng = E();
    const tone = TONES[opts.tone] || TONES.professionnel;
    const p = cv.candidateProfile;
    const f = Eng.buildFeatures(cv);
    const match = offer ? Eng.calculateMatchScore(f, offer) : null;
    const company = (opts.company || (offer && offer.company) || '').trim();
    const position = (opts.position || (offer && offer.title) || p.title || '').trim();
    const years = U.expYears(cv.experiences);
    const offerSet = offer ? new Set(offer.required.concat(offer.nice).map((k) => k.term)) : null;
    const rel = match ? match.relevantExperiences : [];
    const exp = rel.length ? cv.experiences[rel[0].index] : cv.experiences[0];
    const exp2 = rel.length > 1 ? cv.experiences[rel[1].index] : cv.experiences.find((e) => e !== exp);
    const matchedTerms = (match ? match.matched : f.keywords).filter((k) => ['competence', 'methode', 'logiciel', 'technologie'].includes(k.cat)).map((k) => k.term).filter((t, i, a) => a.indexOf(t) === i).slice(0, 5);
    const reqTerms = offer ? offer.required.filter((k) => ['competence', 'methode', 'logiciel', 'technologie'].includes(k.cat)).map((k) => k.term).slice(0, 4) : [];
    const coStr = company ? ' au sein de ' + company : '';
    const lastTitle = (cv.experiences[0] && cv.experiences[0].title) || p.title || '';

    const para = {};
    // 1. Introduction
    para.intro = tone.open(position || PH('intitulé du poste'), coStr);
    if (years || lastTitle) {
      para.intro += ' Mon parcours' + (years ? ' de ' + years + ' an' + (years > 1 ? 's' : '') + ' d\'expérience' : '') + (lastTitle ? ', récemment en tant que ' + lastTitle : '') +
        (matchedTerms.length ? ', m\'a permis de développer une expertise en ' + list(matchedTerms.slice(0, 3)) : '') + '.';
    }
    // 2. Pourquoi ce poste
    let why = '';
    if (opts.motivationPosition.trim()) why += trimEnd(opts.motivationPosition) + '.';
    else why += PH('ajoutez ce qui vous motive personnellement dans ce poste');
    if (reqTerms.length) {
      const common = reqTerms.filter((t) => f.keywordSet.has(t));
      why += ' Votre offre met l\'accent sur ' + list(reqTerms) + (common.length ? ' ; ' + (common.length === reqTerms.length ? 'ces sujets font partie de mon parcours.' : 'parmi eux, ' + list(common) + (common.length > 1 ? ' font' : ' fait') + ' partie de mon parcours.') : '.');
    }
    para.why = why;
    // 3. Expérience pertinente
    const buildExp = (e, n) => {
      if (!e) return PH('ajoutez une expérience professionnelle pertinente');
      const bl = pickBullets(e, offerSet, n);
      let s = 'Dans mon poste de ' + (e.title || PH('intitulé')) + (e.company ? ' chez ' + e.company : '') + (U.period(e) ? ' (' + U.period(e) + ')' : '') + ', ';
      s += bl.length ? 'mes principales réalisations ont été les suivantes : ' + bl.map((b) => U.lowerFirst(trimEnd(b))).join(' ; ') + '.' : 'j\'ai exercé les missions suivantes : ' + (trimEnd(e.description) || PH('décrivez vos missions')) + '.';
      return s;
    };
    const nb = opts.length === 'détaillée' ? 3 : opts.length === 'courte' ? 1 : 2;
    para.exp = buildExp(exp, nb);
    if (opts.length === 'détaillée' && exp2) para.exp2 = buildExp(exp2, 2);
    // 4. Valeur ajoutée
    let value = matchedTerms.length ? 'Je peux vous apporter mon expertise en ' + list(matchedTerms) + (offer ? ', des compétences que vous citez dans votre offre et que je mets en pratique' : '') + '.' : PH('précisez la valeur ajoutée que vous apportez, en vous appuyant sur votre expérience réelle');
    let bestB = null;
    const usedB = new Set(pickBullets(exp || { bullets: [] }, offerSet, nb).concat(opts.length === 'détaillée' && exp2 ? pickBullets(exp2, offerSet, 2) : []));
    (cv.experiences || []).forEach((e) => (e.bullets || []).forEach((b) => { if (!usedB.has(b.trim()) && U.hasMetric(b) && b.length < 220 && (!bestB || (offerSet && Eng.extractKeywords(b).some((k) => offerSet.has(k.term)) && !Eng.extractKeywords(bestB).some((k) => offerSet.has(k.term))))) bestB = b; }));
    if (bestB && opts.length !== 'courte') value += ' Parmi mes résultats : ' + U.lowerFirst(trimEnd(bestB)) + '.';
    para.value = value;
    // 5. Motivation pour l'entreprise
    para.company = opts.motivationCompany.trim() ? trimEnd(opts.motivationCompany) + '.' : PH('ajoutez ce qui vous attire réellement chez ' + (company || 'cette entreprise') + ' : produit, valeurs, marché…');

    let order;
    if (opts.length === 'courte') { para.intro += ' ' + (para.value.startsWith('[') ? '' : para.value); order = ['intro', 'exp', 'close']; }
    else if (opts.length === 'détaillée') order = ['intro', 'why', 'exp', 'exp2', 'value', 'company', 'close'];
    else order = ['intro', 'why', 'exp', 'value', 'company', 'close'];
    if (opts.length === 'courte' && para.value.startsWith('[')) order = ['intro', 'exp', 'value', 'close'];

    const name = fullName(cv);
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const head = [name, [p.email, p.phone].filter(Boolean).join(' | '), [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    const dest = company ? 'À l\'attention de l\'équipe de recrutement de ' + company : '';
    let text = head + '\n\n' + (dest ? dest + '\n\n' : '') + date + '\n\nObjet : Candidature au poste de ' + (position || PH('intitulé du poste')) + '\n\n' + tone.greet + '\n\n';
    text += order.map((k) => (k === 'close' ? tone.close : para[k])).filter(Boolean).join('\n\n');
    text += '\n\n' + name;
    const missing = (text.match(/\[Information manquante/g) || []).length;
    return { text, missing, position, company };
  }

  /* ------------------------------------------------------------------ */
  /* PDF natif (texte sélectionnable, polices standard, WinAnsi)           */
  /* ------------------------------------------------------------------ */
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
    334, 260, 334, 584];
  const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };

  function toWin(str) {
    let o = '';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      if (c >= 32 && c < 127) o += ch;
      else if (c >= 160 && c <= 255) o += ch;
      else if (CP1252[ch] !== undefined) o += String.fromCharCode(CP1252[ch]);
      else if (c === 9 || c === 0x202f || c === 0x2009 || c === 0x2007) o += ' ';
      else if (c === 0x2192) o += '>';
      else if (c === 0x2713 || c === 0x2714) o += '+';
      else if (c < 32) o += ' ';
      else o += '?';
    }
    return o;
  }
  function charW(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c < 127) return HW[c - 32];
    if (c === 0x97) return 1000; if (c === 0x96) return 556; if (c === 0x95) return 350;
    const base = U.norm(ch)[0];
    return base && base.charCodeAt(0) < 127 && base.charCodeAt(0) >= 32 ? HW[base.charCodeAt(0) - 32] : 556;
  }

  const PDF_STYLES = {
    classic: { nameSize: 20, align: 'center', color: [0, 0, 0], caps: true, rule: true },
    professional: { nameSize: 22, align: 'left', color: [15, 118, 110], caps: true, rule: true },
    executive: { nameSize: 24, align: 'left', color: [15, 27, 45], caps: false, rule: true },
    international: { nameSize: 20, align: 'left', color: [30, 64, 175], caps: true, rule: true },
    plain: { nameSize: 14, align: 'left', color: [0, 0, 0], caps: false, rule: false },
  };

  function buildPDF(blocks, styleId, title) {
    const st = PDF_STYLES[styleId] || PDF_STYLES.professional;
    const W = 595.28, H = 841.89, M = 54, maxW = W - 2 * M;
    const pages = [];
    let cur = [], y = H - M;
    const col = (c) => c.map((n) => (n / 255).toFixed(3)).join(' ');
    const width = (s, size, bold) => { let w = 0; for (const ch of s) w += charW(ch); return (w * size / 1000) * (bold ? 1.06 : 1); };
    const newPage = () => { pages.push(cur.join('\n')); cur = []; y = H - M; };
    const ensure = (h) => { if (y - h < M) newPage(); };
    const text = (x, yy, s, font, size, color) => { if (s) cur.push('BT /' + font + ' ' + size + ' Tf ' + col(color || [0, 0, 0]) + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + s.replace(/[\\()]/g, '\\$&') + ') Tj ET'); };
    const wrap = (s, w, size, bold) => {
      const out = [];
      String(s).split('\n').forEach((para) => {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) { out.push(''); return; }
        let line = '';
        words.forEach((wd) => {
          const t = line ? line + ' ' + wd : wd;
          if (width(t, size, bold) <= w || !line) line = t; else { out.push(line); line = wd; }
        });
        out.push(line);
      });
      return out;
    };
    const para = (s, x, w, font, size, color, gap, bold) => {
      wrap(toWin(s), w, size, bold).forEach((ln) => { ensure(size * 1.4); y -= size * 1.35; text(x, y, ln, font, size, color); });
      y -= gap || 0;
    };

    blocks.forEach((b) => {
      const x0 = M;
      switch (b.t) {
        case 'name': {
          const s = toWin(b.x); const w = width(s, st.nameSize, true);
          ensure(st.nameSize * 1.5); y -= st.nameSize * 1.2;
          text(st.align === 'center' ? (W - w) / 2 : x0, y, s, 'F2', st.nameSize, st.color); y -= 4; break;
        }
        case 'title': {
          const s = toWin(b.x); const w = width(s, 12, false);
          ensure(18); y -= 14; text(st.align === 'center' ? (W - w) / 2 : x0, y, s, 'F1', 12, [60, 60, 60]); break;
        }
        case 'contact': {
          wrap(toWin(b.x), maxW, 9.5, false).forEach((ln) => {
            const w = width(ln, 9.5, false);
            ensure(14); y -= 12.5; text(st.align === 'center' ? (W - w) / 2 : x0, y, ln, 'F1', 9.5, [70, 70, 70]);
          });
          y -= 4; break;
        }
        case 'h1': case 'h2': {
          const s = toWin(st.caps || b.t === 'h1' ? b.x.toUpperCase() : b.x);
          ensure(34); y -= b.t === 'h1' ? 22 : 20; text(x0, y, s, 'F2', b.t === 'h1' ? 14 : 11.5, st.color);
          if (st.rule) { y -= 4; cur.push(col(st.color) + ' RG 0.6 w ' + x0 + ' ' + y.toFixed(2) + ' m ' + (W - M).toFixed(2) + ' ' + y.toFixed(2) + ' l S'); }
          y -= 2; break;
        }
        case 'h3': {
          const right = toWin(b.r || '');
          const rw = right ? width(right, 9.5, false) + 8 : 0;
          const lines = wrap(toWin(b.x), maxW - rw, 10.5, true);
          ensure(14 * lines.length + 6); y -= 6;
          lines.forEach((ln, i) => { y -= 13; text(x0, y, ln, 'F2', 10.5, [0, 0, 0]); if (i === 0 && right) text(W - M - rw + 8, y, right, 'F1', 9.5, [80, 80, 80]); });
          break;
        }
        case 'meta': para(b.x, x0, maxW, 'F3', 9.5, [90, 90, 90], 1); break;
        case 'b': {
          const lines = wrap(toWin(b.x), maxW - 16, 10, false);
          lines.forEach((ln, i) => { ensure(14); y -= 13; if (i === 0) text(x0 + 4, y, '\x95', 'F1', 10, [0, 0, 0]); text(x0 + 16, y, ln, 'F1', 10, [20, 20, 20]); });
          y -= 1.5; break;
        }
        case 'sp': y -= 8; break;
        case 'lp': para(b.x, x0, maxW, 'F1', 10.5, [20, 20, 20], 9); break;
        case 'lb': para(b.x, x0, maxW, 'F2', 10.5, [0, 0, 0], 4, true); break;
        default: para(b.x, x0, maxW, 'F1', 10, [20, 20, 20], 3);
      }
    });
    pages.push(cur.join('\n'));

    const nPages = pages.length;
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [' + pages.map((_, i) => (8 + 2 * i) + ' 0 R').join(' ') + '] /Count ' + nPages + ' >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
      '<< /Title (' + toWin(title || 'Document').replace(/[\\()]/g, '\\$&') + ') /Producer (CV ATS PRO) >>',
    ];
    pages.forEach((content, i) => {
      objs.push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + (7 + 2 * i) + ' 0 R >>');
    });
    const fixed = objs;

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    fixed.forEach((o, i) => { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (fixed.length + 1) + '\n0000000000 65535 f \n' + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += 'trailer\n<< /Size ' + (fixed.length + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  /* ------------------------------------------------------------------ */
  /* DOCX minimal (zip « stored », sans dépendance)                         */
  /* ------------------------------------------------------------------ */
  let crcTable = null;
  function crc32(u8) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) crc = crcTable[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files, mime) {
    const enc = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data), len = data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, len, true);
      lh.setUint32(22, len, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, len, true); ch.setUint32(24, len, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + len;
    });
    const cd = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cd, true); end.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), { type: mime });
  }

  function buildDOCX(blocks) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    const run = (t, o) => '<w:r><w:rPr>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.c ? '<w:color w:val="' + o.c + '"/>' : '') + '<w:sz w:val="' + (o.s || 21) + '"/></w:rPr><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
    const p = (inner, ppr) => '<w:p><w:pPr>' + (ppr || '') + '</w:pPr>' + inner + '</w:p>';
    const body = blocks.map((b) => {
      const lines = String(b.x || '').split('\n');
      const multi = (o) => lines.map((l, i) => (i ? '<w:r><w:br/></w:r>' : '') + run(l, o)).join('');
      switch (b.t) {
        case 'name': return p(run(b.x, { b: 1, s: 40 }), '<w:spacing w:after="40"/>');
        case 'title': return p(run(b.x, { s: 26, c: '444444' }), '<w:spacing w:after="40"/>');
        case 'contact': return p(run(b.x, { s: 19, c: '444444' }), '<w:spacing w:after="120"/>');
        case 'h1': case 'h2': return p(run(b.x.toUpperCase(), { b: 1, s: 23, c: '0F766E' }), '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="0F766E"/></w:pBdr><w:spacing w:before="240" w:after="80"/><w:keepNext/>');
        case 'h3': return p(run(b.x, { b: 1 }) + (b.r ? '<w:r><w:tab/></w:r>' + run(b.r, { s: 19, c: '555555' }) : ''), '<w:tabs><w:tab w:val="right" w:pos="9800"/></w:tabs><w:spacing w:before="120" w:after="20"/><w:keepNext/>');
        case 'meta': return p(run(b.x, { i: 1, s: 19, c: '555555' }), '<w:spacing w:after="20"/>');
        case 'b': return p(run('•\t' + b.x, { s: 20 }), '<w:tabs><w:tab w:val="left" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="260"/><w:spacing w:after="20"/>');
        case 'sp': return p('', '<w:spacing w:after="80"/>');
        case 'lp': return p(multi({ s: 21 }), '<w:spacing w:after="160"/>');
        case 'lb': return p(multi({ b: 1, s: 21 }), '<w:spacing w:after="60"/>');
        default: return p(multi({ s: 20 }), '<w:spacing w:after="60"/>');
      }
    }).join('');
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    return zipStore([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  /* ------------------------------------------------------------------ */
  /* Exports                                                               */
  /* ------------------------------------------------------------------ */
  function fileSlug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function fileName(cv, kind, position, ext) {
    const p = cv.candidateProfile;
    return [fileSlug(p.firstName) || 'Prenom', fileSlug(p.lastName) || 'Nom', kind, fileSlug(position || p.title)].filter(Boolean).join('-') + '.' + ext;
  }

  function letterToBlocks(text) {
    const B = [];
    const parts = String(text).split(/\n{2,}/);
    parts.forEach((pt, i) => B.push({ t: i === 0 ? 'lb' : 'lp', x: pt.trim() }));
    return B;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove(); return ok;
    }
  }

  function printHTML(html, cls) {
    let root = document.getElementById('printRoot');
    if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.className = cls || '';
    root.innerHTML = html;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  async function exportCV(cv, format, opts) {
    opts = opts || {};
    const tpl = opts.template || (cv.settings && cv.settings.template) || 'professional';
    const position = opts.position || cv.candidateProfile.title;
    if (format === 'pdf') { U.download(buildPDF(cvToBlocks(cv), tpl, fullName(cv) + ' — CV'), fileName(cv, 'CV', position, 'pdf')); return true; }
    if (format === 'docx') { U.download(buildDOCX(cvToBlocks(cv)), fileName(cv, 'CV', position, 'docx')); return true; }
    if (format === 'copy') return copyText(cvToText(cv));
    if (format === 'print') { printHTML(renderCVHtml(cv, { template: tpl }), 'print-cv'); return true; }
    throw new Error('Format inconnu : ' + format);
  }

  async function exportCoverLetter(cv, text, format, opts) {
    opts = opts || {};
    const position = opts.position || cv.candidateProfile.title;
    if (format === 'pdf') { U.download(buildPDF(letterToBlocks(text), 'plain', fullName(cv) + ' — Lettre de motivation'), fileName(cv, 'Lettre', position, 'pdf')); return true; }
    if (format === 'docx') { U.download(buildDOCX(letterToBlocks(text)), fileName(cv, 'Lettre', position, 'docx')); return true; }
    if (format === 'copy') return copyText(text);
    if (format === 'print') { printHTML('<div class="print-letter">' + U.esc(text).replace(/\n/g, '<br>') + '</div>', 'print-letter-wrap'); return true; }
    throw new Error('Format inconnu : ' + format);
  }

  C.AI.registerLocal('summary', ({ cv, offer }) => buildSummary(cv, offer));
  C.AI.registerLocal('tailorCV', ({ cv, offer }) => tailorCV(cv, offer));
  C.AI.registerLocal('coverLetter', ({ cv, offer, opts }) => generateCoverLetter(cv, offer, opts));

  C.Gen = {
    PH, MISSING_NOTE, createCV, fullName, cvToText, cvToBlocks, renderCVHtml, bulletDiagnostics, tightenBullet, composeBullet,
    buildSummary, tailorCV, generateCoverLetter, buildPDF, buildDOCX, letterToBlocks, fileName, fileSlug, copyText, printHTML, exportCV, exportCoverLetter, skillGroups,
  };
})(window.CVATS);
