# HMS frontend

The patient, doctor and hospital staff interface is a React application built
with Vite.

## Development and verification

From this directory:

```sh
npm run dev
npm test
npm run lint
npm run build
```

The Vite development server proxies `/api` requests to the backend configured
in `vite.config.js`.

## Hospital time zone

Set `VITE_HOSPITAL_TIME_ZONE` to the same IANA time-zone identifier configured
as `HOSPITAL_TIME_ZONE` by the backend. For example, use
`VITE_HOSPITAL_TIME_ZONE=America/New_York` in a local `.env.local` file.

If the frontend setting is missing or invalid, schedule times are displayed in
UTC and the application warns that the hospital time zone is not configured.
