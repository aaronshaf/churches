#!/usr/bin/env bun

/**
 * Church YouTube Transcript Downloader
 *
 * This script downloads transcripts from church YouTube channels using yt-dlp.
 * It fetches church data from the public JSON API, finds YouTube channels,
 * and downloads transcripts for videos/livestreams from the last week.
 *
 * Usage: bun scripts/download-church-transcripts.ts
 *
 * Requirements:
 * - yt-dlp installed: https://github.com/yt-dlp/yt-dlp
 * - Install via: pip install yt-dlp OR brew install yt-dlp
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Configuration
const CHURCHES_JSON_URL = 'https://utahchurches.com/churches.json';
const TRANSCRIPT_DIR = './transcripts';
const DAYS_BACK = 7; // Download transcripts from last 7 days
const MAX_VIDEOS_PER_CHANNEL = 10; // Limit videos per channel

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
 * Ensure transcript directory exists
 */
async function ensureTranscriptDir() {
  try {
    await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
    console.log(`📁 Transcript directory: ${TRANSCRIPT_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create transcript directory:', error);
    process.exit(1);
  }
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

  return `${sanitizedChurchPath}_${videoId}_${sanitizedTitle}.txt`;
}

/**
 * Run yt-dlp command and return promise
 */
function runYtDlp(args: string[]): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', args);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output,
        error: code !== 0 ? errorOutput : undefined,
      });
    });
  });
}

/**
 * Download transcripts for a single church's YouTube channel
 */
async function downloadChurchTranscripts(church: ChurchData): Promise<void> {
  if (!church.youtube) {
    console.log(`⏭️  ${church.name}: No YouTube channel`);
    return;
  }

  console.log(`\n🔍 Processing: ${church.name}`);
  console.log(`   YouTube: ${church.youtube}`);

  const channelId = extractChannelIdentifier(church.youtube);
  if (!channelId) {
    console.log(`❌ Invalid YouTube URL format: ${church.youtube}`);
    return;
  }

  // Calculate date filter for last week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_BACK);
  const dateFilter = oneWeekAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

  // First, get video list from the last week
  console.log(`   📋 Getting videos from last ${DAYS_BACK} days...`);

  const listArgs = [
    '--flat-playlist',
    '--print',
    '%(id)s %(title)s %(upload_date)s',
    '--dateafter',
    dateFilter,
    '--playlist-end',
    MAX_VIDEOS_PER_CHANNEL.toString(),
    channelId.startsWith('@')
      ? `https://www.youtube.com/${channelId}/videos`
      : channelId.startsWith('UC')
        ? `https://www.youtube.com/channel/${channelId}/videos`
        : `https://www.youtube.com/c/${channelId}/videos`,
  ];

  const listResult = await runYtDlp(listArgs);

  if (!listResult.success) {
    console.log(`❌ Failed to get video list: ${listResult.error}`);
    return;
  }

  const videoLines = listResult.output
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  if (videoLines.length === 0) {
    console.log(`   📭 No recent videos found`);
    return;
  }

  console.log(`   📹 Found ${videoLines.length} recent video(s)`);

  // Process each video
  for (const videoLine of videoLines) {
    const parts = videoLine.trim().split(' ');
    if (parts.length < 3) continue;

    const videoId = parts[0];
    const _uploadDate = parts[parts.length - 1]; // Last part is date
    const videoTitle = parts.slice(1, -1).join(' '); // Everything between ID and date

    const filename = generateTranscriptFilename(church.path, videoId, videoTitle);
    const filepath = path.join(TRANSCRIPT_DIR, filename);

    // Check if transcript already exists
    try {
      await fs.access(filepath);
      console.log(`   ⏭️  Already exists: ${filename}`);
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
      'txt',
      '--output',
      filepath.replace('.txt', '.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const transcriptResult = await runYtDlp(transcriptArgs);

    if (transcriptResult.success) {
      // yt-dlp creates files with different extensions, find the actual transcript file
      const possibleExtensions = ['.en.txt', '.en-US.txt', '.txt'];
      let foundTranscript = false;

      for (const ext of possibleExtensions) {
        const possiblePath = filepath.replace('.txt', ext);
        try {
          await fs.access(possiblePath);
          // Rename to our standard format
          await fs.rename(possiblePath, filepath);
          foundTranscript = true;
          break;
        } catch {}
      }

      if (foundTranscript) {
        console.log(`   ✅ Saved: ${filename}`);
      } else {
        console.log(`   ⚠️  Transcript downloaded but file not found: ${videoTitle.substring(0, 30)}...`);
      }
    } else {
      console.log(`   ❌ Failed to download transcript: ${transcriptResult.error?.substring(0, 100)}...`);
    }

    // Small delay to be respectful to YouTube
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
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
  await ensureTranscriptDir();
  const allChurches = await fetchChurches();

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

  // Process each church
  let processed = 0;
  let succeeded = 0;

  for (const church of churchesWithYoutube) {
    processed++;
    try {
      await downloadChurchTranscripts(church);
      succeeded++;
      console.log(`   [${processed}/${churchesWithYoutube.length}] ✅ Completed: ${church.name}`);
    } catch (error) {
      console.log(`   [${processed}/${churchesWithYoutube.length}] ❌ Error processing ${church.name}:`, error);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Processed: ${processed} churches`);
  console.log(`   Succeeded: ${succeeded} churches`);
  console.log(`   Failed: ${processed - succeeded} churches`);
  console.log(`   Transcript directory: ${TRANSCRIPT_DIR}`);
}

// Run the script
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}
