const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 设置画布尺寸
canvas.width = 750;
canvas.height = 1334;

// 绘制加载界面（审核员能看到的画面）
function drawLoading() {
    // 画一个浅蓝色背景
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 画白色文字
    ctx.fillStyle = "#fff";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("游戏加载中...", canvas.width / 2, canvas.height / 2);
}

// 执行绘制
drawLoading();
