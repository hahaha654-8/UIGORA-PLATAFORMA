/* script.js - QUIMERHAA18-4-9 Digital Hub */

/* =========================
   SUPABASE INIT
========================= */

const supabaseUrl = "https://ojozfdqatllpodvmqhor.supabase.co";
const supabaseKey = "sb_publishable_CEA4LYluZrICBfHAkgwH0A_UyC6GQOf";

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

/* =========================
   PAYMENT STATE
========================= */

let paymentApproved = localStorage.getItem("paymentApproved") === "true";

/* =========================
   DOM READY
========================= */

document.addEventListener('DOMContentLoaded', () => {

/* =========================
   PRELOADER
========================= */

const loader = document.querySelector('.loader');
const loaderBar = document.querySelector('.loader-bar');

let progress = 0;

const interval = setInterval(() => {

progress += Math.random() * 30;
if (progress > 100) progress = 100;

if (loaderBar) loaderBar.style.width = `${progress}%`;

if (progress === 100) {

clearInterval(interval);

setTimeout(() => {

if (loader) loader.style.opacity = '0';
document.body.classList.remove('loading');

setTimeout(() => {
if (loader) loader.style.display = 'none';
}, 800);

}, 500);

}

}, 200);

/* =========================
   FAN FORM (CHALLENGE CHECKOUT LOGIC)
========================= */

let pendingChallengeData = null; // Guardar dados temporariamente

const fanForm = document.getElementById('fan-form');

if (fanForm) {

fanForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const name = this.name.value;
    const videoInput = document.getElementById("fan-video");
    const videoFile = videoInput?.files?.[0];

    if (!name || !videoFile) {
        alert("📢 Nome e Vídeo são obrigatórios para o desafio.");
        return;
    }

    // Guardar no "carrinho"
    pendingChallengeData = { name, videoFile };

    alert("✨ Vídeo capturado! Agora, efetue o pagamento da cota de 500 KZ para finalizar sua participação.");
    
    // Redirecionar e preencher valor
    const supportSection = document.getElementById("support");
    const amountInput = document.getElementById("donation-amount");
    
    if (supportSection) supportSection.scrollIntoView({ behavior: 'smooth' });
    if (amountInput) {
        amountInput.value = "500";
        amountInput.disabled = true; // Forçar o valor da cota
    }
});

}

/* =========================
   SUPPORT SYSTEM LOGIC
========================= */

const methodSelect = document.getElementById("payment-method");
const details = document.getElementById("payment-details");
const info = document.getElementById("payment-info");
const receiptBox = document.getElementById("receipt-box");
const amountInput = document.getElementById("donation-amount");

if (methodSelect) {

methodSelect.addEventListener("change", () => {
    const amount = amountInput?.value || "500";
    const method = methodSelect.value;

    if (!method) {
        if (details) details.style.display = "none";
        if (receiptBox) receiptBox.style.display = "none";
        return;
    }

    if (details) details.style.display = "block";
    if (receiptBox) receiptBox.style.display = "block";

    if (info) {
        if (method === "paypal") {
            info.innerHTML = `<b>PayPal</b><br><br>Envie <b>${amount} KZ</b> para:<br>📧 lufundissomorais@gmail.com`;
        } else if (method === "iban") {
            info.innerHTML = `<b>Transferência Bancária</b><br><br>Envie <b>${amount} KZ</b> para:<br>🏦 IBAN: AO06: 0040 0000.0436.7365.1018.6 - Morais Lufundisso` ;
        } else if (method === "multicaixa") {
            info.innerHTML = `<b>Multicaixa Express</b><br><br>Envie <b>${amount} KZ</b> para:<br>📱 Número: 942197485`;
        }
    }
});

}

/* =========================
   SUPPORT SYSTEM (FINAL UPLOAD)
========================= */

const supportForm = document.getElementById('support-form');
const supportButton = document.getElementById("support-button");

