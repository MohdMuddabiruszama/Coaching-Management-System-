const fs = require('fs');

// Fix AdminLayout.jsx
const layoutFile = 'd:/Pre Production/Coaching-Management-System-/frontend/src/components/layout/AdminLayout.jsx';
let layoutContent = fs.readFileSync(layoutFile, 'utf8');

layoutContent = layoutContent.replace(/api\.get\(\`\/\$\{rolePrefix\}\/stats\`\)/g, 'api.get("/admin/stats")');
layoutContent = layoutContent.replace(/api\.get\(\`\/\$\{rolePrefix\}\/usage\`\)/g, 'api.get("/admin/usage")');

fs.writeFileSync(layoutFile, layoutContent);
console.log('AdminLayout.jsx fixed.');

// Fix AdminNotes.jsx
const notesFile = 'd:/Pre Production/Coaching-Management-System-/frontend/src/pages/admin/AdminNotes.jsx';
let notesContent = fs.readFileSync(notesFile, 'utf8');

const oldPromiseAll = `const [notesRes, clsRes, subRes, facRes] = await Promise.all([
                api.get("/notes"),
                api.get("/classes"),
                api.get("/subjects"),
                api.get("/faculty")
            ]);`;

const newPromiseAll = `const [notesRes, clsRes, subRes, facRes] = await Promise.all([
                api.get("/notes").catch(err => ({ data: { success: false, data: [] } })),
                api.get("/classes").catch(err => ({ data: { success: false, data: [] } })),
                api.get("/subjects").catch(err => ({ data: { success: false, data: [] } })),
                api.get("/faculty").catch(err => ({ data: { success: false, data: [] } }))
            ]);`;

if (notesContent.includes(oldPromiseAll)) {
    notesContent = notesContent.replace(oldPromiseAll, newPromiseAll);
    fs.writeFileSync(notesFile, notesContent);
    console.log('AdminNotes.jsx fixed.');
} else {
    console.log('Could not find Promise.all in AdminNotes.jsx');
}
