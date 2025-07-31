// api/webhook.js - Simplified version without QuoteFactory integration

class LoadAutomationSimple {
    constructor() {
        // No browser needed for this version
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
        
        console.log('🔍 Searching for load reference...');
        
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
                    
                    console.log(`✅ Found load reference: "${cleanMatch}"`);
                    return cleanMatch;
                }
            }
        }
        
        console.log('❌ No valid load reference found');
        return null;
    }

    formatResponse(loadReference, subject, originalEmail) {
        if (loadReference) {
            return `Subject: Re: ${subject}

Hello,

Thank you for your load inquiry regarding reference ${loadReference}.

I'm pulling the detailed information from our system now and will send you complete pickup/delivery details, commodity info, and our competitive rate within the next few minutes.

🚛 QUICK QUESTION: When and where will you be empty for pickup?

Best regards,
Balto Booking

---
Original Message:
${originalEmail.substring(0, 200)}...

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
${originalEmail.substring(0, 200)}...

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

    const automation = new LoadAutomationSimple();
    
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
        
        const responseEmail = automation.formatResponse(loadReference, subject, emailContent);
        
        return res.status(200).json({
            success: true,
            loadReference: loadReference || null,
            responseEmail,
            replyToEmailId: emailId,
            timestamp: new Date().toISOString(),
            mode: 'simplified'
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        const responseEmail = automation.formatResponse(null, 'Load Inquiry', 'Error processing email');
        
        return res.status(200).json({
            success: true,
            message: 'Error processing',
            responseEmail,
            timestamp: new Date().toISOString()
        });
    }
}

export const config = {
    maxDuration: 10,
};
