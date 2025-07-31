// api/webhook.js - Your server.js converted to Vercel serverless
import { chromium } from 'playwright-core';
import chromiumPkg from '@sparticuz/chromium';

class LoadAutomationServerless {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing serverless automation...');
            
            this.browser = await chromium.launch({
                args: [
                    ...chromiumPkg.args,
                    '--no-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ],
                defaultViewport: chromiumPkg.defaultViewport,
                executablePath: await chromiumPkg.executablePath(),
                headless: chromiumPkg.headless,
                ignoreHTTPSErrors: true,
            });
            
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            this.page = await this.context.newPage();
            
            // Block heavy resources to save memory
            await this.page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            
            console.log('✅ Browser initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            return false;
        }
    }

    async cleanup() {
        try {
            if (this.page) await this.page.close();
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
            console.log('✅ Browser cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    extractLoadReference(emailBody) {
        const exclusionPatterns = [
            /MC\s*\d+/i,
            /DOT\s*\d+/i,
            /USDOT\s*\d+/i,
            /invoice\s*#?\s*\d+/i,
            /bill\s*#?\s*\d+/i
        ];
        
        for (const pattern of exclusionPatterns) {
            const match = emailBody.match(pattern);
            if (match) {
                console.log(`❌ Found exclusion pattern: ${match[0]} - ignoring`);
                emailBody = emailBody.replace(pattern, '');
            }
        }
        
        const patterns = [
            /order\s*#?\s*(\d{6,8})/i,
            /reference\s+number\s+(\d{6,8})/i,
            /ref[:\s]+(\d{6,8})/i,
            /\b(\d{6})\b/i,
            /(?:load\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /([A-Z]{2,4}[\-\_\s]*\d{3,8}[\-\_\s]*[A-Z0-9]*)/i,
            /([A-HJ-Z]+\d{4,8}[A-Z0-9]*)/i
        ];
        
        console.log('🔍 Searching for load reference:', emailBody.substring(0, 200) + '...');
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = emailBody.match(pattern);
            
            if (match && match[1]) {
                let cleanMatch = match[1].trim();
                cleanMatch = cleanMatch.replace(/[^\w\-]/g, '');
                
                if (cleanMatch && 
                    cleanMatch.length >= 4 && 
                    !cleanMatch.toUpperCase().startsWith('MC') &&
                    !cleanMatch.toUpperCase().startsWith('DOT')) {
                    
                    console.log(`✅ Found and cleaned load reference: "${cleanMatch}"`);
                    return cleanMatch;
                }
            }
        }
        
        console.log('❌ No valid load reference found');
        return null;
    }

    async freshLoginToQuoteFactory() {
        try {
            console.log('🔐 Starting fresh QuoteFactory login...');
            
            const username = process.env.QUOTEFACTORY_USERNAME;
            const password = process.env.QUOTEFACTORY_PASSWORD;
            
            if (!username || !password) {
                console.log('❌ No QuoteFactory credentials found in environment');
                return false;
            }
            
            console.log('✅ Found QuoteFactory credentials, starting login...');
            
            // Shorter timeout for serverless
            this.page.setDefaultTimeout(15000);
            this.page.setDefaultNavigationTimeout(15000);
            
            await this.page.goto('https://app.quotefactory.com', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });
            
            console.log('Current URL:', this.page.url());
            
            if (this.page.url().includes('/broker/dashboard')) {
                console.log('✅ Already on dashboard!');
                return true;
            }
            
            console.log('🔄 Need to perform login...');
            await this.page.waitForTimeout(2000);
            
            try {
                console.log('🔍 Looking for login fields...');
                
                let emailField = null;
                try {
                    emailField = await this.page.waitForSelector('input[type="email"], input[name="username"], input[placeholder*="email"], input[placeholder*="Email"]', { timeout: 8000 });
                    console.log('✅ Found email field with direct selector');
                } catch (e) {
                    console.log('❌ Direct email selector failed:', e.message);
                }
                
                if (!emailField) {
                    console.log('🔍 Trying iframe approach...');
                    try {
                        const authFrame = this.page.frameLocator('iframe[src*="auth0.com"]');
                        emailField = authFrame.getByLabel(/email/i).first();
                        console.log('✅ Found email field in iframe');
                    } catch (e2) {
                        console.log('❌ Iframe approach also failed:', e2.message);
                        return false;
                    }
                }
                
                if (!emailField) {
                    console.log('❌ Could not find email field');
                    return false;
                }
                
                let passwordField = null;
                try {
                    passwordField = await this.page.waitForSelector('input[type="password"]', { timeout: 5000 });
                    console.log('✅ Found password field with direct selector');
                } catch (e) {
                    console.log('🔍 Trying iframe for password field...');
                    try {
                        const authFrame = this.page.frameLocator('iframe[src*="auth0.com"]');
                        passwordField = authFrame.getByLabel(/password/i).first();
                        console.log('✅ Found password field in iframe');
                    } catch (e2) {
                        console.log('❌ Could not find password field');
                        return false;
                    }
                }
                
                console.log('📝 Filling credentials...');
                await emailField.fill(username);
                await passwordField.fill(password);
                
                console.log('🔐 Submitting login form...');
                await this.page.keyboard.press('Enter');
                
                console.log('⏳ Waiting for login to complete...');
                await this.page.waitForTimeout(8000);
                
                const currentUrl = this.page.url();
                console.log('Post-login URL:', currentUrl);
                
                if (currentUrl.includes('/broker/dashboard')) {
                    console.log('✅ Login successful - on dashboard!');
                    return true;
                } else {
                    console.log('❌ Login may have failed - not on dashboard');
                    return false;
                }
                
            } catch (loginError) {
                console.log('❌ Login process failed:', loginError.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Fresh login failed:', error.message);
            return false;
        }
    }

    extractLocationsAndDates(fullText) {
        console.log('🔍 Extracting locations and dates from text...');
        
        const locationPatterns = [
            /([A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl)[A-Za-z\s]*),\s*([A-Z]{2})/gi,
            /([A-Za-z\s]{3,}),\s*([A-Z]{2})(?:\s+\d{5})?/g,
            /([A-Za-z]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Industrial|Business)([A-Za-z\s]+)),\s*([A-Z]{2})/gi
        ];
        
        const locations = [];
        const foundLocations = new Set();
        
        for (const pattern of locationPatterns) {
            const matches = [...fullText.matchAll(pattern)];
            console.log(`🔍 Pattern found ${matches.length} matches`);
            
            for (const match of matches) {
                let cityState = '';
                
                if (match.length === 3) {
                    let city = match[1].trim();
                    const state = match[2];
                    
                    const streetSuffixPattern = /^.*?(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Industrial|Business|Campus)(.+)$/i;
                    const streetMatch = city.match(streetSuffixPattern);
                    
                    if (streetMatch && streetMatch[2]) {
                        city = streetMatch[2].trim();
                        console.log(`🧹 Cleaned city: "${city}" from "${match[1]}"`);
                    }
                    
                    cityState = `${city}, ${state}`;
                    
                } else if (match.length === 4) {
                    const city = match[2].trim();
                    const state = match[3];
                    cityState = `${city}, ${state}`;
                }
                
                if (cityState && !foundLocations.has(cityState.toLowerCase())) {
                    foundLocations.add(cityState.toLowerCase());
                    
                    const locationIndex = fullText.indexOf(match[0]);
                    const contextStart = Math.max(0, locationIndex - 200);
                    const contextEnd = Math.min(fullText.length, locationIndex + 300);
                    const context = fullText.substring(contextStart, contextEnd);
                    
                    const dateMatch = context.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}/i);
                    
                    const date = dateMatch ? dateMatch[0] : '';
                    
                    locations.push({
                        location: cityState,
                        date: date
                    });
                    
                    console.log(`✅ Found location: ${cityState} ${date ? `on ${date}` : '(no date)'}`);
                }
            }
        }
        
        return locations;
    }

