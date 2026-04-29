#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
    let newVersion = process.argv[2];

    if (!newVersion) {
        const current = fs.existsSync("version.txt")
            ? fs.readFileSync("version.txt", "utf8").trim()
            : "";
        newVersion = await prompt(`Version [${current}]: `);
        newVersion = newVersion || current;
    }

    if (!newVersion) {
        console.error("No version provided.");
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
        { cwd: "runner-package", stdio: "inherit" }
    );

    // commit only the version files
    execSync(
        `git commit -m "chore: bump to ${newVersion}" -- version.txt runner-package/package.json runner-package/package-lock.json`,
        { stdio: "inherit" }
    );

    // optionally create an annotated tag
    const isPrerelease = newVersion.includes("-");
    const tagAnswer = await prompt(`Create tag v${newVersion}? [${isPrerelease ? "y/N" : "Y/n"}] `);
    const createTag = isPrerelease
        ? tagAnswer.toLowerCase() === "y"
        : tagAnswer === "" || tagAnswer.toLowerCase() === "y";

    if (createTag) {
        execSync(`git tag -a "v${newVersion}" -m "v${newVersion}"`, { stdio: "inherit" });
    }

    console.log(`\nVersion bumped to ${newVersion}${createTag ? `, tagged as v${newVersion}` : " (no tag created)"}`);

    // optionally push
    const pushAnswer = await prompt("Push commits and tags? [Y/n] ");
    if (pushAnswer === "" || pushAnswer.toLowerCase() === "y") {
        execSync(createTag ? "git push && git push --tags" : "git push", { stdio: "inherit" });
        console.log("Pushed.");
    } else {
        console.log(`Skipped push. Run: git push${createTag ? " && git push --tags" : ""}`);
    }
}

main();