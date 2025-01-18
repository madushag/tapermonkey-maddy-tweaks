// ==UserScript==
// @name         Monarch Money Maddy Tweaks
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Enhance Monarch Money transaction page functionality
// @author       Madusha G.
// @match        https://app.monarchmoney.com/*
// @run-at       document-idle
// @resource     MMMCSS https://raw.githubusercontent.com/madushag/tapermonkey-maddy-tweaks/refs/heads/main/mmm-styles.css
// @resource     sw_api_key file://C:/DevStuff/tapermonkey-maddy-tweaks/sw_api_key.js
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const version = "1.0";
const GRAPHQL_URL = "https://api.monarchmoney.com/graphql"; // Ensure this is defined
const SplitWithDebTagName = "Split with Deb";
const NeedToAddToSplitwiseTagName = "Need to add to Splitwise";
const CapitalOneSavorAccountId = "160250994677913986";
const DebSplitwiseUserId = 782502;
const MySplitwiseUserId = 139530;
const HomeRevereSWGroupId = 1708251;

const scriptText = GM_getResourceText("sw_api_key");
const SplitwiseApiKey = scriptText;

// Create a MutationObserver to watch for changes in the URL
const observer = new MutationObserver(() => {
    onPageStructureChanged();
});

// Start observing the document for changes in the child nodes
observer.observe(document, { childList: true, subtree: true });

// Core logic to handle the split button
function onPageStructureChanged() {

    // Check if the page is the transactions page or the accounts details page
    if (window.location.href.includes("transactions") || window.location.href.includes("accounts/details")) {
        // Check for transaction rows every second
        const checkForTransactions = setInterval(() => {

            // Get all the transaction rows, determined by whether the row has an amount and a merchant
            const transactionRows = Array.from(document.querySelectorAll('div[class*="TransactionsListRow"]'))
                .filter((row) => {
                    return (
                        row.querySelector('div[class*="TransactionOverview__Amount"]') &&
                        row.querySelector('div[class*="TransactionMerchantSelect"]')
                    );
                });

            // If there are transactions, stop checking for them
            if (transactionRows.length > 0) {
                clearInterval(checkForTransactions);
                injectStylesIfNeeded();

                // Use a single event listener for all buttons
                transactionRows.forEach((row) => {
                    addSplitButtonsIfNeeded(row);
                    addUnsplitButtonIfNeeded(row);
                });
            }
        }, 1000);
    }
}

// Add two split buttons to the transaction row if it is not already present.
// One button to just split the transaction, and another button to split and post an expense to Splitwise
function addSplitButtonsIfNeeded(row) {

    // Copy existing button class names
    const existingButton = document.querySelector('button[class*="Button"]');

    // Check if the split button is already present
    if (!row.querySelector(".monarch-helper-button")) {
        // Check if the transaction is already split
        let isAlreadySplit = getTransactionDetailsForRow(row).isSplitTransaction;

        // If the transaction is not already split, add the two buttons
        if (!isAlreadySplit) {
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "button-container";

            // Insert the button container before the transaction icon container
            const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
            if (transactionIconContainer) transactionIconContainer.parentNode.insertBefore(buttonContainer, transactionIconContainer);

            // Add the split button to the button container
            const buttonSplit = document.createElement("button");
            buttonSplit.className = "monarch-helper-button";
            if (existingButton) buttonSplit.className += " " + existingButton.className;
            buttonSplit.innerHTML = "✂️";
            buttonSplit.onclick = (e) => handleSplitButtonClick(e, row);
            buttonContainer.appendChild(buttonSplit);

            // Add the split and post to SW button to the button container, if the transaction is not from the Capital One Savor account
            if (getTransactionDetailsForRow(row).accountId !== CapitalOneSavorAccountId) {
                const buttonSplitAndPostToSW = document.createElement("button");
                buttonSplitAndPostToSW.className = "monarch-helper-button";
                if (existingButton) buttonSplitAndPostToSW.className += " " + existingButton.className;
                buttonSplitAndPostToSW.innerHTML = "📤";
                buttonSplitAndPostToSW.onclick = async (e) => handleSplitAndPostToSWButtonClick(e, row);
                buttonContainer.appendChild(buttonSplitAndPostToSW);
            }
        }
    }
}

