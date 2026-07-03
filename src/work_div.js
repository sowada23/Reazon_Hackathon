const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ドット絵のシャープさを保つ設定
ctx.imageSmoothingEnabled = false;

// ==========================================
// 🛠️ 外部画像の読み込み設定
// ==========================================
// ※index.htmlと同じフォルダに画像を置いてください。別のファイル名にする場合はここを変更します。
const imgPlayerA = new Image();
imgPlayerA.src = 'asset/asset_chara_runfront_clear.png'; // 1枚目の画像（右足前など）

const imgPlayerB = new Image();
imgPlayerB.src = 'asset/asset_chara_backrun_clear.png'; // 2枚目の画像（左足前など）

// 👇 【ここを追加】ボス5種類のPNG画像を asset フォルダから読み込む設定
const bossImages = {
    manager: new Image(),
    consultant: new Image(),
    director: new Image(),
    client: new Image(),
    nightmare: new Image()
};
bossImages.manager.src    = 'asset/boss_1.png';    // 1F用の画像名（自由に変えてください）
bossImages.consultant.src = 'asset/boss_2.png'; // 2F用の画像名
bossImages.director.src   = 'asset/boss_3.png';   // 3F用の画像名
bossImages.client.src     = 'asset/boss_4.png';     // 4F用の画像名
bossImages.nightmare.src  = 'asset/boss_5.png';  // 5F用の画像名

//各種アイテム・弾・障害物の画像読み込み設定
const gameImages = {
    bulletNormal: new Image(),  // プレイヤーの通常弾
    bulletSpecial: new Image(), // 承認ハンコ弾
    itemHeal: new Image(),      // コーヒー（回復アイテム）
    itemDoc: new Image(),       // 書類アイテム
    obsCross: new Image(),      // 障害物1：未処理の書類の山
    obsBat: new Image(),        // 障害物2：電子メール
    obsTalisman: new Image()    // 障害物3：壁時計
};
// 💡 assetフォルダ内にある実際の画像ファイル名に合わせて、ここを自由に変更してください
gameImages.bulletNormal.src  = 'asset/pen_bullet.png';
gameImages.bulletSpecial.src = 'asset/hanko.png';
gameImages.itemHeal.src      = 'asset/coffee.png';
gameImages.itemDoc.src       = 'asset/file.png';
gameImages.obsCross.src      = 'asset/building.png';
gameImages.obsBat.src        = 'asset/email.png';
gameImages.obsTalisman.src   = 'asset/clock.png';

// ==========================================

// --- ゲーム状態管理 ---
let gameState = 'TITLE'; 
let prePauseState = '';  
let score = 0;
let candyCount = 0; // システム内部ではcandyCountのまま「書類の数」として使用
let gameFrame = 0;
let warningTimer = 0;
let flashAlpha = 0;

// --- ボスデータ (会社員テーマ版 5連戦) ---
const bossStages = [
    { name: '1F：イヤミな先輩', maxHp: 100, color: '#e43b44', type: 'manager', maxWaves: 2, interval: 90, wayCount: 3, restDuration: 160 },
    { name: '2F：怒りの部長', maxHp: 120, color: '#0099db', type: 'consultant', maxWaves: 3, interval: 80, wayCount: 4, restDuration: 140 },
    { name: '3F：ぐちぐち取締役', maxHp: 140, color: '#f77622', type: 'director', maxWaves: 4, interval: 70, wayCount: 5, restDuration: 120 },
    { name: '4F：鬼のクライアント', maxHp: 160, color: '#fee761', type: 'client', maxWaves: 5, interval: 62, wayCount: 6, restDuration: 100 },
    { name: '5F：深夜残業の悪夢', maxHp: 180, color: '#b55088', type: 'nightmare', maxWaves: 6, interval: 52, wayCount: 8, restDuration: 90 }
];
let currentBossIdx = 0;

// --- オーディオシステム (Web Audio API 8bitスタイル) ---
let audioCtx = null;
let audioTimer = 0;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, type, duration, vol, startTime) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    } catch (e) {}
}

function playSE(type) {
    if (!audioCtx) return;
    let now = audioCtx.currentTime;
    if (type === 'jump') {
        // 会社員がタッタッと走る・跳ぶ小気味いいステップ音
        playTone(300, 'triangle', 0.06, 0.03, now);
    } else if (type === 'candy') {
        // 書類を回収した時のシャキーン音
        playTone(987.77, 'square', 0.06, 0.02, now);
        playTone(1318.51, 'square', 0.1, 0.015, now + 0.04);
    } else if (type === 'heal') {
        // コーヒーでほっと一息
        playTone(523.25, 'sine', 0.1, 0.04, now);
        playTone(783.99, 'sine', 0.1, 0.04, now + 0.05);
        playTone(1046.50, 'sine', 0.15, 0.03, now + 0.1);
    } else if (type === 'damage') {
        playTone(130, 'sawtooth', 0.2, 0.1, now);
    } else if (type === 'shoot') {
        playTone(800, 'square', 0.04, 0.01, now);
    } else if (type === 'special') {
        playTone(180, 'sawtooth', 0.25, 0.08, now);
        playTone(360, 'square', 0.2, 0.04, now + 0.05);
    } else if (type === 'shield') {
        playTone(600, 'sine', 0.05, 0.05, now);
        playTone(900, 'sine', 0.15, 0.03, now + 0.03);
    } else if (type === 'boss_damage') {
        playTone(400, 'triangle', 0.05, 0.06, now);
    }
}

