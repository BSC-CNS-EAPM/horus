const MESSAGE =
  "This website uses essential cookies to maintain your session. These cookies are necessary for the website to function properly and are deleted when you close your browser.";

export function checkCookies() {
  if (window.horusInternal.webApp) {
    if (!localStorage.getItem("cookiesAccepted")) {
      alert(MESSAGE);
    }
    localStorage.setItem("cookiesAccepted", "true");
  }
}
