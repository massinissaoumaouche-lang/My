/* CV ATS PRO — data.js
 * Utilitaires, lexique de mots-clés, règles par pays, modèles et données de démonstration.
 * Tout le contenu de démonstration est fictif. */
window.CVATS = window.CVATS || {};
(function (C) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  const U = {
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    // minuscules, sans accents, apostrophes normalisées (longueur conservée pour un texte précomposé)
    norm(s) {
      return String(s == null ? '' : s).replace(/[’‘`´]/g, "'").replace(/ /g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    },
    escRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); },
    uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); },
    clone(o) { return JSON.parse(JSON.stringify(o)); },
    slug(s) {
      return U.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    },
    cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); },
    lowerFirst(s) { s = String(s || ''); return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; },
    today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },
    fmtMonth(ym) {
      if (!ym) return '';
      const m = /^(\d{4})-(\d{2})$/.exec(ym);
      return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : String(ym);
    },
    toIdx(ym) {
      const m = /^(\d{4})-(\d{2})/.exec(ym || '');
      return m ? +m[1] * 12 + (+m[2] - 1) : null;
    },
    period(e) {
      const a = U.fmtMonth(e.start);
      const b = e.current || !e.end ? (e.start ? 'Présent' : '') : U.fmtMonth(e.end);
      return [a, b].filter(Boolean).join(' – ');
    },
    expMonths(e) {
      const a = U.toIdx(e.start);
      const b = e.current || !e.end ? U.toIdx(U.today()) : U.toIdx(e.end);
      return a == null || b == null ? 0 : Math.max(0, b - a + 1);
    },
    // années d'expérience (union des périodes, arrondi à l'entier inférieur)
    expYears(exps) {
      const iv = (exps || []).map((e) => {
        const a = U.toIdx(e.start);
        const b = e.current || !e.end ? U.toIdx(U.today()) : U.toIdx(e.end);
        return a == null || b == null ? null : [a, Math.max(a, b)];
      }).filter(Boolean).sort((x, y) => x[0] - y[0]);
      let total = 0, cur = null;
      iv.forEach((i) => {
        if (!cur) cur = i.slice();
        else if (i[0] <= cur[1] + 1) cur[1] = Math.max(cur[1], i[1]);
        else { total += cur[1] - cur[0] + 1; cur = i.slice(); }
      });
      if (cur) total += cur[1] - cur[0] + 1;
      return Math.floor(total / 12);
    },
    hasMetric(s) { return /\d/.test(String(s || '').replace(/\b(19|20)\d{2}\b/g, '')); },
    debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; },
    words(s) { return (String(s || '').match(/[A-Za-zÀ-ÿ0-9'’+#.\-]+/g) || []); },
    pct(n) { return Math.round(n * 100); },
    download(blob, filename) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
  };

  /* ------------------------------------------------------------------ */
  /* Lexique : [forme canonique, catégorie, groupe d'équivalence, alias]  */
  /* Les alias sont de vrais synonymes. Les groupes servent à signaler    */
  /* des compétences « à vérifier » (outil voisin présent dans le CV).    */
  /* ------------------------------------------------------------------ */
  const LEXICON = [
    // compétences
    ['gestion de projet', 'competence', 'projet', ['pilotage de projet', 'pilotage de projets', 'conduite de projet', 'conduite de projets', 'project management', 'gestion de projets']],
    ['gestion des parties prenantes', 'competence', 'projet', ['parties prenantes', 'stakeholder management']],
    ['planification', 'competence', 'projet', ['planning', 'ordonnancement']],
    ['cahier des charges', 'competence', 'projet', ['specifications fonctionnelles', 'expression de besoin', 'expression des besoins', 'cahiers des charges']],
    ['recette', 'competence', 'projet', ['tests utilisateurs', 'uat', 'recettage']],
    ['management d\'équipe', 'competence', 'management', ['encadrement d\'equipe', 'management', 'team management', 'animation d\'equipe', 'manager une equipe', 'encadrement']],
    ['reporting', 'competence', 'reporting', ['tableaux de bord', 'tableau de bord', 'dashboard', 'dashboards']],
    ['analyse de données', 'competence', 'data', ['data analysis', 'analyse de donnees', 'data analytics', 'analyse des donnees']],
    ['gestion budgétaire', 'competence', 'finance', ['budget', 'pilotage budgetaire', 'gestion de budget', 'suivi budgetaire', 'budgets']],
    ['négociation', 'competence', 'commerce', ['negociation', 'negocier', 'negociations']],
    ['prospection commerciale', 'competence', 'commerce', ['prospection', 'business development', 'developpement commercial']],
    ['relation client', 'competence', 'client', ['gestion de la relation client', 'gestion des clients', 'service client', 'customer success', 'customer relationship']],
    ['gestion des risques', 'competence', 'risque', ['risk management', 'analyse de risques']],
    ['amélioration continue', 'competence', 'qualite', ['continuous improvement']],
    ['recrutement', 'competence', 'rh', ['sourcing']],
    ['gestion des prestataires', 'competence', 'achats', ['gestion des fournisseurs', 'vendor management', 'relation avec les prestataires']],
    ['stratégie digitale', 'competence', 'marketing', ['digital strategy', 'strategie marketing digitale']],
    ['marketing digital', 'competence', 'marketing', ['digital marketing', 'webmarketing', 'web marketing']],
    ['SEO', 'competence', 'seo', ['referencement naturel']],
    ['SEA', 'competence', 'sea', ['referencement payant', 'search engine advertising']],
    ['emailing', 'competence', 'emailing', ['e-mailing', 'email marketing', 'newsletters', 'newsletter']],
    ['content marketing', 'competence', 'contenu', ['marketing de contenu', 'strategie editoriale']],
    ['réseaux sociaux', 'competence', 'social', ['social media', 'community management']],
    ['UX', 'competence', 'design', ['experience utilisateur', 'user experience', 'ux design']],
    ['taux de conversion', 'competence', 'conversion', ['conversion rate']],
    ['optimisation du taux de conversion', 'competence', 'conversion', ['cro', 'optimisation de la conversion', 'conversion rate optimization']],
    ['comptabilité', 'competence', 'compta', ['comptabilite generale', 'comptabilite']],
    ['logistique', 'competence', 'supply', ['supply chain', 'gestion des stocks']],
    ['service après-vente', 'competence', 'client', ['sav', 'service apres-vente']],
    // logiciels
    ['Excel', 'logiciel', 'office', ['microsoft excel']],
    ['PowerPoint', 'logiciel', 'office', ['microsoft powerpoint']],
    ['Microsoft Office', 'logiciel', 'office', ['pack office', 'office 365', 'ms office', 'suite office']],
    ['Power BI', 'logiciel', 'bi', ['powerbi']],
    ['Tableau Software', 'logiciel', 'bi', ['tableau software', 'tableau desktop', 'tableau server']],
    ['Looker Studio', 'logiciel', 'bi', ['data studio', 'google data studio', 'looker']],
    ['Qlik', 'logiciel', 'bi', ['qlikview', 'qlik sense']],
    ['SAP', 'logiciel', 'erp', []],
    ['Odoo', 'logiciel', 'erp', []],
    ['CRM', 'logiciel', 'crm', []],
    ['Salesforce', 'logiciel', 'crm', []],
    ['HubSpot', 'logiciel', 'crm', []],
    ['Zoho', 'logiciel', 'crm', []],
    ['Pipedrive', 'logiciel', 'crm', []],
    ['Jira', 'logiciel', 'pmtools', []],
    ['Confluence', 'logiciel', 'pmtools', []],
    ['Trello', 'logiciel', 'pmtools', []],
    ['Asana', 'logiciel', 'pmtools', []],
    ['Monday.com', 'logiciel', 'pmtools', ['monday']],
    ['Notion', 'logiciel', 'pmtools', []],
    ['MS Project', 'logiciel', 'pmtools', ['microsoft project', 'ms project']],
    ['Slack', 'logiciel', 'collab', []],
    ['Figma', 'logiciel', 'design', []],
    ['Adobe XD', 'logiciel', 'design', []],
    ['Photoshop', 'logiciel', 'design', []],
    ['Canva', 'logiciel', 'design', []],
    ['Google Analytics', 'logiciel', 'analytics', ['ga4', 'universal analytics']],
    ['Google Tag Manager', 'logiciel', 'analytics', ['gtm']],
    ['Google Ads', 'logiciel', 'ads', ['adwords']],
    ['Meta Ads', 'logiciel', 'ads', ['facebook ads']],
    ['WordPress', 'logiciel', 'cms', []],
    ['Shopify', 'logiciel', 'cms', []],
    ['PrestaShop', 'logiciel', 'cms', []],
    ['Mailchimp', 'logiciel', 'emailtools', ['brevo', 'sendinblue']],
    ['Git', 'logiciel', 'vcs', ['github', 'gitlab']],
    // technologies
    ['JavaScript', 'technologie', 'js', ['js', 'ecmascript']],
    ['TypeScript', 'technologie', 'js', []],
    ['React', 'technologie', 'js', ['reactjs', 'react.js']],
    ['Vue.js', 'technologie', 'js', ['vue', 'vuejs']],
    ['Angular', 'technologie', 'js', []],
    ['Node.js', 'technologie', 'js', ['nodejs']],
    ['HTML/CSS', 'technologie', 'web', ['html5', 'css3', 'html', 'css']],
    ['Python', 'technologie', 'python', []],
    ['Java', 'technologie', 'java', []],
    ['PHP', 'technologie', 'php', []],
    ['SQL', 'technologie', 'sql', ['postgresql', 'mysql', 'sql server']],
    ['MongoDB', 'technologie', 'nosql', []],
    ['AWS', 'technologie', 'cloud', ['amazon web services']],
    ['Azure', 'technologie', 'cloud', ['microsoft azure']],
    ['Google Cloud', 'technologie', 'cloud', ['gcp']],
    ['Docker', 'technologie', 'devops', []],
    ['Kubernetes', 'technologie', 'devops', ['k8s']],
    ['API REST', 'technologie', 'api', ['api rest', 'apis', 'api', 'restful']],
    ['CI/CD', 'technologie', 'devops', ['integration continue']],
    ['Linux', 'technologie', 'os', []],
    ['intelligence artificielle', 'technologie', 'ia', ['ia', 'machine learning', 'ai']],
    // méthodes
    ['Agile', 'methode', 'agile', ['methodes agiles', 'methode agile', 'agilite']],
    ['Scrum', 'methode', 'agile', []],
    ['Kanban', 'methode', 'agile', []],
    ['SAFe', 'methode', 'agile', []],
    ['Product Owner', 'methode', 'agile', ['po']],
    ['Lean', 'methode', 'lean', ['kaizen']],
    ['Six Sigma', 'methode', 'lean', ['6 sigma']],
    ['Design Thinking', 'methode', 'design', []],
    ['PRINCE2', 'methode', 'pm-cert', []],
    ['OKR', 'methode', 'pilotage', ['okrs']],
    ['DevOps', 'methode', 'devops', []],
    ['ITIL', 'methode', 'itsm', []],
    ['cycle en V', 'methode', 'waterfall', ['waterfall', 'methode en cascade']],
    // certifications
    ['PMP', 'certification', 'pm-cert', ['project management professional']],
    ['PSM', 'certification', 'scrum-cert', ['professional scrum master', 'psm i', 'csm', 'certified scrum master']],
    ['TOEIC', 'certification', 'lang-cert', ['toefl', 'ielts']],
    ['Green Belt', 'certification', 'lean-cert', ['six sigma green belt']],
    // secteurs
    ['e-commerce', 'secteur', 'ecom', ['commerce en ligne', 'e-commerce', 'ecommerce']],
    ['retail', 'secteur', 'retail', ['distribution', 'commerce de detail', 'grande distribution']],
    ['banque', 'secteur', 'finance-sect', ['assurance', 'banque-assurance']],
    ['santé', 'secteur', 'sante', ['sante', 'pharma', 'medical']],
    ['industrie', 'secteur', 'industrie', ['industriel']],
    ['immobilier', 'secteur', 'immo', []],
    ['SaaS', 'secteur', 'saas', ['logiciel en ligne']],
    ['fintech', 'secteur', 'finance-sect', []],
    ['B2B', 'secteur', 'btob', ['btob']],
    ['B2C', 'secteur', 'btoc', ['btoc']],
    ['luxe', 'secteur', 'luxe', []],
    ['média', 'secteur', 'media', ['media', 'presse']],
    ['énergie', 'secteur', 'energie', ['energie']],
    ['télécoms', 'secteur', 'telecom', ['telecoms', 'telecommunications']],
    // soft skills
    ['leadership', 'soft', 'soft', []],
    ['communication', 'soft', 'soft', []],
    ['travail en équipe', 'soft', 'soft', ['esprit d\'equipe', 'collaboration']],
    ['autonomie', 'soft', 'soft', ['autonome']],
    ['rigueur', 'soft', 'soft', ['rigoureux', 'rigoureuse']],
    ['adaptabilité', 'soft', 'soft', ['adaptabilite', 'capacite d\'adaptation']],
    ['organisation', 'soft', 'soft', ['sens de l\'organisation']],
    ['esprit d\'analyse', 'soft', 'soft', ['capacite d\'analyse', 'esprit analytique']],
    ['résolution de problèmes', 'soft', 'soft', ['problem solving', 'resolution de problemes']],
    ['créativité', 'soft', 'soft', ['creativite']],
    ['gestion des priorités', 'soft', 'soft', ['gestion des priorites', 'gestion du temps']],
    // langues
    ['Français', 'langue', 'lang', ['francais', 'french']],
    ['Anglais', 'langue', 'lang', ['english']],
    ['Espagnol', 'langue', 'lang', ['spanish']],
    ['Allemand', 'langue', 'lang', ['german', 'deutsch']],
    ['Italien', 'langue', 'lang', ['italian']],
    ['Arabe', 'langue', 'lang', ['arabic']],
    ['Portugais', 'langue', 'lang', []],
    ['Néerlandais', 'langue', 'lang', ['neerlandais', 'dutch']],
    ['Chinois', 'langue', 'lang', ['mandarin']],
    ['Kabyle', 'langue', 'lang', ['berbere', 'amazigh', 'tamazight']],
  ];

  const CATEGORY_LABELS = {
    competence: 'Compétences', logiciel: 'Logiciels', technologie: 'Technologies', methode: 'Méthodes',
    certification: 'Certifications', secteur: 'Secteurs', soft: 'Soft skills', langue: 'Langues', terme: 'Termes récurrents',
  };

  // Début de phrase acceptable pour une réalisation (verbes d'action + formes nominales courantes en français)
  const ACTION_STARTS = ['pilot', 'gere', 'gerer', 'gest', 'dirig', 'coordon', 'mis ', 'mise ', 'mise en', 'deplo', 'conc', 'develop', 'optimis', 'redui', 'augment', 'negoc', 'anim', 'manag', 'lanc', 'cre', 'analys', 'structur', 'audit', 'form', 'supervis', 'planifi', 'organis', 'redig', 'assur', 'realis', 'implement', 'migr', 'automatis', 'mesur', 'livr', 'suivi', 'suivre', 'encadr', 'contribu', 'accompagn', 'identifi', 'elabor', 'etabli', 'defin', 'mene', 'conduit', 'amelior', 'gener', 'obten', 'atteint', 'fidelis', 'recrut', 'integr', 'cadr', 'budget', 'securis', 'standardis', 'refonte', 'veille', 'recette', 'prospect', 'relation', 'reporting', 'hausse', 'baisse', 'reduction', 'croissance', 'negociation',
    'managed', 'led ', 'built', 'deliver', 'launch', 'increas', 'reduc', 'design', 'improv', 'coordinat', 'analyz', 'analys', 'optimiz', 'drove', 'owned', 'ran ', 'achiev', 'implemented', 'created', 'develop'];

  const WEAK_OPENERS = /^(responsable de|en charge de|charge de|chargee de|participation a|aide a|taches?\s*:|je suis|j'etais|j'ai ete)/;
  const GENERIC_PHRASES = ['motive', 'dynamique', 'serieux', 'serieuse', 'passionne', 'passionnee', 'rigoureux', 'rigoureuse', 'polyvalent', 'polyvalente', 'sens des responsabilites', 'esprit d\'equipe', 'force de proposition', 'curieux', 'curieuse', 'a l\'ecoute', 'investi', 'investie', 'team player', 'hard-working', 'hardworking', 'results-driven', 'self-motivated'];

  const STOPWORDS = new Set(('le la les un une des de du d l et en au aux a à pour par sur dans avec sans sous ou où que qui quoi dont ce cet cette ces se sa son ses leur leurs nos notre vos votre vous nous je tu il elle ils elles on est sont être avoir ont été plus moins très tout tous toute toutes comme mais donc or ni car si ne pas the and of to in for with on at by an as is are be or from that this it you we our your will have has had not but').split(/\s+/).map(U.norm));

  /* ------------------------------------------------------------------ */
  /* Pays cibles : usages courants (jamais présentés comme universels)    */
  /* ------------------------------------------------------------------ */
  const COUNTRIES = {
    'France': { maxPages: 2, extra: [], tips: ['La photo est possible mais non obligatoire ; certains recruteurs la déconseillent pour limiter les biais.', 'Le CV tient en général sur 1 page en début de carrière, 2 pages au plus ensuite.', 'Âge, situation familiale et nombre d\'enfants ne sont pas attendus.'] },
    'Algérie': { maxPages: 2, extra: ['birthDate', 'nationality'], tips: ['Les pratiques varient selon le secteur (public, privé, entreprise internationale) : certains employeurs attendent date de naissance et nationalité, d\'autres non.', 'Pour une candidature passant par un ATS ou une entreprise internationale, un CV sobre, sans photo, est plus courant.', 'Indiquer les niveaux de langues (arabe, français, anglais) est généralement utile.'] },
    'Suisse': { maxPages: 2, extra: ['nationality', 'workPermit', 'birthDate'], tips: ['La photo, la nationalité et le permis de travail figurent souvent sur les CV, avec des variations selon la région linguistique et le secteur.', 'Les certificats de travail et les références sont fréquemment demandés.', 'Le CV reste sobre, d\'une à deux pages.'] },
    'Belgique': { maxPages: 2, extra: ['nationality'], tips: ['Les usages sont proches de ceux de la France mais varient entre Bruxelles, la Flandre et la Wallonie.', 'La photo est facultative.', 'Mentionner les langues et leur niveau est important sur un marché multilingue.'] },
    'Luxembourg': { maxPages: 2, extra: ['nationality', 'workPermit'], tips: ['Marché multilingue : détaillez vos niveaux en français, allemand, anglais (et luxembourgeois le cas échéant).', 'Nationalité et autorisation de travail sont parfois indiquées ; ce n\'est pas systématique.'] },
    'Canada': { maxPages: 2, extra: [], tips: ['Photo, âge, situation familiale et numéro d\'assurance sociale ne sont pas attendus.', 'Résumé de 1 à 2 pages, centré sur les réalisations.', 'Les usages peuvent différer selon la province et la langue de travail.'] },
    'États-Unis': { maxPages: 1, extra: [], tips: ['Resume court (1 page en général, 2 pages pour les profils très expérimentés), sans photo, sans date de naissance, sans situation familiale.', 'Les réalisations chiffrées et les mots-clés de l\'offre sont particulièrement importants.'] },
    'Royaume-Uni': { maxPages: 2, extra: [], tips: ['CV de 2 pages en général, sans photo ni date de naissance.', 'Le profil personnel en tête de CV est courant.'] },
    'Allemagne': { maxPages: 2, extra: ['birthDate', 'nationality'], tips: ['Le Lebenslauf est tabellaire et antéchronologique ; photo et date de naissance restent répandues mais ne sont plus obligatoires.', 'Les certificats de travail (Arbeitszeugnisse) sont souvent joints au dossier.'] },
    'Australie': { maxPages: 3, extra: [], tips: ['Le resume peut atteindre 2 à 3 pages pour un profil expérimenté ; pas de photo ni de date de naissance.', 'Les références sont souvent demandées à un stade avancé du recrutement.'] },
  };
  const EXTRA_LABELS = { birthDate: 'Date de naissance (facultatif)', nationality: 'Nationalité (facultatif)', workPermit: 'Autorisation de travail (facultatif)' };

  const TEMPLATES = [
    { id: 'classic', label: 'ATS Classic', desc: 'Très sobre : noir et blanc, titres centrés, une seule colonne.' },
    { id: 'professional', label: 'ATS Professional', desc: 'Moderne : accent de couleur sur les titres, structure identique.' },
    { id: 'executive', label: 'Executive', desc: 'Profils expérimentés : en-tête marqué, résumé mis en avant.' },
    { id: 'international', label: 'International', desc: 'S\'adapte au pays cible : champs locaux facultatifs ajoutés.' },
  ];

  const STATUSES = ['À préparer', 'Prête', 'Envoyée', 'Entretien', 'Relance', 'Refusée', 'Acceptée'];
  const SKILL_CATS = [
    ['technique', 'Compétences techniques'], ['logiciel', 'Logiciels'], ['methode', 'Méthodologies'],
    ['sectorielle', 'Compétences sectorielles'], ['soft', 'Soft skills'],
  ];
  const LANG_LEVELS = ['Langue maternelle', 'Bilingue', 'Courant (C1-C2)', 'Avancé (B2)', 'Intermédiaire (B1)', 'Notions (A1-A2)'];

  /* ------------------------------------------------------------------ */
  /* Données de démonstration (profil fictif)                             */
  /* ------------------------------------------------------------------ */
  function demoState() {
    return {
      candidateProfile: {
        firstName: 'Emma', lastName: 'Martin', title: 'Digital Project Manager',
        phone: '+33 6 12 34 56 78', email: 'emma.martin@example.com', city: 'Paris', country: 'France',
        linkedin: 'linkedin.com/in/emma-martin-demo', portfolio: '', website: '', availability: 'Disponible sous 2 mois',
        nationality: '', workPermit: '', birthDate: '',
        summary: 'Chef de projet digital dynamique et rigoureuse, avec plus de 5 ans d\'expérience dans le pilotage de projets web. Forte capacité d\'organisation et sens du service client, à l\'aise avec les équipes techniques comme avec les équipes marketing.',
      },
      experiences: [
        { id: 'e1', title: 'Digital Project Manager', company: 'Nova Digital', location: 'Paris', start: '2023-09', end: '', current: true,
          description: 'Pilotage du portefeuille de projets digitaux de clients retail et e-commerce.',
          bullets: [
            'Pilotage de 6 projets digitaux en parallèle (refonte de site e-commerce, application mobile, automatisation marketing) pour un budget cumulé de 480 k€',
            'Coordination d\'une équipe pluridisciplinaire de 9 personnes (design, développement, marketing) en méthode Agile Scrum',
            'Mise en place d\'un reporting hebdomadaire de suivi des délais et des coûts pour la direction',
            'Suivi des prestataires externes et des demandes clients',
          ], tools: 'Jira, Confluence, Google Analytics, Excel, Figma' },
        { id: 'e2', title: 'Chef de projet digital', company: 'Lumière Retail', location: 'Paris', start: '2021-07', end: '2023-08', current: false,
          description: 'Chef de projet sur le site e-commerce d\'une enseigne de distribution.',
          bullets: [
            'Refonte du site e-commerce : cadrage, cahier des charges, recette et mise en production dans les délais',
            'Hausse du taux de conversion de 2,1 % à 2,8 % grâce à des tests A/B et à l\'optimisation du tunnel d\'achat',
            'Gestion du budget projet et négociation avec les prestataires',
            'Animation des cérémonies Scrum de l\'équipe produit',
          ], tools: 'Jira, Google Analytics, Excel, Trello' },
        { id: 'e3', title: 'Chargée de projet web', company: 'Studio Kiosque', location: 'Lille', start: '2019-09', end: '2021-06', current: false,
          description: '',
          bullets: [
            'Gestion des clients',
            'Suivi de production de sites vitrines et de campagnes emailing',
            'Rédaction de recommandations SEO et suivi du référencement naturel',
          ], tools: 'WordPress, Mailchimp, Google Analytics' },
      ],
      education: [
        { id: 'd1', degree: 'Master Management de projet digital', school: 'École Supérieure du Numérique', location: 'Paris', year: '2019', specialty: 'Projet digital' },
        { id: 'd2', degree: 'Licence Information-Communication', school: 'Université Lumière-Sud', location: 'Lille', year: '2017', specialty: 'Communication' },
      ],
      skills: [
        { name: 'Gestion de projet', category: 'technique' }, { name: 'Cahier des charges', category: 'technique' },
        { name: 'Recette', category: 'technique' }, { name: 'Gestion budgétaire', category: 'technique' },
        { name: 'SEO', category: 'technique' }, { name: 'Emailing', category: 'technique' },
        { name: 'Jira', category: 'logiciel' }, { name: 'Confluence', category: 'logiciel' }, { name: 'Google Analytics', category: 'logiciel' },
        { name: 'Excel', category: 'logiciel' }, { name: 'Figma', category: 'logiciel' }, { name: 'Trello', category: 'logiciel' },
        { name: 'Agile', category: 'methode' }, { name: 'Scrum', category: 'methode' }, { name: 'Kanban', category: 'methode' },
        { name: 'e-commerce', category: 'sectorielle' }, { name: 'Retail', category: 'sectorielle' },
        { name: 'Communication', category: 'soft' }, { name: 'Leadership', category: 'soft' }, { name: 'Organisation', category: 'soft' },
      ],
      languages: [{ name: 'Français', level: 'Langue maternelle' }, { name: 'Anglais', level: 'Courant (C1-C2)' }],
      certifications: [{ id: 'c1', name: 'Professional Scrum Master I (PSM I)', issuer: 'Scrum.org', year: '2022', number: '' }],
      projects: [{ id: 'p1', name: 'Application mobile de fidélité', context: 'Projet mené chez Nova Digital pour un client retail', role: 'Chef de projet', tools: 'Jira, Figma', results: '' }],
    };
  }

  const DEMO_OFFER = `Chef de projet digital H/F
Entreprise : Maison Aurèle
Lieu : Lyon (2 jours de télétravail par semaine)
Contrat : CDI

À propos
Maison Aurèle est une enseigne de retail spécialisée dans l'équipement de la maison, en forte croissance sur le e-commerce.

Missions
- Piloter les projets digitaux du site e-commerce (refonte, nouvelles fonctionnalités, intégrations)
- Rédiger les cahiers des charges et coordonner les équipes design, développement et marketing
- Suivre le budget et le planning des projets, assurer le reporting auprès de la direction
- Analyser les performances (taux de conversion, trafic) et proposer des optimisations
- Animer les rituels Agile (Scrum) de l'équipe produit

Responsabilités
- Garantir le respect des délais et du budget
- Manager une équipe de 3 personnes
- Gérer la relation avec les prestataires externes

Profil recherché
- Formation Bac+5 (master) en management de projet digital, marketing ou école de commerce
- 4 à 6 ans d'expérience en gestion de projet digital
- Maîtrise de la gestion de projet (Agile, Scrum), de Jira et d'Excel
- Connaissance indispensable de Power BI pour le reporting
- Expérience du CRM Salesforce
- Anglais courant

Souhaité
- Connaissance de SAP appréciée
- SEO et Google Analytics sont un plus
- Expérience en retail ou e-commerce`;

  const EMPTY_PROFILE = {
    firstName: '', lastName: '', title: '', phone: '', email: '', city: '', country: 'France', linkedin: '', portfolio: '', website: '',
    availability: '', nationality: '', workPermit: '', birthDate: '', summary: '',
  };

  C.U = U;
  C.Data = { LEXICON, CATEGORY_LABELS, ACTION_STARTS, WEAK_OPENERS, GENERIC_PHRASES, STOPWORDS, COUNTRIES, EXTRA_LABELS, TEMPLATES, STATUSES, SKILL_CATS, LANG_LEVELS, demoState, DEMO_OFFER, EMPTY_PROFILE, MONTHS };
})(window.CVATS);