// レトロアーケード風オフィスBGM
const melody = [330, 392, 440, 523, 440, 392, 330, 294, 330, 330, 392, 440, 523, 659, 587, 523];

function runBGM() {
    if (!audioCtx || gameState === 'PAUSE') return; 
    audioTimer++;
    let now = audioCtx.currentTime;

    if (gameState === 'STAGE' || gameState === 'WARNING') {
        if (audioTimer % 16 === 0) {
            let idx = Math.floor(audioTimer / 16) % melody.length;
            playTone(melody[idx], 'square', 0.2, 0.012, now);
            if (idx % 4 === 0) playTone(melody[idx] / 2, 'triangle', 0.25, 0.02, now);
        }
    } else if (gameState === 'BOSS') {
        if (audioTimer % 10 === 0) {
            let idx = Math.floor(audioTimer / 10) % melody.length;
            playTone(melody[idx] * 1.2, 'square', 0.14, 0.012, now);
            if (idx % 2 === 0) playTone(melody[idx] / 2, 'sawtooth', 0.18, 0.015, now);
        }
    }
}

// --- オブジェクト定義 ---
const player = {
    x: 150, y: 250, w: 80, h: 80, vy: 0,
    gravity: 0.26, jumpForce: -7.5, speed: 3.8,      
    hp: 8, maxHp: 8, shootTimer: 0, shieldTimer: 0, 
    reset() {
        this.x = 150; this.y = 250; this.vy = 0;
        this.hp = this.maxHp; this.shootTimer = 0; this.shieldTimer = 0;
    }
};

const boss = {
    x: 950, y: 220, w: 120, h: 120, hp: 100, maxHp: 100,
    shootTimer: 0, hoverTimer: 0, introDone: false,
    waveCount: 0, isResting: false, restTimer: 0,
    reset(tierData) {
        this.x = 950; this.y = 220;
        this.hp = tierData.maxHp; this.maxHp = tierData.maxHp;
        this.shootTimer = 0; this.hoverTimer = 0; this.introDone = false;
        this.waveCount = 0; this.isResting = false; this.restTimer = 0;
    }
};

let obstacles = []; let candies = []; let playerBullets = []; let bossBullets = []; let particles = []; let backgrounds = [];

// --- キー入力管理 ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    initAudio();

    if (e.code === 'Escape') {
        if (gameState === 'STAGE' || gameState === 'WARNING' || gameState === 'BOSS') {
            prePauseState = gameState; gameState = 'PAUSE'; return;
        }
    }

    if (e.code === 'Space') {
        if (gameState === 'STAGE' || gameState === 'WARNING') {
            player.vy = player.jumpForce;
            playSE('jump');
            createParticles(player.x + player.w/2, player.y + player.h, '#d8c2b5', 4, 2);
        } else if (gameState === 'TITLE') {
            // 👇 直接始まらず、案内画面に切り替える
            gameState = 'INSTRUCTION';
        } else if (gameState === 'INSTRUCTION') {
            // 👇 案内画面の時にスペースを押したらゲーム開始
            initGame(); gameState = 'STAGE';
        } else if (gameState === 'GAMEOVER' || gameState === 'CLEAR') {
            gameState = 'TITLE';
        } else if (gameState === 'PAUSE') {
            gameState = prePauseState;
        }
    }

    if (e.code === 'KeyQ' && gameState === 'BOSS' && candyCount >= 5) {
        candyCount -= 5; fireSpecialWeapon();
    }
    if (e.code === 'KeyE' && (gameState === 'STAGE' || gameState === 'BOSS' || gameState === 'WARNING') && candyCount >= 5 && player.shieldTimer <= 0) {
        candyCount -= 5; player.shieldTimer = 50; playSE('shield');
        createParticles(player.x + player.w/2, player.y + player.h/2, '#5fcde4', 15, 3);
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function createParticles(x, y, color, count = 5, size = 3) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            radius: Math.random() * size + 1, color: color, alpha: 1,
            decay: Math.random() * 0.03 + 0.02
        });
    }
}

function initGame() {
    score = 0; candyCount = 0; gameFrame = 0; warningTimer = 0; currentBossIdx = 0;
    obstacles = []; candies = []; playerBullets = []; bossBullets = []; particles = [];
    player.reset(); boss.reset(bossStages[0]);
    initBackgroundObjects();
}

function initBackgroundObjects() {
    backgrounds = [];
    for (let i = 0; i < 8; i++) {
        backgrounds.push({
            x: Math.random() * canvas.width,
            y: Math.random() * 100 + 360,
            w: Math.random() * 40 + 40,
            h: Math.random() * 60 + 80,
            colorVariant: Math.random() < 0.5 ? 0 : 1
        });
    }
}

function fireSpecialWeapon() {
    playSE('special');
    playerBullets.push({
        x: player.x + player.w, y: player.y + player.h / 2,
        w: 48, h: 48, vx: 12, vy: 0, isSpecial: true
    });
    createParticles(player.x + player.w, player.y + player.h/2, '#e43b44', 15, 4);
}

