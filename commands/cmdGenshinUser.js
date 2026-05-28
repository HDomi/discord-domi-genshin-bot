const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const genshindb = require('genshin-db');

// 로컬 캐릭터 데이터 로드
const charactersDataPath = path.join(__dirname, '..', 'data', 'characters.json');
let charactersData = {};
if (fs.existsSync(charactersDataPath)) {
    charactersData = require(charactersDataPath);
}

// 무기 및 성유물 캐시 생성 (Genshin-DB 기반)
const weaponsCache = {};
const artifactsCache = {};

try {
    const weaponNames = genshindb.weapons('names', { matchCategories: true });
    for (const name of weaponNames) {
        const weapon = genshindb.weapons(name);
        if (weapon && weapon.id) {
            const koWeapon = genshindb.weapons(name, { resultLanguage: 'Korean' });
            if (koWeapon) weaponsCache[weapon.id] = koWeapon.name;
        }
    }
} catch (e) {
    console.error('Error building weapons cache:', e);
}

try {
    const artifactNames = genshindb.artifacts('names', { matchCategories: true });
    for (const name of artifactNames) {
        const artifact = genshindb.artifacts(name);
        if (artifact && artifact.id) {
            const koArtifact = genshindb.artifacts(name, { resultLanguage: 'Korean' });
            if (koArtifact) artifactsCache[artifact.id] = koArtifact.name;
        }
    }
} catch (e) {
    console.error('Error building artifacts cache:', e);
}

// 원신 속성별 색상 설정
const elementColors = {
    'Fire': 0xFF4B4B,    // 불
    'Water': 0x4BA6FF,   // 물
    'Wind': 0x4BFFC9,    // 바람
    'Electric': 0xD14BFF, // 번개
    'Grass': 0x56FF4B,   // 풀
    'Ice': 0x4BFFFF,     // 얼음
    'Rock': 0xFFD84B     // 바위
};

// 원신 스탯 아이디 번역 매핑
const statNames = {
    'FIGHT_PROP_HP': '체력',
    'FIGHT_PROP_HP_PERCENT': '체력 %',
    'FIGHT_PROP_ATTACK': '공격력',
    'FIGHT_PROP_ATTACK_PERCENT': '공격력 %',
    'FIGHT_PROP_DEFENSE': '방어력',
    'FIGHT_PROP_DEFENSE_PERCENT': '방어력 %',
    'FIGHT_PROP_ELEMENT_MASTERY': '원소 마스터리',
    'FIGHT_PROP_CHARGE_EFFICIENCY': '원소 충전 효율',
    'FIGHT_PROP_CRITICAL': '치명타 확률',
    'FIGHT_PROP_CRITICAL_HURT': '치명타 피해',
    'FIGHT_PROP_HEAL_ADD': '치료 효과 보너스',
    'FIGHT_PROP_FIRE_ADD_HURT': '불 원소 피해 보너스',
    'FIGHT_PROP_ELEC_ADD_HURT': '번개 원소 피해 보너스',
    'FIGHT_PROP_WATER_ADD_HURT': '물 원소 피해 보너스',
    'FIGHT_PROP_WIND_ADD_HURT': '바람 원소 피해 보너스',
    'FIGHT_PROP_ROCK_ADD_HURT': '바위 원소 피해 보너스',
    'FIGHT_PROP_GRASS_ADD_HURT': '풀 원소 피해 보너스',
    'FIGHT_PROP_ICE_ADD_HURT': '얼음 원소 피해 보너스',
    'FIGHT_PROP_PHYSICAL_ADD_HURT': '물리 피해 보너스'
};

