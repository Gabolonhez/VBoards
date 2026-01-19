
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const projectsData = [
    { name: "FitTracker", prefix: "FIT", color: "#3b82f6" },
    { name: "ShopEase", prefix: "SHOP", color: "#10b981" },
    { name: "OzemPro", prefix: "OZM", color: "#8b5cf6" },
    { name: "FitCal", prefix: "FTC", color: "#f97316" },
];

const versionsData = [
  // FitTracker
  { projectName: "FitTracker", name: "v1.9.4", status: "in_development", release_date: "2026-01-20", notes: "Heart rate monitoring, calorie fixes" },
  { projectName: "FitTracker", name: "v1.9.3", status: "in_stores", release_date: "2026-01-05", notes: "Bug fixes and performance improvements" },
  // ShopEase
  { projectName: "ShopEase", name: "v2.1.0", status: "in_development", release_date: "2026-02-01", notes: "New checkout flow" },
  // OzemPro
  { projectName: "OzemPro", name: "v1.4.1", status: "in_development", release_date: "2026-02-15", notes: "Fixes and improvements for OzemPro" },
  // FitCal
  { projectName: "FitCal", name: "v1.9.4", status: "in_development", release_date: "2026-02-20", notes: "Community updates" }
];

const tasksData = [
    // OzemPro - Ideas (Purple)
    { code: "OZM-101", projectName: "OzemPro", versionName: null, title: "Exibir tutorial 1x pro usuário acessar pela primeira vez após passar pelo quiz, assinar o app e logar", status: "ideas", priority: "medium" },
    { code: "OZM-102", projectName: "OzemPro", versionName: null, title: "Melhorar UI/UX splash screen (animação)", status: "ideas", priority: "medium" },
    { code: "OZM-103", projectName: "OzemPro", versionName: null, title: "Onboarding para iniciantes no quiz", status: "ideas", priority: "medium" },
    { code: "OZM-104", projectName: "OzemPro", versionName: null, title: "Adicionar pop-up para avaliar o app (1x por mês) ao usuário", status: "ideas", priority: "medium" },
    { code: "OZM-105", projectName: "OzemPro", versionName: null, title: "Colocar comunidade na landing page", status: "ideas", priority: "medium" },
    { code: "OZM-106", projectName: "OzemPro", versionName: null, title: "Integração AppsFlyer", description: "https://www.youtube.com/watch?v=alw6gXuMrqI&list=PL_fvQUGxeKHIHKsaAmaNOybSB8AykfmaN&index=2", status: "ideas", priority: "medium" },
    { code: "OZM-107", projectName: "OzemPro", versionName: null, title: "Apple Health sync / Google Health Connect sync", status: "ideas", priority: "medium" },
    { code: "OZM-108", projectName: "OzemPro", versionName: null, title: "Sistema de XP e badges", status: "ideas", priority: "medium" },
    { code: "OZM-109", projectName: "OzemPro", versionName: null, title: "Relatório mensal", status: "ideas", priority: "medium" },
    { code: "OZM-110", projectName: "OzemPro", versionName: null, title: "Tamagotchi/mascote (panda)", status: "ideas", priority: "medium" },
    { code: "OZM-111", projectName: "OzemPro", versionName: null, title: "Panic button", status: "ideas", priority: "medium" },
    { code: "OZM-112", projectName: "OzemPro", versionName: null, title: "AI Agent", status: "ideas", priority: "medium" },
    { code: "OZM-113", projectName: "OzemPro", versionName: null, title: "Rebranding com panda", status: "ideas", priority: "medium" },
    { code: "OZM-114", projectName: "OzemPro", versionName: null, title: "Cardápio para guiar escolhas", status: "ideas", priority: "medium" },
    { code: "OZM-115", projectName: "OzemPro", versionName: null, title: "Feat: deve ter como ver imagens de dias anteriores na minha jornada glp1", status: "ideas", priority: "medium" },
    { code: "OZM-116", projectName: "OzemPro", versionName: null, title: "Feat: deve ter como importar imagens na minha jornada glp-1 nos demais dias caso eu mude o dia pelo wheel picker", status: "ideas", priority: "medium" },

    // OzemPro - Backlog (Brown)
    { code: "OZM-201", projectName: "OzemPro", versionName: "v1.4.1", title: "Formulário e popup de sugestão", status: "backlog", priority: "high" },

    // FitCal - Ideas (Purple)
    { code: "FTC-101", projectName: "FitCal", versionName: null, title: "Possibilidade de notificação personalizada por refeição (café, almoço, janta)", status: "ideas", priority: "medium" },
    { code: "FTC-102", projectName: "FitCal", versionName: null, title: "Adicionar água nas retrospectivas e tela de progresso", status: "ideas", priority: "medium" },
    { code: "FTC-103", projectName: "FitCal", versionName: null, title: "Notificações de dicas do dia", status: "ideas", priority: "medium" },
    { code: "FTC-104", projectName: "FitCal", versionName: null, title: "Roleta aparecer apenas quando a pessoa tentar comprar o 'Trial Anual' e recusar, não ter botão de fechar", status: "ideas", priority: "medium" },
    { code: "FTC-105", projectName: "FitCal", versionName: null, title: "Feat: melhorar UI/UX card de compartilhar refeição", status: "ideas", priority: "medium" },
    { code: "FTC-106", projectName: "FitCal", versionName: null, title: "Feat: analisar e melhorar bruscamente toda UI do app", status: "ideas", priority: "medium" },
    { code: "FTC-107", projectName: "FitCal", versionName: null, title: "Feat: alterar widget (ver imagem anexada)", status: "ideas", priority: "medium" },
    { code: "FTC-108", projectName: "FitCal", versionName: null, title: "Feat: Enviar lembrete 'Inteligente' (baseado no horário que o usuário costuma abrir o app)", status: "ideas", priority: "medium" },
    { code: "FTC-109", projectName: "FitCal", versionName: null, title: "Teste A: Ao final do quiz, apenas mostrar 'Criando seu plano...'. Teste B: Pedir para o usuário 'Assinar um Compromisso' digital", status: "ideas", priority: "medium" },
    { code: "FTC-110", projectName: "FitCal", versionName: null, title: "Social Proof no Paywall Teste A: Mostrar 'X pessoas entraram hoje'. Teste B: Mostrar depoimento", status: "ideas", priority: "medium" },
    { code: "FTC-111", projectName: "FitCal", versionName: null, title: "Feat: implementar variações de textos nos pop-ups motivacionais", status: "ideas", priority: "medium" },
    { code: "FTC-112", projectName: "FitCal", versionName: null, title: "Feat: permitir excluir e adicionar ingredientes nos detalhes da refeição escaneada", status: "ideas", priority: "medium" },
    { code: "FTC-113", projectName: "FitCal", versionName: null, title: "Notificações: 'Ei [Nome], você geralmente consome 500 calorias a essa hora. Não se esqueça de registrar!'", status: "ideas", priority: "medium" },
    { code: "FTC-138", projectName: "FitCal", versionName: null, title: "Feat: google analytics no app e no site para ver métricas de retenção, qua tela é mais acessada, etc", status: "ideas", priority: "medium" },
    { code: "FTC-114", projectName: "FitCal", versionName: null, title: "Feat: teste de ano novo vida nova, mudança de vida etc quiz e paywall", status: "ideas", priority: "medium" },
    { code: "FTC-115", projectName: "FitCal", versionName: null, title: "tutorial melhor mostrando detalhes do app, até a comunidade, como entrar, chamar amigo etc", status: "ideas", priority: "medium" },
    { code: "FTC-116", projectName: "FitCal", versionName: null, title: "Melhorar funcionalidade de buscar alimento FitCal", status: "ideas", priority: "medium" },
    { code: "FTC-117", projectName: "FitCal", versionName: null, title: "Pix no paywall", status: "ideas", priority: "medium" },
    { code: "FTC-118", projectName: "FitCal", versionName: null, title: "Feat: dentro do app a gente pedir pra pessoa liberar as notificações, se ela não ativou", status: "ideas", priority: "medium" },
    { code: "FTC-119", projectName: "FitCal", versionName: null, title: "Feat: pop-up ao alcançar a meta de calorias e peso", status: "ideas", priority: "medium" },
    { code: "FTC-120", projectName: "FitCal", versionName: null, title: "Feat: implementar mais métricas appsflyer (faturamento, etc)", status: "ideas", priority: "medium" },
    { code: "FTC-121", projectName: "FitCal", versionName: null, title: "Testar se eventos chegam no appsflyer", status: "ideas", priority: "medium" },
    { code: "FTC-122", projectName: "FitCal", versionName: null, title: "Melhorar UI/UX splash screen (animação)", status: "ideas", priority: "medium" },
    { code: "FTC-123", projectName: "FitCal", versionName: null, title: "Adicionar pop-up para avaliar o app (1x por mês) ao usuário", status: "ideas", priority: "medium" },
    { code: "FTC-124", projectName: "FitCal", versionName: null, title: "Progress Photos (antes/depois)", status: "ideas", priority: "medium" },
    { code: "FTC-125", projectName: "FitCal", versionName: null, title: "Melhorar plano personalizado", status: "ideas", priority: "medium" },
    { code: "FTC-126", projectName: "FitCal", versionName: null, title: "Quiz na web + forma de pagamento (stripe, etc)", status: "ideas", priority: "medium" },
    { code: "FTC-127", projectName: "FitCal", versionName: null, title: "Modal personalizado para permissão de notificação", status: "ideas", priority: "medium" },
    { code: "FTC-128", projectName: "FitCal", versionName: null, title: "Inserir no adicionar + opção registrar água", status: "ideas", priority: "medium" },
    { code: "FTC-129", projectName: "FitCal", versionName: null, title: "Apple Health sync / Google Health Connect sync", status: "ideas", priority: "medium" },
    { code: "FTC-130", projectName: "FitCal", versionName: null, title: "AI Coach (chat de nutrição)", status: "ideas", priority: "medium" },
    { code: "FTC-131", projectName: "FitCal", versionName: null, title: "Receitas por IA", status: "ideas", priority: "medium" },
    { code: "FTC-132", projectName: "FitCal", versionName: null, title: "Desafios semanais", status: "ideas", priority: "medium" },
    { code: "FTC-133", projectName: "FitCal", versionName: null, title: "Ranking por streak", status: "ideas", priority: "medium" },
    { code: "FTC-134", projectName: "FitCal", versionName: null, title: "Desafios mensais", status: "ideas", priority: "medium" },
    { code: "FTC-135", projectName: "FitCal", versionName: null, title: "Marcos de streak (15d, 30d, 3m, 6m, 1a)", status: "ideas", priority: "medium" },
    { code: "FTC-136", projectName: "FitCal", versionName: null, title: "Implementar notificação sempre que alguém do grupo posta algo no desafio da comunidade redirecionando para a tela do desafio ao clicar", status: "ideas", priority: "medium" },
    { code: "FTC-137", projectName: "FitCal", versionName: null, title: "Notificação caso esteja a noite, usuário esteja em um desafio na comunidade e não tenha postado nada no dia", status: "ideas", priority: "medium" },

    // FitCal - Backlog (Brown)
    { code: "FTC-201", projectName: "FitCal", versionName: "v1.9.4", title: "Problema de autenticação (login com google e senha)", status: "backlog", priority: "high" },
    { code: "FTC-202", projectName: "FitCal", versionName: "v1.9.4", title: "Fix: crashes google play", status: "backlog", priority: "critical" },
];

