import { browser } from "wxt/browser";
import { useEffect, useMemo, useState } from "react";
import type { Highlight } from "../../types/highlight";
import "./style.css";

type DashboardPage = "overview" | "highlights" | "notes" | "settings";
type HighlightFilter = "all" | "notes" | "websites" | "orphaned";

const DEFAULT_HIGHLIGHT_COLOR = "#FFF59D";
const HIGHLIGHT_COLOR_OPTIONS = [
  { value: "#FFF59D", label: "🟨", name: "Yellow" },
  { value: "#BBDEFB", label: "🟦", name: "Blue" },
  { value: "#C8E6C9", label: "🟩", name: "Green" },
  { value: "#F8BBD0", label: "🩷", name: "Pink" },
  { value: "#D1C4E9", label: "🟪", name: "Purple" },
  { value: "#FFE0B2", label: "🟧", name: "Orange" },
] as const;
const WEBSCRIBE_HIGHLIGHT_PARAM = "webscribeHighlight";

function normalizeHighlightColor(color?: string | null) {
  if (typeof color !== "string") {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  const normalized = color.trim().toUpperCase();
  const validColors = new Set(
    HIGHLIGHT_COLOR_OPTIONS.map((option) => option.value.toUpperCase())
  );

  return validColors.has(normalized)
    ? normalized
    : DEFAULT_HIGHLIGHT_COLOR;
}

export default function App() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<HighlightFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<DashboardPage>("overview");

  const normalizedSearchQuery = searchQuery.trim();

  useEffect(() => {
    loadHighlights();
  }, []);

  async function loadHighlights() {
    try {
      setError(null);

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
      setError("Unable to load highlights.");
    } finally {
      setLoading(false);
    }
  }

  const matchesSearchQuery = (highlight: Highlight) => {
    const query = normalizedSearchQuery.toLowerCase();

    if (!query) return true;

    return [
      highlight.highlightedText,
      highlight.domain,
      highlight.pageTitle,
      highlight.note ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  };

  const filteredHighlights = useMemo(() => {
    return highlights.filter((highlight) => {
      if (filter === "notes") {
        return Boolean(highlight.note?.trim()) && matchesSearchQuery(highlight);
      }

      if (filter === "websites") {
        return Boolean(highlight.domain?.trim()) && matchesSearchQuery(highlight);
      }

      if (filter === "orphaned") {
        return Boolean(highlight.orphaned) && matchesSearchQuery(highlight);
      }

      return matchesSearchQuery(highlight);
    });
  }, [filter, highlights, searchQuery]);

  const websiteCount = new Set(
    highlights.map((highlight) => highlight.domain)
  ).size;

  const noteCount = highlights.filter(
    (highlight) => highlight.note?.trim()
  ).length;

  const notes = highlights.filter((highlight) => highlight.note?.trim());
  const filteredNotes = notes.filter((highlight) => matchesSearchQuery(highlight));
  const recentHighlights = useMemo(
    () =>
      [...highlights]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10),
    [highlights]
  );

  const overviewHighlights = useMemo(() => {
    return recentHighlights.filter((highlight) => {
      if (filter === "notes") {
        return Boolean(highlight.note?.trim()) && matchesSearchQuery(highlight);
      }

      if (filter === "websites") {
        return Boolean(highlight.domain?.trim()) && matchesSearchQuery(highlight);
      }

      if (filter === "orphaned") {
        return Boolean(highlight.orphaned) && matchesSearchQuery(highlight);
      }

      return matchesSearchQuery(highlight);
    });
  }, [filter, recentHighlights, searchQuery]);

  function openHighlightPage(highlight: Highlight) {
    if (!highlight?.id || !highlight?.url) {
      window.open(highlight?.url || "", "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const targetUrl = new URL(highlight.url);
      targetUrl.searchParams.set(WEBSCRIBE_HIGHLIGHT_PARAM, highlight.id);
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
    } catch {
      const separator = highlight.url.includes("?") ? "&" : "?";
      const targetUrl = `${highlight.url}${separator}${WEBSCRIBE_HIGHLIGHT_PARAM}=${encodeURIComponent(highlight.id)}`;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDeleteHighlight(id: string) {
    const confirmed = window.confirm("Delete this highlight?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await browser.runtime.sendMessage({
        type: "DELETE_HIGHLIGHT",
        id,
      });

      if (!response?.success) {
        throw new Error(
          response?.error || "Failed to delete highlight"
        );
      }

      setHighlights((current) =>
        current.filter((item) => item.id !== id)
      );
    } catch (error) {
      console.error("Failed to delete highlight:", error);
      setError("Unable to delete highlight.");
    }
  }

  async function handleHighlightColorChange(highlightId: string, color: string) {
    const safeColor = normalizeHighlightColor(color);
    const targetHighlight = highlights.find((item) => item.id === highlightId);

    if (!targetHighlight) {
      return;
    }

    const updatedHighlight = {
      ...targetHighlight,
      color: safeColor,
      updatedAt: Date.now(),
    };

    setHighlights((current) =>
      current.map((item) =>
        item.id === highlightId ? updatedHighlight : item
      )
    );

    try {
      const response = await browser.runtime.sendMessage({
        type: "UPDATE_HIGHLIGHT",
        highlight: updatedHighlight,
      });

      if (!response?.success) {
        throw new Error(
          response?.error || "Failed to update highlight color"
        );
      }
    } catch (error) {
      console.error("Failed to update highlight color:", error);
      setError("Unable to update highlight color.");
    }
  }

  const renderHighlightCard = (highlight: Highlight) => (
    <article className="highlight-card" key={highlight.id}>
      <div
        className="highlight-marker"
        style={{ background: normalizeHighlightColor(highlight.color) }}
      />

      <div className="highlight-content">
        {highlight.orphaned && (
          <div className="orphaned-badge">⚠️ Orphaned</div>
        )}

        <p className="highlight-text">{highlight.highlightedText}</p>

        <div className="metadata">
          <span>🌐 {highlight.domain}</span>
          <span>📅 {new Date(highlight.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="page-title">{highlight.pageTitle}</div>

        {highlight.note && (
          <div className="note">
            <span aria-hidden="true">📝</span>
            <span className="note-text">{highlight.note}</span>
          </div>
        )}

        {highlight.orphaned && (
          <div className="orphaned-message">
            ⚠️ This highlight could not be restored to its original text.
          </div>
        )}

        <div className="color-picker" aria-label="Highlight color picker">
          {HIGHLIGHT_COLOR_OPTIONS.map((option) => {
            const isSelected =
              normalizeHighlightColor(highlight.color) === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={
                  isSelected ? "color-swatch selected" : "color-swatch"
                }
                style={{ backgroundColor: option.value }}
                title={option.name}
                aria-label={`Set highlight color to ${option.name}`}
                aria-pressed={isSelected}
                onClick={() => handleHighlightColorChange(highlight.id, option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="card-footer">
          <span>{highlight.domain}</span>
          <span>•</span>
          <span>{new Date(highlight.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="action-button secondary"
            aria-label={`Open the page for ${highlight.pageTitle}`}
            onClick={() => openHighlightPage(highlight)}
          >
            Open Page
          </button>

          <button
            type="button"
            className="action-button danger"
            aria-label={`Delete highlight from ${highlight.domain}`}
            onClick={() => handleDeleteHighlight(highlight.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );

  const renderOverviewContent = () => (
    <>
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
            className="search-input"
            placeholder="Search highlights, websites, notes..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {normalizedSearchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
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

          <span className="result-count">{filteredHighlights.length} saved</span>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading your knowledge...</h3>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to load highlights.</h3>
            <p>Please try refreshing the dashboard.</p>
          </div>
        ) : overviewHighlights.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>

            <h3>
              {normalizedSearchQuery || filter !== "all"
                ? "No matching highlights found."
                : "No highlights yet. Select text on any webpage to save it."}
            </h3>

            <p>
              {normalizedSearchQuery || filter !== "all"
                ? "Try a different search term or filter."
                : "Start highlighting useful information on the web and it will appear here."}
            </p>
          </div>
        ) : (
          <div className="highlight-list">
            {overviewHighlights.map((highlight) => renderHighlightCard(highlight))}
          </div>
        )}
      </section>
    </>
  );

  const renderHighlightsContent = () => (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">YOUR SAVED HIGHLIGHTS</p>
          <h1>Highlights</h1>
          <p className="subtitle">
            Every important passage you've captured from across the web.
          </p>
        </div>

        <div className="search-wrapper">
          <span>🔍</span>

          <input
            type="text"
            className="search-input"
            placeholder="Search highlights..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {normalizedSearchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>All Highlights</h2>
            <p>Your saved knowledge from across the web.</p>
          </div>

          <span className="search-results-count">
            {filteredHighlights.length} {filteredHighlights.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div className="filter-bar">
          {[
            { id: "all", label: "All" },
            { id: "notes", label: "Notes" },
            { id: "websites", label: "Websites" },
            { id: "orphaned", label: "Orphaned" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                filter === option.id ? "filter-button active" : "filter-button"
              }
              onClick={() => setFilter(option.id as HighlightFilter)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading your knowledge...</h3>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to load highlights.</h3>
            <p>Please try refreshing the dashboard.</p>
          </div>
        ) : filteredHighlights.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>
              {filter === "orphaned"
                ? "No orphaned highlights"
                : normalizedSearchQuery || filter !== "all"
                  ? "No matching highlights found."
                  : "No highlights yet."}
            </h3>
            <p>
              {filter === "orphaned"
                ? "Highlights that cannot currently be found on their original pages will appear here."
                : normalizedSearchQuery || filter !== "all"
                  ? "Try a different search term or filter."
                  : "Start highlighting useful information on the web and it will appear here."}
            </p>
          </div>
        ) : (
          <div className="highlight-list">
            {filteredHighlights.map((highlight) => renderHighlightCard(highlight))}
          </div>
        )}
      </section>
    </>
  );

  const renderNotesContent = () => (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">YOUR NOTES</p>
          <h1>Notes</h1>
          <p className="subtitle">
            Highlights with saved context and personal annotations.
          </p>
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>Your Notes</h2>
            <p>Annotated highlights from your saved knowledge.</p>
          </div>

          <span className="result-count">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading your knowledge...</h3>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to load highlights.</h3>
            <p>Please try refreshing the dashboard.</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>{normalizedSearchQuery ? "No matching notes found." : "No notes yet."}</h3>
            <p>
              {normalizedSearchQuery
                ? "Try a different search term."
                : "Click a highlight on a webpage to add one."}
            </p>
          </div>
        ) : (
          <div className="highlight-list">
            {filteredNotes.map((highlight) => renderHighlightCard(highlight))}
          </div>
        )}
      </section>
    </>
  );

  const renderSettingsContent = () => (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">YOUR PREFERENCES</p>
          <h1>Settings</h1>
          <p className="subtitle">Manage your WebScribe preferences.</p>
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>Settings</h2>
            <p>Manage your WebScribe preferences.</p>
          </div>
        </div>

        <div className="settings-panel">
          <div className="setting-row">
            <h3>Storage</h3>
            <p>
              WebScribe stores your highlights and notes locally using IndexedDB.
            </p>
          </div>

          <div className="setting-row">
            <h3>Highlight Color</h3>
            <div className="setting-color-row">
              <span
                className="setting-color-swatch"
                style={{
                  background:
                    highlights[0]?.color || "#f6c6d8",
                }}
              />
              <span>{highlights[0]?.color || "#F6C6D8"}</span>
            </div>
          </div>

          <div className="setting-row">
            <h3>About</h3>
            <p>WebScribe</p>
            <p>Personal Knowledge Layer for the Web</p>
          </div>
        </div>
      </section>
    </>
  );

  const navItems: Array<{ id: DashboardPage; icon: string; label: string }> = [
    { id: "overview", icon: "🏠", label: "Overview" },
    { id: "highlights", icon: "📖", label: "Highlights" },
    { id: "notes", icon: "📝", label: "Notes" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

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
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                activePage === item.id ? "nav-item active" : "nav-item"
              }
              aria-current={activePage === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => setActivePage(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>WebScribe v1.0</span>
        </div>
      </aside>

      <main className="main-content">
        {activePage === "overview" && renderOverviewContent()}
        {activePage === "highlights" && renderHighlightsContent()}
        {activePage === "notes" && renderNotesContent()}
        {activePage === "settings" && renderSettingsContent()}
      </main>
    </div>
  );
}