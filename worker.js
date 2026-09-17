const TARGET_URL = "https://fastfollow.in"; // ഒറിജിനൽ സൈറ്റ്

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetDomain = new URL(TARGET_URL).hostname;
    const currentDomain = url.hostname; // നിങ്ങളുടെ ഇപ്പോഴത്തെ പുതിയ ഡൊമെയ്ൻ ഓട്ടോമാറ്റിക് ആയി എടുക്കും

    // ടാർഗെറ്റ് സൈറ്റിലേക്കുള്ള പുതിയ URL ഉണ്ടാക്കുന്നു
    const proxyUrl = new URL(request.url);
    proxyUrl.hostname = targetDomain;
    proxyUrl.protocol = "https:";

    // ഹെഡറുകൾ സെറ്റ് ചെയ്യുന്നു
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetDomain);
    newHeaders.set("Origin", TARGET_URL);
    newHeaders.set("Referer", TARGET_URL);
    newHeaders.delete("Accept-Encoding"); // കംപ്രഷൻ ഒഴിവാക്കാൻ

    const modifiedRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      // 'follow' മാറ്റി 'manual' ആക്കി. ഇത് റീഡയറക്റ്റ് ലൂപ്പ് ഒഴിവാക്കും!
      redirect: "manual", 
    });

    const response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);

    // --- റീഡയറക്റ്റ് പ്രശ്നം പരിഹരിക്കുന്ന ഭാഗം ---
    // സൈറ്റ് എങ്ങോട്ടെങ്കിലും റീഡയറക്റ്റ് ചെയ്താൽ അത് നമ്മുടെ പുതിയ ഡൊമെയ്‌നിലേക്ക് തന്നെ മാറ്റുന്നു
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

    // HTML ആണെങ്കിൽ മാത്രം എഡിറ്റ് ചെയ്യുക
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // 1. ബ്രാൻഡിംഗ് മാറ്റുന്നു (tesseract.local ന് പകരം currentDomain ഉപയോഗിക്കുന്നു)
      html = html.replace(/FastFollow/gi, "Tesseract");
      html = html.replace(/Fast Follow/gi, "Tesseract");
      html = html.replace(new RegExp(targetDomain, "gi"), currentDomain);

      // 2. തുർക്കിഷ് വാക്കുകൾ ഇംഗ്ലീഷിലേക്ക് മാറ്റുന്നു
      html = html.replace(/GİRİŞ/g, "LOGIN");
      html = html.replace(/Giriş Yap/gi, "Sign In");
      html = html.replace(/NASIL ÇALIŞIR/gi, "HOW IT WORKS");
      html = html.replace(/takipçi/gi, "followers");
      html = html.replace(/beğeni/gi, "likes");
      html = html.replace(/Araçlar/gi, "Tools");
      html = html.replace(/Paketler/gi, "Packages");

      // 3. ലിക്വിഡ് ഗ്ലാസ് (Glassmorphism) CSS & ഫൂട്ടർ റിമൂവൽ
      const customStyles = `
        <style>
          .navbar-brand img, .brand img, header svg { display: none !important; }
          .navbar-brand, a.brand, .logo {
            font-size: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
          }
          .navbar-brand::after, a.brand::after, .logo::after {
            content: "TESSERACT" !important;
            font-size: 22px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            letter-spacing: 1.5px !important;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5) !important;
          }
          body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%) !important;
            color: #f8fafc !important;
            min-height: 100vh !important;
          }
          header, .navbar, nav {
            background: rgba(255, 255, 255, 0.05) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          }
          .card, .box, .container > div, form {
            background: rgba(255, 255, 255, 0.07) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-radius: 16px !important;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
          }
          .btn, button, input[type="submit"], a.btn {
            background: rgba(255, 255, 255, 0.12) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            border: 1px solid rgba(255, 255, 255, 0.25) !important;
            border-radius: 10px !important;
            color: #ffffff !important;
            font-weight: 600 !important;
            transition: all 0.3s ease !important;
          }
          .btn:hover, button:hover {
            background: rgba(255, 255, 255, 0.25) !important;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.2) !important;
          }
          footer, .footer, [class*="footer"] {
            display: none !important;
          }
          .security-alert-box {
            background: rgba(220, 38, 38, 0.15) !important;
            border: 1px solid rgba(239, 68, 68, 0.5) !important;
            border-radius: 12px !important;
            padding: 14px 16px !important;
            margin: 16px auto !important;
            max-width: 90% !important;
            color: #fca5a5 !important;
            font-size: 13px !important;
            line-height: 1.5 !important;
            text-align: center !important;
            backdrop-filter: blur(8px) !important;
            box-shadow: 0 4px 15px rgba(220, 38, 38, 0.2) !important;
          }
          .security-alert-box strong {
            color: #ef4444 !important;
            display: block !important;
            font-size: 14px !important;
            margin-bottom: 4px !important;
            text-transform: uppercase !important;
          }
        </style>
      `;

      // 4. വാണിംഗ് ബോക്സ്
      const warningHtml = `
        <div class="security-alert-box">
          <strong>⚠️ സുരക്ഷാ മുന്നറിയിപ്പ് / SECURITY WARNING</strong>
          ഇവിടെ ലോഗിൻ ചെയ്യാൻ നിർബന്ധമായും ഒരു ഡമ്മി/ഫേക്ക് അക്കൗണ്ട് മാത്രം ഉപയോഗിക്കുക. യാതൊരു കാരണവശാലും നിങ്ങളുടെ ഒറിജിനൽ ഇൻസ്റ്റാഗ്രാം പാസ്‌വേഡ് ഇവിടെ നൽകരുത്. ഒറിജിനൽ അക്കൗണ്ട് നൽകിയാൽ സുരക്ഷാ ഭീഷണിയും ഹാക്കിംഗ് സാധ്യതയും ഉണ്ടായേക്കാം.
        </div>
      `;

      html = html.replace("</head>", customStyles + "</head>");

      if (html.includes("</form>")) {
        html = html.replace("</form>", "</form>" + warningHtml);
      } else {
        html = html.replace("</body>", warningHtml + "</body>");
      }

      // എററുകൾ വരാതിരിക്കാൻ ഈ ഹെഡറുകൾ കളയണം
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      responseHeaders.delete("content-security-policy"); // ഡിസൈൻ ബ്ലോക്ക് ആവാതിരിക്കാൻ
      responseHeaders.delete("x-frame-options");

      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    // HTML അല്ലാത്തവ (CSS, JS, Images) നേരിട്ട് കൈമാറുന്നു
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
  },
};
