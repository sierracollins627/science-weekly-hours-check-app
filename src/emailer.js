const nodemailer = require("nodemailer");
const { HOURS_THRESHOLD } = require("./config");

function buildTransport() {
  return nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // STARTTLS, not implicit TLS
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER, // full M365 mailbox, e.g. sierra.collins@datavant.com
      pass: process.env.SMTP_PASS, // app password (see README — M365 blocks plain basic auth by default)
    },
  });
}

/** A single email-safe "bar" using a fixed-width table cell — no SVG/canvas/JS, since email clients strip those. */
function bar(hoursShort, maxShort) {
  const pct = Math.max(0.06, Math.min(1, hoursShort / maxShort)); // floor so even small shortfalls show a sliver
  const widthPx = Math.round(pct * 160);
  const color = hoursShort >= 20 ? "#df2f4a" : hoursShort >= 10 ? "#fdab3d" : "#ffcb00";
  return `
    <table cellpadding="0" cellspacing="0" style="width:160px;background:#eceff1;border-radius:4px;">
      <tr><td style="width:${widthPx}px;height:14px;background:${color};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>`;
}

function rowsHtml(people, maxShort) {
  return people
    .map(
      (p) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:13px;color:#323338;">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:13px;color:#323338;text-align:right;">${p.hoursLogged} hrs</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eceff1;">${bar(p.hoursShort, maxShort)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:12px;color:#676879;">${p.hoursShort} short</td>
    </tr>`
    )
    .join("");
}

function excludedRowsHtml(people) {
  return people
    .map((p) => {
      const reasons = [];
      if (p.ptoHours > 0) reasons.push(`${p.ptoHours} PTO hrs`);
      if (p.holidays.length > 0) reasons.push(p.holidays.join(", "));
      return `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:13px;color:#676879;">${p.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:13px;color:#676879;text-align:right;">${p.hoursLogged} hrs</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eceff1;font-family:Arial,sans-serif;font-size:12px;color:#00c875;">${reasons.join("; ")}</td>
    </tr>`;
    })
    .join("");
}

function buildEmailHtml(result) {
  const flagged = result.belowThreshold;
  const maxShort = Math.max(1, ...flagged.map((p) => p.hoursShort));
  const weekLabel = `${result.weekStart} to ${result.weekEnd}`;

  const summaryBlock =
    flagged.length === 0
      ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#00c875;">✅ No one is under ${HOURS_THRESHOLD} hrs this week without PTO or a holiday to explain it.</p>`
      : `
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#676879;border-bottom:2px solid #d0d4e4;">Name</th>
            <th style="text-align:right;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#676879;border-bottom:2px solid #d0d4e4;">Hours</th>
            <th style="text-align:left;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#676879;border-bottom:2px solid #d0d4e4;">Gap vs ${HOURS_THRESHOLD}</th>
            <th style="text-align:left;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#676879;border-bottom:2px solid #d0d4e4;"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml(flagged, maxShort)}</tbody>
      </table>`;

  const excludedBlock =
    result.excludedForPtoOrHoliday.length > 0
      ? `
      <h3 style="font-family:Arial,sans-serif;font-size:14px;color:#323338;margin-top:28px;">Also under ${HOURS_THRESHOLD} hrs, but excluded (PTO/holiday)</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tbody>${excludedRowsHtml(result.excludedForPtoOrHoliday)}</tbody>
      </table>`
      : "";

  return `
  <div style="max-width:640px;margin:0 auto;font-family:Arial,sans-serif;">
    <h2 style="color:#323338;font-size:18px;margin-bottom:4px;">⏱ Weekly Hours Check</h2>
    <p style="color:#676879;font-size:13px;margin-top:0;">Week of ${weekLabel} · flagging under ${HOURS_THRESHOLD} hrs, excluding PTO/holiday</p>
    ${summaryBlock}
    ${excludedBlock}
  </div>`;
}

async function sendTestEmail(result, recipient) {
  const transport = buildTransport();
  const flaggedCount = result.belowThreshold.length;
  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: recipient,
    subject: `Weekly Hours Check — ${flaggedCount} flagged (${result.weekStart} to ${result.weekEnd})`,
    html: buildEmailHtml(result),
  });
}

module.exports = { buildEmailHtml, sendTestEmail };
