# Junze He | 何俊泽 | junzehe0714

This repository powers the official academic homepage of Junze He (何俊泽):

<https://junzehe0714.github.io/>

Junze He is a first-year PhD student in Computer Science at City University of Hong Kong, with research interests in machine learning, optimization, and deep learning.

The site keeps the original homepage modules: `HOME`, `NEWS`, and `PUBLICATIONS`. Content is stored in simple files and `index.html` is generated from them.

## How To Update In VS Code

1. Edit `content/profile.md` for the biography text in `HOME`.
2. Edit `content/site.json` for email, links, education, research interests, news, and publications.
3. Put image assets in `static/assets/img/`.
4. Run the VS Code task `Build homepage`, or run:

```powershell
python scripts/build.py
```

5. Preview locally:

```powershell
python -m http.server 4173
```

Then open <http://127.0.0.1:4173/>.

6. Commit and push to GitHub. The public URL stays unchanged:

<https://junzehe0714.github.io/>

## Files

- `content/profile.md`: homepage biography.
- `content/site.json`: structured academic content.
- `scripts/build.py`: generator for `index.html`.
- `static/css/site.css`: visual style.
- `static/assets/img/`: portrait and image assets.
- `robots.txt` and `sitemap.xml`: generated SEO discovery files.
