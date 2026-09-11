#!/usr/bin/env python3
"""
Mastercard Day Israel Benefits Scraper
Extracts monthly deals and coupon benefits from Mastercard Israel PDP.
Outputs structured data to data/deals.json and data/deals.csv.
"""

import os
import sys
import json
import re
import csv
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

# Ensure UTF-8 stdout encoding
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure local site-packages can be discovered if installed locally
user_site = os.path.expanduser("~/.local/lib/python3.14/site-packages")
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

try:
    from curl_cffi import requests
except ImportError:
    print("[!] 'curl_cffi' is required. Run: pip install curl_cffi", file=sys.stderr)
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("[!] 'beautifulsoup4' is required. Run: pip install beautifulsoup4", file=sys.stderr)
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    pd = None

DEFAULT_URL = "https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html"

# Smart Category Classifier mapping keywords to standard categories
CATEGORY_RULES = [
    {
        "category": "תיירות ונופש",
        "keywords": ["airalo", "voye", "טיסות", "חו\"ל", "מלונות", "חבילות גלישה", "מזוודות", "השכרת רכב", "esim", "אינטרנט בחו\"ל", "נופש", "תיירות", "חופשה"]
    },
    {
        "category": "קולינריה ומסעדות",
        "keywords": ["rebar", "golda", "גולדה", "ריבר", "יין", "גלידה", "משקאות", "מסעדות", "קפה", "שוקולד", "אוכל", "בירה", "קולינריה", "מתוקים", "פיצה", "סושי", "mcdonald", "מקדונלד", "domino", "דומינו", "mishloha", "משלוחה", "עלית"]
    },
    {
        "category": "אופנה ולייף סטייל",
        "keywords": ["terminalx", "adidas", "אדידס", "emanuel", "עמנואל", "טרמינל", "נעליים", "ביגוד", "אופנה", "תכשיטים", "שעונים", "תיקים", "הלבשה", "בגדים", "ספורט"]
    },
    {
        "category": "חשמל וטכנולוגיה",
        "keywords": ["ksp", "עולם הקולנוע", "חשמל", "סמארטפון", "מחשב", "אוזניות", "גיימינג", "גאדג'טים", "טלוויזיה", "אלקטרוניקה", "מוצרי חשמל", "קולנוע", "bug", "באג"]
    },
    {
        "category": "לבית ולמשפחה",
        "keywords": ["hollandia", "הולנדיה", "מזרנים", "ריהוט", "עיצוב הבית", "מצעים", "כלי בית", "מטבח", "גינון", "קמפינג", "לבית", "טקסטיל", "מיטות"]
    }
]


def parse_arguments():
    parser = argparse.ArgumentParser(description="Scrape Mastercard Day Israel benefits catalog.")
    parser.add_argument(
        "--output-dir",
        default="data",
        help="Directory to save deals.json and deals.csv (default: 'data')"
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="Mastercard Day URL to scrape"
    )
    parser.add_argument(
        "--impersonate",
        default="chrome124",
        help="Browser fingerprint to impersonate for TLS (default: 'chrome124')"
    )
    parser.add_argument(
        "--input-html",
        default=None,
        help="Optional local HTML file path to parse instead of fetching online (for offline testing/fallback)"
    )
    return parser.parse_args()


def fetch_page_html(url, impersonate="chrome124", max_retries=3):
    """Fetch webpage using curl_cffi with Chrome TLS impersonation to bypass Akamai WAF."""
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    }

    print(f"[*] Fetching Mastercard Day page: {url}")
    for attempt in range(1, max_retries + 1):
        try:
            r = requests.get(url, headers=headers, impersonate=impersonate, timeout=30)
            if r.status_code == 200 and len(r.text) > 10000:
                print(f"[+] Successfully fetched page ({len(r.text):,} bytes)")
                return r.text
            elif r.status_code == 403:
                print(f"[!] Got 403 Forbidden (attempt {attempt}/{max_retries})")
            else:
                print(f"[!] HTTP {r.status_code} received (attempt {attempt}/{max_retries})")
        except Exception as e:
            print(f"[!] Request error (attempt {attempt}/{max_retries}): {e}")

        if attempt < max_retries:
            time.sleep(2 * attempt)

    raise RuntimeError("Failed to fetch Mastercard Day webpage after multiple retries.")


