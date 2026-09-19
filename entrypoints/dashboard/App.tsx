import { browser } from "wxt/browser";
import { useEffect, useMemo, useState } from "react";
import type { Highlight } from "../../types/highlight";
import "./style.css";

export default function App() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHighlights();
  }, []);

  async function loadHighlights() {
    try {
      const response = await browser.runtime.sendMessage({
        type: "GET_ALL_HIGHLIGHTS",
      });

      if (!response?.success) {
        throw new Error(
          response?.error || "Failed to load highlights"
        );
      }

      setHighlights(response.highlights ?? []);
    } catch (error) {
      console.error("Failed to load highlights:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredHighlights = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return highlights;

    return highlights.filter((highlight) =>
      [
        highlight.highlightedText,
        highlight.domain,
        highlight.pageTitle,
        highlight.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [highlights, search]);

  const websiteCount = new Set(
    highlights.map((highlight) => highlight.domain)
  ).size;

  const noteCount = highlights.filter(
    (highlight) => highlight.note?.trim()
  ).length;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">📚</div>

          <div>
            <h2>WebScribe</h2>
            <span>Knowledge Layer</span>
          </div>
        </div>

        <nav>
          <button className="nav-item active">
            🏠 <span>Overview</span>
          </button>

          <button className="nav-item">
            📖 <span>Highlights</span>
          </button>

          <button className="nav-item">
            🌐 <span>Websites</span>
          </button>

          <button className="nav-item">
            📝 <span>Notes</span>
          </button>

          <button className="nav-item">
            ⚙️ <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span>WebScribe v1.0</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <p className="eyebrow">YOUR PERSONAL KNOWLEDGE LAYER</p>
            <h1>Your knowledge, collected.</h1>
            <p className="subtitle">
              Every important piece of information you've saved across the web.
            </p>
          </div>

          <div className="search-wrapper">
            <span>🔍</span>

            <input
              type="text"
              placeholder="Search highlights, websites, notes..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span className="stat-icon">📖</span>
            <div>
              <p>Total Highlights</p>
              <strong>{highlights.length}</strong>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🌐</span>
            <div>
              <p>Websites</p>
              <strong>{websiteCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">📝</span>
            <div>
              <p>Notes</p>
              <strong>{noteCount}</strong>
            </div>
          </div>
        </section>

        <section className="highlights-section">
          <div className="section-heading">
            <div>
              <h2>Recent Highlights</h2>
              <p>Your saved knowledge from across the web.</p>
            </div>

            <span className="result-count">
              {filteredHighlights.length} saved
            </span>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>Loading your knowledge...</h3>
            </div>
          ) : filteredHighlights.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>

              <h3>
                {search ? "No matching highlights" : "No highlights yet"}
              </h3>

              <p>
                {search
                  ? "Try a different search term."
                  : "Start highlighting useful information on the web and it will appear here."}
              </p>
            </div>
          ) : (
            <div className="highlight-list">
              {filteredHighlights.map((highlight) => (
                <article
                  className="highlight-card"
                  key={highlight.id}
                >
                  <div className="highlight-marker" />

                  <div className="highlight-content">
                    <p className="highlight-text">
                      {highlight.highlightedText}
                    </p>

                    <div className="metadata">
                      <span>🌐 {highlight.domain}</span>
                      <span>📄 {highlight.pageTitle}</span>
                    </div>

                    {highlight.note && (
                      <div className="note">
                        <span>📝</span>
                        <span>{highlight.note}</span>
                      </div>
                    )}

                    <div className="card-footer">
                      <span>
                        {new Date(
                          highlight.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}