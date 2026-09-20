const TARGET_URL = "https://fastfollow.in"; 

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetDomain = new URL(TARGET_URL).hostname;
    const currentDomain = url.hostname;

    // പേജുകൾ തിരിച്ചറിയുന്നു
    const isLoginPage = url.pathname.includes("login") || url.pathname.includes("giris");
    const isHomePage = (url.pathname === "/" || url.pathname === "/index.php") && !isLoginPage;

    const proxyUrl = new URL(request.url);
    proxyUrl.hostname = targetDomain;
    proxyUrl.protocol = "https:";

    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetDomain);
    newHeaders.set("Origin", TARGET_URL);
    newHeaders.set("Referer", TARGET_URL);
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

      // അടിസ്ഥാന മാറ്റങ്ങൾ
      html = html.replace(new RegExp(targetDomain, "gi"), currentDomain);
      html = html.replace(/lang="[^"]*"/gi, 'lang="en"');

      // അനാവശ്യ വാചകങ്ങൾ ഒഴിവാക്കുന്നു
      html = html.replace(/Your Gift.*?Free Followers\./gi, "");
      html = html.replace(/Click and Share on Social Media(?:strong)?/gi, "");

      // CSS സ്റ്റൈലുകൾ (ലോഗിൻ ഫോം ഹൈഡ് ആവാത്ത സുരക്ഷിതമായ റൂളുകൾ)
      const customStyles = `
        <style>
          /* പഴയ ഹെഡറും ഫുട്ടറും മാത്രം ഒഴിവാക്കാൻ */
          header, .navbar, .top-bar, .header, #header, nav,
          footer, .footer, #footer, .bottom-bar {
            display: none !important;
          }
          
          /* ഗൂഗിൾ ട്രാൻസ്ലേറ്റ് ഘടകങ്ങൾ മാത്രം ഹൈഡ് ചെയ്യുന്നു */
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
          
          /* പഴയ ചുവന്ന ബട്ടണും ബൈ പാക്കേജ് ലിങ്കുകളും മാത്രം ഒഴിവാക്കുന്നു */
          .btn-danger, .buy-followers, a[href*="bayi"], a[href*="buy"], a[href*="paket"] {
            display: none !important;
          }

          /* --- പൊതുവായ ഫുട്ടർ ഒപ്റ്റിമൈസേഷൻ --- */
          .shared-footer-box {
            width: 100%;
            box-sizing: border-box;
            padding: 20px 15px;
            font-family: Arial, sans-serif;
            margin-top: 30px;
            line-height: 1.6;
            word-wrap: break-word;
          }

          /* --- ഹോം പേജിലെ ഗ്രേ ഫുട്ടർ --- */
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

          /* --- ലോഗിൻ പേജിലെ ഗ്രേപ്പ് ഫുട്ടർ --- */
          #grape-login-footer {
            background-color: #6f2da8;
            color: white; 
            font-size: 14px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
          }

          /* --- ട്രാൻസ്ലേറ്റ് ബട്ടൺ (പച്ച) --- */
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
      html = html.replace("</head>", customStyles + "</head>");

      // സുരക്ഷിതമായ ക്ലീനർ സ്ക്രിപ്റ്റ് (ലോഗിൻ ഫോം ബാധിക്കാതെ കൃത്യമായി മാത്രം റിമൂവ് ചെയ്യുന്നു)
      let globalScript = `
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            function safeCleanup() {
              // 1. അനാവശ്യ ലിങ്കുകളും ടെക്സ്റ്റുകളും മാത്രം ഹൈഡ് ചെയ്യുന്നു
              document.querySelectorAll('a, button, span, p, h1, h2, h3, h4, strong').forEach(function(el) {
                // ലോഗിൻ ഫോമിനകത്തുള്ള ഘടകങ്ങൾ തൊടരുത്
                if (el.closest('form')) return;

                const text = el.innerText ? el.innerText.trim().toLowerCase() : "";
                
                // Tools ഒഴിവാക്കുന്നു
                if (text === "tools" || text === "araçlar" || text === "araclar" || text.startsWith("tools")) {
                  el.remove();
                  return;
                }
                
                // വാഗ്ദാന വാചകങ്ങൾ
                if (text.includes("your gift") || text.includes("1500 credit") || text.includes("click and share")) {
                  el.style.display = "none";
                  return;
                }

                // ലോഗിൻ സപ്പോർട്ട് ചോദ്യങ്ങൾ മാത്രം
                if (text.includes("can't log in") || text.includes("let us know") || text.includes("giriş yapamıyorum")) {
                  el.style.display = "none";
                  return;
                }

                // ഗൂഗിൾ ട്രാൻസ്ലേറ്റ് ടെക്സ്റ്റ്
                if (text.includes("select language") || text.includes("dil seç") || text.includes("powered by google")) {
                  el.style.display = "none";
                  return;
                }
              });

              // 2. ടെലിഗ്രാം ബോക്സ്, കൂപ്പൺ ബോക്സ് എന്നിവ മാത്രം കൃത്യമായി ഹൈഡ് ചെയ്യുന്നു (ഫോമുകളെ ബാധിക്കില്ല)
              document.querySelectorAll('.card, .alert, .panel').forEach(function(box) {
                if (box.querySelector('form') || box.querySelector('input')) {
                  return; // ലോഗിൻ ഫോം ഉള്ള ബോക്സ് ആണെങ്കിൽ ഒഴിവാക്കുക
                }
                const boxText = box.innerText.toLowerCase();
                if (boxText.includes("telegram") || boxText.includes("coupon") || boxText.includes("kupon")) {
                  box.style.display = "none";
                }
              });
            }

            safeCleanup();
            new MutationObserver(safeCleanup).observe(document.body, { childList: true, subtree: true });
          });
        </script>
      `;
      html = html.replace("</body>", globalScript + "</body>");

      // ഹോം പേജിൽ മാത്രം ഗ്രേ ഫുട്ടർ
      if (isHomePage) {
        const homePageExtras = `
          <div id="custom-new-footer" class="shared-footer-box">
            <div class="footer-top-row">
              <select id="home-lang-selector" class="green-translate-select" onchange="changeHomeLang()">
                <option value="en">🌐 Translate: English</option>
                <option value="ml">🌐 Malayalam (മലയാളം)</option>
                <option value="mg">🌐 Manglish (മംഗ്ലീഷ്)</option>
              </select>
            </div>

            <div id="home-lang-en" class="content-box-text">
              <h3>Disclaimer</h3>
              <p>All data, features, and services accessible via this platform are aggregated from external sources and are subject to their respective terms and policies. This platform serves solely as an independent interface.</p>
              <p style="color: white;">This platform functions solely as an independent gateway relaying external third-party services. All engagements, including follower or like increments, are utilized entirely at the user's own risk. The developer holds zero liability for any account penalties or enforcement measures taken by Instagram arising from the use of this interface.📍🔊</p>
              <p>Interface designed & maintained by <span class="dev-name">Samad.!!😜😁</span></p>
            </div>

            <div id="home-lang-ml" class="content-box-text" style="display: none;">
              <h3>നിരാകരണം (Disclaimer)</h3>
              <p>ഈ പ്ലാറ്റ്‌ഫോം വഴി ലഭ്യമാകുന്ന എല്ലാ ഡാറ്റയും ഫീച്ചറുകളും സേവനങ്ങളും ബാഹ്യ ഉറവിടങ്ങളിൽ നിന്ന് ശേഖരിച്ചവയാണ്, അവ അതത് നിബന്ധനകൾക്കും നയങ്ങൾക്കും വിധേയമാണ്. ഈ പ്ലാറ്റ്‌ഫോം ഒരു സ്വതന്ത്ര ഇന്റർഫേസ് മാത്രമായി പ്രവർത്തിക്കുന്നു.</p>
              <p style="color: white;">ഈ പ്ലാറ്റ്‌ഫോം ബാഹ്യ മൂന്നാം കക്ഷി സേവനങ്ങൾ കൈമാറുന്ന ഒരു സ്വതന്ത്ര ഗേറ്റ്‌വേയായി മാത്രമാണ് പ്രവർത്തിക്കുന്നത്. ഫോളോവേഴ്‌സ് അല്ലെങ്കിൽ ലൈക്കുകൾ വർദ്ധിപ്പിക്കുന്നത് ഉൾപ്പെടെയുള്ള എല്ലാ ഇടപെടലുകളും ഉപയോക്താവിന്റെ സ്വന്തം ഉത്തരവാദിത്തത്തിൽ മാത്രമാണ് ഉപയോഗിക്കുന്നത്. ഈ ഇന്റർഫേസ് ഉപയോഗിക്കുന്നത് വഴി ഇൻസ്റ്റാഗ്രാം സ്വീകരിക്കുന്ന ഏതെങ്കിലും അക്കൗണ്ട് പെനാൽറ്റികൾക്കോ നടപടികൾക്കോ ഡെവലപ്പർക്ക് യാതൊരു ഉത്തരവാദിത്തവുമില്ല.📍🔊</p>
              <p>ഡിസൈൻ & പരിപാലനം: <span class="dev-name">Samad.!!😜😁</span></p>
            </div>

            <div id="home-lang-mg" class="content-box-text" style="display: none;">
              <h3>Disclaimer</h3>
              <p>Ee platform vazhi labhyamunna ella datayum featuresum sevanangalum bahya urvidangalil ninnu shekharichavayanu, ava athathu nibandhanakkalkkum niyamangalkkum vidheyamanu. Ee platform oru sathanthra interface mathramayi pravarthikkunnu.</p>
              <p style="color: white;">Ee platform bahya moonnam kakshi sevanangal kaimarunna oru sathanthra gateway ayi mathramanu pravarthikkunnu. Followers allengil likes vardhippikkunnu ulppatedulla ella idapedukalum upayokthavude swantham utharavadithathil mathramanu upayogikkunnathu. Ee interface upayogikkunnu vazhi Instagram sweekarikkunna ethenkilum account penaltieskko nadapatikkalkko developerku yathoru utharavadithavumilla.📍🔊</p>
              <p>Design & maintain cheythathu: <span class="dev-name">Samad.!!😜😁</span></p>
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

      // ലോഗിൻ പേജിൽ മാത്രം ഗ്രേപ്പ് ഫുട്ടർ (ലോഗിൻ ഫോം താഴെയല്ല, മുകളിൽ കൃത്യമായി കാണിക്കും)
      if (isLoginPage || html.includes('type="password"')) {
        const loginPageExtras = `
          <div id="grape-login-footer" class="shared-footer-box">
            <div class="footer-top-row">
              <select id="lang-selector" class="green-translate-select" onchange="changeGrapeLang()">
                <option value="en">🌐 Translate: English</option>
                <option value="ml">🌐 Malayalam (മലയാളം)</option>
                <option value="mg">🌐 Manglish (മംഗ്ലീഷ്)</option>
              </select>
            </div>
            
            <div id="grape-lang-en" class="content-box-text">
              <p><strong>Use a Dedicated Account:</strong> Create a brand-new Instagram account solely for logging into this platform. Never enter your primary personal credentials.</p>
              <p><strong>Keep Password Simple:</strong> Set a very simple password for this new account. Complex characters or strict password rules might be rejected by the system.</p>
              <p><strong>Register via Gmail:</strong> Always register the account using a Gmail address. Do not link a phone number. Enter the verification code (OTP) received on that Gmail in the subsequent step.</p>
              <br>
              <p><strong>Developer Scope:</strong> The developer has merely provided an accessible interface to navigate external services conveniently.</p>
              <p><strong>External Control:</strong> The full operation and backend control reside entirely with third-party providers. The developer bears zero liability for credentials provided or services consumed. Users proceed entirely at their own discretion.</p>
            </div>

            <div id="grape-lang-ml" class="content-box-text" style="display: none;">
              <p><strong>പ്രത്യേക അക്കൗണ്ട് ഉപയോഗിക്കുക:</strong> ഈ പ്ലാറ്റ്‌ഫോമിൽ ലോഗിൻ ചെയ്യാൻ വേണ്ടി മാത്രം പുതിയൊരു ഇൻസ്റ്റാഗ്രാം അക്കൗണ്ട് നിർമ്മിക്കുക. നിങ്ങളുടെ പ്രധാന അക്കൗണ്ട് വിവരങ്ങൾ ഒരിക്കലും നൽകരുത്.</p>
              <p><strong>ലളിതമായ പാസ്‌വേഡ് നൽകുക:</strong> ഈ പുതിയ അക്കൗണ്ടിന് വളരെ ലളിതമായ പാസ്‌വേഡ് നൽകുക. സങ്കീർണ്ണമായ അക്ഷരങ്ങളും ചിഹ്നങ്ങളും സിസ്റ്റം സ്വീകരിച്ചേക്കില്ല.</p>
              <p><strong>ജിമെയിൽ വഴി രജിസ്റ്റർ ചെയ്യുക:</strong> എപ്പോഴും ഒരു ജിമെയിൽ വിലാസം ഉപയോഗിച്ച് അക്കൗണ്ട് രജിസ്റ്റർ ചെയ്യുക. ഫോൺ നമ്പർ ബന്ധിപ്പിക്കരുത്. ജിമെയിലിൽ ലഭിക്കുന്ന വെരിഫിക്കേഷൻ കോഡ് (OTP) അടുത്ത ഘട്ടത്തിൽ നൽകുക.</p>
              <br>
              <p><strong>ഡെവലപ്പറുടെ പരിധി:</strong> ബാഹ്യ സേവനങ്ങൾ എളുപ്പത്തിൽ ഉപയോഗിക്കാനുള്ള ഒരു ഇന്റർഫേസ് മാത്രമാണ് ഡെവലപ്പർ നൽകിയിട്ടുള്ളത്.</p>
              <p><strong>ബാഹ്യ നിയന്ത്രണം:</strong> ഇതിന്റെ പൂർണ്ണ പ്രവർത്തനവും നിയന്ത്രണവും മൂന്നാം കക്ഷി സേവനദാതാക്കളുടെ കൈകളിലാണ്. നിങ്ങൾ നൽകുന്ന വിവരങ്ങൾക്കും സേവനങ്ങൾക്കും ഡെവലപ്പർക്ക് യാതൊരു ഉത്തരവാദിത്തവുമില്ല. ഉപയോക്താക്കൾ സ്വന്തം ഉത്തരവാദിത്തത്തിൽ മാത്രം ഇത് ഉപയോഗിക്കുക.</p>
            </div>

            <div id="grape-lang-mg" class="content-box-text" style="display: none;">
              <p><strong>Prathyeka account upayogikkuka:</strong> Ee platformil login cheyyan vendi mathram puthiyoru Instagram account nirmikkuka. Ningalude pradhana account vivarangal orikkalum nalkaruth.</p>
              <p><strong>Lalithamaya password nalkuka:</strong> Ee puthiya accountinu valare lalithamaya password nalkuka. Sankeernnamaya aksharangalum chihnangalum system sweekarichekkilla.</p>
              <p><strong>Gmail vazhi register cheyyuka:</strong> Eppozhum oru Gmail vilasam upayogichu account register cheyyuka. Phone number bandhippikkaruth. Gmailil labhikkunna verification code (OTP) adutha ghattathil nalkuka.</p>
              <br>
              <p><strong>Developerude paridhi:</strong> Bahya sevanangal eluppathil upayogikkanulla oru interface mathramanu developer nalkiyittullathu.</p>
              <p><strong>Bahya niyanthranam:</strong> Ithinte poorna pravarthanavum niyanthranavum moonnam kakshi sevanadathakkalude kaikalilanu. Ningal nalkunna vivarangalkkum sevanangalkkum developerku yathoru utharavadithavumilla. Upayokthakkal swantham utharavadithathil mathram ithu upayogikkuka.</p>
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
      }

      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      responseHeaders.delete("content-security-policy"); 
      responseHeaders.delete("x-frame-options");

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
