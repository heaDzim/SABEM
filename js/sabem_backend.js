/*
 * SABEM — integração mínima com Supabase.
 * Inclua primeiro o SDK do Supabase no HTML:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="js/sabem_backend.js"></script>
  */

const SUPABASE_URL = 'https://yiwgsuzzfkemflhoxjej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpd2dzdXp6ZmtlbWZsaG94amVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDM5ODEsImV4cCI6MjEwNDc3OTk4MX0.CBUU83ZXHMqhW4Co7J8u9_wxTXzXi6uIzuAescVuGzc';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function listarEntradasRecentes(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabaseClient
    .from('emotional_entries')
    .select('id, mood_key, mood_label, reflection, emotion_tags, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function registrarProgresso(itemKey, amount = 1) {
  const user = await getCurrentUser();
  if (!user) return;
  const { data: current, error: currentError } = await supabaseClient
    .from('progress_items')
    .select('completed_count')
    .eq('user_id', user.id)
    .eq('item_key', itemKey)
    .single();
  if (currentError) throw currentError;

  const { error } = await supabaseClient
    .from('progress_items')
    .update({ completed_count: current.completed_count + amount, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('item_key', itemKey);
  if (error) throw error;
  await registrarEvento(itemKey, 'complete');
}

async function carregarPainelProgresso() {
  const user = await getCurrentUser();
  if (!user) return { visits: 0, progress: [], actions: [], achievements: [] };

  const [visits, progress, actions, achievements] = await Promise.all([
    supabaseClient.from('site_visits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabaseClient.from('progress_items').select('*').eq('user_id', user.id).order('item_key'),
    supabaseClient.from('quick_action_events').select('action_key, action_label, accessed_at').eq('user_id', user.id).order('accessed_at', { ascending: false }).limit(20),
    supabaseClient.from('achievements').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(10)
  ]);
  for (const response of [visits, progress, actions, achievements]) {
    if (response.error) throw response.error;
  }
  return {
    visits: visits.count || 0,
    progress: progress.data || [],
    actions: actions.data || [],
    achievements: achievements.data || []
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

window.SABEM = {
  cadastrarUsuario,
  entrarUsuario,
  sairUsuario,
  carregarPerfil,
  registrarVisita,
  registrarEvento,
  registrarAcaoRapida,
  salvarEntradaEmocional,
  listarEntradasRecentes,
  registrarProgresso,
  carregarPainelProgresso
};
