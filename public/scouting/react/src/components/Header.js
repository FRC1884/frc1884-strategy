"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const h = React.createElement;

  function Header({ user, mode, onSetMode, onLogout }) {
    if (!user) return h("div", {});
    return h(
      "div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" } },
      h(
        "div", { className: "modes", role: "tablist" },
        h("button", { role: "tab", "aria-selected": mode === "scout", onClick: () => onSetMode("scout") }, "Scout"),
        user.role === "analyst" &&
          h("button", { role: "tab", "aria-selected": mode === "analyst", onClick: () => onSetMode("analyst") }, "Analyst")
      ),
      h("span", { className: "userchip" }, user.name + (user.role === "scout" ? " \u00b7 scout" : "")),
      h("button", { className: "reset", onClick: onLogout }, "Log out")
    );
  }

  C.Header = Header;
})(window);
