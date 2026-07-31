export interface ColorTag {
  color: string;
  meaning: string;
}

export interface UserSettings {
  colorTags: ColorTag[];

  defaultHighlightColor: string;

  autoOpenNote: boolean;

  theme: "light" | "dark" | "system";
}