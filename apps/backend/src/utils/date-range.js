const HttpError = require("./http-error");

// Reports are read by people in one place, so a "day" has to mean a day in THEIR
// calendar. Everything is stored in UTC, and grouping by the UTC day put every reading
// between 00:00 and 07:00 local time into the previous day's bucket. Configurable so the
// choice is visible rather than hard-coded in three query builders.
const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;
const DEFAULT_OFFSET = "+07:00";

// A shape check alone let "+99:99" and "+25:00" through: `new Date("...+99:99")` is
// Invalid Date, so EVERY request carrying ?from= or ?to= started answering 400, and in
// SQL CONVERT_TZ silently returned NULL. The range below is what MySQL's CONVERT_TZ
// actually accepts (-13:59 .. +14:00); anything else falls back to the default rather
// than poisoning both layers.
function isUsableOffset(value) {
  const match = OFFSET_PATTERN.exec(value || "");
  if (!match) return false;

  const [, sign, hours, minutes] = match;
  const hh = Number(hours);
  const mm = Number(minutes);
  if (mm > 59) return false;

  const total = hh * 60 + mm;
  return sign === "+" ? total <= 14 * 60 : total <= 13 * 60 + 59;
}

function reportOffset() {
  const configured = process.env.REPORT_TZ_OFFSET;
  return isUsableOffset(configured) ? configured : DEFAULT_OFFSET;
}

// A bare "2026-09-10" parses as midnight UTC. For a `from` bound in a UTC+7 report that
// is 07:00 local — seven hours of the day silently missing. Both bounds are therefore
// anchored to the report offset, and a `to` bound is pushed to the end of that local day.
// A full ISO timestamp already carries its own offset and is taken as given.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundary(value, fieldName, endOfDay = false) {
  const raw = String(value);

  if (DATE_ONLY_PATTERN.test(raw)) {
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
    const parsed = new Date(`${raw}T${time}${reportOffset()}`);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `Invalid ${fieldName} date`);
    }
    return parsed;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${fieldName} date`);
  }
  return parsed;
}

// Turns ?from=&to= into a Prisma range filter, or undefined when neither is given.
// Shared by sensor readings, alerts and device actions so "7 ngày gần nhất" means the
// same thing on every chart.
function buildDateRange(query = {}, { fromField = "from", toField = "to" } = {}) {
  const range = {};
  if (query[fromField]) range.gte = parseBoundary(query[fromField], fromField);
  if (query[toField]) range.lte = parseBoundary(query[toField], toField, true);

  if (range.gte && range.lte && range.gte > range.lte) {
    throw new HttpError(400, `${fromField} must be earlier than ${toField}`);
  }

  return Object.keys(range).length ? range : undefined;
}

module.exports = { buildDateRange, parseBoundary, reportOffset, isUsableOffset };
