#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

const newVersion = process.argv[2];

if (!newVersion) {
    console.log("Usage: npm run bump -- 1.2.0-dev.0");
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    console.error("Invalid semver:", newVersion);
    process.exit(1);
}

// update version.txt
fs.writeFileSync("version.txt", newVersion + "\n");

// update runner-package/package.json
execSync(
    `npm version ${newVersion} --no-git-tag-version --allow-same-version`,
    {
        cwd: "runner-package",
        stdio: "inherit",
    }
);

// stage only (don't commit automatically)
execSync("git add version.txt runner-package/package.json runner-package/package-lock.json", {
    stdio: "inherit",
});

console.log(`Version bumped to ${newVersion}`);
console.log(`Files staged. Run: git commit -m "chore: bump to ${newVersion}"`);