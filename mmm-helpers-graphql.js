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


// Export the functions to be used in the main script
window.graphqlHelpers = {
    callGraphQL: callGraphQL,
    getGraphqlToken: getGraphqlToken
}

