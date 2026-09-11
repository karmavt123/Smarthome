const { buildDateRange, reportOffset, isUsableOffset } = require('../src/utils/date-range');

describe('buildDateRange', () => {
  test('returns undefined when neither bound is given', () => {
    expect(buildDateRange({})).toBeUndefined();
  });

  // A day means a day in the reader's calendar, not a UTC day. Grouping on raw UTC put
  // every reading from 00:00-07:00 local into the previous day's bucket.
  test('a bare from date starts at local midnight, not UTC midnight', () => {
    expect(buildDateRange({ from: '2026-09-10' })).toEqual({
      gte: new Date(`2026-09-10T00:00:00.000${reportOffset()}`),
    });
  });

  test('a bare to date covers the whole local day', () => {
    expect(buildDateRange({ to: '2026-09-10' })).toEqual({
      lte: new Date(`2026-09-10T23:59:59.999${reportOffset()}`),
    });
  });

  test('a full ISO timestamp keeps its own offset', () => {
    expect(buildDateRange({ to: '2026-09-10T08:00:00.000Z' })).toEqual({
      lte: new Date('2026-09-10T08:00:00.000Z'),
    });
  });

  test('rejects an inverted range', () => {
    expect(() => buildDateRange({ from: '2026-09-10', to: '2026-09-03' })).toThrow(
      /from must be earlier than to/
    );
  });

  test('rejects an unparseable date', () => {
    expect(() => buildDateRange({ from: 'khong-phai-ngay' })).toThrow(/Invalid from date/);
  });

  test('honours custom field names', () => {
    const range = buildDateRange(
      { since: '2026-09-03' },
      { fromField: 'since', toField: 'until' }
    );
    expect(range).toEqual({ gte: new Date(`2026-09-03T00:00:00.000${reportOffset()}`) });
  });
});

describe('reportOffset', () => {
  const original = process.env.REPORT_TZ_OFFSET;
  afterEach(() => {
    if (original === undefined) delete process.env.REPORT_TZ_OFFSET;
    else process.env.REPORT_TZ_OFFSET = original;
  });

  test('defaults to Vietnam time', () => {
    delete process.env.REPORT_TZ_OFFSET;
    expect(reportOffset()).toBe('+07:00');
  });

  test('falls back to the default when the configured value is malformed', () => {
    process.env.REPORT_TZ_OFFSET = 'Asia/Ho_Chi_Minh';
    // A zone NAME would need the mysql.time_zone_* tables, which the stock image lacks,
    // so anything that is not an offset literal is refused rather than passed to SQL.
    expect(reportOffset()).toBe('+07:00');
  });

  test('accepts a valid offset literal', () => {
    process.env.REPORT_TZ_OFFSET = '+00:00';
    expect(reportOffset()).toBe('+00:00');
  });
});

describe('isUsableOffset', () => {
  // A shape-only check let "+99:99" through, and `new Date("...+99:99")` is Invalid Date —
  // so every request carrying ?from= or ?to= started answering 400, while CONVERT_TZ
  // returned NULL in SQL. The bounds below are what MySQL's CONVERT_TZ accepts.
  test.each(['+07:00', '+00:00', '+14:00', '-13:59', '-05:00'])('accepts %s', (value) => {
    expect(isUsableOffset(value)).toBe(true);
  });

  test.each(['+99:99', '+25:00', '-30:70', '+14:30', '-14:00', '+07:60'])(
    'rejects %s',
    (value) => {
      expect(isUsableOffset(value)).toBe(false);
    }
  );

  test.each(['+7:00', '+0700', '07:00', 'Asia/Ho_Chi_Minh', '', null, undefined])(
    'rejects malformed %p',
    (value) => {
      expect(isUsableOffset(value)).toBe(false);
    }
  );
});
