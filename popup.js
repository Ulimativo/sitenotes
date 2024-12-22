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
      const notesList = document.getElementById("notesList");
      notesList.innerHTML = '<option value="new">+ Neue Notiz</option>';

      Object.keys(notes).forEach((noteId) => {
        const option = document.createElement("option");
        option.value = noteId;
        option.textContent = notes[noteId].title;
        notesList.appendChild(option);
      });
    });
  }

  // Notiz laden
  function loadNote(noteId) {
    if (noteId === "new") {
      document.getElementById("noteText").value = "";
      document.getElementById("deleteNote").style.display = "none";
      document.getElementById("renameNote").style.display = "none";
      return;
    }

    chrome.storage.local.get([`notes_${urlKey}`], function (result) {
      const notes = result[`notes_${urlKey}`] || {};
      const note = notes[noteId];
      if (note) {
        document.getElementById("noteText").value = note.content;
        document.getElementById("deleteNote").style.display = "block";
        document.getElementById("renameNote").style.display = "block";
      }
    });
  }

  // Notiz speichern
  function saveNotes() {
    const noteText = document.getElementById("noteText").value;
    if (!noteText.trim()) return;

    chrome.storage.local.get([`notes_${urlKey}`], function (result) {
      const notes = result[`notes_${urlKey}`] || {};

      if (currentNoteId === "new") {
        currentNoteId = Date.now().toString();
        notes[currentNoteId] = {
          title: `Notiz ${Object.keys(notes).length + 1}`,
          content: noteText,
          created: new Date().toISOString(),
          url: currentUrl,
        };
      } else {
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
          document.getElementById("notesList").value = currentNoteId;
        }
      );
    });
  }

  // Event Listeners
  document.getElementById("notesList").addEventListener("change", function (e) {
    currentNoteId = e.target.value;
    loadNote(currentNoteId);
  });

  document.getElementById("deleteNote").addEventListener("click", function () {
    if (confirm("Möchten Sie diese Notiz wirklich löschen?")) {
      chrome.storage.local.get([`notes_${urlKey}`], function (result) {
        const notes = result[`notes_${urlKey}`] || {};
        delete notes[currentNoteId];
        chrome.storage.local.set(
          {
            [`notes_${urlKey}`]: notes,
          },
          function () {
            currentNoteId = "new";
            loadNotesList();
            loadNote("new");
          }
        );
      });
    }
  });

  document.getElementById("renameNote").addEventListener("click", function () {
    const newTitle = prompt("Neuer Titel für die Notiz:");
    if (newTitle && newTitle.trim()) {
      chrome.storage.local.get([`notes_${urlKey}`], function (result) {
        const notes = result[`notes_${urlKey}`] || {};
        notes[currentNoteId].title = newTitle.trim();
        chrome.storage.local.set(
          {
            [`notes_${urlKey}`]: notes,
          },
          loadNotesList
        );
      });
    }
  });

  // Automatisches Speichern
  document.getElementById("noteText").addEventListener("input", function () {
    clearTimeout(saveTimeout);
    document.getElementById("saveButton").classList.add("unsaved");
    saveTimeout = setTimeout(() => {
      saveNotes();
      document.getElementById("saveButton").classList.remove("unsaved");
    }, 10000);
  });

  document.getElementById("saveButton").addEventListener("click", () => {
    clearTimeout(saveTimeout);
    saveNotes();
  });

  // Event Listener für die Suche
  let searchTimeout;
  document.getElementById("searchNotes").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchNotes(e.target.value);
    }, 300);
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", function (e) {
    // Speichern: Ctrl/Cmd + S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      clearTimeout(saveTimeout);
      saveNotes();
    }

    // Neue Notiz: Ctrl/Cmd + N
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      currentNoteId = "new";
      document.getElementById("notesList").value = "new";
      loadNote("new");
    }

    // Notiz löschen: Ctrl/Cmd + Backspace
    if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
      e.preventDefault();
      if (currentNoteId !== "new") {
        document.getElementById("deleteNote").click();
      }
    }

    // Notiz umbenennen: Ctrl/Cmd + R
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
      e.preventDefault();
      if (currentNoteId !== "new") {
        document.getElementById("renameNote").click();
      }
    }

    // Fokus auf Suchfeld: Ctrl/Cmd + F
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      document.getElementById("searchNotes").focus();
    }
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
          const url = ensureValidUrl(
            decodeURIComponent(key.replace("notes_", ""))
          );
          const notes = value;

          for (const [noteId, note] of Object.entries(notes)) {
            if (
              note.content.toLowerCase().includes(query.toLowerCase()) ||
              note.title.toLowerCase().includes(query.toLowerCase())
            ) {
              const timeData = result[`time_${encodeURIComponent(url)}`] || {
                lastVisit: Date.now(),
              };
              searchResults.push({
                url,
                noteId,
                title: note.title,
                content: note.content,
                lastVisit: timeData.lastVisit,
              });
            }
          }
        } catch (error) {
          console.warn("Ungültige URL übersprungen:", key);
          return;
        }
      }
    }

    // Ergebnisse anzeigen
    const searchResultsContainer = document.getElementById("searchResults");
    searchResultsContainer.innerHTML = "";

    if (searchResults.length > 0) {
      searchResults.forEach((result) => {
        const resultElement = document.createElement("div");
        resultElement.className = "search-result";
        if (document.body.classList.contains("dark")) {
          resultElement.classList.add("dark");
        }

        const preview =
          result.content.length > 100
            ? result.content.substring(0, 100) + "..."
            : result.content;

        resultElement.innerHTML = `
          <div class="result-title">${result.title}</div>
          <div class="result-preview">${preview}</div>
          <div class="result-meta">
            <span>${new URL(result.url).hostname}</span>
            <span>${getRelativeTime(result.lastVisit)}</span>
          </div>
        `;

        resultElement.addEventListener("click", () => {
          chrome.tabs.create({ url: ensureValidUrl(result.url) });
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

  // Initial load
  loadNotesList();
  document.getElementById("deleteNote").style.display = "none";
  document.getElementById("renameNote").style.display = "none";
});
