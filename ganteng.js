const { Client } = require('discord.js-selfbot-v13');
const readline = require('readline');
const axios = require('axios');
const cheerio = require('cheerio');
const { spawn } = require('child_process');

// ================== KONFIG USER ==================

const TOKEN = "MTQ1NjY2NzA1NzU2NjUxNTMwNA.GZ6Ge9.fw9Ma_yYQtq2RsLSpC-K9XCaC_nBdEHQvW9s-M"; // <--- GANTI INI

const CHANNEL_ID = "1456668157363355823"; // ID Channel

const OWO_ID = "408785106942164992"; // ID Bot OwO

// ================== KONFIG CAPTCHA ==================

const CAPTCHA_URL = "https://owobot.com/captcha";
// Cookie opsional jika butuh akses setelah login Discord manual (isi string Cookie dari browser)
const CAPTCHA_COOKIE = process.env.CAPTCHA_COOKIE || "";
// Cookie Discord (dari browser) untuk mencoba authorize otomatis saat captcha page minta login
const DISCORD_AUTH_COOKIE = process.env.DISCORD_AUTH_COOKIE || "";
// Token Discord (Authorization header) untuk mencoba authorize otomatis tanpa salin cookie
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";

// ================== KONFIG 2CAPTCHA ==================

const TWO_CAPTCHA_API_KEY = "643103a5cd55484fc9e8fdde2954ad4f";
const TWO_CAPTCHA_ENDPOINT = "https://api.2captcha.com/proxy?key=643103a5cd55484fc9e8fdde2954ad4f&";

// ================== KONFIG DURASI ==================

const loopMin = 15000;
const loopMax = 25000;

const whDelayMin = 4000; // Delay tambahan opsional
const whDelayMax = 13000;

const wbDelayMin = 3000;
const wbDelayMax = 14000;

const wprayMin = 320000;
const wprayMax = 577000;

const restEveryMin = 1280000;
const restEveryMax = 1880000;

const restMin = 180000;
const restMax = 450000;

const textMin = 180000;
const textMax = 600000;

// ================== KONFIG GEMS ==================

const gemCheckCooldown = 600000; // 10 MENIT (600000 ms) Cooldown winv

const gemConfig = {
    enabled: true,
    gemsToUse: {
        huntGem: true,
        luckyGem: true,
        empoweredGem: true,
        specialGem: false
    },
    order: { lowestToHighest: false }, // false = Fabled duluan
    tiers: {
        fabled: true, legendary: true, mythical: true, epic: true, rare: true, uncommon: true, common: true
    },
};

const gemTiers = {
    fabled: ["057", "071", "078", "085"],
    legendary: ["056", "070", "077", "084"],
    mythical: ["055", "069", "076", "083"],
    epic: ["054", "068", "075", "082"],
    rare: ["053", "067", "074", "081"],
    uncommon: ["052", "066", "073", "080"],
    common: ["051", "065", "072", "079"],
};

// ================== TEXT SPAM ==================

const textArray = [
    "Kudo selalu tampil ganteng dengan gaya yang bikin semua orang langsung melirik.",
    "Aura keren Kudo berasa kuat, seolah dia memang lahir untuk jadi pusat perhatian.",
    "Setiap kali Kudo lewat, kesan kece-nya nempel dan susah dilupain.",
    "Kudo itu asik diajak ngobrol, bawa suasana jadi santai tapi tetap seru.",
    "Karisma Kudo bikin orang merasa aman, kayak ada pemimpin yang tenang di dekatnya.",
    "Gaya hidup Kudo elegan, terlihat berkelas seperti raja yang tahu cara menikmati hidup.",
    "Kudo punya selera yang tajam, dari pilihan outfit sampai cara ngomongnya selalu pas.",
    "Senyum Kudo itu mahal, bikin suasana mendadak jadi lebih cerah.",
    "Kudo terlihat kaya raja bukan cuma dari penampilan, tapi juga dari cara dia membawa diri.",
    "Kalau soal vibes, Kudo paket lengkap: ganteng, keren, kece, asik, dan berwibawa."
];

// ================== SETUP CLIENT ==================

const client = new Client({ checkUpdate: false });

// ================== STATE ==================

let running = false;
let lastText = 0, lastWpray = 0, lastRest = 0, nextRest = 0;
let inventoryCheck = false;
let lastGemCheckTime = 0;
let captchaInProgress = false;