if (supportForm) {

supportForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const amount = document.getElementById("donation-amount")?.value;
    const method = document.getElementById("payment-method")?.value;
    const receiptFile = document.getElementById("receipt-file")?.files?.[0];

    if (!method || !receiptFile) {
        alert("📢 Selecione o método e anexe o comprovativo.");
        return;
    }

    // Mudar texto do botão para carregando
    const originalText = supportButton.innerText;
    supportButton.innerText = "A carregar... ⏳";
    supportButton.disabled = true;

    try {
        let finalVideoUrl = null;

        // 1. SE HOUVER VÍDEO PENDENTE, CARREGA PRIMEIRO
        if (pendingChallengeData) {
            const videoName = `${Date.now()}_CHALLENGE_${pendingChallengeData.videoFile.name}`;
            const { error: videoError } = await db.storage
                .from("fan_videos")
                .upload(videoName, pendingChallengeData.videoFile);

            if (videoError) throw videoError;

            const { data: vData } = db.storage.from("fan_videos").getPublicUrl(videoName);
            finalVideoUrl = vData.publicUrl;

            // Criar registro na fan_messages
            await db.from("fan_messages").insert([{
                name: pendingChallengeData.name,
                message: "Participação no Desafio (Cota Paga)",
                video_url: finalVideoUrl,
                views: 0
            }]);
        }

        // 2. CARREGAR COMPROVATIVO
        const receiptName = `${Date.now()}_RECEIPT_${receiptFile.name}`;
        const { error: receiptError } = await db.storage
            .from("receipts")
                .upload(receiptName, receiptFile);

        if (receiptError) throw receiptError;

        const { data: rData } = db.storage.from("receipts").getPublicUrl(receiptName);

        // Criar registro na donations
        await db.from("donations").insert([{
            amount,
            payment_method: method,
            receipt_url: rData.publicUrl,
            status: "pending"
        }]);

        // 3. FINALIZADO
        alert("✅ Carregamento Finalizado! Sua participação foi registada com sucesso.");
        
        // Limpar tudo
        pendingChallengeData = null;
        this.reset();
        if (fanForm) fanForm.reset();
        if (typeof loadFanMessages === 'function') loadFanMessages();
        if (typeof loadStats === 'function') loadStats();

    } catch (e) {
        console.error(e);
        alert("❌ Erro ao enviar. Tente novamente.");
    } finally {
        supportButton.innerText = originalText;
        supportButton.disabled = false;
    }
});

}

async function deleteVideo(id, videoUrl) {

try {

/* 1. apagar da tabela */
await db
.from("fan_messages")
.delete()
.eq("id", id);

/* 2. apagar do storage fan_videos */
if (videoUrl && videoUrl.includes("fan_videos")) {
    const fileName = videoUrl.split("/").pop();
    await db.storage
    .from("fan_videos")
    .remove([fileName]);
}

loadFanMessages();

} catch (e) {
console.log("ERRO DELETE:", e);
}

}

/* =========================
   SISTEMA DE VIEWS (ESTILO YOUTUBE - REFIXED)
========================= */

function observeVideoViews() {
    const videos = document.querySelectorAll(".fan-video");

    videos.forEach((video) => {
        let lastPosition = 0;
        let viewCounted = false;
        let watchTimeStarted = false;

        video.addEventListener("play", () => {
            const videoId = video.dataset.id;
            
            // 1. Verificar Cooldown (1 hora para a mesma pessoa/vídeo)
            const lastView = localStorage.getItem("yt_view_" + videoId);
            const now = Date.now();
            if (lastView && (now - lastView) < (60 * 60 * 1000)) {
                viewCounted = true; // Bloqueia contagem nesta sessão se já viu recentemente
                return;
            }
            watchTimeStarted = true;
        });

        video.addEventListener("timeupdate", () => {
            if (viewCounted || !watchTimeStarted) return;

            // 2. Prevenção de Skip (Se pular mais de 3 segundos, invalida a sessão)
            if (video.currentTime - lastPosition > 3.0) {
                console.log("Salto detectado. View cancelada nesta sessão.");
                watchTimeStarted = false;
                return;
            }
            lastPosition = video.currentTime;

            // 3. Regra dos 30% ou 15 segundos (Padrão YouTube)
            const requiredTime = Math.min(15, video.duration * 0.3);
            
            if (video.currentTime >= requiredTime && !viewCounted) {
                viewCounted = true;
                handleViewUpdate(video.dataset.id);
            }
        });

        // 4. Se o vídeo terminar, conta a view se ainda não foi contada
        video.addEventListener("ended", () => {
            if (!viewCounted && watchTimeStarted) {
                viewCounted = true;
                handleViewUpdate(video.dataset.id);
            }
        });

        video.addEventListener("pause", () => {
            lastPosition = video.currentTime;
        });
    });
}

