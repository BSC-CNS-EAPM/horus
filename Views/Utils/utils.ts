// Define the shemsu token
declare global {
  interface Window {
    pywebview: {
      token: string;
    };
    socketiosid: string;
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
      socketiosid: window.socketiosid || parent.socketiosid || null,
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

  if (headers === null) {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  return await fetch(url, {
    method: "POST",
    headers: {
      shemsu: shemsu || getShemsuToken(),
      socketiosid: window.socketiosid || parent.socketiosid || null,
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

async function openWindow(name, url) {
  const header = {
    "Content-Type": "application/json",
  };

  const window = JSON.stringify({ name: name, url: url });

  // Send a post request to the server to open a window
  const result = await horusPost("/api/desktop/openwindow", header, window);

  // Check any error status code
  if (!result.ok) {
    throw new Error(`Error opening window: ${result.status}`);
  }

  // Parse the result as JSON
  const data = await result.json();

  // Return the data
  return data;
}

const fetchDesktop = async () => {
  try {
    const response = await horusGet("/api/isdesktop");
    window.isDesktop = await response.json();
  } catch (err) {
    alert(
      `Could not detect running mode. Expect errors while running the app. ${err}`
    );
    window.isDesktop = false;
  }
};

async function horusGetSettings(settingID: string) {
  const response = await horusGet(`/api/settings/${settingID}`);

  const setting = await response.json();

  if (!setting.ok) {
    alert(`Error fetching settings: ${setting.msg}`);
  }

  return setting.setting;
}

export {
  horusGetSettings,
  horusGet,
  horusPost,
  getVersion,
  openWindow,
  fetchDesktop,
};
