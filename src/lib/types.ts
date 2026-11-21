export type Note = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  pinned: boolean;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
  body: string;
};

export const COLORS: Record<string, string> = {
  gray: "#9b9a97",
  red: "#eb5757",
  orange: "#f2994a",
  yellow: "#e2b93b",
  green: "#4dab9a",
  blue: "#2383e2",
  purple: "#9065b0",
  pink: "#e255a1",
};
