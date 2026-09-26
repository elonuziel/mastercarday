# Groq Supported Models & Rate Limits Reference

*Source: Official Groq documentation ([GroqDocs - Models](https://console.groq.com/docs/models) & [Rate Limits](https://console.groq.com/docs/rate-limits))*

---

## 1. Supported Text Generation Models

| Model Name | Exact Model ID | Speed | Pricing (per 1M tokens) | Developer Plan Quota | Context Window | Max Completion | Tier Availability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen 3.8 27B** | `qwen/qwen3.8-27b` | ~450 T/s | $0.80 input / $4.00 output | 250K TPM / 1K RPM | 131,072 | 16,384 | **Free & Developer** (Active) |
| **GPT OSS 20B** | `openai/gpt-oss-20b` | ~1,000 T/s | $0.075 input / $0.30 output | 250K TPM / 1K RPM | 131,072 | 65,536 | **Free & Developer** (Active) |
| **GPT OSS 120B** | `openai/gpt-oss-120b` | ~500 T/s | $0.15 input / $0.60 output | 250K TPM / 1K RPM | 131,072 | 65,536 | **Free & Developer** (Active) |
| **Safety GPT OSS 20B** | `openai/gpt-oss-safeguard-20b` | ~1,000 T/s | $0.075 input / $0.30 output | 150K TPM / 1K RPM | 131,072 | 65,536 | **Free & Developer** (Active) |
| **Llama 3.1 8B** | `llama-3.1-8b-instant` | ~560 T/s | Contact Sales | Contact Sales | 131,072 | 131,072 | ⚠️ **Enterprise Only** (`model_not_found` on Free/Dev) |
| **Llama 3.3 70B** | `llama-3.3-70b-versatile` | ~280 T/s | Contact Sales | Contact Sales | 131,072 | 32,768 | ⚠️ **Enterprise Only** (`model_not_found` on Free/Dev) |
| **MiniMax M2.7** | `minimaxai/minimax-m2.7` | ~260 T/s | Contact Sales | Contact Sales | 196,608 | 131,072 | ⚠️ **Enterprise Only** |

---

## 2. Free / On-Demand Plan Rate Limits

| Model ID | RPM (Req / Min) | RPD (Req / Day) | TPM (Tokens / Min) | TPD (Tokens / Day) | Output Token Limits (OTPM) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | 200,000 | **1,000 OTPM** |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 | Standard TPM limit |
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | 200,000 | Standard TPM limit |
| `openai/gpt-oss-safeguard-20b` | 30 | 1,000 | 8,000 | 200,000 | Standard TPM limit |
| `meta-llama/llama-prompt-guard-2-22m`| 30 | 14,400 | 15,000 | 500,000 | - |
| `meta-llama/llama-prompt-guard-2-86m`| 30 | 14,400 | 15,000 | 500,000 | - |
| `canopylabs/orpheus-arabic-saudi` | 10 | 100 | 1,200 | 3,600 | - |
| `canopylabs/orpheus-v1-english` | 10 | 100 | 1,200 | 3,600 | - |
| `whisper-large-v3` | 20 | 2,000 | - | - | 7.2K ASH / 28.8K ASD |
| `whisper-large-v3-turbo` | 20 | 2,000 | - | - | 7.2K ASH / 28.8K ASD |

> **Key Terminology:**
> - **RPM:** Requests Per Minute
> - **RPD:** Requests Per Day
> - **TPM:** Total Tokens Per Minute (Input + Output)
> - **TPD:** Total Tokens Per Day
> - **OTPM:** Output Tokens Per Minute (Hard completion ceiling)
> - **ASH / ASD:** Audio Seconds per Hour / Day

---

## 3. Rate Limit Headers & Retry Mechanism

When a rate limit (HTTP `429 Too Many Requests`) is returned, Groq supplies the following diagnostic headers:

| Header | Example | Meaning |
| :--- | :--- | :--- |
| `retry-after` | `26` | Recommended sleep time in seconds before retrying |
| `x-ratelimit-limit-requests` | `14400` | Requests Per Day (RPD) quota |
| `x-ratelimit-remaining-requests` | `14370` | Remaining daily request allowance |
| `x-ratelimit-limit-tokens` | `8000` | Tokens Per Minute (TPM) limit |
| `x-ratelimit-remaining-tokens` | `1430` | Remaining minute token bucket |
| `x-ratelimit-reset-tokens` | `26.22s` | Seconds until token quota resets |

---

## 4. Best Practices for Scraper / Batch Jobs on Free Tier

1. **Keep `max_tokens` small**:
   Groq reserves `max_tokens` ahead of output generation. Setting `max_tokens: 800` when only ~100 tokens are needed exhausts the 1,000 OTPM ceiling on `qwen/qwen3.8-27b` after just 1 request. Keep `max_tokens` under 200 for batches.
2. **Chunk Size**:
   Batch 2 items per prompt (`chunk_size = 2`) to keep input and output tokens minimal and prevent burst limits.
3. **Handle 429 Gracefully**:
   Read `Retry-After` header or parse `"Please try again in X.Xs"` from the response body, sleep for that interval, and retry (up to 3 times).
4. **Active Model Selection**:
   Use `qwen/qwen3.8-27b` (default) or `openai/gpt-oss-20b`. Avoid `llama-3.1-8b-instant` unless on an Enterprise tier agreement.
