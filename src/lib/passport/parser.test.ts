import { describe, it, expect } from 'vitest';
import { parseIRCTCBooking } from './parser';

describe('parseIRCTCBooking', () => {
  it('parses a standard IRCTC SMS format', () => {
    const sms = `Txn#12345678 PNR:4512367890 Train 12301 HOWRAH RAJDHANI has been Booked. From HWH To NDLS Dt 25-May-2026 Coach B2 Seat 45 Boarding HWH`;
    const result = parseIRCTCBooking(sms);
    expect(result.pnr).toBe('4512367890');
    expect(result.trainNumber).toBe('12301');
    expect(result.fromStation).toBe('HWH');
    expect(result.toStation).toBe('NDLS');
    expect(result.journeyDate).toBe('2026-05-25');
    expect(result.coach).toBe('B2');
    expect(result.confidence).toBe('high');
  });

  it('parses date in DD/MM/YYYY format', () => {
    const text = `PNR 1234567890 Train 12951 MUMBAI RAJDHANI From BCT To NDLS Date 01/06/2026`;
    const result = parseIRCTCBooking(text);
    expect(result.journeyDate).toBe('2026-06-01');
  });

  it('returns low confidence for garbage input', () => {
    const result = parseIRCTCBooking('hello world no booking here');
    expect(result.confidence).toBe('low');
    expect(result.pnr).toBeNull();
    expect(result.trainNumber).toBeNull();
  });

  it('parses PNR even without prefix', () => {
    const text = `Your booking 4512367890 confirmed on train 12302 NDLS to HWH`;
    const result = parseIRCTCBooking(text);
    expect(result.pnr).toBe('4512367890');
    expect(result.trainNumber).toBe('12302');
  });

  it('handles 3A coach format', () => {
    const text = `PNR 9876543210 Train 12259 SEA BEACH EXP Coach 3A Seat 22 From SDAH To NDLS 15-Jun-2026`;
    const result = parseIRCTCBooking(text);
    expect(result.pnr).toBe('9876543210');
    expect(result.journeyDate).toBe('2026-06-15');
  });
});
