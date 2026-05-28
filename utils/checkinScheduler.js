const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { performCheckinForUser } = require('./hoyolabCheckin');

const usersFilePath = path.join(__dirname, '..', 'data', 'checkin_users.json');
const stateFilePath = path.join(__dirname, '..', 'data', 'checkin_state.json');

// KST(한국 표준시) Date 객체 생성 헬퍼
function getKstDate() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

// 오늘 날짜 YYYY-MM-DD 문자열 획득
function getTodayKstString() {
    const kstNow = getKstDate();
    const year = kstNow.getFullYear();
    const month = String(kstNow.getMonth() + 1).padStart(2, '0');
    const date = String(kstNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
}

// 필요한 데이터 파일 초기화
function initializeFiles() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(usersFilePath)) {
        fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }, null, 4));
    }
    
    if (!fs.existsSync(stateFilePath)) {
        fs.writeFileSync(stateFilePath, JSON.stringify({ lastCheckinDate: "" }, null, 4));
    }
}

/**
 * 등록된 모든 유저를 대상으로 출석체크를 진행하고 DM을 발송합니다.
 * @param {import('discord.js').Client} client 
 */
async function runAllCheckins(client) {
    initializeFiles();
    
    let usersData = { users: [] };
    try {
        usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    } catch (e) {
        console.error('Failed to parse checkin users file:', e);
        return;
    }
    
    const todayStr = getTodayKstString();
    console.log(`[Hoyolab Auto Checkin] Starting check-ins for ${usersData.users.length} users on ${todayStr} KST...`);
    
    for (const user of usersData.users) {
        try {
            // 출석체크 수행
            const results = await performCheckinForUser(user.cookie);
            
            // 결과 임베드 빌드
            const embed = new EmbedBuilder()
                .setColor(0x00FFB4)
                .setTitle('📅 호요랩 자동 출석체크 결과 보고서')
                .setDescription(`안녕하세요! 호요랩 자동 출석체크 결과입니다.\n**실행 일자**: \`${todayStr} KST\``)
                .setTimestamp()
                .setFooter({ text: '호요랩 자동 출석체크 시스템' });
                
            let hasCookieExpiry = false;
            
            results.forEach(res => {
                const statusEmoji = res.success ? '✅' : '❌';
                embed.addFields({
                    name: res.game,
                    value: `${statusEmoji} ${res.status}`,
                    inline: true
                });
                
                if (res.code === -100) {
                    hasCookieExpiry = true;
                }
            });
            
            if (hasCookieExpiry) {
                embed.setColor(0xFF4B4B)
                    .addFields({
                        name: '⚠️ 로그인 쿠키 정보 만료 알림',
                        value: '호요랩 로그인 토큰이 더 이상 유효하지 않아 자동 출석체크에 실패했습니다.\n디스코드에서 `/출석등록` 명령어를 사용하여 쿠키를 다시 등록해 주세요.',
                        inline: false
                    });
            }
            
            // 유저 DM 발송
            try {
                const discordUser = await client.users.fetch(user.discordId);
                await discordUser.send({ embeds: [embed] });
                console.log(`[Hoyolab Auto Checkin] Successfully sent check-in DM to user ${user.discordId} (${discordUser.tag})`);
            } catch (dmError) {
                console.error(`[Hoyolab Auto Checkin] Failed to send check-in DM to user ${user.discordId}:`, dmError.message);
            }
            
        } catch (userError) {
            console.error(`[Hoyolab Auto Checkin] Critical error checking in user ${user.discordId}:`, userError);
        }
    }
}

/**
 * 백그라운드 스케줄러 가동
 * @param {import('discord.js').Client} client 
 */
function startCheckinScheduler(client) {
    initializeFiles();
    
    console.log('[Hoyolab Auto Checkin] Scheduler loaded.');
    
    // 10분 간격으로 체크
    setInterval(async () => {
        try {
            const kstNow = getKstDate();
            const hours = kstNow.getHours();
            const minutes = kstNow.getMinutes();
            
            // 새벽 1시 30분 이후인지 여부
            const isPastTargetTime = (hours > 1) || (hours === 1 && minutes >= 30);
            if (!isPastTargetTime) return;
            
            const todayStr = getTodayKstString();
            
            // 상태 로드
            let state = { lastCheckinDate: "" };
            try {
                state = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
            } catch (e) {
                console.error('Failed to parse checkin state file:', e);
            }
            
            // 이미 오늘 체크인을 진행한 경우 스킵
            if (state.lastCheckinDate === todayStr) {
                return;
            }
            
            // 즉시 상태 업데이트하여 중복 실행 방지
            state.lastCheckinDate = todayStr;
            fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 4));
            
            // 출석체크 일괄 실행
            await runAllCheckins(client);
            
        } catch (intervalError) {
            console.error('[Hoyolab Auto Checkin] Scheduler interval error:', intervalError);
        }
    }, 10 * 60 * 1000); // 10분 마다 반복
}

module.exports = {
    startCheckinScheduler,
    runAllCheckins
};
