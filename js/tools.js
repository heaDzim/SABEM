// Tools JavaScript - SABEM

// Initialização das ferramentas
document.addEventListener('DOMContentLoaded', function() {
    initBreathingTimer();
    initHabitTracker();
    initEmotionalDiary();
    initWellnessCalculator();
    initQuickActions();
});

// Timer de respiração
function initBreathingTimer() {
    const startBtn = document.getElementById('startBreathing');
    const pauseBtn = document.getElementById('pauseBreathing');
    const stopBtn = document.getElementById('stopBreathing');
    const circle = document.getElementById('breathingCircle');
    const text = document.getElementById('breathingText');
    const cycleCount = document.getElementById('cycleCount');
    const sessionTime = document.getElementById('sessionTime');
    const techniqueSelect = document.getElementById('breathingTechnique');

    let isRunning = false;
    let isPaused = false;
    let currentCycle = 0;
    let startTime = 0;
    let pausedTime = 0;
    let breathingInterval;
    let timeInterval;

    const techniques = {
        '478': {
            name: '4-7-8',
            phases: [
                { name: 'Inspire', duration: 4000, scale: 1.5 },
                { name: 'Segure', duration: 7000, scale: 1.5 },
                { name: 'Expire', duration: 8000, scale: 1 }
            ]
        },
        'box': {
            name: 'Quadrada',
            phases: [
                { name: 'Inspire', duration: 4000, scale: 1.5 },
                { name: 'Segure', duration: 4000, scale: 1.5 },
                { name: 'Expire', duration: 4000, scale: 1 },
                { name: 'Segure', duration: 4000, scale: 1 }
            ]
        },
        'coherent': {
            name: 'Coerente',
            phases: [
                { name: 'Inspire', duration: 5000, scale: 1.5 },
                { name: 'Expire', duration: 5000, scale: 1 }
            ]
        }
    };

    startBtn.addEventListener('click', startBreathing);
    pauseBtn.addEventListener('click', pauseBreathing);
    stopBtn.addEventListener('click', stopBreathing);

    function startBreathing() {
        if (!isRunning) {
            isRunning = true;
            startTime = Date.now() - pausedTime;
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'inline-flex';
            
            runBreathingCycle();
            startTimer();
        }
    }

    function pauseBreathing() {
        if (isRunning && !isPaused) {
            isPaused = true;
            pausedTime = Date.now() - startTime;
            clearInterval(breathingInterval);
            clearInterval(timeInterval);
            text.textContent = 'Pausado';
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Continuar';
        } else if (isPaused) {
            isPaused = false;
            startTime = Date.now() - pausedTime;
            runBreathingCycle();
            startTimer();
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        }
    }

    function stopBreathing() {
        isRunning = false;
        isPaused = false;
        pausedTime = 0;
        clearInterval(breathingInterval);
        clearInterval(timeInterval);
        
        startBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        
        circle.style.transform = 'scale(1)';
        text.textContent = 'Clique para começar';
    }

    function runBreathingCycle() {
        if (!isRunning || isPaused) return;

        const technique = techniques[techniqueSelect.value];
        let phaseIndex = 0;

        function nextPhase() {
            if (!isRunning || isPaused) return;

            const phase = technique.phases[phaseIndex];
            text.textContent = phase.name;
            circle.style.transform = `scale(${phase.scale})`;
            circle.style.transition = `transform ${phase.duration}ms ease-in-out`;

            breathingInterval = setTimeout(() => {
                phaseIndex = (phaseIndex + 1) % technique.phases.length;
                if (phaseIndex === 0) {
                    currentCycle++;
                    cycleCount.textContent = currentCycle;
                }
                nextPhase();
            }, phase.duration);
        }

        nextPhase();
    }

    function startTimer() {
        timeInterval = setInterval(() => {
            if (!isPaused) {
                const elapsed = Date.now() - startTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                sessionTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
}

// Tracker de hábitos
function initHabitTracker() {
    // O Tracker de Hábitos é carregado e atualizado pelo persistence.js/Supabase.    
}

// Diário emocional
function initEmotionalDiary() {
    const moodBtns = document.querySelectorAll('.mood-btn');
    const tags = document.querySelectorAll('.tag');

    moodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            moodBtns.forEach(item => item.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });
}

// Calculadora de Bem-estar
function initWellnessCalculator() {
    const sliders = document.querySelectorAll('.slider');
    const calculateBtn = document.getElementById('calculateWellness');
    const resultsDiv = document.getElementById('wellnessResults');

    sliders.forEach(slider => {
        const valueSpan = document.getElementById(slider.id + 'Value');
        
        slider.addEventListener('input', function() {
            updateSliderValue(this, valueSpan);
        });
        
        // Valores iniciais
        updateSliderValue(slider, valueSpan);
    });

    calculateBtn.addEventListener('click', calculateWellness);

    function updateSliderValue(slider, valueSpan) {
        const value = parseInt(slider.value);
        const id = slider.id;
        
        switch(id) {
            case 'exercise':
                valueSpan.textContent = `${value} dias`;
                break;
            case 'relaxation':
                valueSpan.textContent = `${value} vezes/semana`;
                break;
            default:
                valueSpan.textContent = `${value}/10`;
        }
    }

    function calculateWellness() {
        const exercise = parseInt(document.getElementById('exercise').value);
        const sleep = parseInt(document.getElementById('sleep').value);
        const nutrition = parseInt(document.getElementById('nutrition').value);
        const stress = parseInt(document.getElementById('stress').value);
        const satisfaction = parseInt(document.getElementById('satisfaction').value);
        const relaxation = parseInt(document.getElementById('relaxation').value);

        // Calcular score (0-100) Sempre -100
        const exerciseScore = (exercise / 7) * 20;
        const sleepScore = (sleep / 10) * 15;
        const nutritionScore = (nutrition / 10) * 15;
        const stressScore = ((10 - stress) / 10) * 20;
        const satisfactionScore = (satisfaction / 10) * 20;
        const relaxationScore = (relaxation / 7) * 10;

        const totalScore = Math.round(exerciseScore + sleepScore + nutritionScore + stressScore + satisfactionScore + relaxationScore);

        displayResults(totalScore, {
            exercise: exerciseScore,
            sleep: sleepScore,
            nutrition: nutritionScore,
            stress: stressScore,
            satisfaction: satisfactionScore,
            relaxation: relaxationScore
        });
    }

    function displayResults(score, breakdown) {
        const scoreElement = document.getElementById('wellnessScore');
        const levelElement = document.getElementById('wellnessLevel');
        const recommendationsList = document.getElementById('recommendationsList');

        scoreElement.textContent = score;
        
        let level, recommendations;
        if (score >= 80) {
            level = 'Excelente';
            levelElement.style.color = '#4CAF50';
            recommendations = [
                'Continue mantendo seus excelentes hábitos!',
                'Considere ajudar outros em sua jornada de bem-estar',
                'Explore novas atividades para manter a motivação'
            ];
        } else if (score >= 60) {
            level = 'Bom';
            levelElement.style.color = '#FF9800';
            recommendations = [
                'Você está no caminho certo! Continue assim.',
                'Identifique áreas específicas para melhorar',
                'Estabeleça metas pequenas e alcançáveis'
            ];
        } else if (score >= 40) {
            level = 'Regular';
            levelElement.style.color = '#FF5722';
            recommendations = [
                'Há espaço para melhorias significativas',
                'Comece com mudanças pequenas e graduais',
                'Considere buscar apoio profissional'
            ];
        } else {
            level = 'Precisa de Atenção';
            levelElement.style.color = '#f44336';
            recommendations = [
                'É importante priorizar seu bem-estar agora',
                'Comece com um hábito por vez',
                'Busque apoio de profissionais de saúde'
            ];
        }

        levelElement.textContent = level;

        // Add specific recommendations based on low scores
        if (breakdown.exercise < 10) recommendations.push('Aumente gradualmente sua atividade física');
        if (breakdown.sleep < 10) recommendations.push('Melhore sua higiene do sono');
        if (breakdown.nutrition < 10) recommendations.push('Foque em uma alimentação mais equilibrada');
        if (breakdown.stress < 10) recommendations.push('Pratique técnicas de gerenciamento do estresse');
        if (breakdown.relaxation < 5) recommendations.push('Inclua mais práticas de relaxamento na rotina');

        recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

// Ações rápidas
function initQuickActions() {
    const actionBtns = document.querySelectorAll('.action-btn');
    const actionResult = document.getElementById('actionResult');

    const actions = {
        anxietyHelp: {
            title: 'Ajuda para Ansiedade',
            content: `
                <h4>Técnica 5-4-3-2-1 para Ansiedade</h4>
                <p>Identifique ao seu redor:</p>
                <ul>
                    <li><strong>5 coisas</strong> que você pode ver</li>
                    <li><strong>4 coisas</strong> que você pode tocar</li>
                    <li><strong>3 coisas</strong> que você pode ouvir</li>
                    <li><strong>2 coisas</strong> que você pode cheirar</li>
                    <li><strong>1 coisa</strong> que você pode saborear</li>
                </ul>
                <p>Esta técnica ajuda a trazer sua mente de volta ao presente.</p>
            `
        },
        stressRelief: {
            title: 'Alívio do Estresse',
            content: `
                <h4>Relaxamento Muscular Progressivo</h4>
                <ol>
                    <li>Sente-se confortavelmente</li>
                    <li>Comece pelos pés: contraia por 5 segundos, depois relaxe</li>
                    <li>Suba pelas pernas, abdômen, braços até a cabeça</li>
                    <li>Observe a diferença entre tensão e relaxamento</li>
                    <li>Respire profundamente durante todo o processo</li>
                </ol>
            `
        },
        energyBoost: {
            title: 'Aumentar Energia',
            content: `
                <h4>Exercícios Rápidos para Energia</h4>
                <ul>
                    <li><strong>Polichinelos:</strong> 30 segundos</li>
                    <li><strong>Respiração energizante:</strong> Inspire rápido pelo nariz, expire pela boca (10x)</li>
                    <li><strong>Alongamento:</strong> Braços para cima, torção do tronco</li>
                    <li><strong>Hidratação:</strong> Beba um copo de água</li>
                </ul>
            `
        },
        sleepHelp: {
            title: 'Ajuda para Dormir',
            content: `
                <h4>Rotina de Relaxamento para o Sono</h4>
                <ol>
                    <li>Desligue telas 1 hora antes de dormir</li>
                    <li>Pratique respiração 4-7-8 (3 ciclos)</li>
                    <li>Faça um escaneamento corporal mental</li>
                    <li>Pense em 3 coisas pelas quais é grato</li>
                    <li>Mantenha o quarto fresco e escuro</li>
                </ol>
            `
        },
        motivationBoost: {
            title: 'Motivação',
            content: `
                <h4>Frases Motivacionais</h4>
                <blockquote>"Cada pequeno passo conta na jornada para uma vida mais saudável."</blockquote>
                <p><strong>Lembre-se:</strong></p>
                <ul>
                    <li>Você já começou, isso é o mais difícil</li>
                    <li>Progresso é mais importante que perfeição</li>
                    <li>Cada dia é uma nova oportunidade</li>
                    <li>Você é mais forte do que imagina</li>
                </ul>
            `
        },
        gratitudePractice: {
            title: 'Prática de Gratidão',
            content: `
                <h4>Exercício de Gratidão</h4>
                <p>Pense e anote mentalmente:</p>
                <ol>
                    <li><strong>3 coisas boas</strong> que aconteceram hoje</li>
                    <li><strong>1 pessoa</strong> pela qual você é grato</li>
                    <li><strong>1 aspecto do seu corpo</strong> que funciona bem</li>
                    <li><strong>1 oportunidade</strong> que você tem</li>
                </ol>
                <p>A gratidão melhora o humor e reduz o estresse.</p>
            `
        }
    };

    actionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const actionId = this.id;
            const action = actions[actionId];
            
            if (action) {
                actionResult.innerHTML = `
                    <div class="action-content">
                        <h3>${action.title}</h3>
                        ${action.content}
                        <button class="btn btn-secondary" onclick="closeActionResult()">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                `;
                actionResult.style.display = 'block';
                actionResult.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    window.closeActionResult = function() {
        actionResult.style.display = 'none';
    };
}

// Avisos 
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : 'info'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// O reset diário é calculado pelo Supabase a partir de completed_on.
