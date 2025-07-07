export function removeTimestampsFromSRT(srtContent: string): string {
  // Remove SRT timestamps and sequence numbers, keep only text
  const lines = srtContent.split('\n');
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Skip sequence numbers (just digits)
    if (/^\d+$/.test(line)) continue;

    // Skip timestamp lines (contains --> )
    if (line.includes('-->')) continue;

    // This is transcript text
    textLines.push(line);
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

export function cleanTranscriptForAI(transcript: string): string {
  // Remove common transcript artifacts
  return transcript
    .replace(/\[Music\]/gi, '')
    .replace(/\[Applause\]/gi, '')
    .replace(/\[Laughter\]/gi, '')
    .replace(/\[.*?\]/g, '') // Remove any [bracketed] content
    .replace(/\s+/g, ' ')
    .trim();
}