// State tambahan buat loop
let nextHunt = 0;
let nextBattle = 0;
let canBattle = false;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function resetLoopState() {
    lastText = Date.now();
    lastWpray = Date.now();
    lastRest = Date.now();
    nextRest = rand(restEveryMin, restEveryMax);
    inventoryCheck = false;
    lastGemCheckTime = 0;
    
    // Set awal timer biar ga tabrakan
    nextHunt = Date.now() + 2000;
    nextBattle = 0;
    canBattle = false;
}

// ================== 2CAPTCHA FUNCTIONS ==================

function extractSiteKey(html) {
    const $ = cheerio.load(html);
    const candidates = [
        $('[data-sitekey]').attr('data-sitekey'),
        $('[data-hcaptcha-sitekey]').attr('data-hcaptcha-sitekey'),
        $('[data-key]').attr('data-key'),
    ].filter(Boolean);

    if (candidates.length > 0) return candidates[0];

    const scriptMatch = html.match(/sitekey["']?\s*[:=]\s*["']([^"']+)["']/i);
    if (scriptMatch && scriptMatch[1]) return scriptMatch[1];

    return null;
}

function mergeCookies(existing, setCookies) {
    const jar = {};
    const addPair = (pair) => {
        const [k, v] = pair.split('=');
        if (k && v) jar[k.trim()] = v.trim();
    };

    if (existing) {
        existing.split(';').forEach(p => addPair(p));
    }
    if (setCookies && Array.isArray(setCookies)) {
        setCookies.forEach(c => {
            const pair = c.split(';')[0];
            addPair(pair);
        });
    }
    const merged = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    return merged;
}

async function uploadCaptchaTo2Captcha(siteKey, pageUrl) {
    try {
        console.log("📤 Uploading reCAPTCHA to 2Captcha...");
        const response = await axios.post(`${TWO_CAPTCHA_ENDPOINT}upload`, null, {
            params: {
                key: TWO_CAPTCHA_API_KEY,
                method: 'userrecaptcha',
                googlekey: siteKey,
                pageurl: pageUrl,
                json: 1
            },
            timeout: 10000
        });

        if (response.data.status === 1) {
            const captchaId = response.data.captcha;
            console.log(`✅ CAPTCHA ID: ${captchaId}`);
            return captchaId;
        } else {
            console.error(`❌ 2Captcha Error: ${response.data.error_text}`);
            return null;
        }
    } catch (err) {
        console.error(`❌ Upload to 2Captcha failed: ${err.message}`);
        return null;
    }
}

async function getCaptchaResult(captchaId) {
    try {
        console.log(`⏳ Waiting for CAPTCHA result... (ID: ${captchaId})`);
        let attempts = 0;
        const maxAttempts = 60; // 5 menit max (60 x 5 detik)

        while (attempts < maxAttempts) {
            await sleep(5000); // Tunggu 5 detik sebelum cek
            attempts++;

            const response = await axios.get(`${TWO_CAPTCHA_ENDPOINT}res`, {
                params: {
                    key: TWO_CAPTCHA_API_KEY,
                    action: 'get',
                    captcha: captchaId,
                    json: 1
                },
                timeout: 10000
            });

            if (response.data.status === 1) {
                const token = response.data.request;
                console.log(`✅ CAPTCHA SOLVED! Token: ${token.substring(0, 50)}...`);
                return token;
            } else if (response.data.request === 'CAPCHA_NOT_READY') {
                console.log(`⏳ CAPTCHA still processing... (${attempts}/60)`);
            } else {
                console.error(`❌ 2Captcha Error: ${response.data.error_text}`);
                return null;
            }
        }

        console.error(`❌ CAPTCHA timeout after ${maxAttempts * 5} seconds`);
        return null;
    } catch (err) {
        console.error(`❌ Get CAPTCHA result failed: ${err.message}`);
        return null;
    }
}

async function solveCaptchaAndVerify(verifyUrl) {
    try {
        console.log(`🔐 Starting CAPTCHA solving process for: ${verifyUrl}`);
        captchaInProgress = true;

        let activeCookie = CAPTCHA_COOKIE;
        // Gabungkan cookie captcha + cookie Discord (jika ada) di awal
        activeCookie = mergeCookies(activeCookie, DISCORD_AUTH_COOKIE ? [DISCORD_AUTH_COOKIE] : []);

        // Step 1: Fetch halaman verify untuk dapatkan siteKey
        console.log("📄 Fetching verification page...");
        const pageResponse = await axios.get(verifyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(activeCookie ? { Cookie: activeCookie } : {}),
            },
            timeout: 10000
        });
        activeCookie = mergeCookies(activeCookie, pageResponse.headers['set-cookie']);

        // Extract siteKey dari halaman
        let siteKey = extractSiteKey(pageResponse.data);
        
        if (!siteKey) {
            const authLinkMatch = pageResponse.data.match(/https:\/\/discord\.com\/oauth2\/authorize[^"']+/);
            if (authLinkMatch) {
                const authUrl = authLinkMatch[0];
                console.error("❌ SiteKey not found. Halaman meminta authorize akun Discord.");
                console.log(`🔗 Silakan buka link authorize ini di browser, login/authorize, lalu ulangi: ${authUrl}`);
                console.log("ℹ️ Jika sudah authorize, salin Cookie dari browser dan set env CAPTCHA_COOKIE agar bot bisa ambil siteKey otomatis.");
                
                // Coba authorize otomatis memakai cookie Discord bila tersedia
                if (DISCORD_AUTH_COOKIE) {
                    try {
                        console.log("🤖 Mencoba authorize otomatis memakai DISCORD_AUTH_COOKIE...");
                        const authResp = await axios.get(authUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                Cookie: DISCORD_AUTH_COOKIE,
                            },
                            maxRedirects: 5,
                            timeout: 10000,
                        });
                        activeCookie = mergeCookies(activeCookie, authResp.headers?.['set-cookie']);

                        // Setelah authorize, fetch ulang captcha page dengan cookie captcha kalau ada
                        const refetch = await axios.get(verifyUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                ...(activeCookie ? { Cookie: activeCookie } : {}),
                            },
                            timeout: 10000,
                        });
                        activeCookie = mergeCookies(activeCookie, refetch.headers['set-cookie']);
                        siteKey = extractSiteKey(refetch.data);
                        if (siteKey) {
                            console.log("✅ SiteKey ditemukan setelah authorize otomatis.");
                        }
                    } catch (autoAuthErr) {
                        console.log(`⚠️ Auto-authorize gagal: ${autoAuthErr.message}`);
                    }
                }

                // Coba authorize otomatis memakai DISCORD_TOKEN (Authorization header)
                if (!siteKey && DISCORD_TOKEN) {
                    try {
                        console.log("🤖 Mencoba authorize otomatis memakai DISCORD_TOKEN...");
                        const authRespToken = await axios.get(authUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                Authorization: DISCORD_TOKEN,
                                ...(activeCookie ? { Cookie: activeCookie } : {}),
                            },
                            maxRedirects: 5,
                            timeout: 10000,
                        });
                        activeCookie = mergeCookies(activeCookie, authRespToken.headers?.['set-cookie']);

                        const refetchToken = await axios.get(verifyUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                ...(activeCookie ? { Cookie: activeCookie } : {}),
                            },
                            timeout: 10000,
                        });
                        activeCookie = mergeCookies(activeCookie, refetchToken.headers['set-cookie']);
                        siteKey = extractSiteKey(refetchToken.data);
                        if (siteKey) {
                            console.log("✅ SiteKey ditemukan setelah authorize otomatis via token.");
                        }
                    } catch (autoAuthTokenErr) {
                        console.log(`⚠️ Auto-authorize via token gagal: ${autoAuthTokenErr.message}`);
                    }
                }

                try {
                    const opener = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
                    spawn(opener, [authUrl], { stdio: 'ignore', detached: true });
                } catch (openErr) {
                    console.log(`⚠️ Gagal auto-open browser: ${openErr.message}`);
                }
            } else {
                console.error("❌ SiteKey not found in verification page");
            }
            if (!siteKey) {
                captchaInProgress = false;
                return false;
            }
        }

        console.log(`🔑 SiteKey found: ${siteKey}`);

        // Step 2: Upload ke 2Captcha
        const captchaId = await uploadCaptchaTo2Captcha(siteKey, verifyUrl);
        if (!captchaId) {
            captchaInProgress = false;
            return false;
        }

        // Step 3: Tunggu hasil
        const captchaToken = await getCaptchaResult(captchaId);
        if (!captchaToken) {
            captchaInProgress = false;
            return false;
        }

        // Step 4: Submit CAPTCHA token
        console.log("🚀 Submitting CAPTCHA token...");
        try {
            const formData = new URLSearchParams();
            formData.append('g-recaptcha-response', captchaToken);

            const submitResponse = await axios.post(
                verifyUrl,
                formData.toString(),
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': verifyUrl,
                        'Origin': new URL(verifyUrl).origin,
                    },
                    maxRedirects: 5,
                    timeout: 10000,
                }
            );

            console.log("✅ CAPTCHA submitted successfully!");
            await sleep(3000); // Wait untuk response dari server

            captchaInProgress = false;
            return true;
        } catch (submitErr) {
            console.log(`⚠️ Submission error (mungkin redirect): ${submitErr.message}`);
            captchaInProgress = false;
            return true; // Anggap berhasil jika ada redirect
        }
    } catch (err) {
        console.error(`❌ CAPTCHA solving failed: ${err.message}`);
        captchaInProgress = false;
        return false;
    }
}

