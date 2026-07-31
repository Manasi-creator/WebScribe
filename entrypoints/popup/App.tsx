export default function App() {
  return (
    <div
      style={{
        width: 320,
        padding: 20,
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      <h2 style={{ marginBottom: 4 }}>📚 WebScribe</h2>

      <p style={{ color: "#666", marginTop: 0 }}>
        Your Personal Knowledge Layer
      </p>

      <hr />

      <p>
        <strong>Status:</strong> 🟢 Active
      </p>

      <p>
        <strong>Database:</strong> Not Initialized
      </p>

      <button
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "15px",
          cursor: "pointer",
        }}
        onClick={() => {
          console.log("Open Dashboard clicked");
        }}
      >
        Open Dashboard
      </button>

      <p
        style={{
          marginTop: 20,
          fontSize: 12,
          color: "#777",
        }}
      >
        Version 1.0
      </p>
    </div>
  );
}