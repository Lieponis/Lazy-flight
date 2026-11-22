# Agent 5l brief: edge-to-edge on the installed iPhone app (copy what Pocket Pilots does)

Lead, 2026-11-22. Build on CURRENT main. One step at a time with Andy (Step N of M, DO max 3 actions, LOOK FOR, REPLY WITH). Lean: save Andy's usage.

## New fact (changes the earlier conclusion)
Pocket Pilots (https://pilots.nimblebit.com/, NimbleBit) is a WEB game, installed by Andy from Safari exactly like Lazy Flight, and on HIS iPhone it fills the whole screen, top and bottom. Its head uses the same tags we tried in 224d654:
- apple-mobile-web-app-capable yes, apple-mobile-web-app-status-bar-style black-translucent
- viewport: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover
- manifest (/manifest.webmanifest): display standalone, background_color and theme_color #0d1626, one 180x180 icon, no orientation, start_url "/"
So "impossible, iOS bug" is NOT the full story. Something in how our page or install differs.

## Suspects, in order (test each, report which one is the cause)
1. Install-time effect (WebKit bug 316008): the status-bar style is read when the app is ADDED to the Home Screen; changing the tag later does nothing until reinstall. Check whether the "62 pt strip" test on Andy's phone was made on an app installed BEFORE the black-translucent build. Andy must remove and re-add the app for each style test (his save is exported first: SAVE FILE).
2. Manifest differences: our manifest vs theirs (display, scope/id, background_color, orientation, theme_color). Try theirs: standalone, dark background_color, no orientation, start_url "/".
3. Page background: html/body background and theme-color. Theirs is a dark navy #0d1626 everywhere, so any unpainted strip looks the same as the game. Compare with ours (black strips can be our own html background showing).
4. Canvas/#app sizing: try plain position:fixed; inset:0 on html, body, #app and canvas with height from window.innerHeight (not 100vh), re-measure on resize/orientationchange/visibilitychange.
5. Our offline helper (service worker) or the title/loading screen using a different height rule.

## DO
- Use the existing fill test (public/ios-fill-test.html): add method E "copy Pocket Pilots" (their exact tags + manifest) and a dark navy page background, so Andy installs one test app and screenshots it.
- If you can fetch pilots.nimblebit.com source (page CSS/JS), read how it sizes the canvas and copy the approach; if you cannot reach it, say so.
- When one method fills the screen on Andy's phone, apply it to the game, keep tests green, push to main, tell Andy the exact reinstall steps (export SAVE FILE first, remove app, add again, import).

## REPLY WITH (max 10 lines)
Cause (which suspect), what changed, live link, what Andy must do. Do not write "impossible" unless the test app with Pocket Pilots' exact tags ALSO shows black bars on his phone.

## Rules
No new features. Suggestions labelled "suggestion". Never touch or reset save data.
