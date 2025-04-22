# BTC Tracker Testing Documentation

This directory contains end-to-end tests for the BTC Tracker application using Puppeteer and Jest.

## How to Run Tests Locally

To run the tests locally, follow these steps:

```bash
# Install dependencies if you haven't already
npm install

# Run all tests
npm run test:e2e

# Run a specific test file
npx jest tests/setup.test.js

# Run tests with a custom timeout
npx jest tests/setup.test.js --testTimeout=60000
```

### Environment Variables

The tests use the following environment variables:

- `NODE_ENV`: Set to 'test' for testing
- `PORT`: Default is 3030 for testing (different from the development port)
- `BTC_TRACKER_DATA_DIR`: Directory for test data (defaults to './tests/test-data')
- `PUPPETEER_EXECUTABLE_PATH`: Optional path to Chrome executable

## How Tests Are Run

Our tests use a comprehensive end-to-end testing approach:

1. **Test Server Setup**: Tests spawn a separate Node.js process running the application
2. **Browser Automation**: Puppeteer is used to automate browser interactions
3. **Test Data**: Tests create a fresh test environment with isolated data
4. **Screenshots**: Screenshots are taken for failed tests to help with debugging

### CI/CD Integration

Tests automatically run in our GitHub Actions workflow (`.github/workflows/e2e-tests.yml`) for:
- All commits that modify certain paths (src/, tests/, package files)
- All pull requests
- Manual triggers via workflow_dispatch

The CI pipeline:
1. Sets up the test environment
2. Installs Chrome for browser testing
3. Creates test directories and sample data
4. Runs the tests
5. Uploads test screenshots as artifacts

## How to Add New Tests

To add a new test:

1. Add your test to the existing test file (`setup.test.js`) or create a new file
2. Follow the existing pattern for Jest tests
3. Use the `beforeAll` and `afterAll` hooks for setup/teardown if needed

### Test Structure Guidelines

```javascript
test('Description of what you are testing', async () => {
    let testPassed = true;
    
    try {
        // Your test logic here
        await page.goto(`${baseUrl}/your-page`);
        
        // Assertions
        expect(condition).toBe(true);
        
    } catch (error) {
        testPassed = false;
        // Take screenshot only if test fails
        await page.screenshot({
            path: path.join(screenshotsDir, 'your-test-FAILED.png')
        });
        throw error;
    }
});
```

### Helper Functions

The tests include several helper functions you can use:
- `checkTickerOnPage(pageName, pageUrl)`: Tests ticker functionality on a page

## 4. List of Current Tests

The following tests are currently implemented in `setup.test.js`:

1. **Application Launch Test**
   - Verifies the application launches successfully
   - Checks the setup page loads with expected content

2. **User Creation Test**
   - Tests creating a new administrator account
   - Verifies the user data is stored correctly

3. **User Login Test**
   - Tests login functionality
   - Verifies redirection to dashboard after login

4. **Admin Panel and CSV Import Test**
   - Tests CSV import functionality in the admin panel
   - Verifies imported data appears correctly

5. **Ticker Container Test**
   - Tests ticker functionality across all pages
   - Checks that the ticker displays real values and is not in a loading state
   - Verifies ticker values contain expected currency symbols

Each test takes screenshots on failure to help with debugging issues. 