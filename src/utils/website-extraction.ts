import { convert } from 'html-to-text';
import OpenAI from 'openai';
import { z } from 'zod';

const EXTRACTION_PROMPT = `From this church website text, extract the following information and return it in a SIMPLE TEXT FORMAT (not JSON):

1) Phone number - Format as "(XXX) XXX-XXXX" with space after area code (e.g., "(801) 295-9439")
2) Email address (if found) - Must be a valid email format
3) Physical address (if found) - Use proper title case, not ALL CAPS. Format as "123 Main St, City, State ZIP"
4) Service times - Include actual clock times with AM/PM and very brief notes:
   - Time MUST be an actual clock time with AM/PM (e.g., "10 AM", "10:30 AM", "6:30 PM")
   - Always include a space before AM/PM (e.g., "9 AM" not "9AM")
   - If there are services on multiple days of the week, include the day for ALL services (e.g., "10 AM Sunday", "6:30 PM Wednesday")
   - If all services are on Sunday only, you can omit the day
   - Notes MUST BE EXTREMELY BRIEF - only 2-4 words maximum!
   - ONLY include essential descriptors: "Traditional", "Contemporary", "Bible study", "Morning prayer", "Youth", "Children's ministry"
   - Apostrophes are fine to use (e.g., "Children's ministry")
   - NEVER include full sentences or explanations
5) Social media URLs - ONLY if they are specific to this church
   - ONLY include ACTUAL URLs found in the text EXACTLY as they appear
   - NEVER make up or invent URLs
   - NEVER include placeholder URLs or explanations
   - If you only know they have YouTube/Facebook but no actual URL, skip it entirely
6) Statement of Faith URL - Look for links titled "Statement of Faith", "What We Believe", etc.
   - Include the EXACT URL as found in the text - DO NOT modify the domain name!

Return ONLY the fields you find, using this EXACT format:

PHONE: (801) 555-1234
EMAIL: contact@example.org
ADDRESS: 123 Main St, City, State 12345
SERVICE: 9 AM Sunday | Traditional
SERVICE: 11 AM Sunday | Contemporary
SERVICE: 6:30 PM Wednesday | Bible study
FACEBOOK: https://facebook.com/example
INSTAGRAM: https://instagram.com/example
YOUTUBE: https://youtube.com/channel/example123
SPOTIFY: https://open.spotify.com/show/example123
STATEMENT_OF_FAITH: https://example.org/beliefs

Important:
- Use the exact field names above (PHONE, EMAIL, etc.)
- For SERVICE lines, separate time and notes with a pipe (|) character
- If there are no notes for a service, just include the time
- Skip any fields you cannot find
- Do NOT add any other text or explanations
- NEVER invent URLs - only include exact URLs found in the text
- NEVER modify URLs - copy them EXACTLY as they appear (do not change domain names!)
- If a church mentions they have YouTube but no URL is given, DO NOT include it`;

// Zod schemas for validation
const serviceTimeSchema = z.object({
  time: z.string().regex(/^\d{1,2}(:\d{2})?\s*(AM|PM|am|pm)(\s+\w+)?(\s*\([^)]+\))?$/),
  notes: z.string().optional(),
});

