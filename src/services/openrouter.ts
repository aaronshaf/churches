import yaml from 'js-yaml';

export interface SermonAnalysis {
  aiGeneratedTitle: string;
  mainBiblePassage: string | null;
  confidence: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeSermonMetadata(title: string, description: string, publishedAt: string): Promise<SermonAnalysis> {
    const prompt = this.buildSermonMetadataAnalysisPrompt(title, description, publishedAt);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://utahchurches.com',
        'X-Title': 'Utah Churches - Sermon Analysis',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet', // Good balance of quality and cost
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more consistent results
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    return this.parseAnalysisResponse(data.choices[0].message.content);
  }

  private buildSermonMetadataAnalysisPrompt(title: string, description: string, publishedAt: string): string {
    const uploadDate = new Date(publishedAt).toLocaleDateString();
    return `Please analyze this church sermon video metadata and provide:

1. An improved sermon title (clean, descriptive, appropriate for a church website)
2. The main Bible passage referenced (if identifiable from title/description)

IMPORTANT: 
- Clean up the title by removing date info, series info, and video artifacts
- Extract the core sermon topic/theme
- If no clear Bible passage is referenced, respond with "None identified"
- Keep the title under 80 characters
- Use proper Bible passage format (e.g., "Matthew 5:1-12", "Psalm 23", "Romans 8:28-39")

Video Metadata:
Title: ${title}
Description: ${description}
Uploaded: ${uploadDate}

IMPORTANT: Respond with ONLY valid YAML, no additional text:

title: Cleaned sermon title here
passage: Main Bible passage or 'None identified'
confidence: 0.75`;
  }

  private parseAnalysisResponse(response: string): SermonAnalysis {
    console.log('Raw AI response:', response);

    try {
      // Parse YAML response
      const parsed = yaml.load(response) as { title?: string; passage?: string; confidence?: number };

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid YAML structure');
      }

      return {
        aiGeneratedTitle: parsed.title || 'Untitled Sermon',
        mainBiblePassage: parsed.passage === 'None identified' ? null : parsed.passage || null,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      // Fallback parsing if YAML fails - try to extract title manually
      console.error('Failed to parse AI YAML response:', error);
      console.error('Response content:', response);

      // Try to extract a basic title from the response text
      let fallbackTitle = 'Sermon Analysis Failed';
      const titleMatch = response.match(/title:\s*(.+?)$/im);
      if (titleMatch) {
        fallbackTitle = titleMatch[1].trim().replace(/["']/g, '');
      }

      return {
        aiGeneratedTitle: fallbackTitle,
        mainBiblePassage: null,
        confidence: 0.0,
      };
    }
  }
}
