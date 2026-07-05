import { mergePdfs, type MergeInput } from '../lib/pdf/merge'
import { toArrayBuffer } from '../lib/binary'

export interface MergeRequest {
  files: { name: string; buffer: ArrayBuffer }[]
}

export type MergeResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

// Typed view of the dedicated-worker scope (the DOM lib's `postMessage` has
// the window signature, which doesn't accept a transfer list).
const scope = self as unknown as {
  postMessage(message: MergeResponse, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<MergeRequest>) => void) | null
}

scope.onmessage = async (event) => {
  try {
    const inputs: MergeInput[] = event.data.files.map((file) => ({
      name: file.name,
      bytes: new Uint8Array(file.buffer),
    }))
    const bytes = await mergePdfs(inputs, (done, total) => scope.postMessage({ type: 'progress', done, total }))
    const buffer = toArrayBuffer(bytes)
    scope.postMessage({ type: 'done', buffer }, [buffer])
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
