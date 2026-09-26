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

DEFAULT_URL = "https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html"

# Known brands dictionary to ensure 100% clean, standardized brand names
KNOWN_BRANDS = [
    ("עולם הקולנוע והחשמל", "עולם הקולנוע והחשמל"),
    ("עולם הקולנוע", "עולם הקולנוע והחשמל"),
    ("דומינו", "דומינו'ס"),
    ("golda", "Golda"),
    ("גולדה", "Golda"),
    ("terminalx", "TerminalX"),
    ("טרמינל", "TerminalX"),
    ("מקדונלד", "מקדונלד'ס"),
    ("bits of gold", "Bits of Gold"),
    ("קפה עלית", "קפה עלית"),
    ("עלית", "קפה עלית"),
    ("bug", "BUG"),
    ("באג", "BUG"),
    ("דרך היין", "דרך היין"),
    ("משלוחה", "משלוחה"),
    ("ev-edge", "EV-EDGE"),
    ("soho", "SOHO"),
    ("סוהו", "SOHO"),
    ("voye", "VOYE"),
    ("aldo", "ALDO"),
    ("אלדו", "ALDO"),
    ("airalo", "Airalo"),
    ("careline", "Careline"),
    ("קרליין", "Careline"),
    ("gali", "GALI"),
    ("גלי", "GALI"),
    ("lee cooper", "Lee Cooper"),
    ("לי קופר", "Lee Cooper"),
    ("nine west", "Nine West"),
    ("ניין ווסט", "Nine West"),
    ("adidas", "adidas"),
    ("אדידס", "adidas"),
    ("gett", "Gett"),
    ("גט", "Gett"),
    ("minene", "Minene"),
    ("מיננה", "Minene"),
    ("emanuel", "Emanuel"),
    ("עמנואל", "Emanuel"),
    ("afrodita", "Afrodita"),
    ("אפרודיטה", "Afrodita"),
    ("soltam", "Soltam"),
    ("סולתם", "Soltam"),
    ("sweetweet", "Sweetweet"),
    ("סוויטוויט", "Sweetweet"),
    ("emporium", "Emporium"),
    ("אמפוריום", "Emporium"),
    ("guess", "Guess"),
    ("גס", "Guess"),
    ("nautica", "Nautica"),
    ("נאוטיקה", "Nautica"),
    ("timberland", "Timberland"),
    ("טימברלנד", "Timberland"),
    ("עברית", "עברית"),
    ("amazon", "Amazon"),
    ("אמזון", "Amazon"),
    ("b.unique", "B.unique"),
    ("בי יוניק", "B.unique"),
    ("ksp", "KSP"),
    ("lenovo", "Lenovo"),
    ("לנובו", "Lenovo"),
    ("nintendo", "Nintendo"),
    ("נינטנדו", "Nintendo"),
    ("walla shops", "Walla Shops"),
    ("וואלה שופס", "Walla Shops"),
    ("אופטיקנה", "אופטיקנה"),
    ("last price", "Last Price"),
    ("לאסט פרייס", "Last Price"),
    ("yellow", "Yellow"),
    ("ילו", "Yellow"),
    ("rebar", "rebar"),
    ("ריבר", "rebar"),
    ("booking", "Booking.com"),
    ("בוקינג", "Booking.com"),
    ("aliexpress", "AliExpress"),
    ("אליאקספרס", "AliExpress"),
    ("hollandia", "Hollandia"),
    ("הולנדיה", "Hollandia")
]

