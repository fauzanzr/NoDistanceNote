export type StoredFile = { id: string; name: string; content: string };
export type FileMeta = {
  id: string; name: string; size: number; mime: string; createdAt: string;
  device?: string; os?: string;
};
export type StorageInfo = { mode: "drive" | "local"; account: string; path: string };
export type DownloadSession = {
  mode: "direct" | "server";
  url: string;
  token?: string;
  name: string;
  size: number;
  mime: string;
};

export interface Store {
  listFiles(): Promise<FileMeta[]>;
  uploadFile(name: string, mime: string, data: Buffer, meta?: { device: string; os: string }): Promise<string>;
  appendFileChunk?(
    uploadId: string,
    name: string,
    chunk: Buffer,
    offset: number,
    totalSize: number,
    meta?: { device: string; os: string }
  ): Promise<{ done: boolean; id?: string }>;
  createUploadSession?(
    name: string, mime: string, size: number, origin: string, meta?: { device: string; os: string }
  ): Promise<string | null>;
  getDownloadSession?(id: string): Promise<DownloadSession | null>;
  getFileStream?(id: string): Promise<{ stream: ReadableStream<Uint8Array>; name: string; size: number; mime: string } | null>;
  storageInfo(): Promise<StorageInfo>;
  getFile(id: string): Promise<{ data: Buffer; name: string; mime: string } | null>;
  deleteFile(id: string): Promise<void>;
  renameFile(id: string, name: string): Promise<{ id: string; name: string }>;
  listNotes(): Promise<StoredFile[]>;
  getNote(id: string): Promise<StoredFile | null>;
  createNote(name: string, content: string): Promise<string>;
  updateNote(id: string, content: string, name?: string): Promise<void>;
  trashNote(id: string): Promise<void>;
  uploadAsset(name: string, mime: string, data: Buffer): Promise<string>;
  getAsset(id: string): Promise<{ data: Buffer; mime: string } | null>;
  readOtk(): Promise<Record<string, number>>;
  writeOtk(data: Record<string, number>): Promise<void>;
}
