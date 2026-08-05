const fs = require('fs');
const file = 'd:/Pre Production/Coaching-Management-System-/frontend/src/components/layout/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix JSX syntax error: to=`/${rolePrefix}/xyz` -> to={`/${rolePrefix}/xyz`}
content = content.replace(/to=`\/\$\{rolePrefix\}\/(.*?)`/g, 'to={`/${rolePrefix}/$1`}');

fs.writeFileSync(file, content);
console.log('JSX fixed.');
