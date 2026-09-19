import { browser } from "wxt/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Highlight } from "../../types/highlight";
import "./style.css";

type DashboardPage = "overview" | "highlights" | "notes" | "websites" | "settings";
type HighlightFilter = "all" | "notes" | "orphaned" | "tags";
type SortMode = "newest" | "oldest" | "updated" | "website" | "has-notes";

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
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "for",
  "with",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "from",
  "this",
  "that",
  "these",
  "those",
  "is",
  "it",
  "as",
  "be",
  "are",
  "was",
  "were",
  "if",
  "then",
  "than",
  "you",
  "your",
  "we",
  "our",
  "i",
  "me",
  "my",
  "he",
  "she",
  "they",
  "them",
  "their",
  "into",
  "over",
  "under",
  "about",
  "after",
  "before",
  "through",
  "during",
  "just",
  "will",
  "would",
  "could",
  "should",
  "have",
  "has",
  "had",
  "how",
  "why",
  "what",
  "when",
  "where",
  "which",
  "who",
  "while",
]);

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

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTags(tags?: string[] | null) {
  const seen = new Set<string>();

  return (tags ?? [])
    .map((tag) => normalizeTag(tag))
    .filter((tag) => {
      if (!tag || tag.length > 32) {
        return false;
      }

      if (seen.has(tag)) {
        return false;
      }

      seen.add(tag);
      return true;
    });
}

function normalizeHighlight(highlight?: Partial<Highlight> | null): Highlight {
  const createdAt = typeof highlight?.createdAt === "number" ? highlight.createdAt : Date.now();

  return {
    id: highlight?.id ?? crypto.randomUUID(),
    url: typeof highlight?.url === "string" ? highlight.url : "",
    domain: typeof highlight?.domain === "string" ? highlight.domain : "",
    pageTitle: typeof highlight?.pageTitle === "string" ? highlight.pageTitle : "Untitled page",
    highlightedText: typeof highlight?.highlightedText === "string" ? highlight.highlightedText : "",
    anchor: {
      exact: typeof highlight?.anchor?.exact === "string" ? highlight.anchor.exact : "",
      prefix: typeof highlight?.anchor?.prefix === "string" ? highlight.anchor.prefix : "",
      suffix: typeof highlight?.anchor?.suffix === "string" ? highlight.anchor.suffix : "",
    },
    color: normalizeHighlightColor(highlight?.color ?? DEFAULT_HIGHLIGHT_COLOR),
    tags: normalizeTags(highlight?.tags),
    note: typeof highlight?.note === "string" ? highlight.note : highlight?.note ?? null,
    createdAt,
    updatedAt: typeof highlight?.updatedAt === "number" ? highlight.updatedAt : createdAt,
    lastVisited: typeof highlight?.lastVisited === "number" ? highlight.lastVisited : createdAt,
    orphaned: Boolean(highlight?.orphaned),
  };
}

function parseSearchQuery(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      tagTerms: [] as string[],
      siteTerms: [] as string[],
      noteTerms: [] as string[],
      textTerms: [] as string[],
    };
  }

  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  const tagTerms: string[] = [];
  const siteTerms: string[] = [];
  const noteTerms: string[] = [];
  const textTerms: string[] = [];

  for (const token of tokens) {
    if (token.toLowerCase().startsWith("tag:")) {
      const value = token.slice(4).trim().toLowerCase();
      if (value) tagTerms.push(value);
      continue;
    }

    if (token.toLowerCase().startsWith("site:")) {
      const value = token.slice(5).trim().toLowerCase();
      if (value) siteTerms.push(value);
      continue;
    }

    if (token.toLowerCase().startsWith("note:")) {
      const value = token.slice(5).trim().toLowerCase();
      if (value) noteTerms.push(value);
      continue;
    }

    textTerms.push(token.toLowerCase());
  }

  return { tagTerms, siteTerms, noteTerms, textTerms };
}