def extract_brand_name(title, url="", alt_text=""):
    """Extract clean brand name from deal title, URL, or image alt attribute."""
    # Pattern 1: Common Hebrew merchant prefixes in title (e.g. באתר, בסניפי, באפליקציית, ברשת, בדומינו'ס, במקדונלד'ס)
    m = re.search(
        r'(?:באתר\s+ובסניפי|באתר\s+ובאפליקציית|באתר|בסניפי|באפליקציית|ברשת|ובאפליקציית|ב)\s*([A-Za-z0-9\u0590-\u05FF\s\'\"-]+?)(?:\s+(?:\bעל\b|\bבקניית\b|\bברכישת\b|\bכולל\b|\bלרוכשים\b|\bומעלה\b|\bבלבד\b|\bלמגוון\b|\bב-)|$)',
        title
    )
    if m:
        candidate = m.group(1).strip().strip('\'"')
        candidate = re.sub(r'^(?:של|את|כל)\s+', '', candidate)
        if len(candidate) > 1 and candidate not in ['האינטרנט', 'מגוון', 'כל', 'המוצרים', 'קניית', 'רכישת']:
            return candidate

    # Pattern 2: Domain name from URL
    if url:
        domain = urlparse(url).netloc.replace('www.', '').split('.')[0]
        if domain and len(domain) > 2 and domain.lower() not in ['bit', 'shorturl', 'link', 'mastercard', 'tinyurl']:
            return domain.capitalize()

    # Pattern 3: Image alt text if descriptive and not generic
    if alt_text:
        clean_alt = alt_text.strip()
        if len(clean_alt) > 1 and clean_alt.lower() not in ['promo', 'image', 'banner', 'mastercard', '1280x720', 'sep']:
            return clean_alt.capitalize()

    return "Mastercard Day"


def extract_discount(title, description=""):
    """Extract discount string, numeric value, and discount type."""
    # Check percentage discount (e.g. 20%, 15.5%)
    disc_pct = re.search(r'(\d+(?:\.\d+)?)\s*%', title)
    if disc_pct:
        pct_val = float(disc_pct.group(1))
        return f"{int(pct_val)}%", int(pct_val), "percent"

    # Check fixed NIS amount (e.g. ₪50 הנחה, 50 ₪ הנחה, ₪84 על קילו)
    disc_nis = re.search(r'(?:₪\s*(\d+)|\b(\d+)\s*₪)', title)
    if disc_nis:
        val = int(disc_nis.group(1) or disc_nis.group(2))
        return f"₪{val}", val, "fixed"

    # Check in description as fallback
    disc_pct_desc = re.search(r'(\d+(?:\.\d+)?)\s*%\s*הנחה', description)
    if disc_pct_desc:
        pct_val = float(disc_pct_desc.group(1))
        return f"{int(pct_val)}%", int(pct_val), "percent"

    return "הטבה מיוחדת", 0, "special"


def extract_coupon_code(desc_html, desc_text):
    """Extract coupon code from description HTML or text."""
    # Pattern 1: Bold tag right after קוד קופון
    m_bold = re.search(r'קוד קופון[:\s]*<b>([^<]+)</b>', desc_html)
    if m_bold:
        return m_bold.group(1).strip()

    # Pattern 2: Text pattern like קוד קופון: MASTERCARDAY9
    m_text = re.search(r'קוד קופון[:\s]+([A-Za-z0-9_-]+)', desc_text)
    if m_text:
        return m_text.group(1).strip()

    # Pattern 3: Look for standard MASTERCARDAY token
    m_token = re.search(r'\b(MASTERCARDAY[A-Z0-9_-]*)\b', desc_text, re.I)
    if m_token:
        return m_token.group(1).strip()

    return "MASTERCARDAY"


def extract_validity(desc_text):
    """Extract validity badges like '10-11 בחודש', '10 בחודש בלבד', 'כל החודש'."""
    if "10-11" in desc_text or "10 עד 11" in desc_text:
        return "10-11 בחודש"
    elif "במהלך כל ימות החודש" in desc_text or "כל החודש" in desc_text:
        return "כל החודש"
    elif "תקף ב-10 בחודש" in desc_text or "ב-10 בחודש בלבד" in desc_text or "ב-10 בחודש" in desc_text:
        return "10 בחודש בלבד"
    return "בכפוף לתקנון"


def determine_category(brand, title, description):
    """Classify deal into a curated category based on brand, title, and terms."""
    full_text = f"{brand} {title} {description}".lower()

    for rule in CATEGORY_RULES:
        for kw in rule["keywords"]:
            if kw.lower() in full_text:
                return rule["category"]

    return "צרכנות ופנאי"


