// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import type { SearchDataSource, SearchResult } from '../types';

/**
 * Intelligently analyzes an identifier (PMID, PMCID, DOI) or a full URL and returns a valid, canonical URL.
 * Returns null if the identifier is not recognized.
 * @param idOrUrl - The identifier string or a full URL.
 * @returns The canonical URL as a string, or null.
 */
export const buildCanonicalUrl = (idOrUrl: string): string | null => {
    if (!idOrUrl || typeof idOrUrl !== 'string') {
        return null;
    }

    const trimmed = idOrUrl.trim();

    // 1. It's already a valid URL
    if (trimmed.startsWith('http')) {
        try {
            const url = new URL(trimmed);
            // Clean up common tracking parameters from NCBI links
            if (url.hostname.includes('ncbi.nlm.nih.gov')) {
                url.searchParams.delete('log$');
                url.searchParams.delete('utm_source');
            }
            return url.href;
        } catch (e) {
            return null; // Invalid URL format
        }
    }

    // 2. It's a DOI
    const doiMatch = trimmed.match(/^(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i);
    if (doiMatch) {
        return `https://doi.org/${doiMatch[1]}`;
    }
    
    // 3. It's an EXPLICIT PMCID (must start with "PMC")
    const explicitPmcidMatch = trimmed.match(/^(PMC\d{1,})$/i);
    if (explicitPmcidMatch) {
        return `https://www.ncbi.nlm.nih.gov/pmc/articles/${explicitPmcidMatch[1]}/`;
    }

    // 4. It's a PMID (numeric only)
    const pmidMatch = trimmed.match(/^(\d{1,10})$/);
    if (pmidMatch) {
        return `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`;
    }


    // Unrecognized format
    return null;
};


const INITIAL_PROXY_BUILDERS = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url:string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// --- DYNAMIC PROXY MANAGEMENT ---
// This list is now stateful and can be modified at runtime by the agent.
let proxyList: {
    builder: (url: string) => string;
    builderString: string;
    score: number;
    lastAttempt: number;
}[] = INITIAL_PROXY_BUILDERS.map(fn => ({
    builder: fn,
    builderString: fn.toString(),
    score: 10,
    lastAttempt: 0,
}));

// Function exposed to the runtime to allow the agent to learn new strategies.
export const updateProxyList = (newBuilderStrings: string[]) => {
    const existingBuilderStrings = new Set(proxyList.map(p => p.builderString));
    let addedCount = 0;
    for (const str of newBuilderStrings) {
        if (!existingBuilderStrings.has(str)) {
            try {
                // Safely create the function from the AI-generated string.
                const newBuilder = new Function('return ' + str)();
                if (typeof newBuilder === 'function') {
                    proxyList.push({
                        builder: newBuilder,
                        builderString: str,
                        score: 15, // Give new strategies a higher initial score
                        lastAttempt: 0,
                    });
                    addedCount++;
                }
            } catch (e) {
                console.error(`[Proxy Manager] Failed to create proxy builder function from string: ${str}`, e);
            }
        }
    }
    return { success: true, message: `Added ${addedCount} new proxy strategies.` };
};

export const getProxyList = async () => {
    // Return a copy to prevent mutation
    return [...proxyList];
};
// --- END DYNAMIC PROXY MANAGEMENT ---

const PRIMARY_SOURCE_DOMAINS = [
    'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov/pmc', 'pmc.ncbi.nlm.nih.gov',
    'biorxiv.org', 'medrxiv.org', 'arxiv.org',
    'patents.google.com', 'uspto.gov',
    'nature.com', 'science.org', 'cell.com',
    'jci.org', 'rupress.org',
    'jamanetwork.com', 'bmj.com', 'thelancet.com',
    'nejm.org', 'pnas.org', 'frontiersin.org',
    'plos.org', 'mdpi.com', 'acs.org', 'springer.com',
    'wiley.com', 'elifesciences.org'
];

export const isPrimarySourceDomain = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return PRIMARY_SOURCE_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch (e) {
        return false;
    }
};

