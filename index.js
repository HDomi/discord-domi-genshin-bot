const { Client, Events, Collection, GatewayIntentBits, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();
const { startCheckinScheduler } = require('./utils/checkinScheduler');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const rest = new REST({ version: '10' }).setToken(token);

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
]});

client.once(Events.ClientReady, readyClient => {
    console.log(`${readyClient.user.tag} 실행완료`);
    startCheckinScheduler(readyClient);
});

// 명령어 로드 처리 부분
const commands = [];
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = require(filePath);
    
    // 배열로 export된 경우 (여러 명령어)
    if (Array.isArray(commandModule)) {
        for (const command of commandModule) {
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }
    } 
    // 단일 객체로 export된 경우 (기존 방식)
    else if (commandModule.data && commandModule.execute) {
        client.commands.set(commandModule.data.name, commandModule);
        commands.push(commandModule.data.toJSON());
    }
}

// 인터랙션 (슬래시 커맨드) 처리
client.on('interactionCreate', async interaction => {
    // 슬래시 커맨드 처리
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('명령어 실행 오류:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: '명령어 실행 중 오류가 발생했습니다!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '명령어 실행 중 오류가 발생했습니다!', ephemeral: true });
                }
            } catch (replyError) {
                console.error('오류 응답 전송 실패:', replyError);
            }
        }
        return;
    }

    // 모달 제출 처리 (호요랩 출석등록)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'hoyolab_register_modal') {
            const command = client.commands.get('출석등록');
            if (command && command.executeModal) {
                try {
                    await command.executeModal(interaction);
                } catch (error) {
                    console.error('모달 처리 오류:', error);
                    try {
                        if (interaction.deferred || interaction.replied) {
                            await interaction.followUp({ content: '모달 처리 중 오류가 발생했습니다!', ephemeral: true });
                        } else {
                            await interaction.reply({ content: '모달 처리 중 오류가 발생했습니다!', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('모달 오류 응답 실패:', replyError);
                    }
                }
            }
            return;
        }
    }

    // 버튼 인터랙션 처리 (원신 관련 봇)
    if (interaction.isButton()) {
        const customId = interaction.customId;
        
        try {
            if (customId.startsWith('genshin_char_')) {
                const command = client.commands.get('유저');
                if (command && command.executeButton) {
                    await command.executeButton(interaction);
                }
                return;
            }

            if (customId.startsWith('genshin_profile_')) {
                const command = client.commands.get('유저');
                if (command && command.executeBackButton) {
                    await command.executeBackButton(interaction);
                }
                return;
            }

            if (customId.startsWith('genshin_farming_back_')) {
                const command = client.commands.get('오늘의아이템');
                if (command && command.executeBackButton) {
                    await command.executeBackButton(interaction);
                }
                return;
            }

            if (customId.startsWith('genshin_farming_')) {
                const command = client.commands.get('오늘의아이템');
                if (command && command.executeButton) {
                    await command.executeButton(interaction);
                }
                return;
            }
        } catch (error) {
            console.error('버튼 인터랙션 실행 오류:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: '요청을 처리하는 중 오류가 발생했습니다!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '요청을 처리하는 중 오류가 발생했습니다!', ephemeral: true });
                }
            } catch (replyError) {
                console.error('버튼 오류 응답 전송 실패:', replyError);
            }
        }
    }
});

// 슬래시 명령어 배포/등록
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('명령어 등록 중 오류가 발생했습니다:', error);
    }
})();

client.login(token);