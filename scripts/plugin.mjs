const command = process.argv[2] ?? "doctor";

if (command === "sync") {
  await import("./sync-plugin-metadata.mjs");
} else if (command === "doctor") {
  await import("./validate-plugin.mjs");
} else {
  console.error("Usage: node scripts/plugin.mjs <sync|doctor>");
  process.exitCode = 1;
}
