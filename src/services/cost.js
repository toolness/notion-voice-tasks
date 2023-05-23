export default async function calculateGPTCost(usage, model) {
  if (
    !usage ||
    typeof usage !== "object" ||
    !usage.prompt_tokens ||
    !usage.completion_tokens
  ) {
    throw new Error("Invalid usage object");
  }

  if (!model || typeof model !== "string") {
    throw new Error("Invalid model string");
  }

  const rates = {
    "gpt-3.5-turbo": {
      prompt: 0.002,
      completion: 0.002,
    },
    "gpt-4": {
      prompt: 0.03,
      completion: 0.06,
    },
    "gpt-4-32k": {
      prompt: 0.06,
      completion: 0.12,
    },
  };

  const chatModel = model.includes("gpt-4-32")
    ? "gpt-4-32k"
    : model.includes("gpt-4")
    ? "gpt-4"
    : "gpt-3.5-turbo";

  if (!rates[chatModel]) {
    throw new Error("Non-supported model.");
  }

  const costs = {
    prompt: (usage.prompt_tokens / 1000) * rates[chatModel].prompt,
    completion: (usage.completion_tokens / 1000) * rates[chatModel].completion,
    get total() {
      return this.prompt + this.completion;
    },
  };

  return `AI Cost: $${costs.total.toFixed(3)}`;
}
