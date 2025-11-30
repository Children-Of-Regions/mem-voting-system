const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { EMAIL_BATCH_SIZE, EMAIL_RATE_LIMIT_MS, DEFAULT_PORT, HOURLY_CHECK_INTERVAL, VOTING_CLOSE_CHECK_INTERVAL, STARTUP_DELAY } = require('./constants');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase Setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Helper: Generate Code (XXX-XXX)
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        if (i === 3) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Global lock to prevent concurrent processing
let isProcessing = false;

async function processPendingEmails() {
    if (isProcessing) return;

    isProcessing = true;

    try {
        // 1. Fetch pending emails (batch of 50)
        const { data: pendingCodes, error: fetchError } = await supabase
            .from('voting_codes')
            .select('*')
            .eq('email_status', 'pending')
            .not('email', 'is', null)
            .limit(EMAIL_BATCH_SIZE);

        if (fetchError) throw fetchError;

        if (!pendingCodes || pendingCodes.length === 0) {
            isProcessing = false;
            return;
        }

        console.log(`\n� Processing batch of ${pendingCodes.length} emails...`);

        let successCount = 0;
        let failCount = 0;

        for (const codeRecord of pendingCodes) {
            try {
                const { email, code, id } = codeRecord;

                // Send Email
                await sendEmail(email, code);

                // Update status to SENT
                await supabase
                    .from('voting_codes')
                    .update({
                        email_status: 'sent',
                        email_sent_at: new Date().toISOString(),
                        email_error: null
                    })
                    .eq('id', id);

                console.log(`   ✅ [SENT] ${email}`);
                successCount++;

            } catch (err) {
                console.error(`   ❌ [FAILED] ${codeRecord.email}: ${err.message}`);

                // Update status to FAILED
                await supabase
                    .from('voting_codes')
                    .update({
                        email_status: 'failed',
                        email_error: err.message
                    })
                    .eq('id', codeRecord.id);

                failCount++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, EMAIL_RATE_LIMIT_MS));
        }

        console.log(`📊 Batch complete: ${successCount} sent, ${failCount} failed.\n`);

        // If full batch, check for more
        if (pendingCodes.length === EMAIL_BATCH_SIZE) {
            isProcessing = false;
            setTimeout(() => processPendingEmails(), 1000);
            return;
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
    } finally {
        isProcessing = false;
    }
}

async function sendEmail(email, code) {
    const fromName = process.env.EMAIL_FROM_NAME || 'ՄԵՄ թիմ 💚💛';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
    const supportEmail = process.env.EMAIL_SUPPORT_ADDRESS || 'it@mem.team';
    const votingUrl = process.env.VOTING_URL || 'https://vote.mem.team';

    const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Ձեր քվեարկության կոդը | ՄԵՄ թիմ 💚💛',
        html: `
<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Քվեարկության կոդ</title>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #379F41 0%, #2d7f34 100%); padding: 40px 20px; text-align: center; }
        .header-title { color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #1f2937; margin-bottom: 20px; font-weight: 500; }
        .message { font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 30px; }
        .code-container { background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 8px; border: 2px dashed #379F41; margin: 30px 0; }
        .code-label { color: #6b7280; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .code { color: #379F41; font-size: 42px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace; }
        .button-container { text-align: center; margin: 35px 0; }
        .action-button { display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #379F41 0%, #2d7f34 100%); color: #dededeff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(55, 159, 65, 0.3); transition: transform 0.2s; }
        .action-button:visited { color: #dededeff !important; }
        .action-button:hover { color: #dededeff !important; }
        .action-button:active { color: #dededeff !important; }
        .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { margin: 5px 0; font-size: 13px; color: #6b7280; }
        .footer-link { color: #379F41; text-decoration: none; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 class="header-title">Տարվա ՄԵՄ-ցի մրցանակաբաշխություն</h1>
        </div>
        <div class="content">
            <p class="greeting">Բարև Ձեզ,</p>
            <p class="message">
                Դուք հրավիրված եք մասնակցելու «Տարվա ՄԵՄ-ցի» քվեարկությանը։
                Սա Ձեր անհատական քվեարկության կոդն է, որը կարող եք օգտագործել միայն մեկ անգամ։
            </p>
            
            <div class="code-container">
                <p class="code-label">Ձեր քվեարկության կոդը</p>
                <h1 class="code">${code}</h1>
            </div>

            <div class="button-container">
                <a href="${votingUrl}?code=${code}" class="action-button" style="color: #ffffff !important; text-decoration: none !important;">
                    <span style="color: #ffffff !important;">Գնալ քվեարկության</span>
                </a>
            </div>

            <p class="message" style="font-size: 14px; text-align: center; color: #9ca3af;">
                Խնդրում ենք չփոխանցել այս կոդը այլ անձանց։
            </p>
        </div>
        <div class="footer">
            <p><strong>Տարվա ՄԵՄ-ցի մրցանակաբաշխություն</strong></p>
            <p>Հարցեր ունե՞ք։ <a href="mailto:${supportEmail}" class="footer-link">Կապվեք մեզ հետ</a></p>
            <p style="margin-top: 15px; font-size: 11px; color: #9ca3af;">
                Եթե դուք չեիք սպասում այս նամակին, խնդրում ենք անտեսել այն։
            </p>
        </div>
    </div>
</body>
</html>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Auto-close voting if closing_time has passed
async function checkAndCloseVoting() {
    try {
        const { error } = await supabase.rpc('auto_close_voting_by_time');

        if (error) {
            console.error('❌ Error checking voting close time:', error);
        } else {
            // Check if voting was actually closed
            const { data: config } = await supabase
                .from('voting_config')
                .select('status, closing_time')
                .eq('id', 1)
                .single();

            if (config && config.status === 'closed' && config.closing_time) {
                console.log('✅ Voting automatically closed at scheduled time:', config.closing_time);
            }
        }
    } catch (error) {
        console.error('❌ Error in checkAndCloseVoting:', error);
    }
}

// Trigger Endpoint
app.post('/api/trigger-process', (req, res) => {
    console.log('🔔 Manual trigger received');
    processPendingEmails();
    res.json({ success: true, message: 'Worker triggered' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        processing: isProcessing,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.SERVER_PORT || process.env.PORT || DEFAULT_PORT;
app.listen(PORT, () => {
    console.log(`\n🚀 Worker Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);

    // Run on startup
    setTimeout(() => {
        processPendingEmails();
        checkAndCloseVoting();
    }, STARTUP_DELAY);

    // Email Processing: Run every 1 hour
    setInterval(() => {
        console.log('\n📧 Running hourly email check...');
        processPendingEmails();
    }, HOURLY_CHECK_INTERVAL);

    // Voting Close Check: Run every 1 minute
    setInterval(() => {
        checkAndCloseVoting();
    }, VOTING_CLOSE_CHECK_INTERVAL);
});