// Add an unsplit button to the transaction row if it is not already present.
function addUnsplitButtonIfNeeded(row) {

    // Copy existing button class names
    const existingButton = document.querySelector('button[class*="Button"]');

    // Check if the unsplit button is already present
    if (!row.querySelector(".monarch-helper-button")) {
        // Check if the transaction is already split
        let isAlreadySplit = getTransactionDetailsForRow(row).isSplitTransaction;

        // If the transaction is already split, add the unsplit button
        if (isAlreadySplit) {
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "button-container";

            // Insert the button container before the transaction icon container
            const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
            if (transactionIconContainer) transactionIconContainer.parentNode.insertBefore(buttonContainer, transactionIconContainer);

            // Add the unsplit button to the button container
            const buttonUnsplit = document.createElement("button");
            buttonUnsplit.className = "monarch-helper-button";
            if (existingButton) buttonUnsplit.className += " " + existingButton.className;
            buttonUnsplit.innerHTML = "🔀"; // Merge/Split transaction button
            buttonUnsplit.onclick = async (e) => handleUnsplitButtonClick(e, row);
            buttonContainer.appendChild(buttonUnsplit);
        }
    }
}

function handleSplitAndPostToSWButtonClick(e, row) {
    e.stopPropagation();

    // if the split button was successful, then add the expense to Splitwise
    if (handleSplitButtonClick(e, row)) {
        addExpenseToSplitwise(getTransactionDetailsForRow(row), MySplitwiseUserId, DebSplitwiseUserId);
    }
}

// Handle the split button click event
async function handleSplitButtonClick(e, row) {
    e.stopPropagation();

    let transactionDetails = getTransactionDetailsForRow(row);

    let fullTransactionObject = getFullTransactionObject(row);

    // first split the transaction
    var splitResponse = await splitTransaction(transactionDetails, row);

    // if there were errors in the response then show an error message in a toast accordingly
    if (splitResponse && splitResponse.updateTransactionSplit.errors !== null) {
        showToast(`Error while splitting transaction ID ${transactionDetails.id}.`, "error");

        return false;
    }
    else {
        // now hide one of the split transactions
        var splitTransactionId = splitResponse.updateTransactionSplit.transaction.splitTransactions[0].id;
        var hideResponse = await hideSplitTransaction(splitTransactionId);

        // if there were errors in the response then show an error message in a toast accordingly
        if (hideResponse && hideResponse.updateTransaction.errors !== null) {
            showToast(`Error while hiding transaction ID ${splitTransactionId}.`, "error");
            return false;
        }
        else {
            var addTagsResponseSuccess = await addTagsToSplitTransactions(transactionDetails, splitResponse.updateTransactionSplit.transaction.splitTransactions);

            // if there were no errors then show a success toast
            if (addTagsResponseSuccess) {
                showToast(`Transaction ${transactionDetails.id} split successfully!`, "success");
            }

            // fullTransactionObject.isSplitTransaction = true;
            // setFullTransactionObject(row, fullTransactionObject);

            // // get div with class starting with AccountDetails__StyledTransactionsListWrapper-sc-
            // var element = document.querySelector("div[class^='AccountDetails__StyledTransactionsListWrapper-sc-']");
            // forceUpdateElement(element);

            // everything went well, so return true
            return true;
        }
    }
}

async function handleUnsplitButtonClick(e, row) {
    e.stopPropagation();

    let transactionDetails = await getTransactionDetailsForRow(row);

    // first get the transaction drawer details
    var transactionDrawerDetails = await getTransactionDrawerDetails(transactionDetails, row);

    // now unsplit the transaction
    var unsplitResponse = await unsplitTransaction(transactionDrawerDetails.getTransaction.originalTransaction.id);

    // if there were errors in the response then show an error message in a toast accordingly
    if (unsplitResponse && unsplitResponse.updateTransactionSplit.errors !== null) {
        showToast(`Error while unsplitting transaction ID ${transactionDrawerDetails.getTransaction.originalTransaction.id}.`, "error");
        return false;
    }
    else {
        // if there were no errors then show a success toast
        showToast(`Transaction ${transactionDrawerDetails.getTransaction.originalTransaction.id} unsplit successfully!`, "success");
        return true;
    }   
}   