async function seed() {
    console.log("Starting seed...");

    // 1. Projects
    const projectMap = new Map();
    for (const p of projectsData) {
        // Check if exists
        const { data: existing } = await supabase.from('projects').select('id').eq('name', p.name).single();
        if (existing) {
            console.log(`Project ${p.name} exists, skipping...`);
            projectMap.set(p.name, existing.id);
        } else {
            console.log(`Creating Project ${p.name}...`);
            const { data, error } = await supabase.from('projects').insert(p).select().single();
            if (error) {
                 console.error(`Error creating project ${p.name}:`, error);
            } else {
                 projectMap.set(p.name, data.id);
            }
        }
    }

    // 2. Versions
    const versionMap = new Map();
    for (const v of versionsData) {
        const projectId = projectMap.get(v.projectName);
        if (!projectId) {
            console.warn(`Project not found for version ${v.name} (${v.projectName})`);
            continue;
        }

        const { data: existing } = await supabase.from('versions')
            .select('id')
            .eq('project_id', projectId)
            .eq('name', v.name)
            .single();

        if (existing) {
             console.log(`Version ${v.name} exists in ${v.projectName}, skipping...`);
             versionMap.set(`${v.projectName}-${v.name}`, existing.id);
        } else {
            console.log(`Creating Version ${v.name} in ${v.projectName}...`);
             const { data, error } = await supabase.from('versions').insert({
                 project_id: projectId,
                 name: v.name,
                 status: v.status,
                 release_date: v.release_date,
                 notes: v.notes
             }).select().single();

            if (error) {
                 console.error(`Error creating version ${v.name}:`, error);
            } else {
                 versionMap.set(`${v.projectName}-${v.name}`, data.id);
            }
        }
    }

    // 3. Tasks
    let taskCount = 0;
    for (const t of tasksData) {
        const projectId = projectMap.get(t.projectName);
        if (!projectId) {
            console.warn(`Project not found for task ${t.title}`);
            continue;
        }

        let versionId = null;
        if (t.versionName) {
            versionId = versionMap.get(`${t.projectName}-${t.versionName}`);
            if (!versionId) {
                console.warn(`Version ${t.versionName} not found for task ${t.title} - looking for ${t.projectName}-${t.versionName}`); 
            }
        }

        // Check availability
         const { data: existing } = await supabase.from('tasks').select('id').eq('code', t.code).single();
         if (existing) {
             console.log(`Task ${t.code} exists, skipping...`);
         } else {
             console.log(`Creating Task ${t.code}...`);
             const { error } = await supabase.from('tasks').insert({
                 code: t.code,
                 project_id: projectId,
                 version_id: versionId,
                 title: t.title,
                 description: t.description || t.title,
                 status: t.status,
                 priority: t.priority
             });
             if (error) {
                 console.error(`Error creating task ${t.code}:`, error);
             } else {
                 taskCount++;
             }
         }
    }
    
    console.log(`Seed complete! Created ${taskCount} new tasks.`);
}

seed().catch(console.error);
