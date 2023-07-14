// Define the shemsu token
declare global {
  interface Window {
    pywebview: {
      token: string;
    };
  }
}

function getShemsuToken() {
  return window.pywebview?.token || window.parent?.pywebview?.token;
}

// Tokenize the urls with the shemsu token
async function horusGet(url, headers?, shemsu?) {
  return await fetch(url, {
    method: "GET",
    headers: {
      shemsu: shemsu || getShemsuToken(),
      ...headers,
    },
  });
}

async function horusPost(url, headers, body, shemsu?) {
  /* Send a post request to the server to open a window
   * @param {string} url - The url to send the request to
   * @param {object} headers - The headers to send with the request
   * @param {object} body - The body to send with the request. Remember to stringify it if the header is application/json
   * */

  return await fetch(url, {
    method: "POST",
    headers: {
      shemsu: shemsu || getShemsuToken(),
      ...headers,
    },
    body: body,
  });
}

async function getVersion() {
  // Fetch the data from /api/data
  const result = await horusGet("/api/version", {});

  // Check any error status code
  if (!result.ok) {
    throw new Error(`Error fetching data: ${result.status}`);
  }

  // Parse the result as JSON
  const data = await result.json();

  // Return the data
  return data;
}

async function getForceFields() {
  // Fetch the data from /api/data
  const result = await horusGet("/api/nbdsuite/forcefields", {});

  // Check any error status code
  if (!result.ok) {
    throw new Error(`Error fetching data: ${result.status}`);
  }

  // Parse the result as JSON
  const data = await result.json();

  // Return the data
  return data;
}

async function openWindow(name, url) {
  const header = {
    "Content-Type": "application/json",
  };

  const window = JSON.stringify({ name: name, url: url });

  // Send a post request to the server to open a window
  const result = await horusPost("/desktop/openWindow", header, window);

  // Check any error status code
  if (!result.ok) {
    throw new Error(`Error opening window: ${result.status}`);
  }

  // Parse the result as JSON
  const data = await result.json();

  // Return the data
  return data;
}

export { horusGet, horusPost, getVersion, getForceFields, openWindow };
