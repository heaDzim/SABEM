/*
 * SABEM — integração mínima com Supabase.
 * Inclua primeiro o SDK do Supabase no HTML:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="js/sabem_backend.js"></script>
 *
 * Substitua os dois valores abaixo pelos dados públicos do seu projeto.
 * Nunca coloque a service_role key no navegador.
 */

const SUPABASE_URL = 'https://yiwgsuzzfkemflhoxjej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpd2dzdXp6ZmtlbWZsaG94amVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDM5ODEsImV4cCI6MjEwNDc3OTk4MX0.CBUU83ZXHMqhW4Co7J8u9_wxTXzXi6uIzuAescVuGzc';const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SABEM_PROGRESS = [
  { item_key: 'exercicios', item_label: 'Exercícios', target_count: 7 },
  { item_key: 'meditacao', item_label: 'Meditação', target_count: 7 },
  { item_key: 'sono', item_label: 'Sono', target_count: 7 },
  { item_key: 'alimentacao', item_label: 'Alimentação', target_count: 7 }
];

const MOODS = {
  muito_feliz: 'Muito Feliz',
  feliz: 'Feliz',
  neutro: 'Neutro',
  triste: 'Triste',
  muito_triste: 'Muito Triste'
};

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function cadastrarUsuario({ email, password, nickname, birthDate }) {
  if (!nickname || !birthDate) throw new Error('Apelido e data de nascimento são obrigatórios.');
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) {
    throw new Error('Informe uma data de nascimento válida.');
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { nickname, birth_date: birthDate }
    }
  });
  if (error) throw error;
  if (!data.user) throw new Error('Não foi possível criar o usuário.');

  // O trigger handle_new_user cria o perfil no banco, e o trigger
  // handle_new_profile cria os indicadores iniciais do painel.
  return data.user;
}

async function entrarUsuario(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await registrarVisita('login');
  return data.user;
}

async function sairUsuario() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function solicitarRedefinicaoSenha(email, redirectTo = `${window.location.origin}/cadastro.html`) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) throw new Error('Informe o e-mail para receber o link de redefinição.');
  if (!/^https?:\/\//i.test(redirectTo)) throw new Error('O endereço de retorno da recuperação não é válido.');

  const { error } = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (!error) return true;

  const raw = `${error.message || ''} ${error.code || ''}`.toLowerCase();
  if (raw.includes('rate limit') || raw.includes('too many')) {
    throw new Error('O limite de envio de e-mails foi atingido. Aguarde alguns minutos e tente novamente.');
  }
  if (raw.includes('smtp') || raw.includes('error sending') || raw.includes('email')) {
    throw new Error('O Supabase não conseguiu enviar o e-mail. Verifique o SMTP em Authentication > SMTP Settings e confirme o endereço do remetente.');
  }
  throw new Error(error.message || 'Não foi possível enviar o e-mail de recuperação.');
}

async function atualizarSenha(novaSenha) {
  if (!novaSenha || novaSenha.length < 8) {
    throw new Error('A nova senha deve ter pelo menos 8 caracteres.');
  }
  const { data, error } = await supabaseClient.auth.updateUser({ password: novaSenha });
  if (error) throw error;
  return data.user;
}

async function carregarPerfil() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profile_summary')
    .select('id, nickname, birth_date, age, created_at, updated_at')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

async function registrarVisita(route = window.location.pathname) {
  const user = await getCurrentUser();
  if (!user) return;

  // Uma visita por sessão do navegador. O histórico registra a data e a rota inicial.
  let sessionKey = sessionStorage.getItem('sabem_session_key');
  if (!sessionKey) {
    sessionKey = crypto.randomUUID();
    sessionStorage.setItem('sabem_session_key', sessionKey);
  }

  const { error } = await supabaseClient.from('site_visits').upsert({
    user_id: user.id,
    session_key: sessionKey,
    route
  }, { onConflict: 'user_id,session_key', ignoreDuplicates: true });
  if (error) throw error;
}

async function registrarEvento(toolKey, actionKey, metadata = {}) {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabaseClient.from('tool_events').insert({
    user_id: user.id,
    tool_key: toolKey,
    action_key: actionKey,
    metadata
  });
  if (error) throw error;

  // Cada uso concluído alimenta o acompanhamento do painel.
  const values = metadata && typeof metadata === 'object' ? metadata : {};
  if (toolKey === 'timer_respiracao' && actionKey === 'start') await incrementarProgresso('meditacao');
  if (toolKey === 'calculadora_bem_estar' && actionKey === 'calculate') {
    if (Number(values.exercise) > 0) await incrementarProgresso('exercicios');
    if (Number(values.sleep) > 0) await incrementarProgresso('sono');
    if (Number(values.nutrition) > 0) await incrementarProgresso('alimentacao');
  }
}

async function registrarAcaoRapida(actionKey, actionLabel) {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabaseClient.from('quick_action_events').insert({
    user_id: user.id,
    action_key: actionKey,
    action_label: actionLabel
  });
  if (error) throw error;
  await registrarEvento('acoes_rapidas', actionKey);
}

