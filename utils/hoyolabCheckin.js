const GAMES = [
    {
        id: 'genshin',
        name: '원신',
        actId: 'e202102251931481',
        url: 'https://sg-hk4e-api.hoyolab.com/event/sol/sign',
        referer: 'https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481'
    },
    {
        id: 'hkrpg',
        name: '붕괴: 스타레일',
        actId: 'e202303301540311',
        url: 'https://sg-public-api.hoyolab.com/event/luna/os/sign',
        referer: 'https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311'
    },
    {
        id: 'nap',
        name: '젠레스 존 제로',
        actId: 'e202406031448091',
        url: 'https://sg-public-api.hoyolab.com/event/luna/zzz/os/sign',
        referer: 'https://act.hoyolab.com/bbs/event/signin/zzz/index.html?act_id=e202406031448091'
    }
];

/**
 * 사용자 입력 쿠키 파싱 및 필수 키 검증
 * @param {string} cookieStr 
 * @returns {string|null}
 */
function parseAndValidateCookieString(cookieStr) {
    if (!cookieStr) return null;
    const trimmed = cookieStr.trim();
    
    // 필수 토큰인 ltoken 또는 ltoken_v2, ltuid 또는 ltuid_v2 존재 여부 확인
    const hasLtoken = trimmed.includes('ltoken') || trimmed.includes('ltoken_v2');
    const hasLtuid = trimmed.includes('ltuid') || trimmed.includes('ltuid_v2') || trimmed.includes('ltmid_v2');
    
    if (!hasLtoken || !hasLtuid) {
        return null;
    }
    return trimmed;
}

/**
 * 호요랩 API를 활용한 쿠키 유효성 검사 (원신 info API 기준)
 * @param {string} cookie 
 * @returns {Promise<boolean>}
 */
async function validateCookie(cookie) {
    try {
        const response = await fetch('https://sg-hk4e-api.hoyolab.com/event/sol/info?act_id=e202102251931481', {
            method: 'GET',
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481',
                'Origin': 'https://act.hoyolab.com'
            }
        });
        
        if (!response.ok) return false;
        
        const resJson = await response.json();
        // retcode -100 은 로그인 정보 만료 또는 유효하지 않음을 뜻함
        return resJson.retcode !== -100;
    } catch (error) {
        console.error('Cookie validation request failed:', error);
        return false;
    }
}

/**
 * 단일 유저에 대해 원신, 스타레일, ZZZ 일괄 출석체크 수행
 * @param {string} cookie 
 * @returns {Promise<Array<{game: string, success: boolean, status: string, code: number}>>}
 */
async function performCheckinForUser(cookie) {
    const results = [];
    
    for (const game of GAMES) {
        try {
            const response = await fetch(game.url, {
                method: 'POST',
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': game.referer,
                    'Origin': 'https://act.hoyolab.com',
                    'Content-Type': 'application/json;charset=UTF-8'
                },
                body: JSON.stringify({ act_id: game.actId })
            });

            if (!response.ok) {
                results.push({
                    game: game.name,
                    success: false,
                    status: `HTTP 오류 (${response.status})`,
                    code: response.status
                });
                continue;
            }

            const resJson = await response.json();
            const retcode = resJson.retcode;
            const message = resJson.message || '';

            if (retcode === 0) {
                results.push({
                    game: game.name,
                    success: true,
                    status: '출석 성공 (보상 획득)',
                    code: 0
                });
            } else if (retcode === -5003) {
                results.push({
                    game: game.name,
                    success: true,
                    status: '이미 출석 완료',
                    code: -5003
                });
            } else if (retcode === -100) {
                results.push({
                    game: game.name,
                    success: false,
                    status: '로그인 만료 (쿠키 재등록 필요)',
                    code: -100
                });
            } else if (retcode === -10002 || message.includes('character') || message.includes('role') || message.includes('game account')) {
                results.push({
                    game: game.name,
                    success: true, // 캐릭터가 없는 것은 유저가 플레이를 안 하는 게임이므로 성공/건너뜀으로 간주
                    status: '건너뜀 (플레이 캐릭터 없음)',
                    code: -10002
                });
            } else {
                results.push({
                    game: game.name,
                    success: false,
                    status: `실패 (${message})`,
                    code: retcode
                });
            }
        } catch (error) {
            results.push({
                game: game.name,
                success: false,
                status: `오류 (${error.message})`,
                code: -999
            });
        }
    }
    
    return results;
}

module.exports = {
    parseAndValidateCookieString,
    validateCookie,
    performCheckinForUser
};
