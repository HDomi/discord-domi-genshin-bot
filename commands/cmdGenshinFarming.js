const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const genshindb = require('genshin-db');

// 요일 매핑 딕셔너리
const dayMap = {
    '월': 'Monday', '월요일': 'Monday', 'mon': 'Monday', 'monday': 'Monday',
    '화': 'Tuesday', '화요일': 'Tuesday', 'tue': 'Tuesday', 'tuesday': 'Tuesday',
    '수': 'Wednesday', '수요일': 'Wednesday', 'wed': 'Wednesday', 'wednesday': 'Wednesday',
    '목': 'Thursday', '목요일': 'Thursday', 'thu': 'Thursday', 'thursday': 'Thursday',
    '금': 'Friday', '금요일': 'Friday', 'fri': 'Friday', 'friday': 'Friday',
    '토': 'Saturday', '토요일': 'Saturday', 'sat': 'Saturday', 'saturday': 'Saturday',
    '일': 'Sunday', '일요일': 'Sunday', 'sun': 'Sunday', 'sunday': 'Sunday'
};

const dayKoMap = {
    'Monday': '월요일',
    'Tuesday': '화요일',
    'Wednesday': '수요일',
    'Thursday': '목요일',
    'Friday': '금요일',
    'Saturday': '토요일',
    'Sunday': '일요일'
};

// 원소별 색상 설정 (Hex 코드 및 캔버스 헥사 컬러)
const elementColors = {
    'Fire': '#FF4B4B', 'Pyro': '#FF4B4B',
    'Water': '#4BA6FF', 'Hydro': '#4BA6FF',
    'Wind': '#4BFFC9', 'Anemo': '#4BFFC9',
    'Electric': '#D14BFF', 'Electro': '#D14BFF',
    'Grass': '#56FF4B', 'Dendro': '#56FF4B',
    'Ice': '#4BFFFF', 'Cryo': '#4BFFFF',
    'Rock': '#FFD84B', 'Geo': '#FFD84B'
};

// 둥근 사각형 그리기 헬퍼 함수 (호환성 보장)
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// 이미지 다운로드 이중 폴백 처리 함수
async function loadImgWithFallback(primaryUrl, fallbackUrl1, fallbackUrl2) {
    if (primaryUrl) {
        try {
            return await loadImage(primaryUrl);
        } catch (e) {
            // 실패 시 다음 폴백으로 진행
        }
    }
    if (fallbackUrl1) {
        try {
            return await loadImage(fallbackUrl1);
        } catch (e) {
            // 실패 시 다음 폴백으로 진행
        }
    }
    if (fallbackUrl2) {
        try {
            return await loadImage(fallbackUrl2);
        } catch (e) {
            // 모든 시도 실패 시 에러 발생
        }
    }
    throw new Error('All image URLs failed to load');
}

// 한국시간 기준 요일 구하기 (새벽 4시 리셋 반영)
function getGenshinDayInfo(customDay = null) {
    if (customDay) {
        const engDay = dayMap[customDay.toLowerCase().trim()];
        if (engDay) {
            return { dayEng: engDay, dayKo: dayKoMap[engDay], isToday: false };
        }
    }

    const kstDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

    // 새벽 4시 이전이면 이전 날짜의 요일로 처리
    if (kstDate.getHours() < 4) {
        kstDate.setDate(kstDate.getDate() - 1);
    }

    const dayEng = kstDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dayKo = kstDate.toLocaleDateString('ko-KR', { weekday: 'long' });

    return { dayEng, dayKo, isToday: true };
}

// 요일별 도메인 획득 가능 아이템(특성 책) 정보 빌드
function getFarmingItemsForDay(dayEng) {
    const domainNames = genshindb.domains('names', { matchCategories: true });
    const books = [];

    for (const name of domainNames) {
        const domain = genshindb.domains(name);
        if (domain && domain.domainType === 'UI_ABYSSUS_AVATAR_PROUD' && domain.daysOfWeek && domain.daysOfWeek.includes(dayEng)) {
            for (const reward of domain.rewardPreview) {
                if (reward.name.startsWith('Philosophies of') && !books.some(b => b.name === reward.name)) {
                    const materialData = genshindb.materials(reward.name);
                    const materialDataKo = genshindb.materials(reward.name, { resultLanguage: 'Korean' });

                    if (materialData && materialDataKo) {
                        books.push({
                            name: reward.name,
                            nameKo: materialDataKo.name,
                            icon: materialData.images.filename_icon,
                            series: reward.name.replace('Philosophies of ', '')
                        });
                    }
                }
            }
        }
    }
    return books;
}

