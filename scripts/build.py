from __future__ import annotations

import html
import json
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def markdown_inline(text: str) -> str:
    text = esc(text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" target="_blank" rel="noreferrer">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    return text


def markdown_to_html(markdown: str) -> str:
    blocks: list[str] = []
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            blocks.append(f"<p>{markdown_inline(' '.join(paragraph))}</p>")
            paragraph.clear()

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            continue
        paragraph.append(line)

    flush_paragraph()
    return "\n".join(blocks)


def format_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return value


def link_buttons(items: list[dict[str, str]]) -> str:
    links = []
    for item in items:
        links.append(
            f'<a class="text-link" href="{esc(item["url"])}" target="_blank" rel="noreferrer">{esc(item["label"])}</a>'
        )
    return "\n".join(links)


def render(data: dict, profile_html: str) -> str:
    site = data["site"]
    profile = data["profile"]
    email_links = "".join(f'<a href="mailto:{esc(email)}">{esc(email)}</a>' for email in profile["email"])
    interests = "".join(f"<li>{esc(item)}</li>" for item in data["research_interests"])

    education = "".join(
        f"""
        <article class="compact-item">
          <div class="item-date">{esc(item["period"])}</div>
          <div>
            <h3>{esc(item["degree"])}</h3>
            <p>{esc(item["institution"])}</p>
            <span>{esc(item["details"])}</span>
          </div>
        </article>
        """
        for item in data["education"]
    )

    news = "".join(
        f"""
        <article class="compact-item">
          <time class="item-date" datetime="{esc(item["date"])}">{esc(format_date(item["date"]))}</time>
          <p>{esc(item["text"])}</p>
        </article>
        """
        for item in data["news"]
    )

    publications = ""
    for pub in data["publications"]:
        pub_links = "".join(
            f'<a class="text-link" href="{esc(link["url"])}" target="_blank" rel="noreferrer">{esc(link["label"])}</a>'
            for link in pub.get("links", [])
        )
        authors = esc(pub["authors"]).replace("Junze He", "<strong>Junze He</strong>")
        publications += f"""
        <article class="publication">
          <div class="item-date">{esc(pub["year"])}</div>
          <div>
            <h3>{esc(pub["title"])}</h3>
            <p class="authors">{authors}</p>
            <p>{esc(pub["venue"])}</p>
            <div class="inline-links">{pub_links}</div>
          </div>
        </article>
        """

    return f"""<!doctype html>
<html lang="{esc(site["language"])}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{esc(site["description"])}">
  <meta property="og:title" content="{esc(site["title"])}">
  <meta property="og:description" content="{esc(site["description"])}">
  <meta property="og:url" content="{esc(site["url"])}">
  <title>{esc(site["title"])}</title>
  <link rel="icon" href="static/assets/favicon.ico">
  <link rel="stylesheet" href="static/css/site.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="#home">{esc(profile["name"])}</a>
    <nav aria-label="Primary">
      <a href="#home">HOME</a>
      <a href="#news">NEWS</a>
      <a href="#publications">PUBLICATIONS</a>
    </nav>
  </header>

  <main>
    <section class="section home" id="home">
      <div class="home-main">
        <p class="eyebrow">{esc(profile["role"])}</p>
        <h1>{esc(profile["name"])} <span>{esc(profile["name_cn"])}</span></h1>
        <p class="affiliation">{esc(profile["affiliation"])}</p>
        <div class="bio">{profile_html}</div>
        <div class="inline-links">
          {link_buttons(profile["links"])}
        </div>
      </div>
      <aside class="portrait-card">
        <img src="{esc(profile["photo"])}" alt="Portrait of {esc(profile["name"])}">
      </aside>
    </section>

    <section class="section home-meta" aria-label="Home details">
      <div class="meta-block">
        <h2>Email</h2>
        <div class="email-list">{email_links}</div>
      </div>
      <div class="meta-block">
        <h2>Education</h2>
        <div class="item-list">{education}</div>
      </div>
      <div class="meta-block">
        <h2>Research Interests</h2>
        <ul class="interest-list">{interests}</ul>
      </div>
    </section>

    <section class="section content-section" id="news">
      <h2>News</h2>
      <div class="item-list">{news}</div>
    </section>

    <section class="section content-section" id="publications">
      <h2>Publications</h2>
      <div class="publication-list">{publications}</div>
    </section>
  </main>

  <footer>
    <p>© {datetime.now().year} {esc(profile["name"])}. All rights reserved.</p>
  </footer>
</body>
</html>
"""


def main() -> None:
    data = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    profile_html = markdown_to_html((CONTENT / "profile.md").read_text(encoding="utf-8"))
    (ROOT / "index.html").write_text(render(data, profile_html), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
