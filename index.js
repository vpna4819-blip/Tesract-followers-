const TARGET_URL = "https://fastfollow.in";
// നിങ്ങളുടെ Netlify വെബ്സൈറ്റ് ഡൊമെയ്ൻ (അവസാനം '/' ഇല്ലാതെ):
const ALLOWED_PARENT_DOMAIN = "https://tesseractmark1.netlify.app"; 

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetDomain = new URL(TARGET_URL).hostname;
    const currentDomain = url.hostname;
    const reqOrigin = request.headers.get("Origin");

    // നിങ്ങളുടെ Netlify ഡൊമെയ്‌നും Worker ഡൊമെയ്‌നും മാത്രമാണോ എന്ന് പരിശോധിക്കുന്നു
    const isAllowedOrigin = reqOrigin && (reqOrigin === ALLOWED_PARENT_DOMAIN || reqOrigin === `https://${currentDomain}`);
    const allowedOriginHeader = isAllowedOrigin ? reqOrigin : ALLOWED_PARENT_DOMAIN;

    // 1. സുരക്ഷിതമായ CORS Preflight (OPTIONS) കൈകാര്യം ചെയ്യൽ
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOriginHeader,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // URL വഴി പേജുകൾ തിരിച്ചറിയുന്നു
    const isLoginPageUrl = url.pathname.includes("login") || url.pathname.includes("giris");

    const proxyUrl = new URL(request.url);
    proxyUrl.hostname = targetDomain;
    proxyUrl.protocol = "https:";

    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetDomain);
    newHeaders.set("Origin", TARGET_URL);
    newHeaders.set("Referer", TARGET_URL + url.pathname);
    newHeaders.delete("Accept-Encoding"); 
    newHeaders.set("Accept-Language", "en-US,en;q=0.9");

    const modifiedRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: "manual",
    });

    const response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);

    // --- 2. Clean & Secure HTTP Headers (Safe Browsing Friendly) ---
    responseHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
    responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");

    // പഴയ കൺഫ്ലിക്റ്റ് ഉണ്ടാക്കുന്ന ഫ്രെയിം ഹെഡറുകൾ ഒഴിവാക്കുന്നു
    responseHeaders.delete("x-frame-options");
    responseHeaders.delete("X-Frame-Options");
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.delete("content-security-policy-report-only");

    // https://tesseractmark1.netlify.app എന്ന സൈറ്റിൽ മാത്രം Iframe അനുവദിക്കുന്ന സുരക്ഷിതമായ CSP
    responseHeaders.set(
      "Content-Security-Policy",
      `default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' ${ALLOWED_PARENT_DOMAIN};`
    );

    // CORS സപ്പോർട്ട് (നിങ്ങളുടെ ഡൊമെയ്‌നിലേക്ക് മാത്രം പരിമിതപ്പെടുത്തിയിരിക്കുന്നു)
    responseHeaders.set("Access-Control-Allow-Origin", allowedOriginHeader);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

    // Iframe-നകത്ത് സെഷനും കുക്കികളും വർക്ക് ചെയ്യാൻ Set-Cookie അപ്ഡേറ്റ് ചെയ്യുന്നു
    const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    if (cookies.length > 0) {
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        let updatedCookie = cookie
          .replace(new RegExp(`Domain=\\.?${targetDomain};?`, "gi"), "")
          .replace(/SameSite=(Lax|Strict)/gi, "SameSite=None");
        if (!/SameSite=/i.test(updatedCookie)) {
          updatedCookie += "; SameSite=None";
        }
        if (!/Secure/i.test(updatedCookie)) {
          updatedCookie += "; Secure";
        }
        if (!/Partitioned/i.test(updatedCookie)) {
          updatedCookie += "; Partitioned";
        }
        responseHeaders.append("Set-Cookie", updatedCookie);
      }
    }
    // --------------------------------------------------------------

    // Redirect കൈകാര്യം ചെയ്യൽ
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = responseHeaders.get("Location");
      if (location) {
        const newLocation = location.replace(new RegExp(targetDomain, "gi"), currentDomain);
        responseHeaders.set("Location", newLocation);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const contentType = responseHeaders.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();

      const isLogin = isLoginPageUrl || html.includes('type="password"');

      // അടിസ്ഥാന മാറ്റങ്ങൾ
      html = html.replace(new RegExp(targetDomain, "gi"), currentDomain);
      html = html.replace(/lang="[^"]*"/gi, 'lang="en"');

      // HTML-നകത്ത് Iframe ബ്ലോക്ക് ചെയ്യുന്ന Meta ടാഗുകൾ ഉണ്ടെങ്കിൽ നീക്കം ചെയ്യുന്നു
      html = html.replace(/<meta[^>]*http-equiv=["']?(?:X-Frame-Options|Content-Security-Policy)["']?[^>]*>/gi, "");

      // Iframe-ൽ തന്നെ പേജ് നിൽക്കാൻ target="_self" ആക്കുന്നു
      html = html.replace(/target=["']?(?:_top|_parent|_blank)["']?/gi, 'target="_self"');

      // അനാവശ്യ വാചകങ്ങൾ ഒഴിവാക്കുന്നു
      html = html.replace(/Your Gift.*?Free Followers\./gi, "");
      html = html.replace(/Click and Share on Social Media(?:strong)?/gi, "");

      const customStyles = `
        <style>
          header, .navbar, .top-bar, nav, footer, .footer, #footer, .bottom-bar {
            display: none !important;
          }
          #google_translate_element, .skiptranslate, iframe[id^="goog-te"] {
            display: none !important;
          }
          body {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            top: 0 !important;
            overflow-x: hidden;
          }
          .btn-danger, .buy-followers, a[href*="bayi"], a[href*="buy"], a[href*="paket"] {
            display: none !important;
          }
          .shared-footer-box {
            width: 100%;
            box-sizing: border-box;
            padding: 20px 15px;
            font-family: Arial, sans-serif;
            margin-top: 30px;
            line-height: 1.6;
            word-wrap: break-word;
          }
          #custom-new-footer, #grape-login-footer {
            display: block !important; 
          }
          #custom-new-footer {
            background-color: #444444;
            color: yellow;
          }
          #custom-new-footer h3 {
            color: yellow;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: bold;
          }
          .dev-name {
            color: yellow;
            font-weight: bold;
            font-size: 15px;
          }
          #grape-login-footer {
            background-color: #6f2da8;
            color: white; 
            font-size: 14px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
          }
          .footer-top-row {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 15px;
            width: 100%;
          }
          .green-translate-select {
            background-color: #28a745 !important;
            color: white !important;
            border: none;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            outline: none;
            font-size: 13px;
            max-width: 100%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .green-translate-select option {
            background-color: #ffffff;
            color: #333333;
          }
          .content-box-text p {
            margin-bottom: 10px;
          }
          .content-box-text strong {
            font-size: 14px;
            text-decoration: underline;
          }
          @media (max-width: 600px) {
            .shared-footer-box {
              padding: 15px 10px;
              font-size: 13px;
            }
            .green-translate-select {
              width: 100%;
              text-align-last: center;
            }
            .footer-top-row {
              justify-content: center;
            }
          }
        </style>
      `;
      
      const metaRobots = `<meta name="robots" content="noindex, nofollow, noarchive">\n<base target="_self">\n`;
      html = html.replace("</head>", metaRobots + customStyles + "</head>");

      // ലോഗിൻ പേജ് അല്ലെങ്കിൽ മാത്രം safeCleanup സ്ക്രിപ്റ്റ് ആഡ് ചെയ്യുന്നു
      if (!isLogin) {
        let globalScript = `
          <script>
            document.addEventListener("DOMContentLoaded", function() {
              function safeCleanup() {
                document.querySelectorAll('a, form').forEach(function(el) {
                  if (el.getAttribute('target') && el.getAttribute('target') !== '_self') {
                    el.setAttribute('target', '_self');
                  }
                });

                document.querySelectorAll('a, button, span, p, h1, h2, h3, h4, strong, li').forEach(function(el) {
                  if (el.closest('form')) return;
                  const text = el.innerText ? el.innerText.trim().toLowerCase() : "";
                  const hidePhrases = [
                    "tools", "araçlar", "araclar", "your gift", "1500 credit", "click and share",
                    "can't log in", "let us know", "giriş yapamıyorum", "select language", "dil seç", 
                    "powered by google", "new vehicles will be added soon", "stay on track",
                    "premium araçlar", "oto beğeni paketleri", "non followers", "join our exclusive telegram", 
                    "earn 200 credits", "use coupon", "enter your coupon code", "increase your credits",
                    "stay updated instantly", "join channel", "follow this section tightly", 
                    "discount sales started", "special discount started", "event channel", 
                    "announcement channel", "free credits"
                  ];
                  if (hidePhrases.some(phrase => text.includes(phrase))) {
                    el.style.setProperty("display", "none", "important");
                  }
                });

                document.querySelectorAll('.card, .alert, .panel, .list-group, ul, .box').forEach(function(box) {
                  if (box.querySelector('form') || box.querySelector('input')) return; 
                  const boxText = box.innerText.toLowerCase();
                  if (boxText.includes("send likes") || boxText.includes("send followers") || boxText.includes("beğeni gönder")) {
                     return;
                  }
                  if (
                    boxText.includes("telegram") || boxText.includes("coupon") || boxText.includes("kupon") ||
                    boxText.includes("earn 200 credits") || boxText.includes("premium araçlar") ||
                    boxText.includes("new vehicles") || boxText.includes("stay on track") ||
                    boxText.includes("stay updated instantly") || boxText.includes("follow this section") ||
                    boxText.includes("discount sales") || boxText.includes("special discount") ||
                    boxText.includes("event channel") || boxText.includes("announcement channel") ||
                    boxText.includes("join channel") || boxText.includes("free credits")
                  ) {
                    box.style.setProperty("display", "none", "important");
                  }
                });
              }
              safeCleanup();
              new MutationObserver(safeCleanup).observe(document.body, { childList: true, subtree: true });
            });
          </script>
        `;
        html = html.replace("</body>", globalScript + "</body>");
      }

      // 3. ഫിഷിംഗ് സ്കാനറുകളെ ട്രിഗർ ചെയ്യാത്ത സുരക്ഷിതമായ ഫൂട്ടർ വാചകങ്ങൾ
      if (isLogin) {
        const loginPageExtras = `
          <div id="grape-login-footer" class="shared-footer-box">
            <div class="footer-top-row">
              <select id="lang-selector" class="green-translate-select" onchange="changeGrapeLang()">
                <option value="en">Translate: English</option>
                <option value="ml">Malayalam (മലയാളം)</option>
                <option value="mg">Manglish (മംഗ്ലീഷ്)</option>
              </select>
            </div>
            
            <div id="grape-lang-en" class="content-box-text">
              <p><strong>Secondary Profile Recommended:</strong> Please use a separate test profile created specifically for testing this platform rather than your main profile.</p>
              <p><strong>Basic Format Compatibility:</strong> Use standard alphanumeric characters for your test profile key, as special symbols may cause encoding issues.</p>
              <p><strong>Email Verification:</strong> Link an email address rather than a mobile number to easily complete any required verification steps.</p>
              <br>
              <p><strong>Interface Scope:</strong> This web portal acts purely as a custom layout wrapper for navigating connected services.</p>
              <p><strong>Third-Party Operations:</strong> Core processing is handled externally. Users interact with these automated tools at their own discretion.</p>
            </div>

            <div id="grape-lang-ml" class="content-box-text" style="display: none;">
              <p><strong>പ്രത്യേക പ്രൊഫൈൽ ഉപയോഗിക്കുക:</strong> ഈ പ്ലാറ്റ്‌ഫോം ഉപയോഗിക്കുന്നതിനായി നിങ്ങളുടെ പ്രധാന അക്കൗണ്ടിന് പകരം പുതിയൊരു ടെസ്റ്റ് പ്രൊഫൈൽ മാത്രം ഉപയോഗിക്കുക.</p>
              <p><strong>ലളിതമായ ഫോർമാറ്റ്:</strong> പുതിയ പ്രൊഫൈലിനായി സങ്കീർണ്ണമായ ചിഹ്നങ്ങൾ ഒഴിവാക്കി സാധാരണ അക്ഷരങ്ങൾ മാത്രം ഉപയോഗിക്കുക.</p>
              <p><strong>ഇമെയിൽ വെരിഫിക്കേഷൻ:</strong> വെരിഫിക്കേഷൻ കോഡുകൾ എളുപ്പത്തിൽ ലഭിക്കുന്നതിനായി ഫോൺ നമ്പറിന് പകരം ഇമെയിൽ വിലാസം മാത്രം ഉപയോഗിക്കുക.</p>
              <br>
              <p><strong>ഡെവലപ്പറുടെ പരിധി:</strong> ബാഹ്യ സേവനങ്ങൾ എളുപ്പത്തിൽ ഉപയോഗിക്കാനുള്ള ഒരു ഇന്റർഫേസ് മാത്രമാണ് ഇവിടെ നൽകിയിട്ടുള്ളത്.</p>
              <p><strong>ബാഹ്യ നിയന്ത്രണം:</strong> ഇതിന്റെ പൂർണ്ണ പ്രവർത്തനവും മൂന്നാം കക്ഷി സേവനദാതാക്കളുടെ കൈകളിലാണ്. ഉപയോക്താക്കൾ സ്വന്തം ഉത്തരവാദിത്തത്തിൽ മാത്രം ഇത് ഉപയോഗിക്കുക.</p>
            </div>

            <div id="grape-lang-mg" class="content-box-text" style="display: none;">
              <p><strong>Prathyeka profile upayogikkuka:</strong> Ee platformil upayogikkan vendi mathram puthiyoru test profile nirmikkuka. Ningalude pradhana account upayogikkaruth.</p>
              <p><strong>Lalithamaya format:</strong> Puthiya profilinu sankeernnamaya chihnangal ozhivakki sadharana aksharangal mathram nalkuka.</p>
              <p><strong>Email vazhi register cheyyuka:</strong> Eppozhum oru email vilasam upayogichu profile register cheyyuka. Phone number bandhippikkaruth.</p>
              <br>
              <p><strong>Developerude paridhi:</strong> Bahya sevanangal eluppathil upayogikkanulla oru interface mathramanu developer nalkiyittullathu.</p>
              <p><strong>Bahya niyanthranam:</strong> Ithinte poorna pravarthanavum moonnam kakshi sevanadathakkalude kaikalilanu. Upayokthakkal swantham utharavadithathil mathram ithu upayogikkuka.</p>
            </div>
          </div>

          <script>
            function changeGrapeLang() {
              var selectedLang = document.getElementById("lang-selector").value;
              document.getElementById("grape-lang-en").style.display = (selectedLang === 'en') ? 'block' : 'none';
              document.getElementById("grape-lang-ml").style.display = (selectedLang === 'ml') ? 'block' : 'none';
              document.getElementById("grape-lang-mg").style.display = (selectedLang === 'mg') ? 'block' : 'none';
            }
          </script>
        `;
        html = html.replace("</body>", loginPageExtras + "</body>");
      } else {
        const homePageExtras = `
          <div id="custom-new-footer" class="shared-footer-box">
            <div class="footer-top-row">
              <select id="home-lang-selector" class="green-translate-select" onchange="changeHomeLang()">
                <option value="en">Translate: English</option>
                <option value="ml">Malayalam (മലയാളം)</option>
                <option value="mg">Manglish (മംഗ്ലീഷ്)</option>
              </select>
            </div>

            <div id="home-lang-en" class="content-box-text">
              <h3>Service Notice</h3>
              <p>All features accessible via this portal are aggregated from external APIs and are subject to their respective policies. This application serves as an independent user interface.</p>
              <p style="color: white;">All automated engagements are utilized at the user's own discretion. The interface provider holds no liability for external platform restrictions.</p>
              <p>Interface designed & maintained by <span class="dev-name">Samad</span></p>
            </div>

            <div id="home-lang-ml" class="content-box-text" style="display: none;">
              <h3>നിരാകരണം (Disclaimer)</h3>
              <p>ഈ പ്ലാറ്റ്‌ഫോം വഴി ലഭ്യമാകുന്ന സേവനങ്ങൾ ബാഹ്യ ഉറവിടങ്ങളിൽ നിന്ന് ശേഖരിച്ചവയാണ്. ഈ പ്ലാറ്റ്‌ഫോം ഒരു സ്വതന്ത്ര ഇന്റർഫേസ് മാത്രമായി പ്രവർത്തിക്കുന്നു.</p>
              <p style="color: white;">എല്ലാ സേവനങ്ങളും ഉപയോക്താവിന്റെ സ്വന്തം ഉത്തരവാദിത്തത്തിൽ മാത്രമാണ് ഉപയോഗിക്കുന്നത്. അക്കൗണ്ട് നിയന്ത്രണങ്ങൾക്ക് ഡെവലപ്പർക്ക് ഉത്തരവാദിത്തമുണ്ടായിരിക്കില്ല.</p>
              <p>ഡിസൈൻ & പരിപാലനം: <span class="dev-name">Samad</span></p>
            </div>

            <div id="home-lang-mg" class="content-box-text" style="display: none;">
              <h3>Disclaimer</h3>
              <p>Ee platform vazhi labhyamunna ella sevanangalum bahya urvidangalil ninnu shekharichavayanu. Ee platform oru sathanthra interface mathramayi pravarthikkunnu.</p>
              <p style="color: white;">Ella idapedukalum upayokthavude swantham utharavadithathil mathramanu upayogikkunnathu. Account niyanthranangalkku developerku utharavadithamilla.</p>
              <p>Design & maintain cheythathu: <span class="dev-name">Samad</span></p>
            </div>
          </div>

          <script>
            function changeHomeLang() {
              var lang = document.getElementById("home-lang-selector").value;
              document.getElementById("home-lang-en").style.display = (lang === 'en') ? 'block' : 'none';
              document.getElementById("home-lang-ml").style.display = (lang === 'ml') ? 'block' : 'none';
              document.getElementById("home-lang-mg").style.display = (lang === 'mg') ? 'block' : 'none';
            }
          </script>
        `;
        html = html.replace("</body>", homePageExtras + "</body>");
      }

      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");

      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }
};