// 특정 특성 책을 사용하는 캐릭터 목록 조회
function getCharactersUsingBook(bookSeries) {
    const charactersList = [];
    const characterNames = genshindb.characters('names', { matchCategories: true });

    for (const charName of characterNames) {
        if (charName.toLowerCase() === 'traveler') continue;

        const talents = genshindb.talents(charName);
        if (talents && talents.costs && talents.costs.lvl2) {
            const usesBook = talents.costs.lvl2.some(item => item.name.includes(bookSeries));
            if (usesBook) {
                const charData = genshindb.characters(charName);
                const charDataKo = genshindb.characters(charName, { resultLanguage: 'Korean' });

                if (charData && charDataKo) {
                    charactersList.push({
                        name: charDataKo.name,
                        rarity: charData.rarity,
                        element: charData.elementType,
                        filename_icon: charData.images.filename_icon,
                        mihoyo_icon: charData.images.mihoyo_icon,
                        mihoyo_sideIcon: charData.images.mihoyo_sideIcon
                    });
                }
            }
        }
    }
    return charactersList;
}

// 캐릭터 이름 축소 표시 헬퍼 함수 (겹침 방지)
function shortenCharacterName(name) {
    if (name.includes('산고노미야 ')) return name.replace('산고노미야 ', '');
    if (name.includes('시카노인 ')) return name.replace('시카노인 ', '');
    if (name.includes('카에데하라 ')) return name.replace('카에데하라 ', '');
    if (name.includes('카미사토 ')) return name.replace('카미사토 ', '');
    if (name.includes('유메미즈키 ')) return name.replace('유메미즈키 ', '');
    if (name === '라이덴 쇼군') return '라이덴';
    if (name.includes('(체험)')) return name.replace('(체험)', '').trim();
    if (name.includes(' (체험)')) return name.replace(' (체험)', '').trim();
    return name;
}

