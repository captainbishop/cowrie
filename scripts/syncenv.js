const fs = require("fs");
const path = require("path");

// Copies the freshly deployed addresses from deployments.json into web/.env.local,
// so you never have to paste them by hand. Only the three address lines are touched;
// your Privy id, AI key, and everything else are left exactly as they are.
function syncEnv() {
  const d = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const map = {
    NEXT_PUBLIC_POLICY_VAULT: d.PolicyVault,
    NEXT_PUBLIC_SCAM_REGISTRY: d.ScamRegistry,
    NEXT_PUBLIC_MOCK_USD: d.MockUSD,
  };
  const envPath = path.join("web", ".env.local");
  let lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  for (const [key, val] of Object.entries(map)) {
    if (!val) continue;
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/^\s+/, "").startsWith(key + "=")) {
        lines[i] = key + "=" + val;
        found = true;
        break;
      }
    }
    if (!found) lines.push(key + "=" + val);
  }
  fs.writeFileSync(envPath, lines.join("\n"));
  console.log("Updated web/.env.local with the new addresses:");
  for (const [k, v] of Object.entries(map)) console.log("  " + k + "=" + v);
}

module.exports = { syncEnv };

if (require.main === module) syncEnv();