def parse_mastercard_day_html(html_content):
    """Parse Adobe Experience Manager (AEM) components and extract all benefit deals."""
    soup = BeautifulSoup(html_content, "html.parser")
    teasers = soup.find_all("div", class_="cmp-teaser")
    print(f"[*] Found {len(teasers)} total teaser components")

    deals = []
    seen_keys = set()

    for t in teasers:
        data_attr = t.get("data-cmp-data-layer")
        if not data_attr:
            continue

        try:
            data_json = json.loads(data_attr)
        except Exception:
            continue

        tid = t.get("id", "")
        info = data_json.get(tid, {})
        title = info.get("dc:title", "").strip()
        desc_html = info.get("dc:description", "").strip()
        link = info.get("xdm:linkURL", "").strip()

        # Ignore navigation or institutional teasers
        if not title:
            continue
        if title in ["הטבות חדשות", "בכל 10 בחודש,    יום הטבות בלעדי למחזיקי כרטיס מאסטרקארד"]:
            continue
        if any(ign in link.lower() for ign in ["merchant-cloud", "economic-outlook", "pdp", "/business/"]):
            continue
        if not any(k in title or k in desc_html for k in ["הנחה", "הטב", "קופון", "₪", "%", "מתנה", "בכפוף לתקנון"]):
            continue

        # Extract image asset
        img_tag = t.find("img", class_="cmp-teaser__secondary-asset__image")
        img_url = ""
        alt_text = ""
        if img_tag and img_tag.get("src"):
            img_url = urljoin("https://www.mastercard.com", img_tag["src"])
            alt_text = img_tag.get("alt", "").strip()

        # Clean description text
        desc_soup = BeautifulSoup(desc_html, "html.parser")
        desc_text = desc_soup.get_text(separator=" ").strip()
        desc_text = re.sub(r'\s+', ' ', desc_text)

        # Extract clean properties
        brand = extract_brand_name(title, link, alt_text)
        discount_str, discount_num, discount_type = extract_discount(title, desc_text)
        coupon_code = extract_coupon_code(desc_html, desc_text)
        validity = extract_validity(desc_text)
        category = determine_category(brand, title, desc_text)

        # Deduplicate deals by brand and discount
        dedup_key = f"{brand.lower()}::{discount_str}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        deal_entry = {
            "id": tid or f"deal-{len(deals) + 1}",
            "brand": brand,
            "title": title,
            "discount": discount_str,
            "discount_numeric": discount_num,
            "discount_type": discount_type,
            "coupon": coupon_code,
            "url": link,
            "image": img_url,
            "category": category,
            "validity": validity,
            "description": desc_text,
            "updated_at": info.get("repo:modifyDate") or datetime.now(timezone.utc).isoformat()
        }
        deals.append(deal_entry)

    # Sort deals by numeric discount descending, then brand
    deals.sort(key=lambda d: (-d["discount_numeric"], d["brand"]))
    print(f"[+] Extracted and normalized {len(deals)} valid Mastercard Day deals")
    return deals


def save_catalog(deals, output_dir="data", source_url=DEFAULT_URL):
    """Save parsed deals into deals.json and deals.csv in output directory."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    # Build unique categories list with "הכל" first
    unique_categories = ["הכל"]
    cat_set = set()
    for d in deals:
        cat = d.get("category")
        if cat and cat not in cat_set:
            cat_set.add(cat)
            unique_categories.append(cat)

    now_iso = datetime.now(timezone.utc).isoformat()

    catalog_data = {
        "metadata": {
            "title": "הטבות יום מאסטרקארד | Mastercard Day Israel",
            "source": source_url,
            "last_updated": now_iso,
            "total_deals": len(deals),
            "categories": unique_categories
        },
        "deals": deals
    }

    # Save JSON
    json_path = out_path / "deals.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved JSON catalog to: {json_path} ({len(deals)} deals)")

    # Save CSV (Excel-compatible with UTF-8 BOM)
    csv_path = out_path / "deals.csv"
    fieldnames = [
        "id", "brand", "discount", "discount_numeric", "discount_type",
        "coupon", "category", "validity", "title", "url", "image", "description"
    ]

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for d in deals:
            writer.writerow(d)
    print(f"[+] Saved CSV catalog to: {csv_path}")

    return json_path, csv_path


def main():
    args = parse_arguments()

    if args.input_html and os.path.exists(args.input_html):
        print(f"[*] Reading HTML from local file: {args.input_html}")
        with open(args.input_html, "r", encoding="utf-8") as f:
            html_content = f.read()
    else:
        html_content = fetch_page_html(args.url, impersonate=args.impersonate)

    deals = parse_mastercard_day_html(html_content)
    if not deals:
        print("[!] Warning: No deals were extracted. Check target HTML.", file=sys.stderr)
        sys.exit(1)

    save_catalog(deals, output_dir=args.output_dir, source_url=args.url)
    print("[*] Scraping completed successfully!")


if __name__ == "__main__":
    main()
