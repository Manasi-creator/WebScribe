export interface Highlight {
  id: string;

  url: string;
  domain: string;
  pageTitle: string;

  highlightedText: string;

  anchor: {
    exact: string;
    prefix: string;
    suffix: string;
  };

  color: string;
  tags: string[];

  note: string | null;

  createdAt: number;
  updatedAt: number;
  lastVisited: number;

  orphaned: boolean;
}