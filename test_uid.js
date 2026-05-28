const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
    console.log(`FETCHING: ${url}`);
    https.get(url, {
        headers: {
            'User-Agent': 'DiscordBot-DomiGenshin/1.0'
        }
    }, res => {
        let data = '';
        console.log(`STATUS: ${res.statusCode}`);
        
        res.on('data', chunk => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const target = res.headers.location.startsWith('http') ? res.headers.location : 'https://enka.network' + res.headers.location;
                fetchUrl(target);
            } else {
                fs.writeFileSync('uid_response.json', data);
                console.log('SAVED TO uid_response.json');
            }
        });
    }).on('error', error => {
        console.error('ERROR:', error);
    });
}

fetchUrl('https://enka.network/api/uid/868767210');
