#!/usr/bin/env python3
"""Fetch enabled RSS feeds defined in FEEDS and write news.json."""

import email.utils
import hashlib
import json
import os
import re
import defusedxml.ElementTree as ET
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen

FEEDS: dict = {
    'skatt': {
        'label': 'Skatt & juridik', 'hue': 24,
        'sources': [
            ('SKV Rättslig vägledning 1', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.71e0e530146a50ea9ac139', True),
            ('SKV Rättslig vägledning 2', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.669f7efe1468ee8b548162e', True),
            ('SKV Rättslig vägledning 3', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.703cf5a5146ada421629626', True),
            ('SKV Rättslig vägledning 4', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.703cf5a5146ada421629657', True),
            ('SKV Rättslig vägledning 5', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.669f7efe1468ee8b548161f', True),
            ('Skatterättsnämnden', 'https://skatterattsnamnden.se/4.14dfc9b0163796ee3e77aa3a/12.14dfc9b0163796ee3e77aa45.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8', True),
            ('PwC Tax Matters', 'https://blogg.pwc.se/taxmatters/rss.xml', True),
            ('Regeringen (skatt)', 'https://www.regeringen.se/Filter/RssFeed?filterType=Taxonomy&filterByType=FilterablePageBase&preFilteredCategories=1284%2C1285%2C1286%2C1287%2C1288%2C1290%2C1291%2C1292%2C1293%2C1294%2C1295%2C1296%2C1297%2C2425&rootPageReference=0&filteredContentCategories=2097%2C2540%2C1339%2C2098%2C1334%2C1341%2C2099%2C1324%2C1325%2C1326%2C1327%2C2085%2C1329%2C1330%2C1331%2C1332&filteredPoliticalLevelCategories=&filteredPoliticalAreaCategories=1267&filteredPublisherCategories=', True),
            ('HFD nyheter', 'https://www.domstol.se/feed/56/?searchPageId=1092&scope=news&facets=%5B{%22id%22:%22organization%22,%22name%22:%22%22,%22type%22:%22list%22,%22facets%22:%5B{%22value%22:%221076%22}%5D},{%22id%22:%22NewsArticleType%22,%22name%22:%22%22,%22type%22:%22list%22,%22facets%22:%5B{%22value%22:%22news%22}%5D}%5D', True),
        ],
    },
    'teknik': {
        'label': 'Teknik', 'hue': 220,
        'sources': [
            ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', True),
            ('The Verge', 'https://www.theverge.com/rss/index.xml', True),
            ('Hacker News', 'https://hnrss.org/frontpage', False),
        ],
    },
    'varlden': {
        'label': 'Världen', 'hue': 280,
        'sources': [
            ('Reuters', 'https://feeds.reuters.com/reuters/worldNews', True),
            ('BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', True),
        ],
    },
    'naringsliv': {
        'label': 'Näringsliv', 'hue': 150,
        'sources': [
            ('Dagens industri', 'https://www.di.se/rss', True),
            ('SVD Näringsliv', 'https://www.svd.se/?service=rss&type=section&id=24561', True),
        ],
    },
    'lokalt': {
        'label': 'Lokalt', 'hue': 60,
        'sources': [
            ('SVT Stockholm', 'https://www.svt.se/nyheter/lokalt/stockholm/rss.xml', True),
            ('Göteborgs-Posten', 'https://www.gp.se/rss', False),
        ],
    },
    'kultur': {
        'label': 'Kultur', 'hue': 320,
        'sources': [
            ('Kulturnytt', 'https://api.sr.se/api/rss/program/2795', True),
            ('Pitchfork', 'https://pitchfork.com/rss/news/', False),
        ],
    },
}

SV_MONTHS = {
    1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr', 5: 'maj', 6: 'jun',
    7: 'jul', 8: 'aug', 9: 'sep', 10: 'okt', 11: 'nov', 12: 'dec',
}


def generate_briefing(articles: list[dict]) -> str:
    """Build a short morning briefing from today's top articles per category."""
    if not articles:
        return ''
    seen: set = set()
    snippets: list = []
    for a in articles:
        cat = a['categoryKey']
        if cat not in seen:
            seen.add(cat)
            snippets.append(f"{a['headline'].rstrip('.')} ({a['source']})")
        if len(snippets) >= 3:
            break
    today = sv_date(datetime.now(timezone.utc))
    total = len(articles)
    cat_count = len({a['categoryKey'] for a in articles})
    text = f"{today}: {total} artiklar från {cat_count} kategorier."
    if snippets:
        text += " Höjdpunkter: " + " · ".join(snippets) + "."
    return text
MAX_ITEMS = 5
MAX_SUMMARY = 220
ATOM_NS = 'http://www.w3.org/2005/Atom'
CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/'

_TAG_RE = re.compile(r'<[^>]+>')
_WS_RE = re.compile(r'\s+')
_OG_RE  = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    re.IGNORECASE,
)


def load_feeds_from_supabase() -> dict | None:
    """Fetch feed config from Supabase feed_config table. Returns None on failure."""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    if not url or not key:
        return None
    try:
        req = Request(
            f'{url}/rest/v1/feed_config?id=eq.1&select=feeds',
            headers={'apikey': key, 'Authorization': f'Bearer {key}'},
        )
        with urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read())
        if rows and rows[0].get('feeds'):
            print('Loaded feed config from Supabase.')
            return rows[0]['feeds']
    except Exception as exc:
        print(f'Supabase fetch failed, using defaults: {exc}')
    return None


def sv_date(dt: datetime) -> str:
    return f"{dt.day} {SV_MONTHS[dt.month]} {dt.year}"


def parse_date(s: str) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    try:
        return email.utils.parsedate_to_datetime(s)
    except Exception:
        pass
    for fmt in ('%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
        try:
            d = datetime.strptime(s[:len(fmt)], fmt)
            return d.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def clean(text: str) -> str:
    text = _TAG_RE.sub(' ', text or '')
    return _WS_RE.sub(' ', text).strip()


def fetch_og_image(url: str) -> str:
    if not url:
        return ''
    try:
        req = Request(url, headers={'User-Agent': 'Notiserna-bot/1.0'})
        with urlopen(req, timeout=3) as resp:
            html = resp.read(65_536).decode('utf-8', errors='ignore')
        m = _OG_RE.search(html)
        if m:
            return (m.group(1) or m.group(2) or '').strip()
    except Exception:
        pass
    return ''


def fetch_url(url: str) -> bytes | None:
    req = Request(url, headers={'User-Agent': 'Notiserna-bot/1.0'})
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.read()
    except Exception as exc:
        print(f'  SKIP {url}: {exc}')
        return None


def parse_feed(
    data: bytes,
    source: str,
    cat_key: str,
    cat_label: str,
    hue: int,
) -> list[dict]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        print(f'  XML error: {exc}')
        return []

    raw: list[tuple[str, str, str, str]] = []

    if 'feed' in root.tag.lower():  # Atom
        for entry in root.findall(f'{{{ATOM_NS}}}entry')[:MAX_ITEMS]:
            title = clean(entry.findtext(f'{{{ATOM_NS}}}title', ''))
            summ_el = (
                entry.find(f'{{{ATOM_NS}}}summary')
                or entry.find(f'{{{ATOM_NS}}}content')
            )
            summary = clean(summ_el.text or '') if summ_el is not None else ''
            pub = (
                entry.findtext(f'{{{ATOM_NS}}}published')
                or entry.findtext(f'{{{ATOM_NS}}}updated', '')
            )
            link_el = (
                entry.find(f'{{{ATOM_NS}}}link[@rel="alternate"]')
                or entry.find(f'{{{ATOM_NS}}}link')
            )
            link = link_el.get('href', '') if link_el is not None else ''
            raw.append((title, summary, pub, link))
    else:  # RSS 2.0
        channel = root.find('channel') or root
        for item in channel.findall('item')[:MAX_ITEMS]:
            title = clean(item.findtext('title', ''))
            desc = item.findtext('description') or item.findtext(
                f'{{{CONTENT_NS}}}encoded', ''
            )
            summary = clean(desc or '')
            pub = item.findtext('pubDate', '')
            link = item.findtext('link', '')
            raw.append((title, summary, pub, link))

    articles: list[dict] = []
    for title, summary, pub, link in raw:
        if not title:
            continue
        dt = parse_date(pub)
        uid = hashlib.md5(f'{cat_key}:{link or title}'.encode()).hexdigest()[:8]
        if len(summary) > MAX_SUMMARY:
            summary = summary[:MAX_SUMMARY] + '…'
        articles.append({
            'id': f'{cat_key}_{uid}',
            'category': cat_label,
            'categoryKey': cat_key,
            'source': source,
            'date': sv_date(dt) if dt else '',
            'headline': title,
            'summary': summary,
            'hue': hue,
            'link': link,
            '_ts': dt.timestamp() if dt else 0.0,
        })
    return articles


def main() -> None:
    supabase_config = load_feeds_from_supabase()

    # Merge Supabase config into FEEDS (keeps label/hue from defaults)
    feeds_to_use: dict = {}
    for cat_key, cat in FEEDS.items():
        if supabase_config and cat_key in supabase_config:
            sources = [
                (f['name'], f['url'], f.get('enabled', True))
                for f in supabase_config[cat_key]
            ]
            feeds_to_use[cat_key] = {**cat, 'sources': sources}
        else:
            feeds_to_use[cat_key] = cat

    articles: list[dict] = []

    for cat_key, cat in feeds_to_use.items():
        for name, url, enabled in cat['sources']:
            if not enabled:
                continue
            print(f'Fetching {name} …')
            data = fetch_url(url)
            if data is None:
                continue
            items = parse_feed(data, name, cat_key, cat['label'], cat['hue'])
            for article in items:
                article['image'] = fetch_og_image(article.get('link', ''))
            print(f'  → {len(items)} artiklar ({sum(1 for a in items if a["image"])} med bild)')
            articles.extend(items)

    articles.sort(key=lambda a: a['_ts'], reverse=True)

    for i, article in enumerate(articles):
        article.pop('_ts')
        if i == 0:
            article['featured'] = True

    output = {
        'articles': articles,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'count': len(articles),
        'briefing': generate_briefing(articles),
    }

    with open('news.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\nKlar — {len(articles)} artiklar skrivna till news.json')


if __name__ == '__main__':
    main()
