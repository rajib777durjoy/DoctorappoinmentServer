import express from 'express';
import { llm } from '../AIModel/LLM.js';
import { ChatPromptTemplate } from "@langchain/core/prompts";
export const LLMRoute = express.Router();
LLMRoute.get('/AIAgent', async (req, res) => {
    console.log('AI agent route hit !!')
    const message = 'Hello AI agentm, I am Software Engineer Durjoy Chando !'
    const prompt = await ChatPromptTemplate.fromTemplate(`
You are an expert backend developer.

Always answer in Bangla.
Maximum 5 lines.

Question:
{question}
`);
    const chain = prompt.pipe(llm);
    const response = await chain.invoke({ question: message });
    res.send({ message: 'AI agent route hit !!', response })

})