// Split a transaction and tag it with the given category and tags
async function splitTransaction(transactionDetails, row) {
    // Check if the transaction is not already split
    if (!transactionDetails.hasSplitTransactions && !transactionDetails.isSplitTransaction) {
        // Calculate the split amount
        const totalAmount = parseFloat(transactionDetails.amount);
        const splitAmount = Math.round((totalAmount / 2) * 100) / 100; // Round to 2 decimal places
        const amount1 = splitAmount;
        const amount2 = totalAmount - splitAmount;

        // Create the GraphQL payload
        const payload = {
            operationName: "Common_SplitTransactionMutation",
            variables: {
                input: {
                    transactionId: transactionDetails.id,
                    splitData: [
                        {
                            merchantName: transactionDetails.merchant.name,
                            categoryId: transactionDetails.category.id,
                            amount: amount1,
                        },
                        {
                            merchantName: transactionDetails.merchant.name,
                            categoryId: transactionDetails.category.id,
                            amount: amount2,
                        },
                    ],
                },
            },
            query: `mutation Common_SplitTransactionMutation($input: UpdateTransactionSplitMutationInput!) {
                updateTransactionSplit(input: $input) {
                    errors {
                        ...PayloadErrorFields
                        __typename
                    }
                    transaction {
                        id
                        hasSplitTransactions
                        splitTransactions {
                            id
                            merchant {
                                id
                                name
                                __typename
                            }
                            category {
                                id
                                icon
                                name
                                __typename
                            }
                            amount
                            notes
                            __typename
                        }
                        __typename
                    }
                    __typename
                }
            }
            
            fragment PayloadErrorFields on PayloadError {
                fieldErrors {
                    field
                    messages
                    __typename
                }
                message
                code
                __typename
            }`,
        };

        return await callGraphQL(payload);
    }
}

// Get the transaction drawer details
async function getTransactionDrawerDetails(transactionDetails, row) {
    // Check if the transaction is already split
    if (transactionDetails.isSplitTransaction) {

        // Create the GraphQL payload to get transaction drawer details
        const payload = {
            operationName: "GetTransactionDrawer",
            variables: {
                id: transactionDetails.id,
                redirectPosted: true
            },
            query: `query GetTransactionDrawer($id: UUID!, $redirectPosted: Boolean) {
                getTransaction(id: $id, redirectPosted: $redirectPosted) {
                    id
                    ...TransactionDrawerFields
                    __typename
                }
                myHousehold {
                    id
                    users {
                        id
                        name
                        __typename
                    }
                    __typename
                }
            }

            fragment TransactionDrawerSplitMessageFields on Transaction {
                id
                amount
                merchant {
                    id
                    name
                    __typename
                }
                category {
                    id
                    icon
                    name
                    __typename
                }
                __typename
            }

            fragment OriginalTransactionFields on Transaction {
                id
                date
                amount
                merchant {
                    id
                    name
                    __typename
                }
                __typename
            }

            fragment AccountLinkFields on Account {
                id
                displayName
                icon
                logoUrl
                id
                __typename
            }

            fragment TransactionOverviewFields on Transaction {
                id
                amount
                pending
                date
                hideFromReports
                plaidName
                notes
                isRecurring
                reviewStatus
                needsReview
                isSplitTransaction
                dataProviderDescription
                attachments {
                    id
                    __typename
                }
                category {
                    id
                    name
                    icon
                    group {
                        id
                        type
                        __typename
                    }
                    __typename
                }
                merchant {
                    name
                    id
                    transactionsCount
                    logoUrl
                    recurringTransactionStream {
                        frequency
                        isActive
                        __typename
                    }
                    __typename
                }
                tags {
                    id
                    name
                    color
                    order
                    __typename
                }
                account {
                    id
                    displayName
                    icon
                    logoUrl
                    __typename
                }
                __typename
            }

            fragment TransactionDrawerFields on Transaction {
                id
                amount
                pending
                isRecurring
                date
                originalDate
                hideFromReports
                needsReview
                reviewedAt
                reviewedByUser {
                    id
                    name
                    __typename
                }
                plaidName
                notes
                hasSplitTransactions
                isSplitTransaction
                isManual
                splitTransactions {
                    id
                    ...TransactionDrawerSplitMessageFields
                    __typename
                }
                originalTransaction {
                    id
                    ...OriginalTransactionFields
                    __typename
                }
                attachments {
                    id
                    publicId
                    extension
                    sizeBytes
                    filename
                    originalAssetUrl
                    __typename
                }
                account {
                    id
                    hideTransactionsFromReports
                    ...AccountLinkFields
                    __typename
                }
                category {
                    id
                    __typename
                }
                goal {
                    id
                    __typename
                }
                merchant {
                    id
                    name
                    transactionCount
                    logoUrl
                    recurringTransactionStream {
                        id
                        frequency
                        __typename
                    }
                    __typename
                }
                tags {
                    id
                    name
                    color
                    order
                    __typename
                }
                needsReviewByUser {
                    id
                    __typename
                }
                ...TransactionOverviewFields
                __typename
            }`
        };


        return await callGraphQL(payload);
    }
}