// 가이드 이미지 버퍼 동적 생성 (디스코드 가독성 극대화를 위해 800px 너비 2열 레이아웃으로 변경)
async function generateFarmingImage(dayEng, dayKo, onProgress) {
    const books = getFarmingItemsForDay(dayEng);

    // 디스코드 채팅방에서 가독성을 높이기 위해 800px 너비로 컴팩트하게 설계
    const canvasWidth = 800;
    const headerHeight = 65;
    const footerHeight = 35;

    // 블록들의 높이 사전 계산
    const blocksInfo = [];
    for (const book of books) {
        const characters = getCharactersUsingBook(book.series);
        const rowsCount = Math.ceil(characters.length / 5) || 1; // 한 줄에 5명씩
        const blockHeight = 55 + rowsCount * 80; // 높이 최적화
        blocksInfo.push({ book, characters, height: blockHeight });
    }

    // 에셋 총 로딩 개수 계산 (로딩 진행률 표시용)
    let totalCount = 0;
    for (const block of blocksInfo) {
        totalCount += 1; // 특성 책 아이콘
        totalCount += block.characters.length; // 캐릭터 초상화
    }

    let loadedCount = 0;
    const notifyProgress = () => {
        loadedCount++;
        if (onProgress) {
            onProgress(loadedCount, totalCount);
        }
    };

    // 2열 높이 계산 및 매칭 (왼쪽 열 Y 좌표와 오른쪽 열 Y 좌표 추적)
    let leftY = headerHeight + 15;
    let rightY = headerHeight + 15;
    const positionedBlocks = [];

    for (const block of blocksInfo) {
        let x = 15;
        let y = 0;
        const width = 375; // 각 열의 너비

        // 더 짧은 쪽에 다음 블록을 밀어 넣음 (Masonry 레이아웃)
        if (leftY <= rightY) {
            x = 15;
            y = leftY;
            leftY += block.height + 12;
        } else {
            x = 410; // 15(좌측 마진) + 375(좌측 열) + 20(중앙 공백) = 410
            y = rightY;
            rightY += block.height + 12;
        }

        positionedBlocks.push({ ...block, x, y, width });
    }

    // 최종 캔버스 높이 결정
    const totalHeight = Math.max(leftY, rightY) + footerHeight;

    const canvas = createCanvas(canvasWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    // 전체 배경 그리기 (다크 그레이 프리미엄 테마)
    ctx.fillStyle = '#121214';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    // 헤더 장식
    ctx.fillStyle = '#00FFB4';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`📅 ${dayKo} 비경 획득 가능 특성 재료`, 15, 38);

    // 헤더 구분선
    ctx.strokeStyle = '#26262B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 52);
    ctx.lineTo(785, 52);
    ctx.stroke();

    // 각 블록 그리기
    for (const block of positionedBlocks) {
        const { book, characters, x, y, width, height } = block;

        // 카드 배경
        ctx.fillStyle = '#1A1A1E';
        drawRoundedRect(ctx, x, y, width, height, 10);
        ctx.fill();

        ctx.strokeStyle = '#2A2A30';
        ctx.lineWidth = 1.2;
        drawRoundedRect(ctx, x, y, width, height, 10);
        ctx.stroke();

        // 특성 책 아이콘 다운로드 및 그리기 (크기: 64x64)
        try {
            const bookIconUrl = `https://enka.network/ui/${book.icon}.png`;
            const bookImg = await loadImage(bookIconUrl);
            ctx.drawImage(bookImg, x + 12, y + 10, 64, 64);
        } catch (e) {
            console.warn(`Failed to load book icon for ${book.nameKo}:`, e.message);
            // 아이콘 404 등 로드 실패 시 골드 플레이스홀더 사각형 드로잉
            ctx.fillStyle = '#E5C07B';
            drawRoundedRect(ctx, x + 12, y + 10, 64, 64, 8);
            ctx.fill();

            ctx.fillStyle = '#1A1A1E';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(book.nameKo.substring(0, 4), x + 44, y + 48);
        }
        notifyProgress();

        // 특성 책 이름 텍스트 그리기
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(book.nameKo, x + 88, y + 30);

        // 영어 명칭 부제목 그리기 (한글 이름 아래에 배치하여 겹침 방지)
        ctx.fillStyle = '#787880';
        ctx.font = '11px sans-serif';
        ctx.fillText(`(${book.series} Series)`, x + 88, y + 48);

        // 캐릭터 원형 초상화 배치 그리기 (지름 48px)
        let charX = x + 88;
        let charY = y + 60;
        let idx = 0;

        for (const char of characters) {
            // 한 줄에 최대 5명, 넘어가면 다음 줄로
            if (idx > 0 && idx % 5 === 0) {
                charX = x + 88;
                charY += 80;
            }

            const iconSize = 48;
            const radius = iconSize / 2;
            const centerX = charX + radius;
            const centerY = charY + radius;

            // 캐릭터 초상화 그리기 (이중 폴백 적용)
            try {
                const primaryUrl = char.filename_icon ? `https://enka.network/ui/${char.filename_icon}.png` : null;
                const fallbackUrl1 = char.mihoyo_icon;
                const fallbackUrl2 = char.mihoyo_sideIcon;

                const charImg = await loadImgWithFallback(primaryUrl, fallbackUrl1, fallbackUrl2);

                // 원형 클리핑 그리기 (크기: 지름 46px)
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(charImg, charX, charY, iconSize, iconSize);
                ctx.restore();

                // 원소 성질별 테두리 동그랗게 입히기 (지름 48px)
                ctx.strokeStyle = elementColors[char.element] || '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();

            } catch (e) {
                // 이미지 로딩 실패 시 원형 배경에 글씨 플레이스홀더 렌더링
                ctx.fillStyle = elementColors[char.element] || '#323238';
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(char.name.substring(0, 4), centerX, centerY + 4);
            }

            // 캐릭터 이름 텍스트 그리기 (이름 축소 적용)
            const displayName = shortenCharacterName(char.name);
            ctx.fillStyle = '#E4E4E6';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(displayName, centerX, charY + iconSize + 15);

            charX += 54; // 가로 간격을 54px로 맞춰 375px 내에 5명 정렬
            idx++;
            notifyProgress();
        }
    }

    // 푸터 디자인
    ctx.fillStyle = '#5A5A62';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Data provided by Genshin-DB & Enka.Network | Design inspired by Paimon.moe', canvasWidth / 2, totalHeight - 15);

    return canvas.toBuffer('image/png');
}


