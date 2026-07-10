const fs = require('fs');
const { parse } = require('csv-parse/sync');

function readCustomers(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found at: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });
    
    // Normalize headers to handle 'Email Address', 'E-mail', 'Name', etc.
    return records.map(row => {
        const normalized = {};
        for (const key in row) {
            const cleanKey = key.toLowerCase().trim();
            const val = row[key] ? row[key].trim() : '';
            
            if (cleanKey.includes('email') || cleanKey === 'e-mail') {
                normalized['email'] = val;
            } else if (cleanKey.includes('name')) {
                normalized['name'] = val;
            } else {
                normalized[cleanKey] = val;
            }
        }
        return normalized;
    });
}

module.exports = { readCustomers };
