export interface Thumbnail {
  height: number
  width: number
  aspectRatio: ThumbnailAspectRatio

  fileUrl: string
}

// 'original': same aspect ratio as the video (width/height in config are a bounding box)
export type ThumbnailAspectRatio = '16:9' | '16:10' | '4:3' | '5:4' | '1:1' | 'original'
