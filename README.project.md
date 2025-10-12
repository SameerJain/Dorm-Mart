# POSIX demo
copy any necessary file into your server\
`scp -r [specify file or server] sooseokk@aptitude.cse.buffalo.edu:/data/web/CSE442/2025-Fall/cse-442j`
connect to the aptitude server\
`ssh sooseokk@aptitude.cse.buffalo.edu`

# How to run React and php server locally
1. `npm run start-local`
2. `php -S localhost:8080 -t .`
- refer to "proxy" field in package.json

# How to build prod app
1. `npm run build-prod`
2. Upload build, migrations, api, and .env.production to the aptitude server
- Refer to scripts in package.json

# How to simulate the apache server locally
1. Rreate /serve/dorm-mart folder in htdocs directory
2. Navigate to your project located in htdocs (if you don't have your project in this directory, copy/paste them)
3. `npm install` to download any new libraries
4. `npm run build-local` to create build folder for local server
5. Upload the build/*, migrations, api, and .env.local, and any neccessary files and folders to /serve/dorm-mart 
(make a script to automate this)
(*Copy and paste out all of the contents of the build folder, they cant still be inside the build folder)
6. Navigate to localhost/serve/dorm-mart from your browser
7. You now should have the app running on your local apache server
8. Make sure to migrate to apply db schema to your local mysql

# How does the server serve the app?
1. `"homepage": "/CSE442/2025-Fall/cse-442j",`
The "homepage" field in your package.json tells the React build tools (like react-scripts) what the base URL of your app will be.
    - It makes sure all asset paths (like CSS, JS, images) inside the build are prefixed with /CSE442/2025-Fall/cse-442j/, so they load correctly when hosted under that subpath instead of at the root.
    - The key piece is that homepage only affects asset paths, not route handling.

2. Apache just serves whatever’s in that folder — the index.html, JavaScript, CSS, etc.
    - When you go to https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login, Apache returns the same index.html file, because that’s what’s physically there.

3. The React app (client-side router) kicks in after the browser loads the index.html.
    - Since your URL has a hash (#/login), the browser doesn’t ask the server for a separate /login resource. Everything after # is handled purely on the client side, meaning all components are loaded entirely within the index.html at once.
    - The React Router reads that hash fragment (#/login) and renders the right component (your Login page). This is how SPA works.



