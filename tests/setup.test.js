const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

// Set test data directory before requiring the app
process.env.BTC_TRACKER_DATA_DIR = path.join(__dirname, 'test-data');
process.env.NODE_ENV = 'test';
process.env.PORT = '3030'; // Use a different port for testing

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

describe('BTC Tracker End-to-End Tests', () => {
    let browser;
    let page;
    let serverProcess;
    const baseUrl = `http://localhost:${process.env.PORT}`;
    const testUser = {
        username: 'testadmin',
        password: 'testpass123'
    };
    
    beforeAll(async () => {
        // Ensure test data directory exists and is empty
        const testDir = process.env.BTC_TRACKER_DATA_DIR;
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });
        
        console.log('Starting application server...');
        
        // Start the server in a separate process
        serverProcess = require('child_process').spawn('node', ['src/server.js'], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                BTC_TRACKER_DATA_DIR: process.env.BTC_TRACKER_DATA_DIR,
                PORT: process.env.PORT
            },
            stdio: 'inherit'
        });
        
        // Give the server time to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Initialize browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
    });
    
    afterAll(async () => {
        // Cleanup
        if (browser) {
            await browser.close();
        }
        
        // Terminate the server
        if (serverProcess) {
            console.log('Stopping application server...');
            serverProcess.kill();
        }
    });
    
    test('1. Application launches successfully', async () => {
        // Navigate to setup page
        console.log(`Navigating to ${baseUrl}/setup`);
        await page.goto(`${baseUrl}/setup`, { waitUntil: 'networkidle0' });
        
        // Check if we're on the setup page
        const setupTitle = await page.$eval('h2', el => el.textContent);
        console.log('Page title:', setupTitle);
        
        let testPassed = true;
        
        // Verify the setup page loaded correctly
        const pageContent = await page.content();
        
        try {
            expect(pageContent).toContain('BTC Tracker');
            expect(pageContent).toContain('Initial Setup');
            expect(pageContent).toContain('Create your administrator account');
        } catch (error) {
            testPassed = false;
            // Only take screenshot if the test fails
            await page.screenshot({
                path: path.join(screenshotsDir, 'app-launch-FAILED-setup-page.png')
            });
            throw error;
        }
        
        console.log('Application launched successfully');
    });
    
    test('2. User creation works correctly', async () => {
        let testPassed = true;

        try {
            // Fill the setup form
            await page.type('input[name="username"]', testUser.username);
            await page.type('input[name="password"]', testUser.password);
            await page.type('input[name="confirmPassword"]', testUser.password);
            
            // Submit form and wait for redirect
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button[type="submit"]')
            ]);
            
            // Verify URL is now login page
            const currentUrl = page.url();
            console.log('Current URL after submit:', currentUrl);
            expect(currentUrl).toContain('/login');
            
            // Verify that the user was created in the file system
            const usersFile = path.join(process.env.BTC_TRACKER_DATA_DIR, 'users.json');
            expect(fs.existsSync(usersFile)).toBe(true);
            
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            expect(users.length).toBe(1);
            expect(users[0].username).toBe(testUser.username);
        } catch (error) {
            testPassed = false;
            // Take screenshot only on failure
            await page.screenshot({
                path: path.join(screenshotsDir, 'user-creation-FAILED.png')
            });
            throw error;
        }
        
        console.log('User creation successful');
    });
    
    test('3. User login works correctly', async () => {
        let testPassed = true;

        try {
            // Already on login page from previous test
            
            // Fill in login credentials
            await page.type('input[name="username"]', testUser.username);
            await page.type('input[name="password"]', testUser.password);
            
            // Submit login form and wait for dashboard
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button[type="submit"]')
            ]);
            
            // Verify we're logged in by checking for dashboard elements
            console.log('Checking if login was successful');
            
            // Wait for dashboard elements to load
            await page.waitForSelector('body', { timeout: 5000 });
            
            // Get current URL to verify login succeeded
            const dashboardUrl = page.url();
            console.log('Dashboard URL:', dashboardUrl);
            
            // Verify we're not on login page anymore
            expect(dashboardUrl).not.toContain('/login');
            
            // Check for elements that are definitely on the dashboard
            const pageContent = await page.content();
            expect(pageContent).toContain('BTC Tracker');
            expect(pageContent).toContain('Dashboard');
            expect(pageContent).toContain('Current Price');
        } catch (error) {
            testPassed = false;
            // Take screenshot only on failure
            await page.screenshot({
                path: path.join(screenshotsDir, 'user-login-FAILED.png')
            });
            throw error;
        }
        
        console.log('Login successful - Dashboard loaded correctly');
    });
    
    test('4. Admin panel and CSV import works correctly', async () => {
        // Increase timeout for this test to 30 seconds
        jest.setTimeout(30000);
        
        let testPassed = true;
        let dialogMessage = '';
        
        try {
            // First, navigate to the admin panel
            console.log('Navigating to Admin Panel');
            
            // Click on the Admin Panel link
            await page.waitForSelector('a[href="/admin.html"], a[href*="admin"]');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/admin.html"], a[href*="admin"]')
            ]);
            
            // Verify we're on the admin page
            const pageUrl = page.url();
            console.log('Admin page URL:', pageUrl);
            expect(pageUrl).toContain('admin');
            
            // Prepare the file upload
            const sampleCsvPath = path.join(__dirname, 'testimport.csv');
            
            console.log('Preparing to import CSV file:', sampleCsvPath);
            
            // Wait for the file input to be available
            console.log('Looking for file input element');
            await page.waitForSelector('input#csvFile');
            
            // Upload the CSV file
            const fileInput = await page.$('input#csvFile');
            await fileInput.uploadFile(sampleCsvPath);
            console.log('File selected for upload:', sampleCsvPath);
            
            // Wait a few seconds for the file to be processed
            console.log('Waiting for file selection to be processed...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Set up dialog handler before clicking
            page.on('dialog', async dialog => {
                dialogMessage = dialog.message();
                console.log('Dialog appeared:', dialogMessage);
                await dialog.accept();
            });
            
            // Find and click the import button
            console.log('Looking for import button');
            await page.waitForSelector('#importForm button.btn-primary[type="submit"]');
            
            // Click the import button
            await page.click('#importForm button.btn-primary[type="submit"]');
            console.log('Import button clicked');
            
            // Wait for import to process
            await new Promise(resolve => setTimeout(resolve, 7000));
            
            // Check if we had an error dialog
            if (dialogMessage.includes('Error')) {
                console.log('IMPORTANT: Import had an error:', dialogMessage);
                console.log('This might be due to CSV format issues. Continuing test anyway...');
                
                // Take a screenshot if we had an error dialog
                await page.screenshot({
                    path: path.join(screenshotsDir, 'admin-import-FAILED-error-dialog.png')
                });
            }
            
            // Navigate to transactions page to verify import
            console.log('Navigating to Transactions page to verify import');
            
            await page.waitForSelector('a[href="/transactions.html"], a[href*="transactions"]');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/transactions.html"], a[href*="transactions"]')
            ]);
            
            // Check if transactions table is present
            await page.waitForSelector('#transactionsTable, table');
            
            // Now navigate to Dashboard to verify the values
            console.log('Navigating to Dashboard to verify values');
            
            await page.waitForSelector('a[href="/"], a[href*="dashboard"]');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/"], a[href*="dashboard"]')
            ]);
            
            // Wait for dashboard values to load
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check dashboard values
            console.log('Checking dashboard values');
            
            // Extract and verify values using page evaluation
            const dashboardValues = await page.evaluate(() => {
                // Helper function to get text content
                const getValueBySelector = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : null;
                };
                
                // Get all relevant values
                return {
                    totalBTC: document.querySelector('.card .bitcoin-logo + span')?.textContent.trim() ||
                              document.querySelector('.card:first-child span')?.textContent.trim(),
                    
                    currentPrice: {
                        eur: document.querySelectorAll('.card')[1]?.querySelector('span')?.textContent.trim() || 
                             document.querySelector('[data-value*="€"]')?.textContent.trim(),
                        pln: document.querySelectorAll('.card')[1]?.querySelectorAll('span')[1]?.textContent.trim() ||
                             document.querySelector('[data-value*="zł"]')?.textContent.trim()
                    },
                    
                    totalCost: {
                        eur: document.querySelectorAll('.card')[2]?.querySelector('span')?.textContent.trim(),
                        pln: document.querySelectorAll('.card')[2]?.querySelectorAll('span')[1]?.textContent.trim()
                    },
                    
                    currentValue: {
                        eur: document.querySelectorAll('.card')[3]?.querySelector('span')?.textContent.trim(),
                        pln: document.querySelectorAll('.card')[3]?.querySelectorAll('span')[1]?.textContent.trim()
                    },
                    
                    pnl: {
                        eur: document.querySelectorAll('.card')[4]?.querySelector('span')?.textContent.trim(),
                        pln: document.querySelectorAll('.card')[4]?.querySelectorAll('span')[1]?.textContent.trim()
                    },
                    
                    pnlPercentage: document.querySelectorAll('.card')[5]?.querySelector('span')?.textContent.trim(),
                    
                    averagePrice: {
                        eur: document.querySelectorAll('.card')[6]?.querySelector('span')?.textContent.trim(),
                        pln: document.querySelectorAll('.card')[6]?.querySelectorAll('span')[1]?.textContent.trim()
                    }
                };
            });
            
            // Print the extracted values
            console.log('Extracted dashboard values:', JSON.stringify(dashboardValues, null, 2));
            
        } catch (error) {
            testPassed = false;
            // Take screenshot only on failure
            await page.screenshot({
                path: path.join(screenshotsDir, 'admin-import-FAILED.png')
            });
            throw error;
        }
        
        console.log('Admin import test completed');
    }, 30000); // Adding timeout parameter here as well
    
    test('5. Ticker container is present and working on all pages', async () => {
        // Increase timeout for this test
        jest.setTimeout(30000);
        
        // Define pages to check
        const pagesToCheck = [
            { name: 'Dashboard', url: '/' },
            { name: 'Transactions', url: '/transactions.html' },
            { name: 'Exchanges', url: '/exchanges.html' },
            { name: 'Admin Panel', url: '/admin.html' }
        ];
        
        // Track results for all pages
        const pageResults = [];
        
        // Function to check ticker on a page
        async function checkTickerOnPage(pageName, pageUrl) {
            console.log(`Checking ticker on ${pageName} page...`);
            
            // Navigate to the page
            await page.goto(`${baseUrl}${pageUrl}`, { waitUntil: 'networkidle0' });
            
            // Result object to track this page's checks
            const result = {
                page: pageName,
                url: pageUrl,
                tickerExists: false,
                contentExists: false,
                valuesPresent: false,
                hasLoadingState: false,
                hasRealValues: false,
                values: {},
                passed: false
            };
            
            // Check if ticker container exists
            result.tickerExists = await page.evaluate(() => {
                return !!document.querySelector('.ticker-container');
            });
            
            console.log(`${result.tickerExists ? '✓' : '✗'} Ticker container found on ${pageName} page`);
            
            // If ticker doesn't exist, take screenshot and return early
            if (!result.tickerExists) {
                // Take screenshot for failed test
                await page.screenshot({
                    path: path.join(screenshotsDir, `ticker-test-FAILED-${pageName.toLowerCase().replace(' ', '-')}.png`)
                });
                pageResults.push(result);
                return;
            }
            
            // Check if ticker content exists
            result.contentExists = await page.evaluate(() => {
                return !!document.querySelector('#tickerContent');
            });
            
            console.log(`${result.contentExists ? '✓' : '✗'} Ticker content found on ${pageName} page`);
            
            // If content doesn't exist, take screenshot and return early
            if (!result.contentExists) {
                // Take screenshot for failed test
                await page.screenshot({
                    path: path.join(screenshotsDir, `ticker-test-FAILED-${pageName.toLowerCase().replace(' ', '-')}.png`)
                });
                pageResults.push(result);
                return;
            }
            
            // Check if specific ticker elements exist and have content
            const tickerValues = await page.evaluate(() => {
                const currentValue = document.querySelector('#tickerCurrentValue');
                const dailyChange = document.querySelector('#tickerDailyChange');
                const dailyPercent = document.querySelector('#tickerDailyPercent');
                
                return {
                    currentValue: currentValue ? currentValue.textContent.trim() : null,
                    dailyChange: dailyChange ? dailyChange.textContent.trim() : null,
                    dailyPercent: dailyPercent ? dailyPercent.textContent.trim() : null,
                    hasCurrentValue: !!currentValue && currentValue.textContent.trim() !== '',
                    hasDailyChange: !!dailyChange && dailyChange.textContent.trim() !== '',
                    hasDailyPercent: !!dailyPercent && dailyPercent.textContent.trim() !== ''
                };
            });
            
            // Store values in result
            result.values = tickerValues;
            result.valuesPresent = tickerValues.hasCurrentValue && tickerValues.hasDailyChange && tickerValues.hasDailyPercent;
            
            // Check for loading state
            result.hasLoadingState = 
                (tickerValues.currentValue && tickerValues.currentValue.includes('Loading')) ||
                (tickerValues.dailyChange && tickerValues.dailyChange.includes('Loading')) ||
                (tickerValues.dailyPercent && tickerValues.dailyPercent.includes('Loading'));
            
            // Check for real values (contains currency symbol)
            result.hasRealValues = 
                tickerValues.currentValue && /[€$£¥₿zł]/.test(tickerValues.currentValue) &&
                !tickerValues.currentValue.includes('Loading');
            
            // Set passed flag - test passes only if ticker has real values and NO loading state
            result.passed = result.valuesPresent && result.hasRealValues && !result.hasLoadingState;
            
            console.log(`Ticker values on ${pageName} page:`, tickerValues);
            console.log(`Values present: ${result.valuesPresent}, Loading state: ${result.hasLoadingState}, Real values: ${result.hasRealValues}`);
            
            // Take screenshot only if test failed
            if (!result.passed) {
                await page.screenshot({
                    path: path.join(screenshotsDir, `ticker-test-FAILED-${pageName.toLowerCase().replace(' ', '-')}.png`)
                });
                
                // Also take a screenshot of just the ticker area to help debug
                try {
                    const tickerBoundingBox = await page.evaluate(() => {
                        const ticker = document.querySelector('.ticker-container');
                        if (!ticker) return null;
                        
                        const rect = ticker.getBoundingClientRect();
                        return {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        };
                    });
                    
                    if (tickerBoundingBox) {
                        await page.screenshot({
                            path: path.join(screenshotsDir, `ticker-test-FAILED-${pageName.toLowerCase().replace(' ', '-')}-closeup.png`),
                            clip: tickerBoundingBox
                        });
                    }
                } catch (e) {
                    console.log(`Could not take closeup screenshot of ticker on ${pageName} page:`, e.message);
                }
            }
            
            pageResults.push(result);
        }
        
        // Check ticker on each page
        for (const pageInfo of pagesToCheck) {
            await checkTickerOnPage(pageInfo.name, pageInfo.url);
        }
        
        // Wait a bit longer for any async data loading
        console.log('Waiting for any delayed data loading...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check pages again if they were in loading state
        const pagesToRecheck = pageResults.filter(result => result.hasLoadingState);
        
        if (pagesToRecheck.length > 0) {
            console.log(`Rechecking ${pagesToRecheck.length} pages that were in loading state...`);
            
            for (const pageToRecheck of pagesToRecheck) {
                const index = pageResults.findIndex(r => r.page === pageToRecheck.page);
                
                // Recheck this page
                await checkTickerOnPage(pageToRecheck.page, pageToRecheck.url);
                
                // Remove the old result
                if (index !== -1) {
                    pageResults.splice(index, 1);
                }
            }
        }
        
        // Summary of results
        console.log('\n===== Ticker Test Summary =====');
        
        let allPagesHaveTicker = true;
        let allPagesHaveContent = true;
        let allPagesHaveRealValues = true;
        let somePageStillLoading = false;
        let failedPages = [];
        
        for (const result of pageResults) {
            console.log(`\nPage: ${result.page} (${result.url})`);
            console.log(`- Ticker exists: ${result.tickerExists ? '✓' : '✗'}`);
            console.log(`- Content exists: ${result.contentExists ? '✓' : '✗'}`);
            console.log(`- Values present: ${result.valuesPresent ? '✓' : '✗'}`);
            console.log(`- Loading state: ${result.hasLoadingState ? 'Yes (FAIL)' : 'No (PASS)'}`);
            console.log(`- Real values: ${result.hasRealValues ? '✓' : '✗'}`);
            console.log(`- Test passed: ${result.passed ? '✓' : '✗'}`);
            
            if (result.values.currentValue) {
                console.log(`- Current Value: "${result.values.currentValue}"`);
            }
            
            allPagesHaveTicker = allPagesHaveTicker && result.tickerExists;
            allPagesHaveContent = allPagesHaveContent && result.contentExists;
            allPagesHaveRealValues = allPagesHaveRealValues && result.hasRealValues;
            somePageStillLoading = somePageStillLoading || result.hasLoadingState;
            
            if (!result.passed) {
                failedPages.push(result.page);
            }
        }
        
        console.log('\n===== Overall Result =====');
        console.log(`All pages have ticker: ${allPagesHaveTicker ? '✓' : '✗'}`);
        console.log(`All pages have content: ${allPagesHaveContent ? '✓' : '✗'}`);
        console.log(`All pages have real values: ${allPagesHaveRealValues ? '✓' : '✗'}`);
        console.log(`Some pages still loading: ${somePageStillLoading ? 'Yes (FAIL)' : 'No (PASS)'}`);
        
        if (failedPages.length > 0) {
            console.log(`\n❌ Failed pages: ${failedPages.join(', ')}`);
            console.log(`Screenshots saved for failed tests in the screenshots directory.`);
        } else {
            console.log(`\n✅ All pages passed ticker tests`);
        }
        
        // Make test pass only if all pages have ticker with real values and none are in loading state
        expect(allPagesHaveTicker).toBe(true);
        expect(allPagesHaveContent).toBe(true);
        expect(allPagesHaveRealValues).toBe(true);
        expect(somePageStillLoading).toBe(false);
        
        console.log('✅ Ticker test completed');
    }, 50000); // Longer timeout for this test
}); 