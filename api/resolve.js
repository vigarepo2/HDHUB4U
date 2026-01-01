import { getRedirectLinks, extractHubCloud } from './logic.js';

export default async function handler(req, res) {
    const { url } = req.query;
    
    try {
        // 1. Resolve HDHub Redirect (Utils.kt logic)
        const resolvedUrl = await getRedirectLinks(url);
        console.log("Resolved to:", resolvedUrl);

        // 2. Check if it's HubCloud/HubDrive
        if (resolvedUrl.includes("hubcloud") || resolvedUrl.includes("hubdrive")) {
            // 3. Run Extractors.kt logic
            const streams = await extractHubCloud(resolvedUrl);
            return res.status(200).json({ streams });
        }

        // Return raw if no extractor matched
        return res.status(200).json({ streams: [{ link: resolvedUrl, server: "Direct/Redirect" }] });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
