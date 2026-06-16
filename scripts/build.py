from __future__ import annotations

import html
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


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


def absolute_url(base_url: str, path: str) -> str:
    return urljoin(base_url, path)


def json_script(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    return f'<script type="application/ld+json">\n{payload}\n  </script>'


def paper_link(link: dict[str, str]) -> str:
    label = esc(link["label"])
    url = esc(link["url"])
    if label.lower() == "arxiv":
        return f"""
        <a class="text-link" href="{url}" target="_blank" rel="noreferrer" aria-label="Open arXiv preprint">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7 3.8h6.2L18 8.6v11.6H7z"></path>
            <path d="M13 4v5h5"></path>
            <path d="M9.8 13.4h5.4"></path>
            <path d="M9.8 16.4h4"></path>
          </svg>
          <span>arXiv</span>
          <svg class="external-mark" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7 17 17 7"></path>
            <path d="M9 7h8v8"></path>
          </svg>
        </a>
        """
    return f'<a class="text-link" href="{url}" target="_blank" rel="noreferrer">{label}</a>'


def profile_link(link: dict[str, str]) -> str:
    label = esc(link["label"])
    url = esc(link["url"])
    if label.lower() == "google scholar":
        return f"""
        <a class="text-link" href="{url}" target="_blank" rel="noreferrer" aria-label="Open Google Scholar profile">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 10.2 12 5l8 5.2-8 5.2z"></path>
            <path d="M7.2 12.3v4.1c1.1 1.2 2.7 1.9 4.8 1.9s3.7-.7 4.8-1.9v-4.1"></path>
            <path d="M20 10.2v5"></path>
          </svg>
          <span>Google Scholar</span>
          <svg class="external-mark" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7 17 17 7"></path>
            <path d="M9 7h8v8"></path>
          </svg>
        </a>
        """
    return f'<a class="text-link" href="{url}" target="_blank" rel="noreferrer">{label}</a>'


def render(data: dict, profile_html: str) -> str:
    site = data["site"]
    profile = data["profile"]
    site_url = site["url"].rstrip("/") + "/"
    image_url = absolute_url(site_url, profile["photo"])
    keywords = ", ".join(site.get("keywords", []))
    keywords_meta = f'  <meta name="keywords" content="{esc(keywords)}">\n' if keywords else ""
    same_as = profile.get("same_as", [])
    person_schema = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": profile["name"],
        "alternateName": [profile["name_cn"], profile.get("username", ""), "junzehe"],
        "url": site_url,
        "image": image_url,
        "jobTitle": profile["role"],
        "affiliation": {
            "@type": "CollegeOrUniversity",
            "name": profile["affiliation"],
        },
        "alumniOf": [
            {
                "@type": "CollegeOrUniversity",
                "name": "Central South University",
            }
        ],
        "email": [f"mailto:{email}" for email in profile["email"]],
        "sameAs": same_as,
        "knowsAbout": data["research_interests"],
    }
    email_links = "".join(f'<a href="mailto:{esc(email)}">{esc(email)}</a>' for email in profile["email"])
    email_note = esc(profile.get("email_note", ""))
    email_note_html = f'<p class="email-note">{email_note}</p>' if email_note else ""
    profile_links = "".join(profile_link(link) for link in profile.get("profile_links", []))
    profile_links_block = f'<div class="profile-links" aria-label="Academic profiles">{profile_links}</div>' if profile_links else ""
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
        pub_links = "".join(paper_link(link) for link in pub.get("links", []))
        authors = esc(pub["authors"]).replace("Junze He", "<strong>Junze He</strong>")
        pub_year = esc(pub.get("year", ""))
        publication_class = "publication" if pub_year else "publication publication-no-date"
        year_column = f'<div class="item-date">{pub_year}</div>' if pub_year else ""
        publications += f"""
        <article class="{publication_class}">
          {year_column}
          <div>
            <h3>{esc(pub["title"])}</h3>
            <p class="authors">{authors}</p>
            <p class="venue-line">{esc(pub["venue"])}</p>
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
  <meta name="author" content="{esc(profile["name"])}">
  <meta name="robots" content="index, follow">
{keywords_meta}  <link rel="canonical" href="{esc(site_url)}">
  <meta property="og:title" content="{esc(site["title"])}">
  <meta property="og:description" content="{esc(site["description"])}">
  <meta property="og:url" content="{esc(site_url)}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="{esc(profile["name"])}">
  <meta property="og:image" content="{esc(image_url)}">
  <meta property="profile:first_name" content="Junze">
  <meta property="profile:last_name" content="He">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(site["title"])}">
  <meta name="twitter:description" content="{esc(site["description"])}">
  <meta name="twitter:image" content="{esc(image_url)}">
  <title>{esc(site["title"])}</title>
  <link rel="icon" href="static/assets/favicon.ico">
  <link rel="stylesheet" href="static/css/site.css">
  {json_script(person_schema)}
</head>
<body>
  <canvas id="fluid-canvas" aria-hidden="true"></canvas>
  <div class="glass-atmosphere" aria-hidden="true"></div>
  <div class="glass-sheen" aria-hidden="true"></div>
  <div class="glass-lens" aria-hidden="true"></div>

  <header class="site-header">
    <a class="brand" href="#home">{esc(profile["name"])}</a>
    <nav aria-label="Primary">
      <a href="#home">HOME</a>
      <a href="#news">NEWS</a>
      <a href="#publications">PUBLICATIONS</a>
    </nav>
  </header>

  <div id="smooth-content">
  <main>
    <section class="hero-wrap section" id="home">
      <div class="hero">
        <div class="home-main">
          <h1>{esc(profile["name"])} <span>{esc(profile["name_cn"])}</span></h1>
          <div class="bio">{profile_html}{profile_links_block}</div>
        </div>
        <aside class="portrait-stage">
          <img src="{esc(profile["photo"])}" alt="Portrait of {esc(profile["name"])}">
        </aside>
        <div class="scroll-cue">More</div>
      </div>
    </section>

    <section class="section home-meta reveal" aria-label="Home details">
      <div class="meta-block">
        <h2>Email</h2>
        <div class="email-list">{email_links}</div>
        {email_note_html}
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

    <section class="section content-section reveal" id="news">
      <h2>News</h2>
      <div class="item-list">{news}</div>
    </section>

    <section class="section content-section reveal" id="publications">
      <h2>Publications</h2>
      <div class="publication-list">{publications}</div>
    </section>
  </main>

  <footer>
    <p>&copy; {datetime.now().year} {esc(profile["name"])}. All rights reserved.</p>
  </footer>
  </div>

  <script type="module" src="static/js/site.js"></script>
</body>
</html>
"""


def main() -> None:
    data = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    profile_html = markdown_to_html((CONTENT / "profile.md").read_text(encoding="utf-8"))
    (ROOT / "index.html").write_text(render(data, profile_html), encoding="utf-8", newline="\n")
    site_url = data["site"]["url"].rstrip("/") + "/"
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {site_url}sitemap.xml\n",
        encoding="utf-8",
        newline="\n",
    )
    today = datetime.now().strftime("%Y-%m-%d")
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{esc(site_url)}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
"""
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
