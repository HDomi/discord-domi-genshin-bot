const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'DiscordBot-DomiGenshin/1.0' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        console.log('Downloading loc.json...');
        const loc = await getJson('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json');
        
        console.log('Extracting ko translation map...');
        const ko = loc['ko'] || {};
        
        console.log(`Writing data/loc_ko.json (contains ${Object.keys(ko).length} entries)...`);
        fs.writeFileSync(path.join(DATA_DIR, 'loc_ko.json'), JSON.stringify(ko, null, 2));
        
        console.log('Successfully saved data/loc_ko.json!');
    } catch (e) {
        console.error('Failed to process loc_ko:', e);
    }
}

main();
