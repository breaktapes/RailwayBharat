import type { LiveTrain, ScraperError, ScraperTransport } from '@/types';
import { isScraperError } from '@/types';

/**
 * Tries primary scraper first; falls back to secondary on rate_limit or network_error.
 * Returns null if train not found on either.
 * Returns ScraperError only if both scrapers fail with real errors.
 */
export async function fetchWithFallback(
  trainNumber: string,
  primary: ScraperTransport,
  fallback: ScraperTransport
): Promise<LiveTrain | ScraperError | null> {
  const primaryResult = await primary.fetchTrainStatus(trainNumber);

  // not_found and parse_error: trust the primary, don't fall back
  if (primaryResult === null) return null;
  if (isScraperError(primaryResult)) {
    if (
      primaryResult.type === 'not_found' ||
      primaryResult.type === 'parse_error'
    ) {
      return primaryResult;
    }
    // rate_limit or network_error: try fallback
  } else {
    return primaryResult; // success
  }

  const fallbackResult = await fallback.fetchTrainStatus(trainNumber);
  return fallbackResult;
}
