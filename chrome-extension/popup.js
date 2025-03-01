document.addEventListener("DOMContentLoaded", async function () {
  let saveTimeout;
  let currentNoteId = "new";

  // Hilfsfunktion zum Validieren und Formatieren von URLs
  function ensureValidUrl(url) {
    try {
      new URL(url);
      return url;
    } catch {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return "https://" + url;
      }
      return url;
    }
  }

  // Aktuelle URL abrufen und validieren
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = ensureValidUrl(tabs[0].url);
  const urlKey = encodeURIComponent(currentUrl);

  // Notizen für diese URL laden
  function loadNotesList() {
    chrome.storage.local.get([`notes_${urlKey}`], function (result) {
      const notes = result[`notes_${urlKey}`] || {};
      const notesList = document.getElementById("existingNotes");
      notesList.innerHTML = "";

      Object.entries(notes)
        .sort((a, b) => new Date(b[1].created) - new Date(a[1].created))
        .forEach(([noteId, note]) => {
          const preview =
            note.content.length > 100
              ? note.content.substring(0, 100) + "..."
              : note.content;

          const noteElement = document.createElement("div");
          noteElement.className = "note-item";
          noteElement.innerHTML = `
            <div class="note-content">
              <div class="note-title">${note.title}</div>
              <div class="note-preview">${preview}</div>
              <div class="note-meta">
                ${getRelativeTimeString(new Date(note.created))}
                ${
                  note.updated
                    ? ` • Bearbeitet ${getRelativeTimeString(
                        new Date(note.updated)
                      )}`
                    : ""
                }
              </div>
            </div>
            <div class="note-actions">
              <button class="note-button rename-note" title="Umbenennen">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button class="note-button delete-note" title="Löschen">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          `;

          // Click Handler für die gesamte Notiz
          noteElement.addEventListener("click", (e) => {
            if (!e.target.closest(".note-button")) {
              currentNoteId = noteId;
              loadNote(noteId);
            }
          });

          // Click Handler für Buttons
          noteElement
            .querySelector(".rename-note")
            .addEventListener("click", (e) => {
              e.stopPropagation();
              const titleElement = noteElement.querySelector(".note-title");
              makeEditable(titleElement, noteId);
            });

          noteElement
            .querySelector(".delete-note")
            .addEventListener("click", (e) => {
              e.stopPropagation();
              showDeleteModal(noteId);
            });

          notesList.appendChild(noteElement);
        });
    });
  }

  // Notiz laden
  function loadNote(noteId) {
    const titleInput = document.getElementById("noteTitle");
    const textInput = document.getElementById("noteText");

    if (noteId === "new") {
      titleInput.value = "";
      textInput.value = "";
      currentNoteId = "new";
      return;
    }

    chrome.storage.local.get([`notes_${urlKey}`], function (result) {
      const notes = result[`notes_${urlKey}`] || {};
      const note = notes[noteId];
      if (note) {
        titleInput.value = note.title;
        textInput.value = note.content;
        currentNoteId = noteId;
      }
    });
  }

  // Notiz speichern
  function saveNotes() {
    const titleInput = document.getElementById("noteTitle");
    const textInput = document.getElementById("noteText");
    const noteText = textInput.value.trim();
    const noteTitle = titleInput.value.trim() || "Unbenannte Notiz";

    if (!noteText) return;

    chrome.storage.local.get([`notes_${urlKey}`], function (result) {
      const notes = result[`notes_${urlKey}`] || {};

      if (currentNoteId === "new") {
        currentNoteId = Date.now().toString();
        notes[currentNoteId] = {
          title: noteTitle,
          content: noteText,
          created: new Date().toISOString(),
          url: currentUrl,
        };
      } else {
        notes[currentNoteId].title = noteTitle;
        notes[currentNoteId].content = noteText;
        notes[currentNoteId].updated = new Date().toISOString();
      }

      chrome.storage.local.set(
        {
          [`notes_${urlKey}`]: notes,
        },
        function () {
          const status = document.getElementById("status");
          status.classList.add("show");
          setTimeout(() => status.classList.remove("show"), 2000);
          loadNotesList();
        }
      );
    });
  }

  // Event Listeners für die Eingabefelder
  document.getElementById("noteText").addEventListener("input", function () {
    clearTimeout(saveTimeout);
    document.getElementById("saveButton").classList.add("unsaved");
    saveTimeout = setTimeout(() => {
      saveNotes();
      document.getElementById("saveButton").classList.remove("unsaved");
    }, 1000);
  });

  document.getElementById("noteTitle").addEventListener("input", function () {
    clearTimeout(saveTimeout);
    document.getElementById("saveButton").classList.add("unsaved");
    saveTimeout = setTimeout(() => {
      saveNotes();
      document.getElementById("saveButton").classList.remove("unsaved");
    }, 1000);
  });

  // Speichern Button
  document.getElementById("saveButton").addEventListener("click", () => {
    clearTimeout(saveTimeout);
    saveNotes();
    document.getElementById("saveButton").classList.remove("unsaved");
  });

  // Keyboard Shortcuts anpassen
  window.addEventListener("keydown", function (e) {
    // Speichern: Ctrl/Cmd + S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      clearTimeout(saveTimeout);
      saveNotes();
      document.getElementById("saveButton").classList.remove("unsaved");
    }

    // Neue Notiz: Ctrl/Cmd + N
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      currentNoteId = "new";
      loadNote("new");
      document.getElementById("noteTitle").focus();
    }

    // Fokus auf Suchfeld: Ctrl/Cmd + F
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      document.getElementById("searchNotes").focus();
    }
  });

  // Event Listener für die Suche
  let searchTimeout;
  document.getElementById("searchNotes").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchNotes(e.target.value);
    }, 300);
  });

  async function searchNotes(query) {
    if (!query.trim()) {
      document.getElementById("searchResults").classList.remove("show");
      return;
    }

    const result = await chrome.storage.local.get(null);
    const searchResults = [];

    // Durchsuche alle Notizen
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith("notes_")) {
        try {
          const url = decodeURIComponent(key.replace("notes_", ""));
          const notes = value;

          for (const [noteId, note] of Object.entries(notes)) {
            if (
              note.content.toLowerCase().includes(query.toLowerCase()) ||
              note.title.toLowerCase().includes(query.toLowerCase())
            ) {
              searchResults.push({
                url,
                noteId,
                title: note.title,
                content: note.content,
                created: note.created,
                updated: note.updated,
              });
            }
          }
        } catch (error) {
          console.warn("Ungültige URL übersprungen:", key);
          continue;
        }
      }
    }

    // Ergebnisse anzeigen
    const searchResultsContainer = document.getElementById("searchResults");
    searchResultsContainer.innerHTML = "";

    if (searchResults.length > 0) {
      searchResults
        .sort(
          (a, b) =>
            new Date(b.updated || b.created) - new Date(a.updated || a.created)
        )
        .forEach((result) => {
          const resultElement = document.createElement("div");
          resultElement.className = "search-result";

          const preview =
            result.content.length > 100
              ? result.content.substring(0, 100) + "..."
              : result.content;

          const hostname = new URL(result.url).hostname;
          const timeString = result.updated
            ? `Bearbeitet ${getRelativeTimeString(new Date(result.updated))}`
            : getRelativeTimeString(new Date(result.created));

          resultElement.innerHTML = `
            <div class="result-title">${result.title}</div>
            <div class="result-preview">${preview}</div>
            <div class="result-meta">
              <span>${hostname}</span>
              <span>${timeString}</span>
            </div>
          `;

          resultElement.addEventListener("click", () => {
            chrome.tabs.create({ url: result.url });
          });

          searchResultsContainer.appendChild(resultElement);
        });

      searchResultsContainer.classList.add("show");
    } else {
      searchResultsContainer.innerHTML = `
        <div class="search-result">
          <div class="result-title">Keine Ergebnisse gefunden</div>
        </div>
      `;
      searchResultsContainer.classList.add("show");
    }
  }

  // Hilfsfunktion für relative Zeitangaben
  function getRelativeTimeString(date) {
    const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
    const now = new Date();
    const diffInSeconds = Math.floor((date - now) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (Math.abs(diffInDays) > 0) {
      return rtf.format(diffInDays, "day");
    } else if (Math.abs(diffInHours) > 0) {
      return rtf.format(diffInHours, "hour");
    } else if (Math.abs(diffInMinutes) > 0) {
      return rtf.format(diffInMinutes, "minute");
    } else {
      return rtf.format(diffInSeconds, "second");
    }
  }

  // Modal-Funktionalität
  const modal = document.getElementById("confirmModal");
  let noteToDelete = null;

  function showDeleteModal(noteId) {
    noteToDelete = noteId;
    modal.style.display = "block";
  }

  function hideDeleteModal() {
    modal.style.display = "none";
    noteToDelete = null;
  }

  document
    .getElementById("cancelDelete")
    .addEventListener("click", hideDeleteModal);
  document
    .getElementById("confirmDelete")
    .addEventListener("click", async () => {
      if (noteToDelete) {
        const notes =
          (await chrome.storage.local.get([`notes_${urlKey}`]))[
            `notes_${urlKey}`
          ] || {};
        delete notes[noteToDelete];
        await chrome.storage.local.set({ [`notes_${urlKey}`]: notes });
        currentNoteId = "new";
        loadNotesList();
        loadNote("new");
        hideDeleteModal();
      }
    });

  // Inline Title Editing
  function makeEditable(titleElement, noteId) {
    const currentText = titleElement.textContent;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "note-title-edit";
    input.value = currentText;

    titleElement.replaceWith(input);
    input.focus();
    input.select();

    async function saveTitle() {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentText) {
        const notes = (await chrome.storage.local.get([`notes_${urlKey}`]))[
          `notes_${urlKey}`
        ];
        notes[noteId].title = newTitle;
        await chrome.storage.local.set({ [`notes_${urlKey}`]: notes });
        loadNotesList();
      } else {
        const titleDiv = document.createElement("div");
        titleDiv.className = "note-title";
        titleDiv.textContent = currentText;
        input.replaceWith(titleDiv);
      }
    }

    input.addEventListener("blur", saveTitle);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        input.value = currentText;
        input.blur();
      }
    });
  }

  // Am Anfang der DOMContentLoaded Funktion:
  async function loadLastNote() {
    const notes =
      (await chrome.storage.local.get([`notes_${urlKey}`]))[
        `notes_${urlKey}`
      ] || {};
    const noteEntries = Object.entries(notes);

    if (noteEntries.length > 0) {
      // Sortiere nach updated oder created Datum
      const lastNote = noteEntries.sort((a, b) => {
        const dateA = new Date(b[1].updated || b[1].created);
        const dateB = new Date(a[1].updated || a[1].created);
        return dateA - dateB;
      })[0];

      currentNoteId = lastNote[0];
      loadNote(currentNoteId);
    } else {
      loadNote("new");
    }
  }

  // Event Listener für den Neue Notiz Button
  document.getElementById("newNoteButton").addEventListener("click", () => {
    currentNoteId = "new";
    loadNote("new");
    document.getElementById("noteTitle").focus();
  });

  // Initial load anpassen
  // loadNote("new"); // Diese Zeile entfernen
  loadLastNote(); // Stattdessen diese verwenden
  loadNotesList();
});
