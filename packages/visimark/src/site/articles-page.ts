/**
 * docs/articles.html — every article in docs/articles/articles.json, as a
 * plain list.
 */

import { articleBody, loadArticles } from "./articles.js";
import { byId } from "./dom.js";

async function render(): Promise<void> {
  const list = byId("articles-list");
  if (!list) return;
  try {
    const articles = await loadArticles();
    list.innerHTML = articles
      .map((a) => `<article class="article-card">${articleBody(a, "h2")}</article>`)
      .join("\n");
  } catch (err) {
    list.textContent = `Could not load the article list (${(err as Error).message}).`;
  }
}

void render();
