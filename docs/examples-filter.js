// Filters the cards on examples.html by tag or by audience, one at a time:
// choosing in one row resets the other to All, so the list is never empty. The page works
// without it: the filter is `hidden` until this runs and every card stays shown.
(function () {
  var filter = document.getElementById("examples-filter");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".examples-list .article-card"));
  if (!filter || !cards.length) return;

  var attrs = { tags: "data-tags", audience: "data-audience" };
  var chosen = { tags: "", audience: "" };

  function has(card, group) {
    var value = chosen[group];
    return !value || (card.getAttribute(attrs[group]) || "").split("|").indexOf(value) !== -1;
  }

  function apply() {
    cards.forEach(function (card) {
      card.hidden = !(has(card, "tags") && has(card, "audience"));
    });
  }

  filter.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("button[data-value]");
    if (!button) return;
    var picked = button.parentNode.getAttribute("data-group");
    Array.prototype.forEach.call(filter.querySelectorAll(".examples-filter-group"), function (row) {
      var group = row.getAttribute("data-group");
      chosen[group] = group === picked ? button.getAttribute("data-value") : "";
      Array.prototype.forEach.call(row.querySelectorAll("button"), function (b) {
        var on = group === picked ? b === button : b.getAttribute("data-value") === "";
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    apply();
  });

  filter.hidden = false;
})();
