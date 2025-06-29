import OpenAI from 'openai';
import { convert } from 'html-to-text';
import { z } from 'zod';

const EXTRACTION_PROMPT = `From this church website text, extract the following information and return ONLY valid JSON:

1) Phone number - Format as "(XXX) XXX-XXXX" with space after area code (e.g., "(801) 295-9439")
2) Email address (if found) - Must be a valid email format
3) Physical address (if found)
4) Service times as an array of objects with 'time' and optional 'notes':
   - Time MUST be an actual clock time with AM/PM (e.g., "10:00 AM", "6:30 PM")
   - Do NOT use descriptive times like "First Sunday of month" - extract the actual time
   - Include day for non-Sunday services (e.g., "6:30 PM (Wednesday)")
   - Notes should be in normal sentence case, NOT ALL CAPS
   - Fix any ALL CAPS text to normal capitalization (e.g., "CONTEMPORARY SERVICE" → "Contemporary service")
5) Social media URLs: instagram, facebook, spotify, youtube - ONLY include if they are specific to this church (not just generic social media homepages)
6) Statement of Faith URL - Look for links/pages titled "Statement of Faith", "What We Believe", "Our Beliefs", "Doctrinal Statement", etc.

Only include properties that are found. Use these exact keys: phone, email, address, service_times, instagram, facebook, spotify, youtube, statement_of_faith_url

Example format:
{
  "phone": "(801) 555-1234",
  "email": "info@churchname.org",
  "address": "123 Main St, City, State 12345",
  "service_times": [
    {"time": "9:00 AM", "notes": "Traditional service"},
    {"time": "11:00 AM", "notes": "Contemporary service with children's ministry"},
    {"time": "6:30 PM (Wednesday)", "notes": "Prayer meeting and Bible study"}
  ],
  "facebook": "https://facebook.com/churchname",
  "instagram": "https://instagram.com/churchhandle",
  "statement_of_faith_url": "https://churchname.org/what-we-believe"
}`;

// Zod schemas for validation
const serviceTimeSchema = z.object({
  time: z.string().regex(/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)(\s*\([^)]+\))?$/),
  notes: z.string().optional(),
});

const extractedChurchDataSchema = z.object({
  phone: z.string().regex(/^\(\d{3}\)\s\d{3}-\d{4}$/).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  service_times: z.array(serviceTimeSchema).optional(),
  instagram: z.string().url().optional(),
  facebook: z.string().url().optional(),
  spotify: z.string().url().optional(),
  youtube: z.string().url().optional(),
  statement_of_faith_url: z.string().url().optional(),
});

export type ServiceTime = z.infer<typeof serviceTimeSchema>;
export type ExtractedChurchData = z.infer<typeof extractedChurchDataSchema>;

// Helper function to parse time for sorting
function parseTimeForSort(timeStr: string): number {
  // Extract time and period (AM/PM)
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
  if (!match) return 0;
  
  let [_, hours, minutes, period] = match;
  let hour = parseInt(hours);
  const minute = parseInt(minutes);
  
  // Convert to 24-hour format for sorting
  if (period.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }
  
  // Check if it's a weekday service (has day in parentheses)
  const dayMatch = timeStr.match(/\((Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\)/i);
  const dayOffset = dayMatch ? 10000 : 0; // Weekday services sort after Sunday
  
  return dayOffset + (hour * 60 + minute);
}

// Sort service times by time of day
function sortServiceTimes(times: ServiceTime[]): ServiceTime[] {
  return times.sort((a, b) => parseTimeForSort(a.time) - parseTimeForSort(b.time));
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
    const rawData = JSON.parse(jsonStr);

    // Pre-process data before validation
    const processedData: any = { ...rawData };

    // Fix phone formatting if needed
    if (processedData.phone && typeof processedData.phone === 'string') {
      let phone = processedData.phone.trim();
      
      // Handle formats like (801)295-9439 -> (801) 295-9439
      phone = phone.replace(/\((\d{3})\)(\d{3})/, '($1) $2');
      
      // Handle formats without parentheses: 8012959439 -> (801) 295-9439
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        phone = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      }
      
      processedData.phone = phone;
    }

    // Normalize email to lowercase
    if (processedData.email && typeof processedData.email === 'string') {
      processedData.email = processedData.email.trim().toLowerCase();
    }

    // Process service times
    if (Array.isArray(processedData.service_times)) {
      processedData.service_times = processedData.service_times
        .map((item: any) => {
          // Handle string format
          if (typeof item === 'string') {
            return { time: item.trim() };
          }
          
          // Handle object format
          if (typeof item === 'object' && item !== null && 'time' in item) {
            // Normalize notes capitalization
            let notes = item.notes ? item.notes.trim() : undefined;
            if (notes) {
              // Convert ALL CAPS to sentence case
              if (notes === notes.toUpperCase() && notes.length > 3) {
                notes = notes.charAt(0).toUpperCase() + notes.slice(1).toLowerCase();
              }
              // Fix common patterns
              notes = notes
                .replace(/\bCHILDREN'S\b/gi, "Children's")
                .replace(/\bBIBLE\b/gi, "Bible")
                .replace(/\bSUNDAY SCHOOL\b/gi, "Sunday School");
            }
            
            return {
              time: item.time.trim(),
              notes: notes
            };
          }
          
          return null;
        })
        .filter((item: any) => item !== null);
    }

    // Filter out generic social media URLs
    const socialMediaKeys = ['instagram', 'facebook', 'spotify', 'youtube'] as const;
    for (const key of socialMediaKeys) {
      const url = processedData[key];
      if (url && typeof url === 'string') {
        const cleanUrl = url.trim();
        
        // Reject generic social media homepages
        const genericPatterns = {
          instagram: /^https?:\/\/(www\.)?instagram\.com\/?$/,
          facebook: /^https?:\/\/(www\.)?facebook\.com\/?$/,
          youtube: /^https?:\/\/(www\.)?youtube\.com\/?$/,
          spotify: /^https?:\/\/(open\.)?spotify\.com\/?$/,
        };
        
        if (genericPatterns[key]?.test(cleanUrl)) {
          delete processedData[key];
        }
      }
    }

    // Parse and validate with Zod
    const parseResult = extractedChurchDataSchema.safeParse(processedData);
    
    if (!parseResult.success) {
      console.warn('Validation errors:', parseResult.error.issues);
      // Return partial data that was valid
      const partialData: ExtractedChurchData = {};
      
      // Try to salvage valid fields
      for (const [key, value] of Object.entries(processedData)) {
        const fieldSchema = extractedChurchDataSchema.shape[key as keyof typeof extractedChurchDataSchema.shape];
        if (fieldSchema) {
          const fieldResult = fieldSchema.safeParse(value);
          if (fieldResult.success) {
            (partialData as any)[key] = fieldResult.data;
          }
        }
      }
      
      // Sort service times if present
      if (partialData.service_times) {
        partialData.service_times = sortServiceTimes(partialData.service_times);
      }
      
      return partialData;
    }

    // Sort service times
    if (parseResult.data.service_times) {
      parseResult.data.service_times = sortServiceTimes(parseResult.data.service_times);
    }

    return parseResult.data;
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
  // Already sorted by extraction process
  return serviceTimes.map(service => ({
    time: service.time,
    notes: service.notes
  }));
}