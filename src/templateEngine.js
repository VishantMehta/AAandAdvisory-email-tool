function renderTemplate(templateString, data) {
    let result = templateString;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

module.exports = { renderTemplate };