const extractedChurchDataSchema = z.object({
  phone: z
    .string()
    .regex(/^\(\d{3}\)\s\d{3}-\d{4}$/)
    .optional(),
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

// Helper function to normalize time format (e.g., "9AM" -> "9 AM", "9:00am" -> "9:00 AM")
function normalizeTimeFormat(timeStr: string): string {
  // First, trim any whitespace
  const normalized = timeStr.trim();

  // Match time patterns: 9AM, 9:30AM, 9 am, 9:30 pm, etc.
  const match = normalized.match(/^(\d{1,2})(:\d{2})?\s*(AM|PM|am|pm)/);
  if (!match) return timeStr; // Return original if no match

  const [_, hours, minutes, period] = match;
  const normalizedPeriod = period.toUpperCase();

  // Build normalized time with space before AM/PM
  const timeBase = hours + (minutes || '');

  // Check if there's additional content after the time (like day in parentheses)
  const restMatch = normalized.match(/^(\d{1,2})(:\d{2})?\s*(AM|PM|am|pm)(.*)$/);
  const rest = restMatch ? restMatch[4] : '';

  return `${timeBase} ${normalizedPeriod}${rest}`;
}


// Helper function to parse time for sorting
function parseTimeForSort(timeStr: string): number {
  // Extract time and period (AM/PM)
  const match = timeStr.match(/(\d{1,2})(:\d{2})?\s*(AM|PM|am|pm)/i);
  if (!match) return 0;

  const [_, hours, minutes, period] = match;
  let hour = parseInt(hours);
  const minute = minutes ? parseInt(minutes.slice(1)) : 0; // Remove colon if present

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

// Normalize address casing and formatting
function normalizeAddress(address: string): string {
  // First, trim and handle basic formatting
  let normalized = address.trim();

  // Add comma before state if missing (e.g., "NORTH SALT LAKE UT" -> "NORTH SALT LAKE, UT")
  // But only if there's no comma already before the state
  if (!normalized.match(/,\s*[A-Z]{2}\s+\d{5}/i)) {
    normalized = normalized.replace(
      /\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+(\d{5}(-\d{4})?)$/i,
      ', $1 $2'
    );
  }

  // Split by comma to handle each part
  const parts = normalized.split(',').map((part) => part.trim()).filter(part => part.length > 0);

  // Process each part
  const processedParts = parts.map((part, index) => {
    // Last part is usually state and zip, keep uppercase for state
    if (index === parts.length - 1 && /^[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(part)) {
      return part;
    }

    // Convert to title case but preserve certain patterns
    return part
      .split(/\s+/)
      .map((word) => {
        // Keep numbers as-is
        if (/^\d/.test(word)) return word;

        // Handle abbreviations (N., S., E., W., ST., AVE., etc.)
        if (/^(N|S|E|W|NE|NW|SE|SW|ST|AVE|BLVD|DR|RD|LN|CT|PL|PKWY|HWY)\.?$/i.test(word)) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase().replace(/\.$/, '');
        }

        // Handle PO Box
        if (/^(PO|P\.O\.)$/i.test(word)) return 'PO';
        if (/^BOX$/i.test(word)) return 'Box';

        // Handle ordinals (1ST, 2ND, 3RD, 4TH, etc.)
        if (/^\d+(ST|ND|RD|TH)$/i.test(word)) {
          return word.toLowerCase();
        }

        // Title case for regular words
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  });

  // Rejoin with commas
  return processedParts.join(', ');
}

export async function extractChurchDataFromWebsite(websiteUrl: string, apiKey: string): Promise<ExtractedChurchData> {
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
    const textContent = convert(html.slice(0, 500000), {
      // Allow up to 500k HTML
      wordwrap: false,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: false, hideLinkHrefIfSameAsText: false } },
        // Don't skip nav/header/footer with Gemini - they might contain service times
      ],
      limits: {
        maxInputLength: 500000,
        ellipsis: '...',
      },
    }).slice(0, 100000); // Allow up to 100k chars for Gemini

    // Initialize OpenRouter client
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });

    // Send to Gemini for extraction
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash-lite-preview-06-17',
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nWebsite content:\n${textContent}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from AI');
    }


    // Parse the text format response
    const rawData: any = {};
    const lines = responseContent.trim().split('\n');
    
    const serviceTimes: Array<{ time: string; notes?: string }> = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes(':')) continue;
      
      const [field, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim(); // Rejoin in case URL contains colons
      
      switch (field.toUpperCase()) {
        case 'PHONE':
          rawData.phone = value;
          break;
        case 'EMAIL':
          rawData.email = value;
          break;
        case 'ADDRESS':
          rawData.address = value;
          break;
        case 'SERVICE':
          // Parse service time format: "9 AM | Traditional"
          const [time, notes] = value.split('|').map(s => s.trim());
          if (time) {
            const serviceObj: { time: string; notes?: string } = { time };
            if (notes) {
              serviceObj.notes = notes;
            }
            serviceTimes.push(serviceObj);
          }
          break;
        case 'FACEBOOK':
          rawData.facebook = value;
          break;
        case 'INSTAGRAM':
          rawData.instagram = value;
          break;
        case 'YOUTUBE':
          rawData.youtube = value;
          break;
        case 'SPOTIFY':
          rawData.spotify = value;
          break;
        case 'STATEMENT_OF_FAITH':
          rawData.statement_of_faith_url = value;
          break;
      }
    }
    
    if (serviceTimes.length > 0) {
      rawData.service_times = serviceTimes;
    }

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

      // Filter out fake phone numbers
      const fakeNumbers = [
        '(555) 555-5555',
        '(123) 456-7890',
        '(000) 000-0000',
        '(999) 999-9999',
        '(111) 111-1111',
      ];
      
      if (fakeNumbers.includes(phone) || phone.includes('555-01')) {
        // Don't include obviously fake numbers
        delete processedData.phone;
      } else {
        processedData.phone = phone;
      }
    }

    // Normalize email to lowercase
    if (processedData.email && typeof processedData.email === 'string') {
      processedData.email = processedData.email.trim().toLowerCase();
    }

    // Normalize address formatting
    if (processedData.address && typeof processedData.address === 'string') {
      processedData.address = normalizeAddress(processedData.address);
    }

    // Process service times
    if (Array.isArray(processedData.service_times)) {
      processedData.service_times = processedData.service_times
        .map((item: any) => {
          // Handle string format
          if (typeof item === 'string') {
            return { time: normalizeTimeFormat(item.trim()) };
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
                .replace(/\bBIBLE\b/gi, 'Bible')
                .replace(/\bSUNDAY SCHOOL\b/gi, 'Sunday School');
            }

            return {
              time: normalizeTimeFormat(item.time.trim()),
              notes: notes,
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

      // Sort and deduplicate service times if present
      if (partialData.service_times) {
        // Deduplicate based on time
        const uniqueTimes = new Map<string, ServiceTime>();
        partialData.service_times.forEach((service) => {
          const existing = uniqueTimes.get(service.time);
          if (!existing || (service.notes && !existing.notes)) {
            uniqueTimes.set(service.time, service);
          }
        });

        partialData.service_times = sortServiceTimes(Array.from(uniqueTimes.values()));
      }

      return partialData;
    }

    // Sort and deduplicate service times
    if (parseResult.data.service_times) {
      // Deduplicate based on time
      const uniqueTimes = new Map<string, ServiceTime>();
      parseResult.data.service_times.forEach((service) => {
        const existing = uniqueTimes.get(service.time);
        if (!existing || (service.notes && !existing.notes)) {
          // Keep the one with notes if duplicate times exist
          uniqueTimes.set(service.time, service);
        }
      });

      parseResult.data.service_times = sortServiceTimes(Array.from(uniqueTimes.values()));
    }

    return parseResult.data;
  } catch (error) {
    console.error('Extraction error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to extract church data: ';
    
    if (error instanceof Error) {
      if (error.message.includes('internal error')) {
        errorMessage += 'The AI service is temporarily unavailable. Please try again in a few moments.';
      } else if (error.message.includes('rate limit')) {
        errorMessage += 'Rate limit exceeded. Please wait a minute before trying again.';
      } else if (error.message.includes('fetch')) {
        errorMessage += 'Unable to fetch the website. Please check the URL and try again.';
      } else {
        errorMessage += error.message;
      }
    } else {
      errorMessage += 'Unknown error occurred';
    }
    
    throw new Error(errorMessage);
  }
}

// Helper to format service times into the gatherings format
export function formatServiceTimesForGatherings(serviceTimes: ServiceTime[]): Array<{
  time: string;
  notes?: string;
}> {
  // Already sorted by extraction process
  return serviceTimes.map((service) => ({
    time: service.time,
    notes: service.notes,
  }));
}
