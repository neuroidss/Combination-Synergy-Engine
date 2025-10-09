// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import type { SearchDataSource, SearchResult } from '../types';

const PROXY_BUILDERS = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url:string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

const PRIMARY_SOURCE_DOMAINS = [
    'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov/pmc',
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
    // If the proxy is specified, we treat it as the ONLY valid method.
    // This prevents falling back to unreliable public proxies when a local, reliable one is expected.
    if (proxyUrl) {
        logEvent(`[Fetch] Attempting fetch via mandated Web Proxy MCP at ${proxyUrl}...`);
        try {
            const proxyResponse = await fetch(`${proxyUrl}/browse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (!proxyResponse.ok) {
                // If the proxy server responds with an error, we throw.
                const errorData = await proxyResponse.json().catch(() => ({ error: 'Proxy returned non-JSON error response.' }));
                throw new Error(`Local proxy service failed with status ${proxyResponse.status}: ${errorData.error || 'Unknown error'}`);
            }

            const data = await proxyResponse.json();
            if (data.success && data.htmlContent) {
                logEvent(`[Fetch] Success with local Web Proxy MCP.`);
                return new Response(data.htmlContent, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }
            // If the proxy reports success:false, we throw.
            throw new Error(data.error || "Local proxy returned 'success: false' but no error message.");

        } catch (error) {
             // If we can't even connect to the proxy, we throw.
             logEvent(`[Fetch] FATAL: Could not connect to or get a valid response from the Web Proxy MCP. Aborting fetch. Error: ${error instanceof Error ? error.message : String(error)}`);
             throw new Error(`Failed to use the local web proxy at ${proxyUrl}. Ensure the server is running and the 'Bootstrap Web Proxy Service' tool ran successfully. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // --- Fallback behavior ONLY executes if no proxyUrl was provided ---
    logEvent('[Fetch] No local proxy specified. Using fallback methods (direct fetch, public proxies).');
    
    // 2. Attempt Direct Fetch
    logEvent(`[Fetch] Attempting direct fetch for: ${url.substring(0, 100)}...`);
    try {
        const response = await fetch(url);
        if (response.ok) {
            return response;
        }
        logEvent(`[Fetch] Direct fetch for ${url} failed with status ${response.status}. Falling back to public proxies.`);
    } catch (error) {
        logEvent(`[Fetch] Direct fetch for ${url} failed, likely due to CORS. Falling back to public proxies.`);
    }

    // 3. Fallback to Public Proxies
    for (const buildProxyUrl of PROXY_BUILDERS) {
        const publicProxyUrl = buildProxyUrl(url);
        try {
            logEvent(`[Fetch] Attempting fetch via proxy: ${new URL(publicProxyUrl).hostname}`);
            const response = await fetch(publicProxyUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (response.ok) {
                logEvent(`[Fetch] Success with proxy: ${new URL(publicProxyUrl).hostname}`);
                return response;
            }
            logEvent(`[Fetch] WARN: Proxy failed with status ${response.status}.`);
        } catch (error) {
            logEvent(`[Fetch] WARN: Proxy threw an error.`);
        }
    }
    throw new Error(`All direct and proxy fetch attempts failed for URL: ${url}`);
};

const stripTags = (html: string) => html.replace(/<[^>]*>?/gm, '').trim();

export const searchWeb = async (query: string, logEvent: (message: string) => void, limit: number): Promise<SearchResult[]> => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, logEvent);
        const htmlContent = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const resultElements = doc.querySelectorAll('.web-result');
        
        resultElements.forEach(el => {
            const titleLink = el.querySelector<HTMLAnchorElement>('a.result__a');
            const snippetEl = el.querySelector('.result__snippet');

            if (titleLink && snippetEl) {
                const hrefAttr = titleLink.getAttribute('href');
                if (hrefAttr) {
                    const redirectUrl = new URL(hrefAttr, 'https://duckduckgo.com');
                    const actualLink = redirectUrl.searchParams.get('uddg');

                    if (actualLink) {
                        results.push({
                            link: actualLink,
                            title: (titleLink.textContent || '').trim(),
                            snippet: (snippetEl.textContent || '').trim(),
                            source: 'WebSearch' as SearchDataSource.WebSearch
                        });
                    }
                }
            }
        });
        logEvent(`[Search.Web] Success via DuckDuckGo, found ${results.length} results.`);
    } catch (error) {
        logEvent(`[Search.Web] Error: ${error}`);
    }
    return results.slice(0, limit);
};

export const searchPubMed = async (query: string, logEvent: (message: string) => void, limit: number): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        const specificQuery = `${query}[Title/Abstract]`;
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(specificQuery)}&retmode=json&sort=relevance&retmax=${limit}`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PubMed search failed with status ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const ids: string[] = searchData.esearchresult.idlist;

        if (ids && ids.length > 0) {
            const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
            const summaryResponse = await fetch(summaryUrl);
             if (!summaryResponse.ok) throw new Error(`PubMed summary failed with status ${summaryResponse.status}`);
            const summaryData = await summaryResponse.json();
            
            ids.forEach(id => {
                const article = summaryData.result[id];
                if (article) {
                    results.push({
                        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                        title: article.title,
                        snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. Journal: ${article.source}. PubDate: ${article.pubdate}`,
                        source: 'PubMed' as SearchDataSource.PubMed
                    });
                }
            });
             logEvent(`[Search.PubMed] Success via API, found ${results.length} results.`);
        }
    } catch (error) {
        logEvent(`[Search.PubMed] Error: ${error}`);
    }
    return results;
};

