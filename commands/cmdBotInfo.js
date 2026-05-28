const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('봇정보')
        .setDescription('봇의 실시간 정보 및 작동 상태를 확인합니다.'),
    async execute(interaction) {
        const client = interaction.client;

        // 업타임 포맷팅
        const totalSeconds = (client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = Math.floor(totalSeconds % 60);

        const uptimeParts = [];
        if (days > 0) uptimeParts.push(`${days}일`);
        if (hours > 0) uptimeParts.push(`${hours}시간`);
        if (minutes > 0) uptimeParts.push(`${minutes}분`);
        uptimeParts.push(`${seconds}초`);
        const uptime = uptimeParts.join(' ');

        // 메모리 사용량 (MB 단위)
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        // API 지연 시간
        const ping = client.ws.ping;

        // 서버 수 및 총 유저 수 계산
        const guildCount = client.guilds.cache.size;
        const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        // 봇 정보 임베드 생성
        const infoEmbed = new EmbedBuilder()
            .setColor(0x4F46E5) // Sleek Indigo 색상
            .setTitle('🤖 봇 상태 정보')
            .setDescription('현재 작동 중인 디스코드 봇의 실시간 사양 및 지표입니다.')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📡 지연 시간 (Ping)', value: `\`${ping}ms\``, inline: true },
                { name: '🕒 작동 시간 (Uptime)', value: `\`${uptime}\``, inline: true },
                { name: '📊 참여 중인 서버', value: `\`${guildCount}개\``, inline: true },
                { name: '👥 관리 중인 유저', value: `\`${memberCount.toLocaleString()}명\``, inline: true },
                { name: '💻 Node.js 버전', value: `\`${process.version}\``, inline: true },
                { name: '💾 메모리 사용량', value: `\`${memoryUsage} MB\``, inline: true }
            )
            .setFooter({ 
                text: `${client.user.tag} | 서비스 상태 정상`, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [infoEmbed] });
    },
};
