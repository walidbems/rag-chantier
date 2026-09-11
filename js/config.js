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
  // Liste des chantiers, tous clients confondus. Le champ "client" (csem/hq)
  // sert à filtrer l'affichage selon le client choisi à l'écran d'accueil
  // (voir renderChantierList dans app.js). À terme, ceci viendra de
  // Supabase (table "chantiers") via un appel au chargement de l'app
  // plutôt qu'en dur ici.
  CHANTIERS: [
    { id: "c467", code: "C467", nom: "Duroking / Maurice-Duplessis", client: "csem" },
    { id: "c468", code: "C468", nom: "Duroking / Notre-Dame", client: "csem" }
  ]
};
