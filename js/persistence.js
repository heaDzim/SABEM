// Integração incremental do site SABEM com Supabase.
// O arquivo preserva as funções visuais existentes e adiciona persistência remota.
(function () {
  function whenReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  whenReady(async function () {
    if (!window.SABEM) return;

    const user = await SABEM.carregarPerfil().catch(() => null);
    if (user) {
      document.body.classList.add('sabem-authenticated');
      document.querySelectorAll('[data-user-nickname]').forEach(el => {
        el.textContent = user.nickname;
      });
    }

    const diaryEntries = document.querySelector('#diaryEntries');
    const moodButtons = document.querySelectorAll('.mood-btn');
    const diaryText = document.querySelector('#diaryText');
    const tags = document.querySelectorAll('.tag');
    const saveDiary = document.querySelector('#saveDiary');

    function renderRemoteDiary(entries) {
      if (!diaryEntries) return;
      diaryEntries.replaceChildren();
      for (const entry of entries) {
        const card = document.createElement('div');
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
        for (const tag of entry.emotion_tags || []) {
          const tagEl = document.createElement('span');
          tagEl.className = 'entry-tag';
          tagEl.textContent = tag;
          tagLine.appendChild(tagEl);
        }
        card.append(header, body, tagLine);
        diaryEntries.appendChild(card);
      }
    }

    if (diaryEntries) {
      const entries = await SABEM.listarEntradasRecentes().catch(() => []);
      renderRemoteDiary(entries);
    }

    if (saveDiary) {
      saveDiary.addEventListener('click', async function () {
        const selectedMood = document.querySelector('.mood-btn.selected');
        if (!selectedMood) return;
        try {
          await SABEM.salvarEntradaEmocional({
            moodKey: selectedMood.dataset.mood.replaceAll('-', '_'),
            reflection: diaryText ? diaryText.value.trim() : '',
            emotionTags: [...document.querySelectorAll('.tag.selected')].map(tag => tag.dataset.tag)
          });
          renderRemoteDiary(await SABEM.listarEntradasRecentes());
        } catch (error) {
          if (typeof showNotification === 'function') showNotification(`Faça login para salvar: ${error.message}`, 'warning');
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
    if (calculate) {
      calculate.addEventListener('click', () => {
        const values = {};
        ['exercise', 'sleep', 'nutrition', 'stress', 'satisfaction', 'relaxation'].forEach(id => {
          const input = document.querySelector(`#${id}`);
          if (input) values[id] = Number(input.value);
        });
        SABEM.registrarEvento('calculadora_bem_estar', 'calculate', values).catch(console.error);
      });
    }

    const startBreathing = document.querySelector('#startBreathing');
    if (startBreathing) startBreathing.addEventListener('click', () => {
      const technique = document.querySelector('#breathingTechnique');
      SABEM.registrarEvento('timer_respiracao', 'start', { technique: technique ? technique.value : null }).catch(console.error);
    });
  });
})();
