(() => {
  "use strict";

  // ---------------------------------------------------------------
  // État en mémoire (pas de stockage local — l'historique persistant
  // vit côté serveur dans Supabase, interrogé via HISTORY_WEBHOOK_URL)
  // ---------------------------------------------------------------
  const state = {
    activeChantier: null,   // { id, code, nom }
    pendingImage: null,     // { file, dataUrl }
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
  };

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
  document.querySelectorAll(".client-card[data-client]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderChantierList();
      showScreen("chantier");
    });
  });

  // ---------------------------------------------------------------
  // Écran 2 — liste des chantiers
  // ---------------------------------------------------------------
  function renderChantierList() {
    const list = $("#chantier-list");
    list.innerHTML = "";
    CONFIG.CHANTIERS.forEach((chantier) => {
      const btn = document.createElement("button");
      btn.className = "chantier-card";
      btn.innerHTML = `
        <span class="chantier-card__code">${chantier.code}</span>
        <span class="chantier-card__name">${chantier.nom}</span>
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
    $("#chat-chantier-label").textContent = `${chantier.code} – ${chantier.nom}`;
    $("#history-chantier-label").textContent = `Historique — ${chantier.code}`;
    resetThread();
    showScreen("chat");
  }

  // ---------------------------------------------------------------
  // Écran 3 — chat / composer
  // ---------------------------------------------------------------
  function resetThread() {
    $("#thread").innerHTML = `
      <div class="empty-state" id="empty-state">
        <p>Décris ce que tu cherches. Un article de devis, un dessin normalisé,
        un code de paiement — parle, tape, ou montre une photo.</p>
      </div>`;
  }

  function appendMessage({ role, text, imageDataUrl, reference }) {
    const emptyState = $("#empty-state");
    if (emptyState) emptyState.remove();

    const thread = $("#thread");
    const bubble = document.createElement("div");
    bubble.className = `msg ${role === "user" ? "msg--user" : "msg--reply"}`;

    let html = "";
    if (imageDataUrl) html += `<img class="msg__thumb" src="${imageDataUrl}" alt="">`;
    if (text) html += `<div>${escapeHtml(text)}</div>`;
    if (reference) html += `<span class="msg__ref">${escapeHtml(reference)}</span>`;

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
    const reader = new FileReader();
    reader.onload = () => {
      state.pendingImage = { file, dataUrl: reader.result };
      showAttachmentPreview(reader.result);
    };
    reader.readAsDataURL(file);
  });

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
      chantier_id: state.activeChantier.id
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
  // Écran 4 — historique (propre à chaque chantier)
  // ---------------------------------------------------------------
  document.querySelectorAll('[data-nav="history"]').forEach((btn) => {
    btn.addEventListener("click", loadHistory);
  });

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

      if (!items.length) {
        list.innerHTML = `<p class="history-empty">Aucune recherche pour ce chantier.</p>`;
        return;
      }

      list.innerHTML = "";
      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "history-card";
        btn.innerHTML = `
          <span class="history-card__date">${escapeHtml(item.date)}</span>
          <span class="history-card__query">${escapeHtml(item.query)}</span>
        `;
        btn.addEventListener("click", () => showScreen("chat"));
        list.appendChild(btn);
      });
    } catch (err) {
      list.innerHTML = `<p class="history-empty">Erreur de chargement de l'historique.</p>`;
    }
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
