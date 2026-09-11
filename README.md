# Mastercard Day Israel - Benefits & Deals Catalog 💳

> **Live Web Application:** [https://elonuziel.github.io/mastercarday/](https://elonuziel.github.io/mastercarday/)  
> **Official Mastercard Day Portal:** [Mastercard Day Israel](https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html)

A high-performance automated scraper and sleek, zero-build RTL web catalog showcasing all exclusive discounts, coupons, and benefits for **Mastercard Day in Israel** (held on the 10th of every month).

---

## 🚀 Live Demo & Features

Explore the live catalog at: **[https://elonuziel.github.io/mastercarday/](https://elonuziel.github.io/mastercarday/)**

- ⏱️ **Live Countdown Timer**: Real-time counter ticking down to the 10th of the month at 10:00 AM (or showing active status when deals are live on the 10th-11th).
- 📋 **1-Click Coupon Copy**: Instant copy button for promo codes (e.g. `MASTERCARDAY`, `MDAY130`) with an animated toast notification.
- 🔗 **Direct Deal Sharing**: Deep-link sharing via URL hash (`#deal-id`) with smooth scroll and pulse highlight.
- 🗂️ **Smart Categories**: Instant filtering across Travel & Tourism, Dining & Food, Fashion & Lifestyle, Tech & Electronics, Home & Living, and Leisure with dynamic deal count badges.
- 🔍 **Instant Search**: Real-time debounced search by brand name, deal title, coupon code, or terms.
- 📊 **Dual Views**: Seamless toggle between responsive Grid Cards and compact Table View.
- 🌙 **Dark & Light Themes**: Full dark mode support with automatic system preference detection and local persistence.
- 📥 **Export Ready**: Download the complete catalog anytime as [data/deals.csv](data/deals.csv) (Excel-compatible UTF-8 BOM) or [data/deals.json](data/deals.json).
- 🛡️ **Akamai WAF Bypass**: Fast TLS-impersonated Python scraper (`curl_cffi`) that bypasses Akamai EdgeSuite Bot Manager in ~2 seconds without heavy headless browser overhead.
- ⚡ **Zero-Build Architecture**: Standard HTML5, Tailwind CSS, and Vanilla JavaScript. Serves directly from GitHub Pages without Node.js or build steps.

---

## 📁 Project Structure

```text
mastercarday/
├── index.html               # Main web application (GitHub Pages)
├── styles.css               # RTL styling, Mastercard color scheme, and animations
├── app.js                   # Frontend search, filtering, countdown, and interactions
├── scraper.py               # High-speed TLS-impersonated Python scraper
├── requirements.txt         # Python dependencies (curl_cffi, beautifulsoup4, pandas)
├── data/
│   ├── deals.json           # Structured JSON catalog of active benefits
│   └── deals.csv            # Excel-compatible CSV catalog
├── .github/workflows/
│   └── scrape.yml           # Automated weekly and monthly GitHub Actions workflow
└── README.md                # Documentation and usage guide
```

---

## 🛠️ Scraper Installation & Usage

### 1. Prerequisites & Dependencies
Ensure Python 3.10+ is installed, then install the required packages:

```bash
pip install -r requirements.txt
```

### 2. Run the Scraper
Run the scraper locally to fetch the official Mastercard Day page, extract all Adobe Experience Manager (AEM) benefit cards, and update `data/deals.json` and `data/deals.csv`:

```bash
python scraper.py
```

> **Technical Note on Akamai WAF Bypass:**  
> The official Mastercard Israel portal is protected by Akamai EdgeSuite Bot Manager, returning `403 Access Denied` to standard curl or Python requests. The scraper uses `curl_cffi` to mimic a legitimate Chrome TLS fingerprint, fetching the entire catalog in ~2 seconds without launching a resource-heavy browser.

---

## 💻 Local Web Development

Because the web application is built with standard HTML5, Tailwind CSS, and Vanilla JavaScript (Zero-Build), you can run it locally with any simple HTTP server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 🌐 Automated Deployment (GitHub Pages)

The repository deploys automatically to GitHub Pages:

1. In your repository on GitHub, navigate to **Settings** -> **Pages**.
2. Under **Build and deployment**, set the source to **Deploy from a branch**.
3. Select branch **`main`** and folder **`/(root)`**, then click **Save**.
4. The site will be published at:  
   **`https://elonuziel.github.io/mastercarday/`**

### Scheduled Automation
The GitHub Actions workflow (`.github/workflows/scrape.yml`) runs automatically:
- **Weekly**: Every Sunday at 06:00 UTC
- **Monthly Drops**: On the 9th and 10th of every month at 06:00 UTC (to catch new monthly deals immediately before and during Mastercard Day)
- **Manual**: Trigger on-demand at any time from the GitHub "Actions" tab

Any catalog updates are committed and pushed automatically, triggering an instant update on GitHub Pages.

---

## 📄 License & Attribution

Mastercard and Mastercard Day are trademarks of Mastercard International Incorporated. Brand logos, merchant offers, and terms belong to their respective owners and participating businesses. Data is extracted from public promotional pages provided by [Mastercard Israel](https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html).
