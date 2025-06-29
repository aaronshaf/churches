import OpenAI from 'openai';
import { convert } from 'html-to-text';

const EXTRACTION_PROMPT = `From this church website text, extract the following information and return ONLY valid JSON:

1) Phone number (if found)
2) Physical address (if found)
3) Service times as an array of objects with 'time' and optional 'notes'. Format times as just the time for Sunday services (e.g. '10:00 AM'), but include day for non-Sunday services (e.g. '6:30 PM (Wednesday)'). Notes can include things like 'Sunday School', 'Prayer Service', 'Children's ministry available', etc.
4) Social media URLs: instagram, facebook, spotify, youtube - ONLY include if they are specific to this church (not just generic social media homepages)

Only include properties that are found. Use these exact keys: phone, address, service_times, instagram, facebook, spotify, youtube

Example format:
{
  "address": "123 Main St, City, State 12345",
  "service_times": [
    {"time": "10:00 AM", "notes": "Traditional Service"},
    {"time": "11:30 AM", "notes": "Contemporary Service with children's ministry"},
    {"time": "6:30 PM (Wednesday)", "notes": "Prayer Service"}
  ],
  "facebook": "https://facebook.com/churchname",
  "instagram": "https://instagram.com/churchhandle"
}`;

export interface ServiceTime {
  time: string;
  notes?: string;
}

export interface ExtractedChurchData {
  phone?: string;
  address?: string;
  service_times?: ServiceTime[];
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

    // Convert HTML to text using html-to-text package
    // With Gemini's 1M context, we can process much more content
    const textContent = convert(html.slice(0, 500000), { // Allow up to 500k HTML
      wordwrap: false,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } }
        // Don't skip nav/header/footer with Gemini - they might contain service times
      ],
      limits: {
        maxInputLength: 500000,
        ellipsis: '...'
      }
    }).slice(0, 100000); // Allow up to 100k chars for Gemini

    // Initialize OpenRouter client
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });

    // Send to Gemini for extraction
    console.log(`Sending ${textContent.length} characters to Gemini for extraction`);
    
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nWebsite content:\n${textContent}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000, // Increased for more detailed extraction
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
        .filter((item): item is ServiceTime => {
          if (typeof item === 'object' && item !== null && 'time' in item) {
            return typeof item.time === 'string' && item.time.trim() !== '';
          }
          // Handle if AI returns strings instead of objects (backwards compatibility)
          if (typeof item === 'string' && item.trim() !== '') {
            return true;
          }
          return false;
        })
        .map(item => {
          if (typeof item === 'string') {
            return { time: item.trim() };
          }
          return {
            time: item.time.trim(),
            notes: item.notes ? item.notes.trim() : undefined
          };
        });
    }

    // Validate and clean social media URLs
    const socialMediaKeys = ['instagram', 'facebook', 'spotify', 'youtube'] as const;
    for (const key of socialMediaKeys) {
      const url = extractedData[key];
      if (url && typeof url === 'string') {
        try {
          const urlObj = new URL(url);
          const cleanUrl = url.trim();
          
          // Reject generic social media homepages
          const genericPatterns = {
            instagram: /^https?:\/\/(www\.)?instagram\.com\/?$/,
            facebook: /^https?:\/\/(www\.)?facebook\.com\/?$/,
            youtube: /^https?:\/\/(www\.)?youtube\.com\/?$/,
            spotify: /^https?:\/\/(open\.)?spotify\.com\/?$/,
          };
          
          if (!genericPatterns[key]?.test(cleanUrl)) {
            cleanedData[key] = cleanUrl;
          }
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
export function formatServiceTimesForGatherings(serviceTimes: ServiceTime[]): Array<{
  time: string;
  notes?: string;
}> {
  return serviceTimes.map(service => ({
    time: service.time,
    notes: service.notes
  }));
}