// 요일 버튼 생성 헬퍼 함수
function createDayButtons(selectedDayEng, disableAll = false) {
    const days = [
        { eng: 'Monday', ko: '월요일' },
        { eng: 'Tuesday', ko: '화요일' },
        { eng: 'Wednesday', ko: '수요일' },
        { eng: 'Thursday', ko: '목요일' },
        { eng: 'Friday', ko: '금요일' },
        { eng: 'Saturday', ko: '토요일' },
        { eng: 'Sunday', ko: '일요일' }
    ];

    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

    // 월 ~ 목 (Row 1)
    for (let i = 0; i < 4; i++) {
        const day = days[i];
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`genshin_farming_${day.eng}`)
                .setLabel(day.ko)
                .setStyle(day.eng === selectedDayEng ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(disableAll)
        );
    }

    // 금 ~ 일 (Row 2)
    for (let i = 4; i < 7; i++) {
        const day = days[i];
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`genshin_farming_${day.eng}`)
                .setLabel(day.ko)
                .setStyle(day.eng === selectedDayEng ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(disableAll)
        );
    }

    // Paimon.moe 바로가기 버튼 추가 (Row 2)
    row2.addComponents(
        new ButtonBuilder()
            .setLabel('Paimon.moe')
            .setURL('https://paimon.moe/')
            .setStyle(ButtonStyle.Link)
            .setDisabled(disableAll)
    );

    return [row1, row2];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('오늘의아이템')
        .setDescription('비경에서 획득할 수 있는 오늘의 특성 책과 사용 캐릭터들을 확인합니다.'),

    async execute(interaction) {
        await interaction.deferReply();

        const { dayEng, dayKo, isToday } = getGenshinDayInfo();
        
        // 초기 로딩 메시지 출력 (버튼 비활성화)
        const initialRows = createDayButtons(dayEng, true);
        await interaction.editReply({
            content: `⏳ **${dayKo} 가이드 이미지 생성 준비 중... (0%)**`,
            components: initialRows
        });

        let lastUpdate = 0;
        const onProgress = async (current, total) => {
            const now = Date.now();
            const pct = Math.round((current / total) * 100);
            // 디스코드 API 레이트리밋 방지를 위해 800ms 간격 또는 100% 완료 시점에만 업로드 진행상황 갱신
            if (now - lastUpdate > 800 || current === total) {
                lastUpdate = now;
                await interaction.editReply({
                    content: `⏳ **${dayKo} 가이드 이미지 생성 중... ${pct}% (${current}/${total})**`,
                    components: initialRows
                }).catch(() => {});
            }
        };

        try {
            // 가이드 이미지 버퍼 생성
            const imageBuffer = await generateFarmingImage(dayEng, dayKo, onProgress);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'farming_today.png' });

            const rows = createDayButtons(dayEng);

            await interaction.editReply({
                content: `📅 **원신 특성 재료 가이드 (${dayKo})**\n${isToday ? '📢 **한국 서버 새벽 4시 초기화 기준** 오늘의 획득 가능 아이템입니다. 각 요일 버튼을 눌러 다른 요일도 바로 확인해 보세요!' : `💡 선택하신 **${dayKo}**의 획득 가능 아이템입니다.`}`,
                files: [attachment],
                components: rows
            });

        } catch (error) {
            console.error('오늘의 아이템 이미지 생성 오류:', error);
            await interaction.editReply({
                content: '❌ 이미지 가이드를 생성하는 중 오류가 발생했습니다. 다시 시도해 주세요.',
                components: createDayButtons(dayEng)
            });
        }
    },

    async executeButton(interaction) {
        const customId = interaction.customId; // 예: "genshin_farming_Monday"
        const dayEng = customId.replace('genshin_farming_', '');
        const dayKo = dayKoMap[dayEng];

        await interaction.deferUpdate();

        // 버튼 비활성화 및 로딩 표시, 기존 사진 제거를 위해 files: [] 전달
        const initialRows = createDayButtons(dayEng, true);
        await interaction.editReply({
            content: `⏳ **${dayKo} 가이드 이미지 생성 준비 중... (0%)**`,
            components: initialRows,
            files: []
        });

        let lastUpdate = 0;
        const onProgress = async (current, total) => {
            const now = Date.now();
            const pct = Math.round((current / total) * 100);
            if (now - lastUpdate > 800 || current === total) {
                lastUpdate = now;
                await interaction.editReply({
                    content: `⏳ **${dayKo} 가이드 이미지 생성 중... ${pct}% (${current}/${total})**`,
                    components: initialRows
                }).catch(() => {});
            }
        };

        try {
            // 새로운 요일 가이드 이미지 버퍼 생성
            const imageBuffer = await generateFarmingImage(dayEng, dayKo, onProgress);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'farming_today.png' });

            const rows = createDayButtons(dayEng);

            await interaction.editReply({
                content: `📅 **원신 특성 재료 가이드 (${dayKo})**\n💡 선택하신 **${dayKo}**의 획득 가능 아이템입니다. 각 요일 버튼을 눌러 다른 요일도 바로 확인해 보세요!`,
                files: [attachment],
                components: rows
            });

        } catch (error) {
            console.error('오늘의 아이템 버튼 처리 오류:', error);
            await interaction.followUp({
                content: '❌ 데이터를 불러오는 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
};
