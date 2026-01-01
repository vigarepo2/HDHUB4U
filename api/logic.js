import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

// --- CONFIGURATION ---
// Based on HDhub4uProvider.kt headers
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Cookie": "xla=s4t" // Explicitly requested in your provider
};

// Domain logic from HDhub4uPlugin.kt
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
let CACHED_DOMAIN = "https://hdhub4u.rehab";

export async function getDomain() {
    try {
        const { data } = await axios.get(DOMAINS_URL);
        if (data && data.HDHUB4u) {
            CACHED_DOMAIN = data.HDHUB4u;
        }
    } catch (e) {
        console.log("Domain fetch failed, using default");
    }
    return CACHED_DOMAIN;
}

// --- HTTP CLIENT ---
const getClient = () => {
    const jar = new CookieJar();
    return wrapper(axios.create({
        jar,
        headers: HEADERS,
        timeout: 15000,
        maxRedirects: 5
    }));
};

// --- UTILS.KT TRANSLATION ---

// Port of `pen(value: String)` from Utils.kt
const rot13 = (str) => {
    return str.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
    });
};

const base64Decode = (str) => Buffer.from(str, 'base64').toString('utf-8');
const base64Encode = (str) => Buffer.from(str).toString('base64');

// Port of `getRedirectLinks(url: String)` from Utils.kt
// This is the "Real and Raw" logic you requested
export async function getRedirectLinks(url) {
    const client = getClient();
    try {
        console.log(`[Utils] Fetching ${url}`);
        const { data: doc } = await client.get(url);
        
        // Regex from Utils.kt: s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'
        const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
        let combinedString = "";
        let match;
        
        while ((match = regex.exec(doc)) !== null) {
            const val = match[1] || match[2];
            if (val) combinedString += val;
        }

        if (!combinedString) return url;

        // Logic: val decodedString = base64Decode(pen(base64Decode(base64Decode(combinedString))))
        const step1 = base64Decode(combinedString);
        const step2 = base64Decode(step1);
        const step3 = rot13(step2);
        const step4 = base64Decode(step3);
        
        const jsonObject = JSON.parse(step4);
        
        const encodedUrl = base64Decode(jsonObject.o || "").trim();
        const dataPayload = base64Encode(jsonObject.data || "").trim(); // Utils.kt uses encode(), assuming it means re-encode for URL param
        const wphttp1 = (jsonObject.blog_url || "").trim();

        if (encodedUrl) return encodedUrl;

        // Fallback to blog_url logic
        if (wphttp1) {
            const blogTarget = `${wphttp1}?re=${dataPayload}`;
            console.log(`[Utils] Hitting Blog URL: ${blogTarget}`);
            const { data: blogDoc } = await client.get(blogTarget, {
                headers: { 'Referer': url }
            });
            
            // "select("body").text().trim()"
            const $ = cheerio.load(blogDoc);
            const directLink = $('body').text().trim();
            // Sometimes it's in a script var reurl
            const reurlMatch = blogDoc.match(/var reurl = "([^"]+)"/);
            
            return reurlMatch ? reurlMatch[1] : directLink;
        }

        return url;
    } catch (e) {
        console.error("Redirect Error:", e.message);
        return url; // Fallback
    }
}

// --- EXTRACTORS.KT TRANSLATION ---

// Port of `HubCloud` class
export async function extractHubCloud(url) {
    const client = getClient();
    try {
        console.log(`[Extractor] Processing HubCloud: ${url}`);
        
        // Handle hubcloud.php redirect logic
        let targetUrl = url;
        if (url.includes("hubcloud.php")) {
            // It's already the target
        } else {
            // Logic: select("#download").attr("href")
            const { data: landing } = await client.get(url);
            const $l = cheerio.load(landing);
            const rawHref = $l("#download").attr("href");
            if (rawHref) {
                if (rawHref.startsWith("http")) targetUrl = rawHref;
                else {
                    const u = new URL(url);
                    targetUrl = `${u.protocol}//${u.host}/${rawHref.replace(/^\//, '')}`;
                }
            }
        }

        console.log(`[Extractor] HubCloud Target: ${targetUrl}`);
        const { data: doc } = await client.get(targetUrl);
        const $ = cheerio.load(doc);
        
        const links = [];
        const header = $("div.card-header").text().trim();
        const size = $("i#size").text().trim();

        // Kotlin: document.select("div.card-body h2 a.btn")
        $("div.card-body h2 a.btn").each((_, el) => {
            const link = $(el).attr("href");
            const text = $(el).text();
            
            // Logic from Extractors.kt "when" block
            if (text.match(/FSL Server/i) || 
                text.match(/Pixeldrain/i) || text.match(/Pixel/i) || 
                text.match(/BuzzServer/i) ||
                text.match(/S3 Server/i) ||
                text.match(/FSLv2/i) ||
                text.match(/Mega Server/i) ||
                text.match(/10Gbps/i)) {
                
                // Special handling for Pixeldrain to make it direct
                let finalLink = link;
                if (text.match(/pixeldra/i)) {
                    if (!link.includes("download")) {
                        const parts = link.split("/");
                        const id = parts[parts.length - 1];
                        finalLink = `https://pixeldrain.com/api/file/${id}?download`;
                    }
                }

                links.push({
                    server: text.trim(),
                    link: finalLink,
                    filename: header,
                    size: size
                });
            }
        });

        return links;

    } catch (e) {
        console.error("HubCloud Error:", e.message);
        return [];
    }
}
