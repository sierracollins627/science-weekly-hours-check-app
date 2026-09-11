const express = require("express");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

const { runWeeklyHoursCheck } = require("./weeklyHoursCheck");
const { sendTestEmail } = require("./emailer");

const app = express();
app.use(express.json());

// TEST PHASE ONLY: hardcoded to your own inbox. Replace/remove once you're
// ready to send to the real distribution list (see README "Going live").
const TEST_RECIPIENT = "sierra.collins@datavant.com";

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Weekly hours check action endpoint is reachable." });
});

/**
 * monday POSTs here when the Custom Action Block runs. Uses the ASYNC
 * pattern (ack immediately, do the work in the background, report back via
 * payload.callbackUrl) since board pagination + sending mail can exceed
 * monday's 1-minute synchronous timeout.
 */
app.post("/run-hours-check", async (req, res) => {
  const body = req.body || {};
  const payload = body.payload || {};
  const runtimeMetadata = body.runtimeMetadata || {};
  const callbackUrl = payload.callbackUrl;
  const actionUuid = runtimeMetadata.actionUuid || "unknown";

  res.status(200).json({ status: "received", message: "Weekly hours check triggered.", actionUuid });

  runInBackground(callbackUrl).catch((err) => {
    console.error("Unhandled error in background run:", err);
  });
});

async function runInBackground(callbackUrl) {
  try {
    const result = await runWeeklyHoursCheck();

    // TEST PHASE: send the styled email to yourself only, regardless of who
    // triggers the action. Failure to send email doesn't fail the whole
    // action — it's still reported as a warning in the callback.
    let emailError = null;
    try {
      await sendTestEmail(result, TEST_RECIPIENT);
    } catch (err) {
      console.error("Test email send failed:", err);
      emailError = String(err).substring(0, 300);
    }

    await sendCallback(callbackUrl, {
      success: true,
      outputFields: {
        message: result.message,
        flaggedCount: result.belowThreshold.length,
        flaggedNames: result.belowThreshold.map((p) => p.name).join(", "),
        emailSent: emailError ? "false" : "true",
        emailError: emailError || "",
      },
    });
  } catch (err) {
    console.error("Weekly hours check failed:", err);
    await sendCallback(callbackUrl, {
      success: false,
      severityCode: 4000,
      runtimeErrorDescription: String(err).substring(0, 500),
      notificationErrorTitle: "Weekly hours check failed",
      notificationErrorDescription: String(err).substring(0, 300),
    });
  }
}

/** Reports the async result back to monday, signed with the app's signing secret. */
async function sendCallback(callbackUrl, resultPayload) {
  if (!callbackUrl) {
    console.log("No callbackUrl provided — skipping callback (likely a manual/test invocation).");
    console.log(JSON.stringify(resultPayload, null, 2));
    return;
  }

  const appId = process.env.MONDAY_APP_ID;
  const signingSecret = process.env.MONDAY_APP_SIGNING_SECRET;
  if (!appId || !signingSecret) {
    console.error("MONDAY_APP_ID / MONDAY_APP_SIGNING_SECRET secrets are not set — cannot sign the callback.");
    return;
  }

  const token = jwt.sign({ appId }, signingSecret);

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(resultPayload),
  });

  if (!response.ok) {
    console.error(`Callback to monday failed: ${response.status} ${await response.text()}`);
  } else {
    console.log("Callback to monday sent successfully.");
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Weekly hours check action server listening on port ${PORT}`);
});
