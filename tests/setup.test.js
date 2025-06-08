const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

// Set test data directory before requiring the app
process.env.BTC_TRACKER_DATA_DIR = path.join(__dirname, 'test-data-setup');
process.env.NODE_ENV = 'test';
process.env.PORT = '3030'; // Use a different port for testing

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots-setup');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Set a global timeout for all tests
jest.setTimeout(60000); // 60 seconds timeout for all tests and hooks

describe('BTC Tracker End-to-End Tests', () => {
    let browser;
    let page;
    let serverProcess;
    const baseUrl = `http://localhost:${process.env.PORT}`;
    const testUser = {
        username: 'testadmin',
        password: 'testpass123',
        pin: '5678'  // Add PIN for testing
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
        
        // Give the server time to start (longer wait in CI)
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Initialize browser with more flexible configuration
        try {
            const puppeteerConfig = {
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                ignoreDefaultArgs: ['--disable-extensions'],
            };
            
            // Try to use system Chrome installation if available
            if (process.platform === 'linux') {
                // Common Linux Chrome paths
                const possiblePaths = [
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/chromium',
                    '/usr/bin/chromium-browser'
                ];
                
                for (const chromePath of possiblePaths) {
                    if (fs.existsSync(chromePath)) {
                        console.log(`Using Chrome at: ${chromePath}`);
                        puppeteerConfig.executablePath = chromePath;
                        break;
                    }
                }
            } else if (process.platform === 'win32') {
                // Windows Chrome paths
                const possiblePaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
                ];
                
                for (const chromePath of possiblePaths) {
                    if (fs.existsSync(chromePath)) {
                        console.log(`Using Chrome at: ${chromePath}`);
                        puppeteerConfig.executablePath = chromePath;
                        break;
                    }
                }
            } else if (process.platform === 'darwin') {
                // MacOS Chrome path
                const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                if (fs.existsSync(chromePath)) {
                    console.log(`Using Chrome at: ${chromePath}`);
                    puppeteerConfig.executablePath = chromePath;
                }
            }
            
            console.log('Launching browser with config:', JSON.stringify(puppeteerConfig, null, 2));
            browser = await puppeteer.launch(puppeteerConfig);
            
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
        } catch (error) {
            console.error('Failed to launch browser:', error);
            
            // Try again with just the basic configuration
            console.log('Trying again with basic configuration...');
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
        }
    });
    
    afterAll(async () => {
        // Cleanup browser
        if (browser) {
            try {
                console.log('Closing browser...');
                await browser.close();
            } catch (error) {
                console.log('Error closing browser:', error.message);
            }
        }
        
        // Terminate the server
        if (serverProcess && !serverProcess.killed) {
            console.log('Stopping application server...');
            try {
                serverProcess.kill('SIGTERM');
                
                // Wait for graceful shutdown, then force kill if needed
                await new Promise(resolve => {
                    const timeout = setTimeout(() => {
                        if (!serverProcess.killed) {
                            console.log('Force killing server process...');
                            serverProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                    
                    serverProcess.on('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
                
            } catch (error) {
                console.log('Error stopping server:', error.message);
            }
        }
        
        console.log('Cleanup complete');
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
                path: path.join(screenshotsDir, '1.ERROR-app-launch-FAILED-setup-page.png')
            });
            throw error;
        }
        
        // Take screenshot of successful setup page
        await page.screenshot({
            path: path.join(screenshotsDir, '1.1-setup-page.png')
        });
        
        console.log('Application launched successfully');
    });
    
    test('2. User creation works correctly', async () => {
        let testPassed = true;

        try {
            // Fill the setup form
            await page.type('input[name="username"]', testUser.username);
            await page.type('input[name="password"]', testUser.password);
            await page.type('input[name="confirmPassword"]', testUser.password);
            
            // Make sure PIN is NOT enabled initially
            const hasPinCheckbox = await page.evaluate(() => {
                return !!document.querySelector('#enablePin');
            });
            
            if (hasPinCheckbox) {
                console.log('Ensuring PIN is disabled for initial creation');
                const isPinEnabled = await page.evaluate(() => {
                    return document.querySelector('#enablePin').checked;
                });
                
                if (isPinEnabled) {
                    // Uncheck the PIN checkbox to disable PIN initially
                    await page.click('#enablePin');
                }
            }
            
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
            // Verify PIN is disabled initially
            expect(users[0].pinEnabled).toBeFalsy();
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
            
            // Switch to Standard Login tab if PIN Login is showing by default
            console.log('Checking login page UI and switching to Standard Login if needed');
            
            // Wait a bit for the login page to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Take a screenshot to see the current state
            await page.screenshot({
                path: path.join(screenshotsDir, 'login-page-initial.png')
            });
            
            // Check if we need to switch to standard login
            const needToSwitchToStandard = await page.evaluate(() => {
                // Check for tab-based UI
                const standardLoginTab = document.querySelector('#standard-login-tab');
                const standardLoginSection = document.querySelector('#standard-login-section');
                
                // Check for link-based UI
                const toStandardLoginLink = document.querySelector('#to-standard-login');
                
                // Check if standard login form is hidden
                const standardLoginForm = document.querySelector('form[action="/login"]');
                const standardLoginVisible = standardLoginForm && 
                    window.getComputedStyle(standardLoginForm.parentElement).display !== 'none';
                
                // We need to switch if:
                // 1. Standard login tab exists but is not active, or
                // 2. There's a link to switch to standard login, or
                // 3. The standard login form is not visible
                return (standardLoginTab && !standardLoginTab.classList.contains('active')) ||
                       !!toStandardLoginLink ||
                       (standardLoginSection && window.getComputedStyle(standardLoginSection).display === 'none') ||
                       !standardLoginVisible;
            });
            
            if (needToSwitchToStandard) {
                console.log('Need to switch to Standard Login tab');
                
                // Try clicking the tab first if it exists
                const hasTab = await page.evaluate(() => {
                    const tab = document.querySelector('#standard-login-tab');
                    if (tab) {
                        tab.click();
                        return true;
                    }
                    return false;
                });
                
                if (hasTab) {
                    console.log('Clicked the Standard Login tab');
                } else {
                    // Try the link instead
                    const hasLink = await page.evaluate(() => {
                        const link = document.querySelector('#to-standard-login');
                        if (link) {
                            link.click();
                            return true;
                        }
                        return false;
                    });
                    
                    if (hasLink) {
                        console.log('Clicked the link to Standard Login');
                    } else {
                        console.log('Could not find a way to switch to Standard Login');
                    }
                }
                
                // Wait for UI to update
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Take a screenshot after switching
                await page.screenshot({
                    path: path.join(screenshotsDir, 'login-page-after-switch.png')
                });
            } else {
                console.log('Standard login already active, no need to switch');
            }
            
            // Fill in login credentials
            console.log('Looking for username and password fields');
            
            // Take another screenshot to verify form is visible
            await page.screenshot({
                path: path.join(screenshotsDir, 'login-before-filling.png')
            });
            
            // Wait for the username field to be visible
            await page.waitForSelector('input[name="username"]', { visible: true, timeout: 5000 });
            
            console.log('Filling username and password');
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
    
    
    test('4. Ticker container is present and working on all pages', async () => {
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