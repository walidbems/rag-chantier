(() => {
  "use strict";

  // ---------------------------------------------------------------
  // État en mémoire (pas de stockage local — l'historique persistant
  // vit côté serveur dans Supabase, interrogé via HISTORY_WEBHOOK_URL)
  // ---------------------------------------------------------------
  const state = {
    activeChantier: null,   // { id, code, nom, client }
    pendingImage: null,     // { file, dataUrl }
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    historyItems: []        // dernière liste d'historique chargée (pour regrouper par session/date)
  };

  const CLIENT_LABELS = {
    csem: "CSEM",
    hq: "Hydro-Québec"
  };

  const EMPTY_STATE_HTML = `
    <p class="label-tech">Aucune question posée</p>
    <p class="empty-state__title">Posez votre question sur ce chantier</p>
    <p class="empty-state__sub">Par texte, dictée vocale ou photo d'un plan. La réponse cite toujours le devis, le dessin ou l'article exact.</p>
    <ul class="empty-state__examples">
      <li>« Recouvrement minimal en chaussée ? »</li>
      <li>« Dimensions d'un massif à 2 conduits ? »</li>
      <li>« Entraxe des séparateurs 115 mm ? »</li>
    </ul>
  `;

  const CHEVRON_SVG = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const FILE_ICON_SVG = `<svg viewBox="0 0 24 24" width="11" height="11"><path d="M7 3h8l4 4v14H5V3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  const $ = (sel) => document.querySelector(sel);
  const screens = document.querySelectorAll(".screen");

  // ---------------------------------------------------------------
  // Navigation entre écrans
  // ---------------------------------------------------------------
  function showScreen(name) {
    screens.forEach((s) => {
      s.hidden = s.dataset.screen !== name;
    });
  }

  document.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) showScreen(navBtn.dataset.nav);
  });

  // ---------------------------------------------------------------
  // Écran 1 — choix du client
  // ---------------------------------------------------------------
  document.querySelectorAll(".pick-card[data-client]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const client = btn.dataset.client;
      document.body.dataset.client = client;

      const clientLabel = CLIENT_LABELS[client] || "Chantiers";
      const overline = $("#chantier-list-overline");
      const label = $("#chantier-list-label");
      if (overline) overline.textContent = "Client actif";
      if (label) label.textContent = clientLabel;

      renderChantierList();
      showScreen("chantier");
    });
  });

  $('[data-client="autre"]').addEventListener("click", () => {
    // "Autres clients" n'a pas encore de backend — état simple en attendant
    // un vrai projet privé à brancher.
    alert("Autres clients — à connecter au backend d'ingestion quand un projet privé arrive.");
  });

  // ---------------------------------------------------------------
  // Écran 2 — liste des chantiers
  // ---------------------------------------------------------------
  function renderChantierList() {
    const list = $("#chantier-list");
    list.innerHTML = "";
    const currentClient = document.body.dataset.client;
    const chantiers = CONFIG.CHANTIERS.filter((c) => c.client === currentClient);

    const countLabel = $("#chantier-count-label");
    if (countLabel) countLabel.textContent = `Chantiers · ${chantiers.length}`;

    chantiers.forEach((chantier) => {
      const btn = document.createElement("button");
      btn.className = "chantier-card";
      btn.innerHTML = `
        <span class="chantier-card__bar"></span>
        <span class="chantier-card__body">
          <span class="chantier-card__code">${chantier.code}</span>
          <span class="chantier-card__name">${chantier.nom}</span>
          ${chantier.district ? `<span class="chantier-card__district">${chantier.district}</span>` : ""}
        </span>
        <span class="chantier-card__chevron">${CHEVRON_SVG}</span>
      `;
      btn.addEventListener("click", () => openChantier(chantier));
      list.appendChild(btn);
    });
  }

  $("#btn-add-chantier").addEventListener("click", () => {
    // Placeholder : brancher sur un formulaire ou sur la table Supabase
    // "chantiers" une fois le backend d'ingestion en place.
    alert("Ajout de chantier — à connecter au backend d'ingestion.");
  });

  function openChantier(chantier) {
    state.activeChantier = chantier;
    state.sessionId = crypto.randomUUID();

    const clientLabel = CLIENT_LABELS[chantier.client] || chantier.client;
    $("#chat-chantier-overline").textContent = `${chantier.code} · ${chantier.nom}`;
    $("#chat-chantier-label").textContent = chantier.nom;
    $("#history-chantier-overline").textContent = `${chantier.code} · ${chantier.nom}`;
    $("#history-chantier-label").textContent = "Historique";

    resetThread();
    showScreen("chat");
  }

  // ---------------------------------------------------------------
  // Écran 3 — chat / composer
  // ---------------------------------------------------------------
  function resetThread() {
    $("#thread").innerHTML = `<div class="empty-state" id="empty-state">${EMPTY_STATE_HTML}</div>`;
  }

  function appendMessage({ role, text, imageDataUrl, reference }) {
    const emptyState = $("#empty-state");
    if (emptyState) emptyState.remove();

    const thread = $("#thread");
    const bubble = document.createElement("div");
    bubble.className = `msg ${role === "user" ? "msg--user" : "msg--reply"}`;

    let html = "";
    if (imageDataUrl) html += `<img class="msg__thumb" src="${imageDataUrl}" alt="">`;
    if (text) html += `<p class="msg__text">${escapeHtml(text)}</p>`;
    if (reference) {
      html += `<p class="msg__ref"><span class="msg__ref-icon">${FILE_ICON_SVG}</span><span>${escapeHtml(reference)}</span></p>`;
    }

    bubble.innerHTML = html;
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Photo : sélection native (choix "prendre une photo" / "galerie") ---
  $("#btn-camera").addEventListener("click", () => $("#attachment-input").click());

  $("#attachment-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImage(file, 1024, 0.7).then((dataUrl) => {
      state.pendingImage = { file, dataUrl };
      showAttachmentPreview(dataUrl);
    });
  });

  // Redimensionne et compresse une image côté client avant l'envoi — une
  // photo brute de téléphone peut faire plusieurs Mo en base64, ce qui fait
  // échouer la requête réseau. On la ramène à une taille raisonnable tout en
  // gardant assez de détail pour la lecture par le modèle de vision.
  function resizeImage(file, maxDimension, quality) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showAttachmentPreview(dataUrl) {
    const preview = $("#attachment-preview");
    preview.hidden = false;
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Photo jointe">
      <button type="button" class="attachment-preview__remove">Retirer</button>
    `;
    preview.querySelector(".attachment-preview__remove").addEventListener("click", () => {
      state.pendingImage = null;
      preview.hidden = true;
      preview.innerHTML = "";
      $("#attachment-input").value = "";
    });
  }

  // --- Micro : enregistrement audio natif du navigateur ---
  $("#btn-mic").addEventListener("click", async () => {
    if (state.isRecording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaRecorder = new MediaRecorder(stream);
      state.audioChunks = [];
      state.mediaRecorder.ondataavailable = (e) => state.audioChunks.push(e.data);
      state.mediaRecorder.onstop = handleRecordingStop;
      state.mediaRecorder.start();
      state.isRecording = true;
      $("#btn-mic").classList.add("is-recording");
    } catch (err) {
      appendMessage({ role: "system", text: "Micro inaccessible : vérifie les permissions du navigateur." });
    }
  });

  function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
      state.mediaRecorder.stop();
      state.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
    state.isRecording = false;
    $("#btn-mic").classList.remove("is-recording");
  }

  function handleRecordingStop() {
    const blob = new Blob(state.audioChunks, { type: "audio/webm" });
    const reader = new FileReader();
    reader.onload = () => {
      submitQuery({ audioDataUrl: reader.result });
    };
    reader.readAsDataURL(blob);
  }

  // --- Envoi (texte et/ou photo) ---
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#text-input");
    const text = input.value.trim();
    if (!text && !state.pendingImage) return;
    submitQuery({ text });
    input.value = "";
  });

  // La zone de saisie est un <textarea> (pour l'auto-agrandissement sur
  // plusieurs lignes) — Entrée seule envoie, Maj+Entrée insère un saut de ligne.
  $("#text-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#composer").requestSubmit();
    }
  });

  async function submitQuery({ text = "", audioDataUrl = null } = {}) {
    if (!state.activeChantier) return;

    const imageDataUrl = state.pendingImage ? state.pendingImage.dataUrl : null;

    appendMessage({
      role: "user",
      text: text || (audioDataUrl ? "🎙️ Message vocal" : ""),
      imageDataUrl
    });

    const payload = {
      texte: text || null,
      audio: audioDataUrl,
      image: imageDataUrl,
      chantier_id: state.activeChantier.id,
      session_id: state.sessionId
    };

    clearAttachment();

    if (!CONFIG.SEARCH_WEBHOOK_URL) {
      appendMessage({
        role: "reply",
        text: "Webhook non configuré — ajoute l'URL dans js/config.js une fois le workflow n8n publié."
      });
      return;
    }

    try {
      const res = await fetch(CONFIG.SEARCH_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      appendMessage({
        role: "reply",
        text: data.reponse || "Pas de réponse.",
        reference: data.reference || null
      });
    } catch (err) {
      appendMessage({ role: "reply", text: "Erreur de connexion au moteur de recherche." });
    }
  }

  function clearAttachment() {
    state.pendingImage = null;
    $("#attachment-preview").hidden = true;
    $("#attachment-preview").innerHTML = "";
    $("#attachment-input").value = "";
  }

  // ---------------------------------------------------------------
  // Écran 4 — historique (propre à chaque chantier, groupé par date)
  // ---------------------------------------------------------------
  document.querySelectorAll('[data-nav="history"]').forEach((btn) => {
    btn.addEventListener("click", loadHistory);
  });

  function dateGroupLabel(rawDate) {
    const d = new Date(rawDate);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return "Hier";
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  }

  function timeLabel(rawDate) {
    return new Date(rawDate).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  }

  async function loadHistory() {
    const list = $("#history-list");
    list.innerHTML = `<p class="history-empty">Chargement…</p>`;

    if (!CONFIG.HISTORY_WEBHOOK_URL || !state.activeChantier) {
      list.innerHTML = `<p class="history-empty">Historique non connecté pour l'instant.</p>`;
      return;
    }

    try {
      const url = `${CONFIG.HISTORY_WEBHOOK_URL}?chantier_id=${state.activeChantier.id}`;
      const res = await fetch(url);
      const items = await res.json();
      state.historyItems = items; // gardé en mémoire pour reconstituer une session au clic

      if (!items.length) {
        list.innerHTML = `<p class="history-empty">Aucune recherche pour ce chantier.</p>`;
        return;
      }

      // Regroupe par jour (Aujourd'hui / Hier / date), le plus récent d'abord —
      // items arrive déjà trié plus récent en premier par le backend.
      const groups = [];
      items.forEach((item) => {
        const groupLabel = dateGroupLabel(item.raw_created_at);
        let group = groups.find((g) => g.label === groupLabel);
        if (!group) {
          group = { label: groupLabel, items: [] };
          groups.push(group);
        }
        group.items.push(item);
      });

      list.innerHTML = "";
      groups.forEach((group) => {
        const section = document.createElement("div");
        section.className = "history-group";
        section.innerHTML = `
          <div class="divider">
            <p class="label-tech">${escapeHtml(group.label)}</p>
            <span class="divider__rule"></span>
          </div>
          <div class="history-list-inner"></div>
        `;
        const inner = section.querySelector(".history-list-inner");

        group.items.forEach((item) => {
          const btn = document.createElement("button");
          btn.className = "history-card";
          btn.innerHTML = `
            <span class="history-card__body">
              <span class="history-card__time">${escapeHtml(timeLabel(item.raw_created_at))}</span>
              <span class="history-card__query">${escapeHtml(item.query)}</span>
              ${item.reference ? `<span class="history-card__ref">${FILE_ICON_SVG}<span>${escapeHtml(item.reference)}</span></span>` : ""}
            </span>
            <span class="history-card__chevron">${CHEVRON_SVG}</span>
          `;
          btn.addEventListener("click", () => loadHistoryItem(item));
          inner.appendChild(btn);
        });

        list.appendChild(section);
      });
    } catch (err) {
      list.innerHTML = `<p class="history-empty">Erreur de chargement de l'historique.</p>`;
    }
  }

  // Charge un échange de l'historique dans le fil de discussion. Si l'échange
  // fait partie d'une session à plusieurs questions (même session_id), on
  // reconstitue TOUTE la session dans l'ordre chronologique — pas juste
  // l'échange cliqué.
  function loadHistoryItem(item) {
    resetThread();

    let sessionExchanges = [item];
    if (item.session_id) {
      const sameSession = state.historyItems.filter((i) => i.session_id === item.session_id);
      if (sameSession.length > 1) {
        sameSession.sort((a, b) => new Date(a.raw_created_at) - new Date(b.raw_created_at));
        sessionExchanges = sameSession;
      }
    }

    sessionExchanges.forEach((exchange) => {
      appendMessage({ role: "user", text: exchange.query });
      appendMessage({
        role: "reply",
        text: exchange.reponse || "Pas de réponse enregistrée.",
        reference: exchange.reference || null
      });
    });

    showScreen("chat");
  }

  // ---------------------------------------------------------------
  // Enregistrement du service worker (PWA — ajout à l'écran d'accueil)
  // ---------------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
