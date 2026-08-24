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
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
        }, 
        signal: AbortSignal.timeout(5000) 
    });
    if (!res.ok) throw new Error('FETCH_FAILED');
    return await res.text();
}

function extractAllUrls(text) {
    if (!text) return [];
    const set = new Set();
    
    const matches = text.match(/https?:\/\/[^\s"'`<>\\)]+/gi);
    if (matches) matches.forEach(u => set.add(u.trim()));

    try {
        const decoded = Buffer.from(text.trim(), 'base64').toString('utf-8');
        const decMatches = decoded.match(/https?:\/\/[^\s"'`<>\\)]+/gi);
        if (decMatches) decMatches.forEach(u => set.add(u.trim()));
    } catch (e) {}

    return Array.from(set).filter(u => u.startsWith('http'));
}

async function fetchVcList() {
    const sources = [
        'https://raw.githubusercontent.com/ptus815/vc/main/vc.txt',
        'https://cdn.jsdelivr.net/gh/ptus815/vc@main/vc.txt',
        'https://fastly.jsdelivr.net/gh/ptus815/vc@main/vc.txt',
        'https://raw.githubusercontent.com/ptus815/vc/refs/heads/main/vc.txt'
    ];

    for (const src of sources) {
        try {
            const txt = await serverFetch(src);
            const urls = extractAllUrls(txt);
            if (urls.length > 0) return urls;
        } catch (e) {}
    }
    return [
        'https://cute.aicore.quest/cute',
        'https://vercel.igac.eu.cc/vercel'
    ];
}

async function resolveUrlToNode(url, subDomain) {
    if (/^(vless|trojan|ss|vmess|hysteria2?|hy2):\/\//i.test(url)) {
        return processDirectNode(url, subDomain);
    }

    const rawContent = await serverFetch(url);

    let directRes = processDirectNode(rawContent, subDomain);
    if (directRes.success) return directRes;

    const config = parseConfig(rawContent);
    if (config) {
        let domain = config.domain;
        if (domain === 'your-domain.com' || !domain) {
            try {
                domain = new URL(url).hostname;
            } catch(e) {
                domain = 'cute.aicore.quest';
            }
        }
        const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        const cleanPath = (config.subPath || '').replace(/^\/+/, '');
        const targetUrl = `https://${cleanDomain}/${cleanPath}`;
        
        try {
            const subContent = await serverFetch(targetUrl);
            let subRes = processDirectNode(subContent, subDomain);
            if (subRes.success) return subRes;
        } catch(e) {}
    }

    return processDirectNode(rawContent, subDomain);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, subDomain = 'sub.eooce.xx.kg' } = req.query;

    try {
        if (action === 'random') {
            const urls = await fetchVcList();
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
            return res.status(200).json({ results: [{ success: false, error: 'ERR' }] });
        }

        if (req.method === 'POST') {
            const { urls = [] } = req.body || {};
            const results = [];
            for (const url of urls) {
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
        return res.status(200).json({ results: [{ success: false, error: 'ERR' }] });
    }
}