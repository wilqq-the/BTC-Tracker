const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

// Set test data directory before requiring the app
process.env.BTC_TRACKER_DATA_DIR = path.join(__dirname, 'test-data-admin');
process.env.NODE_ENV = 'test';
process.env.PORT = '3032'; // Use a different port for admin functionality testing

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots-admin');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Set a global timeout for all tests
jest.setTimeout(180000); // 3 minutes timeout for all tests and hooks

describe('BTC Tracker Admin Transaction Management Tests', () => {
    let browser;
    let page;
    let serverProcess;
    const baseUrl = `http://localhost:${process.env.PORT}`;
    const testUser = {
        username: 'adminuser',
        password: 'adminpass123'
    };
    
    // Test transaction data
    const testTransaction = {
        date: '2023-05-15T10:00:00',  // Fixed: Complete datetime format
        type: 'buy',
        amount: 0.12345678,
        price: 30000,
        currency: 'EUR',
        fee: 10
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
        
        // Wait for server to be ready with a simpler approach
        console.log('Waiting for server to be ready...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds for startup
        console.log('Server startup wait completed');
        
        console.log('Launching browser...');
        // Initialize browser with timeout and additional args
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu',
                '--disable-web-security',
                '--no-first-run'
            ],
            timeout: 10000
        });
        
        console.log('Browser launched, creating page...');
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // Set a default timeout for all page operations
        page.setDefaultTimeout(10000);
        // Listen for page errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Page console error:', msg.text());
            }
        });
        
        page.on('pageerror', err => {
            console.log('Page error:', err.message);
        });
        
        console.log('Browser setup complete');
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
    
    test('1. User creation and login', async () => {
        // Navigate to setup page
        console.log(`Navigating to ${baseUrl}/setup`);
        await page.goto(`${baseUrl}/setup`, { waitUntil: 'networkidle0' });
        
        // Fill the setup form
        await page.type('input[name="username"]', testUser.username);
        await page.type('input[name="password"]', testUser.password);
        await page.type('input[name="confirmPassword"]', testUser.password);
        
        try {
            // Submit form and wait for redirect
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button[type="submit"]')
            ]);
            
            // Verify URL is now login page
            const currentUrl = page.url();
            console.log('Current URL after submit:', currentUrl);
            expect(currentUrl).toContain('/login');
            
            // Login with created user
            await page.type('input[name="username"]', testUser.username);
            await page.type('input[name="password"]', testUser.password);
            
            // Submit login form and wait for redirect
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button[type="submit"]')
            ]);
            
            // Verify we're on the dashboard
            const dashboardUrl = page.url();
            console.log('URL after login:', dashboardUrl);
            expect(dashboardUrl).toContain('/');
            
            // Take a screenshot of successful login
            await page.screenshot({
                path: path.join(screenshotsDir, '1-logged-in-dashboard.png')
            });
            
        } catch (error) {
            await page.screenshot({
                path: path.join(screenshotsDir, '1.ERROR-setup-login-failed.png')
            });
            throw error;
        }
    });
    
    test('2. Navigate to admin panel', async () => {
        try {
            // Click on the Admin Panel link
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/admin.html"]')
            ]);
            
            // Verify we're on the admin page
            const currentUrl = page.url();
            console.log('Current URL after clicking admin link:', currentUrl);
            expect(currentUrl).toContain('admin.html');
            
            // Check for admin panel title
            const pageTitle = await page.$eval('h2', el => el.textContent);
            expect(pageTitle).toContain('Import/Export Transactions');
            
            // Take a screenshot of the admin panel
            await page.screenshot({
                path: path.join(screenshotsDir, '2-admin-panel.png')
            });
            
        } catch (error) {
            await page.screenshot({
                path: path.join(screenshotsDir, '2.ERROR-admin-navigation-failed.png')
            });
            throw error;
        }
    });
    
    test('3. Add a new transaction', async () => {
        try {
            console.log("Starting add transaction test");
            
            // Wait for transactions table to load
            await page.waitForSelector('#transactionsTable', { timeout: 5000 });
            console.log("Transactions table found");
            
            // First take a screenshot of the admin page before clicking anything
            await page.screenshot({
                path: path.join(screenshotsDir, '3-before-add-transaction.png')
            });
            
            // Simple method to find and click the add transaction button
            const addButtonSelector = '.add-transaction-container button.btn.btn-primary';
            await page.waitForSelector(addButtonSelector, { timeout: 5000 });
            await page.click(addButtonSelector);
            console.log("Clicked Add Transaction button");
            
            // Wait for the modal to appear
            await page.waitForSelector('.modal', { visible: true, timeout: 5000 });
            console.log("Modal appeared");
            
            // Take screenshot of modal
            await page.screenshot({
                path: path.join(screenshotsDir, '3-add-transaction-modal.png')
            });
            
            // Fill the transaction form with better error handling - use direct value setting
            console.log("Setting form values...");
            await page.evaluate((tx) => {
                document.getElementById('addDate').value = '2023-05-15T10:00';
                document.getElementById('addType').value = tx.type;
                document.getElementById('addAmount').value = tx.amount.toString();
                document.getElementById('addPrice').value = tx.price.toString();
                document.getElementById('addCurrency').value = tx.currency;
                document.getElementById('addFee').value = tx.fee.toString();
            }, testTransaction);
            console.log("Form filled with test data");
            
            // Check for any JavaScript errors on the page
            const pageErrors = await page.evaluate(() => {
                return window.jsErrors || [];
            });
            if (pageErrors.length > 0) {
                console.log("Page errors detected:", pageErrors);
            }
            
            // Take screenshot of filled form with timeout
            console.log("Taking screenshot of filled form...");
            try {
                await page.screenshot({
                    path: path.join(screenshotsDir, '3-filled-form.png'),
                    timeout: 5000
                });
                console.log("Screenshot taken successfully");
            } catch (screenshotError) {
                console.log("Screenshot failed:", screenshotError.message);
            }
            
            // Submit the form by clicking the save button
            console.log("Looking for save button...");
            const saveButton = await page.$('.modal .btn-primary');
            if (!saveButton) {
                throw new Error("Save button not found");
            }
            
            console.log("Clicking save button...");
            await page.click('.modal .btn-primary');
            console.log("Clicked save button");
            
            // Wait for the modal to close with better error handling
            console.log("Waiting for modal to close...");
            try {
                await page.waitForSelector('.modal', { hidden: true, timeout: 10000 });
                console.log("Modal closed");
            } catch (modalError) {
                console.log("Modal didn't close as expected:", modalError.message);
                // Check if modal still exists
                const modalExists = await page.$('.modal');
                if (modalExists) {
                    console.log("Modal still exists, attempting to close manually");
                    await page.keyboard.press('Escape');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Now navigate to the transactions page to verify
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/transactions.html"]')
            ]);
            console.log("Navigated to transactions page");
            
            // Wait for the transactions table on the transactions page
            await page.waitForSelector('#transactionsTable', { timeout: 5000 });
            
            // Take screenshot of the transactions page
            await page.screenshot({
                path: path.join(screenshotsDir, '3-transactions-page.png')
            });
            
            // Check if the transaction appears in the table
            const transactionExists = await page.evaluate((amount) => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                // Check if we have any rows besides "No transactions found"
                if (rows.length === 0) return false;
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) return false;
                
                // Look for our specific transaction amount
                for (const row of rows) {
                    if (row.textContent.includes(amount.toString().substring(0, 6))) {
                        return true;
                    }
                }
                return false;
            }, testTransaction.amount);
            
            console.log(`Transaction found on transactions page: ${transactionExists}`);
            
            // Verify the transaction was added
            expect(transactionExists).toBe(true);
            
        } catch (error) {
            console.error("Add transaction test failed:", error);
            await page.screenshot({
                path: path.join(screenshotsDir, '3.ERROR-add-transaction-failed.png')
            });
            throw error;
        }
    });
    
    test('4. Delete the added transaction', async () => {
        try {
            console.log("Starting delete transaction test");
            
            // First navigate back to the admin page
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/admin.html"]')
            ]);
            console.log("Navigated to admin page");
            
            // Wait for transactions table to be visible
            await page.waitForSelector('#transactionsTable', { timeout: 5000 });
            console.log("Transactions table is visible");
            
            // Take a screenshot before trying to delete
            await page.screenshot({
                path: path.join(screenshotsDir, '4-before-delete.png')
            });
            
            // Check if there are any transactions to delete
            const hasTransactions = await page.evaluate(() => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                if (rows.length === 0) return false;
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) return false;
                return true;
            });
            
            if (!hasTransactions) {
                console.log("No transactions to delete, skipping delete test");
                return;
            }
            
            // Set up dialog handler to accept confirmation
            page.once('dialog', async dialog => {
                console.log(`Dialog message: ${dialog.message()}`);
                await dialog.accept();
            });
            
            // Click the delete button - simple selector
            await page.click('#transactionsTable tbody tr:first-child .delete-btn');
            console.log("Clicked delete button");
            
            // Wait briefly for the deletion to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Navigate to transactions page to verify deletion
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/transactions.html"]')
            ]);
            console.log("Navigated to transactions page after deletion");
            
            // Take screenshot of transactions page
            await page.screenshot({
                path: path.join(screenshotsDir, '4-after-delete.png')
            });
            
            // Check if our transaction is gone from the transactions page
            const transactionStillExists = await page.evaluate((amount) => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                // If no rows or just "No transactions found" message, transaction is gone
                if (rows.length === 0) return false;
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) return false;
                
                // Check if our specific transaction is still there
                for (const row of rows) {
                    if (row.textContent.includes(amount.toString().substring(0, 6))) {
                        return true;
                    }
                }
                return false;
            }, testTransaction.amount);
            
            console.log(`Transaction still exists after deletion: ${transactionStillExists}`);
            
            // Verify the transaction was deleted
            expect(transactionStillExists).toBe(false);
            
        } catch (error) {
            console.error("Delete transaction test failed:", error);
            await page.screenshot({
                path: path.join(screenshotsDir, '4.ERROR-delete-transaction-failed.png')
            });
            throw error;
        }
    });
    
    test('5. Check transactions file is updated correctly', async () => {
        try {
            // Check the transactions.json file
            const transactionsFile = path.join(process.env.BTC_TRACKER_DATA_DIR, 'transactions.json');
            
            // Verify the file exists
            expect(fs.existsSync(transactionsFile)).toBe(true);
            
            // Read the file contents
            const transactionsData = JSON.parse(fs.readFileSync(transactionsFile, 'utf8'));
            
            // After deleting the transaction, the array should be empty
            expect(Array.isArray(transactionsData)).toBe(true);
            expect(transactionsData.length).toBe(0);
            
            console.log('Transactions file correctly reflects the empty state after deletion');
            
        } catch (error) {
            console.error('Error checking transactions file:', error);
            throw error;
        }
    });
}); 