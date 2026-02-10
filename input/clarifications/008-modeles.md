Les modeles LLM pour analyser les formations doivent etre de openai.
L'utilisateur doit avoir connaissance des prix et ces modeles doivent etre dans les moins chers possible (1M token inferieur a 0.50$)

/\*_ Modèles OpenAI supportés _/
export const OPENAI_MODELS = [
{
id: "gpt-5-nano",
name: "GPT-5 Nano",
description: "Ultra rapide et très économique",
pricing: "~0.10$/1M tokens"
},
{
id: "gpt-5-mini",
name: "GPT-5 Mini",
description: "Nouvelle génération, rapide et performant",
pricing: "~0.20$/1M tokens"
},
{
id: "gpt-4.1-nano",
name: "GPT-4.1 Nano",
description: "Version optimisée de GPT-4.1, très économique",
pricing: "~0.10$/1M tokens"
},
{
id: "gpt-4o-mini",
name: "GPT-4o Mini",
description: "Rapide et économique",
pricing: "~0.15$/1M tokens"
},
{
id: "gpt-4o",
name: "GPT-4o",
description: "Plus puissant, plus cher",
pricing: "~2.50$/1M tokens"
},
{
id: "gpt-4-turbo",
name: "GPT-4 Turbo",
description: "Version turbo de GPT-4",
pricing: "~10$/1M tokens"
},
{
id: "gpt-3.5-turbo",
name: "GPT-3.5 Turbo",
description: "Ancien modèle, très économique",
pricing: "~0.50$/1M tokens"
},
{
id: "o3-mini",
name: "O3 Mini",
description: "Modèle de raisonnement économique",
pricing: "~1.10$/1M tokens"
}
] as const;
