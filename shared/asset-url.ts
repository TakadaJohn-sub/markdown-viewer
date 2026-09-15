export const ASSET_SCHEME = 'mdv-asset'
export const ASSET_HOST = 'local'

/**
 * Maps a `file:` URL to the image-only `mdv-asset:` scheme served by the main process.
 * The path stays percent-encoded exactly as the file URL has it.
 */
export function toAssetUrl(fileUrl: string): string {
  const url = new URL(fileUrl)
  if (url.protocol !== 'file:') throw new TypeError(`Not a file URL: ${fileUrl}`)
  return `${ASSET_SCHEME}://${ASSET_HOST}${url.pathname}`
}
