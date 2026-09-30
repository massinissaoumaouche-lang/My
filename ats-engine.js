/* CV ATS PRO — ats-engine.js
 * Moteur heuristique local : extraction de mots-clés, analyse d'offre, score ATS, matching CV/offre,
 * import de fichiers (TXT, DOCX, PDF best-effort).
 *
 * Le score est une ESTIMATION d'optimisation interne. Il ne reproduit pas le fonctionnement d'un ATS réel
 * et ne garantit aucun entretien. */
window.CVATS = window.CVATS || {};
(function (C) {
  'use strict';
  const { U, Data } = C;

  /* ------------------------------------------------------------------ */
  /* Lexique compilé + extraction de mots-clés                            */
  /* ------------------------------------------------------------------ */
  const LEX = Data.LEXICON.map(([canon, cat, group, aliases]) => {
    const forms = [...new Set([canon, ...(aliases || [])].map(U.norm))].sort((a, b) => b.length - a.length);
    return {
      canon, cat, group, forms,
      re: new RegExp('(^|[^a-z0-9+#])(' + forms.map(U.escRe).join('|') + ')(?:s|x)?(?![a-z0-9+#])', 'g'),
    };
  });
  const LEX_BY_CANON = {};
  LEX.forEach((e) => { LEX_BY_CANON[e.canon] = e; });
  const ALL_FORMS = new Set(); LEX.forEach((e) => e.forms.forEach((f) => ALL_FORMS.add(f)));

  // groupes de lexique considérés comme voisins (pour signaler une compétence « à vérifier »)
  const RELATED = {
    bi: ['reporting', 'analytics', 'data', 'office', 'bi'], crm: ['client', 'commerce', 'crm'], erp: ['finance', 'compta', 'supply', 'erp'],
    pmtools: ['projet', 'pmtools', 'agile'], cloud: ['cloud', 'devops'], devops: ['cloud', 'devops'], analytics: ['analytics', 'data', 'seo'],
    ads: ['sea', 'marketing', 'analytics', 'ads'], cms: ['cms', 'web'], js: ['js', 'web'], sql: ['data', 'sql', 'nosql'], python: ['data', 'python', 'java'],
    design: ['design'], emailtools: ['emailing', 'marketing'], agile: ['agile', 'projet'],
  };

  function extractKeywords(text) {
    const n = U.norm(text);
    const out = [];
    LEX.forEach((e) => {
      e.re.lastIndex = 0;
      let m, count = 0, first = -1;
      while ((m = e.re.exec(n))) {
        const idx = m.index + m[1].length;
        if (e.canon === 'management d\'équipe' && /project\s*$/.test(n.slice(Math.max(0, idx - 10), idx))) continue;
        count++;
        if (first < 0) first = idx;
      }
      if (count) out.push({ term: e.canon, cat: e.cat, group: e.group, count, first });
    });
    return out.sort((a, b) => b.count - a.count || a.first - b.first);
  }

  function groupByCategory(kws) {
    const g = {};
    kws.forEach((k) => { (g[k.cat] = g[k.cat] || []).push(k); });
    return g;
  }

  const weightOf = (k) => (k.cat === 'soft' ? 0.4 : 1);

  function levelRank(s) {
    const n = U.norm(s);
    if (/natif|maternelle|bilingue|native/.test(n)) return 5;
    if (/courant|c1|c2|fluent|professionnel|full professional/.test(n)) return 4;
    if (/avance|b2|upper|operationnel/.test(n)) return 3;
    if (/intermediaire|b1|intermediate/.test(n)) return 2;
    if (/notion|a1|a2|scolaire|debutant|basic/.test(n)) return 1;
    return 0;
  }

  /* ------------------------------------------------------------------ */
  /* Extraction des caractéristiques d'un CV                              */
  /* ------------------------------------------------------------------ */
  const MONTH_RE = '(?:jan|fev|feb|mar|avr|apr|mai|may|juin|jun|juil|jul|aout|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+(?:19|20)\\d{2}';
  const NUM_RE = '(?:(?:0?[1-9]|1[0-2])[\\/.\\-])?(?:19|20)\\d{2}';
  const DATE_RE = '(?:' + MONTH_RE + '|' + NUM_RE + ')';
  const PRESENT_RE = 'present|aujourd\'hui|actuel|actuellement|current|now|ce jour|en cours';
  const RANGE = new RegExp('(' + DATE_RE + ')\\s*(?:-|–|—|a|au|to|jusqu\'a|until)\\s*(' + DATE_RE + '|' + PRESENT_RE + ')', 'i');
  const MONTH_NUM = { jan: 1, fev: 2, feb: 2, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, aou: 8, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function parseDate(tok, isEnd) {
    const t = U.norm(tok).trim();
    let m = /^(?:(\d{1,2})[\/.\-])?((?:19|20)\d{2})$/.exec(t);
    if (m) return m[2] + '-' + String(m[1] ? +m[1] : isEnd ? 12 : 1).padStart(2, '0');
    m = /^([a-z]+)\.?\s+((?:19|20)\d{2})$/.exec(t);
    if (m) {
      const key = m[1].startsWith('juil') ? 'juil' : m[1].startsWith('juin') ? 'juin' : m[1].slice(0, 3);
      const k = MONTH_NUM[key] || MONTH_NUM[m[1].slice(0, 3)];
      if (k) return m[2] + '-' + String(k).padStart(2, '0');
    }
    return '';
  }

  const HEADINGS = [
    ['summary', /^(profil|profil professionnel|resume|resume professionnel|summary|professional summary|about me|about|a propos|objectif|objective|presentation)$/],
    ['experience', /^(experiences?( professionnelles?)?|parcours professionnel|work experience|professional experience|employment( history)?|experience)$/],
    ['education', /^(formations?|education|etudes|parcours academique|diplomes?|scolarite|academic background|formation academique)$/],
    ['skills', /^(competences?( cles| techniques| professionnelles)?|skills|technical skills|key skills|outils|logiciels|expertises?|competences et outils)$/],
    ['languages', /^(langues?|languages?)$/],
    ['certifications', /^(certifications?|certificats?|licenses?( and certifications)?|formations complementaires)$/],
    ['projects', /^(projets?|projects?|realisations)$/],
  ];
  function headingOf(line) {
    const n = U.norm(line).replace(/[:•\-–_*#]+/g, ' ').trim().replace(/\s+/g, ' ');
    if (!n || n.length > 40) return null;
    for (const [k, re] of HEADINGS) if (re.test(n)) return k;
    return null;
  }
  const isBulletLine = (t) => /^[-•·▪●*–—]\s*/.test(t);
  const stripBullet = (t) => t.replace(/^[-•·▪●*–—]\s*/, '');

  function finalize(f) {
    f.norm = U.norm(f.text);
    f.wordCount = U.words(f.text).length;
    f.keywords = extractKeywords(f.text);
    f.keywordSet = new Set(f.keywords.map((k) => k.term));
    f.allBullets = f.exps.reduce((a, e) => a.concat(e.bullets), []);
    return f;
  }

  function featuresFromCV(cv) {
    const p = cv.candidateProfile || {};
    const text = C.Gen.cvToText(cv);
    const exps = (cv.experiences || []).map((e) => ({
      title: e.title || '', company: e.company || '', start: e.start || '', end: e.current ? '' : (e.end || ''), current: !!e.current,
      bullets: (e.bullets || []).map((b) => String(b).trim()).filter(Boolean), hasDates: !!e.start, description: e.description || '', tools: e.tools || '',
    }));
    const skillItems = (cv.skills || []).map((s) => s.name).filter(Boolean);
    const sections = {
      summary: !!(p.summary || '').trim(), experience: exps.length > 0, education: (cv.education || []).length > 0,
      skills: skillItems.length > 0, languages: (cv.languages || []).length > 0,
      certifications: (cv.certifications || []).length > 0, projects: (cv.projects || []).length > 0,
    };
    return finalize({
      mode: 'structured', text, exps, summary: p.summary || '', skillItems, sections,
      sectionOrder: ['summary', 'experience', 'education', 'skills'].filter((k) => sections[k]),
      contact: { email: !!p.email, phone: !!p.phone, location: !!(p.city || p.country) },
      flags: {}, targetTitle: p.title || '', country: (cv.settings && cv.settings.country) || p.country || 'France',
      titles: [p.title].concat(exps.map((e) => e.title)).filter(Boolean),
    });
  }

  function featuresFromText(text, fileFlags, country) {
    text = String(text || '');
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
    const sect = { header: [] };
    const order = [];
    let cur = 'header';
    lines.forEach((l) => {
      const t = l.trim();
      if (!t) return;
      const h = headingOf(t);
      if (h) { cur = h; if (!sect[h]) { sect[h] = []; order.push(h); } return; }
      (sect[cur] = sect[cur] || []).push(t);
    });

    // expériences
    const entries = [];
    const expLines = sect.experience || [];
    let entry = null, pend = [];
    const rangeAhead = (i) => { let seen = 0; for (let j = i + 1; j < expLines.length && seen < 2; j++) { seen++; if (RANGE.test(U.norm(expLines[j]))) return true; } return false; };
    expLines.forEach((t, i) => {
      const nt = U.norm(t);
      const m = RANGE.exec(nt);
      if (m) {
        const isPresent = new RegExp('^(' + PRESENT_RE + ')$').test(m[2]);
        entry = { start: parseDate(m[1], false), end: isPresent ? '' : parseDate(m[2], true), current: isPresent, bullets: [], hasDates: true, lead: [], description: '', tools: '' };
        const splitLead = (x) => x.split(/\s*[|–—,]\s*|\s+-\s+|\s+chez\s+|\s+at\s+/).map((y) => y.trim()).filter((y) => y.length > 2);
        const before = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/[()]/g, ' ');
        const parts = before.split(/\s*[|–—,]\s*|\s+-\s+|\s+chez\s+|\s+at\s+/).map((x) => x.trim()).filter((x) => x.length > 2);
        const pending = pend.splice(0);
        if (parts.length && entries.length) {
          // les lignes en attente appartiennent à l'expérience précédente (outils, etc.)
          const prev = entries[entries.length - 1];
          pending.forEach((pl) => { if (/^(outils|tools|environnement)/i.test(pl)) prev.tools = pl; else prev.bullets.push(pl); });
          entry.lead = parts;
        } else entry.lead = pending.slice(-2).reduce((a, x) => a.concat(splitLead(x)), []).concat(parts);
        entries.push(entry);
        return;
      }
      if (!entry) { pend.push(t); return; }
      if (!isBulletLine(t) && U.words(t).length < 7 && rangeAhead(i)) { pend.push(t); return; }
      if (isBulletLine(t) || U.words(t).length >= 7) entry.bullets.push(stripBullet(t));
      else if (entry.bullets.length === 0) entry.lead.push(t);
      else entry.bullets.push(t);
    });
    entries.forEach((e) => { e.title = e.lead[0] || ''; e.company = e.lead[1] || ''; });

    const headerLines = (sect.header || []).slice(0, 14).join('\n');
    const top = lines.slice(0, 16).join('\n');
    const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);
    const phoneM = (top.match(/\+?\d[\d\s().-]{7,}\d/g) || []).some((x) => x.replace(/\D/g, '').length >= 9);
    const loc = /\b\d{4,5}\b|France|Alg[ée]rie|Suisse|Belgique|Canada|Paris|Lyon|Marseille|Lille|Alger|Bruxelles|Gen[èe]ve|Londres|Toulouse|Nantes|Bordeaux|Luxembourg|Montr[ée]al|,\s*[A-Z][a-zéè]+/.test(top);

    const skillText = (sect.skills || []).join('\n');
    const skillItems = skillText.split(/[,;|•·\n]+|:/).map((s) => stripBullet(s.trim())).filter((s) => s.length >= 2 && s.length <= 40);

    const nonEmpty = lines.filter((l) => l.trim());
    const colLines = nonEmpty.filter((l) => /\S\s{4,}\S|\t/.test(l)).length;
    const pipeLines = nonEmpty.filter((l) => (l.match(/\|/g) || []).length >= 2).length;
    const flags = Object.assign({}, fileFlags || {});
    flags.multiColumn = nonEmpty.length > 8 && colLines / nonEmpty.length > 0.12 && colLines >= 4;
    flags.pipes = pipeLines >= 5;

    const sections = {
      summary: !!(sect.summary && sect.summary.length), experience: !!(sect.experience && sect.experience.length),
      education: !!(sect.education && sect.education.length), skills: !!(sect.skills && sect.skills.length),
      languages: !!(sect.languages && sect.languages.length), certifications: !!(sect.certifications && sect.certifications.length),
      projects: !!(sect.projects && sect.projects.length),
    };
    const firstHeader = (sect.header || []).slice(0, 3);
    return finalize({
      mode: 'text', text, exps: entries, summary: (sect.summary || []).join(' '), skillItems, sections,
      sectionOrder: order.filter((k) => ['summary', 'experience', 'education', 'skills'].includes(k)),
      contact: { email, phone: phoneM, location: loc }, flags, targetTitle: firstHeader[1] || '',
      country: country || 'France', titles: entries.map((e) => e.title).filter(Boolean), _header: headerLines,
    });
  }

  function buildFeatures(src, country) {
    if (src && src.candidateProfile) return featuresFromCV(src);
    if (src && src.cv) return featuresFromCV(src.cv);
    return featuresFromText(src && src.text, src && src.flags, country);
  }

  /* ------------------------------------------------------------------ */
  /* Vérifications de bas niveau                                          */
  /* ------------------------------------------------------------------ */
  function startsWithAction(b) {
    const n = U.norm(b).replace(/^[\W_]+/, '').replace(/^(j'ai|j'|je)\s*/, '');
    if (Data.WEAK_OPENERS.test(n)) return false;
    return Data.ACTION_STARTS.some((s) => n.startsWith(s));
  }

  function spellingIssues(text) {
    const issues = [];
    const n = U.norm(text);
    const typo = n.match(/\b(experiance|competance|competances|responsablite|developement|devellopement|recament|gestionaire|comunication|communcation|manageur|dynamisme?e?\s+motive)\b/g);
    if (typo) typo.slice(0, 3).forEach((t) => issues.push('faute probable : « ' + t + ' »'));
    const dbl = n.match(/\b([a-z]{3,})[ \t]+\1\b/g);
    if (dbl) dbl.slice(0, 3).forEach((t) => issues.push('mot répété : « ' + t + ' »'));
    const sp = text.match(/\S \s*[,.;](?=\s|$)/g);
    if (sp && sp.length > 2) issues.push('espaces avant la ponctuation (' + sp.length + ')');
    return issues;
  }

  function isGenericSummary(summary) {
    const n = U.norm(summary);
    const hits = Data.GENERIC_PHRASES.filter((p) => n.includes(p));
    const kw = extractKeywords(summary).filter((k) => k.cat !== 'soft' && k.cat !== 'langue').length;
    return { hits, kw, generic: (hits.length >= 1 && kw < 3) || hits.length >= 2 || (n.trim().length > 0 && kw < 2) };
  }

  function titleTokens(s) {
    return U.norm(s).replace(/\b(h\s*\/\s*f|f\s*\/\s*h|m\s*\/\s*f|h|f)\b/g, ' ').split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 2 && !Data.STOPWORDS.has(w)).map((w) => w.slice(0, 5));
  }
  function titleSimilarity(offerTitle, cvTitles) {
    const ot = titleTokens(offerTitle);
    if (!ot.length) return 0;
    let best = 0;
    (cvTitles || []).forEach((t) => {
      const ct = new Set(titleTokens(t));
      best = Math.max(best, ot.filter((w) => ct.has(w)).length / ot.length);
    });
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Analyse d'une offre d'emploi                                          */
  /* ------------------------------------------------------------------ */
  const OFFER_SECTIONS = [
    ['responsibilities', /^(vos |les )?(responsabilites?|responsibilities)\b/],
    ['missions', /^(vos |les |nos )?(missions?( principales)?|fonctions?|role|le poste|description du poste|ce que vous ferez|activites|taches|your role|what you(?:'ll| will) do)\b/],
    ['required', /^(profil( recherche)?|votre profil|competences( requises| attendues| cles)?|pre-?requis|requirements?|qualifications?|vous avez|vous etes|ce que nous attendons|exigences?|indispensables?|vos atouts|required)\b/],
    ['nice', /^(souhaite|souhaites|atouts?|apprecie|un plus|idealement|nice to have|bonus|preferred|plus)\b/],
    ['company', /^(a propos|qui sommes|notre entreprise|l'entreprise|about us|presentation|notre histoire|qui est)\b/],
    ['benefits', /^(avantages|nous offrons|ce que nous offrons|remuneration|benefits|on vous offre|processus de recrutement|pourquoi nous rejoindre)\b/],
  ];
  const NICE_MARK = /(souhait|apprecie|un plus|est un plus|sont un plus|atout|idealement|bonus|nice to have|preferred|serait un|de preference)/;
  const STRONG_MARK = /(indispensable|obligatoire|exige|imperatif|requis|must have|incontournable)/;
  const CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Rennes', 'Montpellier', 'Grenoble', 'Alger', 'Oran', 'Constantine', 'Bruxelles', 'Genève', 'Lausanne', 'Zurich', 'Luxembourg', 'Montréal', 'Toronto', 'Londres', 'Berlin', 'New York', 'Sydney'];
  const GENERIC_WORDS = new Set(['poste', 'entreprise', 'equipe', 'experience', 'candidat', 'recherche', 'profil', 'mission', 'missions', 'contrat', 'societe', 'travail', 'notre', 'votre', 'vous', 'nous', 'projets', 'projet', 'sein', 'cadre', 'afin', 'ainsi', 'avoir', 'faire', 'plus', 'aurele']);

  function analyzeJobOffer(raw) {
    raw = String(raw || '');
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const offer = {
      raw, title: '', company: '', location: '', contract: '', experienceLevel: '', minYears: 0, education: [],
      required: [], nice: [], software: [], tech: [], languages: [], missions: [], responsibilities: [], keywords: [], frequent: [], sectors: [], notes: [],
    };
    if (!lines.length) return offer;

    const labelled = (re) => { for (const l of lines) { const m = re.exec(l); if (m && m[1].trim()) return m[1].trim(); } return ''; };
    const cleanTitle = (t) => t.replace(/\s*[(\[]?\s*(h\s*[\/-]\s*f|f\s*[\/-]\s*h|m\s*\/\s*f|h\/f\/x)\s*[)\]]?/ig, '').split(/\s+[-–|]\s+|\s+chez\s+|\s+@\s+/)[0].trim();

    offer.title = cleanTitle(labelled(/^(?:intitul[ée] du poste|poste|titre(?: du poste)?|job title|position)\s*[:\-]\s*(.+)$/i) ||
      (lines[0].length <= 90 && !/^(entreprise|soci[ée]t[ée]|lieu|contrat)\s*:/i.test(lines[0]) ? lines[0] : ''));

    offer.company = labelled(/^(?:entreprise|soci[ée]t[ée]|employeur|company|organisation)\s*[:\-]\s*(.+)$/i);
    if (!offer.company) {
      for (const l of lines.slice(0, 12)) {
        let m = /\bchez\s+([A-ZÀ-Ý][\wÀ-ÿ&'’.-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ&'’.-]*){0,3})/.exec(l) ||
          /^(?:rejoignez|join)\s+([A-ZÀ-Ý][\wÀ-ÿ&'’.-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ&'’.-]*){0,3})/.exec(l) ||
          /^([A-ZÀ-Ý][\wÀ-ÿ&'’.-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ&'’.-]*){0,3})\s+(?:est|recrute|cherche|propose|souhaite|is|is hiring)\b/.exec(l);
        if (m) { offer.company = m[1].trim(); break; }
      }
    }

    offer.location = labelled(/^(?:lieu(?: de travail)?|localisation|localit[ée]|ville|location|adresse)\s*[:\-]\s*(.+)$/i);
    if (!offer.location) {
      const head = lines.slice(0, 14).join(' ');
      const city = CITIES.find((c) => new RegExp('\\b' + c + '\\b').test(head));
      if (city) offer.location = city;
    }
    if (/t[ée]l[ée]travail|remote|hybride/i.test(raw) && offer.location && !/t[ée]l[ée]travail|remote|hybride/i.test(offer.location)) offer.location += ' (télétravail mentionné)';

    const contract = /\b(cdi|cdd|stage|alternance|apprentissage|freelance|int[ée]rim|full[- ]time|part[- ]time)\b/i.exec(raw);
    offer.contract = contract ? contract[1].toUpperCase() : '';

    const nr = U.norm(raw);
    let m = /(\d{1,2})\s*(?:a|-|to)\s*(\d{1,2})\s*ans?/.exec(nr);
    if (m) { offer.minYears = +m[1]; offer.experienceLevel = m[1] + ' à ' + m[2] + ' ans d\'expérience'; }
    else if ((m = /(\d{1,2})\s*\+?\s*ans?\s*(?:d'experience|minimum|d'exp)|experience\s*(?:de|d'au moins|minimale de)\s*(\d{1,2})\s*ans|(\d{1,2})\+?\s*years/.exec(nr))) {
      offer.minYears = +(m[1] || m[2] || m[3]);
      offer.experienceLevel = offer.minYears + ' ans d\'expérience minimum';
    } else if (/junior|debutant/.test(nr)) { offer.experienceLevel = 'Junior / débutant'; }
    else if (/senior|confirme/.test(nr)) { offer.experienceLevel = 'Confirmé / senior'; }

    // découpage en sections
    let section = 'intro';
    const buckets = { missions: [], responsibilities: [], required: [], nice: [], company: [], benefits: [], intro: [] };
    const items = [];
    lines.forEach((l, i) => {
      const n = U.norm(l).replace(/[:\s]+$/, '');
      if (!isBulletLine(l) && l.length <= 60) {
        const hit = OFFER_SECTIONS.find(([, re]) => re.test(n));
        if (hit && (l.endsWith(':') || n.split(' ').length <= 5)) { section = hit[0]; return; }
      }
      if (i === 0) return;
      const text = stripBullet(l);
      (buckets[section] = buckets[section] || []).push(text);
      items.push({ text, section });
    });

    // mots-clés : classement obligatoire / souhaité / contexte
    const reqMap = new Map(), niceMap = new Map(), ctxMap = new Map();
    const put = (map, k) => { if (!map.has(k.term)) map.set(k.term, { term: k.term, cat: k.cat, group: k.group, count: 0 }); map.get(k.term).count += k.count; };
    items.forEach(({ text, section: sec }) => {
      const n = U.norm(text);
      const kws = extractKeywords(text);
      let cls;
      if (sec === 'company' || sec === 'benefits') cls = 'ctx';
      else if (STRONG_MARK.test(n)) cls = 'req';
      else if (NICE_MARK.test(n) || sec === 'nice') cls = 'nice';
      else cls = 'req';
      kws.forEach((k) => put(cls === 'req' ? reqMap : cls === 'nice' ? niceMap : ctxMap, k));
    });
    // le titre compte comme exigence
    extractKeywords(offer.title).forEach((k) => { if (!reqMap.has(k.term)) put(reqMap, k); });
    niceMap.forEach((v, k) => { if (reqMap.has(k)) niceMap.delete(k); });
    ctxMap.forEach((v, k) => { if (reqMap.has(k) || niceMap.has(k)) ctxMap.delete(k); });

    const langs = [];
    const split = (map) => {
      const list = [];
      map.forEach((v) => { if (v.cat === 'langue') return; list.push(v); });
      return list;
    };
    offer.required = split(reqMap);
    offer.nice = split(niceMap);
    [...reqMap.values(), ...niceMap.values()].filter((k) => k.cat === 'langue').forEach((k) => {
      const line = items.find((it) => extractKeywords(it.text).some((x) => x.term === k.term));
      const lv = line ? /(bilingue|courant|professionnel|natif|langue maternelle|interm[ée]diaire|notions?|scolaire|\b[abc][12]\b)/i.exec(line.text) : null;
      langs.push({ name: k.term, level: lv ? lv[1] : '', rank: lv ? levelRank(lv[1]) : 0, required: reqMap.has(k.term) });
    });
    // langues imposées par le texte (ex. « Anglais courant »)
    offer.languages = langs;
    const allKw = [...reqMap.values(), ...niceMap.values(), ...ctxMap.values()];
    offer.software = allKw.filter((k) => k.cat === 'logiciel');
    offer.tech = allKw.filter((k) => k.cat === 'technologie');
    offer.sectors = allKw.filter((k) => k.cat === 'secteur').map((k) => k.term);
    offer.keywords = allKw.filter((k) => k.cat !== 'langue' || true).sort((a, b) => {
      const ra = reqMap.has(a.term) ? 1 : 0, rb = reqMap.has(b.term) ? 1 : 0;
      return rb - ra || b.count - a.count;
    });

    // termes récurrents hors lexique (conservent accents et casse d'origine)
    const freq = new Map(), disp = new Map();
    (raw.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]{4,}/g) || []).forEach((w) => {
      const key = U.norm(w);
      if (Data.STOPWORDS.has(key) || GENERIC_WORDS.has(key) || ALL_FORMS.has(key)) return;
      freq.set(key, (freq.get(key) || 0) + 1);
      if (!disp.has(key)) disp.set(key, w.toLowerCase());
    });
    offer.frequent = [...freq.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, c]) => ({ term: disp.get(k), count: c, cat: 'terme' }));

    // formation
    const formLines = items.map((i) => i.text).filter((t) => /\b(bac\s*\+\s*\d|master|licence|bachelor|ing[ée]nieur|mba|doctorat|bts|dut|dipl[ôo]me)\b/i.test(t));
    offer.education = formLines.slice(0, 3);

    // missions / responsabilités
    let missions = buckets.missions.filter((t) => U.words(t).length >= 3);
    let resp = buckets.responsibilities.filter((t) => U.words(t).length >= 3);
    if (missions.length && !resp.length) {
      const isResp = (t) => /^(garantir|etre responsable|assurer|superviser|manager|encadrer|gerer|veiller)/.test(U.norm(t));
      resp = missions.filter(isResp);
      missions = missions.filter((t) => !isResp(t));
    }
    offer.missions = missions;
    offer.responsibilities = resp;

    const notes = [];
    if (!offer.title) notes.push('titre');
    if (!offer.company) notes.push('entreprise');
    if (!offer.location) notes.push('localisation');
    if (!offer.experienceLevel) notes.push('niveau d\'expérience');
    if (!offer.education.length) notes.push('formation');
    if (!missions.length && !resp.length) notes.push('missions');
    offer.notes = notes;
    return offer;
  }

  /* ------------------------------------------------------------------ */
  /* Matching CV / offre                                                  */
  /* ------------------------------------------------------------------ */
  function calculateMatchScore(f, offer) {
    const has = (k) => f.keywordSet.has(k.term);
    const req = offer.required || [], nice = offer.nice || [];
    const wsum = (arr, pred) => arr.reduce((s, k) => s + (!pred || pred(k) ? weightOf(k) : 0), 0);
    const reqTotal = wsum(req), reqFound = wsum(req, has);
    const niceTotal = wsum(nice), niceFound = wsum(nice, has);

    // langues exigées
    const cvLang = {};
    f.keywords.filter((k) => k.cat === 'langue').forEach((k) => { cvLang[k.term] = true; });

    const matched = req.filter(has).concat(nice.filter(has));
    const missingReq = req.filter((k) => !has(k));
    const missingNice = nice.filter((k) => !has(k));

    const verify = [];
    missingReq.concat(missingNice).forEach((k) => {
      if (k.cat === 'soft') return;
      const rel = RELATED[k.group];
      if (!rel) return;
      const related = f.keywords.filter((c) => c.term !== k.term && c.cat !== 'soft' && c.cat !== 'langue' && (rel.includes(c.group) || c.group === k.group)).slice(0, 3).map((c) => c.term);
      if (related.length) verify.push({ term: k.term, related });
    });

    const titleSim = offer.title ? titleSimilarity(offer.title, f.titles) : 0;
    const cvYears = U.expYears(f.exps);
    const yearsRatio = offer.minYears ? Math.min(1, cvYears / offer.minYears) : 1;

    const parts = [];
    if (reqTotal) parts.push({ id: 'required', label: 'Compétences obligatoires', w: 55, v: reqFound / reqTotal, detail: Math.round(reqFound) + '/' + Math.round(reqTotal) });
    if (niceTotal) parts.push({ id: 'nice', label: 'Compétences souhaitées', w: 15, v: niceFound / niceTotal, detail: Math.round(niceFound) + '/' + Math.round(niceTotal) });
    if (offer.title) parts.push({ id: 'title', label: 'Intitulé de poste', w: 15, v: titleSim, detail: U.pct(titleSim) + ' %' });
    if (offer.minYears) parts.push({ id: 'years', label: 'Années d\'expérience', w: 15, v: yearsRatio, detail: cvYears + ' / ' + offer.minYears + ' ans' });
    if (!reqTotal && !niceTotal && offer.frequent && offer.frequent.length) {
      const hit = offer.frequent.filter((t) => f.norm.includes(U.norm(t.term))).length;
      parts.push({ id: 'frequent', label: 'Termes récurrents de l\'offre', w: 55, v: hit / offer.frequent.length, detail: hit + '/' + offer.frequent.length });
    }
    const wTotal = parts.reduce((s, p) => s + p.w, 0);
    const score = wTotal ? Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / wTotal) * 100) : 0;

    // expériences pertinentes
    const termSet = new Set(req.concat(nice).filter((k) => k.cat !== 'soft').map((k) => k.term));
    const relevantExperiences = f.exps.map((e, index) => {
      const txt = [e.title, e.description, e.tools].concat(e.bullets).join(' \n ');
      const terms = extractKeywords(txt).filter((k) => termSet.has(k.term)).map((k) => k.term);
      const ts = offer.title ? titleSimilarity(offer.title, [e.title]) : 0;
      return { index, title: e.title, company: e.company, start: e.start, end: e.end, current: e.current, terms, score: terms.length + ts * 2 };
    }).filter((e) => e.terms.length > 0 || e.score > 1).sort((a, b) => b.score - a.score);

    return {
      score, parts, matched, missing: missingReq, missingNice, verify, relevantExperiences,
      reqFound: Math.round(reqFound), reqTotal: Math.round(reqTotal), titleSim, cvYears, reqYears: offer.minYears || 0,
      cvLanguages: Object.keys(cvLang),
    };
  }

  function findMissingKeywords(f, offer) {
    const m = calculateMatchScore(f, offer);
    return { required: m.missing, nice: m.missingNice, verify: m.verify };
  }

  /* ------------------------------------------------------------------ */
  /* Score ATS                                                            */
  /* ------------------------------------------------------------------ */
  const round1 = (n) => Math.round(n * 10) / 10;
  function chk(id, label, max, ratio, info) {
    ratio = Math.max(0, Math.min(1, ratio));
    return Object.assign({ id, label, max, ratio, points: round1(max * ratio), status: ratio >= 0.85 ? 'ok' : ratio >= 0.5 ? 'warn' : 'bad' }, info || {});
  }
  function dim(id, label, max, checks) {
    const tm = checks.reduce((s, c) => s + c.max, 0) || 1;
    const tp = checks.reduce((s, c) => s + c.points, 0);
    return { id, label, max, points: round1((tp / tm) * max), pct: Math.round((tp / tm) * 100), checks };
  }

  function structureDim(f) {
    const txt = f.mode === 'text';
    const unv = 'Non détectable à partir d\'un texte seul : vérifiez sur votre fichier.';
    const c = [];
    c.push(chk('columns', 'Colonne unique', 3, f.flags.multiColumn ? 0 : 1, {
      note: txt ? 'Heuristique sur la mise en page du texte extrait.' : 'Tous les modèles de l\'application sont en une seule colonne.',
      good: 'Mise en page en colonne unique', bad: 'Mise en page probablement en plusieurs colonnes : les ATS peuvent lire les blocs dans le mauvais ordre', action: 'Passer à une mise en page en une seule colonne' }));
    const tabl = f.flags.tables || f.flags.pipes;
    c.push(chk('tables', 'Absence de tableaux complexes', 2, tabl ? 0 : 1, {
      note: txt && !f.flags.tables && f.flags.tables !== false && !f.flags.fromFile ? unv : '', unverified: txt && !f.flags.fromFile,
      good: 'Aucun tableau complexe détecté', bad: 'Tableau(x) détecté(s) : leur contenu peut être lu dans le désordre', action: 'Remplacer les tableaux par des listes à puces' }));
    const boxes = f.flags.textBoxes || f.flags.images;
    c.push(chk('boxes', 'Pas de zones de texte ni d\'images', 2, boxes ? (f.flags.textBoxes ? 0 : 0.5) : 1, {
      note: txt && !f.flags.fromFile ? unv : '', unverified: txt && !f.flags.fromFile,
      good: 'Aucune zone de texte ni image détectée', bad: 'Zones de texte ou images détectées : leur contenu peut être invisible pour un ATS', action: 'Supprimer les zones de texte et ne pas mettre d\'information essentielle dans une image' }));
    c.push(chk('headerfooter', 'Rien d\'essentiel dans l\'en-tête / le pied de page', 2, f.flags.headerFooter ? 0 : 1, {
      note: txt && !f.flags.fromFile ? unv : '', unverified: txt && !f.flags.fromFile,
      good: 'En-tête et pied de page sans information essentielle', bad: 'Des informations figurent dans l\'en-tête ou le pied de page : certains ATS les ignorent', action: 'Déplacer les coordonnées dans le corps du document' }));
    const nStd = ['experience', 'education', 'skills'].filter((k) => f.sections[k]).length + (f.sections.summary ? 1 : 0);
    const missing = ['experience', 'education', 'skills'].filter((k) => !f.sections[k]).map((k) => ({ experience: 'Expérience', education: 'Formation', skills: 'Compétences' }[k]));
    c.push(chk('headings', 'Titres de sections standards', 4, nStd / 4, {
      note: nStd + ' section(s) standard détectée(s) sur 4 attendues.',
      good: 'Titres de sections standards (Expérience, Formation, Compétences)', bad: 'Sections standard manquantes ou non reconnues : ' + (missing.join(', ') || 'Résumé'), action: 'Utiliser des titres standards : Résumé professionnel, Expérience professionnelle, Formation, Compétences' }));
    const idx = (k) => f.sectionOrder.indexOf(k);
    const okOrder = (!f.sections.summary || idx('summary') <= 0) && (idx('experience') < 0 || idx('education') < 0 || idx('experience') < idx('education'));
    c.push(chk('order', 'Ordre logique des sections', 2, okOrder ? 1 : 0.5, {
      note: 'Ordre constaté : ' + (f.sectionOrder.join(' → ') || 'non détecté'),
      good: 'Ordre des sections logique', bad: 'Ordre des sections inhabituel (résumé en premier, puis expérience, puis formation)', action: 'Réordonner : résumé, expérience, formation, compétences' }));
    const nContact = (f.contact.email ? 1 : 0) + (f.contact.phone ? 1 : 0) + (f.contact.location ? 1 : 0);
    const lack = [!f.contact.email && 'email', !f.contact.phone && 'téléphone', !f.contact.location && 'ville'].filter(Boolean);
    c.push(chk('contact', 'Coordonnées complètes', 3, nContact / 3, {
      note: nContact + '/3 (email, téléphone, ville).', good: 'Coordonnées complètes', bad: 'Coordonnées incomplètes : ' + lack.join(', '), action: 'Ajouter ' + lack.join(', ') + ' dans l\'en-tête du CV' }));
    c.push(chk('extract', 'Texte exploitable', 2, Math.min(1, f.wordCount / 150), {
      note: f.wordCount + ' mots extraits.', good: 'Texte lisible et extractible', bad: 'Très peu de texte extrait (' + f.wordCount + ' mots) : le document est peut-être une image ou trop court', action: 'Enregistrer le CV en PDF texte ou DOCX, pas en image' }));
    return dim('structure', 'Structure ATS', 20, c);
  }

  function keywordsDim(f) {
    const c = [];
    const main = f.keywords.filter((k) => k.cat !== 'langue' && k.cat !== 'soft');
    c.push(chk('volume', 'Volume de mots-clés métier', 10, main.length / 16, {
      note: main.length + ' mot(s)-clé(s) métier reconnu(s) (objectif indicatif : 16).', good: 'Bon volume de mots-clés métier (' + main.length + ')', bad: 'Seulement ' + main.length + ' mot(s)-clé(s) métier reconnu(s)', action: 'Ajouter les compétences, logiciels et méthodes que vous maîtrisez réellement' }));
    const cats = new Set(main.map((k) => k.cat));
    c.push(chk('diversity', 'Diversité des types de mots-clés', 5, Math.min(1, cats.size / 4), {
      note: [...cats].map((x) => Data.CATEGORY_LABELS[x]).join(', ') || 'aucun', good: 'Mots-clés variés (compétences, outils, méthodes…)', bad: 'Peu de catégories couvertes (compétences, logiciels, méthodes, technologies, secteur)', action: 'Compléter les catégories absentes : logiciels, méthodes, secteur' }));
    const skillKw = extractKeywords(f.skillItems.join(', ')).filter((k) => k.cat !== 'langue' && k.cat !== 'soft');
    const expTxt = U.norm([f.summary].concat(f.exps.map((e) => [e.title, e.description, e.tools].concat(e.bullets).join(' '))).join(' '));
    const expSet = new Set(extractKeywords(expTxt).map((k) => k.term));
    const backed = skillKw.filter((k) => expSet.has(k.term)).length;
    c.push(chk('consistency', 'Compétences illustrées par l\'expérience', 5, skillKw.length ? backed / skillKw.length : 0, {
      note: skillKw.length ? backed + '/' + skillKw.length + ' compétences de la section « Compétences » réapparaissent dans vos expériences.' : 'Section compétences vide ou non reconnue.',
      good: 'Les compétences listées sont illustrées dans les expériences', bad: 'Plusieurs compétences listées n\'apparaissent dans aucune expérience', action: 'Illustrer chaque compétence clé par une réalisation dans vos expériences' }));
    c.push(chk('skillsize', 'Section compétences détaillée', 3, Math.min(1, f.skillItems.length / 8), {
      note: f.skillItems.length + ' compétence(s) listée(s).', good: 'Section compétences détaillée', bad: 'Section compétences courte (' + f.skillItems.length + ')', action: 'Détailler vos compétences par catégorie (techniques, logiciels, méthodes)' }));
    const tools = f.keywords.filter((k) => k.cat === 'logiciel' || k.cat === 'technologie').length;
    c.push(chk('tools', 'Outils et technologies cités', 2, Math.min(1, tools / 3), {
      note: tools + ' outil(s)/technologie(s).', good: 'Outils et technologies bien cités', bad: 'Peu d\'outils ou de technologies cités', action: 'Mentionner les outils utilisés dans chaque expérience' }));
    return dim('keywords', 'Mots-clés', 25, c);
  }

  function experienceDim(f) {
    const c = [];
    const exps = f.exps;
    if (!exps.length) {
      c.push(chk('none', 'Expériences professionnelles', 20, 0, { note: 'Aucune expérience détectée.', bad: 'Aucune expérience professionnelle détectée', action: 'Ajouter vos expériences avec poste, entreprise, dates et réalisations' }));
      return dim('experience', 'Expérience', 20, c);
    }
    const complete = exps.filter((e) => e.title && e.company && e.start).length / exps.length;
    c.push(chk('complete', 'Poste, entreprise et dates renseignés', 4, complete, {
      note: Math.round(complete * exps.length) + '/' + exps.length + ' expérience(s) complète(s).', good: 'Postes, entreprises et dates clairement renseignés', bad: 'Certaines expériences n\'ont pas de poste, d\'entreprise ou de date', action: 'Renseigner poste, entreprise et dates pour chaque expérience' }));
    let ratio = 1, notes = [];
    const dated = exps.filter((e) => U.toIdx(e.start) != null);
    if (dated.length >= 2) {
      let outOfOrder = 0, gaps = 0;
      for (let i = 1; i < dated.length; i++) {
        const prev = dated[i - 1], cur = dated[i];
        if (U.toIdx(cur.start) > U.toIdx(prev.start)) outOfOrder++;
        else {
          const end = cur.current || !cur.end ? U.toIdx(U.today()) : U.toIdx(cur.end);
          if (U.toIdx(prev.start) - end > 6) { gaps++; notes.push('interruption > 6 mois avant ' + U.fmtMonth(prev.start)); }
        }
      }
      ratio = 1 - 0.34 * outOfOrder - 0.2 * gaps;
      if (outOfOrder) notes.push('ordre non antéchronologique');
    }
    c.push(chk('chrono', 'Chronologie cohérente (antéchronologique)', 4, ratio, {
      note: notes.join(' ; ') || 'Chronologie cohérente.', good: 'Chronologie cohérente', bad: 'Chronologie à clarifier : ' + notes.join(' ; '), action: 'Classer les expériences de la plus récente à la plus ancienne et expliquer toute interruption longue' }));
    const top = exps.slice(0, 3);
    const avgB = top.reduce((s, e) => s + (e.bullets.length || (e.description ? 1.5 : 0)), 0) / top.length;
    c.push(chk('depth', 'Réalisations détaillées (≥ 3 par poste récent)', 3, avgB / 3, {
      note: 'Moyenne : ' + round1(avgB) + ' réalisation(s) par poste récent.', good: 'Expériences récentes bien détaillées', bad: 'Les expériences récentes contiennent peu de réalisations', action: 'Détailler 3 à 5 réalisations pour chaque poste récent' }));
    const bl = f.allBullets;
    const verbRatio = bl.length ? bl.filter(startsWithAction).length / bl.length : 0;
    c.push(chk('verbs', 'Verbes d\'action en début de phrase', 3, verbRatio / 0.7, {
      note: Math.round(verbRatio * 100) + ' % des réalisations débutent par un verbe d\'action (objectif indicatif : 70 %).', good: 'Bon usage des verbes d\'action', bad: 'Trop de réalisations ne commencent pas par un verbe d\'action', action: 'Commencer chaque réalisation par un verbe d\'action (piloté, déployé, réduit, négocié…)' }));
    const mRatio = bl.length ? bl.filter(U.hasMetric).length / bl.length : 0;
    c.push(chk('metrics', 'Résultats mesurables', 6, mRatio / 0.4, {
      note: Math.round(mRatio * 100) + ' % des réalisations contiennent un chiffre (objectif indicatif : 40 %).', good: 'Résultats chiffrés présents', bad: 'Peu de résultats mesurables : seulement ' + Math.round(mRatio * 100) + ' % des réalisations sont chiffrées', action: 'Ajouter, lorsque vous les connaissez, des chiffres réels (%, €, volumes, taille d\'équipe, délais)' }));
    return dim('experience', 'Expérience', 20, c);
  }

  function readabilityDim(f) {
    const c = [];
    const w = f.wordCount;
    const maxPages = (Data.COUNTRIES[f.country] || {}).maxPages || 2;
    const maxW = maxPages * 550;
    const lenRatio = w < 250 ? w / 250 : w > maxW ? maxW / w : 1;
    c.push(chk('length', 'Longueur adaptée', 3, lenRatio, {
      note: w + ' mots (≈ ' + Math.max(1, round1(w / 550)) + ' page(s)) ; repère pour « ' + f.country + ' » : jusqu\'à ' + maxPages + ' page(s).', good: 'Longueur adaptée', bad: w < 250 ? 'CV très court (' + w + ' mots)' : 'CV trop long (' + w + ' mots) pour ' + f.country, action: w < 250 ? 'Développer les expériences et compétences' : 'Condenser : garder les réalisations les plus pertinentes' }));
    const bl = f.allBullets;
    const lens = bl.map((b) => U.words(b).length);
    const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const longShare = lens.length ? lens.filter((l) => l > 35).length / lens.length : 0;
    const blRatio = !lens.length ? 0.5 : (avg >= 6 && avg <= 28 ? 1 : avg < 6 ? avg / 6 : 28 / avg) * (1 - longShare * 0.5);
    c.push(chk('sentences', 'Phrases courtes et claires', 2, blRatio, {
      note: lens.length ? 'Longueur moyenne : ' + Math.round(avg) + ' mots par réalisation.' : 'Aucune réalisation détectée.', good: 'Phrases courtes et lisibles', bad: 'Phrases trop longues ou trop courtes', action: 'Viser 10 à 25 mots par réalisation' }));
    const freq = {};
    U.words(f.norm).forEach((x) => { if (x.length >= 6 && !Data.STOPWORDS.has(x) && !ALL_FORMS.has(x)) freq[x] = (freq[x] || 0) + 1; });
    const limit = Math.max(8, w / 45);
    const over = Object.entries(freq).filter(([, n]) => n > limit).sort((a, b) => b[1] - a[1]);
    const starters = {};
    bl.forEach((b) => { const s = U.norm(b).split(/\s+/)[0]; if (s) starters[s] = (starters[s] || 0) + 1; });
    const overStart = Object.entries(starters).filter(([, n]) => n > 3);
    const nRep = Math.min(4, over.length + overStart.length);
    c.push(chk('repeat', 'Peu de répétitions', 2, 1 - 0.25 * nRep, {
      note: over.length || overStart.length ? 'Répétitions : ' + over.slice(0, 3).map(([k, n]) => k + ' ×' + n).concat(overStart.slice(0, 2).map(([k, n]) => 'début « ' + k + ' » ×' + n)).join(', ') : 'Aucune répétition excessive.',
      good: 'Vocabulaire varié', bad: 'Répétitions détectées dans les mots ou les débuts de phrase', action: 'Varier le vocabulaire et les verbes en début de phrase' }));
    const sp = spellingIssues(f.text);
    c.push(chk('spelling', 'Orthographe (vérification de base)', 2, 1 - 0.3 * sp.length, {
      note: sp.length ? sp.join(' ; ') : 'Aucune anomalie détectée. Contrôle limité : ce n\'est pas un correcteur complet.', good: 'Aucune anomalie d\'orthographe détectée (contrôle de base)', bad: 'Anomalies possibles : ' + sp.join(' ; '), action: 'Relire le CV avec un correcteur orthographique complet' }));
    const g = isGenericSummary(f.summary);
    const sw = U.words(f.summary).length;
    const sRatio = !f.summary.trim() ? 0 : g.generic ? 0.2 : sw < 25 ? 0.6 : 1;
    c.push(chk('summary', 'Résumé spécifique', 6, sRatio, {
      note: !f.summary.trim() ? 'Pas de résumé détecté.' : 'Formules génériques : ' + (g.hits.join(', ') || 'aucune') + ' ; mots-clés métier : ' + g.kw + '.',
      good: 'Résumé professionnel spécifique', bad: !f.summary.trim() ? 'Aucun résumé professionnel' : 'Le résumé professionnel est trop générique ou trop peu spécifique', action: 'Réécrire le résumé avec votre métier, vos années d\'expérience, 3-4 compétences clés et un résultat réel' }));
    return dim('readability', 'Lisibilité', 15, c);
  }

  function relevanceDim(f, match) {
    const c = [];
    if (match) {
      const p = (id) => match.parts.find((x) => x.id === id);
      const req = p('required') || p('frequent');
      c.push(chk('coverage', 'Couverture des compétences de l\'offre', 12, req ? req.v : 0, {
        note: req ? req.detail : 'Aucune compétence reconnue dans l\'offre.', good: 'Bonne couverture des compétences de l\'offre', bad: 'Compétences de l\'offre insuffisamment couvertes', action: 'Intégrer, si elles sont vraies, les compétences manquantes de l\'offre' }));
      c.push(chk('otitle', 'Intitulé de poste proche de l\'offre', 4, match.titleSim, {
        note: U.pct(match.titleSim) + ' % de similarité.', good: 'Intitulé cohérent avec l\'offre', bad: 'Intitulé éloigné de celui de l\'offre', action: 'Adapter le résumé pour refléter le poste visé sans modifier vos intitulés réels' }));
      c.push(chk('oyears', 'Années d\'expérience demandées', 4, match.reqYears ? Math.min(1, match.cvYears / match.reqYears) : 1, {
        note: match.reqYears ? match.cvYears + ' an(s) vs ' + match.reqYears + ' demandé(s).' : 'Aucune durée exigée.', good: 'Expérience suffisante', bad: 'Expérience inférieure à celle demandée', action: 'Mettre en avant les expériences les plus proches du poste' }));
      return dim('relevance', 'Pertinence', 20, c);
    }
    const tt = f.targetTitle;
    const ts = tt ? titleSimilarity(tt, f.exps.map((e) => e.title)) : 0;
    c.push(chk('rtitle', 'Titre visé cohérent avec les expériences', 8, tt ? (ts >= 0.3 ? 1 : ts / 0.3) : 0, {
      note: tt ? 'Titre : « ' + tt + ' ».' : 'Titre professionnel absent.', good: 'Titre cohérent avec le parcours', bad: tt ? 'Le titre visé ne se retrouve pas dans vos intitulés de postes' : 'Aucun titre professionnel', action: 'Renseigner un titre professionnel cohérent avec vos postes' }));
    const sk = extractKeywords(f.summary).filter((k) => k.cat !== 'soft' && k.cat !== 'langue').length;
    c.push(chk('rsummary', 'Résumé porteur de mots-clés', 6, Math.min(1, sk / 3), {
      note: sk + ' mot(s)-clé(s) dans le résumé.', good: 'Résumé riche en mots-clés', bad: 'Résumé pauvre en mots-clés métier', action: 'Intégrer 3 à 4 compétences clés dans le résumé' }));
    const last = f.exps[0];
    let lr = 0;
    if (last) {
      const lk = new Set(extractKeywords([last.title, last.description, last.tools].concat(last.bullets).join(' ')).map((k) => k.term));
      const top = f.keywords.filter((k) => k.cat !== 'soft' && k.cat !== 'langue').slice(0, 6);
      lr = top.length ? top.filter((k) => lk.has(k.term)).length / top.length : 0;
    }
    c.push(chk('rlast', 'Cohérence avec l\'expérience la plus récente', 6, lr, {
      note: 'Les mots-clés principaux du CV se retrouvent dans le poste le plus récent.', good: 'Expérience récente alignée sur les compétences clés', bad: 'Les compétences clés du CV ne ressortent pas dans l\'expérience la plus récente', action: 'Mettre en avant vos compétences clés dans le poste le plus récent' }));
    return dim('relevance', 'Cohérence avec le poste visé', 20, c);
  }

  function labelOf(total) { return total >= 80 ? 'Excellent' : total >= 60 ? 'À améliorer' : 'Faible'; }

  function calculateATSScore(f, offer) {
    const match = offer ? calculateMatchScore(f, offer) : null;
    const dims = {
      structure: structureDim(f), keywords: keywordsDim(f), experience: experienceDim(f), readability: readabilityDim(f), relevance: relevanceDim(f, match),
    };
    const total = Math.round(Object.values(dims).reduce((s, d) => s + d.points, 0));
    const all = [];
    Object.values(dims).forEach((d) => d.checks.forEach((ch) => all.push(Object.assign({ dim: d.label }, ch))));

    const strengths = all.filter((x) => x.status === 'ok' && x.good).sort((a, b) => b.max - a.max).map((x) => x.good).slice(0, 6);
    const issues = all.filter((x) => x.status !== 'ok' && x.bad).sort((a, b) => (b.max - b.points) - (a.max - a.points));
    const issueTexts = issues.map((x) => x.bad).slice(0, 8);
    const actions = [];
    issues.forEach((x) => { if (x.action && !actions.includes(x.action)) actions.push(x.action); });

    // actions ciblées
    const weakExp = f.exps.map((e) => ({ e, r: e.bullets.length ? e.bullets.filter(U.hasMetric).length / e.bullets.length : 1 })).filter((x) => x.r < 0.3 && x.e.bullets.length).sort((a, b) => a.r - b.r)[0];
    if (weakExp) actions.unshift('Quantifier les résultats de l\'expérience « ' + (weakExp.e.title || 'sans titre') + (weakExp.e.company ? ' — ' + weakExp.e.company : '') + ' » (chiffres réels uniquement)');
    if (match) {
      match.missing.filter((k) => k.cat !== 'soft').slice(0, 5).forEach((k) => actions.push('Ajouter « ' + k.term + ' » uniquement si cela correspond réellement à votre expérience'));
    }
    return {
      total, label: labelOf(total), dims, mode: match ? 'offer' : 'title', match,
      strengths, issues: issueTexts, actions: actions.slice(0, 9),
      formula: 'Score = Structure (' + dims.structure.points + '/20) + Mots-clés (' + dims.keywords.points + '/25) + Expérience (' + dims.experience.points + '/20) + Lisibilité (' + dims.readability.points + '/15) + ' + (match ? 'Pertinence' : 'Cohérence') + ' (' + dims.relevance.points + '/20)',
      disclaimer: 'Estimation d\'optimisation interne : elle ne reproduit pas un ATS réel et ne garantit pas d\'obtenir un entretien.',
    };
  }

  function analyzeCV(src, opts) {
    opts = opts || {};
    const f = buildFeatures(src, opts.country);
    const score = calculateATSScore(f, opts.offer || null);
    return { features: f, score, keywordsByCat: groupByCategory(f.keywords) };
  }

  /* ------------------------------------------------------------------ */
  /* Import de fichiers : TXT, DOCX (zip + deflate natifs), PDF best-effort */
  /* ------------------------------------------------------------------ */
  async function inflate(u8, fmt) {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream(fmt));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Archive DOCX invalide');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, csize, lho };
      p += 46 + nlen + elen + clen;
    }
    return {
      names: Object.keys(files),
      async read(name) {
        const e = files[name];
        if (!e) return null;
        const start = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true);
        const data = u8.subarray(start, start + e.csize);
        return new TextDecoder().decode(e.method === 0 ? data : await inflate(data, 'deflate-raw'));
      },
    };
  }

  function xmlToText(xml) {
    return xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'')
      .replace(/\n{3,}/g, '\n\n');
  }

  async function docxToText(buf) {
    const zip = await readZip(buf);
    const doc = await zip.read('word/document.xml');
    if (!doc) throw new Error('document.xml introuvable');
    const flags = { fromFile: true, tables: /<w:tbl>/.test(doc), textBoxes: /<w:txbxContent>/.test(doc), images: /<w:drawing>|<w:pict>/.test(doc), headerFooter: false };
    for (const name of zip.names.filter((x) => /^word\/(header|footer)\d*\.xml$/.test(x))) {
      const t = xmlToText((await zip.read(name)) || '');
      if (/[\w.+-]+@[\w-]+\.[\w.-]+|\+?\d[\d\s().-]{8,}\d/.test(t)) flags.headerFooter = true;
    }
    return { text: xmlToText(doc).trim(), flags };
  }

  function parsePdfContent(s) {
    let out = '';
    const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
    s.split(/\bBT\b/).slice(1).forEach((seg) => {
      seg = seg.split(/\bET\b/)[0];
      const re = /\((?:\\[\s\S]|[^\\()])*\)|\[|\]|-?\d*\.?\d+|[A-Za-z'"*]+/g;
      let t, inArr = false, nums = [], lastY = null;
      while ((t = re.exec(seg))) {
        const tok = t[0];
        if (tok[0] === '(') {
          let str = '';
          const body = tok.slice(1, -1);
          for (let i = 0; i < body.length; i++) {
            const ch = body[i];
            if (ch === '\\') {
              const nx = body[i + 1];
              if (/[0-7]/.test(nx)) { let o = nx, k = i + 2; while (k < i + 4 && /[0-7]/.test(body[k] || '')) { o += body[k]; k++; } str += String.fromCharCode(parseInt(o, 8)); i = k - 1; }
              else { str += esc[nx] !== undefined ? esc[nx] : nx; i++; }
            } else str += ch;
          }
          out += str;
        } else if (tok === '[') inArr = true;
        else if (tok === ']') inArr = false;
        else if (/^-?[\d.]/.test(tok)) { nums.push(parseFloat(tok)); if (inArr && parseFloat(tok) < -200) out += ' '; }
        else {
          if (tok === 'Td' || tok === 'TD') { out += nums[nums.length - 1] ? '\n' : ' '; }
          else if (tok === 'T*' || tok === '\'' || tok === '"') out += '\n';
          else if (tok === 'Tm') { const y = nums[nums.length - 1]; out += lastY !== null && y !== lastY ? '\n' : ' '; lastY = y; }
          if (!/^(Tj|TJ|Tf|Tc|Tw|Tz|TL|Tr|Ts)$/.test(tok)) nums = []; else if (tok === 'Tf') nums = [];
        }
      }
      out += '\n';
    });
    return out;
  }

  async function pdfToText(buf) {
    const u8 = new Uint8Array(buf);
    let raw = '';
    for (let i = 0; i < u8.length; i += 8192) raw += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    const parts = [];
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(raw))) {
      const start = m.index + m[0].length;
      const end = raw.indexOf('endstream', start);
      if (end < 0) break;
      re.lastIndex = end + 9;
      const dict = raw.slice(Math.max(0, raw.lastIndexOf('obj', m.index)), m.index);
      let e = end;
      while (e > start && (u8[e - 1] === 10 || u8[e - 1] === 13)) e--;
      let data = u8.subarray(start, e);
      try { if (/FlateDecode/.test(dict)) data = await inflate(data, 'deflate'); } catch (err) { continue; }
      let s = '';
      for (let i = 0; i < data.length; i += 8192) s += String.fromCharCode.apply(null, data.subarray(i, i + 8192));
      if (s.indexOf('BT') < 0) continue;
      parts.push(parsePdfContent(s));
    }
    const CP = { 0x80: '€', 0x85: '…', 0x8c: 'Œ', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™', 0x9c: 'œ' };
    const text = parts.join('\n').replace(/[\x80-\x9f]/g, (c) => CP[c.charCodeAt(0)] || ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    const letters = (text.match(/[A-Za-zÀ-ÿ ]/g) || []).length;
    if (text.length < 80 || letters / text.length < 0.6) throw new Error('Ce PDF ne peut pas être lu sans serveur (police encodée ou document scanné).');
    return { text, flags: { fromFile: true } };
  }

  async function extractTextFromFile(file) {
    const name = (file.name || '').toLowerCase();
    if (/\.(txt|md|text)$/.test(name) || file.type === 'text/plain') return { text: await file.text(), flags: { fromFile: true }, kind: 'txt' };
    if (/\.docx$/.test(name)) { const r = await docxToText(await file.arrayBuffer()); r.kind = 'docx'; return r; }
    if (/\.pdf$/.test(name)) { const r = await pdfToText(await file.arrayBuffer()); r.kind = 'pdf'; return r; }
    throw new Error('Format non pris en charge : utilisez PDF, DOCX ou TXT, ou collez le texte.');
  }

  C.Engine = {
    LEX, extractKeywords, groupByCategory, buildFeatures, startsWithAction, isGenericSummary, titleSimilarity, levelRank, weightOf,
    analyzeJobOffer, calculateMatchScore, findMissingKeywords, calculateATSScore, analyzeCV, labelOf, extractTextFromFile, spellingIssues,
  };
})(window.CVATS);
