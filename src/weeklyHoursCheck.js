/**
 * Weekly Hours Check (< 50 hrs, excluding PTO & Holiday weeks)
 * --------------------------------------------------------------
 * See README.md for the full design notes. Same logic as the standalone
 * script version, adapted to run inside the monday code app.
 */

const { mondayQuery } = require("./mondayApi");
const {
  TIMESHEET_BOARD_ID,
  ROSTER_BOARD_ID,
  HOLIDAYS_BOARD_ID,
  HOURS_THRESHOLD,
  ROSTER_TO_HOLIDAY_COUNTRY,
  COL,
} = require("./config");

function getCurrentWeekRange(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // Sun=0 ... Sat=6
  const daysSinceSaturday = (day + 1) % 7; // Sat->0, Sun->1, Mon->2, ... Fri->6
  const start = new Date(d);
  start.setDate(d.getDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (x) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function getActiveScienceRoster() {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 200, query_params: {
          rules: [
            { column_id: "${COL.roster.monTeam}", compare_value: ["Science Members"], operator: contains_text },
            { column_id: "${COL.roster.tracksTime}", compare_value: ["Yes, Tracks Time"], operator: any_of },
            { column_id: "${COL.roster.hrStatus}", compare_value: ["Active"], operator: any_of }
          ]
        }) {
          cursor
          items {
            id
            name
            column_values(ids: ["${COL.roster.country}"]) { id text }
          }
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [ROSTER_BOARD_ID] });
  const page = data.boards[0].items_page;
  return page.items.map((item) => ({
    name: item.name.trim(),
    country: item.column_values[0]?.text || null,
  }));
  // NOTE: if the roster ever exceeds 200 active/tracking members, add cursor pagination here.
}

async function getHolidaysInRange(start, end) {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 50, query_params: {
          rules: [
            { column_id: "${COL.holidays.date}", compare_value: ["${start}", "${end}"], operator: between }
          ]
        }) {
          items {
            name
            column_values(ids: ["${COL.holidays.date}", "${COL.holidays.country}"]) { id text }
          }
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: [HOLIDAYS_BOARD_ID] });
  const items = data.boards[0].items_page.items;
  return items.map((item) => ({
    name: item.name,
    date: item.column_values.find((c) => c.id === COL.holidays.date)?.text,
    country: item.column_values.find((c) => c.id === COL.holidays.country)?.text,
  }));
}

async function getHoursByPersonInRange(start, end, { ptoOnly = false } = {}) {
  const totals = {};
  let cursor = null;
  const ptoRule = ptoOnly
    ? `, { column_id: "${COL.timesheet.projectName}", compare_value: "PTO", operator: contains_text }`
    : "";
  do {
    const query = `
      query ($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 500, cursor: $cursor${
            cursor
              ? ""
              : `, query_params: {
            rules: [
              { column_id: "${COL.timesheet.date}", compare_value: ["${start}", "${end}"], operator: between }${ptoRule}
            ]
          }`
          }) {
            cursor
            items {
              column_values(ids: ["${COL.timesheet.memberText}", "${COL.timesheet.hours}"]) { id text }
            }
          }
        }
      }
    `;
    const data = await mondayQuery(query, { boardId: [TIMESHEET_BOARD_ID], cursor });
    const page = data.boards[0].items_page;
    for (const item of page.items) {
      const name = item.column_values.find((c) => c.id === COL.timesheet.memberText)?.text?.trim();
      const hours = Number(item.column_values.find((c) => c.id === COL.timesheet.hours)?.text) || 0;
      if (!name) continue;
      totals[name] = (totals[name] || 0) + hours;
    }
    cursor = page.cursor;
  } while (cursor);
  return totals;
}

function holidayAppliesToCountry(holidayCountry, personRosterCountry) {
  if (holidayCountry === "All") return true;
  const mapped = ROSTER_TO_HOLIDAY_COUNTRY[personRosterCountry];
  return mapped != null && holidayCountry === mapped;
}

async function runWeeklyHoursCheck(referenceDate = new Date()) {
  const { start, end } = getCurrentWeekRange(referenceDate);

  const [roster, holidays, hoursByPerson, ptoHoursByPerson] = await Promise.all([
    getActiveScienceRoster(),
    getHolidaysInRange(start, end),
    getHoursByPersonInRange(start, end),
    getHoursByPersonInRange(start, end, { ptoOnly: true }),
  ]);

  const rosterNames = new Set(roster.map((r) => r.name));
  const belowThreshold = [];
  const excludedForPtoOrHoliday = [];

  for (const person of roster) {
    const logged = Math.round((hoursByPerson[person.name] || 0) * 100) / 100;
    if (logged >= HOURS_THRESHOLD) continue;

    const ptoHours = Math.round((ptoHoursByPerson[person.name] || 0) * 100) / 100;
    const hadPto = ptoHours > 0;
    const applicableHolidays = holidays.filter((h) => holidayAppliesToCountry(h.country, person.country));
    const hadHoliday = applicableHolidays.length > 0;

    const entry = {
      name: person.name,
      hoursLogged: logged,
      hoursShort: Math.round((HOURS_THRESHOLD - logged) * 100) / 100,
      ptoHours,
      holidays: applicableHolidays.map((h) => h.name),
    };

    if (hadPto || hadHoliday) {
      excludedForPtoOrHoliday.push(entry);
    } else {
      belowThreshold.push(entry);
    }
  }
  belowThreshold.sort((a, b) => a.hoursLogged - b.hoursLogged);

  const unmatchedEntries = Object.keys(hoursByPerson).filter((name) => !rosterNames.has(name));

  const result = {
    weekStart: start,
    weekEnd: end,
    rosterSize: roster.length,
    belowThreshold,
    excludedForPtoOrHoliday,
    unmatchedEntries,
  };

  result.message = formatMessage(result);
  return result;
}

function formatMessage(result) {
  const weekLabel = `${formatShort(result.weekStart)} - ${formatShort(result.weekEnd)}`;
  const lines = [`⏱ Weekly Hours Check (< ${HOURS_THRESHOLD} hrs, no PTO/holiday) — ${weekLabel}`];

  lines.push("");
  if (result.belowThreshold.length === 0) {
    lines.push(`✅ No one on the roster (${result.rosterSize}) is under ${HOURS_THRESHOLD} hrs this week without PTO or a holiday to explain it.`);
  } else {
    lines.push(`${result.belowThreshold.length} of ${result.rosterSize} team members logged under ${HOURS_THRESHOLD} hrs this week, with no PTO or holiday:`);
    for (const p of result.belowThreshold) {
      lines.push(`• ${p.name} — ${p.hoursLogged} hrs (${p.hoursShort} short)`);
    }
  }

  if (result.excludedForPtoOrHoliday.length > 0) {
    lines.push("");
    lines.push(`ℹ️ Also under ${HOURS_THRESHOLD} hrs but excluded (had PTO and/or a holiday):`);
    for (const p of result.excludedForPtoOrHoliday) {
      const reasons = [];
      if (p.ptoHours > 0) reasons.push(`${p.ptoHours} PTO hrs`);
      if (p.holidays.length > 0) reasons.push(p.holidays.join(", "));
      lines.push(`• ${p.name} — ${p.hoursLogged} hrs (${reasons.join("; ")})`);
    }
  }

  if (result.unmatchedEntries.length > 0) {
    lines.push("");
    lines.push(`ℹ️ Time was also logged under names not found on the active Science roster: ${result.unmatchedEntries.join(", ")}`);
  }

  return lines.join("\n");
}

function formatShort(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

module.exports = { runWeeklyHoursCheck, getCurrentWeekRange };
