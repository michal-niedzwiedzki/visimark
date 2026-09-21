(()=>{function s(t){return document.getElementById(t)}function e(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function l(t){return`article.html?slug=${encodeURIComponent(t.slug)}`}async function n(){let t=await fetch("articles/articles.json");if(!t.ok)throw Error(`articles.json: HTTP ${t.status}`);return(await t.json()).articles}function a(t,r){let i=e(l(t));return`${t.icon?`<a class="articles-icon" href="${i}" tabindex="-1" aria-hidden="true"><img src="articles/${e(t.icon)}" width="400" height="400" alt="" /></a>`:""}<div class="articles-text">
            <${r}><a href="${i}">${e(t.title)}</a></${r}>
            <p class="articles-tags">${t.tags.map(e).join(", ")}</p>
            <p class="articles-teaser">${e(t.teaser)}</p>
            <a class="articles-read" href="${i}">Read the article &rarr;</a>
          </div>`}async function c(){let t=s("articles-list");if(!t)return;try{let r=await n();t.innerHTML=r.map((i)=>`<article class="article-card">${a(i,"h2")}</article>`).join(`
`)}catch(r){t.textContent=`Could not load the article list (${r.message}).`}}c();})();
