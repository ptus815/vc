function decodeBase64Safe(str) {
    try {
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {
        return str;
    }
}

function processDirectNode(raw, subDomain = 'sub.eooce.xx.kg') {
    if (!raw) return { success: false, error: 'ERR' };
    let text = raw.trim();
    let decoded = decodeBase64Safe(text);
    if (decoded && /^(vless|trojan|vmess|ss|ssr|hysteria2?|hy2):\/\//im.test(decoded)) {
        text = decoded;
    }

    const lines = text.split(/[\r\n\s]+/);
    let targetNode = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^(vless|trojan|vmess|ss|ssr|hysteria2?|hy2):\/\//i.test(trimmed)) {
            targetNode = trimmed;
            break;
        }
    }

    if (targetNode) {
        return {
            success: true,
            url: `https://${subDomain}/sub?link=${encodeURIComponent(targetNode)}`
        };
    }
    return { success: false, error: 'ERR' };
}

function extractDefaultValue(code, varName) {
    const plainRegex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*(?:process\\.env\\.[A-Za-z0-9_]+\\s*\\|\\|\\s*)?(['"\`])(.*?)\\1`, 'i');
    const plainMatch = code.match(plainRegex);
    if (plainMatch) return plainMatch[2];
    const regex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*([^;]+);`, 'i');
    const match = code.match(regex);
    if (!match) return null;
    let expr = match[1].trim();
    const orIndex = expr.lastIndexOf('||');
    if (orIndex !== -1) expr = expr.substring(orIndex + 2).trim();
    expr = expr.replace(/;.*$/, '').trim();
    const strMatch = expr.match(/^(['"])(.*)\1$/);
    if (strMatch) return strMatch[2];
    return null;
}

function parseConfig(code) {
    try {
        let decoded = code.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        decoded = decoded.replace(/(['"])([^'"]*?)\1\.split\(['"]{2}\)\.reverse\(\)\.join\(['"]{2}\)/g, (_, q, content) => `"${content.split('').reverse().join('')}"`);
        const domain = extractDefaultValue(decoded, 'DOMAIN');
        const subPath = extractDefaultValue(decoded, 'SUB_PATH');
        if (domain && subPath) return { domain, subPath };
        return null;
    } catch (e) {
        return null;
    }
}

async function serverFetch(url) {
    const res = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 
        signal: AbortSignal.timeout(5000) 
    });
    if (!res.ok) throw new Error('FETCH_FAILED');
    return await res.text();
}

async function resolveUrlToNode(url, subDomain) {
    const code = await serverFetch(url);
    const config = parseConfig(code);
    if (config) {
        let domain = config.domain;
        if (domain === 'your-domain.com') {
            domain = new URL(url).hostname;
        }
        const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        const cleanPath = config.subPath.replace(/^\/+/, '');
        const targetUrl = `https://${cleanDomain}/${cleanPath}`;
        const rawNodeText = await serverFetch(targetUrl);
        return processDirectNode(rawNodeText, subDomain);
    }
    return processDirectNode(code, subDomain);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, subDomain = 'sub.eooce.xx.kg' } = req.query;

    try {
        if (action === 'random') {
            const vcText = await serverFetch('https://raw.githubusercontent.com/ptus815/vc/refs/heads/main/vc.txt');
            let parsedText = vcText;
            try {
                const fn = new Function('window', parsedText + '; return window.__vcUrls;');
                const winObj = {};
                const urlsResult = fn(winObj);
                if (urlsResult) parsedText = urlsResult;
            } catch (e) {}

            const urls = parsedText.split(/[\r\n]+/).filter(l => l.trim().startsWith('http'));
            if (!urls.length) throw new Error('EMPTY_URLS');

            let lastResult = { success: false, error: 'ERR' };
            const shuffled = urls.sort(() => 0.5 - Math.random());
            for (let i = 0; i < Math.min(6, shuffled.length); i++) {
                try {
                    const nodeRes = await resolveUrlToNode(shuffled[i].trim(), subDomain);
                    if (nodeRes.success) {
                        return res.status(200).json({ results: [nodeRes] });
                    }
                } catch (err) {
                    continue;
                }
            }

            return res.status(200).json({ results: [lastResult] });
        }

        if (req.method === 'POST') {
            const { urls = [] } = req.body || {};
            const results = [];
            for (const url of urls) {
                if (/^(vless|trojan|ss|vmess|hysteria2?|hy2):\/\//i.test(url)) {
                    results.push(processDirectNode(url, subDomain));
                    continue;
                }
                try {
                    const nodeRes = await resolveUrlToNode(url, subDomain);
                    results.push(nodeRes);
                } catch (e) {
                    results.push({ success: false, error: 'ERR' });
                }
            }
            return res.status(200).json({ results });
        }

        return res.status(400).json({ error: 'Invalid Request' });
    } catch (err) {
        return res.status(500).json({ error: err.message, results: [{ success: false, error: 'ERR' }] });
    }
}