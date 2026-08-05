const fs = require('fs');

const file = 'd:/Pre Production/Coaching-Management-System-/frontend/src/routes/WebAppRoutes.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add ManagerArea import
if (!content.includes('const ManagerArea = lazy(')) {
    content = content.replace(
        'import { useSubdomain }',
        'const ManagerArea = lazy(() => import("./MobileManagerRoutes").then(module => ({ default: module.ManagerArea || module.default })));\nimport { useSubdomain }'
    );
}

// 2. Replace the admin/manager route mapping using a regex
content = content.replace(
  /<Route\s+path="\/admin\/\*"\s+element=\{\s*<ProtectedRoute allowedRoles=\{\["admin", "manager"\]\}>\s*<AdminLayout \/>\s*<\/ProtectedRoute>\s*\}\s*>/m,
  `{["/admin/*", "/manager/*"].map(basePath => {
          if (basePath === "/manager/*" && isNativeEnv) {
              return <Route key={basePath} path={basePath} element={<ProtectedRoute allowedRoles={["manager"]}><ManagerArea /></ProtectedRoute>} />;
          }
          return (
          <Route
            key={basePath}
            path={basePath}
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >`
);

content = content.replace(
  /<Route path="\*" element=\{<Navigate to="\/admin\/dashboard" \/>\} \/>\s*<\/Route>\s*<Route\s+path="\/faculty\/\*"/m,
  `<Route path="*" element={<Navigate to="/admin/dashboard" />} />
        </Route>
        );
        })}

        <Route
          path="/faculty/*"`
);

fs.writeFileSync(file, content);
console.log('WebAppRoutes.jsx successfully updated.');