# Smart Category Classifier mapping keywords to standard categories
CATEGORY_RULES = [
    {
        "category": "תיירות ונופש",
        "keywords": ["airalo", "voye", "booking", "gett", "טיסות", "חו\"ל", "מלונות", "חבילות גלישה", "מזוודות", "השכרת רכב", "esim", "אינטרנט בחו\"ל", "נופש", "תיירות", "חופשה"]
    },
    {
        "category": "קולינריה ומסעדות",
        "keywords": ["rebar", "golda", "גולדה", "ריבר", "יין", "גלידה", "משקאות", "מסעדות", "קפה", "שוקולד", "אוכל", "בירה", "קולינריה", "מתוקים", "פיצה", "סושי", "mcdonald", "מקדונלד", "domino", "דומינו", "mishloha", "משלוחה", "עלית", "yellow", "sweetweet", "דרך היין"]
    },
    {
        "category": "אופנה ולייף סטייל",
        "keywords": ["terminalx", "adidas", "אדידס", "emanuel", "עמנואל", "טרמינל", "נעליים", "ביגוד", "אופנה", "תכשיטים", "שעונים", "תיקים", "הלבשה", "בגדים", "ספורט", "aldo", "gali", "lee cooper", "nine west", "afrodita", "emporium", "guess", "nautica", "timberland", "b.unique", "אופטיקנה"]
    },
    {
        "category": "חשמל וטכנולוגיה",
        "keywords": ["ksp", "עולם הקולנוע", "חשמל", "סמארטפון", "מחשב", "אוזניות", "גיימינג", "גאדג'טים", "טלוויזיה", "אלקטרוניקה", "מוצרי חשמל", "קולנוע", "bug", "באג", "lenovo", "nintendo", "last price", "walla shops"]
    },
    {
        "category": "לבית ולמשפחה",
        "keywords": ["hollandia", "הולנדיה", "מזרנים", "ריהוט", "עיצוב הבית", "מצעים", "כלי בית", "מטבח", "גינון", "קמפינג", "לבית", "טקסטיל", "מיטות", "soltam", "סולתם", "minene", "מיננה"]
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
        help="Optional local HTML file path to parse instead of fetching online"
    )
    parser.add_argument(
        "--groq-api-key",
        default=os.environ.get("GROQ_API_KEY"),
        help="Optional Groq API key for AI validation of complex Hebrew terms"
    )
    parser.add_argument(
        "--groq-model",
        default=os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"),
        help="Groq model name to use (default: 'llama-3.1-8b-instant')"
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
    """Extract clean, standardized brand name from title, url, or alt text."""
    # First priority: Title and URL (avoids CMS copy-paste bugs in image alt text)
    title_url = f"{title} {url}".lower()
    for needle, brand_name in KNOWN_BRANDS:
        if needle.lower() in title_url:
            return brand_name

    # Second priority: Clean image alt text
    alt_lower = alt_text.lower()
    for needle, brand_name in KNOWN_BRANDS:
        if needle.lower() in alt_lower:
            return brand_name

    # Third priority: Domain name
    if url:
        domain = urlparse(url).netloc.replace('www.', '').split('.')[0]
        if domain and len(domain) > 2 and domain.lower() not in ['bit', 'shorturl', 'link', 'mastercard', 'tinyurl']:
            return domain.capitalize()

    # Regex extraction fallback for new brands
    m = re.search(
        r'(?:באתר(?:\s+(?:ובסניפי|ובחנויות|ובאפליקציית))?|על\s+כל(?:\*)?\s+אתר|בכל\s+אתר|(?:בכל|ב|וב)?\s*סניפי|(?:בכל|ב|וב)?\s*חנויות|באפליקציית|ברשת|במותג)\s+([A-Za-z0-9\u0590-\u05FF\.\'-]+)',
        title
    )
    if m:
        candidate = m.group(1).strip().strip('\'"')
        if len(candidate) > 1 and candidate not in ['האינטרנט', 'מגוון', 'כל', 'המוצרים', 'האתר']:
            return candidate

    return "Mastercard Day"


def extract_discount_and_pricing(title, description=""):
    """
    Extract accurate discount label, numeric sort value, discount type, and minimum spend.
    Distinguishes percent discount, fixed cash discount, special price, 1+1, and gift vouchers.
    """
    text = f"{title} {description}"

    # 1. Minimum Spend Detection (e.g. "בקניה מעל 2000 ₪", "ברכישת ₪250 ומעלה", "בקנייה מעל $49")
    min_spend = None
    min_spend_numeric = 0
    m_spend = re.search(r'(?:ברכישת|בקנייה|בקניה|לרוכשים)\s+(?:ב-?|מעל\s+|בסך\s*)?\s*([₪$]?\s*\d+(?:,\d+)?\s*[₪$]?)(?:\s*ומעלה)?', text)
    if m_spend:
        raw_spend = m_spend.group(1).strip()
        # Ensure it is not matching the discount amount itself
        if not re.search(r'^(?:₪50|₪30|200\s*₪|5\$|10|130\s*₪|84|25)$', raw_spend):
            min_spend = raw_spend
            num_clean = re.sub(r'[^\d]', '', raw_spend)
            if num_clean:
                min_spend_numeric = int(num_clean)

    # 2. Check 1+1
    if "1+1" in title or "1+1" in description:
        return "1+1 מתנה", 100, "one_plus_one", min_spend, min_spend_numeric

    # 3. Check Cashback
    m_cashback = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(?:קרדיט|קאשבק)', title)
    if m_cashback:
        val = int(float(m_cashback.group(1)))
        return f"{val}% קאשבק", val, "cashback", min_spend, min_spend_numeric

    # 4. Check Special Price / Bundles (e.g. "ב-130 ₪", "₪84 על קילו", "2 יח' ב-10 ₪")
    if "ב-130 ₪" in title or "130 ₪" in title and "פיצות" in title:
        return "מחיר מבצע: ₪130", 130, "special_price", min_spend, min_spend_numeric
    if "₪84 על קילו גלידה" in title or "84 ₪" in title:
        return "מחיר מבצע: ₪84", 84, "special_price", min_spend, min_spend_numeric
    if "ב- 10 ₪" in title or "ב-10 ₪" in title:
        return "2 יח' ב-₪10", 10, "special_price", min_spend, min_spend_numeric

    # 5. Check Gift Voucher (מתנה לטעינה)
    m_gift = re.search(r'(?:₪\s*(\d+)|\b(\d+)\s*₪)\s*מתנה', title)
    if m_gift:
        val = int(m_gift.group(1) or m_gift.group(2))
        return f"₪{val} מתנה", val, "gift", min_spend, min_spend_numeric

    # 6. Percentage Discount (e.g. "20% הנחה", "עד 30% הנחה", "אקסטרה 15%")
    m_pct = re.search(r'(\d+(?:\.\d+)?)\s*%', title)
    if m_pct:
        pct_val = int(float(m_pct.group(1)))
        prefix = "עד " if "עד " in title else ("אקסטרה " if "אקסטרה" in title else "")
        return f"{prefix}{pct_val}% הנחה", pct_val, "percent", min_spend, min_spend_numeric

    # 7. Fixed Cash Discount (e.g. "₪50 הנחה", "200 ₪ הנחה", "5$ הנחה")
    m_dollar = re.search(r'(\d+)\s*\$\s*הנחה', title)
    if m_dollar:
        val = int(m_dollar.group(1))
        return f"${val} הנחה", val, "fixed_discount", min_spend, min_spend_numeric

    m_nis = re.search(r'(?:₪\s*(\d+)|\b(\d+)\s*₪)\s*הנחה', title)
    if m_nis:
        val = int(m_nis.group(1) or m_nis.group(2))
        prefix = "עד " if "עד " in title else ""
        return f"{prefix}₪{val} הנחה", val, "fixed_discount", min_spend, min_spend_numeric

    return "הטבה בלעדית", 0, "special", min_spend, min_spend_numeric


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


def extract_validity_info(title, desc_text, discount=""):
    """
    Extract validity code, badge text, ongoing secondary discount, and valid days of month.
    validity_code: '10_11th_and_all_month', '10_11th', 'date_range', 'all_month', 'only_10th'
    valid_days: list of integers (1-31)
    """
    text = f"{title} {desc_text}"

    # 1. Dual / Tiered Benefit (e.g. Airalo 20% on 10-11, 15% all month; VOYE 25% on 10-11, 18% all month)
    m_ongoing = re.search(r'(\d+%\s*הנחה|\d+%|\d+\s*₪\s*הנחה|₪\s*\d+\s*הנחה)\s*(?:תקפים\s*)?(?:במהלך\s*)?(?:ב)?כל\s*ימות\s*החודש', desc_text)
    if not m_ongoing:
        m_ongoing = re.search(r'במהלך\s*שאר\s*ימי\s*החודש\s*תינתן\s*הטבה\s*של\s*(\d+%\s*הנחה|\d+%|\d+\s*₪\s*הנחה|₪\s*\d+\s*הנחה)', desc_text)
    if not m_ongoing:
        m_ongoing = re.search(r'(\d+%\s*הנחה|\d+%|\d+\s*₪\s*הנחה|₪\s*\d+\s*הנחה)[^\.]+?שאר\s*ימי\s*החודש', desc_text)
    ongoing_discount = m_ongoing.group(1).strip() if m_ongoing else None

    m_peak = re.search(r'(\d+%|\d+\s*₪)\s*(?:הנחה\s*)?(?:תקפ(?:ה|ים)\s*)?(?:ב|לרוכשים ב)?-?\s*10\s*(?:-|וב-|ו-)\s*11', desc_text)
    peak_str = m_peak.group(1) if m_peak else discount

    if ("10-11" in text or "10 וב-11" in text or "10 ו-11" in text or "10 עד 11" in text) and ongoing_discount:
        return "10_11th_and_all_month", f"{peak_str} ב-10-11 | {ongoing_discount} כל החודש", ongoing_discount, list(range(1, 32))

    # 2. Date ranges (e.g. Soltam מה-8 ועד ה-15, Lenovo 10-13, Walla Shops 9-11)
    m_range1 = re.search(r'מה-(\d+)\s*ועד\s*(?:ה-)?(\d+)\s*בחודש', text)
    if m_range1:
        s, e = int(m_range1.group(1)), int(m_range1.group(2))
        return "date_range", f"{s}-{e} בחודש", None, list(range(s, e + 1))

    m_range2 = re.search(r'\b(?:ב|מ)?-?(\d+)\s*[-–]\s*(\d+)\s*(?:לכל\s+|ב)?חודש', text)
    if m_range2:
        s, e = int(m_range2.group(1)), int(m_range2.group(2))
        if s == 10 and e == 11:
            return "10_11th", "10-11 בחודש", None, [10, 11]
        return "date_range", f"{s}-{e} בחודש", None, list(range(s, e + 1))

    # 3. Explicit 10-11 (Hollandia: תקף ב-10 וב-11 בחודש בלבד)
    if "10 וב-11" in text or "10 ו-11" in text or "10-11" in text:
        return "10_11th", "10-11 בחודש", None, [10, 11]

    # 4. All month (e.g. Booking.com: בכל ימות החודש)
    if "כל ימות החודש" in text or "במהלך כל החודש" in text or "במהלך כל ימות החודש" in text:
        return "all_month", "כל החודש", None, list(range(1, 32))

    # 5. Only 10th default
    return "only_10th", "10 בחודש בלבד", None, [10]


def parse_terms_bullets(title, desc_text, min_spend=None, ongoing_discount=None):
    """
    Transform raw legal description text into structured, easy-to-read bullet points.
    Extracts Channel, Minimum Spend, Stacking/Coupons rules, Restrictions, and Tiered dates.
    """
    bullets = []

    # 1. Tiered discount info (e.g. Airalo 15% all month long, VOYE 18% all month long)
    if ongoing_discount:
        bullets.append(f"📅 {ongoing_discount} תקפים בכל שאר ימות החודש באותו קוד קופון")
        bullets.append("⚡ הנחת שיא מוגדלת ב-10-11 בחודש")

    # 2. Channel
    channels = []
    if "באתר" in title or "באתר" in desc_text:
        channels.append("באתר אונליין")
    if "באפליקציית" in title or "באפליקציה" in desc_text:
        channels.append("באפליקציה")
    if "בסניפי" in title or "בסניפים" in desc_text or "בחנויות" in title or "בחנויות" in desc_text:
        channels.append("בסניפים/חנויות")
    if channels:
        bullets.append(f"📍 ערוץ: {', '.join(channels)}")

    # 3. Minimum Spend
    if min_spend:
        bullets.append(f"🏷️ מינימום קנייה: {min_spend}")

    # 4. Stacking rules (כפל מבצעים / קופונים / הנחות) - Negations checked FIRST
    if "לא כולל כפל הנחות ומבצעים" in desc_text or "לא כולל כפל מבצעים והנחות" in desc_text or "אין כפל הנחות ומבצעים" in desc_text:
        bullets.append("⚠️ ללא כפל מבצעים והנחות למועדוני לקוחות")
    elif "כולל כפל מבצעים, לא כולל כפל קופונים" in desc_text or "כולל כפל מבצעים לא כולל כפל קופונים" in desc_text or "כולל כפל מבצעים (ללא כפל קופונים" in desc_text:
        bullets.append("🔄 כולל כפל מבצעים | ללא כפל קופונים")
    elif "לא כולל כפל מבצעים" in desc_text or "ללא כפל מבצעים" in desc_text or "אין כפל מבצעים" in desc_text:
        bullets.append("⚠️ ללא כפל מבצעים")
    elif "לא כולל כפל הנחות" in desc_text or "ללא כפל הנחות" in desc_text:
        bullets.append("⚠️ ללא כפל הנחות")
    elif "לא כולל כפל קופונים" in desc_text or "ללא כפל קופונים" in desc_text:
        bullets.append("⚠️ ללא כפל קופונים")
    elif "כולל כפל מבצעים" in desc_text or "כולל כפל הנחות" in desc_text:
        bullets.append("✨ כולל כפל מבצעים והנחות")

    # 5. Usage limitations & exclusions
    if "מימוש ארוחה אחת ללקוח" in desc_text or "מימוש אחד ללקוח" in desc_text or "לרכישה אחת ללקוח" in desc_text:
        bullets.append("👤 מוגבל למימוש 1 ללקוח")
    if "עד השעה 19:00" in desc_text:
        bullets.append("⏰ תקף עד השעה 19:00 בלבד")
    if "ללקוחות חדשים" in title or "למשתמש חדש" in desc_text:
        bullets.append("🎉 מיועד ללקוחות חדשים בלבד")
    if "לא כולל סלולר" in desc_text:
        bullets.append("🚫 לא כולל סלולר וקונסולות")
    if "על קטגוריית היין בלבד" in desc_text:
        bullets.append("🍷 תקף על קטגוריית היין בלבד")
    if "משלוח בלבד" in desc_text:
        bullets.append("🛵 בהזמנת משלוח בלבד")
    if "במלאי מוגבל" in desc_text or "מלאי ההטבות מוגבל" in desc_text or "עד גמר המלאי" in desc_text:
        bullets.append("📦 מלאי ההטבות מוגבל")

    # Fallback if nothing specific matched
    if len(bullets) < 2:
        bullets.append("💳 תקף למשלמים בכרטיס אשראי מאסטרקארד")
        bullets.append("📄 בכפוף לתקנון המלא של בית העסק")

    return bullets


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

        # Filter non-deal teasers
        if not title or title in ["הטבות חדשות", "בכל 10 בחודש,    יום הטבות בלעדי למחזיקי כרטיס מאסטרקארד"]:
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

        # Standardized Brand & Pricing
        brand = extract_brand_name(title, link, alt_text)
        discount_label, discount_num, discount_type, min_spend, min_spend_numeric = extract_discount_and_pricing(title, desc_text)
        coupon_code = extract_coupon_code(desc_html, desc_text)
        validity_code, validity_text, ongoing_discount, valid_days = extract_validity_info(title, desc_text, discount_label)
        terms_bullets = parse_terms_bullets(title, desc_text, min_spend, ongoing_discount)
        category = determine_category(brand, title, desc_text)

        # Deduplicate
        dedup_key = f"{brand.lower()}::{discount_label}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        deal_entry = {
            "id": tid or f"deal-{len(deals) + 1}",
            "brand": brand,
            "title": title,
            "discount": discount_label,
            "discount_numeric": discount_num,
            "discount_type": discount_type,
            "ongoing_discount": ongoing_discount,
            "min_spend": min_spend,
            "min_spend_numeric": min_spend_numeric,
            "coupon": coupon_code,
            "url": link,
            "image": img_url,
            "category": category,
            "validity": validity_text,
            "validity_code": validity_code,
            "valid_days": valid_days,
            "terms_bullets": terms_bullets,
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

    # Save CSV
    csv_path = out_path / "deals.csv"
    fieldnames = [
        "id", "brand", "discount", "discount_numeric", "discount_type",
        "ongoing_discount", "min_spend", "coupon", "category", "validity",
        "validity_code", "valid_days", "title", "url", "image", "description"
    ]

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for d in deals:
            writer.writerow(d)
    print(f"[+] Saved CSV catalog to: {csv_path}")

    return json_path, csv_path


def enrich_deals_with_groq(deals, api_key, model="llama-3.1-8b-instant"):
    """
    Optional AI verification using Groq API.
    Refines valid_days, ongoing_discount, and terms for deals with complex legalese.
    """
    if not api_key:
        return deals

    import urllib.request
    import urllib.error

    print(f"[*] Groq API key detected. Running AI verification & enrichment using model '{model}'...")
    # Find deals with complex Hebrew dates/stacking terms
    candidates = [
        d for d in deals
        if any(w in d["description"] for w in ["שאר", "ועד", "ב-11", "וב-11", "10-11", "10-13", "9-11", "כל ימות החודש", "לא כולל כפל"])
    ]
    if not candidates:
        return deals

    chunk_size = 4
    for i in range(0, len(candidates), chunk_size):
        chunk = candidates[i:i + chunk_size]
        items_payload = [
            {"id": d["id"], "brand": d["brand"], "title": d["title"], "desc": d["description"]}
            for d in chunk
        ]
        prompt = (
            "Analyze these Hebrew promotional terms for Mastercard Day Israel. "
            "For each deal by id, return JSON with:\n"
            "- valid_days: list of integers (days of month 1-31 when active, or [1..31] if active all month)\n"
            "- validity_label: concise Hebrew string (e.g. '10-11 בחודש', '8-15 בחודש')\n"
            "- ongoing_discount: e.g. '18% הנחה' or null\n"
            "- double_discounts_ok: boolean (false if text says לא כולל כפל מבצעים)\n\n"
            f"Deals:\n{json.dumps(items_payload, ensure_ascii=False)}"
        )
        
        max_output_tokens = min(350, len(chunk) * 85)
        max_retries = 3

        for attempt in range(1, max_retries + 1):
            try:
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=json.dumps({
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "max_tokens": max_output_tokens
                    }).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0"
                    }
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    result_json = json.loads(data["choices"][0]["message"]["content"])
                    results_map = {}
                    if isinstance(result_json, list):
                        for item in result_json:
                            if isinstance(item, dict) and "id" in item:
                                results_map[item["id"]] = item
                    elif isinstance(result_json, dict):
                        for k, v in result_json.items():
                            if isinstance(v, dict) and "valid_days" in v:
                                results_map[k] = v
                            elif isinstance(v, list):
                                for sub in v:
                                    if isinstance(sub, dict) and "id" in sub:
                                        results_map[sub["id"]] = sub

                    for d in chunk:
                        if d["id"] in results_map:
                            res = results_map[d["id"]]
                            if res.get("ongoing_discount"):
                                d["ongoing_discount"] = res["ongoing_discount"]
                                d["valid_days"] = list(range(1, 32))
                            elif "valid_days" in res and isinstance(res["valid_days"], list) and len(res["valid_days"]) > 0:
                                d["valid_days"] = res["valid_days"]

                # Chunk processed successfully; small delay to prevent rapid bursting
                time.sleep(1.0)
                break

            except urllib.error.HTTPError as e:
                err_body = ""
                try:
                    err_body = e.read().decode("utf-8")
                except Exception:
                    pass

                if e.code == 429 and attempt < max_retries:
                    retry_header = e.headers.get("Retry-After")
                    wait_time = float(retry_header) if retry_header else None
                    if wait_time is None and err_body:
                        m = re.search(r"try again in ([\d\.]+)s", err_body)
                        if m:
                            wait_time = float(m.group(1)) + 1.0
                    if wait_time is None:
                        wait_time = 25.0
                    print(f"[*] Groq rate limit (429) hit. Waiting {wait_time:.1f}s before retry (attempt {attempt}/{max_retries})...")
                    time.sleep(wait_time)
                else:
                    detail = f": {err_body}" if err_body else f": {e}"
                    print(f"[!] Groq enrichment notice for chunk {i // chunk_size + 1}{detail} (keeping rule-based values)")
                    break
            except Exception as e:
                print(f"[!] Groq enrichment notice for chunk {i // chunk_size + 1}: {e} (keeping rule-based values)")
                break

    print("[+] AI enrichment check complete.")
    return deals


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

    groq_api_key = args.groq_api_key or os.environ.get("GROQ_API_KEY")
    if groq_api_key:
        deals = enrich_deals_with_groq(deals, groq_api_key, model=args.groq_model)

    save_catalog(deals, output_dir=args.output_dir, source_url=args.url)
    print("[*] Scraping and normalization completed successfully!")


if __name__ == "__main__":
    main()