// Unsplit a transaction
async function unsplitTransaction(originalTransactionId) {
    const payload = {
        operationName: "Common_SplitTransactionMutation",
        variables: {
        input: {
            transactionId: originalTransactionId,
            splitData: []
        }
    },
    query: `mutation Common_SplitTransactionMutation($input: UpdateTransactionSplitMutationInput!) {
        updateTransactionSplit(input: $input) {
            errors {
                ...PayloadErrorFields
                __typename
            }
            transaction {
                id
                hasSplitTransactions
                splitTransactions {
                    id
                    amount
                    notes
                    hideFromReports
                    reviewStatus
                    merchant {
                        id
                        name
                        __typename
                    }
                    category {
                        id
                        icon
                        name
                        __typename
                    }
                    goal {
                        id
                        __typename
                    }
                    needsReviewByUser {
                        id
                        __typename
                    }
                    tags {
                        id
                        __typename
                    }
                    __typename
                }
                __typename
            }
            __typename
        }
    }

    fragment PayloadErrorFields on PayloadError {
        fieldErrors {
            field
            messages
            __typename
        }
        message
                code
                __typename
            }`
    };

    return await callGraphQL(payload);  
}

// Add tags to the split transactions
async function addTagsToSplitTransactions(transactionDetails, splitTransactions) {
    // get the necessary tag IDs
    var splitWithDebTagId = await getTagIdWithTagName(SplitWithDebTagName);

    // Get all the tag IDs on the original transaction, thats not the split with deb tag
    let tagIds = transactionDetails.tags
        .filter(tag => tag.id !== splitWithDebTagId)
        .map(tag => tag.id);

    // Add the split with deb tag ID to the tag list
    if (tagIds.length > 0) {
        tagIds.push(splitWithDebTagId);
    } else {
        tagIds = [splitWithDebTagId];
    }

    // Now apply tagIds on to the two split transactions. 
    // Check for errors in the result and return a success message if there are no errors
    var setTagsResponse1 = await setTransactionTags(splitTransactions[0].id, tagIds);
    var setTagsResponse2 = await setTransactionTags(splitTransactions[1].id, tagIds);

    // Check for errors in the result and return a success message if there are no errors
    if (setTagsResponse1.setTransactionTags.errors === null && setTagsResponse2.setTransactionTags.errors === null) {
        return true;
    }
    else {
        return false;
    }
}

