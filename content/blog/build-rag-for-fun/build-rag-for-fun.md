---
title: Build the RAG with Golang and Local LLM
description: In this article I'm going to give a simple overview how to create a Chat Bot with RAG based on you own knowledge base.
date: 2026-03-17
image: jumbomain.png
tags:
  - llm
  - golang
  - k8s
  - rag
---

<div class="message-box">
<h3>RAG stands for Retrieval-Augmented Generation.</h3>

<p> It's a way to make AI assistants smarter by giving them access to specific information when answering questions.</p>
</div>

{% image "./jumbomain.png", "header image", [900] %}

I've a good library of articles about kubernetes. It's a huge knowledge base I've build for myself.
It's hard to navigate on this library but every article has been carefully chosed.

{% image "./obsidian-knowledge.png", "obsidian example", [900] %}

Recently I've found the wonderfull sources explaining how [RAG](https://github.com/pguso/rag-from-scratch/tree/main) works.
I decide to try it.

Let's break it to steps:

- Text Splitting & Chunking
- Embedding
- Vector Store
- Generation

All those steps we can code in golang.

I'm going to use local LLM and mlx apple AI framework. I need an openai-compatable API the [mlx-openai-server](https://github.com/cubist38/mlx-openai-server) works good.

> API server that provides OpenAI-compatible endpoints for MLX models.

The models I've used:

1. [mlx-community/Qwen3-4B-6bit](https://huggingface.co/mlx-community/Qwen3-4B-6bit)
1. [mlx-community/Qwen3-Embedding-0.6B-8bit](https://huggingface.co/mlx-community/Qwen3-Embedding-0.6B-8bit)

Here is configuration file:

```yaml
- model_path: mlx-community/Qwen3-4B-6bit
  model_type: lm
  context_length: 64000
  prompt_cache_size: 10
  enable_auto_tool_choice: true
  max_concurrency: 1
  tool_call_parser: qwen3_coder

- model_path: mlx-community/Qwen3-Embedding-0.6B-8bit
  model_type: embeddings
  context_length: 4000
  max_concurrency: 1
```

The backend is based on [langchaingo](https://tmc.github.io/langchaingo/docs/).

Vector database is redis.

The implementations is pretty simple.

1. **Document loading**: Markdown files are loaded
2. **Embedding**: Documents are converted to vectors using an embedding model
3. **Storage**: Vectors are stored in Redis for fast access
4. **Query**: User questions are embedded and searched (top-20 results)
5. **Generation**: LLM combines retrieved context with the query to generate answers

Here is an example how I query the information about [`conman`](https://github.com/iximiuz/conman).
I've an article about it in my library.

<video width="100%" height="auto" controls>
    <source src="/videos/showcase.mp4" type="video/mp4">
    Your browser does not support the video tag.
</video>

And just to check if model able to answer me without additional knowledge.
Let's question the model directly:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
   -H "Content-Type: application/json" \
   -d '{"model": "mlx-community/Qwen3-4B-6bit", "messages": [{"role": "user", "content": "Explain in simple words what is conman."}], "temperature": 0.7 }' | jq .

{
  "id": "chatcmpl_a47674f043174ea8b9c1d7d64bc7c919",
  "object": "chat.completion",
  "created": 1773737528,
  "model": "mlx-community/Qwen3-4B-6bit",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "<think>\nOkay, the user wants a simple explanation of what a conman is. Let me start by recalling the definition. A conman is someone who deceives others for money or other benefits. But I need to break it down into simple terms.\n\nFirst, I should define the key elements: deception, intent to deceive, and the purpose (like getting money). Maybe use an example to make it clearer. For instance, a conman might pretend to be a wealthy person to get money from someone else.\n\nWait, should I mention that it's illegal? Probably, since conman is a criminal act. But the user asked for simple words, so maybe not too detailed. Also, need to avoid jargon. Use everyday language.\n\nCheck if there's a common example people know. Maybe a fake job offer, or a scam where someone pretends to be a friend. Also, note that conmen use tricks or lies to trick others.\n\nMake sure to explain that it's not just any lie, but a deliberate and deceptive scheme. Maybe mention that they target people's trust or emotions. Avoid using technical terms. Keep it straightforward.\n\nAlso, think about the structure: start with a simple definition, then explain how they do it, maybe give an example, and mention the consequences. But the user might just want a basic definition. Let me confirm the main points.\n\nSo, conman is someone who lies to get money or benefits. They use tricks to deceive people. Examples could be fraud, scams, fake jobs. It's illegal and unethical. Make sure to keep it simple and clear.\n</think>\n\nA **conman** is someone who lies or tricks people to get money, goods, or other benefits. They use deception, like pretending to be someone else, creating fake situations, or exploiting people's trust, to cheat them out of something. For example, a conman might pretend to be a rich person to get money from someone else or fake a job offer to steal your time or money. It’s illegal and unethical, and conmen often target people’s emotions or trust to make them fall for their lies.",
        "role": "assistant",
        "partial": false
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1,
    "total_tokens": 432,
    "completion_tokens": 431,
    "prompt_tokens_details": {
      "cached_tokens": 17
    }
  }
}
```

The answer is:

> A **conman** is someone who lies or tricks people to get money, goods, or other benefits.

At the end I'm pretty exsited about this thing, without any additional fine-tune or some hard stuff like this I able to build a very cool thing just by myself.

The [sources of gorag-agent](https://github.com/roman-kiselenko/gorag-agent)

### Credits

- <small>[RAG from scratch](https://github.com/pguso/rag-from-scratch/tree/main?tab=readme-ov-file)</small>
- <small>[langchaingo](https://tmc.github.io/langchaingo/docs/)</small>
- <small>[chatGPT like UI components built for React](https://github.com/miskibin/chat-components/tree/main)</small>

Happy coding!
