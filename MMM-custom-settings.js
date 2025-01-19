// Function to add the custom settings link
function addCustomSettingsLink() {
  
    // Add custom settings section
    const settingsContainer = document.querySelector('div[class*="Settings__SubNavCard"]').querySelector('div[class^="Menu"]');

    // Check if the settings container exists and if the custom settings link doesn't already exist
    if (settingsContainer && !document.getElementById('mmm-custom-settings-anchor')) {
        
        // Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
        // and add it to the custom settings link
        const existingChildAnchorElementStyles = settingsContainer.querySelector('a:not([class*="nav-item-active"])');
        const existingDivElementStyles = existingChildAnchorElementStyles.querySelector('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

        // Add an anchor element to the settings container to contain the custom settings link
        const customSettingsAnchorElement = document.createElement('a');
        customSettingsAnchorElement.href = '#';
        customSettingsAnchorElement.id = 'mmm-custom-settings-anchor';
        if (existingChildAnchorElementStyles) customSettingsAnchorElement.className = existingChildAnchorElementStyles.className;

        // Create the custom setting div element and add it to the anchor element
        const customSettingsDivElement = document.createElement('div');
        customSettingsDivElement.id = 'mmm-custom-settings-div';
        if (existingDivElementStyles) customSettingsDivElement.className = existingDivElementStyles.className;
        customSettingsDivElement.innerHTML = 'Maddy\'s Custom Settings';

         // Show modal on click. Do a fade in transition
         customSettingsDivElement.addEventListener('click', () => {
            showCustomSettingsModal();
        });

        // Add the custom settings link to the anchor element   
        customSettingsAnchorElement.appendChild(customSettingsDivElement);

        // Add the anchor element to the settings container
        settingsContainer.appendChild(customSettingsAnchorElement);

    }

    // If the custom settings link already exists, re-apply the styles to match the current theme
    else if (document.getElementById('mmm-custom-settings-anchor')) {

        // Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
        // and add it to the custom settings link
        const existingChildAnchorElementStyles = settingsContainer.querySelector('a:not([class*="nav-item-active"])');
        const existingDivElementStyles = existingChildAnchorElementStyles.querySelector('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

        if (existingChildAnchorElementStyles) document.getElementById('mmm-custom-settings-anchor').className = existingChildAnchorElementStyles.className;
        if (existingDivElementStyles) document.getElementById('mmm-custom-settings-div').className = existingDivElementStyles.className;
    }
}


// Function to detect the current theme
function detectTheme() {
    const pageRoot = document.querySelector('div[class^="Page__Root"]');
    if (pageRoot.classList.contains('jyUbNP')) {
        return 'dark';
    } else if (pageRoot.classList.contains('jAzUjM')) {
        return 'light';
    }
    return 'light'; // Default to light theme if no theme is detected
}

// Function to apply the correct modal styles
function applyModalStyles(modal) {
    const theme = detectTheme();
    if (theme === 'dark') {
        modal.classList.add('mmm-modal-dark');
        modal.querySelector('.mmm-modal-content').classList.add('mmm-modal-content-dark');
        modal.querySelector('.mmm-modal-header').classList.add('mmm-modal-header-dark');
        modal.querySelector('.mmm-modal-body').classList.add('mmm-modal-body-dark');
        modal.querySelector('.mmm-modal-close').classList.add('mmm-modal-close-dark');
    } else {
        modal.classList.add('mmm-modal-light');
        modal.querySelector('.mmm-modal-content').classList.add('mmm-modal-content-light');
        modal.querySelector('.mmm-modal-header').classList.add('mmm-modal-header-light');
        modal.querySelector('.mmm-modal-body').classList.add('mmm-modal-body-light');
        modal.querySelector('.mmm-modal-close').classList.add('mmm-modal-close-light');
    }
}

// Function to create the custom settings modal
function showCustomSettingsModal() {
    let theme = detectTheme();

    // Create modal HTML
    const modalHtml = `
        <div id="mmm-settings-modal" class="mmm-modal mmm-modal-${theme}">
            <div class="mmm-modal-content mmm-modal-content-${theme}">
                <div class="mmm-modal-header mmm-modal-header-${theme}">
                    <h2>Maddy's Custom Settings</h2>
                    <span class="mmm-modal-close mmm-modal-close-${theme}">&times;</span>
                </div>
                <div class="mmm-modal-body mmm-modal-body-${theme}">
                    <div class="mmm-settings-section">

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Show Split Button for Shared Account Transactions</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="show-split-button-for-shared-account" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the split button for transactions from the shared account
                            </div>
                        </div>

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Show Split and Post to Splitwise Button</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="show-split-and-post-to-splitwise-button-for-shared-account" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the split and post to Splitwise button for transactions from the shared account
                            </div>
                        </div>

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content-input">
                                <label>Split With Partner Tag Name</label>
                                <div class="mmm-setting-input-${theme}">
                                    <input type="text" id="split-with-partner-tag-name" />
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                The name of the tag to use when splitting transactions with a partner
                            </div>
                        </div>

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content-input">
                                <label>Monarch ID of Account With Split Transactions</label>
                                <div class="mmm-setting-input-${theme}">
                                    <input type="text" id="split-with-partner-account-id" />
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                The Monarch ID of the account that has the split transactions
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to body if it doesn't already exist
    if (!document.getElementById("mmm-settings-modal")) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Get modal element
    const modal = document.getElementById("mmm-settings-modal");

    // Show modal with fade in
    modal.style.display = 'flex'; // Changed to flex to match CSS
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Get modal elements
    const closeBtn = modal.querySelector('.mmm-modal-close');

    // Load settings when opening modal
    const settings = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
    document.getElementById('show-split-button-for-shared-account').checked = settings.showSplitButtonForSharedAccount || false;
    document.getElementById('show-split-and-post-to-splitwise-button-for-shared-account').checked = settings.showSplitAndPostToSplitwiseButtonForSharedAccount || false;
    document.getElementById('split-with-partner-tag-name').value = settings.splitWithPartnerTagName || '';
    document.getElementById('split-with-partner-account-id').value = settings.splitWithPartnerAccountId || '';

    // Close modal on X click with fade out
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 500); // Match the transition-slow timing
    });

    // Close modal on outside click with fade out
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 500); // Match the transition-slow timing
        }
    });

    // Save settings on change
    modal.addEventListener('change', (e) => {
        const settings = {
            showSplitButtonForSharedAccount: document.getElementById('show-split-button-for-shared-account').checked,
            showSplitAndPostToSplitwiseButtonForSharedAccount: document.getElementById('show-split-and-post-to-splitwise-button-for-shared-account').checked,
            splitWithPartnerTagName: document.getElementById('split-with-partner-tag-name').value,
            splitWithPartnerAccountId: document.getElementById('split-with-partner-account-id').value
        };
        localStorage.setItem('mmm-settings', JSON.stringify(settings));
    });
}

function getConfigValue(key) {
    const settings = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
    return settings[key] || '';
}

// Export the functions to be used in the main script
window.customSettings = {
    addCustomSettingsLink: addCustomSettingsLink,
    applyModalStyles: applyModalStyles,
    showCustomSettingsModal: showCustomSettingsModal,
    getConfigValue: getConfigValue
}   
