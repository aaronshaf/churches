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

  async analyzeSermon(transcript: string): Promise<SermonAnalysis> {
    const prompt = this.buildSermonAnalysisPrompt(transcript);

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

  private buildSermonAnalysisPrompt(transcript: string): string {
    return `Please analyze this church sermon transcript and provide:

1. An appropriate sermon title (concise, descriptive, appropriate for a church website)
2. The main Bible passage that was preached on (if clearly identifiable)

IMPORTANT: 
- Focus only on the sermon portion, ignore announcements, singing, or other non-sermon content
- If no clear Bible passage is referenced, respond with "None identified"
- Keep the title under 80 characters
- Use proper Bible passage format (e.g., "Matthew 5:1-12", "Psalm 23", "Romans 8:28-39")

Transcript:
${transcript}

Please respond in this exact JSON format:
{
  "title": "Generated sermon title here",
  "passage": "Main Bible passage or 'None identified'",
  "confidence": 0.85
}`;
  }

  private parseAnalysisResponse(response: string): SermonAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        aiGeneratedTitle: parsed.title || 'Untitled Sermon',
        mainBiblePassage: parsed.passage === 'None identified' ? null : parsed.passage,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      // Fallback parsing if JSON fails
      console.error('Failed to parse AI response:', error);
      return {
        aiGeneratedTitle: 'Sermon Analysis Failed',
        mainBiblePassage: null,
        confidence: 0.0,
      };
    }
  }
}