// Hide a split transaction
async function hideSplitTransaction(transactionId) {
    const json = {
        operationName: "Web_TransactionDrawerUpdateTransaction",
        variables: {
            input: {
                id: transactionId,
                hideFromReports: true
            }
        },
        query: `mutation Web_TransactionDrawerUpdateTransaction($input: UpdateTransactionMutationInput!) {
            updateTransaction(input: $input) {
                transaction {
                    id
                    amount
                    pending
                    date
                    hideFromReports
                    needsReview
                    reviewedAt
                    reviewedByUser {
                        id
                        name
                        __typename
                    }
                    plaidName
                    notes
                    isRecurring
                    category {
                        id
                        __typename
                    }
                    goal {
                        id
                        __typename
                    }
                    merchant {
                        id
                        name
                        __typename
                    }
                    __typename
                }
                errors {
                    ...PayloadErrorFields
                    __typename
                }
                __typename
            }
        }
        
        fragment PayloadErrorFields on PayloadError {
            fieldErrors {
                field
                messages
                __typename
            }
            message
            code
            __typename
        }`
    };

    return await callGraphQL(json);

}

// Get the tag details by name
async function getTagIdWithTagName(tagName) {
    const json = {
        operationName: "GetHouseholdTransactionTags",
        variables: {},
        query: `query GetHouseholdTransactionTags {
            householdTransactionTags {
                id
                name
                color
                order
                transactionCount
                __typename
            }
        }`
    };

    const response = await callGraphQL(json);
    const tags = response.householdTransactionTags;

    // Find the tag with the specified name
    const tag = tags.find(t => t.name === tagName);
    return tag ? tag.id : null; // Return the tag ID or null if not found
}

// Set tags for a transaction. TagIds is an array of tag IDs
async function setTransactionTags(transactionId, tagIds) {
    const json = {
        operationName: "Web_SetTransactionTags",
        variables: {
            input: {
                transactionId: transactionId,
                tagIds: tagIds
            }
        },
        query: `mutation Web_SetTransactionTags($input: SetTransactionTagsInput!) {
            setTransactionTags(input: $input) {
                errors {
                    ...PayloadErrorFields
                    __typename
                }
                transaction {
                    id
                    tags {
                        id
                        __typename
                    }
                    __typename
                }
                __typename
            }
        }
        
        fragment PayloadErrorFields on PayloadError {
            fieldErrors {
                field
                messages
                __typename
            }
            message
            code
            __typename
        }`
    };

    return await callGraphQL(json);
}


//--------- SPLITWISE FUNCTIONS ---------
// Get the current user's Splitwise ID
async function getSplitwiseUserId() {
    const splitwiseApiUrl = "https://secure.splitwise.com/api/v3.0/get_current_user";

    try {
        const response = await GM.xmlHttpRequest({
            method: "GET",
            url: splitwiseApiUrl,
            headers: {
                "Authorization": `Bearer ${SplitwiseApiKey}`
            }
        });

        if (response.status === 200) {
            const user = JSON.parse(response.responseText).user;
            return user.id;
        } else {
            showToast(`Error getting Splitwise user: ${response.statusText}`, "error");
            throw new Error(response.statusText);
        }
    } catch (error) {
        showToast("Failed to get Splitwise user", "error");
        throw error;
    }
}

