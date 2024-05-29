// Purpose: Contains utility functions for the app

function getShemsuToken() {
  return window.pywebview?.token || window.parent?.pywebview?.token;
}

// Tokenize the urls with the shemsu token
async function horusGet(
  url: string,
  headers?: any,
  shemsu?: any,
  timeout?: number
) {
  const controller = new AbortController();
  const signal = controller.signal;

  let timeoutId: Timer | null = null;

  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout * 1000);
  }

  const fetchPromise = fetch(url, {
    method: "GET",
    headers: {
      socketiosid: window.socketiosid || parent.socketiosid || null,
      shemsu: shemsu || getShemsuToken(),
      ...headers,
    },
    signal,
  });

  try {
    const response = await fetchPromise;
    timeoutId && clearTimeout(timeoutId);
    return response;
  } catch (error) {
    timeoutId && clearTimeout(timeoutId);
    throw new Error("Timeout");
  }
}

async function horusPost(
  url: string,
  headers: any,
  body: any,
  shemsu?: string,
  timeout?: number | null
) {
  /* Send a post request to the server to open a window
   * @param {string} url - The url to send the request to
   * @param {object} headers - The headers to send with the request
   * @param {object} body - The body to send with the request. Remember to stringify it if the header is application/json
   * @param {number} timeout - The timeout duration in seconds
   * */

  if (headers === null) {
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  const controller = new AbortController();
  const signal = controller.signal;

  let timeoutId: Timer | null = null;

  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout * 1000);
  }

  const fetchPromise = fetch(url, {
    method: "POST",
    headers: {
      shemsu: shemsu || getShemsuToken(),
      socketiosid: window.socketiosid || parent.socketiosid || null,
      ...headers,
    },
    body: body,
    signal,
  });

  try {
    const response = await fetchPromise;
    timeoutId && clearTimeout(timeoutId);
    return response;
  } catch (error) {
    timeoutId && clearTimeout(timeoutId);
    throw new Error("Timeout");
  }
}
type HorusDeleteParams = {
  url: string;
  headers?: Record<string, string>;
  body?: any;
  shemsu?: string;
  timeout?: number | null;
};

async function horusDelete({
  url,
  headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body = null,
  shemsu,
  timeout = null,
}: HorusDeleteParams): Promise<Response> {
  /* Send a delete request to the server
   * @param {object} params - An object containing the parameters
   * @param {string} params.url - The URL to send the request to
   * @param {object} params.headers - The headers to send with the request
   * @param {object} params.body - The body to send with the request
   * @param {string} [params.shemsu] - An optional shemsu token
   * @param {number} [params.timeout] - An optional timeout duration in seconds
   * */

  const controller = new AbortController();
  const signal = controller.signal;

  let timeoutId: Timer | null = null;

  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout * 1000);
  }

  const fetchPromise = fetch(url, {
    method: "DELETE",
    headers: {
      shemsu: shemsu || getShemsuToken(),
      socketiosid:
        (window as any).socketiosid || (parent as any).socketiosid || null,
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
    signal,
  });

  try {
    const response = await fetchPromise;
    if (timeoutId) clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw new Error("Timeout");
  }
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

async function openWindow(name: string, url: string) {
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

const fetchInternals = async () => {
  try {
    const response = await horusGet("/api/internal");
    window.horusInternal = await response.json();
  } catch (err) {
    alert(
      `Could not detect running mode. Expect errors while running the app. ${err}`
    );
    window.horusInternal = {
      isDesktop: false,
      mode: "server",
      debug: false,
    };
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
  horusDelete,
  getVersion,
  openWindow,
  fetchInternals as fetchDesktop,
};

export function getRandomFromRange(max: number, min: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
