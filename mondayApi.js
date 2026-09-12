const axios = require("axios");
const { MONDAY_API_URL } = require("./config");

/**
 * Runs a GraphQL query/mutation against the monday.com API.
 * Uses the MONDAY_API_TOKEN runtime secret (set in Developer Center ->
 * Host on monday -> Server-side code -> Secrets), NOT the app's signing
 * secret — this token is what actually reads the boards.
 */
async function mondayQuery(query, variables = {}) {
  const res = await axios.post(
    MONDAY_API_URL,
    { query, variables },
    {
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );
  if (res.data.errors) {
    throw new Error("monday API error: " + JSON.stringify(res.data.errors));
  }
  return res.data.data;
}

module.exports = { mondayQuery };