// --- ピクセルアート・色合い処理 (Stardew Valley調のノスタルジック・オフィスカラー) ---
function drawBackgroundGlow() {
    ctx.save();
    if (gameState === 'STAGE' || gameState === 'WARNING' || gameState === 'PAUSE') {
        if (currentBossIdx === 0) {
            ctx.fillStyle = '#4b3d30'; // 1F: 営業部 (温かみのある木製セピアブラウン)
        } else if (currentBossIdx === 1) {
            ctx.fillStyle = '#222a3a'; // 2F: 開発部 (サーバー室のようなディープブルースティール)
        } else if (currentBossIdx === 2) {
            ctx.fillStyle = '#324a46'; // 3F: 会議室 (くすんだオフィスグリーン)
        } else if (currentBossIdx === 3) {
            ctx.fillStyle = '#4d2b3b'; // 4F: 役員フロア (高級感のあるボルドーワイン)
        } else {
            ctx.fillStyle = '#181425'; // 5F: 深夜残業 (ドット絵定番の濃いトワイライトパープル)
        }
    } else {
        ctx.fillStyle = '#2c1e21';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // オフィスフロアの「床の境界線」をドット絵調に描画
    ctx.fillStyle = '#1f1914';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = '#634b35';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 4);
    ctx.restore();
}

// ステージ（部署）ごとのオフィス背景ドット絵オブジェクト
function drawBackgroundObjects() {
    backgrounds.forEach(bg => {
        ctx.save();
        if (currentBossIdx === 0) {
            // 営業部: 木のデスクと観葉植物のシルエット
            ctx.fillStyle = bg.colorVariant === 0 ? '#5a493b' : '#695545';
            ctx.fillRect(bg.x, bg.y, bg.w, canvas.height - bg.y - 40);
            // 植物のドット風葉っぱ
            ctx.fillStyle = '#375b42';
            ctx.fillRect(bg.x + bg.w/2 - 12, bg.y - 16, 24, 16);
        } 
        else if (currentBossIdx === 1) {
            // 開発部: サーバーラックと光るインジケータ
            ctx.fillStyle = bg.colorVariant === 0 ? '#2d384a' : '#37455c';
            ctx.fillRect(bg.x, bg.y - 20, bg.w, canvas.height - bg.y - 20);
            // ピコピコ光るドットインジケータ
            ctx.fillStyle = (gameFrame % 20 < 10) ? '#38b549' : '#e43b44';
            ctx.fillRect(bg.x + 8, bg.y, 4, 4);
            ctx.fillRect(bg.x + 16, bg.y + 16, 4, 4);
        } 
        else if (currentBossIdx === 2) {
            // 会議室: パーティションとホワイトボード風ボード
            ctx.fillStyle = '#42615c';
            ctx.fillRect(bg.x, bg.y - 40, bg.w * 1.2, canvas.height - bg.y);
            ctx.fillStyle = '#eeeeee';
            ctx.fillRect(bg.x + 6, bg.y - 30, bg.w * 1.2 - 12, 50);
        }
        else if (currentBossIdx === 3) {
            // 役員フロア: 高級オフィスチェアと大理石の柱風
            ctx.fillStyle = '#63354b';
            ctx.fillRect(bg.x, 80, 30, canvas.height - 120);
            ctx.fillStyle = '#a35072';
            ctx.fillRect(bg.x + 6, 80, 4, canvas.height - 120);
        }
        else {
            // 深夜残業: 巨大なオフィス窓と外の夜景ドット
            ctx.fillStyle = '#26213a';
            ctx.fillRect(bg.x, 60, bg.w * 1.5, 240);
            // 遠くのビルの窓の明かり
            ctx.fillStyle = '#fee761';
            if (bg.colorVariant === 0) {
                ctx.fillRect(bg.x + 10, 100, 6, 8);
                ctx.fillRect(bg.x + 30, 140, 6, 8);
            } else {
                ctx.fillRect(bg.x + 20, 80, 6, 8);
                ctx.fillRect(bg.x + 40, 180, 6, 8);
            }
        }
        ctx.restore();
    });
}

// 外部画像を使ったプレイヤーの描画処理
function drawPlayer(ctx, x, y, w, h) {
    ctx.save();
    
    // シールドエフェクト (Eキー時)
    if (player.shieldTimer > 0) {
        ctx.fillStyle = 'rgba(95, 205, 228, 0.25)';
        ctx.strokeStyle = '#5fcde4'; ctx.lineWidth = 3;
        ctx.fillRect(x - 12, y - 8, w + 24, h + 16);
        ctx.strokeRect(x - 12, y - 8, w + 24, h + 16);
    }

    // 8フレームごとに足を反転させて交互に走っているように見せる
    let legFlip = Math.floor(gameFrame / 100) % 2 === 0;
    let currentActiveImg = legFlip ? imgPlayerA : imgPlayerB;

    // 🛠️ ローカル制限(CORS)に干渉されにくい「画像ロード完了チェック」に変更
    if (currentActiveImg.complete && currentActiveImg.width > 0) {
        // 画像の縦横比を完全に1:1のスクエア型(w×h)でそのままクッキリ投影
        ctx.drawImage(currentActiveImg, x, y, w, h);

    }

    
    ctx.restore();
}

