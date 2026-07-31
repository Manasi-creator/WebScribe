export interface Highlight {
  id: string;

  url: string;

  domain: string;

  pageTitle: string;

  highlightedText: string;

  anchor: {
    prefix: string;
    suffix: string;
    startOffset: number;
  };

  color: string;

  note: string | null;

  createdAt: number;

  updatedAt: number;

  lastVisited: number;

  orphaned: boolean;
}