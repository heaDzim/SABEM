// SABEM — persistência e ajustes de interface.
(function () {
  function whenReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  function notify(message, type = 'info') {
    if (typeof showNotification === 'function') showNotification(message, type);
    else console[type === 'warning' ? 'warn' : 'log'](message);
  }

  whenReady(async function () {
    if (!window.SABEM) return;

    const profile = await SABEM.carregarPerfil().catch(() => null);
    if (profile) {
      try {
        await SABEM.registrarVisita(window.location.pathname);
      } catch (error) {
        console.error('Não foi possível registrar a visita:', error);
      }
    }
    const loggedUser = document.querySelector('#loggedUser');
    const logoutBtn = document.querySelector('#logoutBtn');

    if (profile) {
      document.body.classList.add('sabem-authenticated');
      if (loggedUser) {
        loggedUser.textContent = `Olá, ${profile.nickname}`;
        loggedUser.hidden = false;
      }
      if (logoutBtn) {
        logoutBtn.hidden = false;
        logoutBtn.addEventListener('click', async () => {
          await SABEM.sairUsuario();
          window.location.href = window.location.pathname.includes('/pages/') ? '../cadastro.html' : 'cadastro.html';
        });
      }
    }

    const visitCount = document.querySelector('#visitCount');
    const toolUsageSummary = document.querySelector('#toolUsageSummary');
    const achievementList = document.querySelector('#achievementList');

    async function loadProgressPanel() {
      if (!visitCount && !document.querySelector('[data-progress-key]')) return;
      if (!profile) {
        if (visitCount) visitCount.textContent = '0';
        if (toolUsageSummary) toolUsageSummary.textContent = 'Faça login para acompanhar seu histórico.';
        return;
      }
      try {
        const panel = await SABEM.carregarPainelProgresso();
        if (visitCount) visitCount.textContent = `${panel.visits} visitas · ${panel.visitDays || 0} dias`;
        if (toolUsageSummary) toolUsageSummary.textContent = `${panel.toolEvents || 0} usos de ferramentas · ${panel.actions.length} ações rápidas · sequência atual: ${panel.currentStreak || 0} dias`;
        (panel.progress || []).forEach(item => {
          const row = document.querySelector(`[data-progress-key="${item.item_key}"]`);
          if (!row) return;
          const target = Number(item.target_count) || 7;
          const completed = Math.min(target, Number(item.completed_count) || 0);
          const percent = Math.min(100, Math.round((completed / target) * 100));
          const fill = row.querySelector('[data-progress-fill]');
          const label = row.querySelector('[data-progress-label]');
          if (fill) {
            fill.style.width = `${percent}%`;
            fill.setAttribute('aria-valuenow', String(percent));
          }
          if (label) label.textContent = `${percent}% da meta semanal (${completed}/${target} dias ativos)`;
        });
        if (achievementList) {
          achievementList.replaceChildren();
          if (!panel.achievements.length) {
            const empty = document.createElement('span');
            empty.textContent = 'Continue usando as ferramentas para desbloquear conquistas.';
            achievementList.appendChild(empty);
          } else {
            panel.achievements.forEach(achievement => {
              const item = document.createElement('div');
              const unlocked = achievement.unlocked !== false;
              item.className = `achievement-item ${unlocked ? 'earned' : 'locked'}`;
              const icon = document.createElement('i');
              icon.className = `fas ${unlocked ? 'fa-medal' : 'fa-lock'}`;
              const content = document.createElement('div');
              const label = document.createElement('strong');
              label.textContent = achievement.title;
              const description = document.createElement('small');
              description.textContent = achievement.description || 'Conquista desbloqueada.';
              content.append(label, description);
              item.append(icon, content);
              achievementList.appendChild(item);
            });
          }
        }
      } catch (error) {
        console.error('Não foi possível carregar o progresso:', error);
      }
    }

    await loadProgressPanel();

    const diaryEntries = document.querySelector('#diaryEntries');
    const diaryText = document.querySelector('#diaryText');
    const saveDiary = document.querySelector('#saveDiary');

    function renderRemoteDiary(entries) {
      if (!diaryEntries) return;
      diaryEntries.replaceChildren();
      if (!profile) {
        diaryEntries.textContent = 'Entre na sua conta para visualizar suas entradas.';
        return;
      }
      if (!entries.length) {
        diaryEntries.textContent = 'Nenhuma entrada salva ainda.';
        return;
      }
      entries.slice(0, 4).forEach(entry => {
        const card = document.createElement('article');
        card.className = 'diary-entry-item';
        const header = document.createElement('div');
        header.className = 'entry-header';
        const date = document.createElement('span');
        date.className = 'entry-date';
        date.textContent = new Date(entry.created_at).toLocaleString('pt-BR');
        const mood = document.createElement('span');
        mood.className = `entry-mood mood-${entry.mood_key}`;
        mood.textContent = entry.mood_label;
        header.append(date, mood);
        const body = document.createElement('div');
        body.className = 'entry-text';
        body.textContent = entry.reflection || 'Humor registrado sem reflexão escrita.';
        const tagLine = document.createElement('div');
        tagLine.className = 'entry-tags';
        (entry.emotion_tags || []).forEach(tag => {
          const tagEl = document.createElement('span');
          tagEl.className = 'entry-tag';
          tagEl.textContent = tag;
          tagLine.appendChild(tagEl);
        });
        card.append(header, body, tagLine);
        diaryEntries.appendChild(card);
      });
    }

    if (diaryEntries) {
      renderRemoteDiary(await SABEM.listarEntradasRecentes(4).catch(() => []));
    }

    if (saveDiary) {
      saveDiary.addEventListener('click', async function () {
        const selectedMood = document.querySelector('.mood-btn.selected');
        if (!selectedMood) return notify('Selecione um humor antes de salvar.', 'warning');
        if (!profile) return notify('Faça login para salvar sua entrada.', 'warning');
        try {
          await SABEM.salvarEntradaEmocional({
            moodKey: selectedMood.dataset.mood.replaceAll('-', '_'),
            reflection: diaryText ? diaryText.value.trim() : '',
            emotionTags: [...document.querySelectorAll('.tag.selected')].map(tag => tag.dataset.tag)
          });
          renderRemoteDiary(await SABEM.listarEntradasRecentes(4));
          notify('Entrada salva com sucesso!', 'success');
        } catch (error) {
          notify(`Não foi possível salvar: ${error.message}`, 'warning');
        }
      });
    }

    const actionMap = {
      anxietyHelp: ['ajuda_ansiedade', 'Ajuda para Ansiedade'],
      stressRelief: ['alivio_estresse', 'Alívio do Estresse'],
      energyBoost: ['aumentar_energia', 'Aumentar Energia'],
      sleepHelp: ['ajuda_dormir', 'Ajuda para Dormir'],
      motivationBoost: ['motivacao', 'Motivação'],
      gratitudePractice: ['gratidao', 'Prática de Gratidão']
    };
    for (const [id, [key, label]] of Object.entries(actionMap)) {
      const button = document.querySelector(`#${id}`);
      if (button) button.addEventListener('click', () => SABEM.registrarAcaoRapida(key, label).catch(console.error));
    }

    const calculate = document.querySelector('#calculateWellness');
    if (calculate) calculate.addEventListener('click', async () => {
      const values = {};
      ['exercise', 'sleep', 'nutrition', 'stress', 'satisfaction', 'relaxation'].forEach(id => {
        const input = document.querySelector(`#${id}`);
        if (input) values[id] = Number(input.value);
      });
      try {
        await SABEM.registrarEvento('calculadora_bem_estar', 'calculate', values);
        await loadProgressPanel();
      } catch (error) { console.error('Não foi possível registrar o cálculo:', error); }
    });

    const startBreathing = document.querySelector('#startBreathing');
    if (startBreathing) startBreathing.addEventListener('click', async () => {
      const technique = document.querySelector('#breathingTechnique');
      try {
        await SABEM.registrarEvento('timer_respiracao', 'start', { technique: technique ? technique.value : null });
        await loadProgressPanel();
      } catch (error) { console.error('Não foi possível registrar a sessão de respiração:', error); }
    });
    // A sessão de respiração é contabilizada uma única vez no clique em Iniciar,
    // dentro de SABEM.registrarEvento('timer_respiracao', 'start').

    const habitsList = document.querySelector('#habitsList');
    const addHabitBtn = document.querySelector('#addHabitBtn');
    const newHabitInput = document.querySelector('#newHabit');
    const completedToday = document.querySelector('#completedToday');
    const totalHabits = document.querySelector('#totalHabits');

    function isCompletedToday(habit) {
      const today = new Date().toISOString().slice(0, 10);
      return (habit.habit_completions || []).some(item => item.completed_on === today);
    }

    function renderHabits(habits) {
      if (!habitsList) return;
      habitsList.replaceChildren();
      let completed = 0;
      habits.forEach(habit => {
        const done = isCompletedToday(habit);
        if (done) completed++;
        const item = document.createElement('div');
        item.className = `habit-item ${done ? 'completed' : ''}`;
        const content = document.createElement('div');
        content.className = 'habit-content';
        const check = document.createElement('button');
        check.className = 'habit-check';
        check.type = 'button';
        check.innerHTML = `<i class="fas ${done ? 'fa-check-circle' : 'fa-circle'}"></i>`;
        check.addEventListener('click', async () => {
          try { await SABEM.alternarHabito(habit.id, !done); await loadHabits(); }
          catch (error) { notify(error.message, 'warning'); }
        });
        const name = document.createElement('span');
        name.className = 'habit-name';
        name.textContent = habit.name;
        const createdAt = new Date(habit.created_at);
        const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000));
        const completedDays = (habit.habit_completions || []).length;
        const streak = document.createElement('span');
        streak.className = 'habit-streak';
        streak.textContent = `${elapsedDays} ${elapsedDays === 1 ? 'dia' : 'dias'} decorridos · ${completedDays} concluídos`;
        content.append(check, name, streak);
        const del = document.createElement('button');
        del.className = 'habit-delete';
        del.type = 'button';
        del.innerHTML = '<i class="fas fa-trash"></i>';
        del.addEventListener('click', async () => {
          try { await SABEM.excluirHabito(habit.id); await loadHabits(); }
          catch (error) { notify(error.message, 'warning'); }
        });
        item.append(content, del);
        habitsList.appendChild(item);
      });
      if (completedToday) completedToday.textContent = completed;
      if (totalHabits) totalHabits.textContent = habits.length;
    }

    async function loadHabits() {
      if (!habitsList) return;
      if (!profile) {
        habitsList.textContent = 'Entre na sua conta para acompanhar seus hábitos.';
        return;
      }
      try { renderHabits((await SABEM.listarHabitos()).slice(0, 4)); }
      catch (error) { habitsList.textContent = 'Não foi possível carregar os hábitos.'; console.error(error); }
    }

    if (habitsList) await loadHabits();
    if (addHabitBtn) addHabitBtn.addEventListener('click', async () => {
      const name = newHabitInput.value.trim();
      if (!name) return;
      try {
        await SABEM.criarHabito(name);
        newHabitInput.value = '';
        await loadHabits();
      } catch (error) { notify(error.message, 'warning'); }
    });
    if (newHabitInput) newHabitInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') addHabitBtn.click();
    });
  });
})();
