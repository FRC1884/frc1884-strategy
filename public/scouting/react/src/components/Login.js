"use strict";
// Sign-in screen. Real React state (no DOM string-building): username/password
// live in useState, submit calls the shared Lib.apiLogin helper, and errors
// render from state instead of manually toggling a hidden attribute.
(function (global) {
  const C = global.C || (global.C = {});
  const { useState, useEffect } = React;
  const h = React.createElement;

  function Login({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [sheetConfigured, setSheetConfigured] = useState(false);

    useEffect(() => {
      let cancelled = false;
      Lib.authStatus().then((d) => {
        if (!cancelled && d && d.configured) setSheetConfigured(true);
      });
      return () => { cancelled = true; };
    }, []);

    async function submit() {
      setError(null);
      try {
        const { name, role } = await Lib.apiLogin(username, password);
        onLogin(name, role);
      } catch (e) {
        setError((e && e.message) || "Sign-in failed.");
      }
    }

    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "Sign in"),
      h(
        "div", { className: "panel", style: { maxWidth: 420, margin: "16px auto 0" } },
        h(
          "div", { className: "formfield" },
          h("label", { htmlFor: "luser" }, "Username"),
          h("input", {
            type: "text", id: "luser", autoComplete: "username", placeholder: "username",
            value: username, onChange: (e) => setUsername(e.target.value), autoFocus: true,
          })
        ),
        h(
          "div", { className: "formfield" },
          h("label", { htmlFor: "lpass" }, "Password"),
          h("input", {
            type: "password", id: "lpass", autoComplete: "current-password", placeholder: "password",
            value: password, onChange: (e) => setPassword(e.target.value),
            onKeyDown: (e) => { if (e.key === "Enter") submit(); },
          })
        ),
        error && h("div", { className: "err" }, error),
        h("div", { className: "actions" }, h("button", { className: "btn", onClick: submit }, "Log in")),
        sheetConfigured
          ? h("p", { className: "help" }, "Sign in with the username and password from the team roster sheet. Access (scouting vs full analysis) is set per person in the sheet.")
          : h(
              "p", { className: "help" },
              "Demo accounts (password ", h("b", {}, "griffins"), "): ", h("b", {}, "coach"), " or ", h("b", {}, "analyst"),
              " \u2192 full access (scouting + analysis) \u00b7 ", h("b", {}, "scout"), " or ", h("b", {}, "maya"), " \u2192 scouting only."
            )
      )
    );
  }

  C.Login = Login;
})(window);
