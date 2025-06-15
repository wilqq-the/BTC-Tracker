// Donation Tooltip Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Handle donation tooltip and payment method toggle
    const donationLink = document.getElementById('donationLink');
    const donationTooltip = document.getElementById('donationTooltip');
    
    // If elements don't exist, exit early
    if (!donationLink || !donationTooltip) {
        console.warn('Donation elements not found in the page');
        return;
    }
    
    const onchainBtn = document.getElementById('onchainBtn');
    const lightningBtn = document.getElementById('lightningBtn');
    const onchainSection = document.getElementById('onchainSection');
    const lightningSection = document.getElementById('lightningSection');

    // Generate QR codes when page loads
    generateQRCode();
    generateLightningQRCode();

    // Payment method toggle functionality
    onchainBtn.addEventListener('click', () => {
        onchainBtn.classList.add('active');
        lightningBtn.classList.remove('active');
        onchainSection.style.display = 'block';
        lightningSection.style.display = 'none';
    });

    lightningBtn.addEventListener('click', () => {
        lightningBtn.classList.add('active');
        onchainBtn.classList.remove('active');
        lightningSection.style.display = 'block';
        onchainSection.style.display = 'none';
    });

    let tooltipTimeout;
    
    // Function to check and adjust tooltip position if it goes off-screen
    function adjustTooltipPosition() {
        // Only run if tooltip is visible
        if (!donationTooltip.classList.contains('show')) return;
        
        const tooltipRect = donationTooltip.getBoundingClientRect();
        const linkRect = donationLink.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        console.log('Tooltip position:', {
            tooltipLeft: tooltipRect.left,
            tooltipRight: tooltipRect.right,
            tooltipWidth: tooltipRect.width,
            linkLeft: linkRect.left,
            linkCenter: linkRect.left + (linkRect.width / 2),
            linkRight: linkRect.right,
            viewportWidth: viewportWidth
        });
        
        // Check if tooltip is going off the left edge
        if (tooltipRect.left < 20) {
            donationTooltip.style.left = '20px';
            donationTooltip.style.transform = 'translateY(0)';
            
            // Adjust arrow position
            const arrow = donationTooltip.querySelector('.tooltip-arrow');
            if (arrow) {
                const arrowPos = linkRect.left + (linkRect.width / 2) - 20; // 20px offset from left
                arrow.style.left = `${arrowPos}px`;
            }
        }
        
        // Check if tooltip is going off the right edge
        if (tooltipRect.right > viewportWidth - 20) {
            donationTooltip.style.left = 'auto';
            donationTooltip.style.right = '20px';
            donationTooltip.style.transform = 'translateY(0)';
            
            // Adjust arrow position
            const arrow = donationTooltip.querySelector('.tooltip-arrow');
            if (arrow) {
                const arrowPos = (viewportWidth - linkRect.right) + (linkRect.width / 2) - 20;
                arrow.style.right = `${arrowPos}px`;
                arrow.style.left = 'auto';
            }
        }
    }

    // Show tooltip
    donationLink.addEventListener('mouseenter', () => {
        clearTimeout(tooltipTimeout);
        donationTooltip.classList.add('show');
        
        // Check if we're on mobile
        if (window.innerWidth <= 768) {
            // On mobile, position at the bottom of the screen
            donationTooltip.style.bottom = '20px';
            donationTooltip.style.left = '50%';
            donationTooltip.style.transform = 'translateX(-50%) translateY(0)';
        } else {
            // Reset any custom positioning
            donationTooltip.style.left = '';
            donationTooltip.style.right = '';
            donationTooltip.style.transform = '';
            
            // Adjust if needed
            setTimeout(adjustTooltipPosition, 0);
        }
    });

    // Hide tooltip
    donationLink.addEventListener('mouseleave', () => {
        tooltipTimeout = setTimeout(() => {
            donationTooltip.classList.remove('show');
        }, 200);
    });

    // Keep tooltip visible when hovering over it
    donationTooltip.addEventListener('mouseenter', () => {
        clearTimeout(tooltipTimeout);
        donationTooltip.classList.add('show');
    });

    // Hide tooltip when mouse leaves it
    donationTooltip.addEventListener('mouseleave', () => {
        tooltipTimeout = setTimeout(() => {
            donationTooltip.classList.remove('show');
        }, 200);
    });
    
    // Adjust tooltip position on window resize
    window.addEventListener('resize', adjustTooltipPosition);
    
    // Log initial positions for debugging
    console.log('Donation link position:', donationLink.getBoundingClientRect());
    console.log('Footer links position:', document.querySelector('.footer-links').getBoundingClientRect());
});

function generateQRCode() {
    const btcAddress = document.getElementById('btcAddress');
    if (!btcAddress) return;
    
    const address = btcAddress.textContent;
    const qrcodeDiv = document.getElementById('qrcode');
    if (!qrcodeDiv) return;
    
    qrcodeDiv.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    qrcodeDiv.appendChild(canvas);
    
    const isLightTheme = document.body.classList.contains('light-theme');
    
    QRCode.toCanvas(canvas, address, {
        width: 150,
        margin: 1,
        color: {
            dark: isLightTheme ? '#000000' : '#ffffff',
            light: isLightTheme ? '#ffffff' : '#000000'
        }
    }, function (error) {
        if (error) {
            console.error('Error generating QR code:', error);
            qrcodeDiv.innerHTML = '<p style="color: var(--error-color, red);">Failed to generate QR code</p>';
        }
    });
}

function generateLightningQRCode() {
    const lightningAddress = document.getElementById('lightningAddress');
    if (!lightningAddress) return;
    
    const address = lightningAddress.textContent;
    const qrcodeDiv = document.getElementById('lightningQrcode');
    if (!qrcodeDiv) return;
    
    qrcodeDiv.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    qrcodeDiv.appendChild(canvas);
    
    const isLightTheme = document.body.classList.contains('light-theme');
    
    QRCode.toCanvas(canvas, address, {
        width: 150,
        margin: 1,
        color: {
            dark: isLightTheme ? '#000000' : '#ffffff',
            light: isLightTheme ? '#ffffff' : '#000000'
        }
    }, function (error) {
        if (error) {
            console.error('Error generating QR code:', error);
            qrcodeDiv.innerHTML = '<p style="color: var(--error-color, red);">Failed to generate QR code</p>';
        }
    });
}

function copyAddress(type) {
    const address = type === 'lightning' 
        ? document.getElementById('lightningAddress').textContent
        : document.getElementById('btcAddress').textContent;
    
    navigator.clipboard.writeText(address).then(() => {
        const button = event.currentTarget;
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.innerHTML = originalIcon;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy address:', err);
        const button = event.currentTarget;
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-times"></i>';
        setTimeout(() => {
            button.innerHTML = originalIcon;
        }, 2000);
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: 'JetBrains Mono', monospace;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        toast.textContent = 'Copy failed. Please select and copy manually.';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    });
} 