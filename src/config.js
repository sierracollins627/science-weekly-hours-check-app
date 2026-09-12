module.exports = {
  MONDAY_API_URL: "https://api.monday.com/v2",

  TIMESHEET_BOARD_ID: 18428785617, // 1️⃣ Main Timesheet 1.0
  ROSTER_BOARD_ID: 18420120506, // User Roster as of September
  HOLIDAYS_BOARD_ID: 18423579621, // Company Holidays

  HOURS_THRESHOLD: 40,

  // Roster Country label -> Company Holidays Country label
  ROSTER_TO_HOLIDAY_COUNTRY: {
    US: "US",
    UK: "UK",
    France: "France",
    ES: "Spain",
    Spain: "Spain",
    IE: null, // no Ireland calendar on the holidays board yet
  },

  COL: {
    timesheet: {
      date: "date_mm5d2cga",
      hours: "numeric_mm4xtp1p",
      memberText: "formula_mm4w4566", // formula-derived Team Member name
      projectName: "text_mm584nnb", // used to detect PTO entries
    },
    roster: {
      monTeam: "dropdown_mm4v180d",
      tracksTime: "dropdown_mm4vdkza",
      hrStatus: "color_mm4v1h1p",
      country: "dropdown_mm4vc760",
    },
    holidays: {
      date: "date_mm5j3ab8",
      country: "dropdown_mm5jkjx7",
    },
  },
};
