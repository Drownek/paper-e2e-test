# Test Filtering

Run specific tests using `-PtestFiles` and `-PtestNames`.

### Syntax Rules
*   **Matching:** Case-sensitive substring matching.
*   **Multiple Patterns:** Comma-separated (no spaces).
*   **Extensions:** No need to include `.spec.js` or `.spec.ts`.

## Filter by File
Run specific test files.

```bash
# Run basic.spec.js
./gradlew testE2E -PtestFiles="basic"

# Run files matching "basic" OR "commands"
./gradlew testE2E -PtestFiles="basic,commands"
```

## Filter by Test Name
Run specific test cases.

```bash
# Run tests containing "should connect"
./gradlew testE2E -PtestNames="should connect"

# Run tests matching "teleport" OR "spawn"
./gradlew testE2E -PtestNames="teleport,spawn"
```

## Combine Filters
Run tests that match **both** the file and the name criteria.

```bash
# Run "purchase" tests, but only inside "shop" files
./gradlew testE2E -PtestFiles="shop" -PtestNames="purchase"
```

> **Note:** Running `./gradlew testE2E` without arguments runs all tests.