// Function to create a new expense in Splitwise
async function addExpenseToSplitwise(expenseDetails, myUserId, debUserId) {
    const splitwiseApiUrl = "https://secure.splitwise.com/api/v3.0/create_expense";
    let groupId = 0;
    let description = expenseDetails.merchant.name + " charged not on Savor card";

    var expenseAmount = expenseDetails.amount * -1;

    // round to 2 decimal places
    var myOwedShare = Math.round(expenseAmount / 2 * 100) / 100;
    var debOwedShare = Math.round(expenseAmount / 2 * 100) / 100;

    // if the sum of myOwedShare and debOwedShare is not equal to expenseAmount, then subtract the difference from myOwedShare
    if (myOwedShare + debOwedShare !== expenseAmount) {
        myOwedShare = myOwedShare - (myOwedShare + debOwedShare - expenseAmount);
    }

    if (expenseDetails.category.name === "Gas Bill") {
        var monthName = new Date(expenseDetails.date).toLocaleString('default', { month: 'long' });
        var year = expenseDetails.date.split("-")[0];
        groupId = HomeRevereSWGroupId;
        description = "Gas - " + year + " " + monthName;
    }
    else if (expenseDetails.category.name === "Electric Bill") {
        var monthName = new Date(expenseDetails.date).toLocaleString('default', { month: 'long' });
        var year = expenseDetails.date.split("-")[0];
        groupId = HomeRevereSWGroupId;
        description = "Electric - " + year + " " + monthName;
    }

    
    // Create the expense data object
    const expenseData = {
        "cost": expenseAmount.toString(),
        "description": description,
        "details": "Category: " + expenseDetails.category.name + ", Notes: " + expenseDetails.notes,
        "date": expenseDetails.date,
        "group_id": groupId,
        "users__0__user_id": myUserId,
        "users__0__paid_share": expenseAmount.toString(),
        "users__0__owed_share": myOwedShare.toString(),
        "users__1__user_id": debUserId,
        "users__1__paid_share": "0",
        "users__1__owed_share": debOwedShare.toString()
    };

    try {
        const response = await GM.xmlHttpRequest({
            method: "POST",
            url: splitwiseApiUrl,
            headers: {
                "Authorization": `Bearer ${SplitwiseApiKey}`,
                "Content-Type": "application/json"
            },
            data: JSON.stringify(expenseData)
        });

        if (response.status === 200) {
            // Deserialize the response and check if there are any errors in the response.errors JSON object
            var responseJson = JSON.parse(response.responseText);   

            // if responseJson.errors is not empty, then show an error toast
            if (responseJson.errors.length > 0) {
                showToast(`Error creating expense: ${responseJson.errors.base}`, "error");
            }
            else {
                showToast("Expense created successfully!", "success");
                return responseJson;
            }
        } else {
            showToast(`Error creating expense: ${response.statusText}`, "error");
            throw new Error(response.statusText);
        }
    } catch (error) {
        showToast("Failed to create expense", "error");
        throw error;
    }
}

//---------------------- HELPER FUNCTIONS ----------------------

