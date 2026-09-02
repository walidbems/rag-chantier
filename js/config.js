// ---------------------------------------------------------------
// Configuration à éditer au fur et à mesure que le backend avance.
// ---------------------------------------------------------------
const CONFIG = {
  // URL du node Webhook du Workflow #2 (Recherche) une fois publié dans n8n.
  // Exemple : "https://<ton-instance>.app.n8n.cloud/webhook/recherche-chantier"
  SEARCH_WEBHOOK_URL: "",

  // URL du webhook qui retourne l'historique d'un chantier (optionnel,
  // peut être le même workflow avec une route différente).
  HISTORY_WEBHOOK_URL: "",

  // Liste des chantiers CSEM. À terme, ceci viendra de Supabase (table
  // "chantiers") via un appel au chargement de l'app plutôt qu'en dur ici.
  CHANTIERS: [
    { id: "c467", code: "C467", nom: "Duroking / Maurice-Duplessis" }
  ]
};