async function handleViewUpdate(videoId) {
    // Registrar timestamp no navegador para o cooldown de 1h
    localStorage.setItem("yt_view_" + videoId, Date.now());

    try {
        // Incremento Real na DB usando RPC para performance e precisão
        const { error } = await db.rpc('increment_video_views', { video_id: videoId });

        if (error) {
            // Fallback caso a RPC não esteja configurada: Método antigo (menos eficiente)
            const { data: row } = await db.from("fan_messages").select("views").eq("id", videoId).maybeSingle();
            if (row) {
                await db.from("fan_messages").update({ views: (row.views || 0) + 1 }).eq("id", videoId);
            }
        }

        // ATUALIZAÇÃO AUTOMÁTICA NA TELA
        const display = document.getElementById(`view-count-${videoId}`);
        if (display) {
            const currentText = display.innerText.match(/\d+/);
            const currentViews = currentText ? parseInt(currentText[0]) : 0;
            display.innerHTML = `👁 ${currentViews + 1} views`;
            display.style.color = "#00ffe1";
        }
    } catch (e) {
        console.error("❌ Erro ao atualizar views:", e);
    }
}

/* =========================
   LOAD FAN MESSAGES (STRICT FILTER & LIMIT)
========================= */

async function loadFanMessages() {
    const { data, error } = await db
        .from("fan_messages")
        .select("*")
        .order("views", { ascending: false })
        .limit(12); // Limita aos 12 melhores/mais recentes no feed inicial

    if (error) {
        console.error(error);
        return;
    }

    if (!fanFeed) return;
    fanFeed.innerHTML = "";

    data.forEach((msg, index) => {
        // FILTRO RIGOROSO: Só mostra se tiver mensagem E vídeo válido (URL começando com http)
        const hasValidVideo = 
            msg.video_url && 
            msg.video_url.trim() !== "" && 
            msg.video_url.toLowerCase().startsWith("http");

        const hasValidMessage = msg.message && msg.message.trim() !== "";

        // Se o vídeo foi deletado da DB (ou da pasta de vídeos), ele simplesmente não entra no array
        if (!hasValidVideo || !hasValidMessage) return;

        let rank = "";
        if (index === 0) rank = "🥇 1º";
        if (index === 1) rank = "🥈 2º";
        if (index === 2) rank = "🥉 3º";

        const card = document.createElement("div");
        card.className = "fan-card";
        card.id = `card-${msg.id}`;
        card.style.opacity = "0"; // Começa invisível
        card.style.transition = "opacity 0.5s ease";

        card.innerHTML = `
            ${rank ? `<div class="rank-badge">${rank}</div>` : ""}
            <p class="fan-message">"${msg.message}"</p>
            <span class="fan-name">@${(msg.name || "anonimo").toLowerCase().replace(/\s/g,'')}</span>
            
            <div class="video-wrapper">
                <video
                    class="fan-video"
                    data-id="${msg.id}"
                    controls
                    preload="metadata"
                    style="width:100%; border-radius:12px; margin-top:10px; background:#000;"
                    onloadedmetadata="this.closest('.fan-card').style.opacity = '1';" 
                    onerror="this.closest('.fan-card').remove();"
                >
                    <source src="${msg.video_url}">
                </video>
                <div class="video-views" id="view-count-${msg.id}">
                    👁 ${msg.views || 0} views
                </div>
            </div>
        `;

        fanFeed.appendChild(card);

        // Se após 3 segundos o vídeo não carregou, remove o "fantasma" por segurança
        setTimeout(() => {
            if (card && card.style.opacity === "0") {
                card.remove();
            }
        }, 3000);
    });

    observeVideoViews();
}

/* =========================
   HEADER SCROLL
========================= */

const header = document.querySelector('header');

window.addEventListener('scroll', () => {

if (!header) return;

if (window.scrollY > 50) {
header.style.padding = '15px 0';
header.style.background = 'rgba(5, 5, 7, 0.95)';
} else {
header.style.padding = '25px 0';
header.style.background = 'rgba(5, 5, 7, 0.8)';
}

});