export const searchBioRxivPmcArchive = async (query: string, logEvent: (message: string) => void, limit: number): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        const processedQuery = query.split(/\s+/).filter(term => term.length > 2).join(' OR ');
        const enhancedQuery = `(("${query}") OR (${processedQuery})) AND biorxiv[journal]`;
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(enhancedQuery)}&retmode=json&sort=relevance&retmax=${limit}`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PMC search failed with status ${searchResponse.status}`);
        
        const searchData = await searchResponse.json();
        const ids: string[] = searchData.esearchresult.idlist;

        if (ids && ids.length > 0) {
            const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${ids.join(',')}&retmode=json`;
            const summaryResponse = await fetch(summaryUrl);
            if (!summaryResponse.ok) throw new Error(`PMC summary failed with status ${summaryResponse.status}`);
            
            const summaryData = await summaryResponse.json();
            
            ids.forEach(id => {
                const article = summaryData.result[id];
                if (article) {
                    const pmcId = article.articleids.find((aid: { idtype: string, value: string }) => aid.idtype === 'pmc')?.value;
                    const link = pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`;

                    results.push({
                        link: link,
                        title: article.title,
                        snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. PubDate: ${article.pubdate}.`,
                        source: 'BioRxivPmcArchive' as SearchDataSource.BioRxivPmcArchive
                    });
                }
            });
            logEvent(`[Search.BioRxiv] Success via PMC API, found ${results.length} results.`);
        }
    } catch (error) {
        logEvent(`[Search.BioRxiv] Error: ${error}`);
    }
    return results;
};


export const searchGooglePatents = async (query: string, logEvent: (message: string) => void, limit: number): Promise<SearchResult[]> => {
    const url = `https://patents.google.com/xhr/query?url=q%3D${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, logEvent);
        const rawText = await response.text();
        
        let patentJsonText = rawText;
        try {
            // Check if the response is from a proxy like allorigins that wraps the content
            const proxyData = JSON.parse(rawText);
            if (proxyData && typeof proxyData.contents === 'string') {
                patentJsonText = proxyData.contents;
            } else if (proxyData && (proxyData.error || proxyData.status?.error)) {
                 throw new Error(`Proxy service returned an error: ${proxyData.error || JSON.stringify(proxyData.status)}`);
            }
        } catch (e) {
            // If it's not JSON, it could be the raw response or an HTML error page from the proxy.
            if (rawText.trim().startsWith('<')) {
                throw new Error("Proxy returned an HTML error page, not the expected JSON content.");
            }
            // If it's not JSON and not HTML, we assume it's the raw content from a direct fetch or a transparent proxy.
        }

        // Google XHR responses sometimes start with )]}' to prevent JSON hijacking.
        const firstBraceIndex = patentJsonText.indexOf('{');
        if (firstBraceIndex === -1) {
            throw new Error(`No JSON object found in patent response. Content starts with: ${patentJsonText.substring(0, 150)}`);
        }
        
        const jsonText = patentJsonText.substring(firstBraceIndex);
        const data = JSON.parse(jsonText);
        
        const patents = data.results?.cluster?.[0]?.result || [];
        patents.slice(0, limit).forEach((item: any) => {
            if (item && item.patent) {
                const patent = item.patent;
                const inventors = (patent.inventor_normalized && Array.isArray(patent.inventor_normalized)) 
                    ? stripTags(patent.inventor_normalized.join(', ')) 
                    : 'N/A';

                results.push({
                    link: `https://patents.google.com/patent/${patent.publication_number}/en`,
                    title: stripTags(patent.title || 'No Title'),
                    snippet: `Inventor: ${inventors}. Pub Date: ${patent.publication_date || 'N/A'}`,
                    source: 'GooglePatents' as SearchDataSource.GooglePatents
                });
            }
        });
         logEvent(`[Search.Patents] Success, found ${results.length} results.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logEvent(`[Search.Patents] Error: ${message}`);
    }
    return results;
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

export const enrichSource = async (source: SearchResult, logEvent: (message: string) => void, proxyUrl?: string): Promise<SearchResult> => {
    if (source.snippet?.startsWith('[DOI Found]') || source.snippet?.startsWith('Fetch failed')) {
        logEvent(`[Enricher] Skipping enrichment for ${source.link} as it appears to be already processed.`);
        return source;
    }

    const doi = extractDoi(source.link);
    let server = '';
    if (source.link.includes('biorxiv.org')) server = 'biorxiv';
    else if (source.link.includes('medrxiv.org')) server = 'medrxiv';

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
                };
            } else {
                throw new Error(`No valid article data found in API response for DOI ${doi}`);
            }
        } catch (error) {
            logEvent(`[Enricher] WARN: ${server} API fetch failed for DOI ${doi}: ${error instanceof Error ? error.message : String(error)}. Falling back to HTML scraping.`);
        }
    }

    // --- Strategy 2: HTML Scraping (Fallback) ---
    logEvent(`[Enricher] Using HTML scraping fallback for: ${source.link}`);
    const urlToScrape = doi ? `https://doi.org/${doi}` : source.link;

    try {
        const response = await fetchWithCorsFallback(urlToScrape, logEvent, proxyUrl);
        const finalUrl = response.url;
        const linkToSave = (finalUrl && !finalUrl.includes('corsproxy') && !finalUrl.includes('allorigins') && !finalUrl.includes('thingproxy'))
            ? finalUrl
            : urlToScrape;

        if (linkToSave !== urlToScrape) {
            logEvent(`[Enricher] URL redirected to canonical: "${linkToSave}"`);
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
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logEvent(`[Enricher] ERROR: Failed to fetch or parse ${urlToScrape}: ${message}.`);
        const fallbackTitle = doi ? `DOI: ${doi}` : source.title;

        return {
            ...source,
            title: fallbackTitle,
            snippet: `Fetch failed. Could not retrieve content from the source.`
        };
    }
};