// Tokenize the urls with the shemsu token
async function horusGet(url, method, headers) {
    return fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            shemsu: window.shemsu,
            ...headers
        }
    })
}

async function horusPost(url, method, body) {
    return fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            shemsu: window.shemsu
        },
        body: JSON.stringify(body)
    })
}

async function getVersion() {
    // Fetch the data from /api/data
    const result = await horusGet("/api/version", "GET", {});

    // Check any error status code
    if (!result.ok) {
        throw new Error(`Error fetching data: ${result.status}`);
    }

    console.log(result)

    // Parse the result as JSON
    const data = await result.json();

    // Return the data
    return data;

}

export default getVersion;