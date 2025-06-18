// Mobile Navigation Component
class MobileNavigation {
    constructor() {
        this.init();
    }

    init() {
        // Clean up any existing mobile navigation elements
        this.cleanup();
        
        this.createMobileHeader();
        this.createBottomNavigation();
        this.setupEventListeners();
    }

    cleanup() {
        // Remove any existing mobile navigation elements
        const elementsToRemove = [
            '.mobile-flex-row',
            '.mobile-nav-bar',
            '.mobile-dropdown-nav',
            '.mobile-header',
            '.mobile-bottom-nav'
        ];
        
        elementsToRemove.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // Reset body padding
        document.body.style.paddingBottom = '';
    }

    createMobileHeader() {
        // Find the header element
        const header = document.querySelector('header');
        if (!header) return;

        // Remove any existing mobile elements that might conflict
        const existingMobileRow = header.querySelector('.mobile-flex-row');
        if (existingMobileRow) {
            existingMobileRow.remove();
        }

        // Create mobile flex row
        const mobileFlexRow = document.createElement('div');
        mobileFlexRow.className = 'mobile-flex-row';
        
        // Get page title from document or use default
        const pageTitle = this.getPageTitle();
        
        // Create mobile header content
        mobileFlexRow.innerHTML = `
            <h1><img src="images/bitcoin-icon.svg" alt="Bitcoin" class="bitcoin-logo"> ${pageTitle}</h1>
            <div class="theme-logout-container">
                ${this.getPageSpecificButtons()}
                <button id="mobileThemeToggle" class="mobile-theme-toggle">
                    <i class="fas fa-moon"></i>
                    <i class="fas fa-sun"></i>
                </button>
                <a href="/logout" class="mobile-logout-btn">
                    <i class="fas fa-sign-out-alt"></i>
                </a>
            </div>
        `;

        // Insert as first child of header
        header.insertBefore(mobileFlexRow, header.firstChild);
    }

    createBottomNavigation() {
        // Remove any existing bottom navigation
        const existingBottomNav = document.querySelector('.mobile-nav-bar');
        if (existingBottomNav) {
            existingBottomNav.remove();
        }

        // Create bottom navigation
        const bottomNav = document.createElement('div');
        bottomNav.className = 'mobile-nav-bar';
        
        const currentPath = window.location.pathname;
        
        bottomNav.innerHTML = `
            <a href="index.html" class="nav-item ${currentPath.includes('index.html') || currentPath === '/' ? 'active' : ''}" data-page="dashboard">
                <i class="fas fa-chart-line"></i>
                <span>Dashboard</span>
            </a>
            <a href="transactions.html" class="nav-item ${currentPath.includes('transactions.html') ? 'active' : ''}" data-page="transactions">
                <i class="fas fa-list-ul"></i>
                <span>Transactions</span>
            </a>
            <a href="exchanges.html" class="nav-item ${currentPath.includes('exchanges.html') ? 'active' : ''}" data-page="exchanges">
                <i class="fas fa-plug"></i>
                <span>Exchanges</span>
            </a>
            <a href="admin.html" class="nav-item ${currentPath.includes('admin.html') ? 'active' : ''}" data-page="admin">
                <i class="fas fa-cog"></i>
                <span>Admin</span>
            </a>
        `;

        // Add to body
        document.body.appendChild(bottomNav);

        // Add bottom padding to body for navigation
        document.body.style.paddingBottom = '80px';
    }

    getPageTitle() {
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('transactions.html')) {
            return 'Transactions';
        } else if (currentPath.includes('exchanges.html')) {
            return 'Exchanges';
        } else if (currentPath.includes('admin.html')) {
            return 'Admin Panel';
        } else {
            return 'Dashboard';
        }
    }

    getPageSpecificButtons() {
        // No page-specific buttons needed anymore since we have buttons in the main content
        return '';
    }

    setupEventListeners() {
        // Setup theme toggle
        const mobileThemeToggle = document.getElementById('mobileThemeToggle');
        const regularThemeToggle = document.getElementById('themeToggle');
        
        if (mobileThemeToggle && regularThemeToggle) {
            mobileThemeToggle.addEventListener('click', () => {
                regularThemeToggle.click();
            });
        }

        // Mobile add button removed - using buttons in main content instead
    }

    // Method to hide old mobile dropdown navigation
    hideOldMobileNav() {
        const oldMobileNav = document.querySelector('.mobile-dropdown-nav');
        if (oldMobileNav) {
            oldMobileNav.style.display = 'none';
        }
    }
}

// Mobile navigation functionality only - CSS moved to css/mobile.css

// Initialize mobile navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mobile navigation
    const mobileNav = new MobileNavigation();
    mobileNav.hideOldMobileNav();
});

// Export for use in other scripts if needed
window.MobileNavigation = MobileNavigation; 