// Inject the styles if they are not already injected
function injectStylesIfNeeded() {
    if (!document.getElementById("mmm-toast-styles")) {
        const css = GM_getResourceText("MMMCSS");
        const style = document.createElement("style");
        style.id = "mmm-toast-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }
}

// Set the full transaction object on the drawer toggle
function setFullTransactionObject(row, fullTransactionObject) {
    const drawerToggle = row.querySelector("button.fs-drawer-toggle");

    if (drawerToggle) { 
        const key = Object.keys(drawerToggle).find((key) =>
            key.startsWith("__reactFiber$")
        );
        if (key) {
            let fiber = drawerToggle[key];   
            while (fiber) {
                if (fiber.memoizedProps?.transaction) {
                    fiber.memoizedProps.transaction = fullTransactionObject;
                    return true;
                }
                fiber = fiber.return;
            }
        }
    }
    return false;
}

// Get the full transaction object from the drawer toggle
function getFullTransactionObject(row) {
    const drawerToggle = row.querySelector("button.fs-drawer-toggle");

    if (drawerToggle) { 
        const key = Object.keys(drawerToggle).find((key) =>
            key.startsWith("__reactFiber$")
        );
        if (key) {
            let fiber = drawerToggle[key];   
            while (fiber) {
                if (fiber.memoizedProps?.transaction) {
                    return fiber.memoizedProps.transaction;
                }
                fiber = fiber.return;
            }
        }
    }
    return null;
}

// Return attributes of a transaction for a given row by accessing the React fiber of the drawer toggle
function getTransactionDetailsForRow(row) {
    let result = null;
    const drawerToggle = row.querySelector("button.fs-drawer-toggle");
    if (drawerToggle) {
        const key = Object.keys(drawerToggle).find((key) =>
            key.startsWith("__reactFiber$")
        );
        if (key) {
            let fiber = drawerToggle[key];
            while (fiber) {
                if (fiber.memoizedProps?.transaction) {
                    let transactionDetails = fiber.memoizedProps.transaction;
                    result = {
                        id: transactionDetails.id,
                        accountId: transactionDetails.account.id,
                        amount: transactionDetails.amount,
                        date: transactionDetails.date,
                        hasSplitTransactions: transactionDetails.hasSplitTransactions,
                        isSplitTransaction: transactionDetails.isSplitTransaction,
                        merchant: { name: transactionDetails.merchant.name },
                        category: { 
                            id: transactionDetails.category.id, 
                            name: transactionDetails.category.name 
                        },
                        notes: transactionDetails.notes,
                        tags: transactionDetails.tags.map((tag) => ({
                            id: tag.id,
                            name: tag.name,
                        })),
                    };
                    break;
                }
                fiber = fiber.return;
            }
        }
    }
    return result;
}

// Force update a React component instance
function forceUpdateElement(element) {
    if (element) {
        // Access the React fiber node
        const fiberKey = Object.keys(element).find(key => key.startsWith("__reactFiber$"));
        if (fiberKey) {
            let fiber = element[fiberKey];

            // Find the nearest class component instance
            let instance = null;
            let currentFiber = fiber;
            while (currentFiber) {
                if (currentFiber.stateNode && currentFiber.stateNode.forceUpdate) {
                    instance = currentFiber.stateNode;
                    break;
                }
                currentFiber = currentFiber.return;
            }
            
        if (instance) {
            instance.forceUpdate();
            return true;
        }
        } else {
            console.error('No React fiber node found for the element.');
        }
    } else {
        console.error('Element not found.');
    }

    return false;
}

// Find and force update a specific transaction row
function refreshTransactionRowByDateAndMerchant(date, merchantName) {
    // Find all transaction rows
    const transactionRows = document.querySelectorAll('div[class*="TransactionsListRow"]');
    
    // Find the specific row that matches both date and merchant
    for (const row of transactionRows) {
        const dateElement = row.querySelector('div[class*="TransactionDate"]');
        const merchantElement = row.querySelector('div[class*="TransactionMerchantSelect"]');
        
        if (dateElement?.textContent.includes(date) && 
            merchantElement?.textContent.includes(merchantName)) {
            return forceUpdateTransactionRow(row);
        }
    }
    return false;
}

// Example usage:
// refreshTransactionRowByDateAndMerchant("January 9, 2025", "CRICO RMF");


// Function to show a toast notification. Include a fade out duration parameter in seconds
function showToast(message, type = "success", fadeOutDuration = 5) {
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.innerText = message;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 1000);
    }, fadeOutDuration * 1000);
}

// Helper function to call the GraphQL API
function callGraphQL(data) {
    var options = {
        mode: "cors",
        method: "POST",
        headers: {
            accept: "*/*",
            authorization: `Token ${getGraphqlToken()}`,
            "content-type": "application/json",
            origin: "https://app.monarchmoney.com",
        },
        body: JSON.stringify(data),
    };

    return fetch(GRAPHQL_URL, options)
        .then((response) => response.json())
        .then((data) => {
            return data.data;
        })
        .catch((error) => {
            console.error(version, error);

            // determine what OperationName is being called. This can be found in the data object. Then show a toast accordingly
            if (data.operationName === "Common_SplitTransactionMutation") {
                showToast(
                    `Error while splitting transaction ${transactionDetails.id}.`,
                    "error"
                );
            } else if (data.operationName === "Web_TransactionDrawerUpdateTransaction"
                && data.input.hideFromReports === true) {
                showToast(
                    `Error while hiding transaction ${transactionDetails.id}.`,
                    "error"
                );
            } else if (data.operationName == "GetHouseholdTransactionTags") {
                showToast(
                    `Error while fetching tag details for ${SplitWithDebTagName}.`,
                    "error"
                );
            } else if (data.operationName == "Web_SetTransactionTags") {
                showToast(
                    `Error while setting tags on transaction ${transactionDetails.id}.`,
                    "error"
                );
            } else {
                showToast(
                    `Error while invoking GraphQL API for transaction ${transactionDetails.id}.`,
                    "error"
                );
            }
        });
}

// Helper function to get the GraphQL token from localStorage
function getGraphqlToken() {
    return JSON.parse(JSON.parse(localStorage.getItem("persist:root")).user)
        .token;
}