function getSearchableText(highlight: Highlight) {
  return [
    highlight.highlightedText,
    highlight.note ?? "",
    highlight.pageTitle,
    highlight.domain,
    highlight.url,
    highlight.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesSearchQuery(highlight: Highlight, query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return true;
  }

  const { tagTerms, siteTerms, noteTerms, textTerms } = parseSearchQuery(cleanQuery);
  const haystack = getSearchableText(highlight);

  if (tagTerms.length > 0) {
    const tagMatch = tagTerms.every((term) =>
      highlight.tags.some((tag) => normalizeTag(tag).includes(term))
    );
    if (!tagMatch) return false;
  }

  if (siteTerms.length > 0) {
    const siteMatch = siteTerms.every((term) => {
      const searchableSite = `${highlight.domain} ${highlight.url}`.toLowerCase();
      return searchableSite.includes(term);
    });
    if (!siteMatch) return false;
  }

  if (noteTerms.length > 0) {
    const noteText = (highlight.note ?? "").toLowerCase();
    const noteMatch = noteTerms.every((term) => noteText.includes(term));
    if (!noteMatch) return false;
  }

  if (textTerms.length > 0) {
    const textMatch = textTerms.every((term) => haystack.includes(term));
    if (!textMatch) return false;
  }

  return true;
}

function sortHighlights(items: Highlight[], sortMode: SortMode) {
  return [...items].sort((a, b) => {
    switch (sortMode) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "updated":
        return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
      case "website":
        return (
          (a.domain ?? "").localeCompare(b.domain ?? "") || b.createdAt - a.createdAt
        );
      case "has-notes":
        return (
          Number(Boolean(b.note?.trim())) - Number(Boolean(a.note?.trim())) ||
          b.updatedAt - a.updatedAt
        );
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });
}

function getWebsiteSummaries(highlights: Highlight[]) {
  const summaryMap = new Map<string, { domain: string; count: number; noteCount: number; lastActivity: number }>();

  for (const highlight of highlights) {
    const domain = highlight.domain || "unknown";
    const entry = summaryMap.get(domain) ?? {
      domain,
      count: 0,
      noteCount: 0,
      lastActivity: 0,
    };

    entry.count += 1;
    entry.noteCount += Number(Boolean(highlight.note?.trim()));
    entry.lastActivity = Math.max(entry.lastActivity, highlight.updatedAt || highlight.createdAt || 0);
    summaryMap.set(domain, entry);
  }

  return Array.from(summaryMap.values()).sort(
    (a, b) => b.lastActivity - a.lastActivity
  );
}

function getRelatedHighlights(currentHighlight: Highlight, allHighlights: Highlight[]) {
  const currentWords = new Set(
    `${currentHighlight.highlightedText} ${currentHighlight.note ?? ""}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );

  return allHighlights
    .filter((highlight) => highlight.id !== currentHighlight.id)
    .map((highlight) => {
      let score = 0;

      if (highlight.domain === currentHighlight.domain) score += 3;
      if (highlight.pageTitle === currentHighlight.pageTitle) score += 2;
      score += highlight.tags.filter((tag) => currentHighlight.tags.includes(tag)).length * 5;

      const otherWords = new Set(
        `${highlight.highlightedText} ${highlight.note ?? ""}`
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      );

      const overlap = [...currentWords].filter((word) => otherWords.has(word)).length;
      score += overlap;

      return {
        highlight,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.highlight);
}

function formatRelativeDate(timestamp: number) {
  const now = Date.now();
  const delta = now - timestamp;

  if (delta < 60 * 1000) {
    return "just now";
  }

  const hours = Math.floor(delta / (60 * 60 * 1000));
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

export default function App() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<HighlightFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [websiteFilter, setWebsiteFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<DashboardPage>("overview");
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedSearchQuery = searchQuery.trim();

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(
          highlights.flatMap((highlight) =>
            (highlight.tags ?? []).map((tag) => normalizeTag(tag))
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [highlights]
  );

  useEffect(() => {
    if (selectedTag !== "all" && !allTags.includes(selectedTag)) {
      setSelectedTag("all");
    }
  }, [allTags, selectedTag]);

  useEffect(() => {
    void loadHighlights();
  }, []);

  async function loadHighlights() {
    try {
      setError(null);

      const response = await browser.runtime.sendMessage({
        type: "GET_ALL_HIGHLIGHTS",
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to load highlights");
      }

      setHighlights(
        (response.highlights ?? []).map((highlight: Partial<Highlight>) =>
          normalizeHighlight(highlight)
        )
      );
    } catch (error) {
      console.error("Failed to load highlights:", error);
      setError("Unable to load highlights.");
    } finally {
      setLoading(false);
    }
  }

  const websiteSummaries = useMemo(
    () => getWebsiteSummaries(highlights),
    [highlights]
  );

  const filteredHighlights = useMemo(() => {
    const matched = highlights.filter((highlight) => {
      if (websiteFilter && highlight.domain !== websiteFilter) {
        return false;
      }

      if (selectedTag !== "all" && !highlight.tags.includes(selectedTag)) {
        return false;
      }

      if (filter === "notes") {
        return Boolean(highlight.note?.trim()) && matchesSearchQuery(highlight, normalizedSearchQuery);
      }

      if (filter === "orphaned") {
        return Boolean(highlight.orphaned) && matchesSearchQuery(highlight, normalizedSearchQuery);
      }

      if (filter === "tags") {
        if (selectedTag === "all") {
          return matchesSearchQuery(highlight, normalizedSearchQuery);
        }

        return (
          highlight.tags.includes(selectedTag) && matchesSearchQuery(highlight, normalizedSearchQuery)
        );
      }

      return matchesSearchQuery(highlight, normalizedSearchQuery);
    });

    return sortHighlights(matched, sortMode);
  }, [filter, highlights, normalizedSearchQuery, selectedTag, sortMode, websiteFilter]);

  const noteCount = highlights.filter((highlight) => highlight.note?.trim()).length;
  const orphanedCount = highlights.filter((highlight) => highlight.orphaned).length;
  const tagCount = new Set(highlights.flatMap((highlight) => highlight.tags)).size;
  const websiteCount = new Set(highlights.map((highlight) => highlight.domain)).size;
  const filteredNotes = useMemo(
    () =>
      highlights.filter(
        (highlight) =>
          Boolean(highlight.note?.trim()) &&
          matchesSearchQuery(highlight, normalizedSearchQuery)
      ),
    [highlights, normalizedSearchQuery]
  );
  const recentHighlights = useMemo(
    () => sortHighlights(highlights, "newest").slice(0, 10),
    [highlights]
  );

  const overviewHighlights = useMemo(() => {
    return recentHighlights.filter((highlight) => {
      if (selectedTag !== "all" && !highlight.tags.includes(selectedTag)) {
        return false;
      }

      if (filter === "notes") {
        return Boolean(highlight.note?.trim()) && matchesSearchQuery(highlight, normalizedSearchQuery);
      }

      if (filter === "orphaned") {
        return Boolean(highlight.orphaned) && matchesSearchQuery(highlight, normalizedSearchQuery);
      }

      if (filter === "tags") {
        if (selectedTag === "all") {
          return matchesSearchQuery(highlight, normalizedSearchQuery);
        }

        return highlight.tags.includes(selectedTag) && matchesSearchQuery(highlight, normalizedSearchQuery);
      }

      return matchesSearchQuery(highlight, normalizedSearchQuery);
    });
  }, [filter, normalizedSearchQuery, recentHighlights, selectedTag]);

  const selectedDetailHighlight =
    highlights.find((item) => item.id === selectedHighlightId) ?? null;

  const relatedHighlights = useMemo(
    () =>
      selectedDetailHighlight
        ? getRelatedHighlights(selectedDetailHighlight, highlights)
        : [],
    [highlights, selectedDetailHighlight]
  );

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
        throw new Error(response?.error || "Failed to delete highlight");
      }

      setHighlights((current) => current.filter((item) => item.id !== id));
      setSelectedHighlightId((current) => (current === id ? null : current));
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
      current.map((item) => (item.id === highlightId ? updatedHighlight : item))
    );

    try {
      const response = await browser.runtime.sendMessage({
        type: "UPDATE_HIGHLIGHT",
        highlight: updatedHighlight,
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to update highlight color");
      }
    } catch (error) {
      console.error("Failed to update highlight color:", error);
      setError("Unable to update highlight color.");
    }
  }

  async function handleTagAdd(highlightId: string) {
    const draft = (tagDrafts[highlightId] ?? "").trim();
    const normalized = normalizeTag(draft);
    const targetHighlight = highlights.find((item) => item.id === highlightId);

    if (!targetHighlight || !normalized) {
      setTagDrafts((current) => ({ ...current, [highlightId]: "" }));
      return;
    }

    if (targetHighlight.tags.includes(normalized)) {
      setTagDrafts((current) => {
        const next = { ...current };
        delete next[highlightId];
        return next;
      });
      return;
    }

    const updatedHighlight = {
      ...targetHighlight,
      tags: normalizeTags([...targetHighlight.tags, normalized]),
      updatedAt: Date.now(),
    };

    setHighlights((current) =>
      current.map((item) => (item.id === highlightId ? updatedHighlight : item))
    );
    setTagDrafts((current) => {
      const next = { ...current };
      delete next[highlightId];
      return next;
    });

    try {
      const response = await browser.runtime.sendMessage({
        type: "UPDATE_HIGHLIGHT",
        highlight: updatedHighlight,
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to update highlight tags");
      }
    } catch (error) {
      console.error("Failed to update highlight tags:", error);
      setError("Unable to update tags.");
    }
  }

  async function handleTagRemove(highlightId: string, tagToRemove: string) {
    const targetHighlight = highlights.find((item) => item.id === highlightId);
    if (!targetHighlight) {
      return;
    }

    const updatedHighlight = {
      ...targetHighlight,
      tags: normalizeTags(targetHighlight.tags.filter((tag) => tag !== tagToRemove)),
      updatedAt: Date.now(),
    };

    setHighlights((current) =>
      current.map((item) => (item.id === highlightId ? updatedHighlight : item))
    );

    try {
      const response = await browser.runtime.sendMessage({
        type: "UPDATE_HIGHLIGHT",
        highlight: updatedHighlight,
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to remove highlight tag");
      }
    } catch (error) {
      console.error("Failed to remove highlight tag:", error);
      setError("Unable to remove tag.");
    }
  }

  async function handleExportKnowledge() {
    const payload = {
      format: "WebScribe",
      version: 1,
      exportedAt: new Date().toISOString(),
      highlights: highlights.map((highlight) => ({
        ...highlight,
        tags: normalizeTags(highlight.tags),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = `webscribe-export-${new Date().toISOString().slice(0, 10)}.json`;

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleImportKnowledge(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);

      if (!parsed || parsed.format !== "WebScribe" || !Array.isArray(parsed.highlights)) {
        throw new Error("Invalid WebScribe export file");
      }

      let imported = 0;
      let skipped = 0;

      for (const item of parsed.highlights) {
        const safeHighlight = normalizeHighlight(item as Partial<Highlight>);
        const duplicate = highlights.some((existing) => existing.id === safeHighlight.id);

        if (duplicate) {
          skipped += 1;
          continue;
        }

        await browser.runtime.sendMessage({
          type: "SAVE_HIGHLIGHT",
          highlight: safeHighlight,
        });

        imported += 1;
      }

      setImportSummary(`Import complete: ${imported} highlights imported, ${skipped} duplicates skipped.`);
      await loadHighlights();
    } catch (error) {
      console.error("Failed to import knowledge:", error);
      setImportSummary("Import failed. Please choose a valid WebScribe export file.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDeleteAllHighlights() {
    const confirmed = window.confirm(
      "Delete all WebScribe knowledge? This will permanently remove your highlights, notes, and tags."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await browser.runtime.sendMessage({
        type: "DELETE_ALL_HIGHLIGHTS",
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to delete all highlights");
      }

      setHighlights([]);
      setSelectedHighlightId(null);
      setImportSummary("All highlights deleted.");
      setFilter("all");
      setSelectedTag("all");
      setWebsiteFilter(null);
    } catch (error) {
      console.error("Failed to delete all highlights:", error);
      setError("Unable to delete all highlights.");
    }
  }

  function renderColorPicker(highlight: Highlight) {
    return (
      <div className="color-picker" aria-label="Highlight color picker">
        {HIGHLIGHT_COLOR_OPTIONS.map((option) => {
          const isSelected = normalizeHighlightColor(highlight.color) === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={isSelected ? "color-swatch selected" : "color-swatch"}
              style={{ backgroundColor: option.value }}
              title={option.name}
              aria-label={`Set highlight color to ${option.name}`}
              aria-pressed={isSelected}
              onClick={() => void handleHighlightColorChange(highlight.id, option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderTagPills(highlight: Highlight) {
    return (
      <div className="tag-list">
        {highlight.tags.length === 0 ? (
          <span className="tag-empty">No tags</span>
        ) : (
          highlight.tags.map((tag) => (
            <span key={tag} className="tag-pill">
              <button
                type="button"
                className="tag-pill-button"
                onClick={() => {
                  setSelectedTag(tag);
                  setFilter("tags");
                  setActivePage("highlights");
                }}
              >
                {tag}
              </button>
              <button
                type="button"
                className="tag-remove"
                aria-label={`Remove ${tag} tag`}
                onClick={() => void handleTagRemove(highlight.id, tag)}
              >
                ×
              </button>
            </span>
          ))
        )}

        {tagDrafts[highlight.id] !== undefined ? (
          <div className="tag-input-row">
            <input
              type="text"
              value={tagDrafts[highlight.id] ?? ""}
              placeholder="Add tag"
              onChange={(event) =>
                setTagDrafts((current) => ({
                  ...current,
                  [highlight.id]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleTagAdd(highlight.id);
                }
              }}
            />
            <button type="button" className="tag-save" onClick={() => void handleTagAdd(highlight.id)}>
              Save
            </button>
            <button
              type="button"
              className="tag-cancel"
              onClick={() =>
                setTagDrafts((current) => {
                  const next = { ...current };
                  delete next[highlight.id];
                  return next;
                })
              }
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="tag-add-button"
            onClick={() =>
              setTagDrafts((current) => ({
                ...current,
                [highlight.id]: "",
              }))
            }
          >
            + Add tag
          </button>
        )}
      </div>
    );
  }

  const renderHighlightCard = (highlight: Highlight) => (
    <article className="highlight-card" key={highlight.id}>
      <div
        className="highlight-marker"
        style={{ background: normalizeHighlightColor(highlight.color) }}
      />

      <div className="highlight-content">
        {highlight.orphaned && <div className="orphaned-badge">⚠️ Orphaned</div>}

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

        {renderTagPills(highlight)}
        {renderColorPicker(highlight)}

        {highlight.orphaned && (
          <div className="orphaned-message">
            ⚠️ This highlight could not be restored to its original text.
          </div>
        )}

        <div className="card-footer">
          <span>{highlight.domain}</span>
          <span>•</span>
          <span>{new Date(highlight.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setSelectedHighlightId(highlight.id)}
          >
            Manage
          </button>

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
            onClick={() => void handleDeleteHighlight(highlight.id)}
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
            placeholder="Search highlights, websites, notes, tags..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {normalizedSearchQuery && (
            <button type="button" className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
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
          <span className="stat-icon">📝</span>
          <div>
            <p>Highlights With Notes</p>
            <strong>{noteCount}</strong>
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
          <span className="stat-icon">🏷️</span>
          <div>
            <p>Tags</p>
            <strong>{tagCount}</strong>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">⚠️</span>
          <div>
            <p>Orphaned</p>
            <strong>{orphanedCount}</strong>
          </div>
        </div>
      </section>

      <section className="tag-cloud-panel">
        <div className="section-heading">
          <div>
            <h2>Most used tags</h2>
            <p>Your local knowledge categories.</p>
          </div>
        </div>

        <div className="tag-cloud">
          {allTags.length === 0 ? (
            <p className="muted">No tags yet.</p>
          ) : (
            allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-cloud-item"
                onClick={() => {
                  setSelectedTag(tag);
                  setFilter("tags");
                  setActivePage("highlights");
                }}
              >
                {tag}
              </button>
            ))
          )}
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
          <p className="subtitle">Every important passage you've captured from across the web.</p>
        </div>

        <div className="search-wrapper">
          <span>🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search highlighted text, notes, tags, domains..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {normalizedSearchQuery && (
            <button type="button" className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>All Highlights</h2>
            <p>Search, filter, and organize your saved knowledge.</p>
          </div>

          <span className="search-results-count">
            {filteredHighlights.length} {filteredHighlights.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div className="toolbar-row">
          <div className="filter-bar">
            {[
              { id: "all", label: "All" },
              { id: "notes", label: "With Notes" },
              { id: "orphaned", label: "Orphaned" },
              { id: "tags", label: "Tags" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? "filter-button active" : "filter-button"}
                onClick={() => {
                  setFilter(option.id as HighlightFilter);
                  if (option.id !== "tags") {
                    setSelectedTag("all");
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="sort-control">
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="updated">Recently Updated</option>
              <option value="website">Website</option>
              <option value="has-notes">Has Notes</option>
            </select>
          </label>
        </div>

        {filter === "tags" && (
          <div className="tag-filter-row">
            <label htmlFor="tag-filter-select">Tag</label>
            <select id="tag-filter-select" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
              <option value="all">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}

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
          <p className="subtitle">Highlights with saved context and personal annotations.</p>
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

  const renderWebsitesContent = () => (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">WEBSITES</p>
          <h1>Website knowledge</h1>
          <p className="subtitle">See what knowledge you have saved from each site.</p>
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>Domains</h2>
            <p>Your saved knowledge grouped by website.</p>
          </div>
        </div>

        {websiteSummaries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <h3>No websites yet.</h3>
            <p>Save a few highlights and they will appear here.</p>
          </div>
        ) : (
          <div className="website-list">
            {websiteSummaries.map((website) => (
              <button
                key={website.domain}
                type="button"
                className="website-card"
                onClick={() => {
                  setWebsiteFilter(website.domain);
                  setActivePage("highlights");
                  setFilter("all");
                  setSelectedTag("all");
                }}
              >
                <div className="website-header">
                  <strong>{website.domain}</strong>
                  <span>{website.count} highlights</span>
                </div>
                <div className="website-meta">
                  <span>{website.noteCount} notes</span>
                  <span>Last activity: {formatRelativeDate(website.lastActivity)}</span>
                </div>
              </button>
            ))}
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
          <p className="subtitle">Manage your local knowledge safely.</p>
        </div>
      </header>

      <section className="highlights-section">
        <div className="section-heading">
          <div>
            <h2>Knowledge Management</h2>
            <p>Export, import, and manage your saved highlights.</p>
          </div>
        </div>

        <div className="settings-panel">
          <div className="setting-row">
            <h3>Storage / Data</h3>
            <div className="settings-actions">
              <button type="button" className="action-button secondary" onClick={() => void handleExportKnowledge()}>
                Export Knowledge
              </button>

              <button type="button" className="action-button secondary" onClick={() => fileInputRef.current?.click()}>
                Import Knowledge
              </button>

              <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(event) => void handleImportKnowledge(event)} />
            </div>

            {importSummary && <p className="inline-message">{importSummary}</p>}
          </div>

          <div className="setting-row danger-zone">
            <h3>Danger Zone</h3>
            <button type="button" className="action-button danger" onClick={() => void handleDeleteAllHighlights()}>
              Delete All Highlights
            </button>
          </div>
        </div>
      </section>
    </>
  );

  const navItems: Array<{ id: DashboardPage; icon: string; label: string }> = [
    { id: "overview", icon: "🏠", label: "Overview" },
    { id: "highlights", icon: "📖", label: "Highlights" },
    { id: "notes", icon: "📝", label: "Notes" },
    { id: "websites", icon: "🌐", label: "Websites" },
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
              className={activePage === item.id ? "nav-item active" : "nav-item"}
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
        {activePage === "websites" && renderWebsitesContent()}
        {activePage === "settings" && renderSettingsContent()}
      </main>

      {selectedDetailHighlight && (
        <div className="detail-backdrop" onClick={() => setSelectedHighlightId(null)}>
          <aside className="detail-panel" onClick={(event) => event.stopPropagation()}>
            <div className="detail-header">
              <div>
                <p className="eyebrow">HIGHLIGHT DETAIL</p>
                <h3>Knowledge item</h3>
              </div>
              <button type="button" className="detail-close" onClick={() => setSelectedHighlightId(null)} aria-label="Close highlight detail">
                ×
              </button>
            </div>

            <div className="detail-content">
              <p className="detail-highlight-text">{selectedDetailHighlight.highlightedText}</p>

              <div className="metadata">
                <span>🌐 {selectedDetailHighlight.domain}</span>
                <span>📅 {new Date(selectedDetailHighlight.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <strong>Page</strong>
                  <span>{selectedDetailHighlight.pageTitle}</span>
                </div>
                <div>
                  <strong>URL</strong>
                  <span>{selectedDetailHighlight.url}</span>
                </div>
                <div>
                  <strong>Color</strong>
                  <span className="detail-color">
                    <span style={{ background: normalizeHighlightColor(selectedDetailHighlight.color) }} />
                    {normalizeHighlightColor(selectedDetailHighlight.color)}
                  </span>
                </div>
                <div>
                  <strong>Updated</strong>
                  <span>{new Date(selectedDetailHighlight.updatedAt).toLocaleString()}</span>
                </div>
                <div>
                  <strong>Orphaned</strong>
                  <span>{selectedDetailHighlight.orphaned ? "Yes" : "No"}</span>
                </div>
                <div>
                  <strong>Tags</strong>
                  <span>{selectedDetailHighlight.tags.length}</span>
                </div>
              </div>

              {selectedDetailHighlight.note && (
                <div className="detail-note">
                  <h4>Note</h4>
                  <p>{selectedDetailHighlight.note}</p>
                </div>
              )}

              <div className="detail-tags">
                <h4>Tags</h4>
                {renderTagPills(selectedDetailHighlight)}
              </div>

              <div className="detail-color-row">
                <h4>Color</h4>
                {renderColorPicker(selectedDetailHighlight)}
              </div>

              <div className="detail-related">
                <h4>Related Highlights</h4>
                {relatedHighlights.length > 0 ? (
                  <div className="related-list">
                    {relatedHighlights.map((highlight) => (
                      <button
                        key={highlight.id}
                        type="button"
                        className="related-item"
                        onClick={() => setSelectedHighlightId(highlight.id)}
                      >
                        <span className="related-domain">{highlight.domain}</span>
                        <span className="related-text">{highlight.highlightedText}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No related highlights yet.</p>
                )}
              </div>
            </div>

            <div className="detail-actions">
              <button type="button" className="action-button secondary" onClick={() => openHighlightPage(selectedDetailHighlight)}>
                Open Page
              </button>
              <button type="button" className="action-button secondary" onClick={() => setSelectedHighlightId(null)}>
                Close
              </button>
              <button
                type="button"
                className="action-button danger"
                onClick={() => {
                  void handleDeleteHighlight(selectedDetailHighlight.id);
                  setSelectedHighlightId(null);
                }}
              >
                Delete
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}