const fetchWithCorsFallback = async (url: string, logEvent: (message: string) => void, proxyUrl?: string): Promise<Response> => {
    // Strategy 1: Prioritize the local Web Proxy MCP if its URL is provided.
    if (proxyUrl) {
        logEvent(`[Fetch] Attempting fetch via mandated Web Proxy MCP at ${proxyUrl}...`);
        try {
            const proxyResponse = await fetch(`${proxyUrl}/browse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (proxyResponse.ok) {
                logEvent(`[Fetch] Success with local Web Proxy MCP.`);
                return proxyResponse;
            }
            const errorText = await proxyResponse.text();
            logEvent(`[Fetch] WARN: Local proxy service failed with status ${proxyResponse.status}: ${errorText.substring(0, 200)}...`);
            throw new Error(`LOCAL_PROXY_FAILED: Status ${proxyResponse.status}`);
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : String(error);
             logEvent(`[Fetch] WARN: Could not connect to the local proxy service. Error: ${errorMessage}. Falling back.`);
             if (!errorMessage.startsWith('LOCAL_PROXY_FAILED')) {
                throw new Error(`LOCAL_PROXY_UNREACHABLE: ${errorMessage}`);
             }
        }
    }

    // --- Fallback behavior executes if no proxyUrl was provided OR if the local proxy failed ---
    
    // 2. Attempt Direct Fetch
    logEvent(`[Fetch] Attempting direct fetch for: ${url.substring(0, 100)}...`);
    try {
        const response = await fetch(url);
        if (response.ok) {
            return response;
        }
        logEvent(`[Fetch] Direct fetch failed with status ${response.status}.`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logEvent(`[Fetch] Direct fetch failed. Error: ${errorMessage}. This could be a CORS issue or a network error. Falling back to proxies.`);
        // Don't throw yet, fall back to public proxies.
    }

    // 3. Fallback to Dynamic Public Proxies
    logEvent('[Fetch] Falling back to dynamic public proxy list...');
    
    // Sort proxies by score, but also prioritize those that haven't been tried recently.
    const sortedProxies = [...proxyList].sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (Math.abs(scoreDiff) > 2) return scoreDiff;
        return a.lastAttempt - b.lastAttempt; // Try the least recently used one if scores are close
    });

    for (const proxy of sortedProxies) {
        const now = Date.now();
        // Don't retry a failing proxy too quickly
        if (proxy.score < 0 && (now - proxy.lastAttempt) < 300000) { // 5 minutes
            continue;
        }

        const publicProxyUrl = proxy.builder(url);
        proxy.lastAttempt = now;

        try {
            logEvent(`[Fetch] Attempting fetch via proxy (Score: ${proxy.score}): ${new URL(publicProxyUrl).hostname}`);
            const response = await fetch(publicProxyUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            
            if (response.ok) {
                logEvent(`[Fetch] Success with proxy: ${new URL(publicProxyUrl).hostname}. Increasing score.`);
                proxy.score = Math.min(20, proxy.score + 2); // Cap score at 20
                return response;
            }
            
            logEvent(`[Fetch] WARN: Proxy failed with status ${response.status}. Decreasing score.`);
            proxy.score = Math.max(-10, proxy.score - 5); // Floor score at -10
            
        } catch (error) {
            logEvent(`[Fetch] WARN: Proxy threw an error. Decreasing score.`);
            proxy.score = Math.max(-10, proxy.score - 5);
        }
    }
    throw new Error(`All direct and proxy fetch attempts failed for URL: ${url}`);
};

const stripTags = (html: string) => html.replace(/<[^>]*>?/gm, '').trim();

export const searchWeb = async (query: string, logEvent: (message: string) => void, limit: number, proxyUrl?: string): Promise<SearchResult[]> => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, logEvent, proxyUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const resultElements = doc.querySelectorAll('.result');

        for (const element of Array.from(resultElements).slice(0, limit)) {
            const titleEl = element.querySelector<HTMLAnchorElement>('.result__a');
            const snippetEl = element.querySelector('.result__snippet');
            
            const linkHref = titleEl?.href;
            const title = titleEl?.textContent?.trim();
            const snippet = snippetEl?.textContent?.trim();

            if (linkHref && title && snippet) {
                 // DDG links are redirectors. We need to extract the real URL from the 'uddg' query param.
                 let realLink = linkHref;
                 try {
                     const linkUrl = new URL(linkHref, 'https://duckduckgo.com');
                     if (linkUrl.searchParams.has('uddg')) {
                         realLink = linkUrl.searchParams.get('uddg')!;
                     }
                 } catch (e) {
                    logEvent(`[Search.Web] WARN: Could not parse DDG redirect URL: ${linkHref}`);
                 }

                const canonicalLink = buildCanonicalUrl(realLink);
                if (canonicalLink) {
                    results.push({
                        link: canonicalLink,
                        title: title,
                        snippet: snippet,
                        source: 'WebSearch' as SearchDataSource.WebSearch
                    });
                }
            }
        }
        if (results.length > 0) {
            logEvent(`[Search.Web] Success via DDG HTML scraping, found ${results.length} results.`);
        } else {
             logEvent(`[Search.Web] WARN: DDG HTML scraping returned no parsable results.`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logEvent(`[Search.Web] Error scraping DDG HTML: ${message}`);
        throw error;
    }
    return results;
};

export const searchPubMed = async (query: string, logEvent: (message: string) => void, limit: number, sinceYear?: number, proxyUrl?: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        let specificQuery = `${query}[Title/Abstract]`;
        const numericIdMatch = query.trim().match(/^(\d{1,10})$/);
        if (numericIdMatch) {
            const numericId = numericIdMatch[1];
            specificQuery = `((${query}[Title/Abstract]) OR (${numericId}[UID]) OR (PMC${numericId}[PMCID]))`;
            logEvent(`[Search.PubMed] Numeric ID detected. Expanding search for "${numericId}" to include UID and PMCID fields.`);
        }
        
        let dateFilter = '';
        if (sinceYear) {
            dateFilter = `&datetype=pdat&mindate=${sinceYear}`;
        }
        
        // Step 1: Search for PubMed IDs
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(specificQuery)}&retmode=json&sort=relevance&retmax=${limit}${dateFilter}`;
        
        const searchResponse = await fetchWithCorsFallback(searchUrl, logEvent, proxyUrl);
        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`PubMed search API returned status ${searchResponse.status}. Response: ${errorText.substring(0, 200)}`);
        }
        
        let searchData;
        try {
            searchData = await searchResponse.json();
        } catch(e) {
            throw new Error(`PubMed search API returned non-JSON response.`);
        }

        const ids: string[] = searchData?.esearchresult?.idlist;
        if (!ids || ids.length === 0) {
            logEvent(`[Search.PubMed] WARN: API response did not contain an idlist or was empty. Assuming no results.`);
            return [];
        }
        
        // Step 2: NEW - Use ID Converter API to reliably get PMCIDs
        let pmidToPmcidMap: Record<string, string> = {};
        try {
            logEvent(`[Search.PubMed] Attempting to convert ${ids.length} PMIDs to PMCIDs...`);
            const converterUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${ids.join(',')}&format=json`;
            const converterResponse = await fetchWithCorsFallback(converterUrl, logEvent, proxyUrl);
            if (converterResponse.ok) {
                const converterData = await converterResponse.json();
                if (converterData.records) {
                    for (const record of converterData.records) {
                        if (record.pmid && record.pmcid) {
                            pmidToPmcidMap[record.pmid] = record.pmcid;
                        }
                    }
                }
                logEvent(`[Search.PubMed] Successfully converted ${Object.keys(pmidToPmcidMap).length} IDs.`);
            } else {
                 logEvent(`[Search.PubMed] WARN: ID Converter API failed with status ${converterResponse.status}. Links may not be optimal.`);
            }
        } catch (e) {
            logEvent(`[Search.PubMed] WARN: ID Converter API call failed: ${e instanceof Error ? e.message : String(e)}. Links may not be optimal.`);
        }


        // Step 3: Get Summaries
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryResponse = await fetchWithCorsFallback(summaryUrl, logEvent, proxyUrl);
        if (!summaryResponse.ok) {
            const errorText = await summaryResponse.text();
            throw new Error(`PubMed summary API returned status ${summaryResponse.status}. Response: ${errorText.substring(0, 200)}`);
        }

        let summaryData;
        try {
            summaryData = await summaryResponse.json();
        } catch(e) {
            throw new Error(`PubMed summary API returned non-JSON response.`);
        }
        
        for (const id of ids) {
            const article = summaryData?.result?.[id];
            if (article) {
                let pmcid = pmidToPmcidMap[id] || article.articleids?.find((aid: any) => aid.idtype === 'pmc')?.value;
                
                // Defensively add PMC prefix if a numeric-only PMCID is returned
                if (pmcid && /^\d+$/.test(pmcid)) {
                    pmcid = 'PMC' + pmcid;
                }

                let finalLink;
                if (pmcid) {
                    // We have a confirmed PMCID, use the canonical builder for a PMC link.
                    finalLink = buildCanonicalUrl(pmcid);
                } else {
                    // No PMCID was found. Fall back to the reliable PubMed link using the PMID.
                    finalLink = buildCanonicalUrl(id);
                }

                if (!finalLink) {
                    logEvent(`[Search.PubMed] WARN: Could not construct a valid URL for ID: ${pmcid || id}. Skipping result.`);
                    continue;
                }

                results.push({
                    link: finalLink,
                    title: article.title,
                    snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. Journal: ${article.source}. PubDate: ${article.pubdate}`,
                    source: 'PubMed' as SearchDataSource.PubMed
                });
            }
        }
         logEvent(`[Search.PubMed] Success via API, found ${results.length} results.`);
        
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logEvent(`[Search.PubMed] Error: ${message}`);
        throw error;
    }
    return results;
};

