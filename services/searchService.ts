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
                const errorText = await proxyResponse.text();
                // Try to parse the error for a more specific message from the proxy's JSON response
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error) {
                        throw new Error(`Local proxy service failed with status ${proxyResponse.status}: ${errorJson.error}`);
                    }
                } catch(e) {
                    // Fallback to raw text if not JSON
                }
                const truncatedErrorText = errorText.length > 500 ? errorText.substring(0, 500) + '...' : errorText;
                throw new Error(`Local proxy service failed with status ${proxyResponse.status}: ${truncatedErrorText}`);
            }

            // The proxy now returns the raw response from the target, just like a public proxy.
            // No special handling is needed; just return the successful response.
            logEvent(`[Fetch] Success with local Web Proxy MCP.`);
            return proxyResponse;

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

export const searchWeb = async (query: string, logEvent: (message: string) => void, limit: number, proxyUrl?: string): Promise<SearchResult[]> => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, logEvent, proxyUrl);
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
        const message = error instanceof Error ? error.message : String(error);
        logEvent(`[Search.Web] Error: ${message}`);
        // Re-throw to allow the caller (e.g., Federated Search) to know about the failure.
        throw error;
    }
    return results.slice(0, limit);
};

export const searchPubMed = async (query: string, logEvent: (message: string) => void, limit: number, sinceYear?: number, proxyUrl?: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        let specificQuery = `${query}[Title/Abstract]`;
        let dateFilter = '';
        if (sinceYear) {
            dateFilter = `&datetype=pdat&mindate=${sinceYear}`;
        }
        
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
        if (!ids) {
            logEvent(`[Search.PubMed] WARN: API response did not contain an idlist. Assuming no results.`);
            return [];
        }

        if (ids && ids.length > 0) {
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
            
            ids.forEach(id => {
                const article = summaryData?.result?.[id];
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
        const enhancedQuery = `(("${query}") OR (${processedQuery})) AND biorxiv[journal]`;
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
            
            ids.forEach(id => {
                const article = summaryData?.result?.[id];
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
    logEvent(`[Enricher] Using HTML scraping fallback for: ${source.link}`);
    const urlToScrape = doi ? `https://doi.org/${doi}` : source.link;

    try {
        const response = await fetchWithCorsFallback(urlToScrape, logEvent, proxyUrl);
        
        // If we are using our local proxy, the response.url will be the proxy's URL.
        // We should always use the original URL we intended to scrape as the canonical link in this case.
        // For public proxies or direct fetches, response.url might reflect a true redirect from the target site.
        const finalUrl = response.url;
        const linkToSave = proxyUrl 
            ? urlToScrape // If local proxy is used, ALWAYS trust the original URL
            : (finalUrl && !finalUrl.includes('corsproxy') && !finalUrl.includes('allorigins') && !finalUrl.includes('thingproxy'))
                ? finalUrl // For public proxies or direct, check for redirects, but ignore proxy domains
                : urlToScrape; // Default to original URL

        if (linkToSave !== urlToScrape && !proxyUrl) { // Only log redirects if it's not our local proxy
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
        logEvent(`[Enricher] ERROR: Failed to fetch or parse ${urlToScrape}: ${message}.`);
        const fallbackTitle = doi ? `DOI: ${doi}` : source.title;

        return {
            ...source,
            title: fallbackTitle,
            snippet: `Fetch failed. Could not retrieve content from the source.`
        };
    }
};