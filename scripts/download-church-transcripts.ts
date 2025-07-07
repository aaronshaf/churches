#!/usr/bin/env bun

/**
 * Church YouTube Transcript Downloader
 *
 * This script downloads transcripts from church YouTube channels using yt-dlp.
 * It fetches church data from the public JSON API, finds YouTube channels,
 * and downloads transcripts with metadata stored in YAML format.
 *
 * Usage: bun scripts/download-church-transcripts.ts
 *
 * Requirements:
 * - yt-dlp installed: https://github.com/yt-dlp/yt-dlp
 * - Install via: pip install yt-dlp OR brew install yt-dlp
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

// Configuration
const CHURCHES_JSON_URL = 'https://utahchurches.com/churches.json';
const TRANSCRIPT_BASE_DIR = './transcripts';
const PROGRESS_FILE = './transcripts/progress.json';
const DAYS_BACK = 365; // Download transcripts from past year
const MAX_VIDEOS_PER_CHANNEL = 50; // Limit videos per channel
const MAX_TRANSCRIPTS_PER_RUN = 3; // Global limit per script run - be very respectful
const MIN_DELAY_MS = 3000; // Minimum delay between operations (3 seconds)
const MAX_DELAY_MS = 15000; // Maximum delay between operations (15 seconds)

interface ChurchData {
  id: number;
  name: string;
  path: string;
  youtube: string | null;
  status: string;
}

interface ChurchesResponse {
  total: number;
  churches: ChurchData[];
}

interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  uploadDate: string;
  url: string;
  transcriptFile: string;
  downloadedAt: string;
}

interface ChurchMetadata {
  churchId: number;
  churchName: string;
  churchPath: string;
  lastUpdated: string;
  videos: VideoMetadata[];
}

interface ChurchProgress {
  churchId: number;
  churchName: string;
  lastProcessed: string;
  videosDownloaded: number;
  hasYouTube: boolean;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

interface ProgressTracker {
  version: string;
  lastRun: string;
  totalChurchesProcessed: number;
  totalTranscriptsDownloaded: number;
  churches: ChurchProgress[];
}

/**
 * Fetch churches data from JSON API
 */
