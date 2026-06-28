/**
 * Updates capacitor.config.json appId/appName before `npx cap sync` for Play Store variants.
 * Usage: node scripts/patch-capacitor-app.cjs student|parent|faculty
 */
const fs = require("fs");
const path = require("path");

const variant = (process.argv[2] || "student").toLowerCase();
const map = {
  student: { appId: "com.zenithflows.student", appName: "ZenithFlows-Student" },
  parent: { appId: "com.zenithflows.parent", appName: "ZenithFlows-Parent" },
  faculty: { appId: "com.zenithflows.faculty", appName: "ZenithFlows-Faculty" },
  universal: { appId: "com.zenithflows.ims", appName: "ZenithFlows" },
};

const patch = map[variant];
if (!patch) {
  console.error("Usage: node scripts/patch-capacitor-app.cjs student|parent|faculty");
  process.exit(1);
}

const configPath = path.join(__dirname, "..", "capacitor.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
Object.assign(config, patch);
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("capacitor.config.json set to", patch.appId, patch.appName);
