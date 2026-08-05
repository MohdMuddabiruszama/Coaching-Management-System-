const fs = require('fs');
const file = 'd:/Pre Production/Coaching-Management-System-/frontend/src/routes/WebAppRoutes.jsx';
let content = fs.readFileSync(file, 'utf8');

// Insert ManagerArea import back
if (!content.includes('const ManagerArea = lazy(')) {
    content = content.replace(
        'import { useSubdomain } from "../hooks/useSubdomain";',
        'const ManagerArea = lazy(() => import("./MobileManagerRoutes").then(module => ({ default: module.ManagerArea })));\nimport { useSubdomain } from "../hooks/useSubdomain";'
    );
}

// Update the route mapping
const oldMapping = `{["/admin/*", "/manager/*"].map(basePath => (
          <Route
            key={basePath}
            path={basePath}`;

const newMapping = `{["/admin/*", "/manager/*"].map(basePath => {
          if (basePath === "/manager/*" && isNativeEnv) {
              return <Route key={basePath} path={basePath} element={<ManagerArea />} />;
          }
          return (
          <Route
            key={basePath}
            path={basePath}`;

content = content.replace(oldMapping, newMapping);

// Replace the closing tag mapping (it was `</Route>\n        ))}`)
const oldClosing = `</Route>\n        ))}`;
const newClosing = `</Route>\n          );\n        })}`;
content = content.replace(oldClosing, newClosing);

fs.writeFileSync(file, content);
console.log('WebAppRoutes.jsx updated to conditionally render native ManagerArea.');
