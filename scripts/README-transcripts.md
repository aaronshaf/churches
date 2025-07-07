# Church YouTube Transcript Downloader

This script downloads transcripts from church YouTube channels using `yt-dlp`.

## Features

- Fetches church data from the public JSON API (`https://utahchurches.com/churches.json`)
- Processes only **Listed** and **Unlisted** churches with YouTube channels
- Downloads transcripts for videos/livestreams from the **last 7 days**
- Creates deterministic filenames: `{church-path}_{video-id}_{video-title}.txt`
- Skips already downloaded transcripts
- Respectful rate limiting (1 second between downloads)

## Requirements

### 1. Install yt-dlp
```bash
# Option 1: pip
pip install yt-dlp

# Option 2: Homebrew (macOS)
brew install yt-dlp

# Option 3: Direct download
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
```

### 2. Verify installation
```bash
yt-dlp --version
```

## Usage

```bash
# Run from project root
bun scripts/download-church-transcripts.ts
```

## Output

Transcripts are saved to `./transcripts/` directory with filenames like:
- `alpine-church-layton_dQw4w9WgXcQ_sunday-morning-service.txt`
- `grace-community-church_abc123xyz_wednesday-bible-study.txt`

## Configuration

Edit the script to customize:
- `DAYS_BACK`: Number of days to look back (default: 7)
- `MAX_VIDEOS_PER_CHANNEL`: Limit videos per channel (default: 10)
- `TRANSCRIPT_DIR`: Output directory (default: `./transcripts`)

## Example Output

```
🎥 Church YouTube Transcript Downloader
========================================

✅ yt-dlp version: 2023.12.30

📡 Fetching churches from: https://utahchurches.com/churches.json
✅ Fetched 295 churches
🔍 Filtering churches with YouTube channels...
📊 Found 47 churches with YouTube channels

🔍 Processing: All Saints Reformed Church
   YouTube: https://www.youtube.com/@allsaintsSG
   📋 Getting videos from last 7 days...
   📹 Found 2 recent video(s)
   ⬇️  Downloading transcript: Sunday Morning Worship Service...
   ✅ Saved: all-saints-reformed-church_dQw4w9WgXcQ_sunday-morning-worship-service.txt
   [1/47] ✅ Completed: All Saints Reformed Church
```

## Troubleshooting

### yt-dlp not found
- Ensure yt-dlp is installed and in your PATH
- Try the installation commands above

### No transcripts downloaded
- YouTube may not have auto-generated captions for all videos
- Some channels may have disabled transcripts
- Videos older than 7 days are skipped by default

### Rate limiting
- The script includes 1-second delays between downloads
- If you hit rate limits, increase the delay in the script

## Notes

- Only downloads transcript files, not video content
- Supports auto-generated and manual captions
- Prefers English captions (`en`, `en-US`)
- Skips videos without available transcripts
- Creates transcript directory automatically