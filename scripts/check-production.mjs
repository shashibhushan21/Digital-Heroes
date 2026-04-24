import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"], { NODE_ENV: "production" }],
];

for (const [command, args, extraEnv] of commands) {
  const label = `${command} ${args.join(" ")}`;
  console.log(`\n> ${label}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...(extraEnv ?? {}),
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nProduction readiness checks passed.");
