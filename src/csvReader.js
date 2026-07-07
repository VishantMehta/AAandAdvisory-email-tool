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
        trim: true
    });
    
    return records; // Array of { name: '...', email: '...' }
}

module.exports = { readCustomers };
