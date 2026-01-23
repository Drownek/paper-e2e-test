# Test Filtering

Run specific tests or test files to speed up development and debugging.

## Filter by Test Files

Run only specific test files using the `-PtestFiles` parameter:

```bash
./gradlew testE2E -PtestFiles="basic,commands"
```

This runs only files matching the patterns (e.g., `basic.spec.js`, `commands.spec.ts`).

### Examples

```bash
# Run all tests in basic.spec.js
./gradlew testE2E -PtestFiles="basic"

# Run multiple test files
./gradlew testE2E -PtestFiles="basic,commands,economy"

# Pattern matching - run all activity-related files
./gradlew testE2E -PtestFiles="activity"
```

### File Pattern Matching

- Patterns use substring matching
- Case-sensitive
- No need to include `.spec.js` or `.spec.ts` extensions
- Comma-separated for multiple patterns

```bash
# These all match "activity-details.spec.ts":
./gradlew testE2E -PtestFiles="activity-details"
./gradlew testE2E -PtestFiles="activity"
./gradlew testE2E -PtestFiles="details"
```

## Filter by Test Names

Run only tests with specific names using the `-PtestNames` parameter:

```bash
./gradlew testE2E -PtestNames="should connect,should teleport"
```

This runs only tests whose names contain the specified patterns.

### Examples

```bash
# Run all tests with "GUI" in the name
./gradlew testE2E -PtestNames="GUI"

# Run specific test
./gradlew testE2E -PtestNames="player receives welcome message"

# Run multiple tests
./gradlew testE2E -PtestNames="connect,teleport,spawn"
```

### Test Name Matching

- Patterns use substring matching
- Case-sensitive
- Comma-separated for multiple patterns

```bash
# Match any test containing "inventory"
./gradlew testE2E -PtestNames="inventory"

# Match tests about permissions
./gradlew testE2E -PtestNames="permission,admin,op"
```

## Combine Both Filters

Combine file and name filters for precise test selection:

```bash
./gradlew testE2E -PtestFiles="commands" -PtestNames="help,spawn"
```

This runs only tests matching BOTH conditions:
- File name contains "commands"
- Test name contains "help" OR "spawn"

### Examples

```bash
# Test specific feature in specific file
./gradlew testE2E -PtestFiles="shop" -PtestNames="purchase"

# Test GUI features across multiple files
./gradlew testE2E -PtestFiles="gui" -PtestNames="click,open,close"

# Debug specific failing test
./gradlew testE2E -PtestFiles="economy.spec" -PtestNames="player balance"
```

## Practical Use Cases

### During Development

Test only the feature you're currently working on:

```bash
# Working on shop GUI
./gradlew testE2E -PtestFiles="shop"

# Working on specific shop feature
./gradlew testE2E -PtestFiles="shop" -PtestNames="purchase diamonds"
```

### Debugging Failures

Isolate and debug a specific failing test:

```bash
# Test failed with name "should track player activity"
./gradlew testE2E -PtestNames="should track player activity"

# Test failed in activity-details.spec.ts
./gradlew testE2E -PtestFiles="activity-details"
```

### Running Test Categories

Group tests by category using naming conventions:

```bash
# All permission tests (if named "test permission for X")
./gradlew testE2E -PtestNames="permission"

# All GUI tests
./gradlew testE2E -PtestNames="GUI,gui,menu,inventory"

# All economy tests
./gradlew testE2E -PtestFiles="economy,shop,bank"
```

## Default Behavior

When no filters are specified, all tests run:

```bash
# Run all tests
./gradlew testE2E
```

This is equivalent to:

```bash
./gradlew testE2E -PtestFiles="" -PtestNames=""
```

## Filter Format

### Valid Formats

```bash
# Single pattern
-PtestFiles="pattern"
-PtestNames="pattern"

# Multiple patterns (comma-separated, no spaces)
-PtestFiles="pattern1,pattern2,pattern3"
-PtestNames="test1,test2,test3"

# Both filters
-PtestFiles="file1,file2" -PtestNames="name1,name2"
```

### Invalid Formats

```bash
# ❌ Spaces after commas (will not match)
-PtestFiles="pattern1, pattern2"

# ❌ Quotes inside patterns (unnecessary)
-PtestNames="'test name'"

# ❌ Wildcards (not supported, use partial matching)
-PtestFiles="*.spec"
```

## Tips

1. **Start broad, then narrow**: Begin with file filters, add name filters if needed
2. **Use partial matching**: No need for exact matches - "shop" matches "shop.spec.ts"
3. **Case matters**: Filters are case-sensitive
4. **No regex**: Filters use simple substring matching, not regular expressions
5. **Debug with logs**: Add `console.log` to tests to verify they're running

## Testing Your Filters

Verify filters work as expected:

```bash
# Add a console.log to your test
test('my test', async ({ player }) => {
  console.log('Running: my test');
  // ... test code
});

# Run with filter
./gradlew testE2E -PtestNames="my test"

# Should see "Running: my test" in output
```

## CI/CD Integration

Use filters in your CI pipeline:

```yaml
# GitHub Actions example
- name: Run smoke tests
  run: ./gradlew testE2E -PtestFiles="smoke"

- name: Run critical tests
  run: ./gradlew testE2E -PtestNames="critical,must-pass"
```

## Next Steps

- [Writing Tests](Writing-Tests) - Organize tests for better filtering
- [Configuration](Configuration) - Additional test configuration options
- [Troubleshooting](Troubleshooting) - Common issues and solutions
