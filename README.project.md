# POSIX demo
- copy any necessary file into your server

`scp -r [specify file or server] sooseokk@aptitude.cse.buffalo.edu:/data/web/CSE442/2025-Fall/cse-442j`
- connect to the altitude server

`ssh sooseokk@aptitude.cse.buffalo.edu`

# how to run PHP localhost server
php -S localhost:8080 -t .

# How to simulate the server locally
1. create /serve/dorm-mart folder in htdocs direcoty
2. navigate to your project located in htdocs
3. `npm install` to download env-cmd library
4. `npm run build-local` to create build folder for local server
5. upload build, migrations, api, and .env.local to /serve/dorm-mart
6. navigate to localhost/serve/dor-mart
7. you now should have the app running on your local apache server

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



