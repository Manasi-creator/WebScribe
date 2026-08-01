let toolbar: HTMLDivElement | null = null;

export function showHighlightToolbar(x: number, y: number, onClick: () => void) {
  
  removeHighlightToolbar();

  toolbar = document.createElement("div");

  toolbar.id = "webscribe-toolbar";

  toolbar.innerHTML = "📒 Highlight";

  toolbar.onmousedown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Toolbar clicked");
    onClick();
  };

  Object.assign(toolbar.style, {
    position: "absolute",
    top: `${y}px`,
    left: `${x}px`,

    padding: "8px 14px",

    background: "#1E3A5F",

    color: "white",

    borderRadius: "8px",

    fontSize: "14px",

    fontFamily: "Segoe UI",

    cursor: "pointer",

    zIndex: "999999",

    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",

    userSelect: "none",
  });

  document.body.appendChild(toolbar);
}

export function removeHighlightToolbar() {
  toolbar?.remove();
  toolbar = null;
}