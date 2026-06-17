Now let me create a comprehensive implementation plan as a visual document:Now I have a deep understanding of the design system. Let me build a comprehensive, professional implementation plan:Here's the complete picture. Let me walk you through the core thinking:

**The key architectural decision — UI isolation** is the foundation. Your project gets two separate Vite configs, two separate entry points, two separate dist folders. The website and mobile app share only one thing: the API/business logic layer in `/src/shared/`. You can redesign your website completely and the mobile app never knows it happened.

**The single most important performance rule** — one API call per dashboard load. Instead of calling `/attendance`, `/timetable`, `/notices`, `/stats` separately, your backend exposes `/api/mobile/faculty/dashboard` that returns everything bundled. Then React Query caches it for 5 minutes — navigating between tabs and back costs zero additional calls.

**For fast CRUD** — optimistic updates are the answer. When a faculty member marks attendance, the UI updates instantly and the API call happens in the background. If it fails, it rolls back silently. Users feel zero latency on the most common actions.

**The 5 phases in order:**
1. Set up folder structure + build pipeline so web and mobile are truly isolated
2. Auth with secure native storage + the API/state layer with React Query
3. Build the 3 dashboard UIs — mobile-first, bottom tab navigation, swipe gestures
4. Optimize: bundle APIs, virtual lists, code splitting, offline queuing
5. Native features: push notifications via FCM, camera, file system, then deploy

Click any button at the bottom to go deep on any specific phase with actual code. Which phase do you want to start implementing first?