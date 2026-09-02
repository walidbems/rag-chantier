# Recherche chantier — frontend

Interface mobile (texte / audio / photo) pour interroger le moteur RAG des
documents CSEM. Statique, sans framework — HTML/CSS/JS seulement.

## Déploiement via GitHub Pages

1. Crée un nouveau repo GitHub (ex. `rag-chantier`), pousse ce dossier tel quel.
2. Dans le repo : **Settings → Pages → Source : Deploy from a branch**,
   choisis la branche `main` et le dossier `/ (root)`.
3. GitHub te donne une URL du type `https://<ton-utilisateur>.github.io/rag-chantier/`.
4. Ouvre cette URL sur ton téléphone → menu du navigateur →
   **"Ajouter à l'écran d'accueil"**. L'app s'ouvre alors en plein écran,
   sans barre de navigateur.

## Configuration à faire avant que ça fonctionne

Tout se passe dans `js/config.js` :

- `SEARCH_WEBHOOK_URL` — l'URL du node Webhook du Workflow #2 (Recherche)
  une fois publié dans n8n.
- `HISTORY_WEBHOOK_URL` — l'URL qui retourne l'historique d'un chantier
  (peut être une route différente du même workflow).
- `CHANTIERS` — la liste des chantiers affichés à l'écran 2. À terme,
  cette liste viendra de la table Supabase `chantiers` plutôt que d'être
  codée en dur ici.

## Format attendu de la réponse du webhook de recherche

```json
{
  "reponse": "600 mm de profondeur minimale en zone urbaine.",
  "reference": "Cahier C, art. 4.2.1 — voir aussi dessin 207-2"
}
```

## Ce qui n'est pas encore branché

- L'historique (écran 4) : la structure d'appel est prête
  (`loadHistory()` dans `js/app.js`), mais dépend de `HISTORY_WEBHOOK_URL`.
- L'ajout d'un chantier depuis l'app (bouton "Ajouter un chantier") :
  affiche une alerte pour l'instant — à connecter au backend d'ingestion.
- Icônes PWA (`icons/icon-192.png`, `icons/icon-512.png`) : à ajouter pour
  que l'icône sur l'écran d'accueil ne soit pas un carré générique.