/* =========================
   COUNTDOWNS SYSTEM (PREMIUM FLIP)
========================= */

function initCountdowns() {
    // 1. Countdown de Lançamento (Premium Flip Clock)
    const launchBox = document.querySelector(".countdown-box");
    
    if (launchBox) {
        const releaseDate = new Date(launchBox.dataset.release).getTime();
        
        const flip = (cardId, newValue) => {
            const card = document.getElementById(cardId);
            if (!card) return;

            const top = card.querySelector(".top");
            const bottom = card.querySelector(".bottom");
            const topFlip = card.querySelector(".top-flip");
            const bottomFlip = card.querySelector(".bottom-flip");

            const startValue = top.textContent;
            newValue = String(newValue).padStart(2, "0");

            if (newValue === startValue) return;

            // Prepara valores
            topFlip.textContent = startValue;
            bottomFlip.textContent = newValue;
            top.textContent = newValue;
            bottom.textContent = startValue;

            // Dispara animação
            card.classList.remove("flipping");
            void card.offsetWidth; // Trigger reflow
            card.classList.add("flipping");

            // Limpa após animação
            card.addEventListener("animationend", (e) => {
                if (e.animationName === "flip-bottom") {
                    card.classList.remove("flipping");
                    bottom.textContent = newValue;
                }
            }, { once: true });
        };

        const updateLaunch = () => {
            const now = new Date().getTime();
            const dist = releaseDate - now;

            if (dist <= 0) {
                launchBox.innerHTML = "<h3 class='main-title' style='font-size:3rem;'>DISPONÍVEL AGORA</h3>";
                return;
            }

            const d = Math.floor(dist / (1000 * 60 * 60 * 24));
            const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((dist % (1000 * 60)) / 1000);

            flip("days-card", d);
            flip("hours-card", h);
            flip("minutes-card", m);
            flip("seconds-card", s);
        };

        setInterval(updateLaunch, 1000);
        updateLaunch();
    }

    // 2. Countdown do Desafio do Sol (Sun Number Style - Simples)
    const challengeBox = document.getElementById("main-countdown");
    if (challengeBox) {
        const endDate = new Date(challengeBox.dataset.release || "2026-05-21T23:59:59").getTime();
        const updateChallenge = () => {
            const now = new Date().getTime();
            const dist = endDate - now;
            if (dist <= 0) {
                challengeBox.innerHTML = "<div class='sun-number'>ENCERRADO</div>";
                return;
            }
            const d = Math.floor(dist / (1000 * 60 * 60 * 24));
            const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((dist % (1000 * 60)) / 1000);

            const setSun = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(val).padStart(2, "0");
            };
            setSun("sun-days", d); setSun("sun-hours", h); setSun("sun-minutes", m); setSun("sun-seconds", s);
        };
        setInterval(updateChallenge, 1000);
        updateChallenge();
    }
}

initCountdowns();

/* =========================
   VISIT REGISTRATION
========================= */

async function registrarVisita() {

try {

await db.from("visitas").insert([{
user_agent: navigator.userAgent
}]);

} catch (e) {
console.log(e);
}

}

setTimeout(registrarVisita, 2000);

/* =========================
   STATS SYSTEM OPTIMIZED
========================= */

async function loadStats() {
    try {
        // Busca todas as contagens em paralelo (muito mais rápido)
        const [resMessages, resDonations, resVisits] = await Promise.all([
            db.from("fan_messages").select('*', { count: 'exact', head: true }),
            db.from("donations").select('*', { count: 'exact', head: true }),
            db.from("visitas").select('*', { count: 'exact', head: true })
        ]);

        const messages = resMessages.count || 0;
        const donations = resDonations.count || 0;
        const visits = resVisits.count || 0;

        const online = Math.max(1, Math.floor(visits / 10));

        const updateEl = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        updateEl("stat-messages", `${messages} mensagens`);
        updateEl("stat-donations", `${donations} doações`);
        updateEl("stat-visits", `${visits} visitas`);
        updateEl("stat-online", `${online} online`);

    } catch (e) {
        console.error("Erro ao carregar estatísticas:", e);
    }
}

loadStats();
setInterval(loadStats, 5000);

});