// 会社テーマのドット絵ボスたち
function drawBoss(ctx, b, type) {
    ctx.save();

    // 指定されたボスの画像を取得
    const currentBossImg = bossImages[type];

    // 画像のロードが完了しているかチェック
    if (currentBossImg && currentBossImg.complete && currentBossImg.width > 0) {
        
        // 💡 【サイズ倍率の調整】
        // 画像をそのままのサイズで出すなら 1.0。1.5にすると1.5倍の大きさになります。
        const sizeScale = 2.0; 
        
        const drawW = b.w * sizeScale;
        const drawH = b.h * sizeScale;
        
        // ボスの中心位置がずれないように少し補正して描画
        const drawX = b.x - (drawW - b.w) / 2;
        const drawY = b.y - (drawH - b.h) / 2;

        ctx.drawImage(currentBossImg, drawX, drawY, drawW, drawH);

    } else {
        // 画像が万が一読み込めなかった時のための文字表示
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('Loading Boss...', b.x, b.y + b.h / 2);
    }
    
    ctx.restore();
}

// 会社テーマのドット絵障害物
function drawObstacle(ctx, obs) {
    ctx.save();
    let currentImg = null;

    if (obs.type === 'cross') currentImg = gameImages.obsCross;
    else if (obs.type === 'bat') currentImg = gameImages.obsBat;
    else if (obs.type === 'talisman') currentImg = gameImages.obsTalisman;

    if (currentImg && currentImg.complete && currentImg.width > 0) {
        // 元の当たり判定の大きい方の辺をベースに、さらに1.6倍に拡大
        const baseSize = Math.max(obs.w, obs.h);
        const drawSize = baseSize * 1.6; 
        
        // 当たり判定の中心位置と画像の中心を完全に一致させる補正
        const drawX = obs.x + obs.w / 2 - drawSize / 2;
        const drawY = obs.y + obs.h / 2 - drawSize / 2;
        
        ctx.drawImage(currentImg, drawX, drawY, drawSize, drawSize);
    } else {
        if (obs.type === 'cross') { 
            ctx.fillStyle = '#eeeeee'; ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.fillStyle = '#cbd8e2'; for(let l=obs.y+4; l<obs.y+obs.h; l+=6) { ctx.fillRect(obs.x + 2, l, obs.w - 4, 2); }
            ctx.strokeStyle = '#4d6575'; ctx.lineWidth = 2; ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'bat') { 
            ctx.fillStyle = '#ffffff'; ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.strokeStyle = '#ac3232'; ctx.lineWidth = 2; ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            ctx.beginPath(); ctx.strokeStyle = '#ac3232'; ctx.moveTo(obs.x, obs.y); ctx.lineTo(obs.x + obs.w/2, obs.y + obs.h/2); ctx.lineTo(obs.x + obs.w, obs.y); ctx.stroke();
        } else if (obs.type === 'talisman') { 
            ctx.fillStyle = '#ffffff'; ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.strokeStyle = '#333333'; ctx.lineWidth = 3; ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            ctx.fillStyle = '#e43b44'; ctx.fillRect(obs.x + obs.w/2 - 1, obs.y + 4, 3, obs.h/2 - 2); ctx.fillRect(obs.x + obs.w/2, obs.y + obs.h/2 - 1, obs.w/3, 3);
        }
    }
    ctx.restore();
}

// 回復アイテム・書類アイテムのドット絵
function drawCandy(ctx, c) {
    ctx.save();
    
    // アイテム描画サイズ（54x54の大きめのスクエアに統一）
    const drawSize = 54;
    const drawX = c.x - drawSize / 2;
    const drawY = c.y - drawSize / 2;

    if (c.isHeart) {
        if (gameImages.itemHeal.complete && gameImages.itemHeal.width > 0) {
            ctx.drawImage(gameImages.itemHeal, drawX, drawY, drawSize, drawSize);
        } else {
            ctx.fillStyle = '#dedede'; ctx.fillRect(c.x - 12, c.y - 6, 24, 20);
            ctx.fillStyle = '#634b35'; ctx.fillRect(c.x - 9, c.y - 4, 18, 4);
            ctx.fillStyle = '#dedede'; ctx.fillRect(c.x + 12, c.y - 2, 6, 10);
            ctx.strokeStyle = '#5a5a5a'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 12, c.y - 6, 24, 20);
        }
    } else {
        if (gameImages.itemDoc.complete && gameImages.itemDoc.width > 0) {
            ctx.drawImage(gameImages.itemDoc, drawX, drawY, drawSize, drawSize);
        } else {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x - 12, c.y - 16, 24, 32);
            ctx.strokeStyle = '#3f3f74'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 12, c.y - 16, 24, 32);
            ctx.fillStyle = '#5b6ee1'; ctx.fillRect(c.x - 8, c.y - 8, 16, 2); ctx.fillRect(c.x - 8, c.y, 12, 2); ctx.fillRect(c.x - 8, c.y + 8, 16, 2);
        }
    }
    ctx.restore();
}