async function fetchChurches(): Promise<ChurchData[]> {
  try {
    console.log(`📡 Fetching churches from: ${CHURCHES_JSON_URL}`);
    const response = await fetch(CHURCHES_JSON_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ChurchesResponse = await response.json();
    console.log(`✅ Fetched ${data.total} churches`);

    return data.churches;
  } catch (error) {
    console.error('❌ Failed to fetch churches data:', error);
    throw error;
  }
}

/**
 * Ensure base transcript directory exists
 */
async function ensureBaseDir() {
  try {
    await fs.mkdir(TRANSCRIPT_BASE_DIR, { recursive: true });
    console.log(`📁 Transcript base directory: ${TRANSCRIPT_BASE_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create transcript directory:', error);
    process.exit(1);
  }
}

/**
 * Load progress tracker
 */
async function loadProgress(): Promise<ProgressTracker> {
  try {
    const content = await fs.readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist, return new tracker
    return {
      version: '1.0',
      lastRun: new Date().toISOString(),
      totalChurchesProcessed: 0,
      totalTranscriptsDownloaded: 0,
      churches: [],
    };
  }
}

/**
 * Save progress tracker
 */
async function saveProgress(progress: ProgressTracker): Promise<void> {
  progress.lastRun = new Date().toISOString();
  const jsonContent = JSON.stringify(progress, null, 2);
  await fs.writeFile(PROGRESS_FILE, jsonContent, 'utf-8');
}

/**
 * Generate a random delay between MIN_DELAY_MS and MAX_DELAY_MS
 */
function getRandomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Sleep for a random amount of time
 */
async function randomSleep(context?: string): Promise<void> {
  const delay = getRandomDelay();
  if (context) {
    console.log(`   ⏳ Waiting ${(delay / 1000).toFixed(1)}s ${context}...`);
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Check if we're being rate limited
 */
function isRateLimitError(error: string): boolean {
  const rateLimitIndicators = [
    'ERROR: Sign in to confirm',
    'ERROR: Unable to extract',
    'too many requests',
    'rate limit',
    '429',
    'ERROR: This video is not available',
    'ERROR: Private video',
    'Command timed out',
  ];

  return rateLimitIndicators.some((indicator) => error.toLowerCase().includes(indicator.toLowerCase()));
}

/**
 * Get church directory path
 */
function getChurchDir(churchId: number): string {
  return path.join(TRANSCRIPT_BASE_DIR, `church-${churchId}`);
}

/**
 * Ensure church-specific directory exists
 */
async function ensureChurchDir(churchId: number): Promise<string> {
  const churchDir = getChurchDir(churchId);
  await fs.mkdir(churchDir, { recursive: true });
  return churchDir;
}

/**
 * Load metadata for a specific church
 */
async function loadChurchMetadata(church: ChurchData): Promise<ChurchMetadata> {
  const metadataPath = path.join(getChurchDir(church.id), 'metadata.yaml');
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.load(content) as ChurchMetadata;
  } catch (error) {
    // File doesn't exist or is invalid, return empty metadata
    return {
      churchId: church.id,
      churchName: church.name,
      churchPath: church.path,
      lastUpdated: new Date().toISOString(),
      videos: [],
    };
  }
}

/**
 * Save metadata for a specific church
 */
async function saveChurchMetadata(metadata: ChurchMetadata): Promise<void> {
  metadata.lastUpdated = new Date().toISOString();
  const metadataPath = path.join(getChurchDir(metadata.churchId), 'metadata.yaml');
  const yamlContent = yaml.dump(metadata, {
    indent: 2,
    lineWidth: -1, // Disable line wrapping
    noRefs: true,
  });
  await fs.writeFile(metadataPath, yamlContent, 'utf-8');
}

/**
 * Extract channel ID or handle from YouTube URL
 */
function extractChannelIdentifier(youtubeUrl: string): string | null {
  try {
    const url = new URL(youtubeUrl);

    // Handle various YouTube URL formats:
    // https://www.youtube.com/channel/UCxxxxxxx
    // https://www.youtube.com/@channelhandle
    // https://www.youtube.com/c/channelname
    // https://www.youtube.com/user/username

    if (url.pathname.startsWith('/channel/')) {
      return url.pathname.replace('/channel/', '');
    }

    if (url.pathname.startsWith('/@')) {
      return url.pathname.replace('/@', '@');
    }

    if (url.pathname.startsWith('/c/')) {
      return url.pathname.replace('/c/', '');
    }

    if (url.pathname.startsWith('/user/')) {
      return url.pathname.replace('/user/', '');
    }

    // If it's just the base URL, return the full URL
    return youtubeUrl;
  } catch (_error) {
    console.warn(`⚠️  Invalid YouTube URL: ${youtubeUrl}`);
    return null;
  }
}

/**
 * Generate deterministic filename for transcript
 */
function generateTranscriptFilename(churchPath: string, videoId: string, videoTitle: string): string {
  // Sanitize church path and video title for filesystem
  const sanitizeForFilename = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();

  const sanitizedChurchPath = sanitizeForFilename(churchPath);
  const sanitizedTitle = sanitizeForFilename(videoTitle).substring(0, 50); // Limit length

  return `${sanitizedChurchPath}_${videoId}_${sanitizedTitle}.vtt`;
}

/**
 * Run yt-dlp command and return promise with timeout
 */
function runYtDlp(args: string[]): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', args);

    let output = '';
    let errorOutput = '';
    let timedOut = false;

    // Set timeout of 30 seconds
    const timeout = setTimeout(() => {
      timedOut = true;
      ytdlp.kill('SIGTERM');
      resolve({
        success: false,
        output: output,
        error: 'Command timed out after 30 seconds',
      });
    }, 30000);

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (!timedOut) {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          output: output,
          error: code !== 0 ? errorOutput : undefined,
        });
      }
    });

    ytdlp.on('error', (err) => {
      if (!timedOut) {
        clearTimeout(timeout);
        resolve({
          success: false,
          output: output,
          error: err.message,
        });
      }
    });
  });
}

/**
 * Download transcripts for a single church's YouTube channel
 * Returns the number of transcripts downloaded
 */
async function downloadChurchTranscripts(church: ChurchData, globalDownloadCount: number): Promise<number> {
  if (!church.youtube) {
    console.log(`⏭️  ${church.name}: No YouTube channel`);
    return 0;
  }

  let downloadsInThisChurch = 0;

  console.log(`\n🔍 Processing: ${church.name} (ID: ${church.id})`);
  console.log(`   YouTube: ${church.youtube}`);

  // Ensure church directory exists
  const churchDir = await ensureChurchDir(church.id);

  // Load church-specific metadata
  const metadata = await loadChurchMetadata(church);

  const channelId = extractChannelIdentifier(church.youtube);
  if (!channelId) {
    console.log(`❌ Invalid YouTube URL format: ${church.youtube}`);
    return 0;
  }

  // Calculate date filter for past year
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - DAYS_BACK);
  // Format as YYYYMMDD for yt-dlp
  const year = oneYearAgo.getFullYear();
  const month = String(oneYearAgo.getMonth() + 1).padStart(2, '0');
  const day = String(oneYearAgo.getDate()).padStart(2, '0');
  const dateFilter = `${year}${month}${day}`; // YYYYMMDD format

  // First, get video list from the past year
  console.log(`   📋 Getting videos from last ${DAYS_BACK} days...`);

  // Note: We need to remove --flat-playlist to get full metadata including dates
  const listArgs = [
    '--print',
    '%(id)s|||%(title)s|||%(upload_date)s|||%(description)s',
    '--dateafter',
    dateFilter,
    '--playlist-end',
    MAX_VIDEOS_PER_CHANNEL.toString(),
    '--skip-download',
    channelId.startsWith('@')
      ? `https://www.youtube.com/${channelId}/videos`
      : channelId.startsWith('UC')
        ? `https://www.youtube.com/channel/${channelId}/videos`
        : `https://www.youtube.com/c/${channelId}/videos`,
  ];

  const listResult = await runYtDlp(listArgs);

  if (!listResult.success) {
    if (listResult.error && listResult.error.includes('Command timed out')) {
      console.log(`⏱️  Timeout detected! Stopping to avoid issues.`);
      console.log(`   This may indicate rate limiting or network issues`);
      throw new Error('TIMEOUT_DETECTED');
    }
    if (listResult.error && isRateLimitError(listResult.error)) {
      console.log(`⚠️  Rate limit detected! Stopping to avoid being blocked.`);
      console.log(`   Error: ${listResult.error?.substring(0, 100)}...`);
      throw new Error('RATE_LIMITED');
    }
    console.log(`❌ Failed to get video list: ${listResult.error?.substring(0, 200)}`);
    console.log(`   Skipping this church due to error`);
    return 0;
  }

  const videoLines = listResult.output
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  if (videoLines.length === 0) {
    console.log(`   📭 No recent videos found`);
    return 0;
  }

  console.log(`   📹 Found ${videoLines.length} recent video(s)`);

  // Process each video
  for (const videoLine of videoLines) {
    // Check global limit
    if (globalDownloadCount + downloadsInThisChurch >= MAX_TRANSCRIPTS_PER_RUN) {
      console.log(`   🛑 Reached global limit of ${MAX_TRANSCRIPTS_PER_RUN} transcripts per run`);
      break;
    }

    const parts = videoLine.trim().split('|||');
    if (parts.length < 4) continue;

    const videoId = parts[0];
    const videoTitle = parts[1];
    const uploadDate = parts[2]; // Format: YYYYMMDD
    const description = parts[3] || '';

    // Format upload date as ISO string if valid
    let formattedDate = uploadDate;
    if (uploadDate && uploadDate !== 'NA' && uploadDate.length === 8) {
      const year = uploadDate.substring(0, 4);
      const month = uploadDate.substring(4, 6);
      const day = uploadDate.substring(6, 8);
      formattedDate = `${year}-${month}-${day}`;
    }

    // Check if we already have this video in metadata
    if (metadata.videos.some((v) => v.videoId === videoId)) {
      console.log(`   ⏭️  Already in metadata: ${videoTitle.substring(0, 50)}...`);
      continue;
    }

    const filename = generateTranscriptFilename(church.path, videoId, videoTitle);
    const filepath = path.join(churchDir, filename);

    // Check if transcript file already exists
    try {
      await fs.access(filepath);
      console.log(`   ⏭️  File exists: ${filename}`);
      continue;
    } catch {
      // File doesn't exist, proceed with download
    }

    console.log(`   ⬇️  Downloading transcript: ${videoTitle.substring(0, 50)}...`);

    // Download transcript for this specific video
    const transcriptArgs = [
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en',
      '--skip-download', // Only download transcript, not video
      '--sub-format',
      'vtt',
      '--output',
      filepath.replace('.vtt', '.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const transcriptResult = await runYtDlp(transcriptArgs);

    if (transcriptResult.success) {
      // yt-dlp creates files with different extensions, find the actual transcript file
      const possibleExtensions = ['.en.vtt', '.en-US.vtt', '.vtt'];
      let foundTranscript = false;

      let actualFilepath = '';
      for (const ext of possibleExtensions) {
        const possiblePath = filepath.replace('.vtt', ext);
        try {
          await fs.access(possiblePath);
          // Keep VTT format but update our tracking
          actualFilepath = possiblePath;
          foundTranscript = true;
          break;
        } catch {}
      }

      if (foundTranscript) {
        console.log(`   ✅ Saved: ${filename}`);

        // Add to metadata
        const videoMetadata: VideoMetadata = {
          videoId,
          title: videoTitle,
          description: description.substring(0, 500), // Limit description length
          uploadDate: formattedDate,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          transcriptFile: path.basename(actualFilepath),
          downloadedAt: new Date().toISOString(),
        };

        metadata.videos.push(videoMetadata);
        downloadsInThisChurch++;

        // Save metadata after each successful download
        await saveChurchMetadata(metadata);
      } else {
        console.log(`   ⚠️  Transcript downloaded but file not found: ${videoTitle.substring(0, 30)}...`);
      }
    } else {
      console.log(`   ❌ Failed to download transcript: ${transcriptResult.error?.substring(0, 100)}...`);
    }

    // Random delay to be respectful to YouTube
    await randomSleep('before next download');
  }

  return downloadsInThisChurch;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎥 Church YouTube Transcript Downloader');
  console.log('========================================\n');

  // Check if yt-dlp is installed
  const ytdlpCheck = await runYtDlp(['--version']);
  if (!ytdlpCheck.success) {
    console.error('❌ yt-dlp is not installed or not in PATH');
    console.error('   Install with: pip install yt-dlp');
    console.error('   Or: brew install yt-dlp');
    process.exit(1);
  }

  console.log(`✅ yt-dlp version: ${ytdlpCheck.output.trim()}\n`);

  // Initialize directory and fetch church data
  await ensureBaseDir();
  const allChurches = await fetchChurches();

  // Load progress tracker
  const progress = await loadProgress();
  console.log(
    `📊 Progress: ${progress.totalChurchesProcessed} churches processed, ${progress.totalTranscriptsDownloaded} transcripts downloaded`
  );

  // Filter for Listed and Unlisted churches with YouTube channels
  console.log('🔍 Filtering churches with YouTube channels...');

  const churchesWithYoutube = allChurches.filter(
    (church) =>
      church.youtube && church.youtube.trim() !== '' && (church.status === 'Listed' || church.status === 'Unlisted')
  );

  console.log(`📊 Found ${churchesWithYoutube.length} churches with YouTube channels\n`);

  if (churchesWithYoutube.length === 0) {
    console.log('🤷 No churches found with YouTube channels');
    return;
  }

  // Update progress tracker with all churches
  for (const church of churchesWithYoutube) {
    if (!progress.churches.some((c) => c.churchId === church.id)) {
      progress.churches.push({
        churchId: church.id,
        churchName: church.name,
        lastProcessed: '',
        videosDownloaded: 0,
        hasYouTube: true,
        status: 'pending',
      });
    }
  }

  // Sort churches by ID to ensure consistent order
  const sortedChurches = churchesWithYoutube.sort((a, b) => a.id - b.id);

  // Find churches that haven't been completed yet
  const pendingChurches = sortedChurches.filter((church) => {
    const churchProgress = progress.churches.find((c) => c.churchId === church.id);
    return !churchProgress || churchProgress.status !== 'completed';
  });

  console.log(`📋 ${pendingChurches.length} churches still need processing`);

  // Process each church
  let processed = 0;
  let totalDownloaded = 0;
  let succeeded = 0;
  let rateLimited = false;

  for (const church of pendingChurches) {
    // Check if we've hit the global limit
    if (totalDownloaded >= MAX_TRANSCRIPTS_PER_RUN) {
      console.log(`\n🛑 Reached global limit of ${MAX_TRANSCRIPTS_PER_RUN} transcripts for this run`);
      break;
    }

    processed++;

    // Update progress to mark as in-progress
    const churchProgress = progress.churches.find((c) => c.churchId === church.id);
    if (churchProgress) {
      churchProgress.status = 'in-progress';
      churchProgress.lastProcessed = new Date().toISOString();
    }

    try {
      const downloadsFromThisChurch = await downloadChurchTranscripts(church, totalDownloaded);
      totalDownloaded += downloadsFromThisChurch;

      if (downloadsFromThisChurch > 0) {
        succeeded++;
      }

      // Update progress
      if (churchProgress) {
        if (downloadsFromThisChurch === -1) {
          // Special case for timeout/skip
          churchProgress.status = 'skipped';
        } else {
          churchProgress.videosDownloaded += downloadsFromThisChurch;
          churchProgress.status = downloadsFromThisChurch > 0 ? 'completed' : 'skipped';
          progress.totalTranscriptsDownloaded += downloadsFromThisChurch;
        }
      }

      const statusIcon = downloadsFromThisChurch === -1 ? '⏭️' : downloadsFromThisChurch > 0 ? '✅' : '📭';
      const message =
        downloadsFromThisChurch === -1
          ? 'Skipped due to timeout'
          : `Downloaded ${downloadsFromThisChurch} transcript(s)`;
      console.log(`   [${processed}/${pendingChurches.length}] ${statusIcon} ${message} from: ${church.name}`);

      // Save progress after each church
      await saveProgress(progress);

      // Add delay between churches
      if (processed < pendingChurches.length) {
        await randomSleep('before next church');
      }
    } catch (error: any) {
      if (error.message === 'RATE_LIMITED' || error.message === 'TIMEOUT_DETECTED') {
        rateLimited = true;
        const message =
          error.message === 'TIMEOUT_DETECTED'
            ? '⏱️  Timeout detected - stopping to avoid issues'
            : '🚫 Rate limit detected - stopping to avoid being blocked';
        console.log(`\n${message}`);
        break;
      }
      console.log(
        `   [${processed}/${pendingChurches.length}] ❌ Error processing ${church.name}:`,
        error.message || error
      );

      // Mark as skipped for other errors
      if (churchProgress) {
        churchProgress.status = 'skipped'; // Skip problematic churches
      }
    }
  }

  // Update total churches processed
  progress.totalChurchesProcessed = progress.churches.filter(
    (c) => c.status === 'completed' || c.status === 'skipped'
  ).length;
  await saveProgress(progress);

  console.log('\n📊 Summary:');
  console.log(`   Churches processed this run: ${processed}`);
  console.log(`   Churches with downloads: ${succeeded}`);
  console.log(`   Total transcripts downloaded this run: ${totalDownloaded}`);
  console.log(`   Overall progress: ${progress.totalChurchesProcessed}/${progress.churches.length} churches`);
  console.log(`   Total transcripts collected: ${progress.totalTranscriptsDownloaded}`);

  if (rateLimited) {
    console.log(`\n⚠️  Script stopped due to rate limiting or timeouts. Wait a few hours before running again.`);
  } else if (pendingChurches.length === 0) {
    console.log(`\n✅ All churches have been processed!`);
  } else if (totalDownloaded >= MAX_TRANSCRIPTS_PER_RUN) {
    console.log(`\n💡 Run the script again to continue with the next churches.`);
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
