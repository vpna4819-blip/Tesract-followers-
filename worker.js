// ഇതൊരു മാതൃകാ (Sample) URL മാത്രമാണ്. ഇവിടെ നിങ്ങളുടെ സ്വന്തം വെബ്സൈറ്റ് വിലാസം നൽകാം.
const TARGET_URL = "https://fastfollow.in"; 

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetDomain = new URL(TARGET_URL).hostname;
    const currentDomain = url.hostname;

    // ടാർഗെറ്റ് വെബ്സൈറ്റിലേക്കുള്ള പ്രോക്സി URL തയ്യാറാക്കുന്നു
    const proxyUrl = new URL(request.url);
    proxyUrl.hostname = targetDomain;
    proxyUrl.protocol = "https:";

    // ആവശ്യമായ ഹെഡറുകൾ ക്രമീകരിക്കുന്നു
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetDomain);
    newHeaders.set("Origin", TARGET_URL);
    newHeaders.set("Referer", TARGET_URL);
    newHeaders.delete("Accept-Encoding"); // ഡാറ്റ കംപ്രസ്സ് ചെയ്യാതിരിക്കാൻ
    
    // ഇംഗ്ലീഷ് ഭാഷ ആവശ്യപ്പെടുന്നു
    newHeaders.set("Accept-Language", "en-US,en;q=0.9");

    const modifiedRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: "manual", // റീഡയറക്റ്റ് ലൂപ്പ് ഒഴിവാക്കാൻ
    });

    const response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);

    // റീഡയറക്റ്റുകൾ കൈകാര്യം ചെയ്യുന്ന ഭാഗം
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

    // HTML പേജുകളിൽ മാത്രം മാറ്റങ്ങൾ വരുത്തുന്നു
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // 1. അടിസ്ഥാന മാറ്റങ്ങൾ
      html = html.replace(/OldBrandName/gi, "NewBrandName");
      html = html.replace(new RegExp(targetDomain, "gi"), currentDomain);
      html = html.replace(/lang="[^"]*"/gi, 'lang="en"');

      // 2. അനാവശ്യ ഭാഗങ്ങൾ ഒഴിവാക്കാനുള്ള CSS
      const customStyles = `
        <style>
          /* ഹെഡറും ഫുട്ടറും ഒഴിവാക്കാൻ */
          header, .navbar, .top-bar, .header, #header, nav,
          footer, .footer, #footer, .bottom-bar {
            display: none !important;
          }
          
          /* ബൈ ഫോളോവേഴ്സ് ബട്ടണും അനുബന്ധ ക്ലാസുകളും മറയ്ക്കാൻ */
          .btn-danger, a[href*="bayi"], a[href*="paket"], a[href*="buy"], .buy-followers {
            display: none !important;
          }

          body {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
          }
        </style>
      `;

      // 3. "Buy Followers", "Tools" എന്നിവ കൃത്യമായി നീക്കം ചെയ്യുന്നതിനുള്ള സ്ക്രിപ്റ്റ്
      const customScript = `
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            function removeElements() {
              // പേജിലെ എല്ലാ ലിങ്കുകളും ബട്ടണുകളും പരിശോധിക്കുന്നു
              document.querySelectorAll('a, button, div, span, p, h1, h2, h3, h4').forEach(function(el) {
                const text = el.innerText ? el.innerText.trim().toLowerCase() : "";
                
                // 1. "Tools" അല്ലെങ്കിൽ ടർക്കിഷ് വാക്കായ "Araçlar" ഒഴിവാക്കുന്നു
                if (text === "tools" || text === "araçlar" || text === "araclar" || text.startsWith("tools")) {
                  el.remove();
                }

                // 2. "Buy Followers" / "Takipçi Satın Al" ബട്ടൺ ഒഴിവാക്കുന്നു
                if (text.includes("buy followers") || text.includes("takipçi satın al") || text.includes("takipci satin al")) {
                  // ബട്ടൺ സ്ഥിതിചെയ്യുന്ന പ്രധാന കണ്ടെയ്നർ തന്നെ നീക്കം ചെയ്യുന്നു
                  const parent = el.closest('a') || el.closest('button') || el;
                  parent.remove();
                }
              });
            }

            // ആദ്യ തവണ റൺ ചെയ്യുന്നു
            removeElements();

            // എന്തെങ്കിലും ഡൈനാമിക് ആയി ലോഡ് ആയാലും അവ ഒഴിവാക്കാൻ ഒബ്സർവർ
            const observer = new MutationObserver(removeElements);
            observer.observe(document.body, { childList: true, subtree: true });
          });
        </script>
      `;

      // സ്റ്റൈലുകൾ </head> ടാഗിന് മുൻപിൽ ചേർക്കുന്നു
      html = html.replace("</head>", customStyles + "</head>");

      // സ്ക്രിപ്റ്റ് </body> ടാഗിന് മുൻപിൽ ചേർക്കുന്നു
      if (html.includes("</body>")) {
        html = html.replace("</body>", customScript + "</body>");
      } else {
        html += customScript;
      }

      // എററുകൾ ഒഴിവാക്കാൻ ഈ ഹെഡറുകൾ നീക്കം ചെയ്യുന്നു
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

    // HTML അല്ലാത്ത ഫയലുകൾ മാറ്റങ്ങളില്ലാതെ നൽകുന്നു
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
