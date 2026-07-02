#!/usr/bin/env python3
"""Fetch enabled RSS feeds defined in FEEDS and write news.json."""

import email.utils
import hashlib
import html as html_lib
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
            ('Skatteverket', 'https://www.skatteverket.se/rss/nyheter.rss', True),
            ('HFD nyheter', 'https://www.domstol.se/hfd/feed', True),
            ('PwC Tax Matters', 'https://taxmatters.pwc.se/feed', True),
        ],
    },
    'sverige': {
        'label': 'Sverige', 'hue': 0,
        'sources': [
            ('SVT Nyheter', 'https://www.svt.se/rss.xml', True),
            ('Dagens Nyheter', 'https://www.dn.se/rss/', True),
        ],
    },
    'teknik': {
        'label': 'Teknik', 'hue': 220,
        'sources': [
            ('The Verge', 'https://www.theverge.com/rss/index.xml', True),
            ('Feber', 'https://feber.se/rss/', True),
            ('Tech Radar', 'https://www.techradar.com/feeds.xml', True),
            ('Forbes Innovation', 'https://www.forbes.com/innovation/feed', True),
        ],
    },
    'varlden': {
        'label': 'Världen', 'hue': 280,
        'sources': [
            ('BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', True),
            ('New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', True),
            ('Associated Press', 'https://feedx.net/rss/ap.xml', True),
        ],
    },
    'naringsliv': {
        'label': 'Näringsliv', 'hue': 150,
        'sources': [
            ('Dagens industri', 'https://www.di.se/rss', True),
            ('SVD Näringsliv', 'https://www.svd.se/?service=rss&type=section&id=24561', True),
            ('EFN', 'https://efn.se/rss/infront', True),
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
    text = html_lib.unescape(text or '')
    text = _TAG_RE.sub(' ', text)
    return _WS_RE.sub(' ', text).strip()


def fetch_og_image(url: str) -> str:
    if not url:
        return ''
    try:
        req = Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        )
        with urlopen(req, timeout=4) as resp:
            html = resp.read(65_536).decode('utf-8', errors='ignore')
        m = _OG_RE.search(html)
        if m:
            img_url = html_lib.unescape((m.group(1) or m.group(2) or '').strip())
            img_url = img_url.replace('&amp;', '&')
            if 'defaultshareimage' in img_url.lower():
                return ''
            return img_url
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


def find_feed_image_element(element) -> str:
    url = _find_feed_image_element_raw(element)
    if not url:
        return ''
    if 'defaultshareimage' in url.lower():
        return ''
    return url


def _find_feed_image_element_raw(element) -> str:
    try:
        xml_str = ET.tostring(element, encoding='utf-8').decode('utf-8')
        
        # Extract all media:content/content tags and find the first one that is NOT a video
        content_tags = re.findall(r'<[^:>]*:?content\s+([^>]+)>', xml_str, re.IGNORECASE)
        for tag_content in content_tags:
            url_match = re.search(r'url=["\']([^"\']+)["\']', tag_content, re.IGNORECASE)
            if url_match:
                url = url_match.group(1)
                medium_match = re.search(r'medium=["\']([^"\']+)["\']', tag_content, re.IGNORECASE)
                type_match = re.search(r'type=["\']([^"\']+)["\']', tag_content, re.IGNORECASE)
                
                is_video = (
                    (medium_match and medium_match.group(1).lower() == 'video') or
                    (type_match and type_match.group(1).lower().startswith('video/')) or
                    '.mp4' in url.lower() or
                    '.m3u8' in url.lower() or
                    '.webm' in url.lower()
                )
                if not is_video:
                    return url
                    
        # Try media:thumbnail
        m = re.search(r'<[^:>]*:?thumbnail[^>]+url=["\']([^"\']+)["\']', xml_str, re.IGNORECASE)
        if m:
            return m.group(1)
            
        # Try enclosure (excluding videos)
        m = re.search(r'<enclosure[^>]+url=["\']([^"\']+)["\']', xml_str, re.IGNORECASE)
        if m:
            url = m.group(1)
            is_video = '.mp4' in url.lower() or '.m3u8' in url.lower() or '.webm' in url.lower()
            if not is_video:
                return url
                
        # Try link enclosure
        m = re.search(r'<link[^>]+rel=["\']enclosure["\'][^>]+href=["\']([^"\']+)["\']', xml_str, re.IGNORECASE)
        if m:
            return m.group(1)
        m = re.search(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']enclosure["\']', xml_str, re.IGNORECASE)
        if m:
            return m.group(1)

        # Try img tag in description (unescape first to support HTML-in-XML description)
        unescaped = html_lib.unescape(xml_str)
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', unescaped, re.IGNORECASE)
        if m:
            return m.group(1)
    except Exception:
        pass
    return ''


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

    raw: list[tuple[str, str, str, str, str]] = []

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
            image = find_feed_image_element(entry)
            raw.append((title, summary, pub, link, image))
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
            image = find_feed_image_element(item)
            raw.append((title, summary, pub, link, image))

    articles: list[dict] = []
    for title, summary, pub, link, image in raw:
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
            'image': image,
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
            print(f'Fetching {name} ...')
            data = fetch_url(url)
            if data is None:
                continue
            items = parse_feed(data, name, cat_key, cat['label'], cat['hue'])
            print(f'  -> {len(items)} artiklar ({sum(1 for a in items if a["image"])} med bild)')
            articles.extend(items)

    articles.sort(key=lambda a: a['_ts'], reverse=True)

    # Fetch og:image only for the top 20 articles that don't have an image yet
    needs_og_image = [a for a in articles if not a.get('image') and a.get('link')][:20]
    for a in needs_og_image:
        a['image'] = fetch_og_image(a['link'])

    for i, article in enumerate(articles):
        article.pop('_ts')
        if i == 0:
            article['featured'] = True

    output = {
        'articles': articles,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'count': len(articles),
    }

    with open('news.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\nKlar - {len(articles)} artiklar skrivna till news.json')


if __name__ == '__main__':
    main()
