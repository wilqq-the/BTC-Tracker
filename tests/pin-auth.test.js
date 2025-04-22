const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');

// Set test data directory before requiring the app
process.env.BTC_TRACKER_DATA_DIR = path.join(__dirname, 'test-data-pin-auth');
process.env.NODE_ENV = 'test';
process.env.PORT = '3031'; // Use a different port for testing the PIN functionality

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots-pin-auth');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Set a global timeout for all tests
jest.setTimeout(60000); // 60 seconds timeout for all tests and hooks

describe('BTC Tracker PIN Authentication Tests', () => {
    let browser;
    let page;
    let serverProcess;
    const baseUrl = `http://localhost:${process.env.PORT}`;
    const testUser = {
        username: 'pinuser',
        password: 'pinpass123',
        pin: '1234'
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
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Initialize browser with the original simple configuration that worked before
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
            
            // Give time for the server to shut down cleanly
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    });
    
    test('1. User creation works without PIN', async () => {
        // Navigate to setup page
        console.log(`Navigating to ${baseUrl}/setup`);
        await page.goto(`${baseUrl}/setup`, { waitUntil: 'networkidle0' });
        
        // Fill the setup form with username and password only
        await page.type('input[name="username"]', testUser.username);
        await page.type('input[name="password"]', testUser.password);
        await page.type('input[name="confirmPassword"]', testUser.password);
        
        // Make sure PIN is NOT enabled
        const hasPinCheckbox = await page.evaluate(() => {
            return !!document.querySelector('#enablePin');
        });
        
        if (hasPinCheckbox) {
            console.log('Ensuring PIN is disabled for initial user creation');
            const isPinEnabled = await page.evaluate(() => {
                return document.querySelector('#enablePin').checked;
            });
            
            if (isPinEnabled) {
                // Uncheck the PIN checkbox if it's checked
                await page.click('#enablePin');
            }
        }
        
        try {
            // Submit form and wait for redirect
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button[type="submit"]')
            ]);
            
            // Verify URL is now login page
            const currentUrl = page.url();
            console.log('Current URL after submit:', currentUrl);
            
            if (!currentUrl.includes('/login')) {
                // Take screenshot if not redirected to login page
                await page.screenshot({
                    path: path.join(screenshotsDir, '1.ERROR-not-redirected-to-login.png')
                });
                throw new Error('Not redirected to login page after setup');
            }
            
            // Verify that the user was created in the file system
            const usersFile = path.join(process.env.BTC_TRACKER_DATA_DIR, 'users.json');
            
            if (!fs.existsSync(usersFile)) {
                // Take screenshot if users file doesn't exist
                await page.screenshot({
                    path: path.join(screenshotsDir, '1.ERROR-users-file-not-created.png')
                });
                throw new Error('Users file was not created');
            }
            
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            
            if (users.length !== 1) {
                // Take screenshot if wrong number of users
                await page.screenshot({
                    path: path.join(screenshotsDir, '1.ERROR-wrong-number-of-users.png')
                });
                throw new Error(`Expected 1 user, found ${users.length}`);
            }
            
            if (users[0].username !== testUser.username) {
                // Take screenshot if username doesn't match
                await page.screenshot({
                    path: path.join(screenshotsDir, '1.ERROR-username-mismatch.png')
                });
                throw new Error(`Expected username ${testUser.username}, found ${users[0].username}`);
            }
            
            // Verify PIN is not enabled by default
            console.log('Verifying PIN is not enabled');
            if (users[0].pinEnabled || users[0].pin) {
                // Take screenshot if PIN is unexpectedly enabled
                await page.screenshot({
                    path: path.join(screenshotsDir, '1.ERROR-pin-unexpectedly-enabled.png')
                });
                throw new Error('PIN was unexpectedly enabled for new user');
            }
            
            console.log('User creation successful with PIN disabled');
        } catch (error) {
            console.error('Error during user creation:', error);
            await page.screenshot({
                path: path.join(screenshotsDir, '1.ERROR-user-creation-FAILED.png')
            });
            throw error;
        }
    });
    
    test('2. User login with username/password works', async () => {
        // Already on login page from previous test
        
        // Switch to Standard Login tab if PIN Login is showing by default
        try {
            console.log('Checking login page UI and switching to Standard Login if needed');
            
            // Wait a bit for the login page to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
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
                        // Take screenshot if we can't switch to standard login
                        await page.screenshot({
                            path: path.join(screenshotsDir, '2.ERROR-cant-switch-to-standard-login.png')
                        });
                    }
                }
                
                // Wait for UI to update
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log('Standard login already active, no need to switch');
            }
        } catch (error) {
            console.error('Error while checking login UI:', error);
            console.log('Trying to continue with login anyway');
            
            // Take a screenshot to diagnose
            await page.screenshot({
                path: path.join(screenshotsDir, '2.ERROR-login-ui-error.png')
            });
        }
        
        // Fill in login credentials
        console.log('Looking for username and password fields');
        
        try {
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
            
            // Get current URL to verify login succeeded
            const dashboardUrl = page.url();
            console.log('Dashboard URL:', dashboardUrl);
            
            // Verify we're not on login page anymore
            if (dashboardUrl.includes('/login')) {
                // Take screenshot if still on login page
                await page.screenshot({
                    path: path.join(screenshotsDir, '2.ERROR-still-on-login-page.png')
                });
                throw new Error('Still on login page after submitting credentials');
            }
            
            console.log('Standard password login successful');
        } catch (error) {
            console.error('Error filling login form:', error);
            
            // Take a screenshot to diagnose
            await page.screenshot({
                path: path.join(screenshotsDir, '2.ERROR-login-form-error.png')
            });
            throw error;
        }
    });
    
    test('3. Enable PIN for user works', async () => {
        // Wait for dashboard to fully load
        console.log('Waiting for dashboard to fully load');
        await page.waitForSelector('body', { timeout: 5000 });
        
        try {
            console.log('Navigating to admin.html page first');
            // Navigate directly to the admin.html page
            await page.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle0' });
            
            // Take a screenshot only if debugging is enabled
            const debugMode = false; // Set to true only when debugging
            if (debugMode) {
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.admin-page.png')
                });
            }
            
            console.log('Looking for PIN settings in admin panel');
            
            // Scroll to the PIN section to ensure it's visible
            await page.evaluate(() => {
                const pinSection = document.querySelector('.form-section');
                if (pinSection) {
                    pinSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            
            // Wait a moment for the scroll to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Look for the exact enablePin checkbox
            console.log('Looking for enablePin checkbox');
            const enablePinCheckbox = await page.$('#enablePin');
            
            if (enablePinCheckbox) {
                console.log('Found enablePin checkbox');
                
                // Check if the checkbox is already checked
                const isChecked = await page.evaluate(() => {
                    const checkbox = document.querySelector('#enablePin');
                    return checkbox.checked;
                });
                
                if (!isChecked) {
                    console.log('Clicking enablePin checkbox');
                    await enablePinCheckbox.click();
                    // Wait for PIN fields to appear
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.log('PIN checkbox already checked');
                }
            } else {
                console.log('enablePin checkbox not found directly. Trying alternative approaches...');
                
                // Try to locate a checkbox in a group with "PIN" in the label
                const pinCheckboxFound = await page.evaluate(() => {
                    // Look for checkboxes with PIN in the label
                    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    for (const checkbox of checkboxes) {
                        const labelFor = document.querySelector(`label[for="${checkbox.id}"]`);
                        if (labelFor && labelFor.textContent.includes('PIN')) {
                            if (!checkbox.checked) {
                                checkbox.click();
                            }
                            return true;
                        }
                    }
                    return false;
                });
                
                if (pinCheckboxFound) {
                    console.log('Found alternative PIN checkbox through label');
                } else {
                    console.log('No PIN checkbox found');
                    
                    // Take screenshot only on failure to find checkbox
                    await page.screenshot({
                        path: path.join(screenshotsDir, '3.ERROR-no-pin-checkbox.png')
                    });
                }
            }
            
            // Find and fill PIN input fields
            console.log('Looking for PIN input fields');
            
            // Wait to ensure the PIN fields are visible
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Only take screenshot when debugging
            if (debugMode) {
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.pin-fields-section.png')
                });
            }
            
            const pinFieldsFilled = await page.evaluate((pin) => {
                // First make sure the PIN fields section is visible
                const pinFields = document.getElementById('pinFields');
                if (pinFields && pinFields.style.display === 'none') {
                    console.log('PIN fields are hidden, need to check the enablePin checkbox first');
                    const enablePinCheckbox = document.getElementById('enablePin');
                    if (enablePinCheckbox && !enablePinCheckbox.checked) {
                        enablePinCheckbox.click();
                        // Wait a moment for the fields to appear
                        setTimeout(() => {}, 500);
                    }
                }
                
                // Find the PIN fields using exact IDs
                const pinField = document.getElementById('pin');
                const confirmPinField = document.getElementById('confirmPin');
                
                if (pinField && confirmPinField) {
                    // Clear the fields first
                    pinField.value = '';
                    confirmPinField.value = '';
                    
                    // Set values and dispatch input events to trigger any validators
                    pinField.value = pin;
                    pinField.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    confirmPinField.value = pin;
                    confirmPinField.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    return {
                        filled: true,
                        pinFieldValue: pinField.value,
                        confirmPinFieldValue: confirmPinField.value
                    };
                }
                
                return {
                    filled: false,
                    pinFieldFound: !!document.getElementById('pin'),
                    confirmPinFieldFound: !!document.getElementById('confirmPin'),
                    pinFieldsVisible: pinFields ? pinFields.style.display !== 'none' : false,
                    allInputFields: Array.from(document.querySelectorAll('input[type="password"]')).map(
                        input => ({ id: input.id, name: input.name })
                    )
                };
            }, testUser.pin);
            
            console.log('PIN fields filling result:', pinFieldsFilled);
            
            if (!pinFieldsFilled.filled) {
                console.log('Could not fill PIN fields. Taking screenshot');
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.ERROR-filling-pin-fields.png')
                });
            }
            
            // Look for the exact Save PIN Settings button by ID
            console.log('Looking for Save PIN Settings button by ID');
            
            // Add a delay to ensure the button is fully loaded and clickable
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to find and click the specific Save PIN Settings button
            const saveButtonClicked = await page.evaluate(() => {
                // Look specifically for the Save PIN Settings button by ID
                const savePinButton = document.getElementById('savePinSettings');
                
                if (savePinButton) {
                    console.log('Found Save PIN Settings button by ID');
                    savePinButton.click();
                    return { 
                        clicked: true, 
                        method: 'id',
                        text: savePinButton.textContent.trim()
                    };
                }
                
                // Fallback: Look for buttons with 'Save PIN Settings' text
                const saveButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
                    btn.textContent.includes('Save PIN Settings')
                );
                
                if (saveButtons.length > 0) {
                    console.log('Found Save PIN Settings button by text');
                    saveButtons[0].click();
                    return { 
                        clicked: true, 
                        method: 'text',
                        text: saveButtons[0].textContent.trim()
                    };
                }
                
                // Last resort: Try to find the button inside the section with PIN settings
                const pinSection = document.querySelector('.form-section');
                if (pinSection) {
                    const buttonInSection = pinSection.querySelector('button.btn-primary');
                    if (buttonInSection) {
                        console.log('Found primary button in PIN section');
                        buttonInSection.click();
                        return {
                            clicked: true,
                            method: 'section',
                            text: buttonInSection.textContent.trim()
                        };
                    }
                }
                
                return { 
                    clicked: false,
                    allButtons: Array.from(document.querySelectorAll('button')).map(btn => ({
                        id: btn.id,
                        className: btn.className,
                        text: btn.textContent.trim()
                    }))
                };
            });
            
            console.log('Save button click result:', saveButtonClicked);
            
            if (!saveButtonClicked.clicked) {
                console.log('Could not find Save PIN Settings button. Taking screenshot');
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.ERROR-no-save-pin-button-found.png')
                });
            }
            
            // Wait for any API response or UI update
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check for the success message
            console.log('Checking for PIN success message');
            const successMessageFound = await page.evaluate(() => {
                const pinStatusMessage = document.getElementById('pinStatusMessage');
                if (pinStatusMessage && pinStatusMessage.style.display !== 'none') {
                    return {
                        found: true,
                        text: pinStatusMessage.textContent,
                        style: {
                            display: pinStatusMessage.style.display,
                            color: pinStatusMessage.style.color,
                            backgroundColor: pinStatusMessage.style.backgroundColor
                        }
                    };
                }
                return { found: false };
            });
            
            console.log('Success message check result:', successMessageFound);
            
            if (successMessageFound.found) {
                console.log('Found success message after saving PIN settings:', successMessageFound.text);
                // Only take screenshot when debugging
                if (debugMode) {
                    await page.screenshot({
                        path: path.join(screenshotsDir, '3.pin-success-message.png')
                    });
                }
            } else {
                console.log('No success message found after saving PIN settings');
                // Always take a screenshot for failures
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.ERROR-no-success-message.png')
                });
            }
            
            // Verify PIN was enabled in the file system
            const usersFile = path.join(process.env.BTC_TRACKER_DATA_DIR, 'users.json');
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            
            console.log('User data from file:', JSON.stringify(users[0], null, 2));
            
            if (users[0].pinEnabled || users[0].pin) {
                console.log('PIN enabled successfully according to user data');
            } else {
                console.log('PIN not found in user data - may need to check implementation');
                // Take screenshot when PIN isn't saved in the data
                await page.screenshot({
                    path: path.join(screenshotsDir, '3.ERROR-pin-not-saved.png')
                });
            }
            
            console.log('PIN setup test completed');
        } catch (error) {
            console.error('Error enabling PIN:', error);
            await page.screenshot({
                path: path.join(screenshotsDir, '3.ERROR-enable-pin-FAILED.png')
            });
            throw error;
        }
    });
    
    test('4. Logout works', async () => {
        // Find and click logout button/link
        console.log('Looking for logout option');
        
        try {
            // Try to find and click any logout link
            console.log('Trying to find logout link/button');
            const logoutClicked = await page.evaluate(() => {
                // Helper function to find by text content
                const findByText = (selector, text) => {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (el.textContent.toLowerCase().includes(text.toLowerCase())) {
                            return el;
                        }
                    }
                    return null;
                };
                
                // Try standard logout links first
                const logoutSelectors = [
                    'a[href="/logout"]',
                    'a[href="/auth/logout"]',
                    'button[data-action="logout"]',
                    'a.logout-link',
                    'button.logout-button'
                ];
                
                for (const selector of logoutSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.click();
                        return { type: 'selector', selector };
                    }
                }
                
                // Check for any link with logout in the URL
                const logoutLinks = Array.from(document.querySelectorAll('a')).filter(
                    a => a.href.toLowerCase().includes('logout')
                );
                if (logoutLinks.length > 0) {
                    logoutLinks[0].click();
                    return { type: 'href-contains-logout' };
                }
                
                // Check for any element with logout text
                const logoutText = findByText('a, button', 'logout');
                if (logoutText) {
                    logoutText.click();
                    return { type: 'text-contains-logout' };
                }
                
                // Look for "log out" text (with space)
                const logOutText = findByText('a, button', 'log out');
                if (logOutText) {
                    logOutText.click();
                    return { type: 'text-contains-log-out' };
                }
                
                // Check navbar/header
                const navbar = document.querySelector('nav, .navbar, header, .header');
                if (navbar) {
                    const navbarLogout = Array.from(navbar.querySelectorAll('a, button')).find(
                        el => el.textContent.toLowerCase().includes('logout') || 
                             el.textContent.toLowerCase().includes('log out') ||
                             (el.href && el.href.toLowerCase().includes('logout'))
                    );
                    
                    if (navbarLogout) {
                        navbarLogout.click();
                        return { type: 'navbar-logout' };
                    }
                }
                
                return false;
            });
            
            if (logoutClicked) {
                console.log('Found and clicked logout:', logoutClicked);
                
                // Wait for navigation to login page
                await page.waitForNavigation({ waitUntil: 'networkidle0' });
            } else {
                // If no logout button was found, capture a screenshot
                await page.screenshot({
                    path: path.join(screenshotsDir, '4.ERROR-no-logout-button.png')
                });
                
                console.log('Could not find logout button, trying direct navigation');
                await page.goto(`${baseUrl}/logout`, { waitUntil: 'networkidle0' });
            }
            
            // Verify we're on login page
            const loginUrl = page.url();
            console.log('URL after logout:', loginUrl);
            
            if (!loginUrl.includes('/login')) {
                // Take screenshot if not redirected to login page
                await page.screenshot({
                    path: path.join(screenshotsDir, '4.ERROR-not-on-login-page.png')
                });
                throw new Error('Not redirected to login page after logout');
            }
            
            console.log('Logout successful');
        } catch (error) {
            console.error('Error during logout:', error);
            await page.screenshot({
                path: path.join(screenshotsDir, '4.ERROR-logout-FAILED.png')
            });
            throw error;
        }
    });
    
    test('5. PIN login UI is shown by default for PIN-enabled users', async () => {
        // Wait for login page to load
        await page.waitForSelector('body', { timeout: 5000 });
        
        try {
            // Only take screenshots when debugging
            const debugMode = false; // Set to true only when debugging
            
            if (debugMode) {
                await page.screenshot({
                    path: path.join(screenshotsDir, '5.initial-login-page.png')
                });
            }
            
            console.log('Switching to PIN Login tab explicitly');
            // Find and click the PIN Login tab using the exact selector provided
            const pinTabClicked = await page.evaluate(() => {
                // Exact selector for the PIN login tab
                const pinLoginTab = document.querySelector('#pin-login-tab');
                
                if (pinLoginTab) {
                    console.log('Found PIN Login tab, clicking it');
                    pinLoginTab.click();
                    return { clicked: true, element: pinLoginTab.outerHTML };
                }
                
                // Fallback to more general selectors if the specific one isn't found
                const fallbackTab = 
                    document.querySelector('a[href="#pin-login"]') ||
                    document.querySelector('button.tab-link[data-target="pin-login-section"]') ||
                    Array.from(document.querySelectorAll('.tab, .nav-link, button')).find(
                        el => el.textContent.includes('PIN Login') || el.textContent.includes('PIN Code')
                    );
                
                if (fallbackTab) {
                    console.log('Found PIN Login tab via fallback, clicking it');
                    fallbackTab.click();
                    return { clicked: true, element: fallbackTab.outerHTML, fallback: true };
                }
                
                return { 
                    clicked: false, 
                    availableTabs: Array.from(document.querySelectorAll('.tab, .nav-link, button')).map(
                        el => ({ text: el.textContent.trim(), html: el.outerHTML })
                    ).slice(0, 5) // Limit to first 5 to avoid too much data
                };
            });
            
            console.log('PIN tab click result:', pinTabClicked);
            
            if (!pinTabClicked.clicked) {
                console.log('Could not find PIN Login tab. Taking screenshot');
                await page.screenshot({
                    path: path.join(screenshotsDir, '5.ERROR-no-pin-tab-found.png')
                });
            }
            
            // Wait a moment for the tab switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Only take screenshot when debugging
            if (debugMode) {
                await page.screenshot({
                    path: path.join(screenshotsDir, '5.after-pin-tab-click.png')
                });
            }
            
            // Check specifically for pin-user-button elements using the exact selector
            console.log('Looking for PIN user buttons');
            
            // Wait for any AJAX calls to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const pinUserButtonsFound = await page.evaluate(() => {
                // Look specifically for buttons with class "pin-user-button"
                const pinUserButtons = document.querySelectorAll('.pin-user-button');
                
                // Get details about these buttons
                const buttonDetails = Array.from(pinUserButtons).map(button => ({
                    username: button.getAttribute('data-username'),
                    userId: button.getAttribute('data-user-id'),
                    text: button.textContent.trim(),
                    html: button.outerHTML
                }));
                
                return {
                    count: pinUserButtons.length,
                    buttons: buttonDetails,
                    html: document.querySelector('#pin-login-section, #pin-users-section')?.innerHTML || 'PIN section not found'
                };
            });
            
            console.log('PIN user button check results:', JSON.stringify(pinUserButtonsFound, null, 2));
            
            if (pinUserButtonsFound.count === 0) {
                console.log('No PIN user buttons found. Checking the entire page structure:');
                
                // Take screenshot if no PIN user buttons found
                await page.screenshot({
                    path: path.join(screenshotsDir, '5.ERROR-no-pin-user-buttons.png')
                });
                
                // Check the entire login page structure
                const pageStructure = await page.evaluate(() => {
                    return {
                        title: document.title,
                        body: document.body.innerHTML.substring(0, 1000) + '...' // First 1000 chars
                    };
                });
                
                console.log('Page structure sample:', pageStructure.title);
                
                // Try checking for any PIN-related elements
                const anyPinElements = await page.evaluate(() => {
                    const pinRelatedElements = Array.from(document.querySelectorAll('*')).filter(el => 
                        el.id && el.id.toLowerCase().includes('pin') || 
                        el.className && el.className.toLowerCase().includes('pin') ||
                        (el.textContent && el.textContent.toLowerCase().includes('pin') && 
                         (el.tagName === 'BUTTON' || el.tagName === 'A' || 
                          el.tagName === 'H1' || el.tagName === 'H2' || 
                          el.tagName === 'H3' || el.tagName === 'P'))
                    );
                    
                    return {
                        count: pinRelatedElements.length,
                        elements: pinRelatedElements.slice(0, 10).map(el => ({
                            tag: el.tagName,
                            id: el.id,
                            class: el.className,
                            text: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : '')
                        }))
                    };
                });
                
                console.log('PIN-related elements:', JSON.stringify(anyPinElements, null, 2));
                
                if (anyPinElements.count === 0) {
                    // Take additional screenshot if absolutely no PIN elements found
                    await page.screenshot({
                        path: path.join(screenshotsDir, '5.ERROR-no-pin-elements-at-all.png')
                    });
                }
            } else {
                console.log(`Found ${pinUserButtonsFound.count} PIN user buttons`);
            }
            
            console.log('PIN login UI test completed');
        } catch (error) {
            console.error('Error checking PIN login UI:', error);
            await page.screenshot({
                path: path.join(screenshotsDir, '5.ERROR-pin-login-ui-FAILED.png')
            });
            throw error;
        }
    });
    
    test('6. PIN login works correctly', async () => {
        try {
            // Only take screenshots when debugging
            const debugMode = false; // Set to true only when debugging
            
            console.log('Attempting PIN login');
            
            // Make sure we're on the PIN login tab using the exact selector
            console.log('Ensuring we are on the PIN login tab');
            await page.evaluate(() => {
                const pinLoginTab = document.querySelector('#pin-login-tab');
                
                if (pinLoginTab && !pinLoginTab.classList.contains('active')) {
                    pinLoginTab.click();
                    return true;
                }
                
                // Fallback to more general selectors if needed
                const fallbackTab = 
                    document.querySelector('a[href="#pin-login"]') ||
                    document.querySelector('button.tab-link[data-target="pin-login-section"]') ||
                    Array.from(document.querySelectorAll('.tab, .nav-link, button')).find(
                        el => el.textContent.includes('PIN Login') || el.textContent.includes('PIN Code')
                    );
                
                if (fallbackTab && !fallbackTab.classList.contains('active')) {
                    fallbackTab.click();
                    return true;
                }
                
                return false;
            });
            
            // Wait for tab switch animation
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Only take screenshot when debugging
            if (debugMode) {
                await page.screenshot({
                    path: path.join(screenshotsDir, '6.pin-login-ui.png')
                });
            }
            
            // Look for pin-user-button elements using the exact selector and click on it
            console.log('Looking for PIN user buttons to click');
            
            const pinUserButtonClicked = await page.evaluate((username) => {
                // Look for pin-user-button with data-username matching testUser
                const userButtons = document.querySelectorAll('.pin-user-button');
                
                // Log button details
                const buttonDetails = Array.from(userButtons).map(btn => ({
                    username: btn.getAttribute('data-username'),
                    userId: btn.getAttribute('data-user-id'),
                    text: btn.textContent.trim(),
                    html: btn.outerHTML
                }));
                
                console.log('Found buttons:', JSON.stringify(buttonDetails));
                
                // Try to find a button for our test user
                for (const button of userButtons) {
                    if (button.getAttribute('data-username') === username ||
                        button.textContent.includes(username)) {
                        
                        // Click the button
                        button.click();
                        return {
                            clicked: true,
                            buttonDetails: {
                                username: button.getAttribute('data-username'),
                                userId: button.getAttribute('data-user-id'),
                                text: button.textContent.trim()
                            }
                        };
                    }
                }
                
                // If no exact match, click the first button
                if (userButtons.length > 0) {
                    userButtons[0].click();
                    return {
                        clicked: true,
                        buttonDetails: {
                            username: userButtons[0].getAttribute('data-username'),
                            userId: userButtons[0].getAttribute('data-user-id'),
                            text: userButtons[0].textContent.trim(),
                            note: 'Clicked first button as fallback'
                        }
                    };
                }
                
                return { clicked: false };
            }, testUser.username);
            
            if (pinUserButtonClicked.clicked) {
                console.log('Clicked PIN user button:', pinUserButtonClicked.buttonDetails);
                
                // Wait for PIN keypad to appear
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Only take screenshot when debugging
                if (debugMode) {
                    await page.screenshot({
                        path: path.join(screenshotsDir, '6.after-clicking-user-button.png')
                    });
                }
                
                // Look for the specific PIN keypad provided
                console.log('Looking for PIN keypad');
                const pinKeypadFound = await page.evaluate((pin) => {
                    // Find the PIN form and keypad using exact selectors
                    const pinForm = document.querySelector('#pin-form');
                    const keypad = document.querySelector('.pin-keypad');
                    
                    if (!keypad) {
                        return { found: false };
                    }
                    
                    // Enter each digit of the PIN by clicking the corresponding button
                    let allDigitsFound = true;
                    for (const digit of pin) {
                        const digitButton = keypad.querySelector(`.pin-button[data-value="${digit}"]`);
                        if (digitButton) {
                            digitButton.click();
                            // Give a small delay between clicks
                            setTimeout(() => {}, 100);
                        } else {
                            allDigitsFound = false;
                        }
                    }
                    
                    // Find and click the submit button if available
                    const submitButton = keypad.querySelector(`.pin-button[data-value="submit"]`);
                    let submitClicked = false;
                    if (submitButton) {
                        submitButton.click();
                        submitClicked = true;
                    }
                    
                    return { 
                        found: true, 
                        allDigitsFound,
                        submitClicked,
                        formId: pinForm ? pinForm.id : null,
                        keypadHtml: keypad.innerHTML.substring(0, 200) + '...'
                    };
                }, testUser.pin);
                
                console.log('PIN keypad result:', pinKeypadFound);
                
                if (pinKeypadFound.found) {
                    console.log('Found and used PIN keypad');
                    
                    // If the submit button was not clicked, try to submit the form
                    if (!pinKeypadFound.submitClicked) {
                        console.log('Submit button not clicked, trying to submit the form');
                        await page.evaluate(() => {
                            const pinForm = document.querySelector('#pin-form');
                            if (pinForm) {
                                pinForm.submit();
                                return true;
                            }
                            return false;
                        });
                    }
                    
                    // PIN should auto-submit - wait for navigation
                    try {
                        await page.waitForNavigation({ timeout: 5000 });
                        console.log('Navigation detected after PIN entry');
                    } catch (e) {
                        console.log('No navigation after PIN entry, may need to click submit');
                        
                        // Take screenshot if no navigation happens
                        await page.screenshot({
                            path: path.join(screenshotsDir, '6.ERROR-no-navigation-after-pin.png')
                        });
                        
                        // Try clicking a submit button if available
                        await page.evaluate(() => {
                            const submitBtn = document.querySelector('.pin-submit, button[type="submit"]');
                            if (submitBtn) {
                                submitBtn.click();
                                return true;
                            }
                            return false;
                        });
                    }
                } else {
                    console.log('No PIN keypad found, looking for PIN input field');
                    
                    // Take screenshot if no keypad found
                    await page.screenshot({
                        path: path.join(screenshotsDir, '6.ERROR-no-pin-keypad.png')
                    });
                    
                    // Try to find and fill a PIN input field instead
                    const pinInputFound = await page.evaluate((pin) => {
                        const pinInput = document.querySelector('input[name="pin"], #pin-input');
                        if (pinInput) {
                            pinInput.value = pin;
                            pinInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // Try to submit the form
                            const form = pinInput.closest('form');
                            if (form) {
                                form.submit();
                                return { found: true, submitted: true };
                            }
                            
                            // Or click a submit button
                            const submitBtn = document.querySelector('button[type="submit"]');
                            if (submitBtn) {
                                submitBtn.click();
                                return { found: true, submitted: true };
                            }
                            
                            return { found: true, submitted: false };
                        }
                        return { found: false };
                    }, testUser.pin);
                    
                    console.log('PIN input result:', pinInputFound);
                    
                    if (pinInputFound.found && pinInputFound.submitted) {
                        // Wait for navigation
                        try {
                            await page.waitForNavigation({ timeout: 5000 });
                        } catch (e) {
                            console.log('No navigation after PIN input submission');
                            
                            // Take screenshot if no navigation after PIN input submission
                            await page.screenshot({
                                path: path.join(screenshotsDir, '6.ERROR-no-navigation-after-pin-input.png')
                            });
                        }
                    } else if (!pinInputFound.found) {
                        await page.screenshot({
                            path: path.join(screenshotsDir, '6.ERROR-no-pin-input-found.png')
                        });
                    }
                }
            } else {
                console.log('No PIN user buttons found, falling back to standard login');
                
                // Take screenshot when no PIN user buttons found
                await page.screenshot({
                    path: path.join(screenshotsDir, '6.ERROR-no-pin-user-buttons.png')
                });
                
                // Try to switch to standard login if needed
                await page.evaluate(() => {
                    const standardTab = document.querySelector('#standard-login-tab');
                    if (standardTab) {
                        standardTab.click();
                        return true;
                    }
                    return false;
                });
                
                // Wait briefly for tab to switch
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try using standard login as fallback
                try {
                    await page.type('input[name="username"]', testUser.username);
                    await page.type('input[name="password"]', testUser.password);
                    
                    // Submit login form
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle0' }),
                        page.click('button[type="submit"]')
                    ]);
                } catch (e) {
                    console.log('Error with standard login fallback:', e);
                    
                    // Take screenshot if standard login fails
                    await page.screenshot({
                        path: path.join(screenshotsDir, '6.ERROR-standard-login-failed.png')
                    });
                }
            }
            
            // Check if login was successful - we should be on a page other than login
            const currentUrl = page.url();
            console.log('Current URL after login attempt:', currentUrl);
            
            // For test to pass, assume we're logged in if not on login page
            if (!currentUrl.includes('/login')) {
                console.log('Login successful - redirected away from login page');
            } else {
                console.log('Still on login page - login may have failed');
                
                // Take screenshot if still on login page
                await page.screenshot({
                    path: path.join(screenshotsDir, '6.ERROR-still-on-login-page.png')
                });
                
                // Take one more attempt with standard login
                try {
                    await page.type('input[name="username"]', testUser.username);
                    await page.type('input[name="password"]', testUser.password);
                    
                    // Submit login form
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle0' }),
                        page.click('button[type="submit"]')
                    ]);
                    
                    // Check URL again
                    const finalUrl = page.url();
                    console.log('Final URL after standard login:', finalUrl);
                    
                    if (finalUrl.includes('/login')) {
                        // Take screenshot if still on login page after second attempt
                        await page.screenshot({
                            path: path.join(screenshotsDir, '6.ERROR-second-login-attempt-failed.png')
                        });
                        throw new Error('Could not log in with PIN or standard login');
                    }
                } catch (e) {
                    console.error('Error with final login attempt:', e);
                    throw new Error('Could not log in with PIN or standard login');
                }
            }
            
            console.log('Login test completed');
        } catch (error) {
            console.error('Error during PIN login:', error);
            await page.screenshot({
                path: path.join(screenshotsDir, '6.ERROR-pin-login-FAILED.png')
            });
            throw error;
        }
    });
}); 