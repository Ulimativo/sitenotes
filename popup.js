document.addEventListener("DOMContentLoaded", function () {
  let saveTimeout;

  // Aktuelle URL abrufen
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentUrl = new URL(tabs[0].url).hostname;

    // Gespeicherte Notizen laden
    chrome.storage.local.get([currentUrl], function (result) {
      const savedNote = result[currentUrl] || "";
      document.getElementById("noteText").value = savedNote;
    });

    // Funktion zum Speichern der Notizen
    const saveNotes = () => {
      const noteText = document.getElementById("noteText").value;
      const saveData = {};
      saveData[currentUrl] = noteText;

      chrome.storage.local.set(saveData, function () {
        const status = document.getElementById("status");
        status.classList.add("show");
        setTimeout(function () {
          status.classList.remove("show");
        }, 2000);
      });
    };

    // Automatisches Speichern nach 10 Sekunden Inaktivität
    document.getElementById("noteText").addEventListener("input", function () {
      clearTimeout(saveTimeout);
      document.getElementById("saveButton").classList.add("unsaved");
      saveTimeout = setTimeout(() => {
        saveNotes();
        document.getElementById("saveButton").classList.remove("unsaved");
      }, 10000);
    });

    // Speicher-Button-Funktionalität
    document.getElementById("saveButton").addEventListener("click", () => {
      clearTimeout(saveTimeout);
      saveNotes();
    });
  });
});
