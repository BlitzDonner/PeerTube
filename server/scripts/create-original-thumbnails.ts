import { buildThumbnailSize } from '@peertube/peertube-core-utils'
import { VideoFileStream } from '@peertube/peertube-models'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { generateImageFilename, processImage } from '@server/helpers/image-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { createLocalVideoThumbnailsFromVideo } from '@server/lib/thumbnail.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoModel } from '@server/models/video/video.js'
import { MThumbnail, MVideoFull } from '@server/types/models/index.js'
import { program } from 'commander'
import { pathExists } from 'fs-extra/esm'

// Adds thumbnails in the video aspect ratio ('original' sizes of the config) to existing local videos
// Existing thumbnails of other aspect ratios are kept untouched
//
// Source of the new thumbnails:
//  * automatically generated thumbnails: a frame of the video
//  * custom thumbnail and landscape (>= 16:10) or audio video: the custom image, it already has the right orientation
//  * custom thumbnail and portrait/square/4:3 video: a frame of the video, because the custom image is landscape

program
  .description('Create thumbnails in the video aspect ratio for existing local videos')
  .option('-v, --video [videoUUID]', 'Process a specific video')
  .option('-a, --all-videos', 'Process all local videos missing these thumbnails')
  .option('-f, --force', 'Also process videos that already have these thumbnails')
  .option('-l, --limit [count]', 'Process at most this number of videos', parseInt)
  .option('-d, --dry-run', 'Only count what would be done')
  .parse(process.argv)

const options = program.opts()

if (!options['video'] && !options['allVideos']) {
  console.error('You need to choose videos to process (--video or --all-videos).')
  process.exit(-1)
}

const originalSizes = CONFIG.THUMBNAILS.SIZES.filter(s => s.aspectRatio === 'original')

const stats = {
  alreadyDone: 0,
  auto: 0,
  customKept: 0,
  customReplacedByFrame: 0,
  errors: 0
}

run()
  .then(() => {
    console.log('Summary: %s', JSON.stringify(stats))
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  if (originalSizes.length === 0) {
    throw new Error('No thumbnail size with aspect_ratio "original" in the configuration')
  }

  await initDatabaseModels(true)
  JobQueue.Instance.init()

  let ids: number[]

  if (options['video']) {
    const video = await VideoModel.load(toCompleteUUID(options['video']))
    if (!video || video.remote) throw new Error('Unknown or remote video ' + options['video'])

    ids = [ video.id ]
  } else {
    ids = await VideoModel.listLocalIds()
  }

  let processed = 0

  // Sequential on purpose: frame extraction is CPU heavy, the script is meant to run off-peak
  for (const id of ids) {
    if (options['limit'] && processed >= options['limit']) break

    try {
      if (await processVideo(id)) processed++
    } catch (err) {
      stats.errors++
      console.error('Cannot process video %d.', id, err)
    }
  }
}

async function processVideo (id: number) {
  const video = await VideoModel.loadFull(id)
  if (!video || video.isLive) return false

  if (!options['force'] && video.Thumbnails.some(t => t.aspectRatio === 'original')) {
    stats.alreadyDone++
    return false
  }

  // Biggest custom thumbnail, if any
  const custom = video.Thumbnails
    .filter(t => t.automaticallyGenerated === false && t.aspectRatio === '16:9')
    .sort((a, b) => b.width - a.width)[0]
  const videoFile = video.getMaxQualityFile(VideoFileStream.VIDEO)
  const useCustomImage = custom && (!videoFile || (video.aspectRatio && video.aspectRatio >= 1.6))

  if (!custom) stats.auto++
  else if (useCustomImage) stats.customKept++
  else stats.customReplacedByFrame++

  console.log('%s video %s (%s): %s', options['dryRun'] ? 'Would process' : 'Processing', video.uuid, video.name,
    !custom ? 'frame' : useCustomImage ? 'custom image' : 'frame instead of landscape custom image')

  if (options['dryRun']) return true

  let newThumbnails: MThumbnail[]

  if (useCustomImage) {
    newThumbnails = await createFromImage(video, custom)
  } else if (videoFile) {
    newThumbnails = await createLocalVideoThumbnailsFromVideo({ video, videoFile, ffprobe: undefined, sizes: originalSizes })
  } else {
    // Audio file without custom thumbnail: the default audio background is used
    const audioFile = video.getMaxQualityFile(VideoFileStream.AUDIO)
    newThumbnails = await createLocalVideoThumbnailsFromVideo({ video, videoFile: audioFile, ffprobe: undefined, sizes: originalSizes })
  }

  const kept = video.Thumbnails.filter(t => t.aspectRatio !== 'original')
  const oldOriginals = video.Thumbnails.filter(t => t.aspectRatio === 'original')

  await video.replaceAndSaveThumbnails([ ...kept, ...newThumbnails ])

  for (const old of oldOriginals) {
    await old.removeFile()
  }

  await federateVideoIfNeeded(video, false)

  return true
}

async function createFromImage (video: MVideoFull, source: MThumbnail) {
  if (!await pathExists(source.getFSPath())) {
    throw new Error(`Thumbnail ${source.getFSPath()} does not exist on disk`)
  }

  const result: MThumbnail[] = []

  for (const configSize of originalSizes) {
    const size = buildThumbnailSize(configSize, video.aspectRatio)

    const thumbnail = new ThumbnailModel({
      filename: generateImageFilename(),
      height: size.height,
      width: size.width,
      aspectRatio: size.aspectRatio,
      fileUrl: null,
      automaticallyGenerated: false,
      cached: false
    })

    await processImage({ path: source.getFSPath(), destination: thumbnail.getFSPath(), newSize: size, keepOriginal: true })

    result.push(thumbnail)
  }

  return result
}
