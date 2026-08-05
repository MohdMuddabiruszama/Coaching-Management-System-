const fs = require('fs');
const file = 'd:/Pre Production/Coaching-Management-System-/frontend/src/components/layout/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/"\/admin\/(.*?)"/g, '`/${rolePrefix}/$1`');
content = content.replace(/'\/admin\/(.*?)'/g, '`/${rolePrefix}/$1`');

if (!content.includes('const rolePrefix')) {
    content = content.replace('const isAdmin = user?.role', 'const rolePrefix = user?.role === "manager" ? "manager" : "admin";\n    const isAdmin = user?.role');
}

content = content.replace('<p>Admin Portal</p>', '<p>{user?.role === "manager" ? "Manager" : "Admin"} Portal</p>');
content = content.replace('`${user.institute_name} — Admin Portal`', '`${user.institute_name} — ${user?.role === "manager" ? "Manager" : "Admin"} Portal`');
content = content.replace(': "Admin Portal";', ': `${user?.role === "manager" ? "Manager" : "Admin"} Portal`;');

fs.writeFileSync(file, content);
console.log('AdminLayout.jsx updated successfully.');
