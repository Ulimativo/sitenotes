document.addEventListener("DOMContentLoaded", function () {
  let saveTimeout;
  let currentNoteId = "new";

  // Aktuelle URL abrufen
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentUrl = new URL(tabs[0].url).hostname;

    // Notizen für diese URL laden
    function loadNotesList() {
      chrome.storage.local.get([`notes_${currentUrl}`], function (result) {
        const notes = result[`notes_${currentUrl}`] || {};
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

      chrome.storage.local.get([`notes_${currentUrl}`], function (result) {
        const notes = result[`notes_${currentUrl}`] || {};
        const note = notes[noteId];
        if (note) {
          document.getElementById("noteText").value = note.content;
          document.getElementById("deleteNote").style.display = "block";
          document.getElementById("renameNote").style.display = "block";
        }
      });
    }

    // Notiz speichern
    const saveNotes = () => {
      const noteText = document.getElementById("noteText").value;
      if (!noteText.trim()) return;

      chrome.storage.local.get([`notes_${currentUrl}`], function (result) {
        const notes = result[`notes_${currentUrl}`] || {};

        if (currentNoteId === "new") {
          currentNoteId = Date.now().toString();
          notes[currentNoteId] = {
            title: `Notiz ${Object.keys(notes).length + 1}`,
            content: noteText,
            created: new Date().toISOString(),
          };
        } else {
          notes[currentNoteId].content = noteText;
          notes[currentNoteId].updated = new Date().toISOString();
        }

        chrome.storage.local.set(
          {
            [`notes_${currentUrl}`]: notes,
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
    };

    // Event Listeners
    document
      .getElementById("notesList")
      .addEventListener("change", function (e) {
        currentNoteId = e.target.value;
        loadNote(currentNoteId);
      });

    document
      .getElementById("deleteNote")
      .addEventListener("click", function () {
        if (confirm("Möchten Sie diese Notiz wirklich löschen?")) {
          chrome.storage.local.get([`notes_${currentUrl}`], function (result) {
            const notes = result[`notes_${currentUrl}`] || {};
            delete notes[currentNoteId];
            chrome.storage.local.set(
              {
                [`notes_${currentUrl}`]: notes,
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

    document
      .getElementById("renameNote")
      .addEventListener("click", function () {
        const newTitle = prompt("Neuer Titel für die Notiz:");
        if (newTitle && newTitle.trim()) {
          chrome.storage.local.get([`notes_${currentUrl}`], function (result) {
            const notes = result[`notes_${currentUrl}`] || {};
            notes[currentNoteId].title = newTitle.trim();
            chrome.storage.local.set(
              {
                [`notes_${currentUrl}`]: notes,
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

    // Theme Toggle
    const themeToggle = document.getElementById("themeToggle");

    themeToggle.addEventListener("change", function () {
      document.body.classList.toggle("dark");
      document.querySelector(".container").classList.toggle("dark");
      document.querySelector("textarea").classList.toggle("dark");
      document.querySelector("button").classList.toggle("dark");
      document.querySelector("#status").classList.toggle("dark");
      document.querySelector("#notesList").classList.toggle("dark");
      document
        .querySelectorAll(".icon-button")
        .forEach((btn) => btn.classList.toggle("dark"));
    });

    // Initial load
    loadNotesList();
    document.getElementById("deleteNote").style.display = "none";
    document.getElementById("renameNote").style.display = "none";
  });
});
