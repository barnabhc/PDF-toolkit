import type { MergeRequest, MergeResponse } from '../../workers/merge.worker'
import type { MergeProgress } from './merge'

/** Runs the merge off the UI thread. File buffers are transferred, not copied. */
export function mergeInWorker(
  files: { name: string; buffer: ArrayBuffer }[],
  onProgress?: MergeProgress,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/merge.worker.ts', import.meta.url), { type: 'module' })
    const finish = (settle: () => void) => {
      worker.terminate()
      settle()
    }
    worker.onmessage = (event: MessageEvent<MergeResponse>) => {
      const message = event.data
      if (message.type === 'progress') onProgress?.(message.done, message.total)
      else if (message.type === 'done') finish(() => resolve(new Uint8Array(message.buffer)))
      else finish(() => reject(new Error(message.message)))
    }
    worker.onerror = (event) => finish(() => reject(new Error(event.message || 'Merge failed unexpectedly.')))
    const request: MergeRequest = { files }
    worker.postMessage(request, files.map((file) => file.buffer))
  })
}