export const searchBioRxivPmcArchive = async (query: string, logEvent: (message: string) => void, limit: number, sinceYear?: number, proxyUrl?: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        const processedQuery = query.split(/\s+/).filter(term => term.length > 2).join(' OR ');
        let enhancedQuery = `(("${query}") OR (${processedQuery})) AND biorxiv[journal]`;

        const numericIdMatch = query.trim().match(/^(\d{1,10})$/);
        if (numericIdMatch) {
            const numericId = numericIdMatch[1];
            enhancedQuery = `((${enhancedQuery}) OR (PMC${numericId}[PMCID]))`;
            logEvent(`[Search.BioRxiv] Numeric ID detected. Expanding search for "${numericId}" to include PMCID field.`);
        }

        let dateFilter = '';
        if (sinceYear) {
            dateFilter = `&datetype=pdat&mindate=${sinceYear}`;
        }
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(enhancedQuery)}&retmode=json&sort=relevance&retmax=${limit}${dateFilter}`;
        
        const searchResponse = await fetchWithCorsFallback(searchUrl, logEvent, proxyUrl);
        if (!searchResponse.ok) {
             const errorText = await searchResponse.text();
            throw new Error(`PMC search API returned status ${searchResponse.status}. Response: ${errorText.substring(0, 200)}`);
        }
        
        let searchData;
        try {
            searchData = await searchResponse.json();
        } catch(e) {
            throw new Error(`PMC search API returned non-JSON response.`);
        }
        const ids: string[] = searchData?.esearchresult?.idlist;

        if (!ids) {
            logEvent(`[Search.BioRxiv] WARN: API response did not contain an idlist. Assuming no results.`);
            return [];
        }

        if (ids && ids.length > 0) {
            const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${ids.join(',')}&retmode=json`;
            const summaryResponse = await fetchWithCorsFallback(summaryUrl, logEvent, proxyUrl);
            if (!summaryResponse.ok) {
                const errorText = await summaryResponse.text();
                throw new Error(`PMC summary API returned status ${summaryResponse.status}. Response: ${errorText.substring(0, 200)}`);
            }
            
            let summaryData;
            try {
                summaryData = await summaryResponse.json();
            } catch(e) {
                throw new Error(`PMC summary API returned non-JSON response.`);
            }
            
            for (const id of ids) {
                const article = summaryData?.result?.[id];
                if (article) {
                    let pmcId = article.articleids.find((aid: { idtype: string, value: string }) => aid.idtype === 'pmc')?.value;
                    
                    // Defensively add PMC prefix if a numeric-only PMCID is returned
                    if (pmcId && /^\d+$/.test(pmcId)) {
                        pmcId = 'PMC' + pmcId;
                    }

                    const finalLink = buildCanonicalUrl(pmcId || id);

                    if (!finalLink) {
                         logEvent(`[Search.BioRxiv] WARN: Could not construct a valid URL for ID: ${pmcId || id}. Skipping result.`);
                         continue;
                    }

                    results.push({
                        link: finalLink,
                        title: article.title,
                        snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. PubDate: ${article.pubdate}.`,
                        source: 'BioRxivPmcArchive' as SearchDataSource.BioRxivPmcArchive
                    });
                }
            }
            logEvent(`[Search.BioRxiv] Success via PMC API, found ${results.length} results.`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logEvent(`[Search.BioRxiv] Error: ${message}`);
        throw error;
    }
    return results;
};


export const searchGooglePatents = async (query: string, logEvent: (message: string) => void, limit: number, proxyUrl?: string): Promise<SearchResult[]> => {
    logEvent('[Search.Patents] Google Patents search has been disabled due to frequent blocking by Google. This source will be skipped.');
    return [];
};

// --- Source Content Enrichment ---

const getContent = (doc: Document, selectors: string[], attribute: string = 'content'): string | null => {
    for (const selector of selectors) {
        const element = doc.querySelector<HTMLMetaElement | HTMLElement>(selector);
        if (element) {
            let content: string | null | undefined = null;
            if (attribute === 'textContent') {
                content = element.textContent;
            } else if ('getAttribute' in element && typeof element.getAttribute === 'function') {
                content = element.getAttribute(attribute);
            }
            if (content) return content.trim();
        }
    }
    return null;
};

const extractDoi = (text: string): string | null => {
    if (!text) return null;
    const doiRegex = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
    const match = text.match(doiRegex);
    return match ? match[1] : null;
};

export const enrichSource = async (source: SearchResult, logEvent: (message: string) => void, proxyUrl?: string): Promise<SearchResult & { textContent?: string }> => {
    const canonicalUrl = buildCanonicalUrl(source.link);

    if (!canonicalUrl) {
        throw new Error(`Could not recognize or create a canonical URL from the initial link: "${source.link}"`);
    }

    if (source.snippet?.startsWith('[DOI Found]') || source.snippet?.startsWith('Fetch failed')) {
        logEvent(`[Enricher] Skipping enrichment for ${canonicalUrl} as it appears to be already processed.`);
        return { ...source, link: canonicalUrl }; // Return with the corrected link
    }
    
    logEvent(`[Enricher] Processing canonical URL: ${canonicalUrl}`);

    const doi = extractDoi(canonicalUrl);
    let server = '';
    if (canonicalUrl.includes('biorxiv.org')) server = 'biorxiv';
    else if (canonicalUrl.includes('medrxiv.org')) server = 'medrxiv';

    // --- Strategy 1: BioRxiv/MedRxiv API ---
    if (doi && server) {
        logEvent(`[Enricher] Found ${server} DOI: ${doi}. Attempting to use official API.`);
        try {
            const apiUrl = `https://api.biorxiv.org/details/${server}/${doi}`;
            const response = await fetchWithCorsFallback(apiUrl, logEvent, proxyUrl);
            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }
            const data = await response.json();
            const article = data?.collection?.[0];
            if (article?.doi && article?.title && article?.abstract) {
                logEvent(`[Enricher] Successfully enriched via ${server} API for DOI ${article.doi}.`);
                return {
                    ...source,
                    link: `https://www.${server}.org/content/${article.doi}`,
                    title: article.title,
                    snippet: `[DOI Found] ${article.abstract}`,
                    textContent: article.abstract, // Use abstract as content for API results
                };
            } else {
                throw new Error(`No valid article data found in API response for DOI ${doi}`);
            }
        } catch (error) {
            logEvent(`[Enricher] WARN: ${server} API fetch failed for DOI ${doi}: ${error instanceof Error ? error.message : String(error)}. Falling back to HTML scraping.`);
        }
    }

    // --- Strategy 2: HTML Scraping (Fallback) ---
    logEvent(`[Enricher] Using HTML scraping fallback for: ${canonicalUrl}`);
    
    const urlsToTry: string[] = [canonicalUrl];
    const isPubmedUrl = canonicalUrl.includes('pubmed.ncbi.nlm.nih.gov');
    const pubmedIdMatch = canonicalUrl.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);

    if (isPubmedUrl && pubmedIdMatch && pubmedIdMatch[1]) {
        const pubmedId = pubmedIdMatch[1];
        
        logEvent(`[Enricher] PubMed link detected. Attempting official conversion for PMID: ${pubmedId}`);
        try {
            const converterUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pubmedId}&format=json`;
            const converterResponse = await fetchWithCorsFallback(converterUrl, logEvent, proxyUrl);
            if (converterResponse.ok) {
                // Robust parsing
                const responseText = await converterResponse.text();
                try {
                    const converterData = JSON.parse(responseText);
                    const record = converterData?.records?.[0];
                    if (record && record.pmcid) {
                        const officialPmcUrl = buildCanonicalUrl(record.pmcid);
                        if (officialPmcUrl) {
                            logEvent(`[Enricher] Found official PMCID ${record.pmcid}. Prioritizing official PMC URL.`);
                             if (!urlsToTry.includes(officialPmcUrl)) {
                                urlsToTry.unshift(officialPmcUrl); // Add to the front of the queue
                            }
                        }
                    } else {
                        logEvent(`[Enricher] No PMCID found via API for PMID ${pubmedId}. This might mean the ID is invalid OR it's a PMCID. Adding a fallback PMC URL to the queue.`);
                        // The original PMID might have been a misidentified PMCID.
                        const fallbackPmcUrl = buildCanonicalUrl(`PMC${pubmedId}`);
                        if (fallbackPmcUrl && !urlsToTry.includes(fallbackPmcUrl)) {
                            // Add it after the original URL, but before any other fallbacks.
                            urlsToTry.splice(1, 0, fallbackPmcUrl);
                        }
                    }
                } catch (jsonError) {
                    logEvent(`[Enricher] WARN: ID Converter API response was not valid JSON for PMID ${pubmedId}. Response snippet: ${responseText.substring(0,200)}...`);
                }
            } else {
                logEvent(`[Enricher] WARN: ID Converter API failed with status ${converterResponse.status}. Will proceed with original PubMed URL.`);
            }
        } catch (e) {
            logEvent(`[Enricher] WARN: ID Converter API call failed: ${e instanceof Error ? e.message : String(e)}. Will proceed with original PubMed URL.`);
        }
    }
    
    const attemptedUrls = new Set<string>();
    let response: Response | null = null;
    let successfulUrl: string | null = null;
    let lastError: any = null;
    let alternativeSourceSearchPerformed = false;
    const urlQueue = [...new Set(urlsToTry)];

    while(urlQueue.length > 0) {
        const url = urlQueue.shift()!;
        if (attemptedUrls.has(url)) continue;

        attemptedUrls.add(url);
        try {
            logEvent(`[Enricher] Attempting to scrape: ${url}`);
            const tempResponse = await fetchWithCorsFallback(url, logEvent, proxyUrl);

            // Read the body once to check for application-level error pages that return 200 OK
            const responseText = await tempResponse.text();
            if (
                responseText.includes(" is not available") ||
                responseText.includes("page does not exist") ||
                (url.includes('ncbi.nlm.nih.gov') && (responseText.includes("The following PMID is not available") || responseText.includes("citation details not found")))
            ) {
                 logEvent(`[Enricher] Detected 'not available' page for ${url}. Treating as fetch failure.`);
                 throw new Error("Content is not available on this page.");
            }

            // If we're here, the response body is valid. Re-create a Response object since the body has been consumed.
            response = new Response(responseText, {
                status: tempResponse.status,
                statusText: tempResponse.statusText,
                headers: tempResponse.headers
            });
            
            successfulUrl = url;
            break; // Success!
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            logEvent(`[Enricher] Attempt failed for ${url}: ${message}.`);
        }
    }

    // If we've exhausted the initial URLs and still have no response, AND we haven't searched for alternatives yet...
    if (!response && !alternativeSourceSearchPerformed) {
        alternativeSourceSearchPerformed = true;
        logEvent(`[Enricher] Initial fetch attempts failed. Searching for alternative sources for: "${source.title}"`);
        try {
            const alternativeResults = await searchWeb(`"${source.title}"`, logEvent, 5, proxyUrl);
            const newUrls = alternativeResults.map(r => r.link).filter(link => !attemptedUrls.has(link));

            if (newUrls.length > 0) {
                logEvent(`[Enricher] Found ${newUrls.length} potential alternative URLs. Retrying fetch.`);
                urlQueue.push(...newUrls);

                // Re-run the loop for the new URLs
                while(urlQueue.length > 0) {
                    const url = urlQueue.shift()!;
                    if (attemptedUrls.has(url)) continue;
                    
                    attemptedUrls.add(url);
                    try {
                        logEvent(`[Enricher] Attempting alternative source: ${url}`);
                        response = await fetchWithCorsFallback(url, logEvent, proxyUrl);
                        successfulUrl = url;
                        break; // Success!
                    } catch (error) {
                        lastError = error;
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        logEvent(`[Enricher] Alternative attempt failed for ${url}: ${message}.`);
                    }
                }
            } else {
                 logEvent(`[Enricher] No alternative sources found for "${source.title}".`);
            }
        } catch (searchError) {
            logEvent(`[Enricher] WARN: Search for alternative sources failed: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
        }
    }

    if (!response || !successfulUrl) {
        logEvent(`[Enricher] ERROR: All fetch attempts failed for source link: ${source.link}.`);
        // Re-throw the last error to be caught by the workflow for adaptive retries.
        throw lastError;
    }

    try {
        if (!response.ok) {
            throw new Error(`Fetch was successful but returned a non-OK status code: ${response.status} ${response.statusText}`);
        }

        const linkToSave = successfulUrl; 

        if (linkToSave !== canonicalUrl) {
            logEvent(`[Enricher] URL successfully fetched via fallback: "${linkToSave}"`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let title: string | null = null;
        let abstract: string | null = null;
        let doiFound = !!doi;

        try {
            const jsonLdElement = doc.querySelector('script[type="application/ld+json"]');
            if (jsonLdElement && jsonLdElement.textContent) {
                const jsonLdData = JSON.parse(jsonLdElement.textContent);
                const articles = Array.isArray(jsonLdData) ? jsonLdData : [jsonLdData];
                const scholarlyArticle = articles.find(item => item && (item['@type'] === 'ScholarlyArticle' || (Array.isArray(item['@type']) && item['@type'].includes('ScholarlyArticle'))));
                if (scholarlyArticle) {
                    title = scholarlyArticle.headline || scholarlyArticle.name || null;
                    abstract = scholarlyArticle.description || scholarlyArticle.abstract || null;
                    if (scholarlyArticle.doi || extractDoi(scholarlyArticle.url || '')) doiFound = true;
                    if (title && abstract) {
                        logEvent(`[Enricher] Found title and abstract via JSON-LD for ${linkToSave}`);
                    }
                }
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            logEvent(`[Enricher] WARN: Could not parse JSON-LD from ${linkToSave}. Error: ${message}`);
        }

        if (!title) {
            title = getContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]'], 'content');
            if (!title) title = doc.querySelector('title')?.textContent || null;
        }
        if (!abstract) {
            abstract = getContent(doc, [
                'meta[name="citation_abstract"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]',
                'meta[name="description"]'
            ], 'content');
        }
        if (!doiFound) {
            const doiMeta = getContent(doc, ['meta[name="citation_doi"]', 'meta[name="DC.identifier"]'], 'content');
            if (doiMeta && doiMeta.startsWith('10.')) {
                doiFound = true;
                logEvent(`[Enricher] Found DOI in meta tag for ${linkToSave}`);
            }
        }

        if (!title) {
            title = getContent(doc, ['h1'], 'textContent');
        }
        if (!abstract) {
            abstract = getContent(doc, [
                'div[class*="abstract"]',
                'section[id*="abstract"]',
                '.abstract-content',
                '#abstract',
                'p.abstract'
            ], 'textContent');
        }

        if (!doiFound && doc.body?.textContent) {
            const foundDoi = extractDoi(doc.body.textContent);
            if (foundDoi) {
                doiFound = true;
                logEvent(`[Enricher] Found DOI via regex in body text for ${linkToSave}`);
            }
        }

        const enrichedTitle = title ? stripTags(title) : source.title;
        let enrichedSnippet = abstract ? stripTags(abstract) : `No abstract could be extracted. Original snippet: ${source.snippet}`;

        if (doiFound) {
            enrichedSnippet = `[DOI Found] ${enrichedSnippet}`;
        }
        
        const textContent = doc.body?.textContent?.replace(/\s\s+/g, ' ').trim() || '';

        if (abstract) {
            logEvent(`[Enricher] Successfully enriched snippet via HTML scraping for ${linkToSave}. DOI found: ${doiFound}`);
        } else {
            logEvent(`[Enricher] WARN: Could not enrich snippet via HTML scraping for ${linkToSave}. Using fallback snippet. DOI found: ${doiFound}`);
        }

        return {
            ...source,
            link: linkToSave,
            title: enrichedTitle,
            snippet: enrichedSnippet,
            textContent: textContent,
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logEvent(`[Enricher] ERROR: Failed to parse ${successfulUrl}: ${message}.`);
        // Re-throw the original error to be caught by the workflow for adaptive retries.
        throw error;
    }
};