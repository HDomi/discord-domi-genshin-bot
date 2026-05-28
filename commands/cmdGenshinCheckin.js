const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { parseAndValidateCookieString, validateCookie, performCheckinForUser } = require('../utils/hoyolabCheckin');

const usersFilePath = path.join(__dirname, '..', 'data', 'checkin_users.json');

// 1. 출석등록 명령어 및 모달 핸들러 객체
const registerCommand = {
    data: new SlashCommandBuilder()
        .setName('출석등록')
        .setDescription('호요랩 자동 출석체크를 위해 쿠키를 등록합니다. (개인 정보 보호를 위해 답변은 비공개로 처리됩니다.)'),
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('hoyolab_register_modal')
            .setTitle('호요랩 출석 자동 등록');

        const cookieInput = new TextInputBuilder()
            .setCustomId('cookieInput')
            .setLabel("호요랩 쿠키 (Cookie)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("ltoken_v2=...; ltuid_v2=...; (전체 쿠키 값 복사 붙여넣기)")
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(cookieInput);
        modal.addComponents(firstActionRow);

        // 모달창 띄우기
        await interaction.showModal(modal);
    },

    async executeModal(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const rawCookie = interaction.fields.getTextInputValue('cookieInput');
        const sanitizedCookie = parseAndValidateCookieString(rawCookie);
        
        if (!sanitizedCookie) {
            return await interaction.editReply({
                content: '❌ 올바르지 않은 호요랩 쿠키 형식입니다. 필수 값인 `ltoken` (혹은 `ltoken_v2`) 및 `ltuid` (혹은 `ltuid_v2`) 값이 문자열 내에 포함되어 있어야 합니다.'
            });
        }
        
        await interaction.editReply({ content: '⏳ 호요랩 계정 로그인 상태 검증 중...' });
        
        const isValid = await validateCookie(sanitizedCookie);
        if (!isValid) {
            return await interaction.editReply({
                content: '❌ 호요랩 로그인 정보 검증에 실패했습니다. 만료된 쿠키이거나 잘못된 값일 수 있습니다. 호요랩 웹사이트(hoyolab.com)에서 다시 로그인 후 쿠키 값을 복사해 주세요.'
            });
        }
        
        // 데이터 폴더 존재 확인
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let usersData = { users: [] };
        if (fs.existsSync(usersFilePath)) {
            try {
                usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
            } catch (e) {
                console.error('Failed to parse checkin users file:', e);
            }
        }
        
        const discordId = interaction.user.id;
        const existingIndex = usersData.users.findIndex(u => u.discordId === discordId);
        const now = new Date().toISOString();
        
        if (existingIndex > -1) {
            usersData.users[existingIndex].cookie = sanitizedCookie;
            usersData.users[existingIndex].updatedAt = now;
        } else {
            usersData.users.push({
                discordId,
                cookie: sanitizedCookie,
                createdAt: now,
                updatedAt: now
            });
        }
        
        try {
            fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 4));
            await interaction.editReply({
                content: '✅ 호요랩 자동 출석체크가 성공적으로 등록되었습니다!\n매일 새벽 01시 30분 이후에 원신, 스타레일, ZZZ의 출석이 자동 진행되고 결과가 DM으로 전송됩니다.\n\n💡 바로 출석 상태를 테스트하려면 `/출석체크` 명령어를 실행해 보세요!'
            });
        } catch (error) {
            console.error('Failed to write checkin users file:', error);
            await interaction.editReply({
                content: '❌ 출석 정보 저장 중 디스크 오류가 발생했습니다.'
            });
        }
    }
};

// 2. 출석해제 명령어 객체
const unregisterCommand = {
    data: new SlashCommandBuilder()
        .setName('출석해제')
        .setDescription('등록된 호요랩 자동 출석체크를 중단하고 등록된 정보를 파기합니다.'),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        if (!fs.existsSync(usersFilePath)) {
            return await interaction.editReply({ content: '❌ 등록된 출석 정보가 존재하지 않습니다.' });
        }
        
        let usersData = { users: [] };
        try {
            usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        } catch (e) {
            return await interaction.editReply({ content: '❌ 데이터를 읽는 중 오류가 발생했습니다.' });
        }
        
        const discordId = interaction.user.id;
        const originalLength = usersData.users.length;
        usersData.users = usersData.users.filter(u => u.discordId !== discordId);
        
        if (usersData.users.length === originalLength) {
            return await interaction.editReply({ content: '❌ 등록된 출석 정보가 존재하지 않습니다.' });
        }
        
        try {
            fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 4));
            await interaction.editReply({ content: '✅ 호요랩 자동 출석체크 해제가 완료되었습니다. 등록하셨던 쿠키는 완전히 삭제되었습니다.' });
        } catch (error) {
            console.error('Failed to unregister checkin user:', error);
            await interaction.editReply({ content: '❌ 해제 처리 중 디스크 오류가 발생했습니다.' });
        }
    }
};

// 3. 즉시 출석체크 (수동) 명령어 객체
const checkinCommand = {
    data: new SlashCommandBuilder()
        .setName('출석체크')
        .setDescription('등록한 호요랩 쿠키를 사용해 지금 즉시 수동으로 출석체크를 가동해 봅니다.'),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        if (!fs.existsSync(usersFilePath)) {
            return await interaction.editReply({ content: '❌ 등록된 자동 출석 정보가 없습니다. `/출석등록` 명령어로 먼저 등록해 주세요.' });
        }
        
        let usersData = { users: [] };
        try {
            usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        } catch (e) {
            return await interaction.editReply({ content: '❌ 데이터를 읽는 중 오류가 발생했습니다.' });
        }
        
        const discordId = interaction.user.id;
        const userRecord = usersData.users.find(u => u.discordId === discordId);
        
        if (!userRecord) {
            return await interaction.editReply({ content: '❌ 등록된 자동 출석 정보가 없습니다. `/출석등록` 명령어로 먼저 등록해 주세요.' });
        }
        
        await interaction.editReply({ content: '⏳ 호요랩 출석체크 API 호출 중...' });
        
        try {
            const results = await performCheckinForUser(userRecord.cookie);
            
            const embed = new EmbedBuilder()
                .setColor(0x00FFB4)
                .setTitle('📅 호요랩 즉시 출석체크 결과')
                .setDescription(`요청하신 즉시 출석체크 결과입니다.\n**실행 일자**: \`${new Date().toLocaleDateString('ko-KR')} KST\``)
                .setTimestamp()
                .setFooter({ text: '호요랩 즉시 출석체크' });
                
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
                        value: '호요랩 로그인 토큰이 만료되어 자동 출석에 실패했습니다. `/출석등록` 명령어로 쿠키를 새로 갱신해 주시기 바랍니다.',
                        inline: false
                    });
            }
            
            await interaction.editReply({ content: null, embeds: [embed] });
            
        } catch (error) {
            console.error('Manual check-in execute error:', error);
            await interaction.editReply({ content: '❌ 출석체크를 가동하는 중 예기치 못한 오류가 발생했습니다.' });
        }
    }
};

module.exports = [
    registerCommand,
    unregisterCommand,
    checkinCommand
];
