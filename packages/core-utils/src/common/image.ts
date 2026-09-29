import { ThumbnailAspectRatio } from '@peertube/peertube-models'
import { maxBy } from './array.js'

export function findAppropriateThumbnail<T extends { width: number, aspectRatio: ThumbnailAspectRatio }> (
  images: T[],
  wantedWidth: number,
  ratio: ThumbnailAspectRatio
) {
  if (!images) return null

  return findAppropriateImage(
    images.filter(img => img.aspectRatio === ratio),
    wantedWidth
  )
}

// Poster of the player: prefer a thumbnail in the video aspect ratio, fallback to 16:9 (remote or older videos)
export function findAppropriatePosterThumbnail<T extends { width: number, aspectRatio: ThumbnailAspectRatio }> (
  images: T[],
  wantedWidth: number
) {
  return findAppropriateThumbnail(images, wantedWidth, 'original') || findAppropriateThumbnail(images, wantedWidth, '16:9')
}

export function findAppropriateImage<T extends { width: number }> (images: T[], wantedWidth: number) {
  if (!wantedWidth) throw new Error('Invalid width to find appropriate image')
  if (!images || images.length === 0) return undefined

  let candidate: T

  for (const img of images) {
    if (img.width >= wantedWidth && (!candidate || img.width < candidate.width)) {
      candidate = img
    }
  }

  return candidate || maxBy(images, 'width')
}

// Resolve a configured thumbnail size to real dimensions
// For 'original' sizes, width/height are a bounding box and the result keeps the video aspect ratio (width / height)
// Other sizes are returned unchanged
export function buildThumbnailSize<T extends { width: number, height: number, aspectRatio: ThumbnailAspectRatio }> (
  size: T,
  videoAspectRatio: number
): T {
  if (size.aspectRatio !== 'original') return size

  const ratio = videoAspectRatio > 0 ? videoAspectRatio : 16 / 9
  const box = Math.max(size.width, size.height)

  // Even dimensions, like video resolutions
  const toEven = (n: number) => Math.max(2, Math.round(n / 2) * 2)

  return ratio >= 1
    ? { ...size, width: toEven(box), height: toEven(box / ratio) }
    : { ...size, width: toEven(box * ratio), height: toEven(box) }
}

export function guessAspectRatio (width: number, height: number): ThumbnailAspectRatio {
  const ratio = width / height

  if (ratio >= 1.77) return '16:9'
  if (ratio >= 1.6) return '16:10'
  if (ratio >= 1.33) return '4:3'
  if (ratio >= 1.25) return '5:4'

  return '1:1'
}
