/**
 * File System Access API — Chromium only, not yet in TypeScript's DOM lib.
 * Feature-detected at every call site; Firefox/Safari fall back to
 * <input type=file> and anchor downloads.
 */
interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[]
  multiple?: boolean
  excludeAcceptAllOption?: boolean
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  launchQueue?: LaunchQueue
}

/**
 * File Handling API (Chromium, installed PWAs only): delivers files the OS
 * asked the app to open — e.g. after the user makes it their default .pdf handler.
 */
interface LaunchQueue {
  setConsumer(consumer: (launchParams: LaunchParams) => void | Promise<void>): void
}

interface LaunchParams {
  readonly files: readonly FileSystemFileHandle[]
  readonly targetURL?: string
}
