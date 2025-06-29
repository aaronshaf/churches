import TurndownService from 'turndown';
import OpenAI from 'openai';

const EXTRACTION_PROMPT = `From this church website text, extract the following information and return ONLY valid JSON:

1) Phone number (if found)
2) Physical address (if found)
3) Service times as an array of strings. Format each time as just the time for Sunday services (e.g. '10:00 AM'), but include day for non-Sunday services (e.g. '6:30 PM (Wednesday)'). Include special service names like 'Sunday School', 'Prayer Service', etc. if mentioned.
4) Social media URLs: instagram, facebook, spotify, youtube (if found)

Only include properties that are found. Use these exact keys: phone, address, service_times, instagram, facebook, spotify, youtube

Example format:
{
  "address": "123 Main St, City, State 12345",
  "service_times": ["10:00 AM", "6:30 PM (Wednesday)", "Sunday School 9:00 AM"],
  "facebook": "https://facebook.com/...",
  "instagram": "https://instagram.com/..."
}`;

export interface ExtractedChurchData {
  phone?: string;
  address?: string;
  service_times?: string[];
  instagram?: string;
  facebook?: string;
  spotify?: string;
  youtube?: string;
}

export async function extractChurchDataFromWebsite(
  websiteUrl: string,
  apiKey: string
): Promise<ExtractedChurchData> {
  try {
    // Fetch the website content
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      headingStyle: 'atx',
    });

    // Remove script and style elements
    turndownService.remove(['script', 'style', 'noscript']);

    const markdown = turndownService.turndown(html);

    // Limit the content to prevent token overflow
    const truncatedMarkdown = markdown.slice(0, 15000);

    // Initialize OpenRouter client
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });

    // Send to DeepSeek for extraction
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nWebsite content:\n${truncatedMarkdown}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from AI');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                      responseContent.match(/({[\s\S]*})/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1];
    const extractedData = JSON.parse(jsonStr) as ExtractedChurchData;

    // Validate and clean the data
    const cleanedData: ExtractedChurchData = {};

    if (extractedData.phone && typeof extractedData.phone === 'string') {
      cleanedData.phone = extractedData.phone.trim();
    }

    if (extractedData.address && typeof extractedData.address === 'string') {
      cleanedData.address = extractedData.address.trim();
    }

    if (Array.isArray(extractedData.service_times)) {
      cleanedData.service_times = extractedData.service_times
        .filter((time): time is string => typeof time === 'string' && time.trim() !== '')
        .map(time => time.trim());
    }

    // Validate and clean social media URLs
    const socialMediaKeys = ['instagram', 'facebook', 'spotify', 'youtube'] as const;
    for (const key of socialMediaKeys) {
      const url = extractedData[key];
      if (url && typeof url === 'string') {
        try {
          new URL(url); // Validate URL
          cleanedData[key] = url.trim();
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return cleanedData;
  } catch (error) {
    console.error('Extraction error:', error);
    throw new Error(`Failed to extract church data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to format service times into the gatherings format
export function formatServiceTimesForGatherings(serviceTimes: string[]): Array<{
  day: string;
  time: string;
  type: string;
}> {
  const gatherings: Array<{ day: string; time: string; type: string }> = [];

  for (const serviceTime of serviceTimes) {
    // Check if it includes a day in parentheses
    const dayMatch = serviceTime.match(/\((Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\)/i);
    
    if (dayMatch) {
      // Non-Sunday service
      const day = dayMatch[1];
      const time = serviceTime.replace(dayMatch[0], '').trim();
      gatherings.push({
        day,
        time,
        type: 'Service',
      });
    } else if (serviceTime.toLowerCase().includes('sunday school')) {
      // Sunday School
      const time = serviceTime.replace(/sunday school/i, '').trim();
      gatherings.push({
        day: 'Sunday',
        time,
        type: 'Sunday School',
      });
    } else {
      // Regular Sunday service
      gatherings.push({
        day: 'Sunday',
        time: serviceTime,
        type: 'Service',
      });
    }
  }

  return gatherings;
}