// Enka API 연동 헬퍼 함수
async function fetchEnkaData(uid) {
    const url = `https://enka.network/api/uid/${uid}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'DiscordBot-DomiGenshin/1.0'
        }
    });
    if (!response.ok) {
        throw new Error(`Enka API error status: ${response.status}`);
    }
    return await response.json();
}

// 메인 유저 프로필 임베드 및 버튼 생성
function createProfileResponse(data, uid) {
    const playerInfo = data.playerInfo;
    const nickname = playerInfo.nickname || '알 수 없음';
    const arLevel = playerInfo.level || 0;
    const worldLevel = playerInfo.worldLevel || 0;
    const achievements = playerInfo.finishAchievementNum || 0;
    const signature = playerInfo.signature || '상태 메시지가 없습니다.';

    const floor = playerInfo.towerFloorIndex || 0;
    const chamber = playerInfo.towerLevelIndex || 0;
    const abyssInfo = floor > 0 ? `${floor}층 ${chamber}번방` : '기록 없음';

    const embed = new EmbedBuilder()
        .setColor(0x00FFC4)
        .setTitle(`🌟 ${nickname} 님의 원신 프로필`)
        .setDescription(`\`${uid}\` 번호의 Genshin Impact 게임 계정 실시간 정보입니다.`)
        .addFields(
            { name: '👤 닉네임', value: `\`${nickname}\``, inline: true },
            { name: '🆔 UID', value: `\`${uid}\``, inline: true },
            { name: '🏆 모험 등급 (AR)', value: `\`Lv. ${arLevel}\``, inline: true },
            { name: '🌍 월드 레벨', value: `\`Lv. ${worldLevel}\``, inline: true },
            { name: '🏅 달성 업적 수', value: `\`${achievements}개\``, inline: true },
            { name: '⚔️ 나선비경 진행도', value: `\`${abyssInfo}\``, inline: true },
            { name: '✍️ 상태 메시지', value: `\`\`\`${signature}\`\`\``, inline: false }
        )
        .addFields({
            name: '🔗 상세 전적 보기',
            value: `[Enka.Network 프로필 바로가기](https://enka.network/u/${uid})`,
            inline: false
        })
        .setFooter({ text: 'Data provided by Enka.Network', iconURL: 'https://enka.network/favicon.ico' })
        .setTimestamp();

    // 캐릭터 진열장 버튼 빌드
    const rows = [];
    const showcaseList = playerInfo.showAvatarInfoList || [];

    if (showcaseList.length > 0) {
        let currentRow = new ActionRowBuilder();
        showcaseList.forEach((char, index) => {
            const charId = char.avatarId;
            const charMeta = charactersData[charId] || {};
            const charName = charMeta.name || `캐릭터_${charId}`;

            // 줄 바꿈 처리 (한 줄에 최대 5개 버튼)
            if (index > 0 && index % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`genshin_char_${uid}_${charId}`)
                    .setLabel(charName)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        rows.push(currentRow);
    }

    return { embeds: [embed], components: rows };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('유저')
        .setDescription('원신 유저의 UID를 입력받아 전적 및 프로필 정보를 조회합니다.')
        .addStringOption(option => 
            option.setName('uid')
                .setDescription('조회할 원신 UID (9자리 숫자)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const uid = interaction.options.getString('uid').trim();

        if (!/^\d{9}$/.test(uid)) {
            return await interaction.reply({ 
                content: '❌ 올바르지 않은 형식의 UID입니다. 9자리 숫자를 입력해 주세요.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        try {
            const data = await fetchEnkaData(uid);
            if (!data.playerInfo) {
                return await interaction.editReply({
                    content: `❌ 유저 정보를 불러오는 데 실패했습니다. (UID: ${uid})`
                });
            }

            const response = createProfileResponse(data, uid);
            await interaction.editReply(response);

        } catch (error) {
            console.error('원신 유저 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 존재하지 않는 UID이거나 외부 API 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
            });
        }
    },

    // 버튼 인터랙션 핸들러 (캐릭터 상세 조회)
    async executeButton(interaction) {
        const [, , uid, avatarId] = interaction.customId.split('_');

        try {
            const data = await fetchEnkaData(uid);
            const avatarList = data.avatarInfoList || [];
            const charData = avatarList.find(c => c.avatarId == avatarId);

            if (!charData) {
                return await interaction.reply({
                    content: '❌ 이 캐릭터의 상세 정보(성유물/무기 등)가 진열장에 공개되어 있지 않습니다.',
                    ephemeral: true
                });
            }

            const charMeta = charactersData[avatarId] || {};
            const charName = charMeta.name || `캐릭터_${avatarId}`;
            const element = charMeta.element || 'Wind';
            const sideIcon = charMeta.sideIcon || 'UI_AvatarIcon_Side_PlayerBoy';

            // 레벨 및 운명의 자리(돌파)
            const charLevel = charData.propMap?.['4001']?.val || '0';
            const constCount = charData.talentIdList ? charData.talentIdList.length : 0;

            // 특성 레벨 구하기
            const skillLevelMap = charData.skillLevelMap || {};
            const skillLevels = [];
            if (charMeta.weaponType) { // 캐릭터에 지정된 스킬오더가 있다면
                const metaFull = genshindb.characters(charName);
                const skillOrder = metaFull?.skillOrder || [];
                if (skillOrder.length > 0) {
                    skillOrder.forEach(skillId => {
                        const level = skillLevelMap[skillId] || 1;
                        skillLevels.push(level);
                    });
                }
            }
            const talentText = skillLevels.length > 0 ? skillLevels.join(' / ') : '정보 없음';

            // 무기 가공
            const equipList = charData.equipList || [];
            const weaponItem = equipList.find(equip => equip.weapon);
            let weaponText = '장착된 무기 없음';
            if (weaponItem) {
                const weaponId = weaponItem.itemId;
                const weaponName = weaponsCache[weaponId] || weaponItem.flat?.nameTextMapHash || '알 수 없는 무기';
                const weaponLevel = weaponItem.weapon.level;
                const weaponAffix = (weaponItem.weapon.affixMap ? Object.values(weaponItem.weapon.affixMap)[0] : 0) + 1;
                const weaponStars = '⭐'.repeat(weaponItem.flat?.rankLevel || 0);
                weaponText = `${weaponStars} **${weaponName}** (Lv. ${weaponLevel}, 재련 ${weaponAffix})`;
            }

            // 성유물 가공
            const relics = equipList.filter(equip => equip.reliquary);
            const setCounts = {};
            relics.forEach(relic => {
                const setName = artifactsCache[relic.flat?.setId] || relic.flat?.setNameTextMapHash || '알 수 없는 성유물';
                setCounts[setName] = (setCounts[setName] || 0) + 1;
            });

            const setBonusParts = [];
            for (const [setName, count] of Object.entries(setCounts)) {
                if (count >= 4) setBonusParts.push(`**${setName} 4세트**`);
                else if (count >= 2) setBonusParts.push(`**${setName} 2세트**`);
            }
            const setBonusText = setBonusParts.length > 0 ? setBonusParts.join(' + ') : '세트 효과 없음';

            // 상세 스탯 정보 파싱
            const fightPropMap = charData.fightPropMap || {};
            const maxHp = Math.round(fightPropMap[2000] || 0);
            const maxAtk = Math.round(fightPropMap[2001] || 0);
            const maxDef = Math.round(fightPropMap[2002] || 0);
            const em = Math.round(fightPropMap[28] || 0);
            const critRate = fightPropMap[20] ? `${(fightPropMap[20] * 100).toFixed(1)}%` : '5.0%';
            const critDmg = fightPropMap[22] ? `${(fightPropMap[22] * 100).toFixed(1)}%` : '50.0%';
            const er = fightPropMap[23] ? `${(fightPropMap[23] * 100).toFixed(1)}%` : '100.0%';

            // 원소 피해 증가 계산
            const dmgBonuses = {
                '불 원소 피해': fightPropMap[40],
                '번개 원소 피해': fightPropMap[41],
                '물 원소 피해': fightPropMap[42],
                '풀 원소 피해': fightPropMap[43],
                '바람 원소 피해': fightPropMap[44],
                '바위 원소 피해': fightPropMap[45],
                '얼음 원소 피해': fightPropMap[46],
                '물리 피해': fightPropMap[30]
            };
            let highestDmgName = '';
            let highestDmgValue = 0;
            for (const [name, val] of Object.entries(dmgBonuses)) {
                if (val && val > highestDmgValue) {
                    highestDmgValue = val;
                    highestDmgName = name;
                }
            }
            const dmgBonusText = highestDmgValue > 0 ? `${highestDmgName} + ${(highestDmgValue * 100).toFixed(1)}%` : '없음';

            // 상세 카드 생성
            const embed = new EmbedBuilder()
                .setColor(elementColors[element] || 0x00FFC4)
                .setTitle(`🌟 ${charName} 상세 정보`)
                .setDescription(`Lv. ${charLevel} | 운명의 자리 **${constCount}돌** | 특성 레벨: \`${talentText}\``)
                .setThumbnail(`https://enka.network/ui/${sideIcon}.png`)
                .addFields(
                    { name: '⚔️ 무기 정보', value: weaponText, inline: false },
                    { name: '🌸 성유물 세트 효과', value: setBonusText, inline: false },
                    { name: '📊 기본 스탯', value: `
❤️ **최대 체력**: \`${maxHp.toLocaleString()}\`
⚔️ **공격력**: \`${maxAtk.toLocaleString()}\`
🛡️ **방어력**: \`${maxDef.toLocaleString()}\`
🧪 **원소 마스터리**: \`${em.toLocaleString()}\`
⚡ **원소 충전 효율**: \`${er}\`
🎯 **치명타 확률**: \`${critRate}\`
💥 **치명타 피해**: \`${critDmg}\`
🔥 **피해 증가 보너스**: \`${dmgBonusText}\`
                    `, inline: false }
                )
                .setFooter({ text: `UID: ${uid} | Data from Enka.Network` })
                .setTimestamp();

            // 뒤로가기 버튼 + 전체 진열장 캐릭터 버튼도 같이 배치 (빠른 전환 지원)
            const rows = [];
            
            // 첫번째 줄: 뒤로가기 버튼
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`genshin_profile_${uid}`)
                    .setLabel('🔙 프로필로 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
            rows.push(backRow);

            // 두번째~세번째 줄: 캐릭터 리스트 버튼들
            const showcaseList = data.playerInfo?.showAvatarInfoList || [];
            if (showcaseList.length > 0) {
                let currentRow = new ActionRowBuilder();
                let addedInRow = 0;
                showcaseList.forEach((char) => {
                    const charId = char.avatarId;
                    const charMeta = charactersData[charId] || {};
                    const charName = charMeta.name || `캐릭터_${charId}`;

                    // 현재 보고 있는 캐릭터는 버튼 비활성화
                    const isCurrent = charId == avatarId;

                    if (addedInRow === 5) {
                        rows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        addedInRow = 0;
                    }

                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`genshin_char_${uid}_${charId}`)
                            .setLabel(charName)
                            .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(isCurrent)
                    );
                    addedInRow++;
                });
                rows.push(currentRow);
            }

            await interaction.update({ embeds: [embed], components: rows });

        } catch (error) {
            console.error('버튼 실행 오류:', error);
            await interaction.reply({
                content: '❌ 상세 정보를 가져오는 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    },

    // 프로필 돌아가기 버튼 핸들러
    async executeBackButton(interaction) {
        const [, , uid] = interaction.customId.split('_');

        try {
            const data = await fetchEnkaData(uid);
            const response = createProfileResponse(data, uid);
            await interaction.update(response);
        } catch (error) {
            console.error('뒤로가기 실행 오류:', error);
            await interaction.reply({
                content: '❌ 프로필로 돌아가는 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
};