    cleanCommodityData(commodityText) {
        if (!commodityText) return 'General Freight';
        
        let cleaned = commodityText
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/(\d+)([A-Za-z])/g, '$1 $2')
            .replace(/([A-Za-z])(\d+)/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (cleaned.length > 100) {
            const firstSentence = cleaned.split(/[.;]/)[0];
            cleaned = firstSentence || cleaned.substring(0, 100) + '...';
        }
        
        return cleaned;
    }

    extractTemperatureRequirements(text) {
        if (!text) return '';
        
        const tempPatterns = [
            /refrigerated[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /frozen[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /temp[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /(\d+°?F?\s*[–-]\s*\d+°?F?)[^.]*?refrigerated/i,
            /(\d+°?F?\s*[–-]\s*\d+°?F?)[^.]*?frozen/i,
            /(\d+°F\s*[–-]\s*\d+°F)/i
        ];
        
        for (const pattern of tempPatterns) {
            const match = text.match(pattern);
            if (match) {
                let tempRange = match[1];
                
                tempRange = tempRange
                    .replace(/(\d+)([^°\d])/g, '$1°F$2')
                    .replace(/°([^F])/g, '°F$1')
                    .replace(/\s*[–-]\s*/g, ' – ')
                    .trim();
                
                return `Refrigerated ${tempRange}`;
            }
        }
        
        if (/refrigerated/i.test(text)) {
            return 'Refrigerated';
        }
        if (/frozen/i.test(text)) {
            return 'Frozen';
        }
        
        return '';
    }

    extractPostedRate(fullText) {
        console.log('🔍 Looking for posted rates in load details...');
        
        const ratePatterns = [
            /(?:rate|price|target|pay)[\s:]+\$(\d{1,2},?\d{3,4})/i,
            /shipment[\s\S]{0,100}\$(\d{1,2},?\d{3,4})/i,
            /load[\s\S]{0,100}\$(\d{1,2},?\d{3,4})/i
        ];
        
        for (const pattern of ratePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const amount = parseInt(match[1].replace(/,/g, ''));
                if (amount >= 500 && amount <= 10000) {
                    console.log(`✅ Found posted rate: $${match[1]}`);
                    return `$${match[1]}`;
                }
            }
        }
        
        console.log('❌ No posted rate found in load details');
        return 'Rate to be quoted';
    }

    async extractLoadInfo(loadReference) {
        try {
            console.log(`🔗 Starting QuoteFactory extraction for: ${loadReference}`);
            
            const loginSuccess = await this.freshLoginToQuoteFactory();
            
            if (!loginSuccess) {
                console.log('❌ Could not establish QuoteFactory session');
                return null;
            }
            
            console.log('✅ On QuoteFactory dashboard! Starting search...');
            
            await this.page.waitForTimeout(2000);
            
            try {
                console.log('🔍 Looking for "Find Anything" menu item...');
                
                console.log('🔍 Trying keyboard shortcut /');
                try {
                    await this.page.keyboard.press('/');
                    await this.page.waitForTimeout(1500);
                    
                    const shortcutInput = await this.page.$('input[type="text"]:focus, input:focus');
                    if (shortcutInput) {
                        console.log('✅ Keyboard shortcut "/" opened search!');
                        
                        await shortcutInput.fill(loadReference);
                        console.log(`✅ Filled search with: ${loadReference}`);
                        
                        await this.page.waitForTimeout(3000);
                        
                        try {
                            await this.page.click(`text="${loadReference}"`, { timeout: 4000 });
                            console.log('✅ Clicked on search result');
                        } catch (e) {
                            await this.page.keyboard.press('Enter');
                            console.log('✅ Pressed Enter');
                        }
                        
                        await this.page.waitForTimeout(5000);
                        
                        const rawData = await this.page.evaluate(() => {
                            const text = document.body.textContent || '';
                            return {
                                fullText: text,
                                weights: text.match(/(\d{1,3}(?:,\d{3})*)\s*(lbs?|pounds?)/gi) || [],
                                commodities: text.match(/(\d+\s*(?:pallets?|boxes?|pieces?)[^.]*)/gi) || []
                            };
                        });
                        
                        console.log('📊 Raw data extracted, parsing locations...');
                        
                        const locationsAndDates = this.extractLocationsAndDates(rawData.fullText);
                        const tempRequirements = this.extractTemperatureRequirements(rawData.fullText);
                        const postedRate = this.extractPostedRate(rawData.fullText);
                        
                        console.log(`🔍 Found ${locationsAndDates.length} locations`);
                        
                        const loadInfo = {
                            pickup: locationsAndDates[0] ? 
                                `${locationsAndDates[0].location}${locationsAndDates[0].date ? ` (${locationsAndDates[0].date})` : ''}` : 
                                'Pickup not found',
                            delivery: locationsAndDates[1] ? 
                                `${locationsAndDates[1].location}${locationsAndDates[1].date ? ` (${locationsAndDates[1].date})` : ''}` : 
                                'Delivery not found',
                            commodity: this.cleanCommodityData(rawData.commodities[0]),
                            weight: rawData.weights[0] || 'Weight not specified',
                            rate: postedRate,
                            temperature: tempRequirements
                        };
                        
                        console.log('📋 Cleaned extracted data:', JSON.stringify(loadInfo, null, 2));
                        
                        if (loadInfo.pickup !== 'Pickup not found' || 
                            loadInfo.delivery !== 'Delivery not found' ||
                            loadInfo.weight !== 'Weight not specified') {
                            console.log('✅ Successfully extracted meaningful data!');
                            return loadInfo;
                        } else {
                            console.log('⚠️ No meaningful data found but process completed');
                            return loadInfo;
                        }
                    }
                } catch (e) {
                    console.log('Keyboard shortcut failed, trying click method...');
                }
                
                const findSelectors = [
                    'text="Find Anything"',
                    'text="Find anything"',
                    '[aria-label*="Find"]'
                ];
                
                let clicked = false;
                for (const selector of findSelectors) {
                    try {
                        await this.page.click(selector, { timeout: 2000 });
                        clicked = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                
                if (!clicked) {
                    console.log('❌ Could not find search element');
                    return null;
                }
                
                await this.page.waitForTimeout(1500);
                
                const searchInput = await this.page.$('input[type="text"]:visible, input:focus');
                if (searchInput) {
                    await searchInput.fill(loadReference);
                    await this.page.waitForTimeout(3000);
                    
                    try {
                        await this.page.click(`text="${loadReference}"`, { timeout: 4000 });
                    } catch (e) {
                        await this.page.keyboard.press('Enter');
                    }
                    
                    await this.page.waitForTimeout(5000);
                    
                    const rawData = await this.page.evaluate(() => {
                        const text = document.body.textContent || '';
                        return {
                            fullText: text,
                            weights: text.match(/(\d{1,3}(?:,\d{3})*)\s*(lbs?|pounds?)/gi) || [],
                            commodities: text.match(/(\d+\s*(?:pallets?|boxes?|pieces?)[^.]*)/gi) || []
                        };
                    });
                    
                    const locationsAndDates = this.extractLocationsAndDates(rawData.fullText);
                    const tempRequirements = this.extractTemperatureRequirements(rawData.fullText);
                    const postedRate = this.extractPostedRate(rawData.fullText);
                    
                    const loadInfo = {
                        pickup: locationsAndDates[0] ? 
                            `${locationsAndDates[0].location}${locationsAndDates[0].date ? ` (${locationsAndDates[0].date})` : ''}` : 
                            'Pickup not found',
                        delivery: locationsAndDates[1] ? 
                            `${locationsAndDates[1].location}${locationsAndDates[1].date ? ` (${locationsAndDates[1].date})` : ''}` : 
                            'Delivery not found',
                        commodity: this.cleanCommodityData(rawData.commodities[0]),
                        weight: rawData.weights[0] || 'Weight not specified',
                        rate: postedRate,
                        temperature: tempRequirements
                    };
                    
                    console.log('📋 Final extracted data:', JSON.stringify(loadInfo, null, 2));
                    return loadInfo;
                }
                
                return null;
                
            } catch (searchError) {
                console.error('❌ Search process failed:', searchError.message);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Load extraction failed:', error.message);
            return null;
        }
    }

    formatResponse(loadInfo, loadReference, subject, originalEmail) {
        if (loadInfo) {
            let loadDetails = `📦 LOAD DETAILS:
- Pickup: ${loadInfo.pickup}
- Delivery: ${loadInfo.delivery}
- Commodity: ${loadInfo.commodity}
- Weight: ${loadInfo.weight}
- Rate: ${loadInfo.rate}`;

            if (loadInfo.temperature) {
                loadDetails += `\n• Temperature: ${loadInfo.temperature}`;
            }

            return `Subject: Re: ${subject}

Hello,

Thank you for your load inquiry. Here are the details for BOL ${loadReference}:

${loadDetails}

🚛 CAPACITY INQUIRY:
When and where will you be empty for pickup?

Best regards,
Balto Booking

---
Original Message:
${originalEmail}

---
Automated response system`;
        } else {
            return `Subject: Re: ${subject} - DAT Reference Number Needed

Hello,

Thank you for reaching out about this load opportunity.

To provide you with accurate pricing and availability, could you please provide the DAT load reference number or QuoteFactory load ID?

This will help us:
- Pull the exact load details from our system
- Provide you with competitive pricing
- Respond faster with availability

Once you provide the reference number, we'll get back to you immediately with our quote and capacity.

Thank you!

Best regards,
Balto Booking

---
Original Message:
${originalEmail}

---
Automated response - Please reply with DAT reference number`;
        }
    }
}

// VERCEL SERVERLESS HANDLER
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const automation = new LoadAutomationServerless();
    
    try {
        console.log('=== Processing New Email ===');
        console.log('Subject:', req.body.subject);
        console.log('Body Preview:', req.body.bodyPreview?.substring(0, 200));
        
        const emailId = req.body.id;
        const subject = req.body.subject || 'Load Inquiry';
        const bodyPreview = req.body.bodyPreview || '';
        const bodyContent = req.body.body?.content || '';
        
        const emailContent = bodyPreview || bodyContent || '';
        
        const loadReference = automation.extractLoadReference(emailContent);
        
        if (loadReference) {
            console.log(`✅ Found load reference: ${loadReference}`);
            
            const initialized = await automation.initialize();
            
            let loadInfo = null;
            if (initialized) {
                loadInfo = await automation.extractLoadInfo(loadReference);
                await automation.cleanup();
            }
            
            const responseEmail = automation.formatResponse(loadInfo, loadReference, subject, emailContent);
            
            return res.status(200).json({
                success: true,
                loadReference,
                loadInfo: loadInfo || { error: 'Could not extract from QuoteFactory' },
                responseEmail,
                replyToEmailId: emailId,
                timestamp: new Date().toISOString()
            });
            
        } else {
            console.log('📧 No valid load reference found');
            
            const responseEmail = automation.formatResponse(null, null, subject, emailContent);
            
            return res.status(200).json({
                success: true,
                message: 'No valid load reference found - requesting DAT number',
                responseEmail,
                replyToEmailId: emailId,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        await automation.cleanup();
        
        const responseEmail = automation.formatResponse(null, null, 'Load Inquiry', 'Error processing email');
        
        return res.status(200).json({
            success: true,
            message: 'Error processing',
            responseEmail,
            timestamp: new Date().toISOString()
        });
    }
}

export const config = {
    maxDuration: 30,
};
EOFcat > api/webhook.js << 'EOF'
// api/webhook.js - Your server.js converted to Vercel serverless
import { chromium } from 'playwright-core';
import chromiumPkg from '@sparticuz/chromium';

class LoadAutomationServerless {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing serverless automation...');
            
            this.browser = await chromium.launch({
                args: [
                    ...chromiumPkg.args,
                    '--no-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ],
                defaultViewport: chromiumPkg.defaultViewport,
                executablePath: await chromiumPkg.executablePath(),
                headless: chromiumPkg.headless,
                ignoreHTTPSErrors: true,
            });
            
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            this.page = await this.context.newPage();
            
            // Block heavy resources to save memory
            await this.page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            
            console.log('✅ Browser initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            return false;
        }
    }

    async cleanup() {
        try {
            if (this.page) await this.page.close();
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
            console.log('✅ Browser cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    extractLoadReference(emailBody) {
        const exclusionPatterns = [
            /MC\s*\d+/i,
            /DOT\s*\d+/i,
            /USDOT\s*\d+/i,
            /invoice\s*#?\s*\d+/i,
            /bill\s*#?\s*\d+/i
        ];
        
        for (const pattern of exclusionPatterns) {
            const match = emailBody.match(pattern);
            if (match) {
                console.log(`❌ Found exclusion pattern: ${match[0]} - ignoring`);
                emailBody = emailBody.replace(pattern, '');
            }
        }
        
        const patterns = [
            /order\s*#?\s*(\d{6,8})/i,
            /reference\s+number\s+(\d{6,8})/i,
            /ref[:\s]+(\d{6,8})/i,
            /\b(\d{6})\b/i,
            /(?:load\s*(?:ref|reference|number|id|#)[:\-\s]*)([A-Z0-9\-\_]+)/i,
            /([A-Z]{2,4}[\-\_\s]*\d{3,8}[\-\_\s]*[A-Z0-9]*)/i,
            /([A-HJ-Z]+\d{4,8}[A-Z0-9]*)/i
        ];
        
        console.log('🔍 Searching for load reference:', emailBody.substring(0, 200) + '...');
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = emailBody.match(pattern);
            
            if (match && match[1]) {
                let cleanMatch = match[1].trim();
                cleanMatch = cleanMatch.replace(/[^\w\-]/g, '');
                
                if (cleanMatch && 
                    cleanMatch.length >= 4 && 
                    !cleanMatch.toUpperCase().startsWith('MC') &&
                    !cleanMatch.toUpperCase().startsWith('DOT')) {
                    
                    console.log(`✅ Found and cleaned load reference: "${cleanMatch}"`);
                    return cleanMatch;
                }
            }
        }
        
        console.log('❌ No valid load reference found');
        return null;
    }

    async freshLoginToQuoteFactory() {
        try {
            console.log('🔐 Starting fresh QuoteFactory login...');
            
            const username = process.env.QUOTEFACTORY_USERNAME;
            const password = process.env.QUOTEFACTORY_PASSWORD;
            
            if (!username || !password) {
                console.log('❌ No QuoteFactory credentials found in environment');
                return false;
            }
            
            console.log('✅ Found QuoteFactory credentials, starting login...');
            
            // Shorter timeout for serverless
            this.page.setDefaultTimeout(15000);
            this.page.setDefaultNavigationTimeout(15000);
            
            await this.page.goto('https://app.quotefactory.com', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });
            
            console.log('Current URL:', this.page.url());
            
            if (this.page.url().includes('/broker/dashboard')) {
                console.log('✅ Already on dashboard!');
                return true;
            }
            
            console.log('🔄 Need to perform login...');
            await this.page.waitForTimeout(2000);
            
            try {
                console.log('🔍 Looking for login fields...');
                
                let emailField = null;
                try {
                    emailField = await this.page.waitForSelector('input[type="email"], input[name="username"], input[placeholder*="email"], input[placeholder*="Email"]', { timeout: 8000 });
                    console.log('✅ Found email field with direct selector');
                } catch (e) {
                    console.log('❌ Direct email selector failed:', e.message);
                }
                
                if (!emailField) {
                    console.log('🔍 Trying iframe approach...');
                    try {
                        const authFrame = this.page.frameLocator('iframe[src*="auth0.com"]');
                        emailField = authFrame.getByLabel(/email/i).first();
                        console.log('✅ Found email field in iframe');
                    } catch (e2) {
                        console.log('❌ Iframe approach also failed:', e2.message);
                        return false;
                    }
                }
                
                if (!emailField) {
                    console.log('❌ Could not find email field');
                    return false;
                }
                
                let passwordField = null;
                try {
                    passwordField = await this.page.waitForSelector('input[type="password"]', { timeout: 5000 });
                    console.log('✅ Found password field with direct selector');
                } catch (e) {
                    console.log('🔍 Trying iframe for password field...');
                    try {
                        const authFrame = this.page.frameLocator('iframe[src*="auth0.com"]');
                        passwordField = authFrame.getByLabel(/password/i).first();
                        console.log('✅ Found password field in iframe');
                    } catch (e2) {
                        console.log('❌ Could not find password field');
                        return false;
                    }
                }
                
                console.log('📝 Filling credentials...');
                await emailField.fill(username);
                await passwordField.fill(password);
                
                console.log('🔐 Submitting login form...');
                await this.page.keyboard.press('Enter');
                
                console.log('⏳ Waiting for login to complete...');
                await this.page.waitForTimeout(8000);
                
                const currentUrl = this.page.url();
                console.log('Post-login URL:', currentUrl);
                
                if (currentUrl.includes('/broker/dashboard')) {
                    console.log('✅ Login successful - on dashboard!');
                    return true;
                } else {
                    console.log('❌ Login may have failed - not on dashboard');
                    return false;
                }
                
            } catch (loginError) {
                console.log('❌ Login process failed:', loginError.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Fresh login failed:', error.message);
            return false;
        }
    }

    extractLocationsAndDates(fullText) {
        console.log('🔍 Extracting locations and dates from text...');
        
        const locationPatterns = [
            /([A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl)[A-Za-z\s]*),\s*([A-Z]{2})/gi,
            /([A-Za-z\s]{3,}),\s*([A-Z]{2})(?:\s+\d{5})?/g,
            /([A-Za-z]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Industrial|Business)([A-Za-z\s]+)),\s*([A-Z]{2})/gi
        ];
        
        const locations = [];
        const foundLocations = new Set();
        
        for (const pattern of locationPatterns) {
            const matches = [...fullText.matchAll(pattern)];
            console.log(`🔍 Pattern found ${matches.length} matches`);
            
            for (const match of matches) {
                let cityState = '';
                
                if (match.length === 3) {
                    let city = match[1].trim();
                    const state = match[2];
                    
                    const streetSuffixPattern = /^.*?(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Industrial|Business|Campus)(.+)$/i;
                    const streetMatch = city.match(streetSuffixPattern);
                    
                    if (streetMatch && streetMatch[2]) {
                        city = streetMatch[2].trim();
                        console.log(`🧹 Cleaned city: "${city}" from "${match[1]}"`);
                    }
                    
                    cityState = `${city}, ${state}`;
                    
                } else if (match.length === 4) {
                    const city = match[2].trim();
                    const state = match[3];
                    cityState = `${city}, ${state}`;
                }
                
                if (cityState && !foundLocations.has(cityState.toLowerCase())) {
                    foundLocations.add(cityState.toLowerCase());
                    
                    const locationIndex = fullText.indexOf(match[0]);
                    const contextStart = Math.max(0, locationIndex - 200);
                    const contextEnd = Math.min(fullText.length, locationIndex + 300);
                    const context = fullText.substring(contextStart, contextEnd);
                    
                    const dateMatch = context.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}/i);
                    
                    const date = dateMatch ? dateMatch[0] : '';
                    
                    locations.push({
                        location: cityState,
                        date: date
                    });
                    
                    console.log(`✅ Found location: ${cityState} ${date ? `on ${date}` : '(no date)'}`);
                }
            }
        }
        
        return locations;
    }

    cleanCommodityData(commodityText) {
        if (!commodityText) return 'General Freight';
        
        let cleaned = commodityText
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/(\d+)([A-Za-z])/g, '$1 $2')
            .replace(/([A-Za-z])(\d+)/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (cleaned.length > 100) {
            const firstSentence = cleaned.split(/[.;]/)[0];
            cleaned = firstSentence || cleaned.substring(0, 100) + '...';
        }
        
        return cleaned;
    }

    extractTemperatureRequirements(text) {
        if (!text) return '';
        
        const tempPatterns = [
            /refrigerated[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /frozen[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /temp[^.]*?(\d+°?F?\s*[–-]\s*\d+°?F?)/i,
            /(\d+°?F?\s*[–-]\s*\d+°?F?)[^.]*?refrigerated/i,
            /(\d+°?F?\s*[–-]\s*\d+°?F?)[^.]*?frozen/i,
            /(\d+°F\s*[–-]\s*\d+°F)/i
        ];
        
        for (const pattern of tempPatterns) {
            const match = text.match(pattern);
            if (match) {
                let tempRange = match[1];
                
                tempRange = tempRange
                    .replace(/(\d+)([^°\d])/g, '$1°F$2')
                    .replace(/°([^F])/g, '°F$1')
                    .replace(/\s*[–-]\s*/g, ' – ')
                    .trim();
                
                return `Refrigerated ${tempRange}`;
            }
        }
        
        if (/refrigerated/i.test(text)) {
            return 'Refrigerated';
        }
        if (/frozen/i.test(text)) {
            return 'Frozen';
        }
        
        return '';
    }

    extractPostedRate(fullText) {
        console.log('🔍 Looking for posted rates in load details...');
        
        const ratePatterns = [
            /(?:rate|price|target|pay)[\s:]+\$(\d{1,2},?\d{3,4})/i,
            /shipment[\s\S]{0,100}\$(\d{1,2},?\d{3,4})/i,
            /load[\s\S]{0,100}\$(\d{1,2},?\d{3,4})/i
        ];
        
        for (const pattern of ratePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const amount = parseInt(match[1].replace(/,/g, ''));
                if (amount >= 500 && amount <= 10000) {
                    console.log(`✅ Found posted rate: $${match[1]}`);
                    return `$${match[1]}`;
                }
            }
        }
        
        console.log('❌ No posted rate found in load details');
        return 'Rate to be quoted';
    }

    async extractLoadInfo(loadReference) {
        try {
            console.log(`🔗 Starting QuoteFactory extraction for: ${loadReference}`);
            
            const loginSuccess = await this.freshLoginToQuoteFactory();
            
            if (!loginSuccess) {
                console.log('❌ Could not establish QuoteFactory session');
                return null;
            }
            
            console.log('✅ On QuoteFactory dashboard! Starting search...');
            
            await this.page.waitForTimeout(2000);
            
            try {
                console.log('🔍 Looking for "Find Anything" menu item...');
                
                console.log('🔍 Trying keyboard shortcut /');
                try {
                    await this.page.keyboard.press('/');
                    await this.page.waitForTimeout(1500);
                    
                    const shortcutInput = await this.page.$('input[type="text"]:focus, input:focus');
                    if (shortcutInput) {
                        console.log('✅ Keyboard shortcut "/" opened search!');
                        
                        await shortcutInput.fill(loadReference);
                        console.log(`✅ Filled search with: ${loadReference}`);
                        
                        await this.page.waitForTimeout(3000);
                        
                        try {
                            await this.page.click(`text="${loadReference}"`, { timeout: 4000 });
                            console.log('✅ Clicked on search result');
                        } catch (e) {
                            await this.page.keyboard.press('Enter');
                            console.log('✅ Pressed Enter');
                        }
                        
                        await this.page.waitForTimeout(5000);
                        
                        const rawData = await this.page.evaluate(() => {
                            const text = document.body.textContent || '';
                            return {
                                fullText: text,
                                weights: text.match(/(\d{1,3}(?:,\d{3})*)\s*(lbs?|pounds?)/gi) || [],
                                commodities: text.match(/(\d+\s*(?:pallets?|boxes?|pieces?)[^.]*)/gi) || []
                            };
                        });
                        
                        console.log('📊 Raw data extracted, parsing locations...');
                        
                        const locationsAndDates = this.extractLocationsAndDates(rawData.fullText);
                        const tempRequirements = this.extractTemperatureRequirements(rawData.fullText);
                        const postedRate = this.extractPostedRate(rawData.fullText);
                        
                        console.log(`🔍 Found ${locationsAndDates.length} locations`);
                        
                        const loadInfo = {
                            pickup: locationsAndDates[0] ? 
                                `${locationsAndDates[0].location}${locationsAndDates[0].date ? ` (${locationsAndDates[0].date})` : ''}` : 
                                'Pickup not found',
                            delivery: locationsAndDates[1] ? 
                                `${locationsAndDates[1].location}${locationsAndDates[1].date ? ` (${locationsAndDates[1].date})` : ''}` : 
                                'Delivery not found',
                            commodity: this.cleanCommodityData(rawData.commodities[0]),
                            weight: rawData.weights[0] || 'Weight not specified',
                            rate: postedRate,
                            temperature: tempRequirements
                        };
                        
                        console.log('📋 Cleaned extracted data:', JSON.stringify(loadInfo, null, 2));
                        
                        if (loadInfo.pickup !== 'Pickup not found' || 
                            loadInfo.delivery !== 'Delivery not found' ||
                            loadInfo.weight !== 'Weight not specified') {
                            console.log('✅ Successfully extracted meaningful data!');
                            return loadInfo;
                        } else {
                            console.log('⚠️ No meaningful data found but process completed');
                            return loadInfo;
                        }
                    }
                } catch (e) {
                    console.log('Keyboard shortcut failed, trying click method...');
                }
                
                const findSelectors = [
                    'text="Find Anything"',
                    'text="Find anything"',
                    '[aria-label*="Find"]'
                ];
                
                let clicked = false;
                for (const selector of findSelectors) {
                    try {
                        await this.page.click(selector, { timeout: 2000 });
                        clicked = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                
                if (!clicked) {
                    console.log('❌ Could not find search element');
                    return null;
                }
                
                await this.page.waitForTimeout(1500);
                
                const searchInput = await this.page.$('input[type="text"]:visible, input:focus');
                if (searchInput) {
                    await searchInput.fill(loadReference);
                    await this.page.waitForTimeout(3000);
                    
                    try {
                        await this.page.click(`text="${loadReference}"`, { timeout: 4000 });
                    } catch (e) {
                        await this.page.keyboard.press('Enter');
                    }
                    
                    await this.page.waitForTimeout(5000);
                    
                    const rawData = await this.page.evaluate(() => {
                        const text = document.body.textContent || '';
                        return {
                            fullText: text,
                            weights: text.match(/(\d{1,3}(?:,\d{3})*)\s*(lbs?|pounds?)/gi) || [],
                            commodities: text.match(/(\d+\s*(?:pallets?|boxes?|pieces?)[^.]*)/gi) || []
                        };
                    });
                    
                    const locationsAndDates = this.extractLocationsAndDates(rawData.fullText);
                    const tempRequirements = this.extractTemperatureRequirements(rawData.fullText);
                    const postedRate = this.extractPostedRate(rawData.fullText);
                    
                    const loadInfo = {
                        pickup: locationsAndDates[0] ? 
                            `${locationsAndDates[0].location}${locationsAndDates[0].date ? ` (${locationsAndDates[0].date})` : ''}` : 
                            'Pickup not found',
                        delivery: locationsAndDates[1] ? 
                            `${locationsAndDates[1].location}${locationsAndDates[1].date ? ` (${locationsAndDates[1].date})` : ''}` : 
                            'Delivery not found',
                        commodity: this.cleanCommodityData(rawData.commodities[0]),
                        weight: rawData.weights[0] || 'Weight not specified',
                        rate: postedRate,
                        temperature: tempRequirements
                    };
                    
                    console.log('📋 Final extracted data:', JSON.stringify(loadInfo, null, 2));
                    return loadInfo;
                }
                
                return null;
                
            } catch (searchError) {
                console.error('❌ Search process failed:', searchError.message);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Load extraction failed:', error.message);
            return null;
        }
    }

    formatResponse(loadInfo, loadReference, subject, originalEmail) {
        if (loadInfo) {
            let loadDetails = `📦 LOAD DETAILS:
- Pickup: ${loadInfo.pickup}
- Delivery: ${loadInfo.delivery}
- Commodity: ${loadInfo.commodity}
- Weight: ${loadInfo.weight}
- Rate: ${loadInfo.rate}`;

            if (loadInfo.temperature) {
                loadDetails += `\n• Temperature: ${loadInfo.temperature}`;
            }

            return `Subject: Re: ${subject}

Hello,

Thank you for your load inquiry. Here are the details for BOL ${loadReference}:

${loadDetails}

🚛 CAPACITY INQUIRY:
When and where will you be empty for pickup?

Best regards,
Balto Booking

---
Original Message:
${originalEmail}

---
Automated response system`;
        } else {
            return `Subject: Re: ${subject} - DAT Reference Number Needed

Hello,

Thank you for reaching out about this load opportunity.

To provide you with accurate pricing and availability, could you please provide the DAT load reference number or QuoteFactory load ID?

This will help us:
- Pull the exact load details from our system
- Provide you with competitive pricing
- Respond faster with availability

Once you provide the reference number, we'll get back to you immediately with our quote and capacity.

Thank you!

Best regards,
Balto Booking

---
Original Message:
${originalEmail}

---
Automated response - Please reply with DAT reference number`;
        }
    }
}

// VERCEL SERVERLESS HANDLER
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const automation = new LoadAutomationServerless();
    
    try {
        console.log('=== Processing New Email ===');
        console.log('Subject:', req.body.subject);
        console.log('Body Preview:', req.body.bodyPreview?.substring(0, 200));
        
        const emailId = req.body.id;
        const subject = req.body.subject || 'Load Inquiry';
        const bodyPreview = req.body.bodyPreview || '';
        const bodyContent = req.body.body?.content || '';
        
        const emailContent = bodyPreview || bodyContent || '';
        
        const loadReference = automation.extractLoadReference(emailContent);
        
        if (loadReference) {
            console.log(`✅ Found load reference: ${loadReference}`);
            
            const initialized = await automation.initialize();
            
            let loadInfo = null;
            if (initialized) {
                loadInfo = await automation.extractLoadInfo(loadReference);
                await automation.cleanup();
            }
            
            const responseEmail = automation.formatResponse(loadInfo, loadReference, subject, emailContent);
            
            return res.status(200).json({
                success: true,
                loadReference,
                loadInfo: loadInfo || { error: 'Could not extract from QuoteFactory' },
                responseEmail,
                replyToEmailId: emailId,
                timestamp: new Date().toISOString()
            });
            
        } else {
            console.log('📧 No valid load reference found');
            
            const responseEmail = automation.formatResponse(null, null, subject, emailContent);
            
            return res.status(200).json({
                success: true,
                message: 'No valid load reference found - requesting DAT number',
                responseEmail,
                replyToEmailId: emailId,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        await automation.cleanup();
        
        const responseEmail = automation.formatResponse(null, null, 'Load Inquiry', 'Error processing email');
        
        return res.status(200).json({
            success: true,
            message: 'Error processing',
            responseEmail,
            timestamp: new Date().toISOString()
        });
    }
}

export const config = {
    maxDuration: 30,
};
