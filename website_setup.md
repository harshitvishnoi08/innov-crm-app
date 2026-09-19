# Website form → CRM setup

Enquiries submitted on weinnovarch.com are forwarded by the site's `submit.php`
to this CRM at `POST /api/webhook/website`, alongside the existing email and
Google Sheet steps. Leads arrive with `platform = "Google Ads"` when the visitor
came from a Google ad (a `gclid` is present), otherwise `platform = "Website"`.

## 1. CRM (this app)

1. Generate a secret: `openssl rand -hex 32`
2. Set `WEBSITE_FORM_SECRET=<secret>` in `.env` locally and in Vercel → Settings
   → Environment Variables. Redeploy.

## 2. Website (cPanel)

The website repo already contains `js/attribution.js` (included on every page)
and the forwarding code in `submit.php`. Both read their config from
`crm-config.php`, which is **gitignored** and must be created once by hand:

1. cPanel → File Manager → `public_html/`
2. Create `crm-config.php` with:

   ```php
   <?php
   return [
     // CRM endpoint + the same secret set in the CRM's WEBSITE_FORM_SECRET
     'crm_url'    => 'https://<crm-domain>/api/webhook/website',
     'crm_secret' => '<secret>',

     // SMTP for the notification email (moved here from submit.php)
     'smtp_host'  => 'mail.weinnovarch.com',
     'smtp_port'  => 465,
     'smtp_user'  => 'contact@weinnovarch.com',
     'smtp_pass'  => '<email password>',
   ];
   ```

3. Set permissions to `640` so it isn't readable by other accounts.

Deploys from git (`.cpanel.yml`) never delete this file, so it only needs
creating once. If it is missing, `submit.php` still sends the email via PHP
`mail()` and the Google Sheet row, but skips the CRM push and logs a warning
to `error_log`.

## 3. How attribution works

- `js/attribution.js` runs on every page. If the URL carries `gclid` or any
  `utm_*` parameter it stores them (plus the landing URL and referrer) in a
  first-party cookie `innov_attr` for 90 days — Google's default click window.
  Later visits without params keep the existing cookie, so a visitor who lands
  from an ad, browses, and submits days later is still attributed.
- The form POST to `submit.php` carries that cookie; `submit.php` decodes it and
  sends the values to the CRM with the form fields.
- Google Ads auto-tagging (on by default) adds `gclid` to every ad click. For
  campaign/keyword names to appear in the CRM, add a tracking template in
  Google Ads → Campaign settings → "Final URL suffix":

  ```
  utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}
  ```

  (or use readable campaign names instead of `{campaignid}`).

## 4. Field mapping

| Website form | CRM lead        |
|--------------|-----------------|
| Name         | customerName    |
| Number       | contactNumber (normalised to +91) |
| Email        | email           |
| City         | city            |
| Requirement  | serviceRequired |
| Budget       | budgetRange     |
| LandArea     | propertySize    |
| message      | requirement     |
| utm_campaign | leadSource, campaignName, utmCampaign |
| utm_content  | adName, utmContent |
| gclid / utm_* / landing / referrer | gclid, utmSource, utmMedium, utmTerm, landingPage, referrer |

WhatsApp auto-template rules match against `website <utm_campaign>`, so a rule
with keyword `website` fires for every site lead.

## 5. Testing

```bash
curl -X POST https://<crm-domain>/api/webhook/website \
  -H "Content-Type: application/json" \
  -H "x-website-secret: <secret>" \
  -d '{"name":"Test Lead","phone":"9876543210","city":"Noida","requirement":"Home Interiors","gclid":"test123","utm_campaign":"trial"}'
```

Expect `{"success":true,"leadId":"..."}` and a lead with platform "Google Ads"
in /admin/leads. Without the header the response is 401. The same phone posted
again within 10 minutes returns the existing lead (`"deduped":true`).

End to end: open `https://weinnovarch.com/contact.html?gclid=test123&utm_campaign=trial`,
submit the form, and check the lead's "Website Attribution" block.
