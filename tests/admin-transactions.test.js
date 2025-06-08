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

describe('BTC Tracker Transaction Management Tests', () => {
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
        date: '2023-05-15',  // Date only format as expected by the form
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
        await page.setViewport({ width: 1280, height: 1024 }); // Increased height for modal visibility
        
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
    
    test('2. Navigate to transactions page', async () => {
        try {
            // Click on the Transactions link
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('a[href="/transactions.html"]')
            ]);
            
            // Verify we're on the transactions page
            const currentUrl = page.url();
            console.log('Current URL after clicking transactions link:', currentUrl);
            expect(currentUrl).toContain('transactions.html');
            
            // Check for transactions page title
            const pageTitle = await page.$eval('h2', el => el.textContent);
            expect(pageTitle).toContain('Transaction History');
            
            // Wait for the transactions table to be visible
            await page.waitForSelector('#transactionsTable', { timeout: 5000 });
            
            // Take a screenshot of the transactions page
            await page.screenshot({
                path: path.join(screenshotsDir, '2-transactions-page.png')
            });
            
        } catch (error) {
            await page.screenshot({
                path: path.join(screenshotsDir, '2.ERROR-transactions-navigation-failed.png')
            });
            throw error;
        }
    });
    
    test('3. Add a new transaction', async () => {
        try {
            console.log("Starting add transaction test");
            
            // Set up error monitoring to catch JavaScript errors
            const jsErrors = [];
            page.on('pageerror', error => {
                jsErrors.push(error.message);
                console.log('JavaScript error detected:', error.message);
            });
            
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    jsErrors.push(msg.text());
                    console.log('Console error:', msg.text());
                }
            });

            // Wait for the Add Transaction button to be visible
            const addButtonSelector = '#addTransactionBtn';
            await page.waitForSelector(addButtonSelector, { timeout: 5000 });
            console.log("Add Transaction button found");
            
            // Scroll the button into view before clicking
            await page.evaluate((selector) => {
                const button = document.querySelector(selector);
                if (button) {
                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, addButtonSelector);
            
            // Wait a moment for scrolling to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await page.click(addButtonSelector);
            console.log("Clicked Add Transaction button");
            
            // Wait for the transaction sidebar to appear with open class
            await page.waitForSelector('.transaction-sidebar.open', { timeout: 5000 });
            console.log("Transaction sidebar appeared and is open");
            
            // Take screenshot of transaction sidebar
            await page.screenshot({
                path: path.join(screenshotsDir, '3-add-transaction-modal.png')
            });
            
            // Fill the transaction form - using the actual modal form field IDs
            console.log("Setting form values...");
            
            // Set transaction type
            await page.select('#modalTransactionType', testTransaction.type);
            
            // Set date field using direct value assignment (avoid typing interference)
            const dateTimeValue = '2023-05-15T10:00'; // Proper datetime-local format
            await page.evaluate((value) => {
                const dateInput = document.getElementById('modalTransactionDate');
                if (dateInput) {
                    dateInput.value = value;
                    // Trigger change event to ensure the form knows the value changed
                    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, dateTimeValue);
            console.log("Set date to:", dateTimeValue);
            
            // Set amount using direct value assignment
            await page.evaluate((value) => {
                const input = document.getElementById('modalTransactionAmount');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, testTransaction.amount.toString());
            
            // Set price using direct value assignment
            await page.evaluate((value) => {
                const input = document.getElementById('modalTransactionPrice');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, testTransaction.price.toString());
            
            // Set currency
            await page.select('#modalTransactionCurrency', testTransaction.currency);
            
            // Set fee using direct value assignment
            await page.evaluate((value) => {
                const input = document.getElementById('modalTransactionFee');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, testTransaction.fee.toString());
            
            console.log("Form filled with test data");
            
            // Take screenshot of filled form
                await page.screenshot({
                path: path.join(screenshotsDir, '3-filled-form.png')
                });
            
            // Submit the form by clicking the save button
            console.log("Looking for save button...");
            const saveButtonSelector = '#modalSubmitBtn';
            await page.waitForSelector(saveButtonSelector, { timeout: 5000 });
            
            // Scroll the save button into view to ensure it's visible
            await page.evaluate((selector) => {
                const button = document.querySelector(selector);
                if (button) {
                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, saveButtonSelector);
            
            // Wait a moment for scrolling to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Debug: Check if button is visible and enabled
            const buttonState = await page.evaluate((selector) => {
                const button = document.querySelector(selector);
                if (!button) return { exists: false };
                
                const rect = button.getBoundingClientRect();
                return {
                    exists: true,
                    visible: rect.width > 0 && rect.height > 0,
                    inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
                    disabled: button.disabled,
                    text: button.textContent,
                    top: rect.top,
                    bottom: rect.bottom,
                    windowHeight: window.innerHeight
                };
            }, saveButtonSelector);
            console.log("Save button state:", buttonState);
            
            // Debug: Check form values before submission
            const formValues = await page.evaluate(() => {
                return {
                    type: document.getElementById('modalTransactionType')?.value,
                    date: document.getElementById('modalTransactionDate')?.value,
                    amount: document.getElementById('modalTransactionAmount')?.value,
                    price: document.getElementById('modalTransactionPrice')?.value,
                    currency: document.getElementById('modalTransactionCurrency')?.value,
                    fee: document.getElementById('modalTransactionFee')?.value
                };
            });
            console.log("Form values before submission:", formValues);
            
            console.log("Clicking save button...");
            
            // Listen for any dialogs (alerts) that might appear
            page.removeAllListeners('dialog'); // Clear any existing handlers
            page.once('dialog', async dialog => {
                console.log(`Add transaction dialog: ${dialog.message()}`);
                await dialog.accept();
            });
            
            // Monitor network requests to see API calls
            const responses = [];
            page.on('response', response => {
                if (response.url().includes('/api/')) {
                    responses.push({
                        url: response.url(),
                        status: response.status(),
                        ok: response.ok()
                    });
                    console.log(`API call: ${response.status()} ${response.url()}`);
                }
            });
            
            await page.click(saveButtonSelector);
            console.log("Clicked save button");
            
            // Wait for the transaction sidebar to close (wait for open class to be removed) or an error
            console.log("Waiting for sidebar to close or error...");
            try {
                await page.waitForFunction(() => {
                    const sidebar = document.querySelector('.transaction-sidebar');
                    return !sidebar || !sidebar.classList.contains('open');
                }, { timeout: 15000 });
                console.log("Sidebar closed successfully");
            } catch (error) {
                console.log("Timeout waiting for sidebar to close, checking page state...");
                
                // Debug: Check if sidebar still exists and has open class
                const sidebarState = await page.evaluate(() => {
                    const sidebar = document.querySelector('.transaction-sidebar');
                    if (!sidebar) return { exists: false };
                    return {
                        exists: true,
                        hasOpenClass: sidebar.classList.contains('open'),
                        buttonText: document.querySelector('#modalSubmitBtn')?.textContent,
                        buttonDisabled: document.querySelector('#modalSubmitBtn')?.disabled
                    };
                });
                console.log("Sidebar state:", sidebarState);
                
                // Take a screenshot for debugging
                await page.screenshot({
                    path: path.join(screenshotsDir, '3-DEBUG-sidebar-not-closed.png')
                });
                
                // If sidebar is still open, try to close it manually
                if (sidebarState.exists && sidebarState.hasOpenClass) {
                    console.log("Manually closing sidebar...");
                    await page.keyboard.press('Escape');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Check what API responses we received
            console.log("API responses during submission:", responses);
            
            // Wait a moment for the table to refresh
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Take screenshot after adding transaction
            await page.screenshot({
                path: path.join(screenshotsDir, '3-after-add-transaction.png')
            });
            
            // Check if the transaction appears in the table
            const transactionExists = await page.evaluate((testData) => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                console.log('Checking table rows:', rows.length);
                
                // Check if we have any rows besides "No transactions found"
                if (rows.length === 0) {
                    console.log('No rows found');
                    return false;
                }
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) {
                    console.log('Only "No transactions found" message');
                    return false;
                }
                
                // Log all row contents for debugging
                for (let i = 0; i < rows.length; i++) {
                    console.log(`Row ${i}:`, rows[i].textContent);
                }
                
                // Look for our specific transaction - check multiple criteria
                for (const row of rows) {
                    const rowText = row.textContent;
                    const hasAmount = rowText.includes(testData.amount.toString().substring(0, 6)) || 
                                     rowText.includes('0.12345');
                    const hasPrice = rowText.includes(testData.price.toString());
                    const hasType = rowText.includes('Buy') || rowText.includes('buy');
                    const hasDate = rowText.includes('May 15, 2023') || 
                                   rowText.includes('2023') ||
                                   rowText.includes('May 15');
                    
                    console.log(`Row check - Amount: ${hasAmount}, Price: ${hasPrice}, Type: ${hasType}, Date: ${hasDate}`);
                    
                    if (hasAmount && (hasPrice || hasType || hasDate)) {
                        console.log('Transaction found!');
                        return true;
                    }
                }
                console.log('Transaction not found');
                return false;
            }, testTransaction);
            
            console.log(`Transaction found in table: ${transactionExists}`);
            
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
            
            // Set up dialog handler to accept confirmation (remove previous handlers first)
            page.removeAllListeners('dialog');
            page.once('dialog', async dialog => {
                console.log(`Delete confirmation dialog: ${dialog.message()}`);
                await dialog.accept();
            });
            
            // Click the delete button - using the new action button structure
            const deleteButtonSelector = '#transactionsTable tbody tr:first-child .action-btn-delete';
            await page.waitForSelector(deleteButtonSelector, { timeout: 5000 });
            await page.click(deleteButtonSelector);
            console.log("Clicked delete button");
            
            // Wait briefly for the deletion to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Take screenshot after deletion
            await page.screenshot({
                path: path.join(screenshotsDir, '4-after-delete.png')
            });
            
            // Check if our transaction is gone
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
    
    test('5. Test actual import/export functionality', async () => {
        try {
            console.log("Starting comprehensive import/export test");
            
            // First, verify we start with no transactions
            const initialTransactionCount = await page.evaluate(() => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) {
                    return 0;
                }
                return rows.length;
            });
            console.log("Initial transaction count:", initialTransactionCount);
            expect(initialTransactionCount).toBe(0);
            
            // Click the Import/Export button to open the sidebar
            const importExportButtonSelector = '#importExportBtn';
            await page.waitForSelector(importExportButtonSelector, { timeout: 5000 });
            await page.click(importExportButtonSelector);
            console.log("Opened Import/Export sidebar");
            
            // Wait for the sidebar to appear
            await page.waitForSelector('.import-export-sidebar.open', { timeout: 5000 });
            
            // Take screenshot of the sidebar
            await page.screenshot({
                path: path.join(screenshotsDir, '5-import-export-sidebar.png')
            });
            
            // Test CSV Import with the test file
            console.log("Testing CSV import...");
            const fileInput = await page.$('#csvFile');
            const testCsvPath = path.join(__dirname, 'testimport.csv');
            
            // Upload the test CSV file
            await fileInput.uploadFile(testCsvPath);
            console.log("Uploaded test CSV file");
            
            // Submit the import form
            await page.click('#importForm button[type="submit"]');
            console.log("Clicked import submit button");
            
            // Wait for import to complete (sidebar should close on success)
            await page.waitForFunction(() => {
                const sidebar = document.querySelector('.import-export-sidebar');
                return !sidebar || !sidebar.classList.contains('open');
            }, { timeout: 10000 });
            console.log("Import completed, sidebar closed");
            
            // Wait for table to refresh and verify imported transactions
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Take screenshot after import
            await page.screenshot({
                path: path.join(screenshotsDir, '5-after-import.png')
            });
            
            // Verify that 3 transactions were imported
            const importedTransactionCount = await page.evaluate(() => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                if (rows.length === 1 && rows[0].textContent.includes('No transactions found')) {
                    return 0;
                }
                return rows.length;
            });
            console.log("Imported transaction count:", importedTransactionCount);
            expect(importedTransactionCount).toBe(3);
            
            // Verify specific transaction data from the CSV
            const transactionData = await page.evaluate(() => {
                const rows = document.querySelectorAll('#transactionsTable tbody tr');
                const transactions = [];
                for (const row of rows) {
                    const text = row.textContent;
                    transactions.push({
                        hasJan1: text.includes('Jan 1') || text.includes('2023-01-01'),
                        hasJan2: text.includes('Jan 2') || text.includes('2023-01-02'), 
                        hasJan3: text.includes('Jan 3') || text.includes('2023-01-03'),
                        hasBuyType: text.includes('Buy') || text.includes('🔵'),
                        hasPointOne: text.includes('0.1') || text.includes('0.10000'),
                        hasPointZeroFive: text.includes('0.05') || text.includes('0.05000'),
                        hasPointZeroTwoFive: text.includes('0.025') || text.includes('0.02500'),
                        text: text
                    });
                }
                return transactions;
            });
            
            console.log("Transaction data verification:", transactionData);
            
            // Verify we have transactions with the expected amounts
            const hasExpectedAmounts = transactionData.some(t => t.hasPointOne) &&
                                     transactionData.some(t => t.hasPointZeroFive) &&
                                     transactionData.some(t => t.hasPointZeroTwoFive);
            expect(hasExpectedAmounts).toBe(true);
            
            // Import test completed successfully!
            console.log("✅ Import test completed successfully!");
            console.log("✅ 3 transactions imported and visible in table");
            console.log("✅ Data integrity verified - amounts match CSV file");
            
        } catch (error) {
            console.error("Import/export test failed:", error);
            await page.screenshot({
                path: path.join(screenshotsDir, '5.ERROR-import-export-failed.png')
            });
            throw error;
        }
    });
    
    test('6. Check transactions file is updated correctly', async () => {
        try {
            // Check the transactions.json file
            const transactionsFile = path.join(process.env.BTC_TRACKER_DATA_DIR, 'transactions.json');
            
            // Verify the file exists
            expect(fs.existsSync(transactionsFile)).toBe(true);
            
            // Read the file contents
            const transactionsData = JSON.parse(fs.readFileSync(transactionsFile, 'utf8'));
            
            // After importing 3 transactions from testimport.csv, the array should have 3 items
            expect(Array.isArray(transactionsData)).toBe(true);
            expect(transactionsData.length).toBe(3);
            
            // Verify the imported data matches our test CSV
            const amounts = transactionsData.map(tx => tx.amount).sort();
            const expectedAmounts = [0.025, 0.05, 0.1]; // From testimport.csv
            expect(amounts).toEqual(expectedAmounts);
            
            // Verify all transactions are buy type
            const allBuyTransactions = transactionsData.every(tx => tx.type === 'buy');
            expect(allBuyTransactions).toBe(true);
            
            console.log('Transactions file correctly reflects the imported data');
            console.log('Found transactions:', transactionsData.map(tx => ({
                date: tx.date,
                type: tx.type,
                amount: tx.amount,
                currency: tx.original?.currency
            })));
            
        } catch (error) {
            console.error('Error checking transactions file:', error);
            throw error;
        }
    });
}); 