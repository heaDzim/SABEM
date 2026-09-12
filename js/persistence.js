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
      entries.slice(0, 2).forEach(entry => {
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
        body.textContent = entry.reflection || 'Sem texto registrado.';
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
      renderRemoteDiary(await SABEM.listarEntradasRecentes(2).catch(() => []));
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
          renderRemoteDiary(await SABEM.listarEntradasRecentes(2));
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
    if (calculate) calculate.addEventListener('click', () => {
      const values = {};
      ['exercise', 'sleep', 'nutrition', 'stress', 'satisfaction', 'relaxation'].forEach(id => {
        const input = document.querySelector(`#${id}`);
        if (input) values[id] = Number(input.value);
      });
      SABEM.registrarEvento('calculadora_bem_estar', 'calculate', values).catch(console.error);
    });

    const startBreathing = document.querySelector('#startBreathing');
    if (startBreathing) startBreathing.addEventListener('click', () => {
      const technique = document.querySelector('#breathingTechnique');
      SABEM.registrarEvento('timer_respiracao', 'start', { technique: technique ? technique.value : null }).catch(console.error);
    });

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
        content.append(check, name);
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
      try { renderHabits(await SABEM.listarHabitos()); }
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
