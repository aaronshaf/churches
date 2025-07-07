export interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  duration: string; // ISO 8601 format
  durationSeconds: number;
  url: string;
}

export interface YouTubeCaption {
  id: string;
  language: string;
  trackKind: 'standard' | 'ASR'; // ASR = auto-generated
}

interface YouTubeApiResponse {
  items?: unknown[];
}

interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    snippet?: {
      channelId: string;
    };
    contentDetails?: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
}

interface YouTubePlaylistResponse {
  items?: Array<{
    snippet: {
      resourceId: {
        videoId: string;
      };
    };
  }>;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      publishedAt: string;
    };
    contentDetails: {
      duration: string;
    };
  }>;
}

interface YouTubeCaptionsResponse {
  items?: Array<{
    id: string;
    snippet: {
      language: string;
      trackKind: string;
    };
  }>;
}

export class YouTubeService {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getChannelId(youtubeUrl: string): Promise<string> {
    // Extract channel ID from various YouTube URL formats
    try {
      const url = new URL(youtubeUrl);

      // Handle @username format: https://www.youtube.com/@username
      if (url.pathname.startsWith('/@')) {
        const username = url.pathname.substring(2);
        return await this.resolveUsernameToChannelId(username);
      }

      // Handle /c/ format: https://www.youtube.com/c/channelname
      if (url.pathname.startsWith('/c/')) {
        const channelName = url.pathname.substring(3);
        return await this.resolveChannelNameToId(channelName);
      }

      // Handle /channel/ format: https://www.youtube.com/channel/UC...
      if (url.pathname.startsWith('/channel/')) {
        return url.pathname.substring(9);
      }

      // Handle /user/ format: https://www.youtube.com/user/username
      if (url.pathname.startsWith('/user/')) {
        const username = url.pathname.substring(6);
        return await this.resolveUsernameToChannelId(username);
      }

      throw new Error('Unsupported YouTube URL format');
    } catch (error) {
      throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
    }
  }

  private async resolveUsernameToChannelId(username: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/channels?part=id&forHandle=${username}&key=${this.apiKey}`);

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as YouTubeApiResponse;
    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found for username: ${username}`);
    }

    return (data.items[0] as { id: string }).id;
  }

  private async resolveChannelNameToId(channelName: string): Promise<string> {
    // For /c/ channels, we need to search
    const response = await fetch(
      `${this.baseUrl}/search?part=snippet&type=channel&q=${encodeURIComponent(channelName)}&key=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as YouTubeApiResponse;
    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found for name: ${channelName}`);
    }

    return (data.items[0] as { snippet: { channelId: string } }).snippet.channelId;
  }

  async getRecentVideos(channelId: string, minDurationMinutes: number = 30): Promise<YouTubeVideo[]> {
    // 1. Get channel's upload playlist ID
    const channelResponse = await fetch(
      `${this.baseUrl}/channels?part=contentDetails&id=${channelId}&key=${this.apiKey}`
    );

    if (!channelResponse.ok) {
      throw new Error(`Failed to get channel info: ${channelResponse.status}`);
    }

    const channelData = (await channelResponse.json()) as YouTubeChannelResponse;
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found');
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists.uploads;
    if (!uploadsPlaylistId) {
      throw new Error('No uploads playlist found');
    }

    // 2. Get recent videos from upload playlist
    const playlistResponse = await fetch(
      `${this.baseUrl}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&order=date&key=${this.apiKey}`
    );

    if (!playlistResponse.ok) {
      throw new Error(`Failed to get playlist items: ${playlistResponse.status}`);
    }

    const playlistData = (await playlistResponse.json()) as YouTubePlaylistResponse;
    if (!playlistData.items || playlistData.items.length === 0) {
      return [];
    }

    // 3. Get video details including duration
    const videoIds = playlistData.items.map((item) => item.snippet.resourceId.videoId);
    const videosResponse = await fetch(
      `${this.baseUrl}/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${this.apiKey}`
    );

    if (!videosResponse.ok) {
      throw new Error(`Failed to get video details: ${videosResponse.status}`);
    }

    const videosData = (await videosResponse.json()) as YouTubeVideosResponse;
    if (!videosData.items) {
      return [];
    }

    // 4. Filter videos by duration (>30 minutes) and return sorted by date
    return videosData.items
      .map((video: any) => this.parseVideo(video))
      .filter((video: YouTubeVideo) => video.durationSeconds >= minDurationMinutes * 60)
      .sort(
        (a: YouTubeVideo, b: YouTubeVideo) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
  }

  async getVideoTranscript(videoId: string): Promise<string> {
    // 1. List available captions
    const captionsResponse = await fetch(`${this.baseUrl}/captions?part=snippet&videoId=${videoId}&key=${this.apiKey}`);

    if (!captionsResponse.ok) {
      throw new Error(`Failed to get captions: ${captionsResponse.status}`);
    }

    const captionsData = (await captionsResponse.json()) as YouTubeCaptionsResponse;
    if (!captionsData.items || captionsData.items.length === 0) {
      throw new Error('No captions available for this video');
    }

    // 2. Find English auto-generated or manual captions
    const englishCaption = captionsData.items.find(
      (cap) =>
        cap.snippet.language === 'en' && (cap.snippet.trackKind === 'ASR' || cap.snippet.trackKind === 'standard')
    );

    if (!englishCaption) {
      throw new Error('No English captions available');
    }

    // 3. Download transcript
    const transcriptResponse = await fetch(`${this.baseUrl}/captions/${englishCaption.id}?tfmt=srt&key=${this.apiKey}`);

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to download transcript: ${transcriptResponse.status}`);
    }

    return await transcriptResponse.text();
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration (PT20M30S) to seconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseVideo(video: NonNullable<YouTubeVideosResponse['items']>[0]): YouTubeVideo {
    return {
      id: video.id,
      title: video.snippet.title,
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      durationSeconds: this.parseDuration(video.contentDetails.duration),
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  }
}
