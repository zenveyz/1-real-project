# Deployment preparation

The project has a Render Blueprint for a Node web service and PostgreSQL in Singapore. Real appointment submissions are disabled by default. Keep them disabled until the clinic has reviewed the English privacy notice, its legal identity, cross-border processing, and database-registration requirements.

## Before accepting real patient requests

- Confirm whether “Doctor Behruzbek stom” is the clinic's complete legal name and whether the published address and phone number are correct.
- Have a qualified local adviser review `privacy.html`, including retention and deletion wording, consent for any health-related personal data, cross-border processing, and database-registration duties.
- The app does not automatically expire requests. The owner can permanently delete each request from the dashboard. Confirm the hosting provider's backup behavior with the clinic before launch.
- In Render, set a unique owner password of at least 16 characters using a password manager. Never commit it to this folder or send it in chat.
- Only after review, set `PRIVACY_NOTICE_VERSION` to the approved version and `ACCEPT_REAL_APPOINTMENTS=true` in the Render service settings. The running server refuses to accept requests with a draft notice version.
- Use fake information during setup. Do not migrate `data/appointments.ndjson` to cloud hosting without a separate instruction and reviewed transfer plan.

## Render setup

1. Create a private GitHub repository for this project and push the files, excluding `data/` and `.env`.
2. In Render, create a Blueprint from that repository and select `render.yaml`.
3. Review the service and database charges before confirming. The current lowest always-on web service and small paid Postgres plan are roughly US$13 per month combined, before usage-based charges; confirm the live estimate in Render's dashboard.
4. Select Singapore for both resources. The Blueprint requests that region and connects the app to Postgres over its private network.
5. Enter `OWNER_PASSWORD` in the Render secret prompt. Do not use the local learning password `kosmic`.
6. The site can be previewed at its Render URL while online bookings are disabled. Complete the local review steps before enabling real submissions.

## References checked 18 October 2026

- Uzbekistan Law No. ZRU-1125 (26 March 2026), amending Article 27¹ of the Personal Data Law: https://lex.uz/ru/docs/8104580
- Cabinet of Ministers Resolution No. 415 (29 July 2026), adequate-protection countries, including Singapore: https://lex.uz/ru/docs/8369688
- Render regions and Blueprint reference: https://render.com/docs/regions and https://render.com/docs/blueprint-spec
- Render pricing: https://render.com/pricing