// --- アップデートロジック ---
function update() {
    if (gameState === 'PAUSE') return; 
    gameFrame++;
    runBGM();

    if (player.shieldTimer > 0) player.shieldTimer--;

    if (gameState === 'STAGE' || gameState === 'WARNING') {
        backgrounds.forEach(bg => {
            bg.x -= 0.6; // 背景のオフィススクロール
            if (bg.x + bg.w < -60) bg.x = canvas.width + Math.random() * 80;
        });
    }

    if (gameState === 'STAGE' || gameState === 'WARNING') {
        player.vy += player.gravity;
        player.y += player.vy;
        if (player.y < 0) { player.y = 0; player.vy = 0; }
        if (player.y + player.h > canvas.height - 40) { player.y = canvas.height - 40 - player.h; player.vy = 0; }

        if (gameState === 'STAGE') {
            score++;
            let targetScore = (currentBossIdx + 1) * 2000;
            if (score >= targetScore) {
                gameState = 'WARNING'; warningTimer = 0;
            }
        }
    } else if (gameState === 'BOSS') {
        if (keys['KeyW'] || keys['ArrowUp']) player.y -= player.speed;
        if (keys['KeyS'] || keys['ArrowDown']) player.y += player.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) player.x -= player.speed;
        if (keys['KeyD'] || keys['ArrowRight']) player.x += player.speed;

        if (player.y < 0) player.y = 0;
        if (player.y + player.h > canvas.height - 40) player.y = canvas.height - 40 - player.h;
        if (player.x < 0) player.x = 0;
        if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

        player.shootTimer++;
        if (player.shootTimer % 14 === 0) {
            playSE('shoot');
            // 承認インク弾を発射
            playerBullets.push({
                x: player.x + player.w, y: player.y + player.h / 2,
                w: 10, h: 10, vx: 9, vy: 0, isSpecial: false, color: '#38b549'
            });
        }
    }

    let currentBoss = bossStages[currentBossIdx];
    if (gameState === 'WARNING') {
        warningTimer++;
        flashAlpha = Math.sin(warningTimer * 0.08) * 0.06 + 0.06; 
        if (warningTimer > 180) {
            gameState = 'BOSS'; flashAlpha = 0; boss.reset(currentBoss);
        }
    } else if (gameState === 'BOSS') {
        if (!boss.introDone) {
            boss.x -= 2.5;
            if (boss.x <= 680) boss.introDone = true;
        } else {
            boss.hoverTimer += 0.03;
            boss.y = 200 + Math.sin(boss.hoverTimer) * 90;
            boss.shootTimer++;
            
            if (boss.isResting) {
                boss.restTimer--;
                if (boss.restTimer <= 0) {
                    boss.isResting = false; boss.waveCount = 0; boss.shootTimer = 0;
                }
            } else {
                if (boss.shootTimer % currentBoss.interval === 0) {
                    boss.waveCount++;
                    let ways = currentBoss.wayCount;
                    
                    let baseAngle = Math.PI; 
                    if (currentBoss.type === 'pumpkin') {
                        baseAngle += Math.sin(gameFrame * 0.06) * 0.4; 
                    } else if (currentBoss.type === 'mummy' || currentBoss.type === 'vampire' || currentBoss.type === 'client') {
                        baseAngle += (gameFrame * 0.06); // 回転弾幕仕様
                    }

                    for (let i = 0; i < ways; i++) {
                        let angle = baseAngle + (i - (ways - 1) / 2) * 0.25;
                        if (currentBoss.type === 'mummy' || currentBoss.type === 'vampire') {
                            angle = baseAngle + (i * (Math.PI * 2 / ways));
                        }
                        // ボスは一定サイズのピクセルインク弾を放つ
                        bossBullets.push({
                            x: boss.x + 20, y: boss.y + boss.h / 2,
                            vx: Math.cos(angle) * 2.6, vy: Math.sin(angle) * 2.6, r: 8 
                        });
                    }
                    if (boss.waveCount >= currentBoss.maxWaves) {
                        boss.isResting = true; boss.restTimer = currentBoss.restDuration;
                    }
                }
            }
        }
    }

    // アイテム・障害物の生成管理 (ボス戦中 BOSS も生成対象)
    if ((gameState === 'STAGE' || gameState === 'WARNING' || gameState === 'BOSS') && gameFrame % 65 === 0) {
        let obsY = -999; let obsH = 0;

        if (gameState === 'STAGE' || gameState === 'WARNING') {
            let types = ['talisman', 'cross', 'bat']; 
            let type = types[Math.floor(Math.random() * types.length)];
            
            if (type === 'cross') {
                obsH = Math.random() * 50 + 70; obsY = canvas.height - 40 - obsH;
                obstacles.push({ x: canvas.width, y: obsY, w: 40, h: obsH, type: 'cross', speed: 3.8 });
            } else if (type === 'bat') {
                obsY = Math.random() * 180 + 40; obsH = 30;
                obstacles.push({ x: canvas.width, y: obsY, w: 40, h: 30, type: 'bat', speed: 4.2 });
            } else if (type === 'talisman') {
                obsY = Math.random() * 200 + 150; obsH = 40;
                obstacles.push({ x: canvas.width, y: obsY, w: 40, h: 40, type: 'talisman', speed: 3.8 });
            }
        }

        if (Math.random() < 0.78) {
            let candyY = Math.random() * 340 + 80;
            if ((gameState === 'STAGE' || gameState === 'WARNING') && obsY !== -999) {
                if (Math.abs(candyY - (obsY + obsH/2)) < 120) {
                    candyY = (obsY > canvas.height / 2) ? Math.random() * 120 + 60 : Math.random() * 120 + 340;
                }
            }
            
            let heartChance = (gameState === 'BOSS') ? 0.14 : 0.08;
            let isHealItem = Math.random() < heartChance; 
            candies.push({
                x: canvas.width + 40, y: candyY, r: isHealItem ? 14 : 18,
                isHeart: isHealItem, color: '#ffffff', speed: 3.8
            });
        }
    }

    // 衝突判定
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i]; obs.x -= obs.speed;
        if (player.x < obs.x + obs.w && player.x + player.w > obs.x &&
            player.y < obs.y + obs.h && player.y + player.h > obs.y) {
            
            if (player.shieldTimer > 0) {
                createParticles(obs.x + obs.w/2, obs.y + obs.h/2, '#5fcde4', 6, 2);
                obstacles.splice(i, 1);
            } else {
                player.hp--; playSE('damage');
                createParticles(player.x + player.w/2, player.y + player.h/2, '#e43b44', 10);
                obstacles.splice(i, 1);
                if (player.hp <= 0) gameState = 'GAMEOVER';
            }
            continue;
        }
        if (obs.x + obs.w < -50) obstacles.splice(i, 1);
    }

    for (let i = candies.length - 1; i >= 0; i--) {
        let c = candies[i]; c.x -= c.speed;
        let dist = Math.hypot((player.x + player.w/2) - c.x, (player.y + player.h/2) - c.y);
        if (dist < c.r + player.w/2 + 8) {
            if (c.isHeart) {
                if (player.hp < player.maxHp) player.hp++;
                playSE('heal'); createParticles(c.x, c.y, '#ff6699', 8, 3);
            } else {
                candyCount++; playSE('candy'); createParticles(c.x, c.y, '#ffffff', 6, 2);
            }
            candies.splice(i, 1); continue;
        }
        if (c.x + c.r < -20) candies.splice(i, 1);
    }

    // プレイヤーの攻撃弾
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        let p = playerBullets[i]; p.x += p.vx;
        if (gameState === 'BOSS' && p.x > boss.x && p.x < boss.x + boss.w &&
            p.y > boss.y && p.y < boss.y + boss.h) {
            let damage = p.isSpecial ? 25 : 2;
            boss.hp -= damage; playSE('boss_damage');
            createParticles(p.x, p.y, p.isSpecial ? '#e43b44' : '#fee761', p.isSpecial ? 12 : 4);
            playerBullets.splice(i, 1);
            
            if (boss.hp <= 0) {
                createParticles(boss.x + boss.w/2, boss.y + boss.h/2, currentBoss.color, 40, 4);
                bossBullets = [];
                if (currentBossIdx < bossStages.length - 1) {
                    currentBossIdx++; gameState = 'STAGE'; score += 10;
                    initBackgroundObjects(); 
                } else {
                    gameState = 'CLEAR';
                }
            }
            continue;
        }
        if (p.x > canvas.width) playerBullets.splice(i, 1);
    }

    // ボス攻撃弾
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        let b = bossBullets[i]; b.x += b.vx; b.y += b.vy;
        let dist = Math.hypot((player.x + player.w/2) - b.x, (player.y + player.h/2) - b.y);
        if (dist < b.r + player.w/3) {
            if (player.shieldTimer > 0) {
                createParticles(b.x, b.y, '#5fcde4', 4, 2);
                bossBullets.splice(i, 1);
            } else {
                player.hp--; playSE('damage');
                createParticles(player.x + player.w/2, player.y + player.h/2, '#e43b44', 10);
                bossBullets.splice(i, 1);
                if (player.hp <= 0) gameState = 'GAMEOVER';
            }
            continue;
        }
        if (b.x + b.r < -20 || b.y + b.r < -20 || b.y - b.r > canvas.height + 20) bossBullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
        if (p.alpha <= 0) particles.splice(i, 1);
    }
}

