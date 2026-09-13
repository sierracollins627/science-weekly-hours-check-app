const axios = require("axios");
const { MONDAY_API_URL } = require("./config");

/**
 * Runs a GraphQL query/mutation against the monday.com API.
 * `token` must be passed in explicitly (fetched via secrets.js's
 * getSecrets()) — monday code Secrets are not available on process.env.
 */
async function mondayQuery(query, variables = {}, token) {
  const res = await axios.post(
    MONDAY_API_URL,
    { query, variables },
    {
      headers: {
        Authorization: token,
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
