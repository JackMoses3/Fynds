import axios from 'axios';

// shared HTTP headers
export const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
};

export const JSON_HEADERS = {
    'User-Agent': BROWSER_HEADERS['User-Agent'],
    Accept: 'application/json, text/plain, */*',
};

/**
 * Infer "sex" from a product type or tag list.
 * Returns 'men', 'women', or 'unisex'.
 */
export function inferSex(type: string, tags: string[]): 'men' | 'women' | 'unisex' {
    const normalize = (s: string) => s.toLowerCase();
    const clean = (s: string) => s.replace(/\//g, ' ').toLowerCase();

    const menKeywords = ['men', 'man', 'boy', 'boys', 'mens', 'gentlemen', 'm'];
    const womenKeywords = ['women', 'woman', 'girl', 'ladies', 'ladie', 'girls', 'w'];

    const t = clean(type);
    if (womenKeywords.some(k => t.includes(k))) return 'women';
    if (menKeywords.some(k => t.includes(k))) return 'men';

    const lowerTags = tags.map(normalize);
    if (womenKeywords.some(k => lowerTags.some(tag => tag.includes(k)))) return 'women';
    if (menKeywords.some(k => lowerTags.some(tag => tag.includes(k)))) return 'men';

    return 'unisex';
}


//Normalize a raw category string into one of our standard buckets.

/**
 * Normalize a raw category string into one of our standard buckets.
 */
export function normalizeCategory(raw: string): string {
    const s = raw
        .toLowerCase()
        .replace(/[_\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Dresses
    if (/\b(mini|midi|maxi|denim)?\s*dress(es)?\b/.test(s)) {
        return 'Dresses';
    }

    // Pants & Sweatpants
    if (
        /\b(pants|trousers|chinos|sweatpants|joggers|trackpants)\b/.test(s)
    ) {
        return 'Pants & Sweatpants';
    }

    // Shorts
    if (/\bshorts?\b/.test(s)) {
        return 'Shorts';
    }

    // Jeans
    if (/\bjeans?\b/.test(s)) {
        return 'Jeans';
    }

    // Jumpers & Cardigans
    if (
        /\b(jumpers?|hoodies?|sweatshirts?|sweaters?|cardigans?)\b/.test(s)
    ) {
        return 'Jumpers & Cardigans';
    }

    // Tshirts
    if (/\b(t[- ]?shirts?|tees?|graphic[- ]?tees?|graphictees?)\b/.test(s)) {
        return 'Tshirts';
    }



    // Shirts (excluding T-shirts)
    if (/\bshirts?\b/.test(s) && !/\b(t[- ]?shirts?)\b/.test(s)) {
        return 'Shirts';
    }

    // Tops (excluding T-shirts)
    if (/\btops?\b/.test(s) && !/\b(t[- ]?shirts?)\b/.test(s)) {
        return 'Tops';
    }

    //singlets 
    if (/\b(singlets?)\b/.test(s)
        || /\b(tank[- ]?tops?)\b/.test(s)
        || /\b(muscle[- ]?tanks?)\b/.test(s)) {
        return 'Singlets';
    }


    // Jackets & Coats
    if (/\b(?:coats?jackets?|jackets?coats?|jackets?|coats?)\b/.test(s)) {
        return 'Jackets & Coats';
    }


    // Sleepwear & Lingerie
    if (/\b(pyjamas?|pjs?|sleepwear|lingerie|bralette|bralettes)\b/.test(s)) {
        return 'Sleepwear & Lingerie';
    }

    // Activewear
    if (/\b(activewear|gym|training|sportswear|leggings)\b/.test(s)) {
        return 'Activewear';
    }

    // Skirts
    if (/\bskirts?\b/.test(s)) {
        return 'Skirts';
    }

    // Swimwear
    if (/\b(swimwear|bikini|bathers|trunks|one[- ]?piece)\b/.test(s)) {
        return 'Swimwear';
    }

    // Pyjamas (if you want a separate bucket; otherwise covered above)
    if (/\b(pyjamas?|pjs?)\b/.test(s)) {
        return 'Pyjamas';
    }

    // Suit
    if (/\bsuits?\b/.test(s)) {
        return 'Suit';
    }

    // Blazer
    if (/\bblazers?\b/.test(s)) {
        return 'Blazer';
    }

    return 'Uncategorized';
}
