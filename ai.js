/* CV ATS PRO — ai.js
 * Couche d'abstraction IA : AI.generate(task, payload).
 *
 * MVP : tout est calculé localement (réponses simulées par les moteurs heuristiques).
 * Pour brancher OpenAI / Claude / Gemini : créer un petit backend qui reçoit { task, payload },
 * appelle le fournisseur AVEC LA CLÉ STOCKÉE CÔTÉ SERVEUR, et renvoie { result }.
 * Puis renseigner son URL dans Paramètres > Fournisseur IA (aucune clé API dans le navigateur).
 */
window.CVATS = window.CVATS || {};
(function (C) {
  'use strict';
  const localTasks = {};

  const AI = {
    config: { provider: 'local', endpoint: '' },
    // Hook appelé avant tout envoi de données à un serveur : doit retourner true/false (confirmation explicite)
    confirmSend: async function () { return false; },

    registerLocal(task, fn) { localTasks[task] = fn; },
    configure(cfg) { Object.assign(AI.config, cfg || {}); },

    /** @returns {Promise<{result:any, source:string, error?:string}>} */
    async generate(task, payload) {
      const runLocal = async () => {
        if (!localTasks[task]) throw new Error('Tâche IA inconnue : ' + task);
        return localTasks[task](payload);
      };
      const { provider, endpoint } = AI.config;
      if (provider === 'backend' && endpoint) {
        try {
          const ok = await AI.confirmSend(task);
          if (!ok) return { result: await runLocal(), source: 'local', error: 'envoi annulé' };
          const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, payload }) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          return { result: data && data.result !== undefined ? data.result : data, source: 'backend' };
        } catch (err) {
          return { result: await runLocal(), source: 'local-fallback', error: err.message };
        }
      }
      return { result: await runLocal(), source: 'local' };
    },
  };

  C.AI = AI;
})(window.CVATS);
