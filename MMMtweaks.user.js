// ==UserScript==
// @name         Monarch Money Maddy Tweaks
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Enhance Monarch Money transaction page functionality
// @author       You
// @match        https://app.monarchmoney.com/transactions
// @grant        none
// @run-at       document-idle
// @resource     MMMCSS file://C:/DevStuff/tapermonkey/mmm-styles.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

const version = "1.0";
const GRAPHQL_URL = "https://api.monarchmoney.com/graphql"; // Ensure this is defined
const SplitWithDebTagName = "Split with Deb";

let currentUrl = window.location.href;

// Create a MutationObserver to watch for changes in the URL
const observer = new MutationObserver(() => {
    onPageStructureChanged();
});

// Start observing the document for changes in the child nodes
observer.observe(document, { childList: true, subtree: true });

// Core logic to handle the split button
function onPageStructureChanged() {
    // Check if the page is the transactions page or the accounts details page
    if (
        window.location.href.includes("transactions") ||
        window.location.href.includes("accounts/details")
    ) {
        // Check for transaction rows every second
        const checkForTransactions = setInterval(() => {
            const transactionRows = Array.from(
                document.querySelectorAll('div[class*="TransactionsListRow"]')
            ).filter((row) => {
                return (
                    row.querySelector('div[class*="TransactionOverview__Amount"]') &&
                    row.querySelector('div[class*="TransactionMerchantSelect"]')
                );
            });

            // If there are transactions, stop checking for them
            if (transactionRows.length > 0) {
                clearInterval(checkForTransactions);

                // Check if the CSS has already been added
                if (!document.getElementById("mmm-toast-styles")) {
                    // Inject CSS
                    const css = GM_getResourceText("MMMCSS");
                    const style = document.createElement("style");
                    style.id = "mmm-toast-styles"; // Set an ID for the style element
                    style.textContent = css;
                    document.head.appendChild(style);
                }

                // Add the button to each transaction row
                transactionRows.forEach((row) => {
                    // Check if the button is not already present
                    if (!row.querySelector(".monarch-helper-button")) {
                        let isAlreadySplit =
                            getTransactionDetailsForRow(row).isSplitTransaction;

                        // Check if the transaction is not already split
                        if (!isAlreadySplit) {
                            const buttonContainer = document.createElement("div");
                            buttonContainer.className = "button-container";

                            // Create the button
                            const button = document.createElement("button");
                            button.className = "monarch-helper-button";

                            // Copy existing button class names
                            const existingButton = document.querySelector(
                                'button[class*="Button"]'
                            );
                            if (existingButton) {
                                button.className += " " + existingButton.className;
                            }

                            // Add the button container class
                            buttonContainer.className += " button-container";

                            // Set the button text and style
                            button.innerHTML = "✂️";

                            // Add event listener to the button
                            button.onclick = async (e) => {
                                e.stopPropagation();
                                await splittingButtonEventHandler(row);
                            };

                            // Append the button to the container
                            buttonContainer.appendChild(button);

                            // Insert the button container before the transaction icon container
                            const transactionIconContainer = row.querySelector(
                                'div[class*="TransactionOverview__Icons"]'
                            );
                            if (transactionIconContainer) {
                                transactionIconContainer.parentNode.insertBefore(
                                    buttonContainer,
                                    transactionIconContainer
                                );
                            }
                        }
                    }
                });
            }
        }, 1000);
    }
}

async function splittingButtonEventHandler(row) {
    let transactionDetails = getTransactionDetailsForRow(row);

    // first split the transaction
    var splitResponse = await splitTransaction(transactionDetails, row);

    // if there were errors in the response then show an error message in a toast accordingly
    if (splitResponse && splitResponse.updateTransactionSplit.errors !== null) {
        showToast(
            `Error while splitting transaction ID ${transactionDetails.id}.`,
            "error"
        );
    }
    else {
        // now hide one of the split transactions
        var splitTransactionId = splitResponse.updateTransactionSplit.transaction.splitTransactions[0].id;
        var hideResponse = await hideSplitTransaction(splitTransactionId);

        // if there were errors in the response then show an error message in a toast accordingly
        if (hideResponse && hideResponse.updateTransaction.errors !== null) {
            showToast(
                `Error while hiding transaction ID ${splitTransactionId}.`,
                "error"
            );
        }
        else {
            var addTagsResponseSuccess = await addTagsToSplitTransactions(transactionDetails, splitResponse.updateTransactionSplit.transaction.splitTransactions);

            // if there were no errors then show a success toast
            if (addTagsResponseSuccess) {
                showToast(
                    `Transaction ${transactionDetails.id} split successfully!`,
                    "success"
                );
            }
        }
    }
}


// Split a transaction and tag it with the given category and tags
async function splitTransaction(transactionDetails, row) {
    if (
        !transactionDetails.hasSplitTransactions &&
        !transactionDetails.isSplitTransaction
    ) {
        const totalAmount = parseFloat(transactionDetails.amount);
        const splitAmount = Math.round((totalAmount / 2) * 100) / 100; // Round to 2 decimal places
        const amount1 = splitAmount;
        const amount2 = totalAmount - splitAmount;

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

async function addTagsToSplitTransactions(transactionDetails, splitTransactions){
    // get the tag id for the split with deb tag
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

    if (setTagsResponse1.setTransactionTags.errors === null && setTagsResponse2.setTransactionTags.errors === null) {
        return true;
    }
    else {
        return false;
    }
}

// Function to hide a split transaction
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

// Function to get the tag details by name
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

// Function to set tags for a transaction. TagIds is an array of tag IDs
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


//---------------------- HELPER FUNCTIONS ----------------------

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
                        amount: transactionDetails.amount,
                        date: transactionDetails.date,
                        hasSplitTransactions: transactionDetails.hasSplitTransactions,
                        isSplitTransaction: transactionDetails.isSplitTransaction,
                        merchant: { name: transactionDetails.merchant.name },
                        category: { id: transactionDetails.category.id },
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

// Function to show a toast notification. Include a fade out duration parameter in seconds
function showToast(message, type = "success", fadeOutDuration = 5) {
    const toast = document.createElement("div");
    toast.className =
        "toast-notification " +
        (type === "success" ? "toast-success" : "toast-error");
    toast.innerText = message;

    // Append the toast to the body
    document.body.appendChild(toast);

    // Fade out and remove the toast after fadeOutDuration seconds
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