// --- メイン描画ロジック ---
function draw() {
    drawBackgroundGlow();
    drawBackgroundObjects();

    obstacles.forEach(obs => drawObstacle(ctx, obs));
    candies.forEach(c => drawCandy(ctx, c));

    playerBullets.forEach(p => {
        ctx.save();
        if (p.isSpecial) {
            // 巨大な承認ハンコ弾（判定サイズ48に対して1.6倍の76x76スクエアで大きく描画）
            if (gameImages.bulletSpecial.complete && gameImages.bulletSpecial.width > 0) {
                const drawSize = p.w * 2.5;
                ctx.drawImage(gameImages.bulletSpecial, p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
            } else {
                ctx.fillStyle = '#ac3232'; ctx.fillRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h);
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px monospace';
                ctx.fillText('承認', p.x - 12, p.y + 4);
            }
        } else {
            // 通常弾（判定サイズ10に対して2.6倍の26x26スクエアで大きく見やすく描画）
            if (gameImages.bulletNormal.complete && gameImages.bulletNormal.width > 0) {
                const drawSize = 36;
                ctx.drawImage(gameImages.bulletNormal, p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
            } else {
                ctx.fillStyle = p.color; ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
            }
        }
        ctx.restore();
    });

    bossBullets.forEach(b => {
        ctx.save();
        ctx.fillStyle = bossStages[currentBossIdx].color;
        ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); // クッキリ四角形ドット弾
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
        ctx.restore();
    });

    drawPlayer(ctx, player.x, player.y, player.w, player.h);
    if (gameState === 'BOSS') {
        drawBoss(ctx, boss, bossStages[currentBossIdx].type);
    }

    // --- レトロドット風UIフレーム表示層 ---
    ctx.save();
    ctx.fillStyle = '#ffffff'; 

    if (gameState === 'STAGE' || gameState === 'BOSS' || gameState === 'WARNING' || gameState === 'PAUSE') {
        // UI上部フレーム
        ctx.fillStyle = '#321c14'; ctx.fillRect(10, 10, canvas.width - 20, 75);
        ctx.strokeStyle = '#964b00'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, canvas.width - 20, 75);

        ctx.fillStyle = '#fee761'; ctx.font = 'bold 16px monospace';
        ctx.fillText(`SCORE: ${String(score).padStart(6, '0')}`, 30, 40);
        ctx.fillText(`DOCS: ${candyCount}枚`, 230, 40);
        ctx.fillText(`STOCK: ${Math.floor(candyCount / 5)} [Q:ハンコ / E:有給バリア]`, 380, 40);

        // ハートライフメーター
        ctx.fillStyle = '#e43b44';
        for (let i = 0; i < player.maxHp; i++) {
            ctx.fillText(i < player.hp ? '■' : '□', 30 + i * 20, 68);
        }
        ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace';
        ctx.fillText('HP:', 30, 54);

        // ボスHPバー (最下部に独立配置)
        if (gameState === 'BOSS' || (gameState === 'PAUSE' && prePauseState === 'BOSS')) {
            ctx.save();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
            ctx.fillText(bossStages[currentBossIdx].name, canvas.width / 2, canvas.height - 48);

            ctx.fillStyle = '#1a1c2c'; ctx.fillRect(canvas.width / 2 - 180, canvas.height - 35, 360, 16);
            let hpWidth = (boss.hp / boss.maxHp) * 360;
            ctx.fillStyle = bossStages[currentBossIdx].color;
            ctx.fillRect(canvas.width / 2 - 180, canvas.height - 35, hpWidth, 16);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(canvas.width / 2 - 180, canvas.height - 35, 360, 16);
            ctx.restore();
        }
    }

    if (gameState === 'WARNING') {
        ctx.save();
        ctx.fillStyle = `rgba(228, 59, 68, ${flashAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fee761'; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center';
        ctx.fillText('WARNING !', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '18px monospace'; ctx.fillStyle = '#ffffff';
        ctx.fillText(`【警告】${bossStages[currentBossIdx].name} がエンカウントしました！`, canvas.width / 2, canvas.height / 2 + 25);
        ctx.restore();
    }

    ctx.textAlign = 'center';
    if (gameState === 'TITLE') {
        ctx.fillStyle = 'rgba(20, 16, 19, 0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawPlayer(ctx, canvas.width/2 - 24, canvas.height/2 - 160, player.w, player.h);
        
        ctx.fillStyle = '#fee761'; ctx.font = 'bold 40px monospace';
        ctx.fillText('サラリーRUN', canvas.width / 2, canvas.height / 2 - 25);
        ctx.font = '16px monospace'; ctx.fillStyle = '#ffffff';
        ctx.fillText('--- ファイルを集めて、走り出せ！ ---', canvas.width / 2, canvas.height / 2 + 15);

        ctx.fillStyle = '#321c14'; ctx.fillRect(canvas.width / 2 - 270, canvas.height / 2 + 55, 540, 210);
        ctx.strokeStyle = '#964b00'; ctx.lineWidth = 3; ctx.strokeRect(canvas.width / 2 - 270, canvas.height / 2 + 55, 540, 210);

        ctx.fillStyle = '#fee761'; ctx.font = 'bold 16px monospace';
        ctx.fillText('🎮 KEYBOARD MANUAL 🎮', canvas.width / 2, canvas.height / 2 + 85);
        ctx.font = '16px monospace'; ctx.fillStyle = '#ffffff';
        ctx.fillText('[ Space ] ジャンプ', canvas.width / 2, canvas.height / 2 + 115);
        ctx.fillText('[ 矢印 ] ボス戦移動', canvas.width / 2, canvas.height / 2 + 145);
        ctx.fillText(' [ Q ] 大ダメージ！', canvas.width / 2, canvas.height / 2 + 175);
        ctx.fillText(' [ E ] バリア', canvas.width / 2, canvas.height / 2 + 205);
        ctx.fillText('[ Esc ]一時停止', canvas.width / 2, canvas.height / 2 + 235);

    } else if (gameState === 'INSTRUCTION') {
        // 👇 【ここを追加】新しく案内画面の描画レイヤーを追加
        ctx.fillStyle = 'rgba(20, 16, 19, 0.95)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 案内枠の表示
        ctx.fillStyle = '#321c14'; ctx.fillRect(canvas.width / 2 - 320, canvas.height / 2 - 130, 640, 260);
        ctx.strokeStyle = '#964b00'; ctx.lineWidth = 3; ctx.strokeRect(canvas.width / 2 - 320, canvas.height / 2 - 130, 640, 260);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fee761'; ctx.font = 'bold 24px monospace';
        ctx.fillText('ルール説明', canvas.width / 2, canvas.height / 2 - 80);

        // ご指定の案内テキスト（センタリング配置）
        ctx.fillStyle = '#ffffff'; ctx.font = '20px monospace';
        ctx.fillText('ファイルを集めて、障害物を避けよう！', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('コーヒーでHP回復！', canvas.width / 2, canvas.height / 2 + 30);

        // アクションを促すテキスト
        ctx.fillStyle = '#38b549'; ctx.font = 'bold 18px monospace';
        ctx.fillText('[ Space ] でゲーム開始！', canvas.width / 2, canvas.height / 2 + 90);

    } else if (gameState === 'PAUSE') {
        ctx.fillStyle = 'rgba(15, 15, 20, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#321c14'; ctx.fillRect(canvas.width / 2 - 300, canvas.height / 2 - 210, 600, 420);
        ctx.strokeStyle = '#964b00'; ctx.lineWidth = 4; ctx.strokeRect(canvas.width / 2 - 300, canvas.height / 2 - 210, 600, 420);

        ctx.fillStyle = '#fee761'; ctx.font = 'bold 28px monospace';
        ctx.fillText('⏸️ PAUSE', canvas.width / 2, canvas.height / 2 - 140);

        /*
        ctx.fillStyle = '#ffb3d9'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
        ctx.fillText('📝 業務の概要', canvas.width / 2 - 250, canvas.height / 2 - 100);
        ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace';
        ctx.fillText('飛び交う未読メールや山積みのタスク書類を華麗に跳び越え、書類を集めよう！', canvas.width / 2 - 250, canvas.height / 2 - 75);
        ctx.fillText('書類5枚ごとに、上司を撃退する大技(Q)や有給バリア(E)が発動可能。', canvas.width / 2 - 250, canvas.height / 2 - 55);
        ctx.fillText('全5フロアの個性的な上司やクライアントを満足（撃破）させて脱出だ！', canvas.width / 2 - 250, canvas.height / 2 - 35);
        */

        ctx.fillStyle = '#cbdcff'; ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🛠️ 操作方法', canvas.width / 2, canvas.height / 2 - 60);
        
        ctx.fillStyle = '#ffffff'; ctx.font = '20px monospace';
        ctx.fillText('・ジャンプ ： [ Space ]', canvas.width / 2, canvas.height / 2 - 25);
        ctx.fillText('・ボス戦の自由移動 ： [ 矢印 ] キー', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('・ハンコ特大弾 ： [ Q ] (書類5枚消費)', canvas.width / 2, canvas.height / 2 + 45);
        ctx.fillText('・バリア ： [ E ] キー (書類5枚消費)', canvas.width / 2, canvas.height / 2 + 80);

        ctx.textAlign = 'center'; ctx.fillStyle = '#38b549'; ctx.font = 'bold 20px monospace';
        ctx.fillText('[ Space ] で再開', canvas.width / 2, canvas.height / 2 + 160);

    } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(20, 10, 15, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e43b44'; ctx.font = 'bold 44px monospace'; ctx.fillText('OVERTIME EXHAUSTION', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff'; ctx.font = '16px monospace';
        ctx.fillText('（残業過多で力尽きてしまった...）', canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`回収した書類: ${candyCount} 枚`, canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText('[ Space ] キーで受付へ戻る', canvas.width / 2, canvas.height / 2 + 110);
    } else if (gameState === 'CLEAR') {
        ctx.fillStyle = 'rgba(15, 25, 20, 0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#38b549'; ctx.font = 'bold 44px monospace'; ctx.fillText('PUNCH OUT! EXIT BUILDING', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff'; ctx.font = '16px monospace';
        ctx.fillText('祝！すべての業務を完遂し、完全定時退社を達成した！', canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`最終書類ストック: ${candyCount} 枚`, canvas.width / 2, canvas.height / 2 + 65);
        ctx.fillText('[ Space ] キーでタイトル画面へ', canvas.width / 2, canvas.height / 2 + 120);
    }
    ctx.restore();
}

let lastTime = 0;
let timeAccumulator = 0;
const tickRate = 1000 / 120; // ★ゲームの計算速度を「120FPSの爆速スピード」に設定

function loop(currentTime) {
    requestAnimationFrame(loop);

    // 前回のフレームからの経過時間を計算
    const elapsed = currentTime - lastTime;
    lastTime = currentTime;

    // 経過時間をプール（蓄積）していく
    timeAccumulator += elapsed;

    // 120FPSのペース（約8.33ミリ秒）が貯まった分だけ、updateを小分けに実行する
    // ※これにより、どのパソコンでもゲームの進む速度が「120Hzの速度」で完全に一致します！
    while (timeAccumulator >= tickRate) {
        update();
        timeAccumulator -= tickRate;
    }

    // 画面の描画はブラウザの最大性能（60Hzなら60回、120Hzなら120回）で行う
    draw();
}

// 初回のループを開始
requestAnimationFrame((timestamp) => {
    lastTime = timestamp;
    loop(timestamp);
});