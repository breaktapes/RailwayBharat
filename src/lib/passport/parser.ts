export interface ParsedBooking {
  pnr: string | null;
  trainNumber: string | null;
  trainName: string | null;
  journeyDate: string | null; // YYYY-MM-DD
  fromStation: string | null;
  toStation: string | null;
  coach: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Parses IRCTC booking confirmation text (SMS or email body).
 * Handles multiple IRCTC message formats observed in the wild.
 */
export function parseIRCTCBooking(text: string): ParsedBooking {
  const result: ParsedBooking = {
    pnr: null,
    trainNumber: null,
    trainName: null,
    journeyDate: null,
    fromStation: null,
    toStation: null,
    coach: null,
    confidence: 'low',
  };

  const normalized = text.replace(/\s+/g, ' ').trim();

  // PNR: 10-digit number, often preceded by "PNR" or "PNR No"
  const pnrMatch = normalized.match(/(?:PNR[:\s#]*)?(\b\d{10}\b)/i);
  if (pnrMatch) result.pnr = pnrMatch[1];

  // Train number: 5-digit number, often preceded by "Train" or "Tr No"
  const trainNumMatch = normalized.match(/(?:Train(?:\s*No)?[:\s.]*)?(\b\d{5}\b)/i);
  if (trainNumMatch) result.trainNumber = trainNumMatch[1];

  // Train name: often in caps between train number and other details
  const trainNameMatch = normalized.match(
    /\d{5}\s+([A-Z][A-Z\s/]+?)(?:\s+(?:From|Dep|Booked|Quota|Class|PNR|\d))/
  );
  if (trainNameMatch) result.trainName = trainNameMatch[1].trim();

  // Journey date formats: DD-Mon-YYYY, DD/MM/YYYY, DD-MM-YYYY, Month DD YYYY
  const datePatterns = [
    /(\d{1,2}[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/]\d{4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
    /(?:Journey Date[:\s]*)(\d{1,2}\s+\w+\s+\d{4})/i,
  ];
  for (const pattern of datePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.journeyDate = normalizeDate(match[1]);
      if (result.journeyDate) break;
    }
  }

  // From/To stations: station codes in caps (3-4 chars) or names
  const fromToMatch = normalized.match(
    /(?:From|Boarding|Dep(?:arture)?)[:\s]+([A-Z]{2,6})/i
  );
  if (fromToMatch) result.fromStation = fromToMatch[1].toUpperCase();

  const toMatch = normalized.match(/(?:To|Destination|Arr(?:ival)?)[:\s]+([A-Z]{2,6})/i);
  if (toMatch) result.toStation = toMatch[1].toUpperCase();

  // Coach: patterns like "B2", "S5", "1A", "3A", "SL"
  const coachMatch = normalized.match(/(?:Coach[:\s]+|Seat[:\s]+\w+[,\s]+)([A-Z]\d+|\d[A-Z]+|SL|GN)/i);
  if (coachMatch) result.coach = coachMatch[1].toUpperCase();

  // Confidence scoring
  const filled = [result.pnr, result.trainNumber, result.journeyDate, result.fromStation, result.toStation]
    .filter(Boolean).length;
  result.confidence = filled >= 4 ? 'high' : filled >= 2 ? 'medium' : 'low';

  return result;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function normalizeDate(raw: string): string | null {
  // Handle "DD-Mon-YYYY"
  const monMatch = raw.match(/(\d{1,2})[-/](\w{3})[-/](\d{4})/i);
  if (monMatch) {
    const month = MONTH_MAP[monMatch[2].toLowerCase()];
    if (month) return `${monMatch[3]}-${month}-${monMatch[1].padStart(2, '0')}`;
  }

  // Handle "DD/MM/YYYY" or "DD-MM-YYYY"
  const numMatch = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (numMatch) {
    return `${numMatch[3]}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
  }

  return null;
}
