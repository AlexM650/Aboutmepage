# Aboutmepage

## Run the project

This project is a static multi-page portfolio served by an Express server. The
server also provides the contact form API and persists submissions locally (or
to Replit Object Storage when running in a configured Replit environment).

```bash
npm install
npm run dev -- --port 5000
```

The Replit preview uses the `Start application` workflow, which runs the same
command on port 5000.

## Main pages

- `/` — home and contact form
- `/media.html` — media gallery
- `/future.html` — future goals
- `/pets.html` — pets
- `/hobbies.html` — hobbies
- `/admin.html` — contact submission dashboard