async function salvarEntradaEmocional({ moodKey, reflection, emotionTags }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para salvar uma entrada.');
  if (!MOODS[moodKey]) throw new Error('Selecione um humor válido.');

  const { data, error } = await supabaseClient
    .from('emotional_entries')
    .insert({
      user_id: user.id,
      mood_key: moodKey,
      mood_label: MOODS[moodKey],
      reflection: reflection || '',
      emotion_tags: emotionTags || []
    })
    .select()
    .single();
  if (error) throw error;
  await registrarEvento('diario_emocional', 'save_entry', { mood: moodKey });
  return data;
}

async function listarEntradasRecentes(limit = 4) {
  const user = await getCurrentUser();
  if (!user) return [];
  const safeLimit = Math.min(4, Math.max(1, Number(limit) || 4));
  const { data, error } = await supabaseClient
    .from('emotional_entries')
    .select('id, mood_key, mood_label, reflection, emotion_tags, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return data || [];
}

async function incrementarProgresso(itemKey, amount = 1) {
  const user = await getCurrentUser();
  if (!user) return;
  const definition = SABEM_PROGRESS.find(item => item.item_key === itemKey);
  if (!definition) return;
  const { data: current, error: currentError } = await supabaseClient
    .from('progress_items')
    .select('completed_count')
    .eq('user_id', user.id)
    .eq('item_key', itemKey)
    .maybeSingle();
  if (currentError) throw currentError;
  const nextCount = (Number(current?.completed_count) || 0) + Math.max(1, Number(amount) || 1);
  const { error } = await supabaseClient
    .from('progress_items')
    .upsert({ user_id: user.id, item_key: itemKey, item_label: definition.item_label, target_count: definition.target_count, completed_count: nextCount, updated_at: new Date().toISOString() }, { onConflict: 'user_id,item_key' });
  if (error) throw error;
}

async function registrarProgresso(itemKey, amount = 1) {
  await incrementarProgresso(itemKey, amount);
  const user = await getCurrentUser();
  if (user) await registrarEvento(itemKey, 'complete');
}

function dataKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function uniqueDayKeys(rows, dateField) {
  return new Set((rows || []).map(row => dataKey(row[dateField])));
}

function consecutiveDays(dayKeys, reference = new Date()) {
  const days = new Set(dayKeys);
  let cursor = new Date(reference);
  cursor.setUTCHours(0, 0, 0, 0);
  let total = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    total += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return total;
}

function startOfSevenDayWindow(reference = new Date()) {
  const start = new Date(reference);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  return start;
}

function eventDaysSince(events, start) {
  return new Set((events || [])
    .filter(event => new Date(event.created_at) >= start)
    .map(event => dataKey(event.created_at)));
}

async function carregarPainelProgresso() {
  const user = await getCurrentUser();
  if (!user) return { visits: 0, visitDays: 0, currentStreak: 0, progress: [], actions: [], achievements: [], toolEvents: 0 };

  const [visits, actions, achievements, toolEvents, visitRows, eventRows] = await Promise.all([
    supabaseClient.from('site_visits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabaseClient.from('quick_action_events').select('action_key, action_label, accessed_at').eq('user_id', user.id).order('accessed_at', { ascending: false }).limit(20),
    supabaseClient.from('achievements').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(10),
    supabaseClient.from('tool_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabaseClient.from('site_visits').select('visited_at').eq('user_id', user.id).order('visited_at', { ascending: false }),
    supabaseClient.from('tool_events').select('tool_key, action_key, metadata, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
  ]);
  for (const response of [visits, actions, achievements, toolEvents, visitRows, eventRows]) {
    if (response.error) throw response.error;
  }

  const visitsData = visitRows.data || [];
  const events = eventRows.data || [];
  const visitDayKeys = uniqueDayKeys(visitsData, 'visited_at');
  const today = new Date();
  const weekStart = startOfSevenDayWindow(today);
  const activityDays = {
    exercicios: eventDaysSince(events.filter(e => e.tool_key === 'calculadora_bem_estar' && e.action_key === 'calculate' && Number(e.metadata?.exercise) > 0), weekStart),
    meditacao: eventDaysSince(events.filter(e => e.tool_key === 'timer_respiracao' && e.action_key === 'start'), weekStart),
    sono: eventDaysSince(events.filter(e => e.tool_key === 'calculadora_bem_estar' && e.action_key === 'calculate' && Number(e.metadata?.sleep) > 0), weekStart),
    alimentacao: eventDaysSince(events.filter(e => e.tool_key === 'calculadora_bem_estar' && e.action_key === 'calculate' && Number(e.metadata?.nutrition) > 0), weekStart)
  };

  const labels = {
    exercicios: 'Exercícios', meditacao: 'Meditação', sono: 'Sono', alimentacao: 'Alimentação'
  };
  const progress = Object.keys(labels).map(itemKey => {
    const completed = activityDays[itemKey].size;
    return { item_key: itemKey, item_label: labels[itemKey], target_count: 7, completed_count: completed, active_days: completed };
  });

  const allHealthyDays = new Set([...activityDays.exercicios, ...activityDays.meditacao, ...activityDays.sono, ...activityDays.alimentacao]);
  const exerciseAllDays = new Set(events.filter(e => e.tool_key === 'calculadora_bem_estar' && e.action_key === 'calculate' && Number(e.metadata?.exercise) > 0).map(e => dataKey(e.created_at)));
  const meditationAllDays = new Set(events.filter(e => e.tool_key === 'timer_respiracao' && e.action_key === 'start').map(e => dataKey(e.created_at)));
  const exerciseStreak = consecutiveDays(exerciseAllDays);
  const allAreasStarted = Object.values(activityDays).every(days => days.size > 0);
  const achievementsDynamic = [
    {
      achievement_key: 'exercicio_7_dias',
      title: '7 dias consecutivos de exercício',
      description: exerciseStreak >= 7 ? 'Conquista desbloqueada: exercícios em 7 dias seguidos.' : `Progresso: ${exerciseStreak}/7 dias consecutivos.`,
      unlocked: exerciseStreak >= 7
    },
    {
      achievement_key: 'primeira_semana_meditacao',
      title: 'Primeira semana de meditação',
      description: meditationAllDays.size >= 7 ? 'Conquista desbloqueada: meditação em 7 dias.' : `Progresso: ${meditationAllDays.size}/7 dias de meditação.`,
      unlocked: meditationAllDays.size >= 7
    },
    {
      achievement_key: '30_dias_habitos',
      title: '30 dias de hábitos saudáveis',
      description: allHealthyDays.size >= 30 ? 'Conquista desbloqueada: atividades saudáveis em 30 dias.' : `Progresso: ${allHealthyDays.size}/30 dias ativos.`,
      unlocked: allHealthyDays.size >= 30
    },
    {
      achievement_key: 'mestre_bem_estar',
      title: 'Mestre do bem-estar',
      description: allAreasStarted && allHealthyDays.size >= 30 ? 'Conquista desbloqueada: todas as áreas foram acompanhadas.' : 'Complete as quatro áreas e acumule 30 dias saudáveis.',
      unlocked: allAreasStarted && allHealthyDays.size >= 30
    }
  ];

  return {
    visits: visits.count || 0,
    visitDays: visitDayKeys.size,
    currentStreak: consecutiveDays(visitDayKeys),
    progress,
    actions: actions.data || [],
    achievements: achievementsDynamic,
    toolEvents: toolEvents.count || 0
  };
}

// Uso básico por página:
// registrarVisita();
// document.querySelector('#btnSalvarEntrada').addEventListener('click', async () => {
//   await salvarEntradaEmocional({
//     moodKey: document.querySelector('[name="mood"]:checked').value,
//     reflection: document.querySelector('#reflection').value,
//     emotionTags: [...document.querySelectorAll('[name="emotionTag"]:checked')].map(el => el.value)
//   });
//   renderEntradas(await listarEntradasRecentes());
// });

async function listarHabitos() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabaseClient
    .from('habits')
    .select('id, name, active, created_at, habit_completions(id, completed_on)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(4);
  if (error) throw error;
  return data || [];
}

async function criarHabito(name) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para criar um hábito.');
  const { data, error } = await supabaseClient
    .from('habits')
    .insert({ user_id: user.id, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  await registrarEvento('tracker_habitos', 'create_habit', { name: name.trim() });
  return data;
}

async function alternarHabito(habitId, completed) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para marcar um hábito.');
  const day = new Date().toISOString().slice(0, 10);
  if (completed) {
    const { error } = await supabaseClient
      .from('habit_completions')
      .upsert({ habit_id: habitId, user_id: user.id, completed_on: day }, { onConflict: 'habit_id,completed_on' });
    if (error) throw error;
  } else {
    const { error } = await supabaseClient
      .from('habit_completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
      .eq('completed_on', day);
    if (error) throw error;
  }
  await registrarEvento('tracker_habitos', completed ? 'complete_habit' : 'uncomplete_habit', { habitId });
}

async function excluirHabito(habitId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Faça login para excluir um hábito.');
  const { error } = await supabaseClient
    .from('habits')
    .update({ active: false })
    .eq('id', habitId)
    .eq('user_id', user.id);
  if (error) throw error;
}

window.SABEM = {
  cadastrarUsuario,
  entrarUsuario,
  sairUsuario,
  solicitarRedefinicaoSenha,
  atualizarSenha,
  carregarPerfil,
  registrarVisita,
  registrarEvento,
  registrarAcaoRapida,
  salvarEntradaEmocional,
  listarEntradasRecentes,
  registrarProgresso,
  carregarPainelProgresso,
  listarHabitos,
  criarHabito,
  alternarHabito,
  excluirHabito
};
