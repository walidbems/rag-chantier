// ---------------------------------------------------------------
// Configuration à éditer au fur et à mesure que le backend avance.
// ---------------------------------------------------------------
const CONFIG = {
  // URL du node Webhook du Workflow #2 (Recherche) une fois publié dans n8n.
  // Exemple : "https://<ton-instance>.app.n8n.cloud/webhook/recherche-chantier"
  SEARCH_WEBHOOK_URL: "https://bems.app.n8n.cloud/webhook/5c7939ef-67fa-4108-bdb6-50eb4905cbdb",
  // URL du webhook qui retourne l'historique d'un chantier (optionnel,
  // peut être le même workflow avec une route différente).
  HISTORY_WEBHOOK_URL: "https://bems.app.n8n.cloud/webhook/06aee4a7-a6f0-468f-96ef-be79ca5f1763",
  // Liste des chantiers, tous clients confondus. "client" (csem/hq) sert au
  // filtrage par client choisi à l'écran d'accueil. "district" est
  // l'arrondissement/quartier, affiché sous le nom du chantier. À terme,
  // ceci viendra de Supabase (table "chantiers") plutôt qu'en dur ici.
  CHANTIERS: [
    { id: "c467", code: "C467", nom: "Duroking / Maurice-Duplessis", client: "csem", district: "Montréal-Nord · Rivière-des-Prairies" },
    { id: "c468", code: "C468", nom: "Duroking / Notre-Dame", client: "csem", district: "Montréal-Est · Pointe-aux-Trembles" }
  ]
};
