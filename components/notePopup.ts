let popup: HTMLDivElement | null = null;

export function showNotePopup(
  x: number,
  y: number,
  existingNote: string | null,
  onSave: (note: string) => void
) {
  removeNotePopup();

  popup = document.createElement("div");

  popup.id = "webscribe-note-popup";

  popup.innerHTML = `
    <textarea
      id="webscribe-note-input"
      placeholder="Add a note..."
    ></textarea>

    <div style="
      display:flex;
      gap:8px;
      margin-top:8px;
    ">
      <button id="webscribe-note-save">Save</button>
      <button id="webscribe-note-cancel">Cancel</button>
    </div>
  `;

  Object.assign(popup.style, {
    position: "fixed",
    top: `${y}px`,
    left: `${x}px`,
    width: "260px",
    padding: "12px",
    background: "#F5E6D3",
    border: "2px solid #1E3A5F",
    borderRadius: "10px",
    boxShadow: "0 5px 18px rgba(0,0,0,0.25)",
    zIndex: "2147483647",
    fontFamily: "Segoe UI, sans-serif",
  });

  document.body.appendChild(popup);

  const textarea = popup.querySelector(
    "#webscribe-note-input"
  ) as HTMLTextAreaElement;

  textarea.value = existingNote ?? "";

  Object.assign(textarea.style, {
    width: "100%",
    height: "80px",
    boxSizing: "border-box",
    resize: "vertical",
  });

  const saveButton = popup.querySelector(
    "#webscribe-note-save"
  ) as HTMLButtonElement;

  const cancelButton = popup.querySelector(
    "#webscribe-note-cancel"
  ) as HTMLButtonElement;

  saveButton.onclick = () => {
    const note = textarea.value.trim();

    onSave(note);

    removeNotePopup();
  };

  cancelButton.onclick = () => {
    removeNotePopup();
  };

  textarea.focus();
}

export function removeNotePopup() {
  popup?.remove();
  popup = null;
}