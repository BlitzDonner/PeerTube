/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { buildThumbnailSize, findAppropriateThumbnail } from '@peertube/peertube-core-utils'
import { expect } from 'chai'

describe('Thumbnail sizes', function () {
  const original = { width: 1920, height: 1920, aspectRatio: 'original' as const }

  it('Should keep non original sizes unchanged', function () {
    const size = { width: 1280, height: 720, aspectRatio: '16:9' as const }

    expect(buildThumbnailSize(size, 0.5625)).to.deep.equal(size)
  })

  it('Should build a portrait size for a 9:16 video', function () {
    expect(buildThumbnailSize(original, 9 / 16)).to.deep.include({ width: 1080, height: 1920 })
  })

  it('Should build a 4:5 and a square size', function () {
    expect(buildThumbnailSize(original, 0.8)).to.deep.include({ width: 1536, height: 1920 })
    expect(buildThumbnailSize(original, 1)).to.deep.include({ width: 1920, height: 1920 })
  })

  it('Should build a landscape size and fallback to 16:9 without ratio', function () {
    expect(buildThumbnailSize(original, 16 / 9)).to.deep.include({ width: 1920, height: 1080 })
    expect(buildThumbnailSize(original, null)).to.deep.include({ width: 1920, height: 1080 })
  })

  it('Should find original thumbnails separately from 16:9 ones', function () {
    const thumbnails = [
      { width: 1280, aspectRatio: '16:9' as const },
      { width: 270, aspectRatio: 'original' as const },
      { width: 1080, aspectRatio: 'original' as const }
    ]

    expect(findAppropriateThumbnail(thumbnails, 800, 'original').width).to.equal(1080)
    expect(findAppropriateThumbnail(thumbnails, 800, '16:9').width).to.equal(1280)
  })
})
