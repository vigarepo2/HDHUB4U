import * as cheerio from 'cheerio';
import { createClient, base64Decode, base64Encode, rot13 } from '../lib/utils.js';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const client = createClient(); // Uses cookie jar

  try {
    // 1. Initial Request
    console.log("Extracting:", url);
    const page1 = await client.get(url);
    const body = page1.data;

    // A. Check for HubCDN
    if (url.includes('hubcdn') || body.includes('var reurl')) {
      const match = body.match(/var reurl = "([^"]+)"/);
      if (match) {
        let target = match[1];
        // Decode ?r=BASE64 if present
        if(target.includes('?r=')) {
            try {
                const b64 = target.split('?r=')[1];
                const decoded = base64Decode(b64);
                if(decoded.includes('link=')) target = decodeURIComponent(decoded.split('link=')[1]);
                else target = decoded;
            } catch(e) {}
        }
        return res.status(200).json({ url: target });
      }
    }

    // B. Check for HubCloud/HubDrive Token Logic
    const regex = /ck\('_wp_http_\d+','([^']+)'/g;
    let combinedString = '';
    let match;
    while ((match = regex.exec(body)) !== null) {
      combinedString += match[1];
    }

    if (combinedString) {
      try {
        // THE CHAIN: Base64 -> Base64 -> Rot13 -> Base64 -> JSON
        const step1 = base64Decode(combinedString);
        const step2 = base64Decode(step1);
        const step3 = rot13(step2);
        const step4 = base64Decode(step3);
        const jsonData = JSON.parse(step4);

        if (jsonData && jsonData.wp_http1) {
          const token = base64Encode(jsonData.data);
          const blogLink = `${jsonData.wp_http1}?re=${token}`;
          
          // 2. Intermediate Request (Cookies are auto-passed by 'client')
          // Must set Referer to original URL
          const page2 = await client.get(blogLink, {
            headers: { 'Referer': url }
          });

          const finalMatch = page2.data.match(/var reurl = "([^"]+)"/);
          if (finalMatch) {
            return res.status(200).json({ url: finalMatch[1] });
          }
        }
      } catch (e) {
        console.error("Token decode error:", e);
      }
    }

    // C. Fallback: Direct Scrape (Download Here Button)
    const $ = cheerio.load(body);
    const directBtn = $('a.btn-success').attr('href') || $('a:contains("Download Here")').attr('href');
    if (directBtn) {
      return res.status(200).json({ url: directBtn });
    }

    return res.status(500).json({ error: "Could not extract link" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