// Konversi angka superscript (kecil) ke normal
function convertSmallNumbers(text) {
    const map = { '⁰':0, '¹':1, '²':2, '³':3, '⁴':4, '⁵':5, '⁶':6, '⁷':7, '⁸':8, '⁹':9 };
    let numStr = text.split('').map(c => map[c] !== undefined ? map[c] : '').join('');
    return numStr ? parseInt(numStr) : 0;
}

// Logic Parsing Inventory
function findGemsAvailable(content) {
    const available = {};
    const regex = /`(\d{3})`.*?([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const gid = match[1];
        const rawCount = match[2];
        const count = convertSmallNumbers(rawCount);
        available[gid] = count;
    }
    return available;
}

function findGemsToUse(available) {
    if (!gemConfig.enabled) return [];
    const tierPriority = ['fabled', 'legendary', 'mythical', 'epic', 'rare', 'uncommon', 'common'];
    if (gemConfig.order.lowestToHighest) tierPriority.reverse();

    const desiredTypes = [];
    if (gemConfig.gemsToUse.huntGem) desiredTypes.push('huntGem');
    if (gemConfig.gemsToUse.empoweredGem) desiredTypes.push('empoweredGem');
    if (gemConfig.gemsToUse.luckyGem) desiredTypes.push('luckyGem');
    if (gemConfig.gemsToUse.specialGem) desiredTypes.push('specialGem');
    
    const typeToIndex = { "huntGem": 0, "empoweredGem": 1, "luckyGem": 2, "specialGem": 3 };
    const gemsToEquip = [];

    for (const gType of desiredTypes) {
        const idx = typeToIndex[gType];
        if (idx === undefined) continue;
        for (const tier of tierPriority) {
            if (!gemConfig.tiers[tier]) continue;
            const tierIds = gemTiers[tier];
            if (!tierIds || idx >= tierIds.length) continue;
            const gemId = tierIds[idx];
            if ((available[gemId] || 0) > 0) {
                gemsToEquip.push(gemId);
                available[gemId]--;
                break;
            }
        }
    }
    return gemsToEquip;
}

// ================== FUNGSI KIRIM PESAN ==================

async function sendForce(content) {
    try {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return console.log("⚠️ Channel not found!");
        await channel.send(content);
    } catch (e) { console.log(`⚠️ Force Send failed: ${e.message}`); }
}

async function sendSafe(content) {
    if (!running || captchaInProgress) return;
    try {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return console.log("⚠️ Channel not found!");
        await channel.sendTyping();
        await sleep(rand(300, 800));
        await channel.send(content);
    } catch (e) { console.log(`⚠️ Send failed: ${e.message}`); }
}

// ================== MAIN LOOP (PENGULANG OTOMATIS) ==================
// Ini yang ditambahkan biar botnya jalan sendiri
async function mainLoop() {
    if (!running || captchaInProgress) {
        setTimeout(mainLoop, 1000);
        return;
    }

    const now = Date.now();

    // Logic Hunt (wh)
    if (now >= nextHunt) {
        console.log("⚔️ Hunting...");
        await sendSafe("wh");
        nextHunt = now + rand(loopMin, loopMax);
        canBattle = true; // wb hanya setelah wh
        nextBattle = now + rand(wbDelayMin, wbDelayMax);
    }

    // Logic Battle (wb)
    if (canBattle && now >= nextBattle) {
        console.log("🛡️ Battling...");
        await sendSafe("wb");
        canBattle = false; // cegah spam, wb cuma sekali setelah wh
        nextBattle = 0;
    }

    // Logic Pray (wpray)
    if (now - lastWpray > rand(wprayMin, wprayMax)) {
        console.log("🙏 Praying...");
        await sendSafe("wpray");
        lastWpray = now;
    }

    // Logic Text Spam
    if (now - lastText > rand(textMin, textMax)) {
        const txt = textArray[rand(0, textArray.length - 1)];
        console.log("💬 Sending Text...");
        await sendSafe(txt);
        lastText = now;
    }

    setTimeout(mainLoop, 1000); // Cek setiap detik
}

// ================== EVENT LISTENER ==================

client.on('messageCreate', async (msg) => {

    if (msg.channelId !== CHANNEL_ID) return;
    
    const content = msg.content.toLowerCase();
    const authorId = msg.author.id;
    const now = Date.now();
    
    // 1. DETEKSI CAPTCHA (PRIORITY UTAMA)
    if ((content.includes("verify") || content.includes("human") || content.includes("real") || content.includes("captcha")) && !captchaInProgress) {
        console.log("🛑 CAPTCHA DETECTED! PAUSING BOT...");
        const wasRunning = running;
        running = false;
        captchaInProgress = true;
    
        // Langsung gunakan link CAPTCHA bawaan
        const verifyUrl = CAPTCHA_URL;
        console.log(`🔗 Using CAPTCHA URL: ${verifyUrl}`);
        
        // Solve CAPTCHA
        const success = await solveCaptchaAndVerify(verifyUrl);
        
        if (success) {
            console.log("✅ CAPTCHA solved! Waiting 5 seconds before resume...");
            await sleep(5000);
            if (wasRunning) {
                console.log("▶️ RESUMING BOT!");
                running = true;
                resetLoopState();
            } else {
                console.log("⏸️ Bot tetap pause sesuai status awal.");
            }
        } else {
            console.error("❌ CAPTCHA solving failed. Bot remains paused. Please restart.");
            captchaInProgress = false;
        }
        return;
    }
    
    // 2. DETEKSI GEM HABIS (DENGAN COOLDOWN 10 MENIT)
    if (authorId === OWO_ID && content.includes("caught") && gemConfig.enabled) {
        const gemIndicators = ["<:gem", "💎", ":egem"];
        // Cek: Gak ada gem icon?
        if (!gemIndicators.some(icon => msg.content.includes(icon))) {
            // Cek: Apakah Cooldown sudah lewat?
            if (now - lastGemCheckTime > gemCheckCooldown) {
                console.log("🔍 Gems Missing! Checking inventory...");
                inventoryCheck = true;
                lastGemCheckTime = now; // Update waktu terakhir cek
                await sendForce("winv");
            } 
        }
    } // <--- INI KURUNG KURAWAL YANG TADI HILANG DI SCRIPT ABANG

    // 3. PROSES INVENTORY
    if (authorId === OWO_ID && inventoryCheck && content.includes("inventory")) {
        console.log("📦 Inventory received. Scanning...");
        inventoryCheck = false;
        const available = findGemsAvailable(msg.content);
        const toUse = findGemsToUse(available);
        
        if (toUse && toUse.length > 0) {
            const idsClean = toUse.map(id => id.replace(/^0+/, ''));
            const cmd = `wuse ${idsClean.join(' ')}`;
            console.log(`💎 Auto-Equipping: ${cmd}`);
            await sendForce(cmd);
        } else {
            console.log("⚠️ Inventory checked, NO GEMS found. (Winv Cooldown Active for 10 min)");
        }
    }
});

client.on('ready', () => {
    console.log("✅ Bot logged in as", client.user.tag);
    console.log("⚠️ Type 'start' to begin, 'stop' to pause");
    
    // Jalankan Loop Utama (tapi nunggu command start)
    mainLoop();
    
    // Setup CLI input
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    rl.on('line', (input) => {
        if (input.toLowerCase() === 'start') {
            running = true;
            resetLoopState();
            console.log("▶️ BOT STARTED");
        } else if (input.toLowerCase() === 'stop') {
            running = false;
            console.log("⏸️ BOT PAUSED");
        }
    });
});

// Login
client.login(TOKEN).catch(e => console.error("Login failed:", e.message));
